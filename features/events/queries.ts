// Design Ref: §5 저장할 데이터 — 일정(events) 조회. 볼 수 있는 범위(같은 팀원)는 데이터베이스 접근 규칙이 정한다.
import { createServerDb } from "@/lib/db/server";

export type EventSummary = {
  id: string;
  type: "practice" | "tournament";
  starts_at: string;
  location: string;
  status: "scheduled" | "confirmed" | "cancelled";
};

export type EventWithTeam = EventSummary & {
  team_id: string;
  team: { name: string; sport: string; required_players: number };
};

/** 한 팀의 다가오는 일정 (취소된 일정 제외, 가까운 순) */
export async function getTeamUpcomingEvents(
  teamId: string,
  limit = 10,
): Promise<EventSummary[]> {
  const db = await createServerDb();
  const { data } = await db
    .from("events")
    .select("id, type, starts_at, location, status")
    .eq("team_id", teamId)
    .gte("starts_at", new Date().toISOString())
    .neq("status", "cancelled")
    .order("starts_at", { ascending: true })
    .limit(limit);
  return (data ?? []) as EventSummary[];
}

/** 내가 속한 모든 팀의 다가오는 일정 (홈 화면용) */
export async function getMyUpcomingEvents(
  limit = 5,
): Promise<(EventSummary & { team_name: string })[]> {
  const db = await createServerDb();
  const { data } = await db
    .from("events")
    .select("id, type, starts_at, location, status, teams(name)")
    .gte("starts_at", new Date().toISOString())
    .neq("status", "cancelled")
    .order("starts_at", { ascending: true })
    .limit(limit);

  return (data ?? []).map((row) => {
    const team = Array.isArray(row.teams) ? row.teams[0] : row.teams;
    return {
      id: row.id,
      type: row.type,
      starts_at: row.starts_at,
      location: row.location,
      status: row.status,
      team_name: team?.name ?? "",
    };
  });
}

/** 일정 한 개와 팀 정보. 없거나 볼 권한이 없으면 null */
export async function getEvent(eventId: string): Promise<EventWithTeam | null> {
  const db = await createServerDb();
  const { data } = await db
    .from("events")
    .select(
      "id, team_id, type, starts_at, location, status, teams(name, sport, required_players)",
    )
    .eq("id", eventId)
    .maybeSingle();
  if (!data) return null;

  const team = Array.isArray(data.teams) ? data.teams[0] : data.teams;
  if (!team) return null;

  return {
    id: data.id,
    team_id: data.team_id,
    type: data.type,
    starts_at: data.starts_at,
    location: data.location,
    status: data.status,
    team,
  };
}
