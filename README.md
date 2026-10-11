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

**Design fixed; app integration not started. Nothing mined yet.**

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
| Ledger head anchored from staging | — not yet mined — | |
| Pool-to-Pool root anchored | — not yet mined — | |
| Dues remittance anchored | — not yet mined — | |

## License

MIT — see [LICENSE](LICENSE).
