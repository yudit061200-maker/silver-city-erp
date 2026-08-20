import { db, doc, getDoc, setDoc, deleteDoc, onSnapshot } from './firebase';

const CHUNK_SIZE = 1000;

function sanitize(obj: any): any {
  if (!obj) return obj;
  return JSON.parse(JSON.stringify(obj, (_key, val) => (val === undefined ? null : val)));
}

/**
 * Purges all stale legacy dataset keys from localStorage and IndexedDB
 * ensuring the application relies strictly and directly on Firebase Firestore.
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
      'sc_data_version'
    ];
    keysToRemove.forEach(k => {
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
 * Breaks large items array into chunk documents and updates main_store manifest.
 */
export async function saveChunkedFirestore(storeObj: any): Promise<void> {
  try {
    const items = Array.isArray(storeObj.items) ? storeObj.items : [];
    
    // 1. Chunk items into smaller documents (max 1000 items per doc)
    const chunks: any[][] = [];
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      chunks.push(items.slice(i, i + CHUNK_SIZE));
    }

    // 2. Write each chunk to 'erp_chunks/chunk_X' in Firestore
    const chunkPromises = chunks.map((chunk, idx) => {
      return setDoc(doc(db, 'erp_chunks', `chunk_${idx}`), {
        chunkIndex: idx,
        items: sanitize(chunk),
        updatedAt: new Date().toISOString()
      });
    });

    await Promise.all(chunkPromises);

    // 3. Remove leftover old chunks if chunk count decreased
    try {
      const prevMetaSnap = await getDoc(doc(db, 'erp', 'main_store'));
      if (prevMetaSnap.exists()) {
        const prevMeta = prevMetaSnap.data();
        const prevCount = Number(prevMeta.chunkCount) || 0;
        if (prevCount > chunks.length) {
          const deletePromises = [];
          for (let i = chunks.length; i < prevCount; i++) {
            deletePromises.push(deleteDoc(doc(db, 'erp_chunks', `chunk_${i}`)));
          }
          await Promise.all(deletePromises);
        }
      }
    } catch (cleanErr) {
      console.warn("Firestore chunk cleanup info:", cleanErr);
    }

    // 4. Save main store metadata directly to Firestore
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
      lastUpdated: storeObj.lastUpdated || Date.now()
    };

    await setDoc(doc(db, 'erp', 'main_store'), mainManifest);
  } catch (err: any) {
    console.error("Direct Firestore save error:", err);
    throw err;
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
      snaps.forEach(snap => {
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

    return resultStore;
  } catch (err: any) {
    console.error("Error loading chunked Firestore data:", err);
    return mainData;
  }
}

/**
 * Direct fetch of the entire store from Firebase Firestore
 */
export async function fetchFullStoreFromFirestore(): Promise<any | null> {
  try {
    const mainSnap = await getDoc(doc(db, 'erp', 'main_store'));
    if (!mainSnap.exists()) return null;
    const rawData = mainSnap.data();
    return await loadChunkedFirestore(rawData);
  } catch (err) {
    console.error("Failed to fetch full store from Firestore:", err);
    return null;
  }
}
