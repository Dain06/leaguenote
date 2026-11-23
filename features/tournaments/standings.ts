// Design Ref: §4.3 경기 기록·순위 — 결과 합계로 승점을 계산하고 순위를 매긴다. (임시 규칙: 승 3·무 1·패 0)
// 저장소를 쓰지 않는 순수 계산이라 Vitest로 규칙을 시험한다.
import { standingsPoints } from "@/lib/rules";

export type StandingInput = {
  team_id: string;
  team_name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
};

export type StandingRow = StandingInput & {
  rank: number;
  points: number;
  goal_diff: number;
};

/**
 * 승점 → 골득실 → 다득점 → 팀 이름 순으로 정렬해 순위를 매긴다.
 * 승점·골득실·다득점이 모두 같으면 같은 순위(공동 순위)를 준다.
 */
export function computeStandings(rows: StandingInput[]): StandingRow[] {
  const withPoints = rows.map((r) => ({
    ...r,
    points: standingsPoints(r.won, r.drawn, r.lost),
    goal_diff: r.goals_for - r.goals_against,
  }));

  withPoints.sort(
    (a, b) =>
      b.points - a.points ||
      b.goal_diff - a.goal_diff ||
      b.goals_for - a.goals_for ||
      a.team_name.localeCompare(b.team_name, "ko"),
  );

  let rank = 0;
  return withPoints.map((r, i) => {
    const prev = withPoints[i - 1];
    const tied =
      prev &&
      prev.points === r.points &&
      prev.goal_diff === r.goal_diff &&
      prev.goals_for === r.goals_for;
    if (!tied) rank = i + 1;
    return { ...r, rank };
  });
}
