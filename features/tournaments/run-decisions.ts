// Design Ref: §4.2 M2 — 참가 여부 응답을 모아 대회를 확정하거나 취소하고 알린다.
// 예약 작업(/api/cron/tournaments)과 응답 직후(모두 응답했는지 확인)에 서버 전용 키로 불린다.
import type { SupabaseClient } from "@supabase/supabase-js";

import { formatKst } from "@/lib/time";

import { decideTournament, type TeamResponseState } from "./decision";
import { unagreedPairs } from "./schedule";

export type DecisionSummary = {
  checkedAt: string;
  checked: number;
  confirmed: number;
  cancelled: number;
  teamsCancelled: number;
  notifications: number;
};

type TeamRow = { team_id: string; teams: { name: string } | { name: string }[] | null };

/** 대회 하나를 판정한다. 확정·취소했으면 "confirmed" 또는 "cancelled", 더 기다려야 하면 "waiting" */
export async function evaluateTournament(
  db: SupabaseClient,
  tournamentId: string,
  now: Date,
  summary?: DecisionSummary,
): Promise<"confirmed" | "cancelled" | "waiting"> {
  const { data: tournament } = await db
    .from("tournaments")
    .select("id, sport, city, starts_on, status, decision_deadline_at, schedule_deadline_at")
    .eq("id", tournamentId)
    .maybeSingle();
  if (!tournament || tournament.status !== "deciding") return "waiting";

  const { data: teamRows } = await db
    .from("tournament_teams")
    .select("team_id, teams(name)")
    .eq("tournament_id", tournamentId)
    .eq("status", "active");
  const teams = (teamRows ?? []) as TeamRow[];
  const nameOf = new Map(
    teams.map((t) => [
      t.team_id,
      (Array.isArray(t.teams) ? t.teams[0]?.name : t.teams?.name) ?? "",
    ]),
  );

  const membersOf = new Map<string, string[]>();
  const states: TeamResponseState[] = [];
  for (const team of teams) {
    const { data: members } = await db
      .from("team_members")
      .select("user_id")
      .eq("team_id", team.team_id);
    const { count } = await db
      .from("tournament_responses")
      .select("user_id", { count: "exact", head: true })
      .eq("tournament_id", tournamentId)
      .eq("team_id", team.team_id);
    const userIds = (members ?? []).map((m) => m.user_id as string);
    membersOf.set(team.team_id, userIds);
    states.push({
      teamId: team.team_id,
      memberCount: userIds.length,
      respondedCount: count ?? 0,
    });
  }

  const deadlinePassed =
    now.getTime() >= new Date(tournament.decision_deadline_at).getTime();
  const outcome = decideTournament(states, deadlinePassed);
  if (outcome.kind === "waiting") return "waiting";

  // 같은 대회를 동시에 판정하는 다른 호출과 겹치지 않도록 먼저 상태를 바꿔 선점한다.
  const { data: claimed } = await db
    .from("tournaments")
    .update(
      outcome.kind === "confirmed"
        ? { status: "confirmed", confirmed_at: now.toISOString() }
        : { status: "cancelled", cancel_reason: outcome.reason },
    )
    .eq("id", tournamentId)
    .eq("status", "deciding")
    .select("id");
  if (!claimed || claimed.length === 0) return "waiting";

  if (outcome.cancelledTeamIds.length > 0) {
    await db
      .from("tournament_teams")
      .update({ status: "cancelled" })
      .eq("tournament_id", tournamentId)
      .in("team_id", outcome.cancelledTeamIds);
  }

  const notify = async (teamId: string, message: string) => {
    const userIds = membersOf.get(teamId) ?? [];
    if (userIds.length === 0) return;
    const { error } = await db.from("notifications").insert(
      userIds.map((user_id) => ({
        user_id,
        kind: `tournament_${outcome.kind}`,
        message,
        link: `/tournaments/${tournamentId}`,
      })),
    );
    if (!error && summary) summary.notifications += userIds.length;
  };

  const cancelled = new Set(outcome.cancelledTeamIds);
  const label = `${tournament.city} ${tournament.sport} 대회`;

  for (const team of teams) {
    const name = nameOf.get(team.team_id) ?? "";
    if (outcome.kind === "cancelled") {
      await notify(team.team_id, `${name}: ${label}가 취소되었습니다. ${outcome.reason}`);
    } else if (cancelled.has(team.team_id)) {
      await notify(
        team.team_id,
        `${name}: 참가 여부에 응답하지 않은 팀원이 많아 ${label}에서 빠졌습니다.`,
      );
    } else {
      await notify(
        team.team_id,
        `${name}: ${label}가 확정되었습니다(대회 시작 ${tournament.starts_on}). ${formatKst(tournament.schedule_deadline_at)}까지 상대 팀과 경기 일정을 정해 주세요.`,
      );
    }
  }

  if (summary) {
    summary[outcome.kind] += 1;
    summary.teamsCancelled += outcome.cancelledTeamIds.length;
  }
  return outcome.kind;
}

