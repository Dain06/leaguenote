// Design Ref: §3.1 `/teams/[id]/dues` — 항목별 납부 현황. 운영자는 전체, 팀원은 본인 납부 여부만 본다. (PRD 7번)
import {
  confirmMatchedPayments,
  deleteDeposit,
  deleteDuesItem,
  setPaymentConfirmed,
} from "../actions";
import type { DuesDepositRow, DuesItem } from "../queries";
import { reconcile, type DepositStatus, type DuesMember } from "../reconcile";

import { DepositForm } from "./DuesForms";

const smallButton =
  "rounded-md border border-black/20 px-3 py-1 text-xs hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10";

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

const DEPOSIT_LABEL: Record<DepositStatus, string> = {
  matched: "납부로 보임",
  short: "금액 부족",
  unknown: "일치하는 팀원 없음",
  ambiguous: "닉네임이 같은 팀원이 여러 명",
};

export default function DuesItemCard({
  teamId,
  item,
  isOperator,
  myUserId,
  members,
  deposits,
  confirmed,
}: {
  teamId: string;
  item: DuesItem;
  isOperator: boolean;
  myUserId: string;
  members: DuesMember[];
  deposits: DuesDepositRow[];
  confirmed: Set<string>;
}) {
  const header = (
    <div>
      <h3 className="font-medium">{item.title}</h3>
      <p className="text-sm text-black/60 dark:text-white/60">
        {won(item.amount)} · 납부 기한 {item.due_on}
      </p>
    </div>
  );

  // 팀원: 본인 납부 여부만
  if (!isOperator) {
    const paid = confirmed.has(myUserId);
    return (
      <li className="rounded-lg border border-black/10 p-4 dark:border-white/15" data-testid="dues-item">
        {header}
        <p className="mt-2 text-sm" data-testid="my-dues-status">
          내 납부: {paid ? "확인됨" : "아직 확인되지 않았습니다"}
        </p>
      </li>
    );
  }

  const result = reconcile(
    item.amount,
    members,
    deposits.map((d) => ({ id: d.id, depositor: d.depositor, amount: d.amount })),
    confirmed,
  );
  const statusOf = new Map(result.deposits.map((d) => [d.depositId, d.status]));
  const paidCount = result.members.filter((m) => m.confirmed).length;

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/15" data-testid="dues-item">
      <div className="flex items-start justify-between gap-2">
        {header}
        <form action={deleteDuesItem.bind(null, teamId, item.id)}>
          <button type="submit" className={smallButton}>
            항목 삭제
          </button>
        </form>
      </div>

      <p className="text-sm" data-testid="dues-summary">
        납부 확인 <strong>{paidCount}명</strong> / 전체 {members.length}명 · 미납{" "}
        {result.unpaid.length}명
      </p>

      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-medium">입금 내역 ({deposits.length}건)</h4>
        {deposits.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm">
            {deposits.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>
                  {d.depositor} · {won(d.amount)}
                </span>
                <span className="text-xs text-black/60 dark:text-white/60">
                  {DEPOSIT_LABEL[statusOf.get(d.id) ?? "unknown"]}
                </span>
                <form action={deleteDeposit.bind(null, teamId, d.id)}>
                  <button type="submit" className={smallButton}>
                    삭제
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <DepositForm teamId={teamId} itemId={item.id} />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-medium">팀원별 납부</h4>
          {result.toConfirm.length > 0 && (
            <form action={confirmMatchedPayments.bind(null, teamId, item.id)}>
              <button type="submit" className={smallButton}>
                입금 대조로 {result.toConfirm.length}명 확인
              </button>
            </form>
          )}
        </div>
        <ul className="flex flex-col gap-1 text-sm" data-testid="dues-members">
          {result.members.map((m) => (
            <li key={m.userId} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-medium">{m.nickname}</span>
              <span className="text-black/60 dark:text-white/60">
                {m.confirmed
                  ? "납부 확인됨"
                  : m.looksPaid
                    ? "확인 대기 (입금 대조 일치)"
                    : m.deposited > 0
                      ? `미납 (입금 ${won(m.deposited)})`
                      : "미납"}
              </span>
              <form
                action={setPaymentConfirmed.bind(null, teamId, item.id, m.userId, !m.confirmed)}
              >
                <button type="submit" className={smallButton}>
                  {m.confirmed ? "확인 취소" : "납부 확인"}
                </button>
              </form>
            </li>
          ))}
        </ul>
        <p className="text-xs text-black/50 dark:text-white/50">
          입금 대조는 참고용입니다. 최종 납부 확인은 운영자가 직접 합니다.
        </p>
      </div>
    </li>
  );
}
