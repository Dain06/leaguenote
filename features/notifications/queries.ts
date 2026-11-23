// Design Ref: §5 저장할 데이터 — 알림(notifications) 조회. 본인 알림만 볼 수 있다. (데이터베이스 접근 규칙)
import { createServerDb } from "@/lib/db/server";

export type NotificationItem = {
  id: string;
  kind: string;
  message: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

/** 내 알림 목록 (최신순) */
export async function getMyNotifications(limit = 50): Promise<NotificationItem[]> {
  const db = await createServerDb();
  const { data } = await db
    .from("notifications")
    .select("id, kind, message, link, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as NotificationItem[];
}

/** 아직 읽지 않은 알림 개수 */
export async function getUnreadCount(): Promise<number> {
  const db = await createServerDb();
  const { count } = await db
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  return count ?? 0;
}
