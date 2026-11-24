"use server";

// Design Ref: §4.2 M2 — [D+3~D+7] 두 팀 사이 경기 일정 조율 요청 → 합의되면 양 팀의 대회 경기 일정 자동 생성
import { revalidatePath } from "next/cache";

import { requireUser } from "@/features/auth/queries";
import { createAdminDb } from "@/lib/db/admin";
import { friendlyDbError } from "@/lib/db/errors";
import { createServerDb } from "@/lib/db/server";
import { attendancePollClosesAt, attendancePollOpensAt } from "@/lib/rules";
import { formatKst, parseKstLocal } from "@/lib/time";

import { getOperatorTeams } from "./queries";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ProposeState = { message?: string; done?: boolean } | undefined;

/** 팀 운영자(들)의 사용자 번호 */
async function operatorIds(
  db: ReturnType<typeof createAdminDb>,
  teamId: string,
): Promise<string[]> {
  const { data } = await db
    .from("team_members")
    .select("user_id")
    .eq("team_id", teamId)
    .eq("role", "operator");
  return (data ?? []).map((m) => m.user_id as string);
}

async function teamName(
  db: ReturnType<typeof createAdminDb>,
  teamId: string,
): Promise<string> {
  const { data } = await db.from("teams").select("name").eq("id", teamId).maybeSingle();
  return data?.name ?? "";
}

async function notifyUsers(
  db: ReturnType<typeof createAdminDb>,
  userIds: string[],
  kind: string,
  message: string,
  link: string,
) {
  if (userIds.length === 0) return;
  await db
    .from("notifications")
    .insert(userIds.map((user_id) => ({ user_id, kind, message: message.slice(0, 200), link })));
}

/** 일정 제안 보내기 (우리 팀 운영자 → 상대 팀). 기간·권한은 데이터베이스 함수가 확인한다. */
export async function proposeSchedule(
  tournamentId: string,
  fromTeamId: string,
  toTeamId: string,
  _prevState: ProposeState,
  formData: FormData,
): Promise<ProposeState> {
  await requireUser(`/tournaments/${tournamentId}`);
  if (![tournamentId, fromTeamId, toTeamId].every((id) => UUID_PATTERN.test(id))) {
    return { message: "요청이 올바르지 않습니다." };
  }

  const startsAt = parseKstLocal(String(formData.get("startsAt") ?? ""));
  const location = String(formData.get("location") ?? "").trim();
  if (!startsAt) return { message: "경기 날짜와 시간을 입력해 주세요." };
  if (location.length < 1 || location.length > 60) {
    return { message: "장소는 1~60자로 입력해 주세요." };
  }

  const db = await createServerDb();
  const { error } = await db.rpc("propose_schedule", {
    p_tournament_id: tournamentId,
    p_from_team_id: fromTeamId,
    p_to_team_id: toTeamId,
    p_proposed_at: startsAt.toISOString(),
    p_location: location,
  });
  if (error) return { message: friendlyDbError(error) };

  const admin = createAdminDb();
  const from = await teamName(admin, fromTeamId);
  await notifyUsers(
    admin,
    await operatorIds(admin, toTeamId),
    "schedule_proposed",
    `${from}이(가) ${formatKst(startsAt)} ${location}에서 경기하자고 제안했습니다. 대회 화면에서 수락하거나 거절해 주세요.`,
    `/tournaments/${tournamentId}`,
  );

  revalidatePath(`/tournaments/${tournamentId}`);
  return { done: true, message: "제안을 보냈습니다." };
}

type RequestRow = {
  id: string;
  tournament_id: string;
  from_team_id: string;
  to_team_id: string;
  proposed_at: string;
  location: string;
  status: "pending" | "accepted" | "rejected" | "withdrawn";
};

