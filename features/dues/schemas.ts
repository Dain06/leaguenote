// Design Ref: §3.1 `/teams/[id]/dues` — 회비 항목·입금 내역 입력 검사
import { z } from "zod";

const money = (label: string) =>
  z
    .string()
    .regex(/^\d+$/, `${label}은 숫자로 입력해 주세요.`)
    .transform(Number)
    .pipe(
      z
        .number()
        .int()
        .min(1, `${label}은 1원 이상이어야 합니다.`)
        .max(10_000_000, `${label}은 1,000만 원 이하여야 합니다.`),
    );

export const itemSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "항목 이름은 2자 이상 입력해 주세요.")
    .max(40, "항목 이름은 40자 이하여야 합니다."),
  amount: money("금액"),
  dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "납부 기한을 입력해 주세요."),
});

export const depositSchema = z.object({
  depositor: z
    .string()
    .trim()
    .min(1, "입금자 닉네임을 입력해 주세요.")
    .max(30, "입금자 닉네임은 30자 이하여야 합니다."),
  amount: money("입금 금액"),
});

/** 서버 액션이 화면에 돌려주는 결과 */
export type DuesFormState =
  | {
      errors?: Record<string, string[]>;
      message?: string;
      values?: Record<string, string>;
      done?: boolean;
    }
  | undefined;
