import { FormEvent, useEffect, useRef, useState } from 'react';
import { Loader2, PackagePlus, Search, X } from 'lucide-react';
import { api, num, rupiah, uid } from '../api';
import { ErpItem, REASONS, RejectRecord } from '../types';

const LS_PIC = 'reject_pic';
const LS_WH = 'reject_wh';

const field =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20';
const label = 'mb-1 block text-xs font-bold text-slate-600';

export default function RejectModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (r: RejectRecord) => void;
}) {
  const [id] = useState(uid); // id tetap selama modal terbuka -> anti double submit
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ErpItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState('');
  const [item, setItem] = useState<ErpItem | null>(null);
  const [manual, setManual] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualName, setManualName] = useState('');

  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [warehouse, setWarehouse] = useState(localStorage.getItem(LS_WH) || '');
  const [qty, setQty] = useState('1');
  const [uom, setUom] = useState('Pcs');
  const [rate, setRate] = useState('0');
  const [reason, setReason] = useState('');
  const [reasonOther, setReasonOther] = useState('');
  const [pic, setPic] = useState(localStorage.getItem(LS_PIC) || '');
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [rateLoading, setRateLoading] = useState(false);
  const [error, setError] = useState('');
  const seq = useRef(0);

  useEffect(() => {
    api.warehouses().then(setWarehouses).catch(() => {});
  }, []);

  // Ambil valuation rate dari ERP berdasarkan item + gudang yang dipilih (Bin gudang -> fallback Item master).
  // Jalan ulang tiap kali item atau gudang berganti.
  useEffect(() => {
    if (manual || !item || !warehouse.trim()) return;
    let alive = true;
    setRateLoading(true);
    api
      .rate(item.item_code, warehouse.trim())
      .then(({ rate: r }) => {
        if (alive) setRate(String(r));
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setRateLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [item, warehouse, manual]);

  // Typeahead item (debounce 300ms, abaikan respons usang)
  useEffect(() => {
    if (item || manual) return;
    const n = ++seq.current;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const list = await api.items(query);
        if (n === seq.current) {
          setResults(list);
          setSearchErr('');
        }
      } catch (e) {
        if (n === seq.current) {
          setResults([]);
          setSearchErr((e as Error).message);
        }
      } finally {
        if (n === seq.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, item, manual]);

  const pick = (i: ErpItem) => {
    setItem(i);
    setUom(i.stock_uom || 'Pcs');
    setRate(String(i.valuation_rate || 0));
  };

  const total = (Number(qty) || 0) * (Number(rate) || 0);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const itemCode = manual ? manualCode.trim() : item?.item_code || '';
    const itemName = manual ? manualName.trim() : item?.item_name || '';
    const finalReason = reason === 'Lainnya' ? reasonOther.trim() || 'Lainnya' : reason;
    if (!itemCode && !itemName) return setError('Pilih item atau isi manual.');
    if (!warehouse.trim()) return setError('Gudang wajib diisi.');
    if (!(Number(qty) > 0)) return setError('Qty harus lebih dari 0.');
    if (!finalReason) return setError('Pilih alasan reject.');
    if (!pic.trim()) return setError('PIC wajib diisi.');

    setSaving(true);
    try {
      const rec = await api.create({
        id,
        itemCode,
        itemName,
        warehouse: warehouse.trim(),
        qty: Number(qty),
        uom,
        rate: Number(rate) || 0,
        reason: finalReason,
        pic: pic.trim(),
        notes,
      });
      localStorage.setItem(LS_PIC, pic.trim());
      localStorage.setItem(LS_WH, warehouse.trim());
      onSaved(rec);
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={submit}
        className="flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between bg-slate-900 px-5 py-3.5 text-white">
          <div className="flex items-center gap-2.5">
            <PackagePlus className="h-5 w-5 text-orange-400" />
            <h2 className="text-sm font-extrabold">Input Item Reject</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-white/10" aria-label="Tutup">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          {/* ITEM */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">
                Item <span className="text-rose-500">*</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setManual(!manual);
                  setItem(null);
                }}
                className="text-[11px] font-bold text-orange-600 hover:underline"
              >
                {manual ? 'Cari dari ERP' : 'Input manual'}
              </button>
            </div>

            {manual ? (
              <div className="grid grid-cols-2 gap-2">
                <input className={field} placeholder="Kode (opsional)" value={manualCode} onChange={(e) => setManualCode(e.target.value)} />
                <input className={field} placeholder="Nama item" value={manualName} onChange={(e) => setManualName(e.target.value)} />
              </div>
            ) : item ? (
              <div className="flex items-center justify-between rounded-lg border border-orange-300 bg-orange-50 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold">{item.item_name}</div>
                  <div className="text-[11px] text-slate-500">
                    {item.item_code} · {rupiah(item.valuation_rate)}/{item.stock_uom}
                  </div>
                </div>
                <button type="button" onClick={() => setItem(null)} className="ml-2 text-xs font-bold text-orange-700 hover:underline">
                  Ganti
                </button>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    className={`${field} pl-9`}
                    placeholder="Cari kode / nama item…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    autoFocus
                  />
                  {searching && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-slate-400" />}
                </div>
                <ul className="mt-1.5 max-h-44 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                  {results.map((i) => (
                    <li key={i.item_code}>
                      <button type="button" onClick={() => pick(i)} className="block w-full px-3 py-2 text-left hover:bg-orange-50">
                        <div className="truncate text-sm font-semibold">{i.item_name}</div>
                        <div className="text-[11px] text-slate-500">
                          {i.item_code} · {i.stock_uom} · {rupiah(i.valuation_rate)}
                        </div>
                      </button>
                    </li>
                  ))}
                  {!results.length && !searching && (
                    <li className="px-3 py-3 text-center text-xs text-slate-400">
                      {searchErr || 'Item tidak ditemukan.'}
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>

          {/* GUDANG */}
          <div>
            <label className={label}>
              Gudang <span className="text-rose-500">*</span>
            </label>
            <input className={field} list="wh-list" placeholder="Pilih / ketik gudang" value={warehouse} onChange={(e) => setWarehouse(e.target.value)} />
            <datalist id="wh-list">
              {warehouses.map((w) => (
                <option key={w} value={w} />
              ))}
            </datalist>
          </div>

          {/* QTY / UOM / RATE */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={label}>
                Qty <span className="text-rose-500">*</span>
              </label>
              <input className={field} type="number" inputMode="decimal" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <div>
              <label className={label}>Satuan</label>
              <input className={field} value={uom} onChange={(e) => setUom(e.target.value)} />
            </div>
            <div>
              <label className={label}>Rate (Rp)</label>
              <div className="relative">
                <input className={field} type="number" inputMode="decimal" min="0" step="any" value={rate} onChange={(e) => setRate(e.target.value)} />
                {rateLoading && <Loader2 className="absolute right-2.5 top-3 h-4 w-4 animate-spin text-slate-400" />}
              </div>
            </div>
          </div>
          <div className="-mt-2 text-right text-xs text-slate-500">
            Total: <b className="text-slate-900">{rupiah(total)}</b>
            {rateLoading && <span className="ml-1 text-slate-400">(mengambil rate dari ERP · gudang {warehouse}…)</span>}
            {!rateLoading && Number(rate) === 0 && <span className="ml-1 text-slate-400">(rate 0 → diambil dari ERP saat simpan)</span>}
          </div>

          {/* ALASAN */}
          <div>
            <label className={label}>
              Alasan / Jenis Reject <span className="text-rose-500">*</span>
            </label>
            <select className={field} value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">— pilih —</option>
              {REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
            {reason === 'Lainnya' && (
              <input className={`${field} mt-2`} placeholder="Tulis alasan" value={reasonOther} onChange={(e) => setReasonOther(e.target.value)} />
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={label}>
                PIC <span className="text-rose-500">*</span>
              </label>
              <input className={field} placeholder="Nama petugas" value={pic} onChange={(e) => setPic(e.target.value)} />
            </div>
            <div>
              <label className={label}>Catatan</label>
              <input className={field} placeholder="Opsional" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</div>}
        </div>

        <div className="flex gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100">
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex flex-[2] items-center justify-center gap-2 rounded-lg bg-orange-600 py-2.5 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Menyimpan & sync…' : `Simpan (${num(Number(qty) || 0)} ${uom})`}
          </button>
        </div>
      </form>
    </div>
  );
}
