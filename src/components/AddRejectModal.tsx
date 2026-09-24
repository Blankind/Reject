import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Search,
  Database,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Package,
  Calculator,
  Warehouse as WarehouseIcon,
  RotateCcw,
  ScanLine,
  Zap,
  Clock,
  Cpu,
  History,
  Barcode,
  Layers,
  MapPin,
  Camera,
  Image as ImageIcon,
  Upload,
  Eye,
  Trash2,
} from 'lucide-react';
import { ErpItem, ErpWarehouse } from '../types/erpnext';
import { RejectItemRecord, RejectReason, RejectStatus } from '../types/reject';
import { ErpNextService, ServerSearchResult, playBarcodeScanBeep } from '../services/erpnextService';
import { ExportService } from '../services/exportService';

interface AddRejectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveRecord: (record: Omit<RejectItemRecord, 'id' | 'createdAt' | 'updatedAt'>) => void;
  warehouses: ErpWarehouse[];
  onOpenErpConfig?: () => void;
}

const REJECT_REASONS: string[] = [
  'Bengkok / Deformasi Fisik',
  'Cacat Pabrik / Pengelasan (Weld Seam)',
  'Berkarat / Korosi Air Hujan',
  'Dimensi / Ketebalan Tidak Sesuai Toleransi',
  'Drat / Threading Rusak',
  'Retur Pelanggan (Salah Spesifikasi)',
  'Pecah / Keretakan Permukaan',
  'Penyok Akibat Handling / Forklift',
  'Lainnya / Other',
];

const REJECT_STATUSES: RejectStatus[] = [
  'Karantina Gudang',
  'Pengajuan Retur Pabrik',
  'Disetujui Retur Pabrik / Supplier',
  'Downgrade (Jual Pipa BS)',
  'Scrap / Besi Tua',
  'Selesai Diproses',
];

// Quick profile suggestions for steel & pipe distributors
const QUICK_PROFILE_SUGGESTIONS = [
  'Semua',
  'Pipa',
  'Spandek',
  'Galvanis',
  'C75',
  'Hollow',
  'Besi Beton',
  'Plat',
];

