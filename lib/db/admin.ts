// Design Ref: §6 기술 선택 — 예약 작업처럼 "사용자 로그인 없이" 서버가 직접 처리하는 일에만 쓰는 관리자 연결 도구.
// 서버 전용 키(SUPABASE_SERVICE_ROLE_KEY)를 쓰며, 이 키는 모든 접근 규칙을 건너뛴다.
// 절대 브라우저로 보내거나 NEXT_PUBLIC_ 접두사를 붙이지 않는다.
import "server-only"; // 실수로 브라우저 코드가 이 파일을 가져오면 빌드가 실패한다.
import { createClient } from "@supabase/supabase-js";

import { getDbEnv } from "./config";

export function createAdminDb() {
  const { url } = getDbEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    throw new Error(
      "서버 전용 키가 없습니다. .env에 SUPABASE_SERVICE_ROLE_KEY를 추가해 주세요.",
    );
  }

  return createClient(url, serviceKey, {
    // 서버에서 한 번 쓰고 버리는 연결이라 로그인 정보를 저장하거나 갱신하지 않는다.
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
