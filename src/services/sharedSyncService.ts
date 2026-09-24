import { RejectItemRecord } from '../types/reject';
import { ErpConfig } from '../types/erpnext';

export interface SharedStoreData {
  records: RejectItemRecord[];
  gsheetWebhook: string;
  gsheetSpreadsheetUrl?: string;
  erpConfig?: Partial<ErpConfig>;
  lastUpdated: string;
}

export class SharedSyncService {
  /**
   * Fetch centralized shared data from the server.
   * This bridges multiple devices across any network.
   */
  public static async fetchSharedData(): Promise<SharedStoreData | null> {
    try {
      const res = await fetch('/api/shared-data');
      if (!res.ok) return null;
      const data = await res.json();
      if (data && data.success) {
        return {
          records: Array.isArray(data.records) ? data.records : [],
          gsheetWebhook: data.gsheetWebhook || '',
          gsheetSpreadsheetUrl: data.gsheetSpreadsheetUrl || '',
          erpConfig: data.erpConfig || undefined,
          lastUpdated: data.lastUpdated || '',
        };
      }
      return null;
    } catch (err) {
      console.warn('[SharedSyncService] Could not reach server shared-data endpoint:', err);
      return null;
    }
  }

  /**
   * Push updated records or config to the centralized server.
   */
  public static async pushSharedData(payload: {
    records?: RejectItemRecord[];
    gsheetWebhook?: string;
    gsheetSpreadsheetUrl?: string;
    erpConfig?: Partial<ErpConfig>;
  }): Promise<boolean> {
    try {
      const res = await fetch('/api/shared-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch (err) {
      console.warn('[SharedSyncService] Failed to push shared data:', err);
      return false;
    }
  }

  /**
   * Get application network URL and cloud endpoint.
   */
  public static async getNetworkInfo(): Promise<{ appUrl: string; port: number }> {
    try {
      const res = await fetch('/api/network-info');
      if (res.ok) {
        const data = await res.json();
        return {
          appUrl: data.appUrl || window.location.origin,
          port: data.port || 3000,
        };
      }
    } catch {
      // Fallback to browser origin
    }
    return {
      appUrl: window.location.origin,
      port: 3000,
    };
  }

  /**
   * Helper to extract a viewable/editable Google Sheets URL
   */
  public static extractSpreadsheetUrl(rawUrl: string): string | null {
    if (!rawUrl) return null;
    const trimmed = rawUrl.trim();
    const sheetMatch = trimmed.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (sheetMatch && sheetMatch[1]) {
      return `https://docs.google.com/spreadsheets/d/${sheetMatch[1]}/edit#gid=0`;
    }
    return null;
  }
}
