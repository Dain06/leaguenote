-- Design Ref: §9 시험 데이터 — 매칭 점검용 가상 팀 (Plan 작업 8번)
-- 실제 팀과 섞이지 않도록 teams에 "가상 데이터" 표시를 달고,
-- 팀 인원·팀 경력(대회 참가 신청에서 입력할 값)은 별도 표에 둔다.

alter table public.teams
  add column if not exists is_demo boolean not null default false;

-- 가상 팀의 팀 인원(규모)과 팀 경력(개월). 작업 9번 참가 신청을 시험할 때 이 값으로 신청 자료를 만든다.
create table if not exists public.demo_team_profiles (
  team_id uuid primary key references public.teams (id) on delete cascade,
  team_size int not null check (team_size between 1 and 100),
  career_months int not null check (career_months >= 0),
  note text not null default ''
);

-- 서버 전용(서비스 키)으로만 읽고 쓴다. 로그인 사용자·익명에게는 열지 않는다.
alter table public.demo_team_profiles enable row level security;
revoke all on public.demo_team_profiles from anon, authenticated;

-- 종목 추천에 가상 팀의 종목이 섞이지 않게 한다.
create or replace function public.popular_sports()
returns table (sport text, typical_players int)
language sql
security definer
stable
set search_path = ''
as $$
  select
    t.sport,
    (mode() within group (order by t.required_players))::int as typical_players
  from public.teams t
  where not t.is_demo
  group by t.sport
  order by count(*) desc, t.sport
  limit 30;
$$;
