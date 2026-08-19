import React from 'react';
import { RecordRow } from '../types';

interface ItemDetailsModalProps {
  viewingItem: RecordRow | null;
  setViewingItem: React.Dispatch<React.SetStateAction<RecordRow | null>>;
  isEditingInDetails: boolean;
  setIsEditingInDetails: React.Dispatch<React.SetStateAction<boolean>>;
  onClose: () => void;
  onSaveInline: (e: React.FormEvent) => void;
  onOpenQr: (item: RecordRow) => void;
}

export const ItemDetailsModal: React.FC<ItemDetailsModalProps> = ({
  viewingItem,
  setViewingItem,
  isEditingInDetails,
  setIsEditingInDetails,
  onClose,
  onSaveInline,
  onOpenQr
}) => {
  if (!viewingItem) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-100 flex flex-col max-h-[92vh]"
      >
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center shrink-0">
          <h3 className="font-bold text-xs uppercase tracking-wider">Record Details</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-base cursor-pointer px-2">&times;</button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-grow">
          {!isEditingInDetails ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                {viewingItem.Photo ? (
                  <img src={viewingItem.Photo} alt="Item" className="w-16 h-16 object-cover rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs" />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 font-bold">
                    <i className="fa-solid fa-box text-xl"></i>
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="text-base font-black text-slate-900 dark:text-slate-100 whitespace-pre-wrap break-words leading-snug">{viewingItem.ItemName || '-'}</h2>
                  <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-0.5">{viewingItem.ItemID || '-'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/60">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Category</p>
                  <p className="font-bold text-slate-800 dark:text-slate-200">{viewingItem.Category || '-'}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/60">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Unit of Measure</p>
                  <p className="font-bold text-slate-800 dark:text-slate-200">{viewingItem.UoM || '-'}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/60">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Price (USD)</p>
                  <p className="font-bold text-slate-800 dark:text-slate-200">${Number(viewingItem.UnitPriceUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/60">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Price (IDR)</p>
                  <p className="font-bold text-slate-800 dark:text-slate-200">Rp {Number(viewingItem.UnitPriceIDR || 0).toLocaleString('id-ID')}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/60">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Min Stock</p>
                  <p className="font-bold text-slate-800 dark:text-slate-200">{viewingItem.MinStock || 0}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/60">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Warehouse Location</p>
                  <p className="font-bold text-slate-800 dark:text-slate-200">{viewingItem.Location || '-'}</p>
                </div>
              </div>
            </div>
          ) : (
            <form id="inlineEditForm" onSubmit={onSaveInline} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Item Photo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 20 * 1024 * 1024) {
                        alert('Ukuran file foto terlalu besar (maksimal 20MB).');
                        e.target.value = '';
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        setViewingItem(prev => prev ? { ...prev, Photo: ev.target?.result } : null);
                        e.target.value = '';
                      };
                      reader.onerror = () => {
                        alert('Gagal membaca file foto.');
                        e.target.value = '';
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Item ID / Code</label>
                  <input
                    type="text"
                    value={viewingItem.ItemID || ''}
                    onChange={(e) => setViewingItem(prev => prev ? { ...prev, ItemID: e.target.value } : null)}
                    required
                    className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 font-bold text-blue-600 dark:text-blue-400 outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Location</label>
                  <input
                    type="text"
                    value={viewingItem.Location || ''}
                    onChange={(e) => setViewingItem(prev => prev ? { ...prev, Location: e.target.value } : null)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 font-medium text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                </div>
                <div className="col-span-2">
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Item Name</label>
                    <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-1.5 py-0.5 rounded">
                      Wrap Text
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    value={viewingItem.ItemName || ''}
                    onChange={(e) => setViewingItem(prev => prev ? { ...prev, ItemName: e.target.value } : null)}
                    required
                    className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 font-medium text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-yellow-400 whitespace-pre-wrap break-words resize-y min-h-[52px]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Category</label>
                  <input
                    type="text"
                    value={viewingItem.Category || ''}
                    onChange={(e) => setViewingItem(prev => prev ? { ...prev, Category: e.target.value } : null)}
                    required
                    className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 font-medium text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">UoM</label>
                  <input
                    type="text"
                    value={viewingItem.UoM || ''}
                    onChange={(e) => setViewingItem(prev => prev ? { ...prev, UoM: e.target.value } : null)}
                    required
                    className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 font-medium text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Price (USD)</label>
                    <span className="text-[9px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-1.5 py-0.5 rounded">
                      Auto-convert to Rp
                    </span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={viewingItem.UnitPriceUSD || 0}
                    onChange={(e) => {
                      const usd = parseFloat(e.target.value) || 0;
                      setViewingItem(prev => prev ? {
                        ...prev,
                        UnitPriceUSD: usd,
                        UnitPriceIDR: Math.round(usd * 16000)
                      } : null);
                    }}
                    required
                    className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 font-medium text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Price (IDR)</label>
                    <span className="text-[9px] font-bold text-slate-400">Rupiah</span>
                  </div>
                  <input
                    type="number"
                    value={viewingItem.UnitPriceIDR || 0}
                    onChange={(e) => {
                      const idr = parseFloat(e.target.value) || 0;
                      setViewingItem(prev => prev ? {
                        ...prev,
                        UnitPriceIDR: idr,
                        UnitPriceUSD: parseFloat((idr / 16000).toFixed(2))
                      } : null);
                    }}
                    required
                    className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 font-medium text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Min Stock</label>
                  <input
                    type="number"
                    value={viewingItem.MinStock || 0}
                    onChange={(e) => setViewingItem(prev => prev ? { ...prev, MinStock: parseFloat(e.target.value) || 0 } : null)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 font-medium text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Last Stock</label>
                  <input
                    type="number"
                    value={viewingItem.LastStock || 0}
                    onChange={(e) => setViewingItem(prev => prev ? { ...prev, LastStock: parseFloat(e.target.value) || 0 } : null)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 font-medium text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                </div>
              </div>
            </form>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 shrink-0">
          {!isEditingInDetails ? (
            <>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenQr(viewingItem);
                }}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <i className="fa-solid fa-qrcode text-xs"></i> QR Code
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition shadow-xs cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => setIsEditingInDetails(true)}
                className="px-5 py-2.5 bg-yellow-400 text-slate-900 rounded-xl text-xs font-bold hover:bg-yellow-500 transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <i className="fa-solid fa-pen text-[10px]"></i> Edit Item
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setIsEditingInDetails(false)}
                className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition shadow-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="inlineEditForm"
                className="px-5 py-2.5 bg-yellow-400 text-slate-900 rounded-xl text-xs font-bold hover:bg-yellow-500 transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <i className="fa-solid fa-floppy-disk text-[10px]"></i> Save
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
