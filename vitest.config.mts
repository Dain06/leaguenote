import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// 규칙 시험용 설정: "@/..." 주소를 앱과 같게 읽도록 맞춘다.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: { include: ["tests/**/*.test.ts"] },
});
