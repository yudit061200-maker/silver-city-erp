import React, { useEffect, useRef, useState } from 'react';
import { RecordRow, TabName } from '../types';
import { parseNumberValue } from '../utils/currency';

interface DashboardViewProps {
  items: RecordRow[];
  requests: RecordRow[];
  purchaseOrders: RecordRow[];
  receives: RecordRow[];
  issued: RecordRow[];
  inventoryItems: RecordRow[];
  setActiveTab: (tab: TabName) => void;
  onOpenReorderModal?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  items,
  requests,
  purchaseOrders,
  receives,
  issued,
  inventoryItems,
  setActiveTab,
  onOpenReorderModal
}) => {
  const [chartView, setChartView] = useState<'valuation' | 'inout'>('valuation');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const totalItemsCount = items.length;
  const totalStockQty = inventoryItems.reduce((acc, curr) => acc + parseNumberValue(curr.CurrentStock), 0);
  const totalValueUSD = inventoryItems.reduce((acc, curr) => acc + parseNumberValue(curr.TotalPriceUSD), 0);
  const totalValueIDR = inventoryItems.reduce((acc, curr) => acc + parseNumberValue(curr.TotalPriceIDR), 0);

  const needOrderItems = inventoryItems.filter(item => {
    const cur = parseNumberValue(item.CurrentStock);
    const min = parseNumberValue(item.MinStock);
    return cur <= min;
  });

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? '#334155' : '#f1f5f9';
    const textColor = isDark ? '#cbd5e1' : '#64748b';

    if ((window as any).Chart) {
      if ((window as any)._erpChart) (window as any)._erpChart.destroy();

      let chartConfig: any = {};
      if (chartView === 'valuation') {
        chartConfig = {
          type: 'bar',
          data: {
            labels: ['Valuation (USD x1k)', 'Material Requests', 'Purchase Orders', 'Material Receives', 'Material Issued'],
            datasets: [{
              label: 'Cash Flow & Valuation Summary',
              data: [
                totalValueUSD / 1000,
                requests.length,
                purchaseOrders.length,
                receives.length,
                issued.length
              ],
              backgroundColor: ['#eab308', '#6366f1', '#f97316', '#14b8a6', '#f43f5e'],
              borderRadius: 12
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor } },
              x: { grid: { display: false }, ticks: { color: textColor } }
            }
          }
        };
      } else {
        chartConfig = {
          type: 'line',
          data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Current Total'],
            datasets: [
              {
                label: 'Material In (Receives)',
                data: [12, 19, 8, 14, 22, receives.length || 15],
                borderColor: '#14b8a6',
                backgroundColor: 'rgba(20, 184, 166, 0.08)',
                fill: true,
                tension: 0.4
              },
              {
                label: 'Material Out (Issued)',
                data: [7, 11, 6, 10, 15, issued.length || 10],
                borderColor: '#f43f5e',
                backgroundColor: 'rgba(244, 63, 94, 0.08)',
                fill: true,
                tension: 0.4
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top', labels: { color: textColor } } },
            scales: {
              y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor } },
              x: { grid: { display: false }, ticks: { color: textColor } }
            }
          }
        };
      }
      (window as any)._erpChart = new (window as any).Chart(ctx, chartConfig);
    }
  }, [chartView, totalValueUSD, requests, purchaseOrders, receives, issued]);

  return (
    <div className="space-y-6">
      {/* Need Order Alert Banner */}
      {needOrderItems.length > 0 && (
        <div className="bg-gradient-to-r from-rose-500 via-rose-600 to-red-600 text-white rounded-3xl p-5 shadow-lg shadow-rose-500/20 border border-rose-400 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-xl shrink-0">
              <i className="fa-solid fa-bell-concierge text-yellow-300 animate-bounce"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-yellow-400 text-slate-900 rounded-lg text-[10px] font-black uppercase tracking-wider">
                  Reorder Alert
                </span>
                <span className="text-xs text-rose-100 font-semibold">
                  Status: <strong>NEED ORDER</strong>
                </span>
              </div>
              <h3 className="text-base font-black mt-0.5">
                {needOrderItems.length} Items Reached or Below Minimum Stock
              </h3>
              <p className="text-xs text-rose-100 font-medium">
                Create a Material Request promptly to maintain operational inventory levels.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto justify-end">
            <button
              onClick={() => setActiveTab('Inventory')}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold transition border border-white/20 cursor-pointer"
            >
              View in Inventory
            </button>
            <button
              onClick={onOpenReorderModal}
              className="px-5 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-slate-900 rounded-2xl text-xs font-extrabold transition shadow-md shadow-yellow-400/20 flex items-center gap-2 cursor-pointer"
            >
              <i className="fa-solid fa-cart-shopping"></i>
              Open Reorder Notifications
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl shadow-xs border border-slate-100 dark:border-slate-800 flex items-center justify-between hover:shadow-md transition">
          <div>
            <p className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Items</p>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1.5">{totalItemsCount}</h3>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center text-base sm:text-lg shadow-xs shrink-0">
            <i className="fa-solid fa-boxes-stacked"></i>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl shadow-xs border border-slate-100 dark:border-slate-800 flex items-center justify-between hover:shadow-md transition">
          <div>
            <p className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Stock Qty</p>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1.5">{totalStockQty}</h3>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-base sm:text-lg shadow-xs shrink-0">
            <i className="fa-solid fa-warehouse"></i>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl shadow-xs border border-slate-100 dark:border-slate-800 flex items-center justify-between hover:shadow-md transition">
          <div>
            <p className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Valuation (USD)</p>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1.5">${totalValueUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center text-base sm:text-lg shadow-xs shrink-0">
            <i className="fa-solid fa-dollar-sign"></i>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl shadow-xs border border-slate-100 dark:border-slate-800 flex items-center justify-between hover:shadow-md transition">
          <div>
            <p className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Valuation (IDR)</p>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1.5">Rp {totalValueIDR.toLocaleString('id-ID')}</h3>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-base sm:text-lg shadow-xs shrink-0">
            <i className="fa-solid fa-rupiah-sign"></i>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div
          onClick={() => setActiveTab('MaterialRequest')}
          className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-xs border border-slate-100 dark:border-slate-800 cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-all group"
        >
          <p className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Material Requests</p>
          <div className="flex justify-between items-end mt-3">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">{requests.length}</h3>
            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold group-hover:translate-x-1.5 transition-transform">View &rarr;</span>
          </div>
        </div>

        <div
          onClick={() => setActiveTab('PurchaseOrder')}
          className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-xs border border-slate-100 dark:border-slate-800 cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-all group"
        >
          <p className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Purchase Orders</p>
          <div className="flex justify-between items-end mt-3">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">{purchaseOrders.length}</h3>
            <span className="text-xs text-amber-600 dark:text-amber-400 font-bold group-hover:translate-x-1.5 transition-transform">View &rarr;</span>
          </div>
        </div>

        <div
          onClick={() => setActiveTab('MaterialReceive')}
          className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-xs border border-slate-100 dark:border-slate-800 cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-all group"
        >
          <p className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Material Receives</p>
          <div className="flex justify-between items-end mt-3">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">{receives.length}</h3>
            <span className="text-xs text-teal-600 dark:text-teal-400 font-bold group-hover:translate-x-1.5 transition-transform">View &rarr;</span>
          </div>
        </div>

        <div
          onClick={() => setActiveTab('MaterialIssued')}
          className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-xs border border-slate-100 dark:border-slate-800 cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-all group"
        >
          <p className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Material Issued</p>
          <div className="flex justify-between items-end mt-3">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">{issued.length}</h3>
            <span className="text-xs text-rose-600 dark:text-rose-400 font-bold group-hover:translate-x-1.5 transition-transform">View &rarr;</span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xs border border-slate-100 dark:border-slate-800 p-8 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Analytics & Performance Center</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Real-time warehouse operations and corporate financial analytics.</p>
          </div>
          <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-700 shadow-inner">
            <button
              onClick={() => setChartView('valuation')}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                chartView === 'valuation' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Cash Flow & Valuation
            </button>
            <button
              onClick={() => setChartView('inout')}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                chartView === 'inout' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Material In / Out
            </button>
          </div>
        </div>

        <div className="relative h-80 w-full">
          <canvas ref={canvasRef}></canvas>
        </div>
      </div>
    </div>
  );
};
