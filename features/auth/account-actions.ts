"use server";

// 계정 탈퇴: 비밀번호로 본인 확인 → 팀 기록 정리(DB 함수) → 로그인 계정 삭제 → 로그아웃
// 계정이 지워지면 프로필(닉네임·연락처·지역)과 본인 응답·알림이 함께 지워지고,
// 팀 활동 기록의 작성자 연결은 비워진다. (20261124010000_privacy_consent_withdrawal.sql)
import { redirect } from "next/navigation";

import { createAdminDb } from "@/lib/db/admin";
import { isDbConfigured } from "@/lib/db/config";
import { friendlyDbError } from "@/lib/db/errors";
import { createServerDb } from "@/lib/db/server";

import { getCurrentUser } from "./queries";
import { deleteAccountSchema, type AuthFormState } from "./schemas";

export async function deleteAccount(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = deleteAccountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      (errors[String(issue.path[0] ?? "form")] ??= []).push(issue.message);
    }
    return { errors };
  }
  if (!isDbConfigured()) {
    return { message: "데이터 저장소 연결 정보가 없어 지금은 이용할 수 없습니다." };
  }

  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Faccount");

  // 비밀번호로 본인 확인 (로그인된 기기를 누가 잠깐 쓰는 경우를 막는다)
  const db = await createServerDb();
  const { error: authError } = await db.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.password,
  });
  if (authError) return { errors: { password: ["비밀번호가 맞지 않습니다."] } };

  const admin = createAdminDb();
  const { error: prepareError } = await admin.rpc("prepare_account_deletion", {
    p_user_id: user.id,
  });
  if (prepareError) return { message: friendlyDbError(prepareError) };

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return { message: "탈퇴 처리 중 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요." };
  }

  await db.auth.signOut();
  redirect("/withdrawn");
}
