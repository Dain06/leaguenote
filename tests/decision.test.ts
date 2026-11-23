import { describe, expect, it } from "vitest";

import { decideTournament, type TeamResponseState } from "@/features/tournaments/decision";
import { isTeamCancelledForNoResponse } from "@/lib/rules";

function team(id: string, memberCount: number, respondedCount: number): TeamResponseState {
  return { teamId: id, memberCount, respondedCount };
}

describe("미응답 과반 팀 취소", () => {
  it("미응답이 팀원의 과반수보다 많을 때만 취소 (절반은 유지)", () => {
    expect(isTeamCancelledForNoResponse(4, 1)).toBe(true); // 미응답 3/4
    expect(isTeamCancelledForNoResponse(4, 2)).toBe(false); // 미응답 2/4 = 정확히 절반
    expect(isTeamCancelledForNoResponse(5, 2)).toBe(true); // 미응답 3/5
    expect(isTeamCancelledForNoResponse(5, 3)).toBe(false); // 미응답 2/5
    expect(isTeamCancelledForNoResponse(1, 0)).toBe(true); // 1명 팀이 응답 안 함
    expect(isTeamCancelledForNoResponse(3, 3)).toBe(false);
  });
});

describe("대회 확정·취소 판정", () => {
  const allDone = [team("a", 3, 3), team("b", 2, 2), team("c", 1, 1), team("d", 4, 4)];

  it("기한 전에 모두 응답하면 기다리지 않고 바로 확정", () => {
    expect(decideTournament(allDone, false)).toEqual({ kind: "confirmed", cancelledTeamIds: [] });
  });

  it("기한 전에 한 명이라도 남았으면 계속 기다린다", () => {
    const teams = [team("a", 3, 2), ...allDone.slice(1)];
    expect(decideTournament(teams, false)).toEqual({ kind: "waiting" });
  });

  it("기한이 지나면 미응답 과반 팀만 빼고 남은 4팀 이상이면 확정", () => {
    const teams = [
      team("a", 4, 1), // 취소
      team("b", 3, 3),
      team("c", 3, 2),
      team("d", 4, 4),
      team("e", 2, 1), // 정확히 절반 → 유지
    ];
    expect(decideTournament(teams, true)).toEqual({ kind: "confirmed", cancelledTeamIds: ["a"] });
  });

  it("기한이 지나 남은 팀이 4팀 미만이면 대회 취소", () => {
    const teams = [team("a", 4, 0), team("b", 4, 0), team("c", 3, 3), team("d", 3, 3), team("e", 2, 2)];
    const result = decideTournament(teams, true);
    expect(result.kind).toBe("cancelled");
    if (result.kind === "cancelled") {
      expect(result.cancelledTeamIds).toEqual(["a", "b"]);
      expect(result.reason).toContain("3팀");
    }
  });

  it("딱 4팀이 남으면 확정", () => {
    const teams = [team("a", 4, 0), team("b", 3, 3), team("c", 3, 3), team("d", 3, 3), team("e", 3, 3)];
    expect(decideTournament(teams, true)).toEqual({ kind: "confirmed", cancelledTeamIds: ["a"] });
  });

  it("기한이 지났어도 모두 응답했으면 취소 팀 없이 확정", () => {
    expect(decideTournament(allDone, true)).toEqual({ kind: "confirmed", cancelledTeamIds: [] });
  });
});
