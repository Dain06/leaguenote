// 시간 처리 도구 — 이 서비스는 한국 시간(KST, UTC+9) 기준으로 입력받고 보여 준다.
// 서버는 다른 시간대(예: Vercel은 UTC)에서 돌 수 있으므로 한국 시간을 직접 지정한다.

const KST_OFFSET = "+09:00";

const kstFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** 입력칸(datetime-local)의 "2026-11-30T19:00"을 한국 시간으로 보고 Date로 바꾼다. 형식이 틀리면 null */
export function parseKstLocal(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00${KST_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** 화면에 보여 줄 한국 시간 문구. 예: "11월 30일 (일) 19:00" */
export function formatKst(value: string | Date): string {
  return kstFormatter.format(new Date(value));
}
