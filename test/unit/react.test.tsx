import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NearPayCheckout, NearPayProvider, useNearPay } from "../../packages/react/src/index";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PK = `pk_test_${"a".repeat(48)}`;
const SID = "cs_01jbz9k3m4n5p6q7r8s9t0v1w2";
const SECRET = `${SID}_secret_${"B".repeat(32)}`;
const PAY = "https://pay.nearpay.localhost";

function render(ui: React.ReactNode) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(ui));
  return { host, root };
}

let seen: unknown = null;
function Probe() {
  seen = useNearPay();
  return null;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("<NearPayCheckout>", () => {
  it("mounts the iframe through the provider and forwards callbacks", () => {
    const onComplete = vi.fn();
    const { host, root } = render(
      <NearPayProvider publishableKey={PK} payOrigin={PAY}>
        <Probe />
        <NearPayCheckout
          sessionId={SID}
          clientSecret={SECRET}
          onComplete={onComplete}
          appearance={{ theme: "dark" }}
          locale="en"
          className="np"
        />
      </NearPayProvider>,
    );
    expect(seen).toMatchObject({ payOrigin: PAY });
    const iframe = host.querySelector("iframe") as HTMLIFrameElement;
    expect(iframe.getAttribute("src")).toBe(`${PAY}/embed/${SID}#${SECRET}`);
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: PAY,
          source: iframe.contentWindow as Window,
          data: { type: "np:complete", v: 1, session_id: SID, payment_intent_id: null },
        }),
      );
    });
    expect(onComplete).toHaveBeenCalledWith({ sessionId: SID, paymentIntentId: null });
    act(() => root.unmount());
    expect(host.querySelector("iframe")).toBeNull();
  });

  it("accepts a publishableKey prop and keeps the frame across callback changes", () => {
    const { host, root } = render(
      <NearPayCheckout
        publishableKey={PK}
        payOrigin={PAY}
        sessionId={SID}
        clientSecret={SECRET}
        onReady={() => undefined}
        onError={() => undefined}
        onClose={() => undefined}
      />,
    );
    const first = host.querySelector("iframe");
    act(() =>
      root.render(
        <NearPayCheckout
          publishableKey={PK}
          payOrigin={PAY}
          sessionId={SID}
          clientSecret={SECRET}
          onReady={() => undefined}
        />,
      ),
    );
    expect(host.querySelector("iframe")).toBe(first);
    const iframe = first as HTMLIFrameElement;
    for (const type of ["np:ready", "np:error", "np:close"]) {
      act(() =>
        window.dispatchEvent(
          new MessageEvent("message", { origin: PAY, source: iframe.contentWindow as Window, data: { type, v: 1 } }),
        ),
      );
    }
    act(() => root.unmount());
  });

  it("throws without a key", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<NearPayCheckout sessionId={SID} clientSecret={SECRET} />)).toThrow(/publishableKey/);
    spy.mockRestore();
  });
});
