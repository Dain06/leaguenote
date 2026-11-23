import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { requireUser } from "@/features/auth/queries";
import EventForm from "@/features/events/components/EventForm";
import { getTeam } from "@/features/teams/queries";

export const metadata: Metadata = { title: "일정 만들기 · 리그노트" };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function NewEventContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/teams/${id}/events/new`);

  if (!UUID_PATTERN.test(id)) notFound();
  const team = await getTeam(id, user.id);
  if (!team) notFound();

  // 일정은 팀 운영자만 만들 수 있다.
  if (team.myRole !== "operator") {
    return (
      <div className="flex flex-col gap-3 text-sm">
        <p role="alert">일정은 팀 운영자만 만들 수 있습니다.</p>
        <Link href={`/teams/${id}`} className="font-medium underline">
          팀 홈으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <>
      <p className="text-sm text-black/60 dark:text-white/60">{team.name}</p>
      <EventForm teamId={id} />
    </>
  );
}

export default function NewEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">일정 만들기</h1>
      <Suspense fallback={null}>
        <NewEventContent params={params} />
      </Suspense>
    </div>
  );
}
