import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { RejectSummaryCards } from './components/RejectSummaryCards';
import { SpreadsheetView } from './components/SpreadsheetView';
import { AddRejectModal } from './components/AddRejectModal';
import { ErpConnectionModal } from './components/ErpConnectionModal';
import { PrintBeritaAcaraModal } from './components/PrintBeritaAcaraModal';
import { GoogleSheetsSyncModal } from './components/GoogleSheetsSyncModal';
import { ErpConfig, ErpWarehouse } from './types/erpnext';
import { RejectItemRecord, deduplicateRecords } from './types/reject';
import { ErpNextService } from './services/erpnextService';
import { ExportService } from './services/exportService';
import { SharedSyncService } from './services/sharedSyncService';
import { MultiDeviceConnectModal } from './components/MultiDeviceConnectModal';
import { GoogleServiceAccountModal } from './components/GoogleServiceAccountModal';
import { GoogleServiceAccountClient } from './services/googleServiceAccountClient';
import {
  ArrowRight,
  Database,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Server,
  RefreshCw,
  Trash2,
  Zap,
  Smartphone,
  Share2,
} from 'lucide-react';

const STORAGE_RECORDS_KEY = 'distri_reject_records_v2';
const GSHEET_WEBHOOK_KEY = 'distri_gsheet_webhook';
const GSHEET_SPREADSHEET_URL_KEY = 'distri_gsheet_spreadsheet_url';

