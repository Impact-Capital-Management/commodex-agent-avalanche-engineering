// ---------------------------------------------------------------------------
// Avalanche anchor (CommodexAnchor contract): which corridor records get a
// 32-byte digest written on chain, and the rules around it. Pure module.
//
// Only digests go on chain: a ledger head, a Pool-to-Pool match hash, a
// remittance receipt hash. No name, amount or address can be read back from
// them. The contract (CommodexAnchor v0, Fuji 0xe274C452dFb0D259FA413EEd3a830197a4Fd50ef)
// stores the block of each hash and refuses a hash twice.
// ---------------------------------------------------------------------------

import { Interface, id as keccakLabel } from 'ethers';

export const ANCHOR_KINDS = ['TEST', 'LEDGER_HEAD', 'P2P_ROOT', 'DUES_REMITTANCE'] as const;
export type AnchorKind = (typeof ANCHOR_KINDS)[number];

/** CommodexAnchor v0 on Avalanche Fuji, deployed 2026-10-11 (block 59306874). */
export const FUJI_ANCHOR_CONTRACT = '0xe274C452dFb0D259FA413EEd3a830197a4Fd50ef';
export const ANCHOR_CHAINS = { 43113: { slug: 'avalanche-fuji', explorer: 'https://testnet.snowtrace.io' }, 43114: { slug: 'avalanche', explorer: 'https://snowtrace.io' } } as const;
export type AnchorChainId = keyof typeof ANCHOR_CHAINS;

export const ANCHOR_ABI = [
  'function anchor(bytes32 hash, bytes32 kind, string ref)',
  'function anchoredAtBlock(bytes32 hash) view returns (uint256)',
  'function operator() view returns (address)',
  'event Anchored(bytes32 indexed hash, bytes32 indexed kind, string ref, uint256 blockNumber)',
] as const;
export const anchorInterface = new Interface(ANCHOR_ABI as unknown as string[]);

export function isAnchorKind(v: unknown): v is AnchorKind {
  return typeof v === 'string' && (ANCHOR_KINDS as readonly string[]).includes(v);
}

/** keccak256 of the kind label, as the contract indexes it. */
export function kindId(kind: AnchorKind): string {
  return keccakLabel(kind);
}

/** A SHA-256 hex digest (64 chars, optional 0x) → bytes32. Anything else is refused. */
export function toBytes32(hex: string): string {
  const h = String(hex ?? '').trim().replace(/^0x/i, '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(h)) throw new RangeError('anchor hash must be a 32-byte hex digest');
  if (/^0+$/.test(h)) throw new RangeError('anchor hash cannot be zero');
  return '0x' + h;
}

/** Short, non-personal reference stored next to the hash ("GH-GOLD-2026-v2/remittance/GH-2026-10-001"). */
export function anchorRef(raw: string): string {
  return String(raw ?? '').replace(/[^A-Za-z0-9 ._:/#-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 96);
}

export function encodeAnchorCall(hashHex: string, kind: AnchorKind, ref: string): string {
  return anchorInterface.encodeFunctionData('anchor', [toBytes32(hashHex), kindId(kind), anchorRef(ref)]);
}

/** Production never anchors in this phase unless the owner flips CDX_ANCHOR_ALLOW_PRODUCTION=true. */
export function anchorEnvironmentAllowed(env: { CMS_ENVIRONMENT?: string; CDX_ANCHOR_ALLOW_PRODUCTION?: string }): boolean {
  if ((env.CMS_ENVIRONMENT ?? '').toLowerCase() !== 'production') return true;
  return env.CDX_ANCHOR_ALLOW_PRODUCTION === 'true';
}

export function explorerTx(chainId: AnchorChainId, txHash: string): string {
  return `${ANCHOR_CHAINS[chainId].explorer}/tx/${txHash}`;
}

export function explorerAddress(chainId: AnchorChainId, address: string): string {
  return `${ANCHOR_CHAINS[chainId].explorer}/address/${address}`;
}

/** EIP-1559 fees with headroom: 2 × base fee + tip, never below the tip. */
export function feeCaps(baseFeeWei: bigint, tipWei: bigint): { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint } {
  const tip = tipWei > 0n ? tipWei : 1n;
  return { maxPriorityFeePerGas: tip, maxFeePerGas: baseFeeWei * 2n + tip };
}

/** Gas estimate + 25 %, rounded up. */
export function gasWithHeadroom(estimate: bigint): bigint {
  return (estimate * 125n + 99n) / 100n;
}

export type AnchorOutcome =
  | { status: 'anchored'; kind: AnchorKind; hash: string; txHash: string; blockNumber: number; chainId: AnchorChainId; contract: string; explorer: string }
  | { status: 'already'; kind: AnchorKind; hash: string; blockNumber: number; chainId: AnchorChainId; contract: string }
  | { status: 'in_preparation'; reason: string }
  | { status: 'refused'; reason: string }
  | { status: 'error'; reason: string };
