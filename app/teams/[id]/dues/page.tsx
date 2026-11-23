import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { requireUser } from "@/features/auth/queries";
import DuesItemCard from "@/features/dues/components/DuesItemCard";
import { DuesItemForm } from "@/features/dues/components/DuesForms";
import {
  getDuesDeposits,
  getDuesItems,
  getDuesPayments,
} from "@/features/dues/queries";
import { getRoster, getTeam } from "@/features/teams/queries";

export const metadata: Metadata = { title: "회비 · 리그노트" };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function DuesContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/teams/${id}/dues`);

  // 주소가 팀 번호 형식이 아니거나, 없는 팀이거나, 내가 속하지 않은 팀이면 "없음" 화면을 보여 준다.
  if (!UUID_PATTERN.test(id)) notFound();
  const team = await getTeam(id, user.id);
  if (!team) notFound();
  const isOperator = team.myRole === "operator";

  const [items, deposits, payments, roster] = await Promise.all([
    getDuesItems(id),
    isOperator ? getDuesDeposits(id) : Promise.resolve([]),
    getDuesPayments(id),
    isOperator ? getRoster(id) : Promise.resolve([]),
  ]);
  const members = roster.map((m) => ({ userId: m.user_id, nickname: m.nickname }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/teams/${id}`} className="text-sm text-black/60 underline dark:text-white/60">
          ← {team.name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">회비</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          입금은 앱 밖에서 이뤄지며, 계좌 정보는 저장하지 않습니다. 납부 여부는 운영자와 본인에게만 보입니다.
        </p>
      </div>

      {isOperator && (
        <section className="rounded-lg border border-black/10 p-4 dark:border-white/15">
          <h2 className="font-semibold">회비 항목 만들기</h2>
          <div className="mt-3">
            <DuesItemForm teamId={id} />
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">회비 항목</h2>
        {items.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60" data-testid="dues-empty">
            등록된 회비 항목이 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {items.map((item) => (
              <DuesItemCard
                key={item.id}
                teamId={id}
                item={item}
                isOperator={isOperator}
                myUserId={user.id}
                members={members}
                deposits={deposits.filter((d) => d.item_id === item.id)}
                confirmed={payments.get(item.id) ?? new Set()}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function DuesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <Suspense fallback={null}>
        <DuesContent params={params} />
      </Suspense>
    </div>
  );
}
