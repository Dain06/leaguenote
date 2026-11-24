"use client";

// 되돌리기 어려운 동작(내보내기, 나가기, 링크 끄기) 앞에서 한 번 더 확인을 받는 제출 버튼
import type { ReactNode } from "react";

export default function ConfirmSubmitButton({
  message,
  className,
  children,
}: {
  message: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
