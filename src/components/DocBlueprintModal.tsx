import React from 'react';
import { CompanyHeader, DocHeader, RecordRow, TabName } from '../types';

interface DocBlueprintModalProps {
  activeTab?: TabName;
  printDocId: string;
  companyHeader: CompanyHeader;
  setCompanyHeader: React.Dispatch<React.SetStateAction<CompanyHeader>>;
  printDocHeader: DocHeader;
  setPrintDocHeader: React.Dispatch<React.SetStateAction<DocHeader>>;
  printDocItems: RecordRow[];
  setPrintDocItems: React.Dispatch<React.SetStateAction<RecordRow[]>>;
  isHeaderEditMode: boolean;
  setIsHeaderEditMode: React.Dispatch<React.SetStateAction<boolean>>;
  items?: RecordRow[];
  receives?: RecordRow[];
  issued?: RecordRow[];
  onClose: () => void;
  onSaveDocForm: () => void;
}

export const DocBlueprintModal: React.FC<DocBlueprintModalProps> = ({
  activeTab,
  printDocId,
  companyHeader,
  setCompanyHeader,
  printDocHeader,
  setPrintDocHeader,
  printDocItems,
  setPrintDocItems,
  isHeaderEditMode,
  setIsHeaderEditMode,
  items,
  receives,
  issued,
  onClose,
  onSaveDocForm
}) => {
  const activeTabUpper = (activeTab || '').toUpperCase();
  const docTitleUpper = (printDocHeader.DocTitle || '').toUpperCase();
  const docNoUpper = (printDocHeader.DocNoLabel || '').toUpperCase();
  const printDocIdUpper = (printDocId || '').toUpperCase();
  const reqIdUpper = (printDocHeader.RequestID || '').toUpperCase();

  const isMaterialReceive =
    activeTabUpper === 'MATERIALRECEIVE' ||
    activeTabUpper.includes('RECEIV') ||
    docTitleUpper.includes('RECEIV') ||
    docTitleUpper.includes('MRR') ||
    docTitleUpper.includes('RCV') ||
    docNoUpper.includes('MRR') ||
    docNoUpper.includes('RCV') ||
    printDocIdUpper.includes('RCV') ||
    printDocIdUpper.includes('MRR') ||
    printDocIdUpper.includes('REC') ||
    reqIdUpper.includes('RCV') ||
    reqIdUpper.includes('MRR');

  const isMaterialIssued =
    !isMaterialReceive && (
      activeTabUpper === 'MATERIALISSUED' ||
      activeTabUpper.includes('ISSUED') ||
      docTitleUpper.includes('ISSUED') ||
      docTitleUpper.includes('MIS') ||
      docNoUpper.includes('MIS') ||
      docNoUpper.includes('ISS') ||
      printDocIdUpper.includes('ISS') ||
      printDocIdUpper.includes('MIS') ||
      reqIdUpper.includes('ISS') ||
      reqIdUpper.includes('MIS')
    );

  const isPurchaseOrder =
    !isMaterialReceive && !isMaterialIssued && (
      activeTabUpper === 'PURCHASEORDER' ||
      activeTabUpper.includes('PURCHASE') ||
      docTitleUpper.includes('PURCHASE ORDER') ||
      docTitleUpper.includes('PO') ||
      docNoUpper.includes('PO') ||
      printDocIdUpper.includes('PO') ||
      reqIdUpper.includes('PO')
    );

  const formatLongDate = (dateStr?: string) => {
    if (!dateStr) return 'Tuesday, 11 August 2026';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  };

  const formatShortDate = (dateStr?: string) => {
    if (!dateStr) return '4/08/2026';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (e) {
      return dateStr;
    }
  };

  const formatCurrency = (val: any) => {
    if (val === undefined || val === null || val === '' || val === '-') return '-';
    const num = Number(String(val).replace(/[^0-9.-]+/g, ''));
    if (isNaN(num)) return val;
    if (num === 0) return '-';
    return num.toLocaleString('en-US');
  };

  const handlePrintDocument = () => {
    window.print();
  };

  // Normalize department names for strict grouping
  const normalizeDept = (deptStr: string) => {
    const s = String(deptStr || '').trim().toLowerCase().replace(/^dept\.\s*/i, '');
    if (s.includes('mech') || s.includes('mkn')) return 'mechanic';
    if (s.includes('drill') || s.includes('rig')) return 'drilling';
    if (s.includes('electr') || s.includes('listrik')) return 'electric';
    if (s.includes('weld') || s.includes('las')) return 'welder';
    return s;
  };

  // Standard department lists
  const defaultDepartments = ['Dept. Drilling', 'Dept. Mechanic', 'Dept. Electric', 'Dept. Welder'];

  // Dynamically collect custom departments if present in printDocItems
  const extraDepartments = Array.from<string>(
    new Set<string>(
      printDocItems
        .map(item => item.Department ? String(item.Department).trim() : '')
        .filter(d => {
          if (!d) return false;
          const norm = normalizeDept(d);
          return !['drilling', 'mechanic', 'electric', 'welder'].includes(norm);
        })
    )
  ).map((d: string) => d.toLowerCase().startsWith('dept') ? d : `Dept. ${d}`);

  const departments: string[] = [...defaultDepartments, ...extraDepartments];

  // Map items strictly to their respective department
  const getDepartmentItems = (deptName: string) => {
    const targetNorm = normalizeDept(deptName);

    return printDocItems.filter(item => {
      // Check item-level department first, fallback to header department
      const rawDept = item.Department
        ? String(item.Department)
        : (printDocHeader.Department ? String(printDocHeader.Department) : '');

      const itemNorm = normalizeDept(rawDept);

      // If item is empty (no ItemID, ItemName, Qty), ignore it
      if (!item.ItemID && !item.ItemName && item.Qty === undefined) {
        return false;
      }

      return itemNorm === targetNorm;
    });
  };

  const updateDepartmentItemCell = (item: RecordRow | undefined, deptName: string, field: string, val: string) => {
    const deptClean = deptName.replace(/^Dept\.\s*/i, '').trim();
    setPrintDocItems(prev => {
      const copy = [...prev];
      if (item) {
        const idx = copy.findIndex(i => i === item);
        if (idx >= 0) {
          copy[idx] = { ...copy[idx], [field]: val, Department: deptClean };
        }
      } else {
        copy.push({
          ItemID: field === 'ItemID' ? val : '',
          ItemName: field === 'ItemName' ? val : '',
          Qty: field === 'Qty' ? val : '',
          Out: field === 'Out' ? val : '',
          UoM: field === 'UoM' ? val : '',
          Stock: field === 'Stock' ? val : '',
          Remark: field === 'Remark' ? val : '',
          Department: deptClean
        });
      }
      return copy;
    });
  };

  const parseAmountOrPercent = (val: any, baseAmount: number) => {
    if (val === undefined || val === null || val === '') return 0;
    const strVal = String(val).trim();
    if (strVal.endsWith('%')) {
      const pct = Number(strVal.replace('%', '').trim());
      return isNaN(pct) ? 0 : (pct / 100) * baseAmount;
    }
    const num = Number(strVal.replace(/[^0-9.-]+/g, ''));
    return isNaN(num) ? 0 : num;
  };

  // Compute PO Totals
  const calculatePoSubtotal = () => {
    let sum = 0;
    printDocItems.forEach(item => {
      const qty = Number(item.Qty) || 0;
      const unitPrice = Number(item.UnitPriceIDR) || 0;
      const total = (item.TotalPriceIDR !== undefined && item.TotalPriceIDR !== '')
        ? Number(item.TotalPriceIDR)
        : qty * unitPrice;
      if (!isNaN(total)) sum += total;
    });
    return sum;
  };

  const calculateReceiveTotals = () => {
    let totalUSD = 0;
    let totalIDR = 0;
    printDocItems.forEach(item => {
      const qty = Number(item.Qty) || 0;

      const usdPrice = Number(String(item.UnitPriceUSD || '').replace(/[^0-9.-]+/g, '')) || 0;
      const usdTot = (item.TotalPriceUSD !== undefined && item.TotalPriceUSD !== '')
        ? Number(String(item.TotalPriceUSD).replace(/[^0-9.-]+/g, ''))
        : qty * usdPrice;
      if (!isNaN(usdTot)) totalUSD += usdTot;

      const idrPrice = Number(String(item.UnitPriceIDR || item.UnitPrice || '').replace(/[^0-9.-]+/g, '')) || 0;
      const idrTot = (item.TotalPriceIDR !== undefined && item.TotalPriceIDR !== '')
        ? Number(String(item.TotalPriceIDR).replace(/[^0-9.-]+/g, ''))
        : qty * idrPrice;
      if (!isNaN(idrTot)) totalIDR += idrTot;
    });
    return { totalUSD, totalIDR };
  };

  const poSubtotal = calculatePoSubtotal();
  const poDiscount = parseAmountOrPercent(printDocHeader.Discount, poSubtotal);
  const poVat = parseAmountOrPercent(printDocHeader.Vat, poSubtotal - poDiscount);
  const poGrandTotal = poSubtotal - poDiscount + poVat;

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 print:p-0 print:m-0 print:bg-transparent print:static print:block">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[95vh] border border-slate-100 print:border-none print:shadow-none print:rounded-none print:max-w-none print:max-h-none print:p-0 print:m-0 print:bg-transparent">
        
        {/* Top Control Bar */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 print:hidden">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-yellow-400 text-slate-900 flex items-center justify-center font-bold text-xs shrink-0">
              <i className="fa-solid fa-file-pen"></i>
            </div>
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider">
                {isMaterialIssued
                  ? 'Material Issued Slip Blueprint'
                  : isPurchaseOrder
                  ? 'Purchase Order Blueprint Form'
                  : isMaterialReceive
                  ? 'Material Receiving Report Blueprint'
                  : 'Document Blueprint Header Form'}
              </h3>
              <p className="text-[10px] text-yellow-400 font-semibold">
                Editable & Printable Official Document Form
              </p>
            </div>
          </div>
          
          <div className="flex items-center justify-between w-full sm:w-auto space-x-2">
            <button
              type="button"
              onClick={() => setIsHeaderEditMode(!isHeaderEditMode)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                isHeaderEditMode ? 'bg-yellow-400 text-slate-900 shadow-xs' : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <i className={`fa-solid ${isHeaderEditMode ? 'fa-pen-to-square' : 'fa-eye'}`}></i>
              <span>{isHeaderEditMode ? 'Form Edit Mode Active' : 'Print Preview Mode'}</span>
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white text-base cursor-pointer px-2">&times;</button>
          </div>
        </div>

        {/* Printable Document Container */}
        <div className="p-3 sm:p-6 md:p-8 space-y-6 overflow-y-auto flex-grow bg-white text-slate-900 print:p-0 print:m-0 print:overflow-visible print:bg-white print:shadow-none print:border-none" id="printBlueprintDoc">
          <div className="overflow-x-auto w-full">
            
            {/* ========================================================= */}
            {/* 1. PURCHASE ORDER FORM LAYOUT (EXACT MATCH TO ATTACHED PDF) */}
            {/* ========================================================= */}
            {isPurchaseOrder ? (
              <div className="space-y-3 text-slate-900 text-xs bg-white min-w-[700px] font-sans p-1">
                
                {/* Header Top Section */}
                <div className="flex justify-between items-start gap-4">
                  {/* Left Logo + Address */}
                  <div className="space-y-1.5 max-w-[340px]">
                    <div className="bg-black p-2.5 inline-block rounded-xs min-w-[210px]">
                      <img
                        src={companyHeader.logoUrl || "https://static.wixstatic.com/media/6daabc_acbf1201bd204e28becacd2ce16a7fb5~mv2.png/v1/fill/w_357,h_100,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/6daabc_acbf1201bd204e28becacd2ce16a7fb5~mv2.png"}
                        alt="Silver City Drilling Logo"
                        className="h-9 object-contain"
                      />
                    </div>
                    <div className="text-[10px] leading-tight text-black font-semibold space-y-0.5">
                      <p className="font-extrabold text-[11px]">PT. Silver City Drilling</p>
                      <p>Jl. Saraswati Ujung Blok R No 9 A RT 2 RW 11</p>
                      <p>Kel. Cipete Utara Kec. Kecamatan Kebayoran</p>
                      <p>Kota Jakarta Selatan, Kode Pos: Pos 12150</p>
                      <p>Telp : 021-48679276</p>
                    </div>
                  </div>

                  {/* Right Document Title + Meta Box */}
                  <div className="flex flex-col items-end space-y-3 shrink-0">
                    <h1 className="text-2xl font-black text-black tracking-wider uppercase font-sans">
                      PURCHASE ORDER
                    </h1>

                    <div className="border border-black text-[10px] font-bold divide-y divide-black bg-white min-w-[200px]">
                      <div className="flex justify-between p-1 px-2">
                        <span className="text-black">Date :</span>
                        {isHeaderEditMode ? (
                          <input
                            type="text"
                            value={printDocHeader.Date || '4/08/2026'}
                            onChange={(e) => setPrintDocHeader(prev => ({ ...prev, Date: e.target.value }))}
                            className="text-right bg-yellow-50 font-bold outline-none w-24"
                          />
                        ) : (
                          <span>{formatShortDate(printDocHeader.Date)}</span>
                        )}
                      </div>

                      <div className="flex justify-between p-1 px-2">
                        <span className="text-black">PO :</span>
                        {isHeaderEditMode ? (
                          <input
                            type="text"
                            value={printDocHeader.RequestID || printDocId || '000093'}
                            onChange={(e) => setPrintDocHeader(prev => ({ ...prev, RequestID: e.target.value }))}
                            className="text-right bg-yellow-50 font-bold outline-none w-24"
                          />
                        ) : (
                          <span>{printDocHeader.RequestID || printDocId || '000093'}</span>
                        )}
                      </div>

                      <div className="flex justify-between p-1 px-2">
                        <span className="text-black">Quotation :</span>
                        {isHeaderEditMode ? (
                          <input
                            type="text"
                            value={printDocHeader.Quotation || 'Penawaran Harga'}
                            onChange={(e) => setPrintDocHeader(prev => ({ ...prev, Quotation: e.target.value }))}
                            className="text-right bg-yellow-50 font-bold outline-none w-28"
                          />
                        ) : (
                          <span>{printDocHeader.Quotation || 'Penawaran Harga'}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Vendor & Ship To Grid */}
                <div className="border border-black text-[10px]">
                  <div className="grid grid-cols-2 bg-black text-white font-black uppercase text-center text-[10px]">
                    <div className="p-1 border-r border-white">VENDOR</div>
                    <div className="p-1">SHIP TO</div>
                  </div>

                  <div className="grid grid-cols-2 divide-x divide-black p-2.5 min-h-[110px] text-black">
                    {/* VENDOR */}
                    <div className="pr-3 space-y-1">
                      {isHeaderEditMode ? (
                        <div className="space-y-1.5">
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase block">Vendor Name</label>
                            <input
                              type="text"
                              value={printDocHeader.VendorName || ''}
                              onChange={(e) => setPrintDocHeader(prev => ({ ...prev, VendorName: e.target.value }))}
                              className="w-full font-bold border-b border-slate-300 outline-none bg-yellow-50 px-1 py-0.5 text-xs"
                              placeholder="Nama Vendor / Supplier"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase block">Address & City</label>
                            <div className="grid grid-cols-3 gap-1">
                              <input
                                type="text"
                                value={printDocHeader.VendorAddress || ''}
                                onChange={(e) => setPrintDocHeader(prev => ({ ...prev, VendorAddress: e.target.value }))}
                                className="col-span-2 border-b border-slate-300 outline-none bg-yellow-50 px-1 py-0.5 text-xs"
                                placeholder="Alamat Vendor"
                              />
                              <input
                                type="text"
                                value={printDocHeader.VendorCity || ''}
                                onChange={(e) => setPrintDocHeader(prev => ({ ...prev, VendorCity: e.target.value }))}
                                className="border-b border-slate-300 outline-none bg-yellow-50 px-1 py-0.5 text-xs"
                                placeholder="Kota"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase block">Contact Person</label>
                              <input
                                type="text"
                                value={printDocHeader.VendorContact || ''}
                                onChange={(e) => setPrintDocHeader(prev => ({ ...prev, VendorContact: e.target.value }))}
                                className="w-full border-b border-slate-300 outline-none bg-yellow-50 px-1 py-0.5 text-xs"
                                placeholder="Kontak Person"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase block">Phone / Telp</label>
                              <input
                                type="text"
                                value={printDocHeader.VendorPhone || ''}
                                onChange={(e) => setPrintDocHeader(prev => ({ ...prev, VendorPhone: e.target.value }))}
                                className="w-full border-b border-slate-300 outline-none bg-yellow-50 px-1 py-0.5 text-xs"
                                placeholder="No. Telepon"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase block">Email Address</label>
                            <input
                              type="text"
                              value={printDocHeader.VendorEmail || ''}
                              onChange={(e) => setPrintDocHeader(prev => ({ ...prev, VendorEmail: e.target.value }))}
                              className="w-full border-b border-slate-300 outline-none bg-yellow-50 px-1 py-0.5 text-xs"
                              placeholder="Alamat Email"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="font-extrabold text-[11px] min-h-[16px]">
                            {printDocHeader.VendorName || ''}
                          </p>
                          <p className="text-[10px] min-h-[14px]">
                            {printDocHeader.VendorAddress ? (
                              <>
                                {printDocHeader.VendorAddress}
                                {printDocHeader.VendorCity ? `, ${printDocHeader.VendorCity}` : ''}
                              </>
                            ) : (
                              printDocHeader.VendorCity || ''
                            )}
                          </p>
                          <div className="pt-1 space-y-0.5 text-[10px]">
                            <p><span className="font-bold">Contact :</span> {printDocHeader.VendorContact || ''}</p>
                            <p><span className="font-bold">Phone :</span> {printDocHeader.VendorPhone || ''}</p>
                            <p><span className="font-bold">Email :</span> {printDocHeader.VendorEmail || ''}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* SHIP TO */}
                    <div className="pl-3 space-y-1">
                      {isHeaderEditMode ? (
                        <div className="space-y-1.5">
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase block">Ship To / Destination</label>
                            <input
                              type="text"
                              value={printDocHeader.ShipToName || ''}
                              onChange={(e) => setPrintDocHeader(prev => ({ ...prev, ShipToName: e.target.value }))}
                              className="w-full font-bold border-b border-slate-300 outline-none bg-yellow-50 px-1 py-0.5 text-xs"
                              placeholder="Nama Penerima / Lokasi"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase block">Delivery Address</label>
                            <input
                              type="text"
                              value={printDocHeader.ShipToAddress || ''}
                              onChange={(e) => setPrintDocHeader(prev => ({ ...prev, ShipToAddress: e.target.value }))}
                              className="w-full border-b border-slate-300 outline-none bg-yellow-50 px-1 py-0.5 text-xs"
                              placeholder="Alamat Lengkap Pengiriman"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase block">Contact Person</label>
                              <input
                                type="text"
                                value={printDocHeader.ShipToContact || ''}
                                onChange={(e) => setPrintDocHeader(prev => ({ ...prev, ShipToContact: e.target.value }))}
                                className="w-full border-b border-slate-300 outline-none bg-yellow-50 px-1 py-0.5 text-xs"
                                placeholder="Kontak Person"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase block">Phone / Telp</label>
                              <input
                                type="text"
                                value={printDocHeader.ShipToPhone || ''}
                                onChange={(e) => setPrintDocHeader(prev => ({ ...prev, ShipToPhone: e.target.value }))}
                                className="w-full border-b border-slate-300 outline-none bg-yellow-50 px-1 py-0.5 text-xs"
                                placeholder="No. Telepon"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase block">Email Address</label>
                            <input
                              type="text"
                              value={printDocHeader.ShipToEmail || ''}
                              onChange={(e) => setPrintDocHeader(prev => ({ ...prev, ShipToEmail: e.target.value }))}
                              className="w-full border-b border-slate-300 outline-none bg-yellow-50 px-1 py-0.5 text-xs"
                              placeholder="Alamat Email"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="font-extrabold text-[11px] min-h-[16px]">
                            {printDocHeader.ShipToName || ''}
                          </p>
                          <p className="text-[10px] min-h-[14px]">
                            {printDocHeader.ShipToAddress || ''}
                          </p>
                          <div className="pt-1 space-y-0.5 text-[10px]">
                            <p><span className="font-bold">Contact :</span> {printDocHeader.ShipToContact || ''}</p>
                            <p><span className="font-bold">Phone :</span> {printDocHeader.ShipToPhone || ''}</p>
                            <p><span className="font-bold">Email :</span> {printDocHeader.ShipToEmail || ''}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Shipping Terms Bar */}
                <div className="border border-black text-[10px]">
                  <div className="grid grid-cols-4 bg-black text-white font-black uppercase text-center">
                    <div className="p-1 border-r border-white">REQUISITIONER</div>
                    <div className="p-1 border-r border-white">SHIP VIA</div>
                    <div className="p-1 border-r border-white">F.O.B.</div>
                    <div className="p-1">SHIPPING TERMS</div>
                  </div>
                  <div className="grid grid-cols-4 divide-x divide-black p-1 text-center font-semibold text-black min-h-[22px]">
                    <div>{isHeaderEditMode ? <input type="text" value={printDocHeader.Requisitioner || ''} onChange={(e) => setPrintDocHeader(prev => ({ ...prev, Requisitioner: e.target.value }))} className="w-full text-center bg-yellow-50 outline-none" /> : printDocHeader.Requisitioner || ''}</div>
                    <div>{isHeaderEditMode ? <input type="text" value={printDocHeader.ShipVia || ''} onChange={(e) => setPrintDocHeader(prev => ({ ...prev, ShipVia: e.target.value }))} className="w-full text-center bg-yellow-50 outline-none" /> : printDocHeader.ShipVia || ''}</div>
                    <div>{isHeaderEditMode ? <input type="text" value={printDocHeader.Fob || ''} onChange={(e) => setPrintDocHeader(prev => ({ ...prev, Fob: e.target.value }))} className="w-full text-center bg-yellow-50 outline-none" /> : printDocHeader.Fob || ''}</div>
                    <div>{isHeaderEditMode ? <input type="text" value={printDocHeader.ShippingTerms || ''} onChange={(e) => setPrintDocHeader(prev => ({ ...prev, ShippingTerms: e.target.value }))} className="w-full text-center bg-yellow-50 outline-none" /> : printDocHeader.ShippingTerms || ''}</div>
                  </div>
                </div>

                {/* Items Table */}
                <table className="w-full border-collapse border border-black text-xs font-sans">
                  <thead>
                    <tr className="bg-black text-white font-black text-[10px] uppercase text-center">
                      <th className="p-1.5 border-r border-white w-10">No.</th>
                      <th className="p-1.5 border-r border-white">DESCRIPTION</th>
                      <th className="p-1.5 border-r border-white w-14">QTY</th>
                      <th className="p-1.5 border-r border-white w-14">UOM</th>
                      <th className="p-1.5 border-r border-white w-32">Price (Each/IDR)</th>
                      <th className="p-1.5 w-36">TOTAL PRICE (IDR)</th>
                    </tr>
                  </thead>
                  <tbody className="text-[11px] font-medium text-black divide-y divide-black">
                    {printDocItems.map((item, idx) => {
                      const qty = item.Qty;
                      const unitPrice = item.UnitPriceIDR;
                      const totalPrice = item.TotalPriceIDR || (Number(qty) * Number(unitPrice)) || '';

                      return (
                        <tr key={idx} className="h-8">
                          {/* No */}
                          <td className="p-1 border-r border-black text-center font-bold">
                            {item.ItemName || item.ItemID ? idx + 1 : ''}
                          </td>

                          {/* DESCRIPTION */}
                          <td className="p-1 border-r border-black pl-2 whitespace-pre-wrap break-words">
                            {isHeaderEditMode ? (
                              <textarea
                                rows={1}
                                value={item.ItemName || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setPrintDocItems(prev => {
                                    const copy = [...prev];
                                    copy[idx] = { ...copy[idx], ItemName: val };
                                    return copy;
                                  });
                                }}
                                className="w-full bg-yellow-50 outline-none resize-y whitespace-pre-wrap break-words min-h-[28px]"
                              />
                            ) : (
                              item.ItemName || ''
                            )}
                          </td>

                          {/* QTY */}
                          <td className="p-1 border-r border-black text-center font-bold">
                            {isHeaderEditMode ? (
                              <input
                                type="text"
                                value={qty !== undefined ? qty : ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setPrintDocItems(prev => {
                                    const copy = [...prev];
                                    copy[idx] = { ...copy[idx], Qty: val };
                                    return copy;
                                  });
                                }}
                                className="w-full text-center bg-yellow-50 outline-none font-bold"
                              />
                            ) : (
                              qty !== undefined ? qty : ''
                            )}
                          </td>

                          {/* UOM */}
                          <td className="p-1 border-r border-black text-center">
                            {isHeaderEditMode ? (
                              <input
                                type="text"
                                value={item.UoM || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setPrintDocItems(prev => {
                                    const copy = [...prev];
                                    copy[idx] = { ...copy[idx], UoM: val };
                                    return copy;
                                  });
                                }}
                                className="w-full text-center bg-yellow-50 outline-none"
                              />
                            ) : (
                              item.UoM || ''
                            )}
                          </td>

                          {/* PRICE (EACH/IDR) */}
                          <td className="p-1 border-r border-black text-right pr-2">
                            {isHeaderEditMode ? (
                              <input
                                type="text"
                                value={unitPrice !== undefined ? unitPrice : ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setPrintDocItems(prev => {
                                    const copy = [...prev];
                                    copy[idx] = { ...copy[idx], UnitPriceIDR: val };
                                    return copy;
                                  });
                                }}
                                className="w-full text-right bg-yellow-50 outline-none"
                              />
                            ) : (
                              unitPrice ? `Rp  ${formatCurrency(unitPrice)}` : ''
                            )}
                          </td>

                          {/* TOTAL PRICE (IDR) */}
                          <td className="p-1 text-right pr-2 font-semibold">
                            {isHeaderEditMode ? (
                              <input
                                type="text"
                                value={totalPrice !== undefined ? totalPrice : ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setPrintDocItems(prev => {
                                    const copy = [...prev];
                                    copy[idx] = { ...copy[idx], TotalPriceIDR: val };
                                    return copy;
                                  });
                                }}
                                className="w-full text-right bg-yellow-50 outline-none font-semibold"
                              />
                            ) : (
                              totalPrice ? `Rp  ${formatCurrency(totalPrice)}` : ''
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Totals Summary Block */}
                <div className="flex justify-end font-sans">
                  <div className="w-64 border border-black text-[11px] font-bold divide-y divide-black text-black">
                    <div className="flex justify-between p-1 px-2">
                      <span>SUBTOTAL</span>
                      <span>Rp {formatCurrency(poSubtotal)}</span>
                    </div>

                    <div className="flex justify-between items-center p-1 px-2">
                      <span>DISCOUNT</span>
                      {isHeaderEditMode ? (
                        <div className="flex items-center gap-1 justify-end">
                          <span className="text-[10px]">Rp</span>
                          <input
                            type="text"
                            value={printDocHeader.Discount !== undefined ? printDocHeader.Discount : ''}
                            onChange={(e) => setPrintDocHeader(prev => ({ ...prev, Discount: e.target.value }))}
                            placeholder="0 / 10%"
                            className="w-24 text-right bg-yellow-50 font-bold outline-none border-b border-slate-300 text-[11px]"
                          />
                        </div>
                      ) : (
                        <span>Rp {formatCurrency(poDiscount)}</span>
                      )}
                    </div>

                    <div className="flex justify-between items-center p-1 px-2">
                      <span>VAT</span>
                      {isHeaderEditMode ? (
                        <div className="flex items-center gap-1 justify-end">
                          <span className="text-[10px]">Rp</span>
                          <input
                            type="text"
                            value={printDocHeader.Vat !== undefined ? printDocHeader.Vat : ''}
                            onChange={(e) => setPrintDocHeader(prev => ({ ...prev, Vat: e.target.value }))}
                            placeholder="0 / 11%"
                            className="w-24 text-right bg-yellow-50 font-bold outline-none border-b border-slate-300 text-[11px]"
                          />
                        </div>
                      ) : (
                        <span>Rp {formatCurrency(poVat)}</span>
                      )}
                    </div>

                    <div className="flex justify-between p-1.5 px-2 bg-black text-white font-black text-xs">
                      <span>GRAND TOTAL</span>
                      <span>Rp {formatCurrency(poGrandTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* Approval Section */}
                <div className="flex justify-between items-end gap-4 pt-2">
                  <div className="w-72 border border-black text-black font-sans">
                    <div className="bg-black text-white p-1 px-2 font-black text-[10px] uppercase">
                      Approved:
                    </div>
                    <div className="p-3 relative min-h-[75px] flex flex-col justify-between">
                      <div className="h-10"></div>

                      <div className="grid grid-cols-3 text-[9px] font-extrabold border-t border-black pt-1 text-center relative z-10">
                        <div>Manager</div>
                        <div className="text-blue-950">{printDocHeader.ApprovedByName || 'Daniel Marron'}</div>
                        <div>Signature</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Legal Terms */}
                <div className="text-[9px] text-black font-medium leading-tight space-y-1 pt-2 border-t border-slate-200">
                  <p>Payment terms are 30 days from the date of invoice, subject to the Purchaser's receipt and acceptance of all goods in full and in good condition</p>
                  <p className="text-center font-normal text-slate-700">
                    If you have any questions about this purchase order, please contact<br />
                    <span className="font-semibold text-black">dharmendra@silvercitydrilling.co.id</span> or <span className="font-semibold text-black">dmarron@silvercitydrilling.com.au</span>
                  </p>
                </div>

              </div>
            ) : isMaterialIssued ? (

              /* ========================================================= */
              /* 2. MATERIAL ISSUED SLIP FORM LAYOUT */
              /* ========================================================= */
              <div className="space-y-0 text-slate-900 text-xs border-2 border-black bg-white min-w-[700px]">
                
                {/* Header Grid */}
                <div className="grid grid-cols-12 border-b-2 border-black">
                  
                  {/* Left Logo Container */}
                  <div className="col-span-5 bg-black p-3 flex items-center justify-center border-r-2 border-black min-h-[90px]">
                    <img
                      src={companyHeader.logoUrl || "https://static.wixstatic.com/media/6daabc_acbf1201bd204e28becacd2ce16a7fb5~mv2.png/v1/fill/w_357,h_100,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/6daabc_acbf1201bd204e28becacd2ce16a7fb5~mv2.png"}
                      alt="Silver City Drilling Logo"
                      className="max-h-14 max-w-full object-contain"
                    />
                  </div>

                  {/* Right Header Metadata Table */}
                  <div className="col-span-7 bg-white p-2.5 text-[11px] font-bold flex flex-col justify-center space-y-1">
                    
                    <div className="flex items-center">
                      <span className="w-24 shrink-0 text-black">MIS No</span>
                      <span className="mr-2">:</span>
                      {isHeaderEditMode ? (
                        <input
                          type="text"
                          value={printDocHeader.RequestID || printDocId}
                          onChange={(e) => setPrintDocHeader(prev => ({ ...prev, RequestID: e.target.value }))}
                          className="flex-1 px-1.5 py-0.5 border border-slate-400 rounded text-xs font-bold text-blue-900 bg-yellow-50 outline-none"
                        />
                      ) : (
                        <span className="font-extrabold text-black">{printDocHeader.RequestID || printDocId}</span>
                      )}
                    </div>

                    <div className="flex items-center">
                      <span className="w-24 shrink-0 text-black">DATE</span>
                      <span className="mr-2">:</span>
                      {isHeaderEditMode ? (
                        <input
                          type="date"
                          value={printDocHeader.Date || ''}
                          onChange={(e) => setPrintDocHeader(prev => ({ ...prev, Date: e.target.value }))}
                          className="flex-1 px-1.5 py-0.5 border border-slate-400 rounded text-xs font-semibold bg-yellow-50 outline-none"
                        />
                      ) : (
                        <span className="text-blue-900 font-semibold">{formatLongDate(printDocHeader.Date)}</span>
                      )}
                    </div>

                    <div className="flex items-center">
                      <span className="w-24 shrink-0 text-black">WELL NAME</span>
                      <span className="mr-2">:</span>
                      {isHeaderEditMode ? (
                        <input
                          type="text"
                          value={printDocHeader.WellLoc || ''}
                          onChange={(e) => setPrintDocHeader(prev => ({ ...prev, WellLoc: e.target.value }))}
                          placeholder="Well Name"
                          className="flex-1 px-1.5 py-0.5 border border-slate-400 rounded text-xs font-semibold bg-yellow-50 outline-none"
                        />
                      ) : (
                        <span className="text-black font-semibold uppercase">{printDocHeader.WellLoc || ''}</span>
                      )}
                    </div>

                    <div className="flex items-center">
                      <span className="w-24 shrink-0 text-black">RIG NAME</span>
                      <span className="mr-2">:</span>
                      {isHeaderEditMode ? (
                        <input
                          type="text"
                          list="rigname-datalist"
                          value={printDocHeader.RigName || 'Rig Silver City 20'}
                          onChange={(e) => setPrintDocHeader(prev => ({ ...prev, RigName: e.target.value }))}
                          placeholder="Rig Name"
                          className="flex-1 px-1.5 py-0.5 border border-slate-400 rounded text-xs font-semibold bg-yellow-50 outline-none"
                        />
                      ) : (
                        <span className="text-blue-900 font-bold uppercase">{printDocHeader.RigName || 'Rig Silver City 20'}</span>
                      )}
                    </div>

                  </div>
                </div>

                {/* Document Title Banner */}
                <div className="bg-[#e0e0e0] text-black text-center font-serif font-black py-1.5 uppercase tracking-wider border-b-2 border-black text-base sm:text-lg">
                  MATERIAL ISSUED SLIP
                </div>

                {/* Items Table with Department Sections */}
                <table className="w-full border-collapse text-xs border-b-2 border-black">
                  <thead>
                    <tr className="bg-white text-[10px] font-black uppercase text-center border-b border-black">
                      <th className="p-1 border-r border-black w-8">No.</th>
                      <th className="p-1 border-r border-black w-28">NUMBER CODE</th>
                      <th className="p-1 border-r border-black">DESCRIPTION</th>
                      <th className="p-1 border-r border-black w-16">ISSUED QTY</th>
                      <th className="p-1 border-r border-black w-12">Uom</th>
                      <th className="p-1 border-r border-black w-20">STOCK ON HAND</th>
                      <th className="p-1 w-36">REMARK USED</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map((dept) => {
                      const deptItems = getDepartmentItems(dept);
                      const rowIndices = Array.from({ length: 8 }, (_, i) => i);

                      return (
                        <React.Fragment key={dept}>
                          {/* Department Bar */}
                          <tr className="bg-[#e0e0e0] text-black font-extrabold text-[11px] border-y border-black">
                            <td colSpan={7} className="px-2 py-0.5 text-left border-black">
                              {dept}
                            </td>
                          </tr>

                          {/* 8 Rows per Department */}
                          {rowIndices.map((rowIdx) => {
                            const item = deptItems[rowIdx];
                            return (
                              <tr key={rowIdx} className="border-b border-black h-6 text-[10px]">
                                {/* No. */}
                                <td className="p-0.5 border-r border-black text-center font-bold">
                                  {rowIdx + 1}
                                </td>

                                {/* NUMBER CODE */}
                                <td className="p-0.5 border-r border-black text-center font-mono font-medium">
                                  {isHeaderEditMode ? (
                                    <input
                                      type="text"
                                      value={item?.ItemID || ''}
                                      onChange={(e) => updateDepartmentItemCell(item, dept, 'ItemID', e.target.value)}
                                      className="w-full text-center bg-yellow-50 outline-none"
                                    />
                                  ) : (
                                    item?.ItemID || ''
                                  )}
                                </td>

                                {/* DESCRIPTION */}
                                <td className="p-0.5 border-r border-black font-medium pl-1.5 whitespace-pre-wrap break-words">
                                  {isHeaderEditMode ? (
                                    <textarea
                                      rows={1}
                                      value={item?.ItemName || ''}
                                      onChange={(e) => updateDepartmentItemCell(item, dept, 'ItemName', e.target.value)}
                                      className="w-full bg-yellow-50 outline-none resize-y whitespace-pre-wrap break-words min-h-[28px]"
                                    />
                                  ) : (
                                    item?.ItemName || ''
                                  )}
                                </td>

                                {/* ISSUED QTY */}
                                <td className="p-0.5 border-r border-black text-center font-bold w-14">
                                  {isHeaderEditMode ? (
                                    <input
                                      type="text"
                                      value={item?.Qty !== undefined ? item.Qty : ''}
                                      onChange={(e) => updateDepartmentItemCell(item, dept, 'Qty', e.target.value)}
                                      className="w-full text-center bg-yellow-50 outline-none font-bold"
                                    />
                                  ) : (
                                    item?.Qty !== undefined ? item.Qty : ''
                                  )}
                                </td>

                                {/* Uom */}
                                <td className="p-0.5 border-r border-black text-center font-medium">
                                  {isHeaderEditMode ? (
                                    <input
                                      type="text"
                                      value={item?.UoM || ''}
                                      onChange={(e) => updateDepartmentItemCell(item, dept, 'UoM', e.target.value)}
                                      className="w-full text-center bg-yellow-50 outline-none"
                                    />
                                  ) : (
                                    item?.UoM || ''
                                  )}
                                </td>

                                {/* STOCK ON HAND */}
                                <td className="p-0.5 border-r border-black text-center font-medium">
                                  {isHeaderEditMode ? (
                                    <input
                                      type="text"
                                      value={item?.Stock !== undefined ? item.Stock : ''}
                                      onChange={(e) => updateDepartmentItemCell(item, dept, 'Stock', e.target.value)}
                                      className="w-full text-center bg-yellow-50 outline-none"
                                    />
                                  ) : (
                                    item?.Stock !== undefined ? item.Stock : ''
                                  )}
                                </td>

                                {/* REMARK USED */}
                                <td className="p-0.5 font-medium pl-1">
                                  {isHeaderEditMode ? (
                                    <input
                                      type="text"
                                      value={item?.Remark || ''}
                                      onChange={(e) => updateDepartmentItemCell(item, dept, 'Remark', e.target.value)}
                                      className="w-full bg-yellow-50 outline-none"
                                    />
                                  ) : (
                                    item?.Remark || ''
                                  )}
                                </td>

                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>

                {/* Signatures Table Grid */}
                <div className="grid grid-cols-6 border-b-2 border-black text-[11px] font-medium text-black">
                  
                  {/* Top Titles */}
                  <div className="col-span-1 border-r border-black p-1 italic">
                    Prepared by,
                  </div>
                  <div className="col-span-4 border-r border-black p-1 italic text-center">
                    User by,
                  </div>
                  <div className="col-span-1 p-1 italic">
                    Approved by,
                  </div>

                  {/* Empty Signature Boxes */}
                  <div className="col-span-1 border-r border-t border-b border-black h-16"></div>
                  <div className="col-span-1 border-r border-t border-b border-black h-16"></div>
                  <div className="col-span-1 border-r border-t border-b border-black h-16"></div>
                  <div className="col-span-1 border-r border-t border-b border-black h-16"></div>
                  <div className="col-span-1 border-r border-t border-b border-black h-16"></div>
                  <div className="col-span-1 border-t border-b border-black h-16"></div>

                  {/* Role Labels */}
                  <div className="col-span-1 border-r border-black p-1 text-center font-bold text-[10px]">
                    Material Man
                  </div>
                  <div className="col-span-1 border-r border-black p-1 text-center font-bold text-[10px]">
                    Drilling
                  </div>
                  <div className="col-span-1 border-r border-black p-1 text-center font-bold text-[10px]">
                    Mechanic
                  </div>
                  <div className="col-span-1 border-r border-black p-1 text-center font-bold text-[10px]">
                    Electric
                  </div>
                  <div className="col-span-1 border-r border-black p-1 text-center font-bold text-[10px]">
                    Welder
                  </div>
                  <div className="col-span-1 p-1 text-center font-bold text-[10px]">
                    Rig Manager
                  </div>

                </div>

                {/* Company Address Footer */}
                <div className="p-2 text-[9px] text-slate-800 bg-white leading-tight font-medium space-y-0.5">
                  <p>Block R, Kl. Saraswati No. 9A Blok R, Cipete Utara, Kecamatan Kebayoran Baru, Jakarta Selatan, Daerah Khusus Ibukota Jakarta 12150.</p>
                  <p>Tel +61 8 8952 2966 Email: jakartaoffice@silvercitydrilling.co.id</p>
                  <div className="w-full h-1.5 bg-[#00a651] mt-1"></div>
                </div>

              </div>
            ) : isMaterialReceive ? (

              /* ========================================================= */
              /* 3. MATERIAL RECEIVING REPORT FORM LAYOUT (MATCHING ATTACHED IMAGE) */
              /* ========================================================= */
              <div className="space-y-0 text-slate-900 text-xs border-2 border-black bg-white min-w-[760px] font-sans">
                
                {/* 1. Top Header Grid: Company Logo + Support Office */}
                <div className="grid grid-cols-12 border-b-2 border-black">
                  {/* Left Logo Container */}
                  <div className="col-span-3 bg-black p-3 flex items-center justify-center border-r-2 border-black min-h-[85px]">
                    <img
                      src={companyHeader.logoUrl || "https://static.wixstatic.com/media/6daabc_acbf1201bd204e28becacd2ce16a7fb5~mv2.png/v1/fill/w_357,h_100,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/6daabc_acbf1201bd204e28becacd2ce16a7fb5~mv2.png"}
                      alt="Silver City Drilling Logo"
                      className="max-h-14 max-w-full object-contain"
                    />
                  </div>

                  {/* Right Company Information */}
                  <div className="col-span-9 bg-white p-2.5 text-[10px] font-sans leading-tight text-black flex flex-col justify-center">
                    {isHeaderEditMode ? (
                      <div className="space-y-1">
                        <input
                          type="text"
                          value={companyHeader.companyName}
                          onChange={(e) => setCompanyHeader(prev => ({ ...prev, companyName: e.target.value }))}
                          className="w-full px-1.5 py-0.5 border border-slate-400 rounded text-xs font-black text-black bg-yellow-50 outline-none"
                        />
                        <input
                          type="text"
                          value={companyHeader.supportOffice}
                          onChange={(e) => setCompanyHeader(prev => ({ ...prev, supportOffice: e.target.value }))}
                          className="w-full px-1.5 py-0.5 border border-slate-400 rounded text-[10px] text-slate-700 bg-yellow-50 outline-none"
                        />
                        <input
                          type="text"
                          value={companyHeader.addressLine1}
                          onChange={(e) => setCompanyHeader(prev => ({ ...prev, addressLine1: e.target.value }))}
                          className="w-full px-1.5 py-0.5 border border-slate-400 rounded text-[10px] text-slate-700 bg-yellow-50 outline-none"
                        />
                        <input
                          type="text"
                          value={companyHeader.addressLine2}
                          onChange={(e) => setCompanyHeader(prev => ({ ...prev, addressLine2: e.target.value }))}
                          className="w-full px-1.5 py-0.5 border border-slate-400 rounded text-[10px] text-slate-700 bg-yellow-50 outline-none"
                        />
                        <input
                          type="text"
                          value={companyHeader.phone}
                          onChange={(e) => setCompanyHeader(prev => ({ ...prev, phone: e.target.value }))}
                          className="w-full px-1.5 py-0.5 border border-slate-400 rounded text-[10px] text-slate-700 bg-yellow-50 outline-none"
                        />
                      </div>
                    ) : (
                      <>
                        <p className="font-extrabold text-xs text-black uppercase mb-0.5">{companyHeader.companyName || 'PT. SILVER CITY DRILLING'}</p>
                        <p className="text-[9px] font-bold text-black uppercase tracking-wider">SUPPORT OFFICE :</p>
                        <p className="text-[10px] text-black font-normal">{companyHeader.addressLine1 || 'Block R, Kl. Saraswati No. 9A Blok R, Cipete Utara,'}</p>
                        <p className="text-[10px] text-black font-normal">{companyHeader.addressLine2 || 'Kec. Kebayoran Baru, Jakarta Selatan, D.K.I Jakarta 12150'}</p>
                        <p className="text-[10px] text-black font-normal">PHONE : {companyHeader.phone || '(+61) 8 8952 2966'}</p>
                      </>
                    )}
                  </div>
                </div>

                {/* 2. Light Green Title Bar */}
                <div className="grid grid-cols-12 border-b-2 border-black bg-[#c8e6c9] items-center text-black font-extrabold text-xs">
                  {/* Left RIG Label */}
                  <div className="col-span-3 border-r-2 border-black px-3 py-1.5 text-left text-[11px]">
                    {isHeaderEditMode ? (
                      <input
                        type="text"
                        value={printDocHeader.RigName || 'RIG SCD#20'}
                        onChange={(e) => setPrintDocHeader(prev => ({ ...prev, RigName: e.target.value }))}
                        className="w-full px-1 py-0.5 border border-slate-400 rounded text-xs font-bold bg-yellow-50 outline-none"
                      />
                    ) : (
                      <span>{printDocHeader.RigName || 'RIG SCD#20'}</span>
                    )}
                  </div>

                  {/* Center Title */}
                  <div className="col-span-5 text-center py-1.5 text-sm font-black uppercase tracking-wide">
                    MATERIAL RECEIVING REPORT
                  </div>

                  {/* Right Date Container */}
                  <div className="col-span-4 border-l-2 border-black px-2 py-1 flex items-center justify-between text-[11px] bg-[#c8e6c9]">
                    <span className="font-bold shrink-0 mr-2">DATE</span>
                    <div className="border border-black bg-white px-2 py-0.5 text-right font-bold text-indigo-950 italic text-[11px] w-full truncate">
                      {isHeaderEditMode ? (
                        <input
                          type="date"
                          value={printDocHeader.Date || ''}
                          onChange={(e) => setPrintDocHeader(prev => ({ ...prev, Date: e.target.value }))}
                          className="w-full text-center bg-yellow-50 outline-none font-sans not-italic text-xs"
                        />
                      ) : (
                        <span>{formatLongDate(printDocHeader.Date)}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Metadata Fields Section */}
                <div className="border-b-2 border-black p-2 bg-white text-[10px] font-bold text-black space-y-1.5">
                  <div className="grid grid-cols-2 gap-x-6">
                    
                    {/* Left Side Metadata */}
                    <div className="space-y-1">
                      {/* RECVD & POSTED BY */}
                      <div className="flex items-center">
                        <span className="w-36 shrink-0">RECVD & POSTED BY :</span>
                        {isHeaderEditMode ? (
                          <input
                            type="text"
                            value={printDocHeader.RecvdPostedBy || 'WAREHOUSE RIG SCD #20'}
                            onChange={(e) => setPrintDocHeader(prev => ({ ...prev, RecvdPostedBy: e.target.value }))}
                            className="flex-1 border-b border-black text-blue-900 font-bold px-1 bg-yellow-50 outline-none"
                          />
                        ) : (
                          <span className="flex-1 border-b border-black text-blue-900 font-bold uppercase px-1">
                            {printDocHeader.RecvdPostedBy || 'WAREHOUSE RIG SCD #20'}
                          </span>
                        )}
                      </div>

                      {/* MRQ REFFERENCE */}
                      <div className="flex items-center">
                        <span className="w-36 shrink-0">MRQ REFFERENCE :</span>
                        {isHeaderEditMode ? (
                          <input
                            type="text"
                            value={printDocHeader.MrqRef || ''}
                            onChange={(e) => setPrintDocHeader(prev => ({ ...prev, MrqRef: e.target.value }))}
                            className="flex-1 border-b border-black text-blue-900 font-bold px-1 bg-yellow-50 outline-none"
                          />
                        ) : (
                          <span className="flex-1 border-b border-black text-blue-900 font-bold uppercase px-1 min-h-[16px]">
                            {printDocHeader.MrqRef || ''}
                          </span>
                        )}
                      </div>

                      {/* WELL / LOCATION */}
                      <div className="flex items-center">
                        <span className="w-36 shrink-0">WELL / LOCATION :</span>
                        {isHeaderEditMode ? (
                          <input
                            type="text"
                            value={printDocHeader.WellLoc || 'YARD - PAMANUKAN'}
                            onChange={(e) => setPrintDocHeader(prev => ({ ...prev, WellLoc: e.target.value }))}
                            className="flex-1 border-b border-black text-blue-900 font-bold px-1 bg-yellow-50 outline-none"
                          />
                        ) : (
                          <span className="flex-1 border-b border-black text-blue-900 font-bold uppercase px-1">
                            {printDocHeader.WellLoc || 'YARD - PAMANUKAN'}
                          </span>
                        )}
                      </div>

                      {/* PROJECT NAME */}
                      <div className="flex items-center">
                        <span className="w-36 shrink-0">PROJECT NAME :</span>
                        {isHeaderEditMode ? (
                          <input
                            type="text"
                            value={printDocHeader.Project || ''}
                            onChange={(e) => setPrintDocHeader(prev => ({ ...prev, Project: e.target.value }))}
                            className="flex-1 border-b border-black text-blue-900 font-bold px-1 bg-yellow-50 outline-none"
                          />
                        ) : (
                          <span className="flex-1 border-b border-black text-blue-900 font-bold uppercase px-1 min-h-[16px]">
                            {printDocHeader.Project || ''}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right Side Metadata */}
                    <div className="space-y-1">
                      {/* MRR No. */}
                      <div className="flex items-center">
                        <span className="w-24 shrink-0">MRR No.</span>
                        <span className="mr-1">:</span>
                        {isHeaderEditMode ? (
                          <input
                            type="text"
                            value={printDocHeader.RequestID || printDocId}
                            onChange={(e) => setPrintDocHeader(prev => ({ ...prev, RequestID: e.target.value }))}
                            className="flex-1 border-b border-black text-blue-900 font-bold px-1 bg-yellow-50 outline-none"
                          />
                        ) : (
                          <span className="flex-1 text-blue-900 font-bold px-1">
                            {printDocHeader.RequestID || printDocId}
                          </span>
                        )}
                      </div>

                      {/* DEPT. */}
                      <div className="flex items-center">
                        <span className="w-24 shrink-0">DEPT.</span>
                        <span className="mr-1">:</span>
                        {isHeaderEditMode ? (
                          <input
                            type="text"
                            value={printDocHeader.Department || 'DRILLING'}
                            onChange={(e) => setPrintDocHeader(prev => ({ ...prev, Department: e.target.value }))}
                            className="flex-1 border-b border-black text-blue-900 font-bold px-1 bg-yellow-50 outline-none"
                          />
                        ) : (
                          <span className="flex-1 border-b border-black text-blue-900 font-bold uppercase px-1">
                            {printDocHeader.Department || 'DRILLING'}
                          </span>
                        )}
                      </div>

                      {/* SUPPLIER */}
                      <div className="flex items-center">
                        <span className="w-24 shrink-0">SUPPLIER</span>
                        <span className="mr-1">:</span>
                        {isHeaderEditMode ? (
                          <input
                            type="text"
                            value={printDocHeader.Supplier || printDocHeader.VendorName || ''}
                            onChange={(e) => setPrintDocHeader(prev => ({ ...prev, Supplier: e.target.value }))}
                            className="flex-1 border-b border-black text-blue-900 font-bold px-1 bg-yellow-50 outline-none"
                          />
                        ) : (
                          <span className="flex-1 border-b border-black text-blue-900 font-bold uppercase px-1 min-h-[16px]">
                            {printDocHeader.Supplier || printDocHeader.VendorName || ''}
                          </span>
                        )}
                      </div>

                      {/* P.O No. */}
                      <div className="flex items-center">
                        <span className="w-24 shrink-0">P.O No.</span>
                        <span className="mr-1">:</span>
                        {isHeaderEditMode ? (
                          <input
                            type="text"
                            value={printDocHeader.PoNo || ''}
                            onChange={(e) => setPrintDocHeader(prev => ({ ...prev, PoNo: e.target.value }))}
                            className="flex-1 border-b border-black text-blue-900 font-bold px-1 bg-yellow-50 outline-none"
                          />
                        ) : (
                          <span className="flex-1 border-b border-black text-blue-900 font-bold uppercase px-1 min-h-[16px]">
                            {printDocHeader.PoNo || ''}
                          </span>
                        )}
                      </div>
                    </div>

                  </div>

                  {/* MAIN GROUP */}
                  <div className="flex items-center pt-0.5">
                    <span className="w-28 shrink-0">MAIN GROUP :</span>
                    {isHeaderEditMode ? (
                      <input
                        type="text"
                        value={printDocHeader.MainGroup || ''}
                        onChange={(e) => setPrintDocHeader(prev => ({ ...prev, MainGroup: e.target.value }))}
                        className="w-48 border-b border-black text-blue-900 font-bold px-1 bg-yellow-50 outline-none"
                      />
                    ) : (
                      <span className="w-48 border-b border-black text-blue-900 font-bold uppercase px-1 min-h-[16px]">
                        {printDocHeader.MainGroup || ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* 4. Table Grid */}
                <div className="overflow-x-auto w-full">
                  <table className="w-full border-collapse text-[10px] border-b-2 border-black">
                    <thead>
                      <tr className="bg-white text-black font-black uppercase text-center border-b-2 border-black">
                        <th rowSpan={2} className="p-1 border-r border-black w-7">NO</th>
                        <th rowSpan={2} className="p-1 border-r border-black w-20">MRQ No.</th>
                        <th rowSpan={2} className="p-1 border-r border-black">DESCRIPTION FULL</th>
                        <th colSpan={2} className="p-1 border-r border-black border-b border-black">RECEIVED</th>
                        <th colSpan={4} className="p-1 border-b border-black">By. Supplier</th>
                      </tr>
                      <tr className="bg-white text-black font-black uppercase text-center border-b-2 border-black">
                        <th className="p-1 border-r border-black w-12">QTY</th>
                        <th className="p-1 border-r border-black w-10">U/I</th>
                        <th className="p-1 border-r border-black w-24">Unit Price (USD)</th>
                        <th className="p-1 border-r border-black w-24">Total Price (USD)</th>
                        <th className="p-1 border-r border-black w-24">Unit Price (Rp)</th>
                        <th className="p-1 w-24">Total Price (Rp)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Ensure at least 8 rows rendered matching image.png */}
                      {Array.from({ length: Math.max(8, printDocItems.length) }).map((_, idx) => {
                        const item = printDocItems[idx];
                        return (
                          <tr key={idx} className="border-b border-black h-8 text-[10px] text-black">
                            {/* NO (Blue number) */}
                            <td className="p-0.5 border-r border-black text-center font-bold text-blue-900">
                              {idx + 1}
                            </td>

                            {/* MRQ No. */}
                            <td className="p-0.5 border-r border-black text-center font-medium">
                              {isHeaderEditMode ? (
                                <input
                                  type="text"
                                  value={item?.MRQNo || item?.Remark || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setPrintDocItems(prev => {
                                      const copy = [...prev];
                                      while (copy.length <= idx) copy.push({});
                                      copy[idx] = { ...copy[idx], MRQNo: val };
                                      return copy;
                                    });
                                  }}
                                  className="w-full text-center bg-yellow-50 outline-none"
                                />
                              ) : (
                                item?.MRQNo || item?.Remark || ''
                              )}
                            </td>

                            {/* DESCRIPTION FULL */}
                            <td className="p-0.5 border-r border-black font-medium pl-1.5 whitespace-pre-wrap break-words">
                              {isHeaderEditMode ? (
                                <input
                                  type="text"
                                  value={item?.ItemName || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setPrintDocItems(prev => {
                                      const copy = [...prev];
                                      while (copy.length <= idx) copy.push({});
                                      copy[idx] = { ...copy[idx], ItemName: val };
                                      return copy;
                                    });
                                  }}
                                  className="w-full bg-yellow-50 outline-none"
                                />
                              ) : (
                                item?.ItemName || ''
                              )}
                            </td>

                            {/* QTY */}
                            <td className="p-0.5 border-r border-black text-center font-bold">
                              {isHeaderEditMode ? (
                                <input
                                  type="text"
                                  value={item?.Qty !== undefined ? item.Qty : ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setPrintDocItems(prev => {
                                      const copy = [...prev];
                                      while (copy.length <= idx) copy.push({});
                                      copy[idx] = { ...copy[idx], Qty: val };
                                      return copy;
                                    });
                                  }}
                                  className="w-full text-center bg-yellow-50 outline-none font-bold"
                                />
                              ) : (
                                item?.Qty !== undefined ? item.Qty : ''
                              )}
                            </td>

                            {/* U/I */}
                            <td className="p-0.5 border-r border-black text-center font-medium">
                              {isHeaderEditMode ? (
                                <input
                                  type="text"
                                  value={item?.UoM || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setPrintDocItems(prev => {
                                      const copy = [...prev];
                                      while (copy.length <= idx) copy.push({});
                                      copy[idx] = { ...copy[idx], UoM: val };
                                      return copy;
                                    });
                                  }}
                                  className="w-full text-center bg-yellow-50 outline-none"
                                />
                              ) : (
                                item?.UoM || ''
                              )}
                            </td>

                            {/* Unit Price (USD) */}
                            <td className="p-0.5 border-r border-black text-right font-medium pr-1">
                              {isHeaderEditMode ? (
                                <input
                                  type="text"
                                  value={item?.UnitPriceUSD !== undefined ? item.UnitPriceUSD : ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setPrintDocItems(prev => {
                                      const copy = [...prev];
                                      while (copy.length <= idx) copy.push({});
                                      copy[idx] = { ...copy[idx], UnitPriceUSD: val };
                                      return copy;
                                    });
                                  }}
                                  className="w-full text-right bg-yellow-50 outline-none"
                                />
                              ) : (
                                item?.UnitPriceUSD ? formatCurrency(item.UnitPriceUSD) : ''
                              )}
                            </td>

                            {/* Total Price (USD) */}
                            <td className="p-0.5 border-r border-black text-right font-medium pr-1">
                              {isHeaderEditMode ? (
                                <input
                                  type="text"
                                  value={item?.TotalPriceUSD !== undefined ? item.TotalPriceUSD : ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setPrintDocItems(prev => {
                                      const copy = [...prev];
                                      while (copy.length <= idx) copy.push({});
                                      copy[idx] = { ...copy[idx], TotalPriceUSD: val };
                                      return copy;
                                    });
                                  }}
                                  className="w-full text-right bg-yellow-50 outline-none"
                                />
                              ) : (
                                item?.TotalPriceUSD ? formatCurrency(item.TotalPriceUSD) : ''
                              )}
                            </td>

                            {/* Unit Price (Rp) */}
                            <td className="p-0.5 border-r border-black text-right font-medium pr-1">
                              {isHeaderEditMode ? (
                                <input
                                  type="text"
                                  value={item?.UnitPriceIDR || item?.UnitPrice || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setPrintDocItems(prev => {
                                      const copy = [...prev];
                                      while (copy.length <= idx) copy.push({});
                                      copy[idx] = { ...copy[idx], UnitPriceIDR: val };
                                      return copy;
                                    });
                                  }}
                                  className="w-full text-right bg-yellow-50 outline-none"
                                />
                              ) : (
                                (item?.UnitPriceIDR || item?.UnitPrice) ? formatCurrency(item?.UnitPriceIDR || item?.UnitPrice) : ''
                              )}
                            </td>

                            {/* Total Price (Rp) */}
                            <td className="p-0.5 text-right font-medium pr-1">
                              {isHeaderEditMode ? (
                                <input
                                  type="text"
                                  value={item?.TotalPriceIDR || item?.TotalPrice || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setPrintDocItems(prev => {
                                      const copy = [...prev];
                                      while (copy.length <= idx) copy.push({});
                                      copy[idx] = { ...copy[idx], TotalPriceIDR: val };
                                      return copy;
                                    });
                                  }}
                                  className="w-full text-right bg-yellow-50 outline-none"
                                />
                              ) : (
                                (item?.TotalPriceIDR || item?.TotalPrice) ? formatCurrency(item?.TotalPriceIDR || item?.TotalPrice) : ''
                              )}
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 5. Bottom Signatures & Totals Section */}
                <div className="grid grid-cols-12 border-b-2 border-black text-black">
                  
                  {/* Box 1: RECEIVED BY */}
                  <div className="col-span-3 border-r-2 border-black p-1.5 flex flex-col justify-between h-28">
                    <span className="font-bold text-[10px] uppercase">RECEIVED BY,</span>
                    
                    {/* Signature Area */}
                    <div className="my-1 flex justify-center items-center">
                      <svg className="h-10 w-28" viewBox="0 0 120 40" fill="none" stroke="#000080" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M 12 28 Q 25 8 38 24 T 52 14 T 68 28 T 88 12 T 108 30" />
                        <path d="M 22 18 L 98 20" />
                      </svg>
                    </div>

                    <div className="text-center">
                      {isHeaderEditMode ? (
                        <input
                          type="text"
                          value={printDocHeader.ReceivedByName || printDocHeader.UserBy || 'Yuditira'}
                          onChange={(e) => setPrintDocHeader(prev => ({ ...prev, ReceivedByName: e.target.value }))}
                          className="w-full text-center border-b border-black text-blue-900 font-bold text-[11px] bg-yellow-50 outline-none"
                        />
                      ) : (
                        <u className="font-extrabold text-[#000080] text-[11px] block">
                          {printDocHeader.ReceivedByName || printDocHeader.UserBy || 'Yuditira'}
                        </u>
                      )}
                      <span className="font-extrabold text-[10px] uppercase block mt-0.5">
                        {printDocHeader.ReceivedByTitle || 'MATERIAL MAN'}
                      </span>
                    </div>
                  </div>

                  {/* Box 2: APPROVED BY */}
                  <div className="col-span-3 border-r-2 border-black p-1.5 flex flex-col justify-between h-28">
                    <span className="font-bold text-[10px] uppercase">APPROVED BY</span>
                    
                    {/* Signature Area */}
                    <div className="my-1 h-10"></div>

                    <div className="text-center">
                      {isHeaderEditMode ? (
                        <input
                          type="text"
                          value={printDocHeader.ApprovedByName || printDocHeader.ApprovedBy || 'Ashley Moggy'}
                          onChange={(e) => setPrintDocHeader(prev => ({ ...prev, ApprovedByName: e.target.value }))}
                          className="w-full text-center border-b border-black text-blue-900 font-bold text-[11px] bg-yellow-50 outline-none"
                        />
                      ) : (
                        <u className="font-extrabold text-[#000080] text-[11px] block">
                          {printDocHeader.ApprovedByName || printDocHeader.ApprovedBy || 'Ashley Moggy'}
                        </u>
                      )}
                      <span className="font-extrabold text-[10px] uppercase block mt-0.5">
                        {printDocHeader.ApprovedByTitle || 'RIG MANAGER'}
                      </span>
                    </div>
                  </div>

                  {/* Box 3: TOTAL USD */}
                  <div className="col-span-3 border-r-2 border-black p-2 flex items-center justify-between font-bold text-xs text-black">
                    <span className="uppercase">TOTAL</span>
                    <span className="text-blue-900 font-extrabold">$</span>
                    <span className="text-blue-900 font-extrabold">
                      {calculateReceiveTotals().totalUSD > 0 ? formatCurrency(calculateReceiveTotals().totalUSD) : '-'}
                    </span>
                  </div>

                  {/* Box 4: TOTAL Rp */}
                  <div className="col-span-3 p-2 flex items-center justify-between font-bold text-xs text-black">
                    <span className="uppercase">TOTAL</span>
                    <span className="text-blue-900 font-extrabold">Rp</span>
                    <span className="text-blue-900 font-extrabold">
                      {calculateReceiveTotals().totalIDR > 0 ? formatCurrency(calculateReceiveTotals().totalIDR) : '-'}
                    </span>
                  </div>

                </div>

                {/* 6. Footer Company Address & Green Accent Line */}
                <div className="p-2 text-[9px] text-black bg-white leading-tight font-medium">
                  <div className="w-full h-1 bg-[#00a651] mb-1.5 rounded-full"></div>
                  <p>Block R, Kl. Saraswati No. 9A Blok R, Cipete Utara, Kec. Kebayoran Baru, Jakarta Selatan, D.K.I Jakarta 12150.</p>
                  <p>Tel +61 8 8952 2966 Email: jakartaoffice@silvercitydrilling.co.id</p>
                  <div className="w-full h-0.5 bg-[#00a651] mt-1.5"></div>
                </div>

              </div>
            ) : (

              /* ========================================================= */
              /* 3. STANDARD DOCUMENT FORM LAYOUT (MATERIAL REQUEST / RECEIVE) */
              /* ========================================================= */
              <div className="space-y-0 text-slate-900 text-xs border-2 border-blue-900 bg-white min-w-[620px]">
                <div className="grid grid-cols-2 border-b-2 border-blue-900">
                  <div className="p-3 bg-white flex flex-col justify-between border-r-2 border-blue-900 space-y-2">
                    <div className="flex items-center space-x-2 mb-1">
                      <img
                        src={companyHeader.logoUrl}
                        alt="Logo"
                        className="h-9 object-contain self-start"
                      />
                    </div>
                    
                    <div className="text-[9px] text-slate-700 leading-tight space-y-1">
                      {isHeaderEditMode ? (
                        <div className="space-y-1">
                          <input
                            type="text"
                            value={companyHeader.companyName}
                            onChange={(e) => setCompanyHeader(prev => ({ ...prev, companyName: e.target.value }))}
                            placeholder="Company Name"
                            className="w-full px-1.5 py-0.5 border border-blue-300 rounded text-[10px] font-bold text-blue-950 bg-yellow-50/50 outline-none"
                          />
                          <input
                            type="text"
                            value={companyHeader.supportOffice}
                            onChange={(e) => setCompanyHeader(prev => ({ ...prev, supportOffice: e.target.value }))}
                            placeholder="Header Support Office"
                            className="w-full px-1.5 py-0.5 border border-blue-300 rounded text-[9px] font-semibold text-slate-600 bg-yellow-50/50 outline-none"
                          />
                          <input
                            type="text"
                            value={companyHeader.addressLine1}
                            onChange={(e) => setCompanyHeader(prev => ({ ...prev, addressLine1: e.target.value }))}
                            placeholder="Address Line 1"
                            className="w-full px-1.5 py-0.5 border border-blue-300 rounded text-[9px] text-slate-700 bg-yellow-50/50 outline-none"
                          />
                          <input
                            type="text"
                            value={companyHeader.addressLine2}
                            onChange={(e) => setCompanyHeader(prev => ({ ...prev, addressLine2: e.target.value }))}
                            placeholder="Address Line 2"
                            className="w-full px-1.5 py-0.5 border border-blue-300 rounded text-[9px] text-slate-700 bg-yellow-50/50 outline-none"
                          />
                          <div className="flex items-center space-x-1">
                            <span className="font-bold text-[9px]">TEL:</span>
                            <input
                              type="text"
                              value={companyHeader.phone}
                              onChange={(e) => setCompanyHeader(prev => ({ ...prev, phone: e.target.value }))}
                              placeholder="Phone No."
                              className="w-full px-1.5 py-0.5 border border-blue-300 rounded text-[9px] text-slate-700 bg-yellow-50/50 outline-none"
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="font-bold text-blue-950 text-[10px] uppercase">{companyHeader.companyName}</p>
                          <p className="font-semibold text-slate-600">{companyHeader.supportOffice}</p>
                          <p>{companyHeader.addressLine1}</p>
                          <p>{companyHeader.addressLine2}</p>
                          <p className="font-medium">PHONE : {companyHeader.phone}</p>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="p-2 space-y-1 text-[11px] bg-white">
                    <div className="flex justify-between items-center gap-1">
                      <span className="font-bold text-slate-700 shrink-0">{printDocHeader.DocNoLabel || 'MRQ No.'}</span>
                      <span className="shrink-0">:</span>
                      {isHeaderEditMode ? (
                        <input
                          type="text"
                          value={printDocHeader.RequestID || printDocId}
                          onChange={(e) => setPrintDocHeader(prev => ({ ...prev, RequestID: e.target.value }))}
                          className="w-full px-1.5 py-0.5 border border-blue-300 rounded text-[10px] font-black text-blue-900 bg-yellow-50/50 outline-none"
                        />
                      ) : (
                        <strong className="text-blue-900 font-black">{printDocHeader.RequestID || printDocId}</strong>
                      )}
                    </div>

                    <div className="flex justify-between items-center gap-1">
                      <span className="font-bold text-slate-700 shrink-0">DATE</span>
                      <span className="shrink-0">:</span>
                      {isHeaderEditMode ? (
                        <input
                          type="date"
                          value={printDocHeader.Date || ''}
                          onChange={(e) => setPrintDocHeader(prev => ({ ...prev, Date: e.target.value }))}
                          className="w-full px-1.5 py-0.5 border border-blue-300 rounded text-[10px] font-semibold bg-yellow-50/50 outline-none"
                        />
                      ) : (
                        <span>{printDocHeader.Date}</span>
                      )}
                    </div>

                    <div className="flex justify-between items-center gap-1">
                      <span className="font-bold text-slate-700 shrink-0">WELL / LOC.</span>
                      <span className="shrink-0">:</span>
                      {isHeaderEditMode ? (
                        <input
                          type="text"
                          value={printDocHeader.WellLoc || ''}
                          onChange={(e) => setPrintDocHeader(prev => ({ ...prev, WellLoc: e.target.value }))}
                          className="w-full px-1.5 py-0.5 border border-blue-300 rounded text-[10px] font-semibold bg-yellow-50/50 outline-none"
                        />
                      ) : (
                        <span>{printDocHeader.WellLoc}</span>
                      )}
                    </div>

                    <div className="flex justify-between items-center gap-1">
                      <span className="font-bold text-slate-700 shrink-0">RIG NAME</span>
                      <span className="shrink-0">:</span>
                      {isHeaderEditMode ? (
                        <input
                          type="text"
                          value={printDocHeader.RigName || 'Rig Silver City 20'}
                          onChange={(e) => setPrintDocHeader(prev => ({ ...prev, RigName: e.target.value }))}
                          className="w-full px-1.5 py-0.5 border border-blue-300 rounded text-[10px] font-semibold bg-yellow-50/50 outline-none"
                        />
                      ) : (
                        <span>{printDocHeader.RigName || 'Rig Silver City 20'}</span>
                      )}
                    </div>

                    <div className="flex justify-between items-center gap-1">
                      <span className="font-bold text-slate-700 shrink-0">DEPT</span>
                      <span className="shrink-0">:</span>
                      {isHeaderEditMode ? (
                        <input
                          type="text"
                          value={printDocHeader.Department || ''}
                          onChange={(e) => {
                            const newDept = e.target.value;
                            setPrintDocHeader(prev => ({
                              ...prev,
                              Department: newDept,
                              UserBy: (!prev.UserBy || prev.UserBy === prev.Department) ? newDept : prev.UserBy
                            }));
                          }}
                          className="w-full px-1.5 py-0.5 border border-blue-300 rounded text-[10px] font-semibold bg-yellow-50/50 outline-none"
                        />
                      ) : (
                        <span>{printDocHeader.Department}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-blue-600 text-white text-center font-black py-1.5 uppercase tracking-wider border-b-2 border-blue-900 text-sm flex items-center justify-center">
                  {isHeaderEditMode ? (
                    <input
                      type="text"
                      value={printDocHeader.DocTitle || 'MATERIAL REQUEST'}
                      onChange={(e) => setPrintDocHeader(prev => ({ ...prev, DocTitle: e.target.value }))}
                      className="bg-blue-700 text-white text-center font-black px-3 py-0.5 rounded text-xs border border-blue-400 outline-none w-2/3"
                      placeholder="Document Form Title"
                    />
                  ) : (
                    <span>{printDocHeader.DocTitle || 'MATERIAL REQUEST'}</span>
                  )}
                </div>

                <div className="overflow-x-auto w-full">
                  <table className="w-full min-w-[550px] border-collapse border-b-2 border-blue-900 text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-[11px] border-b-2 border-blue-900">
                        <th className="p-2 border-r-2 border-blue-900 w-12">NO</th>
                        <th className="p-2 border-r-2 border-blue-900 w-16">QTY</th>
                        <th className="p-2 border-r-2 border-blue-900 w-16">UoM</th>
                        <th className="p-2 border-r-2 border-blue-900 w-28">MAT. CODE</th>
                        <th className="p-2 border-r-2 border-blue-900">DESCRIPTION FULL</th>
                        <th className="p-2 border-r-2 border-blue-900 w-16">STOCK</th>
                        <th className="p-2 w-20">REMARK</th>
                      </tr>
                    </thead>
                    <tbody>
                      {printDocItems.map((r, idx) => (
                        <tr key={idx} className="border-b border-blue-900 h-9">
                          <td className="p-1 border-r border-blue-900 text-center font-bold text-slate-500">{idx + 1}</td>
                          <td className="p-1 border-r border-blue-900 text-center font-bold">{r.Qty}</td>
                          <td className="p-1 border-r border-blue-900 text-center font-medium">{r.UoM || ''}</td>
                          <td className="p-1 border-r border-blue-900 text-center font-medium">{r.ItemID}</td>
                          <td className="p-1 border-r border-blue-900 font-medium">{r.ItemName}</td>
                          <td className="p-1 border-r border-blue-900 text-center font-medium">{r.Stock !== undefined ? r.Stock : ''}</td>
                          <td className="p-1 text-center font-medium">{r.Remark || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-4 border-b-2 border-blue-900 text-center text-[10px] font-bold">
                  <div className="border-r-2 border-blue-900 p-2 flex flex-col justify-between h-24">
                    <span className="text-slate-500">User by</span>
                    <div className="border-t border-slate-800 pt-1">
                      {isHeaderEditMode ? (
                        <input
                          type="text"
                          value={printDocHeader.UserBy || 'Mechanic'}
                          onChange={(e) => setPrintDocHeader(prev => ({ ...prev, UserBy: e.target.value }))}
                          className="w-full text-center bg-yellow-50 outline-none text-[10px] font-bold"
                        />
                      ) : (
                        <span>{printDocHeader.UserBy || 'Mechanic'}</span>
                      )}
                    </div>
                  </div>
                  <div className="border-r-2 border-blue-900 p-2 flex flex-col justify-between h-24">
                    <span className="text-slate-500">Prepared by</span>
                    <div className="border-t border-slate-800 pt-1">
                      {isHeaderEditMode ? (
                        <input
                          type="text"
                          value={printDocHeader.PreparedBy || 'Material Man'}
                          onChange={(e) => setPrintDocHeader(prev => ({ ...prev, PreparedBy: e.target.value }))}
                          className="w-full text-center bg-yellow-50 outline-none text-[10px] font-bold"
                        />
                      ) : (
                        <span>{printDocHeader.PreparedBy || 'Material Man'}</span>
                      )}
                    </div>
                  </div>
                  <div className="border-r-2 border-blue-900 p-2 flex flex-col justify-between h-24">
                    <span className="text-slate-500">Acknowledged by</span>
                    <div className="border-t border-slate-800 pt-1">
                      {isHeaderEditMode ? (
                        <input
                          type="text"
                          value={printDocHeader.AcknowledgedBy || 'Rig Manager'}
                          onChange={(e) => setPrintDocHeader(prev => ({ ...prev, AcknowledgedBy: e.target.value }))}
                          className="w-full text-center bg-yellow-50 outline-none text-[10px] font-bold"
                        />
                      ) : (
                        <span>{printDocHeader.AcknowledgedBy || 'Rig Manager'}</span>
                      )}
                    </div>
                  </div>
                  <div className="p-2 flex flex-col justify-between h-24">
                    <span className="text-slate-500">Approved By</span>
                    <div className="border-t border-slate-800 pt-1">
                      {isHeaderEditMode ? (
                        <input
                          type="text"
                          value={printDocHeader.ApprovedBy || 'General Manager'}
                          onChange={(e) => setPrintDocHeader(prev => ({ ...prev, ApprovedBy: e.target.value }))}
                          className="w-full text-center bg-yellow-50 outline-none text-[10px] font-bold"
                        />
                      ) : (
                        <span>{printDocHeader.ApprovedBy || 'General Manager'}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-2 text-[9px] text-slate-600 bg-slate-50 flex justify-between items-center gap-2">
                  <span className="font-semibold">{companyHeader.addressLine1} {companyHeader.addressLine2}</span>
                  <span className="font-semibold">Email: {companyHeader.email}</span>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5 print:hidden">
          <button
            type="button"
            onClick={onSaveDocForm}
            className="px-4 sm:px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto"
          >
            <i className="fa-solid fa-floppy-disk text-xs"></i> Save Form Header
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-300 transition cursor-pointer flex-1 sm:flex-none text-center"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handlePrintDocument}
              className="px-4 sm:px-5 py-2.5 bg-yellow-400 text-slate-900 rounded-xl text-xs font-bold hover:bg-yellow-500 shadow-md shadow-yellow-400/20 transition flex items-center justify-center gap-2 cursor-pointer flex-1 sm:flex-none"
            >
              <i className="fa-solid fa-print text-xs"></i> Print Document
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
