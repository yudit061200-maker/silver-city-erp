import React, { useMemo, useState } from 'react';
import { RecordRow } from '../types';
import {
  exportInventoryToExcel,
  getAvailableTransactionMonths,
  getMonthlyInventorySummary,
} from '../utils/exportInventoryExcel';

interface ExportInventoryExcelModalProps {
  allItems: RecordRow[];
  filteredItems: RecordRow[];
  hasActiveFilter: boolean;
  receives: RecordRow[];
  issued: RecordRow[];
  pos: RecordRow[];
  onClose: () => void;
  onSuccess: (fileName: string) => void;
  onError: (msg: string) => void;
}

const MONTH_LABELS_ID = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

const formatMonthChip = (ym: string) => {
  const [y, m] = ym.split('-');
  const mIdx = parseInt(m, 10) - 1;
  return `${MONTH_LABELS_ID[mIdx] || m} ${y}`;
};

export const ExportInventoryExcelModal: React.FC<ExportInventoryExcelModalProps> = ({
  allItems,
  filteredItems,
  hasActiveFilter,
  receives,
  issued,
  pos,
  onClose,
  onSuccess,
  onError,
}) => {
  const availableMonths = useMemo(
    () => getAvailableTransactionMonths(receives, issued),
    [receives, issued]
  );

  const [selectedMonthStr, setSelectedMonthStr] = useState<string>(() => {
    return availableMonths[0] || new Date().toISOString().slice(0, 7);
  });
  const [scope, setScope] = useState<'all' | 'filtered'>('all');
  const [isExporting, setIsExporting] = useState(false);

  const targetItems = scope === 'filtered' && hasActiveFilter ? filteredItems : allItems;

  const { year, month } = useMemo(() => {
    const parts = selectedMonthStr.split('-');
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const now = new Date();
    return {
      year: Number.isFinite(y) ? y : now.getFullYear(),
      month: Number.isFinite(m) && m >= 1 && m <= 12 ? m : now.getMonth() + 1,
    };
  }, [selectedMonthStr]);

  const summary = useMemo(
    () =>
      getMonthlyInventorySummary({
        items: targetItems,
        receives,
        issued,
        year,
        month,
      }),
    [targetItems, receives, issued, year, month]
  );

  const handleDownload = async () => {
    if (targetItems.length === 0) {
      onError('Tidak ada data item inventory untuk diekspor.');
      return;
    }
    try {
      setIsExporting(true);
      const fileName = await exportInventoryToExcel({
        items: targetItems,
        receives,
        issued,
        pos,
        year,
        month,
      });
      onSuccess(fileName);
      onClose();
    } catch (err: any) {
      onError(`Gagal mengekspor Excel: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="bg-emerald-700 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-white/15 flex items-center justify-center text-base">
              <i className="fa-solid fa-file-excel"></i>
            </div>
            <div>
              <h3 className="font-extrabold text-sm tracking-wide">Export Excel Inventory Sheet</h3>
              <p className="text-[11px] text-emerald-100 font-medium">
                Format List IN &amp; OUT Harian per Tanggal (.xlsx)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-emerald-100 hover:text-white text-xl leading-none px-1 cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-xs">
          {/* Month selector */}
          <div className="space-y-2">
            <label className="block font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider text-[11px]">
              Pilih Periode Bulan &amp; Tahun
            </label>
            <input
              type="month"
              value={selectedMonthStr}
              onChange={(e) => setSelectedMonthStr(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {availableMonths.length > 0 && (
              <div className="space-y-1 pt-1">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  Periode dengan data transaksi:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {availableMonths.slice(0, 6).map((ym) => {
                    const active = ym === selectedMonthStr;
                    return (
                      <button
                        key={ym}
                        type="button"
                        onClick={() => setSelectedMonthStr(ym)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer border ${
                          active
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {formatMonthChip(ym)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Scope selector (only when search/filter is active) */}
          {hasActiveFilter && (
            <div className="space-y-2">
              <label className="block font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider text-[11px]">
                Cakupan Item
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setScope('all')}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    scope === 'all'
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <div className="font-extrabold">Semua Item</div>
                  <div className="text-[11px] opacity-80">{allItems.length} item inventory</div>
                </button>
                <button
                  type="button"
                  onClick={() => setScope('filtered')}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    scope === 'filtered'
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <div className="font-extrabold">Hasil Filter Saat Ini</div>
                  <div className="text-[11px] opacity-80">{filteredItems.length} item terpilih</div>
                </button>
              </div>
            </div>
          )}

          {/* Summary Box */}
          <div className="grid grid-cols-3 gap-2.5 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="text-center">
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Total Item</div>
              <div className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                {summary.itemCount.toLocaleString('id-ID')}
              </div>
            </div>
            <div className="text-center border-x border-slate-200 dark:border-slate-700">
              <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Total IN</div>
              <div className="text-base font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
                +{summary.totalInQty.toLocaleString('id-ID')}
              </div>
              <div className="text-[10px] text-slate-400">{summary.inRecordCount} tx</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">Total OUT</div>
              <div className="text-base font-black text-amber-700 dark:text-amber-300 mt-0.5">
                -{summary.totalOutQty.toLocaleString('id-ID')}
              </div>
              <div className="text-[10px] text-slate-400">{summary.outRecordCount} tx</div>
            </div>
          </div>

          <div className="text-[11px] text-slate-600 dark:text-slate-400 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/60 rounded-xl p-3 leading-relaxed">
            <strong className="text-sky-900 dark:text-sky-200">Kolom Excel:</strong> INV. CODE, DESCRIPTION FULL, FIRST STOCK (awal bulan), TRANSAKSI IN &amp; OUT per tanggal (1–31), TOTAL TRANSAKSI (IN/OUT), STOCK ON HAND (akhir bulan), STORAGE, MSL, STATUS, By. Supplier, <strong>PRICE (USD &amp; IDR)</strong>, dan <strong>TOTAL PRICE (USD &amp; IDR)</strong> — dilengkapi rumus Excel otomatis serta sheet detail transaksi.
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={isExporting || targetItems.length === 0}
            className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white shadow-md shadow-emerald-600/20 flex items-center gap-2 transition cursor-pointer"
          >
            <i className={`fa-solid ${isExporting ? 'fa-spinner fa-spin' : 'fa-file-excel'}`}></i>
            <span>{isExporting ? 'Membuat Excel...' : 'Download Excel (.xlsx)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
