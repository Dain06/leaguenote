import type { Metadata } from "next";
import { Suspense } from "react";

import { requireUser } from "@/features/auth/queries";
import MercenaryBoard from "@/features/mercenary/components/MercenaryBoard";
import { getMercenaryBoard } from "@/features/mercenary/queries";

export const metadata: Metadata = { title: "용병 · 리그노트" };

async function MercenaryContent() {
  await requireUser("/mercenary");
  const posts = await getMercenaryBoard();
  return <MercenaryBoard posts={posts} />;
}

export default function MercenaryPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">용병 모집</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          글에는 시간·종목·지역·필요 인원만 보입니다. 지원이 수락되면 장소를 알림으로 알려 드립니다.
        </p>
      </div>
      <Suspense fallback={null}>
        <MercenaryContent />
      </Suspense>
    </div>
  );
}
