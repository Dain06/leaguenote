// Design Ref: §5 저장할 데이터 — 대회 참가 신청 조회. 볼 수 있는 범위(같은 팀원)는 접근 규칙이 정한다.
import type { Team } from "@/features/teams/queries";
import { createServerDb } from "@/lib/db/server";

export type ApplicationStatus = "waiting" | "matched" | "excluded";

export type Application = {
  id: string;
  team_id: string;
  team_name: string;
  sport: string;
  team_size: number;
  career_months: number;
  tournament_starts_on: string;
  deadline_at: string;
  status: ApplicationStatus;
};

/** 내가 운영자인 팀 목록 (신청할 수 있는 팀) */
export async function getOperatorTeams(userId: string): Promise<Team[]> {
  const db = await createServerDb();
  const { data } = await db
    .from("team_members")
    .select("teams(id, name, sport, required_players, city, district)")
    .eq("user_id", userId)
    .eq("role", "operator");

  const teams: Team[] = [];
  for (const row of data ?? []) {
    const team = Array.isArray(row.teams) ? row.teams[0] : row.teams;
    if (team) teams.push(team);
  }
  return teams;
}

export type TournamentStatus = "deciding" | "confirmed" | "cancelled";

export type Tournament = {
  id: string;
  sport: string;
  city: string;
  starts_on: string;
  status: TournamentStatus;
  cancel_reason: string | null;
  decision_deadline_at: string;
  schedule_deadline_at: string;
};

export type Participant = {
  team_id: string;
  team_name: string;
  district: string;
  team_size: number;
  career_months: number;
  status: "active" | "cancelled";
  is_mine: boolean;
};

/** 내 팀이 참가하는 대회 (대회 시작일이 가까운 순). 참가 팀의 팀원만 볼 수 있다. */
export async function getMyTournaments(): Promise<
  (Tournament & { team_count: number })[]
> {
  const db = await createServerDb();
  const { data } = await db
    .from("tournaments")
    .select(
      "id, sport, city, starts_on, status, cancel_reason, decision_deadline_at, schedule_deadline_at, tournament_teams(count)",
    )
    .order("starts_on", { ascending: true });

  return (data ?? []).map((row) => {
    const counted = row.tournament_teams as { count: number }[] | null;
    const { tournament_teams: _teams, ...tournament } = row;
    void _teams;
    return { ...(tournament as Tournament), team_count: counted?.[0]?.count ?? 0 };
  });
}

/** 대회 한 개. 없거나 참가 팀이 아니면 null */
export async function getTournament(id: string): Promise<Tournament | null> {
  const db = await createServerDb();
  const { data } = await db
    .from("tournaments")
    .select(
      "id, sport, city, starts_on, status, cancel_reason, decision_deadline_at, schedule_deadline_at",
    )
    .eq("id", id)
    .maybeSingle();
  return (data as Tournament | null) ?? null;
}

/** 대회 참가 팀 목록(팀 이름·지역·인원·경력). 참가 팀의 팀원에게만 돌려준다. */
export async function getTournamentParticipants(
  id: string,
): Promise<Participant[]> {
  const db = await createServerDb();
  const { data } = await db.rpc("tournament_participants", {
    p_tournament_id: id,
  });
  return (data ?? []) as Participant[];
}

export type ResponseSummary = {
  team_id: string;
  member_count: number;
  responded_count: number;
  join_count: number;
};

/** 팀별 응답 현황(응답한 수·참가라고 한 수). 참가 팀의 팀원에게만 돌려준다. */
export async function getResponseSummary(id: string): Promise<ResponseSummary[]> {
  const db = await createServerDb();
  const { data } = await db.rpc("tournament_response_summary", {
    p_tournament_id: id,
  });
  return (data ?? []) as ResponseSummary[];
}

/** 내가 남긴 응답. 아직 없으면 null */
export async function getMyResponse(
  id: string,
  userId: string,
): Promise<"join" | "decline" | null> {
  const db = await createServerDb();
  const { data } = await db
    .from("tournament_responses")
    .select("response")
    .eq("tournament_id", id)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return (data?.response as "join" | "decline" | undefined) ?? null;
}

/** 내 팀들의 대회 참가 신청 (대회 시작일이 가까운 순) */
export async function getMyApplications(): Promise<Application[]> {
  const db = await createServerDb();
  const { data } = await db
    .from("tournament_applications")
    .select(
      "id, team_id, sport, team_size, career_months, tournament_starts_on, deadline_at, status, teams(name)",
    )
    .order("tournament_starts_on", { ascending: true });

  return (data ?? []).map((row) => {
    const team = Array.isArray(row.teams) ? row.teams[0] : row.teams;
    return {
      id: row.id,
      team_id: row.team_id,
      team_name: team?.name ?? "",
      sport: row.sport,
      team_size: row.team_size,
      career_months: row.career_months,
      tournament_starts_on: row.tournament_starts_on,
      deadline_at: row.deadline_at,
      status: row.status,
    };
  });
}
