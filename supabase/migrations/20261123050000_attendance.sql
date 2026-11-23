-- Design Ref: §5 저장할 데이터 — 출석(attendance), 일정의 출석 투표 게시·마감 시각
-- Plan 작업 7번: 출석 투표 자동 게시(시작 2시간 전)와 확정 선수의 투표·마감(시작 30분 전), 출석 알림
-- 게시·마감 시각의 계산 규칙(2시간 전, 30분 전)은 lib/rules.ts 한 곳에서 정하고, 앱이 일정을 만들 때 이 칸에 저장한다.

alter table public.events
  add column if not exists attendance_opens_at timestamptz,
  add column if not exists attendance_closes_at timestamptz,
  -- 출석 투표 게시 알림을 보낸 시각 (예약 작업이 같은 일정에 알림을 두 번 보내지 않도록)
  add column if not exists attendance_notified_at timestamptz;

create index if not exists events_attendance_pending_idx
  on public.events (attendance_opens_at)
  where attendance_notified_at is null;

create table if not exists public.attendance (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  response text not null check (response in ('present', 'absent')),
  responded_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.attendance enable row level security;

-- 같은 팀원만 출석 현황을 볼 수 있다.
drop policy if exists "팀원만 출석 조회" on public.attendance;
create policy "팀원만 출석 조회" on public.attendance
  for select to authenticated
  using (
    public.is_team_member(
      (select e.team_id from public.events e where e.id = event_id)
    )
  );

-- 출석 투표는 "확정된 선수"가 본인 몫만 남기거나 고칠 수 있다. (투표 시간 확인은 앱이 한다)
drop policy if exists "확정 선수 본인 출석 등록" on public.attendance;
create policy "확정 선수 본인 출석 등록" on public.attendance
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.event_roster r
      where r.event_id = attendance.event_id and r.user_id = auth.uid()
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
  );

-- 출석 현황: 확정 선수 모두의 닉네임과 투표(없으면 미투표). 같은 팀원만 볼 수 있다.
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
  join public.event_roster ro on ro.event_id = e.id
  join public.profiles p on p.id = ro.user_id
  left join public.attendance a
    on a.event_id = e.id and a.user_id = ro.user_id
  where e.id = p_event_id
    and public.is_team_member(e.team_id)
  order by p.nickname;
$$;

revoke all on function public.event_attendance(uuid) from public, anon;
grant execute on function public.event_attendance(uuid) to authenticated;
