/**
 * js.<domain>/v1/nearpay.js — the widget loader (global `NearPay`). The checkout origin is the loader's
 * own host with `js.` replaced by `pay.` (so one build serves every deployment), else the build-time
 * default; an explicit `payOrigin` option always wins.
 */
import { NearPay as create, type NearPayInstance, type NearPayOptions, payOriginFromScript } from "@nearpay/js";

declare const __NP_DEFAULT_PAY_ORIGIN__: string;

// document.currentScript is only set while this script is first evaluated.
const derived = payOriginFromScript((document.currentScript as HTMLScriptElement | null)?.src);
const defaultOrigin = derived ?? __NP_DEFAULT_PAY_ORIGIN__;

function NearPay(publishableKey: string, options: NearPayOptions = {}): NearPayInstance {
  return create(publishableKey, { payOrigin: options.payOrigin ?? defaultOrigin });
}

declare global {
  interface Window {
    NearPay?: typeof NearPay;
  }
}

if (!window.NearPay) window.NearPay = NearPay;
