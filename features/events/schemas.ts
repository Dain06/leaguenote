// Design Ref: §3.3 일정 만들기 — 날짜·시간, 장소 (유형은 연습·모의 모임 고정, 최소 인원은 팀 설정에서 자동)
import { z } from "zod";

export const eventSchema = z.object({
  startsAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "날짜와 시간을 입력해 주세요."),
  location: z
    .string()
    .trim()
    .min(1, "장소를 입력해 주세요.")
    .max(60, "장소는 60자 이하여야 합니다."),
});

/** 서버 액션이 화면에 돌려주는 결과 (오류 문구와 다시 보여줄 입력값) */
export type EventFormState =
  | {
      errors?: Record<string, string[]>;
      message?: string;
      values?: Record<string, string>;
    }
  | undefined;
