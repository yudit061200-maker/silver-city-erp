import { db, doc, getDoc, getDocFromServer, setDoc, deleteDoc } from './firebase';

const LEGACY_CHUNK_SIZE = 1000;
const BUCKET_SIZES = {
  items: 60,
  requests: 90,
  receives: 90,
  issued: 90,
  pos: 90,
} as const;

type BucketCollectionKey = keyof typeof BUCKET_SIZES;
const BUCKET_COLLECTIONS: BucketCollectionKey[] = [
  'items',
  'requests',
  'receives',
  'issued',
  'pos',
];

const FIRESTORE_WRITE_TIMEOUT_MS = 4500;
const QUOTA_RETRY_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes; resets immediately if user clicks retry
const QUOTA_STORAGE_KEY = 'sc_firestore_quota_blocked_until';

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
let quotaExceededAt = 0;

function readPersistedQuotaUntil(): number {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(QUOTA_STORAGE_KEY);
      const val = raw ? Number(raw) : 0;
      return Number.isFinite(val) ? val : 0;
    }
  } catch {
    // Ignore storage errors
  }
  return 0;
}

function persistQuotaCooldown(): void {
  const until = Date.now() + QUOTA_RETRY_COOLDOWN_MS;
  firestoreQuotaExceeded = true;
  quotaExceededAt = Date.now();
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(QUOTA_STORAGE_KEY, String(until));
    }
  } catch {
    // Ignore storage errors
  }
}

// Client-side bucket caches so writes only touch changed buckets AND reads skip unchanged buckets
const lastKnownBucketHashes = new Map<string, string>();
const lastKnownBucketData = new Map<string, any[]>();
let lastKnownBucketCounts: Partial<Record<BucketCollectionKey, number>> = {};

export function isFirestoreQuotaExceeded(): boolean {
  const persistedUntil = readPersistedQuotaUntil();
  if (persistedUntil > Date.now()) {
    firestoreQuotaExceeded = true;
    return true;
  }
  if (firestoreQuotaExceeded && Date.now() - quotaExceededAt > QUOTA_RETRY_COOLDOWN_MS) {
    firestoreQuotaExceeded = false;
  }
  return firestoreQuotaExceeded;
}

let lastWritableVerifiedAt = 0;

export function resetFirestoreQuotaFlag(): void {
  firestoreQuotaExceeded = false;
  quotaExceededAt = 0;
  lastWritableVerifiedAt = 0;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(QUOTA_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export async function checkFirestoreWritable(force = false): Promise<boolean> {
  if (!force && isFirestoreQuotaExceeded()) {
    return false;
  }
  if (!force && lastWritableVerifiedAt > 0 && Date.now() - lastWritableVerifiedAt < 60_000) {
    return true;
  }
  if (typeof fetch === 'undefined') {
    return true;
  }
  try {
    const res = await fetch(
      force ? '/api/firestore/write-status?force=1' : '/api/firestore/write-status',
      { cache: 'no-store' }
    );
    if (!res.ok) return true;
    const data = await res.json();
    if (data && data.writable === false) {
      lastWritableVerifiedAt = 0;
      persistQuotaCooldown();
      return false;
    }
    lastWritableVerifiedAt = Date.now();
    return true;
  } catch {
    return true;
  }
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
    msg.includes('daily write units') ||
    msg.includes('firestore write timed out')
  );
}

function withWriteTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new FirestoreQuotaError(
          `Firestore write timed out (${label}) — likely quota backoff`
        )
      );
    }, FIRESTORE_WRITE_TIMEOUT_MS);

    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function writeFirestoreDoc(
  collection: 'erp' | 'erp_buckets' | 'erp_chunks',
  docId: string,
  data: Record<string, any>
): Promise<void> {
  if (typeof fetch !== 'undefined') {
    try {
      const res = await fetch('/api/firestore/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection, docId, data }),
      });
      if (res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const json = await res.json();
          if (json?.ok) return;
          if (json?.quotaExceeded) {
            lastWritableVerifiedAt = 0;
            persistQuotaCooldown();
            throw new FirestoreQuotaError();
          }
          if (!json?.fallbackToSdk) {
            throw new Error(json?.error || `Firestore write failed for ${collection}/${docId}`);
          }
        }
      }
    } catch (err) {
      if (err instanceof FirestoreQuotaError || isQuotaExceededError(err)) {
        throw err;
      }
      // Fall back to SDK if /api/firestore/write is unavailable
    }
  }

  await withWriteTimeout(
    setDoc(doc(db, collection, docId), data),
    `${collection}/${docId}`
  );
}

