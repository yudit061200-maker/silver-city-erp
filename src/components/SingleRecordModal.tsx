import React from 'react';
import { RecordRow, TabName, TAB_SCHEMAS } from '../types';
import { processFileUpload } from '../utils/fileUpload';

interface SingleRecordModalProps {
  activeTab: TabName;
  editingRecord: RecordRow | null;
  editingRowIndex: number | null;
  onClose: () => void;
  onSave: (e: React.FormEvent) => void;
  handleSingleFieldChange: (field: string | Record<string, any>, val?: any) => void;
  onOpenQrScanner?: () => void;
}

export const SingleRecordModal: React.FC<SingleRecordModalProps> = ({
  activeTab,
  editingRecord,
  editingRowIndex,
  onClose,
  onSave,
  handleSingleFieldChange,
  onOpenQrScanner
}) => {
  if (!editingRecord) return null;

  const isEdit = editingRowIndex !== null;
  const primaryKeyCol = (TAB_SCHEMAS[activeTab] || [])[0] || 'ID';

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex justify-end animate-fadeIn">
      {/* Backdrop overlay click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Slide-over Container */}
      <div className="relative w-full sm:max-w-xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col z-10 overflow-hidden border-l border-slate-200 dark:border-slate-800 transition-all">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-6 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-bold shadow-xs ${isEdit ? 'bg-amber-500 text-slate-950' : 'bg-indigo-600 text-white'}`}>
              <i className={`fa-solid ${isEdit ? 'fa-pen-to-square' : 'fa-plus'}`}></i>
            </div>
            <div>
              <h3 className="font-black text-sm uppercase tracking-wider text-white">
                {isEdit ? `Edit Record` : `Create Record`}
              </h3>
              <p className="text-[11px] font-semibold text-slate-400">
                Module: <span className="text-yellow-400 font-extrabold">{activeTab}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer text-lg"
          >
            &times;
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={onSave} className="flex flex-col flex-grow overflow-hidden">
          <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-grow custom-scrollbar">
            {(TAB_SCHEMAS[activeTab] || []).map(col => {
              const val = editingRecord[col] !== undefined ? editingRecord[col] : '';

              if (activeTab === 'MaterialRequest' && col === 'Status') {
                return (
                  <div key={col} className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{col}</label>
                    <select
                      value={val}
                      onChange={(e) => handleSingleFieldChange(col, e.target.value)}
                      className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-yellow-400 outline-none bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 transition cursor-pointer"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Approve">Approve</option>
                      <option value="Receive">Receive</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                );
              }

              if (activeTab === 'MaterialRequest' && col === 'Priority') {
                return (
                  <div key={col} className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{col}</label>
                    <select
                      value={val}
                      onChange={(e) => handleSingleFieldChange(col, e.target.value)}
                      className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-yellow-400 outline-none bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 transition cursor-pointer"
                    >
                      <option value="Normal">Normal</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                );
              }

              if (col === 'Photo') {
                return (
                  <div key={col} className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <i className="fa-solid fa-camera mr-1 text-slate-400"></i> {col} Image
                    </label>
                    <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-4 bg-slate-50 dark:bg-slate-800/50 hover:border-yellow-400 transition text-center">
                      <input
                        type="file"
                        accept="image/*"
                        id="single-photo-input"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => handleSingleFieldChange(col, ev.target?.result);
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      {val ? (
                        <div className="flex flex-col items-center gap-2">
                          <img src={val} alt="Preview" className="h-28 w-28 object-cover rounded-2xl border-2 border-white dark:border-slate-700 shadow-md" />
                          <button
                            type="button"
                            onClick={() => handleSingleFieldChange(col, '')}
                            className="px-3 py-1 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl text-[10px] font-bold hover:bg-rose-100 transition cursor-pointer"
                          >
                            Remove Image
                          </button>
                        </div>
                      ) : (
                        <label htmlFor="single-photo-input" className="cursor-pointer space-y-1 block py-2">
                          <i className="fa-solid fa-cloud-arrow-up text-2xl text-slate-400 mb-1 block"></i>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block">Upload Item Image</span>
                          <span className="text-[10px] text-slate-400 block">PNG, JPG, WEBP up to 5MB</span>
                        </label>
                      )}
                    </div>
                  </div>
                );
              }

              if (col.includes('Date')) {
                return (
                  <div key={col} className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{col}</label>
                    <input
                      type="date"
                      value={val}
                      onChange={(e) => handleSingleFieldChange(col, e.target.value)}
                      required
                      className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-yellow-400 outline-none bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 transition"
                    />
                  </div>
                );
              }

              if (col === 'ItemID') {
                return (
                  <div key={col} className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{col}</label>
                      {onOpenQrScanner && (
                        <button
                          type="button"
                          onClick={onOpenQrScanner}
                          className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-xl text-[10px] font-black transition flex items-center gap-1 cursor-pointer border border-indigo-200 dark:border-indigo-800"
                        >
                          <i className="fa-solid fa-qrcode"></i> Scan QR
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      list="items-id-datalist"
                      value={val}
                      onChange={(e) => handleSingleFieldChange(col, e.target.value)}
                      required
                      placeholder="Select or enter Item ID..."
                      className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-yellow-400 outline-none bg-slate-50 dark:bg-slate-800/80 text-blue-600 dark:text-blue-400 transition"
                    />
                  </div>
                );
              }

              if (col === 'Attachment') {
                const isImage = typeof val === 'string' && (val.startsWith('data:image/') || val.match(/\.(jpeg|jpg|gif|png|webp)$/i));
                return (
                  <div key={col} className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <i className="fa-solid fa-paperclip mr-1 text-slate-400"></i> Attachment File
                    </label>
                    <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-yellow-400 rounded-2xl p-3 bg-slate-50 dark:bg-slate-800/50 transition">
                      <input
                        type="file"
                        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar,.7z"
                        id="single-modal-attachment"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            processFileUpload(file, (result, fileName) => {
                              handleSingleFieldChange({ Attachment: result, AttachmentName: fileName });
                            });
                            e.target.value = '';
                          }
                        }}
                      />
                      {val ? (
                        <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
                          <div className="flex items-center gap-3 overflow-hidden">
                            {isImage ? (
                              <img src={val} alt="Attachment" className="h-10 w-10 object-cover rounded-xl border border-slate-200 dark:border-slate-700 shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                <i className="fa-solid fa-file-lines text-base"></i>
                              </div>
                            )}
                            <div className="truncate">
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                                {editingRecord.AttachmentName || 'Attached Document'}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <a
                                  href={val}
                                  download={editingRecord.AttachmentName || 'Attachment'}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline inline-flex items-center gap-1"
                                >
                                  <i className="fa-solid fa-download"></i> Unduh
                                </a>
                                <span className="text-slate-300 dark:text-slate-600">•</span>
                                <label
                                  htmlFor="single-modal-attachment"
                                  className="text-[10px] text-amber-600 dark:text-amber-400 font-bold hover:underline cursor-pointer inline-flex items-center gap-1"
                                >
                                  <i className="fa-solid fa-arrows-rotate"></i> Ganti File
                                </label>
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm('Apakah Anda yakin ingin menghapus lampiran ini?')) {
                                handleSingleFieldChange({ Attachment: '', AttachmentName: '' });
                              }
                            }}
                            className="px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 dark:text-rose-400 rounded-xl transition cursor-pointer flex items-center gap-1 shrink-0 border border-rose-200 dark:border-rose-900"
                            title="Hapus Lampiran"
                          >
                            <i className="fa-solid fa-trash-can"></i>
                            <span>Hapus</span>
                          </button>
                        </div>
                      ) : (
                        <label htmlFor="single-modal-attachment" className="flex flex-col items-center justify-center py-3 cursor-pointer group">
                          <i className="fa-solid fa-cloud-arrow-up text-xl text-slate-400 group-hover:text-yellow-500 mb-1 transition"></i>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Select attachment file</span>
                          <span className="text-[10px] text-slate-400">PDF, Image, Word, Excel (Max 20MB)</span>
                        </label>
                      )}
                    </div>
                  </div>
                );
              }

              if (col === 'ItemName') {
                return (
                  <div key={col} className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{col}</label>
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                        <i className="fa-solid fa-text-height"></i> Wrap Text
                      </span>
                    </div>
                    <textarea
                      rows={2}
                      value={val}
                      onChange={(e) => handleSingleFieldChange(col, e.target.value)}
                      required
                      placeholder="Enter or select Item Name..."
                      className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-yellow-400 outline-none bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 transition whitespace-pre-wrap break-words resize-y min-h-[60px]"
                    />
                  </div>
                );
              }

              if (col === 'Remark') {
                return (
                  <div key={col} className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{col}</label>
                      <span className="text-[10px] font-medium text-slate-400">
                        Wrap Text
                      </span>
                    </div>
                    <textarea
                      rows={2}
                      value={val}
                      onChange={(e) => handleSingleFieldChange(col, e.target.value)}
                      placeholder="Enter remark or details..."
                      className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-yellow-400 outline-none bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 transition whitespace-pre-wrap break-words resize-y min-h-[50px]"
                    />
                  </div>
                );
              }

              if (col === 'UnitPriceUSD') {
                return (
                  <div key={col} className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {col} ($)
                      </label>
                      <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                        <i className="fa-solid fa-calculator mr-1"></i> Auto-convert to Rp
                      </span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={val}
                      onChange={(e) => handleSingleFieldChange(col, e.target.value)}
                      placeholder="Enter price in USD ($)..."
                      className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-yellow-400 outline-none bg-slate-50 dark:bg-slate-800/80 text-emerald-600 dark:text-emerald-400 transition"
                    />
                  </div>
                );
              }

              if (col === 'UnitPriceIDR') {
                return (
                  <div key={col} className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {col} (Rp)
                      </label>
                      <span className="text-[10px] font-medium text-slate-400">
                        Target Rupiah
                      </span>
                    </div>
                    <input
                      type="number"
                      value={val}
                      onChange={(e) => handleSingleFieldChange(col, e.target.value)}
                      placeholder="Enter price in IDR (Rp)..."
                      className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-yellow-400 outline-none bg-slate-50 dark:bg-slate-800/80 text-blue-600 dark:text-blue-400 transition"
                    />
                  </div>
                );
              }

              if (col === 'UpdatedBy') {
                return (
                  <div key={col} className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Last Updated By
                    </label>
                    <div className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 flex items-center gap-2">
                      <i className="fa-solid fa-user-pen text-amber-500"></i>
                      <span>{val || 'System'}</span>
                    </div>
                  </div>
                );
              }

              return (
                <div key={col} className="space-y-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{col}</label>
                  <input
                    type={col.includes('Price') || col.includes('Stock') || col === 'Qty' ? 'number' : 'text'}
                    step={col.includes('USD') ? '0.01' : '1'}
                    value={val}
                    onChange={(e) => handleSingleFieldChange(col, e.target.value)}
                    required={col !== 'Photo' && col !== 'Remark' && col !== 'Attachment' && col !== 'AttachmentName' && col !== 'UpdatedBy'}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-yellow-400 outline-none bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 transition"
                  />
                </div>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-3 rounded-2xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs shadow-md shadow-amber-400/20 transition cursor-pointer flex items-center gap-2"
            >
              <i className="fa-solid fa-floppy-disk"></i>
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
