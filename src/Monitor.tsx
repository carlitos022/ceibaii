import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Bell, Crosshair, Gauge, LogOut, Menu, Navigation, RefreshCw, Search, Wifi, WifiOff, X } from 'lucide-react';
import type { Vehicle } from './types';

type Props = {
  token: string;
  username: string;
  onLogout: () => void;
};

function vehicleColor(status: Vehicle['status']) {
  if (status === 'alarm') return '#ff3b3b';
  if (status === 'moving') return '#ff9800';
  if (status === 'stopped') return '#ef4444';
  if (status === 'online') return '#facc15';
  return '#64748b';
}

function validPosition(vehicle: Vehicle) {
  return Number.isFinite(vehicle.lat) && Number.isFinite(vehicle.lng) &&
    vehicle.lat !== null && vehicle.lng !== null && (vehicle.lat !== 0 || vehicle.lng !== 0);
}

function markerIcon(vehicle: Vehicle) {
  const color = vehicleColor(vehicle.status);
  const alarm = vehicle.status === 'alarm';
  return L.divIcon({
    className: 'fleet-marker-shell',
    html: `<div class="fleet-marker ${alarm ? 'fleet-marker-alarm' : ''}" style="--marker:${color};--heading:${vehicle.heading || 0}deg">
      <div class="fleet-marker-pulse"></div>
      <div class="fleet-marker-arrow">▲</div>
      <span>${vehicle.unitNumber}</span>
    </div>`,
    iconSize: [76, 46],
    iconAnchor: [38, 23]
  });
}