export const AddRejectModal: React.FC<AddRejectModalProps> = ({
  isOpen,
  onClose,
  onSaveRecord,
  warehouses,
  onOpenErpConfig,
}) => {
  const erpConfig = ErpNextService.getConfig();

  // Search input & results state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [itemsLoading, setItemsLoading] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<ErpItem[]>([]);
  const [telemetry, setTelemetry] = useState<{
    latencyMs: number;
    payloadSizeKb: number;
    fromCache: boolean;
    totalFound: number;
  }>({
    latencyMs: 0,
    payloadSizeKb: 0,
    fromCache: false,
    totalFound: 0,
  });

  // Recent Items Shelf (session memory of recently rejected items)
  const [recentItems, setRecentItems] = useState<ErpItem[]>([]);

  // Instant Barcode & SKU Resolver
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [isResolvingBarcode, setIsResolvingBarcode] = useState<boolean>(false);
  const [barcodeNotification, setBarcodeNotification] = useState<{
    type: 'success' | 'error';
    message: string;
    latencyMs: number;
    source?: string;
  } | null>(null);

  // Manual fallback input
  const [isManualInput, setIsManualInput] = useState<boolean>(false);
  const [manualItemCode, setManualItemCode] = useState<string>('');
  const [manualItemName, setManualItemName] = useState<string>('');

  // Selected Item
  const [selectedItem, setSelectedItem] = useState<ErpItem | null>(null);

  // Valuation Rate & Warehouse selection (Letak Reject)
  const [valuationRate, setValuationRate] = useState<number>(0);
  const [isCustomValuation, setIsCustomValuation] = useState<boolean>(false);
  const [sourceWarehouse, setSourceWarehouse] = useState<string>('');
  const [locationDetail, setLocationDetail] = useState<string>('');

  // Reject details - Default Kosong Tapi Wajib Diisi
  const [qty, setQty] = useState<number>(1);
  const [uom, setUom] = useState<string>('Batang');
  const [alasanReject, setAlasanReject] = useState<string>('');
  const [customAlasan, setCustomAlasan] = useState<string>('');
  const [keteranganAlasan, setKeteranganAlasan] = useState<string>('');
  const [status, setStatus] = useState<RejectStatus>('Karantina Gudang');
  const [pic, setPic] = useState<string>('');
  const [referenceDoc, setReferenceDoc] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Foto Bukti Barang Reject
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [photoFileName, setPhotoFileName] = useState<string>('');
  const [isCompressingPhoto, setIsCompressingPhoto] = useState<boolean>(false);
  const [isPreviewPhotoOpen, setIsPreviewPhotoOpen] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // Form Validation Error state (replaces blocked window.alert)
  const [formError, setFormError] = useState<string | null>(null);

  // Generated document number preview
  const [docNumber, setDocNumber] = useState<string>('');

  // Debounce ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);

  // Default warehouses when available
  useEffect(() => {
    if (warehouses && warehouses.length > 0) {
      if (!sourceWarehouse) {
        const defaultSource = warehouses.find((w) => w.name.includes('Utama')) || warehouses[0];
        setSourceWarehouse(defaultSource.name);
      }
    }
  }, [warehouses]);

  // Load recent items & generate doc number on open
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      setDocNumber(`REJ-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${randomSuffix}`);
      setRecentItems(ErpNextService.getRecentItems());
      setBarcodeNotification(null);
      setLocationDetail('');
      
      // Reset input fields to default kosong
      setAlasanReject('');
      setCustomAlasan('');
      setPic('');
      setPhotoUrl('');
      setPhotoFileName('');
      setReferenceDoc('');
      setNotes('');
      setFormError(null);
      
      // Initial server query with 20 items limit
      triggerServerSearch(searchQuery || '');
    }
  }, [isOpen]);

  // Execute Live Server-Side Search (Limit: 20, 300ms debounce)
  const triggerServerSearch = useCallback(async (query: string) => {
    setItemsLoading(true);
    try {
      const res: ServerSearchResult = await ErpNextService.searchItemsServerSide(query, 20);
      setSearchResults(res.items);
      setTelemetry({
        latencyMs: res.latencyMs,
        payloadSizeKb: res.payloadSizeKb,
        fromCache: !!res.fromCache,
        totalFound: res.totalFound || res.items.length,
      });

      // If no item selected yet, select first match
      if (res.items.length > 0 && !selectedItem) {
        handleSelectItem(res.items[0]);
      }
    } catch (err) {
      console.error('Server search failed:', err);
    } finally {
      setItemsLoading(false);
    }
  }, [selectedItem]);

  // Handle Search Input with 300ms Debounce
  const handleSearchInputChange = (val: string) => {
    setSearchQuery(val);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      triggerServerSearch(val);
    }, 300);
  };

  // Instant Barcode / SKU resolver
  const handleResolveBarcode = async (codeToResolve: string) => {
    const cleanCode = (codeToResolve || barcodeInput).trim();
    if (!cleanCode) return;

    setIsResolvingBarcode(true);
    setBarcodeNotification(null);

    try {
      const result = await ErpNextService.resolveBarcodeOrSku(cleanCode);
      if (result.item) {
        handleSelectItem(result.item);
        setRecentItems(ErpNextService.getRecentItems());
        setBarcodeNotification({
          type: 'success',
          message: `SKU / Barcode ditemukan: "${result.item.item_name}"`,
          latencyMs: result.latencyMs,
          source: result.source === 'session_cache' ? 'Cache Sesi Lokal' : 'Server ERPNext',
        });
        setBarcodeInput('');
      } else {
        setBarcodeNotification({
          type: 'error',
          message: `Item dengan kode "${cleanCode}" tidak ditemukan di database ERPNext.`,
          latencyMs: result.latencyMs,
        });
      }
    } catch (err: any) {
      setBarcodeNotification({
        type: 'error',
        message: err.message || 'Gagal memeriksa barcode ke ERPNext.',
        latencyMs: 0,
      });
    } finally {
      setIsResolvingBarcode(false);
    }
  };

  const handleSelectItem = async (item: ErpItem) => {
    setSelectedItem(item);
    setUom(item.stock_uom || 'Batang');
    ErpNextService.addRecentItem(item);
    setRecentItems(ErpNextService.getRecentItems());

    // Fetch warehouse-specific valuation rate from DocType Bin
    const rate = await ErpNextService.getItemValuationRate(item.item_code, sourceWarehouse);
    setValuationRate(rate || item.valuation_rate || 0);
    setIsCustomValuation(false);
  };

  const totalValue = qty * valuationRate;

  // Photo capture and compression
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressingPhoto(true);
    setPhotoFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1200;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.82);
          setPhotoUrl(compressed);
        } else {
          setPhotoUrl(event.target?.result as string);
        }
        setIsCompressingPhoto(false);
      };
      img.onerror = () => {
        setIsCompressingPhoto(false);
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      setIsCompressingPhoto(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (isManualInput) {
      if (!manualItemName.trim()) {
        setFormError('Nama Item manual wajib diisi terlebih dahulu!');
        return;
      }
    } else if (!selectedItem) {
      setFormError('Pilih salah satu item katalog ERPNext terlebih dahulu atau gunakan mode Input Manual!');
      return;
    }

    if (qty <= 0) {
      setFormError('Jumlah Qty Reject harus lebih dari 0!');
      return;
    }

    // Validasi Wajib Isi Alasan Reject & PIC
    if (!alasanReject || !alasanReject.trim()) {
      setFormError('Kategori kerusakan / alasan reject wajib dipilih!');
      return;
    }

    if (alasanReject === 'Lainnya / Other' && !customAlasan.trim()) {
      setFormError('Silakan ketikkan detail alasan kerusakan (Other) pada kolom yang disediakan!');
      return;
    }

    if (!pic || !pic.trim()) {
      setFormError('Nama Petugas Gudang (PIC) wajib diisi!');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const finalItemCode = isManualInput
      ? (manualItemCode || `MAN-${Date.now()}`).trim()
      : selectedItem!.item_code;
    const finalItemName = isManualInput
      ? manualItemName.trim()
      : selectedItem!.item_name;

    const finalNotes = [
      locationDetail ? `Letak Fisik: ${locationDetail}` : null,
      notes ? notes : null,
    ]
      .filter(Boolean)
      .join(' | ');

    const finalAlasan = alasanReject === 'Lainnya / Other'
      ? (customAlasan.trim() || 'Lainnya / Other')
      : (alasanReject as RejectReason);

    const finalKeterangan = alasanReject === 'Lainnya / Other'
      ? customAlasan.trim()
      : (keteranganAlasan || undefined);

    onSaveRecord({
      docNumber: docNumber || `REJ-${Date.now()}`,
      date: today,
      jenis: selectedItem?.brand || selectedItem?.item_group || searchQuery || 'Distributor',
      itemCode: finalItemCode,
      itemName: finalItemName,
      sourceWarehouse: sourceWarehouse || (warehouses[0]?.name ?? 'Gudang Utama'),
      targetWarehouse: locationDetail ? `Letak: ${locationDetail}` : (sourceWarehouse || 'Gudang Utama'),
      qty: Number(qty),
      uom: uom || 'Batang',
      valuationRate: Number(valuationRate),
      totalValue: Number(totalValue),
      alasanReject: finalAlasan,
      keteranganAlasan: finalKeterangan,
      status,
      pic: pic.trim(),
      referenceDoc,
      notes: finalNotes || undefined,
      photoUrl: photoUrl || undefined,
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-orange-600 flex items-center justify-center text-white shadow-md">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold">Input Item Reject Distributor</h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  On-Demand ERPNext
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Typeahead Autocomplete &bull; Scan Barcode &bull; DocType Bin Valuation Rate &bull; Warehouse Real
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Form Validation Warning Banner */}
          {formError && (
            <div className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-xl text-rose-800 text-xs font-semibold flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
              <button
                type="button"
                onClick={() => setFormError(null)}
                className="text-rose-500 hover:text-rose-700 p-1 rounded-md hover:bg-rose-100 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* ARCHITECTURE NOTICE: 4.000+ Items Server-Side Search Optimization */}
          <div className="bg-slate-900 text-slate-200 rounded-xl p-3 sm:p-4 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start sm:items-center gap-2.5">
              <Cpu className="w-4 h-4 text-orange-400 shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <span className="font-bold text-white">Arsitektur On-Demand Typeahead:</span>{' '}
                <span className="text-slate-300">
                  Katalog 4.000+ item tidak dimuat sekaligus ke RAM browser. Server Frappe mengembalikan 20 item teratas
                  dengan query ter-debounce 300 ms.
                </span>
              </div>
            </div>
            {telemetry.latencyMs > 0 && (
              <div className="flex items-center gap-2 shrink-0 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 text-[11px] font-mono text-emerald-400">
                <Zap className="w-3 h-3 text-amber-400" />
                <span>{telemetry.latencyMs}ms</span>
                <span>&bull;</span>
                <span>~{telemetry.payloadSizeKb} KB</span>
                {telemetry.fromCache && <span className="text-orange-400">(Cache)</span>}
              </div>
            )}
          </div>

          {/* SECTION 1: SCAN BARCODE & SKU RESOLVER INSTAN */}
          <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="text-xs font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                <Barcode className="w-4 h-4 text-amber-700" />
                <span>Scan Barcode &amp; SKU Resolver Instan</span>
              </label>
              <span className="text-[11px] text-amber-800 font-medium">
                Respon instan &lt; 100ms via direct API lookup
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <ScanLine className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-amber-600" />
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleResolveBarcode(barcodeInput);
                    }
                  }}
                  placeholder="Scan barcode fisik barang atau ketik exact SKU lalu tekan Enter..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-amber-300 rounded-lg text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>
              <button
                type="button"
                onClick={() => handleResolveBarcode(barcodeInput)}
                disabled={isResolvingBarcode || !barcodeInput.trim()}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
              >
                {isResolvingBarcode ? (
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Zap className="w-3.5 h-3.5" />
                )}
                <span>Resolve SKU</span>
              </button>
            </div>

            {/* Notification alert on barcode resolution */}
            {barcodeNotification && (
              <div
                className={`mt-2.5 px-3 py-2 rounded-lg text-xs flex items-center justify-between gap-2 ${
                  barcodeNotification.type === 'success'
                    ? 'bg-emerald-100/70 border border-emerald-300 text-emerald-950 font-medium'
                    : 'bg-rose-100 border border-rose-300 text-rose-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  {barcodeNotification.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{barcodeNotification.message}</span>
                </div>
                {barcodeNotification.latencyMs > 0 && (
                  <span className="text-[11px] font-mono text-slate-600 shrink-0">
                    ⚡ {barcodeNotification.latencyMs}ms ({barcodeNotification.source || 'Direct API'})
                  </span>
                )}
              </div>
            )}
          </div>

          {/* SECTION 2: LIVE SERVER-SIDE SEARCH (TYPEAHEAD AUTOCOMPLETE COMBOBOX) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-white text-[11px] font-bold flex items-center justify-center">
                  1
                </span>
                <span>Pencarian On-Demand &bull; Typeahead Combobox</span>
              </label>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 hidden sm:inline">
                  Batasan Payload: 20 Item (~2–3 KB)
                </span>
                <button
                  type="button"
                  onClick={() => setIsManualInput(!isManualInput)}
                  className="text-xs font-semibold px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer shrink-0"
                >
                  {isManualInput ? 'Beralih ke Server Search' : '+ Input Manual'}
                </button>
              </div>
            </div>

            {/* Quick Profile Suggestions Filter Pills */}
            {!isManualInput && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-400 mr-1 font-medium">Contoh Cepat:</span>
                {QUICK_PROFILE_SUGGESTIONS.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => {
                      const queryToUse = sug === 'Semua' ? '' : sug;
                      handleSearchInputChange(queryToUse);
                    }}
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                      (searchQuery === '' && sug === 'Semua') || searchQuery.toLowerCase() === sug.toLowerCase()
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-orange-50 hover:text-orange-700'
                    }`}
                  >
                    {sug}
                  </button>
                ))}
              </div>
            )}

            {!isManualInput ? (
              <>
                {/* Search input with 300ms debounce */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchInputChange(e.target.value)}
                    placeholder="Ketik kode barang, nama profil (misal: pipa, hollow, spandek, galv, c75)..."
                    className="w-full pl-9 pr-10 py-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
                  />
                  {itemsLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <RotateCcw className="w-4 h-4 animate-spin text-orange-600" />
                    </div>
                  )}
                </div>

                {/* Combobox Search Results List (Max 20 Items - Lightweight) */}
                <div className="max-h-52 overflow-y-auto border border-slate-200 bg-white rounded-lg divide-y divide-slate-100 shadow-inner">
                  {itemsLoading ? (
                    <div className="p-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                      <RotateCcw className="w-4 h-4 animate-spin text-orange-600" />
                      <span>Mengirim query ke backend ERPNext (Debounce 300ms &bull; Limit 20)...</span>
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500 space-y-2">
                      <p>
                        Tidak ada item yang cocok dengan &quot;{searchQuery}&quot; di 4.000+ katalog master ERPNext.
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsManualInput(true)}
                        className="text-orange-600 font-bold hover:underline cursor-pointer"
                      >
                        Klik di sini untuk input data reject secara manual
                      </button>
                    </div>
                  ) : (
                    searchResults.map((item) => {
                      const isSelected = selectedItem?.item_code === item.item_code;
                      return (
                        <div
                          key={item.item_code}
                          onClick={() => handleSelectItem(item)}
                          className={`p-2.5 sm:px-3.5 sm:py-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-orange-50/80 border-l-4 border-orange-600 text-orange-950 font-medium'
                              : 'hover:bg-slate-50 text-slate-800'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold truncate text-slate-900">
                                {item.item_name}
                              </span>
                              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                                {item.item_code}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                              <span>Grup: {item.item_group}</span>
                              {item.brand && (
                                <>
                                  <span>&bull;</span>
                                  <span>Brand: {item.brand}</span>
                                </>
                              )}
                              <span>&bull;</span>
                              <span>UOM: {item.stock_uom}</span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                              {ExportService.formatRupiah(item.valuation_rate)}
                            </span>
                            <div className="text-[10px] text-slate-400 mt-0.5">Valuation Rate</div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Selected Item Confirmation Card */}
                {selectedItem && (
                  <div className="p-3 bg-white rounded-lg border border-orange-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
                    <div className="flex items-center gap-2 text-slate-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <span className="text-[11px] text-slate-500 block">Item Terpilih untuk Dicatat:</span>
                        <strong className="text-orange-950 font-bold">{selectedItem.item_name}</strong>{' '}
                        <code className="font-mono text-slate-600 text-[11px]">({selectedItem.item_code})</code>
                      </div>
                    </div>
                    <div className="sm:text-right shrink-0">
                      <span className="text-[11px] text-slate-500 block">Valuation Rate DocType Bin:</span>
                      <strong className="text-emerald-700 font-bold text-sm">
                        {ExportService.formatRupiah(valuationRate)}
                      </strong>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="p-4 bg-white rounded-lg border border-slate-300 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Nama Item / Spesifikasi <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={manualItemName}
                      onChange={(e) => setManualItemName(e.target.value)}
                      placeholder="Contoh: Pipa Galvanis Medium 2 inch"
                      className="w-full text-xs py-2 px-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Kode Item ERP (Opsional)
                    </label>
                    <input
                      type="text"
                      value={manualItemCode}
                      onChange={(e) => setManualItemCode(e.target.value)}
                      placeholder="Contoh: SPD-GI-MED-200"
                      className="w-full text-xs py-2 px-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Riwayat Barang yang Baru Saja Di-reject (Recent Session Items) */}
            {recentItems.length > 0 && !isManualInput && (
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 mb-1.5">
                  <History className="w-3.5 h-3.5 text-slate-500" />
                  <span>Riwayat Barang Baru Saja Di-reject (1-Click Pilih Cepat):</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {recentItems.slice(0, 6).map((rec) => (
                    <button
                      key={rec.item_code}
                      type="button"
                      onClick={() => handleSelectItem(rec)}
                      className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer border ${
                        selectedItem?.item_code === rec.item_code
                          ? 'bg-orange-600 text-white border-orange-600'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {rec.item_name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3 & 4: WAREHOUSE & QUANTITY & VALUATION RATE */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* WAREHOUSE SELECTION (FROM ERPNEXT) */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-white text-[11px] font-bold flex items-center justify-center">
                  2
                </span>
                Letak / Lokasi Barang Reject
              </label>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                  <span>Gudang Letak Reject</span>
                </label>
                <select
                  value={sourceWarehouse}
                  onChange={(e) => {
                    setSourceWarehouse(e.target.value);
                    if (selectedItem) {
                      ErpNextService.getItemValuationRate(selectedItem.item_code, e.target.value).then((rate) => {
                        if (rate) setValuationRate(rate);
                      });
                    }
                  }}
                  className="w-full text-xs py-2 px-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium cursor-pointer"
                >
                  {warehouses.map((wh) => (
                    <option key={wh.name} value={wh.name}>
                      {wh.warehouse_name} ({wh.name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Detail Posisi / Letak Fisik (Opsional)
                </label>
                <input
                  type="text"
                  value={locationDetail}
                  onChange={(e) => setLocationDetail(e.target.value)}
                  placeholder="Contoh: Rak B-03, Baris 2, Lorong Belakang"
                  className="w-full text-xs py-2 px-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="pt-1 text-[11px] text-slate-500 flex items-center gap-1.5">
                <WarehouseIcon className="w-3.5 h-3.5 text-slate-400" />
                <span>Gudang letak reject terhubung langsung ke Master Warehouse ERPNext.</span>
              </div>
            </div>

            {/* QTY & VALUATION RATE AUTO-CALCULATION */}
            <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 space-y-3">
              <label className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-emerald-700 text-white text-[11px] font-bold flex items-center justify-center">
                  3
                </span>
                Valuation Rate &amp; Nilai Kerugian
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Qty Reject
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      value={qty}
                      onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
                      className="w-full text-sm font-bold text-slate-800 py-1.5 px-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <span className="text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-2 py-2 rounded-lg">
                      {uom}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-700">Valuation Rate</label>
                    <button
                      type="button"
                      onClick={() => setIsCustomValuation(!isCustomValuation)}
                      className="text-[10px] text-emerald-700 hover:underline cursor-pointer"
                    >
                      {isCustomValuation ? 'Otomatis ERPNext' : 'Ubah Manual'}
                    </button>
                  </div>
                  <input
                    type="number"
                    disabled={!isCustomValuation}
                    value={valuationRate}
                    onChange={(e) => setValuationRate(Number(e.target.value))}
                    className={`w-full text-xs py-1.5 px-3 rounded-lg border font-mono ${
                      isCustomValuation
                        ? 'bg-white border-orange-400 text-slate-900 font-bold'
                        : 'bg-emerald-100/50 border-emerald-300 text-emerald-950 font-bold'
                    }`}
                  />
                </div>
              </div>

              {/* Total Calculation Display */}
              <div className="p-3 bg-white rounded-lg border border-emerald-200 mt-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600 flex items-center gap-1">
                    <Calculator className="w-3.5 h-3.5 text-emerald-600" />
                    Total Nilai Kerugian:
                  </span>
                  <span className="text-base font-extrabold text-rose-600">
                    {ExportService.formatRupiah(totalValue)}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                  <span>Rumus: {qty} {uom} &times; {ExportService.formatRupiah(valuationRate)}</span>
                  <span className="text-emerald-700 font-medium">Real-time Bin</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 5: ALASAN REJECT & DISPOSISI */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-slate-800 text-white text-[11px] font-bold flex items-center justify-center">
                4
              </span>
              Alasan Reject, PIC &amp; Bukti Foto
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Kategori Kerusakan / Alasan Reject</span>
                  <span className="text-[10px] text-rose-500 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                    * Wajib Isi
                  </span>
                </label>
                <select
                  required
                  value={alasanReject}
                  onChange={(e) => {
                    setAlasanReject(e.target.value);
                    if (e.target.value !== 'Lainnya / Other') {
                      setCustomAlasan('');
                    }
                  }}
                  className={`w-full text-xs py-2 px-3 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium cursor-pointer transition-colors ${
                    !alasanReject
                      ? 'border-amber-400 bg-amber-50/20 text-slate-500 font-normal'
                      : 'border-slate-300 text-slate-800'
                  }`}
                >
                  <option value="" disabled>
                    -- Pilih Kategori Kerusakan (Wajib Isi) --
                  </option>
                  {REJECT_REASONS.map((r) => (
                    <option key={r} value={r} className="text-slate-800 font-medium">
                      {r}
                    </option>
                  ))}
                </select>

                {/* Other / Lainnya: Input khusus ketik sendiri */}
                {alasanReject === 'Lainnya / Other' && (
                  <div className="mt-2.5 p-2.5 bg-orange-50 border border-orange-200 rounded-lg space-y-1">
                    <label className="block text-[11px] font-bold text-orange-950 flex items-center justify-between">
                      <span>Ketikkan Alasan Kerusakan Sendiri:</span>
                      <span className="text-[10px] text-rose-600 font-bold">* Wajib Diisi</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={customAlasan}
                      onChange={(e) => setCustomAlasan(e.target.value)}
                      placeholder="Contoh: Sambungan las bocor halus, lapisan galvanis terkelupas, dll."
                      className="w-full text-xs py-1.5 px-3 bg-white border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium text-slate-800"
                      autoFocus
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Status Disposisi
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as RejectStatus)}
                  className="w-full text-xs py-2 px-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium cursor-pointer"
                >
                  {REJECT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Petugas Gudang (PIC)</span>
                  <span className="text-[10px] text-rose-500 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                    * Wajib Isi
                  </span>
                </label>
                <input
                  type="text"
                  required
                  value={pic}
                  onChange={(e) => setPic(e.target.value)}
                  placeholder="Nama petugas pencatat / pemeriksa (Wajib isi)"
                  className={`w-full text-xs py-2 px-3 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors font-medium ${
                    !pic.trim()
                      ? 'border-amber-400 bg-amber-50/20 text-slate-700'
                      : 'border-slate-300 text-slate-800'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  No. Surat Jalan / Referensi Doctype
                </label>
                <input
                  type="text"
                  value={referenceDoc}
                  onChange={(e) => setReferenceDoc(e.target.value)}
                  placeholder="Contoh: SJ-2026/0411 atau PO-DISTRI-009"
                  className="w-full text-xs py-2 px-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Catatan Teknis Tambahan
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan inspeksi: lokasi cacat, nomor bundle, hasil tes kelurusan, dll."
                className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* FOTO BUKTI BARANG REJECT */}
            <div className="pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-orange-600" />
                  <span>Foto Bukti Fisik Barang Reject</span>
                </label>
                <span className="text-[11px] text-slate-500 font-normal">
                  Kamera Langsung / Upload Galeri (JPG, PNG, WEBP)
                </span>
              </div>

              {/* Hidden File Inputs for Camera & File Picker */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoSelect}
                className="hidden"
              />

              {!photoUrl ? (
                <div className="border-2 border-dashed border-slate-300 hover:border-orange-400 bg-white rounded-xl p-4 transition-colors">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          Lampirkan Foto Bukti Kerusakan Fisik Barang
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Foto otomatis dikompresi beresolusi tinggi dan siap tampil di spreadsheet &amp; berita acara
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        disabled={isCompressingPhoto}
                        className="flex-1 sm:flex-initial px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Buka Kamera</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isCompressingPhoto}
                        className="flex-1 sm:flex-initial px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Pilih File</span>
                      </button>
                    </div>
                  </div>
                  {isCompressingPhoto && (
                    <div className="mt-2 text-center text-xs text-orange-600 font-medium">
                      Mengompresi dan memproses foto...
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white border border-slate-300 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div
                      onClick={() => setIsPreviewPhotoOpen(true)}
                      className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 cursor-pointer group shrink-0"
                      title="Klik untuk memperbesar foto bukti"
                    >
                      <img
                        src={photoUrl}
                        alt="Bukti Reject"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                        <Eye className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-800 truncate">
                          {photoFileName || 'Foto Bukti Kerusakan'}
                        </span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                          Tersimpan
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Klik thumbnail untuk melihat foto ukuran penuh
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => setIsPreviewPhotoOpen(true)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Lihat Penuh</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Ganti</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoUrl('');
                        setPhotoFileName('');
                      }}
                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col-reverse sm:flex-row items-center justify-end gap-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer text-center"
            >
              Batal
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-2.5 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Catat ke Spreadsheet</span>
            </button>
          </div>
        </form>
      </div>

      {/* Lightbox Preview Foto Bukti Kerusakan */}
      {isPreviewPhotoOpen && photoUrl && (
        <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh] shadow-2xl">
            <div className="p-3.5 border-b border-slate-800 flex items-center justify-between text-white bg-slate-950">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-orange-400" />
                <span className="text-xs font-bold">Bukti Foto Fisik Kerusakan Barang Reject</span>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewPhotoOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-black/60 overflow-auto flex-1">
              <img
                src={photoUrl}
                alt="Bukti Kerusakan Penuh"
                className="max-h-[72vh] max-w-full object-contain rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
