# commodex-agent-avalanche-engineering

Avalanche engineering agent for the Commodex Avalanche C-Chain setup. Commodex: https://commodex.xyz/

- Production: https://commodex.xyz
- Testnet UI: https://wedevnext.commodex.xyz
- Network: Avalanche Fuji C-Chain (EVM), chain id `43113`

## Agent

| | |
|---|---|
| Person | Aleksander Wiśniewski |
| Role | Avalanche engineering — connects the Commodex app to the Fuji contracts |
| FR scope | FR-01, FR-03 |
| Squad page | https://team.impactcapital.ltd/showcase/commodex/ |

## Status — 11 October 2026

**App integration live on staging (release ed1f75f, 2026-10-11): the corridor app anchors ledger heads, Pool-to-Pool match roots and remittance receipts on Fuji.**

What the Commodex app already does (on staging and production):

- Every corridor record is a SHA-256 hash-chained ledger event (`prevHash` → `hash`) per stream.
- At settlement and remittance it reads the latest Avalanche block (read-only) and stores the block number and hash in the ledger event — a public time witness, no transaction.
- Pool-to-Pool matches produce a `matchHash` that commits to the seller pool, the buyer pool and a Merkle root of buyer positions.

What this unit builds next, in order (see [docs/what-gets-anchored.md](docs/what-gets-anchored.md)):

1. Ledger head anchor (`LEDGER_HEAD`) from staging, tx hash written back as a ledger event.
2. Pool-to-Pool match anchor (`P2P_ROOT`); each buyer verifies their share against the anchored root.
3. Statutory-dues remittance anchor (`DUES_REMITTANCE`), shown to the public authority.

The contract and the operator script live in [commodex-agent-avalanche-contracts](https://github.com/Impact-Capital-Management/commodex-agent-avalanche-contracts).

## Evidence

| Step | Transaction | Explorer |
|---|---|---|
| Ledger head anchored from staging (`tax` stream, event #96) | `0x3a1c5d0093de40c1…` block 59309310 | https://testnet.snowtrace.io/tx/0x3a1c5d0093de40c15deed22f9a568c0a1b2ad04f66f5ae084771583c69e45ac9 |
| Pool-to-Pool root anchored (P2P-REHEARSAL-001, 12 buyers) | `0x54a4a46708d4bbdd…` block 59309318 | https://testnet.snowtrace.io/tx/0x54a4a46708d4bbdd641f9f4f14fb88c085f2af29d35295834f4d6caab4ec38e6 |
| Dues remittance anchored | — next: first remittance marked remitted on staging — | |

## License

MIT — see [LICENSE](LICENSE).
