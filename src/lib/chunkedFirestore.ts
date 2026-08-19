import { db, doc, getDoc, setDoc, deleteDoc } from './firebase';

const CHUNK_SIZE = 1000;
let isFirestoreQuotaExceeded = false;

export function getIsFirestoreQuotaExceeded(): boolean {
  return isFirestoreQuotaExceeded;
}

export function setFirestoreQuotaExceeded(value: boolean): void {
  isFirestoreQuotaExceeded = value;
}

function sanitize(obj: any): any {
  if (!obj) return obj;
  return JSON.parse(JSON.stringify(obj, (_key, val) => (val === undefined ? null : val)));
}

function isQuotaError(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || '').toLowerCase();
  return (
    code === 'resource-exhausted' ||
    msg.includes('quota') ||
    msg.includes('quota limit exceeded') ||
    msg.includes('daily write units')
  );
}

export async function saveChunkedFirestore(storeObj: any): Promise<void> {
  if (isFirestoreQuotaExceeded) {
    // Skip Firestore cloud writes if project free quota is exhausted
    return;
  }

  try {
    const items = Array.isArray(storeObj.items) ? storeObj.items : [];
    
    // 1. Chunk items into smaller documents (max 1000 items per doc)
    const chunks: any[][] = [];
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      chunks.push(items.slice(i, i + CHUNK_SIZE));
    }

    // 2. Write each chunk to 'erp_chunks/chunk_X'
    const chunkPromises = chunks.map((chunk, idx) => {
      return setDoc(doc(db, 'erp_chunks', `chunk_${idx}`), {
        chunkIndex: idx,
        items: sanitize(chunk)
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
    } catch {
      // Ignore cleanup error
    }

    // 4. Save main store metadata WITHOUT the full items array to avoid 1MB document limit
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
      lastUpdated: storeObj.lastUpdated
    };

    await setDoc(doc(db, 'erp', 'main_store'), mainManifest);
  } catch (err: any) {
    if (isQuotaError(err)) {
      isFirestoreQuotaExceeded = true;
      console.warn("Firestore daily free write quota exceeded. Automatically switching to local server and IndexedDB storage.");
      return;
    }
    throw err;
  }
}

export async function loadChunkedFirestore(mainData: any): Promise<any> {
  if (!mainData) return null;

  try {
    const resultStore = { ...mainData };

    // If chunkCount is defined, fetch item chunks from 'erp_chunks'
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
    if (isQuotaError(err)) {
      isFirestoreQuotaExceeded = true;
      console.warn("Firestore read quota exceeded, using local cached data store.");
      return mainData;
    }
    return mainData;
  }
}

