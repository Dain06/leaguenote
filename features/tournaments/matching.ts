// Design Ref: §4.2 M2 — 같은 종목·같은 시 → 팀 인원 차이(최대 3명)와 팀 경력 구간 규칙으로 4~8팀씩 묶음
// 데이터 저장소를 전혀 쓰지 않는 순수 계산이라 Vitest로 규칙을 바로 시험할 수 있다. 규칙 값은 lib/rules.ts에만 있다.
import {
  allowedCareerGapMonths,
  TOURNAMENT_MAX_TEAM_SIZE_DIFF,
  TOURNAMENT_MAX_TEAMS,
  TOURNAMENT_MIN_TEAMS,
} from "@/lib/rules";

export type MatchCandidate = {
  /** 참가 신청 번호 */
  id: string;
  teamId: string;
  sport: string;
  city: string;
  /** 희망 대회 시작일 "YYYY-MM-DD" */
  startsOn: string;
  teamSize: number;
  careerMonths: number;
  /** 신청 시각(ISO). 묶음이 8팀을 넘을 때 먼저 신청한 팀을 우선한다. */
  appliedAt: string;
};

export type MatchGroup = {
  sport: string;
  city: string;
  startsOn: string;
  members: MatchCandidate[];
};

export type MatchResult = {
  groups: MatchGroup[];
  /** 어느 묶음에도 들지 못한 신청 */
  unmatched: MatchCandidate[];
};

/** 종목 이름 비교용: 앞뒤·중복 공백을 정리하고 소문자로 바꾼다. */
export function normalizeSport(sport: string): string {
  return sport.trim().replace(/\s+/g, " ").toLowerCase();
}

/** 팀 묶음이 모든 규칙(팀 수, 팀 인원 차이, 팀 경력 구간)을 지키는지 */
export function isValidGroup(members: MatchCandidate[]): boolean {
  if (
    members.length < TOURNAMENT_MIN_TEAMS ||
    members.length > TOURNAMENT_MAX_TEAMS
  ) {
    return false;
  }
  const sizes = members.map((m) => m.teamSize);
  if (Math.max(...sizes) - Math.min(...sizes) > TOURNAMENT_MAX_TEAM_SIZE_DIFF) {
    return false;
  }
  const careers = members.map((m) => m.careerMonths);
  const shortest = Math.min(...careers);
  return Math.max(...careers) - shortest <= allowedCareerGapMonths(shortest);
}

function byAppliedThenId(a: MatchCandidate, b: MatchCandidate): number {
  return a.appliedAt.localeCompare(b.appliedAt) || a.id.localeCompare(b.id);
}

/**
 * 남은 팀 중 가장 큰(최대 8팀) 유효한 묶음 하나를 찾는다. 없으면 null.
 * 경력이 짧은 쪽부터, 팀 인원이 작은 쪽부터 훑어 같은 크기면 앞선 묶음을 고른다(결과가 항상 같도록).
 */
function findBestGroup(remaining: MatchCandidate[]): MatchCandidate[] | null {
  let best: MatchCandidate[] | null = null;
  const anchors = [...new Set(remaining.map((c) => c.careerMonths))].sort(
    (a, b) => a - b,
  );

  for (const career of anchors) {
    // 이 경력을 가장 짧은 경력으로 삼았을 때 허용되는 경력 범위 안의 팀들
    const careerLimit = career + allowedCareerGapMonths(career);
    const pool = remaining.filter(
      (c) => c.careerMonths >= career && c.careerMonths <= careerLimit,
    );
    const sizes = [...new Set(pool.map((c) => c.teamSize))].sort((a, b) => a - b);

    for (const smallest of sizes) {
      const window = pool.filter(
        (c) =>
          c.teamSize >= smallest &&
          c.teamSize <= smallest + TOURNAMENT_MAX_TEAM_SIZE_DIFF,
      );
      if (window.length < TOURNAMENT_MIN_TEAMS) continue;

      const chosen = [...window]
        .sort(byAppliedThenId)
        .slice(0, TOURNAMENT_MAX_TEAMS);
      if (!isValidGroup(chosen)) continue;
      if (!best || chosen.length > best.length) best = chosen;
    }
  }
  return best;
}

/**
 * 신청들을 같은 시작일·같은 시·같은 종목끼리 나눈 뒤, 각각에서 규칙에 맞는 묶음을 반복해 만든다.
 * 같은 입력이면 항상 같은 결과가 나온다.
 */
export function matchApplications(candidates: MatchCandidate[]): MatchResult {
  const buckets = new Map<string, MatchCandidate[]>();
  for (const c of candidates) {
    const key = [c.startsOn, c.city, normalizeSport(c.sport)].join("|");
    const list = buckets.get(key) ?? [];
    list.push(c);
    buckets.set(key, list);
  }

  const groups: MatchGroup[] = [];
  const unmatched: MatchCandidate[] = [];

  for (const key of [...buckets.keys()].sort()) {
    let remaining = buckets.get(key) ?? [];
    for (;;) {
      const found = findBestGroup(remaining);
      if (!found) break;
      const picked = new Set(found.map((c) => c.id));
      groups.push({
        sport: found[0].sport,
        city: found[0].city,
        startsOn: found[0].startsOn,
        members: found,
      });
      remaining = remaining.filter((c) => !picked.has(c.id));
    }
    unmatched.push(...remaining);
  }

  return { groups, unmatched };
}
