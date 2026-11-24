// 이 앱의 주소(https://도메인). 프록시 뒤(Vercel 등)에서도 맞도록 전달된 호스트 정보를 우선 쓴다.
// 서버 액션 파일 밖에 둔다. ("use server" 파일의 내보내기는 브라우저에서 부를 수 있는 주소가 되기 때문)
import { headers } from "next/headers";

export async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
