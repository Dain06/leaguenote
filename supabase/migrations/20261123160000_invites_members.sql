-- 보안 점검 2번 반영: 초대 링크 관리와 팀원 내보내기·탈퇴
--  - 새 초대 링크를 만들면 이전 링크는 바로 만료된다. 운영자가 링크를 끌 수 있다.
--  - 초대 한 개로 들어올 수 있는 사람 수에 한도를 둔다(기본 30명, 임시).
--  - 운영자는 팀원을 내보낼 수 있고, 팀원은 스스로 팀을 나갈 수 있다. (운영자는 내보내거나 나갈 수 없다)

alter table public.invites
  add column if not exists use_count int not null default 0,
  add column if not exists max_uses int not null default 30 check (max_uses between 1 and 100);

-- 초대 만들기는 함수로만 한다. (직접 삽입하면 이전 링크가 그대로 살아 있게 되므로 막는다)
drop policy if exists "운영자만 초대 생성" on public.invites;

create or replace function public.create_invite(p_team_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if auth.uid() is null or not public.is_team_operator(p_team_id) then
    raise exception '팀 운영자만 초대 링크를 만들 수 있습니다.';
  end if;

  -- 이전에 만든 링크는 모두 바로 만료시킨다.
  update public.invites set expires_at = now()
  where team_id = p_team_id and expires_at > now();

  insert into public.invites (team_id, created_by)
  values (p_team_id, auth.uid())
  returning code into v_code;

  return v_code;
end;
$$;

create or replace function public.revoke_invites(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_team_operator(p_team_id) then
    raise exception '팀 운영자만 초대 링크를 끌 수 있습니다.';
  end if;
  update public.invites set expires_at = now()
  where team_id = p_team_id and expires_at > now();
end;
$$;

-- 초대 수락: 만료되지 않았고 사용 한도가 남은 링크만. 새로 들어온 경우에만 사용 횟수를 올린다.
create or replace function public.accept_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.invites%rowtype;
  v_rows int;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_invite
  from public.invites
  where code = p_code and expires_at > now() and use_count < max_uses
  for update;

  if not found then
    raise exception '유효하지 않거나 만료된 초대입니다.';
  end if;

  insert into public.team_members (team_id, user_id, role)
  values (v_invite.team_id, auth.uid(), 'member')
  on conflict do nothing;

  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    update public.invites set use_count = use_count + 1 where id = v_invite.id;
  end if;

  return v_invite.team_id;
end;
$$;

create or replace function public.invite_preview(p_code text)
returns table (team_name text, sport text)
language sql
security definer
stable
set search_path = ''
as $$
  select t.name, t.sport
  from public.invites i
  join public.teams t on t.id = i.team_id
  where i.code = p_code and i.expires_at > now() and i.use_count < i.max_uses;
$$;

-- 팀을 떠나는 사람의 앞으로 열릴 일정·대회 응답 기록을 정리한다. (지난 일정의 기록은 남긴다)
-- 내부에서만 쓰는 함수라 어떤 역할에도 실행 권한을 주지 않는다.
create or replace function public.cleanup_member_data(p_team_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.attendance
  where user_id = p_user_id
    and event_id in (select id from public.events where team_id = p_team_id and starts_at > now());
  delete from public.event_roster
  where user_id = p_user_id and not is_mercenary
    and event_id in (select id from public.events where team_id = p_team_id and starts_at > now());
  delete from public.event_responses
  where user_id = p_user_id
    and event_id in (select id from public.events where team_id = p_team_id and starts_at > now());
  delete from public.tournament_responses
  where user_id = p_user_id and team_id = p_team_id
    and tournament_id in (select id from public.tournaments where status = 'deciding');
  delete from public.team_members where team_id = p_team_id and user_id = p_user_id;
end;
$$;
revoke all on function public.cleanup_member_data(uuid, uuid) from public, anon, authenticated;

-- 팀원 내보내기: 운영자만, 일반 팀원만
create or replace function public.remove_team_member(p_team_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_name text;
begin
  if auth.uid() is null or not public.is_team_operator(p_team_id) then
    raise exception '팀 운영자만 팀원을 내보낼 수 있습니다.';
  end if;
  if not exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = p_user_id and role = 'member'
  ) then
    raise exception '내보낼 수 있는 팀원이 아닙니다. (운영자는 내보낼 수 없습니다)';
  end if;

  select name into v_team_name from public.teams where id = p_team_id;
  perform public.cleanup_member_data(p_team_id, p_user_id);

  insert into public.notifications (user_id, kind, message, link)
  values (p_user_id, 'team_removed', left(v_team_name || ' 팀에서 제외되었습니다.', 200), '/');
end;
$$;

-- 팀 나가기: 일반 팀원 본인만 (운영자는 나갈 수 없다)
create or replace function public.leave_team(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_name text;
  v_nickname text;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if not exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = auth.uid() and role = 'member'
  ) then
    raise exception '나갈 수 있는 팀원이 아닙니다. (운영자는 팀을 나갈 수 없습니다)';
  end if;

  select name into v_team_name from public.teams where id = p_team_id;
  select nickname into v_nickname from public.profiles where id = auth.uid();
  perform public.cleanup_member_data(p_team_id, auth.uid());

  insert into public.notifications (user_id, kind, message, link)
  select m.user_id, 'team_left', left(coalesce(v_nickname, '팀원') || '님이 ' || v_team_name || ' 팀을 나갔습니다.', 200), '/teams/' || p_team_id
  from public.team_members m
  where m.team_id = p_team_id and m.role = 'operator';
end;
$$;

revoke all on function public.create_invite(uuid) from public, anon;
revoke all on function public.revoke_invites(uuid) from public, anon;
revoke all on function public.remove_team_member(uuid, uuid) from public, anon;
revoke all on function public.leave_team(uuid) from public, anon;
grant execute on function public.create_invite(uuid) to authenticated;
grant execute on function public.revoke_invites(uuid) to authenticated;
grant execute on function public.remove_team_member(uuid, uuid) to authenticated;
grant execute on function public.leave_team(uuid) to authenticated;
