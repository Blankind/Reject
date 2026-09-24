import { useCallback, useEffect, useState } from 'react';
import { PackagePlus, PackageX, RefreshCw, Settings } from 'lucide-react';
import { api } from './api';
import type { Meta, RejectRecord } from './types';
import Dashboard from './components/Dashboard';
import RejectModal from './components/RejectModal';
import SettingsModal from './components/SettingsModal';

export default function App() {
  const [records, setRecords] = useState<RejectRecord[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);

  const say = (text: string, ok = true) => {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    try {
      setRecords(await api.rejects());
    } catch (e) {
      say((e as Error).message, false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api.meta().then(setMeta).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const onSaved = (r: RejectRecord) => {
    setRecords((prev) => [r, ...prev.filter((x) => x.id !== r.id)]);
    const bad = r.erpStatus === 'failed' || r.sheetStatus === 'failed';
    say(
      bad ? `${r.docNumber} tersimpan, sync gagal (bisa di-retry).` : `${r.docNumber} tersimpan & tersinkron.`,
      !bad,
    );
  };

  const retry = async () => {
    setRetrying(true);
    try {
      const { retried } = await api.retry();
      say(`Retry ${retried} dokumen selesai.`);
      await load();
    } catch (e) {
      say((e as Error).message, false);
    } finally {
      setRetrying(false);
    }
  };

  const failed = records.filter((r) => r.erpStatus === 'failed' || r.sheetStatus === 'failed').length;

  return (
    <div className="min-h-screen pb-28">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-600 text-white">
              <PackageX className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-extrabold">Reject Dashboard</div>
              <div className="text-[11px] text-slate-500">
                ERP {meta?.erpConfigured ? '●' : '○'} · Sheets {meta?.sheetConfigured ? '●' : '○'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {failed > 0 && (
              <button
                onClick={retry}
                disabled={retrying}
                className="flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${retrying ? 'animate-spin' : ''}`} />
                Retry sync ({failed})
              </button>
            )}
            <button
              onClick={() => setSettingsOpen(true)}
              title="Pengaturan & cek koneksi"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              onClick={load}
              title="Muat ulang"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5">
        <Dashboard records={records} loading={loading} sheetUrl={meta?.sheetUrl || ''} />
      </main>

      <button
        onClick={() => setOpen(true)}
        title="Input item reject"
        aria-label="Input item reject"
        className="fixed bottom-6 right-6 z-30 flex h-16 w-16 items-center justify-center rounded-full bg-orange-600 text-white shadow-xl shadow-orange-600/30 transition hover:scale-105 hover:bg-orange-700 active:scale-95"
      >
        <PackagePlus className="h-7 w-7" />
      </button>

      {settingsOpen && (
        <SettingsModal
          onClose={() => {
            setSettingsOpen(false);
            api.meta().then(setMeta).catch(() => {});
          }}
        />
      )}

      {open && <RejectModal onClose={() => setOpen(false)} onSaved={onSaved} />}

      {toast && (
        <div
          className={`fixed bottom-28 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-lg ${
            toast.ok ? 'bg-slate-900' : 'bg-rose-600'
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
