// Design Ref: §5 저장할 데이터 — 회비 조회. 입금 내역은 운영자만, 납부 확인은 운영자와 본인만 읽힌다. (PRD 7번)
import { createServerDb } from "@/lib/db/server";

export type DuesItem = {
  id: string;
  title: string;
  amount: number;
  due_on: string;
};

export type DuesDepositRow = {
  id: string;
  item_id: string;
  depositor: string;
  amount: number;
};

/** 팀의 회비 항목 (기한이 가까운 순) */
export async function getDuesItems(teamId: string): Promise<DuesItem[]> {
  const db = await createServerDb();
  const { data } = await db
    .from("dues_items")
    .select("id, title, amount, due_on")
    .eq("team_id", teamId)
    .order("due_on", { ascending: false });
  return (data ?? []) as DuesItem[];
}

/** 팀의 입금 내역. 운영자가 아니면 빈 목록이 돌아온다. */
export async function getDuesDeposits(teamId: string): Promise<DuesDepositRow[]> {
  const db = await createServerDb();
  const { data } = await db
    .from("dues_deposits")
    .select("id, item_id, depositor, amount")
    .eq("team_id", teamId)
    .order("created_at", { ascending: true });
  return (data ?? []) as DuesDepositRow[];
}

/** 항목별로 최종 확인된 납부자. 운영자는 모두, 팀원은 본인 것만 돌아온다. */
export async function getDuesPayments(
  teamId: string,
): Promise<Map<string, Set<string>>> {
  const db = await createServerDb();
  const { data } = await db
    .from("dues_payments")
    .select("item_id, user_id")
    .eq("team_id", teamId);

  const byItem = new Map<string, Set<string>>();
  for (const row of data ?? []) {
    const set = byItem.get(row.item_id as string) ?? new Set<string>();
    set.add(row.user_id as string);
    byItem.set(row.item_id as string, set);
  }
  return byItem;
}
