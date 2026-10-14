// Copied unchanged from the Commodex app (operator console, Corridor control → Avalanche anchor, release ed1f75f).
// Runs inside the app only (i18n provider, admin API).
'use client';
// ---------------------------------------------------------------------------
// Admin → Commodex → Corridor control → Avalanche anchor.
// Status of the CommodexAnchor contract and the server operator wallet, plus
// three operator actions: anchor a ledger stream head, anchor a test hash, and
// build + anchor a Pool-to-Pool rehearsal match. Every result links to the explorer.
// ---------------------------------------------------------------------------
import { useState, type ReactNode } from 'react';
import { useT } from '@/components/i18n/I18nProvider';

type Any = Record<string, any>;
type Post = (p: Any) => Res; type Res = Promise<Any | null>;
const inp = 'w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm';
const btn = 'inline-flex items-center rounded-lg border border-deepTeal-200 bg-white px-3 py-1.5 text-xs font-semibold text-deepTeal-700 hover:bg-deepTeal-50 disabled:opacity-50';
const short = (h?: string) => (h ? `${h.slice(0, 10)}…${h.slice(-6)}` : '—');
const Ext = ({ href, children }: { href?: string; children: ReactNode }) => {
  if (!href) return <span className="font-mono">{children}</span>;
  return <a href={href} target="_blank" rel="noreferrer" className="font-mono text-deepTeal-700 underline">{children}</a>;
};

