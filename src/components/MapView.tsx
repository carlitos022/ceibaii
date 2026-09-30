import React, { useEffect, useRef, useState } from 'react';
import { Vehicle, Geofence } from '../types';
import { Map as MapIcon, Globe, Target } from 'lucide-react';
import L from 'leaflet';

interface MapViewProps {
  vehicles: Vehicle[];
  geofences: Geofence[];
  selectedVehicle: Vehicle | null;
  onSelectVehicle: (vehicle: Vehicle) => void;
  onMapClick: () => void;
}

export const MapView: React.FC<MapViewProps> = ({
  vehicles,
  geofences,
  selectedVehicle,
  onSelectVehicle,
  onMapClick
}) => {
  const mapRootRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
    const markerTargetsRef = useRef<Record<string, [number, number]>>({});
  const markerIconsRef = useRef<Record<string, string>>({});
  const vehiclesRef = useRef(vehicles);
  vehiclesRef.current = vehicles;
  const geofenceLayersRef = useRef<L.LayerGroup | null>(null);
  const trailLayerRef = useRef<L.Polyline | null>(null);
  const userMovedMapRef = useRef(false);

  const [mapLayer, setMapLayer] = useState<'gm' | 'gh'>('gm');
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const capaLayersRef = useRef<Record<string, L.TileLayer> | null>(null);
  const androidApp = new URLSearchParams(window.location.search).get('app') === 'android';

  // Misma capa base liviana que Rastreo.
  function gLayer(lyrs: string) {
    return L.tileLayer('https://{s}.google.com/vt/lyrs=' + lyrs + '&x={x}&y={y}&z={z}', {
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'], maxZoom: 20, attribution: '&copy; Google Maps'
    });
  }

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Show Ecuador on first open; choosing a unit still moves the map to its GPS position.
    const map = L.map(mapContainerRef.current, {
      center: [-1.65, -78.4],
      zoom: 6,
      zoomControl: false,
      attributionControl: true
    });

    const capaLayers: Record<string, L.TileLayer> = {
      gm: gLayer('m'),
      gh: gLayer('y')
    };
    capaLayersRef.current = capaLayers;
    const initial = capaLayers[mapLayer] || capaLayers.gm;
    initial.addTo(map);
    tileLayerRef.current = initial;

    L.control.zoom({ position: 'topleft' }).addTo(map);

    const geofenceGroup = L.layerGroup().addTo(map);
    geofenceLayersRef.current = geofenceGroup;

    map.on('zoomend', () => setShowLabels(map.getZoom() >= 11));
    map.on('click', () => {
      onMapClick();
    });
    if (androidApp) map.on('dragstart', () => { userMovedMapRef.current = true; });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersRef.current = {};
      markerTargetsRef.current = {};
      markerIconsRef.current = {};
      geofenceLayersRef.current = null;
      trailLayerRef.current = null;
      tileLayerRef.current = null;
      capaLayersRef.current = null;
    };
  }, []);

  useEffect(() => {
    const resize = () => { if (mapContainerRef.current?.clientWidth && mapContainerRef.current?.clientHeight) mapInstanceRef.current?.invalidateSize({ animate: false }); };
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    if (mapRootRef.current) observer?.observe(mapRootRef.current);
    const frame = requestAnimationFrame(resize);
    const settle = window.setTimeout(resize, 250);
    window.addEventListener('resize', resize);
    window.addEventListener('pageshow', resize);
    document.addEventListener('visibilitychange', resize);
    return () => { cancelAnimationFrame(frame); window.clearTimeout(settle); observer?.disconnect(); window.removeEventListener('resize', resize); window.removeEventListener('pageshow', resize); document.removeEventListener('visibilitychange', resize); };
  }, []);

  // Handle Layer change
  useEffect(() => {
    if (!mapInstanceRef.current || !capaLayersRef.current) return;
    const capaLayers = capaLayersRef.current;
    const target = capaLayers[mapLayer];
    if (!target || tileLayerRef.current === target) return;
    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }
    target.addTo(mapInstanceRef.current);
    tileLayerRef.current = target;
  }, [mapLayer]);

  // Render Geofences (circles for real miritrans fences, polygons for mock)
  useEffect(() => {
    if (!mapInstanceRef.current || !geofenceLayersRef.current) return;

    geofenceLayersRef.current.clearLayers();

    geofences.forEach((geo) => {
      let layer: L.Layer;
      if (geo.center && geo.radiusMeters) {
        const circle = L.circle(geo.center as [number, number], {
          radius: geo.radiusMeters,
          color: geo.color,
          fillColor: geo.color,
          fillOpacity: 0.08,
          weight: 2,
          dashArray: '6, 4'
        });
        circle.bindTooltip(
          `<div class="text-[10px] font-mono font-bold text-slate-200">${escapeHtml(geo.name)} • ${geo.radiusMeters}m</div>`,
          { permanent: false, direction: 'center', className: 'bg-transparent border-0 shadow-none' }
        );
        const dot = L.circleMarker(geo.center as [number, number], {
          radius: 4,
          color: geo.color,
          fillColor: geo.color,
          fillOpacity: 1,
          weight: 2
        });
        dot.bindTooltip(`<div class="text-[10px] font-mono font-bold text-white">${escapeHtml(geo.name)}</div>`, { permanent: false, direction: 'top' });
        dot.addTo(geofenceLayersRef.current!);
        layer = circle;
      } else {
        const polygon = L.polygon(geo.coordinates, {
          color: geo.color,
          fillColor: geo.color,
          fillOpacity: 0.12,
          weight: 2,
          dashArray: '4, 6'
        });
        polygon.bindTooltip(
          `<div class="text-[10px] font-mono font-bold text-slate-200">${escapeHtml(geo.name)}</div>`,
          { permanent: false, direction: 'center', className: 'bg-transparent border-0 shadow-none' }
        );
        layer = polygon;
      }
      layer.addTo(geofenceLayersRef.current!);
    });
  }, [geofences]);

  const escapeHtml = (value: string) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));

  // Render / Update Vehicle Markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const visibleIds = new Set(vehicles.filter(v => v.lat !== null && v.lng !== null).map(v => v.id));
    for (const id of Object.keys(markersRef.current)) {
      if (!visibleIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
        delete markerTargetsRef.current[id];
        delete markerIconsRef.current[id];
      }
    }
    vehicles.forEach((vehicle) => {
      if (vehicle.lat === null || vehicle.lng === null) return;
      const isSelected = selectedVehicle?.id === vehicle.id;
      
      let badgeColor = '#6b7280';
      let statusSubtitle = vehicle.statusText;

      if (vehicle.status === 'moving') {
        badgeColor = '#22c55e';
        statusSubtitle = `${vehicle.speed} km/h`;
      } else if (vehicle.status === 'stopped') {
        badgeColor = '#ef4444';
        statusSubtitle = 'Detenido';
      } else if (vehicle.status === 'online') {
        badgeColor = '#38bdf8';
        statusSubtitle = 'En Línea';
      } else {
        badgeColor = '#64748b';
        statusSubtitle = 'Sin conexión';
      }

      const iconSubtitle = androidApp && vehicle.status === 'moving' ? 'En movimiento' : statusSubtitle;
      const heading = Number.isFinite(vehicle.heading) ? Math.round(vehicle.heading / 15) * 15 : 0;
      const iconKey = `${vehicle.status}|${heading}|${vehicle.unitNumber}|${isSelected}|${showLabels}`;
      const previousTarget = markerTargetsRef.current[vehicle.id];
      const positionUnchanged = previousTarget?.[0] === vehicle.lat && previousTarget?.[1] === vehicle.lng;
      if (positionUnchanged && markerIconsRef.current[vehicle.id] === iconKey) return;
      const needsIcon = markerIconsRef.current[vehicle.id] !== iconKey;
      const customIcon = needsIcon ? makeIcon() : undefined;

      function makeIcon() {
        const rotation = Number.isFinite(vehicle.heading) ? Math.round(vehicle.heading / 15) * 15 : 0;
        const label = (isSelected || showLabels)
          ? '<span style="display:block;max-width:90px;margin-top:2px;padding:1px 3px;border-radius:4px;background:#061d2be8;color:#fff;font:600 9px sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escapeHtml(vehicle.unitNumber) + '</span>'
          : '';
        const html = '<div style="display:flex;align-items:center;flex-direction:column;filter:drop-shadow(0 2px 2px #0b2c4055)">' +
          '<div style="width:24px;height:30px;display:grid;place-items:center;color:' + badgeColor + ';transform:rotate(' + rotation + 'deg);' +
          (isSelected ? 'outline:2px solid #00d1ff;border-radius:6px;' : '') + '">' +
          '<svg viewBox="0 0 32 44" width="19" height="27" aria-hidden="true">' +
          '<path d="M9 2h14c4 0 6 3 6 7v27c0 4-3 6-6 6H9c-3 0-6-2-6-6V9c0-4 2-7 6-7Z" fill="currentColor" stroke="#fff" stroke-width="2"/>' +
          '<path d="M7 11c0-2 1-3 3-3h12c2 0 3 1 3 3v8H7Z" fill="#dff7ff"/>' +
          '<path d="M8 25h16v9H8Z" fill="#113447" opacity=".6"/>' +
          '<circle cx="9" cy="37" r="2" fill="#fef3c7"/><circle cx="23" cy="37" r="2" fill="#fef3c7"/>' +
          '</svg></div>' + label + '</div>';
        return L.divIcon({ html, className: 'custom-vehicle-marker', iconSize: [32, 35], iconAnchor: [16, 17] });
      }

      if (markersRef.current[vehicle.id]) {
        const existingMarker = markersRef.current[vehicle.id];
        const previousTarget = markerTargetsRef.current[vehicle.id];
        if (previousTarget && previousTarget[0] === vehicle.lat && previousTarget[1] === vehicle.lng) {
          if (markerIconsRef.current[vehicle.id] !== iconKey) {
            existingMarker.setIcon(customIcon);
            markerIconsRef.current[vehicle.id] = iconKey;
            existingMarker.setZIndexOffset(isSelected ? 1000 : 100);
          }
          return;
        }
        markerTargetsRef.current[vehicle.id] = [vehicle.lat, vehicle.lng];
        const target = L.latLng(vehicle.lat, vehicle.lng);
        const markerElement = existingMarker.getElement();
        const fixTime = Date.parse(String(vehicle.lastUpdate || '').replace(' ', 'T') + '-05:00');
        const animateGps = vehicle.status === 'moving' && Number.isFinite(fixTime) && Date.now() - fixTime < 120000 &&
          previousTarget && Math.abs(previousTarget[0] - vehicle.lat) < 0.003 && Math.abs(previousTarget[1] - vehicle.lng) < 0.003;
        if (markerElement && animateGps) {
          markerElement.style.transition = 'transform 900ms linear';
          window.setTimeout(() => { if (markerElement.isConnected) markerElement.style.transition = ''; }, 950);
        }
        existingMarker.setLatLng(target);
        if (markerIconsRef.current[vehicle.id] !== iconKey) existingMarker.setIcon(customIcon);
        markerIconsRef.current[vehicle.id] = iconKey;
        existingMarker.setZIndexOffset(isSelected ? 1000 : 100);
      } else {
        const marker = L.marker([vehicle.lat, vehicle.lng], {
          icon: customIcon!,
          zIndexOffset: isSelected ? 1000 : 100
        });

        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          const latestVehicle = vehiclesRef.current.find((item) => item.id === vehicle.id) || vehicle;
          onSelectVehicle(latestVehicle);
        });

        marker.addTo(mapInstanceRef.current!);
        markersRef.current[vehicle.id] = marker;
        markerTargetsRef.current[vehicle.id] = [vehicle.lat, vehicle.lng];
        markerIconsRef.current[vehicle.id] = iconKey;
      }
    });

    if (selectedVehicle && selectedVehicle.trail && selectedVehicle.trail.length > 1) {
      if (trailLayerRef.current) {
        trailLayerRef.current.setLatLngs(selectedVehicle.trail);
      } else {
        trailLayerRef.current = L.polyline(selectedVehicle.trail, {
          color: '#00d1ff',
          weight: 3,
          dashArray: '5, 5',
          opacity: 0.8
        }).addTo(mapInstanceRef.current);
      }
    } else if (trailLayerRef.current) {
      trailLayerRef.current.remove();
      trailLayerRef.current = null;
    }
  }, [vehicles, selectedVehicle, showLabels]);

  const lastCenteredVehicleRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedVehicle) {
      lastCenteredVehicleRef.current = null;
      return;
    }
    const map = mapInstanceRef.current;
    if (!map || selectedVehicle.lat == null || selectedVehicle.lng == null) return;
    const position = L.latLng(selectedVehicle.lat, selectedVehicle.lng);
    const selectedChanged = lastCenteredVehicleRef.current !== selectedVehicle.id;
    lastCenteredVehicleRef.current = selectedVehicle.id;
    if (selectedChanged) userMovedMapRef.current = false;
    if (selectedChanged) map.panTo(position, { animate: false });
  }, [selectedVehicle?.id, selectedVehicle?.lat, selectedVehicle?.lng]);

  const toggleFullscreen = () => {
    const root = mapRootRef.current;
    if (!root) return;
    const params = new URLSearchParams(window.location.search);
    const nativeBridge = (params.get('embed') === 'vivo' || params.get('app') === 'android')
      ? (window as Window & { CSRSVivoNative?: { setMapFullscreen: (expand: boolean) => void } }).CSRSVivoNative
      : undefined;
    if (isFullscreen) {
      setIsFullscreen(false);
      if (nativeBridge) nativeBridge.setMapFullscreen(false);
      else if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    } else {
      setIsFullscreen(true);
      if (nativeBridge) nativeBridge.setMapFullscreen(true);
      else if (root.requestFullscreen) void root.requestFullscreen().catch(() => {});
    }
    window.setTimeout(() => mapInstanceRef.current?.invalidateSize({ animate: false }), 100);
  };

  useEffect(() => {
    const syncFullscreen = () => {
      if (!document.fullscreenElement) setIsFullscreen(false);
      window.setTimeout(() => mapInstanceRef.current?.invalidateSize({ animate: false }), 100);
    };
    const nativeExit = () => {
      setIsFullscreen(false);
      window.setTimeout(() => mapInstanceRef.current?.invalidateSize({ animate: false }), 100);
    };
    document.addEventListener('fullscreenchange', syncFullscreen);
    window.addEventListener('csrs-native-fullscreen-exit', nativeExit);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen);
      window.removeEventListener('csrs-native-fullscreen-exit', nativeExit);
    };
  }, []);

  // Ajustar el mapa para mostrar toda la flota (centra y da zoom a los bounds de todos los vehículos reales)
  const fitToFleet = () => {
    if (!mapInstanceRef.current) return;
    const latLngs = vehicles
      .filter((v) => v.lat !== null && v.lng !== null)
      .map((v) => [v.lat!, v.lng!] as L.LatLngExpression);
    if (latLngs.length === 0) return;
    try {
      mapInstanceRef.current.fitBounds(latLngs, {
        padding: [60, 60],
        animate: true,
        duration: 0.6,
        maxZoom: 14
      });
    } catch {}
  };

  return (
    <div ref={mapRootRef} className={isFullscreen ? "fixed inset-0 z-[2000] w-screen h-screen overflow-hidden bg-[#000f20]" : "relative w-full h-full overflow-hidden bg-[#000f20]"}>
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {selectedVehicle && (
        <div className="absolute top-16 left-4 z-20 pointer-events-none">
          <div className="bg-[#000f20]/90 border border-[#48c7ed]/35 px-2.5 py-1 rounded shadow-sm flex items-center space-x-2">
            <span className={`w-2 h-2 rounded-full ${selectedVehicle.status === 'moving' ? 'bg-emerald-400' : selectedVehicle.status === 'offline' ? 'bg-slate-500' : selectedVehicle.status === 'stopped' ? 'bg-red-400' : 'bg-sky-400'}`} />
            <span className="font-mono text-xs font-bold text-cyan-200">
              {selectedVehicle.speed} km/h
            </span>
            <span className="text-[10px] font-mono text-slate-400 border-l border-[#293a50] pl-2">
              {selectedVehicle.unitNumber}
            </span>
          </div>
        </div>
      )}

      <div className="absolute top-[14px] right-[12px] z-[1000] flex flex-col gap-[10px] select-none">
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsLayerMenuOpen(open => !open)}
            className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-[#48c7ed]/60 bg-[#203044]/90 text-white shadow-[0_3px_12px_rgba(0,0,0,0.35)] backdrop-blur-sm transition-colors hover:bg-[#294966] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#48c7ed] sm:h-[52px] sm:w-[52px]"
            title="Elegir capa del mapa"
            aria-label="Elegir capa del mapa"
            aria-expanded={isLayerMenuOpen}
          >
            <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 8 12 4 21 8 12 12Z" />
              <path d="M3 13 12 9 21 13 12 17Z" />
              <path d="M3 17 12 13 21 17 12 21Z" />
            </svg>
          </button>
          {isLayerMenuOpen && (
            <div className="absolute right-[calc(100%+8px)] top-0 w-44 max-w-[calc(100vw-76px)] rounded-[10px] border border-[#48c7ed]/40 bg-[#10263a]/95 p-1.5 text-white shadow-xl backdrop-blur-md" role="menu" aria-label="Capas del mapa">
              <span className="block px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[#83ddeb]">Capa del mapa</span>
              {[
                { id: 'gm', label: 'Calles', icon: MapIcon },
                { id: 'gh', label: 'Satelite con calles', icon: Globe },
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={mapLayer === opt.id}
                  onClick={() => { setMapLayer(opt.id as 'gm' | 'gh'); setIsLayerMenuOpen(false); }}
                  className={mapLayer === opt.id
                    ? 'flex w-full items-center gap-2 rounded-md bg-[#21476a] px-2 py-2 text-left text-xs text-[#83ddeb]'
                    : 'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs hover:bg-[#21476a]'}
                >
                  <opt.icon className="h-4 w-4 shrink-0" />
                  <span>{opt.label}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => { fitToFleet(); setIsLayerMenuOpen(false); }}
                className="mt-1 flex w-full items-center gap-2 border-t border-[#48c7ed]/20 px-2 py-2 text-left text-xs hover:bg-[#21476a]"
              >
                <Target className="h-4 w-4 shrink-0" />
                <span>Mostrar flota</span>
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={toggleFullscreen}
          className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-[#48c7ed]/60 bg-[#203044]/90 text-white shadow-[0_3px_12px_rgba(0,0,0,0.35)] backdrop-blur-sm transition-colors hover:bg-[#294966] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#48c7ed] sm:h-[52px] sm:w-[52px]"
          title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          aria-pressed={isFullscreen}
        >
          <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 9V3h6 M15 3h6v6 M3 15v6h6 M15 21h6v-6" />
          </svg>
        </button>
      </div>
    </div>
  );
};