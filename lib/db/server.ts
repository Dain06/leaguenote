// Design Ref: §2 구조 선택 — 로그인 사용자 기준으로 데이터 저장소에 접근하는 서버 전용 연결 도구.
// 로그인 정보(쿠키)를 읽고 갱신하므로 서버 컴포넌트·서버 액션에서만 쓴다.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getDbEnv } from "./config";

export async function createServerDb() {
  const { url, anonKey } = getDbEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // 서버 컴포넌트에서는 쿠키를 쓸 수 없다. 로그인 갱신은 proxy.ts가 맡으므로 무시해도 된다.
        }
      },
    },
  });
}
