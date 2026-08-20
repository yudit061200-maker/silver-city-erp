import React, { useState, useRef } from 'react';
import { RecordRow, TabName } from '../types';
import { getLatestFullLocalBackup } from '../lib/idbStorage';
import { signInWithGoogle, googleLogout, getGoogleAccessToken, getGoogleUser } from '../lib/googleAuth';
import {
  createERPSpreadsheet,
  syncAllDataToSpreadsheet,
  fetchSpreadsheetDataToERP,
  SpreadsheetConfig
} from '../lib/googleSheetsService';
import { User } from 'firebase/auth';

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
  // Google Sheets Props
  spreadsheetConfig: SpreadsheetConfig;
  onUpdateSpreadsheetConfig: (config: Partial<SpreadsheetConfig>) => void;
  getAllStoreData: () => {
    items: RecordRow[];
    requests: RecordRow[];
    pos: RecordRow[];
    receives: RecordRow[];
    issued: RecordRow[];
    users: RecordRow[];
  };
  onApplyImportedData: (data: any) => void;
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
  showToast,
  spreadsheetConfig,
  onUpdateSpreadsheetConfig,
  getAllStoreData,
  onApplyImportedData
}) => {
  const [activeTabSync, setActiveTabSync] = useState<'sheets' | 'pull' | 'backup' | 'push'>('sheets');
  const [isSyncing, setIsSyncing] = useState(false);
  const [googleUser, setGoogleUser] = useState<User | null>(getGoogleUser());
  const [isSigningInGoogle, setIsSigningInGoogle] = useState(false);
  const [inputSheetIdOrUrl, setInputSheetIdOrUrl] = useState(spreadsheetConfig.spreadsheetId || '');
  const [lastSyncedTime, setLastSyncedTime] = useState<string>(() => {
    return spreadsheetConfig.lastSyncedAt || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setIsSigningInGoogle(true);
    try {
      const result = await signInWithGoogle();
      if (result?.user) {
        setGoogleUser(result.user);
        showToast(`Berhasil login Google: ${result.user.displayName || result.user.email}`, 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal login ke akun Google', 'error');
    } finally {
      setIsSigningInGoogle(false);
    }
  };

  const handleGoogleLogout = async () => {
    await googleLogout();
    setGoogleUser(null);
    showToast('Telah keluar dari akun Google', 'success');
  };

  const parseSpreadsheetId = (input: string): string => {
    const trimmed = input.trim();
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      return match[1];
    }
    return trimmed;
  };

  const handleCreateNewSpreadsheet = async () => {
    const token = getGoogleAccessToken();
    if (!token) {
      showToast('Silakan login dengan Google terlebih dahulu', 'error');
      return;
    }

    setIsSyncing(true);
    try {
      showToast('Membuat Google Spreadsheet ERP baru di Google Drive...', 'success');
      const { spreadsheetId, spreadsheetUrl } = await createERPSpreadsheet(token);
      
      const store = getAllStoreData();
      await syncAllDataToSpreadsheet(token, spreadsheetId, store);

      const nowStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const updatedConfig: SpreadsheetConfig = {
        spreadsheetId,
        spreadsheetUrl,
        title: 'PT Silver City Drilling - Live ERP Database',
        autoSync: true,
        lastSyncedAt: nowStr
      };

      onUpdateSpreadsheetConfig(updatedConfig);
      setInputSheetIdOrUrl(spreadsheetId);
      setLastSyncedTime(nowStr);
      showToast('Google Spreadsheet ERP berhasil dibuat & data terhubung!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal membuat Google Spreadsheet', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConnectExistingSpreadsheet = async () => {
    const token = getGoogleAccessToken();
    if (!token) {
      showToast('Silakan login dengan Google terlebih dahulu', 'error');
      return;
    }

    const rawId = parseSpreadsheetId(inputSheetIdOrUrl);
    if (!rawId) {
      showToast('Masukkan ID atau URL Google Spreadsheet yang valid', 'error');
      return;
    }

    setIsSyncing(true);
    try {
      const nowStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const updatedConfig: SpreadsheetConfig = {
        spreadsheetId: rawId,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${rawId}/edit`,
        title: 'Connected Google Sheet',
        autoSync: true,
        lastSyncedAt: nowStr
      };

      onUpdateSpreadsheetConfig(updatedConfig);
      setLastSyncedTime(nowStr);
      showToast('Spreadsheet berhasil dihubungkan!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal menghubungkan Spreadsheet', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePushAllToSpreadsheet = async () => {
    const token = getGoogleAccessToken();
    if (!token) {
      showToast('Silakan login dengan Google terlebih dahulu', 'error');
      return;
    }
    if (!spreadsheetConfig.spreadsheetId) {
      showToast('Hubungkan spreadsheet terlebih dahulu', 'error');
      return;
    }

    setIsSyncing(true);
    try {
      const store = getAllStoreData();
      await syncAllDataToSpreadsheet(token, spreadsheetConfig.spreadsheetId, store);
      const nowStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      onUpdateSpreadsheetConfig({ lastSyncedAt: nowStr });
      setLastSyncedTime(nowStr);
      showToast('Seluruh data ERP berhasil disinkronkan ke Google Spreadsheet!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal sinkronisasi data ke Google Spreadsheet', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePullFromSpreadsheet = async () => {
    const token = getGoogleAccessToken();
    if (!token) {
      showToast('Silakan login dengan Google terlebih dahulu', 'error');
      return;
    }
    if (!spreadsheetConfig.spreadsheetId) {
      showToast('Hubungkan spreadsheet terlebih dahulu', 'error');
      return;
    }

    setIsSyncing(true);
    try {
      const data = await fetchSpreadsheetDataToERP(token, spreadsheetConfig.spreadsheetId);
      onApplyImportedData(data);
      const nowStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      onUpdateSpreadsheetConfig({ lastSyncedAt: nowStr });
      setLastSyncedTime(nowStr);
      showToast('Data berhasil ditarik dari Google Spreadsheet ke ERP!', 'success');
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Gagal menarik data dari Google Spreadsheet', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExecutePull = async (force: boolean = false) => {
    setIsSyncing(true);
    await new Promise(r => setTimeout(r, 600));
    onPullSync(undefined, force);
    const nowStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    setLastSyncedTime(nowStr);
    setIsSyncing(false);
    onClose();
  };

  const handleExecutePush = async () => {
    setIsSyncing(true);
    await new Promise(r => setTimeout(r, 600));
    onPushSync();
    const nowStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    setLastSyncedTime(nowStr);
    setIsSyncing(false);
    showToast('Data ERP disinkronkan ke Cloud Firebase!');
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

  const isConnectedToGoogle = !!googleUser && !!getGoogleAccessToken();
  const hasConnectedSpreadsheet = !!spreadsheetConfig.spreadsheetId;

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col text-slate-800 dark:text-slate-100">
        
        {/* Header */}
        <div className="bg-emerald-700 dark:bg-emerald-950/80 text-white p-5 flex justify-between items-center shrink-0 border-b border-emerald-600/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white text-emerald-700 flex items-center justify-center text-xl font-bold shadow-md">
              <i className="fa-solid fa-table"></i>
            </div>
            <div>
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-white">
                Google Sheets Live Sync & Backup
              </h3>
              <p className="text-[11px] text-emerald-200 font-medium">
                Otomatis sinkron saat tambah, edit, & hapus data ERP
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
              {hasConnectedSpreadsheet && isConnectedToGoogle
                ? 'Google Sheets 2-Way Live Sync Active'
                : 'Firebase Cloud Database Active'}
            </span>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            Last Sync: <span className="font-bold">{lastSyncedTime}</span>
          </span>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-2 gap-1.5 text-xs font-bold overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTabSync('sheets')}
            className={`flex-1 py-2 px-2.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTabSync === 'sheets'
                ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs border border-slate-200 dark:border-slate-700'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <i className="fa-solid fa-table-cells text-emerald-500"></i> Google Sheets Live
          </button>
          <button
            onClick={() => setActiveTabSync('pull')}
            className={`flex-1 py-2 px-2.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTabSync === 'pull'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200 dark:border-slate-700'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <i className="fa-solid fa-rotate"></i> Cloud Pull
          </button>
          <button
            onClick={() => setActiveTabSync('backup')}
            className={`flex-1 py-2 px-2.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTabSync === 'backup'
                ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs border border-slate-200 dark:border-slate-700'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <i className="fa-solid fa-shield-halved"></i> Backup / JSON
          </button>
          <button
            onClick={() => setActiveTabSync('push')}
            className={`flex-1 py-2 px-2.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTabSync === 'push'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200 dark:border-slate-700'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <i className="fa-solid fa-file-csv"></i> Export CSV
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
              <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Google Sheets</span>
              <span className={`text-xs font-black ${hasConnectedSpreadsheet ? 'text-emerald-500' : 'text-slate-400'}`}>
                <i className={`fa-solid ${hasConnectedSpreadsheet ? 'fa-check-circle' : 'fa-circle-xmark'} mr-1`}></i>
                {hasConnectedSpreadsheet ? 'Linked' : 'Not Linked'}
              </span>
            </div>
          </div>

          {activeTabSync === 'sheets' && (
            <div className="space-y-4 pt-1">
              
              {/* Step 1: Google Account Authentication */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-black text-xs flex items-center justify-center">1</span>
                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">
                      Akun Google & Izin Spreadsheet
                    </h4>
                  </div>
                  {isConnectedToGoogle && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                      Terhubung
                    </span>
                  )}
                </div>

                {!isConnectedToGoogle ? (
                  <div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">
                      Hubungkan akun Google Anda untuk memungkinkan ERP menambahkan, mengubah, atau menghapus baris secara langsung di Google Sheets Anda.
                    </p>
                    
                    {/* Official Sign in with Google Button as per Guidelines */}
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={isSigningInGoogle}
                      className="w-full py-2.5 px-4 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-2xl font-bold text-xs shadow-xs transition flex items-center justify-center gap-3 cursor-pointer"
                    >
                      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                        <path fill="none" d="M0 0h48v48H0z"></path>
                      </svg>
                      <span>{isSigningInGoogle ? 'Menghubungkan...' : 'Sign in with Google'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2.5">
                      {googleUser?.photoURL ? (
                        <img src={googleUser.photoURL} alt="Avatar" className="w-8 h-8 rounded-full" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">
                          {googleUser?.displayName?.charAt(0) || 'G'}
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                          {googleUser?.displayName || 'Google Account'}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {googleUser?.email}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleGoogleLogout}
                      className="px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition cursor-pointer"
                    >
                      Keluar
                    </button>
                  </div>
                )}
              </div>

              {/* Step 2: Spreadsheet Connection & Creation */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-black text-xs flex items-center justify-center">2</span>
                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">
                      Target Google Spreadsheet
                    </h4>
                  </div>
                </div>

                {hasConnectedSpreadsheet ? (
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400">Spreadsheet Terhubung</span>
                      <a
                        href={spreadsheetConfig.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetConfig.spreadsheetId}/edit`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        Buka di Google Sheets <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                      </a>
                    </div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate font-mono">
                      ID: {spreadsheetConfig.spreadsheetId}
                    </p>
                    
                    {/* Live Auto-sync Switch */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                          ⚡ Sinkronisasi Otomatis Real-time
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Setiap Tambah, Edit, & Hapus di ERP langsung sinkron ke Sheets
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={spreadsheetConfig.autoSync !== false}
                        onChange={(e) => onUpdateSpreadsheetConfig({ autoSync: e.target.checked })}
                        className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                      />
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleCreateNewSpreadsheet}
                    disabled={isSyncing || !isConnectedToGoogle}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs rounded-2xl transition shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <i className="fa-solid fa-plus-circle"></i>
                    {isSyncing ? 'Memproses...' : '🚀 Buat Google Spreadsheet ERP Otomatis di Drive'}
                  </button>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={inputSheetIdOrUrl}
                      onChange={(e) => setInputSheetIdOrUrl(e.target.value)}
                      placeholder="Atau tempel Link / ID Spreadsheet yang sudah ada..."
                      className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={handleConnectExistingSpreadsheet}
                      disabled={isSyncing || !isConnectedToGoogle || !inputSheetIdOrUrl.trim()}
                      className="px-4 py-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                    >
                      Hubungkan
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 3: Manual Sync Actions */}
              {hasConnectedSpreadsheet && isConnectedToGoogle && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handlePushAllToSpreadsheet}
                    disabled={isSyncing}
                    className="py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs rounded-2xl transition shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <i className="fa-solid fa-cloud-arrow-up"></i>
                    {isSyncing ? 'Sinkronisasi...' : 'Push Semua Data ke Spreadsheet'}
                  </button>
                  <button
                    type="button"
                    onClick={handlePullFromSpreadsheet}
                    disabled={isSyncing}
                    className="py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black text-xs rounded-2xl transition shadow-md shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <i className="fa-solid fa-cloud-arrow-down"></i>
                    {isSyncing ? 'Mengambil...' : 'Tarik Data dari Spreadsheet ke ERP'}
                  </button>
                </div>
              )}

            </div>
          )}

          {activeTabSync === 'pull' && (
            <div className="space-y-3 pt-2">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs leading-relaxed space-y-2">
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  <i className="fa-solid fa-cloud-arrow-down text-emerald-500 mr-1.5"></i>
                  Muat ulang data dari Cloud Firestore Server:
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Mengambil data transaksi lengkap terbaru yang tersimpan di server cloud.
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
                  Anda dapat memulihkan cadangan otomatis browser atau mengunduh/mengunggah file cadangan lengkap JSON.
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
                  Ekspor data tabel aktif ke format CSV:
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Unduh data tabel dalam format CSV yang kompatibel dengan Microsoft Excel & Google Sheets.
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
