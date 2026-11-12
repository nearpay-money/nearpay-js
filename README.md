# nearpay-js

The browser side of embedded checkout: the widget loader (`nearpay.js`) and the client SDKs `@nearpay-money/js` and `@nearpay-money/react`, which mount the checkout iframe on a merchant's page and speak a versioned postMessage protocol with it.

Part of [NearPay](https://github.com/nearpay-money/nearpay) — start there for the live demo, the architecture diagram and the full "do X, see Y" walkthrough.

- **Where it sits:** a merchant's page loads `https://js.nearpay.money/v1/nearpay.js` (or imports the npm packages) and mounts a checkout session created by the merchant's server. The loader frames the `/embed` route of `nearpay-checkout` at https://pay.nearpay.money and relays its events; it makes no API calls itself and refuses secret keys (only a `pk_` publishable key is accepted).
- **Status:** published on npm as [`@nearpay-money/js`](https://www.npmjs.com/package/@nearpay-money/js) and [`@nearpay-money/react`](https://www.npmjs.com/package/@nearpay-money/react) 0.2.0; the loader is served at https://js.nearpay.money/v1/nearpay.js. NearPay runs on NEAR mainnet as a closed beta (https://nearpay.money).

| | |
|---|---|
| Group | Frontends |
| Kind | library + static |
| Ships as | js.nearpay.money/v1/nearpay.js · npm: @nearpay-money/js, @nearpay-money/react |
| Owns | Embed protocol |
| Depends on (published artifacts only) | spec (public) |
| First built in | Stage 1 (step 1.3) |

## Documentation

Design docs live in [`nearpay-brain`](https://github.com/nearpay-money/nearpay-brain), not here.

- [`lld/checkout-and-js.md`](https://github.com/nearpay-money/nearpay-brain/blob/main/lld/checkout-and-js.md) §5.3, §6 — low-level design this repo is implemented from
- [`decisions/ADR-0010-checkout-isolation.md`](https://github.com/nearpay-money/nearpay-brain/blob/main/decisions/ADR-0010-checkout-isolation.md)
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
(or pass `publishableKey` to the component). npm users of `@nearpay-money/js` call `NearPay(pk, { payOrigin })`
when the checkout is not `https://pay.nearpay.money`. The loader derives the checkout origin from its own
URL (`js.<domain>` → `pay.<domain>`), so one build serves every deployment; `payOrigin` overrides it.

The loader validates the `pk_` key (secret keys are refused), the session id and that the client secret
belongs to the session; it accepts only messages whose `event.origin` is the checkout origin and whose
`event.source` is its own iframe. Create embedded sessions with `ui_mode: "embedded"` and
`allowed_origins` containing your page's origin — the checkout refuses any other parent.

## Verify this repo

Needs Node 22, pnpm 9 and, for step 4, Google Chrome. No Docker. `.npmrc` points the `@nearpay-money` scope at a local package registry (for the `@nearpay-money/spec` dev dependency), so start that first.

1. Start the local registry (no Docker, Node 22 only):
   `git clone https://github.com/nearpay-money/nearpay-deploy ../nearpay-deploy && ../nearpay-deploy/scripts/registry.sh start`
   → `curl http://127.0.0.1:4873/-/ping` answers `{}`.
2. `pnpm install --frozen-lockfile` → ends with `Done in …`, no registry errors.
3. `pnpm test` (unit tests in happy-dom: key and session validation, origin checks, the message protocol) → `Test Files  2 passed (2)`, `Tests  16 passed (16)`.
4. `pnpm verify` (the full gate: typecheck, lint, unit tests with the 90 % branch coverage gate, build, then Playwright against the built loader and a fake checkout frame on another origin) → exits 0; the Playwright list ends with `6 passed`. The browser is the system Chrome at `/usr/bin/google-chrome`; set `NP_CHROME` to another path if needed.

The published packages can be checked without a clone: `npm install @nearpay-money/js @nearpay-money/react` in an empty directory installs 0.2.0 of each from npmjs.com. By reading: [`protocol/v1.md`](protocol/v1.md) is the normative embed protocol.

## Build output

```
pnpm build
dist/v1/nearpay.js         loader (IIFE, global NearPay), served by nearpay-deploy's `js` site
dist/v1/integrity.json     sha384 / sha512 SRI hashes of the loader (publish with every release)
packages/js/dist/          @nearpay-money/js (ESM + d.ts)
packages/react/dist/       @nearpay-money/react (ESM + d.ts)
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

- Runtime: no dependencies in `@nearpay-money/js` and the loader; React ≥ 18.2 is a peer of `@nearpay-money/react`.
- Development: TypeScript, esbuild, Vitest, happy-dom, Playwright, Biome, `@nearpay-money/spec` + zod (protocol checks in tests).
- Licence: Apache-2.0 (`LICENSE`).

Code and documentation are written with AI assistance (Claude) under human direction and review. Built for the NEAR Hackathon (Nov 2026).
