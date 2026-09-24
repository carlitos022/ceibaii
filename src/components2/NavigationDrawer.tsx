import React, { useState, useMemo } from 'react';
import { Vehicle } from '../types';
import { X, Search, Server, ChevronDown, Bus, Navigation, Video } from 'lucide-react';

interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: Vehicle[];
  selectedVehicleId: string | null;
  onSelectVehicle: (vehicle: Vehicle) => void;
  onOpenVideo: (vehicle: Vehicle) => void;
}

export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  isOpen,
  onClose,
  vehicles,
  selectedVehicleId,
  onSelectVehicle,
  onOpenVideo
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [isGroupOpen, setIsGroupOpen] = useState(true);

  // Counts
  const counts = useMemo(() => {
    return {
      online: vehicles.filter(v => v.status !== 'offline').length,
      offline: vehicles.filter(v => v.status === 'offline').length,
      moving: vehicles.filter(v => v.status === 'moving').length,
      stopped: vehicles.filter(v => v.status === 'stopped').length,
      total: vehicles.length
    };
  }, [vehicles]);

  const STATUS_ORDER: Record<string, number> = { online: 0, moving: 1, stopped: 2, offline: 3 };

  // Filtered vehicles
  const filteredVehicles = useMemo(() => {
    const matched = vehicles.filter(v => {
      const matchSearch =
        v.unitNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.route.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus = statusFilter
        ? (statusFilter === 'connected' ? v.status !== 'offline' : v.status === statusFilter)
        : true;

      return matchSearch && matchStatus;
    });
    // Ordenar por estado: online > moving > stopped > offline (online primero), desempatando por unidad
    return matched.sort((a, b) => {
      const oa = STATUS_ORDER[a.status] ?? 4;
      const ob = STATUS_ORDER[b.status] ?? 4;
      if (oa !== ob) return oa - ob;
      return a.unitNumber.localeCompare(b.unitNumber);
    });
  }, [vehicles, searchTerm, statusFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <aside className="absolute top-0 left-0 bottom-0 w-[85%] max-w-[340px] bg-[#000f20] border-r border-[#293a50] flex flex-col shadow-2xl z-10 transition-transform duration-300 animate-in slide-in-from-left">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#293a50] bg-gradient-to-r from-[#000f20] to-[#011428]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#00d1ff]/10 border border-[#00d1ff]/30 flex items-center justify-center">
              <Bus className="w-5 h-5 text-[#00d1ff]" />
            </div>
            <div>
              <span className="font-bold text-base text-white tracking-wide block leading-tight">
                Flota de Unidades
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                CustomServiciosRS
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800/60 rounded-full transition-colors cursor-pointer"
            aria-label="Cerrar panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#011428]/40">
          {/* Search & Filters */}
          <div className="p-3.5 space-y-3 border-b border-[#293a50]/60">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por número o placa (ej. LAA4015)"
                className="w-full bg-[#000f20] border border-[#293a50] rounded-lg text-xs py-2 pl-9 pr-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#00d1ff] focus:border-[#00d1ff] transition-colors font-mono"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Status Summary Pills */}
            <div className="grid grid-cols-2 gap-1.5 text-[10px] font-bold">
              <button
                onClick={() => setStatusFilter(statusFilter === 'connected' ? null : 'connected')}
                className={`flex items-center space-x-2 border p-1.5 rounded transition-all cursor-pointer ${
                  statusFilter === 'connected'
                    ? 'bg-[#fbbf24]/20 border-[#fbbf24] text-white shadow-[0_0_8px_rgba(251,191,36,0.3)]'
                    : 'bg-slate-800/40 border-[#293a50]/60 text-slate-300 hover:border-[#fbbf24]'
                }`}
              >
                <div className="w-2 h-2 rounded-full bg-[#fbbf24] shadow-[0_0_5px_rgba(251,191,36,0.5)]" />
                <span className="truncate">En Línea</span>
                <span className="ml-auto text-[#fbbf24] font-mono">{counts.online}</span>
              </button>

              <button
                onClick={() => setStatusFilter(statusFilter === 'offline' ? null : 'offline')}
                className={`flex items-center space-x-2 border p-1.5 rounded transition-all cursor-pointer ${
                  statusFilter === 'offline'
                    ? 'bg-slate-700 border-slate-500 text-white'
                    : 'bg-slate-800/40 border-[#293a50]/60 text-slate-300 hover:border-slate-500'
                }`}
              >
                <div className="w-2 h-2 rounded-full bg-[#6b7280] shadow-[0_0_5px_rgba(107,114,128,0.5)]" />
                <span className="truncate">Apagado</span>
                <span className="ml-auto text-[#6b7280] font-mono">{counts.offline}</span>
              </button>

              <button
                onClick={() => setStatusFilter(statusFilter === 'moving' ? null : 'moving')}
                className={`flex items-center space-x-2 border p-1.5 rounded transition-all cursor-pointer ${
                  statusFilter === 'moving'
                    ? 'bg-[#ff9100]/20 border-[#ff9100] text-white shadow-[0_0_8px_rgba(255,145,0,0.3)]'
                    : 'bg-slate-800/40 border-[#293a50]/60 text-slate-300 hover:border-[#ff9100]'
                }`}
              >
                <div className="w-2 h-2 rounded-full bg-[#ff9100] shadow-[0_0_5px_rgba(255,145,0,0.5)] animate-pulse" />
                <span className="truncate">Moviendo</span>
                <span className="ml-auto text-[#ff9100] font-mono">{counts.moving}</span>
              </button>

              <button
                onClick={() => setStatusFilter(statusFilter === 'stopped' ? null : 'stopped')}
                className={`flex items-center space-x-2 border p-1.5 rounded transition-all cursor-pointer ${
                  statusFilter === 'stopped'
                    ? 'bg-[#ef4444]/20 border-[#ef4444] text-white shadow-[0_0_8px_rgba(239,68,68,0.3)]'
                    : 'bg-slate-800/40 border-[#293a50]/60 text-slate-300 hover:border-[#ef4444]'
                }`}
              >
                <div className="w-2 h-2 rounded-full bg-[#ef4444] shadow-[0_0_5px_rgba(239,68,68,0.5)]" />
                <span className="truncate">Detenidos</span>
                <span className="ml-auto text-[#ef4444] font-mono">{counts.stopped}</span>
              </button>
            </div>
          </div>

          {/* Units Tree List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-2.5 py-2.5 text-xs space-y-1.5">
            {/* Server Group header */}
            <div
              onClick={() => setIsGroupOpen(!isGroupOpen)}
              className="flex items-center justify-between cursor-pointer p-2 rounded-lg bg-[#293a50]/30 border border-[#293a50]/50 hover:bg-[#293a50]/50 transition-colors"
            >
              <div className="flex items-center space-x-2.5">
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                    isGroupOpen ? '' : '-rotate-90'
                  }`}
                />
                <Server className="w-4 h-4 text-[#00d1ff]" />
                <span className="font-semibold text-slate-200 tracking-wide">
                  CustomServiciosRS
                </span>
              </div>
              <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                {filteredVehicles.length}/{vehicles.length}
              </span>
            </div>

            {/* Nested Units */}
            {isGroupOpen && (
              <div className="pl-3 space-y-1 mt-1 border-l border-[#293a50]/60 ml-3">
                {filteredVehicles.map(vehicle => {
                  const isSelected = vehicle.id === selectedVehicleId || vehicle.unitNumber === selectedVehicleId;
                  
                  let statusColor = '#6b7280';
                  let statusLabel = vehicle.statusText;
                  
                  if (vehicle.status === 'moving') {
                    statusColor = '#ff9100';
                    statusLabel = `En ruta - ${vehicle.speed} km/h`;
                  } else if (vehicle.status === 'stopped') {
                    statusColor = '#ef4444';
                    statusLabel = vehicle.statusText;
                  } else if (vehicle.status === 'online') {
                    statusColor = '#fbbf24';
                    statusLabel = 'En Línea - Idle';
                  } else if (vehicle.status === 'offline') {
                    statusColor = '#6b7280';
                    statusLabel = vehicle.statusText;
                  }

                  return (
                    <div
                      key={vehicle.id}
                      onClick={() => {
                        onSelectVehicle(vehicle);
                        onClose();
                      }}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#00d1ff]/15 border border-[#00d1ff]/40 shadow-[0_0_12px_rgba(0,209,255,0.15)]'
                          : 'hover:bg-slate-800/50 border border-transparent'
                      } ${vehicle.status === 'offline' ? 'opacity-70' : ''}`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="relative flex-shrink-0">
                          <Bus
                            className="w-5 h-5"
                            style={{ color: statusColor }}
                          />
                          <div
                            className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#000f20]"
                            style={{ backgroundColor: statusColor }}
                          />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className={`font-mono text-xs truncate ${
                            isSelected ? 'text-white font-bold' : 'text-slate-200'
                          }`}>
                            {vehicle.unitNumber}
                          </span>
                          <span
                            className="text-[10px] truncate leading-tight font-medium"
                            style={{ color: statusColor }}
                          >
                            {statusLabel}
                          </span>
                        </div>
                      </div>

                      {/* Quick Action buttons on item */}
                      <div className="flex items-center space-x-1 ml-1 flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectVehicle(vehicle);
                            onClose();
                          }}
                          className="p-1.5 text-[#00d1ff] bg-[#00d1ff]/10 hover:bg-[#00d1ff]/20 rounded transition-colors"
                          title="Ubicar en mapa"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenVideo(vehicle);
                            onClose();
                          }}
                          className="p-1.5 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded transition-colors"
                          title="Ver video en vivo"
                        >
                          <Video className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {filteredVehicles.length === 0 && (
                  <div className="text-center py-6 text-slate-500 text-xs font-mono">
                    No se encontraron unidades
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
};