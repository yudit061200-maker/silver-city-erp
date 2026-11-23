import React from 'react';
import { TabName } from '../types';

interface CustomHeadersModalProps {
  activeTab: TabName;
  getDisplayColumns: () => string[];
  editingColHeaders: Record<string, string>;
  setEditingColHeaders: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onClose: () => void;
  onSave: (e: React.FormEvent) => void;
}

export const CustomHeadersModal: React.FC<CustomHeadersModalProps> = ({
  activeTab,
  getDisplayColumns,
  editingColHeaders,
  setEditingColHeaders,
  onClose,
  onSave
}) => {
  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-100 max-h-[92vh] flex flex-col">
        <div className="bg-slate-900 text-white px-5 sm:px-6 py-4 flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-2.5">
            <i className="fa-solid fa-pen-to-square text-yellow-400 text-sm"></i>
            <h3 className="font-bold text-sm uppercase tracking-wider">Custom Table Column Headers</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl cursor-pointer px-2">&times;</button>
        </div>

        <form onSubmit={onSave} className="p-5 sm:p-6 space-y-4 flex flex-col flex-grow overflow-hidden">
          <p className="text-sm text-slate-600 leading-relaxed">
            Customize column header labels for table <strong className="text-slate-900">{activeTab}</strong>. Changes will be saved automatically:
          </p>

          <div className="space-y-3.5 max-h-[52vh] overflow-y-auto pr-1 flex-grow">
            {getDisplayColumns().map(col => (
              <div key={col} className="flex items-center justify-between gap-3.5">
                <label className="text-sm font-bold text-slate-700 w-1/3 shrink-0">{col}</label>
                <input
                  type="text"
                  value={editingColHeaders[col] || ''}
                  onChange={(e) => setEditingColHeaders(prev => ({ ...prev, [col]: e.target.value }))}
                  placeholder={col}
                  className="w-2/3 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-yellow-400 font-semibold"
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end space-x-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-300 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-yellow-400 text-slate-900 rounded-xl text-sm font-bold hover:bg-yellow-500 shadow-md transition cursor-pointer"
            >
              Save Column Headers
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
