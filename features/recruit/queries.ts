// Design Ref: §5 저장할 데이터 — 팀 모집 글 조회. 로그인한 모든 사용자에게 공개된다. (PRD 7번)
import { createServerDb } from "@/lib/db/server";

export type RecruitPost = {
  id: string;
  team_id: string;
  team_name: string;
  sport: string;
  city: string;
  district: string;
  title: string;
  body: string;
  needed_count: number;
  status: "open" | "closed";
  created_at: string;
};

const MAX_POSTS = 50;

/** 모집 글 목록 (최신순). city를 주면 그 시의 글만 보여 준다. */
export async function getRecruitPosts(city?: string): Promise<RecruitPost[]> {
  const db = await createServerDb();
  let query = db
    .from("recruit_posts")
    .select(
      "id, team_id, team_name, sport, city, district, title, body, needed_count, status, created_at",
    )
    .order("status", { ascending: false }) // open이 closed보다 앞
    .order("created_at", { ascending: false })
    .limit(MAX_POSTS);
  if (city) query = query.eq("city", city);

  const { data } = await query;
  return (data ?? []) as RecruitPost[];
}
