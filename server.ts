import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { GoogleSheetsServiceAccount, GoogleServiceAccountConfig } from './server/googleSheetsService';
import { RejectItemRecord, deduplicateRecords } from './src/types/reject';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, 'data');
const STORE_FILE = path.resolve(DATA_DIR, 'shared_store.json');

// Interface for persistent store
interface SharedStore {
  records: any[];
  gsheetWebhook: string;
  gsheetSpreadsheetUrl?: string;
  googleServiceAccount?: {
    clientEmail: string;
    privateKey: string;
    spreadsheetId: string;
  };
  erpConfig?: {
    baseUrl: string;
    apiKey: string;
    apiSecret: string;
    loggedUser?: string;
    isConnected?: boolean;
  };
  lastUpdated: string;
}

// In-memory cache + persistent storage
let memoryStore: SharedStore = {
  records: [],
  gsheetWebhook: '',
  gsheetSpreadsheetUrl: '',
  lastUpdated: new Date().toISOString(),
};

function getEffectiveGoogleConfig(): GoogleServiceAccountConfig {
  const envEmail = (process.env.GOOGLE_CLIENT_EMAIL || '').trim();
  const envKey = (process.env.GOOGLE_PRIVATE_KEY || '').trim();
  const envSheetId = (process.env.GOOGLE_SPREADSHEET_ID || process.env.SPREADSHEET_ID || '').trim();

  const storeConfig = memoryStore.googleServiceAccount || {
    clientEmail: '',
    privateKey: '',
    spreadsheetId: '',
  };

  return {
    clientEmail: envEmail || storeConfig.clientEmail || '',
    privateKey: envKey || storeConfig.privateKey || '',
    spreadsheetId: envSheetId || storeConfig.spreadsheetId || '',
  };
}

function loadStoreFromFile(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STORE_FILE)) {
      const content = fs.readFileSync(STORE_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') {
        const rawRecords = Array.isArray(parsed.records) ? parsed.records : [];
        const cleanRecords = deduplicateRecords(rawRecords);
        memoryStore = {
          records: cleanRecords,
          gsheetWebhook: typeof parsed.gsheetWebhook === 'string' ? parsed.gsheetWebhook : '',
          gsheetSpreadsheetUrl: typeof parsed.gsheetSpreadsheetUrl === 'string' ? parsed.gsheetSpreadsheetUrl : '',
          googleServiceAccount: parsed.googleServiceAccount,
          erpConfig: parsed.erpConfig,
          lastUpdated: parsed.lastUpdated || new Date().toISOString(),
        };
        console.log(`[Store] Loaded ${memoryStore.records.length} unique records from persistent store`);
      }
    }
  } catch (err) {
    console.warn('[Store] Failed to load store file, using in-memory store:', err);
  }
}

function saveStoreToFile(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(memoryStore, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Store] Failed to write store file:', err);
  }
}

