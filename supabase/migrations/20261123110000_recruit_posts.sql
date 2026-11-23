-- Design Ref: §5 저장할 데이터 — 팀 모집 글(recruit_posts) (nice, Plan 작업 14번)
-- 팀 모집 글은 로그인한 모든 사용자에게 공개한다. (PRD 7번) 연락처 같은 개인정보는 글에 넣지 않는다.
-- 글을 쓰는 일은 팀 운영자만, 함수로만 가능하다.

create table if not exists public.recruit_posts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  -- 팀 이름·종목·지역은 글을 쓸 때의 값을 옮겨 둔다. (팀 표는 같은 팀원만 읽을 수 있어서)
  team_name text not null,
  sport text not null,
  city text not null,
  district text not null,
  title text not null check (char_length(title) between 2 and 40),
  body text not null check (char_length(body) between 10 and 500),
  needed_count int not null check (needed_count between 1 and 30),
  -- open 모집 중 / closed 모집 마감
  status text not null default 'open' check (status in ('open', 'closed')),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists recruit_posts_list_idx
  on public.recruit_posts (city, created_at desc);

alter table public.recruit_posts enable row level security;

-- 로그인한 사용자는 누구나 볼 수 있다.
drop policy if exists "로그인 사용자 모집 글 조회" on public.recruit_posts;
create policy "로그인 사용자 모집 글 조회" on public.recruit_posts
  for select to authenticated using (true);

-- 글 지우기는 그 팀 운영자만
drop policy if exists "운영자만 모집 글 삭제" on public.recruit_posts;
create policy "운영자만 모집 글 삭제" on public.recruit_posts
  for delete to authenticated using (public.is_team_operator(team_id));

-- 글쓰기: 팀 운영자만. 한 팀이 모집 중으로 둘 수 있는 글은 3개까지 (임시)
create or replace function public.create_recruit_post(
  p_team_id uuid,
  p_title text,
  p_body text,
  p_needed_count int
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team public.teams%rowtype;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if not public.is_team_operator(p_team_id) then
    raise exception '팀 운영자만 모집 글을 쓸 수 있습니다.';
  end if;
  if (select count(*) from public.recruit_posts
        where team_id = p_team_id and status = 'open') >= 3 then
    raise exception '모집 중인 글은 팀마다 3개까지 쓸 수 있습니다. 기존 글을 마감해 주세요.';
  end if;

  select * into v_team from public.teams where id = p_team_id;

  insert into public.recruit_posts
    (team_id, team_name, sport, city, district, title, body, needed_count, created_by)
  values
    (p_team_id, v_team.name, v_team.sport, v_team.city, v_team.district,
     trim(p_title), trim(p_body), p_needed_count, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

-- 모집 마감/다시 모집: 팀 운영자만
create or replace function public.set_recruit_status(p_post_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
begin
  if p_status not in ('open', 'closed') then
    raise exception '상태 값이 올바르지 않습니다.';
  end if;
  select team_id into v_team_id from public.recruit_posts where id = p_post_id;
  if v_team_id is null or not public.is_team_operator(v_team_id) then
    raise exception '팀 운영자만 바꿀 수 있습니다.';
  end if;
  if p_status = 'open' and (select count(*) from public.recruit_posts
        where team_id = v_team_id and status = 'open') >= 3 then
    raise exception '모집 중인 글은 팀마다 3개까지 쓸 수 있습니다.';
  end if;
  update public.recruit_posts set status = p_status where id = p_post_id;
end;
$$;

revoke all on function public.create_recruit_post(uuid, text, text, int) from public, anon;
revoke all on function public.set_recruit_status(uuid, text) from public, anon;
grant execute on function public.create_recruit_post(uuid, text, text, int) to authenticated;
grant execute on function public.set_recruit_status(uuid, text) to authenticated;
