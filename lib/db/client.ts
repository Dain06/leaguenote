// Design Ref: §2 구조 선택 — 데이터 저장소 접근은 lib/db 한 곳에서만 한다.
// 로그인 상태가 필요 없는 단순 조회용 연결 도구. 로그인 사용자 기준 접근은 server.ts를 쓴다.
import { createClient } from "@supabase/supabase-js";

import { getDbEnv } from "./config";

export function createDbClient() {
  const { url, anonKey } = getDbEnv();
  return createClient(url, anonKey);
}
