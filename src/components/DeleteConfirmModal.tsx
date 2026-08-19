import React from 'react';
import { RecordRow, TabName } from '../types';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  activeTab: TabName;
  recordToDelete: RecordRow | null;
  selectedCount?: number;
  isBatchDelete?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  activeTab,
  recordToDelete,
  selectedCount = 0,
  isBatchDelete = false,
  onClose,
  onConfirm
}) => {
  if (!isOpen) return null;

  const itemTitle = recordToDelete
    ? recordToDelete.ItemName || recordToDelete.ItemID || recordToDelete.RequestID || recordToDelete.POID || recordToDelete.ReceiveID || recordToDelete.IssueID || recordToDelete.Username || 'Record'
    : 'Selected Records';

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-800 dark:text-slate-100 flex flex-col">
        {/* Header */}
        <div className="bg-rose-50 dark:bg-rose-950/50 border-b border-rose-100 dark:border-rose-900/40 p-4 sm:p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center text-lg shrink-0 shadow-md shadow-rose-500/30">
            <i className="fa-solid fa-triangle-exclamation"></i>
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-rose-900 dark:text-rose-200">
              {isBatchDelete ? `Delete ${selectedCount} Records?` : 'Confirm Delete Record'}
            </h3>
            <p className="text-[11px] font-medium text-rose-700/80 dark:text-rose-300/80">
              Module: <span className="font-bold uppercase">{activeTab}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto w-8 h-8 rounded-full bg-slate-200/50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Content Details */}
        <div className="p-5 space-y-4">
          {isBatchDelete ? (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                You are about to permanently remove <span className="text-rose-600 dark:text-rose-400 font-black">{selectedCount} selected items</span> from {activeTab}.
              </p>
            </div>
          ) : recordToDelete ? (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[10px] font-bold uppercase text-slate-400">Target Record</span>
                <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-[10px] font-black">
                  {recordToDelete.ItemID || recordToDelete.RequestID || recordToDelete.POID || recordToDelete.ReceiveID || recordToDelete.IssueID || '#'}
                </span>
              </div>
              <p className="text-xs font-black text-slate-900 dark:text-white line-clamp-2">
                {itemTitle}
              </p>
              {recordToDelete.Category && (
                <p className="text-[11px] font-medium text-slate-500">Category: {recordToDelete.Category}</p>
              )}
            </div>
          ) : null}

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300 text-xs">
            <i className="fa-solid fa-circle-info text-amber-500 mt-0.5 shrink-0"></i>
            <p className="text-[11px] font-medium leading-relaxed">
              This action will delete the entry from the ERP workspace. If synced, changes will be pushed to Google Sheets.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-slate-50/80 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-md shadow-rose-600/30 flex items-center gap-1.5 cursor-pointer"
          >
            <i className="fa-solid fa-trash-can text-[11px]"></i>
            Confirm Delete
          </button>
        </div>
      </div>
    </div>
  );
};
