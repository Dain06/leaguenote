"use server";

// Design Ref: §4.1 M1 일정·출석 — 운영자 입력(일정) → 입력 검사 → 저장 → 팀원 화면에 일정 표시
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/features/auth/queries";
import { createServerDb } from "@/lib/db/server";
import { isSurveyOpen } from "@/lib/rules";
import { parseKstLocal } from "@/lib/time";

import { eventSchema, type EventFormState } from "./schemas";

export async function createEvent(
  teamId: string,
  _prevState: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const user = await requireUser(`/teams/${teamId}/events/new`);

  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") values[key] = value;
  }

  const parsed = eventSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      (errors[key] ??= []).push(issue.message);
    }
    return { errors, values };
  }

  // 입력한 시간은 한국 시간으로 보고, 지난 시각은 받지 않는다.
  const startsAt = parseKstLocal(parsed.data.startsAt);
  if (!startsAt || startsAt.getTime() <= Date.now()) {
    return {
      errors: { startsAt: ["지금 이후의 날짜와 시간을 입력해 주세요."] },
      values,
    };
  }

  const db = await createServerDb();
  // 연습 일정은 운영자만 만들 수 있다. (데이터베이스 접근 규칙이 한 번 더 확인)
  const { data, error } = await db
    .from("events")
    .insert({
      team_id: teamId,
      type: "practice",
      starts_at: startsAt.toISOString(),
      location: parsed.data.location,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      message: "일정을 만들 수 없습니다. 팀 운영자만 일정을 만들 수 있습니다.",
      values,
    };
  }

  redirect(`/events/${data.id}`);
}

/**
 * 지원자 조사: 내 참석 의향(참석/불참)을 남기거나 바꾼다.
 * 같은 팀원만 가능하고(데이터베이스 접근 규칙), 출석 투표가 게시되기 전까지만 받는다.
 */
export async function respondToEvent(
  eventId: string,
  response: "attend" | "absent",
) {
  const user = await requireUser(`/events/${eventId}`);
  const db = await createServerDb();

  const { data: event } = await db
    .from("events")
    .select("starts_at, status")
    .eq("id", eventId)
    .maybeSingle();

  // 볼 수 없는 일정, 취소된 일정, 마감된 조사에는 응답을 남기지 않는다.
  if (!event || event.status === "cancelled" || !isSurveyOpen(event.starts_at)) {
    revalidatePath(`/events/${eventId}`);
    return;
  }

  await db.from("event_responses").upsert(
    {
      event_id: eventId,
      user_id: user.id,
      response,
      responded_at: new Date().toISOString(),
    },
    { onConflict: "event_id,user_id" },
  );

  revalidatePath(`/events/${eventId}`);
}
