"use client";

// Design Ref: §3.3 팀 만들기 — 팀 이름, 종목(기존 종목 추천), 한 경기 필요 인원, 지역
import { useActionState, useState } from "react";

import FormField from "@/features/auth/components/FormField";
import { CITIES } from "@/lib/regions";

import { createTeam } from "../actions";

type SportSuggestion = { sport: string; typical_players: number };

export default function TeamForm({
  suggestions,
}: {
  suggestions: SportSuggestion[];
}) {
  const [state, action, pending] = useActionState(createTeam, undefined);
  const errors = state?.errors;
  const values = state?.values;
  const [players, setPlayers] = useState(values?.requiredPlayers ?? "");

  // 이미 쓰인 종목을 고르면 그 종목에서 가장 흔한 한 경기 필요 인원을 채워 준다. (고쳐 쓸 수 있다)
  function handleSportChange(value: string) {
    const match = suggestions.find(
      (item) => item.sport === value.trim().toLowerCase(),
    );
    if (match) setPlayers(String(match.typical_players));
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormField
        name="name"
        label="팀 이름"
        defaultValue={values?.name}
        errors={errors?.name}
        hint="2~20자"
        required
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="sport" className="text-sm font-medium">
          종목
        </label>
        <input
          id="sport"
          name="sport"
          list="sport-suggestions"
          defaultValue={values?.sport}
          onChange={(event) => handleSportChange(event.target.value)}
          aria-invalid={errors?.sport?.length ? true : undefined}
          placeholder="예: 풋살"
          className="rounded-md border border-black/20 bg-transparent px-3 py-2 text-sm dark:border-white/25"
          required
        />
        <datalist id="sport-suggestions">
          {suggestions.map((item) => (
            <option key={item.sport} value={item.sport} />
          ))}
        </datalist>
        <p className="text-xs text-black/50 dark:text-white/50">
          직접 입력해도 되고, 이미 쓰인 종목은 목록에서 고를 수 있습니다.
        </p>
        {errors?.sport?.map((message) => (
          <p key={message} role="alert" className="text-xs text-red-600 dark:text-red-400">
            {message}
          </p>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="requiredPlayers" className="text-sm font-medium">
          한 경기에 필요한 인원
        </label>
        <input
          id="requiredPlayers"
          name="requiredPlayers"
          type="number"
          min={1}
          max={30}
          inputMode="numeric"
          value={players}
          onChange={(event) => setPlayers(event.target.value)}
          aria-invalid={errors?.requiredPlayers?.length ? true : undefined}
          className="rounded-md border border-black/20 bg-transparent px-3 py-2 text-sm dark:border-white/25"
          required
        />
        <p className="text-xs text-black/50 dark:text-white/50">
          팀 최소 인원이 됩니다. 1인 경기가 가능한 종목(예: 배드민턴)은 최소 인원이 3명으로 적용됩니다.
        </p>
        {errors?.requiredPlayers?.map((message) => (
          <p key={message} role="alert" className="text-xs text-red-600 dark:text-red-400">
            {message}
          </p>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="city" className="text-sm font-medium">
          팀 지역 (시·도)
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
        label="팀 지역 (시·군·구)"
        placeholder="예: 마포구"
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
        {pending ? "만드는 중..." : "팀 만들기"}
      </button>
    </form>
  );
}
