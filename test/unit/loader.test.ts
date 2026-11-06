import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ClientSecretHeaders, idPattern, PublicCheckoutSession } from "@nearpay/spec";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CLIENT_SECRET_RE,
  DEFAULT_PAY_ORIGIN,
  mountCheckout,
  NearPay,
  NearPayError,
  normalizePayOrigin,
  payOriginFromScript,
  READY_TIMEOUT_MS,
  SESSION_ID_RE,
} from "../../packages/js/src/index";
import {
  IFRAME_ALLOW,
  IFRAME_SANDBOX,
  INIT_MAX_TRIES,
  INIT_RETRY_MS,
  initMessage,
  PROTOCOL_VERSION,
  parseParentMessage,
  TO_PARENT,
  toWireAppearance,
} from "../../packages/js/src/protocol";

const PK = `pk_test_${"a".repeat(48)}`;
const SID = "cs_01jbz9k3m4n5p6q7r8s9t0v1w2";
const SECRET = `${SID}_secret_${"B".repeat(32)}`;
const PAY = "https://pay.nearpay.localhost";

/** happy-dom does not load frames: give the iframe a stand-in contentWindow. */
function fakeFrame(iframe: HTMLIFrameElement) {
  const win = { postMessage: vi.fn() };
  Object.defineProperty(iframe, "contentWindow", { value: win, configurable: true });
  return win;
}

function post(iframe: HTMLIFrameElement, data: unknown, origin = PAY, source: unknown = iframe.contentWindow) {
  window.dispatchEvent(new MessageEvent("message", { data, origin, source: source as Window }));
}

describe("protocol v1 catalogue", () => {
  it("matches protocol/v1.json", () => {
    const cat = JSON.parse(readFileSync(join(process.cwd(), "protocol/v1.json"), "utf8"));
    expect(cat.version).toBe(PROTOCOL_VERSION);
    expect(cat.toParent).toEqual(TO_PARENT);
    expect(cat.iframe.sandbox).toBe(IFRAME_SANDBOX);
    expect(cat.iframe.allow).toBe(IFRAME_ALLOW);
    expect([cat.initRetryMs, cat.initMaxTries]).toEqual([INIT_RETRY_MS, INIT_MAX_TRIES]);
  });

  it("id and secret formats agree with @nearpay/spec", () => {
    expect(SESSION_ID_RE.source).toBe(idPattern("cs").source);
    const spec = ClientSecretHeaders.shape["x-nearpay-client-secret"];
    for (const s of [SECRET, `${SID}_secret_short`, "cs_x_secret_y"])
      expect(CLIENT_SECRET_RE.test(s)).toBe(spec.safeParse(s).success);
  });

  it("np:complete's payment_intent_id comes from a required pi_ id on the public session (spec 0.1.5)", () => {
    const pi = PublicCheckoutSession.shape.payment_intent;
    expect(pi.safeParse("pi_01jbz9k3m4n5p6q7r8s9t0v1w2").success).toBe(true);
    expect(pi.safeParse(undefined).success).toBe(false);
    expect(pi.safeParse(null).success).toBe(false);
    const msg = parseParentMessage({
      type: "np:complete",
      v: 1,
      session_id: SID,
      payment_intent_id: "pi_01jbz9k3m4n5p6q7r8s9t0v1w2",
    });
    expect(msg).toEqual({ type: "np:complete", session_id: SID, payment_intent_id: "pi_01jbz9k3m4n5p6q7r8s9t0v1w2" });
  });

  it("parses iframe messages strictly", () => {
    expect(parseParentMessage({ type: "np:ready", v: 1 })).toEqual({ type: "np:ready" });
    expect(parseParentMessage({ type: "np:ready", v: 2 })).toBeNull();
    expect(parseParentMessage({ type: "np:resize", v: 1, height: "9" })).toBeNull();
    expect(parseParentMessage({ type: "np:complete", v: 1 })).toBeNull();
    expect(parseParentMessage({ type: "np:complete", v: 1, session_id: SID })).toEqual({
      type: "np:complete",
      session_id: SID,
      payment_intent_id: null,
    });
    expect(parseParentMessage({ type: "np:error", v: 1 })).toEqual({ type: "np:error", code: "unknown", message: "" });
    expect(parseParentMessage({ type: "np:close", v: 1 })).toEqual({ type: "np:close" });
    expect(parseParentMessage({ type: "np:init", v: 1 })).toBeNull();
    expect(parseParentMessage("np:ready")).toBeNull();
    expect(parseParentMessage(null)).toBeNull();
  });

  it("sanitises appearance", () => {
    expect(toWireAppearance(undefined)).toEqual({ theme: "auto", accent: null, radius: null });
    expect(toWireAppearance({ theme: "dark", accent: "#0af", radius: 7.6 })).toEqual({
      theme: "dark",
      accent: "#0af",
      radius: 8,
    });
    expect(toWireAppearance({ theme: "x" as never, accent: "red", radius: 99 })).toEqual({
      theme: "auto",
      accent: null,
      radius: null,
    });
    expect(initMessage({ theme: "light" }, "de")).toEqual({
      type: "np:init",
      v: 1,
      appearance: { theme: "light", accent: null, radius: null },
      locale: "de",
    });
  });
});

