import { describe, expect, it } from "vitest";

import { computeStandings, type StandingInput } from "@/features/tournaments/standings";
import { standingsPoints } from "@/lib/rules";

function row(
  name: string,
  won: number,
  drawn: number,
  lost: number,
  gf: number,
  ga: number,
): StandingInput {
  return {
    team_id: name,
    team_name: name,
    played: won + drawn + lost,
    won,
    drawn,
    lost,
    goals_for: gf,
    goals_against: ga,
  };
}

describe("승점", () => {
  it("승 3점, 무 1점, 패 0점", () => {
    expect(standingsPoints(2, 1, 3)).toBe(7);
    expect(standingsPoints(0, 0, 0)).toBe(0);
  });
});

describe("순위 계산", () => {
  it("승점이 높은 팀이 위", () => {
    const r = computeStandings([row("가", 1, 0, 2, 3, 6), row("나", 2, 0, 1, 5, 3), row("다", 0, 3, 0, 3, 3)]);
    expect(r.map((x) => x.team_name)).toEqual(["나", "다", "가"]);
    expect(r.map((x) => x.points)).toEqual([6, 3, 3]);
  });

  it("승점이 같으면 골득실, 그다음 다득점 순", () => {
    const r = computeStandings([
      row("가", 1, 0, 1, 2, 2), // 승점 3, 득실 0, 득점 2
      row("나", 1, 0, 1, 5, 3), // 승점 3, 득실 +2
      row("다", 1, 0, 1, 4, 4), // 승점 3, 득실 0, 득점 4
    ]);
    expect(r.map((x) => x.team_name)).toEqual(["나", "다", "가"]);
    expect(r.map((x) => x.rank)).toEqual([1, 2, 3]);
  });

  it("승점·골득실·다득점이 모두 같으면 공동 순위, 다음 순위는 건너뛴다", () => {
    const r = computeStandings([
      row("가", 1, 0, 0, 2, 1),
      row("나", 1, 0, 0, 2, 1),
      row("다", 0, 0, 1, 0, 1),
    ]);
    expect(r.map((x) => x.rank)).toEqual([1, 1, 3]);
  });

  it("경기를 아직 안 한 팀도 순위표에 0점으로 들어간다", () => {
    const r = computeStandings([row("가", 0, 0, 0, 0, 0), row("나", 1, 0, 0, 1, 0)]);
    expect(r[0].team_name).toBe("나");
    expect(r[1]).toMatchObject({ team_name: "가", points: 0, played: 0, rank: 2 });
  });

  it("골득실을 계산해 돌려준다", () => {
    const [first] = computeStandings([row("가", 2, 0, 0, 7, 2)]);
    expect(first.goal_diff).toBe(5);
    expect(first.points).toBe(6);
  });
});
