import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Vehicle, EvidenceTrackData, GpsTrackPoint, HistoricEvent } from '../types';
import { MapView } from './MapView';
import {
  Calendar as CalendarIcon,
  ChevronDown,
  Search,
  MessageSquare,
  Navigation,
  MapPin,
  Clock,
  Sparkles,
  ExternalLink,
  Route,
  Mic,
  MicOff,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface EvidenceTrackerViewProps {
  vehicles: Vehicle[];
  geofences: any[];
  initialVehicle?: Vehicle | null;
  onExportClip?: (unitNumber: string, startTime: string, endTime: string, date: string) => void;
  onNavigateToVivo?: (vehicle: Vehicle) => void;
}

type ChatMessage = { role: 'user' | 'assistant'; text: string };

function formatDate(value: string) {
  const d = new Date(value.replace(' ', 'T'));
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' });
}

function dayRange(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(`${dateStr}T23:59:59`);
  return {
    from: start.toISOString().slice(0, 19).replace('T', ' '),
    to: end.toISOString().slice(0, 19).replace('T', ' ')
  };
}

export const EvidenceTrackerView: React.FC<EvidenceTrackerViewProps> = ({
  vehicles,
  geofences,
  initialVehicle,
  onExportClip
}) => {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(initialVehicle?.id || vehicles[0]?.id || '');
  const [selectedDate, setSelectedDate] = useState<string>('2026-08-18');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [trackData, setTrackData] = useState<EvidenceTrackData | null>(null);
  const [events, setEvents] = useState<HistoricEvent[]>([]);
  const [loadingTrack, setLoadingTrack] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [pointIndex, setPointIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: 'Pregunta por una unidad y una hora, por ejemplo: "Donde estuvo mi unidad 01_AAA2539 a las 9.15 de la mañana".' }
  ]);
  const [chatLoading, setChatLoading] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const routeRef = useRef<L.Polyline | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const startRef = useRef<L.Marker | null>(null);
  const endRef = useRef<L.Marker | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) || vehicles[0] || null,
    [vehicles, selectedVehicleId]
  );

  useEffect(() => {
    if (selectedVehicle?.id) setSelectedVehicleId(selectedVehicle.id);
  }, [selectedVehicle?.id]);

  useEffect(() => {
    if (!selectedVehicle) return;
    setLoadingTrack(true);
    fetch(`/api/gps-track/${selectedVehicle.unitNumber}?date=${selectedDate}`)
      .then((r) => r.json())
      .then((data: EvidenceTrackData) => {
        setTrackData(data);
        setPointIndex(Math.max(0, (data.points?.length || 1) - 1));
      })
      .catch(() => setTrackData(null))
      .finally(() => setLoadingTrack(false));
  }, [selectedVehicle?.unitNumber, selectedDate]);

  useEffect(() => {
    const { from, to } = dayRange(selectedDate);
    setLoadingEvents(true);
    fetch(`/api/tracker/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=250`)
      .then((r) => r.json())
      .then((rows: HistoricEvent[]) => setEvents(Array.isArray(rows) ? rows : []))
      .catch(() => setEvents([]))
      .finally(() => setLoadingEvents(false));
  }, [selectedDate]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, { center: [-3.9928, -79.2845], zoom: 13, zoomControl: false, attributionControl: false });
    const dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 });
    const sat = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'] });
    tileRef.current = dark.addTo(map);
    mapInstanceRef.current = map;
    return () => map.remove();
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !trackData?.points?.length) return;
    const map = mapInstanceRef.current;
    const points = trackData.points.map((p) => [p.lat, p.lng] as [number, number]);
    routeRef.current?.remove();
    startRef.current?.remove();
    endRef.current?.remove();

    routeRef.current = L.polyline(points, { color: '#00d1ff', weight: 5, opacity: 0.9 }).addTo(map);
    startRef.current = L.marker(points[0], {
      icon: L.divIcon({ html: '<div class="w-7 h-7 rounded-full bg-emerald-500 text-white border-2 border-white flex items-center justify-center font-bold text-[10px]">A</div>', className: '', iconSize: [28, 28], iconAnchor: [14, 14] })
    }).addTo(map);
    endRef.current = L.marker(points[points.length - 1], {
      icon: L.divIcon({ html: '<div class="w-7 h-7 rounded-full bg-red-500 text-white border-2 border-white flex items-center justify-center font-bold text-[10px]">B</div>', className: '', iconSize: [28, 28], iconAnchor: [14, 14] })
    }).addTo(map);
    map.fitBounds(routeRef.current.getBounds(), { padding: [36, 36] });
  }, [trackData]);

  useEffect(() => {
    if (!mapInstanceRef.current || !trackData?.points?.length) return;
    const map = mapInstanceRef.current;
    const point = trackData.points[Math.min(pointIndex, trackData.points.length - 1)];
    const icon = L.divIcon({
      html: `<div class="flex flex-col items-center"><div class="w-9 h-9 rounded-full bg-[#00d1ff] border-2 border-white flex items-center justify-center shadow-[0_0_15px_rgba(0,209,255,0.8)]"><svg class="w-5 h-5 text-black" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg></div><div class="mt-1 px-2 py-0.5 rounded bg-[#000f20]/95 border border-[#00d1ff] text-white text-[9px] font-mono">${selectedVehicle?.unitNumber || ''}</div></div>`,
      className: '',
      iconSize: [70, 70],
      iconAnchor: [35, 25]
    });
    if (markerRef.current) {
      markerRef.current.setLatLng([point.lat, point.lng]);
      markerRef.current.setIcon(icon);
    } else {
      markerRef.current = L.marker([point.lat, point.lng], { icon, zIndexOffset: 2000 }).addTo(map);
    }
    if (isPlaying) map.panTo([point.lat, point.lng], { animate: true, duration: 0.2 });
  }, [trackData, pointIndex, selectedVehicle?.unitNumber, isPlaying]);

  useEffect(() => {
    if (!isPlaying || !trackData?.points?.length) return;
    const timer = window.setInterval(() => {
      setPointIndex((prev) => (prev >= trackData.points.length - 1 ? 0 : prev + 1));
    }, 800);
    return () => window.clearInterval(timer);
  }, [isPlaying, trackData]);

  const visibleVehicles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter((v) => {
      const unitMatch = [v.unitNumber, v.plate, v.driverName, v.route, v.geofence].filter(Boolean).join(' ').toLowerCase();
      const eventMatch = events.some((e) => e.unitNumber === v.unitNumber && `${e.title} ${e.description}`.toLowerCase().includes(q));
      return unitMatch.includes(q) || eventMatch;
    });
  }, [vehicles, search, events]);

  const eventsByUnit = useMemo(() => {
    const grouped = new Map<string, HistoricEvent[]>();
    for (const ev of events) {
      const list = grouped.get(ev.unitNumber) || [];
      list.push(ev);
      grouped.set(ev.unitNumber, list);
    }
    for (const list of grouped.values()) {
      list.sort((a, b) => new Date(b.timestamp.replace(' ', 'T')).getTime() - new Date(a.timestamp.replace(' ', 'T')).getTime());
    }
    return grouped;
  }, [events]);

  const filteredCards = useMemo(() => {
    return visibleVehicles
      .map((vehicle) => ({ vehicle, events: eventsByUnit.get(vehicle.unitNumber) || [] }))
      .sort((a, b) => {
        const aTime = a.events[0]?.timestamp || a.vehicle.lastUpdate;
        const bTime = b.events[0]?.timestamp || b.vehicle.lastUpdate;
        return new Date(bTime.replace(' ', 'T')).getTime() - new Date(aTime.replace(' ', 'T')).getTime();
      });
  }, [visibleVehicles, eventsByUnit]);

  const currentPoint: GpsTrackPoint | undefined = trackData?.points?.[Math.min(pointIndex, (trackData?.points?.length || 1) - 1)];

  const handleChat = async () => {
    if (!chatInput.trim()) return;
    setChatMessages((prev) => [...prev, { role: 'user', text: chatInput.trim() }]);
    const question = chatInput.trim();
    setChatInput('');
    setChatLoading(true);
    try {
      const res = await fetch('/api/tracker/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, date: selectedDate, unitNumber: selectedVehicle?.unitNumber })
      });
      const data = await res.json();
      if (data.unitNumber) {
        const target = vehicles.find((v) => v.unitNumber === data.unitNumber);
        if (target) setSelectedVehicleId(target.id);
        setSearch(data.unitNumber);
      }
      setChatMessages((prev) => [...prev, { role: 'assistant', text: data.reply || 'No encontré eventos.' }]);
    } catch {
      setChatMessages((prev) => [...prev, { role: 'assistant', text: 'No pude consultar el histórico en este momento.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const exportVisibleClip = () => {
    if (!trackData?.points?.length || !selectedVehicle || !onExportClip) return;
    const start = trackData.points[0];
    const end = trackData.points[trackData.points.length - 1];
    onExportClip(selectedVehicle.unitNumber, start.timestamp.split(' ')[1] || '00:00:00', end.timestamp.split(' ')[1] || '23:59:59', selectedDate);
  };

  return (
    <div className="relative w-full h-full bg-[#000f20] text-slate-300 flex flex-col overflow-hidden px-3 sm:px-4 lg:px-6 pb-20 pt-16">
      <div className="flex flex-col gap-3 pb-3 border-b border-[#293a50]/60">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white font-mono flex items-center gap-2">
              <Route className="w-5 h-5 text-[#00d1ff]" />
              <span>Centro Historico</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#00d1ff]/10 text-[#00d1ff] border border-[#00d1ff]/30">historico GPS</span>
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-1">Mapa, eventos permanentes, buscador por placa/nombre y chat contextual.</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <button onClick={() => setIsDatePickerOpen((v) => !v)} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#011428] border border-[#293a50] text-xs font-mono text-slate-200">
                <CalendarIcon className="w-4 h-4 text-[#00d1ff]" />
                <span>{selectedDate}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              </button>
              {isDatePickerOpen && (
                <div className="absolute right-0 top-11 z-30 w-44 p-2 rounded-xl bg-[#000f20] border border-[#293a50] shadow-2xl">
                  {['2026-08-18', '2026-08-17', '2026-08-16', '2026-08-15', '2026-08-14'].map((d) => (
                    <button key={d} onClick={() => { setSelectedDate(d); setIsDatePickerOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono ${selectedDate === d ? 'bg-[#00d1ff] text-black font-bold' : 'text-slate-300 hover:bg-slate-900'}`}>
                      {d}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={exportVisibleClip} className="px-3 py-2 rounded-xl bg-[#d0e92f] text-black text-xs font-mono font-bold hover:bg-[#e4fa39] transition-colors">Exportar</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-stretch">
          <div className="flex items-center gap-2 bg-[#011428] border border-[#293a50] rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-[#00d1ff] flex-shrink-0" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por placa, nombre, ruta o evento" className="w-full bg-transparent outline-none text-sm text-white placeholder:text-slate-500" />
          </div>

          <div className="flex items-center justify-between gap-2 rounded-xl border border-[#293a50] bg-[#011428] px-3 py-2 min-w-[240px]">
            <div>
              <div className="text-[10px] font-mono text-slate-500">Unidad activa</div>
              <div className="text-xs font-mono text-white font-bold truncate max-w-[180px]">{selectedVehicle?.unitNumber || '-'}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-3 flex-1 min-h-0 mt-3">
        <section className="min-h-[42vh] rounded-2xl overflow-hidden border border-[#293a50] bg-[#011428] shadow-2xl relative">
          <MapView
            vehicles={vehicles}
            geofences={[]}
            selectedVehicle={selectedVehicle}
            onSelectVehicle={(v) => setSelectedVehicleId(v.id)}
            onMapClick={() => setSelectedVehicleId(selectedVehicle?.id || '')}
          />
          <div className="absolute top-3 left-3 right-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pointer-events-none">
            <div className="px-3 py-2 rounded-xl bg-black/70 border border-white/10 backdrop-blur-md text-xs font-mono text-white">
              {selectedVehicle?.driverName || selectedVehicle?.plate || 'Sin selección'}
            </div>
            <div className="px-3 py-2 rounded-xl bg-black/70 border border-white/10 backdrop-blur-md text-xs font-mono text-[#00d1ff]">
              {loadingTrack ? 'Cargando histórico...' : `${events.length} eventos del día`}
            </div>
          </div>
        </section>

        <aside className="rounded-2xl border border-[#293a50] bg-[#011428] shadow-2xl flex flex-col min-h-0 overflow-hidden">
          <div className="p-3 border-b border-[#293a50] flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-white font-mono flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#d0e92f]" />
                Eventos del día
              </div>
              <div className="text-[10px] text-slate-500 font-mono">{loadingEvents ? 'Cargando eventos...' : `${events.length} eventos persistidos`}</div>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
              <MessageSquare className="w-4 h-4" />
              chat
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
            <div className="rounded-2xl border border-[#293a50] bg-[#000f20] p-3">
              <div className="text-[10px] font-mono text-slate-500 mb-2">Chat histórico</div>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                {chatMessages.map((m, idx) => (
                  <div key={idx} className={`text-xs font-mono p-2 rounded-xl border ${m.role === 'user' ? 'bg-[#00d1ff]/10 border-[#00d1ff]/20 text-white ml-6' : 'bg-slate-900 border-[#293a50] text-slate-200 mr-6'}`}>
                    {m.text}
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleChat()} placeholder="Ej: donde estuvo mi unidad 01_AAA2539 a las 9.15 de la mañana" className="flex-1 bg-slate-950 border border-[#293a50] rounded-xl px-3 py-2 text-xs text-white outline-none" />
                <button onClick={handleChat} disabled={chatLoading} className="px-3 py-2 rounded-xl bg-[#00d1ff] text-black text-xs font-mono font-bold disabled:opacity-60">
                  {chatLoading ? '...' : 'Enviar'}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {filteredCards.map(({ vehicle, events: unitEvents }) => (
                <article key={vehicle.id} className="rounded-2xl border border-[#293a50] bg-[#000f20] p-3 shadow-lg">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-white font-bold font-mono text-sm truncate">{vehicle.unitNumber}</h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] border border-[#00d1ff]/30 text-[#00d1ff] bg-[#00d1ff]/10">{vehicle.plate}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 font-mono truncate">{vehicle.driverName || 'Sin conductor'} • {vehicle.route || 'Sin ruta'}</div>
                    </div>
                    <button onClick={() => setSelectedVehicleId(vehicle.id)} className="px-2.5 py-1.5 rounded-lg bg-[#00d1ff]/10 text-[#00d1ff] border border-[#00d1ff]/30 text-[10px] font-mono">
                      Ver
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] font-mono">
                    <div className="rounded-xl bg-slate-950 border border-[#293a50] p-2">
                      <div className="text-slate-500">Eventos</div>
                      <div className="text-white font-bold">{unitEvents.length}</div>
                    </div>
                    <div className="rounded-xl bg-slate-950 border border-[#293a50] p-2">
                      <div className="text-slate-500">GPS</div>
                      <div className="text-[#00d1ff] font-bold">{vehicle.relativeTime}</div>
                    </div>
                    <div className="rounded-xl bg-slate-950 border border-[#293a50] p-2">
                      <div className="text-slate-500">Velocidad</div>
                      <div className="text-white font-bold">{vehicle.speed} km/h</div>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {unitEvents.length > 0 ? unitEvents.slice(0, 4).map((ev) => (
                      <div key={ev.id} className="rounded-xl border border-[#293a50] bg-[#011428] p-2.5">
                        <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-slate-400">
                          <span className="truncate">{formatDate(ev.timestamp)}</span>
                          <span className="px-2 py-0.5 rounded-full bg-[#00d1ff]/10 text-[#00d1ff] border border-[#00d1ff]/30">{ev.event_type}</span>
                        </div>
                        <div className="text-sm text-white font-medium mt-1">{ev.title}</div>
                        <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">{ev.description}</div>
                      </div>
                    )) : (
                      <div className="rounded-xl border border-dashed border-[#293a50] bg-[#011428] p-3 text-xs text-slate-500 font-mono">Sin eventos para esta unidad en la fecha seleccionada.</div>
                    )}
                  </div>
                </article>
              ))}

              {!loadingEvents && filteredCards.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[#293a50] bg-[#000f20] p-6 text-center text-xs text-slate-500 font-mono">
                  No encontré unidades con ese filtro.
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