describe("NearPay()", () => {
  it("validates the publishable key", () => {
    expect(NearPay(PK).livemode).toBe(false);
    expect(NearPay(`pk_live_${"Z".repeat(48)}`).livemode).toBe(true);
    expect(NearPay(PK).payOrigin).toBe(DEFAULT_PAY_ORIGIN);
    expect(() => NearPay(`sk_test_${"a".repeat(48)}`)).toThrow(/Never use a secret/);
    expect(() => NearPay(`rk_live_${"a".repeat(48)}`)).toThrow(/Never use a secret/);
    expect(() => NearPay("pk_test_short")).toThrow(NearPayError);
    expect(() => NearPay(undefined as unknown as string)).toThrow(NearPayError);
  });

  it("validates the checkout origin", () => {
    expect(normalizePayOrigin("https://pay.nearpay.money/")).toBe("https://pay.nearpay.money");
    expect(normalizePayOrigin("http://localhost:5173")).toBe("http://localhost:5173");
    expect(normalizePayOrigin("http://pay.nearpay.localhost")).toBe("http://pay.nearpay.localhost");
    expect(() => normalizePayOrigin("http://pay.example.com")).toThrow(/https/);
    expect(() => normalizePayOrigin("https://pay.example.com/x")).toThrow(/bare origin/);
    expect(() => normalizePayOrigin("nope")).toThrow(/origin/);
  });

  it("derives pay.<domain> from the loader's js.<domain> URL", () => {
    expect(payOriginFromScript("https://js.nearpay.money/v1/nearpay.js")).toBe("https://pay.nearpay.money");
    expect(payOriginFromScript("https://js.nearpay.localhost:8443/v1/nearpay.js")).toBe(
      "https://pay.nearpay.localhost:8443",
    );
    expect(payOriginFromScript("https://cdn.example.com/nearpay.js")).toBeNull();
    expect(payOriginFromScript("http://js.example.com/v1/nearpay.js")).toBeNull();
    expect(payOriginFromScript(null)).toBeNull();
    expect(payOriginFromScript("::")).toBeNull();
  });
});

