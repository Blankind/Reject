import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  Copy,
  CheckCircle2,
  Send,
  HelpCircle,
  Code2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Table,
  Wand2,
  Check,
  RefreshCw,
  Download,
} from 'lucide-react';
import { RejectItemRecord } from '../types/reject';
import { ExportService } from '../services/exportService';

interface GoogleSheetsSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: RejectItemRecord[];
  onRecordsUpdated?: (records: RejectItemRecord[]) => void;
}

export const APPS_SCRIPT_TEMPLATE = `// ========================================================
// GOOGLE APPS SCRIPT: TWO-WAY AUTO SYNC SPREADSHEET REJECT
// Dilengkapi 20 Kolom Lengkap Termasuk Bukti Foto Kerusakan
// Buka aplikasi langsung memuat data spreadsheet & auto sync
// ========================================================

var SHEET_NAME = "Data Reject Distributor";

function getHeaders() {
  return [
    "No",
    "Waktu Input",
    "No Dokumen",
    "Tanggal Reject",
    "Jenis / Brand",
    "Kode Item",
    "Nama Item & Spesifikasi",
    "Gudang Asal / Letak",
    "Posisi / Letak Fisik",
    "Qty",
    "Satuan",
    "Valuation Rate (Rp)",
    "Total Nilai Kerugian (Rp)",
    "Kategori Cacat / Alasan Reject",
    "Keterangan Kerusakan",
    "Status Penanganan",
    "PIC Gudang",
    "No Surat Jalan / Ref",
    "Catatan Tambahan",
    "Foto / Bukti Gambar Reject"
  ];
}

function rebuildHeaders(sheet) {
  var headers = getHeaders();
  
  // Format baris pertama dengan 20 header
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Desain Header: Emerald tua, font putih tebal, rata tengah
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground("#064e3b");
  headerRange.setFontColor("#ffffff");
  headerRange.setFontWeight("bold");
  headerRange.setFontSize(10);
  headerRange.setHorizontalAlignment("center");
  headerRange.setVerticalAlignment("middle");
  sheet.setRowHeight(1, 34);
  
  // Bekukan baris header agar tetap terlihat saat di-scroll
  sheet.setFrozenRows(1);
  
  // Format Angka Rupiah untuk kolom Valuation Rate & Total Nilai (Kolom 12 & 13)
  sheet.getRange(2, 12, 1000, 2).setNumberFormat('"Rp"#,##0');
  
  // Format rata tengah untuk kolom No, Tanggal, Qty, Satuan, Status, Foto
  sheet.getRange(2, 1, 1000, 1).setHorizontalAlignment("center");
  sheet.getRange(2, 3, 1000, 2).setHorizontalAlignment("center");
  sheet.getRange(2, 10, 1000, 2).setHorizontalAlignment("center");
  sheet.getRange(2, 16, 1000, 1).setHorizontalAlignment("center");
  sheet.getRange(2, 20, 1000, 1).setHorizontalAlignment("center");
  
  // Auto-fit lebar kolom
  for (var col = 1; col <= headers.length; col++) {
    sheet.autoResizeColumn(col);
  }
}

function getOrCreateRejectSheet(ss) {
  var sheet = ss.getSheetByName(SHEET_NAME);
  
  // 1. Otomatis buat Sheet baru jika belum ada
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  
  // 2. Otomatis buat Header jika kosong atau belum 20 kolom
  if (sheet.getLastRow() === 0 || sheet.getLastColumn() < 20) {
    rebuildHeaders(sheet);
  }
  
  return sheet;
}

// Handler GET: Dipanggil otomatis saat aplikasi dibuka
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateRejectSheet(ss);
    var lastRow = sheet.getLastRow();
    
    if (lastRow <= 1) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        total: 0,
        items: []
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var dataRange = sheet.getRange(2, 1, lastRow - 1, 20);
    var values = dataRange.getValues();
    var items = [];
    
    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      if (!row[2] && !row[6]) continue;
      
      var dateStr = "";
      if (row[3] instanceof Date) {
        dateStr = Utilities.formatDate(row[3], Session.getScriptTimeZone(), "yyyy-MM-dd");
      } else {
        dateStr = String(row[3] || "");
      }
      
      items.push({
        id: "gsheet-" + (row[2] || (i + 1)) + "-" + i,
        docNumber: String(row[2] || ("REJ-" + (i + 1))),
        date: dateStr || new Date().toISOString().split("T")[0],
        jenis: String(row[4] || "Distributor"),
        itemCode: String(row[5] || ""),
        itemName: String(row[6] || ""),
        sourceWarehouse: String(row[7] || "Gudang Utama"),
        targetWarehouse: String(row[8] || "-"),
        qty: Number(row[9]) || 1,
        uom: String(row[10] || "Batang"),
        valuationRate: Number(row[11]) || 0,
        totalValue: Number(row[12]) || 0,
        alasanReject: String(row[13] || "Bengkok / Deformasi"),
        keteranganAlasan: String(row[14] || ""),
        status: String(row[15] || "Karantina Gudang"),
        pic: String(row[16] || "Staff Gudang"),
        referenceDoc: String(row[17] || ""),
        notes: String(row[18] || ""),
        photoUrl: String(row[19] || "")
      });
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      total: items.length,
      items: items
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Handler POST: Menerima pembaruan data, pembuatan ulang kolom & pembacaan
function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateRejectSheet(ss);
    
    var data = {};
    if (e && e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    }
    
    // Action Read
    if (data.action === "read") {
      return doGet(e);
    }
    
    // Action Inisialisasi Ulang Kolom & Tabel (recreate_table / init)
    if (data.action === "init" || data.action === "recreate_table") {
      sheet.clear();
      rebuildHeaders(sheet);
      
      var initialItems = data.items || [];
      if (initialItems.length > 0) {
        initialItems.forEach(function(item, idx) {
          sheet.appendRow([
            idx + 1,
            new Date(),
            item.docNumber,
            item.date,
            item.jenis || "Distributor",
            item.itemCode,
            item.itemName,
            item.sourceWarehouse,
            item.targetWarehouse,
            Number(item.qty || 1),
            item.uom || "Batang",
            Number(item.valuationRate || 0),
            Number(item.totalValue || 0),
            item.alasanReject,
            item.keteranganAlasan || "",
            item.status,
            item.pic,
            item.referenceDoc || "",
            item.notes || "",
            item.photoUrl || ""
          ]);
        });
      }
      
      for (var c = 1; c <= 20; c++) {
        sheet.autoResizeColumn(c);
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Struktur 20 kolom (termasuk kolom Foto / Bukti Gambar Reject) berhasil dibuat dan diformat di Google Sheets!",
        sheetName: sheet.getName(),
        totalColumns: 20
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var items = data.items || [];
    
    // Deduplikasi items di Apps Script agar tidak pernah menghasilkan baris ganda
    var uniqueMap = {};
    var uniqueItems = [];
    for (var u = 0; u < items.length; u++) {
      var itm = items[u];
      var key = String(itm.docNumber || itm.id || (itm.itemCode + "_" + itm.date + "_" + itm.qty)).trim().toUpperCase();
      if (!uniqueMap[key]) {
        uniqueMap[key] = true;
        uniqueItems.push(itm);
      }
    }
    
    // Jika sync_all: Timpa seluruh data dari baris 2 secara presisi (TIDAK MENGGUNAKAN appendRow)
    if (data.action === "sync_all") {
      var currentLastRow = sheet.getLastRow();
      if (currentLastRow > 1) {
        sheet.getRange(2, 1, currentLastRow - 1, 20).clearContent();
      } else if (currentLastRow === 0 || sheet.getLastColumn() < 20) {
        rebuildHeaders(sheet);
      }
      
      if (uniqueItems.length > 0) {
        var dataMatrix = uniqueItems.map(function(item, idx) {
          return [
            idx + 1,
            new Date(),
            item.docNumber || "",
            item.date || "",
            item.jenis || "Distributor",
            item.itemCode || "",
            item.itemName || "",
            item.sourceWarehouse || "",
            item.targetWarehouse || "",
            Number(item.qty || 1),
            item.uom || "Batang",
            Number(item.valuationRate || 0),
            Number(item.totalValue || 0),
            item.alasanReject || "",
            item.keteranganAlasan || "",
            item.status || "",
            item.pic || "",
            item.referenceDoc || "",
            item.notes || "",
            item.photoUrl || ""
          ];
        });
        sheet.getRange(2, 1, dataMatrix.length, 20).setValues(dataMatrix);
      }
    } else {
      var startRow = sheet.getLastRow();
      uniqueItems.forEach(function(item, idx) {
        sheet.appendRow([
          startRow + idx,
          new Date(),
          item.docNumber || "",
          item.date || "",
          item.jenis || "Distributor",
          item.itemCode || "",
          item.itemName || "",
          item.sourceWarehouse || "",
          item.targetWarehouse || "",
          Number(item.qty || 1),
          item.uom || "Batang",
          Number(item.valuationRate || 0),
          Number(item.totalValue || 0),
          item.alasanReject || "",
          item.keteranganAlasan || "",
          item.status || "",
          item.pic || "",
          item.referenceDoc || "",
          item.notes || "",
          item.photoUrl || ""
        ]);
      });
    }
    
    for (var c = 1; c <= 20; c++) {
      sheet.autoResizeColumn(c);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: uniqueItems.length + " item reject berhasil disinkronkan ke sheet " + sheet.getName() + " tanpa duplikasi!",
      count: uniqueItems.length
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

export const GoogleSheetsSyncModal: React.FC<GoogleSheetsSyncModalProps> = ({
  isOpen,
  onClose,
  records,
  onRecordsUpdated,
}) => {
  const [webhookUrl, setWebhookUrl] = useState<string>(() => {
    return localStorage.getItem('distri_gsheet_webhook') || '';
  });
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isPulling, setIsPulling] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [copiedData, setCopiedData] = useState<boolean>(false);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);
  const [showScriptGuide, setShowScriptGuide] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleCopyClipboard = async () => {
    const success = await ExportService.copyForGoogleSheets(records);
    if (success) {
      setCopiedData(true);
      setTimeout(() => setCopiedData(false), 3000);
      setStatusMessage({
        type: 'success',
        text: 'Data berhasil disalin! Buka Google Sheets Anda lalu tekan Ctrl+V (Paste) di sel A1.',
      });
    }
  };

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(APPS_SCRIPT_TEMPLATE);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 3000);
    } catch {
      // Fallback
    }
  };

  // Test connection & trigger automatic creation of Sheet & 20 Headers on connect or rebuild
  const handleTestAndInitSheet = async () => {
    if (!webhookUrl || !webhookUrl.trim().startsWith('http')) {
      setStatusMessage({
        type: 'error',
        text: 'Masukkan URL Webhook Google Apps Script terlebih dahulu.',
      });
      return;
    }

    setIsInitializing(true);
    setStatusMessage(null);
    localStorage.setItem('distri_gsheet_webhook', webhookUrl.trim());

    try {
      const result = await ExportService.initGoogleSheetsWebhook(webhookUrl.trim(), records);
      if (result.success) {
        setStatusMessage({
          type: 'success',
          text: 'Terkoneksi! Tab "Data Reject Distributor" beserta seluruh 20 kolom (termasuk kolom Foto / Bukti Gambar Reject) telah berhasil dibuat dan diformat otomatis di Google Sheets Anda!',
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: result.message,
        });
      }
    } catch (e: any) {
      setStatusMessage({
        type: 'error',
        text: e.message || 'Gagal inisialisasi sheet.',
      });
    } finally {
      setIsInitializing(false);
    }
  };

  // Pull / Read data directly from Google Sheets into the application
  const handlePullSpreadsheet = async () => {
    if (!webhookUrl || !webhookUrl.trim().startsWith('http')) {
      setStatusMessage({
        type: 'error',
        text: 'Masukkan URL Webhook Google Apps Script atau link Google Sheets terlebih dahulu.',
      });
      return;
    }

    setIsPulling(true);
    setStatusMessage(null);
    localStorage.setItem('distri_gsheet_webhook', webhookUrl.trim());

    try {
      const result = await ExportService.pullFromGoogleSheets(webhookUrl.trim());
      if (result.success) {
        setStatusMessage({
          type: 'success',
          text: `Berhasil menarik ${result.records.length} baris data langsung dari spreadsheet ke aplikasi!`,
        });
        if (onRecordsUpdated) {
          onRecordsUpdated(result.records);
        }
      } else {
        setStatusMessage({
          type: 'error',
          text: result.message,
        });
      }
    } catch (e: any) {
      setStatusMessage({
        type: 'error',
        text: e.message || 'Gagal menarik data dari Google Sheets.',
      });
    } finally {
      setIsPulling(false);
    }
  };

  const handlePushWebhook = async () => {
    if (!webhookUrl || !webhookUrl.trim().startsWith('http')) {
      setStatusMessage({
        type: 'error',
        text: 'Masukkan URL Webhook Google Apps Script yang valid (berawalan https://script.google.com/macros/s/...)',
      });
      return;
    }

    setIsSending(true);
    setStatusMessage(null);
    localStorage.setItem('distri_gsheet_webhook', webhookUrl.trim());

    try {
      const result = await ExportService.pushToGoogleSheetsWebhook(webhookUrl.trim(), records);
      if (result.success) {
        setStatusMessage({
          type: 'success',
          text: `Berhasil! Data ${records.length} item reject telah masuk ke Google Sheets. Sheet & header otomatis dibuat jika belum ada.`,
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: result.message,
        });
      }
    } catch (e: any) {
      setStatusMessage({
        type: 'error',
        text: e.message || 'Gagal mengirim data ke webhook.',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-emerald-950 px-6 py-4 text-white flex items-center justify-between border-b border-emerald-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-md">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">Sinkronisasi ke Google Sheets</h2>
              <p className="text-xs text-emerald-300">
                Pencatatan data item reject otomatis masuk ke tabel spreadsheet
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-emerald-300 hover:text-white rounded-lg hover:bg-emerald-900 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto">
          {/* Automatic Sheet & Header Creation Notice */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300 rounded-xl p-3.5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
              <Wand2 className="w-4 h-4" />
            </div>
            <div className="text-xs space-y-1">
              <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                <span>Otomatis Buat Sheet &amp; Header Saat Pertama Terhubung</span>
                <span className="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded font-mono font-bold">
                  Auto-Setup
                </span>
              </div>
              <p className="text-emerald-900 leading-relaxed text-[11px]">
                Anda tidak perlu membuat tabel atau mengetik judul kolom secara manual di Google Sheets. Script ini akan otomatis
                membuat lembar <strong className="underline">&quot;Data Reject Distributor&quot;</strong>, membekukan baris atas (freeze header),
                memberi warna header emerald elegan, serta menerapkan format mata uang Rupiah secara otomatis.
              </p>
            </div>
          </div>

          {/* Method 1: Instant 1-Click Copy Paste */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-slate-700 text-white text-[11px] font-bold flex items-center justify-center">
                  1
                </span>
                Metode Cepat: Salin &amp; Tempel (Copy-Paste)
              </span>
              <span className="text-[10px] text-slate-600 font-bold bg-slate-200 px-2 py-0.5 rounded">
                Tanpa Setup Webhook
              </span>
            </div>
            <p className="text-xs text-slate-600 mb-3">
              Format data disesuaikan otomatis dengan kolom Google Sheets lengkap dengan formula dan harga perolehan.
            </p>
            <button
              type="button"
              onClick={handleCopyClipboard}
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              {copiedData ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Data Tersalin! Buka Google Sheets &rarr; Tekan Ctrl+V</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Salin Semua Data ({records.length} Baris) untuk Google Sheets</span>
                </>
              )}
            </button>
          </div>

          {/* Method 2: Google Apps Script Webhook with Auto-Header */}
          <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-emerald-700 text-white text-[11px] font-bold flex items-center justify-center">
                  2
                </span>
                Metode Otomatis: Webhook Google Apps Script (Auto-Header)
              </span>
              <button
                type="button"
                onClick={() => setShowScriptGuide(!showScriptGuide)}
                className="text-xs text-emerald-800 hover:text-emerald-900 font-bold flex items-center gap-1 cursor-pointer bg-white px-2.5 py-1 rounded-md border border-emerald-300 shadow-xs"
              >
                <Code2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>{showScriptGuide ? 'Tutup Panduan' : 'Lihat Script Auto-Header'}</span>
                {showScriptGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Kirim data reject langsung ke Google Sheets secara otomatis. Saat pertama kali terhubung atau saat di-refresh, tab &amp; 20 kolom header lengkap (termasuk kolom Foto Bukti Gambar Reject) dibuat seketika oleh webhook.
            </p>

            {/* Expandable Guide & Script Code */}
            {showScriptGuide && (
              <div className="bg-white border border-slate-300 rounded-xl p-4 space-y-3 text-xs text-slate-700 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Kode Script Auto-Create Sheet &amp; Header
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyScript}
                    className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded text-[11px] flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    {copiedScript ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-200" />
                        <span>Kode Berhasil Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin Kode Script</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px] text-slate-600 space-y-1">
                  <div className="font-bold text-slate-800">Cara Pasang Cepat (1 Menit):</div>
                  <ol className="list-decimal list-inside space-y-0.5">
                    <li>Buka Google Sheets &rarr; Menu <strong>Extensions (Ekstensi)</strong> &rarr; <strong>Apps Script</strong>.</li>
                    <li>Hapus kode bawaan, lalu <strong>Paste</strong> kode script ini.</li>
                    <li>Klik <strong>Deploy (Terapkan)</strong> &rarr; <strong>New deployment</strong> &rarr; pilih <strong>Web app</strong>.</li>
                    <li>Pilih <i>Execute as:</i> <strong>Me</strong> dan <i>Who has access:</i> <strong>Anyone</strong> &rarr; klik <strong>Deploy</strong>.</li>
                    <li>Salin URL Web App dan tempel ke kolom di bawah.</li>
                  </ol>
                </div>

                <div className="relative">
                  <pre className="bg-slate-900 text-emerald-400 p-3 rounded-lg text-[10px] font-mono overflow-x-auto max-h-44 border border-slate-800 leading-relaxed selection:bg-emerald-700 selection:text-white">
                    {APPS_SCRIPT_TEMPLATE}
                  </pre>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-slate-700">
                  URL Web App Google Apps Script / Link Dokumen Google Sheets
                </label>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                  Auto-Sync on Startup
                </span>
              </div>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/AKfycb.../exec atau link Google Sheets"
                className="w-full text-xs py-2 px-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono"
              />
              <p className="text-[10px] text-emerald-800 mt-1 font-medium">
                ⚡ <strong>Sistem Auto-Sync Aktif:</strong> Setiap kali aplikasi dibuka, data dari spreadsheet ini otomatis ditarik dan langsung tampil di tabel aplikasi!
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              {/* Pull Data Directly */}
              <button
                type="button"
                onClick={handlePullSpreadsheet}
                disabled={isPulling || !webhookUrl.trim()}
                className="py-2.5 px-3 bg-emerald-800 hover:bg-emerald-900 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                title="Tarik data terbaru dari spreadsheet langsung ke aplikasi"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isPulling ? 'animate-spin' : ''}`} />
                <span>{isPulling ? 'Menarik Data...' : 'Tarik dari Sheets'}</span>
              </button>

              {/* Push Data */}
              <button
                type="button"
                onClick={handlePushWebhook}
                disabled={isSending || records.length === 0 || !webhookUrl.trim()}
                className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                title="Kirim atau perbarui seluruh data reject ke Google Sheets"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSending ? 'Mengirim Data...' : `Kirim ke Sheets`}</span>
              </button>

              {/* Test Connection & Auto Init Sheet */}
              <button
                type="button"
                onClick={handleTestAndInitSheet}
                disabled={isInitializing || !webhookUrl.trim()}
                className="py-2.5 px-3 bg-white border border-emerald-600 hover:bg-emerald-50 text-emerald-950 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:border-slate-200 disabled:text-slate-400 shadow-2xs"
                title="Cek koneksi dan buat ulang seluruh 20 kolom (termasuk kolom Foto Bukti Barang) di Google Sheets sekarang"
              >
                <Table className="w-3.5 h-3.5 text-emerald-700" />
                <span>{isInitializing ? 'Membuat Kolom...' : 'Buat Ulang 20 Kolom'}</span>
              </button>
            </div>
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div
              className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-100/70 text-emerald-900 border border-emerald-300'
                  : 'bg-rose-100 text-rose-900 border border-rose-300'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <HelpCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Quick instructions */}
          <div className="text-[11px] text-slate-500 flex items-start gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <HelpCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              Tabel spreadsheet akan otomatis memiliki 20 kolom header berformat rapi (Nomor Dokumen, Tanggal, Jenis / Brand, Kode &amp; Nama Item, Gudang Asal, Gudang Tujuan, Qty, Valuation Rate, Nilai Kerugian, Alasan Reject, Status, PIC, dan <strong>Foto / Bukti Gambar Reject</strong>).
            </span>
          </div>

          {/* Footer */}
          <div className="flex justify-end pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
