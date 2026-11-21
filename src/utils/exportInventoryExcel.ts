import ExcelJS from 'exceljs';
import { RecordRow } from '../types';
import { parseNumberValue, DEFAULT_EXCHANGE_RATE } from './currency';
import { normalizeDateStr } from './stock';

export interface ExportInventoryExcelParams {
  items: RecordRow[];
  receives: RecordRow[];
  issued: RecordRow[];
  pos?: RecordRow[];
  year: number;
  month: number; // 1-12
}

export interface MonthlyTransactionSummary {
  itemCount: number;
  totalInQty: number;
  totalOutQty: number;
  inRecordCount: number;
  outRecordCount: number;
}

const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_SHORT_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const getExcelColLetter = (colNumber: number): string => {
  let col = colNumber;
  let letter = '';
  while (col > 0) {
    const rem = (col - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    col = Math.floor((col - 1) / 26);
  }
  return letter;
};

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Returns unique YYYY-MM strings found across receives & issued, sorted newest first.
 */
export function getAvailableTransactionMonths(
  receives: RecordRow[],
  issued: RecordRow[]
): string[] {
  const monthSet = new Set<string>();
  const collect = (rows: RecordRow[]) => {
    for (const r of rows) {
      const norm = normalizeDateStr(r.Date);
      if (/^\d{4}-\d{2}-\d{2}$/.test(norm)) {
        monthSet.add(norm.slice(0, 7));
      }
    }
  };
  collect(receives);
  collect(issued);

  const now = new Date();
  monthSet.add(`${now.getFullYear()}-${pad2(now.getMonth() + 1)}`);

  return Array.from(monthSet).sort((a, b) => b.localeCompare(a));
}

export function getMonthlyInventorySummary({
  items,
  receives,
  issued,
  year,
  month,
}: Omit<ExportInventoryExcelParams, 'pos'>): MonthlyTransactionSummary {
  const ymPrefix = `${year}-${pad2(month)}-`;
  const itemIds = new Set(items.map(i => String(i.ItemID || '').trim().toLowerCase()).filter(Boolean));

  let totalInQty = 0;
  let inRecordCount = 0;
  for (const r of receives) {
    const normCode = String(r.ItemID || '').trim().toLowerCase();
    if (!itemIds.has(normCode)) continue;
    const normDate = normalizeDateStr(r.Date);
    if (normDate.startsWith(ymPrefix)) {
      totalInQty += parseNumberValue(r.Qty);
      inRecordCount++;
    }
  }

  let totalOutQty = 0;
  let outRecordCount = 0;
  for (const i of issued) {
    const normCode = String(i.ItemID || '').trim().toLowerCase();
    if (!itemIds.has(normCode)) continue;
    const normDate = normalizeDateStr(i.Date);
    if (normDate.startsWith(ymPrefix)) {
      totalOutQty += parseNumberValue(i.Qty);
      outRecordCount++;
    }
  }

  return {
    itemCount: items.length,
    totalInQty,
    totalOutQty,
    inRecordCount,
    outRecordCount,
  };
}

export async function exportInventoryToExcel({
  items,
  receives,
  issued,
  pos = [],
  year,
  month,
}: ExportInventoryExcelParams): Promise<string> {
  const daysInMonth = new Date(year, month, 0).getDate();
  const ymPrefix = `${year}-${pad2(month)}-`;
  const monthStartStr = `${year}-${pad2(month)}-01`;
  const monthNameEn = MONTH_NAMES_EN[month - 1] || 'Month';
  const monthShortEn = MONTH_SHORT_EN[month - 1] || 'Mon';
  const shortYear = String(year).slice(-2);

  const firstStockDateLabel = `1-${monthShortEn}-${shortYear}`;
  const transaksiTitleLabel = `TRANSAKSI\n${monthNameEn} 1, ${year}`;
  const endOfMonthDateLabel = `${pad2(daysInMonth)}/${pad2(month)}/${year}`;

  // Pre-index receives & issued by normalized ItemID for O(1) lookup per item
  interface ItemTxBucket {
    priorIn: number;
    priorOut: number;
    dailyIn: Map<number, number>;
    dailyOut: Map<number, number>;
    monthSuppliers: Set<string>;
    latestSupplier: string;
    latestSupplierDate: string;
  }

  const txMap = new Map<string, ItemTxBucket>();
  const ensureBucket = (normCode: string): ItemTxBucket => {
    let bucket = txMap.get(normCode);
    if (!bucket) {
      bucket = {
        priorIn: 0,
        priorOut: 0,
        dailyIn: new Map(),
        dailyOut: new Map(),
        monthSuppliers: new Set(),
        latestSupplier: '',
        latestSupplierDate: '',
      };
      txMap.set(normCode, bucket);
    }
    return bucket;
  };

  interface DetailTxRow {
    date: string;
    type: 'IN' | 'OUT';
    docNo: string;
    itemId: string;
    itemName: string;
    qty: number;
    uom: string;
    unitPriceUSD: number;
    totalPriceUSD: number;
    unitPriceIDR: number;
    totalPriceIDR: number;
    party: string;
    remark: string;
  }

  const resolveItemPrices = (record: RecordRow | undefined, fallbackItem?: RecordRow) => {
    let priceUSD = parseNumberValue(record?.UnitPriceUSD);
    let priceIDR = parseNumberValue(record?.UnitPriceIDR ?? record?.UnitPrice);
    if (priceUSD === 0 && priceIDR === 0 && fallbackItem) {
      priceUSD = parseNumberValue(fallbackItem.UnitPriceUSD);
      priceIDR = parseNumberValue(fallbackItem.UnitPriceIDR);
    }
    if (priceUSD === 0 && priceIDR > 0) {
      priceUSD = parseFloat((priceIDR / DEFAULT_EXCHANGE_RATE).toFixed(2));
    } else if (priceIDR === 0 && priceUSD > 0) {
      priceIDR = Math.round(priceUSD * DEFAULT_EXCHANGE_RATE);
    }
    return { priceUSD, priceIDR };
  };

  const detailRows: DetailTxRow[] = [];
  const itemLookup = new Map<string, RecordRow>();
  for (const item of items) {
    const normCode = String(item.ItemID || '').trim().toLowerCase();
    if (normCode) itemLookup.set(normCode, item);
  }

  for (const r of receives) {
    const normCode = String(r.ItemID || '').trim().toLowerCase();
    if (!normCode) continue;
    const bucket = ensureBucket(normCode);
    const qty = parseNumberValue(r.Qty);
    const normDate = normalizeDateStr(r.Date);
    const supplier = String(r.Supplier || '').trim();

    if (supplier) {
      if (!bucket.latestSupplier || (normDate && normDate >= bucket.latestSupplierDate)) {
        bucket.latestSupplier = supplier;
        bucket.latestSupplierDate = normDate;
      }
    }

    if (!normDate || normDate < monthStartStr) {
      bucket.priorIn += qty;
    } else if (normDate.startsWith(ymPrefix)) {
      const day = parseInt(normDate.slice(8, 10), 10);
      if (day >= 1 && day <= daysInMonth) {
        bucket.dailyIn.set(day, (bucket.dailyIn.get(day) || 0) + qty);
      }
      if (supplier) bucket.monthSuppliers.add(supplier);
      if (itemLookup.has(normCode)) {
        const matched = itemLookup.get(normCode);
        const { priceUSD, priceIDR } = resolveItemPrices(r, matched);
        detailRows.push({
          date: normDate,
          type: 'IN',
          docNo: String(r.ReceiveID || ''),
          itemId: String(r.ItemID || ''),
          itemName: String(r.ItemName || matched?.ItemName || ''),
          qty,
          uom: String(r.UoM || matched?.UoM || ''),
          unitPriceUSD: priceUSD,
          totalPriceUSD: parseFloat((qty * priceUSD).toFixed(2)),
          unitPriceIDR: priceIDR,
          totalPriceIDR: Math.round(qty * priceIDR),
          party: supplier,
          remark: String(r.Remark || ''),
        });
      }
    }
  }

  for (const i of issued) {
    const normCode = String(i.ItemID || '').trim().toLowerCase();
    if (!normCode) continue;
    const bucket = ensureBucket(normCode);
    const qty = parseNumberValue(i.Qty);
    const normDate = normalizeDateStr(i.Date);

    if (!normDate || normDate < monthStartStr) {
      bucket.priorOut += qty;
    } else if (normDate.startsWith(ymPrefix)) {
      const day = parseInt(normDate.slice(8, 10), 10);
      if (day >= 1 && day <= daysInMonth) {
        bucket.dailyOut.set(day, (bucket.dailyOut.get(day) || 0) + qty);
      }
      if (itemLookup.has(normCode)) {
        const matched = itemLookup.get(normCode);
        const { priceUSD, priceIDR } = resolveItemPrices(i, matched);
        detailRows.push({
          date: normDate,
          type: 'OUT',
          docNo: String(i.IssueID || ''),
          itemId: String(i.ItemID || ''),
          itemName: String(i.ItemName || matched?.ItemName || ''),
          qty,
          uom: String(i.UoM || matched?.UoM || ''),
          unitPriceUSD: priceUSD,
          totalPriceUSD: parseFloat((qty * priceUSD).toFixed(2)),
          unitPriceIDR: priceIDR,
          totalPriceIDR: Math.round(qty * priceIDR),
          party: String(i.Department || ''),
          remark: String(i.Remark || ''),
        });
      }
    }
  }

  // Fallback supplier lookup from POs
  for (const p of pos) {
    const normCode = String(p.ItemID || '').trim().toLowerCase();
    const supplier = String(p.Supplier || '').trim();
    if (!normCode || !supplier) continue;
    const bucket = ensureBucket(normCode);
    if (!bucket.latestSupplier) {
      bucket.latestSupplier = supplier;
    }
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Silver City ERP';
  workbook.created = new Date();

  // =========================================================================
  // SHEET 1: Inventory Sheet (matching user's attached Excel format)
  // =========================================================================
  const ws = workbook.addWorksheet(`Inventory ${monthShortEn} ${year}`, {
    views: [{ state: 'frozen', xSplit: 3, ySplit: 3 }],
  });

  // Column layout calculation
  const colInvCode = 1;
  const colDesc = 2;
  const colFirstStock = 3;
  const firstDailyCol = 4;
  const lastDailyCol = firstDailyCol + daysInMonth * 2 - 1;
  const colTotalIn = lastDailyCol + 1;
  const colTotalOut = lastDailyCol + 2;
  const colSoh = lastDailyCol + 3;
  const colStorage = lastDailyCol + 4;
  const colMsl = lastDailyCol + 5;
  const colStatus = lastDailyCol + 6;
  const colSupplier = lastDailyCol + 7;
  const colPriceUsd = lastDailyCol + 8;
  const colPriceIdr = lastDailyCol + 9;
  const colTotalPriceUsd = lastDailyCol + 10;
  const colTotalPriceIdr = lastDailyCol + 11;
  const lastCol = colTotalPriceIdr;

  const firstDailyColLetter = getExcelColLetter(firstDailyCol);
  const lastDailyColLetter = getExcelColLetter(lastDailyCol);
  const totalInColLetter = getExcelColLetter(colTotalIn);
  const totalOutColLetter = getExcelColLetter(colTotalOut);
  const sohColLetter = getExcelColLetter(colSoh);
  const mslColLetter = getExcelColLetter(colMsl);
  const priceUsdColLetter = getExcelColLetter(colPriceUsd);
  const priceIdrColLetter = getExcelColLetter(colPriceIdr);

  // Set column widths
  ws.getColumn(colInvCode).width = 16;
  ws.getColumn(colDesc).width = 48;
  ws.getColumn(colFirstStock).width = 13;
  for (let c = firstDailyCol; c <= lastDailyCol; c++) {
    ws.getColumn(c).width = 5.5;
  }
  ws.getColumn(colTotalIn).width = 8.5;
  ws.getColumn(colTotalOut).width = 8.5;
  ws.getColumn(colSoh).width = 14;
  ws.getColumn(colStorage).width = 16;
  ws.getColumn(colMsl).width = 10;
  ws.getColumn(colStatus).width = 15;
  ws.getColumn(colSupplier).width = 24;
  ws.getColumn(colPriceUsd).width = 14;
  ws.getColumn(colPriceIdr).width = 18;
  ws.getColumn(colTotalPriceUsd).width = 16;
  ws.getColumn(colTotalPriceIdr).width = 20;

  // Color palette matching screenshot
  const fillCyan: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB7DEE8' } };
  const fillWhite: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
  const fillPeach: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCD5B4' } };
  const fillCream: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } };
  const fillGreenHeader: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92D050' } };
  const fillYellowHeader: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF99' } };
  const fillBrightYellow: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
  const fillSoftGreen: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF7E3' } };
  const fillSoftYellow: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBE6' } };
  const fillTotalInData: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
  const fillTotalOutData: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
  const fillNeedOrder: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
  const fillInStock: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
  const fillSummaryRow: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };

  const thinBlack: ExcelJS.Border = { style: 'thin', color: { argb: 'FF000000' } };
  const medBlack: ExcelJS.Border = { style: 'medium', color: { argb: 'FF000000' } };
  const allThinBorder: Partial<ExcelJS.Borders> = {
    top: thinBlack,
    bottom: thinBlack,
    left: thinBlack,
    right: thinBlack,
  };

  // Row heights for 3-row header
  ws.getRow(1).height = 34;
  ws.getRow(2).height = 20;
  ws.getRow(3).height = 20;

  // --- Header merges & values ---
  // INV. CODE (A1:A3)
  ws.mergeCells(1, colInvCode, 3, colInvCode);
  const invCodeHdr = ws.getCell(1, colInvCode);
  invCodeHdr.value = 'INV. CODE';
  invCodeHdr.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF000000' } };
  invCodeHdr.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  invCodeHdr.fill = fillCyan;

  // DESCRIPTION FULL (B1:B3)
  ws.mergeCells(1, colDesc, 3, colDesc);
  const descHdr = ws.getCell(1, colDesc);
  descHdr.value = 'DESCRIPTION FULL';
  descHdr.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF000000' } };
  descHdr.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  descHdr.fill = fillCyan;

  // FIRST STOCK (C1:C2 + C3 date)
  ws.mergeCells(1, colFirstStock, 2, colFirstStock);
  const firstStockTop = ws.getCell(1, colFirstStock);
  firstStockTop.value = 'FIRST\nSTOCK';
  firstStockTop.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF000000' } };
  firstStockTop.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  firstStockTop.fill = fillCyan;

  const firstStockSub = ws.getCell(3, colFirstStock);
  firstStockSub.value = firstStockDateLabel;
  firstStockSub.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
  firstStockSub.alignment = { horizontal: 'center', vertical: 'middle' };
  firstStockSub.fill = fillCyan;

  // TRANSAKSI top banner (Row 1 across all daily IN/OUT columns)
  ws.mergeCells(1, firstDailyCol, 1, lastDailyCol);
  const transaksiHdr = ws.getCell(1, firstDailyCol);
  transaksiHdr.value = transaksiTitleLabel;
  transaksiHdr.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF000000' } };
  transaksiHdr.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  transaksiHdr.fill = fillCyan;

  // Row 2 (day numbers 1..daysInMonth) & Row 3 (IN / OUT under each day)
  for (let d = 1; d <= daysInMonth; d++) {
    const dayInCol = firstDailyCol + (d - 1) * 2;
    const dayOutCol = dayInCol + 1;

    ws.mergeCells(2, dayInCol, 2, dayOutCol);
    const dayCell = ws.getCell(2, dayInCol);
    dayCell.value = d;
    dayCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
    dayCell.alignment = { horizontal: 'center', vertical: 'middle' };
    dayCell.fill = fillWhite;

    const inSub = ws.getCell(3, dayInCol);
    inSub.value = 'IN';
    inSub.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF000000' } };
    inSub.alignment = { horizontal: 'center', vertical: 'middle' };
    inSub.fill = fillGreenHeader;

    const outSub = ws.getCell(3, dayOutCol);
    outSub.value = 'OUT';
    outSub.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF000000' } };
    outSub.alignment = { horizontal: 'center', vertical: 'middle' };
    outSub.fill = fillYellowHeader;
  }

  // TOTAL TRANSAKSI (Row 1-2 merged across IN & OUT)
  ws.mergeCells(1, colTotalIn, 2, colTotalOut);
  const totalTxHdr = ws.getCell(1, colTotalIn);
  totalTxHdr.value = 'TOTAL\nTRANSAKSI';
  totalTxHdr.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF000000' } };
  totalTxHdr.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  totalTxHdr.fill = fillPeach;

  const totalInSub = ws.getCell(3, colTotalIn);
  totalInSub.value = 'IN';
  totalInSub.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
  totalInSub.alignment = { horizontal: 'center', vertical: 'middle' };
  totalInSub.fill = fillGreenHeader;

  const totalOutSub = ws.getCell(3, colTotalOut);
  totalOutSub.value = 'OUT';
  totalOutSub.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
  totalOutSub.alignment = { horizontal: 'center', vertical: 'middle' };
  totalOutSub.fill = fillYellowHeader;

  // STOCK ON HAND
  ws.mergeCells(1, colSoh, 2, colSoh);
  const sohHdr = ws.getCell(1, colSoh);
  sohHdr.value = 'STOCK\nON HAND';
  sohHdr.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF000000' } };
  sohHdr.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  sohHdr.fill = fillWhite;

  const sohSub = ws.getCell(3, colSoh);
  sohSub.value = endOfMonthDateLabel;
  sohSub.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0070C0' } };
  sohSub.alignment = { horizontal: 'center', vertical: 'middle' };
  sohSub.fill = fillWhite;

  // STORAGE
  ws.mergeCells(1, colStorage, 2, colStorage);
  const storageHdr = ws.getCell(1, colStorage);
  storageHdr.value = 'STORAGE';
  storageHdr.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF000000' } };
  storageHdr.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  storageHdr.fill = fillCream;

  const storageSub = ws.getCell(3, colStorage);
  storageSub.value = 'LOC. / ROW';
  storageSub.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
  storageSub.alignment = { horizontal: 'center', vertical: 'middle' };
  storageSub.fill = fillCream;

  // MSL
  ws.mergeCells(1, colMsl, 2, colMsl);
  const mslHdr = ws.getCell(1, colMsl);
  mslHdr.value = 'MSL';
  mslHdr.font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FF0000FF' } };
  mslHdr.alignment = { horizontal: 'center', vertical: 'middle' };
  mslHdr.fill = fillBrightYellow;

  const mslSub = ws.getCell(3, colMsl);
  mslSub.value = 'QTY';
  mslSub.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0070C0' } };
  mslSub.alignment = { horizontal: 'center', vertical: 'middle' };
  mslSub.fill = fillCream;

  // STATUS
  ws.mergeCells(1, colStatus, 2, colStatus);
  const statusHdr = ws.getCell(1, colStatus);
  statusHdr.value = 'STATUS';
  statusHdr.font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FF000000' } };
  statusHdr.alignment = { horizontal: 'center', vertical: 'middle' };
  statusHdr.fill = fillCream;

  const statusSub = ws.getCell(3, colStatus);
  statusSub.value = 'PARTS';
  statusSub.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
  statusSub.alignment = { horizontal: 'center', vertical: 'middle' };
  statusSub.fill = fillCream;

  // By. Supplier
  ws.mergeCells(1, colSupplier, 3, colSupplier);
  const supplierHdr = ws.getCell(1, colSupplier);
  supplierHdr.value = 'By. Supplier';
  supplierHdr.font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FF000000' } };
  supplierHdr.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  supplierHdr.fill = fillCream;

  // PRICE (Row 1-2 merged across USD & IDR)
  ws.mergeCells(1, colPriceUsd, 2, colPriceIdr);
  const priceHdr = ws.getCell(1, colPriceUsd);
  priceHdr.value = 'PRICE';
  priceHdr.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF000000' } };
  priceHdr.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  priceHdr.fill = fillCyan;

  const priceUsdSub = ws.getCell(3, colPriceUsd);
  priceUsdSub.value = 'USD';
  priceUsdSub.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
  priceUsdSub.alignment = { horizontal: 'center', vertical: 'middle' };
  priceUsdSub.fill = fillWhite;

  const priceIdrSub = ws.getCell(3, colPriceIdr);
  priceIdrSub.value = 'IDR (Rp)';
  priceIdrSub.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
  priceIdrSub.alignment = { horizontal: 'center', vertical: 'middle' };
  priceIdrSub.fill = fillWhite;

  // TOTAL PRICE (Row 1-2 merged across USD & IDR)
  ws.mergeCells(1, colTotalPriceUsd, 2, colTotalPriceIdr);
  const totalPriceHdr = ws.getCell(1, colTotalPriceUsd);
  totalPriceHdr.value = 'TOTAL PRICE';
  totalPriceHdr.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF000000' } };
  totalPriceHdr.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  totalPriceHdr.fill = fillPeach;

  const totalPriceUsdSub = ws.getCell(3, colTotalPriceUsd);
  totalPriceUsdSub.value = 'USD';
  totalPriceUsdSub.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
  totalPriceUsdSub.alignment = { horizontal: 'center', vertical: 'middle' };
  totalPriceUsdSub.fill = fillYellowHeader;

  const totalPriceIdrSub = ws.getCell(3, colTotalPriceIdr);
  totalPriceIdrSub.value = 'IDR (Rp)';
  totalPriceIdrSub.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
  totalPriceIdrSub.alignment = { horizontal: 'center', vertical: 'middle' };
  totalPriceIdrSub.fill = fillGreenHeader;

  // Apply crisp borders across header rows 1..3
  const sectionLeftCols = new Set([
    colInvCode,
    colDesc,
    colFirstStock,
    firstDailyCol,
    colTotalIn,
    colSoh,
    colStorage,
    colMsl,
    colStatus,
    colSupplier,
    colPriceUsd,
    colTotalPriceUsd,
  ]);

  for (let r = 1; r <= 3; r++) {
    for (let c = 1; c <= lastCol; c++) {
      const cell = ws.getCell(r, c);
      const isNoInnerHorizCol =
        c === colFirstStock || c === colSoh || c === colStorage || c === colStatus;

      cell.border = {
        top: r === 1 ? medBlack : (isNoInnerHorizCol && r === 3 ? undefined : thinBlack),
        bottom: r === 3 ? medBlack : (isNoInnerHorizCol && r === 2 ? undefined : thinBlack),
        left: sectionLeftCols.has(c) ? medBlack : thinBlack,
        right: c === lastCol ? medBlack : thinBlack,
      };
    }
  }

  // --- Data rows (starting at Row 4) ---
  const dataStartRow = 4;
  items.forEach((item, idx) => {
    const rowNum = dataStartRow + idx;
    const normCode = String(item.ItemID || '').trim().toLowerCase();
    const bucket = txMap.get(normCode);

    const baseLastStock = parseNumberValue(
      item.LastStock ?? item.CurrentStock ?? item.Stock ?? item.Qty
    );
    const baseStockIn = parseNumberValue(item.BaseStockIn);
    const baseStockOut = parseNumberValue(item.BaseStockOut);
    const priorIn = bucket ? bucket.priorIn : 0;
    const priorOut = bucket ? bucket.priorOut : 0;

    // Opening stock on 1st of selected month
    const firstStock = baseLastStock + baseStockIn + priorIn - baseStockOut - priorOut;

    let totalMonthIn = 0;
    let totalMonthOut = 0;
    if (bucket) {
      bucket.dailyIn.forEach(v => { totalMonthIn += v; });
      bucket.dailyOut.forEach(v => { totalMonthOut += v; });
    }

    const closingStock = firstStock + totalMonthIn - totalMonthOut;
    const minStock = parseNumberValue(item.MinStock);
    const statusText = closingStock <= minStock ? 'Need Order' : 'In Stock';

    let supplierStr = '';
    if (bucket && bucket.monthSuppliers.size > 0) {
      supplierStr = Array.from(bucket.monthSuppliers).join(', ');
    } else if (bucket && bucket.latestSupplier) {
      supplierStr = bucket.latestSupplier;
    } else if (item.Supplier) {
      supplierStr = String(item.Supplier).trim();
    }

    const row = ws.getRow(rowNum);
    row.height = 20;

    // INV. CODE
    const cInv = row.getCell(colInvCode);
    cInv.value = String(item.ItemID || '');
    cInv.font = { name: 'Calibri', size: 10, bold: true };
    cInv.alignment = { horizontal: 'center', vertical: 'middle' };

    // DESCRIPTION FULL
    const cDesc = row.getCell(colDesc);
    cDesc.value = String(item.ItemName || '');
    cDesc.font = { name: 'Calibri', size: 10 };
    cDesc.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

    // FIRST STOCK
    const cFirst = row.getCell(colFirstStock);
    cFirst.value = firstStock;
    cFirst.numFmt = '#,##0';
    cFirst.font = { name: 'Calibri', size: 10, bold: true };
    cFirst.alignment = { horizontal: 'center', vertical: 'middle' };

    // Daily IN / OUT columns
    for (let d = 1; d <= daysInMonth; d++) {
      const dayInCol = firstDailyCol + (d - 1) * 2;
      const dayOutCol = dayInCol + 1;
      const inVal = bucket?.dailyIn.get(d) || 0;
      const outVal = bucket?.dailyOut.get(d) || 0;

      const cIn = row.getCell(dayInCol);
      if (inVal > 0) {
        cIn.value = inVal;
        cIn.numFmt = '#,##0';
        cIn.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E6B2D' } };
        cIn.fill = fillSoftGreen;
      } else {
        cIn.value = null;
        cIn.font = { name: 'Calibri', size: 10 };
      }
      cIn.alignment = { horizontal: 'center', vertical: 'middle' };

      const cOut = row.getCell(dayOutCol);
      if (outVal > 0) {
        cOut.value = outVal;
        cOut.numFmt = '#,##0';
        cOut.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF9A3412' } };
        cOut.fill = fillSoftYellow;
      } else {
        cOut.value = null;
        cOut.font = { name: 'Calibri', size: 10 };
      }
      cOut.alignment = { horizontal: 'center', vertical: 'middle' };
    }

    // TOTAL TRANSAKSI IN (live Excel SUMIF formula)
    const cTotIn = row.getCell(colTotalIn);
    cTotIn.value = {
      formula: `SUMIF($${firstDailyColLetter}$3:$${lastDailyColLetter}$3,"IN",${firstDailyColLetter}${rowNum}:${lastDailyColLetter}${rowNum})`,
      result: totalMonthIn,
    };
    cTotIn.numFmt = '#,##0';
    cTotIn.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E6B2D' } };
    cTotIn.fill = fillTotalInData;
    cTotIn.alignment = { horizontal: 'center', vertical: 'middle' };

    // TOTAL TRANSAKSI OUT (live Excel SUMIF formula)
    const cTotOut = row.getCell(colTotalOut);
    cTotOut.value = {
      formula: `SUMIF($${firstDailyColLetter}$3:$${lastDailyColLetter}$3,"OUT",${firstDailyColLetter}${rowNum}:${lastDailyColLetter}${rowNum})`,
      result: totalMonthOut,
    };
    cTotOut.numFmt = '#,##0';
    cTotOut.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF9A3412' } };
    cTotOut.fill = fillTotalOutData;
    cTotOut.alignment = { horizontal: 'center', vertical: 'middle' };

    // STOCK ON HAND (live Excel formula: FIRST STOCK + TOTAL IN - TOTAL OUT)
    const cSoh = row.getCell(colSoh);
    cSoh.value = {
      formula: `C${rowNum}+${totalInColLetter}${rowNum}-${totalOutColLetter}${rowNum}`,
      result: closingStock,
    };
    cSoh.numFmt = '#,##0';
    cSoh.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
    cSoh.alignment = { horizontal: 'center', vertical: 'middle' };

    // STORAGE (LOC. / ROW)
    const cLoc = row.getCell(colStorage);
    cLoc.value = String(item.Location || '');
    cLoc.font = { name: 'Calibri', size: 10 };
    cLoc.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

    // MSL (QTY)
    const cMsl = row.getCell(colMsl);
    cMsl.value = minStock;
    cMsl.numFmt = '#,##0';
    cMsl.font = { name: 'Calibri', size: 10, bold: true };
    cMsl.alignment = { horizontal: 'center', vertical: 'middle' };

    // STATUS (PARTS) (live Excel IF formula)
    const cStat = row.getCell(colStatus);
    cStat.value = {
      formula: `IF(${sohColLetter}${rowNum}<=${mslColLetter}${rowNum},"Need Order","In Stock")`,
      result: statusText,
    };
    cStat.font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: statusText === 'Need Order' ? 'FF9C0006' : 'FF006100' },
    };
    cStat.fill = statusText === 'Need Order' ? fillNeedOrder : fillInStock;
    cStat.alignment = { horizontal: 'center', vertical: 'middle' };

    // By. Supplier
    const cSup = row.getCell(colSupplier);
    cSup.value = supplierStr;
    cSup.font = { name: 'Calibri', size: 10 };
    cSup.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

    // PRICE (USD & IDR) & TOTAL PRICE (USD & IDR)
    const { priceUSD, priceIDR } = resolveItemPrices(item);
    const totalPriceUSD = parseFloat((closingStock * priceUSD).toFixed(2));
    const totalPriceIDR = Math.round(closingStock * priceIDR);

    const cPriceUsd = row.getCell(colPriceUsd);
    cPriceUsd.value = priceUSD;
    cPriceUsd.numFmt = '$#,##0.00';
    cPriceUsd.font = { name: 'Calibri', size: 10 };
    cPriceUsd.alignment = { horizontal: 'right', vertical: 'middle' };

    const cPriceIdr = row.getCell(colPriceIdr);
    cPriceIdr.value = priceIDR;
    cPriceIdr.numFmt = '"Rp "#,##0';
    cPriceIdr.font = { name: 'Calibri', size: 10 };
    cPriceIdr.alignment = { horizontal: 'right', vertical: 'middle' };

    const cTotPriceUsd = row.getCell(colTotalPriceUsd);
    cTotPriceUsd.value = {
      formula: `${sohColLetter}${rowNum}*${priceUsdColLetter}${rowNum}`,
      result: totalPriceUSD,
    };
    cTotPriceUsd.numFmt = '$#,##0.00';
    cTotPriceUsd.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
    cTotPriceUsd.fill = fillSoftYellow;
    cTotPriceUsd.alignment = { horizontal: 'right', vertical: 'middle' };

    const cTotPriceIdr = row.getCell(colTotalPriceIdr);
    cTotPriceIdr.value = {
      formula: `${sohColLetter}${rowNum}*${priceIdrColLetter}${rowNum}`,
      result: totalPriceIDR,
    };
    cTotPriceIdr.numFmt = '"Rp "#,##0';
    cTotPriceIdr.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
    cTotPriceIdr.fill = fillSoftGreen;
    cTotPriceIdr.alignment = { horizontal: 'right', vertical: 'middle' };

    // Apply borders to data row
    for (let c = 1; c <= lastCol; c++) {
      row.getCell(c).border = {
        top: thinBlack,
        bottom: thinBlack,
        left: sectionLeftCols.has(c) ? medBlack : thinBlack,
        right: c === lastCol ? medBlack : thinBlack,
      };
    }
  });

  // --- Summary TOTAL row at the bottom ---
  if (items.length > 0) {
    const dataEndRow = dataStartRow + items.length - 1;
    const sumRowNum = dataEndRow + 1;
    const sumRow = ws.getRow(sumRowNum);
    sumRow.height = 24;

    ws.mergeCells(sumRowNum, colInvCode, sumRowNum, colDesc);
    const sumLabel = sumRow.getCell(colInvCode);
    sumLabel.value = `TOTAL (${items.length} ITEMS)`;
    sumLabel.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF000000' } };
    sumLabel.alignment = { horizontal: 'center', vertical: 'middle' };

    const numericSumCols: number[] = [colFirstStock];
    for (let c = firstDailyCol; c <= colSoh; c++) {
      numericSumCols.push(c);
    }

    for (const c of numericSumCols) {
      const colLet = getExcelColLetter(c);
      const cell = sumRow.getCell(c);
      cell.value = { formula: `SUM(${colLet}${dataStartRow}:${colLet}${dataEndRow})` };
      cell.numFmt = '#,##0';
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }

    // Grand Total Price USD
    const totUsdColLet = getExcelColLetter(colTotalPriceUsd);
    const sumTotUsdCell = sumRow.getCell(colTotalPriceUsd);
    sumTotUsdCell.value = { formula: `SUM(${totUsdColLet}${dataStartRow}:${totUsdColLet}${dataEndRow})` };
    sumTotUsdCell.numFmt = '$#,##0.00';
    sumTotUsdCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
    sumTotUsdCell.alignment = { horizontal: 'right', vertical: 'middle' };

    // Grand Total Price IDR
    const totIdrColLet = getExcelColLetter(colTotalPriceIdr);
    const sumTotIdrCell = sumRow.getCell(colTotalPriceIdr);
    sumTotIdrCell.value = { formula: `SUM(${totIdrColLet}${dataStartRow}:${totIdrColLet}${dataEndRow})` };
    sumTotIdrCell.numFmt = '"Rp "#,##0';
    sumTotIdrCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
    sumTotIdrCell.alignment = { horizontal: 'right', vertical: 'middle' };

    for (let c = 1; c <= lastCol; c++) {
      const cell = sumRow.getCell(c);
      cell.fill = fillSummaryRow;
      cell.border = {
        top: medBlack,
        bottom: medBlack,
        left: sectionLeftCols.has(c) ? medBlack : thinBlack,
        right: c === lastCol ? medBlack : thinBlack,
      };
    }
  }

  // Enable Excel AutoFilter on the bottom header row (Row 3) across all columns
  ws.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3, column: lastCol },
  };

  // Page setup for clean landscape printing from Excel
  ws.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };

  // =========================================================================
  // SHEET 2: Detail Transaksi IN-OUT (itemized audit trail for selected month)
  // =========================================================================
  const wsDetail = workbook.addWorksheet(`Detail IN-OUT ${monthShortEn} ${year}`, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  wsDetail.columns = [
    { header: 'DATE', key: 'date', width: 14 },
    { header: 'TYPE', key: 'type', width: 10 },
    { header: 'DOC NO.', key: 'docNo', width: 16 },
    { header: 'INV. CODE', key: 'itemId', width: 18 },
    { header: 'DESCRIPTION FULL', key: 'itemName', width: 44 },
    { header: 'QTY', key: 'qty', width: 12 },
    { header: 'UoM', key: 'uom', width: 10 },
    { header: 'PRICE (USD)', key: 'unitPriceUSD', width: 14 },
    { header: 'TOTAL PRICE (USD)', key: 'totalPriceUSD', width: 16 },
    { header: 'PRICE (IDR)', key: 'unitPriceIDR', width: 18 },
    { header: 'TOTAL PRICE (IDR)', key: 'totalPriceIDR', width: 20 },
    { header: 'DEPT. / SUPPLIER', key: 'party', width: 24 },
    { header: 'REMARK', key: 'remark', width: 32 },
  ];

  const detailHeaderRow = wsDetail.getRow(1);
  detailHeaderRow.height = 24;
  detailHeaderRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF000000' } };
    cell.fill = fillCyan;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = allThinBorder;
  });

  detailRows.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));

  detailRows.forEach((dRow) => {
    const r = wsDetail.addRow(dRow);
    r.height = 20;
    r.eachCell((cell, colIdx) => {
      cell.font = { name: 'Calibri', size: 10 };
      cell.border = allThinBorder;
      const isLeft = colIdx === 5 || colIdx === 12 || colIdx === 13;
      const isRight = colIdx >= 8 && colIdx <= 11;
      cell.alignment = {
        horizontal: isLeft ? 'left' : isRight ? 'right' : 'center',
        vertical: 'middle',
        wrapText: colIdx === 5 || colIdx === 13,
      };
      if (colIdx === 2) {
        cell.font = {
          name: 'Calibri',
          size: 10,
          bold: true,
          color: { argb: dRow.type === 'IN' ? 'FF1E6B2D' : 'FF9A3412' },
        };
        cell.fill = dRow.type === 'IN' ? fillTotalInData : fillTotalOutData;
      }
      if (colIdx === 6) {
        cell.numFmt = '#,##0';
        cell.font = { name: 'Calibri', size: 10, bold: true };
      }
      if (colIdx === 8 || colIdx === 9) {
        cell.numFmt = '$#,##0.00';
        if (colIdx === 9) cell.font = { name: 'Calibri', size: 10, bold: true };
      }
      if (colIdx === 10 || colIdx === 11) {
        cell.numFmt = '"Rp "#,##0';
        if (colIdx === 11) cell.font = { name: 'Calibri', size: 10, bold: true };
      }
    });
  });

  wsDetail.autoFilter = 'A1:M1';

  // Generate & trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const fileName = `Inventory_Sheet_${monthNameEn}_${year}.xlsx`;

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return fileName;
}
