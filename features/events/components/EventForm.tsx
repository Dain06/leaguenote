"use client";

// Design Ref: §3.3 일정 만들기 — 날짜·시간, 장소 (유형은 연습·모의 모임 고정)
import { useActionState } from "react";

import FormField from "@/features/auth/components/FormField";

import { createEvent } from "../actions";

export default function EventForm({ teamId }: { teamId: string }) {
  const [state, action, pending] = useActionState(
    createEvent.bind(null, teamId),
    undefined,
  );
  const errors = state?.errors;
  const values = state?.values;

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-black/60 dark:text-white/60">
        유형: <span className="font-medium">연습·모의 모임</span> (대회 경기
        일정은 대회가 확정되면 자동으로 만들어집니다.)
      </p>

      <FormField
        name="startsAt"
        label="날짜와 시간 (한국 시간)"
        type="datetime-local"
        defaultValue={values?.startsAt}
        errors={errors?.startsAt}
        required
      />
      <FormField
        name="location"
        label="장소"
        placeholder="예: 마포 풋살파크 A구장"
        defaultValue={values?.location}
        errors={errors?.location}
        hint="60자 이하"
        required
      />

      {state?.message && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60"
      >
        {pending ? "만드는 중..." : "일정 만들기"}
      </button>
    </form>
  );
}
