# nearpay-js

> Widget loader and client SDKs that mount the checkout iframe and speak a versioned postMessage protocol.

| | |
|---|---|
| Group | Frontends |
| Kind | library + static |
| Ships as | js.nearpay.money/v1/nearpay.js · npm: @nearpay/js, @nearpay/react |
| Owns | Embed protocol |
| Depends on (published artifacts only) | spec (public) |
| First built in | Stage 1 (step 1.3) |

## Documentation

This repo stays surgical: design docs live in [`nearpay-brain`](../nearpay-brain/README.md), not here.

- `nearpay-brain/lld/checkout-and-js.md` §5.3, §6 — **low-level design (dev-ready; implement from this)**
- `nearpay-brain/decisions/ADR-0010-checkout-isolation.md`
- [`protocol/v1.md`](protocol/v1.md) — the embed protocol (normative), [`protocol/v1.json`](protocol/v1.json) catalogue

## Usage

```html
<script src="https://js.nearpay.money/v1/nearpay.js" integrity="sha384-…" crossorigin="anonymous"></script>
<script>
  const checkout = NearPay("pk_live_…").mountCheckout({
    sessionId, clientSecret, element: "#pay",
    appearance: { theme: "auto", accent: "#1f6feb", radius: 10 },
    onComplete: ({ sessionId, paymentIntentId }) => { /* confirm via webhook, then fulfil */ },
    onError: ({ code, message }) => {},
  });
  // checkout.destroy();
</script>
```

React: `<NearPayProvider publishableKey="pk_…"><NearPayCheckout sessionId clientSecret onComplete /></NearPayProvider>`
(or pass `publishableKey` to the component). npm users of `@nearpay/js` call `NearPay(pk, { payOrigin })`
when the checkout is not `https://pay.nearpay.money`. The loader derives the checkout origin from its own
URL (`js.<domain>` → `pay.<domain>`), so one build serves every deployment; `payOrigin` overrides it.

The loader validates the `pk_` key (secret keys are refused), the session id and that the client secret
belongs to the session; it accepts only messages whose `event.origin` is the checkout origin and whose
`event.source` is its own iframe. Create embedded sessions with `ui_mode: "embedded"` and
`allowed_origins` containing your page's origin — the checkout refuses any other parent.

## Build output

```
pnpm build
dist/v1/nearpay.js         loader (IIFE, global NearPay), served by nearpay-deploy's `js` site
dist/v1/integrity.json     sha384 / sha512 SRI hashes of the loader (publish with every release)
packages/js/dist/          @nearpay/js (ESM + d.ts)
packages/react/dist/       @nearpay/react (ESM + d.ts)
```

`NP_PAY_ORIGIN` sets the loader's fallback checkout origin when it is not served from a `js.` host
(default `https://pay.nearpay.money`).

## Tests

```
pnpm test / pnpm coverage   # unit (Vitest + happy-dom), 90 % branch gate
pnpm e2e                    # Playwright (system Chrome) against the built loader and a fake checkout frame
pnpm verify                 # typecheck + lint + coverage + build + e2e
```

## Built with

TypeScript, esbuild, React (peer of `@nearpay/react`), Vitest, happy-dom, Playwright, Biome. Code and
documentation are written with AI assistance (Claude) under human direction and review.
