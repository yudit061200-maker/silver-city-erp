import express from 'express';
import path from 'path';
import fs from 'fs';
import {
  importedItems,
  importedRequests,
  importedPOs,
  importedReceives,
  importedIssued,
  importedUsers,
  SPREADSHEET_DATA_VERSION
} from '../src/data/spreadsheetImport';

const app = express();
app.use(express.json({ limit: '50mb' }));

const ROOT_DATA_FILE = path.join(process.cwd(), 'data_store.json');
const TMP_DATA_FILE = process.env.VERCEL
  ? path.join('/tmp', 'data_store.json')
  : ROOT_DATA_FILE;

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
    dataVersion: SPREADSHEET_DATA_VERSION,
    lastUpdated: 0
  };
}

let inMemoryStore: any = null;

function loadStore() {
  if (inMemoryStore && inMemoryStore.items && inMemoryStore.lastUpdated > 0) {
    return inMemoryStore;
  }

  // 1. Try target data file (/tmp on Vercel, root locally)
  try {
    if (fs.existsSync(TMP_DATA_FILE)) {
      const content = fs.readFileSync(TMP_DATA_FILE, 'utf-8');
      const data = JSON.parse(content);
      if (
        data &&
        Array.isArray(data.items) &&
        data.dataVersion === SPREADSHEET_DATA_VERSION
      ) {
        inMemoryStore = data;
        return data;
      }
    }
  } catch (err) {
    console.error('Failed to load data store from tmp:', err);
  }

  // 2. On Vercel, try root data_store.json if /tmp is not yet created
  if (process.env.VERCEL && fs.existsSync(ROOT_DATA_FILE)) {
    try {
      const content = fs.readFileSync(ROOT_DATA_FILE, 'utf-8');
      const data = JSON.parse(content);
      if (
        data &&
        Array.isArray(data.items) &&
        data.dataVersion === SPREADSHEET_DATA_VERSION
      ) {
        const seedData = { ...data, lastUpdated: 0 };
        saveStore(seedData);
        return seedData;
      }
    } catch (err) {
      console.error('Failed to load data store from root:', err);
    }
  }

  // 3. Fallback to full initial spreadsheet dataset
  const init = getInitialStore();
  saveStore(init);
  return init;
}

function saveStore(data: any) {
  try {
    data.lastUpdated = data.lastUpdated !== undefined ? data.lastUpdated : 0;
    inMemoryStore = data;
    fs.writeFileSync(TMP_DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save data store:', err);
  }
}

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
    dataVersion: SPREADSHEET_DATA_VERSION,
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

export default app;
