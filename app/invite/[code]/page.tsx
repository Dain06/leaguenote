import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { getCurrentUser } from "@/features/auth/queries";
import AcceptInviteForm from "@/features/teams/components/AcceptInviteForm";
import { getInvitePreview } from "@/features/teams/queries";

export const metadata: Metadata = { title: "팀 초대 · 리그노트" };

async function InviteContent({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await getCurrentUser();

  // 로그인하지 않았으면 로그인(또는 가입) 뒤 이 화면으로 돌아오게 한다.
  if (!user) {
    const next = encodeURIComponent(`/invite/${code}`);
    return (
      <div className="flex flex-col gap-3 text-sm">
        <p>팀 초대를 받으셨네요. 로그인하거나 가입한 뒤 이 초대로 팀에 들어올 수 있습니다.</p>
        <div className="flex gap-2">
          <Link
            href={`/login?next=${next}`}
            className="rounded-md bg-foreground px-4 py-2 font-medium text-background"
          >
            로그인
          </Link>
          <Link
            href={`/signup?next=${next}`}
            className="rounded-md border border-black/20 px-4 py-2 font-medium dark:border-white/25"
          >
            가입하기
          </Link>
        </div>
      </div>
    );
  }

  const preview = await getInvitePreview(code);
  if (!preview) {
    return (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        유효하지 않거나 만료된 초대입니다. 운영자에게 새 초대 링크를 요청해 주세요.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        <span className="font-semibold">{preview.team_name}</span> ({preview.sport}
        ) 팀에 초대받았습니다.
      </p>
      <AcceptInviteForm code={code} />
    </div>
  );
}

export default function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">팀 초대</h1>
      <Suspense fallback={null}>
        <InviteContent params={params} />
      </Suspense>
    </div>
  );
}