async function deleteFirestoreDoc(
  collection: 'erp' | 'erp_buckets' | 'erp_chunks',
  docId: string
): Promise<void> {
  if (typeof fetch !== 'undefined') {
    try {
      const res = await fetch('/api/firestore/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection, docId }),
      });
      if (res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const json = await res.json();
          if (json?.ok) return;
          if (json?.quotaExceeded) {
            lastWritableVerifiedAt = 0;
            persistQuotaCooldown();
            throw new FirestoreQuotaError();
          }
          if (!json?.fallbackToSdk) {
            throw new Error(json?.error || `Firestore delete failed for ${collection}/${docId}`);
          }
        }
      }
    } catch (err) {
      if (err instanceof FirestoreQuotaError || isQuotaExceededError(err)) {
        throw err;
      }
    }
  }

  await withWriteTimeout(
    deleteDoc(doc(db, collection, docId)),
    `delete ${collection}/${docId}`
  );
}

function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  if (isQuotaExceededError(error)) {
    persistQuotaCooldown();
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
  if (obj === undefined) return null;
  if (obj === null) return null;
  return JSON.parse(
    JSON.stringify(obj, (_key, val) => (val === undefined ? null : val))
  );
}

function hashString(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(h2 >>> 0).toString(36)}_${(h1 >>> 0).toString(36)}_${input.length}`;
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
 * Direct write to Firebase Firestore using small diffed buckets (bucketed_v1).
 * Only changed ~10-18 KB buckets + a ~1.5 KB manifest are written, cutting write units by ~25x-40x.
 */
export async function saveChunkedFirestore(storeObj: any): Promise<void> {
  const canWrite = await checkFirestoreWritable();
  if (!canWrite) {
    throw new FirestoreQuotaError();
  }

  const nextBucketCounts: Record<BucketCollectionKey, number> = {
    items: 0,
    requests: 0,
    receives: 0,
    issued: 0,
    pos: 0,
  };
  const nextBucketHashes: Record<string, string> = {};
  const pendingWrites: Array<{ key: string; col: BucketCollectionKey; idx: number; rows: any[]; hash: string }> = [];
  const pendingDeletes: string[] = [];

  for (const col of BUCKET_COLLECTIONS) {
    const rawArr = Array.isArray(storeObj[col]) ? storeObj[col] : [];
    const rows = sanitize(rawArr) || [];
    const size = BUCKET_SIZES[col];
    const count = Math.ceil(rows.length / size);
    nextBucketCounts[col] = count;

    for (let idx = 0; idx < count; idx++) {
      const slice = rows.slice(idx * size, (idx + 1) * size);
      const key = `${col}_${idx}`;
      const hash = hashString(JSON.stringify(slice));
      nextBucketHashes[key] = hash;

      if (lastKnownBucketHashes.get(key) !== hash) {
        pendingWrites.push({ key, col, idx, rows: slice, hash });
      }
    }

    const prevCount = lastKnownBucketCounts[col] || 0;
    for (let idx = count; idx < prevCount; idx++) {
      pendingDeletes.push(`${col}_${idx}`);
    }
  }

  // Write changed buckets gently in small pairs using compact rowsJson to avoid burst rate limits and minimize index writes
  if (pendingWrites.length > 0) {
    try {
      const writeOneBucket = (b: typeof pendingWrites[number]) =>
        writeFirestoreDoc('erp_buckets', b.key, {
          collection: b.col,
          bucketIndex: b.idx,
          hash: b.hash,
          rowsJson: JSON.stringify(b.rows),
          updatedAt: storeObj.lastUpdated || Date.now(),
        });

      for (let i = 0; i < pendingWrites.length; i += 2) {
        const pair = pendingWrites.slice(i, i + 2);
        await Promise.all(pair.map(writeOneBucket));
      }

      pendingWrites.forEach((b) => {
        lastKnownBucketHashes.set(b.key, b.hash);
        lastKnownBucketData.set(b.key, b.rows);
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'erp_buckets');
    }
  }

  if (pendingDeletes.length > 0) {
    try {
      await Promise.all(
        pendingDeletes.map((key) => deleteFirestoreDoc('erp_buckets', key))
      );
      pendingDeletes.forEach((key) => {
        lastKnownBucketHashes.delete(key);
        lastKnownBucketData.delete(key);
      });
    } catch (cleanErr) {
      if (isQuotaExceededError(cleanErr)) {
        handleFirestoreError(cleanErr, OperationType.DELETE, 'erp_buckets');
      }
      console.warn('Firestore bucket cleanup info:', cleanErr);
    }
  }

  const itemCount = Array.isArray(storeObj.items) ? storeObj.items.length : 0;

  // Compact ~1.5 KB manifest in erp/main_store
  const mainManifest = {
    storageMode: 'bucketed_v1',
    bucketCounts: nextBucketCounts,
    bucketHashes: nextBucketHashes,
    itemCount,
    users: sanitize(storeObj.users || []),
    companyHeader: sanitize(storeObj.companyHeader || {}),
    savedDocHeaders: sanitize(storeObj.savedDocHeaders || {}),
    customColHeaders: sanitize(storeObj.customColHeaders || {}),
    dataVersion: storeObj.dataVersion,
    clientWriteId: storeObj.clientWriteId || null,
    lastUpdated: storeObj.lastUpdated || Date.now(),
  };

  try {
    await writeFirestoreDoc('erp', 'main_store', sanitize(mainManifest));
    lastKnownBucketCounts = { ...nextBucketCounts };
    resetFirestoreQuotaFlag();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'erp/main_store');
  }
}

function seedBucketCacheFromArrays(storeData: any): void {
  for (const col of BUCKET_COLLECTIONS) {
    const rows = sanitize(Array.isArray(storeData[col]) ? storeData[col] : []) || [];
    const size = BUCKET_SIZES[col];
    const count = Math.ceil(rows.length / size);
    lastKnownBucketCounts[col] = count;
    for (let idx = 0; idx < count; idx++) {
      const slice = rows.slice(idx * size, (idx + 1) * size);
      const key = `${col}_${idx}`;
      const hash = hashString(JSON.stringify(slice));
      lastKnownBucketHashes.set(key, hash);
      lastKnownBucketData.set(key, slice);
    }
  }
}

/**
 * Loads the full store from Firebase Firestore (supports both bucketed_v1 and legacy chunked format).
 * Always reads changed docs via getDocFromServer so other devices never read stale local cache.
 */
export async function loadChunkedFirestore(mainData: any): Promise<any> {
  if (!mainData) return null;

  try {
    const resultStore = { ...mainData };

    if (mainData.storageMode === 'bucketed_v1' && mainData.bucketCounts) {
      const bucketCounts = mainData.bucketCounts as Record<BucketCollectionKey, number>;
      const bucketHashes = (mainData.bucketHashes || {}) as Record<string, string>;

      await Promise.all(
        BUCKET_COLLECTIONS.map(async (col) => {
          const count = Number(bucketCounts[col]) || 0;
          const bucketPromises: Array<Promise<any[]>> = [];

          for (let idx = 0; idx < count; idx++) {
            const key = `${col}_${idx}`;
            const expectedHash = bucketHashes[key];

            if (
              expectedHash &&
              lastKnownBucketHashes.get(key) === expectedHash &&
              lastKnownBucketData.has(key)
            ) {
              bucketPromises.push(Promise.resolve(lastKnownBucketData.get(key)!));
            } else {
              const bucketRef = doc(db, 'erp_buckets', key);
              bucketPromises.push(
                getDocFromServer(bucketRef)
                  .catch(() => getDoc(bucketRef))
                  .then((snap) => {
                    if (!snap.exists()) return [];
                    const data = snap.data();
                    let rows: any[] = [];
                    if (typeof data?.rowsJson === 'string') {
                      try {
                        const parsed = JSON.parse(data.rowsJson);
                        if (Array.isArray(parsed)) rows = parsed;
                      } catch {
                        rows = [];
                      }
                    } else if (Array.isArray(data?.rows)) {
                      rows = data.rows;
                    }
                    const actualHash = expectedHash || hashString(JSON.stringify(sanitize(rows)));
                    lastKnownBucketHashes.set(key, actualHash);
                    lastKnownBucketData.set(key, rows);
                    return rows;
                  })
              );
            }
          }

          const bucketSlices = await Promise.all(bucketPromises);
          resultStore[col] = bucketSlices.flat();
          lastKnownBucketCounts[col] = count;
        })
      );

      return resultStore;
    }

    // Legacy format compatibility (erp_chunks/chunk_* + inline arrays in erp/main_store)
    if (typeof mainData.chunkCount === 'number' && mainData.chunkCount >= 0) {
      const chunkPromises = [];
      for (let i = 0; i < mainData.chunkCount; i++) {
        const chunkRef = doc(db, 'erp_chunks', `chunk_${i}`);
        chunkPromises.push(
          getDocFromServer(chunkRef).catch(() => getDoc(chunkRef))
        );
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
    } else if (!Array.isArray(mainData.items)) {
      resultStore.items = [];
    }

    // Important: do NOT seed bucket cache hashes for legacy mode as existing in Firestore
    // unless we want diffed future saves; keeping lastKnownBucketHashes empty ensures
    // first bucketed_v1 save writes all buckets cleanly once.
    if (mainData.storageMode === 'bucketed_v1') {
      seedBucketCacheFromArrays(resultStore);
    }

    return resultStore;
  } catch (err: any) {
    console.error('Error loading Firestore data:', err);
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

export { LEGACY_CHUNK_SIZE };
