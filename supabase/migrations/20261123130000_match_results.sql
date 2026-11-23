-- Design Ref: §5 저장할 데이터 — 경기 결과(match_results)와 순위표 (nice, Plan 작업 16번)
-- 경기 결과 입력은 그 경기에 참가하는 팀의 운영자만 한다. 세부 경기 기록은 참가 팀에게만 보이고,
-- 순위표는 참가 팀과 같은 시(가입 때 고른 시·구 기준)의 사용자에게 보인다. (PRD 7번)
-- 승점 계산은 앱 코드(lib/rules.ts)가 하고, 여기서는 승·무·패와 득실점의 합계만 돌려준다.

create table if not exists public.match_results (
  request_id uuid primary key references public.schedule_requests (id) on delete cascade,
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  -- 합의 요청의 보낸 팀(home)과 받은 팀(away)
  home_team_id uuid not null references public.teams (id) on delete cascade,
  away_team_id uuid not null references public.teams (id) on delete cascade,
  home_score int not null check (home_score between 0 and 99),
  away_score int not null check (away_score between 0 and 99),
  entered_by uuid not null references auth.users (id),
  entered_at timestamptz not null default now()
);

create index if not exists match_results_tournament_idx
  on public.match_results (tournament_id);

alter table public.match_results enable row level security;

-- 세부 경기 기록은 대회 참가 팀의 팀원만 볼 수 있다. (쓰기는 아래 함수로만 가능)
drop policy if exists "참가 팀원만 경기 결과 조회" on public.match_results;
create policy "참가 팀원만 경기 결과 조회" on public.match_results
  for select to authenticated using (public.is_tournament_participant(tournament_id));

