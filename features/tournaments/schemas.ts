// Design Ref: §3.3 대회 참가 신청 — 팀, 규모(팀 인원), 팀 경력(개월), 대회 시작일
import { z } from "zod";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const applicationSchema = z.object({
  teamId: z.string().regex(UUID_PATTERN, "팀을 선택해 주세요."),
  teamSize: z
    .string()
    .regex(/^\d+$/, "팀 인원은 숫자로 입력해 주세요.")
    .transform(Number)
    .pipe(z.number().int().min(1, "팀 인원은 1명 이상이어야 합니다.").max(100, "팀 인원은 100명 이하여야 합니다.")),
  careerMonths: z
    .string()
    .regex(/^\d+$/, "팀 경력은 개월 수를 숫자로 입력해 주세요.")
    .transform(Number)
    .pipe(z.number().int().min(0).max(600, "팀 경력은 600개월 이하여야 합니다.")),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "대회 시작일을 입력해 주세요."),
});

/** 서버 액션이 화면에 돌려주는 결과 (오류 문구와 다시 보여줄 입력값) */
export type ApplicationFormState =
  | {
      errors?: Record<string, string[]>;
      message?: string;
      values?: Record<string, string>;
      done?: boolean;
    }
  | undefined;
