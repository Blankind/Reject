# Reject Dashboard

Dashboard + input reject. Sync otomatis ke ERPNext & Google Sheets (semua di kode, konfigurasi via `.env`).

## Jalankan
```
cp .env.example .env   # isi kredensial
npm install
npm run dev            # dev
npm run build && npm start   # production
```

## Alur simpan
1. Simpan lokal `data/records.json` (tidak hilang walau sync gagal)
2. ERP: Stock Entry (Material Transfer) gudang asal -> `ERP_REJECT_WAREHOUSE` (jika `ERP_CREATE_STOCK_ENTRY=true`)
3. Sheets: append 1 baris ke tab `GOOGLE_SHEET_NAME` (tab & header dibuat otomatis)
4. Gagal sync -> badge merah di dashboard, tombol "Retry sync"
