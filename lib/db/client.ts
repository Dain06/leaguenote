// Design Ref: §2 구조 선택 — 데이터 저장소 접근은 lib/db 한 곳에서만 한다.
// Plan SC: 작업 1번 — 데이터 저장소 연결 준비 (실제 데이터 저장은 이후 작업에서 사용)
import { createClient } from "@supabase/supabase-js";

import { DB_ENV_NAMES } from "./config";

/**
 * 데이터 저장소(Supabase) 연결 도구를 만든다.
 * 연결 정보가 없으면 어떤 값이 빠졌는지 한국어로 알려 주는 오류를 낸다.
 */
export function createDbClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      `데이터 저장소 연결 정보가 없습니다. .env에 ${DB_ENV_NAMES.url}와 ${DB_ENV_NAMES.anonKey}를 추가해 주세요.`,
    );
  }

  return createClient(url, anonKey);
}
