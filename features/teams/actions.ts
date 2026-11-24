"use server";

// Design Ref: §4 데이터 흐름 — 입력 → 입력 검사 → 저장(권한 검사는 데이터베이스 규칙이 한 번 더) → 화면 이동
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/features/auth/queries";
import { createServerDb } from "@/lib/db/server";

import { teamSchema, type TeamFormState } from "./schemas";

export async function createTeam(
  _prevState: TeamFormState,
  formData: FormData,
): Promise<TeamFormState> {
  await requireUser("/teams/new");

  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") values[key] = value;
  }

  const parsed = teamSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      (errors[key] ??= []).push(issue.message);
    }
    return { errors, values };
  }

  const { name, sport, requiredPlayers, city, district } = parsed.data;
  const db = await createServerDb();
  // 팀과 "운영자" 팀원 행을 데이터베이스 함수가 한 번에 만든다.
  const { data, error } = await db.rpc("create_team", {
    p_name: name,
    p_sport: sport,
    p_required_players: requiredPlayers,
    p_city: city,
    p_district: district,
  });

  if (error || !data) {
    return {
      message: "팀을 만드는 중 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요.",
      values,
    };
  }

  redirect(`/teams/${data}`);
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 초대 링크를 새로 만든다. 이전 링크는 바로 만료된다. (운영자만 가능: 데이터베이스 함수가 확인) */
export async function createInvite(teamId: string) {
  await requireUser(`/teams/${teamId}`);
  if (!UUID_PATTERN.test(teamId)) return;
  const db = await createServerDb();
  await db.rpc("create_invite", { p_team_id: teamId });
  revalidatePath(`/teams/${teamId}`);
}

/** 초대 링크를 끈다. (운영자만) */
export async function revokeInvites(teamId: string) {
  await requireUser(`/teams/${teamId}`);
  if (!UUID_PATTERN.test(teamId)) return;
  const db = await createServerDb();
  await db.rpc("revoke_invites", { p_team_id: teamId });
  revalidatePath(`/teams/${teamId}`);
}

/** 팀원 내보내기. (운영자만, 일반 팀원만: 데이터베이스 함수가 확인) */
export async function removeMember(teamId: string, userId: string) {
  await requireUser(`/teams/${teamId}`);
  if (!UUID_PATTERN.test(teamId) || !UUID_PATTERN.test(userId)) return;
  const db = await createServerDb();
  await db.rpc("remove_team_member", { p_team_id: teamId, p_user_id: userId });
  revalidatePath(`/teams/${teamId}`);
  revalidatePath("/", "layout");
}

/** 내가 팀 나가기. (일반 팀원만) 나간 뒤에는 홈으로 간다. */
export async function leaveTeam(teamId: string) {
  await requireUser(`/teams/${teamId}`);
  if (!UUID_PATTERN.test(teamId)) return;
  const db = await createServerDb();
  const { error } = await db.rpc("leave_team", { p_team_id: teamId });
  if (error) {
    revalidatePath(`/teams/${teamId}`);
    return;
  }
  revalidatePath("/", "layout");
  redirect("/");
}

export type AcceptInviteState = { message?: string } | undefined;

/** 초대 코드로 팀에 들어온다. */
export async function acceptInvite(
  code: string,
  // useActionState가 이전 결과를 첫 인자로 넘겨 주므로 받아야 하지만, 이 함수에서는 쓰지 않는다.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: AcceptInviteState,
): Promise<AcceptInviteState> {
  await requireUser(`/invite/${code}`);
  const db = await createServerDb();
  const { data, error } = await db.rpc("accept_invite", { p_code: code });

  if (error || !data) {
    return { message: "유효하지 않거나 만료된 초대입니다." };
  }

  redirect(`/teams/${data}`);
}
