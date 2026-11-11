# @nearpay-money/react

React components for the NearPay embedded checkout, built on
[`@nearpay-money/js`](https://www.npmjs.com/package/@nearpay-money/js).

## Install

```sh
npm install @nearpay-money/react
```

ESM, React ≥ 18.2 (peer dependency).

## Quickstart

```tsx
import { NearPayCheckout, NearPayProvider } from "@nearpay-money/react";

export function Pay({ session }: { session: { id: string; client_secret: string } }) {
  return (
    <NearPayProvider publishableKey="pk_test_…">
      <NearPayCheckout
        sessionId={session.id}
        clientSecret={session.client_secret}
        appearance={{ theme: "auto" }}
        onComplete={({ paymentIntentId }) => {
          // confirm on your server (webhook), then fulfil
        }}
      />
    </NearPayProvider>
  );
}
```

`publishableKey` (and `payOrigin`) can also be passed to `NearPayCheckout` directly; `useNearPay()` returns the
provider's instance.

## Links

- Documentation: https://docs.nearpay.money
- Website: https://nearpay.money
- Source: https://github.com/nearpay-money/nearpay-js

Earlier versions were named `@nearpay/react` on NearPay's private registry only; NearPay never publishes under the
`@nearpay` npm scope (it belongs to an unrelated company). License: Apache-2.0.
