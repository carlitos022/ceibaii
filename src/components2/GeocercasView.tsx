import React, { useState, useEffect } from 'react';
import { Geofence } from '../types';
import { Navigation, Layers, Compass, Radio, AlertCircle } from 'lucide-react';

interface GeocercasViewProps {
  geofences: Geofence[];
  onFocusGeofence: (geo: Geofence) => void;
}

function formatGeocercaEvento(row: any): string {
  const punto = row.nombrePunto || row.FenceCode || 'geocerca';
  const tipo = row.tipoEvento || row.EventType === 0 ? 'ENTRO' : row.EventType === 1 ? 'SALIO' : (row.tipo || '');
  const lugar = row.FenceCode || punto;
  // Fecha y hora real
  let fechaStr = row.fecha || row.EventTime || '';
  let horaStr = row.llego || row.EventTime || '';
  let d: Date | null = null;
  if (fechaStr && horaStr && String(horaStr).includes(':')) {
    // vueltas: fecha + llego separado
    d = new Date(`${String(fechaStr).split('T')[0]} ${String(horaStr)}`);
  } else if (row.EventTime) {
    d = new Date(row.EventTime);
  } else if (row.fecha) {
    d = new Date(row.fecha);
    if (row.llego) d = new Date(`${String(row.fecha).split('T')[0]} ${row.llego}`);
  }
  if (d && !isNaN(d.getTime())) {
    const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sept','oct','nov','dic'];
    const day = String(d.getDate()).padStart(2,'0');
    const mon = meses[d.getMonth()];
    const year = d.getFullYear();
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2,'0');
    const ampm = h >= 12 ? 'pm' : 'am';
    const h12 = h % 12 || 12;
    const accion = tipo === 'ENTRO' ? 'entró a' : tipo === 'SALIO' ? 'salió de' : tipo.toLowerCase();
    return `${accion} ${lugar} a las ${String(h12).padStart(2,'0')}:${m} ${ampm} con fecha ${day}-${mon}-${year}`;
  }
  return `${tipo} ${lugar}`;
}

