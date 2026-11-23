"use server";

// Design Ref: §4.3 용병 모집 — 모집 글(시간·종목·지역·필요 인원만 공개) → 지원 → 운영자가 선수 확정에 반영
import { revalidatePath } from "next/cache";

import { requireUser } from "@/features/auth/queries";
import { getEvent } from "@/features/events/queries";
import { createAdminDb } from "@/lib/db/admin";
import { createServerDb } from "@/lib/db/server";
import { isSurveyOpen } from "@/lib/rules";
import { formatKst } from "@/lib/time";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type MercenaryFormState = { message?: string; done?: boolean } | undefined;

function refresh(eventId?: string) {
  if (eventId) revalidatePath(`/events/${eventId}`);
  revalidatePath("/mercenary");
}

/** 용병 모집 글 올리기 (그 일정 팀의 운영자만. 확정 마감 전의 일정만) */
export async function createMercenaryPost(
  eventId: string,
  _prevState: MercenaryFormState,
  formData: FormData,
): Promise<MercenaryFormState> {
  await requireUser(`/events/${eventId}`);
  if (!UUID_PATTERN.test(eventId)) return { message: "일정을 찾을 수 없습니다." };

  const needed = String(formData.get("neededCount") ?? "");
  if (!/^\d{1,2}$/.test(needed) || Number(needed) < 1 || Number(needed) > 10) {
    return { message: "필요 인원은 1~10명으로 입력해 주세요." };
  }

  // 선수 확정이 끝난 뒤에는 용병을 받아도 명단에 넣을 수 없으므로 모집하지 않는다.
  const event = await getEvent(eventId);
  if (!event || event.status === "cancelled" || !isSurveyOpen(event.starts_at)) {
    return { message: "선수 확정이 마감된 일정에는 용병을 모집할 수 없습니다." };
  }

  const db = await createServerDb();
  const { error } = await db.rpc("create_mercenary_post", {
    p_event_id: eventId,
    p_needed_count: Number(needed),
  });
  if (error) return { message: error.message };

  refresh(eventId);
  return { done: true, message: "용병 모집 글을 올렸습니다." };
}

/** 모집 마감 / 다시 모집 (운영자만) */
export async function setMercenaryStatus(
  eventId: string,
  postId: string,
  status: "open" | "closed",
): Promise<void> {
  await requireUser(`/events/${eventId}`);
  if (!UUID_PATTERN.test(postId)) return;
  const db = await createServerDb();
  await db.rpc("set_mercenary_status", { p_post_id: postId, p_status: status });
  refresh(eventId);
}

/** 용병으로 지원하기 */
export async function applyMercenary(postId: string): Promise<void> {
  await requireUser("/mercenary");
  if (!UUID_PATTERN.test(postId)) return;
  const db = await createServerDb();
  await db.rpc("apply_mercenary", { p_post_id: postId });
  refresh();
}

/** 아직 응답받지 않은 내 지원 취소 */
export async function withdrawMercenary(postId: string): Promise<void> {
  const user = await requireUser("/mercenary");
  if (!UUID_PATTERN.test(postId)) return;
  const db = await createServerDb();
  await db
    .from("mercenary_applications")
    .delete()
    .eq("post_id", postId)
    .eq("user_id", user.id);
  refresh();
}

/** 지원자 수락 → 선수 확정 명단에 용병으로 반영. 수락된 지원자에게만 장소를 알림으로 알려 준다. */
export async function acceptMercenary(
  eventId: string,
  postId: string,
  userId: string,
): Promise<void> {
  await requireUser(`/events/${eventId}`);
  if (![eventId, postId, userId].every((id) => UUID_PATTERN.test(id))) return;

  // 선수 확정 마감(출석 투표 게시) 뒤에는 명단을 바꾸지 않는다.
  const event = await getEvent(eventId);
  if (!event || event.status === "cancelled" || !isSurveyOpen(event.starts_at)) {
    refresh(eventId);
    return;
  }

  const db = await createServerDb();
  const { error } = await db.rpc("accept_mercenary", {
    p_post_id: postId,
    p_user_id: userId,
  });

  if (!error) {
    const admin = createAdminDb();
    await admin.from("notifications").insert({
      user_id: userId,
      kind: "mercenary_accepted",
      message:
        `${event.team.name}: ${formatKst(event.starts_at)} ${event.team.sport} 경기에 용병으로 수락되었습니다. 장소: ${event.location}`.slice(0, 200),
      link: "/mercenary",
    });
  }
  refresh(eventId);
}

/** 지원 거절 또는 수락 취소 (운영자만) */
export async function rejectMercenary(
  eventId: string,
  postId: string,
  userId: string,
): Promise<void> {
  await requireUser(`/events/${eventId}`);
  if (![eventId, postId, userId].every((id) => UUID_PATTERN.test(id))) return;

  const db = await createServerDb();
  const { error } = await db.rpc("reject_mercenary", {
    p_post_id: postId,
    p_user_id: userId,
  });
  if (!error) {
    await createAdminDb().from("notifications").insert({
      user_id: userId,
      kind: "mercenary_rejected",
      message: "용병 지원이 받아들여지지 않았습니다. 다른 모집 글을 확인해 보세요.",
      link: "/mercenary",
    });
  }
  refresh(eventId);
}
