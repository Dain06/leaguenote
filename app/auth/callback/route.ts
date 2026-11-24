// Design Ref: §2 구조 — 이메일 확인 메일의 링크가 돌아오는 주소. 받은 코드로 로그인 세션을 만든 뒤 원래 가려던 화면으로 보낸다.
import { NextResponse } from "next/server";

import { safeNextPath } from "@/features/auth/next";
import { siteOrigin } from "@/features/auth/site";
import { isDbConfigured } from "@/lib/db/config";
import { createServerDb } from "@/lib/db/server";

export async function GET(request: Request) {
  const origin = await siteOrigin();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));

  if (code && isDbConfigured()) {
    const db = await createServerDb();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  // 링크가 만료됐거나 잘못된 경우: 로그인 화면으로 보낸다.
  return NextResponse.redirect(`${origin}/login`);
}
