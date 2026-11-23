// Design Ref: §5 저장할 데이터 — 일정(events) 조회. 볼 수 있는 범위(같은 팀원)는 데이터베이스 접근 규칙이 정한다.
import { createServerDb } from "@/lib/db/server";
import { attendancePollClosesAt, attendancePollOpensAt } from "@/lib/rules";

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
  /** 출석 투표 게시·마감 시각 (일정을 만들 때 규칙으로 계산해 저장한 값) */
  attendance_opens_at: string;
  attendance_closes_at: string;
};

export type AttendanceResponse = "present" | "absent";

export type AttendanceMember = {
  user_id: string;
  nickname: string;
  response: AttendanceResponse | null;
};

/** 출석 현황: 확정 선수 모두의 닉네임과 투표(없으면 null = 미투표) */
export async function getEventAttendance(
  eventId: string,
): Promise<AttendanceMember[]> {
  const db = await createServerDb();
  const { data } = await db.rpc("event_attendance", { p_event_id: eventId });
  return (data ?? []) as AttendanceMember[];
}

export type SurveyResponse = "attend" | "absent";

export type SurveyMember = {
  user_id: string;
  nickname: string;
  role: "operator" | "member";
  response: SurveyResponse | null;
  /** 확정된 선수인지 (작업 6번) */
  confirmed: boolean;
};

/** 지원자 조사 현황: 같은 팀원 모두의 닉네임과 응답(없으면 null = 미응답) */
export async function getEventSurvey(eventId: string): Promise<SurveyMember[]> {
  const db = await createServerDb();
  const { data } = await db.rpc("event_survey", { p_event_id: eventId });
  return (data ?? []) as SurveyMember[];
}

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
      "id, team_id, type, starts_at, location, status, attendance_opens_at, attendance_closes_at, teams(name, sport, required_players)",
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
    // 이전 방식으로 만든 일정(저장된 값이 없는 경우)은 규칙으로 다시 계산한다.
    attendance_opens_at:
      data.attendance_opens_at ??
      attendancePollOpensAt(data.starts_at).toISOString(),
    attendance_closes_at:
      data.attendance_closes_at ??
      attendancePollClosesAt(data.starts_at).toISOString(),
    team,
  };
}
