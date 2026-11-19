import { RecordRow } from '../types';
import { parseNumberValue } from './currency';

export const LATEST_DATA_VERSION = 'v2026_11_20_simple_ids_dynamic_stock';

export function simplifyDocId(
  rawId: unknown,
  defaultPrefix?: 'MRQ' | 'MIS' | 'MRR' | 'PO'
): string {
  if (rawId === null || rawId === undefined) return '';
  const s = String(rawId).trim();
  if (!s) return '';
  if (!s.includes('/')) return s;

  const firstSeg = s.split('/')[0].trim();
  const typeSegMatch = s.match(/\/(MRQ|MIS|MRR|PO)\//i);
  const prefix = typeSegMatch
    ? typeSegMatch[1].toUpperCase()
    : defaultPrefix || '';

  if (!prefix) return s;

  if (/^[_-]+$/.test(firstSeg)) {
    return `${prefix}-${firstSeg}`;
  }

  const numAlpha = firstSeg.match(/^(\d+)([A-Za-z]*)$/);
  if (numAlpha) {
    return `${prefix}-${numAlpha[1].padStart(4, '0')}${numAlpha[2].toUpperCase()}`;
  }

  return `${prefix}-${firstSeg}`;
}

export function migrateStoreData<T extends Record<string, any>>(store: T): T {
  if (!store || typeof store !== 'object') return store;

  const items: RecordRow[] = Array.isArray(store.items) ? store.items : [];
  const requests: RecordRow[] = Array.isArray(store.requests) ? store.requests : [];
  const pos: RecordRow[] = Array.isArray(store.pos) ? store.pos : [];
  const receives: RecordRow[] = Array.isArray(store.receives) ? store.receives : [];
  const issued: RecordRow[] = Array.isArray(store.issued) ? store.issued : [];

  const hasHistoricalFlag =
    receives.some((r) => Boolean(r?.IsHistoricalImport)) ||
    issued.some((i) => Boolean(i?.IsHistoricalImport));

  const hasLongIds =
    requests.some((r) => String(r?.RequestID || '').includes('/')) ||
    pos.some((p) => String(p?.POID || '').includes('/')) ||
    receives.some(
      (r) =>
        String(r?.ReceiveID || '').includes('/') ||
        String(r?.MrqRef || '').includes('/')
    ) ||
    issued.some((i) => String(i?.IssueID || '').includes('/'));

  if (
    !hasHistoricalFlag &&
    !hasLongIds &&
    store.dataVersion === LATEST_DATA_VERSION
  ) {
    return store;
  }

  let nextItems = items;

  if (hasHistoricalFlag || store.dataVersion === 'v2026_11_19_all_docs_import') {
    const nonHistRcvByItem = new Map<string, number>();
    const totalRcvByItem = new Map<string, number>();
    receives.forEach((r) => {
      const code = String(r?.ItemID || '').trim().toLowerCase();
      if (!code) return;
      const qty = parseNumberValue(r?.Qty);
      totalRcvByItem.set(code, (totalRcvByItem.get(code) || 0) + qty);
      if (!r?.IsHistoricalImport) {
        nonHistRcvByItem.set(code, (nonHistRcvByItem.get(code) || 0) + qty);
      }
    });

    const nonHistIssByItem = new Map<string, number>();
    const totalIssByItem = new Map<string, number>();
    issued.forEach((i) => {
      const code = String(i?.ItemID || '').trim().toLowerCase();
      if (!code) return;
      const qty = parseNumberValue(i?.Qty);
      totalIssByItem.set(code, (totalIssByItem.get(code) || 0) + qty);
      if (!i?.IsHistoricalImport) {
        nonHistIssByItem.set(code, (nonHistIssByItem.get(code) || 0) + qty);
      }
    });

    nextItems = items.map((item) => {
      const code = String(item?.ItemID || '').trim().toLowerCase();
      const oldLastStock = parseNumberValue(
        item?.LastStock ?? item?.CurrentStock ?? item?.Stock ?? item?.Qty
      );
      const oldBaseIn = parseNumberValue(item?.BaseStockIn);
      const oldBaseOut = parseNumberValue(item?.BaseStockOut);
      const targetCurrentStock =
        oldLastStock +
        (oldBaseIn + (nonHistRcvByItem.get(code) || 0)) -
        (oldBaseOut + (nonHistIssByItem.get(code) || 0));

      const totalRcv = totalRcvByItem.get(code) || 0;
      const totalIss = totalIssByItem.get(code) || 0;
      const newLastStock = targetCurrentStock - totalRcv + totalIss;

      return {
        ...item,
        LastStock: newLastStock,
        BaseStockIn: 0,
        BaseStockOut: 0,
      };
    });
  }

  const nextRequests = requests.map((r) => ({
    ...r,
    RequestID: simplifyDocId(r?.RequestID, 'MRQ'),
  }));

  const nextPos = pos.map((p) => ({
    ...p,
    POID: simplifyDocId(p?.POID, 'PO'),
  }));

  const nextReceives = receives.map((r) => {
    const { IsHistoricalImport: _hist, ...rest } = r || {};
    const nextRow: RecordRow = {
      ...rest,
      ReceiveID: simplifyDocId(rest.ReceiveID, 'MRR'),
    };
    if (nextRow.MrqRef) {
      nextRow.MrqRef = simplifyDocId(nextRow.MrqRef, 'MRQ');
    }
    if (nextRow.MRQNo) {
      nextRow.MRQNo = simplifyDocId(nextRow.MRQNo, 'MRQ');
    }
    return nextRow;
  });

  const nextIssued = issued.map((i) => {
    const { IsHistoricalImport: _hist, ...rest } = i || {};
    return {
      ...rest,
      IssueID: simplifyDocId(rest.IssueID, 'MIS'),
    };
  });

  const nextSavedDocHeaders: Record<string, any> = {};
  if (store.savedDocHeaders && typeof store.savedDocHeaders === 'object') {
    Object.entries(store.savedDocHeaders).forEach(([key, val]) => {
      const simpleKey = simplifyDocId(key);
      if (val && typeof val === 'object') {
        const headerObj: Record<string, any> = { ...(val as Record<string, any>) };
        if (headerObj.RequestID) {
          headerObj.RequestID = simplifyDocId(headerObj.RequestID);
        }
        if (headerObj.MrqRef) {
          headerObj.MrqRef = simplifyDocId(headerObj.MrqRef, 'MRQ');
        }
        nextSavedDocHeaders[simpleKey] = headerObj;
      } else {
        nextSavedDocHeaders[simpleKey] = val;
      }
    });
  }

  return {
    ...store,
    items: nextItems,
    requests: nextRequests,
    pos: nextPos,
    receives: nextReceives,
    issued: nextIssued,
    savedDocHeaders: nextSavedDocHeaders,
    dataVersion: LATEST_DATA_VERSION,
  };
}
