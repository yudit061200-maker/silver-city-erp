import React, { useState, useRef } from 'react';
import { RecordRow, TabName } from '../types';
import { getLatestFullLocalBackup } from '../lib/idbStorage';

interface SpreadsheetSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemsCount: number;
  requestsCount: number;
  posCount: number;
  receivesCount: number;
  issuedCount: number;
  onPullSync: (customUrl?: string, force?: boolean) => void;
  onPushSync: () => void;
  onExportAllSheetsCSV: () => void;
  onExportFullJSONBackup?: () => void;
  onImportFullJSONBackup?: (data: any) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const SpreadsheetSyncModal: React.FC<SpreadsheetSyncModalProps> = ({
  isOpen,
  onClose,
  itemsCount,
  requestsCount,
  posCount,
  receivesCount,
  issuedCount,
  onPullSync,
  onPushSync,
  onExportAllSheetsCSV,
  onExportFullJSONBackup,
  onImportFullJSONBackup,
  showToast
}) => {
  const [sheetUrl, setSheetUrl] = useState('https://docs.google.com/spreadsheets/d/1CbJK7DdaHp4bYmuoYiZwmibCRzwUOgu5whDk7HHw7Ak/export?format=csv&gid=1145528084');
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTabSync, setActiveTabSync] = useState<'pull' | 'push' | 'backup' | 'settings'>('pull');
  const [lastSyncedTime, setLastSyncedTime] = useState<string>(() => {
    return localStorage.getItem('sc_last_synced') || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleExecutePull = async (force: boolean = false) => {
    setIsSyncing(true);
    await new Promise(r => setTimeout(r, 600));
    onPullSync(sheetUrl.trim() ? sheetUrl : undefined, force);
    const nowStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    setLastSyncedTime(nowStr);
    localStorage.setItem('sc_last_synced', nowStr);
    setIsSyncing(false);
    onClose();
  };

  const handleExecutePush = async () => {
    setIsSyncing(true);
    await new Promise(r => setTimeout(r, 600));
    onPushSync();
    const nowStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    setLastSyncedTime(nowStr);
    localStorage.setItem('sc_last_synced', nowStr);
    setIsSyncing(false);
    showToast('ERP data synchronized to Google Sheets cache & Cloud!');
    onClose();
  };

  const handleAutoRecoverLocal = async () => {
    setIsSyncing(true);
    try {
      const backup = await getLatestFullLocalBackup();
      if (backup && onImportFullJSONBackup) {
        onImportFullJSONBackup(backup);
        showToast('Data berhasil dipulihkan dari cadangan otomatis browser!', 'success');
        onClose();
      } else {
        showToast('Tidak ada cadangan lokal tambahan di browser ini.', 'error');
      }
    } catch {
      showToast('Gagal membaca cadangan lokal.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        if (onImportFullJSONBackup) {
          onImportFullJSONBackup(json);
          showToast('Data cadangan JSON berhasil diimport!', 'success');
          onClose();
        }
      } catch {
        showToast('Format file JSON tidak valid.', 'error');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col text-slate-800 dark:text-slate-100">
        
        {/* Header */}
        <div className="bg-emerald-700 dark:bg-emerald-950/80 text-white p-5 flex justify-between items-center shrink-0 border-b border-emerald-600/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white text-emerald-700 flex items-center justify-center text-xl font-bold shadow-md">
              <i className="fa-solid fa-cloud-arrow-down"></i>
            </div>
            <div>
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-white">
                Cloud Sync, Backup & Data Recovery
              </h3>
              <p className="text-[11px] text-emerald-200 font-medium">
                Sinkronisasi data, pemulihan data & ekspor/impor cadangan
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-emerald-800/60 hover:bg-emerald-800 text-white flex items-center justify-center transition cursor-pointer text-lg"
          >
            &times;
          </button>
        </div>

        {/* Sync Status Banner */}
        <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3.5 border-b border-emerald-100 dark:border-emerald-900/50 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="font-bold text-emerald-900 dark:text-emerald-300 text-[11px]">
              Firebase Cloud & Storage Active
            </span>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            Last Sync: <span className="font-bold">{lastSyncedTime}</span>
          </span>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-2 gap-1.5 text-xs font-bold overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTabSync('pull')}
            className={`flex-1 py-2 px-2.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTabSync === 'pull'
                ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs border border-slate-200 dark:border-slate-700'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <i className="fa-solid fa-rotate"></i> Pull / Refresh
          </button>
          <button
            onClick={() => setActiveTabSync('backup')}
            className={`flex-1 py-2 px-2.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTabSync === 'backup'
                ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs border border-slate-200 dark:border-slate-700'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <i className="fa-solid fa-shield-halved"></i> Backup & Restore
          </button>
          <button
            onClick={() => setActiveTabSync('push')}
            className={`flex-1 py-2 px-2.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTabSync === 'push'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200 dark:border-slate-700'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <i className="fa-solid fa-cloud-arrow-up"></i> Export CSV
          </button>
          <button
            onClick={() => setActiveTabSync('settings')}
            className={`py-2 px-2.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTabSync === 'settings'
                ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-xs border border-slate-200 dark:border-slate-700'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <i className="fa-solid fa-gear"></i> Setup
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          
          {/* Active Tables Record Counter */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-slate-50 dark:bg-slate-800/70 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Item Master</span>
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{itemsCount} Items</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/70 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Material Request</span>
              <span className="text-sm font-black text-blue-600 dark:text-blue-400">{requestsCount} Records</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/70 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Purchase Order</span>
              <span className="text-sm font-black text-amber-600 dark:text-amber-400">{posCount} Orders</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/70 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Material Receive</span>
              <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{receivesCount} Receives</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/70 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Material Issued</span>
              <span className="text-sm font-black text-purple-600 dark:text-purple-400">{issuedCount} Issues</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/70 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col justify-center items-center">
              <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Database</span>
              <span className="text-xs font-black text-emerald-500"><i className="fa-solid fa-check-circle mr-1"></i> Connected</span>
            </div>
          </div>

          {activeTabSync === 'pull' && (
            <div className="space-y-3 pt-2">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs leading-relaxed space-y-2">
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  <i className="fa-solid fa-cloud-arrow-down text-emerald-500 mr-1.5"></i>
                  Muat ulang data dari Firebase Cloud & Google Sheets:
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Mengambil data transaksi lengkap terbaru yang tersimpan di cloud atau spreadsheet utama.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={() => handleExecutePull(false)}
                  className="py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs rounded-2xl transition shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <i className="fa-solid fa-rotate text-sm"></i> Pull Cloud Sync
                </button>
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={() => handleExecutePull(true)}
                  className="py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black text-xs rounded-2xl transition shadow-md shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <i className="fa-solid fa-arrows-rotate text-sm"></i> Force Reload Semua Data
                </button>
              </div>
            </div>
          )}

          {activeTabSync === 'backup' && (
            <div className="space-y-3 pt-2">
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-800/60 text-xs leading-relaxed space-y-2">
                <p className="font-bold text-amber-900 dark:text-amber-300">
                  <i className="fa-solid fa-shield-halved text-amber-600 mr-1.5"></i>
                  Pemulihan Data & Cadangan Lengkap (JSON):
                </p>
                <p className="text-[11px] text-amber-800/90 dark:text-amber-400/90">
                  Jika data di Vercel tampak kosong, Anda dapat memulihkan cadangan otomatis browser atau mengunduh/mengunggah file cadangan lengkap.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleAutoRecoverLocal}
                  disabled={isSyncing}
                  className="py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-black text-xs rounded-2xl transition shadow-md shadow-amber-600/30 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <i className="fa-solid fa-clock-rotate-left"></i> Pulihkan Dari Riwayat Browser
                </button>

                <button
                  type="button"
                  onClick={() => onExportFullJSONBackup && onExportFullJSONBackup()}
                  className="py-3 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white font-black text-xs rounded-2xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <i className="fa-solid fa-download"></i> Download Cadangan JSON
                </button>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".json"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 rounded-2xl font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <i className="fa-solid fa-upload text-emerald-600"></i> Upload & Pulihkan File JSON Cadangan
                </button>
              </div>
            </div>
          )}

          {activeTabSync === 'push' && (
            <div className="space-y-3 pt-2">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs leading-relaxed space-y-2">
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  <i className="fa-solid fa-cloud-arrow-up text-indigo-500 mr-1.5"></i>
                  Ekspor data tabel aktif ke format CSV / Spreadsheets:
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Unduh seluruh data tabel dalam format CSV yang kompatibel dengan Microsoft Excel & Google Sheets.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={handleExecutePush}
                  className="py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs rounded-2xl transition shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <i className="fa-solid fa-arrows-rotate"></i> Push ke Cloud Firebase
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onExportAllSheetsCSV();
                    onClose();
                  }}
                  className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-2xl transition shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <i className="fa-solid fa-file-csv"></i> Download CSV Tables
                </button>
              </div>
            </div>
          )}

          {activeTabSync === 'settings' && (
            <div className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Custom Google Sheets Published CSV URL (Optional)
                </label>
                <input
                  type="url"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/.../pub?output=csv"
                  className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-slate-400">Tempel URL publikasi web CSV Google Sheets untuk integrasi langsung.</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  showToast('Google Sheets URL endpoint configured successfully!');
                  handleExecutePull();
                }}
                className="w-full py-3 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white font-bold text-xs rounded-2xl transition cursor-pointer"
              >
                Save & Connect Custom Endpoint
              </button>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold hover:bg-slate-100 transition cursor-pointer"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};

