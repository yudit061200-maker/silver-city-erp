import React, { useState, useEffect } from 'react';
import { TabName, UserSession } from '../types';

interface SidebarProps {
  activeTab: TabName;
  setActiveTab: (tab: TabName) => void;
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
  currentUser: UserSession;
  onLogout: () => void;
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isDrawerOpen,
  setIsDrawerOpen,
  currentUser,
  onLogout,
  sidebarWidth,
  setSidebarWidth,
  isDarkMode = false,
  onToggleDarkMode
}) => {
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingSidebar) return;
      const newWidth = Math.min(Math.max(e.clientX, 200), 480);
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizingSidebar) {
        setIsResizingSidebar(false);
      }
    };

    if (isResizingSidebar) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSidebar, setSidebarWidth]);

  return (
    <>
      {isDrawerOpen && (
        <div
          onClick={() => setIsDrawerOpen(false)}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        ></div>
      )}

      <aside
        style={{ width: `${sidebarWidth}px` }}
        className={`fixed lg:static inset-y-0 left-0 z-50 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 flex flex-col border-r border-slate-200/85 dark:border-slate-800 transition-transform duration-300 transform ${
          isDrawerOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } shadow-xl lg:shadow-none shrink-0 relative group transition-colors max-w-[85vw] sm:max-w-[320px] lg:max-w-none`}
      >
        <div
          onMouseDown={() => setIsResizingSidebar(true)}
          title="Drag to resize sidebar width"
          className={`hidden lg:block absolute top-0 bottom-0 -right-1 w-2.5 cursor-col-resize hover:bg-yellow-400/50 transition-colors z-30 ${
            isResizingSidebar ? 'bg-yellow-400' : ''
          }`}
        >
          <div className="absolute top-1/2 -translate-y-1/2 left-0.5 w-1 h-8 bg-slate-300 dark:bg-slate-700 group-hover:bg-yellow-600 rounded-full"></div>
        </div>

        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-xs">
              <img
                src="https://static.wixstatic.com/media/6daabc_acbf1201bd204e28becacd2ce16a7fb5~mv2.png/v1/fill/w_357,h_100,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/6daabc_acbf1201bd204e28becacd2ce16a7fb5~mv2.png"
                alt="Silver City Drilling Logo"
                className="h-5 object-contain"
              />
            </div>
            <div>
              <h1 className="text-[11px] font-black tracking-wider bg-gradient-to-r from-yellow-600 to-amber-600 dark:from-yellow-400 dark:to-amber-400 bg-clip-text text-transparent">
                SILVER CITY
              </h1>
              <p className="text-[8px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-widest">
                ERP Operations
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsDrawerOpen(false)}
            className="lg:hidden text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        <nav className="flex-grow px-3.5 py-4 space-y-2 overflow-y-auto text-xs font-medium">
          <div className="px-3 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Main Modules</div>

          {[
            { name: 'Dashboard' as TabName, label: 'Dashboard', icon: 'fa-chart-pie' },
            { name: 'ItemList' as TabName, label: 'Item Master List', icon: 'fa-boxes-stacked' },
            { name: 'MaterialRequest' as TabName, label: 'Material Request', icon: 'fa-file-invoice' },
            { name: 'PurchaseOrder' as TabName, label: 'Purchase Order', icon: 'fa-cart-shopping' },
            { name: 'MaterialReceive' as TabName, label: 'Material Receive', icon: 'fa-truck-ramp-box' },
            { name: 'MaterialIssued' as TabName, label: 'Material Issued', icon: 'fa-share-nodes' },
            { name: 'Inventory' as TabName, label: 'Current Inventory', icon: 'fa-warehouse' }
          ].map(item => {
            const isActive = activeTab === item.name;
            return (
              <button
                key={item.name}
                onClick={() => {
                  setActiveTab(item.name);
                  setIsDrawerOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-200 group text-left cursor-pointer ${
                  isActive
                    ? 'bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white font-bold shadow-xs border border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <div className="flex items-center space-x-3.5">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors border shadow-xs shrink-0 ${
                      isActive
                        ? 'bg-yellow-400 text-slate-900 border-yellow-400'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-400 group-hover:border-yellow-400 group-hover:text-yellow-600 dark:group-hover:text-yellow-400'
                    }`}
                  >
                    <i className={`fa-solid ${item.icon} text-xs`}></i>
                  </div>
                  <span className="tracking-wide font-semibold">{item.label}</span>
                </div>
                <i className="fa-solid fa-chevron-right text-[9px] opacity-0 group-hover:opacity-100 transition-opacity text-slate-400"></i>
              </button>
            );
          })}

          {currentUser?.username?.trim().toLowerCase() === 'yudit061200' && (
            <>
              <div className="pt-4 pb-1 px-3 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Administration</div>

              <button
                onClick={() => {
                  setActiveTab('Users');
                  setIsDrawerOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-200 group text-left cursor-pointer ${
                  activeTab === 'Users'
                    ? 'bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white font-bold shadow-xs border border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <div className="flex items-center space-x-3.5">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors border shadow-xs shrink-0 ${
                      activeTab === 'Users'
                        ? 'bg-yellow-400 text-slate-900 border-yellow-400'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-400 group-hover:border-yellow-400 group-hover:text-yellow-600 dark:group-hover:text-yellow-400'
                    }`}
                  >
                    <i className="fa-solid fa-users-gear text-xs"></i>
                  </div>
                  <span className="tracking-wide font-semibold">User Management</span>
                </div>
                <i className="fa-solid fa-chevron-right text-[9px] opacity-0 group-hover:opacity-100 transition-opacity text-slate-400"></i>
              </button>
            </>
          )}
        </nav>

        {/* Theme Quick Switcher in Sidebar Footer */}
        {onToggleDarkMode && (
          <div className="px-3.5 py-2 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={onToggleDarkMode}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition cursor-pointer border border-slate-200 dark:border-slate-700/80"
            >
              <span className="flex items-center gap-2">
                <i className={`fa-solid ${isDarkMode ? 'fa-sun text-amber-400' : 'fa-moon text-indigo-500'}`}></i>
                <span>Theme: {isDarkMode ? 'Dark Mode' : 'Light Mode'}</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-600">
                {isDarkMode ? 'Dark' : 'Light'}
              </span>
            </button>
          </div>
        )}

        <div className="p-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 text-yellow-600 dark:text-yellow-400 flex items-center justify-center font-black text-xs border border-slate-200 dark:border-slate-700 shadow-xs">
                <i className="fa-solid fa-user-shield text-xs"></i>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate w-32">{currentUser.fullname}</p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Online
                </p>
              </div>
            </div>
            <button
              onClick={onLogout}
              title="Logout"
              className="text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 p-2 rounded-lg transition border border-rose-100 dark:border-rose-900/40 shadow-xs cursor-pointer"
            >
              <i className="fa-solid fa-power-off text-xs"></i>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
