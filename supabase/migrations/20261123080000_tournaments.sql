-- Design Ref: §5 저장할 데이터 — 대회(tournaments), 대회 참가 팀(tournament_teams)
-- Plan 작업 10번: 신청 마감 뒤 매칭 결과로 만들어지는 대회. 만들고 고치는 일은 서버 전용 키(예약 작업)만 한다.
-- 3일 참가 여부 응답(작업 11번)·4일 경기 일정(작업 12번)이 이 표를 이어서 쓴다.

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  sport text not null,
  city text not null,
  starts_on date not null,
  -- deciding = 참가 여부 결정 중 / confirmed = 확정 / cancelled = 취소
  status text not null default 'deciding' check (status in ('deciding', 'confirmed', 'cancelled')),
  cancel_reason text,
  -- 각 단계의 마감 시각(예약 작업이 읽는다): 참가 여부 결정(신청 마감 +3일), 경기 일정 확정(+7일)
  decision_deadline_at timestamptz not null,
  schedule_deadline_at timestamptz not null,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create table if not exists public.tournament_teams (
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  application_id uuid not null references public.tournament_applications (id) on delete cascade,
  -- active = 진행 / cancelled = 미응답 과반 등으로 취소
  status text not null default 'active' check (status in ('active', 'cancelled')),
  -- 매칭 당시의 팀 인원·경력(신청 값)을 대회 화면에 그대로 보여 준다.
  team_size int not null,
  career_months int not null,
  primary key (tournament_id, team_id)
);

create index if not exists tournament_teams_team_idx on public.tournament_teams (team_id);

alter table public.tournaments enable row level security;
alter table public.tournament_teams enable row level security;

-- 내 팀이 참가한 대회인지 (접근 규칙에서 쓰는 도우미)
create or replace function public.is_tournament_participant(p_tournament_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.tournament_teams tt
    join public.team_members m on m.team_id = tt.team_id
    where tt.tournament_id = p_tournament_id and m.user_id = auth.uid()
  );
$$;

revoke all on function public.is_tournament_participant(uuid) from public, anon;
grant execute on function public.is_tournament_participant(uuid) to authenticated;

-- 대회와 참가 팀 목록은 참가 팀의 팀원만 볼 수 있다. (PRD 7번: 팀 정보는 같은 팀원과 대회 참가 팀)
drop policy if exists "참가 팀원만 대회 조회" on public.tournaments;
create policy "참가 팀원만 대회 조회" on public.tournaments
  for select to authenticated using (public.is_tournament_participant(id));

drop policy if exists "참가 팀원만 참가 팀 조회" on public.tournament_teams;
create policy "참가 팀원만 참가 팀 조회" on public.tournament_teams
  for select to authenticated using (public.is_tournament_participant(tournament_id));

-- 참가 팀 화면에 보여 줄 팀 이름·지역: 팀 표는 같은 팀원만 읽을 수 있으므로 함수로 이름만 돌려준다.
create or replace function public.tournament_participants(p_tournament_id uuid)
returns table (
  team_id uuid,
  team_name text,
  district text,
  team_size int,
  career_months int,
  status text,
  is_mine boolean
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    tt.team_id,
    t.name,
    t.district,
    tt.team_size,
    tt.career_months,
    tt.status,
    public.is_team_member(tt.team_id)
  from public.tournament_teams tt
  join public.teams t on t.id = tt.team_id
  where tt.tournament_id = p_tournament_id
    and public.is_tournament_participant(p_tournament_id)
  order by tt.career_months, tt.team_size, t.name;
$$;

revoke all on function public.tournament_participants(uuid) from public, anon;
grant execute on function public.tournament_participants(uuid) to authenticated;
