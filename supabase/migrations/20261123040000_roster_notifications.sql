-- Design Ref: §5 저장할 데이터 — 선수 확정(event_roster), 알림(notifications)
-- Plan 작업 6번: 일정 및 선수 확정, 최소 인원 미달 시 운영자 알림
-- 확정 마감(출석 투표 게시 전까지)과 최소 인원 값은 규칙 값이므로 lib/rules.ts에서 앱이 확인한다.

-- ---------------------------------------------------------------------------
-- 선수 확정
-- ---------------------------------------------------------------------------
create table if not exists public.event_roster (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  confirmed_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.event_roster enable row level security;

-- 같은 팀원만 확정 선수를 볼 수 있다. (확정·변경은 아래 함수로만 가능)
drop policy if exists "팀원만 확정 선수 조회" on public.event_roster;
create policy "팀원만 확정 선수 조회" on public.event_roster
  for select to authenticated
  using (
    public.is_team_member(
      (select e.team_id from public.events e where e.id = event_id)
    )
  );

-- 선수 확정: 운영자만, 참석 의향을 남긴 팀원 중에서 고른다. 기존 확정은 새 선택으로 바뀐다.
create or replace function public.confirm_roster(p_event_id uuid, p_user_ids uuid[])
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team uuid;
  v_status text;
  v_ids uuid[];
  v_count int;
begin
  select team_id, status into v_team, v_status
  from public.events where id = p_event_id;

  if v_team is null or not public.is_team_operator(v_team) then
    raise exception '선수 확정은 팀 운영자만 할 수 있습니다.';
  end if;
  if v_status = 'cancelled' then
    raise exception '취소된 일정입니다.';
  end if;

  select coalesce(array_agg(distinct u), '{}') into v_ids
  from unnest(coalesce(p_user_ids, '{}')) as u;

  if exists (
    select 1 from unnest(v_ids) as u
    where not exists (
      select 1 from public.event_responses r
      where r.event_id = p_event_id and r.user_id = u and r.response = 'attend'
    )
  ) then
    raise exception '참석 의향을 남긴 팀원만 선수로 확정할 수 있습니다.';
  end if;

  delete from public.event_roster where event_id = p_event_id;
  insert into public.event_roster (event_id, user_id)
  select p_event_id, u from unnest(v_ids) as u;

  v_count := coalesce(array_length(v_ids, 1), 0);
  update public.events
  set status = case when v_count > 0 then 'confirmed' else 'scheduled' end
  where id = p_event_id;

  return v_count;
end;
$$;

-- 조사 현황 함수에 "확정 선수 여부"를 더한다. (반환 형태가 바뀌어 새로 만든다)
drop function if exists public.event_survey(uuid);
create function public.event_survey(p_event_id uuid)
returns table (
  user_id uuid,
  nickname text,
  role text,
  response text,
  confirmed boolean
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    m.user_id,
    p.nickname,
    m.role,
    r.response,
    (ro.user_id is not null) as confirmed
  from public.events e
  join public.team_members m on m.team_id = e.team_id
  join public.profiles p on p.id = m.user_id
  left join public.event_responses r
    on r.event_id = e.id and r.user_id = m.user_id
  left join public.event_roster ro
    on ro.event_id = e.id and ro.user_id = m.user_id
  where e.id = p_event_id
    and public.is_team_member(e.team_id)
  order by (m.role = 'operator') desc, m.joined_at;
$$;

-- ---------------------------------------------------------------------------
-- 알림 (앱 안 알림함)
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  message text not null check (char_length(message) <= 200),
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- 알림은 받는 사람 본인만 보고, "읽음 시각"만 고칠 수 있다.
drop policy if exists "본인 알림 조회" on public.notifications;
create policy "본인 알림 조회" on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "본인 알림 읽음 처리" on public.notifications;
create policy "본인 알림 읽음 처리" on public.notifications
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- 팀 운영자에게 알림 보내기: 같은 팀 운영자만 부를 수 있고, 팀의 모든 운영자에게 한 건씩 남긴다.
create or replace function public.notify_team_operators(
  p_team_id uuid,
  p_kind text,
  p_message text,
  p_link text
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  if not public.is_team_operator(p_team_id) then
    raise exception '팀 운영자만 알림을 보낼 수 있습니다.';
  end if;

  insert into public.notifications (user_id, kind, message, link)
  select m.user_id, p_kind, left(p_message, 200), p_link
  from public.team_members m
  where m.team_id = p_team_id and m.role = 'operator';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- 함수는 로그인한 사용자만 부를 수 있게 한다.
-- ---------------------------------------------------------------------------
revoke all on function public.confirm_roster(uuid, uuid[]) from public, anon;
revoke all on function public.event_survey(uuid) from public, anon;
revoke all on function public.notify_team_operators(uuid, text, text, text) from public, anon;

grant execute on function public.confirm_roster(uuid, uuid[]) to authenticated;
grant execute on function public.event_survey(uuid) to authenticated;
grant execute on function public.notify_team_operators(uuid, text, text, text) to authenticated;
