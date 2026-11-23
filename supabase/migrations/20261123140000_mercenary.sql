-- Design Ref: §5 저장할 데이터 — 용병 모집 글(mercenary_posts)·지원(mercenary_applications) (nice, Plan 작업 17번)
-- 용병 글은 로그인한 모든 사용자에게 보이되, 일정의 시간·종목·지역·필요 인원만 담는다. 상세 장소와 팀 이름은 담지 않는다. (PRD 7번)
-- 운영자가 지원자를 수락하면 그 일정의 확정 선수 명단(event_roster)에 "용병"으로 반영되고,
-- 수락된 지원자에게는 알림으로 장소를 알려 준다.

-- ---------------------------------------------------------------------------
-- 확정 선수 명단에 용병 표시
-- ---------------------------------------------------------------------------
alter table public.event_roster
  add column if not exists is_mercenary boolean not null default false;

-- 선수 확정: 팀원 선택은 새 선택으로 바뀌고, 이미 수락된 용병은 그대로 둔다. 돌려주는 값은 용병을 포함한 확정 인원이다.
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
  v_total int;
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

  delete from public.event_roster where event_id = p_event_id and not is_mercenary;
  insert into public.event_roster (event_id, user_id)
  select p_event_id, u from unnest(v_ids) as u
  on conflict do nothing;

  select count(*) into v_total from public.event_roster where event_id = p_event_id;
  update public.events
  set status = case when v_total > 0 then 'confirmed' else 'scheduled' end
  where id = p_event_id;

  return v_total;
end;
$$;

