-- Design Ref: §5 저장할 데이터 — 사용자(profiles)
-- 이메일·비밀번호는 Supabase 로그인 서비스(auth.users)가 관리하고,
-- 닉네임·연락처·거주 시·구는 이 표에 저장한다.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null,
  phone text not null,
  city text not null,
  district text not null,
  created_at timestamptz not null default now()
);

-- 개인정보 보호: 본인 행만 읽고 고칠 수 있다. (같은 팀 운영자 조회 등은 팀 기능을 만들 때 추가)
alter table public.profiles enable row level security;

drop policy if exists "본인 프로필 조회" on public.profiles;
create policy "본인 프로필 조회" on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "본인 프로필 수정" on public.profiles;
create policy "본인 프로필 수정" on public.profiles
  for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- 회원가입 때 받은 값(user_metadata)으로 프로필 행을 자동으로 만든다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nickname, phone, city, district)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nickname', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    coalesce(new.raw_user_meta_data ->> 'city', ''),
    coalesce(new.raw_user_meta_data ->> 'district', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
