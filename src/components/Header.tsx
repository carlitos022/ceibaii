import React from 'react';
import { Menu, Bell, Settings, User } from 'lucide-react';

interface HeaderProps {
  onOpenDrawer: () => void;
  onOpenAlerts: () => void;
  onOpenSettings: () => void;
  unreadAlertsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenDrawer,
  onOpenAlerts,
  onOpenSettings,
  unreadAlertsCount
}) => {
  return (
    <header className="absolute top-0 left-0 right-0 min-h-14 bg-[#000f20]/85 backdrop-blur-md border-b border-[#293a50]/50 flex items-center justify-between gap-3 px-3 sm:px-4 py-2 z-30 select-none">
      <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
        <button
          onClick={onOpenDrawer}
          className="p-2 -ml-2 text-slate-300 hover:text-white transition-colors cursor-pointer active:scale-95"
          aria-label="Abrir flota de unidades"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center space-x-2 min-w-0">
          <span className="text-base sm:text-xl font-bold text-[#00d1ff] tracking-wide drop-shadow-[0_0_8px_rgba(0,209,255,0.4)] truncate">
            CustomServiciosRS
          </span>
          <span className="hidden sm:inline-block text-[9px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded bg-[#011428] border border-[#293a50] text-[#00d1ff]">
            Ceiba II
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-1.5 sm:space-x-2">
        <button
          onClick={onOpenAlerts}
          className="p-2 text-slate-300 hover:text-white transition-colors relative cursor-pointer active:scale-95"
          aria-label="Alertas del sistema"
        >
          <Bell className="w-5 h-5" />
          {unreadAlertsCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-[#000f20] animate-pulse" />
          )}
        </button>

        <button
          onClick={onOpenSettings}
          className="w-8 h-8 rounded-full bg-slate-800/60 backdrop-blur-sm flex items-center justify-center text-slate-300 border border-[#293a50] cursor-pointer hover:border-[#00d1ff] hover:text-white transition-colors active:scale-95"
          aria-label="Configuración y Servidor MySQL"
        >
          <Settings className="w-4 h-4" />
        </button>

        <div
          onClick={onOpenSettings}
          className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white border border-[#293a50] cursor-pointer hover:border-[#00d1ff] transition-colors"
          title="Operador Central"
        >
          <User className="w-4 h-4" />
        </div>
      </div>
    </header>
  );
};
