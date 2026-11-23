-- Design Ref: §5 저장할 데이터 — 참석 의향(event_responses)
-- Plan 작업 5번: 일정별 지원자(참석 의향) 조사
-- 조사 마감 시각(출석 투표 게시 전까지)은 규칙 값이므로 lib/rules.ts에서 앱이 확인한다.

create table if not exists public.event_responses (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  response text not null check (response in ('attend', 'absent')),
  responded_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.event_responses enable row level security;

-- 같은 팀원만 응답을 볼 수 있다.
drop policy if exists "팀원만 참석 의향 조회" on public.event_responses;
create policy "팀원만 참석 의향 조회" on public.event_responses
  for select to authenticated
  using (
    public.is_team_member(
      (select e.team_id from public.events e where e.id = event_id)
    )
  );

-- 응답은 같은 팀원이 "본인 몫"만 남기거나 고칠 수 있다.
drop policy if exists "본인 참석 의향 등록" on public.event_responses;
create policy "본인 참석 의향 등록" on public.event_responses
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_team_member(
      (select e.team_id from public.events e where e.id = event_id)
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
  );

-- 조사 현황: 같은 팀원 모두의 닉네임과 응답(없으면 미응답)을 돌려준다.
-- 닉네임은 같은 팀원에게 보이는 정보이고, 연락처는 포함하지 않는다.
create or replace function public.event_survey(p_event_id uuid)
returns table (
  user_id uuid,
  nickname text,
  role text,
  response text
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
    r.response
  from public.events e
  join public.team_members m on m.team_id = e.team_id
  join public.profiles p on p.id = m.user_id
  left join public.event_responses r
    on r.event_id = e.id and r.user_id = m.user_id
  where e.id = p_event_id
    and public.is_team_member(e.team_id)
  order by (m.role = 'operator') desc, m.joined_at;
$$;

revoke all on function public.event_survey(uuid) from public, anon;
grant execute on function public.event_survey(uuid) to authenticated;
