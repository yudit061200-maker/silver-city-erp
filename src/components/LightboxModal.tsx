import React from 'react';

interface LightboxModalProps {
  src: string;
  caption: string;
  onClose: () => void;
}

export const LightboxModal: React.FC<LightboxModalProps> = ({ src, caption, onClose }) => {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-4xl max-h-[90vh] p-3 bg-white rounded-3xl shadow-2xl flex flex-col items-center border border-slate-100"
      >
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 bg-rose-600 hover:bg-rose-700 text-white w-8 h-8 rounded-full font-bold text-sm shadow-md flex items-center justify-center cursor-pointer"
        >
          &times;
        </button>
        <img src={src} alt="Enlarged" className="max-h-[80vh] max-w-full object-contain rounded-2xl shadow-xs" />
        <p className="mt-3 text-xs font-bold text-slate-700 uppercase tracking-wider">{caption}</p>
      </div>
    </div>
  );
};
