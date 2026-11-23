import type { Metadata } from "next";
import { Suspense } from "react";

import { requireUser } from "@/features/auth/queries";
import TeamForm from "@/features/teams/components/TeamForm";
import { getPopularSports } from "@/features/teams/queries";

export const metadata: Metadata = { title: "팀 만들기 · 리그노트" };

async function NewTeamContent() {
  await requireUser("/teams/new");
  const suggestions = await getPopularSports();
  return <TeamForm suggestions={suggestions} />;
}

export default function NewTeamPage() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">팀 만들기</h1>
      <Suspense fallback={null}>
        <NewTeamContent />
      </Suspense>
    </div>
  );
}
