import React from 'react';
import { TabName } from '../types';

interface MobileBottomNavProps {
  activeTab: TabName;
  setActiveTab: (tab: TabName) => void;
  onOpenSingleModal: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenSingleModal
}) => {
  const navItems: { name: TabName; label: string; icon: string }[] = [
    { name: 'Dashboard', label: 'Home', icon: 'fa-chart-pie' },
    { name: 'ItemList', label: 'Items', icon: 'fa-boxes-stacked' },
    { name: 'MaterialRequest', label: 'Requests', icon: 'fa-file-invoice' },
    { name: 'PurchaseOrder', label: 'POs', icon: 'fa-cart-shopping' },
    { name: 'Inventory', label: 'Stock', icon: 'fa-warehouse' },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800 backdrop-blur-xl z-40 lg:hidden px-2 py-1.5 flex items-center justify-around shadow-lg">
      {navItems.map(item => {
        const isActive = activeTab === item.name;
        return (
          <button
            key={item.name}
            onClick={() => setActiveTab(item.name)}
            className={`flex flex-col items-center py-1 px-2.5 rounded-2xl transition cursor-pointer ${
              isActive
                ? 'text-yellow-600 dark:text-yellow-400 font-extrabold'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <i className={`fa-solid ${item.icon} text-base mb-0.5`}></i>
            <span className="text-[9px] uppercase tracking-wider">{item.label}</span>
          </button>
        );
      })}

      {activeTab !== 'Dashboard' && activeTab !== 'Inventory' && (
        <button
          onClick={onOpenSingleModal}
          className="w-10 h-10 rounded-full bg-amber-400 text-slate-950 font-black shadow-lg shadow-amber-400/40 flex items-center justify-center -mt-5 border-2 border-white dark:border-slate-900 transition active:scale-95 cursor-pointer"
          title="Add New Record"
        >
          <i className="fa-solid fa-plus text-sm"></i>
        </button>
      )}
    </nav>
  );
};
