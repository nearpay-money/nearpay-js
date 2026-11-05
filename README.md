# nearpay-js

> Widget loader and client SDKs that mount the checkout iframe and speak a versioned postMessage protocol.

| | |
|---|---|
| Group | Frontends |
| Kind | library + static |
| Ships as | js.nearpay.money/v1/nearpay.js · npm: @nearpay/js, @nearpay/react |
| Owns | Embed protocol |
| Depends on (published artifacts only) | spec (public) |
| Roadmap phase | P1 Core payments |

## Documentation

This repo stays surgical: design docs live in [`nearpay-brain`](../nearpay-brain/README.md), not here.

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

Scaffold only. Implementation starts in phase **P1 Core payments** (`nearpay-brain/roadmap/roadmap.md`).
