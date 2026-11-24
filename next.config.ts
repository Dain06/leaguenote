import type { NextConfig } from "next";

// 모든 화면에 붙는 보안 헤더 (공개 전 보안 점검 반영)
const securityHeaders = [
  // 다른 사이트가 이 앱을 투명한 틀(iframe)로 덮어 버튼을 누르게 하는 공격(클릭재킹) 방지
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Content-Security-Policy",
    // 틀 삽입 금지, 이 사이트가 아닌 곳으로 폼 전송 금지, 플러그인 금지.
    // (스크립트 허용 범위 제한은 Next.js의 nonce 설정이 필요해 아직 넣지 않았다.)
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
  // 브라우저가 파일 종류를 멋대로 추측하지 않게 함
  { key: "X-Content-Type-Options", value: "nosniff" },
  // 다른 사이트로 이동할 때 주소 전체(초대 코드 등)를 알리지 않음
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // 쓰지 않는 기기 기능은 막아 둠
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // 한 번 https로 접속한 뒤에는 계속 https만 쓰게 함 (http로 접속하면 브라우저가 무시)
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
