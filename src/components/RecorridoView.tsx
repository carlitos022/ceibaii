import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Bus, CalendarDays, ChevronDown, Crosshair, Layers3, Minus, Pause, Play, Plus, RotateCcw, Search, SkipBack, SkipForward, ListFilter, Tag, Gauge, Power, Clock3, Maximize2, Minimize2, X } from 'lucide-react';
import { Vehicle } from '../types';
import { buildPlaybackTimeline, toPlaybackClock, fromPlaybackClock, PLAYBACK_BASE_RATE, advancePlayback, eventPosition, playbackPosition, pointIndex } from '../lib/recorrido-playback';

type Point = { time: string; stamp: number; lat: number; lng: number; speed: number | null; heading: number | null };
type History = { unitNumber: string; from: string; to: string; totalRecords: number; sampled: boolean; points: Point[] };
type RouteEvent = { id: number; unit_number: string; event_type: string; title: string; description: string; event_time: string; lat: number | null; lng: number | null; speed: number | null; meta?: string | { connection_state?: string } };
const eventLabel = (event: RouteEvent) => ({ connection_online: 'Unidad Encendida', connection_offline: 'Unidad Apagada', ignition_on: 'Ignicion encendida', ignition_off: 'Ignicion apagada', stopped: 'Parada', route_active: 'En movimiento', signal_lost: 'Sin senal', signal_recovered: 'Senal recuperada', geofence_entry: 'Entrada a geocerca', geofence_exit: 'Salida de geocerca' } as Record<string, string>)[event.event_type] || event.title || 'Evento';
const eventConnection = (event: RouteEvent) => {
  let meta: any = event.meta || {};
  if (typeof meta === 'string') { try { meta = JSON.parse(meta); } catch { meta = {}; } }
  if (meta.connection_state === 'online' || event.event_type === 'connection_online') return 'Encendido (en linea)';
  if (meta.connection_state === 'disconnected' || event.event_type === 'connection_offline') return 'Apagado (desconectado)';
  if (event.event_type === 'signal_lost') return 'Senal perdida';
  if (event.event_type === 'signal_recovered') return 'En linea';
  return 'Estado no registrado';
};
const eventStamp = (value: string) => { const stamp = Date.parse(String(value).replace(' ', 'T') + (/[zZ]|[+-]\d\d:\d\d$/.test(value) ? '' : '-05:00')); return Number.isFinite(stamp) ? stamp : 0; };
export type RecorridoSelection = { vehicleId: string; date: string; fromTime: string; toTime: string };
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const timeText = (stamp?: number) => stamp ? new Date(stamp).toLocaleTimeString('es-EC', { timeZone: 'America/Guayaquil', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '—';
const valid = (point: Point) => Number.isFinite(point.lat) && Number.isFinite(point.lng) && Number.isFinite(point.stamp);

export function RecorridoView({ vehicles, token, initialSelection, chromeHidden, onChromeHiddenChange }: { vehicles: Vehicle[]; token: string | null; initialSelection?: RecorridoSelection | null; chromeHidden?: boolean; onChromeHiddenChange?: (hidden: boolean) => void }) {
  const [vehicleId, setVehicleId] = useState(initialSelection?.vehicleId || '');
  const [fromDate, setFromDate] = useState(initialSelection?.date || today);
  const [toDate, setToDate] = useState(initialSelection?.date || today);
  const [fromTime, setFromTime] = useState(initialSelection?.fromTime || '00:00');
  const [toTime, setToTime] = useState(initialSelection?.toTime || '23:59');
  const [picker, setPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [history, setHistory] = useState<History | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [follow, setFollow] = useState(false);
  const [availability, setAvailability] = useState<{ vehicleId: string; date: string; count: number }[] | null>(null);
  const [satellite, setSatellite] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [events, setEvents] = useState<RouteEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState('');
  const [eventFilter, setEventFilter] = useState('all');
  const [eventFocus, setEventFocus] = useState<{ event: RouteEvent; lat: number; lng: number; exact: boolean } | null>(null);
  const requestId = useRef(0);
  const panelTouchY = useRef<number | null>(null);
  const mapElement = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const trackLayer = useRef<L.LayerGroup | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const playedRoute = useRef<L.Polyline | null>(null);
  const drawnIndex = useRef(-1);
  const lastDraw = useRef(0);
  const followRef = useRef(false);
  const lastPan = useRef(0);
  const sorted = useMemo(() => [...vehicles].sort((a, b) => a.unitNumber.localeCompare(b.unitNumber, 'es', { numeric: true })), [vehicles]);
  const currentVehicle = vehicles.find(v => v.id === vehicleId);
  const filtered = sorted.filter(v => [v.unitNumber, v.plate].some(s => s?.toLowerCase().includes(search.toLowerCase())));
  const dayCount = (id: string) => availability?.find(row => row.vehicleId === id && row.date === fromDate)?.count || 0;
  const recentDay = availability?.filter(row => row.vehicleId === vehicleId && row.count > 0).sort((a, b) => b.date.localeCompare(a.date))[0];
  useEffect(() => {
    if (!token || !fromDate) return;
    const controller = new AbortController();
    setAvailability(null);
    fetch('/api/recorrido/availability?date=' + encodeURIComponent(fromDate), { headers: { Authorization: 'Bearer ' + token }, signal: controller.signal, cache: 'no-store' })
      .then(async r => { if (!r.ok) throw new Error('Índice no disponible'); return r.json(); })
      .then(data => setAvailability(Array.isArray(data.days) ? data.days : null))
      .catch(() => { if (!controller.signal.aborted) setAvailability(null); });
    return () => controller.abort();
  }, [token, fromDate]);
  useEffect(() => { if (!vehicles.some(v => v.id === vehicleId)) { setVehicleId(sorted[0]?.id || ''); setHistory(null); setPlaying(false); } }, [vehicles, sorted, vehicleId]);
  const points = history?.points || [];
  const first = points[0]?.stamp || 0, last = points[points.length - 1]?.stamp || 0;
  const playbackTimeline = useMemo(() => buildPlaybackTimeline(points), [points]);
  const currentIndex = useMemo(() => pointIndex(points, cursor), [points, cursor]);
  const current = points[currentIndex];
  const eventTypes = useMemo(() => Array.from(new Set(events.map(event => event.event_type))), [events]);
  const filteredEvents = useMemo(() => events.filter(event => eventFilter === 'all' || event.event_type === eventFilter), [events, eventFilter]);
  const distance = useMemo(() => {
    let km = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const rad = Math.PI / 180, deltaLat = (b.lat - a.lat) * rad, deltaLng = (b.lng - a.lng) * rad;
      const q = Math.sin(deltaLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(deltaLng / 2) ** 2;
      const step = 12742 * Math.asin(Math.min(1, Math.sqrt(q)));
      // Ignore GPS jumps that cannot represent travel between two timestamps.
      if (Number.isFinite(step) && step < 3) km += step;
    }
    return km;
  }, [points]);
  async function consult(selection?: RecorridoSelection) {
    const id = selection?.vehicleId || vehicleId, startDay = selection?.date || fromDate, endDay = selection?.date || toDate;
    const startHour = selection?.fromTime || fromTime, endHour = selection?.toTime || toTime;
    if (!id || !token) return;
    const span = Date.parse(endDay + 'T' + endHour + ':59-05:00') - Date.parse(startDay + 'T' + startHour + ':00-05:00');
    if (span < 0 || span > 7 * 24 * 3600_000) { setError('Selecciona un rango de hasta 7 días'); return; }
    const request = ++requestId.current;
    setLoading(true); setError(''); setHistory(null); setPlaying(false);
    setEventFocus(null); setEvents([]); setEventsError(''); setEventsLoading(false); setEventsOpen(false); setEventFilter('all');
    followRef.current = false; setFollow(false);
    try {
      const params = new URLSearchParams({ vehicleId: id, fromDate: startDay, toDate: endDay, fromTime: startHour, toTime: endHour });
      const response = await fetch('/api/recorrido/history?' + params, { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo consultar el GPS');
      if (!Array.isArray(data.points)) throw new Error('El CMS devolvió una respuesta incompleta');
      if (request !== requestId.current) return;
      setHistory(data); setCursor(data.points[0]?.stamp || 0);
      setEventsLoading(true);
      const from = startDay + ' ' + startHour + ':00';
      const to = endDay + ' ' + endHour + ':59';
      const eventParams = new URLSearchParams({ unit: data.unitNumber, from, to, limit: '500' });
      fetch('/api/tracker/events?' + eventParams, { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' })
        .then(async result => { if (!result.ok) throw new Error('No se pudieron consultar los eventos'); return result.json(); })
        .then(rows => { if (request === requestId.current) setEvents(Array.isArray(rows) ? rows : []); })
        .catch(() => { if (request === requestId.current) setEventsError('No se pudieron cargar los eventos de esta unidad'); })
        .finally(() => { if (request === requestId.current) setEventsLoading(false); });
    } catch (e: any) { if (request === requestId.current) setError(e.message || 'Error de conexión'); } finally { if (request === requestId.current) setLoading(false); }
  }
  useEffect(() => { if (initialSelection && vehicles.some(v => v.id === initialSelection.vehicleId)) {
    setVehicleId(initialSelection.vehicleId); setFromDate(initialSelection.date); setToDate(initialSelection.date);
    setFromTime(initialSelection.fromTime); setToTime(initialSelection.toTime);
    void consult(initialSelection);
  } }, [initialSelection, token]);
  useEffect(() => {
    if (!mapElement.current || map.current) return;
    const instance = L.map(mapElement.current, { center: [-1.65, -78.4], zoom: 6, zoomControl: false });
    trackLayer.current = L.layerGroup().addTo(instance);
    map.current = instance;
    const stopFollow = () => { followRef.current = false; setFollow(false); };
    instance.on('dragstart zoomstart', stopFollow);
    const resize = () => instance.invalidateSize({ animate: false });
    const observer = new ResizeObserver(resize);
    observer.observe(mapElement.current);
    const timeout = window.setTimeout(resize, 120);
    window.addEventListener('resize', resize);
    return () => { window.clearTimeout(timeout); window.removeEventListener('resize', resize); observer.disconnect(); instance.remove(); map.current = null; trackLayer.current = null; marker.current = null; };
  }, []);
  useEffect(() => {
    if (!map.current) return;
    const tile = L.tileLayer(satellite
      ? 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
      : 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
      { subdomains: ['mt0', 'mt1', 'mt2', 'mt3'], maxZoom: 20, attribution: '&copy; Google Maps' }).addTo(map.current);
    return () => { tile.remove(); };
  }, [satellite]);
  useEffect(() => {
    if (!map.current || !trackLayer.current) return;
    trackLayer.current.clearLayers(); marker.current = null; playedRoute.current = null; drawnIndex.current = -1;
    if (!points.length) { map.current.setView([-1.65, -78.4], 6); return; }
    const locations = points.filter(valid).map(p => [p.lat, p.lng] as [number, number]);
    if (!locations.length) return;
    const line = L.polyline(locations, { color: '#b91c1c', weight: 5, opacity: 0.94 }).addTo(trackLayer.current);
    playedRoute.current = L.polyline([locations[0]], { color: '#facc15', weight: 4, opacity: 0.95 }).addTo(trackLayer.current);
    L.circleMarker(locations[0], { radius: 7, color: '#fff', weight: 2, fillColor: '#22c55e', fillOpacity: 1 }).addTo(trackLayer.current);
    L.circleMarker(locations[locations.length - 1], { radius: 7, color: '#fff', weight: 2, fillColor: '#f59e0b', fillOpacity: 1 }).addTo(trackLayer.current);
    marker.current = L.marker(locations[0], { icon: L.divIcon({ className: 'recorrido-bus-marker',
      html: '<div style="width:28px;height:28px;border-radius:8px;background:#0891b2;border:1px solid white;box-shadow:0 2px 7px #0008;display:grid;place-items:center"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="16" rx="3"/><path d="M5 11h14M8 15h2m4 0h2M8 19v2m8-2v2M9 7h6"/></svg></div>',
      iconSize: [28, 28], iconAnchor: [14, 14] }) }).addTo(trackLayer.current);
    map.current.fitBounds(line.getBounds(), { padding: [32, 32], maxZoom: 16 });
    window.setTimeout(() => map.current?.invalidateSize(), 120);
  }, [history]);
  useEffect(() => {
    if (!marker.current || !current) return;
    const position = !playing && eventFocus ? eventFocus : playbackPosition(points, cursor);
    if (position) marker.current.setLatLng([position.lat, position.lng]);
    const now = performance.now();
    const refresh = !playing || now - lastDraw.current > 90 || currentIndex === points.length - 1;
    if (playedRoute.current && currentIndex !== drawnIndex.current && refresh) {
      playedRoute.current.setLatLngs(points.slice(0, currentIndex + 1).map(p => [p.lat, p.lng] as [number, number]));
      drawnIndex.current = currentIndex; lastDraw.current = now;
      if (playing && followRef.current && map.current && now - lastPan.current > 450) {
        const view = map.current, projected = view.latLngToContainerPoint([current.lat, current.lng]);
        const size = view.getSize();
        if (projected.x < size.x * .18 || projected.x > size.x * .82 || projected.y < size.y * .18 || projected.y > size.y * .82) {
          lastPan.current = now;
          view.panTo([current.lat, current.lng], { animate: true, duration: .4 });
        }
      }
    }
  }, [cursor, currentIndex, history, playing, eventFocus]);
  useEffect(() => {
    if (!playing || !points.length) return;
    let frame = 0;
    const startedAt = performance.now();
    const startCursor = toPlaybackClock(playbackTimeline, cursor);
    const endClock = playbackTimeline[playbackTimeline.length - 1].clock;
    let lastPaint = 0;
    const tick = (now: number) => {
      // El reloj real define la velocidad; los fotogramas lentos no reducen x6 ni x10.
      const position = advancePlayback(startCursor, now - startedAt, speed * PLAYBACK_BASE_RATE, endClock);
      if (now - lastPaint >= 50 || position >= endClock) {
        setCursor(fromPlaybackClock(playbackTimeline, position));
        lastPaint = now;
      }
      if (position < endClock) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, points, first, last, speed, playbackTimeline]);
  useEffect(() => { if (playing && cursor >= last) setPlaying(false); }, [playing, cursor, last]);
  const jump = (direction: number) => { if (!points.length) return; setEventFocus(null); setPlaying(false); const point = points[Math.max(0, Math.min(points.length - 1, currentIndex + direction))]; setCursor(point.stamp); map.current?.panTo([point.lat, point.lng]); };
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);
  useEffect(() => {
    const first = requestAnimationFrame(() => map.current?.invalidateSize({ animate: false }));
    const second = window.setTimeout(() => map.current?.invalidateSize({ animate: false }), 250);
    return () => { cancelAnimationFrame(first); window.clearTimeout(second); };
  }, [fullscreen]);
  const chart = useMemo(() => {
    if (!points.length || first === last) return [];
    const buckets = Array.from({ length: 72 }, () => 0);
    for (const point of points) {
      const i = Math.min(71, Math.floor((point.stamp - first) / (last - first) * 72));
      buckets[i] = Math.max(buckets[i], point.speed || 0);
    }
    return buckets;
  }, [points, first, last]);
  return createPortal(<section className={fullscreen ? 'fixed inset-0 z-[1100] flex flex-col min-h-0 overflow-hidden bg-[#071626] text-white' : `absolute inset-x-0 ${chromeHidden ? 'top-0 sm:top-14' : 'top-14'} bottom-16 flex flex-col min-h-0 overflow-hidden bg-[#071626] text-white`}>
    {!fullscreen && <div className={`shrink-0 p-2 sm:p-3 border-b border-[#294458] bg-[#10283c] ${chromeHidden ? 'hidden sm:block' : ''}`}
      onTouchStart={event => { panelTouchY.current = event.touches[0]?.clientY ?? null; }}
      onTouchEnd={event => { if (panelTouchY.current != null && panelTouchY.current - (event.changedTouches[0]?.clientY ?? panelTouchY.current) > 35) onChromeHiddenChange?.(true); panelTouchY.current = null; }}>
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button onClick={() => setPicker(true)} className="min-w-0 rounded-xl border border-[#34546a] bg-[#071626] px-2 py-2 flex items-center gap-1.5 text-left">
            <Bus className="h-4 w-4 text-cyan-300 shrink-0" /><span className="truncate text-xs sm:text-sm">{currentVehicle?.unitNumber || 'Sin unidades'}</span><ChevronDown className="h-3 w-3 text-slate-400 ml-auto shrink-0" />
          </button>
          <label className="min-w-0 rounded-xl border border-[#34546a] bg-[#071626] px-2 flex items-center gap-1"><CalendarDays className="h-4 w-4 text-cyan-300 shrink-0" /><input aria-label="Fecha desde" type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="min-w-0 w-full bg-transparent text-[11px] text-white [color-scheme:dark]" /></label>
          <label className="min-w-0 rounded-xl border border-[#34546a] bg-[#071626] px-2 flex items-center gap-1"><CalendarDays className="h-4 w-4 text-cyan-300 shrink-0" /><input aria-label="Fecha hasta" type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="min-w-0 w-full bg-transparent text-[11px] text-white [color-scheme:dark]" /></label>
          <div className="grid grid-cols-2 gap-1 min-w-0"><input aria-label="Hora desde" type="time" value={fromTime} onChange={e => setFromTime(e.target.value)} className="min-w-0 rounded-lg border border-[#34546a] bg-[#071626] px-1 text-[11px] text-white [color-scheme:dark]" /><input aria-label="Hora hasta" type="time" value={toTime} onChange={e => setToTime(e.target.value)} className="min-w-0 rounded-lg border border-[#34546a] bg-[#071626] px-1 text-[11px] text-white [color-scheme:dark]" /></div>
        </div>
        <div className="flex items-center gap-2 mt-2"><button onClick={() => { const end = toDate || today(); const start = new Date(end + 'T12:00:00Z'); start.setUTCDate(start.getUTCDate() - 6); setFromDate(start.toISOString().slice(0, 10)); setToDate(end); setFromTime('00:00'); setToTime('23:59'); }} className="shrink-0 rounded-xl border border-cyan-600 px-3 py-2 text-xs text-cyan-200">Últimos 7 días</button><button disabled={!vehicleId || loading} onClick={() => consult()} className="flex-1 rounded-xl bg-amber-400 py-2 text-sm font-bold text-[#172539] disabled:opacity-50">{loading ? 'Cargando posiciones reales…' : 'CONSULTAR RECORRIDO'}</button></div>
        {availability && <p className="mt-1 text-[11px] text-slate-300">GPS en el CMS el {fromDate}: <strong className={dayCount(vehicleId) ? 'text-emerald-300' : 'text-amber-300'}>{dayCount(vehicleId).toLocaleString('es-EC')} registros</strong> · {new Set(availability.filter(row => row.date === fromDate && row.count > 0).map(row => row.vehicleId)).size}/{vehicles.length} unidades con historial</p>}
      </div>
    </div>}
    <div className="relative flex-1 min-h-0 bg-[#14283b]">
      <div ref={mapElement} className="absolute inset-0" role="img" aria-label="Mapa del recorrido GPS" />
      {fullscreen && <div className="absolute left-2 top-2 z-[500] rounded-lg bg-[#102337]/90 border border-[#34546a] px-2.5 py-1.5 text-xs text-white shadow-lg">{history?.unitNumber || currentVehicle?.unitNumber} · {timeText(cursor)}</div>}
      <div className="absolute right-2 top-2 z-[500] flex flex-col gap-2">
        <button aria-label={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'} onClick={() => setFullscreen(value => !value)} className="rounded-xl bg-[#102337]/90 border border-[#34546a] p-2.5 shadow-lg">{fullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}</button>
        <button aria-label="Ver eventos del recorrido" title="Eventos del recorrido" disabled={!history || eventsLoading} onClick={() => setEventsOpen(true)} className="rounded-xl bg-[#102337] border border-[#34546a] p-2.5 shadow-lg disabled:opacity-45 relative"><ListFilter className="w-5 h-5" />{events.length > 0 && <span className="absolute -top-1 -right-1 rounded-full bg-amber-400 text-[#102337] text-[9px] font-bold min-w-4 px-0.5">{events.length < 500 ? events.length : '500+'}</span>}</button>
        <button aria-label="Cambiar capas" onClick={() => setSatellite(s => !s)} className="rounded-xl bg-[#102337] border border-[#34546a] p-2.5 shadow-lg"><Layers3 className="w-5 h-5" /></button>
        <button aria-label={follow ? 'Dejar de seguir unidad' : 'Seguir unidad'} onClick={() => { const next = !followRef.current; followRef.current = next; setFollow(next); if (next && current) map.current?.panTo([current.lat, current.lng]); }} className={`rounded-xl border p-2.5 shadow-lg ${follow ? 'border-cyan-300 bg-cyan-700' : 'border-[#34546a] bg-[#102337]'}`}><Crosshair className="w-5 h-5" /></button>
        <button aria-label="Mostrar ruta completa" onClick={() => { followRef.current = false; setFollow(false); if (map.current && points.length) map.current.fitBounds(L.latLngBounds(points.map(p => [p.lat, p.lng])), { padding: [30, 30], maxZoom: 16 }); }} className="rounded-xl bg-[#102337] border border-[#34546a] p-2.5 shadow-lg"><Bus className="w-5 h-5" /></button>
        {!fullscreen && <button aria-label="Acercar mapa" onClick={() => map.current?.zoomIn()} className="rounded-xl bg-[#102337] border border-[#34546a] p-2.5 shadow-lg"><Plus className="w-5 h-5" /></button>}
        {!fullscreen && <button aria-label="Alejar mapa" onClick={() => map.current?.zoomOut()} className="rounded-xl bg-[#102337] border border-[#34546a] p-2.5 shadow-lg"><Minus className="w-5 h-5" /></button>}
      </div>
      {eventFocus && <div role="status" aria-label="Evento seleccionado en el mapa" className="absolute left-2 top-2 right-16 z-[500] max-w-sm rounded-xl border border-amber-400 bg-[#102337]/95 p-3 text-xs shadow-xl">
        <button type="button" aria-label="Quitar evento seleccionado" onClick={() => setEventFocus(null)} className="float-right p-1"><X className="h-4 w-4" /></button>
        <strong className="block text-amber-300">{eventLabel(eventFocus.event)}</strong>
        <span className="block mt-1">{timeText(eventStamp(eventFocus.event.event_time))}</span>
        <span className="block mt-1 text-slate-300">{eventFocus.exact ? 'Ubicacion GPS guardada del evento' : 'Posicion GPS mas cercana; el evento no guardo coordenadas'}</span>
      </div>}
      {error && <div role="alert" className="absolute left-2 right-14 top-2 z-[500] rounded-xl border border-red-700 bg-red-950/90 p-3 text-xs">{error}</div>}
      {history?.points.length === 0 && <div className="absolute left-2 right-14 top-2 z-[500] rounded-xl border border-[#34546a] bg-[#102337]/95 p-3 text-xs"><p>El CMS no guardó posiciones GPS para esta unidad en el horario elegido.</p>{recentDay && recentDay.date !== fromDate && <button onClick={() => { setFromDate(recentDay.date); setToDate(recentDay.date); setFromTime('00:00'); setToTime('23:59'); void consult({ vehicleId, date: recentDay.date, fromTime: '00:00', toTime: '23:59' }); }} className="mt-2 rounded-lg bg-cyan-700 px-2 py-1.5 font-semibold text-white">Ver último día disponible: {recentDay.date}</button>}</div>}
      {!fullscreen && history && points.length > 0 && <div className="absolute left-2 bottom-2 z-[500] max-w-[70%] rounded-xl border border-[#34546a] bg-[#102337]/95 p-2 text-[11px] shadow-xl">
        <div className="font-semibold text-cyan-200">{currentVehicle?.unitNumber} · {timeText(cursor)}</div>
        <div className="text-slate-300">{current?.speed ?? '—'} km/h · {distance.toFixed(1)} km aprox. · {currentIndex + 1}/{points.length} puntos · {history.totalRecords} registros{history.sampled ? ' (muestra real)' : ''}</div>
      </div>}
    </div>
    <div className={fullscreen ? 'shrink-0 border-t border-[#34546a] bg-[#102337]/95 px-2 py-1 pb-[max(8px,env(safe-area-inset-bottom))]' : 'shrink-0 border-t border-[#34546a] bg-[#102337] px-3 pt-2 pb-2 max-h-[140px]'}>
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center gap-2 justify-between">
          <div className="flex items-center gap-1">
            <button aria-label={playing ? 'Pausar' : 'Reproducir'} disabled={!points.length} onClick={() => { setEventFocus(null); if (!playing && points.length) { const point = cursor >= last ? points[0] : current; if (point && followRef.current) map.current?.panTo([point.lat, point.lng]); if (cursor >= last) setCursor(first); } setPlaying(p => !p); }} className="p-2 rounded-lg text-cyan-200 disabled:opacity-40">{playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}</button>
            <button aria-label="Reiniciar" disabled={!points.length} onClick={() => { setEventFocus(null); setPlaying(false); setCursor(first); }} className="p-2 disabled:opacity-40"><RotateCcw className="h-4 w-4" /></button>
            <button aria-label="Punto anterior" disabled={!points.length} onClick={() => jump(-1)} className="p-2 disabled:opacity-40"><SkipBack className="h-4 w-4" /></button>
            <button aria-label="Punto siguiente" disabled={!points.length} onClick={() => jump(1)} className="p-2 disabled:opacity-40"><SkipForward className="h-4 w-4" /></button>
          </div>
          <div className="text-right"><label title="Escala acelerada: x1 equivale a cinco minutos del historial por segundo real" className="text-xs text-slate-300 flex items-center gap-1">Velocidad<select aria-label="Velocidad de reproducción" value={speed} onChange={e => setSpeed(Number(e.target.value))} className="rounded-lg border border-[#34546a] bg-[#071626] p-1 text-xs text-white">{[1, 3, 6, 10, 20].map(value => <option value={value} key={value}>×{value}</option>)}</select></label><span className="block mt-0.5 text-[9px] text-slate-400">Base x1: 5 min/s</span><span className="block text-[9px] text-slate-400">Huecos GPS abreviados</span></div>
        </div>
        {!fullscreen && <div className="relative h-8 overflow-hidden rounded bg-[#071626] flex items-end gap-px px-1">{chart.map((n, i) => <div key={i} style={{ height: Math.max(2, Math.min(28, n / 100 * 28)) }} className={n > 0 ? 'flex-1 bg-cyan-500/65' : 'flex-1 bg-slate-700/50'} />)}</div>}
        <input aria-label="Línea de tiempo del recorrido" type="range" min={first} max={Math.max(first + 1, last)} step="1000" value={cursor || first} disabled={!points.length} onChange={e => { setEventFocus(null); setPlaying(false); setCursor(Number(e.target.value)); }} className="w-full h-3 accent-[#00d1ff] disabled:opacity-40" />
        <div className="flex justify-between gap-1 text-[9px] text-slate-400"><span className="min-w-0 truncate">{points.length ? new Date(first).toLocaleString('es-EC', {timeZone:'America/Guayaquil'}) : 'Inicio'}</span><span className="min-w-0 truncate text-center">{points.length ? new Date(cursor).toLocaleString('es-EC', {timeZone:'America/Guayaquil'}) : 'Selecciona un rango'}</span><span className="min-w-0 truncate text-right">{points.length ? new Date(last).toLocaleString('es-EC', {timeZone:'America/Guayaquil'}) : 'Fin'}</span></div>
      </div>
    </div>
    {eventsOpen && createPortal(<div className="fixed inset-0 z-[1300] flex items-end justify-center bg-black/70" onClick={() => setEventsOpen(false)}>
      <div role="dialog" aria-modal="true" aria-label="Eventos del recorrido" className="w-full max-w-3xl max-h-[75dvh] rounded-t-3xl border border-[#34546a] bg-[#102337] text-white flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-slate-500 shrink-0" />
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[#34546a] shrink-0">
          <div><h2 className="text-base font-bold">Eventos del recorrido</h2><p className="text-xs text-slate-300">{history?.unitNumber} · {history?.from} a {history?.to}</p></div>
          <button aria-label="Cerrar eventos" onClick={() => setEventsOpen(false)} className="rounded-lg p-2 hover:bg-white/10"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex gap-2 overflow-x-auto px-3 py-2 border-b border-[#34546a] shrink-0">
          {['all', ...eventTypes].map(type => <button key={type} onClick={() => setEventFilter(type)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs border ${eventFilter === type ? 'bg-cyan-700 border-cyan-400 text-white' : 'border-[#34546a] bg-[#071626] text-slate-200'}`}>{type === 'all' ? `Todos (${events.length})` : `${eventLabel(events.find(event => event.event_type === type)!)} (${events.filter(event => event.event_type === type).length})`}</button>)}
        </div>
        <div className="overflow-y-auto p-3 space-y-2 pb-[max(20px,env(safe-area-inset-bottom))]">
          {eventsError && <p role="alert" className="rounded-xl border border-red-700 p-3 text-sm text-rose-200">{eventsError}</p>}
          {!eventsError && filteredEvents.length === 0 && <p className="rounded-xl border border-[#34546a] p-4 text-sm text-slate-300">No hay eventos registrados para esta unidad y horario.</p>}
          {filteredEvents.map(event => <button type="button" key={event.id} aria-label={eventLabel(event) + ' - Ver evento en el mapa'} className="w-full rounded-lg border border-slate-300 bg-slate-100 p-3 text-left text-slate-900 shadow-sm hover:border-emerald-500 focus-visible:outline-2 focus-visible:outline-cyan-500" onClick={() => {
            const stamp = eventStamp(event.event_time);
            const target = eventPosition(event, stamp, points);
            if (!target) { setEventsError('Este evento no tiene una ubicacion GPS disponible en el recorrido.'); return; }
            setPlaying(false); setEventFocus({ event, ...target });
            followRef.current = false; setFollow(false);
            if (points.length && stamp) setCursor(Math.max(first, Math.min(last, stamp)));
            marker.current?.setLatLng([target.lat, target.lng]);
            map.current?.setView([target.lat, target.lng], Math.max(16, map.current.getZoom()), { animate: false });
            setEventsError(''); setEventsOpen(false);
          }}>

            <div className="flex items-start gap-3"><Tag className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /><span className="text-sm font-bold leading-snug">{eventLabel(event)}</span></div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <div className="flex min-w-0 items-center gap-2"><Gauge className="h-5 w-5 shrink-0 text-emerald-600" /><span>{event.speed == null ? 'Sin dato' : Number(event.speed).toFixed(1) + ' km/h'}</span></div>
              <div className="flex min-w-0 items-center gap-2"><Power className="h-5 w-5 shrink-0 text-emerald-600" /><span>{eventConnection(event)}</span></div>
              <div className="flex min-w-0 items-center gap-2"><CalendarDays className="h-5 w-5 shrink-0 text-emerald-600" /><span>{eventStamp(event.event_time) ? new Date(eventStamp(event.event_time)).toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' }) : 'Sin fecha'}</span></div>
              <div className="flex min-w-0 items-center gap-2"><Clock3 className="h-5 w-5 shrink-0 text-emerald-600" /><span>{timeText(eventStamp(event.event_time))}</span></div>
            </div>
            {event.description && <p className="mt-3 border-t border-slate-300 pt-2 text-xs leading-relaxed text-slate-700">{event.description}</p>}
          </button>)}
          {events.length >= 500 && <p className="text-xs text-amber-200 p-2">Se muestran los 500 eventos mas recientes del rango. Acorta el horario para consultar los anteriores.</p>}
        </div>
      </div>
    </div>, document.body)}
    {picker && createPortal(<div className="fixed inset-0 z-[1200] flex items-end bg-black/70" onClick={() => setPicker(false)}><div role="dialog" aria-label="Seleccionar unidad" className="mx-auto w-full max-w-4xl rounded-t-3xl bg-[#102337] border border-[#34546a] p-4 max-h-[75dvh] flex flex-col" onClick={e => e.stopPropagation()}>
      <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-slate-500" /><div className="flex gap-2 items-center"><Search className="w-5 h-5 text-slate-400" /><input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar disco o placa" className="min-w-0 flex-1 rounded-xl bg-[#071626] p-3 outline-none border border-[#34546a]" /><button aria-label="Cerrar selector" onClick={() => setPicker(false)}><X /></button></div>
      <div className="mt-3 overflow-y-auto space-y-2 pb-[max(14px,env(safe-area-inset-bottom))]">{filtered.map(v => <button key={v.id} className={`block w-full rounded-xl p-3 text-left border ${v.id === vehicleId ? 'border-cyan-400 bg-cyan-800/40' : 'border-[#34546a] bg-[#071626]'}`} onClick={() => { requestId.current++; setVehicleId(v.id); setHistory(null); setEventFocus(null); setEvents([]); setEventsOpen(false); setPlaying(false); setPicker(false); setSearch(''); }}>{v.unitNumber}<span className="ml-2 text-xs text-slate-400">{availability ? (dayCount(v.id) ? dayCount(v.id).toLocaleString('es-EC') + ' GPS' : 'Sin GPS ese día') : ''}</span></button>)}{!filtered.length && <p className="p-3 text-slate-400">No hay unidades autorizadas coincidentes</p>}</div>
    </div></div>, document.body)}
  </section>, document.body);
}