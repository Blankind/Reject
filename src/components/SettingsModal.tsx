import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, MinusCircle, RefreshCw, X, XCircle } from 'lucide-react';
import { api, CheckReport, CheckResult } from '../api';

function Card({ title, r, loading }: { title: string; r?: CheckResult; loading: boolean }) {
  const state = loading || !r ? 'loading' : r.skipped ? 'skip' : r.ok ? 'ok' : 'fail';
  const style = {
    loading: 'border-slate-200 bg-white',
    ok: 'border-emerald-300 bg-emerald-50/50',
    fail: 'border-rose-300 bg-rose-50/60',
    skip: 'border-slate-200 bg-slate-50',
  }[state];
  const Icon = { loading: Loader2, ok: CheckCircle2, fail: XCircle, skip: MinusCircle }[state];
  const iconCls = {
    loading: 'animate-spin text-slate-400',
    ok: 'text-emerald-600',
    fail: 'text-rose-600',
    skip: 'text-slate-400',
  }[state];
  const label = { loading: 'Mengecek…', ok: 'Terhubung', fail: 'Gagal', skip: 'Tidak aktif' }[state];

  return (
    <section className={`rounded-xl border p-4 ${style}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold">{title}</h3>
        <span className="flex items-center gap-1.5 text-xs font-bold">
          <Icon className={`h-4 w-4 ${iconCls}`} />
          {label}
        </span>
      </div>

      {r && !loading && (
        <>
          <p
            className={`mt-2 break-words text-xs font-semibold ${
              r.ok ? 'text-emerald-800' : r.skipped ? 'text-slate-500' : 'text-rose-700'
            }`}
          >
            {r.message}
          </p>
          <dl className="mt-3 space-y-1 text-[11px]">
            {Object.entries(r.details).map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="w-28 shrink-0 text-slate-500">{k}</dt>
                <dd className="min-w-0 break-all font-semibold text-slate-700">{v}</dd>
              </div>
            ))}
          </dl>
          {r.url && (
            <a
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline"
            >
              Buka Spreadsheet <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </>
      )}
    </section>
  );
}

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const [report, setReport] = useState<CheckReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const run = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setReport(await api.check());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/60 sm:items-center sm:p-4">
      <div className="flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between bg-slate-900 px-5 py-3.5 text-white">
          <h2 className="text-sm font-extrabold">Pengaturan · Cek Koneksi</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-white/10" aria-label="Tutup">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto p-5">
          <Card title="Google Spreadsheet" r={report?.sheets} loading={loading} />
          <Card title="ERPNext" r={report?.erp} loading={loading} />
          {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</div>}
          <p className="text-[11px] leading-relaxed text-slate-500">
            Kredensial diatur di file <code className="rounded bg-slate-100 px-1">.env</code> di server. Setelah
            mengubahnya, restart server lalu tekan Cek ulang.
          </p>
        </div>

        <div className="flex gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100"
          >
            Tutup
          </button>
          <button
            onClick={run}
            disabled={loading}
            className="flex flex-[2] items-center justify-center gap-2 rounded-lg bg-slate-900 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Cek ulang
          </button>
        </div>
      </div>
    </div>
  );
}
