import React from 'react';
import { Database, FileSpreadsheet, Plus, Settings2, Download, Printer, RefreshCw, CheckCircle2, AlertCircle, Smartphone, QrCode } from 'lucide-react';
import { ErpConfig } from '../types/erpnext';

interface NavbarProps {
  erpConfig: ErpConfig;
  onOpenErpConfig: () => void;
  onOpenAddModal: () => void;
  onOpenPrintModal: () => void;
  onOpenMultiDeviceModal: () => void;
  onOpenGoogleServiceAccountModal: () => void;
  isGoogleConfigured?: boolean;
  onExportExcel: () => void;
  onCopyGoogleSheets: () => void;
  totalRecords: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  erpConfig,
  onOpenErpConfig,
  onOpenAddModal,
  onOpenPrintModal,
  onOpenMultiDeviceModal,
  onOpenGoogleServiceAccountModal,
  isGoogleConfigured = false,
  onExportExcel,
  onCopyGoogleSheets,
  totalRecords,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Brand & Distributor info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-white">DistriReject</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded">
                  Distributor Edition
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Pencatatan Item Reject &bull; Terkoneksi ERPNext (Katalog Master Distributor)
              </p>
            </div>
          </div>

          {/* Center ERPNext Status Pill */}
          <div className="hidden md:flex items-center">
            <button
              onClick={onOpenErpConfig}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all text-xs cursor-pointer ${
                erpConfig.isConnected && erpConfig.baseUrl
                  ? 'bg-emerald-950/50 hover:bg-emerald-900/60 border-emerald-800/80 text-emerald-200'
                  : 'bg-amber-950/40 hover:bg-amber-900/50 border-amber-700/60 text-amber-200'
              }`}
              title="Klik untuk konfigurasi koneksi ERPNext"
            >
              {erpConfig.isConnected && erpConfig.baseUrl ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <Database className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-semibold truncate max-w-[200px]">
                    {erpConfig.baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </span>
                  <span className="text-emerald-500 text-[10px]">|</span>
                  <span className="text-emerald-300 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    {erpConfig.loggedUser ? `User: ${erpConfig.loggedUser}` : 'Live Terhubung'}
                  </span>
                </>
              ) : (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
                  </span>
                  <Database className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-semibold text-amber-300">ERPNext: Belum Terhubung</span>
                  <span className="text-amber-400/60 text-[10px]">|</span>
                  <span className="text-amber-400 underline font-medium">Klik untuk Setup</span>
                </>
              )}
            </button>
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center gap-2">
            {/* Google Service Account direct connection */}
            <button
              onClick={onOpenGoogleServiceAccountModal}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                isGoogleConfigured
                  ? 'text-emerald-200 bg-emerald-950/80 hover:bg-emerald-900 border-emerald-700/80 shadow-xs'
                  : 'text-slate-300 bg-slate-800/90 hover:bg-slate-700 border-slate-700'
              }`}
              title="Koneksi Google Sheets via Service Account (GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, ID Spreadsheet)"
            >
              <FileSpreadsheet
                className={`w-4 h-4 ${isGoogleConfigured ? 'text-emerald-400' : 'text-slate-400'}`}
              />
              <span className="hidden sm:inline">Google Sheets SA</span>
              {isGoogleConfigured ? (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Terhubung"></span>
              ) : (
                <span className="text-[10px] text-amber-400 font-normal">Hubungkan</span>
              )}
            </button>

            {/* Multi-Device & Mobile Access Button */}
            <button
              onClick={onOpenMultiDeviceModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-200 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/80 shadow-xs transition-all cursor-pointer hover:border-indigo-500 group"
              title="Buka aplikasi & data spreadsheet ini dari HP / device lain / jaringan berbeda"
            >
              <Smartphone className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">Akses HP</span>
            </button>

            <button
              onClick={onOpenErpConfig}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Pengaturan Koneksi ERPNext"
            >
              <Settings2 className="w-5 h-5" />
            </button>

            <button
              onClick={onOpenPrintModal}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
              title="Cetak Berita Acara Barang Reject"
            >
              <Printer className="w-4 h-4 text-slate-400" />
              <span>Cetak BA</span>
            </button>

            <div className="hidden lg:flex items-center gap-1">
              <button
                onClick={onCopyGoogleSheets}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-800/60 transition-colors"
                title="Salin data ke clipboard dengan format siap tempel (paste) di Google Sheets"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Salin ke Sheets</span>
              </button>

              <button
                onClick={onExportExcel}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
                title="Download file Excel .xlsx"
              >
                <Download className="w-4 h-4 text-slate-400" />
                <span>Export Excel</span>
              </button>
            </div>

            <button
              onClick={onOpenAddModal}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 active:bg-orange-700 shadow-sm shadow-orange-600/30 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Input Item Reject</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
