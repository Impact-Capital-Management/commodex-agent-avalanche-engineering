// Run: npm test   (Node 22.6+; same file as src/modules/commodex/domain/anchor.test.ts in the app)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { id } from 'ethers';
import { anchorEnvironmentAllowed, anchorInterface, anchorRef, encodeAnchorCall, explorerTx, feeCaps, gasWithHeadroom, isAnchorKind, kindId, toBytes32, FUJI_ANCHOR_CONTRACT } from './anchor.ts';

const H = 'a'.repeat(64);

test('kinds are the four the contract is used for', () => {
  for (const k of ['TEST', 'LEDGER_HEAD', 'P2P_ROOT', 'DUES_REMITTANCE']) assert.equal(isAnchorKind(k), true, k);
  for (const k of ['test', 'ESCROW', '', null, 1]) assert.equal(isAnchorKind(k), false, String(k));
  assert.equal(kindId('TEST'), id('TEST'));
});

test('only a non-zero 32-byte digest is accepted', () => {
  assert.equal(toBytes32(H), '0x' + H);
  assert.equal(toBytes32('0x' + H.toUpperCase()), '0x' + H);
  assert.throws(() => toBytes32('abc'), RangeError);
  assert.throws(() => toBytes32('0'.repeat(64)), RangeError);
  assert.throws(() => toBytes32('g'.repeat(64)), RangeError);
});

test('refs are short and carry no free text beyond a safe charset', () => {
  assert.equal(anchorRef('GH-GOLD-2026-v2/remittance/GH-2026-10-001'), 'GH-GOLD-2026-v2/remittance/GH-2026-10-001');
  assert.equal(anchorRef('<script>alert(1)</script> name@mail.com'), 'scriptalert1/script namemail.com');
  assert.equal(anchorRef('x'.repeat(200)).length, 96);
});

test('the encoded call decodes back to the same hash, kind and ref', () => {
  const data = encodeAnchorCall(H, 'LEDGER_HEAD', 'po:42');
  const [hash, kind, ref] = anchorInterface.decodeFunctionData('anchor', data);
  assert.equal(hash, '0x' + H);
  assert.equal(kind, id('LEDGER_HEAD'));
  assert.equal(ref, 'po:42');
});

test('production refuses to anchor unless explicitly allowed', () => {
  assert.equal(anchorEnvironmentAllowed({ CMS_ENVIRONMENT: 'staging' }), true);
  assert.equal(anchorEnvironmentAllowed({}), true);
  assert.equal(anchorEnvironmentAllowed({ CMS_ENVIRONMENT: 'production' }), false);
  assert.equal(anchorEnvironmentAllowed({ CMS_ENVIRONMENT: 'production', CDX_ANCHOR_ALLOW_PRODUCTION: '1' }), false);
  assert.equal(anchorEnvironmentAllowed({ CMS_ENVIRONMENT: 'production', CDX_ANCHOR_ALLOW_PRODUCTION: 'true' }), true);
});

test('fees and gas keep headroom', () => {
  assert.deepEqual(feeCaps(100n, 5n), { maxPriorityFeePerGas: 5n, maxFeePerGas: 205n });
  assert.deepEqual(feeCaps(100n, 0n), { maxPriorityFeePerGas: 1n, maxFeePerGas: 201n });
  assert.equal(gasWithHeadroom(100_000n), 125_000n);
  assert.equal(gasWithHeadroom(3n), 4n);
});

test('explorer links point at the Fuji explorer for chain 43113', () => {
  assert.equal(explorerTx(43113, '0xabc'), 'https://testnet.snowtrace.io/tx/0xabc');
  assert.match(FUJI_ANCHOR_CONTRACT, /^0x[0-9a-fA-F]{40}$/);
});
