// Copied unchanged from the Commodex app (src/modules/commodex/api/anchor.ts, release ed1f75f).
// Runs inside the app only: it needs the app's database client, site params and egress allow-list (@/lib/*).
// The pure rules it uses are in ./anchor.ts and are tested by ./anchor.test.ts.
// ---------------------------------------------------------------------------
// Avalanche anchor I/O: write a corridor digest to CommodexAnchor and file the
// transaction back into the same ledger stream as a `chain.anchored` event.
//
// - Signer: one server operator wallet whose key is a file mounted read-only
//   into the container (CDX_ANCHOR_KEY_FILE). Never a database value, never logged.
// - Contract: site param `commodex.anchor` {contract, chainId}, else
//   CDX_ANCHOR_CONTRACT, else CommodexAnchor v0 on Fuji.
// - Network: the enabled Avalanche row in web3Network, through the sanctioned
//   egress client (same path as the chain witness).
// - Production refuses unless CDX_ANCHOR_ALLOW_PRODUCTION=true.
// - It never throws into a settlement or remittance: every failure comes back
//   as an outcome ('in_preparation' | 'refused' | 'error').
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { Wallet, getAddress, formatEther } from 'ethers';
import { prisma } from '@/lib/prisma';
import { getSiteParam } from '@/lib/site-params';
import { createNetworkEgressClient } from '@/lib/net/allowlist';
import { recordEvent } from './ledger';
import {
  ANCHOR_CHAINS, FUJI_ANCHOR_CONTRACT, anchorEnvironmentAllowed, anchorInterface, anchorRef, encodeAnchorCall, explorerAddress, explorerTx,
  feeCaps, gasWithHeadroom, kindId, toBytes32, type AnchorChainId, type AnchorKind, type AnchorOutcome,
} from './anchor';

export const ANCHOR_PARAM_KEY = 'commodex.anchor';

interface AnchorConfig { contract: string; chainId: AnchorChainId; rpcUrl: string; wallet: Wallet }
type ConfigResult = { ok: true; config: AnchorConfig } | { ok: false; outcome: AnchorOutcome };

