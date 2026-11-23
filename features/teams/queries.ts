// Design Ref: §5 저장할 데이터 — 팀·팀원·초대를 조회한다. (볼 수 있는 범위는 데이터베이스 접근 규칙이 정한다)
import { createServerDb } from "@/lib/db/server";

export type Team = {
  id: string;
  name: string;
  sport: string;
  required_players: number;
  city: string;
  district: string;
};

export type RosterMember = {
  user_id: string;
  nickname: string;
  role: "operator" | "member";
  phone: string | null;
};

/** 내가 속한 팀 목록 */
export async function getMyTeams(): Promise<Team[]> {
  const db = await createServerDb();
  const { data } = await db
    .from("teams")
    .select("id, name, sport, required_players, city, district")
    .order("created_at", { ascending: false });
  return data ?? [];
}

/** 팀 한 개와 내 역할. 팀원이 아니거나 없는 팀이면 null */
export async function getTeam(
  teamId: string,
  userId: string,
): Promise<(Team & { myRole: "operator" | "member" }) | null> {
  const db = await createServerDb();
  const { data: team } = await db
    .from("teams")
    .select("id, name, sport, required_players, city, district")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) return null;

  const { data: member } = await db
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .maybeSingle();

  return { ...team, myRole: member?.role === "operator" ? "operator" : "member" };
}

/** 팀원 목록. 연락처는 같은 팀 운영자와 본인에게만 값이 들어온다. */
export async function getRoster(teamId: string): Promise<RosterMember[]> {
  const db = await createServerDb();
  const { data } = await db.rpc("team_roster", { p_team_id: teamId });
  return (data ?? []) as RosterMember[];
}

/** 아직 유효한 가장 최근 초대 코드 (운영자만 볼 수 있다) */
export async function getActiveInviteCode(teamId: string): Promise<string | null> {
  const db = await createServerDb();
  const { data } = await db
    .from("invites")
    .select("code")
    .eq("team_id", teamId)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.code ?? null;
}

/** 이미 쓰인 종목 이름과 그 종목에서 가장 흔한 한 경기 필요 인원 */
export async function getPopularSports(): Promise<
  { sport: string; typical_players: number }[]
> {
  const db = await createServerDb();
  const { data } = await db.rpc("popular_sports");
  return (data ?? []) as { sport: string; typical_players: number }[];
}

/** 초대 코드에 해당하는 팀 이름·종목 (유효하지 않으면 null) */
export async function getInvitePreview(
  code: string,
): Promise<{ team_name: string; sport: string } | null> {
  const db = await createServerDb();
  const { data } = await db.rpc("invite_preview", { p_code: code });
  const rows = (data ?? []) as { team_name: string; sport: string }[];
  return rows[0] ?? null;
}
