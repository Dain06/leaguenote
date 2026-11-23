"use server";

// Design Ref: §4.1 — 입력 → 입력 검사 → 저장 → 화면 이동
// 비밀번호는 이 앱이 저장하지 않고 Supabase 로그인 서비스가 암호화해 보관한다. (PRD 7번)
import { redirect } from "next/navigation";

import { isDbConfigured } from "@/lib/db/config";
import { createServerDb } from "@/lib/db/server";

import { loginSchema, signupSchema, type AuthFormState } from "./schemas";

const NO_DB_MESSAGE =
  "데이터 저장소 연결 정보가 없어 지금은 이용할 수 없습니다. 관리자에게 문의해 주세요.";

/** 비밀번호는 다시 보여주지 않고, 나머지 입력값만 돌려준다. */
function keepValues(formData: FormData) {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key !== "password" && typeof value === "string") values[key] = value;
  }
  return values;
}

export async function signup(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      errors: flattenIssues(parsed.error.issues),
      values: keepValues(formData),
    };
  }

  if (!isDbConfigured()) return { message: NO_DB_MESSAGE };

  const { email, password, nickname, phone, city, district } = parsed.data;
  const db = await createServerDb();
  // 닉네임·연락처·지역은 가입 정보로 함께 보내 두면, DB가 profiles 행을 자동으로 만든다.
  const { error } = await db.auth.signUp({
    email,
    password,
    options: { data: { nickname, phone, city, district } },
  });

  if (error) {
    const alreadyUsed = /already|registered/i.test(error.message);
    return {
      message: alreadyUsed
        ? "이미 가입된 이메일입니다. 로그인해 주세요."
        : "가입 중 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요.",
      values: keepValues(formData),
    };
  }

  redirect("/");
}

export async function login(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      errors: flattenIssues(parsed.error.issues),
      values: keepValues(formData),
    };
  }

  if (!isDbConfigured()) return { message: NO_DB_MESSAGE };

  const db = await createServerDb();
  const { error } = await db.auth.signInWithPassword(parsed.data);

  if (error) {
    return {
      message: "이메일 또는 비밀번호가 맞지 않습니다.",
      values: keepValues(formData),
    };
  }

  redirect("/");
}

export async function logout() {
  if (isDbConfigured()) {
    const db = await createServerDb();
    await db.auth.signOut();
  }
  redirect("/");
}

/** Zod 오류 목록을 "입력칸 이름 → 오류 문구 목록" 형태로 바꾼다. */
function flattenIssues(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    (errors[key] ??= []).push(issue.message);
  }
  return errors;
}
