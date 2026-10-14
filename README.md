# commodex-agent-avalanche-engineering

Avalanche engineering agent for the Commodex Avalanche C-Chain setup. Commodex: https://commodex.xyz/

- Production: https://commodex.xyz
- Testnet UI: https://wedevnext.commodex.xyz
- Fuji evidence page on the testnet UI: https://wedevnext.commodex.xyz/fuji
- Network: Avalanche Fuji C-Chain (EVM), chain id `43113`

## Agent

| | |
|---|---|
| Person | Aleksander Wiśniewski |
| Role | Avalanche engineering — connects the Commodex app to the Fuji contracts |
| FR scope | FR-01, FR-03 |
| Squad page | https://team.impactcapital.ltd/showcase/commodex/agents/blockchain_engineer/ |

## Status — 14 October 2026

**The Commodex app anchors corridor records on Fuji from the testnet UI (https://wedevnext.commodex.xyz).** The app
code that does it is in [`app/`](app/), copied unchanged from the Commodex app.

| File | What it does |
|---|---|
| [`app/anchor.ts`](app/anchor.ts) | Pure rules: the four anchor kinds, bytes32 checks, safe `ref`, call encoding, production guard, fee and gas headroom |
| [`app/anchor.test.ts`](app/anchor.test.ts) | 7 tests for those rules (`npm test`) |
| [`app/anchor-service.ts`](app/anchor-service.ts) | Signs and sends `anchor(hash, kind, ref)` with the server operator wallet, waits for the receipt, files a `chain.anchored` event into the same ledger stream. One anchor at a time (serial nonce). Never throws into a settlement. |
| [`app/AnchorPanel.tsx`](app/AnchorPanel.tsx) | Operator console panel: contract, operator wallet, balance, recent anchors with explorer links, buttons to anchor a test hash, a ledger head and a Pool-to-Pool root |

Where the app calls it: at settlement (ledger head of the order stream), at remittance (dues remittance digest),
and from the operator console. Production refuses to anchor unless `CDX_ANCHOR_ALLOW_PRODUCTION=true`.

What gets anchored and why no personal data reaches the chain: [docs/what-gets-anchored.md](docs/what-gets-anchored.md).
The contract and the operator script: [commodex-agent-avalanche-contracts](https://github.com/Impact-Capital-Management/commodex-agent-avalanche-contracts).

## Commands

```bash
git clone https://github.com/Impact-Capital-Management/commodex-agent-avalanche-engineering
cd commodex-agent-avalanche-engineering
npm install
npm test          # 7 checks of app/anchor.ts, no network, no key (Node 22.6 or newer)
```

Check the anchors the app wrote, against the public Fuji RPC, with no install:

```bash
git clone https://github.com/Impact-Capital-Management/commodex-agent-contract-assurance
node commodex-agent-contract-assurance/checks/verify-fuji.mjs      # prints PASS/FAIL per transaction
```

## Evidence

| Step | Transaction | Explorer |
|---|---|---|
| App sends its first anchor (`TEST`) from the server wallet | block 59309304 | https://testnet.snowtrace.io/tx/0x41a6b23d19891b6fa92896242dbfd827c6b8707eeb36f0855ce4c57d23469e42 |
| Ledger head anchored from the testnet UI (`tax` stream, event #96) | block 59309310 | https://testnet.snowtrace.io/tx/0x3a1c5d0093de40c15deed22f9a568c0a1b2ad04f66f5ae084771583c69e45ac9 |
| Pool-to-Pool root anchored (P2P-REHEARSAL-001, 12 buyers) | block 59309318 | https://testnet.snowtrace.io/tx/0x54a4a46708d4bbdd641f9f4f14fb88c085f2af29d35295834f4d6caab4ec38e6 |
| Dues remittance anchored | next: first remittance marked remitted on the testnet UI | |

## License

MIT — see [LICENSE](LICENSE).
