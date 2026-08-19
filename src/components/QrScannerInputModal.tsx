import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { RecordRow, TabName } from '../types';
import { processFileUpload } from '../utils/fileUpload';

interface QrScannerInputModalProps {
  activeTab: TabName;
  items: RecordRow[];
  onClose: () => void;
  onScanSuccess: (scannedItem: RecordRow, qty: number, deptOrSupplier: string, remark: string, attachment: string, attachmentName: string) => void;
}

export const QrScannerInputModal: React.FC<QrScannerInputModalProps> = ({
  activeTab,
  items,
  onClose,
  onScanSuccess
}) => {
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [qty, setQty] = useState<number>(1);
  const [deptOrSupplier, setDeptOrSupplier] = useState<string>('');
  const [remark, setRemark] = useState<string>('');
  const [attachment, setAttachment] = useState<string>('');
  const [attachmentName, setAttachmentName] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [manualCode, setManualCode] = useState<string>('');
  const [scannedMessage, setScannedMessage] = useState<string>('');

  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [cameraError, setCameraError] = useState<string>('');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const qrRegionId = 'qr-input-scanner-region';

  // Default dept / supplier depending on activeTab
  useEffect(() => {
    if (activeTab === 'MaterialReceive') {
      setDeptOrSupplier('Baker Hughes Indonesia');
    } else {
      setDeptOrSupplier('Drilling Operations');
    }
  }, [activeTab]);

  useEffect(() => {
    // Check available cameras
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          setSelectedCameraId(devices[0].id);
        }
      })
      .catch((err) => {
        console.warn('Cannot enumerate camera devices:', err);
      });
  }, []);

  const stopCameraScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn('Error stopping html5QrCode:', e);
      }
      html5QrCodeRef.current = null;
    }
    setIsCameraActive(false);
    setIsScanning(false);
  };

  const startCameraScanner = async (cameraIdOverride?: string) => {
    try {
      setCameraError('');
      if (html5QrCodeRef.current) {
        await stopCameraScanner();
      }

      const qrScanner = new Html5Qrcode(qrRegionId);
      html5QrCodeRef.current = qrScanner;

      let cameraConfig: any = { facingMode: 'environment' };
      if (cameraIdOverride) {
        cameraConfig = cameraIdOverride;
      } else if (selectedCameraId) {
        cameraConfig = selectedCameraId;
      }

      const scanConfig = {
        fps: 12,
        qrbox: { width: 220, height: 220 },
        aspectRatio: 1.333
      };

      const handleSuccess = (decodedText: string) => {
        handleCodeDetected(decodedText);
      };

      const handleFailure = () => {};

      try {
        await qrScanner.start(cameraConfig, scanConfig, handleSuccess, handleFailure);
        setIsCameraActive(true);
        setIsScanning(true);
      } catch (err1) {
        console.warn('Environment camera failed, trying front/user camera...', err1);
        try {
          await qrScanner.start({ facingMode: 'user' }, scanConfig, handleSuccess, handleFailure);
          setIsCameraActive(true);
          setIsScanning(true);
        } catch (err2) {
          console.warn('FacingMode camera failed, checking device list...', err2);
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            setCameras(devices);
            const fallbackId = devices[0].id;
            setSelectedCameraId(fallbackId);
            await qrScanner.start(fallbackId, scanConfig, handleSuccess, handleFailure);
            setIsCameraActive(true);
            setIsScanning(true);
          } else {
            throw new Error('Kamera tidak ditemukan atau akses ditolak oleh peramban/sistem.');
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to start camera scanner:', err);
      setIsCameraActive(false);
      setIsScanning(false);
      setCameraError(err?.message || 'Gagal membuka kamera. Pastikan izin kamera telah diberikan.');
    }
  };

  useEffect(() => {
    if (isScanning) {
      startCameraScanner();
    } else {
      stopCameraScanner();
    }

    return () => {
      stopCameraScanner();
    };
  }, []);

  const handleCodeDetected = (scannedText: string) => {
    const cleaned = scannedText.trim();
    const itemIdCandidate = cleaned.includes('|') ? cleaned.split('|')[0].trim() : cleaned;

    const match = items.find(
      (item) =>
        String(item.ItemID).toLowerCase() === itemIdCandidate.toLowerCase() ||
        String(item.ItemID).toLowerCase() === cleaned.toLowerCase() ||
        String(item.ItemName).toLowerCase().includes(cleaned.toLowerCase())
    );

    if (match) {
      setSelectedItemId(match.ItemID);
      setScannedMessage(`QR Code Terdeteksi: ${match.ItemID} - ${match.ItemName}`);
    } else {
      setScannedMessage(`QR Scanned: "${cleaned}" (Item tidak ditemukan dalam database)`);
    }
  };

  const handleFileQrScan = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const tempScanner = new Html5Qrcode('qr-input-file-temp');
    tempScanner
      .scanFile(file, true)
      .then((decodedText) => {
        handleCodeDetected(decodedText);
      })
      .catch((err) => {
        alert('Tidak dapat membaca QR Code dari file foto. Pastikan QR code terlihat jelas.');
        console.error('QR file scan error:', err);
      });
  };

  const selectedItem = items.find(i => String(i.ItemID).toLowerCase() === String(selectedItemId).toLowerCase());

  const handleItemSelect = (item: RecordRow) => {
    setSelectedItemId(item.ItemID);
    setScannedMessage(`QR Code Selected: ${item.ItemID} - ${item.ItemName}`);
  };

  const handleManualSearch = (code: string) => {
    setManualCode(code);
    const match = items.find(i => 
      String(i.ItemID).toLowerCase() === code.toLowerCase() ||
      String(i.ItemName).toLowerCase().includes(code.toLowerCase())
    );
    if (match) {
      setSelectedItemId(match.ItemID);
      setScannedMessage(`Pencarian Ditemukan: ${match.ItemID} - ${match.ItemName}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) {
      alert('Pilih item terlebih dahulu melalui scan QR atau pencarian ID');
      return;
    }
    if (qty <= 0) {
      alert('Jumlah quantity harus lebih besar dari 0');
      return;
    }

    stopCameraScanner();
    onScanSuccess(selectedItem, qty, deptOrSupplier, remark, attachment, attachmentName);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <style>{`
        #qr-input-scanner-region video {
          width: 100% !important;
          height: 100% !important;
          max-height: 280px !important;
          object-fit: cover !important;
          border-radius: 0.75rem !important;
        }
        #qr-input-scanner-region {
          width: 100% !important;
          border: none !important;
        }
        #qr-input-scanner-region img {
          display: none !important;
        }
      `}</style>
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-100 my-8">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-2xl bg-yellow-400 text-slate-900 flex items-center justify-center font-bold text-base shadow-xs">
              <i className="fa-solid fa-qrcode"></i>
            </div>
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider">
                Scan QR Code - {activeTab === 'MaterialReceive' ? 'Input Material Receive' : 'Input Material Issued'}
              </h3>
              <p className="text-[10px] text-yellow-400 font-semibold">
                Arahkan kamera ke label QR Code material untuk menginput data transaksi otomatis
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCameraScanner();
              onClose();
            }}
            className="text-slate-400 hover:text-white text-xl cursor-pointer px-2"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Live Camera Scanner Box */}
          <div className="bg-slate-950 rounded-2xl p-3 text-white relative overflow-hidden flex flex-col items-center justify-center min-h-[260px] border-2 border-slate-800">
            <div id={qrRegionId} className="w-full h-full min-h-[220px]"></div>
            <div id="qr-input-file-temp" className="hidden"></div>

            {!isCameraActive && !cameraError && (
              <div className="p-6 text-center space-y-3 my-auto z-10">
                <div className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 text-yellow-400 flex items-center justify-center mx-auto text-2xl">
                  <i className="fa-solid fa-camera"></i>
                </div>
                <p className="text-xs text-slate-300 font-medium">
                  Klik tombol di bawah untuk mengaktifkan pemindai kamera
                </p>
                <button
                  type="button"
                  onClick={() => startCameraScanner()}
                  className="bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-black text-xs px-5 py-2.5 rounded-xl shadow-lg transition cursor-pointer inline-flex items-center gap-2"
                >
                  <i className="fa-solid fa-video"></i> Aktifkan Kamera Scanner
                </button>
              </div>
            )}

            {isCameraActive && (
              <div className="mt-2 flex items-center justify-between w-full px-2 z-10">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-[10px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span> Live Camera Active
                </span>
                <button
                  type="button"
                  onClick={stopCameraScanner}
                  className="bg-rose-600/90 hover:bg-rose-700 text-white font-bold text-[11px] px-3 py-1 rounded-xl transition cursor-pointer shadow-md"
                >
                  <i className="fa-solid fa-stop mr-1"></i> Stop Kamera
                </button>
              </div>
            )}
          </div>

          {/* Camera Selector & Error Handling */}
          {cameraError && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-amber-800">
                <i className="fa-solid fa-triangle-exclamation text-amber-600"></i> Info Akses Kamera:
              </p>
              <p className="text-[11px] leading-relaxed">{cameraError}</p>
              <div className="pt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => startCameraScanner()}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] rounded-lg cursor-pointer"
                >
                  Coba Lagi
                </button>
              </div>
            </div>
          )}

          {cameras.length > 1 && (
            <div className="flex items-center gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <label className="font-bold text-slate-700 shrink-0 flex items-center gap-1">
                <i className="fa-solid fa-camera-rotate text-yellow-600"></i> Pilih Kamera:
              </label>
              <select
                value={selectedCameraId}
                onChange={(e) => {
                  setSelectedCameraId(e.target.value);
                  startCameraScanner(e.target.value);
                }}
                className="w-full p-1.5 border border-slate-300 rounded-lg text-xs bg-white font-semibold text-slate-800 outline-none"
              >
                {cameras.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label || `Camera ${c.id}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Upload Foto QR Code & Scanned status badge */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1 border-t border-slate-100">
            <div>
              <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl border border-slate-200 cursor-pointer transition">
                <i className="fa-solid fa-file-image text-emerald-600"></i>
                <span>Upload Foto / Gambar QR Code</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileQrScan}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {scannedMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
              <i className="fa-solid fa-circle-check text-emerald-600 text-sm"></i>
              <span>{scannedMessage}</span>
            </div>
          )}

          {/* Quick QR Code Preset Buttons for Testing */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <i className="fa-solid fa-bolt text-yellow-500 mr-1"></i> Quick Test Item QR Scan:
            </label>
            <div className="flex flex-wrap gap-2">
              {items.slice(0, 5).map((item) => (
                <button
                  key={item.ItemID}
                  type="button"
                  onClick={() => handleItemSelect(item)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    selectedItemId === item.ItemID
                      ? 'bg-yellow-400 text-slate-900 shadow-xs ring-2 ring-yellow-500/50'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <i className="fa-solid fa-qrcode text-[10px] text-slate-500"></i>
                  <span>{item.ItemID}</span>
                  <span className="text-[10px] opacity-75 font-normal truncate max-w-[100px]">({item.ItemName})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Manual Search & Item Selection */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Atau Cari Kode Item ID / Nama Item:
            </label>
            <div className="relative">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => handleManualSearch(e.target.value)}
                placeholder="Ketik Item ID (contoh: 32.0044)..."
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-yellow-400 outline-none bg-slate-50 font-medium"
              />
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-3 text-slate-400 text-xs"></i>
            </div>
          </div>

          {/* Selected Item Details Card */}
          {selectedItem && (
            <div className="p-4 bg-yellow-50/60 border border-yellow-200 rounded-2xl space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-yellow-400 text-slate-900 px-2 py-0.5 rounded-md">
                    {selectedItem.ItemID}
                  </span>
                  <h4 className="font-bold text-sm text-slate-900 mt-1">{selectedItem.ItemName}</h4>
                </div>
                <div className="text-right text-xs">
                  <span className="text-slate-500 block text-[10px]">Lokasi: {selectedItem.Location || 'Gudang Utama'}</span>
                  <span className="font-black text-emerald-700">Stok: {selectedItem.LastStock || 0} {selectedItem.UoM || 'Pcs'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Transaction Fields: Qty, Department/Supplier, Remark, Attachment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Jumlah Quantity ({selectedItem?.UoM || 'Pcs'})
              </label>
              <input
                type="number"
                min="1"
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                required
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-yellow-400 outline-none bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                {activeTab === 'MaterialReceive' ? 'Pemasok / Supplier' : 'Departemen Peminta'}
              </label>
              <input
                type="text"
                value={deptOrSupplier}
                onChange={(e) => setDeptOrSupplier(e.target.value)}
                required
                placeholder={activeTab === 'MaterialReceive' ? 'Nama Supplier...' : 'Nama Departemen...'}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-yellow-400 outline-none bg-slate-50"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Catatan / Keterangan
              </label>
              <input
                type="text"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="contoh: Rig Silver City 20 Well Site A / Batch Pengiriman..."
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-yellow-400 outline-none bg-slate-50"
              />
            </div>

            {/* Attachment Field */}
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                <i className="fa-solid fa-paperclip mr-1 text-slate-400"></i> Lampiran (Surat Jalan / Bukti)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar,.7z"
                  id="qr-scan-attachment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      processFileUpload(file, (result, fileName) => {
                        setAttachment(result);
                        setAttachmentName(fileName);
                      });
                      e.target.value = '';
                    }
                  }}
                />
                {attachment ? (
                  <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 p-2 rounded-xl text-xs font-bold text-emerald-800 dark:text-emerald-300 w-full">
                    <div className="flex items-center gap-2 truncate">
                      {typeof attachment === 'string' && (attachment.startsWith('data:image/') || attachment.match(/\.(jpeg|jpg|gif|png|webp)$/i)) ? (
                        <a href={attachment} target="_blank" rel="noreferrer" title="Click to view full image">
                          <img
                            src={attachment}
                            alt="Preview"
                            className="w-8 h-8 object-cover rounded-lg border border-emerald-300 dark:border-emerald-700 hover:scale-105 transition shrink-0"
                          />
                        </a>
                      ) : (
                        <i className="fa-solid fa-paperclip text-emerald-600 text-sm shrink-0"></i>
                      )}
                      <span className="truncate max-w-[180px] text-slate-800 dark:text-slate-100 font-extrabold">{attachmentName || 'Lampiran Dokumen'}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <label
                        htmlFor="qr-scan-attachment"
                        className="text-[11px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2 py-1 rounded-lg hover:underline cursor-pointer font-bold"
                      >
                        Ganti
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('Apakah Anda yakin ingin menghapus lampiran ini?')) {
                            setAttachment('');
                            setAttachmentName('');
                          }
                        }}
                        className="text-rose-500 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/60 p-1.5 rounded-lg cursor-pointer transition flex items-center gap-1 font-bold text-xs"
                        title="Hapus Lampiran"
                      >
                        <i className="fa-solid fa-trash-can text-xs"></i>
                        <span>Hapus</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <label
                    htmlFor="qr-scan-attachment"
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition border border-slate-200 flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-file-arrow-up"></i> Upload Surat Jalan / Dokumen Bukti
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                stopCameraScanner();
                onClose();
              }}
              className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={!selectedItem}
              className="px-6 py-2.5 bg-yellow-400 text-slate-900 rounded-xl text-xs font-bold hover:bg-yellow-500 shadow-md shadow-yellow-400/20 transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <i className="fa-solid fa-circle-check"></i>
              Simpan Data Transaksi ({activeTab === 'MaterialReceive' ? 'Receive' : 'Issued'})
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
