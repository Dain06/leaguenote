-- 공개 전 보안 점검(2026-11-24) 결과 반영: 앱 화면을 거치지 않고 데이터베이스를 직접 부르는 경우에도 규칙이 지켜지도록 한다.
--  A. 용병·모집 글 표의 과다 공개 줄이기
--  B. 시간·값 규칙을 데이터베이스에서도 확인 (신청 마감, 참석·출석·선수 확정·용병 수락 시한, 일정 등록 칸)
--  C. 가입 정보(프로필) 형식 제약과 수정 범위 제한
--  D. 알림 종류·링크 검증

-- ---------------------------------------------------------------------------
-- A. 용병·모집 글 공개 범위
-- ---------------------------------------------------------------------------

-- 지원 조회 정책이 용병 글 표를 직접 읽지 않도록, 운영자 여부를 함수로 확인한다.
create or replace function public.is_mercenary_post_operator(p_post_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.mercenary_posts p
    where p.id = p_post_id and public.is_team_operator(p.team_id)
  );
$$;
revoke all on function public.is_mercenary_post_operator(uuid) from public, anon;
grant execute on function public.is_mercenary_post_operator(uuid) to authenticated;

drop policy if exists "본인과 운영자만 지원 조회" on public.mercenary_applications;
create policy "본인과 운영자만 지원 조회" on public.mercenary_applications
  for select to authenticated
  using (user_id = auth.uid() or public.is_mercenary_post_operator(post_id));

-- 일정 화면용: 그 일정 팀의 팀원에게만 가장 최근 용병 글을 돌려준다.
create or replace function public.event_mercenary_post(p_event_id uuid)
returns table (id uuid, needed_count int, status text)
language sql
security definer
stable
set search_path = ''
as $$
  select p.id, p.needed_count, p.status
  from public.mercenary_posts p
  join public.events e on e.id = p.event_id
  where p.event_id = p_event_id and public.is_team_member(e.team_id)
  order by p.created_at desc
  limit 1;
$$;
revoke all on function public.event_mercenary_post(uuid) from public, anon;
grant execute on function public.event_mercenary_post(uuid) to authenticated;

-- 용병 글 표는 직접 조회할 수 없게 하고(게시판·일정 화면은 함수로만 읽는다), 팀 번호·운영자 번호가 새지 않게 한다.
revoke select on public.mercenary_posts from authenticated, anon;

-- 팀 모집 글은 공개하는 글이지만, 작성자 사용자 번호(created_by)는 공개하지 않는다.
revoke select on public.recruit_posts from authenticated, anon;
grant select (id, team_id, team_name, sport, city, district, title, body, needed_count, status, created_at)
  on public.recruit_posts to authenticated;

-- "이 사람이 이 팀 소속인가"를 아무나 물어볼 수 없도록, 함수 대신 정책 안에서 직접 확인한다.
drop policy if exists "운영자만 납부 확인" on public.dues_payments;
create policy "운영자만 납부 확인" on public.dues_payments
  for insert to authenticated
  with check (
    public.is_team_operator(team_id)
    and confirmed_by = auth.uid()
    and exists (
      select 1 from public.team_members m
      where m.team_id = dues_payments.team_id and m.user_id = dues_payments.user_id
    )
  );
drop function if exists public.is_team_member_of(uuid, uuid);

-- ---------------------------------------------------------------------------
-- B. 시간·값 규칙을 데이터베이스에서도 확인
-- ---------------------------------------------------------------------------

-- 대회 참가 신청: 마감 시각을 호출자가 정하지 못하게 시작일에서 직접 계산한다.
-- (주의: "시작 3주 전 마감"과 "1인 경기 종목 최소 3명"은 lib/rules.ts의 규칙과 같은 값이다. 바꿀 때 함께 고친다.)
drop function if exists public.apply_tournament(uuid, int, int, date, timestamptz);

create or replace function public.apply_tournament(
  p_team_id uuid,
  p_team_size int,
  p_career_months int,
  p_starts_on date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team public.teams%rowtype;
  v_deadline timestamptz;
  v_min_players int;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if not public.is_team_operator(p_team_id) then
    raise exception '팀 운영자만 신청할 수 있습니다.';
  end if;

  v_deadline := (p_starts_on::timestamp at time zone 'Asia/Seoul') - interval '21 days';
  if v_deadline <= now() then
    raise exception '신청 마감이 지났습니다.';
  end if;

  select * into v_team from public.teams where id = p_team_id;
  v_min_players := case when v_team.required_players <= 1 then 3 else v_team.required_players end;
  if p_team_size < v_min_players then
    raise exception '팀 인원이 최소 인원(%명)보다 적습니다.', v_min_players;
  end if;

  insert into public.tournament_applications (
    team_id, sport, city, district, team_size, career_months,
    tournament_starts_on, deadline_at, created_by
  )
  values (
    p_team_id, v_team.sport, v_team.city, v_team.district, p_team_size, p_career_months,
    p_starts_on, v_deadline, auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.apply_tournament(uuid, int, int, date) from public, anon;
grant execute on function public.apply_tournament(uuid, int, int, date) to authenticated;

-- 참석 의향: 출석 투표가 게시되기 전(조사 기간)에만 등록·수정할 수 있다. (게시 시각은 일정에 저장된 값)
drop policy if exists "본인 참석 의향 등록" on public.event_responses;
create policy "본인 참석 의향 등록" on public.event_responses
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_team_member(
      (select e.team_id from public.events e where e.id = event_id)
    )
    and exists (
      select 1 from public.events e
      where e.id = event_responses.event_id
        and e.status <> 'cancelled'
        and (e.attendance_opens_at is null or now() < e.attendance_opens_at)
    )
  );

drop policy if exists "본인 참석 의향 수정" on public.event_responses;
create policy "본인 참석 의향 수정" on public.event_responses
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and public.is_team_member(
      (select e.team_id from public.events e where e.id = event_id)
    )
    and exists (
      select 1 from public.events e
      where e.id = event_responses.event_id
        and e.status <> 'cancelled'
        and (e.attendance_opens_at is null or now() < e.attendance_opens_at)
    )
  );

