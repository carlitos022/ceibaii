import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Building2, BusFront, ChevronDown, Crosshair, Layers3, MapPin, Search, X, Plus, Minus, Bell } from 'lucide-react';
import { Vehicle } from '../types';

interface Props {
  vehicles: Vehicle[];
  onOpenVehicle: (vehicle: Vehicle) => void;
  token: string | null;
}

const ECUADOR: [number, number] = [-1.65, -78.4];
const validPosition = (vehicle: Vehicle): vehicle is Vehicle & { lat: number; lng: number } =>
  typeof vehicle.lat === 'number' && typeof vehicle.lng === 'number' &&
  Number.isFinite(vehicle.lat) && Number.isFinite(vehicle.lng) &&
  Math.abs(vehicle.lat) <= 90 && Math.abs(vehicle.lng) <= 180 && (vehicle.lat !== 0 || vehicle.lng !== 0);

const colorFor = (vehicle: Vehicle) =>
  vehicle.status === 'moving' ? '#22c55e' :
  vehicle.status === 'stopped' ? '#ef4444' :
  vehicle.status === 'online' ? '#38bdf8' : '#64748b';

const formatEcuadorDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: true
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value || '';
  const period = part('dayPeriod').toLowerCase().replace(/\./g, '');
  return `${part('year')}-${part('month')}-${part('day')} a las ${part('hour')}:${part('minute')} ${period} Ecuador`;
};

