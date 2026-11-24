// 확인 메일 복귀 주소를 고정하는 SITE_URL 해석 시험 (headers()를 쓰는 siteOrigin 대신 순수 함수만 시험)
import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ headers: vi.fn() }));

import { configuredOrigin } from "@/features/auth/site";

describe("configuredOrigin", () => {
  it("올바른 https 주소는 origin만 돌려준다", () => {
    expect(configuredOrigin("https://leaguenote.vercel.app/")).toBe("https://leaguenote.vercel.app");
    expect(configuredOrigin("  https://leaguenote.vercel.app/path?x=1 ")).toBe("https://leaguenote.vercel.app");
  });

  it("로컬 http 주소도 허용한다", () => {
    expect(configuredOrigin("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("비었거나 잘못된 값, 다른 프로토콜은 null", () => {
    expect(configuredOrigin(undefined)).toBeNull();
    expect(configuredOrigin("")).toBeNull();
    expect(configuredOrigin("leaguenote.vercel.app")).toBeNull();
    expect(configuredOrigin("javascript:alert(1)")).toBeNull();
    expect(configuredOrigin("ftp://example.com")).toBeNull();
  });
});
