import { TAB_SCHEMAS, TabName, RecordRow } from '../types';

export interface SpreadsheetConfig {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
  autoSync: boolean;
  lastSyncedAt?: string;
}

const SUPPORTED_TABS: TabName[] = [
  'ItemList',
  'MaterialRequest',
  'PurchaseOrder',
  'MaterialReceive',
  'MaterialIssued',
  'Users'
];

/**
 * Creates a brand new Google Spreadsheet configured with all ERP sheets & headers
 */
export async function createERPSpreadsheet(
  accessToken: string,
  title: string = 'PT Silver City Drilling - Live ERP Database'
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const sheets = SUPPORTED_TABS.map((tab) => ({
    properties: {
      title: tab,
      gridProperties: {
        frozenRowCount: 1
      }
    }
  }));

  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        title
      },
      sheets
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gagal membuat Google Spreadsheet: ${errText}`);
  }

  const data = await res.json();
  const spreadsheetId = data.spreadsheetId;
  const spreadsheetUrl = data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  return { spreadsheetId, spreadsheetUrl };
}

/**
 * Gets sheet metadata including Sheet IDs needed for batchUpdates
 */
export async function getSpreadsheetDetails(
  accessToken: string,
  spreadsheetId: string
): Promise<{ title: string; sheets: { sheetId: number; title: string }[] }> {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties(sheetId,title)`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!res.ok) {
    throw new Error('Spreadsheet tidak ditemukan atau izin akses ditolak');
  }

  const data = await res.json();
  const sheets = (data.sheets || []).map((s: any) => ({
    sheetId: s.properties.sheetId,
    title: s.properties.title
  }));

  return {
    title: data.properties?.title || 'Google Spreadsheet',
    sheets
  };
}

/**
 * Ensures required ERP sheets exist in the spreadsheet
 */
export async function ensureERPSheetsExist(
  accessToken: string,
  spreadsheetId: string,
  existingSheets: { sheetId: number; title: string }[]
): Promise<Map<string, number>> {
  const sheetMap = new Map<string, number>();
  existingSheets.forEach(s => sheetMap.set(s.title, s.sheetId));

  const missingTabs = SUPPORTED_TABS.filter(tab => !sheetMap.has(tab));

  if (missingTabs.length > 0) {
    const requests = missingTabs.map(tab => ({
      addSheet: {
        properties: {
          title: tab,
          gridProperties: { frozenRowCount: 1 }
        }
      }
    }));

    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requests })
    });

    if (res.ok) {
      const respData = await res.json();
      (respData.replies || []).forEach((reply: any) => {
        if (reply.addSheet?.properties) {
          sheetMap.set(reply.addSheet.properties.title, reply.addSheet.properties.sheetId);
        }
      });
    }
  }

  return sheetMap;
}

/**
 * Push all ERP data to Google Spreadsheet (all sheets populated at once)
 */
export async function syncAllDataToSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  store: {
    items: RecordRow[];
    requests: RecordRow[];
    pos: RecordRow[];
    receives: RecordRow[];
    issued: RecordRow[];
    users: RecordRow[];
  }
): Promise<boolean> {
  const details = await getSpreadsheetDetails(accessToken, spreadsheetId);
  await ensureERPSheetsExist(accessToken, spreadsheetId, details.sheets);

  const valueRanges: any[] = [];

  const tabDataMap: Record<string, RecordRow[]> = {
    ItemList: store.items || [],
    MaterialRequest: store.requests || [],
    PurchaseOrder: store.pos || [],
    MaterialReceive: store.receives || [],
    MaterialIssued: store.issued || [],
    Users: store.users || []
  };

  for (const tab of SUPPORTED_TABS) {
    const headers = TAB_SCHEMAS[tab] || [];
    const rows = tabDataMap[tab] || [];

    const tableValues: any[][] = [headers];

    rows.forEach(row => {
      const rowValues = headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        return String(val);
      });
      tableValues.push(rowValues);
    });

    // Clear and write full sheet range
    valueRanges.push({
      range: `${tab}!A1:Z${Math.max(tableValues.length + 10, 50)}`,
      values: tableValues
    });
  }

  // Clear existing values on these sheets first
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ranges: SUPPORTED_TABS.map(t => `${t}!A1:Z5000`)
    })
  });

  // Write new values
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: valueRanges
    })
  });

  return res.ok;
}

/**
 * Appends a newly added ERP row directly to Google Sheets
 */
export async function syncRowAddedToSheet(
  accessToken: string,
  spreadsheetId: string,
  tab: TabName,
  rowData: RecordRow
): Promise<void> {
  const headers = TAB_SCHEMAS[tab] || [];
  if (headers.length === 0) return;

  const rowValues = headers.map(h => {
    const val = rowData[h];
    return val !== undefined && val !== null ? String(val) : '';
  });

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${tab}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [rowValues]
      })
    }
  );

  if (!res.ok) {
    console.warn(`Gagal menambah data ke Google Sheet tab ${tab}:`, await res.text());
  }
}

/**
 * Finds a row by its primary key in Google Sheet and updates that row
 */
