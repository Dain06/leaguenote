// Design Ref: §3.3 화면 체크리스트(회원가입) — 입력값을 저장 전에 검사한다 (Zod)
import { z } from "zod";

import { CITIES } from "@/lib/regions";

const email = z.email("이메일 형식이 올바르지 않습니다.");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "비밀번호를 입력해 주세요."),
});

export const signupSchema = z.object({
  email,
  password: z
    .string()
    .min(8, "비밀번호는 8자 이상이어야 합니다.")
    .max(72, "비밀번호는 72자 이하여야 합니다."),
  // 실명 대신 항상 닉네임을 쓴다 (PRD 7번)
  nickname: z
    .string()
    .trim()
    .min(2, "닉네임은 2자 이상이어야 합니다.")
    .max(12, "닉네임은 12자 이하여야 합니다."),
  phone: z
    .string()
    .trim()
    .regex(/^01[016789]-?\d{3,4}-?\d{4}$/, "휴대전화 번호 형식이 올바르지 않습니다.")
    .transform((value) => value.replaceAll("-", "")),
  city: z.enum(CITIES, { error: "시·도를 선택해 주세요." }),
  district: z
    .string()
    .trim()
    .min(1, "시·군·구를 입력해 주세요.")
    .max(20, "시·군·구는 20자 이하여야 합니다."),
});

/** 서버 액션이 화면에 돌려주는 결과 (오류 문구와 다시 보여줄 입력값) */
export type AuthFormState =
  | {
      errors?: Record<string, string[]>;
      message?: string;
      /** 오류가 아닌 안내 (예: 가입 확인 메일을 보냈습니다) */
      notice?: string;
      values?: Record<string, string>;
    }
  | undefined;
