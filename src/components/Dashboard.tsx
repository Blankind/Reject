import { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { RejectRecord, SyncState } from '../types';
import { num, rupiah } from '../api';

type Period = 'today' | '7d' | '30d' | 'all';
const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Hari ini' },
  { key: '7d', label: '7 hari' },
  { key: '30d', label: '30 hari' },
  { key: 'all', label: 'Semua' },
];

const ymd = (d: Date) => d.toLocaleDateString('sv-SE');

function cutoff(p: Period): string {
  if (p === 'all') return '0000-00-00';
  const d = new Date();
  if (p === '7d') d.setDate(d.getDate() - 6);
  if (p === '30d') d.setDate(d.getDate() - 29);
  return ymd(d);
}

function group(rows: RejectRecord[], key: (r: RejectRecord) => string) {
  const m = new Map<string, { qty: number; total: number; n: number }>();
  for (const r of rows) {
    const k = key(r) || '-';
    const v = m.get(k) || { qty: 0, total: 0, n: 0 };
    v.qty += r.qty;
    v.total += r.total;
    v.n += 1;
    m.set(k, v);
  }
  return [...m.entries()].map(([label, v]) => ({ label, ...v })).sort((a, b) => b.total - a.total || b.qty - a.qty);
}

function Bars({ data, color }: { data: { label: string; qty: number; total: number }[]; color: string }) {
  const max = Math.max(...data.map((d) => d.total || d.qty), 1);
  if (!data.length) return <p className="py-6 text-center text-sm text-slate-400">Belum ada data</p>;
  return (
    <ul className="space-y-3">
      {data.slice(0, 6).map((d) => (
        <li key={d.label}>
          <div className="mb-1 flex justify-between gap-3 text-xs">
            <span className="truncate font-semibold text-slate-700">{d.label}</span>
            <span className="shrink-0 text-slate-500">
              {num(d.qty)} · {rupiah(d.total)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className={`h-2 rounded-full ${color}`} style={{ width: `${((d.total || d.qty) / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Badge({ label, state, title }: { label: string; state: SyncState; title?: string }) {
  const cls: Record<SyncState, string> = {
    ok: 'bg-emerald-50 text-emerald-700',
    failed: 'bg-rose-50 text-rose-700',
    pending: 'bg-amber-50 text-amber-700',
    skipped: 'bg-slate-100 text-slate-500',
  };
  return (
    <span title={title} className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${cls[state]}`}>
      {label} {state === 'ok' ? '✓' : state === 'failed' ? '✕' : state === 'skipped' ? '–' : '…'}
    </span>
  );
}

export default function Dashboard({
  records,
  loading,
  sheetUrl,
}: {
  records: RejectRecord[];
  loading: boolean;
  sheetUrl: string;
}) {
  const [period, setPeriod] = useState<Period>('7d');

  const rows = useMemo(() => {
    const c = cutoff(period);
    return records.filter((r) => r.date >= c);
  }, [records, period]);

  const totalQty = rows.reduce((a, r) => a + r.qty, 0);
  const totalValue = rows.reduce((a, r) => a + r.total, 0);
  const byItem = useMemo(() => group(rows, (r) => r.itemName), [rows]);
  const byReason = useMemo(() => group(rows, (r) => r.reason), [rows]);

  const trend = useMemo(() => {
    const days: { date: string; total: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({ date: ymd(d), total: 0 });
    }
    for (const r of records) {
      const d = days.find((x) => x.date === r.date);
      if (d) d.total += r.total || r.qty;
    }
    return days;
  }, [records]);
  const trendMax = Math.max(...trend.map((d) => d.total), 1);

  const cards = [
    { label: 'Total Nilai Reject', value: rupiah(totalValue), tone: 'text-rose-600' },
    { label: 'Total Qty', value: num(totalQty), tone: 'text-amber-600' },
    { label: 'Dokumen', value: num(rows.length), tone: 'text-slate-900' },
    {
      label: 'Item Terbanyak',
      value: byItem[0]?.label || '-',
      tone: 'text-slate-900',
      small: true,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg bg-white p-1 shadow-sm ring-1 ring-slate-200">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
                period === p.key ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {sheetUrl && (
          <a
            href={sheetUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:underline"
          >
            Buka Spreadsheet <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{c.label}</div>
            <div
              className={`mt-2 font-extrabold tracking-tight ${c.tone} ${
                c.small ? 'line-clamp-2 text-sm leading-snug' : 'text-xl sm:text-2xl'
              }`}
            >
              {loading ? '…' : c.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-extrabold">Per Item</h3>
          <Bars data={byItem} color="bg-orange-500" />
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-extrabold">Per Alasan</h3>
          <Bars data={byReason} color="bg-rose-500" />
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-extrabold">Tren 14 Hari</h3>
          <div className="flex h-32 items-end gap-1">
            {trend.map((d) => (
              <div key={d.date} className="group relative flex h-full flex-1 items-end" title={`${d.date}: ${num(d.total)}`}>
                <div
                  className="w-full rounded-t bg-slate-800 transition group-hover:bg-orange-600"
                  style={{ height: `${Math.max((d.total / trendMax) * 100, d.total ? 4 : 1)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-slate-400">
            <span>{trend[0].date.slice(5)}</span>
            <span>{trend[trend.length - 1].date.slice(5)}</span>
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <h3 className="border-b border-slate-100 px-4 py-3 text-sm font-extrabold">Input Terbaru</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2">Dokumen</th>
                <th className="px-4 py-2">Item</th>
                <th className="px-4 py-2">Gudang</th>
                <th className="px-4 py-2 text-right">Qty</th>
                <th className="px-4 py-2 text-right">Nilai</th>
                <th className="px-4 py-2">Alasan</th>
                <th className="px-4 py-2">Sync</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.slice(0, 15).map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <div className="font-bold">{r.docNumber}</div>
                    <div className="text-[11px] text-slate-400">
                      {r.date} {r.time} · {r.pic}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="font-semibold">{r.itemName}</div>
                    <div className="text-[11px] text-slate-400">{r.itemCode}</div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{r.warehouse}</td>
                  <td className="px-4 py-2.5 text-right font-semibold">
                    {num(r.qty)} <span className="text-xs font-normal text-slate-400">{r.uom}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right">{rupiah(r.total)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.reason}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      <Badge label="ERP" state={r.erpStatus} title={r.erpError || r.erpDoc} />
                      <Badge label="Sheet" state={r.sheetStatus} title={r.sheetError} />
                    </div>
                  </td>
                </tr>
              ))}
              {!records.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    {loading ? 'Memuat…' : 'Belum ada input. Tekan tombol oranye di kanan bawah.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
