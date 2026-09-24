import type { ErpItem, Meta, RejectRecord } from './types';

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || res.statusText);
  return data as T;
}

export const api = {
  meta: () => j<Meta>('/api/meta'),
  rejects: () => j<RejectRecord[]>('/api/rejects'),
  items: (q: string) => j<ErpItem[]>(`/api/items?q=${encodeURIComponent(q)}`),
  warehouses: () => j<string[]>('/api/warehouses'),
  create: (body: Record<string, unknown>) =>
    j<RejectRecord>('/api/rejects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  retry: () => j<{ retried: number }>('/api/rejects/retry', { method: 'POST' }),
};

export const rupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

export const num = (n: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(n || 0);

/** crypto.randomUUID hanya ada di HTTPS/localhost; fallback untuk akses via IP LAN */
export const uid = () =>
  (globalThis.crypto as Crypto | undefined)?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
