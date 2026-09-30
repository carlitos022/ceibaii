import React from 'react';
import { createPortal } from 'react-dom';
import { Vehicle } from '../types';
import { X, Bus, Activity, Gauge, UserRound, ShieldCheck } from 'lucide-react';

interface Props { vehicle: Vehicle | null; onClose: () => void; onOpenVideo: () => void }
const available = (value: unknown): boolean => value != null && String(value).trim() !== '' && !/^(sin dato(s)?|sin ruta|no asignado|desconocido|n\/a)$/i.test(String(value).trim());
const numeric = (value: number | null | undefined, suffix: string) => value != null && Number.isFinite(value) ? String(value) + suffix : null;
export const DetailModal: React.FC<Props> = ({ vehicle, onClose, onOpenVideo }) => {
  if (!vehicle) return null;
  const metrics = [
    ['Odometro', numeric(vehicle.mileageKm, ' km')],
    ['Combustible', numeric(vehicle.fuelLevelPct, '%')],
    ['Bateria', numeric(vehicle.batteryVolts, ' V')],
    ['Temperatura del motor', numeric(vehicle.engineTempC, ' °C')],
    ['Altitud GPS', numeric(vehicle.altitudeMeters, ' msnm')],
    ['Satelites', numeric(vehicle.satellites, '')],
  ].filter(([, value]) => value != null);
  const assignment = [['Conductor', vehicle.driverName], ['Telefono', vehicle.driverPhone], ['Grupo', vehicle.route]].filter(([, value]) => available(value));
  const hardware = [['MDVR', vehicle.mdvrId], ['Modelo', vehicle.deviceModel], ['Direccion IP', vehicle.ipAddress], ['SIM', vehicle.simCard]].filter(([, value]) => available(value));
  const section = (title: string, Icon: typeof Gauge, rows: (string | null | undefined)[][]) => rows.length ? <section>
    <h3 className="flex gap-2 items-center text-xs text-slate-400 mb-2 uppercase tracking-wide"><Icon className="h-4 w-4 text-cyan-300" />{title}</h3>
    <dl className="grid grid-cols-2 gap-2">{rows.map(([label, value]) => <div key={label} className="rounded-xl bg-[#011428] border border-[#293a50] p-3 min-w-0"><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-1 text-sm font-medium text-white break-words">{value}</dd></div>)}</dl>
  </section> : null;
  return createPortal(<div className="fixed inset-0 z-[2000] bg-black/75 flex items-center justify-center p-3 sm:p-5" onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-label="Detalle de la unidad" className="w-full max-w-lg max-h-[calc(100dvh-1.5rem)] bg-[#071626] text-slate-200 rounded-2xl border border-[#34546a] overflow-hidden shadow-2xl flex flex-col" onClick={event => event.stopPropagation()}>
      <header className="p-4 border-b border-[#293a50] flex items-center gap-3">
        <div className="rounded-xl bg-cyan-400/10 p-2.5 text-cyan-300"><Bus className="w-5 h-5" /></div>
        <div className="min-w-0 flex-1"><p className="text-xs text-slate-400">Detalle de la unidad</p><h2 className="font-semibold text-base break-words">{vehicle.unitNumber}</h2>{available(vehicle.plate) && vehicle.plate !== vehicle.unitNumber && <p className="text-xs text-slate-400 mt-1">Placa: {vehicle.plate}</p>}</div>
        <button aria-label="Cerrar detalle" onClick={onClose} className="rounded-xl bg-slate-800/70 p-2"><X className="w-5 h-5" /></button>
      </header>
      <div className="overflow-y-auto min-h-0 p-4 space-y-4">
        <section className="rounded-xl border border-[#293a50] bg-[#011428] p-3">
          <div className="flex gap-2 items-start"><Activity className={`w-5 h-5 shrink-0 ${vehicle.status === 'offline' ? 'text-slate-400' : 'text-emerald-400'}`} /><div className="flex-1 min-w-0">{available(vehicle.statusText) && <p className="font-medium text-sm">{vehicle.statusText}</p>}{available(vehicle.lastUpdate) && <p className="text-xs text-slate-400 mt-1">Ultimo reporte: {vehicle.lastUpdate}</p>}</div></div>
          {vehicle.lastUpdate && Number.isFinite(vehicle.speed) && <p className="mt-3 text-xl font-semibold text-cyan-300">{vehicle.speed} <span className="text-xs font-normal text-slate-400">km/h</span></p>}
          {available(vehicle.camerasOnline) && <p className="mt-2 text-xs text-slate-400">{vehicle.camerasOnline}</p>}
        </section>
        {section('Sensores disponibles', Gauge, metrics)}
        {section('Asignacion', UserRound, assignment)}
        {section('Equipo', ShieldCheck, hardware)}
      </div>
      <footer className="p-3 border-t border-[#293a50] flex flex-wrap justify-end gap-2">
        <button onClick={onClose} className="rounded-xl bg-slate-800 px-4 py-3 text-sm">Cerrar</button>
        {vehicle.channels.length > 0 && <button onClick={() => { onClose(); onOpenVideo(); }} className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-[#001c18]">Ver Video en Vivo</button>}
      </footer>
    </div>
  </div>, document.body);
};
