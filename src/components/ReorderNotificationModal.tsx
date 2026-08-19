import React, { useState } from 'react';
import { RecordRow } from '../types';

interface ReorderNotificationModalProps {
  itemsNeedingOrder: RecordRow[];
  onClose: () => void;
  onCreateSingleRequest: (item: RecordRow) => void;
  onCreateBatchRequest: (items: RecordRow[]) => void;
  onOpenItemDetails: (itemId: string) => void;
}

export const ReorderNotificationModal: React.FC<ReorderNotificationModalProps> = ({
  itemsNeedingOrder,
  onClose,
  onCreateSingleRequest,
  onCreateBatchRequest,
  onOpenItemDetails
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = itemsNeedingOrder.filter(item => {
    const term = searchTerm.toLowerCase();
    return (
      String(item.ItemID || '').toLowerCase().includes(term) ||
      String(item.ItemName || '').toLowerCase().includes(term) ||
      String(item.Category || '').toLowerCase().includes(term) ||
      String(item.Location || '').toLowerCase().includes(term)
    );
  });

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-100 my-8 flex flex-col max-h-[85vh]"
      >
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-rose-500/30 animate-pulse">
              <i className="fa-solid fa-bell"></i>
            </div>
            <div>
              <h3 className="font-extrabold text-sm uppercase tracking-wider flex items-center gap-2">
                <span>Items Needing Reorder Notification</span>
                <span className="px-2.5 py-0.5 bg-rose-500 text-white text-xs font-black rounded-full">
                  {itemsNeedingOrder.length} Items
                </span>
              </h3>
              <p className="text-[11px] text-slate-300 font-medium">
                Items with stock equal to or below minimum threshold (Status: <strong className="text-yellow-400">NEED ORDER</strong>)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl font-light cursor-pointer px-2"
          >
            &times;
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-grow">
          {/* Top Summary Banner */}
          <div className="bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 border border-rose-200/80 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-black text-base shrink-0">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <div>
                <h4 className="font-extrabold text-xs text-rose-950 uppercase tracking-wide">
                  Critical Stock Alert (Need Order)
                </h4>
                <p className="text-xs text-slate-700 font-medium mt-0.5">
                  There are <strong className="text-rose-700">{itemsNeedingOrder.length} items</strong> requiring an immediate Material Request creation.
                </p>
              </div>
            </div>

            {itemsNeedingOrder.length > 0 && (
              <button
                type="button"
                onClick={() => onCreateBatchRequest(itemsNeedingOrder)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-rose-600/20 flex items-center gap-2 cursor-pointer shrink-0"
              >
                <i className="fa-solid fa-cart-plus"></i> Order All ({itemsNeedingOrder.length} Items)
              </button>
            )}
          </div>

          {/* Search Filter */}
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Item ID, Item Name, Category, or Location..."
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs font-medium bg-slate-50 outline-none focus:ring-2 focus:ring-rose-400 focus:bg-white"
            />
            <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-slate-400 text-xs"></i>
          </div>

          {/* Table / List of items needing order */}
          {filtered.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <i className="fa-solid fa-circle-check text-4xl text-emerald-500 mb-2"></i>
              <p className="font-bold text-slate-700 text-sm">No items currently need to be ordered</p>
              <p className="text-xs text-slate-400 mt-1">All item stock levels are healthy (In Stock)</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3 text-center">#</th>
                    <th className="p-3">Item ID</th>
                    <th className="p-3">Item Name</th>
                    <th className="p-3 text-center">Current Stock</th>
                    <th className="p-3 text-center">Min Stock</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Suggested Order</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((item, index) => {
                    const currentStock = Number(item.CurrentStock) || 0;
                    const minStock = Number(item.MinStock) || 0;
                    const deficit = Math.max(1, minStock - currentStock);

                    return (
                      <tr key={`need-order-row-${item.ItemID}-${index}`} className="hover:bg-slate-50 transition">
                        <td className="p-3 text-center font-bold text-slate-400">{index + 1}</td>
                        <td className="p-3 font-bold text-blue-700">
                          <button
                            type="button"
                            onClick={() => onOpenItemDetails(String(item.ItemID))}
                            className="hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>{item.ItemID}</span>
                            <i className="fa-solid fa-circle-info text-[10px] text-blue-400"></i>
                          </button>
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{item.ItemName}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2">
                            <span>{item.Category || '-'}</span>
                            <span>•</span>
                            <span>Location: {item.Location || '-'}</span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`font-black text-xs px-2 py-1 rounded-lg ${
                            currentStock <= 0 ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-900'
                          }`}>
                            {currentStock} {item.UoM || 'Pcs'}
                          </span>
                        </td>
                        <td className="p-3 text-center font-bold text-slate-700">
                          {minStock} {item.UoM || 'Pcs'}
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-2.5 py-1 bg-rose-100 text-rose-800 border border-rose-300 rounded-lg text-[10px] font-extrabold inline-flex items-center gap-1 animate-pulse">
                            <i className="fa-solid fa-triangle-exclamation"></i>
                            NEED ORDER
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="font-extrabold text-blue-700 bg-blue-50 px-2 py-1 rounded-lg text-xs">
                            +{deficit} {item.UoM || 'Pcs'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => onCreateSingleRequest(item)}
                            className="px-3 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-slate-900 rounded-xl text-[11px] font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer mx-auto"
                            title="Create Material Request for this item"
                          >
                            <i className="fa-solid fa-plus"></i> Order (MR)
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-100 flex justify-between items-center shrink-0 text-xs">
          <span className="text-slate-500 font-medium">
            Status <strong className="text-rose-700 font-bold">NEED ORDER</strong> is active when Stock &le; Minimum Stock.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
