# @nearpay-money/js

Mount the NearPay embedded checkout in your page: a sandboxed iframe from `https://pay.nearpay.money` that talks
to your page over a versioned `postMessage` protocol. Deposit addresses, amounts and wallet interactions stay
inside the iframe. Create the checkout session on your server (for example with
[`@nearpay-money/node`](https://www.npmjs.com/package/@nearpay-money/node)) and pass its id and client secret here.

## Install

```sh
npm install @nearpay-money/js
```

ESM, browser only, no dependencies. Without a bundler, use the hosted loader instead:
`<script src="https://js.nearpay.money/v1/nearpay.js" integrity="sha384-…" crossorigin="anonymous"></script>`.

## Quickstart

```ts
import { NearPay } from "@nearpay-money/js";

const nearpay = NearPay("pk_test_…"); // NearPay(pk, { payOrigin }) for a checkout other than pay.nearpay.money
const checkout = nearpay.mountCheckout({
  sessionId: session.id, // cs_…
  clientSecret: session.client_secret,
  element: "#pay",
  appearance: { theme: "auto", accent: "#007A68", radius: 12 },
  onComplete: ({ sessionId, paymentIntentId }) => {
    // confirm the payment on your server (webhook), then fulfil
  },
  onError: ({ code, message }) => console.error(code, message),
});
// checkout.destroy();
```

## Links

- Documentation: https://docs.nearpay.money
- Website: https://nearpay.money
- Source and embed protocol: https://github.com/nearpay-money/nearpay-js

Earlier versions were named `@nearpay/js` on NearPay's private registry only; NearPay never publishes under the
`@nearpay` npm scope (it belongs to an unrelated company). License: Apache-2.0.
