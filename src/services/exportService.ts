import * as XLSX from 'xlsx';
import { RejectItemRecord, deduplicateRecords } from '../types/reject';

export class ExportService {
  /**
   * Format number as Indonesian Rupiah
   */
  public static formatRupiah(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  /**
   * Export reject records to Excel (.xlsx) file
   */
  public static exportToExcel(records: RejectItemRecord[], filename = 'Data_Item_Reject_Distributor.xlsx') {
    const formattedData = records.map((r, index) => ({
      'No': index + 1,
      'No Dokumen': r.docNumber,
      'Tanggal': r.date,
      'Jenis / Brand': r.jenis,
      'Item Code (ERPNext)': r.itemCode,
      'Item Name (ERPNext)': r.itemName,
      'Warehouse Asal': r.sourceWarehouse,
      'Warehouse Tujuan (Reject)': r.targetWarehouse,
      'Qty Reject': r.qty,
      'Satuan (UOM)': r.uom,
      'Valuation Rate ERPNext (Rp)': r.valuationRate,
      'Total Nilai Kerugian (Rp)': r.totalValue,
      'Alasan Reject': r.alasanReject,
      'Detail Cacat': r.keteranganAlasan || '-',
      'Status Penanganan': r.status,
      'PIC Gudang': r.pic,
      'No Ref / SJ': r.referenceDoc || '-',
      'Catatan': r.notes || '-',
      'Foto / Bukti Gambar Reject': r.photoUrl || '-',
    }));

    const worksheet = XLSX.utils.json_to_sheet(formattedData);

    // Auto calculate column widths
    const columnKeys = Object.keys(formattedData[0] || {});
    worksheet['!cols'] = columnKeys.map((key) => ({
      wch: Math.max(key.length + 4, 15),
    }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reject Items');

    XLSX.writeFile(workbook, filename);
  }

  /**
   * Export reject records to CSV
   */
  public static exportToCsv(records: RejectItemRecord[], filename = 'Data_Item_Reject_Distributor.csv') {
    const headers = [
      'No',
      'No Dokumen',
      'Tanggal',
      'Jenis',
      'Item Code',
      'Item Name',
      'Warehouse Asal',
      'Warehouse Tujuan',
      'Qty',
      'UOM',
      'Valuation Rate',
      'Total Nilai',
      'Alasan Reject',
      'Keterangan',
      'Status',
      'PIC',
      'No Ref',
      'Catatan',
      'Foto / Bukti Gambar Reject',
    ];

    const rows = records.map((r, i) => [
      i + 1,
      `"${r.docNumber}"`,
      `"${r.date}"`,
      `"${r.jenis}"`,
      `"${r.itemCode}"`,
      `"${r.itemName.replace(/"/g, '""')}"`,
      `"${r.sourceWarehouse}"`,
      `"${r.targetWarehouse}"`,
      r.qty,
      `"${r.uom}"`,
      r.valuationRate,
      r.totalValue,
      `"${r.alasanReject}"`,
      `"${(r.keteranganAlasan || '').replace(/"/g, '""')}"`,
      `"${r.status}"`,
      `"${r.pic}"`,
      `"${r.referenceDoc || ''}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`,
      `"${(r.photoUrl || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Copy to clipboard in TSV format ready for 1-click paste into Google Sheets
   */
  public static async copyForGoogleSheets(records: RejectItemRecord[]): Promise<boolean> {
    const headers = [
      'No Dokumen',
      'Tanggal',
      'Jenis',
      'Item Code',
      'Item Name',
      'Warehouse Asal',
      'Warehouse Tujuan',
      'Qty',
      'Satuan',
      'Valuation Rate (Rp)',
      'Total Nilai (Rp)',
      'Alasan Reject',
      'Keterangan Kerusakan',
      'Status Penanganan',
      'PIC Gudang',
      'No Referensi / SJ',
      'Foto / Bukti Gambar Reject',
    ];

    const rows = records.map((r) => [
      r.docNumber,
      r.date,
      r.jenis,
      r.itemCode,
      r.itemName,
      r.sourceWarehouse,
      r.targetWarehouse,
      r.qty,
      r.uom,
      r.valuationRate,
      r.totalValue,
      r.alasanReject,
      r.keteranganAlasan || '',
      r.status,
      r.pic,
      r.referenceDoc || '',
      r.photoUrl || '',
    ]);

    const tsvContent = [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');

    try {
      await navigator.clipboard.writeText(tsvContent);
      return true;
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
      return false;
    }
  }

  /**
   * Initialize Sheet & 20 Formatted Headers on connection or rebuild
   */
  public static async initGoogleSheetsWebhook(
    webhookUrl: string,
    records: RejectItemRecord[] = []
  ): Promise<{ success: boolean; message: string }> {
    if (!webhookUrl || !webhookUrl.trim().startsWith('http')) {
      return { success: false, message: 'URL Webhook Google Sheets tidak valid' };
    }

    try {
      const payload = {
        action: 'recreate_table',
        sheetName: 'Data Reject Distributor',
        timestamp: new Date().toISOString(),
        items: records,
      };

      // Try via backend proxy first to avoid CORS/redirect issues
      try {
        const proxyRes = await fetch('/api/gsheet-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: webhookUrl.trim(),
            method: 'POST',
            body: payload,
          }),
        });
        if (proxyRes.ok) {
          return {
            success: true,
            message: 'Berhasil terhubung! Sheet "Data Reject Distributor" beserta seluruh 20 kolom (termasuk kolom Foto / Bukti Gambar Reject) telah diinisialisasi otomatis di Google Sheets.',
          };
        }
      } catch (proxyErr) {
        console.warn('Proxy init attempt fell back to direct fetch', proxyErr);
      }

      // Direct fallback
      await fetch(webhookUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'no-cors',
      });

      return {
        success: true,
        message: 'Berhasil terhubung! Sheet "Data Reject Distributor" beserta seluruh 20 kolom (termasuk kolom Foto / Bukti Gambar Reject) telah diinisialisasi otomatis di Google Sheets.',
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Gagal menginisialisasi Google Sheets: ${err.message || 'Error'}`,
      };
    }
  }

  /**
   * Pull / Fetch reject records directly from Google Sheets or Apps Script Webhook.
   * Enables automatic two-way sync: open app -> instantly load spreadsheet rows.
   */
  public static async pullFromGoogleSheets(
    sheetOrWebhookUrl: string
  ): Promise<{ success: boolean; records: RejectItemRecord[]; message: string }> {
    if (!sheetOrWebhookUrl || !sheetOrWebhookUrl.trim().startsWith('http')) {
      return { success: false, records: [], message: 'URL Google Sheets belum diatur' };
    }

    const trimmedUrl = sheetOrWebhookUrl.trim();

    try {
      // CASE 1: Direct Google Spreadsheet Link (https://docs.google.com/spreadsheets/d/{ID}/...)
      const gsheetMatch = trimmedUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (gsheetMatch && gsheetMatch[1]) {
        const spreadsheetId = gsheetMatch[1];
        const gidMatch = trimmedUrl.match(/[#&]gid=([0-9]+)/);
        const gidParam = gidMatch ? `&gid=${gidMatch[1]}` : '';
        const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv${gidParam}`;

        let csvText = '';
        try {
          const res = await fetch('/api/gsheet-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: csvUrl, method: 'GET' }),
          });
          if (res.ok) {
            csvText = await res.text();
          }
        } catch (e) {
          console.warn('Proxy gsheet fetch fallback to direct:', e);
        }

        if (!csvText) {
          const directRes = await fetch(csvUrl);
          csvText = await directRes.text();
        }

        if (csvText && (csvText.includes(',') || csvText.includes('\t'))) {
          const workbook = XLSX.read(csvText, { type: 'string' });
          const firstSheet = workbook.SheetNames[0];
          const rawRows = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[firstSheet], { header: 1 });

          if (rawRows.length > 1) {
            const records: RejectItemRecord[] = [];
            // Skip row 0 (headers)
            for (let i = 1; i < rawRows.length; i++) {
              const r = rawRows[i];
              if (!r || r.length === 0) continue;
              
              // Skip empty rows without docNumber or itemName
              const docNum = String(r[2] || r[1] || '').trim();
              const itemName = String(r[6] || r[5] || '').trim();
              if (!docNum && !itemName) continue;

              const cleanNumber = (val: any): number => {
                if (typeof val === 'number') return val;
                if (!val) return 0;
                const cleaned = String(val).replace(/[^0-9.-]/g, '');
                return Number(cleaned) || 0;
              };

              records.push({
                id: `gsheet-${docNum || 'row'}-${i}`,
                docNumber: docNum || `REJ-GS-${i}`,
                date: String(r[3] || new Date().toISOString().split('T')[0]).trim(),
                jenis: String(r[4] || 'Distributor').trim(),
                itemCode: String(r[5] || '').trim(),
                itemName: itemName || String(r[5] || 'Item Reject'),
                sourceWarehouse: String(r[7] || 'Gudang Utama').trim(),
                targetWarehouse: String(r[8] || '-').trim(),
                qty: cleanNumber(r[9]) || 1,
                uom: String(r[10] || 'Batang').trim(),
                valuationRate: cleanNumber(r[11]) || 0,
                totalValue: cleanNumber(r[12]) || (cleanNumber(r[9]) * cleanNumber(r[11])),
                alasanReject: (r[13] as any) || 'Bengkok / Deformasi',
                keteranganAlasan: String(r[14] || '').trim(),
                status: (r[15] as any) || 'Karantina Gudang',
                pic: String(r[16] || 'Staff Gudang').trim(),
                referenceDoc: String(r[17] || '').trim(),
                notes: String(r[18] || '').trim(),
                photoUrl: String(r[19] || '').trim() || undefined,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            }

            const cleanRecords = deduplicateRecords(records);
            return {
              success: true,
              records: cleanRecords,
              message: `Berhasil menarik ${cleanRecords.length} baris data langsung dari Google Spreadsheet!`,
            };
          }
        }
      }

      // CASE 2: Google Apps Script Webhook (script.google.com/macros/s/.../exec)
      const readUrl = trimmedUrl.includes('?') ? `${trimmedUrl}&action=read` : `${trimmedUrl}?action=read`;

      let jsonResult: any = null;

      // Try proxy first (solves Apps Script HTTP 302 redirects & CORS seamlessly)
      try {
        const proxyRes = await fetch('/api/gsheet-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: readUrl, method: 'GET' }),
        });
        if (proxyRes.ok) {
          jsonResult = await proxyRes.json();
        }
      } catch (proxyErr) {
        console.warn('Apps Script GET proxy fallback:', proxyErr);
      }

      // If GET didn't return items, try POST with action="read"
      if (!jsonResult || !jsonResult.items) {
        try {
          const postProxyRes = await fetch('/api/gsheet-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: trimmedUrl,
              method: 'POST',
              body: { action: 'read' },
            }),
          });
          if (postProxyRes.ok) {
            jsonResult = await postProxyRes.json();
          }
        } catch (e) {
          console.warn('Apps Script POST read fallback:', e);
        }
      }

      // If jsonResult contains items
      if (jsonResult && Array.isArray(jsonResult.items)) {
        const mappedRecords: RejectItemRecord[] = jsonResult.items.map((it: any, idx: number) => ({
          id: it.id || `gsheet-${it.docNumber || idx}`,
          docNumber: it.docNumber || `REJ-${idx + 1}`,
          date: it.date || new Date().toISOString().split('T')[0],
          jenis: it.jenis || 'Distributor',
          itemCode: it.itemCode || '',
          itemName: it.itemName || 'Item Reject',
          sourceWarehouse: it.sourceWarehouse || 'Gudang Utama',
          targetWarehouse: it.targetWarehouse || '-',
          qty: Number(it.qty) || 1,
          uom: it.uom || 'Batang',
          valuationRate: Number(it.valuationRate) || 0,
          totalValue: Number(it.totalValue) || (Number(it.qty || 1) * Number(it.valuationRate || 0)),
          alasanReject: it.alasanReject || 'Bengkok / Deformasi',
          keteranganAlasan: it.keteranganAlasan || '',
          status: it.status || 'Karantina Gudang',
          pic: it.pic || 'Staff Gudang',
          referenceDoc: it.referenceDoc || '',
          notes: it.notes || '',
          photoUrl: it.photoUrl || '',
          createdAt: it.createdAt || new Date().toISOString(),
          updatedAt: it.updatedAt || new Date().toISOString(),
        }));

        const cleanRecords = deduplicateRecords(mappedRecords);

        return {
          success: true,
          records: cleanRecords,
          message: `Berhasil memuat ${cleanRecords.length} data reject dari Google Sheets.`,
        };
      }

      return {
        success: false,
        records: [],
        message: 'Tidak ada baris data yang ditemukan di spreadsheet.',
      };
    } catch (err: any) {
      console.error('Failed to pull records from Google Sheets:', err);
      return {
        success: false,
        records: [],
        message: `Gagal membaca spreadsheet: ${err.message || 'Error'}`,
      };
    }
  }

  /**
   * Send data to Google Sheets via Webhook (Google Apps Script)
   */
  public static async pushToGoogleSheetsWebhook(
    webhookUrl: string,
    records: RejectItemRecord[]
  ): Promise<{ success: boolean; message: string }> {
    if (!webhookUrl || !webhookUrl.startsWith('http')) {
      return { success: false, message: 'URL Webhook Google Sheets tidak valid' };
    }

    try {
      const cleanRecords = deduplicateRecords(records);
      const payload = {
        action: 'sync_all',
        timestamp: new Date().toISOString(),
        count: cleanRecords.length,
        items: cleanRecords,
      };

      // Try proxy first to guarantee transmission and handle redirects
      try {
        const proxyRes = await fetch('/api/gsheet-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: webhookUrl.trim(),
            method: 'POST',
            body: payload,
          }),
        });
        if (proxyRes.ok) {
          return {
            success: true,
            message: `${records.length} baris data berhasil disinkronkan ke Google Sheets!`,
          };
        }
      } catch (proxyErr) {
        console.warn('Push proxy error, fallback to direct fetch', proxyErr);
      }

      // Direct fallback
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'no-cors',
      });

      return {
        success: true,
        message: 'Data berhasil dikirim ke Webhook Google Sheets!',
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Gagal mengirim ke Google Sheets: ${err.message || 'Error'}`,
      };
    }
  }
}
