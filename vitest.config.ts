import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@nearpay-money/js": fileURLToPath(new URL("./packages/js/src/index.ts", import.meta.url)) } },
  esbuild: { jsx: "automatic" },
  test: {
    include: ["test/unit/**/*.test.{ts,tsx}"],
    environment: "happy-dom",
    // happy-dom reports every (deliberately disabled) frame load; the frame side is covered by Playwright.
    onConsoleLog: (log) => !log.includes("Iframe page loading is disabled"),
    environmentOptions: { happyDOM: { settings: { disableIframePageLoading: true } } },
    coverage: {
      provider: "v8",
      include: ["packages/js/src/**/*.ts", "packages/react/src/**/*.tsx"],
      reporter: ["text", "json-summary"],
      thresholds: { branches: 90, lines: 90 },
    },
  },
});
