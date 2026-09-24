import { RejectItemRecord } from '../types/reject';

export interface GSheetServiceAccountStatus {
  isConfigured: boolean;
  clientEmail: string;
  spreadsheetId: string;
  hasPrivateKey: boolean;
  source: 'env' | 'store' | 'none';
  spreadsheetUrl: string;
}

export class GoogleServiceAccountClient {
  public static async getStatus(): Promise<GSheetServiceAccountStatus> {
    try {
      const res = await fetch('/api/gsheet-service-account/config');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Failed to fetch Service Account status:', e);
    }
    return {
      isConfigured: false,
      clientEmail: '',
      spreadsheetId: '',
      hasPrivateKey: false,
      source: 'none',
      spreadsheetUrl: '',
    };
  }

  public static async saveConfig(payload: {
    clientEmail: string;
    privateKey: string;
    spreadsheetId: string;
  }): Promise<{ success: boolean; message: string; spreadsheetTitle?: string; url?: string }> {
    const res = await fetch('/api/gsheet-service-account/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Gagal menyimpan konfigurasi Google Service Account');
    }
    return data;
  }

  public static async testConfig(payload: {
    clientEmail: string;
    privateKey: string;
    spreadsheetId: string;
  }): Promise<{ success: boolean; message: string; spreadsheetTitle?: string; url?: string }> {
    const res = await fetch('/api/gsheet-service-account/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Koneksi ke Google Sheets gagal');
    }
    return data;
  }

  public static async pushRecords(
    records?: RejectItemRecord[]
  ): Promise<{ success: boolean; message: string; updatedRows: number; spreadsheetUrl: string }> {
    const res = await fetch('/api/gsheet-service-account/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Gagal mengirim data ke Google Sheets');
    }
    return data;
  }

  public static async pullRecords(): Promise<{
    success: boolean;
    records: RejectItemRecord[];
    count: number;
    message: string;
  }> {
    const res = await fetch('/api/gsheet-service-account/pull');
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Gagal menarik data dari Google Sheets');
    }
    return data;
  }
}