export default function Monitor({ token, username, onLogout }: Props) {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [connected, setConnected] = useState(false);
  const [lastFeedAt, setLastFeedAt] = useState<number>(0);

  const selected = useMemo(
    () => vehicles.find(v => v.id === selectedId) || null,
    [vehicles, selectedId]
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter(v =>
      [v.unitNumber, v.plate, v.route, v.statusText].some(x => String(x || '').toLowerCase().includes(q))
    );
  }, [vehicles, query]);

  const counts = useMemo(() => ({
    total: vehicles.length,
    moving: vehicles.filter(v => v.status === 'moving').length,
    stopped: vehicles.filter(v => v.status === 'stopped').length,
    offline: vehicles.filter(v => v.status === 'offline').length
  }), [vehicles]);

  async function loadVehicles() {
    const response = await fetch('/api/monitor/vehicles', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (response.status === 401) return onLogout();
    if (!response.ok) throw new Error('No se pudo cargar Monitor');
    const data = await response.json();
    if (Array.isArray(data)) {
      setVehicles(data);
      setLastFeedAt(Date.now());
    }
  }

  useEffect(() => {
    void loadVehicles().catch(() => {});
    const es = new EventSource(`/api/monitor/stream?access_token=${encodeURIComponent(token)}`);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = event => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'telemetry_update' && Array.isArray(data.vehicles)) {
          setVehicles(data.vehicles);
          setConnected(true);
          setLastFeedAt(Date.now());
        }
      } catch {}
    };
    const fallback = window.setInterval(() => {
      if (!connected || Date.now() - lastFeedAt > 10000) void loadVehicles().catch(() => {});
    }, 10000);
    return () => {
      es.close();
      window.clearInterval(fallback);
    };
  }, [token]);

  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) return;
    const map = L.map(mapNodeRef.current, { zoomControl: false, attributionControl: true })
      .setView([-3.99, -79.20], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    mapRef.current = map;
    requestAnimationFrame(() => map.invalidateSize());
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();

    for (const vehicle of vehicles) {
      if (!validPosition(vehicle)) continue;
      seen.add(vehicle.id);
      const latlng: L.LatLngExpression = [vehicle.lat as number, vehicle.lng as number];
      let marker = markersRef.current.get(vehicle.id);
      if (!marker) {
        marker = L.marker(latlng, { icon: markerIcon(vehicle), riseOnHover: true })
          .addTo(map)
          .on('click', () => setSelectedId(vehicle.id));
        markersRef.current.set(vehicle.id, marker);
      } else {
        marker.setLatLng(latlng);
        marker.setIcon(markerIcon(vehicle));
      }
      marker.bindTooltip(
        `<strong>${vehicle.unitNumber}</strong><br>${vehicle.speed} km/h · ${vehicle.relativeTime || ''}`,
        { direction: 'top', offset: [0, -16], opacity: .95 }
      );
    }

    for (const [id, marker] of markersRef.current) {
      if (!seen.has(id)) {
        map.removeLayer(marker);
        markersRef.current.delete(id);
      }
    }
  }, [vehicles]);

  function focusVehicle(vehicle: Vehicle) {
    setSelectedId(vehicle.id);
    setDrawerOpen(false);
    if (mapRef.current && validPosition(vehicle)) {
      mapRef.current.flyTo([vehicle.lat as number, vehicle.lng as number], 17, { duration: .6 });
    }
  }

  function resetMap() {
    const points = vehicles.filter(validPosition).map(v => [v.lat as number, v.lng as number] as [number, number]);
    if (!mapRef.current) return;
    if (points.length === 1) mapRef.current.flyTo(points[0], 16);
    if (points.length > 1) mapRef.current.fitBounds(points, { padding: [35, 35], maxZoom: 15 });
  }

  return (
    <div className="monitor-root">
      <header className="monitor-header">
        <button className="icon-btn" onClick={() => setDrawerOpen(true)} aria-label="Abrir unidades"><Menu /></button>
        <div className="monitor-title">
          <strong>Monitor</strong>
          <span>{connected ? 'GPS en vivo' : 'Reconectando...'}</span>
        </div>
        <div className="monitor-account">
          <span>{username}</span>
          <button className="icon-btn" onClick={onLogout} aria-label="Cerrar sesion"><LogOut /></button>
        </div>
      </header>

      <section className="monitor-stats">
        <div><strong>{counts.total}</strong><span>Unidades</span></div>
        <div><strong>{counts.moving}</strong><span>En ruta</span></div>
        <div><strong>{counts.stopped}</strong><span>Detenidas</span></div>
        <div><strong>{counts.offline}</strong><span>Offline</span></div>
      </section>

      <div className="monitor-map-wrap">
        <div ref={mapNodeRef} className="monitor-map" />
        <div className="map-actions">
          <button className="map-action" onClick={resetMap} title="Mostrar toda la flota"><Crosshair size={21} /></button>
          <button className="map-action" onClick={() => void loadVehicles()} title="Actualizar"><RefreshCw size={21} /></button>
        </div>
        <div className="feed-pill">
          {connected ? <Wifi size={15} /> : <WifiOff size={15} />}
          <span>{connected ? 'Conectado' : 'Sin enlace'}</span>
        </div>
      </div>

      {selected && (
        <section className="vehicle-sheet">
          <div className="sheet-grabber" />
          <div className="sheet-head">
            <div>
              <div className="sheet-unit">{selected.unitNumber}</div>
              <div className="sheet-route">{selected.route || 'Sin grupo/ruta'}</div>
            </div>
            <button className="icon-btn" onClick={() => setSelectedId(null)} aria-label="Cerrar detalle"><X /></button>
          </div>
          <div className="vehicle-status-line">
            <span className="status-dot" style={{ background: vehicleColor(selected.status) }} />
            <strong>{selected.statusText}</strong>
            <span>{selected.relativeTime}</span>
          </div>
          <div className="detail-grid">
            <div><Gauge size={18} /><span>Velocidad</span><strong>{selected.speed} km/h</strong></div>
            <div><Navigation size={18} /><span>Direccion</span><strong>{Math.round(selected.heading || 0)}°</strong></div>
            <div><Bell size={18} /><span>Estado</span><strong>{selected.status}</strong></div>
            <div><Wifi size={18} /><span>MDVR</span><strong>{selected.camerasOnline || '-'}</strong></div>
          </div>
          <div className="detail-coords">
            GPS: {selected.lat ?? '-'}, {selected.lng ?? '-'} · {selected.lastUpdate || 'sin reporte'}
          </div>
        </section>
      )}

      <aside className={`vehicle-drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="drawer-head">
          <div><strong>Vehiculos</strong><span>{filtered.length} visibles</span></div>
          <button className="icon-btn" onClick={() => setDrawerOpen(false)}><X /></button>
        </div>
        <label className="drawer-search">
          <Search size={18} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar unidad o placa" />
        </label>
        <div className="vehicle-list">
          {filtered.map(vehicle => (
            <button key={vehicle.id} className="vehicle-row" onClick={() => focusVehicle(vehicle)}>
              <span className="status-dot" style={{ background: vehicleColor(vehicle.status) }} />
              <span className="vehicle-main">
                <strong>{vehicle.unitNumber}</strong>
                <small>{vehicle.route || vehicle.plate}</small>
              </span>
              <span className="vehicle-side">
                <strong>{vehicle.speed} km/h</strong>
                <small>{vehicle.relativeTime}</small>
              </span>
            </button>
          ))}
          {!filtered.length && <div className="empty-list">No hay unidades para esta cuenta.</div>}
        </div>
      </aside>
      {drawerOpen && <button className="drawer-backdrop" onClick={() => setDrawerOpen(false)} aria-label="Cerrar" />}
    </div>
  );
}
