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
  const markerAnimationsRef = useRef<Record<string, number>>({});
  const markerTargetsRef = useRef<Record<string, [number, number]>>({});
  const markerIconsRef = useRef<Record<string, string>>({});
  const vehiclesRef = useRef(vehicles);
  vehiclesRef.current = vehicles;
  const geofenceLayersRef = useRef<L.LayerGroup | null>(null);
  const trailLayerRef = useRef<L.Polyline | null>(null);

  const [mapLayer, setMapLayer] = useState<'gm' | 'gh'>('gm');
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const capaLayersRef = useRef<Record<string, L.TileLayer> | null>(null);

  // Helper like notificador.sytes.net
  function gLayer(lyrs: string, maxNative: number) {
    return L.tileLayer('https://{s}.google.com/vt/lyrs=' + lyrs + '&x={x}&y={y}&z={z}', {
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      maxZoom: 22,
      maxNativeZoom: maxNative,
      attribution: '&copy; Google Maps'
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
      attributionControl: false
    });

    const capaLayers: Record<string, L.TileLayer> = {
      gm: gLayer('m', 20),
      gh: gLayer('y', 19)
    };
    capaLayersRef.current = capaLayers;
    const initial = capaLayers[mapLayer] || capaLayers.gm;
    initial.addTo(map);
    tileLayerRef.current = initial;

    L.control.zoom({ position: 'topleft' }).addTo(map);

    const geofenceGroup = L.layerGroup().addTo(map);
    geofenceLayersRef.current = geofenceGroup;

    map.on('click', () => {
      onMapClick();
    });

    mapInstanceRef.current = map;

    return () => {
      Object.values(markerAnimationsRef.current).forEach((animation) => cancelAnimationFrame(animation as number));
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const resize = () => mapInstanceRef.current?.invalidateSize({ animate: false });
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
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
        if (markerAnimationsRef.current[id]) cancelAnimationFrame(markerAnimationsRef.current[id]);
        delete markerAnimationsRef.current[id];
        delete markerTargetsRef.current[id];
        delete markerIconsRef.current[id];
      }
    }
    vehicles.forEach((vehicle) => {
      if (vehicle.lat === null || vehicle.lng === null) return;
      const isSelected = selectedVehicle?.id === vehicle.id;
      
      let badgeColor = '#6b7280';
      let badgeBg = '#6b7280';
      let statusSubtitle = vehicle.statusText;

      if (vehicle.status === 'moving') {
        badgeColor = '#ff9100';
        badgeBg = '#ff9100';
        statusSubtitle = `${vehicle.speed} km/h`;
      } else if (vehicle.status === 'stopped') {
        badgeColor = '#ef4444';
        badgeBg = '#ff4444';
        statusSubtitle = 'Detenido';
      } else if (vehicle.status === 'online') {
        badgeColor = '#fbbf24';
        badgeBg = '#ffcc00';
        statusSubtitle = 'En Línea';
      } else {
        badgeColor = '#6b7280';
        badgeBg = '#757575';
        statusSubtitle = 'Sin conexión';
      }

      const iconHtml = `
        <div class="flex flex-col items-center cursor-pointer group select-none transition-transform duration-300 ${
          isSelected ? 'scale-115 z-50' : 'z-20 hover:scale-105'
        }">
          <div class="relative flex items-center justify-center">
            <div class="vehicle-status-pulse vehicle-status-pulse--${vehicle.status}" style="background-color: ${badgeBg};"></div>
            <div class="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center relative z-10 shadow-[0_0_12px_rgba(0,0,0,0.8)]" style="background-color: ${badgeBg}; ${
        isSelected ? 'box-shadow: 0 0 16px #00d1ff, 0 0 24px rgba(0,209,255,0.6);' : ''
      }">
              <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
              </svg>
            </div>
          </div>
          <div class="mt-1 bg-[#000f20]/95 backdrop-blur-md px-1.5 py-0.5 rounded border shadow-lg flex flex-col items-center text-center font-mono ${
            isSelected ? 'border-[#00d1ff] ring-1 ring-[#00d1ff]' : 'border-[#293a50]'
          }">
            <span class="font-bold text-[9px] text-white leading-tight">${escapeHtml(vehicle.unitNumber)}</span>
            <span class="text-[8px] leading-none" style="color: ${badgeColor}">${escapeHtml(statusSubtitle)}</span>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-vehicle-marker',
        iconSize: [60, 60],
        iconAnchor: [30, 20]
      });

      const iconKey = `${vehicle.status}|${statusSubtitle}|${vehicle.unitNumber}|${isSelected}`;
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
        const start = existingMarker.getLatLng();
        const previousAnimation = markerAnimationsRef.current[vehicle.id];
        if (previousAnimation) cancelAnimationFrame(previousAnimation);
        const distance = start.distanceTo(target);
        if (distance > 0.5) {
          const startedAt = performance.now();
          const duration = 2200;
          const animateMarker = (now: number) => {
            const progress = Math.min(1, (now - startedAt) / duration);
            const eased = progress * (2 - progress);
            existingMarker.setLatLng([
              start.lat + (target.lat - start.lat) * eased,
              start.lng + (target.lng - start.lng) * eased
            ]);
            if (progress < 1) {
              markerAnimationsRef.current[vehicle.id] = requestAnimationFrame(animateMarker);
            } else {
              delete markerAnimationsRef.current[vehicle.id];
            }
          };
          markerAnimationsRef.current[vehicle.id] = requestAnimationFrame(animateMarker);
        } else {
          existingMarker.setLatLng(target);
        }
        if (markerIconsRef.current[vehicle.id] !== iconKey) existingMarker.setIcon(customIcon);
        markerIconsRef.current[vehicle.id] = iconKey;
        existingMarker.setZIndexOffset(isSelected ? 1000 : 100);
      } else {
        const marker = L.marker([vehicle.lat, vehicle.lng], {
          icon: customIcon,
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
  }, [vehicles, selectedVehicle]);

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
    if (selectedChanged || !map.getBounds().pad(-0.15).contains(position)) {
      map.panTo(position, { animate: true, duration: 0.8 });
    }
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
        <div className="absolute top-16 left-4 z-20 pointer-events-none animate-in fade-in">
          <div className="bg-[#000f20]/90 backdrop-blur-md border border-[#ff9100]/50 px-2.5 py-1 rounded shadow-lg flex items-center space-x-2">
            <span className={`w-2 h-2 rounded-full ${selectedVehicle.status === 'moving' ? 'bg-[#ff9100] animate-ping' : selectedVehicle.status === 'offline' ? 'bg-slate-500' : 'bg-[#ef4444]'}`} />
            <span className="font-mono text-xs font-bold text-[#ff9100]">
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