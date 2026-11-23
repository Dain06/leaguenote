import { describe, expect, it } from "vitest";

import { normalizeName, reconcile } from "@/features/dues/reconcile";

const members = [
  { userId: "u1", nickname: "철수" },
  { userId: "u2", nickname: "Younghee" },
  { userId: "u3", nickname: "민수" },
];

describe("회비 입금 대조", () => {
  it("이름 비교는 공백·대소문자를 정리한다", () => {
    expect(normalizeName("  Young   Hee ")).toBe("young hee");
  });

  it("닉네임이 일치하고 금액이 충분하면 '납부로 보임'(확인 대기)", () => {
    const r = reconcile(30000, members, [{ id: "d1", depositor: "철수", amount: 30000 }], new Set());
    expect(r.deposits[0]).toEqual({ depositId: "d1", status: "matched", userId: "u1" });
    expect(r.toConfirm).toEqual(["u1"]);
    expect(r.unpaid).toEqual(["u1", "u2", "u3"]); // 운영자가 확인하기 전에는 모두 미납
  });

  it("금액이 모자라면 '부족'이고 납부로 보지 않는다", () => {
    const r = reconcile(30000, members, [{ id: "d1", depositor: "철수", amount: 20000 }], new Set());
    expect(r.deposits[0].status).toBe("short");
    expect(r.toConfirm).toEqual([]);
  });

  it("같은 사람의 입금이 나뉘어 있어도 합계로 판단한다", () => {
    const r = reconcile(
      30000,
      members,
      [
        { id: "d1", depositor: "철수", amount: 10000 },
        { id: "d2", depositor: "철수", amount: 20000 },
      ],
      new Set(),
    );
    expect(r.deposits.map((d) => d.status)).toEqual(["matched", "matched"]);
    expect(r.members[0].deposited).toBe(30000);
  });

  it("금액이 더 많아도 납부로 본다", () => {
    const r = reconcile(30000, members, [{ id: "d1", depositor: "민수", amount: 50000 }], new Set());
    expect(r.toConfirm).toEqual(["u3"]);
  });

  it("공백·대소문자가 달라도 같은 닉네임으로 본다", () => {
    const r = reconcile(10000, members, [{ id: "d1", depositor: " younghee ", amount: 10000 }], new Set());
    expect(r.deposits[0]).toEqual({ depositId: "d1", status: "matched", userId: "u2" });
  });

  it("일치하는 팀원이 없으면 '알 수 없음'", () => {
    const r = reconcile(10000, members, [{ id: "d1", depositor: "모르는사람", amount: 10000 }], new Set());
    expect(r.deposits[0]).toEqual({ depositId: "d1", status: "unknown", userId: null });
    expect(r.toConfirm).toEqual([]);
  });

  it("닉네임이 같은 팀원이 둘이면 '모호'로 두고 운영자가 직접 확인한다", () => {
    const twins = [...members, { userId: "u4", nickname: "철수" }];
    const r = reconcile(10000, twins, [{ id: "d1", depositor: "철수", amount: 10000 }], new Set());
    expect(r.deposits[0].status).toBe("ambiguous");
    expect(r.toConfirm).toEqual([]);
  });

  it("운영자가 확인한 팀원은 미납에서 빠진다 (입금 내역과 상관없이)", () => {
    const r = reconcile(30000, members, [], new Set(["u2"]));
    expect(r.unpaid).toEqual(["u1", "u3"]);
    expect(r.members.find((m) => m.userId === "u2")?.confirmed).toBe(true);
    expect(r.toConfirm).toEqual([]);
  });

  it("이미 확인한 팀원은 확인 대기에 다시 나오지 않는다", () => {
    const r = reconcile(10000, members, [{ id: "d1", depositor: "철수", amount: 10000 }], new Set(["u1"]));
    expect(r.toConfirm).toEqual([]);
    expect(r.unpaid).toEqual(["u2", "u3"]);
  });
});
