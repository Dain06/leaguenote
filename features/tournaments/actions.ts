"use server";

// Design Ref: §4.2 M2 — 운영자 입력(참가 신청) → 입력 검사 → 신청 자료에 저장(매칭 대기)
import { revalidatePath } from "next/cache";

import { requireUser } from "@/features/auth/queries";
import { getOperatorTeams } from "./queries";
import { createAdminDb } from "@/lib/db/admin";
import { createServerDb } from "@/lib/db/server";
import { teamMinPlayers, tournamentApplicationDeadline } from "@/lib/rules";
import { formatKst } from "@/lib/time";

import { evaluateTournament } from "./run-decisions";
import { applicationSchema, type ApplicationFormState } from "./schemas";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function applyTournament(
  _prevState: ApplicationFormState,
  formData: FormData,
): Promise<ApplicationFormState> {
  const user = await requireUser("/tournaments");

  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") values[key] = value;
  }

  const parsed = applicationSchema.safeParse(values);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      (errors[key] ??= []).push(issue.message);
    }
    return { errors, values };
  }
  const { teamId, teamSize, careerMonths, startsOn } = parsed.data;

  // 운영자인 팀만 신청할 수 있다. (데이터베이스 접근 규칙이 한 번 더 확인)
  const team = (await getOperatorTeams(user.id)).find((t) => t.id === teamId);
  if (!team) {
    return { message: "팀 운영자만 참가 신청을 할 수 있습니다.", values };
  }

  const minPlayers = teamMinPlayers(team.required_players);
  if (teamSize < minPlayers) {
    return {
      errors: { teamSize: [`${team.sport}은(는) 팀 인원이 최소 ${minPlayers}명 이상이어야 합니다.`] },
      values,
    };
  }

  const deadline = tournamentApplicationDeadline(startsOn);
  if (!deadline) {
    return { errors: { startsOn: ["대회 시작일을 입력해 주세요."] }, values };
  }
  if (deadline.getTime() <= Date.now()) {
    return {
      errors: {
        startsOn: [
          "신청은 대회 시작 3주 전까지만 받습니다. 더 늦은 날짜를 선택해 주세요.",
        ],
      },
      values,
    };
  }

  const db = await createServerDb();
  const { error } = await db.rpc("apply_tournament", {
    p_team_id: teamId,
    p_team_size: teamSize,
    p_career_months: careerMonths,
    p_starts_on: startsOn,
  });

  if (error) {
    // 같은 팀이 같은 시작일에 이미 신청한 경우
    if (error.code === "23505") {
      return {
        message: "이 팀은 같은 대회 시작일에 이미 신청했습니다.",
        values,
      };
    }
    return { message: "참가 신청을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.", values };
  }

  revalidatePath("/tournaments");
  return {
    done: true,
    message: `신청했습니다. ${formatKst(deadline)}에 신청이 마감되고 매칭이 진행됩니다.`,
  };
}

/**
 * 대회 참가 여부 응답: 참가 팀 팀원이 "참가"/"불참"을 남긴다. 기간·권한은 데이터베이스 함수가 확인한다.
 * 응답 직후 모두 응답했는지 확인해, 기한을 기다리지 않고 바로 확정한다.
 */
export async function respondTournament(
  tournamentId: string,
  response: "join" | "decline",
): Promise<void> {
  await requireUser(`/tournaments/${tournamentId}`);
  if (!UUID_PATTERN.test(tournamentId)) return;

  const db = await createServerDb();
  const { error } = await db.rpc("respond_tournament", {
    p_tournament_id: tournamentId,
    p_response: response,
  });

  if (!error) {
    // 판정은 모든 팀의 응답을 읽어야 하므로 서버 전용 연결로 한다.
    await evaluateTournament(createAdminDb(), tournamentId, new Date());
  }
  revalidatePath(`/tournaments/${tournamentId}`);
  revalidatePath("/tournaments");
}

/** 마감 전·매칭 대기 중인 신청 취소 (운영자만. 접근 규칙이 한 번 더 확인한다) */
export async function withdrawApplication(applicationId: string): Promise<void> {
  await requireUser("/tournaments");
  if (!UUID_PATTERN.test(applicationId)) return;

  const db = await createServerDb();
  await db.from("tournament_applications").delete().eq("id", applicationId);
  revalidatePath("/tournaments");
}
