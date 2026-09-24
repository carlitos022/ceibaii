import React from 'react';
import { Vehicle } from '../types';
import { X, Video } from 'lucide-react';

interface UnitInfoSheetProps {
  vehicle: Vehicle | null;
  onClose: () => void;
  onOpenVideo: () => void;
  onOpenDetail: () => void;
  onOpenGeocercas: () => void;
  onOpenDescargar: () => void;
  onOpenAlertas: () => void;
  onOpenTracker?: () => void;
}

export const UnitInfoSheet: React.FC<UnitInfoSheetProps> = ({
  vehicle,
  onClose,
  onOpenVideo,
  onOpenDetail,
  onOpenGeocercas,
  onOpenDescargar,
  onOpenAlertas,
  onOpenTracker
}) => {
  if (!vehicle) return null;

  return (
    <div
      id="info-panel"
      className="fixed left-3 right-3 sm:left-4 sm:right-4 bottom-20 z-40 bg-[#000f20]/95 backdrop-blur-xl border border-[#293a50]/80 shadow-2xl rounded-2xl flex flex-col transform transition-all duration-300 ease-out animate-in fade-in slide-in-from-bottom-4 select-none max-w-lg mx-auto"
    >
      {/* Floating Video Button */}
      <button
        onClick={onOpenVideo}
        className="absolute right-3 -top-14 z-50 w-14 h-14 bg-emerald-500 hover:bg-emerald-400 text-white rounded-full shadow-[0_0_20px_rgba(34,197,94,0.45)] flex flex-col items-center justify-center hover:scale-105 active:scale-95 transition-all duration-300 border-2 border-[#000f20]/60 cursor-pointer"
        id="floating-cam-btn"
        aria-label="Ver video en vivo de las cámaras MDVR"
      >
        <Video className="w-6 h-6 animate-pulse" />
        <span className="text-[9px] font-bold mt-0.5 uppercase tracking-wider">
          Video
        </span>
      </button>

      <div className="p-3.5 flex flex-col space-y-2">
        {/* Drag / Dismiss Pill */}
        <div 
          onClick={onClose}
          className="w-12 h-1 bg-slate-600/70 hover:bg-[#00d1ff] rounded-full mx-auto mb-1 cursor-pointer transition-colors"
          title="Toca para cerrar panel" 
        />

        {/* Header Row */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <div className="text-xl sm:text-2xl font-bold text-white tracking-tight font-mono">
              {vehicle.unitNumber}
            </div>
            <div className="flex items-center space-x-2 mt-0.5">
              <span
                className="w-2 h-2 rounded-full shadow-[0_0_5px_rgba(255,145,0,0.5)]"
                style={{
                  backgroundColor:
                    vehicle.status === 'moving'
                      ? '#ff9100'
                      : vehicle.status === 'stopped'
                      ? '#ef4444'
                      : vehicle.status === 'online'
                      ? '#fbbf24'
                      : '#6b7280'
                }}
              />
              <span
                className="text-xs font-medium"
                style={{
                  color:
                    vehicle.status === 'moving'
                      ? '#ff9100'
                      : vehicle.status === 'stopped'
                      ? '#ef4444'
                      : vehicle.status === 'online'
                      ? '#fbbf24'
                      : '#94a3b8'
                }}
              >
                {vehicle.statusText}
              </span>
            </div>
            <div className="text-[10px] font-mono text-[#00d1ff]/90 mt-0.5 tracking-tight">
              {vehicle.lat.toFixed(5)}, {vehicle.lng.toFixed(5)}
            </div>
          </div>

          <div className="text-right flex flex-col items-end">
            <button
              onClick={onClose}
              className="p-1.5 -mr-1.5 -mt-1 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              aria-label="Cerrar panel de información"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mt-1">
              GPS
            </div>
            <div className="text-xs text-[#00d1ff] font-medium font-mono">
              {vehicle.relativeTime}
            </div>
          </div>
        </div>

        {/* 2x2 Telemetry Grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs border-t border-[#293a50]/50 pt-2.5">
          <div className="flex flex-col">
            <span className="text-slate-400 text-[11px]">Fecha y Hora</span>
            <span className="text-slate-200 font-mono text-xs">{vehicle.lastUpdate}</span>
          </div>

          <div className="flex flex-col">
            <span className="text-slate-400 text-[11px]">Velocidad</span>
            <span className="text-slate-100 font-bold font-mono text-xs">
              {vehicle.speed} km/h
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-slate-400 text-[11px]">Geocerca</span>
            <span className="text-slate-200 truncate font-mono text-xs">
              {vehicle.geofence || 'Sin geocerca'}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-slate-400 text-[11px]">Cámaras</span>
            <span className="text-emerald-400 font-medium font-mono text-xs">
              {vehicle.camerasOnline}
            </span>
          </div>
        </div>

        {/* Action Buttons Grid */}
        <div className="grid grid-cols-4 gap-2 pt-2">
          {onOpenTracker ? (
            <button
              onClick={onOpenTracker}
              className="bg-[#00d1ff]/15 border border-[#00d1ff]/40 py-2 rounded-lg text-[10px] font-bold text-[#00d1ff] hover:bg-[#00d1ff] hover:text-black transition-all uppercase tracking-wider font-mono cursor-pointer active:scale-95 text-center shadow-[0_0_8px_rgba(0,209,255,0.2)]"
            >
              Centro Hist.
            </button>
          ) : (
            <button
              onClick={onOpenDetail}
              className="bg-[#00d1ff]/10 border border-[#00d1ff]/30 py-2 rounded-lg text-[10px] font-bold text-[#00d1ff] hover:bg-[#00d1ff] hover:text-black transition-all uppercase tracking-wider font-mono cursor-pointer active:scale-95 text-center"
            >
              Detalle
            </button>
          )}

          <button
            onClick={onOpenDetail}
            className="bg-slate-800/60 border border-[#293a50] py-2 rounded-lg text-[10px] font-bold text-white hover:bg-slate-700 transition-all uppercase tracking-wider font-mono cursor-pointer active:scale-95 text-center"
          >
            Detalle
          </button>

          <button
            onClick={onOpenGeocercas}
            className="bg-slate-800/60 border border-[#293a50] py-2 rounded-lg text-[10px] font-bold text-white hover:bg-slate-700 transition-all uppercase tracking-wider font-mono cursor-pointer active:scale-95 text-center"
          >
            Geocercas
          </button>

          <button
            onClick={onOpenDescargar}
            className="bg-slate-800/60 border border-[#293a50] py-2 rounded-lg text-[10px] font-bold text-white hover:bg-slate-700 transition-all uppercase tracking-wider font-mono cursor-pointer active:scale-95 text-center"
          >
            Descargar
          </button>
        </div>
      </div>
    </div>
  );
};
