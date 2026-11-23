"use client";

// Design Ref: §3.1 `/teams/[id]` 팀 홈 — 초대 링크 보여 주기와 복사
import { useState } from "react";

export default function CopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  // 브라우저에서만 전체 주소(도메인 포함)를 만들 수 있어서, 처음에는 경로만 보여 준다.
  const [origin] = useState(() =>
    typeof window === "undefined" ? "" : window.location.origin,
  );
  const fullUrl = `${origin}${path}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 복사 권한이 없으면 링크를 직접 선택해 복사하도록 둔다.
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        readOnly
        value={fullUrl}
        aria-label="초대 링크"
        data-testid="invite-link"
        onFocus={(event) => event.currentTarget.select()}
        className="min-w-0 flex-1 rounded-md border border-black/20 bg-transparent px-3 py-2 text-sm dark:border-white/25"
      />
      <button
        type="button"
        onClick={copy}
        className="rounded-md border border-black/20 px-3 py-2 text-sm hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
      >
        {copied ? "복사됨" : "복사"}
      </button>
    </div>
  );
}
