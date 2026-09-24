import 'dotenv/config';

const bool = (v?: string) => ['1', 'true', 'yes', 'on'].includes((v || '').trim().toLowerCase());

function sheetId(input: string): string {
  const m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return (m ? m[1] : input).trim();
}

function privateKey(raw: string): string {
  let k = raw.trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) k = k.slice(1, -1);
  return k.replace(/\\n/g, '\n');
}

export const env = {
  port: Number(process.env.PORT) || 3000,
  tz: process.env.TZ_NAME || 'Asia/Jakarta',
  erp: {
    url: (process.env.ERP_URL || '').trim().replace(/\/+$/, ''),
    key: (process.env.ERP_API_KEY || '').trim(),
    secret: (process.env.ERP_API_SECRET || '').trim(),
    createStockEntry: bool(process.env.ERP_CREATE_STOCK_ENTRY),
    rejectWarehouse: (process.env.ERP_REJECT_WAREHOUSE || '').trim(),
    submit: bool(process.env.ERP_SUBMIT_STOCK_ENTRY),
    company: (process.env.ERP_COMPANY || '').trim(),
  },
  google: {
    email: (process.env.GOOGLE_CLIENT_EMAIL || '').trim(),
    key: privateKey(process.env.GOOGLE_PRIVATE_KEY || ''),
    sheetId: sheetId(process.env.GOOGLE_SPREADSHEET_ID || ''),
    sheetName: (process.env.GOOGLE_SHEET_NAME || 'Reject').trim(),
  },
};

export const erpConfigured = () => !!(env.erp.url && env.erp.key && env.erp.secret);
export const erpWriteEnabled = () =>
  erpConfigured() && env.erp.createStockEntry && !!env.erp.rejectWarehouse;
export const sheetConfigured = () => !!(env.google.email && env.google.key && env.google.sheetId);