/** 받은 제안 수락/거절 (받은 팀 운영자만). 수락하면 양 팀의 대회 경기 일정이 만들어진다. */
export async function respondSchedule(
  requestId: string,
  accept: boolean,
): Promise<void> {
  const user = await requireUser("/tournaments");
  if (!UUID_PATTERN.test(requestId)) return;

  const db = await createServerDb();
  const { data } = await db
    .from("schedule_requests")
    .select("id, tournament_id, from_team_id, to_team_id, proposed_at, location, status")
    .eq("id", requestId)
    .maybeSingle();
  const request = data as RequestRow | null;
  if (!request) return;

  const link = `/tournaments/${request.tournament_id}`;
  const admin = createAdminDb();

  if (!accept) {
    const { error } = await db.rpc("reject_schedule_request", { p_request_id: requestId });
    if (!error && request.status === "pending") {
      const to = await teamName(admin, request.to_team_id);
      await notifyUsers(
        admin,
        await operatorIds(admin, request.from_team_id),
        "schedule_rejected",
        `${to}이(가) ${formatKst(request.proposed_at)} 경기 제안을 거절했습니다. 다른 시간으로 다시 제안해 주세요.`,
        link,
      );
    }
    revalidatePath(link);
    return;
  }

  // 수락: 받은 팀의 운영자만, 대기 중인 요청만, 조율 기간 안에서만
  const operatorTeams = await getOperatorTeams(user.id);
  if (request.status !== "pending" || !operatorTeams.some((t) => t.id === request.to_team_id)) {
    return;
  }
  const { data: tournament } = await admin
    .from("tournaments")
    .select("status, schedule_deadline_at")
    .eq("id", request.tournament_id)
    .maybeSingle();
  const now = new Date();
  if (
    !tournament ||
    tournament.status !== "confirmed" ||
    now.getTime() >= new Date(tournament.schedule_deadline_at).getTime() ||
    new Date(request.proposed_at).getTime() <= now.getTime()
  ) {
    return;
  }

  // 같은 요청을 두 번 수락하지 않도록 먼저 "수락됨"으로 선점한다.
  const { data: claimed } = await admin
    .from("schedule_requests")
    .update({ status: "accepted", responded_at: now.toISOString() })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id");
  if (!claimed || claimed.length === 0) return;

  // 양 팀의 대회 경기 일정을 만든다. (출석 투표 시각은 규칙으로 계산해 한 번 저장)
  const startsAt = new Date(request.proposed_at);
  const { data: events, error: eventError } = await admin
    .from("events")
    .insert(
      [request.from_team_id, request.to_team_id].map((team_id) => ({
        team_id,
        type: "tournament",
        starts_at: startsAt.toISOString(),
        location: request.location,
        created_by: user.id,
        attendance_opens_at: attendancePollOpensAt(startsAt).toISOString(),
        attendance_closes_at: attendancePollClosesAt(startsAt).toISOString(),
        tournament_id: request.tournament_id,
        schedule_request_id: requestId,
      })),
    )
    .select("id, team_id");

  if (eventError || !events || events.length !== 2) {
    // 일정을 못 만들었으면 수락을 되돌린다.
    await admin.from("events").delete().eq("schedule_request_id", requestId);
    await admin
      .from("schedule_requests")
      .update({ status: "pending", responded_at: null })
      .eq("id", requestId);
    revalidatePath(link);
    return;
  }

  const [fromName, toName] = await Promise.all([
    teamName(admin, request.from_team_id),
    teamName(admin, request.to_team_id),
  ]);
  for (const [teamId, opponent] of [
    [request.from_team_id, toName],
    [request.to_team_id, fromName],
  ] as const) {
    const { data: members } = await admin
      .from("team_members")
      .select("user_id")
      .eq("team_id", teamId);
    await notifyUsers(
      admin,
      (members ?? []).map((m) => m.user_id as string),
      "schedule_agreed",
      `${opponent}와(과)의 경기 일정이 ${formatKst(startsAt)} ${request.location}으로 합의되었습니다. 일정에서 참석 의향을 남겨 주세요.`,
      `/events/${events.find((e) => e.team_id === teamId)?.id ?? ""}`,
    );
  }

  revalidatePath(link);
  revalidatePath("/");
}

/** 보낸 제안 철회 (보낸 팀 운영자만) */
export async function withdrawSchedule(requestId: string): Promise<void> {
  await requireUser("/tournaments");
  if (!UUID_PATTERN.test(requestId)) return;

  const db = await createServerDb();
  const { data } = await db
    .from("schedule_requests")
    .select("tournament_id")
    .eq("id", requestId)
    .maybeSingle();
  await db.rpc("withdraw_schedule_request", { p_request_id: requestId });
  if (data) revalidatePath(`/tournaments/${data.tournament_id}`);
}
