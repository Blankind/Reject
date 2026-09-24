export type SyncState = 'pending' | 'ok' | 'failed' | 'skipped';

export interface RejectRecord {
  id: string;
  docNumber: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  itemCode: string;
  itemName: string;
  warehouse: string;
  qty: number;
  uom: string;
  rate: number;
  total: number;
  reason: string;
  pic: string;
  notes: string;
  sheetStatus: SyncState;
  sheetError?: string;
  createdAt: string;
}

export interface ErpItem {
  item_code: string;
  item_name: string;
  item_group?: string;
  brand?: string;
  stock_uom: string;
  valuation_rate: number;
}

export interface Meta {
  erpConfigured: boolean;
  sheetConfigured: boolean;
  sheetUrl: string;
}

export const REASONS = [
  'Bengkok / Deformasi Fisik',
  'Cacat Pabrik / Pengelasan',
  'Berkarat / Korosi',
  'Dimensi / Ketebalan Tidak Sesuai',
  'Drat / Threading Rusak',
  'Retur Pelanggan (Salah Spesifikasi)',
  'Pecah / Keretakan',
  'Penyok Akibat Handling',
  'Lainnya',
];
