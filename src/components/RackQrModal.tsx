import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { CompanyHeader, RecordRow } from '../types';
import {
  RackGroup,
  UNASSIGNED_RACK_NAME,
  buildRackQrUrl,
  extractRackFromQrText,
  generateQrDataUrl,
  groupItemsByRack,
} from '../utils/rackQr';
import { parseNumberValue } from '../utils/currency';

export type RackQrModalMode = 'print' | 'scan' | 'view';
type LabelLayoutSize = 'compact' | 'medium' | 'poster';

interface RackQrModalProps {
  inventoryItems: RecordRow[];
  companyHeader: CompanyHeader;
  initialMode?: RackQrModalMode;
  initialRackName?: string | null;
  isStandalonePublicView?: boolean;
  onClose: () => void;
  onOpenItemDetails?: (itemId: string) => void;
  onFilterInventoryByRack?: (rackName: string) => void;
  onOpenLightbox?: (src: string, caption: string) => void;
}

export const RackQrModal: React.FC<RackQrModalProps> = ({
  inventoryItems,
  companyHeader,
  initialMode = 'print',
  initialRackName = null,
  isStandalonePublicView = false,
  onClose,
  onOpenItemDetails,
  onFilterInventoryByRack,
  onOpenLightbox,
}) => {
  const allRacks = useMemo(() => groupItemsByRack(inventoryItems), [inventoryItems]);

  const [mode, setMode] = useState<RackQrModalMode>(initialMode);
  const [rackSearch, setRackSearch] = useState('');
  const [itemSearchInRack, setItemSearchInRack] = useState('');

  // Print selections
  const [selectedRackNames, setSelectedRackNames] = useState<string[]>(() => {
    if (initialRackName) return [initialRackName];
    const firstAssigned = allRacks.find((r) => r.rackName !== UNASSIGNED_RACK_NAME);
    return firstAssigned ? [firstAssigned.rackName] : allRacks[0] ? [allRacks[0].rackName] : [];
  });
  const [copiesPerRack, setCopiesPerRack] = useState<number>(1);
  const [labelSize, setLabelSize] = useState<LabelLayoutSize>('medium');
  const [showItemPreviewOnLabel, setShowItemPreviewOnLabel] = useState<boolean>(true);
  const [qrDataUrls, setQrDataUrls] = useState<Record<string, string>>({});

  // Viewed / Scanned Rack
  const [activeRackName, setActiveRackName] = useState<string | null>(initialRackName || null);

  // Camera Scanner States
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [cameraError, setCameraError] = useState<string>('');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [scanFeedback, setScanFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const qrRegionId = 'rack-qr-scanner-region';

  // Ensure initial selection stays valid once Firestore data hydrates
  useEffect(() => {
    if (initialRackName) {
      setActiveRackName(initialRackName);
      setSelectedRackNames([initialRackName]);
    } else if (selectedRackNames.length === 0 && allRacks.length > 0) {
      const firstAssigned = allRacks.find((r) => r.rackName !== UNASSIGNED_RACK_NAME) || allRacks[0];
      if (firstAssigned) {
        setSelectedRackNames([firstAssigned.rackName]);
      }
    }
  }, [initialRackName, allRacks.length]);

  const filteredRacks = useMemo(() => {
    const q = rackSearch.trim().toLowerCase();
    if (!q) return allRacks;
    return allRacks.filter(
      (r) =>
        r.rackName.toLowerCase().includes(q) ||
        r.items.some(
          (i) =>
            String(i.ItemID || '').toLowerCase().includes(q) ||
            String(i.ItemName || '').toLowerCase().includes(q)
        )
    );
  }, [allRacks, rackSearch]);

  const selectedRacks: RackGroup[] = useMemo(() => {
    const selectedSet = new Set(selectedRackNames.map((n) => n.toLowerCase()));
    return allRacks.filter((r) => selectedSet.has(r.rackKey));
  }, [allRacks, selectedRackNames]);

  // Generate local QR data URLs for all selected racks (plus active rack)
  useEffect(() => {
    let cancelled = false;
    const namesToGenerate = Array.from(
      new Set([
        ...selectedRacks.map((r) => r.rackName),
        ...(activeRackName ? [activeRackName] : []),
      ])
    ).filter((name) => name && !qrDataUrls[name]);

    if (namesToGenerate.length === 0) return;

    Promise.all(
      namesToGenerate.map(async (name) => {
        const url = buildRackQrUrl(name);
        const dataUrl = await generateQrDataUrl(url, 280);
        return [name, dataUrl] as const;
      })
    )
      .then((entries) => {
        if (cancelled) return;
        setQrDataUrls((prev) => {
          const next = { ...prev };
          for (const [name, dataUrl] of entries) {
            next[name] = dataUrl;
          }
          return next;
        });
      })
      .catch((err) => {
        console.error('Failed to generate rack QR code:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedRacks, activeRackName]);

  const activeRackGroup = useMemo(() => {
    if (!activeRackName) return null;
    const key = activeRackName.trim().toLowerCase();
    return (
      allRacks.find((r) => r.rackKey === key || r.rackName.toLowerCase() === key) || {
        rackKey: key,
        rackName: activeRackName,
        items: [],
        totalStock: 0,
        needOrderCount: 0,
      }
    );
  }, [allRacks, activeRackName]);

  const filteredRackItems = useMemo(() => {
    if (!activeRackGroup) return [];
    const q = itemSearchInRack.trim().toLowerCase();
    if (!q) return activeRackGroup.items;
    return activeRackGroup.items.filter(
      (item) =>
        String(item.ItemID || '').toLowerCase().includes(q) ||
        String(item.ItemName || '').toLowerCase().includes(q) ||
        String(item.Category || '').toLowerCase().includes(q) ||
        String(item.Status || '').toLowerCase().includes(q)
    );
  }, [activeRackGroup, itemSearchInRack]);

  const stopCameraScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn('Error stopping rack QR scanner:', e);
      }
      html5QrCodeRef.current = null;
    }
    setIsCameraActive(false);
  };

  const handleRackCodeDetected = (decodedText: string) => {
    const rackName = extractRackFromQrText(decodedText, allRacks);
    if (rackName) {
      stopCameraScanner();
      setScanFeedback({ type: 'success', text: `QR Rak terdeteksi: ${rackName}` });
      setActiveRackName(rackName);
      setItemSearchInRack('');
      setMode('view');
    } else {
      setScanFeedback({
        type: 'error',
        text: `QR "${decodedText}" tidak dikenali sebagai QR Rak. Pastikan Anda memindai label QR Rak.`,
      });
    }
  };

  const startCameraScanner = async (cameraIdOverride?: string) => {
    try {
      setCameraError('');
      setScanFeedback(null);
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
        aspectRatio: 1.333,
      };

      const onSuccess = (decodedText: string) => {
        handleRackCodeDetected(decodedText);
      };
      const onFailure = () => {};

      try {
        await qrScanner.start(cameraConfig, scanConfig, onSuccess, onFailure);
        setIsCameraActive(true);
      } catch {
        try {
          await qrScanner.start({ facingMode: 'user' }, scanConfig, onSuccess, onFailure);
          setIsCameraActive(true);
        } catch {
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            setCameras(devices);
            const fallbackId = devices[0].id;
            setSelectedCameraId(fallbackId);
            await qrScanner.start(fallbackId, scanConfig, onSuccess, onFailure);
            setIsCameraActive(true);
          } else {
            throw new Error('Kamera tidak ditemukan atau izin kamera ditolak oleh browser.');
          }
        }
      }
    } catch (err: any) {
      setIsCameraActive(false);
      setCameraError(err?.message || 'Gagal membuka kamera. Pastikan izin kamera telah diaktifkan.');
    }
  };

  useEffect(() => {
    if (mode === 'scan') {
      Html5Qrcode.getCameras()
        .then((devices) => {
          if (devices && devices.length > 0) {
            setCameras(devices);
            if (!selectedCameraId) setSelectedCameraId(devices[0].id);
          }
        })
        .catch(() => {});
      const timer = setTimeout(() => {
        startCameraScanner();
      }, 120);
      return () => {
        clearTimeout(timer);
        stopCameraScanner();
      };
    } else {
      stopCameraScanner();
    }
  }, [mode]);

  useEffect(() => {
    return () => {
      stopCameraScanner();
    };
  }, []);

  const handleFileQrScan = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanFeedback(null);
    const tempScanner = new Html5Qrcode('rack-qr-file-temp');
    tempScanner
      .scanFile(file, true)
      .then((decodedText) => {
        handleRackCodeDetected(decodedText);
      })
      .catch(() => {
        setScanFeedback({
          type: 'error',
          text: 'Tidak dapat membaca QR Code dari foto tersebut. Pastikan gambar QR terlihat jelas.',
        });
      })
      .finally(() => {
        e.target.value = '';
      });
  };

  const toggleRackSelection = (rackName: string) => {
    setSelectedRackNames((prev) =>
      prev.includes(rackName) ? prev.filter((r) => r !== rackName) : [...prev, rackName]
    );
  };

  const handleSelectAllFiltered = () => {
    setSelectedRackNames(
      filteredRacks
        .filter((r) => r.rackName !== UNASSIGNED_RACK_NAME)
        .map((r) => r.rackName)
    );
  };

  const openRackContents = (rackName: string) => {
    setActiveRackName(rackName);
    setItemSearchInRack('');
    setMode('view');
  };

  const openPrintForSingleRack = (rackName: string) => {
    setSelectedRackNames([rackName]);
    setMode('print');
  };

  const totalLabelsToPrint = selectedRacks.length * copiesPerRack;

  const gridClass =
    labelSize === 'compact'
      ? 'grid-cols-2 sm:grid-cols-3 print:grid-cols-3 gap-3'
      : labelSize === 'medium'
      ? 'grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-4'
      : 'grid-cols-1 print:grid-cols-1 gap-5';

  return (
    <div
      onClick={() => {
        if (!isStandalonePublicView) {
          stopCameraScanner();
          onClose();
        }
      }}
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto"
    >
      <style>{`
        #rack-qr-scanner-region video {
          width: 100% !important;
          height: 100% !important;
          max-height: 280px !important;
          object-fit: cover !important;
          border-radius: 0.75rem !important;
        }
        #rack-qr-scanner-region {
          width: 100% !important;
          border: none !important;
        }
        #rack-qr-scanner-region img {
          display: none !important;
        }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-5xl w-full my-4 sm:my-6 border border-slate-200 dark:border-slate-800 flex flex-col max-h-[94vh] overflow-hidden text-slate-800 dark:text-slate-100 print:max-h-none print:my-0 print:rounded-none print:border-none print:shadow-none print:bg-white print:text-black"
      >
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-5 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-yellow-400 text-slate-950 flex items-center justify-center text-lg font-black shadow-md shadow-yellow-400/20">
              <i className="fa-solid fa-boxes-packing"></i>
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black uppercase tracking-wider">
                QR Code Rak Gudang
              </h3>
              <p className="text-[11px] text-slate-300 font-medium">
                Cetak label QR per rak &amp; pindai untuk melihat daftar barang di rak tersebut
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode Switcher */}
            <div className="flex items-center bg-slate-800 p-1 rounded-2xl border border-slate-700 text-xs font-bold">
              <button
                type="button"
                onClick={() => setMode('print')}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                  mode === 'print'
                    ? 'bg-yellow-400 text-slate-950 font-black shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <i className="fa-solid fa-print text-[11px]"></i>
                <span>Cetak QR Rak</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('scan')}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                  mode === 'scan'
                    ? 'bg-yellow-400 text-slate-950 font-black shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <i className="fa-solid fa-camera text-[11px]"></i>
                <span>Scan QR Rak</span>
              </button>
              {activeRackName && (
                <button
                  type="button"
                  onClick={() => setMode('view')}
                  className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                    mode === 'view'
                      ? 'bg-emerald-500 text-white font-black shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <i className="fa-solid fa-list-check text-[11px]"></i>
                  <span>Isi Rak</span>
                </button>
              )}
            </div>

            {isStandalonePublicView ? (
              <button
                type="button"
                onClick={() => {
                  stopCameraScanner();
                  onClose();
                }}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs transition cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <i className="fa-solid fa-right-to-bracket"></i>
                <span>Masuk ke ERP</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  stopCameraScanner();
                  onClose();
                }}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center justify-center text-lg cursor-pointer"
                aria-label="Tutup"
              >
                &times;
              </button>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-grow space-y-5 print:p-0 print:overflow-visible">
          {/* ===================== MODE 1: CETAK QR RAK ===================== */}
          {mode === 'print' && (
            <>
              {/* Rack Picker & Print Controls (hidden when printing) */}
              <div className="space-y-4 print:hidden">
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                        1. Pilih Rak / Lokasi ({allRacks.length} Rak Tersedia)
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Centang satu atau beberapa rak yang ingin dicetak label QR-nya. Klik ikon mata untuk melihat daftar barang di rak.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleSelectAllFiltered}
                        className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer transition"
                      >
                        Pilih Semua ({filteredRacks.filter((r) => r.rackName !== UNASSIGNED_RACK_NAME).length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedRackNames([])}
                        className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[11px] font-bold text-rose-600 dark:text-rose-400 cursor-pointer transition"
                      >
                        Reset Pilihan
                      </button>
                    </div>
                  </div>

                  {/* Search Rack */}
                  <div className="relative">
                    <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                    <input
                      type="text"
                      value={rackSearch}
                      onChange={(e) => setRackSearch(e.target.value)}
                      placeholder="Cari nama rak (misal: 1/H, 2/A) atau cari berdasarkan nama/kode barang..."
                      className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-yellow-400"
                    />
                    {rackSearch && (
                      <button
                        type="button"
                        onClick={() => setRackSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-sm cursor-pointer px-1"
                      >
                        &times;
                      </button>
                    )}
                  </div>

                  {/* Rack Selection Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-52 overflow-y-auto pr-1">
                    {filteredRacks.length === 0 ? (
                      <div className="col-span-full text-center py-6 text-xs text-slate-400 font-medium">
                        Tidak ada rak yang cocok dengan pencarian &quot;{rackSearch}&quot;
                      </div>
                    ) : (
                      filteredRacks.map((rack) => {
                        const isChecked = selectedRackNames.includes(rack.rackName);
                        return (
                          <div
                            key={rack.rackKey}
                            className={`flex items-center justify-between gap-1.5 p-2 rounded-xl border text-xs transition ${
                              isChecked
                                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 shadow-2xs'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                            }`}
                          >
                            <label className="flex items-center gap-2 min-w-0 flex-grow cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleRackSelection(rack.rackName)}
                                className="w-3.5 h-3.5 accent-amber-500 rounded cursor-pointer shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="font-black text-slate-900 dark:text-white truncate text-xs">
                                  {rack.rackName}
                                </div>
                                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                                  {rack.items.length} barang &bull; stok {rack.totalStock.toLocaleString('id-ID')}
                                </div>
                              </div>
                            </label>
                            <button
                              type="button"
                              onClick={() => openRackContents(rack.rackName)}
                              title={`Lihat daftar barang di rak ${rack.rackName}`}
                              className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-slate-600 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center justify-center shrink-0 transition cursor-pointer"
                            >
                              <i className="fa-solid fa-eye text-[11px]"></i>
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Print Options */}
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <label className="font-extrabold text-slate-700 dark:text-slate-200">
                        Ukuran Label:
                      </label>
                      <select
                        value={labelSize}
                        onChange={(e) => setLabelSize(e.target.value as LabelLayoutSize)}
                        className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 font-bold text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-yellow-400 cursor-pointer"
                      >
                        <option value="compact">Kecil (3 Kolom / Stiker Rak)</option>
                        <option value="medium">Sedang (2 Kolom / Kartu Rak)</option>
                        <option value="poster">Besar (1 Kolom / Poster Daftar Rak)</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="font-extrabold text-slate-700 dark:text-slate-200">
                        Copy / Rak:
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={copiesPerRack}
                        onChange={(e) =>
                          setCopiesPerRack(Math.max(1, Math.min(12, Number(e.target.value) || 1)))
                        }
                        className="w-16 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-2 py-1.5 text-center font-black text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400"
                      />
                    </div>

                    {labelSize !== 'compact' && (
                      <label className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={showItemPreviewOnLabel}
                          onChange={(e) => setShowItemPreviewOnLabel(e.target.checked)}
                          className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                        />
                        <span>Tampilkan ringkasan barang di label</span>
                      </label>
                    )}
                  </div>

                  <span className="px-3 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-black text-[11px] border border-emerald-200 dark:border-emerald-800">
                    {selectedRacks.length} Rak Dipilih &bull; Total {totalLabelsToPrint} Label
                  </span>
                </div>
              </div>

              {/* Printable Preview Grid */}
              {selectedRacks.length === 0 ? (
                <div className="p-10 text-center bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl text-xs text-slate-500 dark:text-slate-400 font-semibold print:hidden">
                  Pilih minimal 1 rak di atas untuk menampilkan preview &amp; mencetak QR Code Rak.
                </div>
              ) : (
                <div
                  id="printableQrArea"
                  className="p-4 bg-slate-100/80 dark:bg-slate-950/50 rounded-2xl border border-slate-200 dark:border-slate-800 print:bg-white print:p-0 print:border-none"
                >
                  <div className={`grid ${gridClass}`}>
                    {selectedRacks.flatMap((rack) =>
                      Array.from({ length: copiesPerRack }).map((_, copyIdx) => {
                        const qrSrc = qrDataUrls[rack.rackName];
                        const maxPreviewItems = labelSize === 'poster' ? 20 : 5;
                        const previewItems = rack.items.slice(0, maxPreviewItems);
                        const remainingCount = Math.max(0, rack.items.length - previewItems.length);

                        return (
                          <div
                            key={`${rack.rackKey}-copy-${copyIdx}`}
                            className={`bg-white text-slate-900 rounded-2xl border-2 border-slate-900 shadow-xs flex flex-col justify-between print:shadow-none print:rounded-lg print:border-2 print:border-slate-900 print:break-inside-avoid ${
                              labelSize === 'compact'
                                ? 'p-3 text-center items-center'
                                : labelSize === 'medium'
                                ? 'p-4'
                                : 'p-5'
                            }`}
                          >
                            {/* Top Company + Rack Header */}
                            <div className="w-full border-b-2 border-slate-900 pb-2 mb-2.5 flex items-center justify-between gap-2">
                              <div className={labelSize === 'compact' ? 'w-full text-center' : 'text-left'}>
                                <div className="text-[9px] font-black uppercase tracking-wider text-slate-600 line-clamp-1">
                                  {companyHeader.companyName || 'PT. SILVER CITY DRILLING'}
                                </div>
                                <div
                                  className={`font-black text-slate-950 tracking-tight leading-tight mt-0.5 ${
                                    labelSize === 'compact'
                                      ? 'text-base'
                                      : labelSize === 'medium'
                                      ? 'text-xl'
                                      : 'text-2xl'
                                  }`}
                                >
                                  RAK: {rack.rackName}
                                </div>
                              </div>
                              {labelSize !== 'compact' && (
                                <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-yellow-400 text-[10px] font-black uppercase tracking-wider shrink-0">
                                  {rack.items.length} Barang
                                </span>
                              )}
                            </div>

                            {/* QR + Summary Body */}
                            {labelSize === 'compact' ? (
                              <div className="flex flex-col items-center w-full">
                                {qrSrc ? (
                                  <img
                                    src={qrSrc}
                                    alt={`QR Rak ${rack.rackName}`}
                                    className="w-28 h-28 object-contain border border-slate-200 p-1 rounded-xl bg-white my-1"
                                  />
                                ) : (
                                  <div className="w-28 h-28 flex items-center justify-center text-[10px] text-slate-400 border border-slate-200 rounded-xl my-1">
                                    Memuat QR...
                                  </div>
                                )}
                                <div className="mt-1.5 text-[10px] font-extrabold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-300">
                                  {rack.items.length} Jenis Barang &bull; Stok {rack.totalStock.toLocaleString('id-ID')}
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start gap-4 w-full">
                                <div className="shrink-0 flex flex-col items-center">
                                  {qrSrc ? (
                                    <img
                                      src={qrSrc}
                                      alt={`QR Rak ${rack.rackName}`}
                                      className={`${
                                        labelSize === 'poster' ? 'w-40 h-40' : 'w-32 h-32'
                                      } object-contain border-2 border-slate-200 p-1.5 rounded-xl bg-white`}
                                    />
                                  ) : (
                                    <div
                                      className={`${
                                        labelSize === 'poster' ? 'w-40 h-40' : 'w-32 h-32'
                                      } flex items-center justify-center text-xs text-slate-400 border border-slate-200 rounded-xl`}
                                    >
                                      Memuat QR...
                                    </div>
                                  )}
                                  <span className="mt-1.5 text-[10px] font-black text-slate-700">
                                    Total Stok: {rack.totalStock.toLocaleString('id-ID')}
                                  </span>
                                </div>

                                <div className="min-w-0 flex-grow">
                                  {showItemPreviewOnLabel ? (
                                    <div className="space-y-1">
                                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                                        Daftar Barang di Rak {rack.rackName}:
                                      </div>
                                      <ul className="space-y-0.5 text-left">
                                        {previewItems.map((item, iIdx) => (
                                          <li
                                            key={`${rack.rackKey}-item-${item.ItemID}-${iIdx}`}
                                            className="text-[10px] leading-snug text-slate-800 flex items-baseline justify-between gap-2 border-b border-slate-100 pb-0.5"
                                          >
                                            <span className="truncate">
                                              <strong className="font-mono font-black text-slate-950 mr-1">
                                                {item.ItemID}
                                              </strong>
                                              {item.ItemName}
                                            </span>
                                            <span className="font-black text-slate-900 shrink-0">
                                              {parseNumberValue(item.CurrentStock ?? item.LastStock)}{' '}
                                              {item.UoM || ''}
                                            </span>
                                          </li>
                                        ))}
                                      </ul>
                                      {remainingCount > 0 && (
                                        <p className="text-[9px] font-bold text-slate-500 pt-0.5 italic">
                                          + {remainingCount} barang lainnya (scan QR untuk daftar lengkap &amp; stok terbaru)
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="space-y-1.5 text-left pt-1">
                                      <p className="text-xs font-extrabold text-slate-800">
                                        Lokasi Penyimpanan: {rack.rackName}
                                      </p>
                                      <p className="text-[11px] font-semibold text-slate-600">
                                        Jumlah jenis material terdaftar: <strong>{rack.items.length} item</strong>
                                      </p>
                                      <p className="text-[11px] font-semibold text-slate-600">
                                        Total stok saat ini: <strong>{rack.totalStock.toLocaleString('id-ID')}</strong>
                                      </p>
                                      <p className="text-[10px] text-slate-500 pt-1">
                                        Arahkan kamera HP atau Scanner ERP ke QR Code untuk melihat isi rak secara real-time.
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Footer Caption */}
                            <div className="mt-2.5 pt-1.5 border-t border-slate-200 w-full flex items-center justify-between text-[9px] font-bold text-slate-600">
                              <span>
                                <i className="fa-solid fa-qrcode mr-1"></i>
                                Scan QR untuk lihat isi rak secara real-time
                              </span>
                              {labelSize !== 'compact' && (
                                <span className="font-mono text-slate-800">LOC: {rack.rackName}</span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ===================== MODE 2: SCAN QR RAK ===================== */}
          {mode === 'scan' && (
            <div className="space-y-4 print:hidden">
              <div className="bg-slate-950 rounded-2xl p-3 text-white relative overflow-hidden flex flex-col items-center justify-center min-h-[260px] border-2 border-slate-800">
                <div id={qrRegionId} className="w-full h-full min-h-[220px]"></div>
                <div id="rack-qr-file-temp" className="hidden"></div>

                {!isCameraActive && !cameraError && (
                  <div className="p-6 text-center space-y-3 my-auto z-10">
                    <div className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 text-yellow-400 flex items-center justify-center mx-auto text-2xl">
                      <i className="fa-solid fa-camera"></i>
                    </div>
                    <p className="text-xs text-slate-300 font-medium">
                      Arahkan kamera ke stiker QR Rak untuk melihat daftar barang di rak tersebut
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
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span> Kamera Aktif &bull; Siap Scan QR Rak
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

              {cameraError && (
                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 rounded-2xl text-xs space-y-1.5">
                  <p className="font-bold flex items-center gap-1.5">
                    <i className="fa-solid fa-triangle-exclamation text-amber-600"></i> Info Akses Kamera:
                  </p>
                  <p className="text-[11px] leading-relaxed">{cameraError}</p>
                  <button
                    type="button"
                    onClick={() => startCameraScanner()}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] rounded-xl cursor-pointer"
                  >
                    Coba Buka Kamera Lagi
                  </button>
                </div>
              )}

              {cameras.length > 1 && (
                <div className="flex items-center gap-2 text-xs bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <label className="font-bold text-slate-700 dark:text-slate-200 shrink-0 flex items-center gap-1">
                    <i className="fa-solid fa-camera-rotate text-amber-500"></i> Pilih Kamera:
                  </label>
                  <select
                    value={selectedCameraId}
                    onChange={(e) => {
                      setSelectedCameraId(e.target.value);
                      startCameraScanner(e.target.value);
                    }}
                    className="w-full p-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-100 outline-none"
                  >
                    {cameras.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label || `Camera ${c.id}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer transition">
                  <i className="fa-solid fa-file-image text-emerald-600"></i>
                  <span>Upload Foto / Gambar QR Rak</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileQrScan}
                    className="hidden"
                  />
                </label>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  Tips: Anda juga bisa memindai stiker QR Rak langsung lewat kamera HP biasa.
                </span>
              </div>

              {scanFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 border ${
                    scanFeedback.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                  }`}
                >
                  <i
                    className={`fa-solid ${
                      scanFeedback.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'
                    }`}
                  ></i>
                  <span>{scanFeedback.text}</span>
                </div>
              )}

              {/* Quick Manual Rack Picker */}
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    <i className="fa-solid fa-warehouse text-amber-500 mr-1.5"></i>
                    Atau Pilih Rak Secara Manual:
                  </label>
                  <span className="text-[11px] text-slate-400 font-semibold">
                    {allRacks.length} Rak
                  </span>
                </div>
                <input
                  type="text"
                  value={rackSearch}
                  onChange={(e) => setRackSearch(e.target.value)}
                  placeholder="Ketik kode rak (misal: 1/H)..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold outline-none focus:ring-2 focus:ring-yellow-400"
                />
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pt-1">
                  {filteredRacks.slice(0, 36).map((rack) => (
                    <button
                      key={`manual-rack-${rack.rackKey}`}
                      type="button"
                      onClick={() => openRackContents(rack.rackName)}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-slate-200 dark:border-slate-700 hover:border-amber-400 text-xs font-bold text-slate-800 dark:text-slate-100 transition cursor-pointer flex items-center gap-1.5"
                    >
                      <i className="fa-solid fa-location-dot text-rose-500 text-[10px]"></i>
                      <span>{rack.rackName}</span>
                      <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                        {rack.items.length}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ===================== MODE 3: ISI RAK (VIEW CONTENTS) ===================== */}
          {mode === 'view' && activeRackGroup && (
            <div className="space-y-4">
              {/* Rack Hero Summary Card */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
                <div className="flex items-center gap-4">
                  {qrDataUrls[activeRackGroup.rackName] && (
                    <img
                      src={qrDataUrls[activeRackGroup.rackName]}
                      alt={`QR Rak ${activeRackGroup.rackName}`}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white p-1.5 shrink-0 shadow-md"
                    />
                  )}
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-yellow-400 text-slate-950 text-[10px] font-black uppercase tracking-wider">
                      <i className="fa-solid fa-location-dot"></i>
                      Lokasi Rak Gudang
                    </span>
                    <h4 className="text-xl sm:text-2xl font-black tracking-tight mt-1">
                      RAK {activeRackGroup.rackName}
                    </h4>
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-300 font-semibold">
                      <span>
                        <strong className="text-white font-black">{activeRackGroup.items.length}</strong> Jenis Barang
                      </span>
                      <span>&bull;</span>
                      <span>
                        Total Stok:{' '}
                        <strong className="text-emerald-400 font-black">
                          {activeRackGroup.totalStock.toLocaleString('id-ID')}
                        </strong>
                      </span>
                      {activeRackGroup.needOrderCount > 0 && (
                        <>
                          <span>&bull;</span>
                          <span className="text-rose-300 font-bold">
                            {activeRackGroup.needOrderCount} Need Order
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openPrintForSingleRack(activeRackGroup.rackName)}
                    className="px-3.5 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-xs transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <i className="fa-solid fa-print"></i>
                    <span>Cetak QR Rak Ini</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('scan')}
                    className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-qrcode"></i>
                    <span>Scan Rak Lain</span>
                  </button>
                  {onFilterInventoryByRack && !isStandalonePublicView && (
                    <button
                      type="button"
                      onClick={() => {
                        onFilterInventoryByRack(activeRackGroup.rackName);
                        onClose();
                      }}
                      className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
                    >
                      <i className="fa-solid fa-arrow-up-right-from-square"></i>
                      <span>Buka di Inventory</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Search inside Rack */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="relative flex-grow">
                  <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                  <input
                    type="text"
                    value={itemSearchInRack}
                    onChange={(e) => setItemSearchInRack(e.target.value)}
                    placeholder={`Cari barang di rak ${activeRackGroup.rackName} (kode item / nama / kategori)...`}
                    className="w-full pl-9 pr-8 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                  {itemSearchInRack && (
                    <button
                      type="button"
                      onClick={() => setItemSearchInRack('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-sm cursor-pointer"
                    >
                      &times;
                    </button>
                  )}
                </div>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">
                  Menampilkan {filteredRackItems.length} dari {activeRackGroup.items.length} barang
                </span>
              </div>

              {/* Item List in Rack */}
              {filteredRackItems.length === 0 ? (
                <div className="p-10 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-slate-200 dark:bg-slate-700 text-slate-500 flex items-center justify-center mx-auto text-xl">
                    <i className="fa-solid fa-box-open"></i>
                  </div>
                  <p className="text-sm font-extrabold text-slate-700 dark:text-slate-200">
                    {activeRackGroup.items.length === 0
                      ? `Belum ada barang yang terdaftar di Rak "${activeRackGroup.rackName}"`
                      : `Tidak ada barang yang cocok dengan "${itemSearchInRack}"`}
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 uppercase text-[10px] font-black tracking-wider">
                        <tr>
                          <th className="p-3 border-b border-slate-200 dark:border-slate-700 w-10 text-center">No</th>
                          <th className="p-3 border-b border-slate-200 dark:border-slate-700">Foto</th>
                          <th className="p-3 border-b border-slate-200 dark:border-slate-700">Item ID</th>
                          <th className="p-3 border-b border-slate-200 dark:border-slate-700">Nama Barang</th>
                          <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-right">Stok Saat Ini</th>
                          <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-right">Min Stok</th>
                          <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-center">Status</th>
                          {onOpenItemDetails && !isStandalonePublicView && (
                            <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-center">Aksi</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredRackItems.map((item, idx) => {
                          const curStock = parseNumberValue(item.CurrentStock ?? item.LastStock);
                          const minStock = parseNumberValue(item.MinStock);
                          const isNeedOrder = curStock <= minStock || item.Status === 'Need Order';
                          return (
                            <tr
                              key={`rack-view-item-${item.ItemID || idx}-${idx}`}
                              className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                            >
                              <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                              <td className="p-2.5">
                                {item.Photo ? (
                                  <img
                                    src={item.Photo}
                                    alt={item.ItemName || item.ItemID}
                                    onClick={() =>
                                      onOpenLightbox && onOpenLightbox(item.Photo, item.ItemName || item.ItemID)
                                    }
                                    className="w-10 h-10 object-cover rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 text-xs">
                                    <i className="fa-solid fa-box"></i>
                                  </div>
                                )}
                              </td>
                              <td className="p-3 font-mono font-black text-blue-600 dark:text-blue-400 whitespace-nowrap">
                                {item.ItemID}
                              </td>
                              <td className="p-3 min-w-[200px]">
                                <div className="font-bold text-slate-900 dark:text-white leading-snug">
                                  {item.ItemName}
                                </div>
                                {item.Category && (
                                  <span className="inline-block mt-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                    {item.Category}
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-right whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-black">
                                  {curStock.toLocaleString('id-ID')} {item.UoM || ''}
                                </span>
                              </td>
                              <td className="p-3 text-right font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                {minStock.toLocaleString('id-ID')} {item.UoM || ''}
                              </td>
                              <td className="p-3 text-center whitespace-nowrap">
                                <span
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black border ${
                                    isNeedOrder
                                      ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                                      : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                                  }`}
                                >
                                  {isNeedOrder ? 'Need Order' : 'In Stock'}
                                </span>
                              </td>
                              {onOpenItemDetails && !isStandalonePublicView && (
                                <td className="p-3 text-center whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => onOpenItemDetails(String(item.ItemID))}
                                    className="px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 font-bold text-[11px] transition cursor-pointer inline-flex items-center gap-1"
                                  >
                                    <i className="fa-solid fa-circle-info"></i>
                                    <span>Detail</span>
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-6 py-4 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            {mode === 'print'
              ? 'Label QR berisi tautan rak otomatis — dapat dipindai lewat kamera HP maupun menu Scan QR Rak.'
              : mode === 'scan'
              ? 'Pindai QR Rak atau pilih rak secara manual untuk melihat seluruh barang di rak tersebut.'
              : `Daftar barang real-time di Rak ${activeRackGroup?.rackName || '-'}.`}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                stopCameraScanner();
                onClose();
              }}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
            >
              {isStandalonePublicView ? 'Masuk ke ERP' : 'Tutup'}
            </button>

            {mode === 'print' && (
              <button
                type="button"
                disabled={selectedRacks.length === 0}
                onClick={() => window.print()}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-black px-5 py-2.5 rounded-xl transition shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer"
              >
                <i className="fa-solid fa-print"></i>
                <span>Cetak QR Rak ({totalLabelsToPrint} Label)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
