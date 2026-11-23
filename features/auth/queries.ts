// Design Ref: §3.1 `/` 홈·공통 메뉴 — 현재 로그인한 사용자를 알아낸다.
import { isDbConfigured } from "@/lib/db/config";
import { createServerDb } from "@/lib/db/server";

export type CurrentUser = { id: string; email: string; nickname: string };

/** 로그인한 사용자를 돌려준다. 로그인하지 않았거나 연결 정보가 없으면 null. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
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