-- 순위표를 볼 수 있는 사람: 참가 팀의 팀원이거나, 대회가 열린 시와 같은 시를 가입 때 고른 사용자
create or replace function public.can_view_standings(p_tournament_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select
    public.is_tournament_participant(p_tournament_id)
    or exists (
      select 1
      from public.tournaments t
      join public.profiles p on p.id = auth.uid()
      where t.id = p_tournament_id
        and t.status = 'confirmed'
        and p.city = t.city
    );
$$;

-- 경기 결과 입력/수정: 합의된 경기가 시작된 뒤, 그 경기를 하는 두 팀 중 한 팀의 운영자만
create or replace function public.record_match_result(
  p_request_id uuid,
  p_home_score int,
  p_away_score int
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.schedule_requests%rowtype;
  v_status text;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_request from public.schedule_requests where id = p_request_id;
  if not found or v_request.status <> 'accepted' then
    raise exception '합의된 경기만 결과를 입력할 수 있습니다.';
  end if;
  if not (public.is_team_operator(v_request.from_team_id)
          or public.is_team_operator(v_request.to_team_id)) then
    raise exception '경기를 하는 팀의 운영자만 결과를 입력할 수 있습니다.';
  end if;

  select status into v_status from public.tournaments where id = v_request.tournament_id;
  if v_status <> 'confirmed' then
    raise exception '확정된 대회의 경기만 결과를 입력할 수 있습니다.';
  end if;
  if v_request.proposed_at > now() then
    raise exception '경기가 시작된 뒤에 결과를 입력할 수 있습니다.';
  end if;
  if p_home_score not between 0 and 99 or p_away_score not between 0 and 99 then
    raise exception '점수는 0~99 사이여야 합니다.';
  end if;

  insert into public.match_results
    (request_id, tournament_id, home_team_id, away_team_id, home_score, away_score, entered_by)
  values
    (p_request_id, v_request.tournament_id, v_request.from_team_id, v_request.to_team_id,
     p_home_score, p_away_score, auth.uid())
  on conflict (request_id) do update
    set home_score = excluded.home_score,
        away_score = excluded.away_score,
        entered_by = excluded.entered_by,
        entered_at = now();
end;
$$;

-- 참가 팀에게 보여 주는 경기 결과 목록(팀 이름 포함)
create or replace function public.tournament_results(p_tournament_id uuid)
returns table (
  request_id uuid,
  home_team_id uuid,
  home_team_name text,
  away_team_id uuid,
  away_team_name text,
  home_score int,
  away_score int,
  played_at timestamptz
)
language sql
security definer
stable
set search_path = ''
as $$
  select r.request_id, r.home_team_id, h.name, r.away_team_id, a.name,
         r.home_score, r.away_score, s.proposed_at
  from public.match_results r
  join public.teams h on h.id = r.home_team_id
  join public.teams a on a.id = r.away_team_id
  join public.schedule_requests s on s.id = r.request_id
  where r.tournament_id = p_tournament_id
    and public.is_tournament_participant(p_tournament_id)
  order by s.proposed_at;
$$;

-- 순위표 재료: 진행 중인 참가 팀마다 경기 수·승·무·패·득점·실점 (승점·순위는 앱이 계산한다)
create or replace function public.tournament_standings(p_tournament_id uuid)
returns table (
  team_id uuid,
  team_name text,
  played int,
  won int,
  drawn int,
  lost int,
  goals_for int,
  goals_against int
)
language sql
security definer
stable
set search_path = ''
as $$
  with games as (
    select home_team_id as team_id, home_score as gf, away_score as ga
    from public.match_results where tournament_id = p_tournament_id
    union all
    select away_team_id, away_score, home_score
    from public.match_results where tournament_id = p_tournament_id
  )
  select
    tt.team_id,
    t.name,
    count(g.team_id)::int,
    count(*) filter (where g.gf > g.ga)::int,
    count(*) filter (where g.gf = g.ga)::int,
    count(*) filter (where g.gf < g.ga)::int,
    coalesce(sum(g.gf), 0)::int,
    coalesce(sum(g.ga), 0)::int
  from public.tournament_teams tt
  join public.teams t on t.id = tt.team_id
  left join games g on g.team_id = tt.team_id
  where tt.tournament_id = p_tournament_id
    and tt.status = 'active'
    and public.can_view_standings(p_tournament_id)
  group by tt.team_id, t.name;
$$;

-- 순위표 화면의 대회 정보(종목·시·시작일). 순위표를 볼 수 있는 사람에게만 돌려준다.
create or replace function public.tournament_public_info(p_tournament_id uuid)
returns table (id uuid, sport text, city text, starts_on date, status text)
language sql
security definer
stable
set search_path = ''
as $$
  select t.id, t.sport, t.city, t.starts_on, t.status
  from public.tournaments t
  where t.id = p_tournament_id and public.can_view_standings(p_tournament_id);
$$;

-- 내가 가입 때 고른 시에서 열리는 확정 대회 목록 (순위표 보기용)
create or replace function public.my_city_tournaments()
returns table (id uuid, sport text, city text, starts_on date)
language sql
security definer
stable
set search_path = ''
as $$
  select t.id, t.sport, t.city, t.starts_on
  from public.tournaments t
  join public.profiles p on p.id = auth.uid()
  where t.status = 'confirmed' and t.city = p.city
  order by t.starts_on desc
  limit 20;
$$;

revoke all on function public.can_view_standings(uuid) from public, anon;
revoke all on function public.record_match_result(uuid, int, int) from public, anon;
revoke all on function public.tournament_results(uuid) from public, anon;
revoke all on function public.tournament_standings(uuid) from public, anon;
revoke all on function public.tournament_public_info(uuid) from public, anon;
revoke all on function public.my_city_tournaments() from public, anon;
grant execute on function public.can_view_standings(uuid) to authenticated;
grant execute on function public.record_match_result(uuid, int, int) to authenticated;
grant execute on function public.tournament_results(uuid) to authenticated;
grant execute on function public.tournament_standings(uuid) to authenticated;
grant execute on function public.tournament_public_info(uuid) to authenticated;
grant execute on function public.my_city_tournaments() to authenticated;
