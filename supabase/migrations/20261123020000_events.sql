-- Design Ref: §5 저장할 데이터 — 일정(events)
-- Plan 작업 4번: 연습·모의 모임 일정 등록
-- 지원자 조사(5번), 선수 확정(6번), 출석 투표(7번), 대회 연결(11~13번)에 필요한 칸은 그 작업에서 추가한다.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  -- practice: 연습·모의 모임 / tournament: 대회 경기 (대회 경기는 매칭 기능에서 자동으로 만든다)
  type text not null check (type in ('practice', 'tournament')),
  starts_at timestamptz not null,
  location text not null check (char_length(location) between 1 and 60),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'confirmed', 'cancelled')),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists events_team_starts_idx
  on public.events (team_id, starts_at);

alter table public.events enable row level security;

-- 같은 팀원만 일정을 볼 수 있다.
drop policy if exists "팀원만 일정 조회" on public.events;
create policy "팀원만 일정 조회" on public.events
  for select to authenticated using (public.is_team_member(team_id));

-- 연습 일정은 같은 팀 운영자만 만들 수 있다. (대회 경기 일정은 직접 만들 수 없다)
drop policy if exists "운영자만 연습 일정 생성" on public.events;
create policy "운영자만 연습 일정 생성" on public.events
  for insert to authenticated
  with check (
    public.is_team_operator(team_id)
    and created_by = auth.uid()
    and type = 'practice'
  );
