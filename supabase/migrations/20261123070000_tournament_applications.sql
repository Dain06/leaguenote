-- Design Ref: §5 저장할 데이터 — 대회 참가 신청(tournament_applications)
-- Plan 작업 9번: 운영자가 종목·팀 인원(규모)·팀 경력(개월)·희망 대회 시작일을 입력해 신청한다.
-- 신청 마감은 대회 시작 3주 전이며, 마감 시각은 앱 코드(lib/rules.ts)가 계산해 신청에 한 번 저장한다.

create table if not exists public.tournament_applications (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  -- 신청 당시 팀의 종목·지역을 그대로 옮겨 둔다. (매칭은 같은 종목·같은 시끼리 묶는다)
  sport text not null,
  city text not null,
  district text not null,
  -- 운영자가 신청 때 직접 입력하는 값
  team_size int not null check (team_size between 1 and 100),
  career_months int not null check (career_months between 0 and 600),
  -- 희망 대회 시작일(한국 날짜)과 신청 마감 시각(시작일 0시 - 3주)
  tournament_starts_on date not null,
  deadline_at timestamptz not null,
  status text not null default 'waiting' check (status in ('waiting', 'matched', 'excluded')),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  -- 같은 팀이 같은 대회 시작일에 중복 신청하지 못하게 한다.
  unique (team_id, tournament_starts_on)
);

create index if not exists tournament_applications_matching_idx
  on public.tournament_applications (sport, city, tournament_starts_on)
  where status = 'waiting';

alter table public.tournament_applications enable row level security;

-- 신청 내용은 같은 팀원이 볼 수 있다. (다른 팀에는 보이지 않는다)
drop policy if exists "팀원만 신청 조회" on public.tournament_applications;
create policy "팀원만 신청 조회" on public.tournament_applications
  for select to authenticated using (public.is_team_member(team_id));

-- 운영자는 마감 전, 매칭 대기 중인 신청만 취소할 수 있다.
drop policy if exists "운영자만 대기 신청 취소" on public.tournament_applications;
create policy "운영자만 대기 신청 취소" on public.tournament_applications
  for delete to authenticated
  using (
    public.is_team_operator(team_id)
    and status = 'waiting'
    and deadline_at > now()
  );

-- 신청하기: 운영자만, 마감 전에만. 종목·지역은 팀에 저장된 값을 쓰므로 신청자가 바꿀 수 없다.
create or replace function public.apply_tournament(
  p_team_id uuid,
  p_team_size int,
  p_career_months int,
  p_starts_on date,
  p_deadline_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team public.teams%rowtype;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if not public.is_team_operator(p_team_id) then
    raise exception '팀 운영자만 신청할 수 있습니다.';
  end if;
  if p_deadline_at <= now() then
    raise exception '신청 마감이 지났습니다.';
  end if;

  select * into v_team from public.teams where id = p_team_id;

  insert into public.tournament_applications (
    team_id, sport, city, district, team_size, career_months,
    tournament_starts_on, deadline_at, created_by
  )
  values (
    p_team_id, v_team.sport, v_team.city, v_team.district, p_team_size, p_career_months,
    p_starts_on, p_deadline_at, auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.apply_tournament(uuid, int, int, date, timestamptz) from public, anon;
grant execute on function public.apply_tournament(uuid, int, int, date, timestamptz) to authenticated;
