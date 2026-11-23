export type TabName =
  | 'Dashboard'
  | 'ItemList'
  | 'MaterialRequest'
  | 'PurchaseOrder'
  | 'MaterialReceive'
  | 'MaterialIssued'
  | 'Inventory'
  | 'Users';

export type EditableModule =
  | 'ItemList'
  | 'MaterialRequest'
  | 'PurchaseOrder'
  | 'MaterialReceive'
  | 'MaterialIssued'
  | 'Users';

export type AccessMode = 'view_only' | 'custom' | 'full_edit';

export interface UserPermissions {
  mode: AccessMode;
  editableTabs: EditableModule[];
}

export const EDITABLE_MODULES: {
  key: EditableModule;
  label: string;
  shortLabel: string;
  description: string;
  icon: string;
}[] = [
  {
    key: 'ItemList',
    label: 'Item Master & Stock',
    shortLabel: 'Items',
    description: 'Tambah, edit & hapus master barang serta Last Stock',
    icon: 'fa-boxes-stacked',
  },
  {
    key: 'MaterialRequest',
    label: 'Material Request',
    shortLabel: 'MRQ',
    description: 'Buat, edit, hapus & ubah status permintaan material',
    icon: 'fa-file-invoice',
  },
  {
    key: 'PurchaseOrder',
    label: 'Purchase Order',
    shortLabel: 'PO',
    description: 'Buat, edit, hapus & cetak form Purchase Order',
    icon: 'fa-cart-shopping',
  },
  {
    key: 'MaterialReceive',
    label: 'Material Receive',
    shortLabel: 'MRR',
    description: 'Input barang masuk, scan QR & edit form MRR',
    icon: 'fa-truck-ramp-box',
  },
  {
    key: 'MaterialIssued',
    label: 'Material Issued',
    shortLabel: 'MIS',
    description: 'Input barang keluar, scan QR & edit form MIS',
    icon: 'fa-share-nodes',
  },
  {
    key: 'Users',
    label: 'Users & Izin Akun',
    shortLabel: 'Users',
    description: 'Kelola akun pengguna dan hak akses edit',
    icon: 'fa-users-gear',
  },
];

export const DEFAULT_COLUMN_LABELS: Record<string, string> = {
  UpdatedBy: 'Last Edit By',
  Permissions: 'Izin Akun',
};

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
  UpdatedBy?: string;
  UpdatedAt?: string;
  UpdatedAtISO?: string;
}

export const TAB_SCHEMAS: Record<TabName, string[]> = {
  Dashboard: [],
  ItemList: ['ItemID', 'ItemName', 'Category', 'UoM', 'UnitPriceUSD', 'UnitPriceIDR', 'MinStock', 'LastStock', 'Location', 'UpdatedBy', 'Photo'],
  MaterialRequest: ['RequestID', 'Date', 'ItemID', 'ItemName', 'Qty', 'UoM', 'Department', 'Status', 'Priority', 'Remark', 'UpdatedBy', 'Attachment'],
  PurchaseOrder: ['POID', 'Date', 'ItemID', 'ItemName', 'Qty', 'UoM', 'UnitPriceIDR', 'UnitPriceUSD', 'TotalPriceIDR', 'TotalPriceUSD', 'Supplier', 'PlaceOfDelivery', 'Status', 'Remark', 'UpdatedBy', 'Attachment'],
  MaterialReceive: ['ReceiveID', 'Date', 'ItemID', 'ItemName', 'Qty', 'UoM', 'UnitPriceUSD', 'UnitPriceIDR', 'TotalPriceUSD', 'TotalPriceIDR', 'Supplier', 'Remark', 'UpdatedBy', 'Attachment'],
  MaterialIssued: ['IssueID', 'Date', 'ItemID', 'ItemName', 'Qty', 'UoM', 'UnitPriceIDR', 'UnitPriceUSD', 'TotalPriceIDR', 'TotalPriceUSD', 'Department', 'Remark', 'UpdatedBy', 'Attachment'],
  Inventory: ['ItemID', 'ItemName', 'UoM', 'UnitPriceUSD', 'UnitPriceIDR', 'MinStock', 'LastStock', 'StockIn', 'StockOut', 'CurrentStock', 'Status', 'Location', 'TotalPriceUSD', 'TotalPriceIDR', 'UpdatedBy'],
  Users: ['Username', 'Email', 'Password', 'Role', 'Fullname', 'Permissions', 'UpdatedBy']
};
