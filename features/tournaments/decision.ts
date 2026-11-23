// Design Ref: §4.2 M2 — [D+3 또는 모두 응답 시 조기 종료] 미응답 과반 팀 취소 → 남은 팀 4팀 미만이면 대회 취소, 아니면 확정
// 저장소를 쓰지 않는 순수 계산이라 Vitest로 규칙을 시험한다. 규칙 값은 lib/rules.ts에만 있다.
import { isTeamCancelledForNoResponse, TOURNAMENT_MIN_TEAMS } from "@/lib/rules";

export type TeamResponseState = {
  teamId: string;
  /** 팀원 수 */
  memberCount: number;
  /** 참가·불참 중 하나라도 응답한 팀원 수 */
  respondedCount: number;
};

export type DecisionOutcome =
  | { kind: "waiting" }
  | { kind: "confirmed"; cancelledTeamIds: string[] }
  | { kind: "cancelled"; cancelledTeamIds: string[]; reason: string };

/**
 * 지금 대회를 확정·취소할지 판정한다.
 *  - 모든 팀의 모든 팀원이 응답했으면 기한을 기다리지 않고 바로 확정한다. (최대 기간 3일은 늘리지 않는다)
 *  - 기한이 지났으면 미응답이 과반수보다 많은 팀을 빼고, 남은 팀이 4팀 미만이면 대회를 취소한다.
 *  - 그 밖에는 계속 기다린다.
 */
export function decideTournament(
  teams: TeamResponseState[],
  deadlinePassed: boolean,
): DecisionOutcome {
  const allResponded = teams.every((t) => t.respondedCount >= t.memberCount);
  if (!deadlinePassed && !allResponded) return { kind: "waiting" };

  const cancelledTeamIds = teams
    .filter((t) => isTeamCancelledForNoResponse(t.memberCount, t.respondedCount))
    .map((t) => t.teamId);
  const remaining = teams.length - cancelledTeamIds.length;

  if (remaining < TOURNAMENT_MIN_TEAMS) {
    return {
      kind: "cancelled",
      cancelledTeamIds,
      reason: `응답하지 않은 팀원이 많은 팀이 빠져 남은 팀이 ${remaining}팀이 되어(최소 ${TOURNAMENT_MIN_TEAMS}팀) 대회를 열지 않습니다.`,
    };
  }
  return { kind: "confirmed", cancelledTeamIds };
}
