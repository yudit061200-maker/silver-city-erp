import React from 'react';
import { TabName, UserSession } from '../types';

interface HeaderProps {
  activeTab: TabName;
  setActiveTab: (tab: TabName) => void;
  currentUser?: UserSession;
  onLogout?: () => void;
  onSyncSheets: () => void;
  itemsCount: number;
  itemsNeedingOrderCount?: number;
  onOpenReorderModal?: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  onLogout,
  onSyncSheets,
  itemsCount,
  itemsNeedingOrderCount = 0,
  onOpenReorderModal,
  isDarkMode = false,
  onToggleDarkMode
}) => {
  const isYudit = currentUser?.username?.trim().toLowerCase() === 'yudit061200';
  const navTabs: { name: TabName; label: string; icon: string }[] = [
    { name: 'Dashboard', label: 'Dashboard', icon: 'fa-chart-pie' },
    { name: 'ItemList', label: 'Item Master', icon: 'fa-boxes-stacked' },
    { name: 'MaterialRequest', label: 'Requests', icon: 'fa-file-invoice' },
    { name: 'PurchaseOrder', label: 'Purchase Orders', icon: 'fa-cart-shopping' },
    { name: 'MaterialReceive', label: 'Receives', icon: 'fa-truck-ramp-box' },
    { name: 'MaterialIssued', label: 'Issued', icon: 'fa-share-nodes' },
    { name: 'Inventory', label: 'Inventory', icon: 'fa-warehouse' },
    ...(isYudit ? [{ name: 'Users' as TabName, label: 'Users', icon: 'fa-users-gear' }] : []),
  ];

  return (
    <header className="bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 shadow-sm border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-30 backdrop-blur-xl transition-colors">
      
      {/* Top Bar: Brand, Actions, User */}
      <div className="px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80">
        
        {/* Brand Logo & Title */}
        <div className="flex items-center space-x-3 shrink-0">
          <div className="bg-slate-50 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-xs">
            <img
              src="https://static.wixstatic.com/media/6daabc_acbf1201bd204e28becacd2ce16a7fb5~mv2.png/v1/fill/w_357,h_100,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/6daabc_acbf1201bd204e28becacd2ce16a7fb5~mv2.png"
              alt="Silver City Drilling Logo"
              className="h-5 object-contain"
            />
          </div>
          <div className="hidden xs:block">
            <div className="flex items-center gap-1.5">
              <h1 className="text-[12px] font-black tracking-wider bg-gradient-to-r from-yellow-600 to-amber-600 dark:from-yellow-400 dark:to-amber-400 bg-clip-text text-transparent">
                SILVER CITY
              </h1>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800" title="Firebase Realtime Cloud Sync Active across all devices">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Cloud Sync
              </span>
            </div>
            <p className="text-[8px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-widest">
              ERP Operations
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          

          {/* Reorder Notification Bell */}
          <button
            onClick={onOpenReorderModal}
            title={itemsNeedingOrderCount > 0 ? `${itemsNeedingOrderCount} items need order` : 'Stock Notification'}
            className="relative p-2 sm:p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-2xl text-slate-700 dark:text-slate-200 transition shadow-xs cursor-pointer flex items-center justify-center shrink-0"
          >
            <i className="fa-solid fa-bell text-sm sm:text-base"></i>
            {itemsNeedingOrderCount > 0 ? (
              <span className="absolute -top-1 -right-1 bg-rose-600 text-white font-black text-[10px] min-w-4 h-4 px-1 rounded-full flex items-center justify-center shadow-md animate-bounce">
                {itemsNeedingOrderCount}
              </span>
            ) : (
              <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full"></span>
            )}
          </button>

          {/* Dark / Light Toggle */}
          <button
            onClick={onToggleDarkMode}
            title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
            className="p-2 sm:p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-2xl text-slate-700 dark:text-slate-200 transition shadow-xs cursor-pointer flex items-center justify-center shrink-0"
          >
            <i className={`fa-solid ${isDarkMode ? 'fa-sun text-amber-400' : 'fa-moon text-indigo-600'} text-sm`}></i>
          </button>

          {/* User Profile & Logout */}
          {currentUser && (
            <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-800 pl-2 sm:pl-3">
              <div className="hidden md:flex flex-col text-right">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate max-w-[120px]">
                  {currentUser.fullname}
                </span>
                <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">
                  {currentUser.role}
                </span>
              </div>
              {onLogout && (
                <button
                  onClick={onLogout}
                  title="Logout"
                  className="p-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-xl transition cursor-pointer text-xs font-bold"
                >
                  <i className="fa-solid fa-power-off"></i>
                </button>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Bottom Bar: Horizontal Scrollable Tabs */}
      <div className="px-3 sm:px-6 py-1.5 flex items-center overflow-x-auto no-scrollbar gap-1.5 sm:gap-2 text-xs font-semibold">
        {navTabs.map(tab => {
          const isActive = activeTab === tab.name;
          return (
            <button
              key={tab.name}
              onClick={() => setActiveTab(tab.name)}
              className={`py-2 px-3 sm:px-3.5 rounded-2xl transition cursor-pointer flex items-center gap-2 shrink-0 ${
                isActive
                  ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                  : 'bg-slate-100/70 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/80'
              }`}
            >
              <i className={`fa-solid ${tab.icon} text-xs ${isActive ? 'text-slate-950' : 'text-slate-400 dark:text-slate-400'}`}></i>
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}
      </div>

    </header>
  );
};
