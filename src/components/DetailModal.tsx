import React from 'react';
import { Vehicle } from '../types';
import { X, Cpu, Gauge, Fuel, BatteryCharging, User, Phone, MapPin, Radio, ShieldCheck, Activity } from 'lucide-react';

interface DetailModalProps {
  vehicle: Vehicle | null;
  onClose: () => void;
  onOpenVideo: () => void;
}

export const DetailModal: React.FC<DetailModalProps> = ({
  vehicle,
  onClose,
  onOpenVideo
}) => {
  if (!vehicle) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none">
      <div className="bg-[#000f20] border border-[#293a50] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#293a50] bg-[#011428]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#00d1ff]/10 border border-[#00d1ff]/30 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-[#00d1ff]" />
            </div>
            <div>
              <h2 className="font-mono font-bold text-white text-base leading-tight">
                Detalle Telemático: {vehicle.unitNumber}
              </h2>
              <span className="text-[10px] text-slate-400 font-mono">
                Placa: {vehicle.plate} • MDVR: {vehicle.mdvrId || 'Sin dato'}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800/60 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto custom-scrollbar space-y-4 text-xs">
          {/* Status Banner */}
          <div className="p-3 rounded-xl bg-[#011428] border border-[#293a50] flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Activity className={`w-5 h-5 ${vehicle.status === 'offline' ? 'text-slate-500' : 'text-emerald-400'}`} />
                {vehicle.status !== 'offline' && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full animate-ping" />}
              </div>
              <div>
                <div className="text-white font-bold font-mono text-sm">{vehicle.statusText}</div>
                <div className="text-slate-400 text-[10px] font-mono">Último reporte: {vehicle.lastUpdate}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[#00d1ff] font-bold font-mono text-base">{vehicle.speed} km/h</div>
              <div className="text-[10px] text-slate-400 font-mono">{vehicle.camerasOnline}</div>
            </div>
          </div>

          {/* Telemetry Metrics Grid */}
          <div>
            <h3 className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2 flex items-center space-x-1.5">
              <Gauge className="w-4 h-4 text-[#00d1ff]" />
              <span>Sensores & Diagnóstico OBD-II</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-[#293a50]/60">
                <span className="text-slate-400 text-[10px] block">Odómetro Total</span>
                <span className="text-white font-mono font-semibold text-xs">
                  {vehicle.mileageKm == null ? 'Sin dato' : `${vehicle.mileageKm.toLocaleString()} km`}
                </span>
              </div>

              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-[#293a50]/60">
                <span className="text-slate-400 text-[10px] block flex items-center space-x-1">
                  <Fuel className="w-3 h-3 text-amber-400" />
                  <span>Combustible</span>
                </span>
                <span className="text-white font-mono font-semibold text-xs">
                  {vehicle.fuelLevelPct == null ? 'Sin dato' : `${vehicle.fuelLevelPct}%`}
                </span>
              </div>

              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-[#293a50]/60">
                <span className="text-slate-400 text-[10px] block flex items-center space-x-1">
                  <BatteryCharging className="w-3 h-3 text-emerald-400" />
                  <span>Batería</span>
                </span>
                <span className="text-white font-mono font-semibold text-xs">
                  {vehicle.batteryVolts == null ? 'Sin dato' : `${vehicle.batteryVolts} V`}
                </span>
              </div>

              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-[#293a50]/60">
                <span className="text-slate-400 text-[10px] block">Temp. Motor</span>
                <span className="text-white font-mono font-semibold text-xs">
                  {vehicle.engineTempC == null ? 'Sin dato' : `${vehicle.engineTempC} °C`}
                </span>
              </div>

              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-[#293a50]/60">
                <span className="text-slate-400 text-[10px] block">Altitud GPS</span>
                <span className="text-white font-mono font-semibold text-xs">
                  {vehicle.altitudeMeters == null ? 'Sin dato' : `${vehicle.altitudeMeters} msnm`}
                </span>
              </div>

              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-[#293a50]/60">
                <span className="text-slate-400 text-[10px] block flex items-center space-x-1">
                  <Radio className="w-3 h-3 text-[#00d1ff]" />
                  <span>Satélites</span>
                </span>
                <span className="text-white font-mono font-semibold text-xs">
                  {vehicle.satellites == null ? 'Sin dato' : `${vehicle.satellites} fijados`}
                </span>
              </div>
            </div>
          </div>

          {/* Driver & Assignment Info */}
          <div>
            <h3 className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2 flex items-center space-x-1.5">
              <User className="w-4 h-4 text-[#00d1ff]" />
              <span>Conductor & Despacho</span>
            </h3>
            <div className="bg-slate-900/80 p-3 rounded-lg border border-[#293a50]/60 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Conductor Asignado:</span>
                <span className="text-white font-medium font-mono">{vehicle.driverName || 'No asignado'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 flex items-center space-x-1">
                  <Phone className="w-3 h-3 text-slate-400" />
                  <span>Teléfono Contacto:</span>
                </span>
                <span className="text-[#00d1ff] font-mono">{vehicle.driverPhone || 'Sin dato'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 flex items-center space-x-1">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  <span>Grupo:</span>
                </span>
                <span className="text-white font-mono">{vehicle.route}</span>
              </div>
            </div>
          </div>

          {/* Hardware & Ceiba II Network Specs */}
          <div>
            <h3 className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2 flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Conectividad Ceiba II & MDVR</span>
            </h3>
            <div className="bg-slate-900/80 p-3 rounded-lg border border-[#293a50]/60 space-y-1.5 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400">Modelo Hardware:</span>
                <span className="text-slate-200">{vehicle.deviceModel || 'Sin dato'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Dirección IP MDVR:</span>
                <span className="text-slate-200">{vehicle.ipAddress || 'Sin dato'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">SIM 4G IMSI:</span>
                <span className="text-slate-200">{vehicle.simCard || 'Sin dato'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-[#293a50] bg-[#011428] flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white font-mono text-xs cursor-pointer"
          >
            Cerrar
          </button>
          <button
            onClick={() => {
              onClose();
              onOpenVideo();
            }}
            className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-mono text-xs font-bold transition-all shadow-[0_0_12px_rgba(34,197,94,0.3)] cursor-pointer"
          >
            Ver Video en Vivo
          </button>
        </div>
      </div>
    </div>
  );
};