export const RastreoView: React.FC<Props> = ({ vehicles, onOpenVehicle, token }) => {
  const mapElement = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);
  const vehicleMarkers = useRef(new Map<string, { marker: L.Marker; iconKey: string }>());
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [isListOpen, setIsListOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [satellite, setSatellite] = useState(false);
  const [showFleet, setShowFleet] = useState(false);
  type GeoEvent = { id: number; unit_number: string; event_type: string; title: string; description: string; event_time: string };
  const [geoEvents, setGeoEvents] = useState<GeoEvent[]>([]);
  const [alertCount, setAlertCount] = useState(0);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState('');
  const [hasMoreAlerts, setHasMoreAlerts] = useState(false);

  const selectedUnit = vehicles.find(v => v.id === selectedId)?.unitNumber || '';
  useEffect(() => {
    if (!token) return;
    let active = true;
    const refresh = async () => {
      try {
        const params = new URLSearchParams({ kind: 'geofence', count: '1' });
        if (selectedUnit) params.set('unit', selectedUnit);
        const response = await fetch('/api/tracker/events?' + params, { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' });
        if (!response.ok) throw new Error('No se pudieron consultar alertas');
        const data = await response.json();
        if (active) setAlertCount(Number(data.total) || 0);
      } catch { if (active) setAlertCount(0); }
    };
    void refresh();
    const interval = window.setInterval(refresh, 15000);
    return () => { active = false; window.clearInterval(interval); };
  }, [token, selectedUnit]);
  useEffect(() => { setGeoEvents([]); setHasMoreAlerts(false); }, [selectedUnit]);
  useEffect(() => {
    if (!alertsOpen) return;
    const interval = window.setInterval(() => { void loadGeoAlerts(); }, 15000);
    return () => window.clearInterval(interval);
  }, [alertsOpen, selectedUnit, token]);
  async function loadGeoAlerts(beforeId?: number) {
    if (!token) return;
    setAlertsLoading(true); setAlertsError('');
    try {
      const params = new URLSearchParams({ kind: 'geofence', limit: '100' });
      if (selectedUnit) params.set('unit', selectedUnit);
      if (beforeId) params.set('beforeId', String(beforeId));
      const response = await fetch('/api/tracker/events?' + params, { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' });
      if (!response.ok) throw new Error('No se pudo cargar el historial de geocercas');
      const rows: GeoEvent[] = await response.json();
      setGeoEvents(previous => beforeId ? [...previous, ...rows] : rows);
      setHasMoreAlerts(rows.length === 100);
    } catch (error: any) { setAlertsError(error.message || 'Error de conexion'); }
    finally { setAlertsLoading(false); }
  }

  const located = useMemo(() => vehicles.filter(validPosition), [vehicles]);
  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const matches = query ? vehicles.filter(vehicle =>
      [vehicle.unitNumber, vehicle.plate, vehicle.route, vehicle.driverName]
        .some(value => value?.toLocaleLowerCase().includes(query))) : vehicles;
    return [...matches].sort((a, b) => Number(a.status === 'offline') - Number(b.status === 'offline') || a.unitNumber.localeCompare(b.unitNumber, 'es', { numeric: true }));
  }, [vehicles, search]);

  useEffect(() => {
    if (!mapElement.current || map.current) return;
    const instance = L.map(mapElement.current, {
      center: ECUADOR, zoom: 6, zoomControl: false, attributionControl: true
    });
    markers.current = L.layerGroup().addTo(instance);
    map.current = instance;
    const resize = () => instance.invalidateSize();
    const timer = window.setTimeout(resize, 100);
    window.addEventListener('resize', resize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', resize);
      instance.remove();
      map.current = null;
      markers.current = null;
      vehicleMarkers.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!map.current) return;
    const layer = L.tileLayer(
      satellite
        ? 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
        : 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
      { subdomains: ['mt0', 'mt1', 'mt2', 'mt3'], maxZoom: 20, attribution: '&copy; Google Maps' }
    ).addTo(map.current);
    return () => { layer.remove(); };
  }, [satellite]);

  const makeIcon = (color: string, rotation: number) => L.divIcon({
    className: 'rastreo-vehicle-marker',
    html: '<div class="rastreo-bus" style="--bus-color:' + color + '">' +
      '<div class="rastreo-bus__body" style="transform:rotate(' + rotation + 'deg)">' +
      '<svg viewBox="0 0 32 44" width="25" height="34" aria-hidden="true">' +
      '<path d="M9 2h14c4 0 6 3 6 7v27c0 4-3 6-6 6H9c-3 0-6-2-6-6V9c0-4 2-7 6-7Z" fill="currentColor" stroke="#fff" stroke-width="2"/>' +
      '<path d="M7 11c0-2 1-3 3-3h12c2 0 3 1 3 3v8H7Z" fill="#dff7ff"/>' +
      '<path d="M8 25h16v9H8Z" fill="#113447" opacity=".6"/>' +
      '<circle cx="9" cy="37" r="2" fill="#fef3c7"/><circle cx="23" cy="37" r="2" fill="#fef3c7"/>' +
      '</svg></div></div>',
    iconSize: [38, 48], iconAnchor: [19, 24]
  });

  useEffect(() => {
    if (!markers.current) return;
    const shown = showFleet ? located : located.filter(vehicle => vehicle.id === selectedId);
    const visibleIds = new Set(shown.map(vehicle => vehicle.id));
    for (const [id, entry] of vehicleMarkers.current) {
      if (!visibleIds.has(id)) {
        markers.current.removeLayer(entry.marker);
        vehicleMarkers.current.delete(id);
      }
    }
    for (const vehicle of shown) {
      const color = colorFor(vehicle);
      const rotation = Number.isFinite(vehicle.heading) ? Math.round(vehicle.heading / 5) * 5 : 0;
      const iconKey = color + ':' + rotation;
      const existing = vehicleMarkers.current.get(vehicle.id);
      if (existing) {
        existing.marker.setLatLng([vehicle.lat, vehicle.lng]);
        if (existing.iconKey !== iconKey) {
          existing.marker.setIcon(makeIcon(color, rotation));
          existing.iconKey = iconKey;
        }
        continue;
      }
      const marker = L.marker([vehicle.lat, vehicle.lng], { icon: makeIcon(color, rotation) }).addTo(markers.current);
      vehicleMarkers.current.set(vehicle.id, { marker, iconKey });
      marker.on('click', () => {
        setSelectedId(vehicle.id);
        setIsListOpen(false);
      });
    }
  }, [located, showFleet, selectedId]);

  const focus = (vehicle: Vehicle) => {
    setSelectedId(vehicle.id);
    setShowFleet(false);
    setIsSelectorOpen(false);
    setIsListOpen(false);
    if (validPosition(vehicle)) map.current?.flyTo([vehicle.lat, vehicle.lng], 16, { duration: 0.6 });
  };

  const focusFleet = () => {
    setShowFleet(true);
    setSelectedId(null);
    if (!map.current) return;
    if (located.length) {
      map.current.fitBounds(L.latLngBounds(located.map(v => [v.lat, v.lng] as [number, number])), {
        padding: [48, 48], maxZoom: 14
      });
    } else map.current.setView(ECUADOR, 6);
  };

  const selected = vehicles.find(v => v.id === selectedId);

  return (
    <section className="relative isolate w-full h-full overflow-hidden bg-[#e9eef1] text-slate-900" aria-label="Rastreo GPS">
      <div ref={mapElement} className="absolute top-14 bottom-16 left-0 right-0 z-0" />
      <style>{`.rastreo-vehicle-marker {transition:transform .65s linear}.rastreo-bus {width:38px;height:46px;display:grid;place-items:center;filter:drop-shadow(0 3px 5px #0b2c4055);animation:bus-enter .4s ease-out both}.rastreo-bus__body {width:32px;height:42px;display:grid;place-items:center;color:var(--bus-color);transition:transform .6s ease}@keyframes bus-enter {from{opacity:0;scale:.75}to{opacity:1;scale:1}}`}</style>
      <div className="absolute top-[68px] left-3 right-3 sm:right-auto sm:w-[360px] flex gap-2" style={{ zIndex: 1000 }}>
        <button type="button" onClick={() => { setIsSelectorOpen(true); setIsListOpen(false); }}
          className="flex-1 min-w-0 flex items-center justify-between gap-2 rounded-2xl bg-[#061d2b]/95 text-white px-4 py-3 shadow-xl border border-cyan-500/30">
          <span className="flex items-center gap-2 truncate"><Building2 size={19} className="text-cyan-400 shrink-0" /><b className="truncate">Mis unidades</b></span>
          <ChevronDown size={18} />
        </button>
      </div>
      <div className="absolute right-3 top-36 flex flex-col gap-2" style={{ zIndex: 1000 }}>
        <button type="button" onClick={() => { setAlertsOpen(true); void loadGeoAlerts(); }} aria-label="Alertas de geocercas" className="relative w-11 h-11 rounded-xl bg-[#061d2b] text-cyan-200 shadow-lg grid place-items-center border border-cyan-500/40"><Bell size={20} />{alertCount > 0 && <span className="absolute -top-1 -right-1 min-w-4 rounded-full bg-amber-400 px-1 text-[10px] font-bold text-[#061d2b]">{alertCount > 99 ? '99+' : alertCount}</span>}</button>
        <button type="button" onClick={() => setSatellite(v => !v)} aria-label="Cambiar capa del mapa"
          className="w-11 h-11 rounded-xl bg-white shadow-lg grid place-items-center text-slate-700"><Layers3 size={21} /></button>
        <button type="button" disabled title="Ubicación del teléfono: próximamente" aria-label="Ubicación del teléfono próximamente"
          className="w-11 h-11 rounded-xl bg-white/80 shadow-lg grid place-items-center text-slate-400 cursor-not-allowed"><Crosshair size={21} /></button>
        <button type="button" onClick={() => map.current?.zoomIn()} aria-label="Acercar mapa"
          className="w-11 h-11 rounded-xl bg-white shadow-lg grid place-items-center text-slate-700"><Plus size={21} /></button>
        <button type="button" onClick={() => map.current?.zoomOut()} aria-label="Alejar mapa"
          className="w-11 h-11 rounded-xl bg-white shadow-lg grid place-items-center text-slate-700"><Minus size={21} /></button>
      </div>
      {!alertsOpen && !selectedId && !isSelectorOpen && !isListOpen && createPortal(
        <button type="button" onClick={focusFleet} aria-label="Mostrar las unidades autorizadas en el mapa" title="Mostrar unidades"
          className="fixed right-3 w-11 h-11 rounded-xl bg-[#061d2b] text-cyan-300 shadow-lg grid place-items-center border border-cyan-500/40 active:scale-95 transition-transform"
          style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px) + 12px)', zIndex: 1100 }}>
          <BusFront size={21} aria-hidden="true" />
        </button>, document.body
      )}
      {!alertsOpen && selected && !isListOpen && !isSelectorOpen && createPortal(
        <div className="fixed left-3 right-3 sm:max-w-sm rounded-2xl bg-[#061d2b] text-white shadow-xl p-4 border border-cyan-500/30"
          style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px) + 12px)', zIndex: 1100 }}>
          <div className="flex justify-between gap-2"><b>{selected.unitNumber}</b><button onClick={() => setSelectedId(null)} aria-label="Cerrar"><X size={18} /></button></div>
          <p className="text-sm text-slate-300 mt-1">{selected.plate} · {selected.statusText} · {selected.speed} km/h</p>
          <p className="text-xs text-slate-400 mt-1">Actualizado: {selected.relativeTime || selected.lastUpdate}</p>
          <button type="button" onClick={() => { setSelectedId(null); onOpenVehicle(selected); }} className="mt-3 text-sm font-semibold text-cyan-300">Ver detalles de la unidad →</button>
        </div>, document.body
      )}
      {(isSelectorOpen || isListOpen) && (
        <div className="absolute inset-0 bottom-16 flex flex-col justify-end sm:items-start bg-black/45" style={{ zIndex: 1200 }}
          onClick={() => { setIsSelectorOpen(false); setIsListOpen(false); }}>
          <div className="bg-[#f7f9fb] w-full sm:w-[420px] max-h-[78%] rounded-t-3xl sm:rounded-tr-3xl shadow-2xl overflow-hidden flex flex-col"
            onClick={event => event.stopPropagation()}>
            <div className="mx-auto mt-3 mb-2 w-12 h-1 rounded-full bg-slate-300" />
            <div className="px-4 pb-3 flex items-center gap-3">
              <h2 className="font-bold text-lg flex-1">{'Mis unidades'}</h2>
              <button type="button" onClick={() => { setIsSelectorOpen(false); setIsListOpen(false); }} aria-label="Cerrar panel"><X size={22} /></button>
            </div>
            {isSelectorOpen && (
              <button type="button" className="mx-4 mb-3 rounded-xl p-3 flex items-center gap-3 bg-[#d8f4e8] text-[#075d39] font-bold"
                onClick={() => { setIsSelectorOpen(false); setIsListOpen(true); }}>
                <Building2 size={22} /> Mis unidades <span className="ml-auto">{vehicles.length}</span>
              </button>
            )}
            <label className="mx-4 mb-3 flex items-center gap-2 rounded-xl border border-slate-300 px-3 bg-white">
              <Search size={19} className="text-slate-500" />
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar disco o placa"
                className="w-full py-3 bg-transparent outline-none text-sm" />
              {search && <button onClick={() => setSearch('')} aria-label="Limpiar búsqueda"><X size={18} /></button>}
            </label>
                <div className="overflow-y-auto px-4 pb-6 space-y-2">
                  {visible.map(vehicle => (
                    <button type="button" key={vehicle.id} onClick={() => focus(vehicle)}
                      className="w-full flex items-center gap-3 rounded-xl bg-white border border-slate-200 p-3 text-left">
                      <MapPin size={20} style={{ color: colorFor(vehicle) }} />
                      <span className="min-w-0 flex-1"><b className="block truncate text-sm">{vehicle.unitNumber} · {vehicle.plate}</b>
                        <small className="block truncate text-slate-500">{vehicle.status === 'offline' ? 'Apagada' : 'Encendida'} · {vehicle.statusText}</small></span>
                      <span className="text-xs text-slate-500">{vehicle.speed} km/h</span>
                    </button>
                  ))}
                  {!visible.length && <p className="text-center text-slate-500 py-8">No hay unidades para mostrar.</p>}
                </div>
          </div>
        </div>
      )}
      {alertsOpen && createPortal(
        <div className="fixed inset-0 z-[1300] flex items-end justify-center bg-black/70" onClick={() => setAlertsOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Alertas de geocercas" onClick={event => event.stopPropagation()}
            className="w-full max-w-2xl max-h-[80dvh] flex flex-col rounded-t-3xl border border-[#34546a] bg-[#102337] text-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-[#34546a] p-4">
              <div><h2 className="font-bold text-lg">Alertas de geocercas</h2><p className="text-xs text-slate-300">{selectedUnit || 'Todas mis unidades'} · {alertCount} eventos guardados</p></div>
              <button aria-label="Cerrar alertas" onClick={() => setAlertsOpen(false)}><X size={22} /></button>
            </div>
            <div className="overflow-y-auto p-3 space-y-2 pb-[max(20px,env(safe-area-inset-bottom))]">
              {alertsError && <p role="alert" className="p-3 text-rose-300">{alertsError}</p>}
              {!geoEvents.length && !alertsLoading && !alertsError && <p className="p-4 text-sm text-slate-300">Aun no hay entradas o salidas de geocercas guardadas para esta seleccion.</p>}
              {geoEvents.map(event => <article key={event.id} className="rounded-xl border border-[#34546a] bg-[#071626] p-3">
                <p className="font-semibold text-sm text-cyan-200">{event.event_type === 'geofence_entry' ? 'Entrada' : 'Salida'} · {event.unit_number}</p>
                <p className="mt-1 text-sm">{event.title}</p>
                <p className="mt-1 text-xs text-slate-300">{event.description}</p>
                <time className="mt-2 block text-xs text-amber-200">{formatEcuadorDateTime(event.event_time)}</time>
              </article>)}
              {hasMoreAlerts && <button disabled={alertsLoading} onClick={() => void loadGeoAlerts(geoEvents[geoEvents.length - 1]?.id)}
                className="w-full rounded-xl border border-cyan-600 p-3 text-sm text-cyan-200 disabled:opacity-50">Cargar eventos anteriores</button>}
              {alertsLoading && <p className="p-3 text-center text-xs text-slate-300">Cargando eventos…</p>}
            </div>
          </div>
        </div>, document.body
      )}
    </section>
  );
};