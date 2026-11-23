-- Design Ref: §5 저장할 데이터 — 회비 항목(dues_items)·입금 내역(dues_deposits)·납부 확인(dues_payments) (nice, Plan 작업 15번)
-- 회비 입금은 플랫폼 밖에서 이뤄진다. 계좌·카드 정보는 저장하지 않고, 운영자가 입금자 닉네임·금액만 입력한다.
-- 회비 납부 여부는 같은 팀 운영자와 본인에게만 보인다. (PRD 7번)

create table if not exists public.dues_items (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 40),
  amount int not null check (amount between 1 and 10000000),
  due_on date not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  -- 입금·납부 확인이 같은 팀의 항목에만 붙도록 (항목 번호, 팀 번호) 쌍을 참조한다.
  unique (id, team_id)
);

-- 운영자가 입력한 입금 내역: 입금자 닉네임과 금액
create table if not exists public.dues_deposits (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null,
  team_id uuid not null,
  depositor text not null check (char_length(depositor) between 1 and 30),
  amount int not null check (amount between 1 and 10000000),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  foreign key (item_id, team_id) references public.dues_items (id, team_id) on delete cascade
);

-- 운영자가 최종 확인한 납부 (항목마다 팀원 한 명에 한 줄)
create table if not exists public.dues_payments (
  item_id uuid not null,
  team_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  confirmed_by uuid not null references auth.users (id),
  confirmed_at timestamptz not null default now(),
  primary key (item_id, user_id),
  foreign key (item_id, team_id) references public.dues_items (id, team_id) on delete cascade
);

-- 납부 확인 대상이 그 팀의 팀원인지 (접근 규칙에서 쓰는 도우미)
create or replace function public.is_team_member_of(p_team_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = p_user_id
  );
$$;

revoke all on function public.is_team_member_of(uuid, uuid) from public, anon;
grant execute on function public.is_team_member_of(uuid, uuid) to authenticated;

alter table public.dues_items enable row level security;
alter table public.dues_deposits enable row level security;
alter table public.dues_payments enable row level security;

-- 항목(이름·금액·기한)은 같은 팀원이 볼 수 있고, 만들고 지우는 일은 운영자만 한다.
drop policy if exists "팀원만 회비 항목 조회" on public.dues_items;
create policy "팀원만 회비 항목 조회" on public.dues_items
  for select to authenticated using (public.is_team_member(team_id));

drop policy if exists "운영자만 회비 항목 생성" on public.dues_items;
create policy "운영자만 회비 항목 생성" on public.dues_items
  for insert to authenticated
  with check (public.is_team_operator(team_id) and created_by = auth.uid());

drop policy if exists "운영자만 회비 항목 삭제" on public.dues_items;
create policy "운영자만 회비 항목 삭제" on public.dues_items
  for delete to authenticated using (public.is_team_operator(team_id));

-- 입금 내역은 운영자만 보고, 넣고, 지운다.
drop policy if exists "운영자만 입금 내역 조회" on public.dues_deposits;
create policy "운영자만 입금 내역 조회" on public.dues_deposits
  for select to authenticated using (public.is_team_operator(team_id));

drop policy if exists "운영자만 입금 내역 입력" on public.dues_deposits;
create policy "운영자만 입금 내역 입력" on public.dues_deposits
  for insert to authenticated
  with check (public.is_team_operator(team_id) and created_by = auth.uid());

drop policy if exists "운영자만 입금 내역 삭제" on public.dues_deposits;
create policy "운영자만 입금 내역 삭제" on public.dues_deposits
  for delete to authenticated using (public.is_team_operator(team_id));

-- 납부 확인은 운영자는 모두, 팀원은 본인 것만 볼 수 있다. 확인·취소는 운영자만 한다.
drop policy if exists "운영자와 본인만 납부 확인 조회" on public.dues_payments;
create policy "운영자와 본인만 납부 확인 조회" on public.dues_payments
  for select to authenticated
  using (public.is_team_operator(team_id) or user_id = auth.uid());

drop policy if exists "운영자만 납부 확인" on public.dues_payments;
create policy "운영자만 납부 확인" on public.dues_payments
  for insert to authenticated
  with check (
    public.is_team_operator(team_id)
    and confirmed_by = auth.uid()
    and public.is_team_member_of(team_id, user_id)
  );

drop policy if exists "운영자만 납부 확인 취소" on public.dues_payments;
create policy "운영자만 납부 확인 취소" on public.dues_payments
  for delete to authenticated using (public.is_team_operator(team_id));
