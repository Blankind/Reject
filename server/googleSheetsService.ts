import { JWT } from 'google-auth-library';
import { RejectItemRecord, deduplicateRecords } from '../src/types/reject';

export interface GoogleServiceAccountConfig {
  clientEmail: string;
  privateKey: string;
  spreadsheetId: string;
}

export class GoogleSheetsServiceAccount {
  /**
   * Cleans and formats private key, handling literal \n vs newline characters
   */
  public static formatPrivateKey(key: string): string {
    if (!key) return '';
    let formatted = key.trim();
    // If it's enclosed in quotes, strip them
    if (
      (formatted.startsWith('"') && formatted.endsWith('"')) ||
      (formatted.startsWith("'") && formatted.endsWith("'"))
    ) {
      formatted = formatted.substring(1, formatted.length - 1);
    }
    // Replace literal \n with real newline characters
    formatted = formatted.replace(/\\n/g, '\n');
    return formatted;
  }

  /**
   * Helper to extract clean spreadsheet ID from full URL or direct ID
   */
  public static extractSpreadsheetId(input: string): string {
    if (!input) return '';
    const trimmed = input.trim();
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      return match[1];
    }
    return trimmed;
  }

  /**
   * Create authenticated JWT Client
   */
  public static getAuthClient(clientEmail: string, privateKey: string): JWT {
    const formattedKey = this.formatPrivateKey(privateKey);
    return new JWT({
      email: clientEmail.trim(),
      key: formattedKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  }

  /**
   * Test connection & return spreadsheet title and first sheet name
   */
  public static async testConnection(config: GoogleServiceAccountConfig): Promise<{
    success: boolean;
    spreadsheetTitle: string;
    sheetName: string;
    sheetCount: number;
    url: string;
  }> {
    const spreadsheetId = this.extractSpreadsheetId(config.spreadsheetId);
    if (!spreadsheetId) {
      throw new Error('ID Spreadsheet tidak boleh kosong.');
    }
    if (!config.clientEmail) {
      throw new Error('GOOGLE_CLIENT_EMAIL tidak boleh kosong.');
    }
    if (!config.privateKey) {
      throw new Error('GOOGLE_PRIVATE_KEY tidak boleh kosong.');
    }

    const auth = this.getAuthClient(config.clientEmail, config.privateKey);
    const tokenInfo = await auth.getAccessToken();
    const token = tokenInfo?.token;
    if (!token) {
      throw new Error(
        'Gagal mendapatkan access token Google Service Account. Periksa kembali email dan private key.'
      );
    }

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?includeGridData=false`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errBody = (await response.json().catch(() => ({}))) as any;
      const errorMsg = errBody?.error?.message || response.statusText;
      if (response.status === 404) {
        throw new Error(
          `Spreadsheet ID "${spreadsheetId}" tidak ditemukan. Pastikan ID Spreadsheet valid.`
        );
      }
      if (response.status === 403) {
        throw new Error(
          `Akses Ditolak (403 Permission Denied). Buka file Google Spreadsheet Anda, klik 'Bagikan' (Share), dan undang email Service Account ini sebagai 'Editor':\n${config.clientEmail.trim()}`
        );
      }
      throw new Error(`Google Sheets API Error (${response.status}): ${errorMsg}`);
    }

    const data = (await response.json()) as any;
    const sheets = data.sheets || [];
    const firstSheetName = sheets[0]?.properties?.title || 'Sheet1';

    return {
      success: true,
      spreadsheetTitle: data.properties?.title || 'Google Spreadsheet',
      sheetName: firstSheetName,
      sheetCount: sheets.length,
      url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    };
  }

  /**
   * Push all reject records directly to Google Sheets using Service Account
   */
  public static async pushRecordsToSheet(
    config: GoogleServiceAccountConfig,
    records: RejectItemRecord[]
  ): Promise<{ success: boolean; updatedRows: number; spreadsheetUrl: string }> {
    const spreadsheetId = this.extractSpreadsheetId(config.spreadsheetId);
    const conn = await this.testConnection(config);
    const sheetName = conn.sheetName;

    const auth = this.getAuthClient(config.clientEmail, config.privateKey);
    const tokenInfo = await auth.getAccessToken();
    const token = tokenInfo?.token;

    // Deduplicate records to ensure no duplicate rows are ever pushed
    const uniqueRecords = deduplicateRecords(records);

    // Headers
    const headers = [
      'No',
      'No. Dokumen',
      'Tanggal',
      'Jenis / Brand',
      'Item Code (ERPNext)',
      'Item Name (ERPNext)',
      'Gudang Letak Reject',
      'Posisi / Letak Fisik',
      'Qty Reject',
      'Satuan (UOM)',
      'Valuation Rate ERPNext (Rp)',
      'Total Kerugian (Rp)',
      'Alasan Reject',
      'Detail Cacat / Kerusakan',
      'Status Penanganan',
      'PIC Gudang',
      'No Ref / SJ',
      'Catatan Tambahan',
      'Foto / Bukti Gambar Reject',
      'Waktu Update',
    ];

    // Rows
    const dataRows = uniqueRecords.map((r, i) => [
      i + 1,
      r.docNumber || '',
      r.date || '',
      r.jenis || '',
      r.itemCode || '',
      r.itemName || '',
      r.sourceWarehouse || '',
      r.targetWarehouse || '',
      Number(r.qty) || 0,
      r.uom || 'Pcs',
      Number(r.valuationRate) || 0,
      Number(r.totalValue) || 0,
      r.alasanReject || '',
      r.keteranganAlasan || '',
      r.status || '',
      r.pic || '',
      r.referenceDoc || '',
      r.notes || '',
      r.photoUrl || '',
      r.updatedAt || new Date().toISOString(),
    ]);

    const allValues = [headers, ...dataRows];

    // 1. Clear existing sheet values to prevent leftover rows
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
        sheetName
      )}!A1:Z10000:clear`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // 2. Write new values starting at A1
    const updateRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
        sheetName
      )}!A1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          range: `${sheetName}!A1`,
          majorDimension: 'ROWS',
          values: allValues,
        }),
      }
    );

    if (!updateRes.ok) {
      const errBody = (await updateRes.json().catch(() => ({}))) as any;
      throw new Error(
        `Gagal menulis data ke Google Sheets: ${errBody?.error?.message || updateRes.statusText}`
      );
    }

    return {
      success: true,
      updatedRows: allValues.length,
      spreadsheetUrl: conn.url,
    };
  }

  /**
   * Pull records directly from Google Sheets using Service Account
   */
  public static async pullRecordsFromSheet(
    config: GoogleServiceAccountConfig
  ): Promise<{ success: boolean; records: RejectItemRecord[]; count: number }> {
    const spreadsheetId = this.extractSpreadsheetId(config.spreadsheetId);
    const conn = await this.testConnection(config);
    const sheetName = conn.sheetName;

    const auth = this.getAuthClient(config.clientEmail, config.privateKey);
    const tokenInfo = await auth.getAccessToken();
    const token = tokenInfo?.token;

    const readRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
        sheetName
      )}!A1:Z5000`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      }
    );

    if (!readRes.ok) {
      const errBody = (await readRes.json().catch(() => ({}))) as any;
      throw new Error(
        `Gagal membaca Google Sheets: ${errBody?.error?.message || readRes.statusText}`
      );
    }

    const data = (await readRes.json()) as any;
    const rows: any[][] = data.values || [];

    if (rows.length <= 1) {
      // Empty or header only
      return { success: true, records: [], count: 0 };
    }

    // First row is headers, remaining rows are data
    const records: RejectItemRecord[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0 || (!row[1] && !row[4] && !row[5])) {
        continue; // Skip empty rows
      }

      // Map columns:
      // 0: No, 1: DocNumber, 2: Date, 3: Jenis, 4: ItemCode, 5: ItemName, 6: SourceWarehouse,
      // 7: Posisi/Target, 8: Qty, 9: UOM, 10: ValuationRate, 11: TotalValue, 12: Alasan,
      // 13: Keterangan, 14: Status, 15: PIC, 16: RefDoc, 17: Notes, 18: PhotoUrl, 19: UpdatedAt
      const docNumber = String(row[1] || `REJ-GS-${Date.now()}-${i}`).trim();
      const date = String(row[2] || new Date().toISOString().split('T')[0]).trim();
      const jenis = String(row[3] || 'General').trim();
      const itemCode = String(row[4] || '-').trim();
      const itemName = String(row[5] || 'Item Reject').trim();
      const sourceWarehouse = String(row[6] || 'Gudang Utama').trim();
      const targetWarehouse = String(row[7] || 'Gudang Karantina').trim();
      const qty = parseFloat(String(row[8]).replace(/[^0-9.-]+/g, '')) || 1;
      const uom = String(row[9] || 'Pcs').trim();
      const valuationRate = parseFloat(String(row[10]).replace(/[^0-9.-]+/g, '')) || 0;
      const totalValue =
        parseFloat(String(row[11]).replace(/[^0-9.-]+/g, '')) || qty * valuationRate;
      const alasanReject = (String(row[12] || 'Rusak Kemasan').trim() as any);
      const keteranganAlasan = String(row[13] || '').trim();
      const status = (String(row[14] || 'Draft Karantina').trim() as any);
      const pic = String(row[15] || 'Staff Gudang').trim();
      const referenceDoc = String(row[16] || '').trim();
      const notes = String(row[17] || '').trim();
      const photoUrl = String(row[18] || '').trim();
      const updatedAt = String(row[19] || new Date().toISOString()).trim();

      records.push({
        id: `rej-sa-${Date.now()}-${i}`,
        docNumber,
        date,
        jenis,
        itemCode,
        itemName,
        sourceWarehouse,
        targetWarehouse,
        qty,
        uom,
        valuationRate,
        totalValue,
        alasanReject,
        keteranganAlasan,
        status,
        pic,
        referenceDoc,
        notes,
        photoUrl: photoUrl.startsWith('data:') || photoUrl.startsWith('http') ? photoUrl : undefined,
        createdAt: date,
        updatedAt,
      });
    }

    const cleanRecords = deduplicateRecords(records);

    return {
      success: true,
      records: cleanRecords,
      count: cleanRecords.length,
    };
  }
}