export default function App() {
  // ERPNext Configuration State (Real live credentials)
  const [erpConfig, setErpConfig] = useState<ErpConfig>(() => {
    return ErpNextService.getConfig();
  });

  // Master Warehouses from real ERPNext
  const [warehouses, setWarehouses] = useState<ErpWarehouse[]>([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState<boolean>(false);

  // Direct Google Spreadsheet URL
  const [gsheetSpreadsheetUrl, setGsheetSpreadsheetUrl] = useState<string>(() => {
    return localStorage.getItem(GSHEET_SPREADSHEET_URL_KEY) || '';
  });

  // Multi-Device Modal State
  const [isMultiDeviceModalOpen, setIsMultiDeviceModalOpen] = useState<boolean>(false);

  // Google Service Account Modal & Connection State
  const [isGoogleServiceAccountModalOpen, setIsGoogleServiceAccountModalOpen] = useState<boolean>(false);
  const [isGoogleServiceAccountConfigured, setIsGoogleServiceAccountConfigured] = useState<boolean>(false);

  // Auto-sync status on app startup
  const [autoSyncStatus, setAutoSyncStatus] = useState<{
    isSyncing: boolean;
    erpSynced: boolean;
    sheetSynced: boolean;
    lastSyncTime: string | null;
  }>({
    isSyncing: false,
    erpSynced: false,
    sheetSynced: false,
    lastSyncTime: null,
  });

  const startupSyncStartedRef = useRef<boolean>(false);

  // Reject Records State (Spreadsheet Rows)
  const [records, setRecords] = useState<RejectItemRecord[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_RECORDS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return deduplicateRecords(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to parse stored reject records', e);
    }
    return [];
  });

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isErpConfigOpen, setIsErpConfigOpen] = useState<boolean>(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [isGoogleSheetsModalOpen, setIsGoogleSheetsModalOpen] = useState<boolean>(false);
  const [isPullingSheets, setIsPullingSheets] = useState<boolean>(false);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // Load Warehouses directly from real ERPNext
  const reloadMasterData = useCallback(async () => {
    setLoadingWarehouses(true);
    try {
      const list = await ErpNextService.getWarehouses();
      setWarehouses(list);
    } catch (err) {
      console.warn('Could not load real warehouses from ERPNext', err);
    } finally {
      setLoadingWarehouses(false);
    }
  }, []);

  // AUTOMATIC STARTUP SYNC: ERPNext & Google Sheets
  // Automatically syncs when opening the application so spreadsheet data appears immediately
  useEffect(() => {
    let isMounted = true;

    // Prevent duplicate startup sync running multiple times on page load/strict mode
    if (startupSyncStartedRef.current) {
      return;
    }
    startupSyncStartedRef.current = true;

    const performStartupSync = async () => {
      setAutoSyncStatus((prev) => ({ ...prev, isSyncing: true }));

      let erpOk = false;
      let sheetOk = false;
      let cloudOk = false;
      let pulledCount = 0;

      // 0. Centralized Shared Cloud Server Sync (Multi-Device & Cross-Network Bridge)
      try {
        const sharedData = await SharedSyncService.fetchSharedData();
        if (sharedData) {
          cloudOk = true;
          // If server has records, load them into state and localStorage with deduplication
          if (Array.isArray(sharedData.records) && sharedData.records.length > 0) {
            const cleanRecords = deduplicateRecords(sharedData.records);
            if (isMounted && cleanRecords.length > 0) {
              setRecords(cleanRecords);
              localStorage.setItem(STORAGE_RECORDS_KEY, JSON.stringify(cleanRecords));
              pulledCount = cleanRecords.length;
            }
          } else {
            // If server store is empty but this device has local records, seed server store!
            const currentLocal = JSON.parse(localStorage.getItem(STORAGE_RECORDS_KEY) || '[]');
            const cleanLocal = deduplicateRecords(currentLocal);
            if (cleanLocal.length > 0) {
              await SharedSyncService.pushSharedData({ records: cleanLocal });
            }
          }

          // Sync shared Google Sheets Webhook if missing locally
          if (sharedData.gsheetWebhook && !localStorage.getItem(GSHEET_WEBHOOK_KEY)) {
            localStorage.setItem(GSHEET_WEBHOOK_KEY, sharedData.gsheetWebhook);
          }

          // Sync shared Google Sheets Spreadsheet URL
          if (sharedData.gsheetSpreadsheetUrl) {
            if (isMounted) setGsheetSpreadsheetUrl(sharedData.gsheetSpreadsheetUrl);
            localStorage.setItem(GSHEET_SPREADSHEET_URL_KEY, sharedData.gsheetSpreadsheetUrl);
          }

          // Sync ERP config if missing locally
          if (sharedData.erpConfig && !ErpNextService.getConfig().baseUrl) {
            ErpNextService.saveConfig(sharedData.erpConfig as ErpConfig);
            if (isMounted) setErpConfig(ErpNextService.getConfig());
          }
        }
      } catch (err) {
        console.warn('Startup Cloud Sync notice:', err);
      }

      // 1. Check Google Service Account status & auto-pull directly from Google Sheets
      try {
        const saStatus = await GoogleServiceAccountClient.getStatus();
        if (isMounted) {
          setIsGoogleServiceAccountConfigured(saStatus.isConfigured);
          if (saStatus.isConfigured && saStatus.spreadsheetUrl) {
            setGsheetSpreadsheetUrl(saStatus.spreadsheetUrl);
          }
        }
        if (saStatus.isConfigured) {
          const saPull = await GoogleServiceAccountClient.pullRecords();
          if (saPull.success && saPull.records && saPull.records.length > 0) {
            const clean = deduplicateRecords(saPull.records);
            if (isMounted && clean.length > 0) {
              setRecords(clean);
              localStorage.setItem(STORAGE_RECORDS_KEY, JSON.stringify(clean));
              SharedSyncService.pushSharedData({ records: clean });
              pulledCount = clean.length;
              sheetOk = true;
            }
          }
        }
      } catch (err) {
        console.warn('Service Account startup check notice:', err);
      }

      const currentErp = ErpNextService.getConfig();
      const currentGsheetWebhook = localStorage.getItem(GSHEET_WEBHOOK_KEY);

      const hasErp = !!(currentErp.baseUrl && currentErp.apiKey && currentErp.apiSecret);
      const hasGsheet = !!(currentGsheetWebhook && currentGsheetWebhook.trim().startsWith('http'));

      if (!hasErp && !hasGsheet && !sheetOk) {
        // Fallback: still load warehouse cached or available
        reloadMasterData();
        if (isMounted) {
          setAutoSyncStatus({
            isSyncing: false,
            erpSynced: false,
            sheetSynced: false,
            lastSyncTime: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          });
        }
        return;
      }

      // 2. Auto-sync ERPNext master data
      if (hasErp) {
        try {
          const list = await ErpNextService.getWarehouses();
          if (isMounted && list.length > 0) {
            setWarehouses(list);
          }
          erpOk = true;
        } catch (err) {
          console.warn('Startup ERPNext sync notice:', err);
        }
      }

      // 3. Auto-sync Google Sheets spreadsheet via Webhook / CSV URL (only if SA hasn't already pulled)
      if (hasGsheet && currentGsheetWebhook && !sheetOk) {
        try {
          const pullResult = await ExportService.pullFromGoogleSheets(currentGsheetWebhook);
          if (pullResult.success && pullResult.records && pullResult.records.length > 0) {
            const clean = deduplicateRecords(pullResult.records);
            if (isMounted && clean.length > 0) {
              setRecords(clean);
              localStorage.setItem(STORAGE_RECORDS_KEY, JSON.stringify(clean));
              SharedSyncService.pushSharedData({ records: clean });
              pulledCount = clean.length;
              sheetOk = true;
            }
          }
        } catch (err) {
          console.warn('Startup Google Sheets sync notice:', err);
        }
      }

      if (isMounted) {
        const timeNow = new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        });
        setAutoSyncStatus({
          isSyncing: false,
          erpSynced: erpOk,
          sheetSynced: sheetOk,
          lastSyncTime: timeNow,
        });

        if (erpOk || sheetOk || cloudOk) {
          const syncedItems = [
            cloudOk ? 'Cloud Multi-Device' : null,
            erpOk ? 'ERPNext' : null,
            sheetOk ? (pulledCount > 0 ? `Google Sheets (${pulledCount} baris dimuat)` : 'Google Sheets') : null,
          ]
            .filter(Boolean)
            .join(' & ');
          showToast(`⚡ Sinkronisasi otomatis berhasil (${syncedItems})`);
        }
      }
    };

    performStartupSync();

    return () => {
      isMounted = false;
    };
  }, []); // Run once on app startup

  // Manual Trigger to sync / pull from Google Sheets
  const handleSyncGoogleSheets = async () => {
    const currentGsheetWebhook = localStorage.getItem(GSHEET_WEBHOOK_KEY);
    if (!currentGsheetWebhook || !currentGsheetWebhook.trim().startsWith('http')) {
      setIsGoogleSheetsModalOpen(true);
      return;
    }

    setIsPullingSheets(true);
    try {
      const pullResult = await ExportService.pullFromGoogleSheets(currentGsheetWebhook);
      if (pullResult.success) {
        if (pullResult.records && pullResult.records.length > 0) {
          setRecords(pullResult.records);
          localStorage.setItem(STORAGE_RECORDS_KEY, JSON.stringify(pullResult.records));
          showToast(`⚡ Berhasil memuat ${pullResult.records.length} data reject langsung dari Google Sheets!`);
        } else {
          showToast('Spreadsheet terhubung (data kosong atau belum ada baris baru).');
        }
      } else {
        showToast(`Gagal membaca spreadsheet: ${pullResult.message}`);
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal sinkronisasi spreadsheet');
    } finally {
      setIsPullingSheets(false);
    }
  };

  // Persist records to localStorage whenever updated
  useEffect(() => {
    localStorage.setItem(STORAGE_RECORDS_KEY, JSON.stringify(records));
  }, [records]);

  // Background helper to keep Google Sheets & Centralized Cloud in continuous sync
  const syncToSpreadsheetBackground = useCallback((recordsToSync: RejectItemRecord[]) => {
    // 1. Centralized Cloud Sync (Bridges all devices & networks)
    SharedSyncService.pushSharedData({ records: recordsToSync }).catch((e) =>
      console.warn('Centralized cloud sync:', e)
    );

    // 2. Direct Google Sheets Service Account Sync
    GoogleServiceAccountClient.pushRecords(recordsToSync).catch((e) =>
      console.warn('Background Service Account push:', e)
    );

    // 3. Google Sheets Webhook sync
    try {
      const webhook = localStorage.getItem(GSHEET_WEBHOOK_KEY);
      if (webhook && webhook.trim().startsWith('http')) {
        ExportService.pushToGoogleSheetsWebhook(webhook, recordsToSync).catch((e) =>
          console.warn('Background spreadsheet sync:', e)
        );
      }
    } catch (e) {
      console.warn('Failed background gsheet push', e);
    }
  }, []);

  // Save new reject record (Auto-syncs to Google Sheets immediately)
  const handleSaveNewRecord = (recordData: Omit<RejectItemRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newRecord: RejectItemRecord = {
      ...recordData,
      id: `rej-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const nextRecords = [newRecord, ...records];
    setRecords(nextRecords);
    syncToSpreadsheetBackground(nextRecords);
    showToast(`Item reject "${newRecord.itemName}" berhasil dicatat & disinkronkan!`);
  };

  // Update existing record inline (Auto-syncs to Google Sheets)
  const handleUpdateRecord = (id: string, updatedFields: Partial<RejectItemRecord>) => {
    const nextRecords = records.map((r) => {
      if (r.id === id) {
        return {
          ...r,
          ...updatedFields,
          updatedAt: new Date().toISOString(),
        };
      }
      return r;
    });

    setRecords(nextRecords);
    syncToSpreadsheetBackground(nextRecords);
  };

  // In-App Delete & Clear Confirmation State (eliminates blocked window.confirm in iframes)
  const [recordToDelete, setRecordToDelete] = useState<RejectItemRecord | null>(null);
  const [isClearAllConfirmOpen, setIsClearAllConfirmOpen] = useState<boolean>(false);

  // Delete record from spreadsheet
  const handleDeleteRecord = (id: string) => {
    const item = records.find((r) => r.id === id);
    if (item) {
      setRecordToDelete(item);
    } else {
      // Direct fallback if item reference is missing
      const nextRecords = records.filter((r) => r.id !== id);
      setRecords(nextRecords);
      syncToSpreadsheetBackground(nextRecords);
      showToast('Baris data berhasil dihapus.');
    }
  };

  const confirmDeleteRecord = () => {
    if (!recordToDelete) return;
    const id = recordToDelete.id;
    const docNum = recordToDelete.docNumber;
    const nextRecords = records.filter((r) => r.id !== id);
    setRecords(nextRecords);
    localStorage.setItem(STORAGE_RECORDS_KEY, JSON.stringify(nextRecords));
    syncToSpreadsheetBackground(nextRecords);
    showToast(`Baris dokumen ${docNum} berhasil dihapus.`);
    setRecordToDelete(null);
  };

  // Clear all records
  const handleClearAllRecords = () => {
    if (records.length === 0) return;
    setIsClearAllConfirmOpen(true);
  };

  const confirmClearAllRecords = () => {
    setRecords([]);
    localStorage.removeItem(STORAGE_RECORDS_KEY);
    syncToSpreadsheetBackground([]);
    showToast('Semua data spreadsheet telah dibersihkan.');
    setIsClearAllConfirmOpen(false);
  };

  // Save ERPNext Configuration
  const handleSaveErpConfig = (newConfig: ErpConfig) => {
    ErpNextService.saveConfig(newConfig);
    setErpConfig(newConfig);
    showToast('Konfigurasi ERPNext berhasil disimpan!');
    reloadMasterData();
  };

  // Export handlers
  const handleExportExcel = () => {
    ExportService.exportToExcel(records);
    showToast('File Excel (.xlsx) berhasil diunduh!');
  };

  const handleExportCsv = () => {
    ExportService.exportToCsv(records);
    showToast('File CSV berhasil diunduh!');
  };

  const handleCopyGoogleSheets = async () => {
    const ok = await ExportService.copyForGoogleSheets(records);
    if (ok) {
      showToast('Data berhasil disalin! Buka Google Sheets lalu tekan Ctrl+V (Paste).');
    } else {
      showToast('Gagal menyalin data ke clipboard.');
    }
  };

  const hasGsheetWebhook = typeof window !== 'undefined' && !!localStorage.getItem(GSHEET_WEBHOOK_KEY);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans selection:bg-orange-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        erpConfig={erpConfig}
        onOpenErpConfig={() => setIsErpConfigOpen(true)}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenPrintModal={() => setIsPrintModalOpen(true)}
        onOpenMultiDeviceModal={() => setIsMultiDeviceModalOpen(true)}
        onOpenGoogleServiceAccountModal={() => setIsGoogleServiceAccountModalOpen(true)}
        isGoogleConfigured={isGoogleServiceAccountConfigured}
        onExportExcel={handleExportExcel}
        onCopyGoogleSheets={handleCopyGoogleSheets}
        totalRecords={records.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Banner: Real ERPNext Connection Alert if not connected */}
        {!erpConfig.baseUrl ? (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
                <Server className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-bold text-amber-950">
                  ERPNext Server Belum Dihubungkan (Mode Data Real Aktif)
                </h2>
                <p className="text-xs sm:text-sm text-amber-900 leading-relaxed max-w-2xl">
                  Aplikasi telah dikonfigurasi 100% menggunakan data real dari ERPNext tanpa data dummy. Masukkan
                  URL server ERPNext, API Key, dan API Secret distributor Anda untuk memanggil katalog master produk,
                  valuation rate dari DocType Bin, dan list warehouse secara langsung.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsErpConfigOpen(true)}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all flex items-center gap-2 shrink-0 cursor-pointer self-start md:self-auto"
            >
              <Database className="w-4 h-4" />
              <span>Hubungkan ERPNext Sekarang</span>
            </button>
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-300 rounded-xl px-4 py-3 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-950">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
              </span>
              <span className="font-bold">ERPNext Live Terhubung:</span>
              <span className="font-mono bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded text-[11px]">
                {erpConfig.baseUrl}
              </span>
              {erpConfig.loggedUser && (
                <span className="text-emerald-800 hidden sm:inline">
                  (User: <strong>{erpConfig.loggedUser}</strong>)
                </span>
              )}
              <span className="text-emerald-700 text-[11px] hidden md:inline">
                &bull; {warehouses.length} Gudang Tersedia
              </span>

              {/* Startup Auto-Sync Indicator */}
              <span className="inline-flex items-center gap-1 bg-emerald-200/70 text-emerald-900 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                <Zap className="w-3 h-3 text-emerald-700" />
                <span>Auto-Sync Aktif</span>
                {autoSyncStatus.lastSyncTime && (
                  <span className="text-emerald-800 font-normal">({autoSyncStatus.lastSyncTime})</span>
                )}
              </span>

              {hasGsheetWebhook && (
                <span className="inline-flex items-center gap-1 bg-emerald-200/70 text-emerald-900 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                  <FileSpreadsheet className="w-3 h-3 text-emerald-700" />
                  <span>Google Sheets Sync Otomatis</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={reloadMasterData}
                disabled={loadingWarehouses}
                className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md font-semibold text-[11px] flex items-center gap-1 cursor-pointer"
                title="Muat ulang master data gudang dari ERPNext"
              >
                <RefreshCw className={`w-3 h-3 ${loadingWarehouses ? 'animate-spin' : ''}`} />
                <span>Refresh ERP</span>
              </button>
              <button
                onClick={() => setIsErpConfigOpen(true)}
                className="text-emerald-700 hover:text-emerald-900 font-semibold underline text-[11px] cursor-pointer"
              >
                Pengaturan
              </button>
            </div>
          </div>
        )}

        {/* Metric Summary Cards */}
        <RejectSummaryCards records={records} />

        {/* Action bar for spreadsheet clear */}
        {records.length > 0 && (
          <div className="flex justify-end">
            <button
              onClick={handleClearAllRecords}
              className="text-xs text-slate-400 hover:text-rose-600 flex items-center gap-1.5 transition-colors cursor-pointer px-2 py-1 rounded"
              title="Bersihkan seluruh baris spreadsheet"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Semua Catatan ({records.length} Baris)</span>
            </button>
          </div>
        )}

        {/* The Spreadsheet Grid Table View */}
        <SpreadsheetView
          records={records}
          warehouses={warehouses}
          onUpdateRecord={handleUpdateRecord}
          onDeleteRecord={handleDeleteRecord}
          onOpenAddModal={() => setIsAddModalOpen(true)}
          onExportExcel={handleExportExcel}
          onExportCsv={handleExportCsv}
          onCopyGoogleSheets={handleCopyGoogleSheets}
          onOpenGoogleSheetsModal={() => setIsGoogleSheetsModalOpen(true)}
          onOpenMultiDeviceModal={() => setIsMultiDeviceModalOpen(true)}
          onOpenGoogleServiceAccountModal={() => setIsGoogleServiceAccountModalOpen(true)}
          spreadsheetUrl={gsheetSpreadsheetUrl || (hasGsheetWebhook ? localStorage.getItem(GSHEET_WEBHOOK_KEY) || '' : '')}
          onPullGoogleSheets={handleSyncGoogleSheets}
          isPullingSheets={isPullingSheets}
        />
      </main>

      {/* MODALS */}
      <GoogleServiceAccountModal
        isOpen={isGoogleServiceAccountModalOpen}
        onClose={() => setIsGoogleServiceAccountModalOpen(false)}
        records={records}
        onRecordsUpdated={(newRecords) => {
          setRecords(newRecords);
          localStorage.setItem(STORAGE_RECORDS_KEY, JSON.stringify(newRecords));
          SharedSyncService.pushSharedData({ records: newRecords });
        }}
        onSuccessToast={(msg) => showToast(msg)}
      />

      <MultiDeviceConnectModal
        isOpen={isMultiDeviceModalOpen}
        onClose={() => setIsMultiDeviceModalOpen(false)}
        spreadsheetUrl={gsheetSpreadsheetUrl || (hasGsheetWebhook ? localStorage.getItem(GSHEET_WEBHOOK_KEY) || '' : '')}
        onSaveSpreadsheetUrl={(url) => {
          setGsheetSpreadsheetUrl(url);
          localStorage.setItem(GSHEET_SPREADSHEET_URL_KEY, url);
          SharedSyncService.pushSharedData({ gsheetSpreadsheetUrl: url });
          showToast('Link Google Sheets berhasil disimpan & disinkronkan ke semua device!');
        }}
        totalRecords={records.length}
      />

      <AddRejectModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSaveRecord={handleSaveNewRecord}
        warehouses={warehouses}
        onOpenErpConfig={() => {
          setIsAddModalOpen(false);
          setIsErpConfigOpen(true);
        }}
      />

      <ErpConnectionModal
        isOpen={isErpConfigOpen}
        onClose={() => setIsErpConfigOpen(false)}
        config={erpConfig}
        onSaveConfig={handleSaveErpConfig}
        onDataSynced={reloadMasterData}
      />

      <PrintBeritaAcaraModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        records={records}
        companyName={erpConfig.companyName || 'PT Distributor Logistik Utama'}
      />

      <GoogleSheetsSyncModal
        isOpen={isGoogleSheetsModalOpen}
        onClose={() => setIsGoogleSheetsModalOpen(false)}
        records={records}
        onRecordsUpdated={(newRecords) => {
          setRecords(newRecords);
          localStorage.setItem(STORAGE_RECORDS_KEY, JSON.stringify(newRecords));
          showToast(`⚡ ${newRecords.length} data spreadsheet berhasil dimuat!`);
        }}
      />

      {/* In-App Modal: Konfirmasi Hapus Baris Dokumen */}
      {recordToDelete && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Hapus Baris Spreadsheet?</h3>
                <p className="text-xs text-slate-500">Tindakan ini akan menghapus data reject dari daftar:</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">No. Dokumen:</span>
                <span className="font-mono font-bold text-slate-800">{recordToDelete.docNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Nama Item:</span>
                <span className="font-semibold text-slate-800 truncate max-w-[220px]" title={recordToDelete.itemName}>
                  {recordToDelete.itemName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Qty Reject:</span>
                <span className="font-bold text-rose-600">{recordToDelete.qty} {recordToDelete.uom}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Alasan Reject:</span>
                <span className="text-slate-700 font-medium">{recordToDelete.alasanReject}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRecordToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDeleteRecord}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Baris</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Modal: Konfirmasi Bersihkan Semua Data */}
      {isClearAllConfirmOpen && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Bersihkan Semua Data?</h3>
                <p className="text-xs text-slate-500">Semua {records.length} baris data reject akan dihapus.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-5 leading-relaxed bg-amber-50 border border-amber-200 p-3 rounded-xl text-amber-900">
              Apakah Anda yakin ingin menghapus seluruh baris pencatatan reject di spreadsheet? Data lokal dan sinkronisasi akan dikosongkan.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsClearAllConfirmOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmClearAllRecords}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Semua</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-fade-in text-xs sm:text-sm max-w-md">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
