// Design Ref: §3.1 `/` 홈·공통 메뉴 — 현재 로그인한 사용자를 알아낸다.
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { isDbConfigured } from "@/lib/db/config";
import { createServerDb } from "@/lib/db/server";

export type CurrentUser = { id: string; email: string; nickname: string };

/** 로그인한 사용자를 돌려준다. 로그인하지 않았거나 연결 정보가 없으면 null. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  // 로그인 상태는 요청마다 다르므로, 미리 만들어 두는 단계가 아니라 요청이 들어왔을 때 계산한다.
  await connection();
  if (!isDbConfigured()) return null;

  const db = await createServerDb();
  const { data } = await db.auth.getUser();
  const user = data.user;
  if (!user) return null;

  return {
    id: user.id,
    email: user.email ?? "",
    nickname: String(user.user_metadata?.nickname ?? ""),
  };
}

/** 로그인이 필요한 화면에서 쓴다. 로그인하지 않았으면 로그인 화면으로 보내고, 끝나면 원래 화면으로 돌아온다. */
export async function requireUser(returnTo: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return user;
}
