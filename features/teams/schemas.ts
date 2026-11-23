// Design Ref: §3.3 팀 만들기 — 팀 이름, 종목, 한 경기 필요 인원, 지역
import { z } from "zod";

import { CITIES } from "@/lib/regions";

/** 종목 이름을 정리한다: 앞뒤 공백 제거, 연속 공백을 하나로, 영문은 소문자로 통일. ("풋살 " = "풋살") */
export function normalizeSport(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}

export const teamSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "팀 이름은 2자 이상이어야 합니다.")
    .max(20, "팀 이름은 20자 이하여야 합니다."),
  sport: z
    .string()
    .transform(normalizeSport)
    .pipe(
      z
        .string()
        .min(1, "종목을 입력해 주세요.")
        .max(20, "종목은 20자 이하여야 합니다."),
    ),
  requiredPlayers: z.coerce
    .number({ error: "한 경기 필요 인원을 숫자로 입력해 주세요." })
    .int("한 경기 필요 인원은 정수여야 합니다.")
    .min(1, "한 경기 필요 인원은 1명 이상이어야 합니다.")
    .max(30, "한 경기 필요 인원은 30명 이하여야 합니다."),
  city: z.enum(CITIES, { error: "시·도를 선택해 주세요." }),
  district: z
    .string()
    .trim()
    .min(1, "시·군·구를 입력해 주세요.")
    .max(20, "시·군·구는 20자 이하여야 합니다."),
});

/** 서버 액션이 화면에 돌려주는 결과 (오류 문구와 다시 보여줄 입력값) */
export type TeamFormState =
  | {
      errors?: Record<string, string[]>;
      message?: string;
      values?: Record<string, string>;
    }
  | undefined;
