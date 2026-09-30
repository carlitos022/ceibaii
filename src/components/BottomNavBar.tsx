import React from 'react';
import { Monitor, Folder, MapPinned, Bus, Route } from 'lucide-react';
import { TabType } from '../types';

export const BottomNavBar: React.FC<{
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}> = ({ activeTab, onTabChange }) => (
  <nav className="fixed bottom-0 left-0 right-0 h-16 bg-[#000f20]/95 backdrop-blur-xl border-t border-[#293a50] grid grid-cols-5 items-center px-1 z-[1000] select-none shadow-[0_-8px_24px_rgba(0,0,0,0.45)]"
    style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
    {([
      { id: 'vivo' as const, label: 'Vivo', Icon: Monitor },
      { id: 'biblioteca' as const, label: 'Biblioteca', Icon: Folder },
      { id: 'recorrido' as const, label: 'Recorrido', Icon: Route },
      { id: 'rastreo' as const, label: 'Rastreo', Icon: MapPinned },
      { id: 'despacho' as const, label: 'Despacho', Icon: Bus }
    ]).map(({ id, label, Icon }) => (
      <button key={id} type="button" onClick={() => onTabChange(id)}
        className={`flex flex-col items-center justify-center gap-1 p-1.5 relative transition-colors ${activeTab === id ? 'text-[#00d1ff]' : 'text-slate-400 hover:text-slate-200'}`}>
        {activeTab === id && <div className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-1 bg-[#00d1ff] rounded-b-md shadow-[0_0_8px_rgba(0,209,255,0.8)]" />}
        <Icon className="w-5 h-5" />
        <span className="text-[11px] font-semibold">{label}</span>
      </button>
    ))}
  </nav>
);
