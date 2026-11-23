// Design Ref: §4.3 회비 정산 — 운영자가 입력한 입금 내역(입금자 닉네임·금액)을 회비 항목과 대조한다. (AI 미사용, 최종 확인은 운영자)
// 저장소를 쓰지 않는 순수 계산이라 Vitest로 규칙을 시험한다.

export type DuesMember = { userId: string; nickname: string };
export type DuesDeposit = { id: string; depositor: string; amount: number };

/** 입금 한 건의 대조 결과 */
export type DepositStatus =
  /** 닉네임이 한 팀원과 일치하고, 그 팀원의 입금 합계가 항목 금액 이상 */
  | "matched"
  /** 닉네임은 일치하지만 그 팀원의 입금 합계가 항목 금액보다 적음 */
  | "short"
  /** 일치하는 팀원이 없음 */
  | "unknown"
  /** 같은 닉네임의 팀원이 둘 이상이라 가릴 수 없음 */
  | "ambiguous";

export type DepositResult = {
  depositId: string;
  status: DepositStatus;
  userId: string | null;
};

export type MemberDues = {
  userId: string;
  nickname: string;
  /** 대조된 입금 합계 */
  deposited: number;
  /** 입금 합계가 항목 금액 이상이라 "납부로 보이는" 상태 */
  looksPaid: boolean;
  /** 운영자가 최종 확인함 */
  confirmed: boolean;
};

export type Reconciliation = {
  deposits: DepositResult[];
  members: MemberDues[];
  /** 대조상 납부로 보이지만 아직 운영자가 확인하지 않은 팀원 (확인 대기) */
  toConfirm: string[];
  /** 최종 확인이 없는 팀원 = 미납자 */
  unpaid: string[];
};

/** 닉네임 비교용: 앞뒤·중복 공백을 정리하고 소문자로 바꾼다. */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function reconcile(
  itemAmount: number,
  members: DuesMember[],
  deposits: DuesDeposit[],
  confirmedUserIds: Set<string>,
): Reconciliation {
  const byName = new Map<string, DuesMember[]>();
  for (const m of members) {
    const key = normalizeName(m.nickname);
    byName.set(key, [...(byName.get(key) ?? []), m]);
  }

  // 1) 입금자 닉네임으로 팀원을 찾아 팀원별 입금 합계를 낸다.
  const totals = new Map<string, number>();
  const attributed = deposits.map((d) => {
    const found = byName.get(normalizeName(d.depositor)) ?? [];
    if (found.length === 1) {
      totals.set(found[0].userId, (totals.get(found[0].userId) ?? 0) + d.amount);
      return { deposit: d, status: null, userId: found[0].userId as string | null };
    }
    return {
      deposit: d,
      status: (found.length === 0 ? "unknown" : "ambiguous") as DepositStatus,
      userId: null as string | null,
    };
  });

  // 2) 팀원별로 "납부로 보이는지"를 정하고, 입금 한 건의 결과를 낸다.
  const depositResults: DepositResult[] = attributed.map((a) => ({
    depositId: a.deposit.id,
    userId: a.userId,
    status:
      a.status ??
      ((totals.get(a.userId as string) ?? 0) >= itemAmount ? "matched" : "short"),
  }));

  const memberRows: MemberDues[] = members.map((m) => {
    const deposited = totals.get(m.userId) ?? 0;
    return {
      userId: m.userId,
      nickname: m.nickname,
      deposited,
      looksPaid: deposited >= itemAmount,
      confirmed: confirmedUserIds.has(m.userId),
    };
  });

  return {
    deposits: depositResults,
    members: memberRows,
    toConfirm: memberRows.filter((m) => m.looksPaid && !m.confirmed).map((m) => m.userId),
    unpaid: memberRows.filter((m) => !m.confirmed).map((m) => m.userId),
  };
}
