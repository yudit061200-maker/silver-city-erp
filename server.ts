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
      lastUpdated: store.lastUpdated || Date.now()
    };
    saveStore(updatedStore);
    res.json({ status: 'ok', lastUpdated: updatedStore.lastUpdated });
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