describe("mountCheckout", () => {
  let el: HTMLDivElement;
  beforeEach(() => {
    vi.useFakeTimers();
    el = document.createElement("div");
    el.id = "pay";
    document.body.append(el);
  });
  afterEach(() => {
    vi.useRealTimers();
    el.remove();
  });

  it("validates its inputs", () => {
    expect(() => mountCheckout(PAY, { sessionId: "cs_x", clientSecret: SECRET, element: el })).toThrow(/sessionId/);
    expect(() => mountCheckout(PAY, { sessionId: SID, clientSecret: "nope", element: el })).toThrow(/clientSecret/);
    expect(() =>
      mountCheckout(PAY, {
        sessionId: SID,
        clientSecret: `cs_01jbz9k3m4n5p6q7r8s9t0v1w3_secret_${"B".repeat(32)}`,
        element: el,
      }),
    ).toThrow(/clientSecret/);
    expect(() => mountCheckout(PAY, { sessionId: SID, clientSecret: SECRET, element: "#missing" })).toThrow(
      /no element/,
    );
  });

  it("creates the sandboxed iframe with the secret in the fragment", () => {
    const h = NearPay(PK, { payOrigin: PAY }).mountCheckout({ sessionId: SID, clientSecret: SECRET, element: "#pay" });
    expect(h.iframe.parentElement).toBe(el);
    expect(h.iframe.getAttribute("src")).toBe(`${PAY}/embed/${SID}#${SECRET}`);
    expect(h.iframe.getAttribute("sandbox")).toBe(IFRAME_SANDBOX);
    expect(h.iframe.getAttribute("allow")).toBe("clipboard-write");
    h.destroy();
    h.destroy();
    expect(el.children.length).toBe(0);
  });

  it("speaks the protocol only with the checkout frame", () => {
    const onReady = vi.fn();
    const onComplete = vi.fn();
    const onError = vi.fn();
    const onClose = vi.fn();
    const h = mountCheckout(PAY, {
      sessionId: SID,
      clientSecret: SECRET,
      element: el,
      appearance: { accent: "#123456" },
      onReady,
      onComplete,
      onError,
      onClose,
    });
    const sent: { data: unknown; origin: string }[] = [];
    fakeFrame(h.iframe).postMessage.mockImplementation((data: unknown, origin: string) => sent.push({ data, origin }));
    h.iframe.dispatchEvent(new Event("load"));
    vi.advanceTimersByTime(INIT_RETRY_MS * 3);
    expect(sent.length).toBe(4);
    expect(sent[0]).toEqual({ data: initMessage({ accent: "#123456" }, undefined), origin: PAY });

    // Wrong origin, wrong source, wrong version: ignored.
    post(h.iframe, { type: "np:ready", v: 1 }, "https://evil.example");
    post(h.iframe, { type: "np:ready", v: 1 }, PAY, window);
    post(h.iframe, { type: "np:ready", v: 9 });
    expect(onReady).not.toHaveBeenCalled();
    post(h.iframe, { type: "np:ready", v: 1 });
    post(h.iframe, { type: "np:ready", v: 1 });
    expect(onReady).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(INIT_RETRY_MS * 5);
    expect(sent.length).toBe(4); // retries stop at np:ready

    post(h.iframe, { type: "np:resize", v: 1, height: 612.4 });
    expect(h.iframe.style.height).toBe("612px");
    post(h.iframe, { type: "np:resize", v: 1, height: 10 });
    expect(h.iframe.style.height).toBe("120px");
    post(h.iframe, { type: "np:resize", v: 1, height: 1e9 });
    expect(h.iframe.style.height).toBe("4000px");

    post(h.iframe, {
      type: "np:complete",
      v: 1,
      session_id: "cs_01jbz9k3m4n5p6q7r8s9t0v1w3",
      payment_intent_id: "pi_1",
    });
    expect(onComplete).not.toHaveBeenCalled();
    post(h.iframe, { type: "np:complete", v: 1, session_id: SID, payment_intent_id: "pi_01jbz9k3m4n5p6q7r8s9t0v1w2" });
    post(h.iframe, { type: "np:complete", v: 1, session_id: SID, payment_intent_id: "pi_01jbz9k3m4n5p6q7r8s9t0v1w2" });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({ sessionId: SID, paymentIntentId: "pi_01jbz9k3m4n5p6q7r8s9t0v1w2" });

    post(h.iframe, { type: "np:error", v: 1, code: "geo_blocked", message: "no" });
    expect(onError).toHaveBeenCalledWith({ code: "geo_blocked", message: "no" });
    post(h.iframe, { type: "np:close", v: 1 });
    expect(onClose).toHaveBeenCalledTimes(1);

    h.destroy();
    post(h.iframe, { type: "np:close", v: 1 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stops retrying init after the maximum and reports a load timeout", () => {
    const onError = vi.fn();
    const h = mountCheckout(PAY, { sessionId: SID, clientSecret: SECRET, element: el, onError });
    const spy = fakeFrame(h.iframe).postMessage;
    h.iframe.dispatchEvent(new Event("load"));
    vi.advanceTimersByTime(INIT_RETRY_MS * (INIT_MAX_TRIES + 10));
    expect(spy).toHaveBeenCalledTimes(INIT_MAX_TRIES);
    vi.advanceTimersByTime(READY_TIMEOUT_MS);
    expect(onError).toHaveBeenCalledWith({ code: "load_timeout", message: "The checkout did not load." });
    h.destroy();
  });

  it("isolates merchant callback exceptions", () => {
    const h = mountCheckout(PAY, {
      sessionId: SID,
      clientSecret: SECRET,
      element: el,
      onReady: () => {
        throw new Error("merchant bug");
      },
      onClose: vi.fn(),
    });
    fakeFrame(h.iframe);
    expect(() => post(h.iframe, { type: "np:ready", v: 1 })).not.toThrow();
    expect(() => vi.runOnlyPendingTimers()).toThrow("merchant bug");
    h.destroy();
  });
});
