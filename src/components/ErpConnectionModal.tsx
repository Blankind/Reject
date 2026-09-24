import React, { useState } from 'react';
import {
  X,
  Database,
  CheckCircle2,
  AlertCircle,
  Key,
  Globe,
  Lock,
  RefreshCw,
  Building,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  Server,
  PackageCheck,
  Clock,
  Check,
} from 'lucide-react';
import { ErpConfig, ErpConnectionTestResult } from '../types/erpnext';
import { ErpNextService } from '../services/erpnextService';

interface ErpConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ErpConfig;
  onSaveConfig: (config: ErpConfig) => void;
  onDataSynced?: () => void;
}

export const ErpConnectionModal: React.FC<ErpConnectionModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onDataSynced,
}) => {
  const [formData, setFormData] = useState<ErpConfig>(config);
  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<ErpConnectionTestResult | null>(null);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncResult, setSyncResult] = useState<{ warehousesCount: number; itemsCount: number } | null>(null);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setSyncResult(null);
    try {
      const res = await ErpNextService.testConnection(formData);
      setTestResult(res);
      if (res.success) {
        setFormData((prev) => ({
          ...prev,
          isConnected: true,
          loggedUser: res.user,
          lastSyncTime: new Date().toISOString(),
        }));
      }
    } catch (e: any) {
      setTestResult({
        success: false,
        message: e.message || 'Gagal menghubungi server ERPNext.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSyncMasterData = async () => {
    setSyncing(true);
    try {
      const result = await ErpNextService.syncAllMasterData();
      setSyncResult(result);
      if (onDataSynced) {
        onDataSynced();
      }
    } catch (e: any) {
      alert(`Gagal sinkronisasi data: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-orange-600 flex items-center justify-center text-white shadow-md shadow-orange-600/30">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold">Koneksi ERPNext Server Real</h2>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded">
                  Live REST API
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Hubungkan langsung ke sistem ERPNext / Frappe distributor Anda (Real Item Master, Valuation Rate &amp; Warehouses)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto max-h-[82vh]">
          {/* Connection Status Banner if already connected */}
          {formData.isConnected && formData.loggedUser && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-950">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-600"></span>
                </span>
                <div>
                  <span className="font-bold">ERPNext Live Terhubung</span>
                  <div className="text-emerald-700 text-[11px]">
                    User: <strong>{formData.loggedUser}</strong> &bull; Server: {formData.baseUrl}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSyncMasterData}
                disabled={syncing}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-[11px] flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors shrink-0"
              >
                <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? 'Menyinkronkan...' : 'Sinkron Master Data'}</span>
              </button>
            </div>
          )}

          {/* Form Fields for real ERPNext instance */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                URL Server ERPNext <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="url"
                  required
                  value={formData.baseUrl}
                  onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                  placeholder="https://erp.perusahaan-anda.com atau https://subdomain.frappe.cloud"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono"
                />
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Alamat domain atau IP server Frappe / ERPNext distributor Anda (didukung HTTPS, HTTP, maupun Frappe Cloud).
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  API Key ERPNext <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    placeholder="Contoh: 3b4a5c6d7e8f..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  API Secret ERPNext <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={formData.apiSecret}
                    onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
                    placeholder="••••••••••••••••"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                Nama Perusahaan / Distributor
              </label>
              <div className="relative">
                <Building className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={formData.companyName || ''}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  placeholder="PT Distributor Utama Nusantara"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
          </div>

          {/* Test Connection Button & Result */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing || !formData.baseUrl}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white text-xs font-bold rounded-lg border border-slate-700 flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              {testing ? (
                <RefreshCw className="w-4 h-4 animate-spin text-orange-400" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              )}
              <span>
                {testing ? 'Menguji Sambungan ke Server ERPNext...' : 'Uji Sambungan Real (Test Connection)'}
              </span>
            </button>

            {testResult && (
              <div
                className={`mt-3 p-3.5 rounded-xl border text-xs flex items-start gap-3 ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : 'bg-rose-50 border-rose-300 text-rose-950'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1 flex-1">
                  <div className="font-bold flex items-center justify-between">
                    <span>{testResult.success ? 'Koneksi ERPNext Berhasil Terhubung!' : 'Koneksi Gagal'}</span>
                    {testResult.latencyMs && (
                      <span className="text-[10px] text-emerald-700 font-mono">
                        Respon: {testResult.latencyMs} ms
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] leading-relaxed">{testResult.message}</p>
                  {testResult.accessibleDocTypes && testResult.accessibleDocTypes.length > 0 && (
                    <div className="pt-1 text-[11px] text-emerald-800 flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold">Izin Akses Terverifikasi:</span>
                      {testResult.accessibleDocTypes.map((dt) => (
                        <span
                          key={dt}
                          className="bg-emerald-200/60 text-emerald-900 px-2 py-0.5 rounded font-mono text-[10px] font-semibold"
                        >
                          {dt}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {syncResult && (
              <div className="mt-2.5 p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  Master data berhasil disinkronkan: <strong>{syncResult.warehousesCount} Gudang</strong> dan{' '}
                  <strong>{syncResult.itemsCount} Item Produk</strong> dari ERPNext.
                </span>
              </div>
            )}
          </div>

          {/* ERPNext Guide Accordion */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-[11px] text-slate-600 space-y-2">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-orange-500" />
              Cara Mendapatkan API Key &amp; Secret di ERPNext:
            </div>
            <ol className="list-decimal list-inside space-y-1 text-slate-600">
              <li>
                Login ke ERPNext Anda &rarr; Klik foto profil di pojok kanan atas &rarr; Buka <strong>User Settings</strong>.
              </li>
              <li>
                Gulir ke bawah ke bagian <strong>API Access</strong> &rarr; Klik tombol <strong>Generate Keys</strong>.
              </li>
              <li>
                Salin <strong>API Key</strong> dan <strong>API Secret</strong> ke isian form di atas.
              </li>
              <li>
                Pastikan user memiliki role izin membaca untuk <code>Item</code>, <code>Warehouse</code>, dan <code>Bin</code>.
              </li>
            </ol>
            <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-200">
              Fitur backend proxy bawaan secara otomatis mengatasi kendala CORS dan HTTPS Mixed Content, sehingga URL ERPNext cloud maupun on-premise lokal Anda dapat langsung terhubung.
            </p>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 active:bg-orange-800 rounded-lg shadow-sm shadow-orange-600/30 transition-all cursor-pointer"
            >
              Simpan Konfigurasi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
