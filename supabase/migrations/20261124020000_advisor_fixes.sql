-- Supabase Security Advisor 점검 반영
-- 가입 때 프로필을 만드는 트리거 함수는 /rest/v1/rpc/handle_new_user 로 직접 부를 수 있을 필요가 없다.
-- (트리거는 호출자의 실행 권한과 상관없이 동작한다)
revoke all on function public.handle_new_user() from public, anon, authenticated;
