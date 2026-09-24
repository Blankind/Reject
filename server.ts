import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { env, erpConfigured, erpWriteEnabled, sheetConfigured } from './server/env';
import { createStockEntry, listWarehouses, lookupRate, searchItems } from './server/erp';
import { appendRow } from './server/sheets';
import { findRecord, listRecords, nextDocNumber, saveRecord } from './server/store';
import type { RejectRecord } from './src/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production' || process.argv.includes('--prod');

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

function nowParts() {
  const d = new Date();
  const date = d.toLocaleDateString('sv-SE', { timeZone: env.tz });
  const time = d.toLocaleTimeString('en-GB', { timeZone: env.tz, hour: '2-digit', minute: '2-digit' });
  return { date, time };
}

/** Sync satu record ke ERP + Sheets. Aman dipanggil ulang (hanya langkah yang belum 'ok'). */
async function syncRecord(r: RejectRecord): Promise<RejectRecord> {
  if (r.erpStatus !== 'ok') {
    try {
      const doc = await createStockEntry(r);
      r.erpStatus = doc ? 'ok' : 'skipped';
      r.erpDoc = doc || r.erpDoc;
      r.erpError = undefined;
    } catch (e) {
      r.erpStatus = 'failed';
      r.erpError = errMsg(e);
    }
  }
  if (r.sheetStatus !== 'ok') {
    if (!sheetConfigured()) {
      r.sheetStatus = 'skipped';
      r.sheetError = undefined;
    } else {
      try {
        await appendRow(r);
        r.sheetStatus = 'ok';
        r.sheetError = undefined;
      } catch (e) {
        r.sheetStatus = 'failed';
        r.sheetError = errMsg(e);
      }
    }
  }
  saveRecord(r);
  return r;
}

async function start() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/meta', (_req, res) => {
    res.json({
      erpConfigured: erpConfigured(),
      erpWrite: erpWriteEnabled(),
      sheetConfigured: sheetConfigured(),
      sheetUrl: env.google.sheetId ? `https://docs.google.com/spreadsheets/d/${env.google.sheetId}/edit` : '',
    });
  });

  app.get('/api/items', wrap(async (req, res) => {
    res.json(await searchItems(String(req.query.q || '')));
  }));

  app.get('/api/warehouses', wrap(async (_req, res) => {
    res.json(await listWarehouses());
  }));

  app.get('/api/rejects', (_req, res) => {
    res.json(listRecords());
  });

  app.post('/api/rejects', wrap(async (req, res) => {
    const b = req.body || {};
    const id = String(b.id || '').trim();
    const itemCode = String(b.itemCode || '').trim();
    const itemName = String(b.itemName || '').trim();
    const warehouse = String(b.warehouse || '').trim();
    const reason = String(b.reason || '').trim();
    const pic = String(b.pic || '').trim();
    const qty = Number(b.qty);

    if (!id) return res.status(400).json({ error: 'id wajib.' });
    if (!itemCode && !itemName) return res.status(400).json({ error: 'Item wajib diisi.' });
    if (!warehouse) return res.status(400).json({ error: 'Gudang wajib diisi.' });
    if (!(qty > 0)) return res.status(400).json({ error: 'Qty harus > 0.' });
    if (!reason) return res.status(400).json({ error: 'Alasan wajib diisi.' });
    if (!pic) return res.status(400).json({ error: 'PIC wajib diisi.' });

    // Idempotent: request ganda (double tap / retry jaringan) tidak membuat baris baru
    const existing = findRecord(id);
    if (existing) return res.json(existing);

    let rate = Number(b.rate) || 0;
    if (rate <= 0 && itemCode) rate = await lookupRate(itemCode, warehouse);

    const { date, time } = nowParts();
    const record: RejectRecord = {
      id,
      docNumber: nextDocNumber(date),
      date,
      time,
      itemCode: itemCode || '-',
      itemName: itemName || itemCode,
      warehouse,
      qty,
      uom: String(b.uom || 'Pcs').trim(),
      rate,
      total: Math.round(qty * rate * 100) / 100,
      reason,
      pic,
      notes: String(b.notes || '').trim(),
      erpStatus: 'pending',
      sheetStatus: 'pending',
      createdAt: new Date().toISOString(),
    };
    saveRecord(record); // simpan lokal dulu: data tidak hilang kalau ERP/Sheets gagal
    res.json(await syncRecord(record));
  }));

  app.post('/api/rejects/retry', wrap(async (_req, res) => {
    const todo = listRecords().filter((r) => r.erpStatus !== 'ok' || r.sheetStatus !== 'ok');
    for (const r of [...todo].reverse()) await syncRecord(r); // urut lama -> baru
    res.json({ retried: todo.length });
  }));

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: errMsg(err) });
  });

  if (isProd) {
    const dist = path.resolve(__dirname, 'dist');
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }

  app.listen(env.port, '0.0.0.0', () => {
    console.log(`Reject Dashboard: http://localhost:${env.port}  [${isProd ? 'production' : 'dev'}]`);
    console.log(`ERP: ${erpConfigured() ? 'on' : 'off'} (write: ${erpWriteEnabled() ? 'on' : 'off'}) | Sheets: ${sheetConfigured() ? 'on' : 'off'}`);
  });
}

start().catch((e) => {
  console.error(e);
  process.exit(1);
});
