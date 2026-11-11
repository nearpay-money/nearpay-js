import { expect, type Page, test } from "@playwright/test";
import { PI, SECRET, Servers, SID } from "./support/servers";

const servers = new Servers();
test.beforeAll(async () => servers.start());
test.afterAll(async () => servers.stop());

const events = (page: Page) => page.evaluate(() => (window as unknown as { __events: unknown[] }).__events);
const checkoutFrame = (page: Page) => page.frames().find((f) => f.url().includes("/embed/"));

test("the SRI-pinned loader derives pay.<domain>, mounts the iframe and speaks protocol v1", async ({ page }) => {
  await page.goto(`${servers.merchantOrigin}/page/loader`);
  await page.evaluate(
    () =>
      ((window as unknown as { __checkout: unknown; __mount: () => unknown }).__checkout = (
        window as unknown as { __mount: () => unknown }
      ).__mount()),
  );
  const iframe = page.locator("#pay iframe");
  await expect(iframe).toHaveAttribute("src", `${servers.payOrigin}/embed/${SID}#${SECRET}`);
  await expect(iframe).toHaveAttribute("sandbox", "allow-scripts allow-same-origin allow-popups allow-forms");
  await expect(iframe).toHaveAttribute("allow", "clipboard-write");
  await expect.poll(() => events(page)).toEqual([["ready"]]);
  await expect(iframe).toHaveCSS("height", "640px");

  const frame = checkoutFrame(page);
  const inits =
    (await frame?.evaluate(
      () => (window as unknown as { __inits: { data: unknown; origin: string; hash: string }[] }).__inits,
    )) ?? [];
  expect(inits[0]).toEqual({
    data: { type: "np:init", v: 1, appearance: { theme: "dark", accent: "#ff5500", radius: 4 }, locale: "en" },
    origin: servers.merchantOrigin,
    hash: `#${SECRET}`,
  });

  await frame?.click("#complete");
  await frame?.click("#error");
  await frame?.click("#close");
  await expect
    .poll(() => events(page))
    .toEqual([
      ["ready"],
      ["complete", { sessionId: SID, paymentIntentId: PI }],
      ["error", { code: "session_expired", message: "expired" }],
      ["close"],
    ]);

  await page.evaluate(() => (window as unknown as { __checkout: { destroy(): void } }).__checkout.destroy());
  await expect(page.locator("#pay iframe")).toHaveCount(0);
});

test("messages from other frames and from the page itself are ignored", async ({ page }) => {
  await page.goto(`${servers.merchantOrigin}/page/loader`);
  await page.evaluate(() => {
    const w = window as unknown as { __mount: () => unknown; __rogue: () => void };
    w.__mount();
  });
  await expect.poll(() => events(page)).toEqual([["ready"]]);
  await page.evaluate(() => {
    window.postMessage(
      { type: "np:complete", v: 1, session_id: "cs_01jbz9k3m4n5p6q7r8s9t0v1w2", payment_intent_id: "pi_self" },
      "*",
    );
    (window as unknown as { __rogue: () => void }).__rogue();
  });
  await page.waitForTimeout(800);
  expect(await events(page)).toEqual([["ready"]]);
});

test("a tampered loader is refused by Subresource Integrity", async ({ page }) => {
  await page.goto(`${servers.merchantOrigin}/page/loader?sri=bad`);
  expect(await page.evaluate(() => typeof (window as unknown as { NearPay?: unknown }).NearPay)).toBe("undefined");
});

test("the loader rejects secret keys and malformed sessions", async ({ page }) => {
  await page.goto(`${servers.merchantOrigin}/page/loader`);
  const err = await page.evaluate(() => {
    const NP = (window as unknown as { NearPay: (k: string) => { mountCheckout(o: object): unknown } }).NearPay;
    const out: string[] = [];
    try {
      NP(`sk_test_${"a".repeat(48)}`);
    } catch (e) {
      out.push((e as Error).message);
    }
    try {
      NP(`pk_test_${"a".repeat(48)}`).mountCheckout({ sessionId: "cs_bad", clientSecret: "x", element: "#pay" });
    } catch (e) {
      out.push((e as Error).message);
    }
    return out;
  });
  expect(err[0]).toMatch(/Never use a secret/);
  expect(err[1]).toMatch(/sessionId/);
  await expect(page.locator("#pay iframe")).toHaveCount(0);
});

test("an explicit payOrigin wins over the derived one", async ({ page }) => {
  await page.goto(`${servers.merchantOrigin}/page/loader`);
  await page.evaluate(() =>
    (window as unknown as { __mount: (o: object) => unknown }).__mount({ payOrigin: "https://pay.example.com" }),
  );
  await expect(page.locator("#pay iframe")).toHaveAttribute("src", /^https:\/\/pay\.example\.com\/embed\//);
});

test("@nearpay-money/react mounts the checkout and reports completion", async ({ page }) => {
  await page.goto(`${servers.merchantOrigin}/page/react`);
  await expect(page.locator("[data-nearpay-checkout] iframe")).toHaveAttribute(
    "src",
    `${servers.payOrigin}/embed/${SID}#${SECRET}`,
  );
  await expect.poll(() => events(page)).toEqual([["ready"]]);
  await checkoutFrame(page)?.click("#complete");
  await expect.poll(() => events(page)).toEqual([["ready"], ["complete", { sessionId: SID, paymentIntentId: PI }]]);
});
