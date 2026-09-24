import { ErpConfig, ErpItem, ErpWarehouse, ErpConnectionTestResult } from '../types/erpnext';

const ERP_CONFIG_KEY = 'distri_erpnext_config';
const CACHE_WAREHOUSES_KEY = 'distri_cached_warehouses';
const CACHE_ITEMS_KEY = 'distri_cached_items';
const SESSION_CACHE_KEY = 'distri_session_items_cache';
const RECENT_ITEMS_KEY = 'distri_recent_selected_items';

export const LIGHTWEIGHT_ITEM_FIELDS = [
  'name',
  'item_code',
  'item_name',
  'stock_uom',
  'valuation_rate',
  'item_group',
  'brand',
];

export interface ServerSearchResult {
  items: ErpItem[];
  latencyMs: number;
  payloadSizeKb: number;
  totalFound?: number;
  fromCache?: boolean;
}

export function playBarcodeScanBeep(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch {
    // Ignore audio autoplay restrictions
  }
}

export const DEFAULT_CONFIG: ErpConfig = {
  baseUrl: '',
  apiKey: '',
  apiSecret: '',
  isConnected: false,
  companyName: '',
  defaultJenis: '',
};

export class ErpNextService {
  public static getConfig(): ErpConfig {
    try {
      const stored = localStorage.getItem(ERP_CONFIG_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to parse stored ERPNext config', e);
    }
    return DEFAULT_CONFIG;
  }

  public static saveConfig(config: ErpConfig): void {
    localStorage.setItem(ERP_CONFIG_KEY, JSON.stringify(config));
  }

  /**
   * Helper to execute API requests to the real ERPNext server.
   * Routes through the backend proxy (/api/erpnext-proxy) to completely bypass CORS & Mixed Content issues.
   * Falls back to direct fetch if proxy is unavailable.
   */
  private static async executeRequest(
    config: ErpConfig,
    endpoint: string,
    options: { method?: string; body?: any; headers?: Record<string, string> } = {}
  ): Promise<any> {
    if (!config.baseUrl) {
      throw new Error('URL Server ERPNext belum diatur. Silakan atur di Pengaturan Koneksi ERPNext.');
    }

    const cleanBaseUrl = config.baseUrl.trim().replace(/\/+$/, '');
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const targetUrl = `${cleanBaseUrl}${cleanEndpoint}`;
    const method = options.method || 'GET';

    const authHeader = config.apiKey && config.apiSecret ? `token ${config.apiKey.trim()}:${config.apiSecret.trim()}` : '';

    const reqHeaders: Record<string, string> = {
      'Accept': 'application/json',
      ...(authHeader ? { 'Authorization': authHeader } : {}),
      ...(options.headers || {}),
    };

    // 1. Try via backend proxy (eliminates CORS errors)
    try {
      const proxyRes = await fetch('/api/erpnext-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl,
          method,
          headers: reqHeaders,
          body: options.body,
        }),
      });