export async function syncRowUpdatedInSheet(
  accessToken: string,
  spreadsheetId: string,
  tab: TabName,
  primaryKeyField: string,
  primaryKeyValue: string | number,
  rowData: RecordRow
): Promise<void> {
  const headers = TAB_SCHEMAS[tab] || [];
  if (headers.length === 0) return;

  const pkStr = String(primaryKeyValue || '').trim().toLowerCase();
  if (!pkStr) return;

  // 1. Fetch current sheet values to locate the row index
  const readRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${tab}!A1:Z5000`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  if (!readRes.ok) return;
  const readData = await readRes.json();
  const values: string[][] = readData.values || [];

  if (values.length <= 1) {
    // If empty or only header, just append
    await syncRowAddedToSheet(accessToken, spreadsheetId, tab, rowData);
    return;
  }

  const sheetHeaders = values[0].map(h => h.trim());
  const pkColIdx = sheetHeaders.findIndex(h => h.toLowerCase() === primaryKeyField.toLowerCase());

  if (pkColIdx === -1) {
    // Column not found, fallback to append
    await syncRowAddedToSheet(accessToken, spreadsheetId, tab, rowData);
    return;
  }

  // Find 1-based row number
  let targetRowNumber = -1;
  for (let i = 1; i < values.length; i++) {
    const cellVal = String(values[i][pkColIdx] || '').trim().toLowerCase();
    if (cellVal === pkStr) {
      targetRowNumber = i + 1;
      break;
    }
  }

  const updatedValues = sheetHeaders.map(h => {
    const val = rowData[h];
    return val !== undefined && val !== null ? String(val) : '';
  });

  if (targetRowNumber > 0) {
    // Update existing row
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${tab}!A${targetRowNumber}:Z${targetRowNumber}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [updatedValues]
        })
      }
    );
  } else {
    // Row not found in sheet, append it
    await syncRowAddedToSheet(accessToken, spreadsheetId, tab, rowData);
  }
}

/**
 * Deletes a row by primary key from Google Sheet
 */
export async function syncRowDeletedFromSheet(
  accessToken: string,
  spreadsheetId: string,
  tab: TabName,
  primaryKeyField: string,
  primaryKeyValue: string | number
): Promise<void> {
  const pkStr = String(primaryKeyValue || '').trim().toLowerCase();
  if (!pkStr) return;

  const details = await getSpreadsheetDetails(accessToken, spreadsheetId);
  const targetSheet = details.sheets.find(s => s.title.toLowerCase() === tab.toLowerCase());
  if (!targetSheet) return;

  // 1. Read sheet to find row index
  const readRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${tab}!A1:Z5000`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  if (!readRes.ok) return;
  const readData = await readRes.json();
  const values: string[][] = readData.values || [];
  if (values.length <= 1) return;

  const sheetHeaders = values[0].map(h => h.trim());
  const pkColIdx = sheetHeaders.findIndex(h => h.toLowerCase() === primaryKeyField.toLowerCase());
  if (pkColIdx === -1) return;

  let zeroBasedRowIdx = -1;
  for (let i = 1; i < values.length; i++) {
    const cellVal = String(values[i][pkColIdx] || '').trim().toLowerCase();
    if (cellVal === pkStr) {
      zeroBasedRowIdx = i;
      break;
    }
  }

  if (zeroBasedRowIdx > 0) {
    // Delete row dimension
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: targetSheet.sheetId,
                dimension: 'ROWS',
                startIndex: zeroBasedRowIdx,
                endIndex: zeroBasedRowIdx + 1
              }
            }
          }
        ]
      })
    });
  }
}

/**
 * Pull and parse all data from connected Google Spreadsheet to ERP state
 */
export async function fetchSpreadsheetDataToERP(
  accessToken: string,
  spreadsheetId: string
): Promise<{
  items?: RecordRow[];
  requests?: RecordRow[];
  pos?: RecordRow[];
  receives?: RecordRow[];
  issued?: RecordRow[];
  users?: RecordRow[];
}> {
  const ranges = SUPPORTED_TABS.map(t => `${t}!A1:Z5000`);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?ranges=${ranges.map(encodeURIComponent).join('&ranges=')}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  if (!res.ok) {
    throw new Error('Gagal mengambil data dari Google Spreadsheet');
  }

  const data = await res.json();
  const result: any = {};

  (data.valueRanges || []).forEach((vr: any) => {
    const rangeName = vr.range || '';
    const tabName = SUPPORTED_TABS.find(t => rangeName.startsWith(t) || rangeName.includes(t));
    if (!tabName) return;

    const values: string[][] = vr.values || [];
    if (values.length <= 1) return;

    const headers = values[0].map(h => h.trim());
    const parsedRows: RecordRow[] = [];

    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      const hasContent = row.some(cell => cell && String(cell).trim().length > 0);
      if (!hasContent) continue;

      const rowObj: RecordRow = { _rowIndex: r + 1 };
      headers.forEach((h, cIdx) => {
        rowObj[h] = row[cIdx] !== undefined ? row[cIdx] : '';
      });
      parsedRows.push(rowObj);
    }

    if (tabName === 'ItemList') result.items = parsedRows;
    if (tabName === 'MaterialRequest') result.requests = parsedRows;
    if (tabName === 'PurchaseOrder') result.pos = parsedRows;
    if (tabName === 'MaterialReceive') result.receives = parsedRows;
    if (tabName === 'MaterialIssued') result.issued = parsedRows;
    if (tabName === 'Users') result.users = parsedRows;
  });

  return result;
}
