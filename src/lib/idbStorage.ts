// IndexedDB storage helper for storing large ERP datasets safely in browser
const DB_NAME = 'SilverCityERP_DB';
const DB_VERSION = 1;
const STORE_NAME = 'kv_store';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function idbSet(key: string, val: any): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(val, key);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    // Fail silently
  }
}

export function safeSetLocalStorage(key: string, val: any): void {
  try {
    const str = typeof val === 'string' ? val : JSON.stringify(val);
    localStorage.setItem(key, str);
    // Also mirror to IndexedDB for persistence
    idbSet(key, val);
    if (Array.isArray(val) && val.length > 0) {
      idbSet(key + '_auto_backup', val);
    }
  } catch (e) {
    // Quota exceeded or disabled localStorage - save to IndexedDB asynchronously
    idbSet(key, val);
    if (Array.isArray(val) && val.length > 0) {
      idbSet(key + '_auto_backup', val);
    }
  }
}

export async function createFullLocalBackup(store: any): Promise<void> {
  try {
    if (!store) return;
    await idbSet('sc_full_backup_latest', store);
    await idbSet('sc_full_backup_' + new Date().toISOString().slice(0, 10), store);
  } catch {
    // fail silently
  }
}

export async function getLatestFullLocalBackup(): Promise<any | null> {
  try {
    const latest = await idbGet<any>('sc_full_backup_latest');
    if (latest) return latest;
    // Fallback: check individual arrays
    const items = (await idbGet<any[]>('sc_items_auto_backup')) || (await idbGet<any[]>('sc_items'));
    const requests = (await idbGet<any[]>('sc_requests_auto_backup')) || (await idbGet<any[]>('sc_requests'));
    const pos = (await idbGet<any[]>('sc_pos_auto_backup')) || (await idbGet<any[]>('sc_pos'));
    const receives = (await idbGet<any[]>('sc_receives_auto_backup')) || (await idbGet<any[]>('sc_receives'));
    const issued = (await idbGet<any[]>('sc_issued_auto_backup')) || (await idbGet<any[]>('sc_issued'));
    const users = await idbGet<any[]>('sc_users');
    if ((items && items.length > 0) || (requests && requests.length > 0) || (pos && pos.length > 0)) {
      return { items, requests, pos, receives, issued, users };
    }
    return null;
  } catch {
    return null;
  }
}

