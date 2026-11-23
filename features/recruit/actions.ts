"use server";

// Design Ref: §4.3 팀 모집 — 글 작성 → 로그인한 모든 사용자에게 목록 표시
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/features/auth/queries";
import { createServerDb } from "@/lib/db/server";

import { recruitSchema, type RecruitFormState } from "./schemas";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createRecruitPost(
  _prevState: RecruitFormState,
  formData: FormData,
): Promise<RecruitFormState> {
  await requireUser("/recruit/new");

  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") values[key] = value;
  }

  const parsed = recruitSchema.safeParse(values);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      (errors[key] ??= []).push(issue.message);
    }
    return { errors, values };
  }

  // 팀 운영자인지, 모집 중인 글이 3개 미만인지는 데이터베이스 함수가 확인한다.
  const db = await createServerDb();
  const { error } = await db.rpc("create_recruit_post", {
    p_team_id: parsed.data.teamId,
    p_title: parsed.data.title,
    p_body: parsed.data.body,
    p_needed_count: parsed.data.neededCount,
  });
  if (error) return { message: error.message, values };

  revalidatePath("/recruit");
  redirect("/recruit");
}

/** 모집 마감 / 다시 모집 (팀 운영자만) */
export async function setRecruitStatus(
  postId: string,
  status: "open" | "closed",
): Promise<void> {
  await requireUser("/recruit");
  if (!UUID_PATTERN.test(postId)) return;

  const db = await createServerDb();
  await db.rpc("set_recruit_status", { p_post_id: postId, p_status: status });
  revalidatePath("/recruit");
}

/** 글 삭제 (팀 운영자만. 접근 규칙이 한 번 더 확인한다) */
export async function deleteRecruitPost(postId: string): Promise<void> {
  await requireUser("/recruit");
  if (!UUID_PATTERN.test(postId)) return;

  const db = await createServerDb();
  await db.from("recruit_posts").delete().eq("id", postId);
  revalidatePath("/recruit");
}
