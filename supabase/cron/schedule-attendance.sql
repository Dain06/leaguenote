-- Design Ref: §6 기술 선택 — Supabase 예약 작업(pg_cron)이 5분마다 앱의 출석 알림 주소를 호출한다.
--
-- 이 파일은 "설정 틀"입니다. 앱이 인터넷에 배포돼 주소가 생긴 뒤(Part 5)에 아래 두 값을 채워서
-- Supabase SQL 편집기(또는 관리 API)로 한 번 실행하세요. 지금은 실행하지 않았습니다.
--   <배포주소>   예: https://leaguenote.vercel.app  (끝에 / 없이)
--   <CRON_SECRET> .env의 CRON_SECRET 값과 같아야 합니다. (이 파일에는 실제 값을 적지 마세요 — 커밋됩니다)
--
-- 내 컴퓨터에서 개발할 때는 이 예약 작업이 닿지 않으므로, 같은 주소를 직접 호출해 시험합니다.
--   curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/attendance

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'leaguenote-attendance',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := '<배포주소>/api/cron/attendance',
    headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
  );
  $$
);

-- 대회 매칭(작업 10번): 신청 마감이 지난 참가 신청을 묶어 대회를 만든다. 같은 방식으로 5분마다 호출한다.
select cron.schedule(
  'leaguenote-matching',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := '<배포주소>/api/cron/matching',
    headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
  );
  $$
);

-- 대회 참가 여부 결정 기한 처리(작업 11번): 기한이 지난 대회를 확정하거나 취소한다.
select cron.schedule(
  'leaguenote-tournaments',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := '<배포주소>/api/cron/tournaments',
    headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
  );
  $$
);

-- 멈추려면:
--   select cron.unschedule('leaguenote-tournaments');
--   select cron.unschedule('leaguenote-attendance');
--   select cron.unschedule('leaguenote-matching');
