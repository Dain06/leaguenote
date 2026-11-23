// Design Ref: §4.2 M2 — [매칭 실행: 신청 마감일 D] 같은 종목·같은 시 묶음 → 대회 자료 생성 → 각 팀 팀원에게 알림
// 예약 작업(/api/cron/matching)이 사용자 로그인 없이 부르므로 관리자 연결을 받아 쓴다.
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  tournamentDecisionDeadline,
  tournamentScheduleDeadline,
} from "@/lib/rules";
import { formatKst } from "@/lib/time";

import { matchApplications, type MatchCandidate } from "./matching";

export type MatchingSummary = {
  checkedAt: string;
  applications: number;
  tournamentsCreated: number;
  teamsMatched: number;
  teamsUnmatched: number;
  notifications: number;
};

const MAX_APPLICATIONS_PER_RUN = 1000;

type ApplicationRow = {
  id: string;
  team_id: string;
  sport: string;
  city: string;
  tournament_starts_on: string;
  team_size: number;
  career_months: number;
  deadline_at: string;
  created_at: string;
  teams: { name: string } | { name: string }[] | null;
};

/** 신청 마감이 지났고 아직 매칭되지 않은 신청을 모아 매칭한다. 여러 번 불러도 같은 신청을 두 번 처리하지 않는다. */
export async function runMatching(
  db: SupabaseClient,
  now: Date,
): Promise<MatchingSummary> {
  const summary: MatchingSummary = {
    checkedAt: now.toISOString(),
    applications: 0,
    tournamentsCreated: 0,
    teamsMatched: 0,
    teamsUnmatched: 0,
    notifications: 0,
  };

  const { data, error } = await db
    .from("tournament_applications")
    .select(
      "id, team_id, sport, city, tournament_starts_on, team_size, career_months, deadline_at, created_at, teams(name)",
    )
    .eq("status", "waiting")
    .lte("deadline_at", now.toISOString())
    .order("created_at", { ascending: true })
    .limit(MAX_APPLICATIONS_PER_RUN);
  if (error) throw new Error("신청을 불러오지 못했습니다.");

  const rows = (data ?? []) as ApplicationRow[];
  summary.applications = rows.length;
  if (rows.length === 0) return summary;

  const byId = new Map(rows.map((r) => [r.id, r]));
  const teamName = (applicationId: string): string => {
    const team = byId.get(applicationId)?.teams;
    return (Array.isArray(team) ? team[0]?.name : team?.name) ?? "";
  };

  const candidates: MatchCandidate[] = rows.map((r) => ({
    id: r.id,
    teamId: r.team_id,
    sport: r.sport,
    city: r.city,
    startsOn: r.tournament_starts_on,
    teamSize: r.team_size,
    careerMonths: r.career_months,
    appliedAt: r.created_at,
  }));

  const { groups, unmatched } = matchApplications(candidates);

  const notify = async (
    userIds: string[],
    kind: string,
    message: string,
    link: string,
  ) => {
    if (userIds.length === 0) return;
    const { error: insertError } = await db
      .from("notifications")
      .insert(userIds.map((user_id) => ({ user_id, kind, message, link })));
    if (!insertError) summary.notifications += userIds.length;
  };

  const releaseClaim = async (ids: string[]) => {
    await db
      .from("tournament_applications")
      .update({ status: "waiting" })
      .in("id", ids);
  };

  for (const group of groups) {
    const ids = group.members.map((m) => m.id);

    // 같은 신청을 동시에 처리하는 다른 호출과 겹치지 않도록 먼저 "매칭됨"으로 선점한다.
    const { data: claimed } = await db
      .from("tournament_applications")
      .update({ status: "matched" })
      .in("id", ids)
      .eq("status", "waiting")
      .select("id");
    if (!claimed || claimed.length !== ids.length) {
      await releaseClaim((claimed ?? []).map((c) => c.id as string));
      continue;
    }

    const applicationDeadline = new Date(byId.get(ids[0])!.deadline_at);
    const decisionDeadline = tournamentDecisionDeadline(applicationDeadline);

    const { data: tournament, error: tournamentError } = await db
      .from("tournaments")
      .insert({
        sport: group.sport,
        city: group.city,
        starts_on: group.startsOn,
        decision_deadline_at: decisionDeadline.toISOString(),
        schedule_deadline_at: tournamentScheduleDeadline(applicationDeadline).toISOString(),
      })
      .select("id")
      .single();
    if (tournamentError || !tournament) {
      await releaseClaim(ids);
      continue;
    }

    const { error: teamsError } = await db.from("tournament_teams").insert(
      group.members.map((m) => ({
        tournament_id: tournament.id,
        team_id: m.teamId,
        application_id: m.id,
        team_size: m.teamSize,
        career_months: m.careerMonths,
      })),
    );
    if (teamsError) {
      await db.from("tournaments").delete().eq("id", tournament.id);
      await releaseClaim(ids);
      continue;
    }

    summary.tournamentsCreated += 1;
    summary.teamsMatched += group.members.length;

    // 참가 팀의 모든 팀원에게 알림
    for (const member of group.members) {
      const { data: members } = await db
        .from("team_members")
        .select("user_id")
        .eq("team_id", member.teamId);
      await notify(
        (members ?? []).map((m) => m.user_id as string),
        "tournament_matched",
        `${teamName(member.id)}: ${group.sport} 대회(${group.members.length}팀)가 매칭되었습니다. ${formatKst(decisionDeadline)}까지 참가 여부를 알려 주세요.`,
        `/tournaments/${tournament.id}`,
      );
    }
  }

  // 어느 묶음에도 들지 못한 신청은 "제외"로 처리하고 운영자에게 알린다.
  for (const candidate of unmatched) {
    const { data: updated } = await db
      .from("tournament_applications")
      .update({ status: "excluded" })
      .eq("id", candidate.id)
      .eq("status", "waiting")
      .select("id");
    if (!updated || updated.length === 0) continue;

    summary.teamsUnmatched += 1;
    const { data: operators } = await db
      .from("team_members")
      .select("user_id")
      .eq("team_id", candidate.teamId)
      .eq("role", "operator");
    await notify(
      (operators ?? []).map((o) => o.user_id as string),
      "tournament_unmatched",
      `${teamName(candidate.id)}: ${candidate.sport} 대회(${candidate.startsOn} 시작) 신청은 조건에 맞는 팀이 모자라 매칭되지 않았습니다. 다른 날짜로 다시 신청해 보세요.`,
      "/tournaments",
    );
  }

  return summary;
}
