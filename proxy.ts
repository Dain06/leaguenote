import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/db/session";

// 모든 화면 요청 앞에서 로그인 상태를 갱신한다. (Next.js 16부터 middleware 대신 proxy)
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // 정적 파일과 이미지는 제외
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
