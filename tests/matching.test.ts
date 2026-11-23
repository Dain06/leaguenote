import { describe, expect, it } from "vitest";

import {
  isValidGroup,
  matchApplications,
  normalizeSport,
  type MatchCandidate,
} from "@/features/tournaments/matching";
import {
  allowedCareerGapMonths,
  attendancePollClosesAt,
  attendancePollOpensAt,
  tournamentApplicationDeadline,
  tournamentDecisionDeadline,
} from "@/lib/rules";

let seq = 0;
function team(
  teamSize: number,
  careerMonths: number,
  extra: Partial<MatchCandidate> = {},
): MatchCandidate {
  seq += 1;
  return {
    id: `a${String(seq).padStart(3, "0")}`,
    teamId: `t${seq}`,
    sport: "풋살",
    city: "서울특별시",
    startsOn: "2027-01-10",
    teamSize,
    careerMonths,
    appliedAt: `2026-12-01T00:${String(seq % 60).padStart(2, "0")}:00Z`,
    ...extra,
  };
}

describe("경력 구간 허용 차이", () => {
  it("2년 미만 6개월, 2년 이상 1년, 4년 이상 2년 (경계 포함)", () => {
    expect(allowedCareerGapMonths(0)).toBe(6);
    expect(allowedCareerGapMonths(23)).toBe(6);
    expect(allowedCareerGapMonths(24)).toBe(12);
    expect(allowedCareerGapMonths(47)).toBe(12);
    expect(allowedCareerGapMonths(48)).toBe(24);
    expect(allowedCareerGapMonths(100)).toBe(24);
  });
});

describe("묶음 규칙", () => {
  it("4팀이면 유효, 3팀이면 무효", () => {
    expect(isValidGroup([team(10, 5), team(10, 6), team(11, 7), team(12, 8)])).toBe(true);
    expect(isValidGroup([team(10, 5), team(10, 6), team(11, 7)])).toBe(false);
  });

  it("9팀 묶음은 만들지 않는다", () => {
    const nine = Array.from({ length: 9 }, () => team(10, 5));
    expect(isValidGroup(nine)).toBe(false);
  });

  it("팀 인원 차이 3명까지는 허용, 4명이면 무효", () => {
    expect(isValidGroup([team(10, 5), team(11, 5), team(12, 5), team(13, 5)])).toBe(true);
    expect(isValidGroup([team(10, 5), team(11, 5), team(12, 5), team(14, 5)])).toBe(false);
  });

  it("경력 2년 미만 기준 6개월 차이까지 허용", () => {
    expect(isValidGroup([team(10, 3), team(10, 5), team(10, 7), team(10, 9)])).toBe(true);
    expect(isValidGroup([team(10, 3), team(10, 5), team(10, 7), team(10, 10)])).toBe(false);
  });

  it("가장 짧은 팀이 2년 이상이면 1년, 4년 이상이면 2년 차이까지", () => {
    expect(isValidGroup([team(10, 24), team(10, 28), team(10, 32), team(10, 36)])).toBe(true);
    expect(isValidGroup([team(10, 24), team(10, 28), team(10, 32), team(10, 37)])).toBe(false);
    expect(isValidGroup([team(10, 48), team(10, 55), team(10, 62), team(10, 72)])).toBe(true);
    expect(isValidGroup([team(10, 48), team(10, 55), team(10, 62), team(10, 73)])).toBe(false);
  });

  it("2년 미만 팀이 섞이면 가장 짧은 팀(2년 미만) 기준 6개월이 적용된다", () => {
    expect(isValidGroup([team(10, 20), team(10, 24), team(10, 28), team(10, 30)])).toBe(false);
  });
});