async function startServer() {
  loadStoreFromFile();

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // CORS middleware for API routes
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Real ERPNext Backend Proxy Route:
  // Bypasses browser CORS and Mixed Content restrictions so the frontend can communicate with ANY
  // Frappe / ERPNext server (Frappe Cloud, self-hosted, HTTP, custom port, VPN)
  app.post('/api/erpnext-proxy', async (req, res) => {
    try {
      const { targetUrl, method = 'GET', headers = {}, body } = req.body;

      if (!targetUrl) {
        return res.status(400).json({ error: 'targetUrl is required in request body' });
      }

      const requestHeaders: Record<string, string> = {
        'Accept': 'application/json',
        ...headers,
      };

      const fetchOptions: RequestInit = {
        method,
        headers: requestHeaders,
      };

      if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
        fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
        if (!requestHeaders['Content-Type']) {
          requestHeaders['Content-Type'] = 'application/json';
        }
      }

      const erpResponse = await fetch(targetUrl, fetchOptions);
      const contentType = erpResponse.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const jsonData = await erpResponse.json();
        return res.status(erpResponse.status).json(jsonData);
      } else {
        const textData = await erpResponse.text();
        return res.status(erpResponse.status).send(textData);
      }
    } catch (err: any) {
      console.error('ERPNext proxy error:', err);
      return res.status(502).json({
        error: 'Bad Gateway / ERPNext Connection Error',
        message: err.message || 'Tidak dapat menghubungi server ERPNext. Pastikan URL dan koneksi internet server valid.',
      });
    }
  });

  // Google Sheets / Apps Script Backend Proxy:
  // Allows the frontend to read Google Sheets or Apps Script Webhooks without CORS or redirect blocks
  app.post('/api/gsheet-proxy', async (req, res) => {
    try {
      const { url, method = 'GET', body } = req.body;
      if (!url) {
        return res.status(400).json({ error: 'url is required' });
      }

      const fetchOptions: RequestInit = {
        method,
        redirect: 'follow',
        headers: {
          'Accept': 'application/json, text/plain, text/csv, */*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      };

      if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
        fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
        (fetchOptions.headers as Record<string, string>)['Content-Type'] = 'application/json';
      }

      const gResponse = await fetch(url, fetchOptions);
      const contentType = gResponse.headers.get('content-type') || '';
      const text = await gResponse.text();

      if (contentType.includes('application/json')) {
        try {
          return res.status(gResponse.status).json(JSON.parse(text));
        } catch {
          return res.status(gResponse.status).send(text);
        }
      } else {
        res.setHeader('Content-Type', contentType || 'text/plain');
        return res.status(gResponse.status).send(text);
      }
    } catch (err: any) {
      console.error('GSheet proxy error:', err);
      return res.status(502).json({
        error: 'GSheet Proxy Error',
        message: err.message || 'Tidak dapat mengambil data dari Google Sheets.',
      });
    }
  });

  // Centralized Shared Data API for Multi-Device & Cross-Network Sync
  // Ensures all devices (mobile phones, tablets, other PCs) on ANY network have the exact same
  // spreadsheet rows and configuration without relying solely on isolated browser LocalStorage.
  app.get('/api/shared-data', (_req, res) => {
    return res.json({
      success: true,
      records: memoryStore.records,
      gsheetWebhook: memoryStore.gsheetWebhook,
      gsheetSpreadsheetUrl: memoryStore.gsheetSpreadsheetUrl,
      erpConfig: memoryStore.erpConfig,
      lastUpdated: memoryStore.lastUpdated,
    });
  });

  app.post('/api/shared-data', (req, res) => {
    try {
      const { records, gsheetWebhook, gsheetSpreadsheetUrl, erpConfig } = req.body;

      if (Array.isArray(records)) {
        memoryStore.records = deduplicateRecords(records);
      }
      if (typeof gsheetWebhook === 'string') {
        memoryStore.gsheetWebhook = gsheetWebhook;
      }
      if (typeof gsheetSpreadsheetUrl === 'string') {
        memoryStore.gsheetSpreadsheetUrl = gsheetSpreadsheetUrl;
      }
      if (erpConfig && typeof erpConfig === 'object') {
        memoryStore.erpConfig = erpConfig;
      }

      memoryStore.lastUpdated = new Date().toISOString();
      saveStoreToFile();

      return res.json({
        success: true,
        count: memoryStore.records.length,
        lastUpdated: memoryStore.lastUpdated,
      });
    } catch (err: any) {
      console.error('Error saving shared data:', err);
      return res.status(500).json({ error: 'Failed to save shared data', message: err.message });
    }
  });

  // ==========================================
  // DIRECT GOOGLE SHEETS VIA SERVICE ACCOUNT
  // ==========================================

  // Check Service Account status & configuration
  app.get('/api/gsheet-service-account/config', (_req, res) => {
    const cfg = getEffectiveGoogleConfig();
    const isConfigured = !!(cfg.clientEmail && cfg.privateKey && cfg.spreadsheetId);
    const source = process.env.GOOGLE_CLIENT_EMAIL
      ? 'env'
      : memoryStore.googleServiceAccount?.clientEmail
      ? 'store'
      : 'none';

    return res.json({
      isConfigured,
      clientEmail: cfg.clientEmail,
      spreadsheetId: cfg.spreadsheetId,
      hasPrivateKey: !!cfg.privateKey,
      source,
      spreadsheetUrl: cfg.spreadsheetId
        ? `https://docs.google.com/spreadsheets/d/${GoogleSheetsServiceAccount.extractSpreadsheetId(
            cfg.spreadsheetId
          )}/edit`
        : '',
    });
  });

  // Save / update Service Account credentials in store and test connection
  app.post('/api/gsheet-service-account/config', async (req, res) => {
    try {
      const { clientEmail, privateKey, spreadsheetId } = req.body;
      const current = getEffectiveGoogleConfig();

      const targetConfig: GoogleServiceAccountConfig = {
        clientEmail: (clientEmail ?? current.clientEmail).trim(),
        privateKey: (privateKey ?? current.privateKey).trim(),
        spreadsheetId: (spreadsheetId ?? current.spreadsheetId).trim(),
      };

      // Test connection with Google Sheets API v4
      const testResult = await GoogleSheetsServiceAccount.testConnection(targetConfig);

      memoryStore.googleServiceAccount = targetConfig;
      memoryStore.gsheetSpreadsheetUrl = testResult.url;
      memoryStore.lastUpdated = new Date().toISOString();
      saveStoreToFile();

      return res.json({
        ...testResult,
        message: `Berhasil terhubung ke spreadsheet: "${testResult.spreadsheetTitle}"`,
      });
    } catch (err: any) {
      console.error('Service Account Config Error:', err);
      return res.status(400).json({
        success: false,
        error: err.message || 'Gagal menghubungkan Google Service Account',
      });
    }
  });

  // Test Service Account connection without saving
  app.post('/api/gsheet-service-account/test', async (req, res) => {
    try {
      const current = getEffectiveGoogleConfig();
      const { clientEmail, privateKey, spreadsheetId } = req.body || {};

      const targetConfig: GoogleServiceAccountConfig = {
        clientEmail: (clientEmail || current.clientEmail).trim(),
        privateKey: (privateKey || current.privateKey).trim(),
        spreadsheetId: (spreadsheetId || current.spreadsheetId).trim(),
      };

      const testResult = await GoogleSheetsServiceAccount.testConnection(targetConfig);
      return res.json({
        ...testResult,
        message: `Koneksi valid! Terhubung ke spreadsheet: "${testResult.spreadsheetTitle}"`,
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err.message || 'Koneksi Service Account gagal',
      });
    }
  });

  // Push records directly to Google Sheet via Service Account
  app.post('/api/gsheet-service-account/push', async (req, res) => {
    try {
      const cfg = getEffectiveGoogleConfig();
      if (!cfg.clientEmail || !cfg.privateKey || !cfg.spreadsheetId) {
        return res.status(400).json({
          success: false,
          error:
            'Kredensial Google Service Account (GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY) atau ID Spreadsheet belum lengkap.',
        });
      }

      const rawRecords = Array.isArray(req.body?.records) ? req.body.records : memoryStore.records;
      const records = deduplicateRecords(rawRecords);
      const result = await GoogleSheetsServiceAccount.pushRecordsToSheet(cfg, records);

      // Keep server cache in sync with deduplicated records
      memoryStore.records = records;
      memoryStore.lastUpdated = new Date().toISOString();
      saveStoreToFile();

      return res.json({
        ...result,
        message: `Berhasil sinkronisasi ${records.length} baris ke Google Sheets!`,
      });
    } catch (err: any) {
      console.error('Service Account Push Error:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Gagal mengirim data ke Google Sheets',
      });
    }
  });

  // Pull records directly from Google Sheet via Service Account
  app.get('/api/gsheet-service-account/pull', async (_req, res) => {
    try {
      const cfg = getEffectiveGoogleConfig();
      if (!cfg.clientEmail || !cfg.privateKey || !cfg.spreadsheetId) {
        return res.status(400).json({
          success: false,
          error:
            'Kredensial Google Service Account (GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY) atau ID Spreadsheet belum lengkap.',
        });
      }

      const result = await GoogleSheetsServiceAccount.pullRecordsFromSheet(cfg);
      const cleanRecords = deduplicateRecords(result.records || []);
      if (cleanRecords.length > 0) {
        memoryStore.records = cleanRecords;
        memoryStore.lastUpdated = new Date().toISOString();
        saveStoreToFile();
      }

      return res.json({
        success: true,
        message: `Berhasil memuat ${cleanRecords.length} baris dari Google Sheets!`,
        records: cleanRecords,
        count: cleanRecords.length,
      });
    } catch (err: any) {
      console.error('Service Account Pull Error:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Gagal membaca data dari Google Sheets',
      });
    }
  });

  // Network and Cloud URL info
  app.get('/api/network-info', (_req, res) => {
    return res.json({
      appUrl: process.env.APP_URL || '',
      port: PORT,
      timestamp: new Date().toISOString(),
    });
  });

  // Mount Vite middleware in development or serve built files in production
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[DistriReject ERPNext] Full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
