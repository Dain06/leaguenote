"use server";

// Design Ref: §3.1 `/notifications` 알림함 — 읽음 처리
import { revalidatePath } from "next/cache";

import { requireUser } from "@/features/auth/queries";
import { createServerDb } from "@/lib/db/server";

/** 내 알림을 모두 읽음으로 표시한다. (남의 알림은 데이터베이스 접근 규칙이 막는다) */
export async function markAllNotificationsRead() {
  const user = await requireUser("/notifications");
  const db = await createServerDb();
  await db
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

  // 메뉴의 읽지 않은 알림 개수도 함께 바뀌도록 전체 화면을 새로 그린다.
  revalidatePath("/", "layout");
}
