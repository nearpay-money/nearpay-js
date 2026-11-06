import { defineConfig } from "@playwright/test";

// Browser tests of the built loader (dist/v1/nearpay.js) and @nearpay/react against a fake checkout
// frame on another origin. System Chrome only; run `pnpm build` first (pnpm verify does).
export default defineConfig({
  testDir: "test/e2e",
  testMatch: "**/*.spec.ts",
  workers: 1,
  timeout: 20_000,
  expect: { timeout: 5_000 },
  reporter: [["list"]],
  use: {
    browserName: "chromium",
    launchOptions: { executablePath: process.env.NP_CHROME ?? "/usr/bin/google-chrome", args: ["--no-sandbox"] },
  },
});
