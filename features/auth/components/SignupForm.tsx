"use client";

// Design Ref: §3.3 회원가입 — 이메일, 비밀번호, 닉네임, 연락처, 거주 시·구
import { useActionState } from "react";

import { signup } from "../actions";
import { CITIES } from "../schemas";
import FormField from "./FormField";

export default function SignupForm() {
  const [state, action, pending] = useActionState(signup, undefined);
  const errors = state?.errors;
  const values = state?.values;

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormField
        name="email"
        label="이메일"
        type="email"
        autoComplete="email"
        defaultValue={values?.email}
        errors={errors?.email}
        required
      />
      <FormField
        name="password"
        label="비밀번호"
        type="password"
        autoComplete="new-password"
        hint="8자 이상"
        errors={errors?.password}
        required
      />
      <FormField
        name="nickname"
        label="닉네임"
        autoComplete="nickname"
        hint="실명 대신 닉네임을 사용합니다. (2~12자)"
        defaultValue={values?.nickname}
        errors={errors?.nickname}
        required
      />
      <FormField
        name="phone"
        label="연락처"
        type="tel"
        autoComplete="tel"
        placeholder="010-1234-5678"
        hint="같은 팀 운영자와 본인에게만 보입니다."
        defaultValue={values?.phone}
        errors={errors?.phone}
        required
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="city" className="text-sm font-medium">
          거주 지역 (시·도)
        </label>
        <select
          id="city"
          name="city"
          defaultValue={values?.city ?? ""}
          aria-invalid={errors?.city?.length ? true : undefined}
          className="rounded-md border border-black/20 bg-transparent px-3 py-2 text-sm dark:border-white/25"
          required
        >
          <option value="" disabled>
            선택해 주세요
          </option>
          {CITIES.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
        {errors?.city?.map((message) => (
          <p key={message} role="alert" className="text-xs text-red-600 dark:text-red-400">
            {message}
          </p>
        ))}
      </div>
      <FormField
        name="district"
        label="거주 지역 (시·군·구)"
        placeholder="예: 마포구"
        hint="대회 순위는 같은 지역 사용자에게만 공개됩니다."
        defaultValue={values?.district}
        errors={errors?.district}
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
        {pending ? "가입 중..." : "가입하기"}
      </button>
    </form>
  );
}
