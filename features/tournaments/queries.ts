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
