import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Vehicle } from './types';
import OriginalLiveVideo from './OriginalLiveVideo';
import { apiUrl } from './api';

type Props = {
  token: string;
  username: string;
  onLogout: () => void;
};

type DetailSection = 'location' | 'trip' | 'day' | 'sensor';

type Capabilities = {
  serverType: string;
  serverVersion: string;
  nativeApi: boolean;
  originalMonitor: {
    vehicleStateButton: boolean;
    mapResetButton: boolean;
    detailTabs: boolean;
    vehicleDrawer: boolean;
  };
};

const A = '/ceiba-original/';

function validPosition(v: Vehicle) {
  return Number.isFinite(v.lat) && Number.isFinite(v.lng) &&
    v.lat !== null && v.lng !== null && (v.lat !== 0 || v.lng !== 0);
}

function statusIcon(v: Vehicle) {
  if (v.status === 'alarm') return A + 'car_warning_icon.png';
  if (v.status === 'offline') return A + 'car_offline_icon.png';
  return A + 'car_icon.png';
}

function markerHtml(v: Vehicle) {
  const state = v.status === 'alarm' ? 'alarm' : v.status === 'offline' ? 'offline' : 'online';
  return `<div class="ceiba-marker ceiba-marker-${state}">
    <div class="ceiba-marker-ring"></div>
    <div class="ceiba-marker-body" style="transform:rotate(${Number(v.heading || 0)}deg)">
      <img src="${statusIcon(v)}" alt="" />
    </div>
    <div class="ceiba-marker-label">${String(v.unitNumber || '').replace(/</g, '&lt;')}</div>
  </div>`;
}

function displayRows(data: any): Array<[string, string]> {
  if (!data) return [['-', '-']];
  const source = Array.isArray(data) ? data : Object.entries(data);
  if (Array.isArray(data)) {
    return data.slice(0, 40).map((item: any, index) => {
      if (item && typeof item === 'object') {
        const title = String(item.title ?? item.name ?? item.key ?? `#${index + 1}`);
        const value = String(item.value ?? item.state ?? item.status ?? JSON.stringify(item));
        return [title, value];
      }
      return [`#${index + 1}`, String(item)];
    });
  }
  return (source as Array<[string, any]>)
    .filter(([key]) => !['vehicle', 'plate'].includes(key))
    .slice(0, 40)
    .map(([key, value]) => [
      key.replace(/([A-Z])/g, ' $1').replace(/^./, x => x.toUpperCase()),
      value == null || value === '' ? '-' : typeof value === 'object' ? JSON.stringify(value) : String(value)
    ]);
}

