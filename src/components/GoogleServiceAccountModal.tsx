import React, { useState, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  Key,
  Mail,
  Link2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  UploadCloud,
  DownloadCloud,
  Info,
  Copy,
} from 'lucide-react';
import {
  GoogleServiceAccountClient,
  GSheetServiceAccountStatus,
} from '../services/googleServiceAccountClient';
import { RejectItemRecord } from '../types/reject';

interface GoogleServiceAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: RejectItemRecord[];
  onRecordsUpdated: (newRecords: RejectItemRecord[]) => void;
  onSuccessToast: (msg: string) => void;
}

export const GoogleServiceAccountModal: React.FC<GoogleServiceAccountModalProps> = ({
  isOpen,
  onClose,
  records,
  onRecordsUpdated,
  onSuccessToast,
}) => {
  const [clientEmail, setClientEmail] = useState<string>('');
  const [privateKey, setPrivateKey] = useState<string>('');
  const [spreadsheetId, setSpreadsheetId] = useState<string>('');
  const [status, setStatus] = useState<GSheetServiceAccountStatus | null>(null);

  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    title?: string;
  } | null>(null);

  const [copiedEmail, setCopiedEmail] = useState<boolean>(false);

  // Load status on open
  useEffect(() => {
    if (isOpen) {
      setIsLoadingStatus(true);
      setTestResult(null);
      GoogleServiceAccountClient.getStatus()
        .then((st) => {
          setStatus(st);
          if (st.clientEmail) setClientEmail(st.clientEmail);
          if (st.spreadsheetId) setSpreadsheetId(st.spreadsheetId);
        })
        .finally(() => setIsLoadingStatus(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Auto clean spreadsheet ID when pasting full URL
  const handleSpreadsheetIdChange = (val: string) => {
    const trimmed = val.trim();
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      setSpreadsheetId(match[1]);
    } else {
      setSpreadsheetId(trimmed);
    }
  };

  // Helper if user pastes raw Google Service Account JSON
  const handlePrivateKeyChange = (val: string) => {
    const trimmed = val.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const json = JSON.parse(trimmed);
        if (json.client_email) {
          setClientEmail(json.client_email);
        }
        if (json.private_key) {
          setPrivateKey(json.private_key);
        }
        return;
      } catch {
        // Not valid JSON, continue with raw text
      }
    }
    setPrivateKey(val);
  };

  const handleTestConnection = async () => {
    if (!clientEmail.trim() || !spreadsheetId.trim()) {
      setTestResult({
        success: false,
        message: 'Harap isi GOOGLE_CLIENT_EMAIL dan ID Spreadsheet.',
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await GoogleServiceAccountClient.testConfig({
        clientEmail: clientEmail.trim(),
        privateKey: privateKey.trim(),
        spreadsheetId: spreadsheetId.trim(),
      });
      setTestResult({
        success: true,
        message: res.message,
        title: res.spreadsheetTitle,
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Koneksi gagal',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!clientEmail.trim() || !spreadsheetId.trim()) {
      setTestResult({
        success: false,
        message: 'Harap lengkapi GOOGLE_CLIENT_EMAIL dan ID Spreadsheet.',
      });
      return;
    }

    setIsSaving(true);
    setTestResult(null);
    try {
      const res = await GoogleServiceAccountClient.saveConfig({
        clientEmail: clientEmail.trim(),
        privateKey: privateKey.trim(),
        spreadsheetId: spreadsheetId.trim(),
      });
      setTestResult({
        success: true,
        message: res.message,
        title: res.spreadsheetTitle,
      });
      const st = await GoogleServiceAccountClient.getStatus();
      setStatus(st);
      onSuccessToast('Kredensial Service Account berhasil disimpan dan terhubung!');
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Gagal menyimpan konfigurasi',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePushToSheet = async () => {
    setIsSyncing(true);
    try {
      const res = await GoogleServiceAccountClient.pushRecords(records);
      onSuccessToast(`⚡ ${res.message}`);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Gagal sinkronisasi data ke Google Sheets',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePullFromSheet = async () => {
    setIsSyncing(true);
    try {
      const res = await GoogleServiceAccountClient.pullRecords();
      if (res.records) {
        onRecordsUpdated(res.records);
        onSuccessToast(`⚡ ${res.message}`);
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Gagal menarik data dari Google Sheets',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCopyEmail = async () => {
    if (!clientEmail) return;
    try {
      await navigator.clipboard.writeText(clientEmail.trim());
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2500);
    } catch {
      // Fallback
    }
  };

  const directSheetUrl = spreadsheetId
    ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
    : status?.spreadsheetUrl;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 px-6 py-4 text-white flex items-center justify-between border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-600/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold">Koneksi Google Sheets via Service Account</h2>
                {status?.isConfigured && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                    Terhubung Langsung
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300">
                Akses baca &amp; tulis Google Spreadsheet resmi tanpa ribet, multi-device &amp; multi-jaringan
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

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto text-xs">
          {/* Status Alert */}
          {status?.isConfigured ? (
            <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold text-emerald-950 block text-xs">
                    Google Service Account Terhubung!
                  </span>
                  <p className="text-emerald-900 text-[11px]">
                    Kredensial aktif ({status.source === 'env' ? 'dari File .env / Environment' : 'dari Pengaturan Tersimpan'}).
                    Aplikasi dapat membaca dan menulis data langsung ke spreadsheet.
                  </p>
                </div>
              </div>
              {directSheetUrl && (
                <a
                  href={directSheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold shrink-0 flex items-center gap-1 shadow-xs transition-colors"
                >
                  <span>Buka Sheet</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-300 rounded-xl p-3.5 flex items-start gap-2.5">
              <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-blue-950 block text-xs">
                  Cara Kerja Koneksi Google Service Account:
                </span>
                <p className="text-blue-900 leading-relaxed text-[11px]">
                  Server akan berkomunikasi langsung dengan Google Sheets API v4 menggunakan Service Account resmi Google Cloud.
                  Koneksi ini berjalan di level server sehingga <strong>seluruh perangkat (HP, laptop lain, staf gudang) di jaringan apa pun</strong> langsung terhubung ke spreadsheet yang sama tanpa kendala login atau CORS.
                </p>
              </div>
            </div>
          )}

          {/* Form Fields */}
          <div className="space-y-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
            {/* Field 1: GOOGLE_CLIENT_EMAIL */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  <span>GOOGLE_CLIENT_EMAIL</span>
                </label>
                {clientEmail && (
                  <button
                    type="button"
                    onClick={handleCopyEmail}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedEmail ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Email Tersalin</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Salin Email</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="nama-service-account@project-id.iam.gserviceaccount.com"
                className="w-full text-xs font-mono py-2 px-3 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Field 2: GOOGLE_PRIVATE_KEY */}
            <div>
              <label className="font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                <Key className="w-3.5 h-3.5 text-slate-500" />
                <span>GOOGLE_PRIVATE_KEY</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  (Bisa paste teks kunci privat atau paste seluruh file JSON Service Account)
                </span>
              </label>
              <textarea
                rows={3}
                value={privateKey}
                onChange={(e) => handlePrivateKeyChange(e.target.value)}
                placeholder="-----BEGIN PRIVATE KEY-----\nMIIEv...=\n-----END PRIVATE KEY-----\n"
                className="w-full text-[11px] font-mono py-2 px-3 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y"
              />
            </div>

            {/* Field 3: ID SPREADSHEET */}
            <div>
              <label className="font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                <Link2 className="w-3.5 h-3.5 text-slate-500" />
                <span>ID SPREADSHEET</span>
              </label>
              <input
                type="text"
                value={spreadsheetId}
                onChange={(e) => handleSpreadsheetIdChange(e.target.value)}
                placeholder="1BxiMVs0X_Xxxxxxxx_xxxx atau paste seluruh URL Google Sheets"
                className="w-full text-xs font-mono py-2 px-3 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Tips: Cukup paste URL Google Sheets Anda (e.g.{' '}
                <code>https://docs.google.com/spreadsheets/d/1BxiMVs0.../edit</code>), sistem akan otomatis
                mengambil ID-nya.
              </p>
            </div>
          </div>

          {/* CRITICAL STEP INSTRUCTION */}
          <div className="bg-amber-50/80 border border-amber-300 rounded-xl p-3.5 space-y-1.5 text-[11px] text-amber-900">
            <div className="font-bold text-amber-950 flex items-center gap-1.5 text-xs">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>Langkah Wajib di Google Spreadsheet Anda:</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 pl-1 text-slate-700">
              <li>Buka file Google Spreadsheet Anda di browser.</li>
              <li>Klik tombol biru <strong>&quot;Bagikan&quot; (Share)</strong> di pojok kanan atas.</li>
              <li>
                Masukkan email Service Account:{' '}
                <code className="bg-amber-100 text-amber-950 px-1 py-0.5 rounded font-mono font-semibold">
                  {clientEmail.trim() || 'nama-service-account@...iam.gserviceaccount.com'}
                </code>
              </li>
              <li>
                Pastikan perannya dipilih sebagai <strong>&quot;Editor&quot;</strong>, lalu klik <strong>Kirim (Share)</strong>.
              </li>
            </ol>
          </div>

          {/* Test / Save Result Feedback */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                testResult.success
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <span className="font-bold block">
                  {testResult.success ? 'Koneksi Sukses!' : 'Peringatan Koneksi:'}
                </span>
                <p className="whitespace-pre-line text-[11px]">{testResult.message}</p>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || !clientEmail || !spreadsheetId}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                <span>{isTesting ? 'Menguji...' : 'Test Koneksi'}</span>
              </button>

              <button
                type="button"
                onClick={handleSaveConfig}
                disabled={isSaving || !clientEmail || !spreadsheetId}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                <span>{isSaving ? 'Menyimpan...' : 'Simpan & Hubungkan'}</span>
              </button>
            </div>

            {status?.isConfigured && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePullFromSheet}
                  disabled={isSyncing}
                  className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  title="Tarik data terbaru dari Google Sheets"
                >
                  <DownloadCloud className={`w-3.5 h-3.5 text-blue-700 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Tarik dari Sheets</span>
                </button>

                <button
                  type="button"
                  onClick={handlePushToSheet}
                  disabled={isSyncing}
                  className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  title="Kirim seluruh data reject ke Google Sheets"
                >
                  <UploadCloud className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Kirim ke Sheets ({records.length} Baris)</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Google Sheets API v4 &bull; Service Account Auth Resmi</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