export const GeocercasView: React.FC<GeocercasViewProps> = ({ geofences: propGeofences, onFocusGeofence }) => {
  const [realFences, setRealFences] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realEvents, setRealEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

    // Fetch real fences from miritrans (coopcariamanga) via ceiba2-web proxy
  useEffect(() => {
    const token = (() => { try { const s = localStorage.getItem('csrs_auth'); if (s) return JSON.parse(s).token; } catch {} return null; })();
    const headers: Record<string, string> = token ? { Authorization: 'Bearer ' + token } : {};
    // Try miritrans ceiba fences first (44 real), fallback to puntos
    Promise.all([
      fetch('/api/ceiba/fences', { headers }).then(r => r.json()).catch(() => null),
      fetch('/api/v1/puntos', { headers }).then(r => r.json()).catch(() => null),
    ]).then(([ceiba, puntos]) => {
      let fences: any[] = [];
      if (ceiba && Array.isArray(ceiba) && ceiba.length > 0) {
        fences = ceiba.map((f: any) => ({
          id: String(f.FenceID),
          name: f.FenceCode,
          type: f.FenceType === 2 ? 'corridor' : 'terminal',
          typeLabel: f.FenceType === 2 ? 'Corredor' : 'Terminal Terrestre',
          center: f.KeyPoints ? f.KeyPoints.split(',').map((n: string) => parseFloat(n.trim())) as [number, number] : [0, 0],
          coordinates: f.KeyPoints ? [f.KeyPoints.split(',').map((n: string) => parseFloat(n.trim()))] as [number, number][] : [],
          radiusMeters: f.Radius || 250,
          speedLimitKmH: f.FenceType === 2 ? 60 : 20,
          activeUnitsCount: 0,
          alertOnEntry: true,
          alertOnExit: true,
          color: f.FenceType === 2 ? '#3b82f6' : '#f59e0b',
          raw: f,
        }));
      } else if (puntos && Array.isArray(puntos) && puntos.length > 0) {
        const arr = Array.isArray(puntos) ? puntos : (puntos as any).result || [];
        fences = (arr as any[]).map((p: any) => ({
          id: String(p.idPunto || p.FenceID),
          name: p.nombrePunto || p.FenceCode,
          type: 'terminal',
          typeLabel: 'Terminal Terrestre',
          center: [parseFloat(p.latitud || p.KeyPoints?.split(',')[0] || 0), parseFloat(p.longitud || p.KeyPoints?.split(',')[1] || 0)] as [number, number],
          coordinates: [],
          radiusMeters: parseInt(p.radio_geocerca || p.Radius) || 250,
          speedLimitKmH: 20,
          activeUnitsCount: 0,
          alertOnEntry: true,
          alertOnExit: true,
          color: '#f59e0b',
          raw: p,
        }));
      }
      if (fences.length > 0) setRealFences(fences);
      else setRealFences([]);
      setIsLoading(false);
    }).catch((e) => {
      setError(e.message);
      setIsLoading(false);
    });
    // Fetch real geofence events (últimos movimientos) for tarjetas con hora/fecha
    const fetchEvents = () => {
      fetch('/api/v1/registrosvueltas/detalle?page=1&pageSize=20', { headers }).then(r=>r.json()).then(j=>{
        const arr = j.data || j.result || (Array.isArray(j)?j:[]);
        setRealEvents(Array.isArray(arr)?arr.slice(0,12):[]);
        setEventsLoading(false);
      }).catch(()=> setEventsLoading(false));
    };
    fetchEvents();
    const evInterval = setInterval(fetchEvents, 10000);
    return () => clearInterval(evInterval);
  }, []);

  const displayFences = realFences.length > 0 ? realFences : propGeofences;

  // Convert real fence to Geofence type for onFocus
  const handleFocus = (f: any) => {
    if (f.raw) {
      // Convert to Geofence for MapView
      const geo: Geofence = {
        id: f.id,
        name: f.name,
        type: f.type,
        typeLabel: f.typeLabel,
        coordinates: f.center ? [[f.center[0] - 0.001, f.center[1] - 0.001], [f.center[0] - 0.001, f.center[1] + 0.001], [f.center[0] + 0.001, f.center[1] + 0.001], [f.center[0] + 0.001, f.center[1] - 0.001]] : [],
        center: f.center,
        radiusMeters: f.radiusMeters,
        speedLimitKmH: f.speedLimitKmH,
        activeUnitsCount: f.activeUnitsCount,
        alertOnEntry: f.alertOnEntry,
        alertOnExit: f.alertOnExit,
        color: f.color,
      };
      onFocusGeofence(geo);
    } else {
      onFocusGeofence(f);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#000f20] overflow-hidden select-none pb-20 pt-16 px-4 max-w-4xl mx-auto w-full">
      <div className="mb-4 border-b border-[#293a50]/60 pb-3">
        <h1 className="text-xl font-bold text-white flex items-center space-x-2 font-mono">
          <Layers className="w-5 h-5 text-[#00d1ff]" />
          <span>Control de Geocercas & Terminales</span>
          {realFences.length > 0 && <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-900/30 text-emerald-400 border border-emerald-700">REAL {realFences.length} desde miritrans_data</span>}
        </h1>
        <p className="text-xs text-slate-400 font-mono mt-0.5">
          {isLoading ? 'Cargando geocercas reales desde coopcariamanga...' : `Perímetros circulares reales • ${displayFences.length} geocercas • Radio 70-250m • Sincronizado desde wcms4.fenceinfo`}
        </p>
        {error && (
          <div className="mt-2 p-2 rounded bg-amber-900/20 border border-amber-700 text-amber-300 text-xs font-mono flex items-center space-x-2">
            <AlertCircle className="w-4 h-4" />
            <span>Error cargando reales, mostrando mock: {error}</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1">
        {isLoading ? (
          <div className="text-center py-12 text-slate-500 font-mono text-xs flex flex-col items-center space-y-2">
            <Radio className="w-6 h-6 animate-pulse text-[#00d1ff]" />
            <span>Cargando 44 geocercas reales...</span>
          </div>
        ) : (
          displayFences.map((geo: any) => (
            <div key={geo.id} className="p-4 rounded-xl bg-[#011428] border border-[#293a50] hover:border-[#00d1ff]/50 transition-all shadow-lg">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className="p-2.5 rounded-lg border flex items-center justify-center mt-0.5" style={{ backgroundColor: `${geo.color}15`, borderColor: `${geo.color}40` }}>
                    <Compass className="w-5 h-5" style={{ color: geo.color }} />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-white font-bold font-mono text-sm">{geo.name}</h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border" style={{ backgroundColor: `${geo.color}15`, color: geo.color, borderColor: `${geo.color}30` }}>
                        {geo.typeLabel}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 mt-2 text-xs font-mono text-slate-300">
                      <div>
                        <span className="text-slate-500 text-[10px] block">Centro:</span>
                        <span className="text-white font-mono text-[11px]">{geo.center ? `${geo.center[0].toFixed(6)}, ${geo.center[1].toFixed(6)}` : '-'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] block">Radio:</span>
                        <span className="text-[#00d1ff] font-bold">{geo.radiusMeters || 250} m</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] block">ID:</span>
                        <span className="text-slate-300">{geo.id}</span>
                      </div>
                    </div>
                    {geo.raw && (
                      <div className="mt-1 text-[10px] font-mono text-slate-500">
                        Raw: {geo.raw.KeyPoints || `${geo.raw.latitud},${geo.raw.longitud}`} • FenceID:{geo.raw.FenceID || geo.raw.idPunto}
                      </div>
                    )}
                  </div>
                </div>
                <button onClick={() => handleFocus(geo)} className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-[#00d1ff]/10 hover:bg-[#00d1ff] hover:text-black border border-[#00d1ff]/30 text-[#00d1ff] text-xs font-mono transition-all cursor-pointer flex-shrink-0">
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Ver en Mapa</span>
                </button>
              </div>
            </div>
          ))
        )}
        {/* Últimos movimientos por geocerca con hora y fecha reales */}
        <div className="mt-4 p-3 rounded-xl bg-[#011428] border border-[#293a50]">
          <h3 className="text-sm font-bold text-white font-mono flex items-center space-x-2 mb-2">
            <Radio className="w-4 h-4 text-[#00d1ff]" />
            <span>Últimos movimientos por geocerca</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">{realEvents.length} eventos reales</span>
          </h3>
          {eventsLoading ? (
            <div className="text-center py-4 text-slate-500 font-mono text-xs">Cargando eventos reales...</div>
          ) : realEvents.length === 0 ? (
            <div className="text-center py-4 text-slate-500 font-mono text-xs">Sin movimientos recientes</div>
          ) : (
            <div className="space-y-2">
              {realEvents.map((ev:any, idx:number) => {
                const detalle = formatGeocercaEvento(ev);
                const unidad = ev.codigoBus || ev.codigoCompleto || ev.unitNumber || ev.DeviceID || '-';
                const isEntry = (ev.tipoEvento || ev.tipo || ev.EventType) === 'ENTRO' || ev.EventType === 0;
                return (
                  <div key={idx} className={`p-2.5 rounded-lg border flex items-start justify-between ${isEntry ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-orange-950/20 border-orange-800/40'}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isEntry ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700' : 'bg-orange-900/40 text-orange-300 border border-orange-700'}`}>{isEntry ? 'ENTRÓ' : 'SALIÓ'}</span>
                        <span className="text-white font-mono text-xs font-bold truncate">{unidad}</span>
                        <span className="text-slate-400 text-[11px] truncate">{ev.nombrePunto || ev.FenceCode || '-'}</span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-300 mt-1">{detalle}</div>
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">Unidad: {unidad} • Ruta: {ev.nombreRuta || '-'} • Hora Debe: {ev.horaDebeLlegar || ev.tiempoFijo || '-'} • Llegó: {ev.llego || ev.hora || '-'}</div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 ml-2 flex-shrink-0">{ev.fecha ? new Date(ev.fecha).toLocaleDateString() : ''}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};