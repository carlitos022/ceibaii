import React from 'react';
import { Monitor, Folder, Map as MapIcon, AlertTriangle, Download, Route, ClipboardList } from 'lucide-react';
import { TabType } from '../types';

interface BottomNavBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  unreadAlertsCount: number;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onTabChange,
  unreadAlertsCount
}) => {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 h-16 bg-[#000f20] border-t border-[#293a50] flex justify-around items-center px-1.5 z-40 select-none shadow-[0_-5px_15px_rgba(0,0,0,0.4)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Tab: Vivo */}
      <button
        onClick={() => onTabChange('vivo')}
        className={`flex flex-col items-center justify-center space-y-1 p-2 flex-1 relative transition-colors cursor-pointer ${
          activeTab === 'vivo' ? 'text-[#00d1ff]' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        {activeTab === 'vivo' && (
          <div className="absolute -top-px left-1/2 transform -translate-x-1/2 w-8 h-1 bg-[#00d1ff] rounded-b-md shadow-[0_0_8px_rgba(0,209,255,0.8)]" />
        )}
        <Monitor className="w-4.5 h-4.5 mt-0.5" />
        <span className={`text-[9.5px] ${activeTab === 'vivo' ? 'font-bold tracking-wide' : 'font-medium'}`}>
          Vivo
        </span>
      </button>

      {/* Tab: Biblioteca */}
      <button
        onClick={() => onTabChange('biblioteca')}
        className={`flex flex-col items-center justify-center space-y-1 p-2 flex-1 relative transition-colors cursor-pointer ${
          activeTab === 'biblioteca' ? 'text-[#00d1ff]' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        {activeTab === 'biblioteca' && (
          <div className="absolute -top-px left-1/2 transform -translate-x-1/2 w-8 h-1 bg-[#00d1ff] rounded-b-md shadow-[0_0_8px_rgba(0,209,255,0.8)]" />
        )}
        <Folder className="w-4.5 h-4.5 mt-0.5" />
        <span className={`text-[9.5px] ${activeTab === 'biblioteca' ? 'font-bold tracking-wide' : 'font-medium'}`}>
          Biblioteca
        </span>
      </button>

      {/* Tab: Tracker / Rastro GPS */}
      <button
        onClick={() => onTabChange('tracker')}
        className={`flex flex-col items-center justify-center space-y-1 p-2 flex-1 relative transition-colors cursor-pointer ${
          activeTab === 'tracker' ? 'text-[#00d1ff]' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        {activeTab === 'tracker' && (
          <div className="absolute -top-px left-1/2 transform -translate-x-1/2 w-8 h-1 bg-[#00d1ff] rounded-b-md shadow-[0_0_8px_rgba(0,209,255,0.8)]" />
        )}
        <Route className="w-4.5 h-4.5 mt-0.5" />
        <span className={`text-[9.5px] ${activeTab === 'tracker' ? 'font-bold tracking-wide' : 'font-medium'}`}>
          Tracker
        </span>
      </button>

      {/* Tab: Geocercas */}
      <button
        onClick={() => onTabChange('geocercas')}
        className={`flex flex-col items-center justify-center space-y-1 p-2 flex-1 relative transition-colors cursor-pointer ${
          activeTab === 'geocercas' ? 'text-[#00d1ff]' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        {activeTab === 'geocercas' && (
          <div className="absolute -top-px left-1/2 transform -translate-x-1/2 w-8 h-1 bg-[#00d1ff] rounded-b-md shadow-[0_0_8px_rgba(0,209,255,0.8)]" />
        )}
        <MapIcon className="w-4.5 h-4.5 mt-0.5" />
        <span className={`text-[9.5px] ${activeTab === 'geocercas' ? 'font-bold tracking-wide' : 'font-medium'}`}>
          Geocercas
        </span>
      </button>

      {/* Tab: Vueltas */}
      <button
        onClick={() => onTabChange('vueltas')}
        className={`flex flex-col items-center justify-center space-y-1 p-2 flex-1 relative transition-colors cursor-pointer ${
          activeTab === 'vueltas' ? 'text-[#00d1ff]' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        {activeTab === 'vueltas' && (
          <div className="absolute -top-px left-1/2 transform -translate-x-1/2 w-8 h-1 bg-[#00d1ff] rounded-b-md shadow-[0_0_8px_rgba(0,209,255,0.8)]" />
        )}
        <ClipboardList className="w-4.5 h-4.5 mt-0.5" />
        <span className={`text-[9.5px] ${activeTab === 'vueltas' ? 'font-bold tracking-wide' : 'font-medium'}`}>Vueltas</span>
      </button>

      {/* Tab: Alertas */}
      <button
        onClick={() => onTabChange('alertas')}
        className={`flex flex-col items-center justify-center space-y-1 p-2 flex-1 relative transition-colors cursor-pointer ${
          activeTab === 'alertas' ? 'text-[#00d1ff]' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        {activeTab === 'alertas' && (
          <div className="absolute -top-px left-1/2 transform -translate-x-1/2 w-8 h-1 bg-[#00d1ff] rounded-b-md shadow-[0_0_8px_rgba(0,209,255,0.8)]" />
        )}
        <div className="relative">
          <AlertTriangle className="w-4.5 h-4.5 mt-0.5" />
          {unreadAlertsCount > 0 && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#ffb300] rounded-full border border-[#000f20] animate-pulse" />
          )}
        </div>
        <span className={`text-[9.5px] ${activeTab === 'alertas' ? 'font-bold tracking-wide' : 'font-medium'}`}>
          Alertas
        </span>
      </button>

      {/* Tab: Descargas */}
      <button
        onClick={() => onTabChange('descargas')}
        className={`flex flex-col items-center justify-center space-y-1 p-2 flex-1 relative transition-colors cursor-pointer ${
          activeTab === 'descargas' ? 'text-[#00d1ff]' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        {activeTab === 'descargas' && (
          <div className="absolute -top-px left-1/2 transform -translate-x-1/2 w-8 h-1 bg-[#00d1ff] rounded-b-md shadow-[0_0_8px_rgba(0,209,255,0.8)]" />
        )}
        <Download className="w-4.5 h-4.5 mt-0.5" />
        <span className={`text-[9.5px] ${activeTab === 'descargas' ? 'font-bold tracking-wide' : 'font-medium'}`}>
          Descargas
        </span>
      </button>
    </nav>
  );
};