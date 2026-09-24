import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Copy,
  Trash2,
  Edit2,
  Check,
  Search,
  Filter,
  ArrowUpDown,
  Plus,
  ExternalLink,
  ChevronDown,
  Info,
  MapPin,
  RefreshCw,
  Camera,
  Eye,
  X,
  Smartphone,
} from 'lucide-react';
import { RejectItemRecord, RejectStatus, RejectReason } from '../types/reject';
import { ErpWarehouse } from '../types/erpnext';
import { ExportService } from '../services/exportService';
import { SharedSyncService } from '../services/sharedSyncService';

interface SpreadsheetViewProps {
  records: RejectItemRecord[];
  warehouses: ErpWarehouse[];
  onUpdateRecord: (id: string, updatedFields: Partial<RejectItemRecord>) => void;
  onDeleteRecord: (id: string) => void;
  onOpenAddModal: () => void;
  onCopyGoogleSheets: () => void;
  onExportExcel: () => void;
  onExportCsv: () => void;
  onOpenGoogleSheetsModal: () => void;
  onOpenMultiDeviceModal?: () => void;
  onOpenGoogleServiceAccountModal?: () => void;
  spreadsheetUrl?: string;
  onPullGoogleSheets?: () => void;
  isPullingSheets?: boolean;
}

