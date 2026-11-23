"use client";

// Design Ref: §3.3 대회 참가 신청 — 종목(팀 설정값), 규모(팀 인원), 팀 경력(개월), 대회 시작일
import { useActionState } from "react";

import FormField from "@/features/auth/components/FormField";
import type { Team } from "@/features/teams/queries";

import { applyTournament } from "../actions";

export default function ApplicationForm({ teams }: { teams: Team[] }) {
  const [state, action, pending] = useActionState(applyTournament, undefined);
  const errors = state?.errors;
  const values = state?.values;

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1">
        <label htmlFor="teamId" className="text-sm font-medium">
          팀
        </label>
        <select
          id="teamId"
          name="teamId"
          defaultValue={values?.teamId ?? teams[0]?.id}
          className="rounded-md border border-black/20 bg-transparent px-3 py-2 text-sm dark:border-white/25"
        >
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name} · {team.sport} · {team.city}
            </option>
          ))}
        </select>
        <p className="text-xs text-black/50 dark:text-white/50">
          종목과 지역은 팀에 저장된 값으로 신청됩니다. 같은 종목·같은 시의 팀끼리 매칭됩니다.
        </p>
        {errors?.teamId?.map((m) => (
          <p key={m} role="alert" className="text-xs text-red-600 dark:text-red-400">
            {m}
          </p>
        ))}
      </div>

      <FormField
        name="teamSize"
        label="팀 인원(규모)"
        type="number"
        inputMode="numeric"
        defaultValue={values?.teamSize}
        errors={errors?.teamSize}
        hint="실제 활동 중인 팀원 수 (명)"
        required
      />
      <FormField
        name="careerMonths"
        label="팀 경력 (개월)"
        type="number"
        inputMode="numeric"
        defaultValue={values?.careerMonths}
        errors={errors?.careerMonths}
        hint="팀을 꾸린 지 얼마나 됐는지 개월 수로 입력 (2년 = 24)"
        required
      />
      <FormField
        name="startsOn"
        label="희망 대회 시작일"
        type="date"
        defaultValue={values?.startsOn}
        errors={errors?.startsOn}
        hint="신청은 대회 시작 3주 전까지 받고, 마감되면 매칭이 진행됩니다."
        required
      />

      {state?.message && (
        <p
          role={state.done ? "status" : "alert"}
          className={`text-sm ${state.done ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
        >
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60"
      >
        {pending ? "신청하는 중..." : "참가 신청"}
      </button>
    </form>
  );
}
