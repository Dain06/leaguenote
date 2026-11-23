import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { requireUser } from "@/features/auth/queries";
import ApplicationForm from "@/features/tournaments/components/ApplicationForm";
import ApplicationList from "@/features/tournaments/components/ApplicationList";
import {
  getMyApplications,
  getOperatorTeams,
} from "@/features/tournaments/queries";

export const metadata: Metadata = { title: "대회 · 리그노트" };

async function TournamentsContent() {
  const user = await requireUser("/tournaments");
  const [operatorTeams, applications] = await Promise.all([
    getOperatorTeams(user.id),
    getMyApplications(),
  ]);

  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">참가 신청</h2>
        {operatorTeams.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60" data-testid="not-operator">
            대회 참가 신청은 팀 운영자만 할 수 있습니다.{" "}
            <Link href="/teams/new" className="font-medium underline">
              팀 만들기
            </Link>
          </p>
        ) : (
          <ApplicationForm teams={operatorTeams} />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">내 팀의 신청 현황</h2>
        <ApplicationList
          applications={applications}
          operatorTeamIds={new Set(operatorTeams.map((t) => t.id))}
        />
      </section>
    </>
  );
}

export default function TournamentsPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8">
      <h1 className="text-2xl font-bold tracking-tight">대회</h1>
      <Suspense fallback={null}>
        <TournamentsContent />
      </Suspense>
    </div>
  );
}
