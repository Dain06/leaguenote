import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { requireUser } from "@/features/auth/queries";
import RecruitList from "@/features/recruit/components/RecruitList";
import { getRecruitPosts } from "@/features/recruit/queries";
import { getOperatorTeams } from "@/features/tournaments/queries";
import { CITIES } from "@/lib/regions";

export const metadata: Metadata = { title: "팀 모집 · 리그노트" };

async function RecruitContent({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>;
}) {
  const { city: rawCity } = await searchParams;
  const user = await requireUser("/recruit");

  // 목록에 없는 시 이름이 들어오면 전체를 보여 준다.
  const city = (CITIES as readonly string[]).includes(rawCity ?? "") ? rawCity : undefined;

  const [posts, operatorTeams] = await Promise.all([
    getRecruitPosts(city),
    getOperatorTeams(user.id),
  ]);

  return (
    <>
      <form className="flex flex-wrap items-end gap-2" method="get">
        <div className="flex flex-col gap-1">
          <label htmlFor="city" className="text-sm font-medium">
            지역
          </label>
          <select
            id="city"
            name="city"
            defaultValue={city ?? ""}
            className="rounded-md border border-black/20 bg-transparent px-3 py-2 text-sm dark:border-white/25"
          >
            <option value="">전체</option>
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md border border-black/20 px-3 py-2 text-sm hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
        >
          보기
        </button>
        {operatorTeams.length > 0 && (
          <Link
            href="/recruit/new"
            className="ml-auto rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background"
          >
            모집 글 쓰기
          </Link>
        )}
      </form>

      <RecruitList
        posts={posts}
        operatorTeamIds={new Set(operatorTeams.map((t) => t.id))}
      />
    </>
  );
}

export default function RecruitPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">팀 모집</h1>
      <Suspense fallback={null}>
        <RecruitContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
