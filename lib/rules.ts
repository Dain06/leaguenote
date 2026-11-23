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

/** 대회 참가 신청은 대회 시작 이 주(week) 전에 마감된다 (PRD M2 규칙) */
const TOURNAMENT_APPLICATION_WEEKS_BEFORE_START = 3;

/**
 * 대회 참가 신청 마감 시각: 대회 시작일(한국 날짜, "2026-12-21") 0시에서 3주 전.
 * 날짜 형식이 틀리면 null.
 */
export function tournamentApplicationDeadline(startsOn: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn)) return null;
  const start = new Date(`${startsOn}T00:00:00+09:00`).getTime();
  if (Number.isNaN(start)) return null;
  return new Date(
    start - TOURNAMENT_APPLICATION_WEEKS_BEFORE_START * 7 * 24 * 60 * 60 * 1000,
  );
}

// ── 대회 매칭 규칙 (PRD M2). *표시 값은 PRD에서 "임시"로 정한 값이다. ──

/** 한 대회의 최소 팀 수 (임시) */
export const TOURNAMENT_MIN_TEAMS = 4;
/** 한 대회의 최대 팀 수 — 8팀을 넘는 묶음은 만들지 않는다 */
export const TOURNAMENT_MAX_TEAMS = 8;
/** 한 묶음 안에서 팀 인원(규모) 차이의 최대값, 명 (임시) */
export const TOURNAMENT_MAX_TEAM_SIZE_DIFF = 3;

/**
 * 묶음 안에서 가장 경력이 짧은 팀의 경력(개월)을 기준으로, 허용되는 팀 경력 차이(개월).
 *  - 2년(24개월) 미만: 6개월 / 2년 이상: 1년 / 4년(48개월) 이상: 2년 (구간 적용 방식은 임시 해석)
 */
export function allowedCareerGapMonths(shortestCareerMonths: number): number {
  if (shortestCareerMonths >= 48) return 24;
  if (shortestCareerMonths >= 24) return 12;
  return 6;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 참가 여부 결정 기간이 끝났을 때, 응답하지 않은 팀원이 팀원 수의 과반수보다 많으면 그 팀은 취소된다 (PRD M2).
 * 팀 인원은 앱에 가입한 팀원 수로 센다 (임시 해석).
 */
export function isTeamCancelledForNoResponse(
  memberCount: number,
  respondedCount: number,
): boolean {
  const unresponded = memberCount - respondedCount;
  return unresponded * 2 > memberCount;
}

/** 매칭 뒤 팀원이 참가 여부를 정해야 하는 기한: 신청 마감 + 3일 */
export function tournamentDecisionDeadline(applicationDeadline: Date): Date {
  return new Date(applicationDeadline.getTime() + 3 * DAY_MS);
}

/** 두 팀의 경기 일정을 확정해야 하는 기한: 신청 마감 + 7일 (참가 여부 3일 + 일정 4일) */
export function tournamentScheduleDeadline(applicationDeadline: Date): Date {
  return new Date(applicationDeadline.getTime() + 7 * DAY_MS);
}

/** 대회 경기는 대회 시작일(한국 날짜) 0시 이후로만 잡을 수 있다. 형식이 틀리면 null */
export function tournamentMatchEarliest(startsOn: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn)) return null;
  const start = new Date(`${startsOn}T00:00:00+09:00`);
  return Number.isNaN(start.getTime()) ? null : start;
}

// ── 리그 순위 승점 규칙 (nice). PRD에 승점 계산이 미결정이라 임시 값이다. ──
export const POINTS_PER_WIN = 3;
export const POINTS_PER_DRAW = 1;
export const POINTS_PER_LOSS = 0;

/** 승·무·패 수로 승점을 계산한다 (임시: 승 3점, 무 1점, 패 0점) */
export function standingsPoints(won: number, drawn: number, lost: number): number {
  return won * POINTS_PER_WIN + drawn * POINTS_PER_DRAW + lost * POINTS_PER_LOSS;
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
