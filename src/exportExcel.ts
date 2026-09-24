import type { PenaltyRecord, ActivityLog } from './types';

const fmtDate = (v?: string) => {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleString('id-ID');
};

export async function exportToExcel(
  records: PenaltyRecord[],
  logs: ActivityLog[],
  period?: { start?: string; end?: string }
) {
  const XLSX = await import('xlsx');

  // Sheet 1: detail
  const detail = records.map((r, i) => ({
    No: i + 1,
    Tanggal: fmtDate(r.createdAt),
    Nama: r.name,
    Cabang: r.branch,
    'Jumlah (Rp)': Number(r.amount) || 0,
    Keterangan: r.description,
    'Detail Dokumen': r.documentDetail,
    Status: r.status === 'PAID' ? 'LUNAS' : 'BELUM LUNAS',
    'Tgl Bayar': fmtDate(r.paidAt),
    'Rekening Tujuan': r.destinationAccount || '',
  }));

  // Sheet 2: rekap per pelanggar
  const map = new Map<string, { name: string; branch: string; count: number; total: number; paid: number }>();
  for (const r of records) {
    const key = `${r.name.trim().toLowerCase()}|${r.branch}`;
    const cur = map.get(key) || { name: r.name, branch: r.branch, count: 0, total: 0, paid: 0 };
    cur.count += 1;
    cur.total += Number(r.amount) || 0;
    if (r.status === 'PAID') cur.paid += Number(r.amount) || 0;
    map.set(key, cur);
  }
  const rekap = [...map.values()]
    .sort((a, b) => b.total - a.total)
    .map((x, i) => ({
      No: i + 1,
      Nama: x.name,
      Cabang: x.branch,
      'Jumlah Pelanggaran': x.count,
      'Total Denda (Rp)': x.total,
      'Sudah Dibayar (Rp)': x.paid,
      'Sisa (Rp)': x.total - x.paid,
    }));

  // Sheet 3: log
  const logRows = logs.map((l, i) => ({
    No: i + 1,
    Waktu: fmtDate(l.timestamp),
    Aksi: l.action,
    Detail: l.details,
  }));

  const wb = XLSX.utils.book_new();
  const add = (rows: any[], name: string, widths: number[]) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = widths.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  add(detail, 'Detail Denda', [5, 20, 25, 14, 14, 35, 35, 14, 20, 18]);
  add(rekap, 'Rekap per Pelanggar', [5, 25, 14, 18, 18, 18, 16]);
  add(logRows, 'Log Aktivitas', [5, 20, 10, 60]);

  const stamp = new Date().toISOString().slice(0, 10);
  const range = period?.start || period?.end ? `_${period.start || 'awal'}_sd_${period.end || 'akhir'}` : '';
  XLSX.writeFile(wb, `data-denda_${stamp}${range}.xlsx`);
}