      if (proxyRes.ok) {
        return await proxyRes.json();
      } else {
        const errJson = await proxyRes.json().catch(() => null);
        const errMsg = errJson?.message || errJson?.error || proxyRes.statusText;
        throw new Error(`ERPNext Error (${proxyRes.status}): ${errMsg}`);
      }
    } catch (proxyErr: any) {
      console.warn('Backend proxy call failed, attempting direct fetch:', proxyErr.message);

      const directRes = await fetch(targetUrl, {
        method,
        headers: reqHeaders,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      if (!directRes.ok) {
        throw new Error(`HTTP Error ${directRes.status}: ${directRes.statusText}`);
      }
      return await directRes.json();
    }
  }

  /**
   * Test connection to ERPNext instance and retrieve logged-in user profile & permissions
   */
  public static async testConnection(config: ErpConfig): Promise<ErpConnectionTestResult> {
    if (!config.baseUrl || !config.apiKey || !config.apiSecret) {
      return {
        success: false,
        message: 'Mohon lengkapi URL Server ERPNext, API Key, dan API Secret.',
      };
    }

    const startTime = Date.now();
    try {
      // 1. Check logged user
      const userRes = await this.executeRequest(config, '/api/method/frappe.auth.get_logged_user');
      const loggedUser = userRes?.message || 'User';
      const latencyMs = Date.now() - startTime;

      // 2. Check access to Item and Warehouse doctypes
      const accessibleDocTypes: string[] = [];

      try {
        const whCheck = await this.executeRequest(config, '/api/resource/Warehouse?limit_page_length=1');
        if (whCheck && Array.isArray(whCheck.data)) {
          accessibleDocTypes.push('Warehouse');
        }
      } catch (e) {
        console.warn('Could not read Warehouse doctype:', e);
      }

      try {
        const itemCheck = await this.executeRequest(config, '/api/resource/Item?limit_page_length=1');
        if (itemCheck && Array.isArray(itemCheck.data)) {
          accessibleDocTypes.push('Item');
        }
      } catch (e) {
        console.warn('Could not read Item doctype:', e);
      }

      try {
        const binCheck = await this.executeRequest(config, '/api/resource/Bin?limit_page_length=1');
        if (binCheck && Array.isArray(binCheck.data)) {
          accessibleDocTypes.push('Bin (Valuation Rate)');
        }
      } catch (e) {
        console.warn('Could not read Bin doctype:', e);
      }

      // Save user to config
      const updatedConfig: ErpConfig = {
        ...config,
        isConnected: true,
        loggedUser,
        lastSyncTime: new Date().toISOString(),
      };
      this.saveConfig(updatedConfig);

      return {
        success: true,
        message: `Koneksi ke ERPNext berhasil! Terhubung sebagai: ${loggedUser} (${latencyMs}ms)`,
        user: loggedUser,
        accessibleDocTypes,
        latencyMs,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Koneksi ke ERPNext gagal. Periksa kembali URL dan API Key/Secret.',
      };
    }
  }

  /**
   * Get real list of Warehouses from ERPNext
   */
  public static async getWarehouses(): Promise<ErpWarehouse[]> {
    const config = this.getConfig();
    if (!config.baseUrl || !config.apiKey || !config.apiSecret) {
      return this.getCachedWarehouses();
    }

    try {
      const fields = JSON.stringify(['name', 'warehouse_name', 'is_group', 'company', 'warehouse_type']);
      const filters = JSON.stringify([['is_group', '=', 0]]);
      const endpoint = `/api/resource/Warehouse?fields=${encodeURIComponent(fields)}&filters=${encodeURIComponent(filters)}&limit_page_length=500`;

      const res = await this.executeRequest(config, endpoint);
      if (res && Array.isArray(res.data) && res.data.length > 0) {
        localStorage.setItem(CACHE_WAREHOUSES_KEY, JSON.stringify(res.data));
        return res.data;
      }
      return this.getCachedWarehouses();
    } catch (err) {
      console.warn('Failed to fetch live ERPNext warehouses:', err);
      return this.getCachedWarehouses();
    }
  }

  /**
   * STRATEGY 1, 3, 4: ON-DEMAND SERVER-SIDE SEARCH (TYPEAHEAD / AUTOCOMPLETE)
   * 
   * - Menghindari pemuatan 4.000+ item sekaligus ke RAM browser.
   * - Field projection hemat bandwidth (hanya 7 field esensial).
   * - Batasan pagination ringan (default limit: 20 item, hanya ~2-3 KB payload).
   * - Menghubungi Frappe REST API saat operator mengetik query (misal: pipa, hollow, spandek, galv, c75).
   */
  public static async searchItemsServerSide(
    query: string,
    limit: number = 20
  ): Promise<ServerSearchResult> {
    const cleanQuery = (query || '').trim();
    const config = this.getConfig();
    const startTime = Date.now();

    // If no config or offline, search local recent/cached items
    if (!config.baseUrl || !config.apiKey || !config.apiSecret) {
      const cached = this.getRecentItems();
      const filtered = cleanQuery
        ? cached.filter((i) => this.matchesQuery(i, cleanQuery)).slice(0, limit)
        : cached.slice(0, limit);
      return {
        items: filtered,
        latencyMs: Date.now() - startTime,
        payloadSizeKb: Number(((JSON.stringify(filtered).length) / 1024).toFixed(1)),
        totalFound: filtered.length,
        fromCache: true,
      };
    }

    try {
      const fields = JSON.stringify(LIGHTWEIGHT_ITEM_FIELDS);
      const filters = JSON.stringify([['disabled', '=', 0]]);

      let endpoint = '';
      if (!cleanQuery) {
        // Return 20 most recent active items
        endpoint = `/api/resource/Item?fields=${encodeURIComponent(fields)}&filters=${encodeURIComponent(filters)}&limit_page_length=${limit}&order_by=modified desc`;
      } else {
        // Multi-field search via or_filters: item_code, item_name, item_group, brand
        const orFilters = JSON.stringify([
          ['item_name', 'like', `%${cleanQuery}%`],
          ['item_code', 'like', `%${cleanQuery}%`],
          ['item_group', 'like', `%${cleanQuery}%`],
          ['brand', 'like', `%${cleanQuery}%`],
        ]);
        endpoint = `/api/resource/Item?fields=${encodeURIComponent(fields)}&filters=${encodeURIComponent(filters)}&or_filters=${encodeURIComponent(orFilters)}&limit_page_length=${limit}`;
      }

      const res = await this.executeRequest(config, endpoint);
      const latencyMs = Date.now() - startTime;
      const rawData = res?.data || [];
      const payloadSizeKb = Number((JSON.stringify(rawData).length / 1024).toFixed(2));

      const items: ErpItem[] = rawData.map((i: any) => ({
        name: i.name || i.item_code,
        item_code: i.item_code || i.name,
        item_name: i.item_name || i.item_code,
        item_group: i.item_group || 'General',
        brand: i.brand || '',
        stock_uom: i.stock_uom || 'Nos',
        valuation_rate: Number(i.valuation_rate || 0),
        standard_rate: Number(i.standard_rate || 0),
        last_purchase_rate: Number(i.last_purchase_rate || 0),
      }));

      // Cache returned items in session cache for instant future lookup
      this.saveToSessionCache(items);

      return {
        items,
        latencyMs,
        payloadSizeKb,
        totalFound: items.length,
        fromCache: false,
      };
    } catch (err: any) {
      console.warn('Server-side search failed, falling back to session cache:', err.message);
      // Fallback: search in session cache
      const sessionItems = this.getAllSessionCachedItems();
      const filtered = sessionItems.filter((i) => this.matchesQuery(i, cleanQuery)).slice(0, limit);
      return {
        items: filtered,
        latencyMs: Date.now() - startTime,
        payloadSizeKb: 0,
        totalFound: filtered.length,
        fromCache: true,
      };
    }
  }

  /**
   * STRATEGY 5: SCAN BARCODE & SKU RESOLVER INSTAN
   * 
   * - Cek cache sesi lokal terlebih dahulu (< 1ms).
   * - Jika belum ada di cache, kirim direct exact match query ke API ERPNext (< 100ms).
   * - Menyimpan item terpilih ke riwayat barang yang baru saja di-reject tanpa membebani memori.
   */
  public static async resolveBarcodeOrSku(
    barcodeOrSku: string
  ): Promise<{ item: ErpItem | null; latencyMs: number; source: 'session_cache' | 'server_erpnext' }> {
    const cleanCode = (barcodeOrSku || '').trim();
    if (!cleanCode) {
      return { item: null, latencyMs: 0, source: 'session_cache' };
    }

    const startTime = Date.now();

    // 1. Cek cache sesi lokal terlebih dahulu
    const sessionCache = this.getAllSessionCachedItems();
    const cachedMatch = sessionCache.find(
      (i) =>
        i.item_code.toLowerCase() === cleanCode.toLowerCase() ||
        i.name.toLowerCase() === cleanCode.toLowerCase()
    );

    if (cachedMatch) {
      this.addRecentItem(cachedMatch);
      playBarcodeScanBeep();
      return {
        item: cachedMatch,
        latencyMs: Date.now() - startTime,
        source: 'session_cache',
      };
    }

    // 2. Tembak API ERPNext dengan parameter pencarian presisi
    const config = this.getConfig();
    if (!config.baseUrl || !config.apiKey || !config.apiSecret) {
      return { item: null, latencyMs: Date.now() - startTime, source: 'server_erpnext' };
    }

    try {
      const fields = JSON.stringify(LIGHTWEIGHT_ITEM_FIELDS);
      const exactFilter = JSON.stringify([
        ['disabled', '=', 0],
        ['item_code', '=', cleanCode],
      ]);
      const endpoint = `/api/resource/Item?fields=${encodeURIComponent(fields)}&filters=${encodeURIComponent(exactFilter)}&limit_page_length=1`;

      const res = await this.executeRequest(config, endpoint);
      if (res?.data && res.data.length > 0) {
        const raw = res.data[0];
        const item: ErpItem = {
          name: raw.name || raw.item_code,
          item_code: raw.item_code || raw.name,
          item_name: raw.item_name || raw.item_code,
          item_group: raw.item_group || 'General',
          brand: raw.brand || '',
          stock_uom: raw.stock_uom || 'Nos',
          valuation_rate: Number(raw.valuation_rate || 0),
        };

        // Simpan otomatis ke cache sesi dan recent
        this.saveToSessionCache([item]);
        this.addRecentItem(item);
        playBarcodeScanBeep();

        return {
          item,
          latencyMs: Date.now() - startTime,
          source: 'server_erpnext',
        };
      }

      // If exact code match failed, try barcode or item_name search
      const orFilters = JSON.stringify([
        ['item_code', '=', cleanCode],
        ['barcode', '=', cleanCode],
      ]);
      const fallbackEndpoint = `/api/resource/Item?fields=${encodeURIComponent(fields)}&filters=${encodeURIComponent(JSON.stringify([['disabled', '=', 0]]))}&or_filters=${encodeURIComponent(orFilters)}&limit_page_length=1`;
      
      const fallbackRes = await this.executeRequest(config, fallbackEndpoint);
      if (fallbackRes?.data && fallbackRes.data.length > 0) {
        const raw = fallbackRes.data[0];
        const item: ErpItem = {
          name: raw.name || raw.item_code,
          item_code: raw.item_code || raw.name,
          item_name: raw.item_name || raw.item_code,
          item_group: raw.item_group || 'General',
          brand: raw.brand || '',
          stock_uom: raw.stock_uom || 'Nos',
          valuation_rate: Number(raw.valuation_rate || 0),
        };

        this.saveToSessionCache([item]);
        this.addRecentItem(item);
        playBarcodeScanBeep();

        return {
          item,
          latencyMs: Date.now() - startTime,
          source: 'server_erpnext',
        };
      }
    } catch (err) {
      console.warn('Barcode/SKU resolver query error:', err);
    }

    return {
      item: null,
      latencyMs: Date.now() - startTime,
      source: 'server_erpnext',
    };
  }

  /**
   * Helper to check if an ERPNext item matches query
   */
  private static matchesQuery(item: ErpItem, query: string): boolean {
    if (!query) return true;
    const q = query.toLowerCase();
    const brandMatch = (item.brand || '').toLowerCase().includes(q);
    const nameMatch = (item.item_name || '').toLowerCase().includes(q);
    const groupMatch = (item.item_group || '').toLowerCase().includes(q);
    const codeMatch = (item.item_code || '').toLowerCase().includes(q);
    return brandMatch || nameMatch || groupMatch || codeMatch;
  }

  /**
   * Get exact valuation rate from ERPNext:
   * 1. Checks DocType Bin for the specific warehouse.
   * 2. Fallbacks to Item master valuation rate.
   */
  public static async getItemValuationRate(itemCode: string, warehouse?: string): Promise<number> {
    const config = this.getConfig();
    if (!config.baseUrl || !config.apiKey || !config.apiSecret) {
      const cached = this.getAllSessionCachedItems().find((i) => i.item_code === itemCode);
      return cached?.valuation_rate || 0;
    }

    try {
      // 1. Check Bin for specific warehouse
      if (warehouse) {
        const binFields = JSON.stringify(['valuation_rate', 'actual_qty', 'stock_value', 'warehouse']);
        const binFilters = JSON.stringify([
          ['item_code', '=', itemCode],
          ['warehouse', '=', warehouse],
        ]);
        const binEndpoint = `/api/resource/Bin?fields=${encodeURIComponent(binFields)}&filters=${encodeURIComponent(binFilters)}&limit_page_length=1`;

        try {
          const binRes = await this.executeRequest(config, binEndpoint);
          if (binRes?.data && binRes.data.length > 0) {
            const rate = Number(binRes.data[0].valuation_rate);
            if (rate > 0) return rate;
            if (binRes.data[0].stock_value > 0 && binRes.data[0].actual_qty > 0) {
              return binRes.data[0].stock_value / binRes.data[0].actual_qty;
            }
          }
        } catch (binErr) {
          console.warn('Bin query failed, checking Item doctype:', binErr);
        }
      }

      // 2. Query Item DocType directly
      const itemEndpoint = `/api/resource/Item/${encodeURIComponent(itemCode)}`;
      const itemRes = await this.executeRequest(config, itemEndpoint);
      if (itemRes?.data) {
        const rate = Number(
          itemRes.data.valuation_rate ||
          itemRes.data.last_purchase_rate ||
          itemRes.data.standard_rate ||
          0
        );
        return rate;
      }
    } catch (err) {
      console.warn('Could not fetch valuation rate from ERPNext:', err);
    }

    const cachedItem = this.getAllSessionCachedItems().find((i) => i.item_code === itemCode);
    return cachedItem?.valuation_rate || 0;
  }

  /**
   * Recent Items Management:
   * Keeps track of up to 20 recently used items in session for instant re-selection.
   */
  public static getRecentItems(): ErpItem[] {
    try {
      const stored = sessionStorage.getItem(RECENT_ITEMS_KEY) || localStorage.getItem(RECENT_ITEMS_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return [];
  }

  public static addRecentItem(item: ErpItem): void {
    try {
      const current = this.getRecentItems().filter((i) => i.item_code !== item.item_code);
      const updated = [item, ...current].slice(0, 20);
      sessionStorage.setItem(RECENT_ITEMS_KEY, JSON.stringify(updated));
      localStorage.setItem(RECENT_ITEMS_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  }

  private static saveToSessionCache(items: ErpItem[]): void {
    try {
      const current = this.getAllSessionCachedItems();
      const map = new Map<string, ErpItem>();
      current.forEach((i) => map.set(i.item_code, i));
      items.forEach((i) => map.set(i.item_code, i));
      const combined = Array.from(map.values()).slice(0, 300); // capped at 300 items max in session
      sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(combined));
    } catch {
      // ignore
    }
  }

  private static getAllSessionCachedItems(): ErpItem[] {
    try {
      const stored = sessionStorage.getItem(SESSION_CACHE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return this.getRecentItems();
  }

  public static async getWarehousesCached(): Promise<ErpWarehouse[]> {
    return this.getWarehouses();
  }

  private static getCachedWarehouses(): ErpWarehouse[] {
    try {
      const stored = localStorage.getItem(CACHE_WAREHOUSES_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      // Ignore
    }
    return [];
  }

  /**
   * Compatibility method for backward compatibility
   */
  public static async getItemsByJenis(jenis: string): Promise<ErpItem[]> {
    const res = await this.searchItemsServerSide(jenis, 20);
    return res.items;
  }

  public static async syncAllMasterData(): Promise<{ warehousesCount: number; itemsCount: number }> {
    const warehouses = await this.getWarehouses();
    const searchRes = await this.searchItemsServerSide('', 20);
    return {
      warehousesCount: warehouses.length,
      itemsCount: searchRes.items.length,
    };
  }
}

