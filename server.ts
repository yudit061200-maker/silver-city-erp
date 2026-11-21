import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

// Initial dataset fallback definitions
import {
  importedItems,
  importedRequests,
  importedPOs,
  importedReceives,
  importedIssued,
  importedUsers
} from './src/data/spreadsheetImport.js';

const PORT = 3000;
const DATA_FILE = path.join(process.cwd(), 'data_store.json');

const defaultItems: any[] = importedItems || [];
const defaultRequests: any[] = importedRequests || [];
const defaultPOs: any[] = importedPOs || [];
const defaultReceives: any[] = importedReceives || [];
const defaultIssued: any[] = importedIssued || [];

const defaultUsers: any[] = (importedUsers && importedUsers.length > 0) ? importedUsers : [
  { _rowIndex: 2, Username: 'admin', Password: '123', Role: 'Admin', Fullname: 'System Admin' },
  { _rowIndex: 3, Username: 'operator', Password: '123', Role: 'Operator', Fullname: 'Rig Material Man' }
];

function getInitialStore() {
  return {
    items: defaultItems,
    requests: defaultRequests,
    pos: defaultPOs,
    receives: defaultReceives,
    issued: defaultIssued,
    users: defaultUsers,
    lastUpdated: 0
  };
}

let inMemoryStore: any = null;

function loadStore() {
  if (inMemoryStore && inMemoryStore.items) {
    return inMemoryStore;
  }
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      const data = JSON.parse(content);
      if (data && Array.isArray(data.items)) {
        inMemoryStore = data;
        return data;
      }
    }
  } catch (err) {
    console.error('Failed to load data store from file:', err);
  }
  const init = getInitialStore();
  saveStore(init);
  return init;
}

