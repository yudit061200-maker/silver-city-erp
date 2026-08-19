import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { RecordRow } from '../types';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (scannedText: string, itemObj?: RecordRow | null) => void;
  itemsList: RecordRow[];
  title?: string;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  itemsList,
  title = 'Scan QR Code Material'
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [cameraError, setCameraError] = useState<string>('');
  const [manualCode, setManualCode] = useState<string>('');
  const [scannedFeedback, setScannedFeedback] = useState<string>('');

  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const qrRegionId = 'qr-camera-reader-element';

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    // Try enumerating cameras
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          setSelectedCameraId(devices[0].id);
        } else {
          setCameraError('No camera found on your device.');
        }
      })
      .catch((err) => {
        console.warn('Camera access warning:', err);
        setCameraError('Camera permissions restricted or unavailable. You can upload a QR image or type an Item ID.');
      });

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async (cameraId?: string) => {
    try {
      setCameraError('');
      if (html5QrcodeRef.current && isScanning) {
        await stopCamera();
      }

      const qrScanner = new Html5Qrcode(qrRegionId);
      html5QrcodeRef.current = qrScanner;

      const scanConfig = {
        fps: 12,
        qrbox: { width: 220, height: 220 },
        aspectRatio: 1.333
      };

      const handleSuccess = (decodedText: string) => {
        handleScannedResult(decodedText);
      };

      const handleFailure = () => {};

      try {
        const targetCam = cameraId || selectedCameraId || { facingMode: 'environment' };
        await qrScanner.start(targetCam, scanConfig, handleSuccess, handleFailure);
        setIsScanning(true);
      } catch (err1) {
        try {
          await qrScanner.start({ facingMode: 'user' }, scanConfig, handleSuccess, handleFailure);
          setIsScanning(true);
        } catch (err2) {
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            setCameras(devices);
            await qrScanner.start(devices[0].id, scanConfig, handleSuccess, handleFailure);
            setIsScanning(true);
          } else {
            throw new Error('Kamera tidak ditemukan atau akses ditolak.');
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to start camera:', err);
      setCameraError('Gagal membuka kamera: ' + (err?.message || 'Akses ditolak'));
      setIsScanning(false);
    }
  };

  const stopCamera = async () => {
    if (html5QrcodeRef.current) {
      try {
        if (html5QrcodeRef.current.isScanning) {
          await html5QrcodeRef.current.stop();
        }
        html5QrcodeRef.current.clear();
      } catch (err) {
        console.warn('Error stopping html5Qrcode:', err);
      }
      html5QrcodeRef.current = null;
    }
    setIsScanning(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const html5QrCode = new Html5Qrcode('qr-file-temp-element');
    html5QrCode
      .scanFile(file, true)
      .then((decodedText) => {
        handleScannedResult(decodedText);
      })
      .catch((err) => {
        alert('Unable to read QR Code from the uploaded image. Please ensure the QR code is clearly visible.');
        console.error('QR file scan error:', err);
      });
  };

  const handleScannedResult = (scannedText: string) => {
    // Format could be: "32.0044 | Firefighting Foam..." or just "32.0044"
    const cleanedText = scannedText.trim();
    const itemIdCandidate = cleanedText.includes('|') ? cleanedText.split('|')[0].trim() : cleanedText;

    // Find in itemsList
    const matchedItem = itemsList.find(
      (item) =>
        String(item.ItemID).toLowerCase() === itemIdCandidate.toLowerCase() ||
        String(item.ItemID).toLowerCase() === cleanedText.toLowerCase() ||
        String(item.ItemName).toLowerCase() === cleanedText.toLowerCase()
    ) || null;

    setScannedFeedback(`Successfully Scanned: ${itemIdCandidate} ${matchedItem ? `- ${matchedItem.ItemName}` : ''}`);

    // Call callback
    onScanSuccess(itemIdCandidate, matchedItem);

    // Stop camera and close
    setTimeout(() => {
      stopCamera();
      onClose();
    }, 600);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <style>{`
        #qr-camera-reader-element video {
          width: 100% !important;
          height: 100% !important;
          max-height: 280px !important;
          object-fit: cover !important;
          border-radius: 0.75rem !important;
        }
        #qr-camera-reader-element {
          width: 100% !important;
          border: none !important;
        }
        #qr-camera-reader-element img {
          display: none !important;
        }
      `}</style>
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 flex flex-col relative text-slate-800">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 text-slate-900 flex items-center justify-center font-black text-sm">
              <i className="fa-solid fa-qrcode"></i>
            </div>
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-white">{title}</h3>
              <p className="text-[10px] text-emerald-400 font-medium">Material Receive & Material Issued</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center justify-center text-sm cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {scannedFeedback && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold text-center animate-pulse">
              <i className="fa-solid fa-circle-check text-emerald-600 mr-1.5"></i>
              {scannedFeedback}
            </div>
          )}

          {/* Scanner View Area */}
          <div className="relative bg-slate-900 rounded-2xl overflow-hidden min-h-[260px] flex flex-col items-center justify-center text-white border-2 border-slate-800">
            <div id={qrRegionId} className="w-full h-full min-h-[250px]"></div>
            <div id="qr-file-temp-element" className="hidden"></div>

            {!isScanning && (
              <div className="p-6 text-center space-y-3 my-auto">
                <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 text-emerald-400 flex items-center justify-center mx-auto text-2xl">
                  <i className="fa-solid fa-camera"></i>
                </div>
                <p className="text-xs text-slate-300 font-medium">
                  Point the camera at the item QR code label or select another input method below.
                </p>
                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs px-5 py-2.5 rounded-xl shadow-lg transition cursor-pointer inline-flex items-center gap-2"
                >
                  <i className="fa-solid fa-video"></i> Open Camera Scanner
                </button>
              </div>
            )}

            {isScanning && (
              <button
                type="button"
                onClick={stopCamera}
                className="absolute bottom-3 bg-red-600/90 hover:bg-red-700 text-white font-bold text-[11px] px-3.5 py-1.5 rounded-xl transition cursor-pointer shadow-md"
              >
                <i className="fa-solid fa-stop mr-1"></i> Stop Camera
              </button>
            )}
          </div>

          {cameraError && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-[11px]">
              <p className="font-bold mb-1"><i className="fa-solid fa-triangle-exclamation mr-1"></i> Camera Info:</p>
              <p>{cameraError}</p>
            </div>
          )}

          {cameras.length > 1 && isScanning && (
            <div className="flex items-center gap-2 text-xs">
              <label className="font-bold text-slate-600 shrink-0">Select Camera:</label>
              <select
                value={selectedCameraId}
                onChange={(e) => {
                  setSelectedCameraId(e.target.value);
                  startCamera(e.target.value);
                }}
                className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-slate-50 font-medium"
              >
                {cameras.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label || `Camera ${c.id}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Alternative options: Upload Image or Manual Item ID */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                <i className="fa-solid fa-file-image text-emerald-600 mr-1"></i> Upload Photo / QR Code File:
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Or type Item ID (e.g. 32.0044)..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && manualCode.trim()) {
                    e.preventDefault();
                    handleScannedResult(manualCode);
                  }
                }}
                className="flex-grow px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
              />
              <button
                type="button"
                onClick={() => {
                  if (manualCode.trim()) {
                    handleScannedResult(manualCode);
                  }
                }}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer shrink-0"
              >
                Use ID
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex items-center justify-end">
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