-- 출석 현황은 팀원 선수만 센다. (용병은 팀 일정 화면을 볼 수 없으므로 출석 투표 대상이 아니다)
create or replace function public.event_attendance(p_event_id uuid)
returns table (
  user_id uuid,
  nickname text,
  response text
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    ro.user_id,
    p.nickname,
    a.response
  from public.events e
  join public.event_roster ro on ro.event_id = e.id and not ro.is_mercenary
  join public.profiles p on p.id = ro.user_id
  left join public.attendance a
    on a.event_id = e.id and a.user_id = ro.user_id
  where e.id = p_event_id
    and public.is_team_member(e.team_id)
  order by p.nickname;
$$;

-- ---------------------------------------------------------------------------
-- 용병 모집 글과 지원
-- ---------------------------------------------------------------------------
create table if not exists public.mercenary_posts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  -- 공개되는 정보: 시간·종목·지역·필요 인원 (장소와 팀 이름은 일부러 담지 않는다)
  sport text not null,
  city text not null,
  district text not null,
  starts_at timestamptz not null,
  needed_count int not null check (needed_count between 1 and 10),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

-- 한 일정에 모집 중인 글은 하나만 둔다.
create unique index if not exists mercenary_posts_open_event_idx
  on public.mercenary_posts (event_id) where status = 'open';

create table if not exists public.mercenary_applications (
  post_id uuid not null references public.mercenary_posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- applied 지원 / accepted 수락 / rejected 거절
  status text not null default 'applied' check (status in ('applied', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.mercenary_posts enable row level security;
alter table public.mercenary_applications enable row level security;

drop policy if exists "로그인 사용자 용병 글 조회" on public.mercenary_posts;
create policy "로그인 사용자 용병 글 조회" on public.mercenary_posts
  for select to authenticated using (true);

-- 지원 내용은 지원자 본인과, 글을 쓴 팀의 운영자만 볼 수 있다. 취소는 아직 응답받지 않은 본인 지원만.
drop policy if exists "본인과 운영자만 지원 조회" on public.mercenary_applications;
create policy "본인과 운영자만 지원 조회" on public.mercenary_applications
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.mercenary_posts p
      where p.id = post_id and public.is_team_operator(p.team_id)
    )
  );

drop policy if exists "본인 지원 취소" on public.mercenary_applications;
create policy "본인 지원 취소" on public.mercenary_applications
  for delete to authenticated using (user_id = auth.uid() and status = 'applied');

-- 모집 글 올리기: 그 일정 팀의 운영자만, 아직 시작하지 않은 일정만
create or replace function public.create_mercenary_post(p_event_id uuid, p_needed_count int)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_team public.teams%rowtype;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  select * into v_event from public.events where id = p_event_id;
  if not found or not public.is_team_operator(v_event.team_id) then
    raise exception '팀 운영자만 용병 모집 글을 올릴 수 있습니다.';
  end if;
  if v_event.status = 'cancelled' or v_event.starts_at <= now() then
    raise exception '앞으로 열릴 일정에만 용병을 모집할 수 있습니다.';
  end if;
  if p_needed_count not between 1 and 10 then
    raise exception '필요 인원은 1~10명이어야 합니다.';
  end if;

  select * into v_team from public.teams where id = v_event.team_id;

  begin
    insert into public.mercenary_posts
      (event_id, team_id, sport, city, district, starts_at, needed_count, created_by)
    values
      (p_event_id, v_event.team_id, v_team.sport, v_team.city, v_team.district,
       v_event.starts_at, p_needed_count, auth.uid())
    returning id into v_id;
  exception when unique_violation then
    raise exception '이 일정에는 이미 모집 중인 글이 있습니다.';
  end;
  return v_id;
end;
$$;

-- 모집 마감 / 다시 모집
create or replace function public.set_mercenary_status(p_post_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post public.mercenary_posts%rowtype;
begin
  if p_status not in ('open', 'closed') then
    raise exception '상태 값이 올바르지 않습니다.';
  end if;
  select * into v_post from public.mercenary_posts where id = p_post_id;
  if not found or not public.is_team_operator(v_post.team_id) then
    raise exception '팀 운영자만 바꿀 수 있습니다.';
  end if;
  begin
    update public.mercenary_posts set status = p_status where id = p_post_id;
  exception when unique_violation then
    raise exception '이 일정에는 이미 모집 중인 글이 있습니다.';
  end;
end;
$$;

-- 지원하기: 그 팀의 팀원이 아닌 로그인 사용자만, 모집 중이고 시작 전인 글에
create or replace function public.apply_mercenary(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post public.mercenary_posts%rowtype;
  v_event_status text;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  select * into v_post from public.mercenary_posts where id = p_post_id;
  if not found or v_post.status <> 'open' or v_post.starts_at <= now() then
    raise exception '모집이 끝난 글입니다.';
  end if;
  select status into v_event_status from public.events where id = v_post.event_id;
  if v_event_status is null or v_event_status = 'cancelled' then
    raise exception '취소된 일정입니다.';
  end if;
  if public.is_team_member(v_post.team_id) then
    raise exception '우리 팀의 용병 글에는 지원할 수 없습니다.';
  end if;
  begin
    insert into public.mercenary_applications (post_id, user_id) values (p_post_id, auth.uid());
  exception when unique_violation then
    raise exception '이미 지원했습니다.';
  end;
end;
$$;

-- 지원자 수락: 선수 확정 명단에 용병으로 넣는다. 필요 인원이 차면 모집을 마감한다. (확정 마감 시각은 앱이 확인한다)
create or replace function public.accept_mercenary(p_post_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post public.mercenary_posts%rowtype;
  v_event public.events%rowtype;
  v_accepted int;
begin
  select * into v_post from public.mercenary_posts where id = p_post_id;
  if not found or not public.is_team_operator(v_post.team_id) then
    raise exception '팀 운영자만 수락할 수 있습니다.';
  end if;
  select * into v_event from public.events where id = v_post.event_id;
  if v_event.status = 'cancelled' or v_event.starts_at <= now() then
    raise exception '앞으로 열릴 일정만 수락할 수 있습니다.';
  end if;
  if not exists (
    select 1 from public.mercenary_applications
    where post_id = p_post_id and user_id = p_user_id and status = 'applied'
  ) then
    raise exception '수락할 수 있는 지원이 아닙니다.';
  end if;

  select count(*) into v_accepted from public.mercenary_applications
  where post_id = p_post_id and status = 'accepted';
  if v_accepted >= v_post.needed_count then
    raise exception '필요 인원을 이미 채웠습니다.';
  end if;

  update public.mercenary_applications set status = 'accepted'
  where post_id = p_post_id and user_id = p_user_id;

  insert into public.event_roster (event_id, user_id, is_mercenary)
  values (v_post.event_id, p_user_id, true)
  on conflict do nothing;

  update public.events set status = 'confirmed'
  where id = v_post.event_id and status = 'scheduled';

  if v_accepted + 1 >= v_post.needed_count then
    update public.mercenary_posts set status = 'closed' where id = p_post_id;
  end if;
end;
$$;

-- 지원 거절(또는 수락 취소): 명단에서 용병을 빼고, 명단이 비면 일정 상태를 되돌린다.
create or replace function public.reject_mercenary(p_post_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post public.mercenary_posts%rowtype;
begin
  select * into v_post from public.mercenary_posts where id = p_post_id;
  if not found or not public.is_team_operator(v_post.team_id) then
    raise exception '팀 운영자만 거절할 수 있습니다.';
  end if;

  update public.mercenary_applications set status = 'rejected'
  where post_id = p_post_id and user_id = p_user_id;

  delete from public.event_roster
  where event_id = v_post.event_id and user_id = p_user_id and is_mercenary;

  update public.events set status = 'scheduled'
  where id = v_post.event_id and status = 'confirmed'
    and not exists (select 1 from public.event_roster where event_id = v_post.event_id);
end;
$$;

-- 용병 게시판: 모집 중이고 시작 전인 글. 내 지원 상태와 우리 팀 글 여부를 함께 돌려준다.
create or replace function public.mercenary_board()
returns table (
  post_id uuid,
  sport text,
  city text,
  district text,
  starts_at timestamptz,
  needed_count int,
  accepted_count int,
  my_status text,
  is_my_team boolean
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    p.id, p.sport, p.city, p.district, p.starts_at, p.needed_count,
    (select count(*) from public.mercenary_applications a
       where a.post_id = p.id and a.status = 'accepted')::int,
    (select a.status from public.mercenary_applications a
       where a.post_id = p.id and a.user_id = auth.uid()),
    public.is_team_member(p.team_id)
  from public.mercenary_posts p
  where p.status = 'open' and p.starts_at > now()
  order by p.starts_at
  limit 50;
$$;

-- 운영자용 지원자 목록 (닉네임과 지원 상태)
create or replace function public.mercenary_applicants(p_post_id uuid)
returns table (user_id uuid, nickname text, status text, created_at timestamptz)
language sql
security definer
stable
set search_path = ''
as $$
  select a.user_id, pr.nickname, a.status, a.created_at
  from public.mercenary_applications a
  join public.mercenary_posts p on p.id = a.post_id
  join public.profiles pr on pr.id = a.user_id
  where a.post_id = p_post_id and public.is_team_operator(p.team_id)
  order by a.created_at;
$$;

-- 일정의 수락된 용병 닉네임 (같은 팀원에게만)
create or replace function public.event_mercenaries(p_event_id uuid)
returns table (user_id uuid, nickname text)
language sql
security definer
stable
set search_path = ''
as $$
  select ro.user_id, pr.nickname
  from public.event_roster ro
  join public.events e on e.id = ro.event_id
  join public.profiles pr on pr.id = ro.user_id
  where ro.event_id = p_event_id and ro.is_mercenary
    and public.is_team_member(e.team_id)
  order by pr.nickname;
$$;

revoke all on function public.create_mercenary_post(uuid, int) from public, anon;
revoke all on function public.set_mercenary_status(uuid, text) from public, anon;
revoke all on function public.apply_mercenary(uuid) from public, anon;
revoke all on function public.accept_mercenary(uuid, uuid) from public, anon;
revoke all on function public.reject_mercenary(uuid, uuid) from public, anon;
revoke all on function public.mercenary_board() from public, anon;
revoke all on function public.mercenary_applicants(uuid) from public, anon;
revoke all on function public.event_mercenaries(uuid) from public, anon;
grant execute on function public.create_mercenary_post(uuid, int) to authenticated;
grant execute on function public.set_mercenary_status(uuid, text) to authenticated;
grant execute on function public.apply_mercenary(uuid) to authenticated;
grant execute on function public.accept_mercenary(uuid, uuid) to authenticated;
grant execute on function public.reject_mercenary(uuid, uuid) to authenticated;
grant execute on function public.mercenary_board() to authenticated;
grant execute on function public.mercenary_applicants(uuid) to authenticated;
grant execute on function public.event_mercenaries(uuid) to authenticated;
