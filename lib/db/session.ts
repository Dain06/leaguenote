// Design Ref: §3 화면 구성 — 요청마다 로그인 유효 기간을 확인하고 필요하면 갱신한다. (proxy.ts에서 호출)
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getDbEnv, isDbConfigured } from "./config";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // 연결 정보가 없으면 로그인 갱신을 건너뛴다. (화면은 그대로 열린다)
  if (!isDbConfigured()) return response;

  const { url, anonKey } = getDbEnv();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // 로그인 정보를 확인하면서 만료가 가까우면 새로 받아 쿠키에 반영한다.
  await supabase.auth.getClaims();

  return response;
}