describe("매칭", () => {
  it("조건에 맞는 4팀을 하나의 대회로 묶는다", () => {
    const result = matchApplications([team(10, 5), team(11, 6), team(12, 7), team(12, 8)]);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].members).toHaveLength(4);
    expect(result.unmatched).toHaveLength(0);
  });

  it("3팀뿐이면 대회를 만들지 않고 모두 미매칭", () => {
    const result = matchApplications([team(10, 5), team(11, 6), team(12, 7)]);
    expect(result.groups).toHaveLength(0);
    expect(result.unmatched).toHaveLength(3);
  });

  it("종목이 다르면 묶지 않고, 대소문자·공백은 같은 종목으로 본다", () => {
    const mixed = matchApplications([
      team(10, 5, { sport: "풋살" }),
      team(10, 5, { sport: "농구" }),
      team(10, 5, { sport: "풋살" }),
      team(10, 5, { sport: "농구" }),
    ]);
    expect(mixed.groups).toHaveLength(0);

    const spaced = matchApplications([
      team(10, 5, { sport: "Futsal" }),
      team(10, 5, { sport: " futsal " }),
      team(10, 5, { sport: "FUTSAL" }),
      team(10, 5, { sport: "futsal" }),
    ]);
    expect(spaced.groups).toHaveLength(1);
    expect(normalizeSport("  Fut   Sal ")).toBe("fut sal");
  });

  it("시가 다르거나 대회 시작일이 다르면 묶지 않는다", () => {
    const diffCity = matchApplications([
      team(10, 5),
      team(10, 5),
      team(10, 5, { city: "부산광역시" }),
      team(10, 5, { city: "부산광역시" }),
    ]);
    expect(diffCity.groups).toHaveLength(0);

    const diffDate = matchApplications([
      team(10, 5),
      team(10, 5),
      team(10, 5, { startsOn: "2027-02-01" }),
      team(10, 5, { startsOn: "2027-02-01" }),
    ]);
    expect(diffDate.groups).toHaveLength(0);
  });

  it("한 팀이 규칙 밖이면 그 팀만 빠지고 나머지는 묶인다", () => {
    const outlier = team(20, 5);
    const result = matchApplications([team(10, 5), team(11, 6), team(12, 7), team(12, 8), outlier]);
    expect(result.groups).toHaveLength(1);
    expect(result.unmatched.map((c) => c.id)).toEqual([outlier.id]);
  });

  it("조건에 맞는 팀이 10팀이면 먼저 신청한 8팀이 묶이고 2팀은 남는다", () => {
    const ten = Array.from({ length: 10 }, () => team(10, 5));
    const result = matchApplications(ten);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].members).toHaveLength(8);
    expect(result.unmatched).toHaveLength(2);
    const picked = result.groups[0].members.map((m) => m.id).sort();
    expect(picked).toEqual(ten.slice(0, 8).map((m) => m.id).sort());
  });

  it("조건에 맞는 팀이 8팀 + 4팀이면 대회가 두 개 만들어진다", () => {
    const apps = [
      ...Array.from({ length: 8 }, () => team(10, 5)),
      ...Array.from({ length: 4 }, () => team(10, 60)),
    ];
    const result = matchApplications(apps);
    expect(result.groups.map((g) => g.members.length).sort()).toEqual([4, 8]);
    expect(result.unmatched).toHaveLength(0);
  });

  it("한 팀은 하나의 대회에만 들어가고, 모든 묶음이 규칙을 지킨다", () => {
    const apps = [
      team(10, 8), team(12, 14), team(11, 20), team(13, 30), team(14, 36),
      team(9, 50), team(16, 60), team(15, 100), team(12, 26), team(12, 28),
      team(11, 33), team(13, 35),
    ];
    const result = matchApplications(apps);
    const ids = result.groups.flatMap((g) => g.members.map((m) => m.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length + result.unmatched.length).toBe(apps.length);
    for (const g of result.groups) expect(isValidGroup(g.members)).toBe(true);
    expect(result.groups).toHaveLength(1);
  });

  it("같은 입력이면 입력 순서가 달라도 같은 결과가 나온다", () => {
    const apps = Array.from({ length: 6 }, (_, i) => team(10 + (i % 3), 5 + i));
    const a = matchApplications(apps);
    const b = matchApplications([...apps].reverse());
    const ids = (r: typeof a) => r.groups.map((g) => g.members.map((m) => m.id).sort());
    expect(ids(b)).toEqual(ids(a));
  });
});

describe("시각 규칙", () => {
  it("출석 투표는 시작 2시간 전 게시, 30분 전 마감", () => {
    const start = new Date("2026-12-01T10:00:00Z");
    expect(attendancePollOpensAt(start).toISOString()).toBe("2026-12-01T08:00:00.000Z");
    expect(attendancePollClosesAt(start).toISOString()).toBe("2026-12-01T09:30:00.000Z");
  });

  it("참가 신청 마감은 대회 시작일(한국) 0시의 3주 전", () => {
    expect(tournamentApplicationDeadline("2027-01-10")?.toISOString()).toBe(
      "2026-12-19T15:00:00.000Z",
    );
    expect(tournamentApplicationDeadline("잘못된 값")).toBeNull();
  });

  it("참가 여부 결정은 신청 마감 3일 뒤", () => {
    const deadline = new Date("2026-12-19T15:00:00Z");
    expect(tournamentDecisionDeadline(deadline).toISOString()).toBe("2026-12-22T15:00:00.000Z");
  });
});