export const SpreadsheetView: React.FC<SpreadsheetViewProps> = ({
  records,
  warehouses,
  onUpdateRecord,
  onDeleteRecord,
  onOpenAddModal,
  onCopyGoogleSheets,
  onExportExcel,
  onExportCsv,
  onOpenGoogleSheetsModal,
  onOpenMultiDeviceModal,
  onOpenGoogleServiceAccountModal,
  spreadsheetUrl = '',
  onPullGoogleSheets,
  isPullingSheets = false,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [jenisFilter, setJenisFilter] = useState<string>('all');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Inline Editing State
  const [editingCell, setEditingCell] = useState<{ id: string; field: keyof RejectItemRecord } | null>(null);
  const [editValue, setEditValue] = useState<string | number>('');

  // Modal Viewing Photo Bukti Barang
  const [viewingPhotoRecord, setViewingPhotoRecord] = useState<RejectItemRecord | null>(null);

  // Filtering
  const filteredRecords = records.filter((r) => {
    // Search query
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchDoc = r.docNumber.toLowerCase().includes(q);
      const matchItem = r.itemName.toLowerCase().includes(q) || r.itemCode.toLowerCase().includes(q);
      const matchJenis = r.jenis.toLowerCase().includes(q);
      const matchReason = r.alasanReject.toLowerCase().includes(q);
      const matchPic = r.pic.toLowerCase().includes(q);
      if (!matchDoc && !matchItem && !matchJenis && !matchReason && !matchPic) {
        return false;
      }
    }

    // Jenis filter
    if (jenisFilter !== 'all') {
      if (r.jenis.toLowerCase() !== jenisFilter.toLowerCase()) {
        return false;
      }
    }

    // Warehouse filter
    if (warehouseFilter !== 'all') {
      if (r.sourceWarehouse !== warehouseFilter && r.targetWarehouse !== warehouseFilter) {
        return false;
      }
    }

    // Status filter
    if (statusFilter !== 'all') {
      if (r.status !== statusFilter) {
        return false;
      }
    }

    return true;
  });

  // Calculate totals for bottom sheet footer
  const totalFilteredQty = filteredRecords.reduce((acc, r) => acc + (Number(r.qty) || 0), 0);
  const totalFilteredValue = filteredRecords.reduce((acc, r) => acc + (Number(r.totalValue) || 0), 0);

  // Inline edit handlers
  const handleStartEdit = (id: string, field: keyof RejectItemRecord, currentValue: any) => {
    setEditingCell({ id, field });
    setEditValue(currentValue);
  };

  const handleSaveEdit = (record: RejectItemRecord) => {
    if (!editingCell) return;
    const { field, id } = editingCell;

    let updatedFields: Partial<RejectItemRecord> = {};

    if (field === 'qty') {
      const newQty = Math.max(1, Number(editValue) || 1);
      const newTotal = newQty * (record.valuationRate || 0);
      updatedFields = { qty: newQty, totalValue: newTotal };
    } else if (field === 'valuationRate') {
      const newRate = Math.max(0, Number(editValue) || 0);
      const newTotal = (record.qty || 0) * newRate;
      updatedFields = { valuationRate: newRate, totalValue: newTotal };
    } else {
      updatedFields = { [field]: editValue };
    }

    onUpdateRecord(id, updatedFields);
    setEditingCell(null);
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
  };

  const getStatusBadgeClass = (status: RejectStatus) => {
    switch (status) {
      case 'Karantina Gudang':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Pengajuan Retur Pabrik':
        return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      case 'Disetujui Retur Pabrik / Supplier':
      case 'Disetujui Retur Spindo':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'Downgrade (Jual Pipa BS)':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'Scrap / Besi Tua':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'Selesai Diproses':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  // Distinct Jenis list from current records
  const distinctJenis = Array.from(new Set(records.map((r) => r.jenis)));

  return (
    <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden flex flex-col">
      {/* SPREADSHEET TOOLBAR */}
      <div className="bg-slate-100/90 border-b border-slate-300 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search */}
          <div className="relative w-56 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari item, kode barang, no doc, pic..."
              className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 text-xs"
            />
          </div>

          {/* Filter Jenis */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Jenis:</span>
            <select
              value={jenisFilter}
              onChange={(e) => setJenisFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-md py-1.5 px-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              <option value="all">Semua Jenis / Brand</option>
              {distinctJenis.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Warehouse */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Gudang:</span>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-md py-1.5 px-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-orange-500 max-w-[140px] truncate"
            >
              <option value="all">Semua Gudang</option>
              {warehouses.map((w) => (
                <option key={w.name} value={w.name}>
                  {w.warehouse_name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Status */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-md py-1.5 px-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              <option value="all">Semua Status</option>
              <option value="Karantina Gudang">Karantina Gudang</option>
              <option value="Pengajuan Retur Pabrik">Pengajuan Retur Pabrik</option>
              <option value="Disetujui Retur Pabrik / Supplier">Disetujui Retur Pabrik / Supplier</option>
              <option value="Downgrade (Jual Pipa BS)">Downgrade (Jual Pipa BS)</option>
              <option value="Scrap / Besi Tua">Scrap / Besi Tua</option>
              <option value="Selesai Diproses">Selesai Diproses</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {onOpenGoogleServiceAccountModal && (
            <button
              onClick={onOpenGoogleServiceAccountModal}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-emerald-800 hover:bg-emerald-900 text-white font-medium text-xs shadow-xs transition-colors cursor-pointer"
              title="Koneksi Google Sheets via Service Account (GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, ID Spreadsheet)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" />
              <span>Google Sheets Service Account</span>
            </button>
          )}

          {onOpenMultiDeviceModal && (
            <button
              onClick={onOpenMultiDeviceModal}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-indigo-700 hover:bg-indigo-800 text-white font-medium text-xs shadow-xs transition-colors cursor-pointer group"
              title="Akses spreadsheet ini dari HP / device lain / jaringan berbeda"
            >
              <Smartphone className="w-3.5 h-3.5 text-indigo-200 group-hover:scale-110 transition-transform" />
              <span>Akses Multi-Device / HP</span>
            </button>
          )}

          {spreadsheetUrl && SharedSyncService.extractSpreadsheetUrl(spreadsheetUrl) && (
            <a
              href={SharedSyncService.extractSpreadsheetUrl(spreadsheetUrl)!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-emerald-800 hover:bg-emerald-900 text-white font-medium text-xs shadow-xs transition-colors cursor-pointer"
              title="Buka dokumen Google Sheets langsung di tab baru"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" />
              <span>Buka di Google Sheets</span>
              <ExternalLink className="w-3 h-3 text-emerald-300" />
            </a>
          )}

          <button
            onClick={onCopyGoogleSheets}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-xs shadow-xs transition-colors cursor-pointer"
            title="Salin seluruh data spreadsheet ke clipboard untuk langsung di-paste di Google Sheets"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Salin ke Google Sheets</span>
          </button>

          <button
            onClick={onExportExcel}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-medium text-xs shadow-xs transition-colors cursor-pointer"
            title="Download file Excel .xlsx"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>.XLSX</span>
          </button>

          <button
            onClick={onExportCsv}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-medium text-xs shadow-xs transition-colors cursor-pointer"
            title="Download file CSV"
          >
            <span>.CSV</span>
          </button>

          {onPullGoogleSheets && (
            <button
              onClick={onPullGoogleSheets}
              disabled={isPullingSheets}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-medium text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              title="Tarik data terbaru dari Google Spreadsheet ke aplikasi sekarang"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-700 ${isPullingSheets ? 'animate-spin' : ''}`} />
              <span>{isPullingSheets ? 'Menarik...' : 'Tarik dari Sheets'}</span>
            </button>
          )}

          <button
            onClick={onOpenGoogleSheetsModal}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-medium text-xs shadow-xs transition-colors cursor-pointer"
            title="Pengaturan Integrasi Webhook Google Sheets"
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
            <span>Setup Sync</span>
          </button>

          <button
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>Tambah Baris</span>
          </button>
        </div>
      </div>

      {/* SPREADSHEET FORMULA BAR */}
      <div className="bg-slate-50 border-b border-slate-300 px-4 py-1.5 flex items-center gap-3 text-xs text-slate-600 font-mono">
        <div className="flex items-center gap-1 text-slate-400 font-sans text-[11px] font-bold">
          <span className="bg-slate-200 px-1.5 py-0.5 rounded text-slate-700">fx</span>
        </div>
        <div className="text-slate-500 truncate flex items-center gap-2">
          <span>Nilai Reject:</span>
          <code className="text-orange-950 font-bold bg-white px-2 py-0.5 rounded border border-slate-200">
            = [Qty Reject] &times; [Valuation Rate ERPNext]
          </code>
          <span className="text-slate-400 text-[11px] font-sans">
            (Klik dua kali pada sel Qty / Status / Alasan untuk mengedit langsung di spreadsheet)
          </span>
        </div>
      </div>

      {/* SPREADSHEET GRID TABLE */}
      <div className="overflow-x-auto max-h-[580px] overflow-y-auto">
        <table className="w-full text-left border-collapse font-sans text-xs">
          {/* Google Sheets / Excel Alphabetical Column Row */}
          <thead className="sticky top-0 z-20">
            <tr className="bg-slate-200/90 text-slate-500 border-b border-slate-300 text-[10px] font-mono select-none">
              <th className="w-10 px-2 py-1 text-center border-r border-slate-300 bg-slate-200">#</th>
              <th className="w-28 px-2 py-1 text-center border-r border-slate-300">A</th>
              <th className="w-24 px-2 py-1 text-center border-r border-slate-300">B</th>
              <th className="w-24 px-2 py-1 text-center border-r border-slate-300">C</th>
              <th className="w-32 px-2 py-1 text-center border-r border-slate-300">D</th>
              <th className="min-w-[240px] px-2 py-1 text-center border-r border-slate-300">E</th>
              <th className="min-w-[180px] px-2 py-1 text-center border-r border-slate-300">F</th>
              <th className="min-w-[180px] px-2 py-1 text-center border-r border-slate-300">G</th>
              <th className="w-20 px-2 py-1 text-center border-r border-slate-300">H</th>
              <th className="w-16 px-2 py-1 text-center border-r border-slate-300">I</th>
              <th className="w-32 px-2 py-1 text-center border-r border-slate-300">J</th>
              <th className="w-36 px-2 py-1 text-center border-r border-slate-300">K</th>
              <th className="min-w-[160px] px-2 py-1 text-center border-r border-slate-300">L</th>
              <th className="min-w-[160px] px-2 py-1 text-center border-r border-slate-300">M</th>
              <th className="w-36 px-2 py-1 text-center border-r border-slate-300">N</th>
              <th className="w-28 px-2 py-1 text-center border-r border-slate-300">O</th>
              <th className="w-32 px-2 py-1 text-center border-r border-slate-300 bg-amber-50/80 text-amber-900 font-bold">P</th>
              <th className="w-20 px-2 py-1 text-center">Aksi</th>
            </tr>
            {/* Real Header Names */}
            <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 font-semibold text-[11px]">
              <th className="px-2 py-2 text-center border-r border-slate-300 bg-slate-100 w-10">No</th>
              <th className="px-3 py-2 border-r border-slate-300">No. Dokumen</th>
              <th className="px-3 py-2 border-r border-slate-300">Tanggal</th>
              <th className="px-3 py-2 border-r border-slate-300">Jenis</th>
              <th className="px-3 py-2 border-r border-slate-300">Item Code (ERP)</th>
              <th className="px-3 py-2 border-r border-slate-300">Item Name (ERPNext)</th>
              <th className="px-3 py-2 border-r border-slate-300">Gudang Letak Reject</th>
              <th className="px-3 py-2 border-r border-slate-300">Posisi / Letak Fisik</th>
              <th className="px-3 py-2 border-r border-slate-300 text-right">Qty Reject</th>
              <th className="px-2 py-2 border-r border-slate-300 text-center">UOM</th>
              <th className="px-3 py-2 border-r border-slate-300 text-right">Valuation Rate</th>
              <th className="px-3 py-2 border-r border-slate-300 text-right text-rose-700 font-bold bg-rose-50/50">
                Total Kerugian (Rp)
              </th>
              <th className="px-3 py-2 border-r border-slate-300">Alasan Reject</th>
              <th className="px-3 py-2 border-r border-slate-300">Detail / Keterangan</th>
              <th className="px-3 py-2 border-r border-slate-300 text-center">Status</th>
              <th className="px-3 py-2 border-r border-slate-300">PIC Gudang</th>
              <th className="px-3 py-2 border-r border-slate-300 text-center bg-amber-50/80 text-amber-950 font-bold">
                <span className="flex items-center justify-center gap-1">
                  <Camera className="w-3.5 h-3.5 text-amber-600" />
                  Foto Bukti Barang
                </span>
              </th>
              <th className="px-2 py-2 text-center">Aksi</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 bg-white">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={18} className="text-center py-12 text-slate-400">
                  <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-medium">Tidak ada data item reject yang cocok.</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Gunakan tombol &quot;Tambah Baris&quot; atau &quot;Input Item Reject&quot; untuk memasukkan barang reject distributor.
                  </p>
                </td>
              </tr>
            ) : (
              filteredRecords.map((record, index) => {
                return (
                  <tr
                    key={record.id}
                    className="hover:bg-amber-50/40 transition-colors group border-b border-slate-200"
                  >
                    {/* Row Index */}
                    <td className="px-2 py-2 text-center font-mono text-[10px] text-slate-400 bg-slate-50 border-r border-slate-200 select-none">
                      {index + 1}
                    </td>

                    {/* No Dokumen */}
                    <td className="px-3 py-2 font-mono text-[11px] font-semibold text-slate-800 border-r border-slate-200 whitespace-nowrap">
                      {record.docNumber}
                    </td>

                    {/* Tanggal */}
                    <td className="px-3 py-2 text-slate-600 border-r border-slate-200 whitespace-nowrap">
                      {record.date}
                    </td>

                    {/* Jenis / Brand */}
                    <td className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {record.jenis}
                      </span>
                    </td>

                    {/* Item Code */}
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-600 border-r border-slate-200 whitespace-nowrap">
                      {record.itemCode}
                    </td>

                    {/* Item Name */}
                    <td className="px-3 py-2 font-medium text-slate-900 border-r border-slate-200">
                      <div className="font-semibold text-slate-900">{record.itemName}</div>
                      {record.referenceDoc && (
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          Ref: {record.referenceDoc}
                        </div>
                      )}
                    </td>

                    {/* Gudang Letak Reject */}
                    <td className="px-3 py-2 text-slate-700 border-r border-slate-200 text-[11px] font-medium whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span>{record.sourceWarehouse.split(' - ')[0]}</span>
                      </div>
                    </td>

                    {/* Posisi / Letak Fisik */}
                    <td className="px-3 py-2 text-slate-600 border-r border-slate-200 text-[11px]">
                      {record.targetWarehouse?.startsWith('Letak: ') ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-mono text-[10px] font-semibold">
                          {record.targetWarehouse.replace('Letak: ', '')}
                        </span>
                      ) : record.notes?.includes('Letak Fisik: ') ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-mono text-[10px] font-semibold">
                          {record.notes.split('Letak Fisik: ')[1]?.split('|')[0]?.trim()}
                        </span>
                      ) : record.targetWarehouse && record.targetWarehouse !== '-' && record.targetWarehouse !== record.sourceWarehouse ? (
                        <span className="text-slate-500">{record.targetWarehouse.split(' - ')[0]}</span>
                      ) : (
                        <span className="text-slate-400 italic">-</span>
                      )}
                    </td>

                    {/* Qty Reject (Editable) */}
                    <td
                      onDoubleClick={() => handleStartEdit(record.id, 'qty', record.qty)}
                      className="px-3 py-2 border-r border-slate-200 text-right font-bold text-slate-900 cursor-pointer hover:bg-orange-100/50"
                      title="Klik 2x untuk edit Qty"
                    >
                      {editingCell?.id === record.id && editingCell?.field === 'qty' ? (
                        <div className="flex items-center gap-1 justify-end">
                          <input
                            type="number"
                            min={1}
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => handleSaveEdit(record)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(record);
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                            className="w-16 px-1.5 py-0.5 text-right font-bold border border-orange-500 bg-white rounded text-xs focus:outline-none"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1 group-hover:text-orange-950">
                          <span>{record.qty}</span>
                          <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-40 text-slate-400" />
                        </div>
                      )}
                    </td>

                    {/* UOM */}
                    <td className="px-2 py-2 border-r border-slate-200 text-center text-slate-600 font-medium text-[11px]">
                      {record.uom}
                    </td>

                    {/* Valuation Rate ERPNext */}
                    <td className="px-3 py-2 border-r border-slate-200 text-right font-mono text-slate-700 text-[11px]">
                      {ExportService.formatRupiah(record.valuationRate)}
                    </td>

                    {/* Total Kerugian = Qty x Valuation Rate */}
                    <td className="px-3 py-2 border-r border-slate-200 text-right font-mono font-bold text-rose-700 bg-rose-50/20 whitespace-nowrap">
                      {ExportService.formatRupiah(record.totalValue)}
                    </td>

                    {/* Alasan Reject */}
                    <td className="px-3 py-2 border-r border-slate-200 text-slate-800 font-semibold text-[11px]">
                      {record.alasanReject}
                    </td>

                    {/* Detail / Keterangan Kerusakan */}
                    <td className="px-3 py-2 border-r border-slate-200 text-slate-600 text-[11px] max-w-[200px]">
                      {record.keteranganAlasan ? (
                        <span className="line-clamp-2" title={record.keteranganAlasan}>
                          {record.keteranganAlasan}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">-</span>
                      )}
                    </td>

                    {/* Status Penanganan */}
                    <td className="px-3 py-2 border-r border-slate-200 text-center whitespace-nowrap">
                      <select
                        value={record.status}
                        onChange={(e) =>
                          onUpdateRecord(record.id, { status: e.target.value as RejectStatus })
                        }
                        className={`text-[11px] font-bold px-2 py-1 rounded-full border cursor-pointer ${getStatusBadgeClass(
                          record.status
                        )}`}
                      >
                        <option value="Karantina Gudang">Karantina Gudang</option>
                        <option value="Pengajuan Retur Pabrik">Pengajuan Retur Pabrik</option>
                        <option value="Disetujui Retur Pabrik / Supplier">Disetujui Retur Pabrik / Supplier</option>
                        <option value="Downgrade (Jual Pipa BS)">Downgrade (Jual Pipa BS)</option>
                        <option value="Scrap / Besi Tua">Scrap / Besi Tua</option>
                        <option value="Selesai Diproses">Selesai Diproses</option>
                      </select>
                    </td>

                    {/* PIC */}
                    <td className="px-3 py-2 border-r border-slate-200 text-slate-700 text-[11px] whitespace-nowrap">
                      {record.pic}
                    </td>

                    {/* Dedicated Column: Foto Bukti Barang */}
                    <td className="px-3 py-2 border-r border-slate-200 text-center whitespace-nowrap bg-amber-50/20">
                      {record.photoUrl ? (
                        <button
                          type="button"
                          onClick={() => setViewingPhotoRecord(record)}
                          className="inline-flex items-center gap-1.5 px-2 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-md text-amber-900 text-[11px] font-semibold transition-all hover:scale-105 cursor-pointer shadow-2xs group"
                          title="Klik untuk melihat foto bukti barang reject ukuran besar"
                        >
                          <img
                            src={record.photoUrl}
                            alt="Bukti Foto"
                            className="w-7 h-7 rounded object-cover border border-amber-300 group-hover:ring-2 group-hover:ring-amber-400"
                          />
                          <span className="font-mono text-[10px]">Lihat Foto</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">- Tidak Ada Foto -</span>
                      )}
                    </td>

                    {/* Action buttons */}
                    <td className="px-2 py-2 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onDeleteRecord(record.id);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:bg-rose-100 rounded-lg transition-all cursor-pointer group"
                          title="Hapus baris dokumen ini dari spreadsheet"
                        >
                          <Trash2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          {/* SPREADSHEET SUMMARY TOTAL FOOTER (=SUM) */}
          <tfoot className="bg-slate-100 text-slate-900 font-bold border-t-2 border-slate-400 sticky bottom-0 z-10 text-xs">
            <tr>
              <td colSpan={8} className="px-4 py-2.5 text-right uppercase tracking-wider text-slate-600">
                <span className="font-mono bg-slate-200 px-2 py-0.5 rounded text-[11px] mr-2">
                  =SUM()
                </span>
                Total Akumulasi ({filteredRecords.length} Baris):
              </td>
              <td className="px-3 py-2.5 text-right font-mono font-extrabold text-slate-900 border-r border-slate-300">
                {totalFilteredQty}
              </td>
              <td className="px-2 py-2.5 text-center text-slate-500 font-normal">Batang</td>
              <td className="px-3 py-2.5 text-right text-slate-500 font-normal border-r border-slate-300">
                -
              </td>
              <td className="px-3 py-2.5 text-right font-mono font-extrabold text-rose-700 bg-rose-100/50 border-r border-slate-300 whitespace-nowrap">
                {ExportService.formatRupiah(totalFilteredValue)}
              </td>
              <td colSpan={6} className="px-4 py-2.5 text-slate-500 font-normal text-[11px]">
                Sinkron otomatis dengan Valuation Rate ERPNext
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* MODAL VIEW FOTO BUKTI BARANG REJECT */}
      {viewingPhotoRecord && viewingPhotoRecord.photoUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[92vh]">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-orange-400" />
                <span className="font-bold text-xs sm:text-sm">
                  Foto Bukti Kerusakan: {viewingPhotoRecord.itemName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewingPhotoRecord(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-950 flex items-center justify-center overflow-auto max-h-[60vh]">
              <img
                src={viewingPhotoRecord.photoUrl}
                alt={viewingPhotoRecord.itemName}
                className="max-h-[55vh] max-w-full object-contain rounded-lg shadow-lg"
              />
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">No. Dokumen</span>
                  <span className="font-mono font-bold text-slate-800">{viewingPhotoRecord.docNumber}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">SKU / Item Code</span>
                  <span className="font-mono font-bold text-slate-800">{viewingPhotoRecord.itemCode}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Qty Reject</span>
                  <span className="font-bold text-rose-600">{viewingPhotoRecord.qty} {viewingPhotoRecord.uom}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">PIC Pemeriksa</span>
                  <span className="font-medium text-slate-800">{viewingPhotoRecord.pic}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Alasan / Detail Kerusakan</span>
                <p className="font-semibold text-slate-800">
                  {viewingPhotoRecord.alasanReject}
                  {viewingPhotoRecord.keteranganAlasan && (
                    <span className="font-normal text-slate-600 ml-1">
                      &mdash; {viewingPhotoRecord.keteranganAlasan}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="p-3 bg-white border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingPhotoRecord(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Tutup Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