export type ScheduleClosingSummary = {
  tournaments: number;
  unagreedMatches: number;
  notifications: number;
};

/**
 * 경기 일정 조율 기한(신청 마감 +7일)이 지난 확정 대회에서 합의되지 않은 경기를 "미합의"로 보고 운영자에게 한 번 알린다.
 * 합의되지 않았을 때의 처리 방식은 PRD에서 미결정이라, 지금은 표시와 알림만 한다.
 */
export async function runScheduleClosing(
  db: SupabaseClient,
  now: Date,
): Promise<ScheduleClosingSummary> {
  const summary: ScheduleClosingSummary = { tournaments: 0, unagreedMatches: 0, notifications: 0 };

  const { data } = await db
    .from("tournaments")
    .select("id")
    .eq("status", "confirmed")
    .is("schedule_notified_at", null)
    .lte("schedule_deadline_at", now.toISOString())
    .limit(200);

  for (const row of data ?? []) {
    const tournamentId = row.id as string;

    // 같은 대회를 동시에 처리하는 다른 호출과 겹치지 않도록 먼저 "알림 처리함"을 선점한다.
    const { data: claimed } = await db
      .from("tournaments")
      .update({ schedule_notified_at: now.toISOString() })
      .eq("id", tournamentId)
      .is("schedule_notified_at", null)
      .select("id");
    if (!claimed || claimed.length === 0) continue;
    summary.tournaments += 1;

    const { data: teamRows } = await db
      .from("tournament_teams")
      .select("team_id, teams(name)")
      .eq("tournament_id", tournamentId)
      .eq("status", "active");
    const teams = (teamRows ?? []) as TeamRow[];
    const nameOf = new Map(
      teams.map((t) => [
        t.team_id,
        (Array.isArray(t.teams) ? t.teams[0]?.name : t.teams?.name) ?? "",
      ]),
    );

    const { data: accepted } = await db
      .from("schedule_requests")
      .select("from_team_id, to_team_id")
      .eq("tournament_id", tournamentId)
      .eq("status", "accepted");
    const unagreed = unagreedPairs(
      teams.map((t) => t.team_id),
      (accepted ?? []).map((r) => [r.from_team_id as string, r.to_team_id as string]),
    );
    summary.unagreedMatches += unagreed.length;

    // 미합의 경기가 있는 팀 운영자에게 팀별로 한 번씩 알린다.
    const opponentsOf = new Map<string, string[]>();
    for (const [a, b] of unagreed) {
      opponentsOf.set(a, [...(opponentsOf.get(a) ?? []), nameOf.get(b) ?? ""]);
      opponentsOf.set(b, [...(opponentsOf.get(b) ?? []), nameOf.get(a) ?? ""]);
    }
    for (const [teamId, opponents] of opponentsOf) {
      const { data: operators } = await db
        .from("team_members")
        .select("user_id")
        .eq("team_id", teamId)
        .eq("role", "operator");
      const rows = (operators ?? []).map((o) => ({
        user_id: o.user_id as string,
        kind: "schedule_unagreed",
        message: `${nameOf.get(teamId)}: ${opponents.join(", ")}와(과)의 경기 일정이 기한 안에 합의되지 않아 "미합의"로 표시됩니다.`.slice(0, 200),
        link: `/tournaments/${tournamentId}`,
      }));
      if (rows.length > 0) {
        const { error } = await db.from("notifications").insert(rows);
        if (!error) summary.notifications += rows.length;
      }
    }
  }
  return summary;
}

/** 참가 여부 결정 기한이 지난 대회를 모두 판정한다. 여러 번 불러도 같은 대회를 두 번 처리하지 않는다. */
export async function runDecisions(
  db: SupabaseClient,
  now: Date,
): Promise<DecisionSummary> {
  const summary: DecisionSummary = {
    checkedAt: now.toISOString(),
    checked: 0,
    confirmed: 0,
    cancelled: 0,
    teamsCancelled: 0,
    notifications: 0,
  };

  const { data, error } = await db
    .from("tournaments")
    .select("id")
    .eq("status", "deciding")
    .lte("decision_deadline_at", now.toISOString())
    .limit(200);
  if (error) throw new Error("대회를 불러오지 못했습니다.");

  for (const row of data ?? []) {
    summary.checked += 1;
    await evaluateTournament(db, row.id as string, now, summary);
  }
  return summary;
}
