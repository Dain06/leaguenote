"use server";

// Design Ref: §4.1 M1 일정·출석 — 운영자 입력(일정) → 입력 검사 → 저장 → 팀원 화면에 일정 표시
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/features/auth/queries";
import { createServerDb } from "@/lib/db/server";
import { notifyTeamOperators } from "@/lib/notify";
import {
  attendancePollClosesAt,
  attendancePollOpensAt,
  isAttendancePollOpen,
  isSurveyOpen,
  teamMinPlayers,
} from "@/lib/rules";
import { formatKst, parseKstLocal } from "@/lib/time";

import { getEvent } from "./queries";
import { eventSchema, type EventFormState } from "./schemas";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
      // 출석 투표 게시·마감 시각은 시작 시각에서 규칙(lib/rules.ts)으로 계산해 일정에 한 번 저장한다.
      attendance_opens_at: attendancePollOpensAt(startsAt).toISOString(),
      attendance_closes_at: attendancePollClosesAt(startsAt).toISOString(),
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

export type RosterFormState =
  | { message?: string; savedCount?: number }
  | undefined;

/**
 * 선수 확정: 운영자가 참석 의향을 남긴 팀원 중에서 선수를 고른다. (같은 일정은 다시 확정해 바꿀 수 있다)
 * 출석 투표가 게시되기 전까지만 가능하고, 확정 인원이 최소 인원보다 적으면 운영자에게 알림을 남긴다.
 */
export async function confirmRoster(
  eventId: string,
  // useActionState가 이전 결과를 첫 인자로 넘겨 주므로 받아야 하지만, 이 함수에서는 쓰지 않는다.
  _prevState: RosterFormState,
  formData: FormData,
): Promise<RosterFormState> {
  await requireUser(`/events/${eventId}`);

  const event = await getEvent(eventId);
  if (!event) return { message: "일정을 찾을 수 없습니다." };
  if (event.status === "cancelled" || !isSurveyOpen(event.starts_at)) {
    return {
      message: "선수 확정은 출석 투표가 게시되기 전까지만 할 수 있습니다.",
    };
  }

  const playerIds = formData
    .getAll("players")
    .filter((v): v is string => typeof v === "string" && UUID_PATTERN.test(v));

  const db = await createServerDb();
  const { data, error } = await db.rpc("confirm_roster", {
    p_event_id: eventId,
    p_user_ids: playerIds,
  });

  if (error) {
    return {
      message: error.message.includes("운영자")
        ? "선수 확정은 팀 운영자만 할 수 있습니다."
        : "선수를 확정하지 못했습니다. 참석 의향을 남긴 팀원만 확정할 수 있습니다.",
    };
  }

  const count = Number(data ?? 0);
  const minPlayers = teamMinPlayers(event.team.required_players);

  // 확정 인원이 최소 인원보다 적으면 팀 운영자에게 알린다. (PRD M1 규칙)
  if (count > 0 && count < minPlayers) {
    await notifyTeamOperators(db, event.team_id, {
      kind: "roster_short",
      message: `${event.team.name} ${formatKst(event.starts_at)} 일정의 확정 인원(${count}명)이 최소 인원(${minPlayers}명)보다 적습니다.`,
      link: `/events/${eventId}`,
    });
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/", "layout");
  return { savedCount: count };
}

/**
 * 출석 투표: 확정된 선수가 내 출석 여부(출석/불참)를 남기거나 바꾼다.
 * 게시 시각 이후 마감 시각 전까지만 받는다. (확정 선수인지는 데이터베이스 접근 규칙이 확인)
 */
export async function respondAttendance(
  eventId: string,
  response: "present" | "absent",
) {
  const user = await requireUser(`/events/${eventId}`);
  const event = await getEvent(eventId);

  if (
    !event ||
    event.status === "cancelled" ||
    !isAttendancePollOpen(event.attendance_opens_at, event.attendance_closes_at)
  ) {
    revalidatePath(`/events/${eventId}`);
    return;
  }

  const db = await createServerDb();
  await db.from("attendance").upsert(
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
