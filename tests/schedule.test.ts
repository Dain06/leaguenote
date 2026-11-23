import { describe, expect, it } from "vitest";

import { allPairs, pairKey, unagreedPairs } from "@/features/tournaments/schedule";
import { tournamentMatchEarliest, tournamentScheduleDeadline } from "@/lib/rules";

describe("경기 짝", () => {
  it("n팀이면 n(n-1)/2개의 짝", () => {
    expect(allPairs(["a", "b", "c", "d"])).toHaveLength(6);
    expect(allPairs(Array.from({ length: 8 }, (_, i) => `t${i}`))).toHaveLength(28);
    expect(allPairs(["a"])).toHaveLength(0);
  });

  it("짝 키는 팀 순서와 상관없이 같다", () => {
    expect(pairKey("a", "b")).toBe(pairKey("b", "a"));
    expect(pairKey("a", "b")).not.toBe(pairKey("a", "c"));
  });

  it("합의된 짝(순서 무관)을 뺀 나머지가 미합의", () => {
    const teams = ["a", "b", "c", "d"];
    const left = unagreedPairs(teams, [["b", "a"], ["c", "d"]]);
    expect(left).toHaveLength(4);
    expect(left.map(([x, y]) => pairKey(x, y))).not.toContain(pairKey("a", "b"));
    expect(left.map(([x, y]) => pairKey(x, y))).not.toContain(pairKey("c", "d"));
  });

  it("모두 합의되면 미합의는 없다", () => {
    const teams = ["a", "b", "c"];
    expect(unagreedPairs(teams, allPairs(teams))).toHaveLength(0);
  });
});

describe("대회 경기 시각 규칙", () => {
  it("경기는 대회 시작일(한국) 0시 이후만 가능", () => {
    expect(tournamentMatchEarliest("2027-01-10")?.toISOString()).toBe("2027-01-09T15:00:00.000Z");
    expect(tournamentMatchEarliest("잘못된 값")).toBeNull();
  });

  it("경기 일정 확정 기한은 신청 마감 +7일", () => {
    expect(tournamentScheduleDeadline(new Date("2026-12-19T15:00:00Z")).toISOString()).toBe(
      "2026-12-26T15:00:00.000Z",
    );
  });
});
