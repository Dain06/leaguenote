"use client";

// Design Ref: §3.3 회원가입 — 이메일, 비밀번호, 닉네임, 연락처, 거주 시·구
import Link from "next/link";
import { useActionState } from "react";

import { MIN_AGE } from "@/lib/privacy";
import { CITIES } from "@/lib/regions";

import { signup } from "../actions";
import FormField from "./FormField";

export default function SignupForm({ next = "/" }: { next?: string }) {
  const [state, action, pending] = useActionState(signup, undefined);
  const errors = state?.errors;
  const values = state?.values;

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
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

      <div className="flex flex-col gap-2 rounded-md border border-black/10 p-3 dark:border-white/15">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="consent"
            defaultChecked={values?.consent === "on"}
            className="mt-1"
          />
          <span>
            (필수) 개인정보 수집·이용에 동의합니다. 이메일·닉네임·연락처·거주 지역을 팀 활동과 대회 매칭에 쓰며,
            탈퇴할 때까지 보관합니다.{" "}
            <Link href="/privacy" target="_blank" className="underline">
              처리방침 보기
            </Link>
          </span>
        </label>
        {errors?.consent?.map((message) => (
          <p key={message} role="alert" className="text-xs text-red-600 dark:text-red-400">
            {message}
          </p>
        ))}
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="age"
            defaultChecked={values?.age === "on"}
            className="mt-1"
          />
          <span>(필수) 만 {MIN_AGE}세 이상입니다.</span>
        </label>
        {errors?.age?.map((message) => (
          <p key={message} role="alert" className="text-xs text-red-600 dark:text-red-400">
            {message}
          </p>
        ))}
      </div>

      {state?.message && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}
      {state?.notice && (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          {state.notice}
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
