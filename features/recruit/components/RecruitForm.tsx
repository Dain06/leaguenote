"use client";

// Design Ref: §3.1 `/recruit` — 모집 글 작성(팀·제목·내용·모집 인원). 종목·지역은 팀 설정값을 쓴다.
import { useActionState } from "react";

import FormField from "@/features/auth/components/FormField";
import type { Team } from "@/features/teams/queries";

import { createRecruitPost } from "../actions";

export default function RecruitForm({ teams }: { teams: Team[] }) {
  const [state, action, pending] = useActionState(createRecruitPost, undefined);
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
              {team.name} · {team.sport} · {team.city} {team.district}
            </option>
          ))}
        </select>
        <p className="text-xs text-black/50 dark:text-white/50">
          종목과 지역은 팀에 저장된 값으로 게시됩니다.
        </p>
      </div>

      <FormField
        name="title"
        label="제목"
        placeholder="예: 평일 저녁 풋살 같이 하실 분"
        defaultValue={values?.title}
        errors={errors?.title}
        hint="2~40자"
        required
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="body" className="text-sm font-medium">
          내용
        </label>
        <textarea
          id="body"
          name="body"
          rows={5}
          defaultValue={values?.body}
          aria-invalid={errors?.body?.length ? true : undefined}
          className="rounded-md border border-black/20 bg-transparent px-3 py-2 text-sm dark:border-white/25"
          placeholder="활동 요일·시간, 실력 수준, 분위기를 적어 주세요."
        />
        <p className="text-xs text-black/50 dark:text-white/50">
          10~500자. 전화번호 같은 개인정보는 적지 마세요. 글은 로그인한 모든 사용자에게 보입니다.
        </p>
        {errors?.body?.map((m) => (
          <p key={m} role="alert" className="text-xs text-red-600 dark:text-red-400">
            {m}
          </p>
        ))}
      </div>

      <FormField
        name="neededCount"
        label="모집 인원 (명)"
        type="number"
        inputMode="numeric"
        defaultValue={values?.neededCount}
        errors={errors?.neededCount}
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
        {pending ? "올리는 중..." : "모집 글 올리기"}
      </button>
    </form>
  );
}
