// Design Ref: §1 설계 목표 — PRD의 규칙 값은 이 파일 한 곳에서 관리한다.
// 값이 바뀌어도 여기만 고치면 되도록, 규칙은 화면 코드에 직접 적지 않는다.

/** 출석 투표는 경기·모임 시작 이 시간 전에 게시된다 (PRD M1 규칙). 지원자 조사는 그 전까지 받는다. */
const ATTENDANCE_POLL_HOURS_BEFORE_START = 2;

/** 출석 투표가 게시되는 시각 = 지원자 조사·선수 확정의 마감 시각 */
export function attendancePollOpensAt(startsAt: string | Date): Date {
  const start = new Date(startsAt).getTime();
  return new Date(start - ATTENDANCE_POLL_HOURS_BEFORE_START * 60 * 60 * 1000);
}

/** 출석 투표는 경기·모임 시작 이 시간(분) 전에 마감된다 (PRD M1 규칙) */
const ATTENDANCE_POLL_MINUTES_BEFORE_START_TO_CLOSE = 30;

/** 출석 투표가 마감되는 시각 */
export function attendancePollClosesAt(startsAt: string | Date): Date {
  const start = new Date(startsAt).getTime();
  return new Date(
    start - ATTENDANCE_POLL_MINUTES_BEFORE_START_TO_CLOSE * 60 * 1000,
  );
}

/** 지금 출석 투표를 받는 중인지 (게시 시각 이상, 마감 시각 미만) */
export function isAttendancePollOpen(
  opensAt: string | Date,
  closesAt: string | Date,
  now: Date = new Date(),
): boolean {
  return (
    now.getTime() >= new Date(opensAt).getTime() &&
    now.getTime() < new Date(closesAt).getTime()
  );
}

/** 지금 지원자 조사(참석 의향)를 받을 수 있는지 */
export function isSurveyOpen(startsAt: string | Date, now: Date = new Date()): boolean {
  return now.getTime() < attendancePollOpensAt(startsAt).getTime();
}

/** 1인 경기가 가능한 종목(예: 배드민턴)의 팀 최소 인원 (PRD M1 규칙) */
const MIN_PLAYERS_FOR_SOLO_SPORTS = 3;

/**
 * 팀 최소 인원: 종목마다 "한 경기에 필요한 인원"으로 정한다.
 * 1인 경기가 가능한 종목(필요 인원 1명)은 3명이다.
 */
export function teamMinPlayers(requiredPlayers: number): number {
  return requiredPlayers <= 1 ? MIN_PLAYERS_FOR_SOLO_SPORTS : requiredPlayers;
}
