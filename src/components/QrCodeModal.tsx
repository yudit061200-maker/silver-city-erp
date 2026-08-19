import React from 'react';
import { CompanyHeader, RecordRow } from '../types';

interface QrCodeModalProps {
  qrItem: RecordRow | null;
  qrCopies: number;
  setQrCopies: React.Dispatch<React.SetStateAction<number>>;
  companyHeader: CompanyHeader;
  onClose: () => void;
}

export const QrCodeModal: React.FC<QrCodeModalProps> = ({
  qrItem,
  qrCopies,
  setQrCopies,
  companyHeader,
  onClose
}) => {
  if (!qrItem) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full my-6 p-6 border border-slate-100 flex flex-col relative text-slate-800 print:p-0 print:border-none print:shadow-none print:bg-white"
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center text-lg font-bold">
              <i className="fa-solid fa-qrcode"></i>
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Generate & Print QR Code Label</h3>
              <p className="text-xs text-slate-500">{qrItem.ItemName || qrItem.ItemID} ({qrItem.ItemID})</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition flex items-center justify-center text-sm cursor-pointer"
          >
            &times;
          </button>
        </div>

        <div className="my-4 p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs print:hidden">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">Item Selected:</span>
            <span className="font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">{qrItem.ItemID}</span>
            <span className="text-slate-600 font-medium line-clamp-1 max-w-[200px]">{qrItem.ItemName}</span>
          </div>

          <div className="flex items-center gap-3">
            <label className="font-bold text-slate-700">Sticker Print Quantity:</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="24"
                value={qrCopies}
                onChange={(e) => setQrCopies(Math.max(1, Math.min(24, Number(e.target.value) || 1)))}
                className="w-16 bg-white border border-slate-300 font-black text-slate-900 text-center rounded-xl py-1 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <span className="text-slate-500 font-semibold">copies</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-100/70 rounded-2xl border border-slate-200/80 print:bg-white print:p-0 print:border-none" id="printableQrArea">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 print:grid-cols-3 print:gap-3">
            {Array.from({ length: qrCopies }).map((_, idx) => (
              <div
                key={idx}
                className="bg-white text-slate-900 p-3.5 rounded-2xl border-2 border-slate-800 flex flex-col items-center justify-center text-center shadow-xs print:shadow-none print:rounded-lg print:border-2 print:border-slate-900 print:p-2.5 print:break-inside-avoid"
              >
                <div className="text-[10px] font-black uppercase text-slate-900 line-clamp-1 w-full border-b border-slate-200 pb-1 mb-1">
                  {companyHeader.companyName || 'SILVER CITY DRILLING'}
                </div>

                <p className="text-[10px] font-extrabold text-slate-800 line-clamp-1 w-full uppercase">
                  {qrItem.ItemName || 'Material Item'}
                </p>

                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrItem.ItemID + ' | ' + (qrItem.ItemName || ''))}`}
                  alt="QR Code"
                  className="h-20 w-20 my-1.5 border border-slate-100 p-1 rounded-lg bg-white"
                />

                <span className="font-mono text-[11px] font-black text-blue-700 tracking-wider bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  {qrItem.ItemID}
                </span>

                <div className="mt-2 pt-1 border-t border-slate-200 w-full flex items-center justify-between text-[9px] font-bold text-slate-600">
                  <span>LOC: {qrItem.Location || 'WH'}</span>
                  <span className="font-black text-slate-900">
                    {qrItem.UnitPriceIDR ? `Rp ${Number(qrItem.UnitPriceIDR).toLocaleString('id-ID')}` : qrItem.UoM || 'Pcs'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-100 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 transition cursor-pointer"
          >
            Done
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer"
          >
            <i className="fa-solid fa-print text-xs"></i> Print QR Label Now
          </button>
        </div>
      </div>
    </div>
  );
};
