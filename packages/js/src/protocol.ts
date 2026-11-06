/** Embed protocol v1 (`protocol/v1.md`): message names, iframe attributes and appearance rules. */
export const PROTOCOL_VERSION = 1 as const;
export const IFRAME_SANDBOX = "allow-scripts allow-same-origin allow-popups allow-forms";
export const IFRAME_ALLOW = "clipboard-write";
export const INIT_RETRY_MS = 250;
export const INIT_MAX_TRIES = 40;

export type ToParentType = "np:ready" | "np:resize" | "np:complete" | "np:error" | "np:close";
export const TO_PARENT: readonly ToParentType[] = ["np:ready", "np:resize", "np:complete", "np:error", "np:close"];

export interface Appearance {
  readonly theme?: "light" | "dark" | "auto";
  /** `#rgb` or `#rrggbb`. */
  readonly accent?: string;
  /** Corner radius in px, 0–24. */
  readonly radius?: number;
}

export interface WireAppearance {
  readonly theme: "light" | "dark" | "auto";
  readonly accent: string | null;
  readonly radius: number | null;
}

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function toWireAppearance(a: Appearance | undefined): WireAppearance {
  const theme = a?.theme === "light" || a?.theme === "dark" ? a.theme : "auto";
  const accent = typeof a?.accent === "string" && HEX.test(a.accent) ? a.accent : null;
  const r = a?.radius;
  const radius = typeof r === "number" && Number.isFinite(r) && r >= 0 && r <= 24 ? Math.round(r) : null;
  return { theme, accent, radius };
}

export function initMessage(appearance: Appearance | undefined, locale: string | undefined) {
  return {
    type: "np:init" as const,
    v: PROTOCOL_VERSION,
    appearance: toWireAppearance(appearance),
    locale: locale ?? null,
  };
}

export type ParentMessage =
  | { readonly type: "np:ready" }
  | { readonly type: "np:resize"; readonly height: number }
  | { readonly type: "np:complete"; readonly session_id: string; readonly payment_intent_id: string | null }
  | { readonly type: "np:error"; readonly code: string; readonly message: string }
  | { readonly type: "np:close" };

/** Parses an iframe → parent message; null for anything that is not a well-formed v1 message. */
export function parseParentMessage(data: unknown): ParentMessage | null {
  if (typeof data !== "object" || data === null) return null;
  const m = data as Record<string, unknown>;
  if (m.v !== PROTOCOL_VERSION || typeof m.type !== "string") return null;
  switch (m.type) {
    case "np:ready":
      return { type: "np:ready" };
    case "np:close":
      return { type: "np:close" };
    case "np:resize":
      return typeof m.height === "number" && Number.isFinite(m.height) ? { type: "np:resize", height: m.height } : null;
    case "np:complete":
      if (typeof m.session_id !== "string") return null;
      return {
        type: "np:complete",
        session_id: m.session_id,
        payment_intent_id: typeof m.payment_intent_id === "string" ? m.payment_intent_id : null,
      };
    case "np:error":
      return {
        type: "np:error",
        code: typeof m.code === "string" ? m.code.slice(0, 100) : "unknown",
        message: typeof m.message === "string" ? m.message.slice(0, 500) : "",
      };
    default:
      return null;
  }
}
