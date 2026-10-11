# What gets anchored on Fuji

Only 32-byte digests go on chain. The record itself never leaves the Commodex database, and no digest
can be reversed into a name, an amount or an address.

| Kind (`keccak256` label) | Digest | Source in the app | Who can check it |
|---|---|---|---|
| `TEST` | keccak256 of a fixed text | operator script | anyone |
| `LEDGER_HEAD` | SHA-256 `hash` of the last event of a ledger stream | hash-chained ledger | operator, auditor with the ledger export |
| `P2P_ROOT` | SHA-256 `matchHash` = hash of {PO ref, seller pool hash, buyer pool hash, positions Merkle root} | Pool-to-Pool record | each buyer, with their receipt and Merkle proof |
| `DUES_REMITTANCE` | SHA-256 of the approved remittance batch | statutory dues remittance | the public authority, from its dashboard |

`ref` carries a short non-personal reference such as `GH-GOLD-2026-v1/ledger/42`.

## Rules

- Staging only until the Fuji evidence pack is green. Production never anchors in this phase.
- The server signs with a dedicated Fuji operator wallet whose key is a mounted file, never a database value.
- No key → the feature shows "in preparation"; it never fails a settlement.
- The tx hash of each anchor is written back into the same ledger stream as its own event.
- Public pages name no network; the explorer link appears on operator, buyer-receipt and authority screens.
