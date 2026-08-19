import React from 'react';
import { RecordRow, TabName, TAB_SCHEMAS } from '../types';
import { processFileUpload } from '../utils/fileUpload';

interface MultiRecordModalProps {
  activeTab: TabName;
  multiRows: RecordRow[];
  setMultiRows: React.Dispatch<React.SetStateAction<RecordRow[]>>;
  onClose: () => void;
  onSave: () => void;
  handleMultiRowChange: (index: number, field: string | Record<string, any>, val?: any) => void;
  addMultiRow: () => void;
  onOpenQrScanner?: (rowIndex?: number) => void;
}

export const MultiRecordModal: React.FC<MultiRecordModalProps> = ({
  activeTab,
  multiRows,
  setMultiRows,
  onClose,
  onSave,
  handleMultiRowChange,
  addMultiRow,
  onOpenQrScanner
}) => {
  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-6xl w-full overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] text-slate-800 dark:text-slate-100">
        {/* Header */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center text-base font-bold shadow-xs">
              <i className="fa-solid fa-layer-group"></i>
            </div>
            <div>
              <h3 className="font-extrabold text-xs sm:text-sm uppercase tracking-wider text-white">
                Batch Record Entry - {activeTab}
              </h3>
              <p className="text-[10px] text-slate-400 font-medium">Add multiple line items in a single operation</p>
            </div>
            {onOpenQrScanner && (activeTab === 'MaterialReceive' || activeTab === 'MaterialIssued') && (
              <button
                type="button"
                onClick={() => onOpenQrScanner()}
                className="ml-2 px-3 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-slate-950 rounded-xl text-[10px] font-black transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <i className="fa-solid fa-qrcode"></i> Scan QR & Append
              </button>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg cursor-pointer px-2">&times;</button>
        </div>

        {/* Form Body */}
        <div className="p-3 sm:p-6 space-y-4 overflow-y-auto flex-grow">
          <div className="max-h-[58vh] overflow-auto border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
            <table className="w-full min-w-[700px] text-left text-xs border-collapse">
              <thead className="bg-slate-100 dark:bg-slate-800 uppercase text-[10px] text-slate-600 dark:text-slate-300 font-extrabold sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3 w-10 text-center">#</th>
                  {(TAB_SCHEMAS[activeTab] || []).map((col, cIdx) => (
                    <th key={`multi-hdr-${col}-${cIdx}`} className="p-3 whitespace-nowrap min-w-[120px]">{col}</th>
                  ))}
                  <th className="p-3 text-center w-12">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {multiRows.map((r, idx) => (
                  <tr key={`multi-row-${idx}`} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    <td className="p-3 text-center font-bold text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/50">
                      {idx + 1}
                    </td>
                    {(TAB_SCHEMAS[activeTab] || []).map((col, cIdx) => {
                      const val = r[col] !== undefined ? r[col] : '';

                      if (col === 'ItemID') {
                        return (
                          <td key={`multi-cell-${col}-${cIdx}`} className="p-2">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                list="items-id-datalist"
                                value={val}
                                onChange={(e) => handleMultiRowChange(idx, col, e.target.value)}
                                placeholder="Item ID"
                                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 font-bold text-blue-600 dark:text-blue-400 outline-none focus:ring-1 focus:ring-yellow-400"
                              />
                              {onOpenQrScanner && (
                                <button
                                  type="button"
                                  onClick={() => onOpenQrScanner(idx)}
                                  title="Scan QR to populate this row"
                                  className="p-2 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-600 dark:text-blue-400 rounded-xl text-xs shrink-0 cursor-pointer border border-blue-200 dark:border-blue-800"
                                >
                                  <i className="fa-solid fa-qrcode"></i>
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      }

                      if (col === 'ItemName') {
                        return (
                          <td key={`multi-cell-${col}-${cIdx}`} className="p-2 min-w-[220px]">
                            <textarea
                              rows={2}
                              value={val}
                              onChange={(e) => handleMultiRowChange(idx, col, e.target.value)}
                              placeholder="Item Name"
                              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 font-medium text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-yellow-400 whitespace-pre-wrap break-words resize-y min-h-[44px]"
                            />
                          </td>
                        );
                      }

                      if (col === 'Remark') {
                        return (
                          <td key={`multi-cell-${col}-${cIdx}`} className="p-2 min-w-[180px]">
                            <textarea
                              rows={2}
                              value={val}
                              onChange={(e) => handleMultiRowChange(idx, col, e.target.value)}
                              placeholder="Remark"
                              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 font-medium text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-yellow-400 whitespace-pre-wrap break-words resize-y min-h-[44px]"
                            />
                          </td>
                        );
                      }

                      if (col === 'Attachment') {
                        const isImage = typeof val === 'string' && (val.startsWith('data:image/') || val.match(/\.(jpeg|jpg|gif|png|webp)$/i));
                        return (
                          <td key={`multi-cell-${col}-${cIdx}`} className="p-2 min-w-[160px]">
                            <div className="flex items-center gap-1.5">
                              {val ? (
                                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl text-[10px] font-bold shrink-0 shadow-xs">
                                  {isImage ? (
                                    <a href={val} target="_blank" rel="noreferrer" title="Click to view full image">
                                      <img
                                        src={val}
                                        alt="Preview"
                                        className="w-8 h-8 object-cover rounded-lg border border-slate-200 dark:border-slate-700 hover:scale-105 transition cursor-pointer"
                                      />
                                    </a>
                                  ) : (
                                    <a
                                      href={val}
                                      download={r.AttachmentName || 'Attachment'}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200 dark:border-blue-800"
                                    >
                                      <i className="fa-solid fa-file-pdf text-xs"></i>
                                    </a>
                                  )}
                                  <div className="flex flex-col min-w-0 max-w-[80px]">
                                    <a
                                      href={val}
                                      download={r.AttachmentName || 'Attachment'}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="hover:underline truncate text-slate-800 dark:text-slate-200 font-bold"
                                      title={r.AttachmentName || 'Attachment'}
                                    >
                                      {r.AttachmentName || 'Attached'}
                                    </a>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (window.confirm('Apakah Anda yakin ingin menghapus lampiran ini?')) {
                                        handleMultiRowChange(idx, { Attachment: '', AttachmentName: '' });
                                      }
                                    }}
                                    className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/60 p-1.5 rounded-lg cursor-pointer transition shrink-0"
                                    title="Hapus Lampiran"
                                  >
                                    <i className="fa-solid fa-trash-can text-xs"></i>
                                  </button>
                                </div>
                              ) : null}

                              <label className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-bold cursor-pointer transition border border-slate-200 dark:border-slate-700 flex items-center gap-1 shrink-0">
                                <i className="fa-solid fa-upload text-amber-500"></i> {val ? 'Ganti' : 'Upload'}
                                <input
                                  type="file"
                                  accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar,.7z"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      processFileUpload(file, (result, fileName) => {
                                        handleMultiRowChange(idx, { Attachment: result, AttachmentName: fileName });
                                      });
                                      e.target.value = '';
                                    }
                                  }}
                                />
                              </label>
                            </div>
                          </td>
                        );
                      }

                      if (col === 'Status') {
                        return (
                          <td key={`multi-cell-${col}-${cIdx}`} className="p-2">
                            <select
                              value={val || 'Pending'}
                              onChange={(e) => handleMultiRowChange(idx, col, e.target.value)}
                              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-2 text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold outline-none"
                            >
                              <option value="Pending">Pending</option>
                              <option value="Approve">Approve</option>
                              <option value="Approved">Approved</option>
                              <option value="Receive">Receive</option>
                              <option value="Cancelled">Cancelled</option>
                            </select>
                          </td>
                        );
                      }

                      if (col === 'Priority') {
                        return (
                          <td key={`multi-cell-${col}-${cIdx}`} className="p-2">
                            <select
                              value={val || 'Normal'}
                              onChange={(e) => handleMultiRowChange(idx, col, e.target.value)}
                              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-2 text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold outline-none"
                            >
                              <option value="Normal">Normal</option>
                              <option value="Urgent">Urgent</option>
                            </select>
                          </td>
                        );
                      }

                      if (col === 'UpdatedBy') {
                        return (
                          <td key={`multi-cell-${col}-${cIdx}`} className="p-2 min-w-[120px]">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              <i className="fa-solid fa-user-pen text-amber-500"></i>
                              {val || 'System'}
                            </span>
                          </td>
                        );
                      }

                      if (col.includes('Date')) {
                        return (
                          <td key={`multi-cell-${col}-${cIdx}`} className="p-2">
                            <input
                              type="date"
                              value={val}
                              onChange={(e) => handleMultiRowChange(idx, col, e.target.value)}
                              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-2 text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium outline-none"
                            />
                          </td>
                        );
                      }

                      return (
                        <td key={`multi-cell-${col}-${cIdx}`} className="p-2">
                          <input
                            type={col.includes('Price') || col.includes('Stock') || col === 'Qty' ? 'number' : 'text'}
                            value={val}
                            onChange={(e) => handleMultiRowChange(idx, col, e.target.value)}
                            className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-yellow-400"
                          />
                        </td>
                      );
                    })}
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => setMultiRows(prev => prev.filter((_, i) => i !== idx))}
                        className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900 transition flex items-center justify-center cursor-pointer text-xs"
                        title="Delete row"
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2">
            <button
              type="button"
              onClick={addMultiRow}
              className="w-full sm:w-auto px-4 py-2.5 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-700 transition flex items-center justify-center gap-2 cursor-pointer border border-slate-700"
            >
              <i className="fa-solid fa-plus text-[10px]"></i> Add More Row
            </button>
            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold hover:bg-slate-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSave}
                className="px-6 py-2.5 bg-amber-400 hover:bg-amber-500 text-slate-950 rounded-2xl text-xs font-black shadow-md shadow-amber-400/20 transition cursor-pointer flex items-center gap-2"
              >
                <i className="fa-solid fa-check"></i> Save All {multiRows.length} Items
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
