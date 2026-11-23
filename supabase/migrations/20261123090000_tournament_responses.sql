-- Design Ref: §5 저장할 데이터 — 대회 참가 여부 응답(tournament_responses)
-- Plan 작업 11번: 매칭된 팀의 팀원이 3일 안에 참가/불참을 응답한다.
-- 확정·취소 판정은 서버(예약 작업·응답 직후)가 서버 전용 키로 한다.

create table if not exists public.tournament_responses (
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  response text not null check (response in ('join', 'decline')),
  responded_at timestamptz not null default now(),
  primary key (tournament_id, team_id, user_id)
);

alter table public.tournament_responses enable row level security;

-- 내 응답만 볼 수 있다. (쓰기는 아래 함수로만 가능)
drop policy if exists "본인 응답 조회" on public.tournament_responses;
create policy "본인 응답 조회" on public.tournament_responses
  for select to authenticated using (user_id = auth.uid());

-- 응답하기: 참가 여부를 받는 중(결정 중 + 기한 전)일 때만, 내 팀(들)의 응답으로 저장한다. 다시 응답하면 바뀐다.
create or replace function public.respond_tournament(p_tournament_id uuid, p_response text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_count int;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_response not in ('join', 'decline') then
    raise exception '응답 값이 올바르지 않습니다.';
  end if;

  select * into v_tournament from public.tournaments where id = p_tournament_id;
  if not found or not public.is_tournament_participant(p_tournament_id) then
    raise exception '참가 팀의 팀원만 응답할 수 있습니다.';
  end if;
  if v_tournament.status <> 'deciding' or v_tournament.decision_deadline_at <= now() then
    raise exception '참가 여부를 받는 기간이 아닙니다.';
  end if;

  insert into public.tournament_responses (tournament_id, team_id, user_id, response)
  select p_tournament_id, tt.team_id, auth.uid(), p_response
  from public.tournament_teams tt
  where tt.tournament_id = p_tournament_id
    and tt.status = 'active'
    and public.is_team_member(tt.team_id)
  on conflict (tournament_id, team_id, user_id)
  do update set response = excluded.response, responded_at = now();

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception '참가 중인 팀의 팀원만 응답할 수 있습니다.';
  end if;
end;
$$;

-- 팀별 응답 현황(팀원 수, 응답한 수, 참가라고 한 수). 이름이나 개인별 응답은 담지 않는다.
create or replace function public.tournament_response_summary(p_tournament_id uuid)
returns table (team_id uuid, member_count int, responded_count int, join_count int)
language sql
security definer
stable
set search_path = ''
as $$
  select
    tt.team_id,
    (select count(*) from public.team_members m where m.team_id = tt.team_id)::int,
    (select count(*) from public.tournament_responses r
       where r.tournament_id = tt.tournament_id and r.team_id = tt.team_id)::int,
    (select count(*) from public.tournament_responses r
       where r.tournament_id = tt.tournament_id and r.team_id = tt.team_id and r.response = 'join')::int
  from public.tournament_teams tt
  where tt.tournament_id = p_tournament_id
    and public.is_tournament_participant(p_tournament_id);
$$;

revoke all on function public.respond_tournament(uuid, text) from public, anon;
revoke all on function public.tournament_response_summary(uuid) from public, anon;
grant execute on function public.respond_tournament(uuid, text) to authenticated;
grant execute on function public.tournament_response_summary(uuid) to authenticated;
