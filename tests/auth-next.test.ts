import { describe, expect, it } from "vitest";

import { safeNextPath } from "@/features/auth/next";

describe("로그인 후 이동 주소 검사", () => {
  it("이 사이트 안의 주소는 그대로 허용", () => {
    expect(safeNextPath("/")).toBe("/");
    expect(safeNextPath("/tournaments/abc")).toBe("/tournaments/abc");
    expect(safeNextPath("/events/1?tab=2#x")).toBe("/events/1?tab=2#x");
  });

  it("다른 사이트로 가는 주소는 홈으로 바꾼다", () => {
    for (const bad of [
      "//evil.com",
      "https://evil.com",
      "http://evil.com/x",
      "evil.com",
      "/\\evil.com",
      "javascript:alert(1)",
    ]) {
      expect(safeNextPath(bad)).toBe("/");
    }
  });

  it("보이지 않는 문자를 끼운 우회도 막는다 (탭·줄바꿈·공백·제어 문자)", () => {
    for (const bad of [
      "/\t/evil.com",
      "/\n/evil.com",
      "/\r/evil.com",
      "/ /evil.com",
      "/\u0000/evil.com",
      "/" + String.fromCharCode(0xa0) + "/evil.com", // 줄 바꿈 없는 공백(NBSP)
      "/" + String.fromCharCode(0x2028) + "/evil.com", // 줄 구분 문자
      "/ok\t",
    ]) {
      expect(safeNextPath(bad)).toBe("/");
    }
  });

  it("문자열이 아니면 홈", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath(123)).toBe("/");
  });
});