function walletFromFile(file: string): Wallet {
  const raw = readFileSync(file, 'utf8').replace(/^﻿/, '').trim().replace(/^["']|["']$/g, '').trim();
  const hex = raw.replace(/\s+/g, '').replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error('ANCHOR_KEY_FORMAT');
  return new Wallet('0x' + hex);
}

async function loadConfig(): Promise<ConfigResult> {
  if (!anchorEnvironmentAllowed({ CMS_ENVIRONMENT: process.env.CMS_ENVIRONMENT, CDX_ANCHOR_ALLOW_PRODUCTION: process.env.CDX_ANCHOR_ALLOW_PRODUCTION })) return { ok: false, outcome: { status: 'refused', reason: 'production does not anchor in this phase' } };
  let stored: { contract?: string; chainId?: number } = {};
  try { stored = JSON.parse((await getSiteParam(ANCHOR_PARAM_KEY).catch(() => undefined)) || '{}'); } catch { stored = {}; }
  const chainId: AnchorChainId = stored.chainId === 43114 ? 43114 : 43113;
  const rawContract = stored.contract || process.env.CDX_ANCHOR_CONTRACT || (chainId === 43113 ? FUJI_ANCHOR_CONTRACT : '');
  if (!rawContract) return { ok: false, outcome: { status: 'in_preparation', reason: 'no anchor contract recorded' } };
  let contract: string;
  try { contract = getAddress(rawContract); } catch { return { ok: false, outcome: { status: 'error', reason: 'anchor contract is not a valid address' } }; }
  const file = process.env.CDX_ANCHOR_KEY_FILE;
  if (!file) return { ok: false, outcome: { status: 'in_preparation', reason: 'no operator key mounted' } };
  let wallet: Wallet;
  try { wallet = walletFromFile(file); } catch (e) {
    return { ok: false, outcome: { status: 'in_preparation', reason: (e as Error).message === 'ANCHOR_KEY_FORMAT' ? 'operator key file is not a private key' : 'operator key file unreadable' } };
  }
  const net = await prisma.web3Network.findFirst({ where: { slug: ANCHOR_CHAINS[chainId].slug, enabled: true }, select: { rpcUrl: true } }).catch(() => null);
  if (!net?.rpcUrl) return { ok: false, outcome: { status: 'in_preparation', reason: `${ANCHOR_CHAINS[chainId].slug} is not enabled under Admin → Chains` } };
  return { ok: true, config: { contract, chainId, rpcUrl: net.rpcUrl, wallet } };
}

async function rpc<T = string>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  const { client } = await createNetworkEgressClient();
  const r = await client.fetch(rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const j = (await r.json().catch(() => null)) as { result?: T; error?: { message?: string } } | null;
  if (!r.ok || !j) throw new Error(`RPC_${method}_HTTP_${r.status}`);
  if (j.error) throw new Error(`RPC_${method}: ${j.error.message ?? 'error'}`);
  return j.result as T;
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

// One anchor at a time per process, so two settlements never pick the same nonce.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => null);
  return run;
}

/** Public status for the admin desk: contract, operator wallet, balance, readiness. Sends nothing. */
export async function anchorStatus() {
  const c = await loadConfig();
  if (!c.ok) return { ready: false, ...c.outcome };
  const { contract, chainId, rpcUrl, wallet } = c.config;
  try {
    const [chainHex, balHex, opRaw] = await Promise.all([
      rpc(rpcUrl, 'eth_chainId', []),
      rpc(rpcUrl, 'eth_getBalance', [wallet.address, 'latest']),
      rpc(rpcUrl, 'eth_call', [{ to: contract, data: anchorInterface.encodeFunctionData('operator', []) }, 'latest']),
    ]);
    const contractOperator = getAddress(anchorInterface.decodeFunctionResult('operator', opRaw)[0] as string);
    const chainOk = parseInt(chainHex, 16) === chainId;
    const isOperator = contractOperator === wallet.address;
    const balance = formatEther(BigInt(balHex));
    const reason = !chainOk ? `RPC answers chain ${parseInt(chainHex, 16)}` : !isOperator ? 'server wallet is not yet the contract operator (setOperator pending)' : BigInt(balHex) === 0n ? 'server wallet has no AVAX for gas' : null;
    return { ready: !reason, status: reason ? 'in_preparation' : 'ready', reason, contract, chainId, operatorAddress: wallet.address, contractOperator, balance, contractUrl: explorerAddress(chainId, contract), operatorUrl: explorerAddress(chainId, wallet.address) };
  } catch (e) {
    return { ready: false, status: 'error', reason: (e as Error).message, contract, chainId, operatorAddress: wallet.address };
  }
}

/** Anchor one digest. `stream` is the ledger stream the receipt is filed into. */
export function anchorHash(input: { tenantId: string; stream: string; kind: AnchorKind; hashHex: string; ref: string; actor?: string | null; meta?: Record<string, unknown> }): Promise<AnchorOutcome> {
  return serial(async (): Promise<AnchorOutcome> => {
    let hash: string;
    try { hash = toBytes32(input.hashHex); } catch (e) { return { status: 'error', reason: (e as Error).message }; }
    const c = await loadConfig();
    if (!c.ok) return c.outcome;
    const { contract, chainId, rpcUrl } = c.config;
    const ref = anchorRef(input.ref);
    try {
      const chainHex = await rpc(rpcUrl, 'eth_chainId', []);
      if (parseInt(chainHex, 16) !== chainId) return { status: 'refused', reason: `RPC answers chain ${parseInt(chainHex, 16)}, expected ${chainId}` };
      const wallet = c.config.wallet;
      const seenRaw = await rpc(rpcUrl, 'eth_call', [{ to: contract, data: anchorInterface.encodeFunctionData('anchoredAtBlock', [hash]) }, 'latest']);
      const seen = Number(anchorInterface.decodeFunctionResult('anchoredAtBlock', seenRaw)[0]);
      if (seen > 0) return { status: 'already', kind: input.kind, hash, blockNumber: seen, chainId, contract };

      const data = encodeAnchorCall(hash, input.kind, ref);
      const [nonceHex, block, tipHex, gasHex] = await Promise.all([
        rpc(rpcUrl, 'eth_getTransactionCount', [wallet.address, 'pending']),
        rpc<{ baseFeePerGas?: string }>(rpcUrl, 'eth_getBlockByNumber', ['latest', false]),
        rpc(rpcUrl, 'eth_maxPriorityFeePerGas', []).catch(() => '0x1'),
        rpc(rpcUrl, 'eth_estimateGas', [{ from: wallet.address, to: contract, data }]),
      ]);
      const fees = feeCaps(BigInt(block?.baseFeePerGas ?? '0x1'), BigInt(tipHex));
      const signed = await wallet.signTransaction({ type: 2, chainId, nonce: parseInt(nonceHex, 16), to: contract, data, value: 0n, gasLimit: gasWithHeadroom(BigInt(gasHex)), ...fees });
      const txHash = await rpc(rpcUrl, 'eth_sendRawTransaction', [signed]);

      let receipt: { status?: string; blockNumber?: string } | null = null;
      for (let i = 0; i < 30 && !receipt; i++) {
        await sleep(1000);
        receipt = await rpc<{ status?: string; blockNumber?: string } | null>(rpcUrl, 'eth_getTransactionReceipt', [txHash]).catch(() => null);
      }
      if (!receipt) return { status: 'error', reason: `sent ${txHash}, no receipt after 30 s` };
      if (receipt.status !== '0x1') return { status: 'error', reason: `transaction ${txHash} reverted` };
      const blockNumber = parseInt(receipt.blockNumber ?? '0x0', 16);
      const outcome: AnchorOutcome = { status: 'anchored', kind: input.kind, hash, txHash, blockNumber, chainId, contract, explorer: explorerTx(chainId, txHash) };
      await recordEvent(input.tenantId, input.stream, 'chain.anchored', { ...outcome, kindId: kindId(input.kind), ref, operator: wallet.address, ...(input.meta ?? {}) }, input.actor ?? 'engine').catch(() => null);
      return outcome;
    } catch (e) {
      return { status: 'error', reason: (e as Error).message.slice(0, 300) };
    }
  });
}

/** Anchor the current head (last event hash) of a ledger stream. */
export async function anchorStreamHead(tenantId: string, stream: string, ref: string, actor?: string | null, kind: AnchorKind = 'LEDGER_HEAD'): Promise<AnchorOutcome & { seq?: number }> {
  const head = await prisma.cdxEvent.findFirst({ where: { tenantId, stream }, orderBy: { seq: 'desc' }, select: { seq: true, hash: true } });
  if (!head) return { status: 'error', reason: `stream ${stream} is empty` };
  const out = await anchorHash({ tenantId, stream, kind, hashHex: head.hash, ref: ref || `${stream}#${head.seq}`, actor, meta: { anchoredSeq: head.seq } });
  return { ...out, seq: head.seq };
}

/** Anchors already filed in a stream (newest first), for desks and receipts. */
export async function anchorsInStream(tenantId: string, stream: string, take = 20) {
  const rows = await prisma.cdxEvent.findMany({ where: { tenantId, stream, type: 'chain.anchored' }, orderBy: { seq: 'desc' }, take });
  return rows.map((r) => ({ seq: r.seq, at: r.at.toISOString(), ...(r.payload as Record<string, unknown>) }));
}

/** Latest anchors across every stream (admin desk). */
export async function recentAnchors(tenantId: string, take = 15) {
  const rows = await prisma.cdxEvent.findMany({ where: { tenantId, type: 'chain.anchored' }, orderBy: { at: 'desc' }, take });
  return rows.map((r) => ({ stream: r.stream, seq: r.seq, at: r.at.toISOString(), ...(r.payload as Record<string, unknown>) }));
}
