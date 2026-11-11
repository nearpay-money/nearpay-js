/**
 * @nearpay-money/react — `<NearPayCheckout sessionId clientSecret onComplete />` (lld/checkout-and-js.md §6).
 * The publishable key comes from `<NearPayProvider publishableKey>` or the `publishableKey` prop.
 */
import {
  type Appearance,
  type CheckoutError,
  type CompleteResult,
  NearPay,
  type NearPayInstance,
} from "@nearpay-money/js";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef } from "react";

const NearPayContext = createContext<NearPayInstance | null>(null);

export interface NearPayProviderProps {
  readonly publishableKey: string;
  readonly payOrigin?: string;
  readonly children?: ReactNode;
}

export function NearPayProvider({ publishableKey, payOrigin, children }: NearPayProviderProps) {
  const np = useMemo(() => NearPay(publishableKey, payOrigin ? { payOrigin } : {}), [publishableKey, payOrigin]);
  return <NearPayContext.Provider value={np}>{children}</NearPayContext.Provider>;
}

export function useNearPay(): NearPayInstance | null {
  return useContext(NearPayContext);
}

export interface NearPayCheckoutProps {
  readonly sessionId: string;
  readonly clientSecret: string;
  readonly publishableKey?: string;
  readonly payOrigin?: string;
  readonly appearance?: Appearance;
  readonly locale?: string;
  readonly className?: string;
  readonly onComplete?: (r: CompleteResult) => void;
  readonly onError?: (e: CheckoutError) => void;
  readonly onReady?: () => void;
  readonly onClose?: () => void;
}

export function NearPayCheckout(props: NearPayCheckoutProps) {
  const ctx = useContext(NearPayContext);
  const { publishableKey, payOrigin, sessionId, clientSecret, locale } = props;
  const np = useMemo(() => {
    if (publishableKey) return NearPay(publishableKey, payOrigin ? { payOrigin } : {});
    if (ctx) return ctx;
    throw new Error("NearPayCheckout needs a publishableKey prop or a <NearPayProvider>");
  }, [publishableKey, payOrigin, ctx]);
  const el = useRef<HTMLDivElement>(null);
  // Callbacks change on every render; keep the latest without remounting the iframe.
  const cb = useRef(props);
  cb.current = props;
  const appearance = JSON.stringify(props.appearance ?? {});

  useEffect(() => {
    if (!el.current) return;
    const handle = np.mountCheckout({
      sessionId,
      clientSecret,
      element: el.current,
      appearance: JSON.parse(appearance) as Appearance,
      ...(locale ? { locale } : {}),
      onComplete: (r) => cb.current.onComplete?.(r),
      onError: (e) => cb.current.onError?.(e),
      onReady: () => cb.current.onReady?.(),
      onClose: () => cb.current.onClose?.(),
    });
    return () => handle.destroy();
  }, [np, sessionId, clientSecret, appearance, locale]);

  return <div className={props.className} ref={el} data-nearpay-checkout="" />;
}

export type { Appearance, CheckoutError, CompleteResult } from "@nearpay-money/js";
