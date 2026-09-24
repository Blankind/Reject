import { env, erpConfigured } from './env';
import type { ErpItem } from '../src/types';

async function erp(path: string, init: { method?: string; body?: unknown } = {}): Promise<any> {
  if (!erpConfigured()) throw new Error('ERPNext belum dikonfigurasi (.env).');
  const res = await fetch(`${env.erp.url}${path}`, {
    method: init.method || 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `token ${env.erp.key}:${env.erp.secret}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-json */
  }
  if (!res.ok) {
    let msg = json?.exception || json?.message || json?.exc_type || res.statusText;
    // _server_messages berisi pesan validasi Frappe (JSON string dalam array)
    if (json?._server_messages) {
      try {
        const arr = JSON.parse(json._server_messages) as string[];
        msg = arr.map((s) => JSON.parse(s).message).join('; ').replace(/<[^>]+>/g, '');
      } catch {
        /* ignore */
      }
    }
    throw new Error(`ERPNext ${res.status}: ${String(msg).slice(0, 300)}`);
  }
  return json;
}

const q = (v: unknown) => encodeURIComponent(JSON.stringify(v));

export async function searchItems(query: string, limit = 20): Promise<ErpItem[]> {
  const fields = ['item_code', 'item_name', 'item_group', 'brand', 'stock_uom', 'valuation_rate'];
  const filters: unknown[] = [['disabled', '=', 0]];
  let url = `/api/resource/Item?fields=${q(fields)}&filters=${q(filters)}&limit_page_length=${limit}`;
  const s = query.trim();
  if (s) {
    const or = [
      ['item_name', 'like', `%${s}%`],
      ['item_code', 'like', `%${s}%`],
      ['item_group', 'like', `%${s}%`],
      ['brand', 'like', `%${s}%`],
    ];
    url += `&or_filters=${q(or)}`;
  } else {
    url += '&order_by=modified%20desc';
  }
  const res = await erp(url);
  return (res?.data || []).map((i: any) => ({
    item_code: i.item_code,
    item_name: i.item_name || i.item_code,
    item_group: i.item_group || '',
    brand: i.brand || '',
    stock_uom: i.stock_uom || 'Nos',
    valuation_rate: Number(i.valuation_rate) || 0,
  }));
}

export async function listWarehouses(): Promise<string[]> {
  const fields = ['name'];
  const filters = [
    ['is_group', '=', 0],
    ['disabled', '=', 0],
  ];
  const res = await erp(
    `/api/resource/Warehouse?fields=${q(fields)}&filters=${q(filters)}&limit_page_length=500&order_by=name%20asc`,
  );
  return (res?.data || []).map((w: any) => w.name as string);
}

/** Valuation rate: Bin (per gudang) -> Item master. Return 0 jika gagal. */
export async function lookupRate(itemCode: string, warehouse: string): Promise<number> {
  if (!erpConfigured()) return 0;
  try {
    if (warehouse) {
      const filters = [
        ['item_code', '=', itemCode],
        ['warehouse', '=', warehouse],
      ];
      const bin = await erp(
        `/api/resource/Bin?fields=${q(['valuation_rate'])}&filters=${q(filters)}&limit_page_length=1`,
      );
      const r = Number(bin?.data?.[0]?.valuation_rate) || 0;
      if (r > 0) return r;
    }
    const item = await erp(`/api/resource/Item/${encodeURIComponent(itemCode)}`);
    return (
      Number(item?.data?.valuation_rate) ||
      Number(item?.data?.last_purchase_rate) ||
      Number(item?.data?.standard_rate) ||
      0
    );
  } catch {
    return 0;
  }
}

/** Tes koneksi ERP: login token + izin baca Item & Warehouse. ERP hanya dipakai untuk baca (search item & rate). */
export async function checkErp(): Promise<string> {
  const who = await erp('/api/method/frappe.auth.get_logged_user');
  const parts: string[] = [`login sebagai ${who?.message || 'user'}`];
  try {
    await searchItems('', 1);
    parts.push('baca Item OK');
  } catch (e) {
    parts.push(`baca Item GAGAL (${(e as Error).message})`);
  }
  try {
    const w = await listWarehouses();
    parts.push(`${w.length} gudang terbaca`);
  } catch (e) {
    parts.push(`baca Warehouse GAGAL (${(e as Error).message})`);
  }
  return parts.join(' · ');
}
