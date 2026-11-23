// Design Ref: §3.1 `/recruit` — 팀 모집 글 작성 입력 검사
import { z } from "zod";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const recruitSchema = z.object({
  teamId: z.string().regex(UUID_PATTERN, "팀을 선택해 주세요."),
  title: z
    .string()
    .trim()
    .min(2, "제목은 2자 이상 입력해 주세요.")
    .max(40, "제목은 40자 이하여야 합니다."),
  body: z
    .string()
    .trim()
    .min(10, "내용은 10자 이상 입력해 주세요.")
    .max(500, "내용은 500자 이하여야 합니다."),
  neededCount: z
    .string()
    .regex(/^\d+$/, "모집 인원은 숫자로 입력해 주세요.")
    .transform(Number)
    .pipe(
      z
        .number()
        .int()
        .min(1, "모집 인원은 1명 이상이어야 합니다.")
        .max(30, "모집 인원은 30명 이하여야 합니다."),
    ),
});

/** 서버 액션이 화면에 돌려주는 결과 (오류 문구와 다시 보여줄 입력값) */
export type RecruitFormState =
  | {
      errors?: Record<string, string[]>;
      message?: string;
      values?: Record<string, string>;
    }
  | undefined;
