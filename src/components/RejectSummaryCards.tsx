import React from 'react';
import { TrendingDown, Layers, Warehouse, ShieldAlert, CheckCircle } from 'lucide-react';
import { RejectItemRecord } from '../types/reject';
import { ExportService } from '../services/exportService';

interface RejectSummaryCardsProps {
  records: RejectItemRecord[];
}

export const RejectSummaryCards: React.FC<RejectSummaryCardsProps> = ({ records }) => {
  const totalDocs = records.length;
  const totalQty = records.reduce((acc, curr) => acc + (Number(curr.qty) || 0), 0);
  const totalLossValue = records.reduce((acc, curr) => acc + (Number(curr.totalValue) || 0), 0);

  // Status breakdown
  const karantinaCount = records.filter((r) => r.status === 'Karantina Gudang').length;
  const karantinaQty = records
    .filter((r) => r.status === 'Karantina Gudang')
    .reduce((acc, curr) => acc + (Number(curr.qty) || 0), 0);

  const returPabrikCount = records.filter(
    (r) =>
      r.status === 'Pengajuan Retur Pabrik' ||
      r.status === 'Disetujui Retur Pabrik / Supplier' ||
      (r.status as any) === 'Disetujui Retur Spindo'
  ).length;
  const returLoss = records
    .filter(
      (r) =>
        r.status === 'Pengajuan Retur Pabrik' ||
        r.status === 'Disetujui Retur Pabrik / Supplier' ||
        (r.status as any) === 'Disetujui Retur Spindo'
    )
    .reduce((acc, curr) => acc + (Number(curr.totalValue) || 0), 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Total Kerugian Nilai Reject (Rp) */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/90 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Nilai Kerugian
          </span>
          <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
            <TrendingDown className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            {ExportService.formatRupiah(totalLossValue)}
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <span className="font-medium text-rose-600">Berdasarkan Valuation Rate</span> ERPNext
          </p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-rose-600"></div>
      </div>

      {/* Total Qty Reject */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/90 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Volume Reject
          </span>
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            {totalQty} <span className="text-sm font-normal text-slate-500">Unit / Pcs</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Dari <span className="font-semibold text-slate-700">{totalDocs}</span> dokumen transaksi reject
          </p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500"></div>
      </div>

      {/* Karantina Gudang */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/90 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-all">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider bg-amber-100/70 px-1.5 py-0.5 rounded">
              Karantina
            </span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Gudang
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <ShieldAlert className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            {karantinaCount} <span className="text-sm font-normal text-slate-500">Dokumen ({karantinaQty} Unit)</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Menunggu disposisi atau inspeksi teknis lanjutan
          </p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500"></div>
      </div>

      {/* Retur Pabrik / Supplier */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/90 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Retur Pabrik / Supplier
          </span>
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Warehouse className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            {returPabrikCount} <span className="text-sm font-normal text-slate-500">Klaim Retur</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Nilai klaim: <span className="font-semibold text-slate-800">{ExportService.formatRupiah(returLoss)}</span>
          </p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
      </div>
    </div>
  );
};
