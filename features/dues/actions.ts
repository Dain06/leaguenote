"use server";

// Design Ref: §4.3 회비 정산 — 회비 항목 등록 → 운영자가 입금 내역 입력 → 앱이 대조 → 미납자 목록 → 운영자 최종 확인
import { revalidatePath } from "next/cache";

import { requireUser } from "@/features/auth/queries";
import { getRoster } from "@/features/teams/queries";
import { createServerDb } from "@/lib/db/server";

import { getDuesDeposits, getDuesItems } from "./queries";
import { reconcile } from "./reconcile";
import { depositSchema, itemSchema, type DuesFormState } from "./schemas";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") values[key] = value;
  }
  return values;
}

function issuesToErrors(
  issues: { path: PropertyKey[]; message: string }[],
): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    (errors[key] ??= []).push(issue.message);
  }
  return errors;
}

/** 회비 항목 만들기 (운영자만. 접근 규칙이 한 번 더 확인한다) */
export async function createDuesItem(
  teamId: string,
  _prevState: DuesFormState,
  formData: FormData,
): Promise<DuesFormState> {
  const user = await requireUser(`/teams/${teamId}/dues`);
  if (!UUID_PATTERN.test(teamId)) return { message: "팀을 찾을 수 없습니다." };

  const values = readValues(formData);
  const parsed = itemSchema.safeParse(values);
  if (!parsed.success) return { errors: issuesToErrors(parsed.error.issues), values };

  const db = await createServerDb();
  const { error } = await db.from("dues_items").insert({
    team_id: teamId,
    title: parsed.data.title,
    amount: parsed.data.amount,
    due_on: parsed.data.dueOn,
    created_by: user.id,
  });
  if (error) return { message: "항목을 만들 수 없습니다. 팀 운영자만 만들 수 있습니다.", values };

  revalidatePath(`/teams/${teamId}/dues`);
  return { done: true, message: "회비 항목을 만들었습니다." };
}

/** 입금 내역 한 건 입력 (운영자만) */
export async function addDeposit(
  teamId: string,
  itemId: string,
  _prevState: DuesFormState,
  formData: FormData,
): Promise<DuesFormState> {
  const user = await requireUser(`/teams/${teamId}/dues`);
  if (!UUID_PATTERN.test(teamId) || !UUID_PATTERN.test(itemId)) {
    return { message: "요청이 올바르지 않습니다." };
  }

  const values = readValues(formData);
  const parsed = depositSchema.safeParse(values);
  if (!parsed.success) return { errors: issuesToErrors(parsed.error.issues), values };

  const db = await createServerDb();
  const { error } = await db.from("dues_deposits").insert({
    item_id: itemId,
    team_id: teamId,
    depositor: parsed.data.depositor,
    amount: parsed.data.amount,
    created_by: user.id,
  });
  if (error) return { message: "입금 내역을 저장할 수 없습니다. 팀 운영자만 입력할 수 있습니다.", values };

  revalidatePath(`/teams/${teamId}/dues`);
  return { done: true, message: "입금 내역을 추가했습니다." };
}

/** 입금 내역 삭제 (운영자만) */
export async function deleteDeposit(teamId: string, depositId: string): Promise<void> {
  await requireUser(`/teams/${teamId}/dues`);
  if (!UUID_PATTERN.test(depositId)) return;
  const db = await createServerDb();
  await db.from("dues_deposits").delete().eq("id", depositId).eq("team_id", teamId);
  revalidatePath(`/teams/${teamId}/dues`);
}

/** 한 명의 납부를 최종 확인하거나(confirm=true) 확인을 취소한다 (운영자만) */
export async function setPaymentConfirmed(
  teamId: string,
  itemId: string,
  userId: string,
  confirm: boolean,
): Promise<void> {
  const user = await requireUser(`/teams/${teamId}/dues`);
  if (![teamId, itemId, userId].every((id) => UUID_PATTERN.test(id))) return;

  const db = await createServerDb();
  if (confirm) {
    await db.from("dues_payments").upsert(
      { item_id: itemId, team_id: teamId, user_id: userId, confirmed_by: user.id },
      { onConflict: "item_id,user_id", ignoreDuplicates: true },
    );
  } else {
    await db.from("dues_payments").delete().eq("item_id", itemId).eq("user_id", userId);
  }
  revalidatePath(`/teams/${teamId}/dues`);
}

/** 입금 대조로 "납부로 보이는" 팀원을 한꺼번에 최종 확인한다 (운영자만) */
export async function confirmMatchedPayments(
  teamId: string,
  itemId: string,
): Promise<void> {
  const user = await requireUser(`/teams/${teamId}/dues`);
  if (!UUID_PATTERN.test(teamId) || !UUID_PATTERN.test(itemId)) return;

  const db = await createServerDb();
  const [items, deposits, roster, confirmedRows] = await Promise.all([
    getDuesItems(teamId),
    getDuesDeposits(teamId),
    getRoster(teamId),
    db.from("dues_payments").select("user_id").eq("item_id", itemId),
  ]);
  const item = items.find((i) => i.id === itemId);
  if (!item) return;

  const result = reconcile(
    item.amount,
    roster.map((m) => ({ userId: m.user_id, nickname: m.nickname })),
    deposits.filter((d) => d.item_id === itemId).map((d) => ({ id: d.id, depositor: d.depositor, amount: d.amount })),
    new Set((confirmedRows.data ?? []).map((r) => r.user_id as string)),
  );
  if (result.toConfirm.length === 0) return;

  await db.from("dues_payments").upsert(
    result.toConfirm.map((userId) => ({
      item_id: itemId,
      team_id: teamId,
      user_id: userId,
      confirmed_by: user.id,
    })),
    { onConflict: "item_id,user_id", ignoreDuplicates: true },
  );
  revalidatePath(`/teams/${teamId}/dues`);
}

/** 회비 항목 삭제 (운영자만) */
export async function deleteDuesItem(teamId: string, itemId: string): Promise<void> {
  await requireUser(`/teams/${teamId}/dues`);
  if (!UUID_PATTERN.test(itemId)) return;
  const db = await createServerDb();
  await db.from("dues_items").delete().eq("id", itemId).eq("team_id", teamId);
  revalidatePath(`/teams/${teamId}/dues`);
}
