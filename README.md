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

- `nearpay-brain/lld/checkout-and-js.md` — **low-level design (dev-ready; implement from this)**
- `nearpay-brain/lld/audits/checkout-and-js.md` — audit findings already folded into the LLD
- `nearpay-brain/roadmap/development-plan.md` — stage and step this repo is built in
- `nearpay-brain/architecture/hld.md` — system design
- `nearpay-brain/architecture/repositories.md` — repo topology and dependency rules
- `nearpay-brain/decisions/ADR-0010-checkout-isolation.md`

## Layout

```
nearpay-js/
├── examples/
│   ├── html/
│   └── react/
├── packages/
│   ├── js/
│   ├── loader/
│   └── react/
├── protocol/
├── test/
└── .github/
    └── workflows/
```

## Status

Scaffold only. Implementation starts in **Stage 1 (step 1.3)** (`nearpay-brain/roadmap/development-plan.md`).

## Built with

Libraries are listed here as they are added (hackathon rule Q-005). Code and documentation are written with AI assistance (Claude) under human direction and review.
