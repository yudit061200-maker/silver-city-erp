import React, { useState, useEffect } from 'react';
import {
  TabName,
  UserSession,
  RecordRow,
  ToastItem,
  CompanyHeader,
  DocHeader,
  TAB_SCHEMAS
} from './types';
import {
  importedItems,
  importedRequests,
  importedPOs,
  importedReceives,
  importedIssued,
  importedUsers,
  SPREADSHEET_DATA_VERSION
} from './data/spreadsheetImport';

import { LoginModal } from './components/LoginModal';
import { processFileUpload } from './utils/fileUpload';
import { processPriceUpdates, parseNumberValue, DEFAULT_EXCHANGE_RATE } from './utils/currency';
import { matchesSearchQuery } from './utils/search';
import { calculateIssuedStockOnHand } from './utils/stock';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { SingleRecordModal } from './components/SingleRecordModal';
import { MultiRecordModal } from './components/MultiRecordModal';
import { DocBlueprintModal } from './components/DocBlueprintModal';
import { CustomHeadersModal } from './components/CustomHeadersModal';
import { ItemDetailsModal } from './components/ItemDetailsModal';
import { QrCodeModal } from './components/QrCodeModal';
import { LightboxModal } from './components/LightboxModal';
import { QrScannerInputModal } from './components/QrScannerInputModal';
import { ReorderNotificationModal } from './components/ReorderNotificationModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { SpreadsheetSyncModal } from './components/SpreadsheetSyncModal';
import { db, doc, getDocFromServer, onSnapshot } from './lib/firebase';
import {
  saveChunkedFirestore,
  loadChunkedFirestore,
  fetchFullStoreFromFirestore,
  purgeLocalStorageDataset
} from './lib/chunkedFirestore';

const initialItems: RecordRow[] = importedItems as any[];
const initialRequests: RecordRow[] = importedRequests as any[];
const initialPOs: RecordRow[] = importedPOs as any[];
const initialReceives: RecordRow[] = importedReceives as any[];
const initialIssued: RecordRow[] = importedIssued as any[];
const initialUsers: RecordRow[] = (importedUsers && importedUsers.length > 0) ? (importedUsers as any[]).map(u => ({
  ...u,
  Email: u.Email || (u.Username === 'yudit061200' ? 'yudit061200@gmail.com' : `${String(u.Username || '').toLowerCase()}@silvercitydrilling.co.id`)
})) : [
  { _rowIndex: 2, Username: 'admin', Email: 'admin@silvercitydrilling.co.id', Password: '123', Role: 'Admin', Fullname: 'System Admin' },
  { _rowIndex: 3, Username: 'operator', Email: 'operator@silvercitydrilling.co.id', Password: '123', Role: 'Operator', Fullname: 'Rig Material Man' }
];

export const syncAttachmentsForTab = (tab: TabName, data: RecordRow[]): RecordRow[] => {
  const primaryKey = (TAB_SCHEMAS[tab] || [])[0];
  if (!primaryKey) return data;

  const attachMap = new Map<string, { Attachment: string; AttachmentName: string }>();
  data.forEach(row => {
    const pkVal = row[primaryKey] ? String(row[primaryKey]).trim().toLowerCase() : '';
    if (pkVal && row.Attachment) {
      attachMap.set(pkVal, {
        Attachment: row.Attachment,
        AttachmentName: row.AttachmentName || ''
      });
    }
  });

  if (attachMap.size === 0) return data;

  return data.map(row => {
    const pkVal = row[primaryKey] ? String(row[primaryKey]).trim().toLowerCase() : '';
    if (pkVal && attachMap.has(pkVal)) {
      const match = attachMap.get(pkVal)!;
      if (row.Attachment !== match.Attachment || row.AttachmentName !== match.AttachmentName) {
        return {
          ...row,
          Attachment: match.Attachment,
          AttachmentName: match.AttachmentName
        };
      }
    }
    return row;
  });
};

