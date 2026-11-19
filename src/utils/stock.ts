import { RecordRow } from '../types';
import { parseNumberValue } from './currency';

export const normalizeDateStr = (dateVal: unknown): string => {
  if (dateVal === null || dateVal === undefined) return '';
  const raw = String(dateVal).trim();
  if (!raw) return '';
  // Strip time portion if ISO timestamp
  const datePart = raw.split('T')[0].trim();
  // Match YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return datePart;
  }
  // Match DD/MM/YYYY or MM/DD/YYYY -> convert to YYYY-MM-DD
  const dmyMatch = datePart.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const [, first, second, yyyy] = dmyMatch;
    const n1 = parseInt(first, 10);
    const n2 = parseInt(second, 10);
    if (n2 > 12 && n1 <= 12) {
      return `${yyyy}-${first.padStart(2, '0')}-${second.padStart(2, '0')}`;
    }
    return `${yyyy}-${second.padStart(2, '0')}-${first.padStart(2, '0')}`;
  }
  // Fallback parse
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return datePart;
};

interface IssuedStockCalcParams {
  itemCode: unknown;
  targetDate?: unknown;
  targetDocId?: unknown;
  currentRowQty?: unknown;
  rowIndexInDoc?: number;
  docItems?: RecordRow[];
  items: RecordRow[];
  receives: RecordRow[];
  issued: RecordRow[];
}

const extractDocSeq = (docId: string): number | null => {
  const m = docId.match(/(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
};

/**
 * Calculates Stock On Hand as of a specific Material Issued document/date:
 * LastStock + Receives (<= targetDate) - Prior Issued (< targetDate, or same date & earlier seq/created) - This Document Issued (up to current row).
 */
export const calculateIssuedStockOnHand = ({
  itemCode,
  targetDate,
  targetDocId,
  currentRowQty,
  rowIndexInDoc,
  docItems,
  items,
  receives,
  issued,
}: IssuedStockCalcParams): number | '' => {
  const normCode = String(itemCode || '').trim().toLowerCase();
  if (!normCode) return '';

  const matchedItem = items.find(
    (i) => String(i.ItemID || '').trim().toLowerCase() === normCode
  );
  if (!matchedItem) return '';

  const txDate = normalizeDateStr(targetDate);
  const normDocId = String(targetDocId || '').trim().toLowerCase();
  const targetSeq = normDocId ? extractDocSeq(normDocId) : null;

  const lastStock = parseNumberValue(
    matchedItem.LastStock ?? matchedItem.CurrentStock ?? matchedItem.Stock
  );
  const baseStockIn = parseNumberValue(matchedItem.BaseStockIn);
  const baseStockOut = parseNumberValue(matchedItem.BaseStockOut);

  // Stock In: include base stockIn + receives on or before txDate (or undated receives)
  const stockIn =
    baseStockIn +
    receives
      .filter((rcv) => {
        if (String(rcv.ItemID || '').trim().toLowerCase() !== normCode) return false;
        const rcvDate = normalizeDateStr(rcv.Date);
        if (!txDate || !rcvDate) return true;
        return rcvDate <= txDate;
      })
      .reduce((acc, curr) => acc + parseNumberValue(curr.Qty), 0);

  // Determine index bounds of the target document inside `issued`
  let targetDocFirstIdx = -1;
  if (normDocId) {
    targetDocFirstIdx = issued.findIndex(
      (iss) => String(iss.IssueID || '').trim().toLowerCase() === normDocId
    );
  }

  // Prior Stock Out: base stockOut + OTHER IssueID documents up to targetDate
  const priorStockOut =
    baseStockOut +
    issued
      .filter((iss, issIdx) => {
        if (String(iss.ItemID || '').trim().toLowerCase() !== normCode) return false;

        const issDocId = String(iss.IssueID || '').trim().toLowerCase();
        // Skip rows belonging to the current document (those are summed via docItems below)
        if (normDocId && issDocId === normDocId) return false;

        const issDate = normalizeDateStr(iss.Date);

        if (txDate && issDate) {
          if (issDate < txDate) return true;
          if (issDate > txDate) return false;

          // Same date, different document: compare doc sequence number if available
          const issSeq = extractDocSeq(issDocId);
          if (targetSeq !== null && issSeq !== null && issSeq !== targetSeq) {
            return issSeq < targetSeq;
          }

          if (targetDocFirstIdx === -1) return true;
          return issIdx > targetDocFirstIdx;
        }

        // Fallback if either record lacks a date
        if (targetDocFirstIdx === -1) return true;
        return issIdx > targetDocFirstIdx;
      })
      .reduce((acc, curr) => acc + parseNumberValue(curr.Qty), 0);

  // Stock Out from the CURRENT document up to and including the current row
  let thisDocOut = 0;
  if (docItems && docItems.length > 0 && rowIndexInDoc !== undefined && rowIndexInDoc >= 0) {
    for (let i = 0; i <= rowIndexInDoc && i < docItems.length; i++) {
      const row = docItems[i];
      if (String(row.ItemID || '').trim().toLowerCase() === normCode) {
        thisDocOut += parseNumberValue(row.Qty);
      }
    }
  } else {
    thisDocOut = parseNumberValue(currentRowQty);
  }

  return lastStock + stockIn - priorStockOut - thisDocOut;
};
