// Design Ref: §4.2 M2 — 두 팀 사이 경기 일정 조율. 참가 팀끼리 가능한 모든 짝과, 기한 안에 합의되지 않은 짝을 계산한다.
// 저장소를 쓰지 않는 순수 계산이라 Vitest로 시험한다.

export type TeamPair = [string, string];

/** 팀 순서와 상관없이 같은 짝이면 같은 문자열 */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** 참가 팀들 사이에서 가능한 모든 짝 (n팀이면 n(n-1)/2 개) */
export function allPairs(teamIds: string[]): TeamPair[] {
  const pairs: TeamPair[] = [];
  for (let i = 0; i < teamIds.length; i += 1) {
    for (let j = i + 1; j < teamIds.length; j += 1) {
      pairs.push([teamIds[i], teamIds[j]]);
    }
  }
  return pairs;
}

/** 합의된 짝(순서 무관)을 뺀, 아직 경기 일정이 합의되지 않은 짝 */
export function unagreedPairs(teamIds: string[], agreed: TeamPair[]): TeamPair[] {
  const done = new Set(agreed.map(([a, b]) => pairKey(a, b)));
  return allPairs(teamIds).filter(([a, b]) => !done.has(pairKey(a, b)));
}