export default function Monitor({ token, username, onLogout }: Props) {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [vehicleStateOpen, setVehicleStateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailSection, setDetailSection] = useState<DetailSection>('location');
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [liveOpen, setLiveOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [stateQuery, setStateQuery] = useState('');
  const [sortMode, setSortMode] = useState<'plate' | 'time'>('time');
  const [sortAsc, setSortAsc] = useState(false);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);

  const selected = useMemo(
    () => vehicles.find(v => v.id === selectedId) || null,
    [vehicles, selectedId]
  );

  const filteredVehicles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter(v =>
      [v.unitNumber, v.plate, v.route].some(x => String(x || '').toLowerCase().includes(q))
    );
  }, [vehicles, query]);

  const groups = useMemo(() => {
    const map = new Map<string, Vehicle[]>();
    for (const v of filteredVehicles) {
      const group = v.route || 'Sin grupo';
      const list = map.get(group) || [];
      list.push(v);
      map.set(group, list);
    }
    return [...map.entries()];
  }, [filteredVehicles]);

  const stateVehicles = useMemo(() => {
    const q = stateQuery.trim().toLowerCase();
    const list = vehicles.filter(v =>
      !q || [v.unitNumber, v.plate, v.route].some(x => String(x || '').toLowerCase().includes(q))
    );
    return [...list].sort((a, b) => {
      const value = sortMode === 'plate'
        ? String(a.unitNumber).localeCompare(String(b.unitNumber))
        : String(a.lastUpdate || '').localeCompare(String(b.lastUpdate || ''));
      return sortAsc ? value : -value;
    });
  }, [vehicles, stateQuery, sortMode, sortAsc]);

  async function authFetch(url: string) {
    const response = await fetch(apiUrl(url), { headers: { Authorization: `Bearer ${token}` } });
    if (response.status === 401) {
      onLogout();
      throw new Error('Sesion expirada');
    }
    return response;
  }

  async function loadVehicles() {
    const response = await authFetch('/api/monitor/vehicles');
    if (!response.ok) throw new Error('No se pudieron cargar los vehiculos');
    const data = await response.json();
    if (!Array.isArray(data)) return;
    setVehicles(data);
    setSelectedIds(prev => prev.size ? prev : new Set(data.map((v: Vehicle) => v.id)));
  }

  async function loadCapabilities() {
    const response = await authFetch('/api/monitor/capabilities');
    if (response.ok) setCapabilities(await response.json());
  }

  async function loadDetail(section: DetailSection) {
    if (!selected) return;
    setDetailSection(section);
    setDetailLoading(true);
    try {
      const response = await authFetch(
        `/api/monitor/vehicle/${encodeURIComponent(selected.id)}/detail?section=${section}`
      );
      const payload = await response.json();
      setDetailData(payload?.data ?? null);
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    void Promise.all([loadVehicles(), loadCapabilities()]).catch(() => {});
    const es = new EventSource(apiUrl(`/api/monitor/stream?access_token=${encodeURIComponent(token)}`));
    es.onmessage = event => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'telemetry_update' && Array.isArray(payload.vehicles)) {
          setVehicles(payload.vehicles);
          return;
        }
        if (payload.type === 'gps_event' && payload.data?.deviceno) {
          const data = payload.data;
          const lat = Number(data.lat);
          const lng = Number(data.lng);
          const speed = Math.max(0, Number(data.speed) || 0);
          setVehicles(prev => prev.map(vehicle => {
            if (String(vehicle.mdvrId || '') !== String(data.deviceno)) return vehicle;
            const status = Number(data.state) === 2 ? 'alarm' : speed > 5 ? 'moving' : 'stopped';
            return {
              ...vehicle,
              lat: Number.isFinite(lat) ? lat : vehicle.lat,
              lng: Number.isFinite(lng) ? lng : vehicle.lng,
              speed,
              heading: Number(data.direction) || 0,
              lastUpdate: String(data.dateTime || vehicle.lastUpdate || ''),
              relativeTime: 'ahora',
              status,
              statusText: status === 'alarm' ? 'Alarma activa' : speed > 5 ? `Moviendo - ${speed} km/h` : 'Detenido',
              altitudeMeters: Number.isFinite(Number(data.altitude)) ? Number(data.altitude) : vehicle.altitudeMeters
            };
          }));
          return;
        }
        if (payload.type === 'state_event' && payload.data?.deviceno) {
          const data = payload.data;
          setVehicles(prev => prev.map(vehicle => {
            if (String(vehicle.mdvrId || '') !== String(data.deviceno)) return vehicle;
            const state = Number(data.state);
            const status = state === 2 ? 'alarm' : state === 0 ? 'offline' : vehicle.speed > 5 ? 'moving' : 'online';
            return {
              ...vehicle,
              status,
              statusText: status === 'alarm' ? 'Alarma activa' : status === 'offline' ? 'Sin conexion' : vehicle.speed > 5 ? `Moviendo - ${vehicle.speed} km/h` : 'Conectado'
            };
          }));
          return;
        }
        if (payload.type === 'alarm_event' && payload.data?.deviceno) {
          const data = payload.data;
          setVehicles(prev => prev.map(vehicle => {
            if (String(vehicle.mdvrId || '') !== String(data.deviceno)) return vehicle;
            return {
              ...vehicle,
              status: 'alarm',
              statusText: data.type != null ? `Alarma tipo ${data.type}` : 'Alarma activa'
            };
          }));
        }
      } catch {}
    };
    return () => es.close();
  }, [token]);

  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) return;
    const map = L.map(mapNodeRef.current, { zoomControl: false, attributionControl: false })
      .setView([-3.99, -79.20], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
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
    const visible = vehicles.filter(v => selectedIds.has(v.id) && validPosition(v));
    const seen = new Set<string>();

    for (const vehicle of visible) {
      seen.add(vehicle.id);
      const point: L.LatLngExpression = [vehicle.lat as number, vehicle.lng as number];
      let marker = markersRef.current.get(vehicle.id);
      const icon = L.divIcon({
        className: 'ceiba-marker-host',
        html: markerHtml(vehicle),
        iconSize: [74, 58],
        iconAnchor: [37, 30]
      });
      if (!marker) {
        marker = L.marker(point, { icon, riseOnHover: true })
          .addTo(map)
          .on('click', () => setSelectedId(vehicle.id));
        markersRef.current.set(vehicle.id, marker);
      } else {
        marker.setLatLng(point);
        marker.setIcon(icon);
      }
    }

    for (const [id, marker] of markersRef.current) {
      if (!seen.has(id)) {
        map.removeLayer(marker);
        markersRef.current.delete(id);
      }
    }
  }, [vehicles, selectedIds]);

  function toggleVehicle(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function focusVehicle(v: Vehicle) {
    setSelectedId(v.id);
    setDrawerOpen(false);
    if (validPosition(v) && mapRef.current) {
      mapRef.current.setView([v.lat as number, v.lng as number], 16);
    }
  }

  function resetMap() {
    const points = vehicles
      .filter(v => selectedIds.has(v.id) && validPosition(v))
      .map(v => [v.lat as number, v.lng as number] as [number, number]);
    if (!mapRef.current || !points.length) return;
    if (points.length === 1) mapRef.current.setView(points[0], 16);
    else mapRef.current.fitBounds(points, { padding: [25, 25], maxZoom: 16 });
  }

  function openDetail() {
    setDetailOpen(true);
    void loadDetail('location');
  }

  if (liveOpen && selected) {
    return <OriginalLiveVideo token={token} vehicle={selected} onBack={() => setLiveOpen(false)} />;
  }

  return (
    <div className="ceiba-monitor">
      <div className="ceiba-map-layout">
        <div ref={mapNodeRef} className="ceiba-map" />

        <button className="ceiba-original-button ceiba-btn-vehicle" onClick={() => setDrawerOpen(true)}>
          <img src={A + 'car_btn_bg_selected.png'} alt="Vehiculos" />
        </button>

        {capabilities?.originalMonitor.vehicleStateButton && (
          <button className="ceiba-original-button ceiba-btn-state" onClick={() => setVehicleStateOpen(true)}>
            <img src={A + 'ic_list_car.png'} alt="Estado de vehiculos" />
          </button>
        )}

        {capabilities?.originalMonitor.mapResetButton && (
          <button className="ceiba-original-button ceiba-btn-reset" onClick={resetMap}>
            <img src={A + 'ic_map_reset.png'} alt="Restablecer mapa" />
          </button>
        )}
      </div>

      <aside className={`ceiba-drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="ceiba-drawer-title">Vehiculos</div>
        <div className="ceiba-drawer-search-row">
          <button className="ceiba-refresh" onClick={() => void loadVehicles()} aria-label="Actualizar">↻</button>
          <div className="ceiba-search-box">
            <input value={query} onChange={e => setQuery(e.target.value)} maxLength={100} />
            <img src={A + 'search_icon.png'} alt="" />
          </div>
        </div>
        <div className="ceiba-divider" />
        <div className="ceiba-tree">
          {groups.map(([group, items]) => (
            <div className="ceiba-tree-group" key={group}>
              <div className="ceiba-tree-group-title">{group}</div>
              {items.map(v => (
                <div className="ceiba-tree-row" key={v.id}>
                  <label className="ceiba-check">
                    <input type="checkbox" checked={selectedIds.has(v.id)} onChange={() => toggleVehicle(v.id)} />
                  </label>
                  <img src={statusIcon(v)} alt="" />
                  <button onClick={() => focusVehicle(v)}>
                    <strong>{v.unitNumber}</strong>
                    <span>{v.relativeTime || v.lastUpdate || ''}</span>
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
        <button className="ceiba-drawer-logout" onClick={onLogout}>Cerrar sesion · {username}</button>
      </aside>
      {drawerOpen && <button className="ceiba-drawer-overlay" onClick={() => setDrawerOpen(false)} />}

      {selected && (
        <section className="ceiba-map-popup">
          <div className="ceiba-pop-title-row">
            <div className="ceiba-pop-title">{selected.unitNumber}</div>
            <button className="ceiba-preview-button" title="Vista previa" onClick={() => setLiveOpen(true)} disabled={!selected.channels?.length}>
              <img src={A + 'marker_video_selected.png'} alt="" />
              <span>Preview</span>
            </button>
          </div>
          <div className="ceiba-pop-line"><span>Grupo</span><strong>{selected.route || '-'}</strong></div>
          <div className="ceiba-pop-line"><span>Tiempo</span><strong>{selected.lastUpdate || '-'}</strong></div>
          <div className="ceiba-pop-line"><span>Velocidad</span><strong>{selected.speed} km/h</strong></div>
          <div className="ceiba-pop-line ceiba-pop-location">
            <span>Ubicacion</span>
            <strong>{validPosition(selected) ? `${selected.lat}, ${selected.lng}` : '-'}</strong>
            <button onClick={openDetail}><img src={A + 'ic_show_detail.png'} alt="Detalle" /></button>
          </div>
          {selected.status === 'alarm' && (
            <div className="ceiba-pop-line"><span>Alarma</span><strong>{selected.statusText}</strong></div>
          )}
          <div className="ceiba-pop-actions">
            <button><img src={A + 'marker_playback.png'} alt="" /><span>Playback</span></button>
            <button><img src={A + 'marker_text.png'} alt="" /><span>Mensaje</span></button>
            <button><img src={A + 'marker_capture.png'} alt="" /><span>Captura</span></button>
            <button><img src={A + 'marker_intercom.png'} alt="" /><span>Hablar</span></button>
          </div>
        </section>
      )}

      {vehicleStateOpen && (
        <section className="ceiba-fullscreen-panel ceiba-vehicle-state">
          <div className="ceiba-state-top">
            <button onClick={() => setVehicleStateOpen(false)}><img src={A + 'alarm_back.png'} alt="Atras" /></button>
            <div className="ceiba-state-search">
              <input value={stateQuery} onChange={e => setStateQuery(e.target.value)} />
              <img src={A + 'search_icon.png'} alt="" />
            </div>
          </div>
          <div className="ceiba-state-sort">
            <button onClick={() => { setSortMode('plate'); setSortAsc(v => sortMode === 'plate' ? !v : true); }}>
              Placa <img src={A + (sortMode === 'plate' ? (sortAsc ? 'ic_arrow_default.png' : 'ic_arrow_down.png') : 'ic_arrow_default.png')} alt="" />
            </button>
            <button onClick={() => { setSortMode('time'); setSortAsc(v => sortMode === 'time' ? !v : false); }}>
              Tiempo <img src={A + (sortMode === 'time' ? (sortAsc ? 'ic_arrow_default.png' : 'ic_arrow_down.png') : 'ic_arrow_default.png')} alt="" />
            </button>
          </div>
          <div className="ceiba-state-list">
            {stateVehicles.map(v => (
              <button className="ceiba-state-item" key={v.id} onClick={() => { setVehicleStateOpen(false); focusVehicle(v); }}>
                <img src={statusIcon(v)} alt="" />
                <div>
                  <strong>{v.unitNumber} -- {v.speed} km/h</strong>
                  <span>{v.lastUpdate || ''}</span>
                  <small>{v.route || ''}</small>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {detailOpen && selected && (
        <section className="ceiba-fullscreen-panel ceiba-detail">
          <div className="ceiba-detail-head">
            <strong>{selected.unitNumber}</strong>
            <button onClick={() => setDetailOpen(false)}>Cerrar</button>
          </div>
          <div className="ceiba-detail-tabs">
            {([
              ['location', 'Ubicacion'],
              ['trip', 'Viaje'],
              ['day', 'Dia'],
              ['sensor', 'Sensor']
            ] as Array<[DetailSection, string]>).map(([key, label]) => (
              <button
                key={key}
                className={detailSection === key ? 'active' : ''}
                onClick={() => void loadDetail(key)}
              >{label}</button>
            ))}
          </div>
          <div className="ceiba-detail-list">
            {detailLoading
              ? <div className="ceiba-detail-loading">Cargando...</div>
              : displayRows(detailData).map(([label, value], index) => (
                  <div className="ceiba-detail-row" key={label + index}>
                    <span>{label}</span><strong>{value}</strong>
                  </div>
                ))
            }
          </div>
        </section>
      )}
    </div>
  );
}
