import React from 'react';
import { X, Printer, FileText, CheckCircle2 } from 'lucide-react';
import { RejectItemRecord } from '../types/reject';
import { ExportService } from '../services/exportService';

interface PrintBeritaAcaraModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: RejectItemRecord[];
  companyName: string;
}

export const PrintBeritaAcaraModal: React.FC<PrintBeritaAcaraModalProps> = ({
  isOpen,
  onClose,
  records,
  companyName,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const totalQty = records.reduce((acc, r) => acc + (Number(r.qty) || 0), 0);
  const totalValue = records.reduce((acc, r) => acc + (Number(r.totalValue) || 0), 0);
  const todayFormatted = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'full',
  }).format(new Date());

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 print:p-0 print:bg-white">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh] print:max-h-none print:shadow-none print:border-none">
        {/* Modal Controls (Hidden in Print) */}
        <div className="bg-slate-900 px-6 py-3.5 text-white flex items-center justify-between border-b border-slate-800 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-orange-500" />
            <span className="font-bold text-sm">Preview Berita Acara Barang Reject / Karantina</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / Simpan PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="flex-1 overflow-y-auto p-8 sm:p-10 text-slate-900 bg-white font-sans text-xs print:p-0">
          {/* Letterhead */}
          <div className="border-b-2 border-slate-900 pb-4 mb-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                  {companyName || 'PT DISTRIBUTOR BAJA NUSANTARA'}
                </h1>
                <p className="text-xs text-slate-600 font-medium">
                  Divisi Logistik, Pergudangan & Pengendalian Kualitas (Quality Control)
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Distributor Resmi Produk Pipa, Baja, Profil & Material Konstruksi
                </p>
              </div>
              <div className="text-right">
                <span className="inline-block px-2.5 py-1 rounded bg-slate-100 border border-slate-300 font-mono font-bold text-xs text-slate-800">
                  DOC-REJ-{new Date().getFullYear()}-{String(new Date().getMonth() + 1).padStart(2, '0')}
                </span>
                <p className="text-[11px] text-slate-500 mt-1">{todayFormatted}</p>
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="text-center my-4">
            <h2 className="text-base font-bold uppercase tracking-wide text-slate-900 underline">
              BERITA ACARA PEMERIKSAAN & KARANTINA BARANG REJECT
            </h2>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Lampiran Verifikasi Fisik & Sinkronisasi Valuation Rate ERPNext
            </p>
          </div>

          <p className="text-xs text-slate-700 leading-relaxed mb-4">
            Pada hari ini, tanggal <strong>{todayFormatted}</strong>, telah dilakukan pemeriksaan fisik dan
            pencatatan barang/item yang dinyatakan <strong>REJECT / RUSAK / TIDAK SESUAI SPESIFIKASI</strong> dengan rincian
            sebagai berikut:
          </p>

          {/* Items Table */}
          <div className="border border-slate-300 rounded-sm overflow-hidden mb-6">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="bg-slate-100 text-slate-800 border-b border-slate-300 font-bold">
                  <th className="p-2 text-center w-8 border-r border-slate-300">No</th>
                  <th className="p-2 border-r border-slate-300">No. Bukti</th>
                  <th className="p-2 border-r border-slate-300">Item Name (ERPNext)</th>
                  <th className="p-2 border-r border-slate-300">Gudang Asal &rarr; Tujuan</th>
                  <th className="p-2 border-r border-slate-300 text-center">Qty</th>
                  <th className="p-2 border-r border-slate-300 text-right">Valuation Rate</th>
                  <th className="p-2 border-r border-slate-300 text-right">Total Nilai (Rp)</th>
                  <th className="p-2 border-r border-slate-300">Alasan Reject</th>
                  <th className="p-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {records.map((r, i) => (
                  <tr key={r.id}>
                    <td className="p-2 text-center border-r border-slate-200 font-mono text-[10px]">
                      {i + 1}
                    </td>
                    <td className="p-2 border-r border-slate-200 font-mono text-[10px] whitespace-nowrap">
                      {r.docNumber}
                    </td>
                    <td className="p-2 border-r border-slate-200 font-medium">
                      <div>{r.itemName}</div>
                      <div className="text-[9px] text-slate-500 font-mono">{r.itemCode}</div>
                    </td>
                    <td className="p-2 border-r border-slate-200 text-[10px]">
                      <div>{r.sourceWarehouse.split(' - ')[0]}</div>
                      <div className="text-slate-500">&rarr; {r.targetWarehouse.split(' - ')[0]}</div>
                    </td>
                    <td className="p-2 border-r border-slate-200 text-center font-bold">
                      {r.qty} {r.uom}
                    </td>
                    <td className="p-2 border-r border-slate-200 text-right font-mono text-[10px]">
                      {ExportService.formatRupiah(r.valuationRate)}
                    </td>
                    <td className="p-2 border-r border-slate-200 text-right font-mono font-bold">
                      {ExportService.formatRupiah(r.totalValue)}
                    </td>
                    <td className="p-2 border-r border-slate-200 text-[10px]">
                      <div className="font-semibold">{r.alasanReject}</div>
                      {r.keteranganAlasan && (
                        <div className="text-slate-500 italic">{r.keteranganAlasan}</div>
                      )}
                    </td>
                    <td className="p-2 text-center font-semibold text-[10px] whitespace-nowrap">
                      {r.status}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                  <td colSpan={4} className="p-2 text-right uppercase">
                    Total Keseluruhan ({records.length} Item):
                  </td>
                  <td className="p-2 text-center border-r border-slate-300 font-mono">
                    {totalQty} Batang
                  </td>
                  <td className="p-2 border-r border-slate-300"></td>
                  <td className="p-2 text-right font-mono font-bold text-slate-900 border-r border-slate-300">
                    {ExportService.formatRupiah(totalValue)}
                  </td>
                  <td colSpan={2} className="p-2 text-[10px] text-slate-500 font-normal">
                    Nilai dihitung berdasarkan harga perolehan ERPNext
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Lampiran Bukti Foto Kerusakan */}
          {records.some((r) => r.photoUrl) && (
            <div className="mb-6 pt-3 border-t border-slate-300">
              <h3 className="font-bold text-xs uppercase text-slate-800 mb-2">
                Lampiran Dokumentasi Foto Kerusakan / Cacat Fisik:
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {records
                  .filter((r) => r.photoUrl)
                  .map((r, idx) => (
                    <div key={r.id || idx} className="border border-slate-300 rounded p-2 bg-slate-50 text-[10px]">
                      <div className="h-28 bg-slate-200 overflow-hidden rounded mb-1.5 flex items-center justify-center">
                        <img src={r.photoUrl} alt={r.itemName} className="w-full h-full object-cover" />
                      </div>
                      <p className="font-bold truncate text-slate-900">{r.itemName}</p>
                      <p className="font-mono text-slate-600">{r.itemCode} &bull; {r.qty} {r.uom}</p>
                      <p className="text-rose-700 font-semibold truncate mt-0.5">{r.alasanReject}</p>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Signatures */}
          <div className="mt-8 pt-4">
            <p className="text-xs text-slate-700 mb-6">
              Demikian Berita Acara ini dibuat dengan sebenar-benarnya untuk digunakan sebagai dasar pemindahan
              stok ke gudang karantina dan proses klaim retur ke produsen (Pabrik / Supplier terkait).
            </p>

            <div className="grid grid-cols-4 gap-4 text-center text-xs">
              <div>
                <p className="text-slate-600 font-medium">Petugas Gudang (PIC)</p>
                <div className="h-16"></div>
                <p className="font-bold border-t border-slate-400 pt-1 text-slate-800">
                  ( Bambang Sudiro )
                </p>
                <p className="text-[10px] text-slate-500">Staf Gudang</p>
              </div>

              <div>
                <p className="text-slate-600 font-medium">Quality Control (QC)</p>
                <div className="h-16"></div>
                <p className="font-bold border-t border-slate-400 pt-1 text-slate-800">
                  ( Hendra Gunawan )
                </p>
                <p className="text-[10px] text-slate-500">Inspector QC</p>
              </div>

              <div>
                <p className="text-slate-600 font-medium">Kepala Gudang / Logistik</p>
                <div className="h-16"></div>
                <p className="font-bold border-t border-slate-400 pt-1 text-slate-800">
                  ( Agus Wahyudi, ST )
                </p>
                <p className="text-[10px] text-slate-500">Manager Logistik</p>
              </div>

              <div>
                <p className="text-slate-600 font-medium">Perwakilan Pabrik / Sales</p>
                <div className="h-16"></div>
                <p className="font-bold border-t border-slate-400 pt-1 text-slate-800">
                  ( ............................. )
                </p>
                <p className="text-[10px] text-slate-500">Pabrik / Supplier</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
