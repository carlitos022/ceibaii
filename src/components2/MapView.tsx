import React, { useEffect, useRef, useState } from 'react';
import { Vehicle, Geofence } from '../types';
import { Maximize, Minimize, Layers, Map as MapIcon, Globe, Target } from 'lucide-react';
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
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const geofenceLayersRef = useRef<L.LayerGroup | null>(null);
  const trailLayerRef = useRef<L.Polyline | null>(null);

  const [mapLayer, setMapLayer] = useState<'calles' | 'gm' | 'gs' | 'gh' | 'esri'>('calles');
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

    const centerLat = selectedVehicle?.lat ?? vehicles[0]?.lat ?? -3.9928;
    const centerLng = selectedVehicle?.lng ?? vehicles[0]?.lng ?? -79.2845;

    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLng],
      zoom: 13,
      zoomControl: false,
      attributionControl: false
    });

    const capaLayers: Record<string, L.TileLayer> = {
      calles: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, maxNativeZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }),
      gm: gLayer('m', 20),
      gs: gLayer('s', 19),
      gh: gLayer('y', 19),
      esri: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 22, maxNativeZoom: 18,
        attribution: '&copy; Esri, Maxar, Earthstar Geographics'
      })
    };
    capaLayersRef.current = capaLayers;
    const initial = capaLayers[mapLayer] || capaLayers.calles;
    initial.addTo(map);
    tileLayerRef.current = initial;

    // Fallback a Esri si Google falla (como notificador)
    ['gm', 'gs', 'gh'].forEach(k => {
      capaLayers[k].on('tileerror', () => {
        if (tileLayerRef.current === capaLayers[k]) {
          map.removeLayer(capaLayers[k]);
          capaLayers.esri.addTo(map);
          tileLayerRef.current = capaLayers.esri;
          setMapLayer('esri');
        }
      });
    });

    L.control.zoom({ position: 'topleft' }).addTo(map);

    const geofenceGroup = L.layerGroup().addTo(map);
    geofenceLayersRef.current = geofenceGroup;

    map.on('click', () => {
      onMapClick();
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const resize = () => mapInstanceRef.current?.invalidateSize({ animate: false });
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Handle Layer change (calles / Google / Esri) - sin API key, como notificador
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
          `<div class="text-[10px] font-mono font-bold text-slate-200">${geo.name} • ${geo.radiusMeters}m</div>`,
          { permanent: false, direction: 'center', className: 'bg-transparent border-0 shadow-none' }
        );
        const dot = L.circleMarker(geo.center as [number, number], {
          radius: 4,
          color: geo.color,
          fillColor: geo.color,
          fillOpacity: 1,
          weight: 2
        });
        dot.bindTooltip(`<div class="text-[10px] font-mono font-bold text-white">${geo.name}</div>`, { permanent: false, direction: 'top' });
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
          `<div class="text-[10px] font-mono font-bold text-slate-200">${geo.name}</div>`,
          { permanent: false, direction: 'center', className: 'bg-transparent border-0 shadow-none' }
        );
        layer = polygon;
      }
      layer.addTo(geofenceLayersRef.current!);
    });
  }, [geofences]);

  // Render / Update Vehicle Markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    vehicles.forEach((vehicle) => {
      const isSelected = selectedVehicle?.id === vehicle.id;
      
      let badgeColor = '#6b7280';
      let badgeBg = '#6b7280';
      let statusSubtitle = vehicle.statusText;
      let isPulsing = false;

      if (vehicle.status === 'moving') {
        badgeColor = '#ff9100';
        badgeBg = '#ff9100';
        statusSubtitle = `${vehicle.speed} km/h`;
        isPulsing = true;
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
        statusSubtitle = 'Apagado';
      }

      const iconHtml = `
        <div class="flex flex-col items-center cursor-pointer group select-none transition-transform duration-300 ${
          isSelected ? 'scale-115 z-50' : 'z-20 hover:scale-105'
        }">
          <div class="relative flex items-center justify-center">
            ${
              isPulsing
                ? `<div class="absolute inset-0 rounded-full animate-ping opacity-75" style="background-color: ${badgeBg};"></div>`
                : ''
            }
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
            <span class="font-bold text-[9px] text-white leading-tight">${vehicle.unitNumber}</span>
            <span class="text-[8px] leading-none" style="color: ${badgeColor}">${statusSubtitle}</span>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-vehicle-marker',
        iconSize: [60, 60],
        iconAnchor: [30, 20]
      });

      if (markersRef.current[vehicle.id]) {
        const existingMarker = markersRef.current[vehicle.id];
        existingMarker.setLatLng([vehicle.lat, vehicle.lng]);
        existingMarker.setIcon(customIcon);
        existingMarker.setZIndexOffset(isSelected ? 1000 : 100);
      } else {
        const marker = L.marker([vehicle.lat, vehicle.lng], {
          icon: customIcon,
          zIndexOffset: isSelected ? 1000 : 100
        });

        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          if (selectedVehicle?.id === vehicle.id) {
            onMapClick();
          } else {
            onSelectVehicle(vehicle);
          }
        });

        marker.addTo(mapInstanceRef.current!);
        markersRef.current[vehicle.id] = marker;
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
    }
  }, [vehicles, selectedVehicle]);

  useEffect(() => {
    if (!mapInstanceRef.current || !selectedVehicle) return;

    mapInstanceRef.current.panTo([selectedVehicle.lat, selectedVehicle.lng], {
      animate: true,
      duration: 0.8
    });
  }, [selectedVehicle?.id]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Ajustar el mapa para mostrar toda la flota (centra y da zoom a los bounds de todos los vehículos reales)
  const fitToFleet = () => {
    if (!mapInstanceRef.current) return;
    const latLngs = vehicles
      .filter((v) => !Number.isNaN(v.lat) && !Number.isNaN(v.lng))
      .map((v) => [v.lat, v.lng] as L.LatLngExpression);
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
    <div className="relative w-full h-full overflow-hidden bg-[#000f20]">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {selectedVehicle && (
        <div className="absolute top-16 left-4 z-20 pointer-events-none animate-in fade-in">
          <div className="bg-[#000f20]/90 backdrop-blur-md border border-[#ff9100]/50 px-2.5 py-1 rounded shadow-lg flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-[#ff9100] animate-ping" />
            <span className="font-mono text-xs font-bold text-[#ff9100]">
              {selectedVehicle.speed} km/h
            </span>
            <span className="text-[10px] font-mono text-slate-400 border-l border-[#293a50] pl-2">
              {selectedVehicle.unitNumber}
            </span>
          </div>
        </div>
      )}

      <div className="absolute top-16 right-4 flex flex-col space-y-2 z-20 select-none">
        <button
          onClick={toggleFullscreen}
          className="bg-[#000f20]/90 backdrop-blur-md border border-[#293a50] p-3 rounded-xl shadow-xl text-slate-300 hover:text-white transition-all hover:border-[#00d1ff] active:scale-95 cursor-pointer"
          title="Pantalla Completa"
          aria-label="Alternar pantalla completa"
        >
          {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
        </button>

        <button
          onClick={fitToFleet}
          className="bg-[#000f20]/90 backdrop-blur-md border border-[#293a50] p-3 rounded-xl shadow-xl text-slate-300 hover:text-[#00d1ff] hover:border-[#00d1ff] transition-all active:scale-95 cursor-pointer"
          title="Ajustar a flota"
          aria-label="Ajustar mapa a toda la flota"
        >
          <Target className="w-6 h-6" />
        </button>

        <div className="relative">
          <button
            onClick={() => setIsLayerMenuOpen(!isLayerMenuOpen)}
            className={`bg-[#000f20]/90 backdrop-blur-md border p-3 rounded-xl shadow-xl transition-all cursor-pointer active:scale-95 ${
              isLayerMenuOpen
                ? 'border-[#00d1ff] text-[#00d1ff] shadow-[0_0_12px_rgba(0,209,255,0.3)]'
                : 'border-[#293a50] text-slate-300 hover:text-white hover:border-[#00d1ff]'
            }`}
            title="Capas del Mapa (sin API, como notificador.sytes.net)"
          >
            <Layers className="w-6 h-6" />
          </button>

          {isLayerMenuOpen && (
            <div className="absolute top-0 right-14 w-52 bg-[#000f20] border border-[#293a50] rounded-xl shadow-2xl z-30 flex flex-col p-1.5 animate-in fade-in zoom-in-95">
              <div className="text-[10px] font-mono text-slate-500 px-2 py-1 uppercase tracking-wider">Capas (sin API)</div>
              {[
                { id: 'calles', label: 'Calles OSM', icon: MapIcon, color: '#00d1ff' },
                { id: 'gm', label: 'Google Mapas', icon: MapIcon, color: '#4285f4' },
                { id: 'gs', label: 'Google Satélite', icon: Globe, color: '#34a853' },
                { id: 'gh', label: 'Google Híbrido', icon: Globe, color: '#fbbc05' },
                { id: 'esri', label: 'Esri Satélite', icon: Globe, color: '#34d399' },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setMapLayer(opt.id as any);
                    setIsLayerMenuOpen(false);
                  }}
                  className={`flex items-center space-x-2.5 px-3 py-2 text-xs rounded-lg transition-colors cursor-pointer ${
                    mapLayer === opt.id
                      ? 'bg-[#011428] text-[#00d1ff] font-semibold border border-[#00d1ff]/30'
                      : 'text-slate-300 hover:bg-slate-800/60'
                  }`}
                >
                  <opt.icon className="w-4 h-4" style={{ color: opt.color }} />
                  <span>{opt.label}</span>
                </button>
              ))}
              <div className="text-[9px] font-mono text-slate-600 px-2 pt-1">Usa Google/Esri sin API key, con fallback a Esri si falla.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
