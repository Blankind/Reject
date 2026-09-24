import fs from 'fs';
import path from 'path';
import type { RejectRecord } from '../src/types';

const DIR = path.resolve(process.cwd(), 'data');
const FILE = path.join(DIR, 'records.json');

let records: RejectRecord[] = [];
try {
  if (fs.existsSync(FILE)) {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
    if (Array.isArray(parsed)) records = parsed;
  }
} catch (e) {
  console.warn('[store] gagal baca records.json:', e);
}

function persist() {
  fs.mkdirSync(DIR, { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(records, null, 2), 'utf-8');
  fs.renameSync(tmp, FILE);
}

export const listRecords = () => records;
export const findRecord = (id: string) => records.find((r) => r.id === id);

export function saveRecord(r: RejectRecord) {
  const i = records.findIndex((x) => x.id === r.id);
  if (i >= 0) records[i] = r;
  else records.unshift(r);
  persist();
}

/** Nomor dokumen harian: REJ-YYYYMMDD-001 */
export function nextDocNumber(date: string): string {
  const prefix = `REJ-${date.replace(/-/g, '')}-`;
  const max = records
    .filter((r) => r.docNumber.startsWith(prefix))
    .reduce((m, r) => Math.max(m, parseInt(r.docNumber.slice(prefix.length), 10) || 0), 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}
