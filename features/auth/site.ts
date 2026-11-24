// 이 앱의 주소(https://도메인). 확인 메일의 복귀 주소가 되므로 요청 헤더에 휘둘리지 않게
// 환경 변수 SITE_URL(예: https://leaguenote.vercel.app)이 있으면 그 값을 쓴다.
// 환경 변수가 없을 때(로컬 개발)만 프록시가 전달한 호스트 정보를 쓴다.
// 서버 액션 파일 밖에 둔다. ("use server" 파일의 내보내기는 브라우저에서 부를 수 있는 주소가 되기 때문)
import { headers } from "next/headers";

/** SITE_URL이 올바른 http(s) 주소면 그 origin을, 아니면 null */
export function configuredOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export async function siteOrigin(): Promise<string> {
  const fixed = configuredOrigin(process.env.SITE_URL);
  if (fixed) return fixed;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
