import React, { useState, useEffect } from 'react';
import {
  AccessMode,
  EDITABLE_MODULES,
  EditableModule,
  RecordRow,
} from '../types';
import {
  ALL_EDITABLE_MODULES,
  OPERATIONAL_MODULES,
  isSuperAdmin,
  resolveUserPermissions,
} from '../utils/permissions';

interface UserPermissionsModalProps {
  userRow: RecordRow | null;
  onClose: () => void;
  onSave: (userRow: RecordRow, mode: AccessMode, editableTabs: EditableModule[]) => void;
}

export const UserPermissionsModal: React.FC<UserPermissionsModalProps> = ({
  userRow,
  onClose,
  onSave,
}) => {
  const [mode, setMode] = useState<AccessMode>('view_only');
  const [editableTabs, setEditableTabs] = useState<EditableModule[]>([]);

  useEffect(() => {
    if (!userRow) return;
    const resolved = resolveUserPermissions(userRow);
    setMode(resolved.mode);
    setEditableTabs(resolved.editableTabs);
  }, [userRow]);

  if (!userRow) return null;

  const targetUsername = String(userRow.Username || userRow.username || '');
  const targetIsSuperAdmin = isSuperAdmin(targetUsername);

  const toggleModule = (modKey: EditableModule) => {
    setEditableTabs((prev) =>
      prev.includes(modKey) ? prev.filter((m) => m !== modKey) : [...prev, modKey]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (targetIsSuperAdmin) {
      onSave(userRow, 'full_edit', [...ALL_EDITABLE_MODULES]);
      return;
    }
    const finalMode: AccessMode =
      mode === 'custom' && editableTabs.length === 0 ? 'view_only' : mode;
    onSave(userRow, finalMode, finalMode === 'full_edit' ? [...ALL_EDITABLE_MODULES] : editableTabs);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center text-lg font-black shadow-xs">
              <i className="fa-solid fa-user-shield"></i>
            </div>
            <div>
              <h3 className="font-black text-base uppercase tracking-wider">
                Pengaturan Izin Akun
              </h3>
              <p className="text-xs text-slate-300 font-semibold mt-0.5">
                {userRow.Fullname || targetUsername}{' '}
                <span className="text-amber-400 font-bold">(@{targetUsername})</span>
                {userRow.Role ? ` • ${userRow.Role}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-xl transition cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-grow">
          {targetIsSuperAdmin && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-sm text-amber-900 dark:text-amber-200 flex items-start gap-3">
              <i className="fa-solid fa-crown text-amber-500 text-base mt-0.5"></i>
              <div>
                <p className="font-extrabold">Akun Super Admin Utama</p>
                <p className="text-xs mt-0.5">
                  Akun <strong>{targetUsername}</strong> selalu memiliki akses penuh ke seluruh modul dan tidak dapat dibatasi agar sistem tetap terkendali.
                </p>
              </div>
            </div>
          )}

          {/* Mode Selection */}
          <div className="space-y-2.5">
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Pilih Tingkat Izin Akun
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                disabled={targetIsSuperAdmin}
                onClick={() => {
                  setMode('view_only');
                  setEditableTabs([]);
                }}
                className={`p-4 rounded-2xl border-2 text-left transition cursor-pointer disabled:opacity-50 ${
                  mode === 'view_only'
                    ? 'border-slate-800 dark:border-amber-400 bg-slate-50 dark:bg-slate-800 shadow-sm'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center text-sm">
                    <i className="fa-solid fa-eye"></i>
                  </span>
                  {mode === 'view_only' && (
                    <i className="fa-solid fa-circle-check text-amber-500 text-base"></i>
                  )}
                </div>
                <p className="font-black text-sm text-slate-900 dark:text-white">Hanya Lihat</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                  View Only — hanya bisa melihat, mencari, cetak & export data.
                </p>
              </button>

              <button
                type="button"
                disabled={targetIsSuperAdmin}
                onClick={() => {
                  setMode('custom');
                  if (editableTabs.length === 0) {
                    setEditableTabs(['MaterialReceive', 'MaterialIssued']);
                  }
                }}
                className={`p-4 rounded-2xl border-2 text-left transition cursor-pointer disabled:opacity-50 ${
                  mode === 'custom'
                    ? 'border-indigo-600 dark:border-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/40 shadow-sm'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center text-sm">
                    <i className="fa-solid fa-sliders"></i>
                  </span>
                  {mode === 'custom' && (
                    <i className="fa-solid fa-circle-check text-indigo-600 dark:text-indigo-400 text-base"></i>
                  )}
                </div>
                <p className="font-black text-sm text-slate-900 dark:text-white">Edit Pilihan</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                  Tentukan modul apa saja yang boleh diedit oleh akun ini.
                </p>
              </button>

              <button
                type="button"
                disabled={targetIsSuperAdmin}
                onClick={() => {
                  setMode('full_edit');
                  setEditableTabs([...ALL_EDITABLE_MODULES]);
                }}
                className={`p-4 rounded-2xl border-2 text-left transition cursor-pointer disabled:opacity-50 ${
                  mode === 'full_edit'
                    ? 'border-emerald-600 dark:border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/40 shadow-sm'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center text-sm">
                    <i className="fa-solid fa-shield-halved"></i>
                  </span>
                  {mode === 'full_edit' && (
                    <i className="fa-solid fa-circle-check text-emerald-600 dark:text-emerald-400 text-base"></i>
                  )}
                </div>
                <p className="font-black text-sm text-slate-900 dark:text-white">Edit Semua</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                  Akses penuh menambah, mengedit & menghapus semua modul.
                </p>
              </button>
            </div>
          </div>

          {/* Module Checklist when Custom */}
          {mode === 'custom' && !targetIsSuperAdmin && (
            <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    Pilih Modul Yang Boleh Diedit
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Modul yang tidak dicentang otomatis menjadi <strong>Hanya Lihat (View Only)</strong>.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditableTabs([...OPERATIONAL_MODULES])}
                    className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-700 transition cursor-pointer"
                  >
                    Semua Operasional
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditableTabs([])}
                    className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                  >
                    Kosongkan
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {EDITABLE_MODULES.map((mod) => {
                  const checked = editableTabs.includes(mod.key);
                  return (
                    <label
                      key={mod.key}
                      className={`flex items-start gap-3 p-3 rounded-2xl border transition cursor-pointer select-none ${
                        checked
                          ? 'bg-white dark:bg-slate-900 border-indigo-400 dark:border-indigo-500 shadow-xs'
                          : 'bg-white/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleModule(mod.key)}
                        className="mt-1 w-4 h-4 accent-indigo-600 rounded cursor-pointer shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <i
                            className={`fa-solid ${mod.icon} text-xs ${
                              checked ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'
                            }`}
                          ></i>
                          <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                            {mod.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                          {mod.description}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-amber-400 hover:bg-amber-500 text-slate-950 rounded-2xl text-sm font-black shadow-md shadow-amber-400/20 transition flex items-center gap-2 cursor-pointer"
            >
              <i className="fa-solid fa-floppy-disk"></i> Simpan Izin Akun
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
