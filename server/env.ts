import 'dotenv/config';

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
  },
  google: {
    email: (process.env.GOOGLE_CLIENT_EMAIL || '').trim(),
    key: privateKey(process.env.GOOGLE_PRIVATE_KEY || ''),
    sheetId: sheetId(process.env.GOOGLE_SPREADSHEET_ID || ''),
    sheetName: (process.env.GOOGLE_SHEET_NAME || 'Reject').trim(),
  },
};

export const erpConfigured = () => !!(env.erp.url && env.erp.key && env.erp.secret);
export const sheetConfigured = () => !!(env.google.email && env.google.key && env.google.sheetId);
