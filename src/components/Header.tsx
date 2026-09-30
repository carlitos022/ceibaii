import React from 'react';
import { Menu, Settings, User } from 'lucide-react';

export const Header: React.FC<{
  onOpenDrawer: () => void;
  onOpenSettings: () => void;
}> = ({ onOpenDrawer, onOpenSettings }) => (
  <header className="absolute top-0 left-0 right-0 min-h-14 bg-[#000f20]/85 backdrop-blur-md border-b border-[#293a50]/50 flex items-center justify-between gap-3 px-3 sm:px-4 py-2 z-30 select-none">
    <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
      <button onClick={onOpenDrawer} className="p-2 -ml-2 text-slate-300 hover:text-white" aria-label="Abrir flota de unidades">
        <Menu className="w-6 h-6" />
      </button>
      <span className="text-base sm:text-xl font-bold text-[#00d1ff] tracking-wide drop-shadow-[0_0_8px_rgba(0,209,255,0.4)] truncate">
        CSRS X
      </span>
    </div>
    <div className="flex items-center space-x-2">
      <button onClick={onOpenSettings} className="w-8 h-8 rounded-full bg-slate-800/60 flex items-center justify-center border border-[#293a50]" aria-label="Configuración">
        <Settings className="w-4 h-4" />
      </button>
      <button onClick={onOpenSettings} className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white border border-[#293a50]" aria-label="Cuenta">
        <User className="w-4 h-4" />
      </button>
    </div>
  </header>
);
