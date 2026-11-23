-- Design Ref: §5 저장할 데이터 — 팀(teams), 팀원(team_members), 초대(invites)
-- Plan 작업 3번: 팀 생성(종목·한 경기 필요 인원·지역)과 팀원 초대

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 20),
  -- 종목: 공백·대소문자를 정리한 값 (팀이 직접 입력)
  sport text not null check (char_length(sport) between 1 and 20),
  -- 한 경기에 필요한 인원. 팀 최소 인원 계산에 쓴다 (1인 경기 종목은 최소 인원 3, 규칙은 일정 기능에서 적용)
  required_players int not null check (required_players between 1 and 30),
  city text not null,
  district text not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('operator', 'member')),
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  code text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_by uuid not null references auth.users (id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

-- 접근 규칙에서 쓰는 도우미: 내가 이 팀의 팀원인지 / 운영자인지
create or replace function public.is_team_member(p_team_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_team_operator(p_team_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = auth.uid() and role = 'operator'
  );
$$;

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.invites enable row level security;

-- 팀과 팀원 목록은 같은 팀원만 볼 수 있다. (만들기·들어오기는 아래 함수로만 가능)
drop policy if exists "팀원만 팀 조회" on public.teams;
create policy "팀원만 팀 조회" on public.teams
  for select to authenticated using (public.is_team_member(id));

drop policy if exists "팀원만 팀원 조회" on public.team_members;
create policy "팀원만 팀원 조회" on public.team_members
  for select to authenticated using (public.is_team_member(team_id));

-- 초대는 운영자만 만들고 볼 수 있다.
drop policy if exists "운영자만 초대 조회" on public.invites;
create policy "운영자만 초대 조회" on public.invites
  for select to authenticated using (public.is_team_operator(team_id));

drop policy if exists "운영자만 초대 생성" on public.invites;
create policy "운영자만 초대 생성" on public.invites
  for insert to authenticated
  with check (public.is_team_operator(team_id) and created_by = auth.uid());

-- 팀 만들기: 팀과 "운영자" 팀원 행을 한 번에 만든다.
create or replace function public.create_team(
  p_name text,
  p_sport text,
  p_required_players int,
  p_city text,
  p_district text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  insert into public.teams (name, sport, required_players, city, district, created_by)
  values (p_name, p_sport, p_required_players, p_city, p_district, auth.uid())
  returning id into v_id;

  insert into public.team_members (team_id, user_id, role)
  values (v_id, auth.uid(), 'operator');

  return v_id;
end;
$$;

-- 초대 수락: 유효한 초대 코드면 "팀원"으로 들어온다. (이미 팀원이면 그대로 둔다)
create or replace function public.accept_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select team_id into v_team
  from public.invites
  where code = p_code and expires_at > now();

  if v_team is null then
    raise exception '유효하지 않거나 만료된 초대입니다.';
  end if;

  insert into public.team_members (team_id, user_id, role)
  values (v_team, auth.uid(), 'member')
  on conflict do nothing;

  return v_team;
end;
$$;

-- 초대 화면에서 가입 전에 팀 이름·종목을 미리 보여 준다. (초대 코드를 아는 사람만)
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
  where i.code = p_code and i.expires_at > now();
$$;

-- 팀원 목록: 닉네임은 같은 팀원 모두에게, 연락처는 같은 팀 운영자와 본인에게만 보여 준다. (PRD 7번)
create or replace function public.team_roster(p_team_id uuid)
returns table (
  user_id uuid,
  nickname text,
  role text,
  phone text,
  joined_at timestamptz
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
    case
      when m.user_id = auth.uid() or public.is_team_operator(p_team_id) then p.phone
      else null
    end,
    m.joined_at
  from public.team_members m
  join public.profiles p on p.id = m.user_id
  where m.team_id = p_team_id
    and public.is_team_member(p_team_id)
  order by (m.role = 'operator') desc, m.joined_at;
$$;

-- 종목 추천: 이미 쓰인 종목 이름과 그 종목에서 가장 흔한 "한 경기 필요 인원"만 돌려준다.
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
  group by t.sport
  order by count(*) desc, t.sport
  limit 30;
$$;

-- 함수는 로그인한 사용자만 부를 수 있게 한다.
revoke all on function public.is_team_member(uuid) from public, anon;
revoke all on function public.is_team_operator(uuid) from public, anon;
revoke all on function public.create_team(text, text, int, text, text) from public, anon;
revoke all on function public.accept_invite(text) from public, anon;
revoke all on function public.invite_preview(text) from public, anon;
revoke all on function public.team_roster(uuid) from public, anon;
revoke all on function public.popular_sports() from public, anon;

grant execute on function public.is_team_member(uuid) to authenticated;
grant execute on function public.is_team_operator(uuid) to authenticated;
grant execute on function public.create_team(text, text, int, text, text) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.invite_preview(text) to authenticated;
grant execute on function public.team_roster(uuid) to authenticated;
grant execute on function public.popular_sports() to authenticated;