export const safeSetLocalStorage = (_key: string, _val: any) => {
  // Legacy stub kept for backward compatibility; all data persists directly to Firebase Firestore
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => {
    try {
      localStorage.removeItem('silverCityERP_session');
      const saved = sessionStorage.getItem('silverCityERP_session');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const isYudit = currentUser?.username?.trim().toLowerCase() === 'yudit061200';

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('silverCityERP_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch { return false; }
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('silverCityERP_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('silverCityERP_theme', 'light');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
  };

  const [activeTab, setActiveTab] = useState<TabName>('Dashboard');
  const [currentViewMode, setCurrentViewMode] = useState<'list' | 'report'>('list');

  // Primary data states initialized directly with defaults; Firestore is the single source of truth
  const [items, setItems] = useState<RecordRow[]>(initialItems);
  const [requests, setRequests] = useState<RecordRow[]>(initialRequests);
  const [purchaseOrders, setPurchaseOrders] = useState<RecordRow[]>(initialPOs);
  const [receives, setReceives] = useState<RecordRow[]>(initialReceives);
  const [issued, setIssued] = useState<RecordRow[]>(initialIssued);
  const [users, setUsers] = useState<RecordRow[]>(initialUsers);

  const [companyHeader, setCompanyHeader] = useState<CompanyHeader>({
    companyName: 'PT. SILVER CITY DRILLING',
    supportOffice: 'SUPPORT OFFICE :',
    addressLine1: 'Block R, Kl. Saraswati No. 9A Blok R, Cipete Utara,',
    addressLine2: 'Kec. Kebayoran Baru, Kota Jakarta Selatan, D.K.I Jakarta 12150',
    phone: '(+61) 8 8952 2966',
    email: 'jakartaoffice@silvercitydrilling.co.id',
    logoUrl: 'https://static.wixstatic.com/media/6daabc_acbf1201bd204e28becacd2ce16a7fb5~mv2.png/v1/fill/w_357,h_100,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/6daabc_acbf1201bd204e28becacd2ce16a7fb5~mv2.png'
  });

  const [savedDocHeaders, setSavedDocHeaders] = useState<Record<string, any>>({});
  const [customColHeaders, setCustomColHeaders] = useState<Record<string, string>>({});
  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(false);
  const [isSavingToFirestore, setIsSavingToFirestore] = useState<boolean>(false);

  const isFirestoreHydratedRef = React.useRef<boolean>(false);

  const latestStoreRef = React.useRef({
    items,
    requests,
    purchaseOrders,
    receives,
    issued,
    users,
    companyHeader,
    savedDocHeaders,
    customColHeaders
  });

  useEffect(() => {
    latestStoreRef.current = {
      items,
      requests,
      purchaseOrders,
      receives,
      issued,
      users,
      companyHeader,
      savedDocHeaders,
      customColHeaders
    };
  }, [items, requests, purchaseOrders, receives, issued, users, companyHeader, savedDocHeaders, customColHeaders]);

  // Purge any stale localStorage ERP data on mount to ensure clean Firebase-only operation
  useEffect(() => {
    purgeLocalStorageDataset();
  }, []);

  const applyHydratedStore = (store: any) => {
    if (!store) return;
    if (Array.isArray(store.items)) {
      setItems(store.items);
      latestStoreRef.current.items = store.items;
    }
    if (Array.isArray(store.requests)) {
      setRequests(store.requests);
      latestStoreRef.current.requests = store.requests;
    }
    if (Array.isArray(store.pos)) {
      setPurchaseOrders(store.pos);
      latestStoreRef.current.purchaseOrders = store.pos;
    }
    if (Array.isArray(store.receives)) {
      setReceives(store.receives);
      latestStoreRef.current.receives = store.receives;
    }
    if (Array.isArray(store.issued)) {
      setIssued(store.issued);
      latestStoreRef.current.issued = store.issued;
    }
    if (Array.isArray(store.users)) {
      setUsers(store.users);
      latestStoreRef.current.users = store.users;
    }
    if (store.companyHeader) {
      setCompanyHeader(store.companyHeader);
      latestStoreRef.current.companyHeader = store.companyHeader;
    }
    if (store.savedDocHeaders) {
      setSavedDocHeaders(store.savedDocHeaders);
      latestStoreRef.current.savedDocHeaders = store.savedDocHeaders;
    }
    if (store.customColHeaders) {
      setCustomColHeaders(store.customColHeaders);
      latestStoreRef.current.customColHeaders = store.customColHeaders;
    }
    isFirestoreHydratedRef.current = true;
  };

  const pushSyncToServer = async (overrideStore?: any) => {
    setIsSavingToFirestore(true);

    // Guard: if Firestore hasn't finished initial hydration yet, fetch server store first
    // so we never accidentally overwrite existing cloud data with default initial arrays.
    let baseStore: any = {
      items: latestStoreRef.current.items,
      requests: latestStoreRef.current.requests,
      pos: latestStoreRef.current.purchaseOrders,
      receives: latestStoreRef.current.receives,
      issued: latestStoreRef.current.issued,
      users: latestStoreRef.current.users,
      companyHeader: latestStoreRef.current.companyHeader,
      savedDocHeaders: latestStoreRef.current.savedDocHeaders,
      customColHeaders: latestStoreRef.current.customColHeaders,
    };

    if (!isFirestoreHydratedRef.current) {
      try {
        const existingServerStore = await fetchFullStoreFromFirestore();
        if (existingServerStore) {
          baseStore = {
            items: Array.isArray(existingServerStore.items) ? existingServerStore.items : baseStore.items,
            requests: Array.isArray(existingServerStore.requests) ? existingServerStore.requests : baseStore.requests,
            pos: Array.isArray(existingServerStore.pos) ? existingServerStore.pos : baseStore.pos,
            receives: Array.isArray(existingServerStore.receives) ? existingServerStore.receives : baseStore.receives,
            issued: Array.isArray(existingServerStore.issued) ? existingServerStore.issued : baseStore.issued,
            users: Array.isArray(existingServerStore.users) ? existingServerStore.users : baseStore.users,
            companyHeader: existingServerStore.companyHeader || baseStore.companyHeader,
            savedDocHeaders: existingServerStore.savedDocHeaders || baseStore.savedDocHeaders,
            customColHeaders: existingServerStore.customColHeaders || baseStore.customColHeaders,
          };
          isFirestoreHydratedRef.current = true;
        }
      } catch (fetchErr) {
        console.warn("Pre-write hydration check failed:", fetchErr);
      }
    }

    const newTs = Date.now();
    const storeObj = {
      items: overrideStore?.items !== undefined ? overrideStore.items : baseStore.items,
      requests: overrideStore?.requests !== undefined ? overrideStore.requests : baseStore.requests,
      pos: overrideStore?.pos !== undefined ? overrideStore.pos : baseStore.pos,
      receives: overrideStore?.receives !== undefined ? overrideStore.receives : baseStore.receives,
      issued: overrideStore?.issued !== undefined ? overrideStore.issued : baseStore.issued,
      users: overrideStore?.users !== undefined ? overrideStore.users : baseStore.users,
      companyHeader: overrideStore?.companyHeader || baseStore.companyHeader,
      savedDocHeaders: overrideStore?.savedDocHeaders || baseStore.savedDocHeaders,
      customColHeaders: overrideStore?.customColHeaders || baseStore.customColHeaders,
      dataVersion: SPREADSHEET_DATA_VERSION,
      lastUpdated: newTs
    };

    // Save directly to Firebase Firestore
    try {
      await saveChunkedFirestore(storeObj);
      isFirestoreHydratedRef.current = true;
      setIsFirebaseConnected(true);
    } catch (e) {
      console.error("Direct Firestore write error:", e);
    } finally {
      setIsSavingToFirestore(false);
    }

    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store: storeObj })
      });
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('silvercity_erp_sync');
        bc.postMessage({ type: 'SYNC_UPDATE', timestamp: Date.now() });
        bc.close();
      }
    } catch {
      // Offline fallback
    }
  };

  // Real-time Firebase Firestore synchronization
  useEffect(() => {
    let isMounted = true;

    // 1. Initial direct load from Firebase Firestore
    fetchFullStoreFromFirestore().then((store) => {
      if (isMounted && store) {
        applyHydratedStore(store);
        setIsFirebaseConnected(true);
      }
    }).catch(err => {
      console.warn("Initial Firestore fetch notice:", err);
    });

    // 2. Real-time Firestore snapshot listener
    const unsubscribeFirestore = onSnapshot(doc(db, 'erp', 'main_store'), async (snapshot) => {
      if (!isMounted) return;
      setIsFirebaseConnected(true);

      const isFromCache = snapshot.metadata.fromCache;

      if (!snapshot.exists()) {
        // Never seed from a cached-only miss; confirm directly against the Firestore server first
        if (isFromCache) return;
        try {
          const serverCheck = await getDocFromServer(doc(db, 'erp', 'main_store'));
          if (serverCheck.exists()) {
            const s = await loadChunkedFirestore(serverCheck.data());
            if (isMounted && s) applyHydratedStore(s);
            return;
          }
        } catch (checkErr) {
          console.warn("Firestore server check notice (skipping seed to protect data):", checkErr);
          return;
        }

        // Confirmed missing on Firestore server: seed initial store once
        const initialStoreObj = {
          items: latestStoreRef.current.items,
          requests: latestStoreRef.current.requests,
          pos: latestStoreRef.current.purchaseOrders,
          receives: latestStoreRef.current.receives,
          issued: latestStoreRef.current.issued,
          users: latestStoreRef.current.users,
          companyHeader: latestStoreRef.current.companyHeader,
          savedDocHeaders: latestStoreRef.current.savedDocHeaders,
          customColHeaders: latestStoreRef.current.customColHeaders,
          dataVersion: SPREADSHEET_DATA_VERSION,
          lastUpdated: Date.now()
        };
        try {
          await saveChunkedFirestore(initialStoreObj);
          isFirestoreHydratedRef.current = true;
        } catch (err) {
          console.warn("Error seeding initial Firestore store:", err);
        }
        return;
      }

      if (snapshot.metadata.hasPendingWrites) {
        return;
      }

      const rawData = snapshot.data();
      if (rawData) {
        const s = await loadChunkedFirestore(rawData);
        if (isMounted && s) {
          applyHydratedStore(s);
        }
      }
    }, (error) => {
      console.warn("Firestore snapshot listener notice:", error);
    });

    return () => {
      isMounted = false;
      unsubscribeFirestore();
    };
  }, []);

  const [filterColumn, setFilterColumn] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortCol, setSortCol] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RecordRow | null>(null);
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [editingOriginalRecord, setEditingOriginalRecord] = useState<RecordRow | null>(null);
  const [editingOriginalPrimaryKey, setEditingOriginalPrimaryKey] = useState<string>('');

  const [isMultiModalOpen, setIsMultiModalOpen] = useState(false);
  const [multiRows, setMultiRows] = useState<RecordRow[]>([]);

  // Interactive Delete & Batch Selection States
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<RecordRow | null>(null);
  const [deleteRowIndex, setDeleteRowIndex] = useState<number | null>(null);
  const [isBatchDelete, setIsBatchDelete] = useState(false);
  const [selectedRowIndices, setSelectedRowIndices] = useState<number[]>([]);

  // Spreadsheet Sync Modal State
  const [isSpreadsheetModalOpen, setIsSpreadsheetModalOpen] = useState(false);

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printDocId, setPrintDocId] = useState('');
  const [printDocHeader, setPrintDocHeader] = useState<DocHeader>({});
  const [printDocItems, setPrintDocItems] = useState<RecordRow[]>([]);

  const [isItemDetailsModalOpen, setIsItemDetailsModalOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<RecordRow | null>(null);
  const [editingOriginalItemId, setEditingOriginalItemId] = useState<string>('');
  const [isEditingInDetails, setIsEditingInDetails] = useState(false);

  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrItem, setQrItem] = useState<RecordRow | null>(null);
  const [qrCopies, setQrCopies] = useState<number>(6);

  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState('');
  const [lightboxCaption, setLightboxCaption] = useState('');

  const [isQrScannerInputOpen, setIsQrScannerInputOpen] = useState(false);
  const [qrScanTargetRowIndex, setQrScanTargetRowIndex] = useState<number | null>(null);

  const [isColHeaderModalOpen, setIsColHeaderModalOpen] = useState(false);
  const [editingColHeaders, setEditingColHeaders] = useState<Record<string, string>>({});
  const [isHeaderEditMode, setIsHeaderEditMode] = useState(true);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);

  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('sc_sidebar_width');
      return saved ? parseInt(saved, 10) : 288;
    } catch { return 288; }
  });

  useEffect(() => { safeSetLocalStorage('sc_sidebar_width', sidebarWidth.toString()); }, [sidebarWidth]);
  useEffect(() => { safeSetLocalStorage('sc_company_header', companyHeader); }, [companyHeader]);
  useEffect(() => { safeSetLocalStorage('sc_doc_headers', savedDocHeaders); }, [savedDocHeaders]);
  useEffect(() => { safeSetLocalStorage('sc_custom_col_headers', customColHeaders); }, [customColHeaders]);
  useEffect(() => { setSelectedRowIndices([]); }, [activeTab, searchTerm, filterColumn, sortCol, sortDir]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const handleSignUpUser = async (newUser: RecordRow): Promise<boolean> => {
    const targetEmail = String(newUser.Email || '').trim().toLowerCase();
    const targetUsername = String(newUser.Username || '').trim().toLowerCase();

    const exists = users.some(u => {
      const uEmail = String(u.Email ?? u.email ?? '').trim().toLowerCase();
      const uName = String(u.Username ?? u.username ?? '').trim().toLowerCase();
      return (targetEmail !== '' && uEmail === targetEmail) || (targetUsername !== '' && uName === targetUsername);
    });

    if (exists) {
      showToast('Username or Email is already registered in the database!', 'error');
      return false;
    }

    const maxRowIndex = users.reduce((max, u) => Math.max(max, u._rowIndex || 0), 1);
    const createdUser: RecordRow = {
      ...newUser,
      _rowIndex: maxRowIndex + 1,
      UpdatedBy: 'Self-Registered'
    };

    const updatedUsers = [...users, createdUser];
    setUsers(updatedUsers);
    latestStoreRef.current.users = updatedUsers;
    await pushSyncToServer({ users: updatedUsers });
    return true;
  };

  const handleLoginSuccess = (userObj: UserSession) => {
    setCurrentUser(userObj);
    sessionStorage.setItem('silverCityERP_session', JSON.stringify(userObj));
    showToast(`Welcome back, ${userObj.fullname || userObj.username}!`);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem('silverCityERP_session');
    localStorage.removeItem('silverCityERP_session');
    showToast('Logged out successfully.');
  };

  const getRawDataForTab = (tab: TabName): RecordRow[] => {
    switch (tab) {
      case 'ItemList': return items;
      case 'MaterialRequest': return requests;
      case 'PurchaseOrder': return purchaseOrders;
      case 'MaterialReceive': return receives;
      case 'MaterialIssued': return issued;
      case 'Users': return users;
      case 'Inventory': {
        return items.map(item => {
          const rawId = item.ItemID;
          const normItemId = String(rawId || '').trim().toLowerCase();
          
          const stockIn = parseNumberValue(item.BaseStockIn) + receives
            .filter(r => !r.IsHistoricalImport && String(r.ItemID || '').trim().toLowerCase() === normItemId)
            .reduce((acc, curr) => acc + parseNumberValue(curr.Qty), 0);
            
          const stockOut = parseNumberValue(item.BaseStockOut) + issued
            .filter(i => !i.IsHistoricalImport && String(i.ItemID || '').trim().toLowerCase() === normItemId)
            .reduce((acc, curr) => acc + parseNumberValue(curr.Qty), 0);
            
          const lastStock = parseNumberValue(item.LastStock ?? item.CurrentStock ?? item.Stock ?? item.Qty);
          const currentStock = lastStock + stockIn - stockOut;
          const minStock = parseNumberValue(item.MinStock);
          const status = currentStock <= minStock ? 'Need Order' : 'In Stock';
          
          let priceUSD = parseNumberValue(item.UnitPriceUSD);
          let priceIDR = parseNumberValue(item.UnitPriceIDR);
          
          if (priceUSD === 0 && priceIDR > 0) {
            priceUSD = parseFloat((priceIDR / DEFAULT_EXCHANGE_RATE).toFixed(2));
          } else if (priceIDR === 0 && priceUSD > 0) {
            priceIDR = Math.round(priceUSD * DEFAULT_EXCHANGE_RATE);
          }

          return {
            ...item,
            LastStock: lastStock,
            StockIn: stockIn,
            StockOut: stockOut,
            CurrentStock: currentStock,
            MinStock: minStock,
            Status: status,
            UnitPriceUSD: priceUSD,
            UnitPriceIDR: priceIDR,
            TotalPriceUSD: (currentStock * priceUSD).toFixed(2),
            TotalPriceIDR: (currentStock * priceIDR).toFixed(0)
          };
        });
      }
      default: return [];
    }
  };

  const updateDataForTab = (tab: TabName, updated: RecordRow[]) => {
    let newItems = latestStoreRef.current.items;
    let newRequests = latestStoreRef.current.requests;
    let newPOs = latestStoreRef.current.purchaseOrders;
    let newReceives = latestStoreRef.current.receives;
    let newIssued = latestStoreRef.current.issued;
    let newUsers = latestStoreRef.current.users;

    switch (tab) {
      case 'ItemList':
      case 'Inventory':
        newItems = updated;
        setItems(updated);
        break;
      case 'MaterialRequest':
        newRequests = updated;
        setRequests(updated);
        break;
      case 'PurchaseOrder':
        newPOs = updated;
        setPurchaseOrders(updated);
        break;
      case 'MaterialReceive':
        newReceives = updated;
        setReceives(updated);
        break;
      case 'MaterialIssued':
        newIssued = updated;
        setIssued(updated);
        break;
      case 'Users':
        newUsers = updated;
        setUsers(updated);
        break;
      default:
        break;
    }

    latestStoreRef.current = {
      ...latestStoreRef.current,
      items: newItems,
      requests: newRequests,
      purchaseOrders: newPOs,
      receives: newReceives,
      issued: newIssued,
      users: newUsers
    };

    pushSyncToServer({
      items: newItems,
      requests: newRequests,
      pos: newPOs,
      receives: newReceives,
      issued: newIssued,
      users: newUsers
    });
  };

  const getDisplayColumns = (): string[] => {
    const original = TAB_SCHEMAS[activeTab] || [];
    if (currentViewMode === 'report') return original;
    if (activeTab === 'ItemList') return ['ItemID', 'ItemName', 'Category', 'Location', 'Photo'];
    if (activeTab === 'Inventory') return ['ItemID', 'ItemName', 'UoM', 'LastStock', 'StockIn', 'StockOut', 'CurrentStock', 'Status', 'Location'];
    
    if (['MaterialRequest', 'PurchaseOrder', 'MaterialReceive', 'MaterialIssued'].includes(activeTab)) {
      const primary = original[0];
      const cols = [primary];
      if (original.includes('Date')) cols.push('Date');
      if (original.includes('ItemID')) cols.push('ItemID');
      if (original.includes('ItemName')) cols.push('ItemName');
      if (original.includes('Qty')) cols.push('Qty');
      if (original.includes('UoM')) cols.push('UoM');
      if (original.includes('Supplier')) cols.push('Supplier');
      if (original.includes('Department')) cols.push('Department');
      if (original.includes('Status')) cols.push('Status');
      if (original.includes('Priority')) cols.push('Priority');
      if (original.includes('Remark')) cols.push('Remark');
      if (original.includes('Attachment')) cols.push('Attachment');
      return Array.from(new Set(cols.filter(c => original.includes(c))));
    }

    const primary = original[0] || 'ID';
    const cols = [primary];
    if (original.includes('Date')) cols.push('Date');
    if (original.includes('Status')) cols.push('Status');
    if (original.includes('Priority')) cols.push('Priority');
    if (original.includes('Remark')) cols.push('Remark');
    if (original.includes('Attachment')) cols.push('Attachment');
    return Array.from(new Set(cols));
  };

  const rawData = getRawDataForTab(activeTab);
  
  const filteredData = rawData.filter(row => {
    if (!searchTerm.trim()) return true;
    const allSchemaCols = TAB_SCHEMAS[activeTab] || getDisplayColumns();
    const colsToSearch = filterColumn === 'all' ? allSchemaCols : [filterColumn];
    return matchesSearchQuery(row, searchTerm, colsToSearch);
  });

  if (sortCol) {
    filteredData.sort((a, b) => {
      let valA = a[sortCol] !== undefined ? a[sortCol] : '';
      let valB = b[sortCol] !== undefined ? b[sortCol] : '';
      if (!isNaN(Number(valA)) && !isNaN(Number(valB)) && valA !== '' && valB !== '') {
        valA = Number(valA);
        valB = Number(valB);
      } else {
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
      }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const totalEntries = filteredData.length;
  const maxPages = Math.ceil(totalEntries / rowsPerPage) || 1;
  const startIdx = (currentPage - 1) * rowsPerPage;
  const pageData = filteredData.slice(startIdx, startIdx + rowsPerPage);

  const canMultiDelete = activeTab !== 'Dashboard' && activeTab !== 'Inventory' && (activeTab !== 'Users' || isYudit);
  const pageRowIndices = pageData.map((_, i) => startIdx + i);
  const isAllPageSelected = pageRowIndices.length > 0 && pageRowIndices.every(idx => selectedRowIndices.includes(idx));
  const isAllFilteredSelected = filteredData.length > 0 && selectedRowIndices.length === filteredData.length;
  const selectedRecordsList = selectedRowIndices
    .map(idx => filteredData[idx])
    .filter((r): r is RecordRow => r !== undefined && r !== null);

  const toggleSelectRow = (actualRowIndex: number) => {
    setSelectedRowIndices(prev =>
      prev.includes(actualRowIndex)
        ? prev.filter(i => i !== actualRowIndex)
        : [...prev, actualRowIndex]
    );
  };

  const toggleSelectPage = () => {
    if (isAllPageSelected) {
      const pageSet = new Set(pageRowIndices);
      setSelectedRowIndices(prev => prev.filter(i => !pageSet.has(i)));
    } else {
      setSelectedRowIndices(prev => Array.from(new Set([...prev, ...pageRowIndices])));
    }
  };

  const selectAllFiltered = () => {
    setSelectedRowIndices(filteredData.map((_, idx) => idx));
  };

  const clearSelection = () => {
    setSelectedRowIndices([]);
  };

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const openSingleModal = (editRecord?: RecordRow, index?: number) => {
    if (activeTab === 'Users' && !isYudit) {
      showToast('Akses ditolak: Hanya akun yudit061200 yang dapat mengelola users', 'error');
      return;
    }
    if (editRecord) {
      const primaryKey = (TAB_SCHEMAS[activeTab] || [])[0] || 'ID';
      setEditingOriginalRecord(editRecord);
      setEditingOriginalPrimaryKey(editRecord[primaryKey] ? String(editRecord[primaryKey]) : '');
      setEditingRecord({ ...editRecord });
      setEditingRowIndex(index !== undefined ? index : null);
    } else {
      setEditingOriginalRecord(null);
      setEditingOriginalPrimaryKey('');
      const schema = TAB_SCHEMAS[activeTab] || [];
      const primaryKey = schema[0] || 'ID';

      const newObj: RecordRow = {};
      schema.forEach(col => {
        if (col === primaryKey) newObj[col] = '';
        else if (col === 'Date') newObj[col] = new Date().toISOString().split('T')[0];
        else if (col === 'Status' && activeTab === 'MaterialRequest') newObj[col] = 'Pending';
        else if (col === 'Priority' && activeTab === 'MaterialRequest') newObj[col] = 'Normal';
        else if (col === 'UpdatedBy') newObj[col] = currentUser ? currentUser.username : 'System';
        else newObj[col] = '';
      });
      setEditingRecord(newObj);
      setEditingRowIndex(null);
    }
    setIsSingleModalOpen(true);
  };

  const handleSheetCellChange = (
    rowObjOrIndex: RecordRow | number,
    columnKeyOrObject: string | Record<string, any>,
    newValue?: any
  ) => {
    if (activeTab === 'Users' && !isYudit) {
      showToast('Akses ditolak: Hanya akun yudit061200 yang dapat mengelola users', 'error');
      return;
    }
    const currentData = [...getRawDataForTab(activeTab)];
    let targetIdx = -1;

    if (typeof rowObjOrIndex === 'object' && rowObjOrIndex !== null) {
      targetIdx = currentData.indexOf(rowObjOrIndex);
      if (targetIdx < 0) {
        const primaryKey = (TAB_SCHEMAS[activeTab] || [])[0];
        if (primaryKey && rowObjOrIndex[primaryKey]) {
          targetIdx = currentData.findIndex(r => String(r[primaryKey]) === String(rowObjOrIndex[primaryKey]));
        }
      }
    } else if (typeof rowObjOrIndex === 'number') {
      targetIdx = rowObjOrIndex;
    }

    if (targetIdx < 0 || targetIdx >= currentData.length) return;

    const updates = typeof columnKeyOrObject === 'object' && columnKeyOrObject !== null
      ? columnKeyOrObject
      : { [String(columnKeyOrObject)]: newValue };

    let row = { ...currentData[targetIdx], ...updates };

    if ('ItemID' in updates) {
      const itemVal = updates['ItemID'];
      const match = items.find(i => String(i.ItemID).toLowerCase() === String(itemVal).toLowerCase());
      if (match) {
        row.ItemName = match.ItemName || row.ItemName || '';
        if (row.UnitPriceUSD !== undefined) row.UnitPriceUSD = match.UnitPriceUSD || 0;
        if (row.UnitPriceIDR !== undefined) row.UnitPriceIDR = match.UnitPriceIDR || 0;
        if (row.UoM !== undefined) row.UoM = match.UoM || 'Pcs';
      }
    } else if ('ItemName' in updates) {
      const nameVal = updates['ItemName'];
      const match = items.find(i => String(i.ItemName).toLowerCase() === String(nameVal).toLowerCase());
      if (match) {
        if (activeTab !== 'ItemList' && activeTab !== 'Inventory') {
          row.ItemID = match.ItemID || row.ItemID || '';
        }
        if (row.UnitPriceUSD !== undefined) row.UnitPriceUSD = match.UnitPriceUSD || 0;
        if (row.UnitPriceIDR !== undefined) row.UnitPriceIDR = match.UnitPriceIDR || 0;
        if (row.UoM !== undefined) row.UoM = match.UoM || 'Pcs';
      }
    }

    row = processPriceUpdates(updates, row);
    row.UpdatedBy = currentUser ? currentUser.username : 'System';

    currentData[targetIdx] = row;

    const primaryKey = (TAB_SCHEMAS[activeTab] || [])[0];
    const primaryVal = primaryKey && row[primaryKey] ? String(row[primaryKey]).trim() : '';

    if (primaryKey && primaryVal) {
      if ('Attachment' in updates || 'AttachmentName' in updates) {
        const attachVal = updates.Attachment !== undefined ? updates.Attachment : (row.Attachment || '');
        const attachNameVal = updates.AttachmentName !== undefined ? updates.AttachmentName : (row.AttachmentName || '');
        currentData.forEach((r, idx) => {
          if (r[primaryKey] && String(r[primaryKey]).trim().toLowerCase() === primaryVal.toLowerCase()) {
            currentData[idx] = {
              ...currentData[idx],
              Attachment: attachVal,
              AttachmentName: attachNameVal
            };
          }
        });
      } else if (primaryKey in updates) {
        const existingWithAttach = currentData.find(
          r => r[primaryKey] && String(r[primaryKey]).trim().toLowerCase() === primaryVal.toLowerCase() && r.Attachment
        );
        if (existingWithAttach) {
          currentData[targetIdx] = {
            ...currentData[targetIdx],
            Attachment: existingWithAttach.Attachment,
            AttachmentName: existingWithAttach.AttachmentName
          };
        }
      }
    }

    updateDataForTab(activeTab, currentData);
  };

  const promptDeleteRow = (globalRowIndex: number, rowObj?: RecordRow) => {
    if (activeTab === 'Users' && !isYudit) {
      showToast('Akses ditolak: Hanya akun yudit061200 yang dapat mengelola users', 'error');
      return;
    }
    const item = rowObj || filteredData[globalRowIndex] || getRawDataForTab(activeTab)[globalRowIndex];
    setRecordToDelete(item || null);
    setDeleteRowIndex(globalRowIndex);
    setIsBatchDelete(false);
    setIsDeleteModalOpen(true);
  };

  const matchRecord = (a: RecordRow, b: RecordRow, tab: TabName): boolean => {
    if (!a || !b) return false;
    if (a === b) return true;

    // Check primary key for current tab
    const primaryKey = (TAB_SCHEMAS[tab] || [])[0] || 'ItemID';
    const pkA = a[primaryKey];
    const pkB = b[primaryKey];
    if (pkA !== undefined && pkA !== null && String(pkA).trim() !== '' &&
        pkB !== undefined && pkB !== null && String(pkB).trim() !== '') {
      if (String(pkA).trim().toLowerCase() === String(pkB).trim().toLowerCase()) {
        if (['MaterialRequest', 'PurchaseOrder', 'MaterialReceive', 'MaterialIssued'].includes(tab)) {
          const itemA = String(a.ItemID || a.ItemName || '').trim().toLowerCase();
          const itemB = String(b.ItemID || b.ItemName || '').trim().toLowerCase();
          const qtyA = String(a.Qty ?? '');
          const qtyB = String(b.Qty ?? '');
          return itemA === itemB && qtyA === qtyB;
        }
        return true;
      }
    }

    // Check ItemID specifically if present
    if (a.ItemID !== undefined && a.ItemID !== null && String(a.ItemID).trim() !== '' &&
        b.ItemID !== undefined && b.ItemID !== null && String(b.ItemID).trim() !== '') {
      if (String(a.ItemID).trim().toLowerCase() === String(b.ItemID).trim().toLowerCase()) {
        return true;
      }
    }

    // Check _rowIndex
    if (a._rowIndex !== undefined && a._rowIndex !== null &&
        b._rowIndex !== undefined && b._rowIndex !== null) {
      if (Number(a._rowIndex) === Number(b._rowIndex)) {
        return true;
      }
    }

    // Check ItemName
    if (a.ItemName !== undefined && a.ItemName !== null && String(a.ItemName).trim() !== '' &&
        b.ItemName !== undefined && b.ItemName !== null && String(b.ItemName).trim() !== '') {
      if (String(a.ItemName).trim().toLowerCase() === String(b.ItemName).trim().toLowerCase()) {
        return true;
      }
    }

    return false;
  };

  const confirmDeleteSingleRow = () => {
    const targetItem = recordToDelete || (deleteRowIndex !== null ? filteredData[deleteRowIndex] : null);

    if (!targetItem) {
      setIsDeleteModalOpen(false);
      setRecordToDelete(null);
      setDeleteRowIndex(null);
      return;
    }

    const targetTab = (activeTab === 'Inventory') ? 'ItemList' : activeTab;
    const currentList = getRawDataForTab(targetTab);
    const hasExactRef = currentList.includes(targetItem);
    const updatedList = hasExactRef
      ? currentList.filter(item => item !== targetItem)
      : currentList.filter(item => !matchRecord(item, targetItem, targetTab));

    updateDataForTab(targetTab, updatedList);

    const remainingCount = Math.max(0, filteredData.length - 1);
    const newMaxPages = Math.max(1, Math.ceil(remainingCount / rowsPerPage));
    if (currentPage > newMaxPages) {
      setCurrentPage(newMaxPages);
    }

    showToast('Record deleted successfully!');
    setSelectedRowIndices([]);
    setIsDeleteModalOpen(false);
    setRecordToDelete(null);
    setDeleteRowIndex(null);
  };

  const promptBatchDelete = () => {
    if (activeTab === 'Users' && !isYudit) {
      showToast('Akses ditolak: Hanya akun yudit061200 yang dapat mengelola users', 'error');
      return;
    }
    if (activeTab === 'Inventory') return;
    if (selectedRowIndices.length === 0) {
      showToast('Pilih minimal 1 data terlebih dahulu untuk dihapus', 'error');
      return;
    }
    setIsBatchDelete(true);
    setRecordToDelete(null);
    setIsDeleteModalOpen(true);
  };

  const confirmBatchDelete = () => {
    const selectedRecords = selectedRowIndices
      .map(idx => filteredData[idx])
      .filter((r): r is RecordRow => r !== undefined && r !== null);

    if (selectedRecords.length === 0) {
      setSelectedRowIndices([]);
      setIsDeleteModalOpen(false);
      return;
    }

    const targetTab = (activeTab === 'Inventory') ? 'ItemList' : activeTab;
    const currentList = getRawDataForTab(targetTab);
    const selectedSet = new Set(selectedRecords);
    const updatedList = currentList.filter(item =>
      !selectedRecords.some(sel => (currentList.includes(sel) ? item === sel : matchRecord(item, sel, targetTab))) &&
      !selectedSet.has(item)
    );

    updateDataForTab(targetTab, updatedList);

    const remainingCount = Math.max(0, filteredData.length - selectedRecords.length);
    const newMaxPages = Math.max(1, Math.ceil(remainingCount / rowsPerPage));
    if (currentPage > newMaxPages) {
      setCurrentPage(newMaxPages);
    }

    showToast(`${selectedRecords.length} data berhasil dihapus sekaligus!`);
    setSelectedRowIndices([]);
    setIsDeleteModalOpen(false);
  };

  const handleExportCSV = () => {
    const data = getRawDataForTab(activeTab);
    const cols = getDisplayColumns();
    if (data.length === 0) {
      showToast('No data to export', 'error');
      return;
    }
    const header = cols.join(',');
    const rows = data.map(row => cols.map(c => `"${String(row[c] || '').replace(/"/g, '""')}"`).join(','));
    const csvContent = "data:text/csv;charset=utf-8," + [header, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${activeTab}_Sheet.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Sheet data exported to CSV successfully!');
  };

  const handleSingleFieldChange = (fieldOrObj: string | Record<string, any>, val?: any) => {
    setEditingRecord(prev => {
      if (!prev) return prev;
      const updates = typeof fieldOrObj === 'object' && fieldOrObj !== null ? fieldOrObj : { [String(fieldOrObj)]: val };
      let updated = { ...prev, ...updates };

      if ('ItemID' in updates) {
        const itemVal = updates['ItemID'];
        const match = items.find(i => String(i.ItemID).toLowerCase() === String(itemVal).toLowerCase());
        if (match) {
          updated.ItemName = match.ItemName || '';
          if (updated.UnitPriceUSD !== undefined) updated.UnitPriceUSD = match.UnitPriceUSD || 0;
          if (updated.UnitPriceIDR !== undefined) updated.UnitPriceIDR = match.UnitPriceIDR || 0;
          if (updated.UoM !== undefined) updated.UoM = match.UoM || 'Pcs';
        }
      } else if ('ItemName' in updates) {
        const nameVal = updates['ItemName'];
        const match = items.find(i => String(i.ItemName).toLowerCase() === String(nameVal).toLowerCase());
        if (match) {
          if (activeTab !== 'ItemList' && activeTab !== 'Inventory') {
            updated.ItemID = match.ItemID || '';
          }
          if (updated.UnitPriceUSD !== undefined) updated.UnitPriceUSD = match.UnitPriceUSD || 0;
          if (updated.UnitPriceIDR !== undefined) updated.UnitPriceIDR = match.UnitPriceIDR || 0;
          if (updated.UoM !== undefined) updated.UoM = match.UoM || 'Pcs';
        }
      }

      updated = processPriceUpdates(updates, updated);

      return updated;
    });
  };

  const handleSaveSingleRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    if (activeTab === 'Users' && !isYudit) {
      showToast('Akses ditolak: Hanya akun yudit061200 yang dapat mengelola users', 'error');
      return;
    }

    const currentData = [...getRawDataForTab(activeTab)];
    const primaryKey = (TAB_SCHEMAS[activeTab] || [])[0] || 'ID';
    const recordToSave = { ...editingRecord };
    const isCreatingNew = editingOriginalRecord === null && editingRowIndex === null;

    if (!recordToSave[primaryKey] || String(recordToSave[primaryKey]).trim() === '') {
      showToast(`Mohon isi ${primaryKey} terlebih dahulu!`, 'error');
      return;
    }

    recordToSave['UpdatedBy'] = currentUser ? currentUser.username : 'System';

    const primaryVal = recordToSave[primaryKey];
    let targetIdx = -1;

    if (!isCreatingNew) {
      // EDIT MODE: Update existing record
      if (editingOriginalRecord) {
        targetIdx = currentData.indexOf(editingOriginalRecord);
      }
      if (targetIdx < 0 && editingOriginalPrimaryKey) {
        targetIdx = currentData.findIndex(r =>
          r[primaryKey] && String(r[primaryKey]).trim().toLowerCase() === String(editingOriginalPrimaryKey).trim().toLowerCase()
        );
      }
      if (targetIdx < 0 && primaryVal) {
        targetIdx = currentData.findIndex(r =>
          r[primaryKey] && String(r[primaryKey]).trim().toLowerCase() === String(primaryVal).trim().toLowerCase()
        );
      }
      if (targetIdx < 0 && editingRowIndex !== null && editingRowIndex >= 0 && editingRowIndex < currentData.length) {
        targetIdx = editingRowIndex;
      }
    }

    if (targetIdx >= 0) {
      currentData[targetIdx] = recordToSave;
    } else {
      currentData.unshift(recordToSave);
    }

    if (primaryKey && recordToSave[primaryKey]) {
      const attachVal = recordToSave.Attachment || '';
      const attachNameVal = recordToSave.AttachmentName || '';
      if (attachVal) {
        const pkValStr = String(recordToSave[primaryKey]).trim().toLowerCase();
        currentData.forEach((r, idx) => {
          if (r[primaryKey] && String(r[primaryKey]).trim().toLowerCase() === pkValStr) {
            currentData[idx] = {
              ...currentData[idx],
              Attachment: attachVal,
              AttachmentName: attachNameVal
            };
          }
        });
      }
    }

    updateDataForTab(activeTab, currentData);
    setIsSingleModalOpen(false);
    setEditingOriginalRecord(null);
    setEditingOriginalPrimaryKey('');
    setEditingRecord(null);
    setEditingRowIndex(null);
    showToast(isCreatingNew ? 'Data baru berhasil ditambahkan!' : 'Data berhasil diperbarui!');
  };

  const openMultiModal = () => {
    if (activeTab === 'Users' && !isYudit) {
      showToast('Akses ditolak: Hanya akun yudit061200 yang dapat mengelola users', 'error');
      return;
    }
    const schema = TAB_SCHEMAS[activeTab] || [];
    const newRow: RecordRow = {};
    schema.forEach(col => {
      if (col === 'Date') newRow[col] = new Date().toISOString().split('T')[0];
      else if (col === 'Priority') newRow[col] = 'Normal';
      else if (col === 'UpdatedBy') newRow[col] = currentUser ? currentUser.username : 'System';
      else newRow[col] = '';
    });
    setMultiRows([newRow]);
    setIsMultiModalOpen(true);
  };

  const addMultiRow = () => {
    const schema = TAB_SCHEMAS[activeTab] || [];
    const newRow: RecordRow = {};
    schema.forEach(col => {
      if (col === 'Date') newRow[col] = new Date().toISOString().split('T')[0];
      else if (col === 'Priority') newRow[col] = 'Normal';
      else if (col === 'UpdatedBy') newRow[col] = currentUser ? currentUser.username : 'System';
      else newRow[col] = '';
    });
    setMultiRows(prev => [...prev, newRow]);
  };

  const handleMultiRowChange = (index: number, fieldOrObj: string | Record<string, any>, val?: any) => {
    setMultiRows(prev => {
      const copy = [...prev];
      const updates = typeof fieldOrObj === 'object' && fieldOrObj !== null ? fieldOrObj : { [String(fieldOrObj)]: val };
      let row = { ...copy[index], ...updates };

      if ('ItemID' in updates) {
        const itemVal = updates['ItemID'];
        const match = items.find(i => String(i.ItemID).toLowerCase() === String(itemVal).toLowerCase());
        if (match) {
          row.ItemName = match.ItemName || '';
          if (row.UnitPriceUSD !== undefined) row.UnitPriceUSD = match.UnitPriceUSD || 0;
          if (row.UnitPriceIDR !== undefined) row.UnitPriceIDR = match.UnitPriceIDR || 0;
          if (row.UoM !== undefined) row.UoM = match.UoM || 'Pcs';
        }
      }

      row = processPriceUpdates(updates, row);

      copy[index] = row;

      const primaryKey = (TAB_SCHEMAS[activeTab] || [])[0];
      const primaryVal = primaryKey && row[primaryKey] ? String(row[primaryKey]).trim() : '';

      if (primaryKey && primaryVal) {
        if ('Attachment' in updates || 'AttachmentName' in updates) {
          const attachVal = updates.Attachment !== undefined ? updates.Attachment : (row.Attachment || '');
          const attachNameVal = updates.AttachmentName !== undefined ? updates.AttachmentName : (row.AttachmentName || '');
          copy.forEach((r, idx) => {
            if (r[primaryKey] && String(r[primaryKey]).trim().toLowerCase() === primaryVal.toLowerCase()) {
              copy[idx] = {
                ...copy[idx],
                Attachment: attachVal,
                AttachmentName: attachNameVal
              };
            }
          });
        }
      }

      return copy;
    });
  };

  const saveMultiRecords = () => {
    if (activeTab === 'Users' && !isYudit) {
      showToast('Akses ditolak: Hanya akun yudit061200 yang dapat mengelola users', 'error');
      return;
    }
    const primaryKey = (TAB_SCHEMAS[activeTab] || [])[0] || 'ID';
    const validRows = multiRows.filter(r => r[primaryKey] || r.ItemName || r.ItemID || r.Username);
    if (validRows.length === 0) {
      showToast('Mohon masukkan minimal 1 baris data yang valid', 'error');
      return;
    }

    const missingPk = validRows.find(r => !r[primaryKey] || String(r[primaryKey]).trim() === '');
    if (missingPk) {
      showToast(`Mohon lengkapi ${primaryKey} pada setiap baris!`, 'error');
      return;
    }

    const currentData = [...getRawDataForTab(activeTab)];

    const processedRows = validRows.map((r) => {
      const copy = { ...r };
      copy['UpdatedBy'] = currentUser ? currentUser.username : 'System';
      return copy;
    });

    const combined = [...processedRows, ...currentData];
    const syncedCombined = syncAttachmentsForTab(activeTab, combined);
    updateDataForTab(activeTab, syncedCombined);
    setIsMultiModalOpen(false);
    showToast(`${processedRows.length} data baru berhasil disimpan!`);
  };

  const handleQrScanSuccess = (
    scannedItem: RecordRow,
    qty: number,
    deptOrSupplier: string,
    remark: string,
    attachment: string,
    attachmentName: string
  ) => {
    setIsQrScannerInputOpen(false);

    const priceInfo = processPriceUpdates({}, {
      UnitPriceUSD: scannedItem.UnitPriceUSD || 0,
      UnitPriceIDR: scannedItem.UnitPriceIDR || 0,
      Qty: qty
    });

    // If modal was open
    if (isSingleModalOpen && editingRecord) {
      setEditingRecord(prev => {
        if (!prev) return null;
        const updated: RecordRow = {
          ...prev,
          ItemID: scannedItem.ItemID,
          ItemName: scannedItem.ItemName,
          Qty: qty,
          UoM: scannedItem.UoM || 'Pcs',
          UnitPriceUSD: priceInfo.UnitPriceUSD,
          UnitPriceIDR: priceInfo.UnitPriceIDR,
          TotalPriceUSD: priceInfo.TotalPriceUSD,
          TotalPriceIDR: priceInfo.TotalPriceIDR,
        };
        if (activeTab === 'MaterialReceive') updated.Supplier = deptOrSupplier;
        if (activeTab === 'MaterialIssued') updated.Department = deptOrSupplier;
        if (remark) updated.Remark = remark;
        if (attachment) {
          updated.Attachment = attachment;
          updated.AttachmentName = attachmentName;
        }
        return updated;
      });
      showToast(`Item ${scannedItem.ItemID} filled into form!`);
      return;
    }

    if (isMultiModalOpen) {
      if (qrScanTargetRowIndex !== null && qrScanTargetRowIndex >= 0) {
        setMultiRows(prev => {
          const copy = [...prev];
          const r = { ...copy[qrScanTargetRowIndex] };
          r.ItemID = scannedItem.ItemID;
          r.ItemName = scannedItem.ItemName;
          r.Qty = qty;
          r.UoM = scannedItem.UoM || 'Pcs';
          r.UnitPriceUSD = priceInfo.UnitPriceUSD;
          r.UnitPriceIDR = priceInfo.UnitPriceIDR;
          r.TotalPriceUSD = priceInfo.TotalPriceUSD;
          r.TotalPriceIDR = priceInfo.TotalPriceIDR;
          if (activeTab === 'MaterialReceive') r.Supplier = deptOrSupplier;
          if (activeTab === 'MaterialIssued') r.Department = deptOrSupplier;
          if (remark) r.Remark = remark;
          if (attachment) {
            r.Attachment = attachment;
            r.AttachmentName = attachmentName;
          }
          copy[qrScanTargetRowIndex] = r;
          return copy;
        });
        showToast(`Item ${scannedItem.ItemID} inserted into row #${qrScanTargetRowIndex + 1}!`);
      } else {
        const schema = TAB_SCHEMAS[activeTab] || [];
        const newRow: RecordRow = {};
        schema.forEach(col => {
          if (col === 'Date') newRow[col] = new Date().toISOString().split('T')[0];
          else if (col === 'Priority') newRow[col] = 'Normal';
          else newRow[col] = '';
        });
        newRow.ItemID = scannedItem.ItemID;
        newRow.ItemName = scannedItem.ItemName;
        newRow.Qty = qty;
        newRow.UoM = scannedItem.UoM || 'Pcs';
        newRow.UnitPriceUSD = priceInfo.UnitPriceUSD;
        newRow.UnitPriceIDR = priceInfo.UnitPriceIDR;
        newRow.TotalPriceUSD = priceInfo.TotalPriceUSD;
        newRow.TotalPriceIDR = priceInfo.TotalPriceIDR;
        if (activeTab === 'MaterialReceive') newRow.Supplier = deptOrSupplier;
        if (activeTab === 'MaterialIssued') newRow.Department = deptOrSupplier;
        if (remark) newRow.Remark = remark;
        if (attachment) {
          newRow.Attachment = attachment;
          newRow.AttachmentName = attachmentName;
        }
        setMultiRows(prev => [...prev, newRow]);
        showToast(`Item ${scannedItem.ItemID} added to multi-input table!`);
      }
      return;
    }

    // Direct input from main tab view
    const dateStr = new Date().toISOString().split('T')[0];
    let newDocId = '';
    if (activeTab === 'MaterialReceive') {
      newDocId = `RCV-${Math.floor(100 + Math.random() * 900)}`;
    } else {
      newDocId = `ISS-${Math.floor(100 + Math.random() * 900)}`;
    }

    const newRecord: RecordRow = {
      Date: dateStr,
      ItemID: scannedItem.ItemID,
      ItemName: scannedItem.ItemName,
      Qty: qty,
      UoM: scannedItem.UoM || 'Pcs',
      UnitPriceUSD: priceInfo.UnitPriceUSD,
      UnitPriceIDR: priceInfo.UnitPriceIDR,
      TotalPriceUSD: priceInfo.TotalPriceUSD,
      TotalPriceIDR: priceInfo.TotalPriceIDR,
      Remark: remark || 'Input via QR Code Scanner',
      Attachment: attachment || '',
      AttachmentName: attachmentName || ''
    };

    if (activeTab === 'MaterialReceive') {
      newRecord.ReceiveID = newDocId;
      newRecord.Supplier = deptOrSupplier || 'Baker Hughes Indonesia';
    } else {
      newRecord.IssueID = newDocId;
      newRecord.Department = deptOrSupplier || 'Drilling Operations';
    }

    const currentData = [...getRawDataForTab(activeTab)];
    const syncedData = syncAttachmentsForTab(activeTab, [newRecord, ...currentData]);
    updateDataForTab(activeTab, syncedData);
    showToast(`${activeTab === 'MaterialReceive' ? 'Receive' : 'Issued'} entry (${newDocId}) saved successfully!`);
  };

  const openPrintModal = (id?: string) => {
    const schema = TAB_SCHEMAS[activeTab] || [];
    const primaryKey = schema[0];
    const raw = getRawDataForTab(activeTab);
    const targetId = id || (raw.length > 0 ? String(raw[0][primaryKey] || 'DOC-001') : 'DOC-001');

    setPrintDocId(targetId);
    const matched = raw.filter(r => String(r[primaryKey]) === String(targetId));

    if (matched.length > 0) {
      const main = matched[0];
      const docTypeTitle = activeTab === 'PurchaseOrder'
        ? 'PURCHASE ORDER'
        : activeTab === 'MaterialReceive'
        ? 'MATERIAL RECEIVE REPORT'
        : activeTab === 'MaterialIssued'
        ? 'MATERIAL ISSUED SLIP'
        : activeTab === 'ItemList'
        ? 'MATERIAL SPECIFICATION & REQUISITION'
        : 'MATERIAL REQUEST';

      const existingHeader = savedDocHeaders[targetId];

      const initialHeader = existingHeader ? {
        ...existingHeader,
        DocTitle: activeTab === 'MaterialReceive' ? 'MATERIAL RECEIVE REPORT' : existingHeader.DocTitle,
        DocNoLabel: activeTab === 'MaterialReceive' && (!existingHeader.DocNoLabel || existingHeader.DocNoLabel === 'Doc No.') ? 'RCV No.' : existingHeader.DocNoLabel,
        ApprovedBy: (activeTab === 'MaterialRequest' && (existingHeader.ApprovedBy === 'Ashley Moggy' || !existingHeader.ApprovedBy))
          ? 'General Manager'
          : (existingHeader.ApprovedBy || (activeTab === 'MaterialReceive' ? 'Ashley Moggy' : 'General Manager'))
      } : {
        DocTitle: docTypeTitle,
        RequestID: targetId,
        DocNoLabel: activeTab === 'PurchaseOrder' ? 'PO No.' : activeTab === 'MaterialReceive' ? 'RCV No.' : activeTab === 'MaterialIssued' ? 'ISS No.' : activeTab === 'ItemList' ? 'Item Code' : 'MRQ No.',
        Date: main.Date ? String(main.Date).split('T')[0] : new Date().toISOString().split('T')[0],
        WellLoc: main.WellLoc || main.Location || 'YARD - PAMANUKAN',
        RigName: main.RigName || 'RIG SCD#20',
        Department: main.Department || 'DRILLING',
        Client: main.Client || 'PT. Pertamina EP',
        Project: main.Project || '',
        Priority: main.Priority || 'Normal',
        PurchaseBy: main.PurchaseBy || main.Supplier || 'Client / Company',
        Remark: main.Remark || 'Rig Site Operations',
        UserBy: main.UserBy || main.Department || 'WAREHOUSE RIG SCD #20',
        RecvdPostedBy: main.RecvdPostedBy || 'WAREHOUSE RIG SCD #20',
        Supplier: main.Supplier || main.VendorName || '',
        MrqRef: main.MrqRef || main.MRQNo || '',
        PoNo: main.PoNo || main.PONO || '',
        MainGroup: main.MainGroup || '',
        PreparedBy: main.PreparedBy || 'Material Man',
        ReceivedByName: main.ReceivedByName || main.UserBy || 'Yuditira',
        ReceivedByTitle: main.ReceivedByTitle || 'MATERIAL MAN',
        ApprovedByName: main.ApprovedByName || main.ApprovedBy || (activeTab === 'MaterialReceive' ? 'Ashley Moggy' : 'General Manager'),
        ApprovedByTitle: main.ApprovedByTitle || (activeTab === 'MaterialReceive' ? 'RIG MANAGER' : 'GENERAL MANAGER'),
        AcknowledgedBy: main.AcknowledgedBy || 'Rig Manager',
        ApprovedBy: main.ApprovedBy || (activeTab === 'MaterialReceive' ? 'Ashley Moggy' : 'General Manager'),
        // Purchase Order defaults matching standard document
        Quotation: main.Quotation || 'Penawaran Harga',
        VendorName: main.VendorName || main.Supplier || '',
        VendorAddress: main.VendorAddress || '',
        VendorCity: main.VendorCity || '',
        VendorContact: main.VendorContact || '',
        VendorPhone: main.VendorPhone || '',
        VendorEmail: main.VendorEmail || '',
        ShipToName: main.ShipToName || main.PlaceOfDelivery || '',
        ShipToAddress: main.ShipToAddress || '',
        ShipToContact: main.ShipToContact || '',
        ShipToPhone: main.ShipToPhone || '',
        ShipToEmail: main.ShipToEmail || '',
        Requisitioner: main.Requisitioner || '',
        ShipVia: main.ShipVia || '',
        Fob: main.Fob || '',
        ShippingTerms: main.ShippingTerms || ''
      };

      setPrintDocHeader(initialHeader);

      const docRows: RecordRow[] = matched.map(r => {
        const itemCode = r.ItemID || targetId;
        const matchedItem = items.find(i => String(i.ItemID || '').trim().toLowerCase() === String(itemCode || '').trim().toLowerCase());
        const uom = r.UoM || (matchedItem ? matchedItem.UoM : 'ea');
        const qty = (r.Qty !== undefined && r.Qty !== '') ? r.Qty : 1;
        const unitPrice = r.UnitPriceIDR || (matchedItem ? matchedItem.UnitPriceIDR : 0);
        const totalPrice = r.TotalPriceIDR || (Number(qty) * Number(unitPrice)) || 0;

        return {
          Qty: qty,
          ItemID: itemCode,
          ItemName: r.ItemName || (matchedItem ? matchedItem.ItemName : r.Remark || 'Material Equipment'),
          UoM: uom,
          UnitPriceIDR: unitPrice,
          TotalPriceIDR: totalPrice,
          Stock: r.Stock !== undefined ? parseNumberValue(r.Stock) : (r.CurrentStock !== undefined ? parseNumberValue(r.CurrentStock) : ''),
          Department: r.Department || main.Department || '',
          Date: r.Date || initialHeader.Date || '',
          Attachment: r.Attachment,
          AttachmentName: r.AttachmentName,
          IsHistoricalImport: r.IsHistoricalImport
        };
      });

      docRows.forEach((row, idx) => {
        const itemCode = row.ItemID;
        const matchedItem = items.find(i => String(i.ItemID || '').trim().toLowerCase() === String(itemCode || '').trim().toLowerCase());
        if (matchedItem) {
          if (activeTab === 'MaterialIssued') {
            if (!(row.IsHistoricalImport && row.Stock !== '' && row.Stock !== undefined)) {
              row.Stock = calculateIssuedStockOnHand({
                itemCode,
                targetDate: row.Date || initialHeader.Date,
                targetDocId: targetId,
                currentRowQty: row.Qty,
                rowIndexInDoc: idx,
                docItems: docRows,
                items,
                receives,
                issued,
              });
            }
          } else {
            const normCode = String(itemCode || '').trim().toLowerCase();
            const stockIn = parseNumberValue(matchedItem.BaseStockIn) + receives.filter(rcv => !rcv.IsHistoricalImport && String(rcv.ItemID || '').trim().toLowerCase() === normCode).reduce((acc, curr) => acc + parseNumberValue(curr.Qty), 0);
            const stockOut = parseNumberValue(matchedItem.BaseStockOut) + issued.filter(iss => !iss.IsHistoricalImport && String(iss.ItemID || '').trim().toLowerCase() === normCode).reduce((acc, curr) => acc + parseNumberValue(curr.Qty), 0);
            const lastStock = parseNumberValue(matchedItem.LastStock ?? matchedItem.CurrentStock ?? matchedItem.Stock);
            row.Stock = lastStock + stockIn - stockOut;
          }
        }
      });

      for (let i = matched.length; i < 8; i++) {
        docRows.push({ Qty: '', ItemID: '', ItemName: '', UoM: '', UnitPriceIDR: '', TotalPriceIDR: '', Stock: '' });
      }
      setPrintDocItems(docRows);
    } else {
      setPrintDocHeader({
        DocTitle: 'FORM MATERIAL DOCUMENT',
        RequestID: targetId,
        DocNoLabel: 'Doc No.',
        Date: new Date().toISOString().split('T')[0],
        WellLoc: 'Well - 05',
        RigName: 'Rig Silver City 20',
        Department: 'Mechanic',
        Client: 'PT. Pertamina EP',
        Project: 'Offshore & Onshore',
        Priority: 'Normal',
        PurchaseBy: 'Client / Company',
        Remark: 'Rig Site Operations',
        UserBy: 'Mechanic',
        PreparedBy: 'Material Man',
        AcknowledgedBy: 'Rig Manager',
        ApprovedBy: 'General Manager'
      });
      const docRows: RecordRow[] = [];
      for (let i = 0; i < 8; i++) {
        docRows.push({ Qty: '', ItemID: '', ItemName: '', UoM: '' });
      }
      setPrintDocItems(docRows);
    }
    setIsHeaderEditMode(true);
    setIsPrintModalOpen(true);
  };

  const handleSaveDocForm = () => {
    if (!printDocId) return;

    const updatedDocHeaders = {
      ...savedDocHeaders,
      [printDocId]: printDocHeader
    };
    setSavedDocHeaders(updatedDocHeaders);
    pushSyncToServer({ savedDocHeaders: updatedDocHeaders, companyHeader });

    const primaryKey = (TAB_SCHEMAS[activeTab] || [])[0];
    const currentData = getRawDataForTab(activeTab);
    const validDocItems = printDocItems.filter(i => i.ItemID || i.ItemName || (i.Qty !== undefined && i.Qty !== ''));

    if (validDocItems.length > 0 && primaryKey) {
      const existingIdx = currentData.findIndex(r => String(r[primaryKey]) === String(printDocId));
      const otherRecords = currentData.filter(r => String(r[primaryKey]) !== String(printDocId));
      const firstMatched = existingIdx >= 0 ? currentData[existingIdx] : undefined;

      const updatedDocRecords = validDocItems.map(item => ({
        ...(firstMatched || {}),
        ...item,
        [primaryKey]: printDocId,
        Date: printDocHeader.Date || firstMatched?.Date || new Date().toISOString().split('T')[0],
        Department: item.Department || printDocHeader.Department || firstMatched?.Department || 'Mechanic',
        WellLoc: printDocHeader.WellLoc || firstMatched?.WellLoc || '',
        RigName: printDocHeader.RigName || firstMatched?.RigName || '',
        Priority: printDocHeader.Priority || firstMatched?.Priority || 'Normal',
        Remark: item.Remark || printDocHeader.Remark || firstMatched?.Remark || ''
      }));

      if (existingIdx >= 0) {
        const insertAt = Math.min(existingIdx, otherRecords.length);
        const nextData = [
          ...otherRecords.slice(0, insertAt),
          ...updatedDocRecords,
          ...otherRecords.slice(insertAt)
        ];
        updateDataForTab(activeTab, nextData);
      } else {
        updateDataForTab(activeTab, [...updatedDocRecords, ...otherRecords]);
      }
    } else {
      const updatedData = currentData.map(r => {
        if (String(r[primaryKey]) === String(printDocId)) {
          return {
            ...r,
            Date: printDocHeader.Date || r.Date,
            Department: printDocHeader.Department || r.Department,
            Priority: printDocHeader.Priority || r.Priority,
            Remark: printDocHeader.Remark || r.Remark
          };
        }
        return r;
      });
      updateDataForTab(activeTab, updatedData);
    }

    showToast('Form Header & Document saved successfully!');
  };

  const handleSaveColHeaders = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = {
      ...customColHeaders,
      ...editingColHeaders
    };
    setCustomColHeaders(updated);
    pushSyncToServer({ customColHeaders: updated });
    setIsColHeaderModalOpen(false);
    showToast('Column headers updated successfully!');
  };

  const openItemDetails = (itemId: string) => {
    const invMatch = getRawDataForTab('Inventory').find(i => String(i.ItemID).toLowerCase() === String(itemId).toLowerCase());
    const match = invMatch || items.find(i => String(i.ItemID).toLowerCase() === String(itemId).toLowerCase());
    if (match) {
      setViewingItem({ ...match });
      setEditingOriginalItemId(String(match.ItemID));
      setIsEditingInDetails(false);
      setIsItemDetailsModalOpen(true);
    } else {
      showToast('Item details not found', 'error');
    }
  };

  const handleSaveItemDetailsInline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingItem) return;
    const { StockIn: _si, StockOut: _so, CurrentStock: _cs, TotalPriceUSD: _tu, TotalPriceIDR: _ti, Status: _st, ...cleanItem } = viewingItem;
    cleanItem.UpdatedBy = currentUser ? currentUser.username : 'System';
    const orig = editingOriginalItemId || cleanItem.ItemID;
    const currentItems = [...items];
    const existingIdx = currentItems.findIndex(i => String(i.ItemID).toLowerCase() === String(orig).toLowerCase());

    let updatedItems: RecordRow[];
    if (existingIdx >= 0) {
      currentItems[existingIdx] = cleanItem;
      updatedItems = currentItems;
    } else {
      updatedItems = [cleanItem, ...currentItems];
    }

    updateDataForTab('ItemList', updatedItems);
    const updatedCurrentStock = parseNumberValue(cleanItem.LastStock) + parseNumberValue(viewingItem.StockIn) - parseNumberValue(viewingItem.StockOut);
    setViewingItem({ ...viewingItem, ...cleanItem, CurrentStock: updatedCurrentStock });
    setIsEditingInDetails(false);
    showToast('Item updated successfully!');
  };

  const openQrModal = (item: RecordRow) => {
    setQrItem(item);
    setQrCopies(6);
    setIsQrModalOpen(true);
  };

  const openSpreadsheetModal = () => {
    setIsSpreadsheetModalOpen(true);
  };

  const handlePullSync = async (customUrl?: string) => {
    try {
      if (customUrl) {
        const resp = await fetch(customUrl);
        if (resp.ok) {
          const csvText = await resp.text();
          const lines = csvText.split('\n').filter(l => l.trim().length > 0);
          if (lines.length > 1) {
            const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
            const parsedRecords: RecordRow[] = lines.slice(1).map((line, rIdx) => {
              const cells = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
              const rowObj: RecordRow = { _rowIndex: rIdx + 2 };
              headers.forEach((h, cIdx) => {
                rowObj[h] = cells[cIdx] || '';
              });
              return rowObj;
            });
            if (parsedRecords.length > 0) {
              const itemMap = new Map<string, RecordRow>();
              latestStoreRef.current.items.forEach(p => {
                if (p.ItemID) itemMap.set(String(p.ItemID).toLowerCase(), p);
              });
              parsedRecords.forEach(rec => {
                const key = rec.ItemID ? String(rec.ItemID).toLowerCase() : null;
                if (key) {
                  itemMap.set(key, { ...(itemMap.get(key) || {}), ...rec });
                } else {
                  itemMap.set(`_custom_${Math.random()}`, rec);
                }
              });
              const updatedItems = Array.from(itemMap.values());
              setItems(updatedItems);
              latestStoreRef.current.items = updatedItems;
              await pushSyncToServer({ items: updatedItems });
              showToast(`Google Sheets CSV synchronized (${parsedRecords.length} records updated)!`);
              return;
            }
          }
        }
      }

      // 1. Direct fetch from Firebase Firestore
      const firestoreStore = await fetchFullStoreFromFirestore();
      if (firestoreStore) {
        if (Array.isArray(firestoreStore.items)) setItems(firestoreStore.items);
        if (Array.isArray(firestoreStore.requests)) setRequests(firestoreStore.requests);
        if (Array.isArray(firestoreStore.pos)) setPurchaseOrders(firestoreStore.pos);
        if (Array.isArray(firestoreStore.receives)) setReceives(firestoreStore.receives);
        if (Array.isArray(firestoreStore.issued)) setIssued(firestoreStore.issued);
        if (Array.isArray(firestoreStore.users)) setUsers(firestoreStore.users);
        if (firestoreStore.companyHeader) setCompanyHeader(firestoreStore.companyHeader);
        if (firestoreStore.savedDocHeaders) setSavedDocHeaders(firestoreStore.savedDocHeaders);
        if (firestoreStore.customColHeaders) setCustomColHeaders(firestoreStore.customColHeaders);
        setIsFirebaseConnected(true);
        showToast('Data refreshed directly from Firebase Firestore!');
        return;
      }
      showToast('Firebase Firestore data is already up to date.');
    } catch {
      showToast('Failed to sync with Firebase Firestore.', 'error');
    }
  };

  const handlePushSync = async () => {
    try {
      await pushSyncToServer();
      showToast('ERP data synchronized across all devices successfully!');
    } catch {
      showToast('Offline sync using local cache', 'error');
    }
  };

  const handleExportAllSheetsCSV = () => {
    handleExportCSV();
  };

  const inventoryItems = getRawDataForTab('Inventory');
  const itemsNeedingOrder = inventoryItems.filter(item => {
    const cur = parseNumberValue(item.CurrentStock);
    const min = parseNumberValue(item.MinStock);
    return cur <= min;
  });

  const handleCreateSingleRequestFromReorder = (item: RecordRow) => {
    setIsReorderModalOpen(false);
    setActiveTab('MaterialRequest');
    const cur = parseNumberValue(item.CurrentStock);
    const min = parseNumberValue(item.MinStock);
    const deficit = Math.max(1, min - cur);

    const schema = TAB_SCHEMAS['MaterialRequest'] || [];
    const newObj: RecordRow = {};
    schema.forEach(col => {
      if (col === 'Date') newObj[col] = new Date().toISOString().split('T')[0];
      else if (col === 'Status') newObj[col] = 'Pending';
      else if (col === 'Priority') newObj[col] = 'Urgent';
      else if (col === 'ItemID') newObj[col] = item.ItemID || '';
      else if (col === 'ItemName') newObj[col] = item.ItemName || '';
      else if (col === 'Qty') newObj[col] = deficit;
      else if (col === 'UoM') newObj[col] = item.UoM || 'Pcs';
      else if (col === 'Remark') newObj[col] = 'Auto-reorder requirement (Stok <= Min Stock)';
      else if (col === 'Department') newObj[col] = 'Purchasing';
      else newObj[col] = '';
    });

    setEditingRecord(newObj);
    setEditingRowIndex(null);
    setIsSingleModalOpen(true);
    showToast(`Material Request form prepared for ${item.ItemName}`);
  };

  const handleCreateBatchRequestFromReorder = (orderItems: RecordRow[]) => {
    setIsReorderModalOpen(false);
    setActiveTab('MaterialRequest');
    const today = new Date().toISOString().split('T')[0];

    const rows = orderItems.map(item => {
      const cur = Number(item.CurrentStock) || 0;
      const min = Number(item.MinStock) || 0;
      const deficit = Math.max(1, min - cur);

      return {
        Date: today,
        Department: 'Purchasing',
        Priority: 'Urgent',
        Status: 'Pending',
        ItemID: item.ItemID || '',
        ItemName: item.ItemName || '',
        Qty: deficit,
        UoM: item.UoM || 'Pcs',
        Remark: 'Auto-reorder (Batch Need Order)'
      };
    });

    setMultiRows(rows.length > 0 ? rows : [{ Date: today, Department: 'Purchasing', Priority: 'Normal' }]);
    setIsMultiModalOpen(true);
    showToast(`${orderItems.length} items prepared in Multi-Record Material Request!`);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-100 antialiased selection:bg-yellow-400 selection:text-slate-900 transition-colors">
      
      {/* Toast Floating Notifications */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`px-4 py-3 rounded-2xl shadow-xl text-xs font-bold flex items-center space-x-2.5 pointer-events-auto transition-all duration-300 transform translate-y-0 opacity-100 ${
              t.type === 'success' ? 'bg-slate-900 text-white border border-slate-800' : 'bg-rose-600 text-white'
            }`}
          >
            <i className={`fa-solid ${t.type === 'success' ? 'fa-circle-check text-emerald-400' : 'fa-circle-exclamation'} text-sm`}></i>
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* LOGIN OVERLAY SCREEN */}
      {!currentUser && (
        <LoginModal
          users={users}
          onLoginSuccess={handleLoginSuccess}
          onSignUpUser={handleSignUpUser}
          showToast={showToast}
        />
      )}

      {/* MAIN APPLICATION CONTAINER */}
      {currentUser && (
        <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors">
          
          <Header
            activeTab={activeTab}
            setActiveTab={(tab) => {
              setActiveTab(tab);
              setSearchTerm('');
              setFilterColumn('all');
              setCurrentPage(1);
            }}
            currentUser={currentUser}
            onLogout={handleLogout}
            onSyncSheets={openSpreadsheetModal}
            itemsCount={items.length}
            itemsNeedingOrderCount={itemsNeedingOrder.length}
            onOpenReorderModal={() => setIsReorderModalOpen(true)}
            isDarkMode={isDarkMode}
            onToggleDarkMode={toggleDarkMode}
            isFirebaseConnected={isFirebaseConnected}
            isSavingToFirestore={isSavingToFirestore}
          />

          <div className="flex-grow flex flex-col min-w-0">
            <main className="container mx-auto px-3 sm:px-6 py-4 sm:py-8 flex-grow max-w-7xl">
              
              {activeTab === 'Dashboard' && (
                <DashboardView
                  items={items}
                  requests={requests}
                  purchaseOrders={purchaseOrders}
                  receives={receives}
                  issued={issued}
                  inventoryItems={inventoryItems}
                  setActiveTab={setActiveTab}
                  onOpenReorderModal={() => setIsReorderModalOpen(true)}
                />
              )}

              {activeTab !== 'Dashboard' && (
                <div className="space-y-4 sm:space-y-5">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl shadow-xs border border-slate-100 dark:border-slate-800 transition-colors">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        {activeTab.replace(/([A-Z])/g, ' $1').trim()}
                      </h2>

                      {['ItemList', 'Inventory', 'MaterialRequest', 'PurchaseOrder', 'MaterialReceive', 'MaterialIssued'].includes(activeTab) && (
                        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-semibold">
                          <button
                            onClick={() => setCurrentViewMode('report')}
                            className={`px-2.5 sm:px-3 py-1.5 rounded-xl transition cursor-pointer text-xs ${
                              currentViewMode === 'report' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            Report View
                          </button>
                          <button
                            onClick={() => setCurrentViewMode('list')}
                            className={`px-2.5 sm:px-3 py-1.5 rounded-xl transition cursor-pointer text-xs ${
                              currentViewMode === 'list' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            List View
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full md:w-auto">
                      <select
                        value={filterColumn}
                        onChange={(e) => { setFilterColumn(e.target.value); setCurrentPage(1); }}
                        className="w-full sm:w-auto border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 sm:px-3.5 sm:py-2.5 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-slate-400 shadow-xs cursor-pointer"
                      >
                        <option value="all">All Columns</option>
                        {getDisplayColumns().map(col => (
                          <option key={col} value={col}>{customColHeaders[col] || col}</option>
                        ))}
                      </select>

                      <div className="relative w-full sm:w-auto flex-grow md:flex-grow-0">
                        <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs"></i>
                        <input
                          type="text"
                          value={searchTerm}
                          onFocus={() => setIsSearchDropdownOpen(true)}
                          onBlur={() => setIsSearchDropdownOpen(false)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setIsSearchDropdownOpen(false);
                          }}
                          onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1);
                            setIsSearchDropdownOpen(true);
                          }}
                          placeholder="Ketik beberapa karakter..."
                          className={`pl-10 ${searchTerm ? 'pr-20' : 'pr-4'} py-2 sm:py-2.5 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs w-full sm:w-56 md:w-68 focus:ring-2 focus:ring-yellow-400 focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none bg-slate-50 dark:bg-slate-800 shadow-xs`}
                        />
                        {searchTerm && (
                          <div className="absolute right-2.5 top-1/2 transform -translate-y-1/2 flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[10px] font-black">
                              {filteredData.length}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setSearchTerm('');
                                setCurrentPage(1);
                                setIsSearchDropdownOpen(false);
                              }}
                              title="Hapus pencarian"
                              className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 flex items-center justify-center text-xs font-bold cursor-pointer"
                            >
                              &times;
                            </button>
                          </div>
                        )}
                        {isSearchDropdownOpen && searchTerm.trim().length >= 2 && (
                          <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                            <div className="px-3.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                              <span>Hasil Cepat ({filteredData.length})</span>
                              <span>Klik untuk fokus</span>
                            </div>
                            {filteredData.length === 0 ? (
                              <div className="px-3.5 py-3 text-xs text-slate-400 font-medium">
                                Tidak ada data yang cocok dengan &quot;{searchTerm}&quot;
                              </div>
                            ) : (
                              filteredData.slice(0, 6).map((item, sIdx) => {
                                const pk = (TAB_SCHEMAS[activeTab] || [])[0] || 'ItemID';
                                const pkVal = item[pk] || item.ItemID || `#${sIdx + 1}`;
                                const labelVal = item.ItemName || item.Fullname || item.Username || item.Category || '';
                                return (
                                  <button
                                    key={`quick-search-${sIdx}`}
                                    type="button"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      setSearchTerm(String(pkVal));
                                      setCurrentPage(1);
                                      setIsSearchDropdownOpen(false);
                                    }}
                                    className="w-full text-left px-3.5 py-2 text-xs hover:bg-yellow-50 dark:hover:bg-slate-800 transition flex items-center justify-between gap-2 cursor-pointer"
                                  >
                                    <div className="min-w-0 truncate">
                                      <span className="font-black text-indigo-600 dark:text-indigo-400 mr-2">{String(pkVal)}</span>
                                      <span className="font-semibold text-slate-700 dark:text-slate-200">{String(labelVal)}</span>
                                    </div>
                                    {item.Status && (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                                        {item.Status}
                                      </span>
                                    )}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between sm:justify-start space-x-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 px-3 sm:px-3.5 py-2 sm:py-2.5 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xs w-full sm:w-auto">
                        <span>Show:</span>
                        <select
                          value={rowsPerPage}
                          onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                          className="bg-transparent text-xs font-black outline-none cursor-pointer text-slate-800 dark:text-slate-100"
                        >
                          <option value={10} className="dark:bg-slate-800">10</option>
                          <option value={25} className="dark:bg-slate-800">25</option>
                          <option value={50} className="dark:bg-slate-800">50</option>
                        </select>
                      </div>

                      {(activeTab === 'MaterialReceive' || activeTab === 'MaterialIssued') && (
                        <button
                          onClick={() => {
                            setQrScanTargetRowIndex(null);
                            setIsQrScannerInputOpen(true);
                          }}
                          className="bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-bold px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-xs shadow-md shadow-yellow-400/20 flex items-center justify-center gap-2 transition cursor-pointer w-full sm:w-auto"
                          title="Scan QR Code to enter Material Receive / Issued data"
                        >
                          <i className="fa-solid fa-qrcode"></i> Scan QR Input
                        </button>
                      )}

                      {activeTab !== 'Inventory' && (activeTab !== 'Users' || isYudit) && (
                        <>
                          <button
                            onClick={() => openSingleModal()}
                            className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-xs shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 transition cursor-pointer w-full sm:w-auto"
                            title="Form modal untuk mengisi data baru"
                          >
                            <i className="fa-solid fa-plus text-[10px]"></i> + New
                          </button>
                          <button
                            onClick={() => openMultiModal()}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-xs shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition cursor-pointer w-full sm:w-auto"
                            title="Tambah banyak data sekaligus (Batch Multi Record Entry)"
                          >
                            <i className="fa-solid fa-layer-group text-[10px]"></i> + Add Multiple
                          </button>
                        </>
                      )}

                      {canMultiDelete && selectedRowIndices.length > 0 && (
                        <button
                          onClick={promptBatchDelete}
                          className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-xs shadow-md shadow-rose-600/25 flex items-center justify-center gap-2 transition cursor-pointer w-full sm:w-auto animate-fadeIn"
                          title="Hapus semua data yang dipilih sekaligus"
                        >
                          <i className="fa-solid fa-trash-can text-[11px]"></i> Hapus Terpilih ({selectedRowIndices.length})
                        </button>
                      )}

                      <button
                        onClick={handleExportCSV}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition cursor-pointer w-full sm:w-auto"
                      >
                        <i className="fa-solid fa-file-csv text-[10px]"></i> Export CSV
                      </button>
                    </div>
                  </div>

                  {/* Data Content View (Data List View or Spreadsheet Table View) */}
                  {activeTab === 'Users' && !isYudit ? (
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 text-center border border-slate-200 dark:border-slate-800 shadow-md space-y-4 my-6 max-w-lg mx-auto">
                      <div className="w-16 h-16 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-3xl flex items-center justify-center text-2xl mx-auto shadow-inner">
                        <i className="fa-solid fa-lock"></i>
                      </div>
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Akses Dibatasi (Restricted Access)</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Hanya akun <span className="font-extrabold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">yudit061200</span> yang memiliki wewenang untuk mengelola pengguna.
                      </p>
                      <button
                        onClick={() => setActiveTab('Dashboard')}
                        className="px-5 py-2.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs rounded-2xl shadow-md transition cursor-pointer"
                      >
                        Kembali ke Dashboard
                      </button>
                    </div>
                  ) : currentViewMode === 'report' ? (
                    <div className="space-y-4">
                      {canMultiDelete && pageData.length > 0 && (
                        <div className={`rounded-2xl px-4 py-2.5 border flex flex-wrap items-center justify-between gap-2.5 transition ${
                          selectedRowIndices.length > 0
                            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 shadow-xs'
                            : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-xs'
                        }`}>
                          <label className="flex items-center gap-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isAllPageSelected}
                              onChange={toggleSelectPage}
                              className="w-4 h-4 accent-rose-600 rounded cursor-pointer"
                            />
                            <span>Pilih Semua di Halaman Ini ({pageData.length})</span>
                          </label>

                          <div className="flex flex-wrap items-center gap-2">
                            {selectedRowIndices.length > 0 && (
                              <>
                                <span className="px-2.5 py-1 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-[11px] font-black">
                                  {selectedRowIndices.length} data dipilih
                                </span>
                                {!isAllFilteredSelected && filteredData.length > pageData.length && (
                                  <button
                                    type="button"
                                    onClick={selectAllFiltered}
                                    className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-[11px] font-bold transition cursor-pointer"
                                  >
                                    Pilih Semua ({filteredData.length})
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={clearSelection}
                                  className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-[11px] font-bold transition cursor-pointer"
                                >
                                  Batal Pilih
                                </button>
                                <button
                                  type="button"
                                  onClick={promptBatchDelete}
                                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold shadow-xs flex items-center gap-1.5 transition cursor-pointer"
                                >
                                  <i className="fa-solid fa-trash-can text-[10px]"></i>
                                  Hapus ({selectedRowIndices.length})
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="space-y-3">
                        {pageData.length === 0 ? (
                          <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 text-center text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-slate-800 font-medium flex flex-col items-center justify-center gap-3">
                            <div>No Data Found</div>
                            {activeTab !== 'Inventory' && (
                              <div className="flex items-center gap-2 mt-1">
                                <button
                                  onClick={() => openSingleModal()}
                                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-2xl transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                                >
                                  <i className="fa-solid fa-plus"></i> + New Record
                                </button>
                                <button
                                  onClick={() => openMultiModal()}
                                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-2xl transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                                >
                                  <i className="fa-solid fa-layer-group"></i> + Add Multiple Records
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          pageData.map((row, index) => {
                            const globalIdx = startIdx + index + 1;
                            const actualRowIndex = startIdx + index;
                            const isSelected = selectedRowIndices.includes(actualRowIndex);
                            const primaryKeyCol = (TAB_SCHEMAS[activeTab] || [])[0];
                            const primaryVal = row[primaryKeyCol] || `#${globalIdx}`;
                            const itemName = row.ItemName || row.Fullname || row.Username || primaryVal;
                            const statusVal = row.Status;

                            let statusClass = 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
                            if (statusVal === 'In Stock' || statusVal === 'Approve' || statusVal === 'Approved' || statusVal === 'Receive' || statusVal === 'Active') {
                              statusClass = 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 font-bold';
                            } else if (statusVal === 'Need Order') {
                              statusClass = 'bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800 font-black';
                            } else if (statusVal === 'Low Stock' || statusVal === 'Pending' || statusVal === 'Urgent') {
                              statusClass = 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 font-bold';
                            } else if (statusVal === 'Cancelled' || statusVal === 'Inactive') {
                              statusClass = 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800 font-bold';
                            }

                            return (
                              <div
                                key={`datalist-${activeTab}-${globalIdx}`}
                                className={`bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border shadow-xs hover:shadow-md transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                                  isSelected
                                    ? 'border-rose-400 dark:border-rose-500 ring-2 ring-rose-400/25 bg-rose-50/30 dark:bg-rose-950/20'
                                    : 'border-slate-100 dark:border-slate-800 hover:border-yellow-400/80'
                                }`}
                              >
                                {/* Left: Checkbox, Index, Photo/Icon, Code, Title, Badges */}
                                <div className="flex items-center gap-3 min-w-0 flex-grow">
                                  {canMultiDelete && (
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleSelectRow(actualRowIndex)}
                                      aria-label={`Pilih baris ${globalIdx}`}
                                      className="w-4 h-4 accent-rose-600 rounded cursor-pointer shrink-0"
                                    />
                                  )}
                                  <span className="w-8 h-8 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs font-black shrink-0">
                                    {globalIdx}
                                  </span>

                                  {row.Photo ? (
                                    <img
                                      src={row.Photo}
                                      alt="Thumbnail"
                                      onClick={() => {
                                        setLightboxSrc(row.Photo);
                                        setLightboxCaption(itemName);
                                        setIsLightboxOpen(true);
                                      }}
                                      className="w-12 h-12 object-cover rounded-2xl border border-slate-200 dark:border-slate-700 cursor-pointer shadow-xs shrink-0"
                                    />
                                  ) : (
                                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500 shrink-0">
                                      <i className="fa-solid fa-box text-lg"></i>
                                    </div>
                                  )}

                                  <div className="min-w-0 space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-extrabold text-[11px] border border-indigo-100 dark:border-indigo-900/50">
                                        {primaryVal}
                                      </span>
                                      {statusVal && (
                                        <span className={`px-2.5 py-0.5 rounded-lg text-[10px] border ${statusClass}`}>
                                          {statusVal}
                                        </span>
                                      )}
                                      {row.Category && (
                                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                                          {row.Category}
                                        </span>
                                      )}
                                      {activeTab === 'Inventory' && (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                          <i className="fa-solid fa-boxes-stacked text-[9px] text-blue-500"></i>
                                          Current Stock: {typeof row.CurrentStock === 'number' ? row.CurrentStock.toLocaleString('id-ID') : (row.CurrentStock ?? 0)} {row.UoM || ''}
                                        </span>
                                      )}
                                    </div>
                                    <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white whitespace-normal break-words leading-snug">
                                      {itemName}
                                    </h4>
                                    {row.Location && (
                                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                                        <i className="fa-solid fa-location-dot text-rose-500 text-[10px]"></i> {row.Location}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Center: Attributes Grid */}
                                <div className={`grid grid-cols-2 sm:grid-cols-3 ${activeTab === 'Inventory' ? 'lg:grid-cols-3 md:min-w-[340px]' : 'lg:grid-cols-4 md:min-w-[320px]'} gap-2 text-xs bg-slate-50/80 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800`}>
                                  {(activeTab === 'Inventory'
                                    ? ['CurrentStock', 'LastStock', 'StockIn', 'StockOut', 'MinStock', 'UoM']
                                    : getDisplayColumns()
                                        .filter(col => col !== primaryKeyCol && col !== 'ItemName' && col !== 'Status' && col !== 'Photo' && col !== 'Location')
                                        .slice(0, 4)
                                  ).map(col => {
                                    let v = row[col] !== undefined && row[col] !== null ? row[col] : '-';
                                    if ((col === 'Date' || col.includes('Date')) && v) {
                                      v = String(v).split('T')[0];
                                    }
                                    if (col.includes('USD') && typeof v === 'number') v = `$${v.toLocaleString('en-US')}`;
                                    if (col.includes('IDR') && typeof v === 'number') v = `Rp ${v.toLocaleString('id-ID')}`;
                                    if (col === 'CurrentStock' && typeof v === 'number') v = v.toLocaleString('id-ID');

                                    return (
                                      <div key={col} className="min-w-0">
                                        <span className="text-[9px] sm:text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider block truncate">
                                          {customColHeaders[col] || col}
                                        </span>
                                        <span className={`text-xs truncate block ${
                                          col === 'CurrentStock'
                                            ? 'font-black text-blue-700 dark:text-blue-300'
                                            : 'font-bold text-slate-800 dark:text-slate-200'
                                        }`}>
                                          {String(v)}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Right: Action Buttons */}
                                <div className="flex flex-wrap items-center gap-1.5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                                  {row.ItemID && (
                                    <button
                                      onClick={() => openQrModal(row)}
                                      title="Generate & Print Barcode QR Sticker"
                                      className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                    >
                                      <i className="fa-solid fa-qrcode text-[11px] text-amber-500"></i>
                                      <span className="hidden sm:inline">QR</span>
                                    </button>
                                  )}

                                  {row.ItemID && (
                                    <button
                                      onClick={() => openItemDetails(String(row.ItemID))}
                                      className="px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                    >
                                      <i className="fa-solid fa-circle-info text-[11px]"></i> Details
                                    </button>
                                  )}

                                  {row[primaryKeyCol] && ['MaterialRequest', 'PurchaseOrder', 'MaterialReceive', 'MaterialIssued'].includes(activeTab) && (
                                    <button
                                      onClick={() => openPrintModal(String(row[primaryKeyCol]))}
                                      className="px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                    >
                                      <i className="fa-solid fa-file-lines text-[11px]"></i> Print
                                    </button>
                                  )}

                                  {activeTab !== 'Inventory' && (
                                    <button
                                      onClick={() => openSingleModal(row, actualRowIndex)}
                                      className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                                    >
                                      <i className="fa-solid fa-pen-to-square text-[11px]"></i> Edit
                                    </button>
                                  )}

                                  {activeTab !== 'Inventory' && (
                                    <button
                                      onClick={() => promptDeleteRow(actualRowIndex, row)}
                                      className="px-2.5 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                                    >
                                      <i className="fa-solid fa-trash text-[11px]"></i> Delete
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Pagination for Card View */}
                      <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 rounded-3xl shadow-xs border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center text-xs gap-3">
                        <span className="text-slate-500 dark:text-slate-400 font-semibold">
                          Showing {totalEntries === 0 ? 0 : startIdx + 1} to {Math.min(startIdx + rowsPerPage, totalEntries)} of {totalEntries} entries
                        </span>
                        <div className="flex items-center space-x-2">
                          <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 text-xs font-bold shadow-xs cursor-pointer"
                          >
                            Prev
                          </button>
                          <span className="px-3 py-2 font-bold text-slate-700 dark:text-slate-300">
                            Page {currentPage} of {maxPages}
                          </span>
                          <button
                            disabled={currentPage === maxPages || maxPages === 0}
                            onClick={() => setCurrentPage(prev => Math.min(maxPages, prev + 1))}
                            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 text-xs font-bold shadow-xs cursor-pointer"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Table View (Spreadsheet Table View) */
                    <div className="space-y-3">
                      {canMultiDelete && selectedRowIndices.length > 0 && (
                        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5 shadow-xs animate-fadeIn">
                          <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-lg bg-rose-600 text-white flex items-center justify-center text-[11px] font-black">
                              {selectedRowIndices.length}
                            </span>
                            <span className="text-xs font-extrabold text-rose-900 dark:text-rose-200">
                              data terpilih siap dihapus sekaligus
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {!isAllFilteredSelected && filteredData.length > pageData.length && (
                              <button
                                type="button"
                                onClick={selectAllFiltered}
                                className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-[11px] font-bold transition cursor-pointer"
                              >
                                Pilih Semua ({filteredData.length})
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={clearSelection}
                              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-[11px] font-bold transition cursor-pointer"
                            >
                              Batal Pilih
                            </button>
                            <button
                              type="button"
                              onClick={promptBatchDelete}
                              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold shadow-xs flex items-center gap-1.5 transition cursor-pointer"
                            >
                              <i className="fa-solid fa-trash-can text-[10px]"></i>
                              Hapus ({selectedRowIndices.length}) Data
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xs border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors">
                        <div className="overflow-x-auto w-full">
                          <table className="w-full min-w-[1050px] text-left text-xs border-collapse">
                            <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-wider">
                              <tr>
                                <th className="p-3.5 border-b border-slate-800 min-w-[105px] text-white font-black text-center select-none shrink-0 whitespace-nowrap">
                                  <div className="flex items-center justify-center gap-2">
                                    {canMultiDelete && pageData.length > 0 && (
                                      <input
                                        type="checkbox"
                                        checked={isAllPageSelected}
                                        onChange={toggleSelectPage}
                                        title="Pilih semua baris di halaman ini"
                                        aria-label="Pilih semua baris di halaman ini"
                                        className="w-3.5 h-3.5 accent-rose-500 rounded cursor-pointer"
                                      />
                                    )}
                                    <span># / Actions</span>
                                  </div>
                                </th>
                              {getDisplayColumns().map((col, colIdx) => {
                                const isSorted = sortCol === col;
                                const colLabel = customColHeaders[col] || col;
                                return (
                                  <th
                                    key={`col-hdr-${col}-${colIdx}`}
                                    onClick={() => handleSort(col)}
                                    className="p-3.5 border-b border-slate-800 text-white font-black cursor-pointer hover:bg-slate-800 active:bg-slate-900 transition select-none whitespace-nowrap group min-w-[120px]"
                                    title={`Sort by ${colLabel}`}
                                  >
                                    {colLabel}{' '}
                                    <span className="inline-block transition-transform">
                                      {isSorted ? (
                                        sortDir === 'asc' ? (
                                          <i className="fa-solid fa-sort-up ml-1 text-yellow-400 text-[12px]"></i>
                                        ) : (
                                          <i className="fa-solid fa-sort-down ml-1 text-yellow-400 text-[12px]"></i>
                                        )
                                      ) : (
                                        <i className="fa-solid fa-sort ml-1 text-slate-400 opacity-60 text-[10px]"></i>
                                      )}
                                    </span>
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>

                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {pageData.length === 0 ? (
                              <tr>
                                <td colSpan={15} className="p-10 text-center text-slate-400 font-medium">
                                  No Data Found
                                </td>
                              </tr>
                            ) : (
                              pageData.map((row, index) => {
                                const globalIdx = startIdx + index + 1;
                                const actualRowIndex = startIdx + index;
                                const isSelected = selectedRowIndices.includes(actualRowIndex);
                                const primaryKeyCol = (TAB_SCHEMAS[activeTab] || [])[0];

                                return (
                                  <tr
                                    key={`tbl-row-${activeTab}-${startIdx + index}-${row._rowIndex ?? index}`}
                                    className={`transition ${
                                      isSelected
                                        ? 'bg-rose-50/70 dark:bg-rose-950/25 hover:bg-rose-100/70 dark:hover:bg-rose-950/35'
                                        : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                                    }`}
                                  >
                                    <td className="p-2 border-b border-slate-100 dark:border-slate-800 font-bold text-slate-400 dark:text-slate-500 text-center bg-slate-50/40 dark:bg-slate-900/40 select-none whitespace-nowrap min-w-[105px]">
                                      {activeTab !== 'Inventory' ? (
                                        <div className="flex items-center justify-center gap-1.5">
                                          {canMultiDelete && (
                                            <input
                                              type="checkbox"
                                              checked={isSelected}
                                              onChange={() => toggleSelectRow(actualRowIndex)}
                                              aria-label={`Pilih baris ${globalIdx}`}
                                              className="w-3.5 h-3.5 accent-rose-600 rounded cursor-pointer shrink-0"
                                            />
                                          )}
                                          <span className="text-slate-500 dark:text-slate-400 font-extrabold text-xs min-w-[18px]">{globalIdx}</span>
                                          <button
                                            onClick={() => openSingleModal(row, actualRowIndex)}
                                            title="Edit this record via Modal"
                                            className="inline-flex items-center justify-center w-5.5 h-5.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition text-[10px] shadow-xs cursor-pointer shrink-0"
                                          >
                                            <i className="fa-solid fa-pencil"></i>
                                          </button>
                                          <button
                                            onClick={() => promptDeleteRow(actualRowIndex, row)}
                                            title="Delete this row"
                                            className="inline-flex items-center justify-center w-5.5 h-5.5 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition text-[10px] shadow-xs cursor-pointer shrink-0"
                                          >
                                            <i className="fa-solid fa-trash"></i>
                                          </button>
                                        </div>
                                      ) : (
                                        <span className="text-slate-500 dark:text-slate-400 font-extrabold text-xs">{globalIdx}</span>
                                      )}
                                    </td>

                                    {getDisplayColumns().map(col => {
                                      let val = row[col] !== undefined && row[col] !== null ? row[col] : '';
                                      if ((col === 'Date' || col.includes('Date')) && val) {
                                        val = String(val).split('T')[0];
                                      }

                                      const isReadOnlyTab = activeTab === 'Inventory';
                                      const isComputedCol = ['TotalPriceIDR', 'TotalPriceUSD', 'CurrentStock', 'StockIn', 'StockOut'].includes(col);

                                      if (isReadOnlyTab || isComputedCol) {
                                        if (col === 'Status' && val) {
                                          let statusClass = 'bg-slate-100 text-slate-700 border-slate-200';
                                          if (val === 'In Stock' || val === 'Approve' || val === 'Approved' || val === 'Receive') {
                                            statusClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold';
                                          } else if (val === 'Need Order') {
                                            statusClass = 'bg-rose-100 text-rose-800 border-rose-300 font-black animate-pulse shadow-xs';
                                          } else if (val === 'Low Stock' || val === 'Pending') {
                                            statusClass = 'bg-amber-50 text-amber-700 border-amber-200 font-bold';
                                          } else if (val === 'Cancelled') {
                                            statusClass = 'bg-rose-50 text-rose-700 border-rose-200 font-bold';
                                          }
                                          return (
                                            <td key={col} className="p-3 border-b border-slate-100 dark:border-slate-800 whitespace-nowrap min-w-[120px]">
                                              <span className={`px-2.5 py-1 rounded-lg text-[10px] border ${statusClass}`}>
                                                {val}
                                              </span>
                                            </td>
                                          );
                                        }

                                        if (col === 'CurrentStock') {
                                          return (
                                            <td key={col} className="p-3 border-b border-slate-100 dark:border-slate-800 whitespace-nowrap min-w-[120px]">
                                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800 shadow-2xs">
                                                <i className="fa-solid fa-boxes-stacked text-[11px] text-blue-500"></i>
                                                {typeof val === 'number' ? val.toLocaleString('id-ID') : val}
                                              </span>
                                            </td>
                                          );
                                        }

                                        return (
                                          <td
                                            key={col}
                                            className={`p-3 border-b border-slate-100 dark:border-slate-800 font-semibold text-slate-700 dark:text-slate-200 ${
                                              col === 'ItemName'
                                                ? 'min-w-[180px] max-w-[260px] whitespace-normal break-words'
                                                : 'whitespace-nowrap min-w-[100px]'
                                            }`}
                                          >
                                            {col.includes('USD') && typeof val === 'number'
                                              ? `$${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                                              : col.includes('IDR') && typeof val === 'number'
                                              ? `Rp ${val.toLocaleString('id-ID')}`
                                              : val}
                                          </td>
                                        );
                                      }

                                      if (col === 'UpdatedBy') {
                                        return (
                                          <td key={col} className="p-3 border-b border-slate-100 dark:border-slate-800 whitespace-nowrap min-w-[120px]">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                              <i className="fa-solid fa-user-pen text-amber-500 text-[9px]"></i>
                                              {val || 'System'}
                                            </span>
                                          </td>
                                        );
                                      }

                                      if (col === 'ItemID') {
                                        return (
                                          <td key={col} className="p-1.5 border-b border-slate-100 dark:border-slate-800 whitespace-nowrap min-w-[130px]">
                                            <div className="flex items-center gap-1">
                                              <input
                                                type="text"
                                                list="items-id-datalist"
                                                value={val}
                                                onChange={(e) => handleSheetCellChange(row, col, e.target.value)}
                                                className="bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-yellow-400 border border-transparent focus:border-yellow-400 rounded-lg px-2 py-1 w-full min-w-[90px] text-xs font-bold text-blue-600 dark:text-blue-400 outline-none transition"
                                              />
                                              {val && (
                                                <button
                                                  onClick={() => openItemDetails(String(val))}
                                                  title="View Item Details"
                                                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-950/50 transition shrink-0 cursor-pointer text-xs"
                                                >
                                                  <i className="fa-solid fa-circle-info"></i>
                                                </button>
                                              )}
                                            </div>
                                          </td>
                                        );
                                      }

                                      if (col === primaryKeyCol && ['MaterialRequest', 'PurchaseOrder', 'MaterialReceive', 'MaterialIssued'].includes(activeTab)) {
                                        return (
                                          <td key={col} className="p-1.5 border-b border-slate-100 dark:border-slate-800 whitespace-nowrap min-w-[130px]">
                                            <div className="flex items-center gap-1">
                                              <input
                                                type="text"
                                                value={val}
                                                onChange={(e) => handleSheetCellChange(row, col, e.target.value)}
                                                className="bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-yellow-400 border border-transparent focus:border-yellow-400 rounded-lg px-2 py-1 w-full min-w-[90px] text-xs font-bold text-indigo-600 dark:text-indigo-400 outline-none transition"
                                              />
                                              {val && (
                                                <button
                                                  onClick={() => openPrintModal(String(val))}
                                                  title="View Document Form"
                                                  className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 p-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition shrink-0 cursor-pointer text-xs"
                                                >
                                                  <i className="fa-solid fa-file-lines"></i>
                                                </button>
                                              )}
                                            </div>
                                          </td>
                                        );
                                      }

                                      if (col === 'ItemName') {
                                        return (
                                          <td key={col} className="p-1.5 border-b border-slate-100 dark:border-slate-800 whitespace-normal break-words min-w-[220px] max-w-[340px]">
                                            <textarea
                                              rows={2}
                                              value={val}
                                              onChange={(e) => handleSheetCellChange(row, col, e.target.value)}
                                              className="bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-yellow-400 border border-transparent focus:border-yellow-400 rounded-lg px-2 py-1 w-full text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none transition whitespace-pre-wrap break-words resize-y min-h-[38px]"
                                            />
                                          </td>
                                        );
                                      }

                                      if (col === 'Status') {
                                        return (
                                          <td key={col} className="p-1.5 border-b border-slate-100 dark:border-slate-800 whitespace-nowrap min-w-[120px]">
                                            <select
                                              value={val}
                                              onChange={(e) => handleSheetCellChange(row, col, e.target.value)}
                                              className="bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-yellow-400 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none transition cursor-pointer min-w-[100px]"
                                            >
                                              {activeTab === 'MaterialRequest' || activeTab === 'PurchaseOrder' ? (
                                                <>
                                                  <option value="Pending" className="dark:bg-slate-800">Pending</option>
                                                  <option value="Approve" className="dark:bg-slate-800">Approve</option>
                                                  <option value="Receive" className="dark:bg-slate-800">Receive</option>
                                                  <option value="Cancelled" className="dark:bg-slate-800">Cancelled</option>
                                                </>
                                              ) : activeTab === 'ItemList' ? (
                                                <>
                                                  <option value="In Stock" className="dark:bg-slate-800">In Stock</option>
                                                  <option value="Low Stock" className="dark:bg-slate-800">Low Stock</option>
                                                </>
                                              ) : (
                                                <>
                                                  <option value="Active" className="dark:bg-slate-800">Active</option>
                                                  <option value="Inactive" className="dark:bg-slate-800">Inactive</option>
                                                </>
                                              )}
                                            </select>
                                          </td>
                                        );
                                      }

                                      if (col === 'Priority') {
                                        return (
                                          <td key={col} className="p-1.5 border-b border-slate-100 dark:border-slate-800 whitespace-nowrap min-w-[110px]">
                                            <select
                                              value={val}
                                              onChange={(e) => handleSheetCellChange(row, col, e.target.value)}
                                              className="bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-yellow-400 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none transition cursor-pointer min-w-[90px]"
                                            >
                                              <option value="Normal" className="dark:bg-slate-800">Normal</option>
                                              <option value="Urgent" className="dark:bg-slate-800">Urgent</option>
                                            </select>
                                          </td>
                                        );
                                      }

                                      if (col === 'Role') {
                                        return (
                                          <td key={col} className="p-1.5 border-b border-slate-100 dark:border-slate-800 whitespace-nowrap min-w-[120px]">
                                            <select
                                              value={val || 'Operator'}
                                              onChange={(e) => handleSheetCellChange(row, col, e.target.value)}
                                              className="bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-yellow-400 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none transition cursor-pointer min-w-[100px]"
                                            >
                                              <option value="Admin" className="dark:bg-slate-800">Admin</option>
                                              <option value="Operator" className="dark:bg-slate-800">Operator</option>
                                              <option value="Materialman" className="dark:bg-slate-800">Materialman</option>
                                              <option value="Rig Manager" className="dark:bg-slate-800">Rig Manager</option>
                                              <option value="Staff" className="dark:bg-slate-800">Staff</option>
                                              <option value="Manager" className="dark:bg-slate-800">Manager</option>
                                              <option value="Viewer" className="dark:bg-slate-800">Viewer</option>
                                            </select>
                                          </td>
                                        );
                                      }

                                      if (col === 'Email') {
                                        return (
                                          <td key={col} className="p-1.5 border-b border-slate-100 dark:border-slate-800 whitespace-nowrap min-w-[180px]">
                                            <input
                                              type="email"
                                              value={val}
                                              onChange={(e) => handleSheetCellChange(row, col, e.target.value)}
                                              placeholder="email@example.com"
                                              className="bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-yellow-400 border border-transparent focus:border-yellow-400 rounded-lg px-2 py-1 w-full min-w-[150px] text-xs font-medium text-slate-800 dark:text-slate-100 outline-none transition"
                                            />
                                          </td>
                                        );
                                      }

                                      if (col === 'Password') {
                                        return (
                                          <td key={col} className="p-1.5 border-b border-slate-100 dark:border-slate-800 whitespace-nowrap min-w-[130px]">
                                            <input
                                              type="password"
                                              value={val}
                                              onChange={(e) => handleSheetCellChange(row, col, e.target.value)}
                                              placeholder="••••••••"
                                              className="bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-yellow-400 border border-transparent focus:border-yellow-400 rounded-lg px-2 py-1 w-full min-w-[100px] text-xs font-mono text-slate-800 dark:text-slate-100 outline-none transition"
                                            />
                                          </td>
                                        );
                                      }

                                      if (col === 'Department') {
                                        return (
                                          <td key={col} className="p-1.5 border-b border-slate-100 dark:border-slate-800 whitespace-nowrap min-w-[140px]">
                                            <input
                                              type="text"
                                              list="departments-datalist"
                                              value={val}
                                              onChange={(e) => handleSheetCellChange(row, col, e.target.value)}
                                              className="bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-yellow-400 border border-transparent focus:border-yellow-400 rounded-lg px-2 py-1 w-full min-w-[110px] text-xs font-medium text-slate-800 dark:text-slate-100 outline-none transition"
                                            />
                                          </td>
                                        );
                                      }

                                      if (col === 'Supplier') {
                                        return (
                                          <td key={col} className="p-1.5 border-b border-slate-100 dark:border-slate-800 whitespace-nowrap min-w-[140px]">
                                            <input
                                              type="text"
                                              list="suppliers-datalist"
                                              value={val}
                                              onChange={(e) => handleSheetCellChange(row, col, e.target.value)}
                                              className="bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-yellow-400 border border-transparent focus:border-yellow-400 rounded-lg px-2 py-1 w-full min-w-[110px] text-xs font-medium text-slate-800 dark:text-slate-100 outline-none transition"
                                            />
                                          </td>
                                        );
                                      }

                                      if (col === 'Attachment') {
                                        const isImage = typeof val === 'string' && (val.startsWith('data:image/') || val.match(/\.(jpeg|jpg|gif|png|webp)$/i));
                                        return (
                                          <td key={col} className="p-1.5 border-b border-slate-100 dark:border-slate-800 whitespace-nowrap min-w-[170px]">
                                            <div className="flex items-center gap-1.5">
                                              {val ? (
                                                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl text-[10px] font-bold shrink-0 shadow-xs">
                                                  {isImage ? (
                                                    <a
                                                      href={val}
                                                      target="_blank"
                                                      rel="noreferrer"
                                                      title="Klik untuk lihat gambar penuh"
                                                      className="shrink-0"
                                                    >
                                                      <img
                                                        src={val}
                                                        alt="Preview"
                                                        className="w-9 h-9 object-cover rounded-lg border border-slate-200 dark:border-slate-700 hover:scale-105 transition cursor-pointer shadow-2xs"
                                                      />
                                                    </a>
                                                  ) : (
                                                    <a
                                                      href={val}
                                                      download={row.AttachmentName || 'Attachment'}
                                                      target="_blank"
                                                      rel="noreferrer"
                                                      className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200 dark:border-blue-800 hover:scale-105 transition"
                                                      title="Klik untuk unduh / buka file"
                                                    >
                                                      <i className="fa-solid fa-file-pdf text-sm"></i>
                                                    </a>
                                                  )}
                                                  <div className="flex flex-col min-w-0 max-w-[90px]">
                                                    <a
                                                      href={val}
                                                      download={row.AttachmentName || 'Attachment'}
                                                      target="_blank"
                                                      rel="noreferrer"
                                                      className="hover:underline truncate text-slate-800 dark:text-slate-200 font-extrabold text-[11px]"
                                                      title={row.AttachmentName || 'Attachment'}
                                                    >
                                                      {row.AttachmentName || 'Dokumen'}
                                                    </a>
                                                    <span className="text-[9px] text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 font-bold">
                                                      <i className="fa-solid fa-check text-[8px]"></i> Ter-upload
                                                    </span>
                                                  </div>
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      if (window.confirm('Apakah Anda yakin ingin menghapus lampiran ini?')) {
                                                        handleSheetCellChange(row, { Attachment: '', AttachmentName: '' });
                                                        showToast('Lampiran berhasil dihapus');
                                                      }
                                                    }}
                                                    className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg cursor-pointer transition hover:bg-rose-50 dark:hover:bg-rose-950/60"
                                                    title="Hapus Lampiran"
                                                  >
                                                    <i className="fa-solid fa-trash-can text-xs"></i>
                                                  </button>
                                                </div>
                                              ) : null}

                                              <label className="text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 font-bold cursor-pointer transition shrink-0 flex items-center gap-1 border border-slate-200 dark:border-slate-700">
                                                <i className="fa-solid fa-upload text-amber-500"></i> {val ? 'Ganti' : 'Upload'}
                                                <input
                                                  type="file"
                                                  accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar,.7z"
                                                  className="hidden"
                                                  onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                      processFileUpload(file, (result, fileName) => {
                                                        handleSheetCellChange(row, { Attachment: result, AttachmentName: fileName });
                                                      });
                                                      e.target.value = '';
                                                    }
                                                  }}
                                                />
                                              </label>
                                            </div>
                                          </td>
                                        );
                                      }

                                      if (col === 'Date' || col.includes('Date')) {
                                        return (
                                          <td key={col} className="p-1.5 border-b border-slate-100 dark:border-slate-800 whitespace-nowrap min-w-[130px]">
                                            <input
                                              type="date"
                                              value={val}
                                              onChange={(e) => handleSheetCellChange(row, col, e.target.value)}
                                              className="bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-yellow-400 border border-transparent focus:border-yellow-400 rounded-lg px-2 py-1 text-xs font-medium text-slate-800 dark:text-slate-100 outline-none transition min-w-[110px]"
                                            />
                                          </td>
                                        );
                                      }

                                      if (col === 'Photo') {
                                        return (
                                          <td key={col} className="p-1.5 border-b border-slate-100 dark:border-slate-800 whitespace-nowrap min-w-[130px]">
                                            <div className="flex items-center gap-1.5">
                                              {val ? (
                                                <img
                                                  src={val}
                                                  alt="Thumb"
                                                  onClick={() => {
                                                    setLightboxSrc(val);
                                                    setLightboxCaption(row.ItemName || 'Item Photo');
                                                    setIsLightboxOpen(true);
                                                  }}
                                                  className="h-8 w-8 object-cover rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer shadow-xs shrink-0"
                                                />
                                              ) : (
                                                <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 text-[10px] shrink-0">
                                                  No Img
                                                </div>
                                              )}
                                              <label className="text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-2 py-1 rounded-md text-slate-700 dark:text-slate-300 font-bold cursor-pointer transition shrink-0">
                                                Upload
                                                <input
                                                  type="file"
                                                  accept="image/*"
                                                  className="hidden"
                                                  onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                      const reader = new FileReader();
                                                      reader.onload = (ev) => handleSheetCellChange(row, col, ev.target?.result);
                                                      reader.readAsDataURL(file);
                                                    }
                                                  }}
                                                />
                                              </label>
                                            </div>
                                          </td>
                                        );
                                      }

                                      return (
                                        <td key={col} className="p-1.5 border-b border-slate-100 dark:border-slate-800 whitespace-nowrap min-w-[120px]">
                                          <input
                                            type={col.includes('Price') || col.includes('Stock') || col === 'Qty' ? 'number' : 'text'}
                                            step={col.includes('USD') ? '0.01' : '1'}
                                            value={val}
                                            onChange={(e) => handleSheetCellChange(row, col, e.target.value)}
                                            className="bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-yellow-400 border border-transparent focus:border-yellow-400 rounded-lg px-2 py-1 w-full min-w-[90px] text-xs font-medium text-slate-800 dark:text-slate-100 outline-none transition"
                                          />
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="p-4 sm:p-5 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center text-xs gap-3">
                        <span className="text-slate-500 dark:text-slate-400 font-semibold">
                          Showing {totalEntries === 0 ? 0 : startIdx + 1} to {Math.min(startIdx + rowsPerPage, totalEntries)} of {totalEntries} entries
                        </span>
                        <div className="flex items-center space-x-2">
                          <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 text-xs font-bold shadow-xs cursor-pointer"
                          >
                            Prev
                          </button>
                          <span className="px-3 py-2 font-bold text-slate-700 dark:text-slate-300">
                            Page {currentPage} of {maxPages}
                          </span>
                          <button
                            disabled={currentPage === maxPages || maxPages === 0}
                            onClick={() => setCurrentPage(prev => Math.min(maxPages, prev + 1))}
                            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 text-xs font-bold shadow-xs cursor-pointer"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </div>
                    </div>
                  )}
                </div>
              )}
            </main>
          </div>
        </div>
      )}

      {/* Modals */}
      {isSingleModalOpen && (
        <SingleRecordModal
          activeTab={activeTab}
          editingRecord={editingRecord}
          editingRowIndex={editingRowIndex}
          items={items}
          onClose={() => setIsSingleModalOpen(false)}
          onSave={handleSaveSingleRecord}
          handleSingleFieldChange={handleSingleFieldChange}
          onOpenQrScanner={() => {
            setQrScanTargetRowIndex(null);
            setIsQrScannerInputOpen(true);
          }}
        />
      )}

      {isMultiModalOpen && (
        <MultiRecordModal
          activeTab={activeTab}
          multiRows={multiRows}
          setMultiRows={setMultiRows}
          items={items}
          onClose={() => setIsMultiModalOpen(false)}
          onSave={saveMultiRecords}
          handleMultiRowChange={handleMultiRowChange}
          addMultiRow={addMultiRow}
          onOpenQrScanner={(rowIndex) => {
            setQrScanTargetRowIndex(rowIndex !== undefined ? rowIndex : null);
            setIsQrScannerInputOpen(true);
          }}
        />
      )}

      {isPrintModalOpen && (
        <DocBlueprintModal
          activeTab={activeTab}
          printDocId={printDocId}
          companyHeader={companyHeader}
          setCompanyHeader={setCompanyHeader}
          printDocHeader={printDocHeader}
          setPrintDocHeader={setPrintDocHeader}
          printDocItems={printDocItems}
          setPrintDocItems={setPrintDocItems}
          isHeaderEditMode={isHeaderEditMode}
          setIsHeaderEditMode={setIsHeaderEditMode}
          items={items}
          receives={receives}
          issued={issued}
          onClose={() => setIsPrintModalOpen(false)}
          onSaveDocForm={handleSaveDocForm}
        />
      )}

      {isColHeaderModalOpen && (
        <CustomHeadersModal
          activeTab={activeTab}
          getDisplayColumns={getDisplayColumns}
          editingColHeaders={editingColHeaders}
          setEditingColHeaders={setEditingColHeaders}
          onClose={() => setIsColHeaderModalOpen(false)}
          onSave={handleSaveColHeaders}
        />
      )}

      {isItemDetailsModalOpen && (
        <ItemDetailsModal
          viewingItem={viewingItem}
          setViewingItem={setViewingItem}
          isEditingInDetails={isEditingInDetails}
          setIsEditingInDetails={setIsEditingInDetails}
          onClose={() => setIsItemDetailsModalOpen(false)}
          onSaveInline={handleSaveItemDetailsInline}
          onOpenQr={openQrModal}
        />
      )}

      {isQrModalOpen && (
        <QrCodeModal
          qrItem={qrItem}
          qrCopies={qrCopies}
          setQrCopies={setQrCopies}
          companyHeader={companyHeader}
          onClose={() => setIsQrModalOpen(false)}
        />
      )}

      {isLightboxOpen && (
        <LightboxModal
          src={lightboxSrc}
          caption={lightboxCaption}
          onClose={() => setIsLightboxOpen(false)}
        />
      )}

      {isQrScannerInputOpen && (
        <QrScannerInputModal
          activeTab={activeTab}
          items={items}
          onClose={() => setIsQrScannerInputOpen(false)}
          onScanSuccess={handleQrScanSuccess}
        />
      )}

      {/* Interactive Delete Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        activeTab={activeTab}
        recordToDelete={recordToDelete}
        selectedCount={selectedRowIndices.length}
        selectedRecords={selectedRecordsList}
        isBatchDelete={isBatchDelete}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={isBatchDelete ? confirmBatchDelete : confirmDeleteSingleRow}
      />

      {/* Mobile Bottom Dock Navigation */}
      {currentUser && (
        <MobileBottomNav
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            setSearchTerm('');
            setFilterColumn('all');
            setCurrentPage(1);
          }}
          onOpenSingleModal={() => openSingleModal()}
        />
      )}

      {isReorderModalOpen && (
        <ReorderNotificationModal
          itemsNeedingOrder={itemsNeedingOrder}
          onClose={() => setIsReorderModalOpen(false)}
          onCreateSingleRequest={handleCreateSingleRequestFromReorder}
          onCreateBatchRequest={handleCreateBatchRequestFromReorder}
          onOpenItemDetails={openItemDetails}
        />
      )}

      <SpreadsheetSyncModal
        isOpen={isSpreadsheetModalOpen}
        onClose={() => setIsSpreadsheetModalOpen(false)}
        itemsCount={items.length}
        requestsCount={requests.length}
        posCount={purchaseOrders.length}
        receivesCount={receives.length}
        issuedCount={issued.length}
        onPullSync={handlePullSync}
        onPushSync={handlePushSync}
        onExportAllSheetsCSV={handleExportAllSheetsCSV}
        showToast={showToast}
      />

      <datalist id="items-id-datalist">
        {items.map((i, idx) => (
          <option key={`opt-id-${i.ItemID || ''}-${idx}`} value={i.ItemID}>{i.ItemName}</option>
        ))}
      </datalist>

      <datalist id="items-name-datalist">
        {items.map((i, idx) => (
          <option key={`opt-name-${i.ItemID || ''}-${idx}`} value={i.ItemName}>{i.ItemID}</option>
        ))}
      </datalist>

      <datalist id="departments-datalist">
        <option value="Operations" />
        <option value="Maintenance" />
        <option value="HSE" />
        <option value="Logistics" />
        <option value="Administration" />
        <option value="Finance" />
      </datalist>

      <datalist id="suppliers-datalist">
        <option value="PT Supply Utama" />
        <option value="PT Rig Nusantara" />
        <option value="CV Teknik Mandiri" />
        <option value="Global Drilling Tools" />
        <option value="Pramana Equipment" />
      </datalist>

      <datalist id="rigname-datalist">
        <option value="Rig Silver City 20" />
        <option value="SILVER CITY DRILLING #20" />
        <option value="Rig Silver City 02" />
      </datalist>
    </div>
  );
}
