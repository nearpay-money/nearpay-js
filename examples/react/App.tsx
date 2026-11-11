import { NearPayCheckout, NearPayProvider } from "@nearpay-money/react";

/** sessionId / clientSecret come from your server (embedded checkout session). */
export function Checkout({ sessionId, clientSecret }: { sessionId: string; clientSecret: string }) {
  return (
    <NearPayProvider publishableKey="pk_test_REPLACE_ME">
      <NearPayCheckout
        sessionId={sessionId}
        clientSecret={clientSecret}
        appearance={{ theme: "auto" }}
        onComplete={({ sessionId: id }) => window.location.assign(`/thanks?session_id=${id}`)}
      />
    </NearPayProvider>
  );
}