export default function AnchorPanel({ post, busy, setNotice }: { post: Post; busy: boolean; setNotice: (s: string) => void }) {
  const t = useT();
  const [st, setSt] = useState<Any | null>(null);
  const [stream, setStream] = useState('tax');
  const [poRef, setPoRef] = useState('P2P-REHEARSAL-001');
  const [tickets, setTickets] = useState('B-001, 250\nB-002, 100\nB-003, 25\nB-004, 625');
  const [lot, setLot] = useState('1000');
  const [last, setLast] = useState<Any | null>(null);
  const [p2p, setP2p] = useState<Any | null>(null);

  const outcomeText = (o: Any) => o?.status === 'anchored' ? t('cdx.admin.anchor.anchored', { block: o.blockNumber })
    : o?.status === 'already' ? t('cdx.admin.anchor.already', { block: o.blockNumber })
    : `${t('cdx.admin.anchor.notAnchored')}: ${o?.reason ?? o?.status ?? '—'}`;

  async function refresh() { const r = await post({ action: 'anchor.status' }); if (r) setSt(r); }
  async function headNow() { const r = await post({ action: 'anchor.stream', stream }); if (r) { setLast(r.anchor); setNotice(outcomeText(r.anchor)); } }
  async function testNow() { const r = await post({ action: 'anchor.test' }); if (r) { setLast(r.anchor); setNotice(outcomeText(r.anchor)); } }
  async function p2pNow() {
    const rows = tickets.split(/\r?\n/).map((l) => l.split(',').map((x) => x.trim())).filter((x) => x[0] && x[1]);
    const r = await post({ action: 'anchor.p2p', poRef, lotPriceUsd: Number(lot), tickets: rows.map(([buyerRef, usd]) => ({ buyerRef, amountUsd: Number(usd) })) });
    if (r) { setP2p(r); setLast(r.anchor); setNotice(outcomeText(r.anchor)); }
  }

  const s = st?.anchor;
  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold text-slate-900">{t('cdx.admin.anchor.title')}</h2>
        <button className={btn} disabled={busy} onClick={refresh}>{t('cdx.admin.anchor.refresh')}</button>
      </div>
      <p className="mt-1 text-xs text-slate-500">{t('cdx.admin.anchor.note')}</p>
      {s && (
        <dl className="mt-3 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[160px_1fr]">
          <dt className="text-slate-500">{t('cdx.admin.anchor.state')}</dt><dd className={s.ready ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}>{s.ready ? t('cdx.admin.anchor.ready') : `${t('cdx.admin.anchor.inPreparation')}: ${s.reason ?? s.status}`}</dd>
          <dt className="text-slate-500">{t('cdx.admin.anchor.contract')}</dt><dd><Ext href={s.contractUrl}>{s.contract ?? '—'}</Ext> · {t('cdx.admin.anchor.chainId', { id: s.chainId ?? '—' })}</dd>
          <dt className="text-slate-500">{t('cdx.admin.anchor.operator')}</dt><dd><Ext href={s.operatorUrl}>{s.operatorAddress ?? '—'}</Ext>{s.balance != null && ` · ${t('cdx.admin.anchor.balance', { amount: s.balance })}`}</dd>
          <dt className="text-slate-500">{t('cdx.admin.anchor.contractOperator')}</dt><dd className="font-mono">{s.contractOperator ?? '—'}</dd>
        </dl>
      )}
      {(st?.recent?.length ?? 0) > 0 && (
        <div className="mt-3 text-xs"><p className="font-semibold text-slate-600">{t('cdx.admin.anchor.recent')}</p>
          <ul className="mt-1 space-y-0.5">{st!.recent.map((a: Any) => <li key={`${a.stream}-${a.seq}`}>{a.at?.slice(0, 16).replace('T', ' ')} · {a.kind} · {a.stream} · <Ext href={a.explorer}>{short(a.txHash)}</Ext> · {t('cdx.admin.anchor.block', { block: a.blockNumber })}</li>)}</ul>
        </div>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold text-slate-600">{t('cdx.admin.anchor.streamTitle')}</p>
          <p className="text-[11px] text-slate-400">{t('cdx.admin.anchor.streamHelp')}</p>
          <div className="mt-1 flex gap-2"><input className={inp} value={stream} onChange={(e) => setStream(e.target.value)} /><button className={btn} disabled={busy || !stream.trim()} onClick={headNow}>{t('cdx.admin.anchor.streamButton')}</button></div>
          <button className={`${btn} mt-2`} disabled={busy} onClick={testNow}>{t('cdx.admin.anchor.testButton')}</button>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-600">{t('cdx.admin.anchor.p2pTitle')}</p>
          <p className="text-[11px] text-slate-400">{t('cdx.admin.anchor.p2pHelp')}</p>
          <div className="mt-1 grid grid-cols-2 gap-2"><input className={inp} value={poRef} onChange={(e) => setPoRef(e.target.value)} aria-label={t('cdx.admin.anchor.p2pRef')} /><input className={inp} value={lot} onChange={(e) => setLot(e.target.value)} aria-label={t('cdx.admin.anchor.p2pLot')} /></div>
          <textarea className={`${inp} mt-2 h-24 font-mono`} value={tickets} onChange={(e) => setTickets(e.target.value)} aria-label={t('cdx.admin.anchor.p2pTickets')} />
          <button className={`${btn} mt-2`} disabled={busy} onClick={p2pNow}>{t('cdx.admin.anchor.p2pButton')}</button>
        </div>
      </div>

      {last && <p className="mt-3 text-xs">{outcomeText(last)}{last.explorer && <> · <Ext href={last.explorer}>{short(last.txHash)}</Ext></>}</p>}
      {p2p?.record && (
        <div className="mt-3 overflow-x-auto text-xs">
          <p><span className="text-slate-500">{t('cdx.admin.anchor.matchHash')}</span> <span className="font-mono">{short(p2p.record.matchHash)}</span> · <span className="text-slate-500">{t('cdx.admin.anchor.positionsRoot')}</span> <span className="font-mono">{short(p2p.record.positionsRoot)}</span></p>
          <table className="mt-2 min-w-full"><thead><tr className="text-left text-slate-500"><th className="pr-3">{t('cdx.admin.anchor.p2pBuyer')}</th><th className="pr-3">{t('cdx.admin.anchor.p2pAllocated')}</th><th className="pr-3">{t('cdx.admin.anchor.p2pShare')}</th><th>{t('cdx.admin.anchor.p2pProof')}</th></tr></thead>
            <tbody>{p2p.positions.map((x: Any) => <tr key={x.buyerRef}><td className="pr-3">{x.buyerRef}</td><td className="pr-3">{(x.allocatedMinor / 100).toFixed(2)}</td><td className="pr-3">{(x.shareMicros / 10_000).toFixed(2)}%</td><td className={x.proofOk ? 'text-emerald-700' : 'text-red-700'}>{x.proofOk ? t('cdx.admin.anchor.p2pProofOk') : t('cdx.admin.anchor.p2pProofBad')} ({x.proof.length})</td></tr>)}</tbody>
          </table>
          {p2p.rejected?.length > 0 && <p className="mt-1 text-amber-700">{t('cdx.admin.anchor.p2pRejected')}: {p2p.rejected.map((r: Any) => `${r.buyerRef ?? r.id} (${r.reason})`).join(', ')}</p>}
        </div>
      )}
    </div>
  );
}
