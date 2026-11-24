-- 개인정보 처리: 수집 동의 기록, 계정 탈퇴 준비 함수, 사용자 참조 칸의 삭제 규칙 정리

-- 1) 동의 기록 (가입 때 보낸 값으로 트리거가 채운다. 동의 기능 이전 가입자는 null)
alter table public.profiles
  add column if not exists consented_at timestamptz,
  add column if not exists consent_version text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version text := nullif(new.raw_user_meta_data ->> 'consent_version', '');
begin
  insert into public.profiles (id, nickname, phone, city, district, consented_at, consent_version)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nickname', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    coalesce(new.raw_user_meta_data ->> 'city', ''),
    coalesce(new.raw_user_meta_data ->> 'district', ''),
    case when v_version is null then null else now() end,
    left(v_version, 20)
  );
  return new;
end;
$$;

-- 2) 사용자를 가리키지만 삭제 규칙이 없던 칸(작성자·입력자 등)은 사용자가 지워져도 기록이 남도록
--    "비움(set null)"으로 바꾼다. (회원 번호가 대체 식별자가 되지 않게 연결만 끊는다)
do $$
declare
  r record;
begin
  for r in
    select c.conrelid::regclass as tbl, c.conname, a.attname
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid = 'auth.users'::regclass
      and c.confdeltype = 'a'
      and c.connamespace = 'public'::regnamespace
  loop
    execute format('alter table %s alter column %I drop not null', r.tbl, r.attname);
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format(
      'alter table %s add constraint %I foreign key (%I) references auth.users (id) on delete set null',
      r.tbl, r.conname, r.attname
    );
  end loop;
end;
$$;

-- 3) 계정 탈퇴 준비 (서버 관리 키로만 호출). 이 함수가 끝난 뒤 로그인 계정을 지운다.
--    - 다른 팀원이 있는 팀의 운영자는 탈퇴할 수 없다 (먼저 팀원을 내보내야 한다)
--    - 혼자 남은 팀은 함께 삭제한다
--    - 일반 팀원으로 속한 팀에서는 앞으로의 일정 기록을 정리하고 나간다
create or replace function public.prepare_account_deletion(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select team_id, role from public.team_members where user_id = p_user_id
  loop
    if r.role = 'operator' then
      if exists (
        select 1 from public.team_members
        where team_id = r.team_id and user_id <> p_user_id
      ) then
        raise exception '운영 중인 팀에 다른 팀원이 있어 탈퇴할 수 없습니다. 먼저 팀원을 모두 내보내 주세요.'
          using errcode = 'P0001';
      end if;
    end if;
  end loop;

  for r in
    select team_id, role from public.team_members where user_id = p_user_id
  loop
    if r.role = 'operator' then
      delete from public.teams where id = r.team_id;
    else
      perform public.cleanup_member_data(r.team_id, p_user_id);
    end if;
  end loop;
end;
$$;

revoke all on function public.prepare_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.prepare_account_deletion(uuid) to service_role;
