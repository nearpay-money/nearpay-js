# AGENTS.md — nearpay-js

You are working in **nearpay-js**, one of 26 NearPay repositories (`nearpay-brain/architecture/repositories.md`).
Scope: Widget loader and client SDKs that mount the checkout iframe and speak a versioned postMessage protocol.

## Before changing anything

1. Read `../nearpay-brain/AGENTS.md`, then this repo's LLD (`../nearpay-brain/lld/checkout-and-js.md`) — it is the implementation spec; do not make design decisions it already makes.
2. Contracts (requests, responses, events, errors) come from `@nearpay-money/spec`. If one must change, open a PR in `nearpay-spec` first; never hand-write contract types here.
3. Check your change against invariants INV-1…INV-9 in `nearpay-brain/product/requirements.md`.

## Rules for this repo

- Loader URLs are versioned and immutable; publish SRI hashes with every release.
- The postMessage protocol is versioned in `protocol/`; never accept messages from unexpected origins.

## Never

- Import source code from another NearPay repo (depend on published packages/images only).
- Read or write another service's database.
- Add design documents here — update `nearpay-brain` and link to it.
- Commit secrets, private keys or real customer data.
- Merge changes to paths listed in `.github/CODEOWNERS` without the required human review.