-- 출석 투표: 확정 선수가 게시 시각 이후 마감 시각 전에만 남기거나 고칠 수 있다.
drop policy if exists "확정 선수 본인 출석 등록" on public.attendance;
create policy "확정 선수 본인 출석 등록" on public.attendance
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.event_roster r
      where r.event_id = attendance.event_id and r.user_id = auth.uid()
    )
    and exists (
      select 1 from public.events e
      where e.id = attendance.event_id
        and e.status <> 'cancelled'
        and e.attendance_opens_at is not null
        and now() >= e.attendance_opens_at
        and now() < e.attendance_closes_at
    )
  );

drop policy if exists "확정 선수 본인 출석 수정" on public.attendance;
create policy "확정 선수 본인 출석 수정" on public.attendance
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.event_roster r
      where r.event_id = attendance.event_id and r.user_id = auth.uid()
    )
    and exists (
      select 1 from public.events e
      where e.id = attendance.event_id
        and e.status <> 'cancelled'
        and e.attendance_opens_at is not null
        and now() >= e.attendance_opens_at
        and now() < e.attendance_closes_at
    )
  );

-- 일정 등록: 운영자가 상태·알림 처리 표시·대회 연결 칸을 마음대로 채우지 못하게 하고, 시각 순서를 확인한다.
drop policy if exists "운영자만 연습 일정 생성" on public.events;
create policy "운영자만 연습 일정 생성" on public.events
  for insert to authenticated
  with check (
    public.is_team_operator(team_id)
    and created_by = auth.uid()
    and type = 'practice'
    and status = 'scheduled'
    and attendance_notified_at is null
    and tournament_id is null
    and schedule_request_id is null
    and attendance_opens_at is not null
    and attendance_closes_at is not null
    and attendance_opens_at < attendance_closes_at
    and attendance_closes_at <= starts_at
    and starts_at > now() - interval '5 minutes'
  );

-- 선수 확정: 출석 투표 게시 전까지만 (게시 시각은 일정에 저장된 값). 용병은 그대로 두고 돌려주는 값은 용병 포함 인원.
create or replace function public.confirm_roster(p_event_id uuid, p_user_ids uuid[])
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team uuid;
  v_status text;
  v_opens timestamptz;
  v_ids uuid[];
  v_total int;
begin
  select team_id, status, attendance_opens_at into v_team, v_status, v_opens
  from public.events where id = p_event_id;

  if v_team is null or not public.is_team_operator(v_team) then
    raise exception '선수 확정은 팀 운영자만 할 수 있습니다.';
  end if;
  if v_status = 'cancelled' then
    raise exception '취소된 일정입니다.';
  end if;
  if v_opens is not null and now() >= v_opens then
    raise exception '선수 확정은 출석 투표가 게시되기 전까지만 할 수 있습니다.';
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

-- 용병 모집 글 올리기: 선수 확정 마감 전의 일정만
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
  if v_event.attendance_opens_at is not null and now() >= v_event.attendance_opens_at then
    raise exception '선수 확정이 마감된 일정에는 용병을 모집할 수 없습니다.';
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

-- 용병 수락: 선수 확정 마감 전까지만
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
  if v_event.attendance_opens_at is not null and now() >= v_event.attendance_opens_at then
    raise exception '선수 확정이 마감되어 용병을 수락할 수 없습니다.';
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

-- ---------------------------------------------------------------------------
-- C. 가입 정보(프로필): 형식 제약과 수정 범위
-- ---------------------------------------------------------------------------
-- 이미 있는 행은 검사하지 않고(not valid), 새로 넣거나 고치는 값부터 검사한다.
alter table public.profiles
  add constraint profiles_nickname_len check (char_length(nickname) between 2 and 12) not valid,
  add constraint profiles_phone_format check (phone ~ '^01[016789][0-9]{7,8}$') not valid,
  add constraint profiles_district_len check (char_length(district) between 1 and 20) not valid,
  add constraint profiles_city_list check (city in (
    '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시', '울산광역시',
    '세종특별자치시', '경기도', '강원특별자치도', '충청북도', '충청남도', '전북특별자치도',
    '전라남도', '경상북도', '경상남도', '제주특별자치도'
  )) not valid;

-- 시·도(순위표 공개 범위의 기준)는 사용자가 마음대로 바꿀 수 없게 하고, 닉네임·연락처·시군구만 고칠 수 있게 한다.
revoke update on public.profiles from authenticated, anon;
grant update (nickname, phone, district) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- D. 알림: 종류와 링크 검증 (링크는 앱 안의 주소만)
-- ---------------------------------------------------------------------------
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
  if p_kind !~ '^[a-z_]{1,40}$' then
    raise exception '알림 종류가 올바르지 않습니다.';
  end if;
  if p_link is not null and p_link !~ '^/([^/\\[:space:]][^\\[:space:]]*)?$' then
    raise exception '알림 링크는 앱 안의 주소만 쓸 수 있습니다.';
  end if;

  insert into public.notifications (user_id, kind, message, link)
  select m.user_id, p_kind, left(p_message, 200), p_link
  from public.team_members m
  where m.team_id = p_team_id and m.role = 'operator';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
