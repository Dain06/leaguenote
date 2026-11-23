-- Design Ref: §5 저장할 데이터 — 일정 조율 요청(schedule_requests)
-- Plan 작업 12번: 확정된 대회에서 두 팀이 플랫폼 안에서 경기 일정을 주고받는다. (최대 4일, 신청 마감 +7일까지)
-- 합의(수락)되면 양 팀의 "대회 경기" 일정이 자동으로 만들어진다. 그 일정 만들기는 서버가 서버 전용 키로 한다.

create table if not exists public.schedule_requests (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  from_team_id uuid not null references public.teams (id) on delete cascade,
  to_team_id uuid not null references public.teams (id) on delete cascade,
  proposed_at timestamptz not null,
  location text not null check (char_length(location) between 1 and 60),
  -- pending 대기 / accepted 수락(합의) / rejected 거절 / withdrawn 보낸 팀이 철회
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'withdrawn')),
  requested_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (from_team_id <> to_team_id)
);

-- 같은 두 팀 사이에는 대기 중이거나 합의된 요청이 하나만 있을 수 있다. (방향은 따지지 않는다)
create unique index if not exists schedule_requests_open_pair_idx
  on public.schedule_requests (
    tournament_id,
    least(from_team_id, to_team_id),
    greatest(from_team_id, to_team_id)
  )
  where status in ('pending', 'accepted');

-- 대회 경기 일정이 어느 대회·어느 합의에서 생겼는지 남긴다.
alter table public.events
  add column if not exists tournament_id uuid references public.tournaments (id) on delete set null,
  add column if not exists schedule_request_id uuid references public.schedule_requests (id) on delete set null;

-- 대회 일정 확정 처리를 알렸는지(한 번만 알리기 위해)
alter table public.tournaments
  add column if not exists schedule_notified_at timestamptz;

alter table public.schedule_requests enable row level security;

-- 요청은 보낸 팀·받은 팀 팀원만 직접 볼 수 있다. (쓰기는 아래 함수나 서버만 한다)
drop policy if exists "관련 팀원만 요청 조회" on public.schedule_requests;
create policy "관련 팀원만 요청 조회" on public.schedule_requests
  for select to authenticated
  using (public.is_team_member(from_team_id) or public.is_team_member(to_team_id));

-- 요청 보내기: 우리 팀 운영자만, 일정 조율 기간 안에, 대회 시작일 이후 시각으로.
create or replace function public.propose_schedule(
  p_tournament_id uuid,
  p_from_team_id uuid,
  p_to_team_id uuid,
  p_proposed_at timestamptz,
  p_location text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if not public.is_team_operator(p_from_team_id) then
    raise exception '팀 운영자만 일정을 제안할 수 있습니다.';
  end if;
  if p_from_team_id = p_to_team_id then
    raise exception '같은 팀에는 제안할 수 없습니다.';
  end if;

  select * into v_tournament from public.tournaments where id = p_tournament_id;
  if not found or v_tournament.status <> 'confirmed' then
    raise exception '확정된 대회에서만 일정을 조율할 수 있습니다.';
  end if;
  if v_tournament.schedule_deadline_at <= now() then
    raise exception '경기 일정 조율 기간이 끝났습니다.';
  end if;

  if (select count(*) from public.tournament_teams
        where tournament_id = p_tournament_id and status = 'active'
          and team_id in (p_from_team_id, p_to_team_id)) <> 2 then
    raise exception '대회에 참가 중인 두 팀 사이에서만 조율할 수 있습니다.';
  end if;

  if p_proposed_at <= now() then
    raise exception '지금 이후의 시각을 제안해 주세요.';
  end if;
  if p_proposed_at < (v_tournament.starts_on::timestamp at time zone 'Asia/Seoul') then
    raise exception '경기는 대회 시작일 이후로 제안해 주세요.';
  end if;

  begin
    insert into public.schedule_requests
      (tournament_id, from_team_id, to_team_id, proposed_at, location, requested_by)
    values
      (p_tournament_id, p_from_team_id, p_to_team_id, p_proposed_at, trim(p_location), auth.uid())
    returning id into v_id;
  exception when unique_violation then
    raise exception '두 팀 사이에 이미 대기 중이거나 합의된 일정이 있습니다.';
  end;

  return v_id;
end;
$$;

-- 받은 요청 거절: 받은 팀 운영자만
create or replace function public.reject_schedule_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.schedule_requests%rowtype;
begin
  select * into v_request from public.schedule_requests where id = p_request_id;
  if not found or not public.is_team_operator(v_request.to_team_id) then
    raise exception '받은 팀 운영자만 거절할 수 있습니다.';
  end if;
  update public.schedule_requests
    set status = 'rejected', responded_at = now()
    where id = p_request_id and status = 'pending';
end;
$$;

-- 보낸 요청 철회: 보낸 팀 운영자만
create or replace function public.withdraw_schedule_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.schedule_requests%rowtype;
begin
  select * into v_request from public.schedule_requests where id = p_request_id;
  if not found or not public.is_team_operator(v_request.from_team_id) then
    raise exception '보낸 팀 운영자만 철회할 수 있습니다.';
  end if;
  update public.schedule_requests
    set status = 'withdrawn', responded_at = now()
    where id = p_request_id and status = 'pending';
end;
$$;

-- 대회 화면용 요청 목록: 합의된 경기는 참가 팀 모두에게, 그 밖의 요청은 보낸·받은 팀 팀원에게만 돌려준다.
create or replace function public.tournament_schedule_requests(p_tournament_id uuid)
returns table (
  id uuid,
  from_team_id uuid,
  from_team_name text,
  to_team_id uuid,
  to_team_name text,
  proposed_at timestamptz,
  location text,
  status text,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    r.id, r.from_team_id, f.name, r.to_team_id, t.name,
    r.proposed_at, r.location, r.status, r.created_at
  from public.schedule_requests r
  join public.teams f on f.id = r.from_team_id
  join public.teams t on t.id = r.to_team_id
  where r.tournament_id = p_tournament_id
    and public.is_tournament_participant(p_tournament_id)
    and (
      r.status = 'accepted'
      or public.is_team_member(r.from_team_id)
      or public.is_team_member(r.to_team_id)
    )
  order by r.created_at desc;
$$;

revoke all on function public.propose_schedule(uuid, uuid, uuid, timestamptz, text) from public, anon;
revoke all on function public.reject_schedule_request(uuid) from public, anon;
revoke all on function public.withdraw_schedule_request(uuid) from public, anon;
revoke all on function public.tournament_schedule_requests(uuid) from public, anon;
grant execute on function public.propose_schedule(uuid, uuid, uuid, timestamptz, text) to authenticated;
grant execute on function public.reject_schedule_request(uuid) to authenticated;
grant execute on function public.withdraw_schedule_request(uuid) to authenticated;
grant execute on function public.tournament_schedule_requests(uuid) to authenticated;
