export type TabName =
  | 'Dashboard'
  | 'ItemList'
  | 'MaterialRequest'
  | 'PurchaseOrder'
  | 'MaterialReceive'
  | 'MaterialIssued'
  | 'Inventory'
  | 'Users';

export interface UserSession {
  username: string;
  fullname: string;
  role: string;
  email?: string;
}

export interface RecordRow {
  [key: string]: any;
  _rowIndex?: number;
}

export interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error';
}

export interface CompanyHeader {
  companyName: string;
  supportOffice: string;
  addressLine1: string;
  addressLine2: string;
  phone: string;
  email: string;
  logoUrl: string;
}

export interface DocHeader {
  [key: string]: any;
  DocTitle?: string;
  RequestID?: string;
  DocNoLabel?: string;
  Date?: string;
  WellLoc?: string;
  RigName?: string;
  Department?: string;
  Client?: string;
  Project?: string;
  Priority?: string;
  PurchaseBy?: string;
  Remark?: string;
  UserBy?: string;
  PreparedBy?: string;
  AcknowledgedBy?: string;
  ApprovedBy?: string;
}

export const TAB_SCHEMAS: Record<TabName, string[]> = {
  Dashboard: [],
  ItemList: ['ItemID', 'ItemName', 'Category', 'UoM', 'UnitPriceUSD', 'UnitPriceIDR', 'MinStock', 'LastStock', 'Location', 'UpdatedBy', 'Photo'],
  MaterialRequest: ['RequestID', 'Date', 'ItemID', 'ItemName', 'Qty', 'UoM', 'Department', 'Status', 'Priority', 'Remark', 'UpdatedBy', 'Attachment'],
  PurchaseOrder: ['POID', 'Date', 'ItemID', 'ItemName', 'Qty', 'UoM', 'UnitPriceIDR', 'UnitPriceUSD', 'TotalPriceIDR', 'TotalPriceUSD', 'Supplier', 'PlaceOfDelivery', 'Status', 'Remark', 'UpdatedBy', 'Attachment'],
  MaterialReceive: ['ReceiveID', 'Date', 'ItemID', 'ItemName', 'Qty', 'UoM', 'UnitPriceUSD', 'UnitPriceIDR', 'TotalPriceUSD', 'TotalPriceIDR', 'Supplier', 'Remark', 'UpdatedBy', 'Attachment'],
  MaterialIssued: ['IssueID', 'Date', 'ItemID', 'ItemName', 'Qty', 'UoM', 'UnitPriceIDR', 'UnitPriceUSD', 'TotalPriceIDR', 'TotalPriceUSD', 'Department', 'Remark', 'UpdatedBy', 'Attachment'],
  Inventory: ['ItemID', 'ItemName', 'UoM', 'UnitPriceUSD', 'UnitPriceIDR', 'MinStock', 'LastStock', 'StockIn', 'StockOut', 'CurrentStock', 'Status', 'Location', 'TotalPriceUSD', 'TotalPriceIDR', 'UpdatedBy'],
  Users: ['Username', 'Email', 'Password', 'Role', 'Fullname', 'UpdatedBy']
};
