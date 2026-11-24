// Design Ref: §5 저장할 데이터 — 용병 모집 글·지원 조회. 글에는 시간·종목·지역·필요 인원만 있다. (PRD 7번)
import { createServerDb } from "@/lib/db/server";

export type BoardPost = {
  post_id: string;
  sport: string;
  city: string;
  district: string;
  starts_at: string;
  needed_count: number;
  accepted_count: number;
  /** 내 지원 상태. 지원하지 않았으면 null */
  my_status: "applied" | "accepted" | "rejected" | null;
  is_my_team: boolean;
};

/** 용병 게시판: 모집 중이고 시작 전인 글 (시작이 가까운 순) */
export async function getMercenaryBoard(): Promise<BoardPost[]> {
  const db = await createServerDb();
  const { data } = await db.rpc("mercenary_board");
  return (data ?? []) as BoardPost[];
}

export type EventPost = {
  id: string;
  needed_count: number;
  status: "open" | "closed";
};

/** 일정에 올린 가장 최근의 용병 글. 없으면 null */
export async function getEventPost(eventId: string): Promise<EventPost | null> {
  // 용병 글 표는 직접 읽을 수 없고(공개 범위 보호), 같은 팀원에게만 돌려주는 함수로 읽는다.
  const db = await createServerDb();
  const { data } = await db.rpc("event_mercenary_post", { p_event_id: eventId });
  const rows = (data ?? []) as EventPost[];
  return rows[0] ?? null;
}

export type Applicant = {
  user_id: string;
  nickname: string;
  status: "applied" | "accepted" | "rejected";
  created_at: string;
};

/** 지원자 목록. 글을 쓴 팀 운영자에게만 돌아온다. */
export async function getApplicants(postId: string): Promise<Applicant[]> {
  const db = await createServerDb();
  const { data } = await db.rpc("mercenary_applicants", { p_post_id: postId });
  return (data ?? []) as Applicant[];
}

/** 일정에 수락된 용병 닉네임. 같은 팀원에게만 돌아온다. */
export async function getEventMercenaries(
  eventId: string,
): Promise<{ user_id: string; nickname: string }[]> {
  const db = await createServerDb();
  const { data } = await db.rpc("event_mercenaries", { p_event_id: eventId });
  return (data ?? []) as { user_id: string; nickname: string }[];
}
