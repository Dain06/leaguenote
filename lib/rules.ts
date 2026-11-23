// Design Ref: §1 설계 목표 — PRD의 규칙 값은 이 파일 한 곳에서 관리한다.
// 값이 바뀌어도 여기만 고치면 되도록, 규칙은 화면 코드에 직접 적지 않는다.

/** 1인 경기가 가능한 종목(예: 배드민턴)의 팀 최소 인원 (PRD M1 규칙) */
const MIN_PLAYERS_FOR_SOLO_SPORTS = 3;

/**
 * 팀 최소 인원: 종목마다 "한 경기에 필요한 인원"으로 정한다.
 * 1인 경기가 가능한 종목(필요 인원 1명)은 3명이다.
 */
export function teamMinPlayers(requiredPlayers: number): number {
  return requiredPlayers <= 1 ? MIN_PLAYERS_FOR_SOLO_SPORTS : requiredPlayers;
}