function saveStore(data: any) {
  try {
    data.lastUpdated = data.lastUpdated !== undefined ? data.lastUpdated : 0;
    inMemoryStore = data;
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save data store to file:', err);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  // API Routes
  let cachedFirestoreWriteStatus: { writable: boolean; checkedAt: number; reason?: string } | null = null;

  app.get('/api/firestore/write-status', async (req, res) => {
    const force = req.query.force === '1' || req.query.force === 'true';
    const now = Date.now();
    if (!force && cachedFirestoreWriteStatus) {
      const ttl = cachedFirestoreWriteStatus.writable ? 60_000 : 180_000;
      if (now - cachedFirestoreWriteStatus.checkedAt < ttl) {
        res.json({ status: 'ok', ...cachedFirestoreWriteStatus });
        return;
      }
    }

    try {
      const cfgPath = path.join(process.cwd(), 'firebase-applet-config.json');
      if (!fs.existsSync(cfgPath)) {
        res.json({ status: 'ok', writable: true });
        return;
      }
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      const dbId = cfg.firestoreDatabaseId || '(default)';
      const url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${dbId}/documents/erp/_quota_probe?key=${cfg.apiKey}`;
      const probeRes = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { ts: { integerValue: String(now) } } }),
      });

      if (probeRes.status === 429) {
        cachedFirestoreWriteStatus = { writable: false, checkedAt: now, reason: 'resource-exhausted' };
        res.json({ status: 'ok', ...cachedFirestoreWriteStatus });
        return;
      }

      if (probeRes.ok) {
        cachedFirestoreWriteStatus = { writable: true, checkedAt: now };
        res.json({ status: 'ok', ...cachedFirestoreWriteStatus });
        return;
      }

      const bodyText = await probeRes.text().catch(() => '');
      if (bodyText.toLowerCase().includes('resource_exhausted') || bodyText.toLowerCase().includes('quota limit exceeded')) {
        cachedFirestoreWriteStatus = { writable: false, checkedAt: now, reason: 'resource-exhausted' };
        res.json({ status: 'ok', ...cachedFirestoreWriteStatus });
        return;
      }

      res.json({ status: 'ok', writable: true });
    } catch {
      res.json({ status: 'ok', writable: true });
    }
  });

  const toFirestoreValue = (val: any): any => {
    if (val === null || val === undefined) return { nullValue: null };
    if (typeof val === 'boolean') return { booleanValue: val };
    if (typeof val === 'number') {
      if (!Number.isFinite(val)) return { nullValue: null };
      if (Number.isInteger(val) && Number.isSafeInteger(val)) {
        return { integerValue: String(val) };
      }
      return { doubleValue: val };
    }
    if (typeof val === 'string') return { stringValue: val };
    if (Array.isArray(val)) {
      return { arrayValue: { values: val.map(toFirestoreValue) } };
    }
    if (typeof val === 'object') {
      const fields: Record<string, any> = {};
      Object.entries(val).forEach(([k, v]) => {
        if (v !== undefined) fields[k] = toFirestoreValue(v);
      });
      return { mapValue: { fields } };
    }
    return { stringValue: String(val) };
  };

  const getFirestoreRestBase = () => {
    const cfgPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (!fs.existsSync(cfgPath)) return null;
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
    const dbId = cfg.firestoreDatabaseId || '(default)';
    return {
      apiKey: cfg.apiKey,
      projectId: cfg.projectId,
      dbId,
      docRoot: `projects/${cfg.projectId}/databases/${dbId}/documents`,
      base: `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${dbId}/documents`,
    };
  };

  app.post('/api/firestore/commit', async (req, res) => {
    const { writes, deletes } = req.body || {};
    const writeList = Array.isArray(writes) ? writes : [];
    const deleteList = Array.isArray(deletes) ? deletes : [];
    if (writeList.length === 0 && deleteList.length === 0) {
      res.status(400).json({ status: 'error', message: 'Empty Firestore commit payload' });
      return;
    }

    const validCols = new Set(['erp', 'erp_buckets', 'erp_chunks']);
    for (const w of writeList) {
      if (!w || !validCols.has(String(w.collection)) || !w.docId || typeof w.docId !== 'string' || !w.data || typeof w.data !== 'object') {
        res.status(400).json({ status: 'error', message: 'Invalid Firestore commit write item' });
        return;
      }
    }
    for (const d of deleteList) {
      if (!d || !validCols.has(String(d.collection)) || !d.docId || typeof d.docId !== 'string') {
        res.status(400).json({ status: 'error', message: 'Invalid Firestore commit delete item' });
        return;
      }
    }

    const now = Date.now();
    try {
      const cfg = getFirestoreRestBase();
      if (!cfg) {
        res.json({ status: 'ok', ok: false, fallbackToSdk: true });
        return;
      }

      const firestoreWrites: any[] = [];
      for (const w of writeList) {
        const fields: Record<string, any> = {};
        Object.entries(w.data).forEach(([k, v]) => {
          if (v !== undefined) fields[k] = toFirestoreValue(v);
        });
        firestoreWrites.push({
          update: {
            name: `${cfg.docRoot}/${encodeURIComponent(w.collection)}/${encodeURIComponent(w.docId)}`,
            fields,
          },
        });
      }
      for (const d of deleteList) {
        firestoreWrites.push({
          delete: `${cfg.docRoot}/${encodeURIComponent(d.collection)}/${encodeURIComponent(d.docId)}`,
        });
      }

      const url = `${cfg.base}:commit?key=${cfg.apiKey}`;
      const fsRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ writes: firestoreWrites }),
      });

      if (fsRes.ok) {
        cachedFirestoreWriteStatus = { writable: true, checkedAt: now };
        res.json({ status: 'ok', ok: true });
        return;
      }

      const errText = await fsRes.text().catch(() => '');
      const isQuota =
        fsRes.status === 429 ||
        errText.toLowerCase().includes('resource_exhausted') ||
        errText.toLowerCase().includes('quota limit exceeded') ||
        errText.toLowerCase().includes('daily write units');

      if (isQuota) {
        cachedFirestoreWriteStatus = { writable: false, checkedAt: now, reason: 'resource-exhausted' };
        res.json({ status: 'ok', ok: false, quotaExceeded: true });
        return;
      }

      res.json({ status: 'ok', ok: false, error: errText.slice(0, 300) });
    } catch (err: any) {
      res.json({ status: 'ok', ok: false, error: err?.message || 'Firestore REST commit failed' });
    }
  });

  app.post('/api/firestore/write', async (req, res) => {
    const { collection, docId, data } = req.body || {};
    if (!['erp', 'erp_buckets', 'erp_chunks'].includes(String(collection)) || !docId || !data || typeof data !== 'object') {
      res.status(400).json({ status: 'error', message: 'Invalid Firestore write payload' });
      return;
    }
    const now = Date.now();
    try {
      const cfg = getFirestoreRestBase();
      if (!cfg) {
        res.json({ status: 'ok', ok: false, fallbackToSdk: true });
        return;
      }
      const fields: Record<string, any> = {};
      Object.entries(data).forEach(([k, v]) => {
        if (v !== undefined) fields[k] = toFirestoreValue(v);
      });
      const url = `${cfg.base}/${encodeURIComponent(collection)}/${encodeURIComponent(docId)}?key=${cfg.apiKey}`;
      const fsRes = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      });

      if (fsRes.ok) {
        cachedFirestoreWriteStatus = { writable: true, checkedAt: now };
        res.json({ status: 'ok', ok: true });
        return;
      }

      const errText = await fsRes.text().catch(() => '');
      const isQuota =
        fsRes.status === 429 ||
        errText.toLowerCase().includes('resource_exhausted') ||
        errText.toLowerCase().includes('quota limit exceeded') ||
        errText.toLowerCase().includes('daily write units');

      if (isQuota) {
        cachedFirestoreWriteStatus = { writable: false, checkedAt: now, reason: 'resource-exhausted' };
        res.json({ status: 'ok', ok: false, quotaExceeded: true });
        return;
      }

      res.json({ status: 'ok', ok: false, error: errText.slice(0, 300) });
    } catch (err: any) {
      res.json({ status: 'ok', ok: false, error: err?.message || 'Firestore REST write failed' });
    }
  });

  app.post('/api/firestore/delete', async (req, res) => {
    const { collection, docId } = req.body || {};
    if (!['erp', 'erp_buckets', 'erp_chunks'].includes(String(collection)) || !docId) {
      res.status(400).json({ status: 'error', message: 'Invalid Firestore delete payload' });
      return;
    }
    const now = Date.now();
    try {
      const cfg = getFirestoreRestBase();
      if (!cfg) {
        res.json({ status: 'ok', ok: false, fallbackToSdk: true });
        return;
      }
      const url = `${cfg.base}/${encodeURIComponent(collection)}/${encodeURIComponent(docId)}?key=${cfg.apiKey}`;
      const fsRes = await fetch(url, { method: 'DELETE' });
      if (fsRes.ok || fsRes.status === 404) {
        res.json({ status: 'ok', ok: true });
        return;
      }
      const errText = await fsRes.text().catch(() => '');
      const isQuota =
        fsRes.status === 429 ||
        errText.toLowerCase().includes('resource_exhausted') ||
        errText.toLowerCase().includes('quota limit exceeded');
      if (isQuota) {
        cachedFirestoreWriteStatus = { writable: false, checkedAt: now, reason: 'resource-exhausted' };
        res.json({ status: 'ok', ok: false, quotaExceeded: true });
        return;
      }
      res.json({ status: 'ok', ok: false, error: errText.slice(0, 300) });
    } catch (err: any) {
      res.json({ status: 'ok', ok: false, error: err?.message || 'Firestore REST delete failed' });
    }
  });

  app.get('/api/sync/version', (req, res) => {
    const store = loadStore();
    res.json({
      status: 'ok',
      lastUpdated: Number(store.lastUpdated) || 0,
      clientWriteId: store.clientWriteId || null,
    });
  });

  app.get('/api/sync', (req, res) => {
    const store = loadStore();
    res.json({ status: 'ok', store });
  });

  app.post('/api/sync', (req, res) => {
    const body = req.body || {};
    const store = body.store || body;
    if (!store || !Array.isArray(store.items)) {
      res.status(400).json({ status: 'error', message: 'Invalid store data structure' });
      return;
    }
    const current = loadStore();
    const updatedStore = {
      items: store.items !== undefined ? store.items : current.items,
      requests: store.requests !== undefined ? store.requests : current.requests,
      pos: store.pos !== undefined ? store.pos : current.pos,
      receives: store.receives !== undefined ? store.receives : current.receives,
      issued: store.issued !== undefined ? store.issued : current.issued,
      users: store.users !== undefined ? store.users : current.users,
      companyHeader: store.companyHeader || current.companyHeader,
      savedDocHeaders: store.savedDocHeaders || current.savedDocHeaders,
      customColHeaders: store.customColHeaders || current.customColHeaders,
      dataVersion: store.dataVersion || current.dataVersion,
      clientWriteId: store.clientWriteId || current.clientWriteId || null,
      lastUpdated: store.lastUpdated || Date.now()
    };
    saveStore(updatedStore);
    res.json({ status: 'ok', lastUpdated: updatedStore.lastUpdated, clientWriteId: updatedStore.clientWriteId });
  });

  app.post('/api/sync/reset', (req, res) => {
    const init = getInitialStore();
    saveStore(init);
    res.json({ status: 'ok', store: init });
  });

  // Vite middleware in dev, static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
