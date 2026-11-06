/**
 * @nearpay/js — mounts the NearPay embedded checkout (lld/checkout-and-js.md §6, ADR-0010).
 *
 *   const np = NearPay("pk_test_…");
 *   const checkout = np.mountCheckout({ sessionId, clientSecret, element: "#pay", onComplete });
 *   checkout.destroy();
 *
 * Deposit addresses, amounts and wallet interactions stay inside the checkout iframe; the merchant page
 * only learns ready / resize / complete / error / close through the origin-checked protocol.
 */
import {
  type Appearance,
  IFRAME_ALLOW,
  IFRAME_SANDBOX,
  INIT_MAX_TRIES,
  INIT_RETRY_MS,
  initMessage,
  parseParentMessage,
} from "./protocol.js";

export type { Appearance } from "./protocol.js";
export { PROTOCOL_VERSION } from "./protocol.js";

export const DEFAULT_PAY_ORIGIN = "https://pay.nearpay.money";
export const PUBLISHABLE_KEY_RE = /^pk_(live|test)_[0-9A-Za-z]{48}$/;
/** `cs_` + TypeID suffix (spec `idPattern("cs")`). */
export const SESSION_ID_RE = /^cs_[0-7][0123456789abcdefghjkmnpqrstvwxyz]{25}$/;
/** Spec `ClientSecretHeaders`; the secret embeds its session id. */
export const CLIENT_SECRET_RE = /^(cs_[0-9a-z]{26})_secret_[0-9A-Za-z]{32}$/;
const MIN_HEIGHT = 120;
const MAX_HEIGHT = 4000;
export const READY_TIMEOUT_MS = 15_000;

export interface NearPayOptions {
  /** Origin of the checkout (`https://pay.<domain>`). Defaults to `https://pay.nearpay.money`. */
  readonly payOrigin?: string;
}

export interface CheckoutError {
  readonly code: string;
  readonly message: string;
}

export interface CompleteResult {
  readonly sessionId: string;
  /**
   * `pi_…` of the session (`PublicCheckoutSession.payment_intent`, spec 0.1.5): known as soon as the
   * session completes, also when the checkout only polled. `null` only from checkouts before spec 0.1.5.
   */
  readonly paymentIntentId: string | null;
}

export interface MountCheckoutOptions {
  readonly sessionId: string;
  readonly clientSecret: string;
  /** Container element or a CSS selector. */
  readonly element: HTMLElement | string;
  readonly appearance?: Appearance;
  readonly locale?: string;
  readonly onComplete?: (r: CompleteResult) => void;
  readonly onError?: (e: CheckoutError) => void;
  readonly onReady?: () => void;
  readonly onClose?: () => void;
}

export interface CheckoutHandle {
  readonly iframe: HTMLIFrameElement;
  destroy(): void;
}

export interface NearPayInstance {
  readonly publishableKey: string;
  readonly livemode: boolean;
  readonly payOrigin: string;
  mountCheckout(o: MountCheckoutOptions): CheckoutHandle;
}

export class NearPayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NearPayError";
  }
}

/** Validates and canonicalises a checkout origin (https, or http on localhost for development). */
export function normalizePayOrigin(origin: string): string {
  let u: URL;
  try {
    u = new URL(origin);
  } catch {
    throw new NearPayError(`payOrigin must be an origin like https://pay.nearpay.money, got ${origin}`);
  }
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname) || u.hostname.endsWith(".localhost");
  if (u.protocol !== "https:" && !(u.protocol === "http:" && local)) throw new NearPayError("payOrigin must use https");
  if (u.pathname !== "/" || u.search || u.hash || u.username) throw new NearPayError("payOrigin must be a bare origin");
  return u.origin;
}

/** `https://js.<domain>[:port]/v1/nearpay.js` → `https://pay.<domain>[:port]`; null when not a js. host. */
export function payOriginFromScript(src: string | null | undefined): string | null {
  if (!src) return null;
  try {
    const u = new URL(src);
    if (!u.hostname.startsWith("js.")) return null;
    u.hostname = `pay.${u.hostname.slice(3)}`;
    return normalizePayOrigin(u.origin);
  } catch {
    return null;
  }
}

function resolveElement(el: HTMLElement | string, doc: Document): HTMLElement {
  if (typeof el !== "string") return el;
  const found = doc.querySelector(el);
  if (!(found instanceof HTMLElement)) throw new NearPayError(`no element matches ${el}`);
  return found;
}

