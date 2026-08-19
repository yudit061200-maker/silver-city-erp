import React, { useState } from 'react';
import { RecordRow, TabName } from '../types';

interface SpreadsheetSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemsCount: number;
  requestsCount: number;
  posCount: number;
  receivesCount: number;
  issuedCount: number;
  onPullSync: (customUrl?: string) => void;
  onPushSync: () => void;
  onExportAllSheetsCSV: () => void;
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
  showToast
}) => {
  const [sheetUrl, setSheetUrl] = useState('https://docs.google.com/spreadsheets/d/1CbJK7DdaHp4bYmuoYiZwmibCRzwUOgu5whDk7HHw7Ak/export?format=csv&gid=1145528084');
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTabSync, setActiveTabSync] = useState<'pull' | 'push' | 'settings'>('pull');
  const [lastSyncedTime, setLastSyncedTime] = useState<string>(() => {
    return localStorage.getItem('sc_last_synced') || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  });

  if (!isOpen) return null;

  const handleExecutePull = async () => {
    setIsSyncing(true);
    await new Promise(r => setTimeout(r, 800));
    onPullSync(sheetUrl.trim() ? sheetUrl : undefined);
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
    showToast('ERP data synchronized to Google Sheets cache!');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col text-slate-800 dark:text-slate-100">
        
        {/* Header */}
        <div className="bg-emerald-700 dark:bg-emerald-950/80 text-white p-5 flex justify-between items-center shrink-0 border-b border-emerald-600/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white text-emerald-700 flex items-center justify-center text-xl font-bold shadow-md">
              <i className="fa-solid fa-file-excel"></i>
            </div>
            <div>
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-white">
                Google Sheets Data Synchronization
              </h3>
              <p className="text-[11px] text-emerald-200 font-medium">
                Bi-directional sync between ERP database & Google Sheets
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
        <div className="bg-emerald-50 dark:bg-emerald-950/40 p-4 border-b border-emerald-100 dark:border-emerald-900/50 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="font-bold text-emerald-900 dark:text-emerald-300">
              Google Sheets Link Active
            </span>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            Last Sync: <span className="font-bold">{lastSyncedTime}</span>
          </span>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-2 gap-2 text-xs font-bold">
          <button
            onClick={() => setActiveTabSync('pull')}
            className={`flex-1 py-2 px-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${
              activeTabSync === 'pull'
                ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs border border-slate-200 dark:border-slate-700'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <i className="fa-solid fa-cloud-arrow-down"></i> Pull / Import Data
          </button>
          <button
            onClick={() => setActiveTabSync('push')}
            className={`flex-1 py-2 px-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${
              activeTabSync === 'push'
                ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs border border-slate-200 dark:border-slate-700'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <i className="fa-solid fa-cloud-arrow-up"></i> Sync & Export
          </button>
          <button
            onClick={() => setActiveTabSync('settings')}
            className={`py-2 px-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${
              activeTabSync === 'settings'
                ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs border border-slate-200 dark:border-slate-700'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <i className="fa-solid fa-gear"></i> Config
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          
          {/* Active Tables Record Counter */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-center text-xs">
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
              <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Status</span>
              <span className="text-xs font-black text-emerald-500"><i className="fa-solid fa-check-circle mr-1"></i> Ready</span>
            </div>
          </div>

          {activeTabSync === 'pull' && (
            <div className="space-y-3 pt-2">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs leading-relaxed space-y-2">
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  <i className="fa-solid fa-circle-info text-emerald-500 mr-1.5"></i>
                  Fetch and reload records directly from Google Sheets dataset:
                </p>
                <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-1 text-[11px]">
                  <li>Synchronizes Item Master, Requests, Purchase Orders, and Stock Movements.</li>
                  <li>Preserves local offline edits while updating modified fields.</li>
                </ul>
              </div>

              <button
                type="button"
                disabled={isSyncing}
                onClick={handleExecutePull}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs rounded-2xl transition shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSyncing ? (
                  <>
                    <i className="fa-solid fa-spinner animate-spin"></i> Syncing from Google Sheets...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-rotate text-sm"></i> Pull & Sync Latest Sheets Data
                  </>
                )}
              </button>
            </div>
          )}

          {activeTabSync === 'push' && (
            <div className="space-y-3 pt-2">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs leading-relaxed space-y-2">
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  <i className="fa-solid fa-cloud-arrow-up text-indigo-500 mr-1.5"></i>
                  Sync & Export active ERP database to Google Sheets / CSV format:
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Export all active tables into standard Google Sheets compatible CSV or push current ERP state into Google Sheet payload format.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={handleExecutePush}
                  className="py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs rounded-2xl transition shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <i className="fa-solid fa-arrows-rotate"></i> Sync ERP State
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onExportAllSheetsCSV();
                    onClose();
                  }}
                  className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-2xl transition shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <i className="fa-solid fa-file-csv"></i> Download CSV Sheets
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
                <p className="text-[10px] text-slate-400">Paste your Google Sheets Web CSV published URL to directly bind live spreadsheet updates.</p>
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
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
