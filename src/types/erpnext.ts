/**
 * Types for Real ERPNext Connection and Master Data
 */

export interface ErpConfig {
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
  isConnected: boolean;
  companyName?: string;
  loggedUser?: string;
  loggedUserFullName?: string;
  lastSyncTime?: string;
  defaultJenis?: string;
}

export interface ErpItem {
  name: string; // item_code in ERPNext
  item_code: string;
  item_name: string;
  item_group: string;
  brand?: string;
  stock_uom: string;
  valuation_rate: number;
  standard_rate?: number;
  last_purchase_rate?: number;
  description?: string;
  weight_per_unit?: number;
  disabled?: number;
}

export interface ErpWarehouse {
  name: string;
  warehouse_name: string;
  is_group?: number | boolean;
  company?: string;
  warehouse_type?: string;
  disabled?: number;
}

export interface ErpBinValuation {
  item_code: string;
  warehouse: string;
  actual_qty: number;
  valuation_rate: number;
  stock_value: number;
}

export interface ErpConnectionTestResult {
  success: boolean;
  message: string;
  user?: string;
  userFullName?: string;
  company?: string;
  accessibleDocTypes?: string[];
  latencyMs?: number;
}
