import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { requireUser } from "@/features/auth/queries";
import RecruitForm from "@/features/recruit/components/RecruitForm";
import { getOperatorTeams } from "@/features/tournaments/queries";

export const metadata: Metadata = { title: "모집 글 쓰기 · 리그노트" };

async function NewRecruitContent() {
  const user = await requireUser("/recruit/new");
  const teams = await getOperatorTeams(user.id);

  // 모집 글은 팀 운영자만 쓸 수 있다.
  if (teams.length === 0) {
    return (
      <div className="flex flex-col gap-3 text-sm">
        <p role="alert">모집 글은 팀 운영자만 쓸 수 있습니다.</p>
        <Link href="/recruit" className="font-medium underline">
          모집 글 보러 가기
        </Link>
      </div>
    );
  }

  return <RecruitForm teams={teams} />;
}

export default function NewRecruitPage() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">모집 글 쓰기</h1>
      <Suspense fallback={null}>
        <NewRecruitContent />
      </Suspense>
    </div>
  );
}
