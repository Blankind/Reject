/**
 * Types for Reject Records and Spreadsheet Data
 */

export type RejectReason =
  | 'Cacat Pabrik / Pengelasan (Weld Seam)'
  | 'Bengkok / Deformasi Fisik'
  | 'Berkarat / Korosi Air Hujan'
  | 'Retur Pelanggan (Salah Spesifikasi)'
  | 'Dimensi / Ketebalan Tidak Sesuai Toleransi'
  | 'Drat / Threading Rusak'
  | 'Pecah / Keretakan Permukaan'
  | 'Penyok Akibat Handling / Forklift'
  | 'Lainnya / Other'
  | string;

export type RejectStatus =
  | 'Karantina Gudang'
  | 'Pengajuan Retur Pabrik'
  | 'Disetujui Retur Pabrik / Supplier'
  | 'Disetujui Retur Spindo' // Backward compatibility for saved records
  | 'Downgrade (Jual Pipa BS)'
  | 'Scrap / Besi Tua'
  | 'Selesai Diproses';

export interface RejectItemRecord {
  id: string;
  docNumber: string; // e.g. REJ-2026-09-001
  date: string; // YYYY-MM-DD
  jenis: string; // e.g. "Pipa Galvanis", "Baja Ringan", "Besi Beton", "Plat"
  item_group?: string;
  itemCode: string;
  itemName: string;
  sourceWarehouse: string; // Gudang asal
  targetWarehouse: string; // Gudang tujuan reject / karantina
  qty: number;
  uom: string; // Batang, Pcs, Kg, Meter
  valuationRate: number; // Nilai perolehan ERPNext (Rp)
  totalValue: number; // qty * valuationRate (Rp)
  alasanReject: RejectReason;
  keteranganAlasan?: string;
  status: RejectStatus;
  pic: string; // Petugas pemeriksa / gudang
  referenceDoc?: string; // No. Surat Jalan / No. PO / DO
  notes?: string;
  photoUrl?: string; // Foto bukti cacat/reject (Base64 atau URL gambar)
  createdAt: string;
  updatedAt: string;
}

export interface SpreadsheetColumnDef {
  key: keyof RejectItemRecord | 'totalValueFormatted' | 'valuationRateFormatted';
  colLetter: string;
  header: string;
  width: number;
  type: 'text' | 'number' | 'currency' | 'date' | 'badge';
  readOnly?: boolean;
}

/**
 * Deduplicate reject records to guarantee that no duplicate rows exist.
 * Two records are considered identical if they have:
 * 1. The exact same ID, or
 * 2. The exact same Document Number (No. Dokumen) (if non-empty and non-generic), or
 * 3. The exact same item code + date + source warehouse + qty + valuation rate + alasanReject.
 */
export function deduplicateRecords(records: RejectItemRecord[]): RejectItemRecord[] {
  if (!Array.isArray(records) || records.length <= 1) return records || [];

  const seenIds = new Set<string>();
  const seenDocNumbers = new Set<string>();
  const seenFingerprints = new Set<string>();
  const uniqueList: RejectItemRecord[] = [];

  for (const r of records) {
    if (!r) continue;

    // Filter out dummy/mock records if any
    if (r.id?.startsWith('mock-') || r.id?.startsWith('spd-gi-')) continue;

    // 1. Check ID uniqueness
    if (r.id && seenIds.has(r.id)) {
      continue;
    }

    // 2. Check Document Number uniqueness
    const doc = (r.docNumber || '').trim().toUpperCase();
    const isGenericDoc =
      !doc ||
      doc.startsWith('REJ-GS-') ||
      doc.startsWith('REJ-ROW-') ||
      doc.startsWith('REJ-SA-');

    if (doc && !isGenericDoc) {
      if (seenDocNumbers.has(doc)) {
        continue;
      }
      seenDocNumbers.add(doc);
    }

    // 3. Check item content fingerprint uniqueness
    // Matches identical item, date, source warehouse, qty, valuationRate, and reason
    const code = (r.itemCode || r.itemName || '').trim().toUpperCase();
    const date = (r.date || '').trim();
    const wh = (r.sourceWarehouse || '').trim().toUpperCase();
    const qty = Number(r.qty) || 0;
    const rate = Number(r.valuationRate) || 0;
    const reason = (r.alasanReject || '').trim().toLowerCase();

    const fingerprint = `${code}__${date}__${wh}__${qty}__${rate}__${reason}`;

    if (seenFingerprints.has(fingerprint)) {
      continue;
    }
    seenFingerprints.add(fingerprint);

    if (r.id) {
      seenIds.add(r.id);
    }

    uniqueList.push(r);
  }

  return uniqueList;
}
