import { JWT } from 'google-auth-library';
import { env, sheetConfigured } from './env';
import type { RejectRecord } from '../src/types';

const HEADER = [
  'No. Dokumen',
  'Tanggal',
  'Jam',
  'Item Code',
  'Item Name',
  'Gudang',
  'Qty',
  'UOM',
  'Valuation Rate',
  'Total Nilai',
  'Alasan',
  'PIC',
  'Catatan',
  'ERP Doc',
];

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
let auth: JWT | null = null;
let ready = false;

async function call(path: string, init: { method?: string; body?: unknown } = {}): Promise<any> {
  if (!sheetConfigured()) throw new Error('Google Sheets belum dikonfigurasi (.env).');
  auth ??= new JWT({
    email: env.google.email,
    key: env.google.key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const token = (await auth.getAccessToken()).token;
  if (!token) throw new Error('Gagal mendapat access token Google. Cek email & private key.');
  const res = await fetch(`${BASE}/${env.google.sheetId}${path}`, {
    method: init.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 403)
      throw new Error(`Google 403: share spreadsheet ke ${env.google.email} sebagai Editor.`);
    if (res.status === 404) throw new Error('Google 404: Spreadsheet ID tidak ditemukan.');
    throw new Error(`Google ${res.status}: ${json?.error?.message || res.statusText}`);
  }
  return json;
}

const range = (a1: string) => encodeURIComponent(`'${env.google.sheetName}'!${a1}`);

/** Pastikan tab ada & header baris 1 terisi. Jalan sekali per proses. */
async function ensureSheet(): Promise<void> {
  if (ready) return;
  const meta = await call('?fields=sheets.properties.title');
  const exists = (meta.sheets || []).some((s: any) => s.properties?.title === env.google.sheetName);
  if (!exists) {
    await call(':batchUpdate', {
      method: 'POST',
      body: { requests: [{ addSheet: { properties: { title: env.google.sheetName } } }] },
    });
  }
  const head = await call(`/values/${range('A1:N1')}`);
  if (!head.values?.[0]?.length) {
    await call(`/values/${range('A1')}?valueInputOption=RAW`, {
      method: 'PUT',
      body: { values: [HEADER] },
    });
  }
  ready = true;
}

/** Tes koneksi: auth + tab + header. Lempar error jika gagal. */
export async function checkSheet(): Promise<string> {
  ready = false;
  await ensureSheet();
  return `OK, tab "${env.google.sheetName}" siap`;
}

export async function appendRow(r: RejectRecord): Promise<void> {
  try {
    await ensureSheet();
    await doAppend(r);
  } catch (e) {
    ready = false; // tab/header bisa saja dihapus; cek ulang di percobaan berikutnya
    throw e;
  }
}

async function doAppend(r: RejectRecord): Promise<void> {
  await call(`/values/${range('A:N')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    body: {
      values: [
        [
          r.docNumber,
          r.date,
          r.time,
          r.itemCode,
          r.itemName,
          r.warehouse,
          r.qty,
          r.uom,
          r.rate,
          r.total,
          r.reason,
          r.pic,
          r.notes,
          r.erpDoc || '',
        ],
      ],
    },
  });
}
