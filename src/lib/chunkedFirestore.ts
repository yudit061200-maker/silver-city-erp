import { db, doc, getDoc, getDocFromServer, setDoc, deleteDoc } from './firebase';

const CHUNK_SIZE = 1000;

export const FIRESTORE_DATABASE_UPGRADE_URL =
  'https://console.firebase.google.com/project/fit-figure-r9v0l/firestore/databases/ai-studio-silvercityerp-57d30aeb-3d0d-4926-a14c-c6ef54533a4a/data?openUpgradeDialog=true';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | null;
    email: string | null;
    emailVerified: boolean | null;
    isAnonymous: boolean | null;
    tenantId: string | null;
    providerInfo: Array<{ providerId?: string | null; email?: string | null }>;
  };
}

export class FirestoreQuotaError extends Error {
  code = 'resource-exhausted';
  constructor(message = 'Firestore daily write quota exceeded') {
    super(message);
    this.name = 'FirestoreQuotaError';
  }
}

let firestoreQuotaExceeded = false;
let lastKnownItemsJson: string | null = null;
let lastKnownChunkCount: number | null = null;

export function isFirestoreQuotaExceeded(): boolean {
  return firestoreQuotaExceeded;
}

export function isQuotaExceededError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof FirestoreQuotaError) return true;
  const code = String((err as any)?.code || '').toLowerCase();
  const msg = String((err as any)?.message || err || '').toLowerCase();
  return (
    code === 'resource-exhausted' ||
    msg.includes('resource-exhausted') ||
    msg.includes('quota limit exceeded') ||
    msg.includes('daily write units')
  );
}

function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  if (isQuotaExceededError(error)) {
    firestoreQuotaExceeded = true;
    throw new FirestoreQuotaError(
      error instanceof Error ? error.message : String(error)
    );
  }

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function sanitize(obj: any): any {
  if (!obj) return obj;
  return JSON.parse(
    JSON.stringify(obj, (_key, val) => (val === undefined ? null : val))
  );
}

/**
 * Purges all stale legacy dataset keys from localStorage and IndexedDB
 * ensuring the application relies strictly on server/Firestore sync.
 */
export function purgeLocalStorageDataset(): void {
  try {
    const keysToRemove = [
      'sc_items',
      'sc_requests',
      'sc_pos',
      'sc_receives',
      'sc_issued',
      'sc_users',
      'sc_last_updated',
      'sc_company_header',
      'sc_doc_headers',
      'sc_custom_col_headers',
      'sc_data_version',
    ];
    keysToRemove.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {
        // Ignore
      }
    });

    if (typeof window !== 'undefined' && window.indexedDB) {
      try {
        window.indexedDB.deleteDatabase('SilverCityERP_DB');
      } catch {
        // Ignore
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Direct write to Firebase Firestore.
 * Only writes chunk documents if the items array actually changed to minimize Firestore write units.
 */
export async function saveChunkedFirestore(storeObj: any): Promise<void> {
  if (firestoreQuotaExceeded) {
    throw new FirestoreQuotaError();
  }

  const items = sanitize(Array.isArray(storeObj.items) ? storeObj.items : []);
  const itemsJson = JSON.stringify(items);

  // 1. Chunk items into smaller documents (max 1000 items per doc)
  const chunks: any[][] = [];
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    chunks.push(items.slice(i, i + CHUNK_SIZE));
  }

  // 2. Write item chunks ONLY when items actually changed since last load/save
  const itemsChanged = lastKnownItemsJson !== itemsJson;
  if (itemsChanged) {
    try {
      const chunkPromises = chunks.map((chunk, idx) =>
        setDoc(doc(db, 'erp_chunks', `chunk_${idx}`), {
          chunkIndex: idx,
          items: chunk,
          updatedAt: new Date().toISOString(),
        })
      );
      await Promise.all(chunkPromises);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'erp_chunks');
    }

    // 3. Remove leftover old chunks only if chunk count decreased
    if (lastKnownChunkCount !== null && lastKnownChunkCount > chunks.length) {
      try {
        const deletePromises = [];
        for (let i = chunks.length; i < lastKnownChunkCount; i++) {
          deletePromises.push(deleteDoc(doc(db, 'erp_chunks', `chunk_${i}`)));
        }
        await Promise.all(deletePromises);
      } catch (cleanErr) {
        if (isQuotaExceededError(cleanErr)) {
          handleFirestoreError(cleanErr, OperationType.DELETE, 'erp_chunks');
        }
        console.warn('Firestore chunk cleanup info:', cleanErr);
      }
    }
  }

  // 4. Save main store manifest directly to Firestore
  const mainManifest = {
    chunkCount: chunks.length,
    itemCount: items.length,
    requests: sanitize(storeObj.requests || []),
    pos: sanitize(storeObj.pos || []),
    receives: sanitize(storeObj.receives || []),
    issued: sanitize(storeObj.issued || []),
    users: sanitize(storeObj.users || []),
    companyHeader: sanitize(storeObj.companyHeader || {}),
    savedDocHeaders: sanitize(storeObj.savedDocHeaders || {}),
    customColHeaders: sanitize(storeObj.customColHeaders || {}),
    dataVersion: storeObj.dataVersion,
    lastUpdated: storeObj.lastUpdated || Date.now(),
  };

  try {
    await setDoc(doc(db, 'erp', 'main_store'), mainManifest);
    lastKnownItemsJson = itemsJson;
    lastKnownChunkCount = chunks.length;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'erp/main_store');
  }
}

/**
 * Loads the full chunked store from Firebase Firestore.
 */
export async function loadChunkedFirestore(mainData: any): Promise<any> {
  if (!mainData) return null;

  try {
    const resultStore = { ...mainData };

    if (typeof mainData.chunkCount === 'number' && mainData.chunkCount >= 0) {
      const chunkPromises = [];
      for (let i = 0; i < mainData.chunkCount; i++) {
        chunkPromises.push(getDoc(doc(db, 'erp_chunks', `chunk_${i}`)));
      }
      const snaps = await Promise.all(chunkPromises);
      const combinedItems: any[] = [];
      snaps.forEach((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data.items)) {
            combinedItems.push(...data.items);
          }
        }
      });
      resultStore.items = combinedItems;
      lastKnownItemsJson = JSON.stringify(sanitize(combinedItems));
      lastKnownChunkCount = mainData.chunkCount;
    } else if (!Array.isArray(mainData.items)) {
      resultStore.items = [];
    } else {
      lastKnownItemsJson = JSON.stringify(sanitize(mainData.items));
      lastKnownChunkCount = 0;
    }

    return resultStore;
  } catch (err: any) {
    console.error('Error loading chunked Firestore data:', err);
    return mainData;
  }
}

/**
 * Direct fetch of the entire store from Firebase Firestore.
 * Uses getDocFromServer on initial boot to validate live connectivity.
 */
export async function fetchFullStoreFromFirestore(): Promise<any | null> {
  try {
    let mainSnap;
    try {
      mainSnap = await getDocFromServer(doc(db, 'erp', 'main_store'));
    } catch (serverErr: any) {
      if (
        serverErr instanceof Error &&
        serverErr.message.includes('the client is offline')
      ) {
        console.error('Please check your Firebase configuration.');
      }
      mainSnap = await getDoc(doc(db, 'erp', 'main_store'));
    }
    if (!mainSnap.exists()) return null;
    const rawData = mainSnap.data();
    return await loadChunkedFirestore(rawData);
  } catch (err) {
    console.warn('Failed to fetch full store from Firestore:', err);
    return null;
  }
}