/** Calls a merchant callback without letting its exceptions break the protocol handling. */
function safely<A extends unknown[]>(fn: ((...a: A) => void) | undefined, ...args: A): void {
  try {
    fn?.(...args);
  } catch (e) {
    setTimeout(() => {
      throw e;
    }, 0);
  }
}

export function mountCheckout(payOrigin: string, o: MountCheckoutOptions, win: Window = window): CheckoutHandle {
  if (!SESSION_ID_RE.test(o.sessionId)) throw new NearPayError("sessionId must be a checkout session id (cs_…)");
  const m = CLIENT_SECRET_RE.exec(o.clientSecret);
  if (!m || m[1] !== o.sessionId) throw new NearPayError("clientSecret does not belong to this checkout session");
  const doc = win.document;
  const container = resolveElement(o.element, doc);

  const iframe = doc.createElement("iframe");
  iframe.src = `${payOrigin}/embed/${encodeURIComponent(o.sessionId)}#${o.clientSecret}`;
  iframe.setAttribute("sandbox", IFRAME_SANDBOX);
  iframe.setAttribute("allow", IFRAME_ALLOW);
  iframe.setAttribute("title", "NearPay checkout");
  iframe.setAttribute("data-nearpay", "checkout");
  iframe.style.width = "100%";
  iframe.style.border = "0";
  iframe.style.colorScheme = "normal";
  iframe.style.height = "480px";

  const init = initMessage(o.appearance, o.locale);
  let ready = false;
  let completed = false;
  let destroyed = false;
  let tries = 0;
  let retry: ReturnType<typeof setInterval> | null = null;
  const readyTimer = setTimeout(() => {
    if (!ready && !destroyed) safely(o.onError, { code: "load_timeout", message: "The checkout did not load." });
  }, READY_TIMEOUT_MS);

  const sendInit = () => {
    if (ready || destroyed || !iframe.contentWindow) return;
    tries++;
    iframe.contentWindow.postMessage(init, payOrigin);
    if (tries >= INIT_MAX_TRIES && retry) clearInterval(retry);
  };

  const onMessage = (ev: MessageEvent) => {
    if (destroyed || ev.origin !== payOrigin || ev.source !== iframe.contentWindow) return;
    const msg = parseParentMessage(ev.data);
    if (!msg) return;
    switch (msg.type) {
      case "np:ready":
        if (!ready) {
          ready = true;
          if (retry) clearInterval(retry);
          clearTimeout(readyTimer);
          safely(o.onReady);
        }
        return;
      case "np:resize":
        iframe.style.height = `${Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.round(msg.height)))}px`;
        return;
      case "np:complete":
        if (completed || msg.session_id !== o.sessionId) return;
        completed = true;
        safely(o.onComplete, { sessionId: msg.session_id, paymentIntentId: msg.payment_intent_id });
        return;
      case "np:error":
        safely(o.onError, { code: msg.code, message: msg.message });
        return;
      case "np:close":
        safely(o.onClose);
        return;
    }
  };

  win.addEventListener("message", onMessage);
  iframe.addEventListener("load", () => {
    sendInit();
    if (!ready && retry === null) retry = setInterval(sendInit, INIT_RETRY_MS);
  });
  container.appendChild(iframe);

  return {
    iframe,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      win.removeEventListener("message", onMessage);
      if (retry) clearInterval(retry);
      clearTimeout(readyTimer);
      iframe.remove();
    },
  };
}

/** Creates a NearPay instance for a publishable key. */
export function NearPay(publishableKey: string, options: NearPayOptions = {}): NearPayInstance {
  if (typeof publishableKey !== "string") throw new NearPayError("NearPay() needs your publishable key (pk_…)");
  if (/^(sk|rk)_/.test(publishableKey)) {
    throw new NearPayError("Never use a secret or restricted key in the browser: pass your publishable key (pk_…)");
  }
  const km = PUBLISHABLE_KEY_RE.exec(publishableKey);
  if (!km) throw new NearPayError("Invalid publishable key: expected pk_live_… or pk_test_…");
  const payOrigin = normalizePayOrigin(options.payOrigin ?? DEFAULT_PAY_ORIGIN);
  return Object.freeze({
    publishableKey,
    livemode: km[1] === "live",
    payOrigin,
    mountCheckout: (o: MountCheckoutOptions) => mountCheckout(payOrigin, o),
  });
}

export default NearPay;
