import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Vehicle, GpsTrackPoint, EvidenceTrackData } from '../types';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Scissors,
  Layers,
  Map as MapIcon,
  Globe,
  Plus,
  Minus,
  Navigation,
  Calendar as CalendarIcon,
  Download,
  CheckCircle2,
  X,
  Clock,
  Sparkles,
  ChevronDown
} from 'lucide-react';

interface EvidenceTrackerViewProps {
  vehicles: Vehicle[];
  initialVehicle?: Vehicle | null;
  onExportClip?: (unitNumber: string, startTime: string, endTime: string, date: string) => void;
  onNavigateToVivo?: (vehicle: Vehicle) => void;
}

export const EvidenceTrackerView: React.FC<EvidenceTrackerViewProps> = ({
  vehicles,
  initialVehicle,
  onExportClip
}) => {
  // Select active vehicle
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(
    initialVehicle?.id || vehicles[0]?.id || 'unit-03'
  );

  const selectedVehicle = useMemo(() => {
    return vehicles.find((v) => v.id === selectedVehicleId) || vehicles[0];
  }, [vehicles, selectedVehicleId]);

  // Selected date for route history
  const [selectedDate, setSelectedDate] = useState<string>('2026-08-18');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);

  // Track data
  const [trackData, setTrackData] = useState<EvidenceTrackData | null>(null);
  const [isLoadingTrack, setIsLoadingTrack] = useState<boolean>(false);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1); // 1x, 2x, 5x, 10x
  const [currentPointIndex, setCurrentPointIndex] = useState<number>(65); // ~12:42:00

  // Cutting / Range Selection
  const [isCutModalOpen, setIsCutModalOpen] = useState<boolean>(false);
  const [cutRangeStart, setCutRangeStart] = useState<number>(60); // index
  const [cutRangeEnd, setCutRangeEnd] = useState<number>(75); // index
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Map state
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const vehicleMarkerRef = useRef<L.Marker | null>(null);
  const startMarkerRef = useRef<L.Marker | null>(null);
  const endMarkerRef = useRef<L.Marker | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [mapLayer, setMapLayer] = useState<'dark' | 'satellite'>('dark');
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);

  // Fetch track data when vehicle or date changes
  useEffect(() => {
    if (!selectedVehicle) return;

    let isMounted = true;
    setIsLoadingTrack(true);

    fetch(`/api/gps-track/${selectedVehicle.unitNumber}?date=${selectedDate}`)
      .then((r) => r.json())
      .then((data: EvidenceTrackData) => {
        if (!isMounted) return;
        setTrackData(data);
        setIsLoadingTrack(false);
        // Default to a realistic midday position (around 12:42:15)
        const defaultIdx = Math.min(65, (data.points?.length || 1) - 1);
        setCurrentPointIndex(defaultIdx);
        setCutRangeStart(Math.max(0, defaultIdx - 5));
        setCutRangeEnd(Math.min((data.points?.length || 1) - 1, defaultIdx + 8));
      })
      .catch((err) => {
        console.error('Error fetching GPS track:', err);
        if (isMounted) setIsLoadingTrack(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedVehicle?.unitNumber, selectedDate]);

  // Current active waypoint point
  const currentPoint: GpsTrackPoint | undefined = useMemo(() => {
    if (!trackData || !trackData.points || trackData.points.length === 0) return undefined;
    return trackData.points[Math.min(currentPointIndex, trackData.points.length - 1)];
  }, [trackData, currentPointIndex]);

  // Timeline formatted time string
  const currentFormattedTime = useMemo(() => {
    if (!currentPoint) return '12:42:15';
    const parts = currentPoint.timestamp.split(' ');
    return parts[1] || '12:42:15';
  }, [currentPoint]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialLat = selectedVehicle?.lat || -3.9928;
    const initialLng = selectedVehicle?.lng || -79.2845;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 13,
      zoomControl: false,
      attributionControl: false
    });

    const tileUrl =
      mapLayer === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
        : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

    tileLayerRef.current = L.tileLayer(tileUrl, { maxZoom: 19 }).addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Tile Layer
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;

    const tileUrl =
      mapLayer === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
        : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

    tileLayerRef.current.setUrl(tileUrl);
  }, [mapLayer]);

  // Render Full GPS Route and Markers on Map
  useEffect(() => {
    if (!mapInstanceRef.current || !trackData || !trackData.points || trackData.points.length === 0) return;

    const map = mapInstanceRef.current;
    const latLngs = trackData.points.map((p) => [p.lat, p.lng] as [number, number]);

    // Clear previous route layer
    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
    }

    // Draw high-visibility route polyline
    routeLayerRef.current = L.polyline(latLngs, {
      color: '#00d1ff',
      weight: 5,
      opacity: 0.85,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);

    // Start flag marker
    if (startMarkerRef.current) startMarkerRef.current.remove();
    const startPt = trackData.points[0];
    const startIcon = L.divIcon({
      html: `
        <div class="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500 text-white font-bold text-[10px] border-2 border-white shadow-lg font-mono">
          A
        </div>
      `,
      className: 'start-flag-marker',
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
    startMarkerRef.current = L.marker([startPt.lat, startPt.lng], { icon: startIcon }).addTo(map);

    // End flag marker
    if (endMarkerRef.current) endMarkerRef.current.remove();
    const endPt = trackData.points[trackData.points.length - 1];
    const endIcon = L.divIcon({
      html: `
        <div class="flex items-center justify-center w-7 h-7 rounded-full bg-red-500 text-white font-bold text-[10px] border-2 border-white shadow-lg font-mono">
          B
        </div>
      `,
      className: 'end-flag-marker',
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
    endMarkerRef.current = L.marker([endPt.lat, endPt.lng], { icon: endIcon }).addTo(map);

    // Fit map bounds to whole route initially
    map.fitBounds(routeLayerRef.current.getBounds(), { padding: [40, 40] });
  }, [trackData]);

  // Update Moving Vehicle Marker on Current Waypoint
  useEffect(() => {
    if (!mapInstanceRef.current || !currentPoint || !selectedVehicle) return;

    const map = mapInstanceRef.current;
    const { lat, lng, speed, heading, timestamp } = currentPoint;

    const vehicleIconHtml = `
      <div class="flex flex-col items-center select-none cursor-pointer">
        <div class="relative flex items-center justify-center">
          <div class="absolute inset-0 rounded-full bg-[#00d1ff] animate-ping opacity-60"></div>
          <div class="w-9 h-9 rounded-full bg-[#00d1ff] border-2 border-white flex items-center justify-center relative z-10 shadow-[0_0_15px_rgba(0,209,255,0.9)]" style="transform: rotate(${heading}deg);">
            <svg class="w-5 h-5 text-black" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
            </svg>
          </div>
        </div>
        <div class="mt-1 bg-[#000f20]/95 backdrop-blur-md px-2 py-0.5 rounded-md border border-[#00d1ff] shadow-xl flex flex-col items-center text-center font-mono">
          <span class="font-bold text-[9px] text-white leading-tight">${selectedVehicle.unitNumber}</span>
          <span class="text-[8px] text-[#00d1ff] leading-none">${speed} km/h • Dir: ${getHeadingLabel(heading)}</span>
        </div>
      </div>
    `;

    const vehicleIcon = L.divIcon({
      html: vehicleIconHtml,
      className: 'evidence-tracker-marker',
      iconSize: [70, 70],
      iconAnchor: [35, 25]
    });

    if (vehicleMarkerRef.current) {
      vehicleMarkerRef.current.setLatLng([lat, lng]);
      vehicleMarkerRef.current.setIcon(vehicleIcon);
    } else {
      vehicleMarkerRef.current = L.marker([lat, lng], {
        icon: vehicleIcon,
        zIndexOffset: 2000
      }).addTo(map);
    }

    if (isPlaying) {
      map.panTo([lat, lng], { animate: true, duration: 0.3 });
    }
  }, [currentPoint, selectedVehicle, isPlaying]);

  // Playback timer loop
  useEffect(() => {
    if (!isPlaying || !trackData || !trackData.points) return;

    const interval = setInterval(() => {
      setCurrentPointIndex((prev) => {
        if (prev >= trackData.points.length - 1) {
          setIsPlaying(false);
          return 0; // loop or stop
        }
        return prev + 1;
      });
    }, 800 / playbackSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, trackData]);

  // Direction helper
  function getHeadingLabel(deg: number): string {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
    return directions[Math.round(deg / 45) % 8];
  }

  // Handle Play/Pause
  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  // Step Back
  const handleStepBack = () => {
    setCurrentPointIndex((prev) => Math.max(0, prev - 5));
  };

  // Step Forward
  const handleStepForward = () => {
    if (!trackData || !trackData.points) return;
    setCurrentPointIndex((prev) => Math.min(trackData.points.length - 1, prev + 5));
  };

  // Handle Export Corte
  const handleConfirmExport = () => {
    if (!trackData || !trackData.points) return;
    const startPoint = trackData.points[cutRangeStart] || trackData.points[0];
    const endPoint = trackData.points[cutRangeEnd] || trackData.points[trackData.points.length - 1];

    const startTimeFormatted = startPoint.timestamp.split(' ')[1] || '12:40:00';
    const endTimeFormatted = endPoint.timestamp.split(' ')[1] || '12:45:00';

    if (onExportClip) {
      onExportClip(selectedVehicle.unitNumber, startTimeFormatted, endTimeFormatted, selectedDate);
    }

    setIsCutModalOpen(false);
    setExportNotice(`Exportación de ${selectedVehicle.unitNumber} (${startTimeFormatted} - ${endTimeFormatted}) enviada a Descargas.`);
    setTimeout(() => setExportNotice(null), 4500);
  };

  const totalPoints = trackData?.points?.length || 180;
  const progressPercent = (currentPointIndex / (totalPoints - 1)) * 100;
  const cutStartPercent = (cutRangeStart / (totalPoints - 1)) * 100;
  const cutEndPercent = (cutRangeEnd / (totalPoints - 1)) * 100;

  return (
    <div className="relative w-full h-full bg-[#000f20] text-slate-300 flex flex-col font-sans select-none overflow-hidden">
      {/* ======================================================== */}
      {/* TOP BAR / NAVIGATION (Matches user's Stitch mockup) */}
      {/* ======================================================== */}
      <div className="bg-[#000f20]/95 backdrop-blur-md border-b border-[#293a50] px-3 sm:px-4 py-2.5 z-20 flex flex-col space-y-2">
        {/* Title and date selector */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-[#00d1ff]/15 border border-[#00d1ff]/40 flex items-center justify-center text-[#00d1ff]">
              <Navigation className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-white font-mono font-bold text-sm sm:text-base leading-tight">
                EvidenceTracker
              </h1>
              <span className="text-[10px] text-[#00d1ff] font-mono tracking-wider uppercase block">
                Rastro GPS & Grabación de Ruta
              </span>
            </div>
          </div>

          {/* Date Selector Badge */}
          <div className="relative">
            <button
              onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-[#293a50] hover:border-[#00d1ff] text-slate-200 text-xs font-mono transition-colors cursor-pointer"
            >
              <CalendarIcon className="w-3.5 h-3.5 text-[#00d1ff]" />
              <span>{selectedDate}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isDatePickerOpen && (
              <div className="absolute right-0 top-10 w-44 bg-[#000f20] border border-[#293a50] rounded-xl shadow-2xl z-40 p-1.5 animate-in fade-in">
                {['2026-08-18', '2026-08-17', '2026-08-16', '2026-08-15', '2026-08-14'].map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      setSelectedDate(d);
                      setIsDatePickerOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                      selectedDate === d
                        ? 'bg-[#00d1ff] text-black font-bold'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {d} {d === '2026-08-18' && '(Hoy)'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* GPS Unit Selectors (GPS 1, GPS 2, GPS 3, GPS 4 matching the user's mockup) */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
          {vehicles.map((v, idx) => {
            const isSelected = v.id === selectedVehicleId;
            return (
              <button
                key={v.id}
                onClick={() => setSelectedVehicleId(v.id)}
                className={`flex-shrink-0 flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#011428] border-[#00d1ff] text-white shadow-[0_0_12px_rgba(0,209,255,0.35)]'
                    : 'bg-slate-900/80 border-[#293a50] text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    v.status === 'moving'
                      ? 'bg-amber-400 animate-pulse'
                      : v.status === 'online'
                      ? 'bg-emerald-400'
                      : 'bg-slate-500'
                  }`}
                />
                <span className="font-bold">{v.unitNumber}</span>
                <span className="text-[10px] text-slate-400">GPS {idx + 1}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ======================================================== */}
      {/* INTERACTIVE TIMELINE & PLAYBACK CONTROLS (Stitch Mockup) */}
      {/* ======================================================== */}
      <div className="bg-[#000f20]/90 backdrop-blur-md border-b border-[#293a50] p-3 sm:p-4 z-20 flex flex-col space-y-3">
        {/* Timeline Header */}
        <div className="flex justify-between items-center text-xs font-mono">
          <span className="text-slate-400 uppercase tracking-widest text-[11px] font-bold">
            LÍNEA DE TIEMPO
          </span>
          <div className="flex items-center space-x-2">
            <Clock className="w-3.5 h-3.5 text-[#00d1ff]" />
            <span className="text-sm font-bold text-white tracking-wider">
              {currentFormattedTime}
            </span>
          </div>
        </div>

        {/* Timeline Range Bar & Playhead */}
        <div className="relative py-1">
          {/* Time ticks */}
          <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>24:00</span>
          </div>

          {/* Interactive Bar Track */}
          <div
            className="relative h-6 bg-slate-950 rounded-lg overflow-hidden border border-[#293a50] cursor-pointer flex items-center"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const ratio = Math.max(0, Math.min(1, clickX / rect.width));
              const newIdx = Math.round(ratio * (totalPoints - 1));
              setCurrentPointIndex(newIdx);
            }}
          >
            {/* Background recorded activity segments */}
            <div className="absolute inset-y-1 left-[25%] right-[10%] bg-[#00d1ff]/20 rounded-xs" />

            {/* Shaded Corte / Cut selection slice (e.g. from cutRangeStart to cutRangeEnd) */}
            <div
              className="absolute h-full bg-[#d0e92f]/30 border-x border-[#d0e92f] transition-all"
              style={{
                left: `${cutStartPercent}%`,
                width: `${Math.max(4, cutEndPercent - cutStartPercent)}%`
              }}
              title="Rango de Corte de Video / Telemetría"
            />

            {/* Glowing cyan playhead indicator */}
            <div
              className="absolute h-full w-1 bg-[#00d1ff] shadow-[0_0_12px_#00d1ff] z-10 transition-all pointer-events-none"
              style={{ left: `${progressPercent}%` }}
            >
              <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-3 h-3 rounded-full bg-[#00d1ff] border border-white shadow-[0_0_8px_#00d1ff]" />
            </div>
          </div>
        </div>

        {/* Playback Controls Grid (ATRÁS, PAUSA/PLAY, SIG., CORTE) */}
        <div className="grid grid-cols-4 gap-2 pt-1">
          {/* 1. ATRÁS Button */}
          <button
            onClick={handleStepBack}
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-[#293a50] text-slate-300 hover:text-white transition-all cursor-pointer active:scale-95"
            title="Retroceder punto"
          >
            <SkipBack className="w-5 h-5" />
            <span className="text-[9px] font-mono font-bold mt-1 tracking-wider uppercase">
              Atrás
            </span>
          </button>

          {/* 2. PAUSA / PLAY Button (Cyan Glowing) */}
          <button
            onClick={togglePlay}
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-[#00d1ff] hover:bg-[#4cd6ff] text-black transition-all cursor-pointer active:scale-95 shadow-[0_0_18px_rgba(0,209,255,0.6)]"
            title={isPlaying ? 'Pausar recorrido' : 'Reproducir rastro'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-black stroke-black" />
            ) : (
              <Play className="w-5 h-5 fill-black stroke-black ml-0.5" />
            )}
            <span className="text-[9px] font-mono font-bold mt-1 tracking-wider uppercase text-black">
              {isPlaying ? 'Pausa' : 'Play'}
            </span>
          </button>

          {/* 3. SIG. Button */}
          <button
            onClick={handleStepForward}
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-[#293a50] text-slate-300 hover:text-white transition-all cursor-pointer active:scale-95"
            title="Avanzar punto"
          >
            <SkipForward className="w-5 h-5" />
            <span className="text-[9px] font-mono font-bold mt-1 tracking-wider uppercase">
              Sig.
            </span>
          </button>

          {/* 4. CORTE Button (Lime/Yellow styling from Stitch) */}
          <button
            onClick={() => setIsCutModalOpen(true)}
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-[#d0e92f] hover:bg-[#b8ce27] text-black transition-all cursor-pointer active:scale-95 shadow-[0_0_15px_rgba(208,233,47,0.5)]"
            title="Crear corte de video y telemetría"
          >
            <Scissors className="w-5 h-5 stroke-[2.5]" />
            <span className="text-[9px] font-mono font-bold mt-1 tracking-wider uppercase text-black">
              Corte
            </span>
          </button>
        </div>

        {/* Speed & Stats bar */}
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-[#293a50]/50">
          <div className="flex items-center space-x-2">
            <span>Velocidad:</span>
            {[1, 2, 5, 10].map((spd) => (
              <button
                key={spd}
                onClick={() => setPlaybackSpeed(spd)}
                className={`px-1.5 py-0.5 rounded text-[10px] transition-colors cursor-pointer ${
                  playbackSpeed === spd
                    ? 'bg-[#00d1ff] text-black font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          <div className="text-right">
            {currentPoint && (
              <span className="text-white font-bold">
                {currentPoint.speed} km/h • {currentPoint.address || 'Carretera'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Export Confirmation Toast */}
      {exportNotice && (
        <div className="absolute top-4 left-4 right-4 z-50 bg-emerald-500/90 backdrop-blur-md text-black font-mono font-bold text-xs p-3 rounded-xl border border-emerald-300 shadow-2xl flex items-center space-x-2 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{exportNotice}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* INTERACTIVE MAP AREA */}
      {/* ======================================================== */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Top-Right Floating Controls (Layers, Zoom) */}
        <div className="absolute top-4 right-4 flex flex-col space-y-2 z-20 select-none">
          {/* Layer switcher */}
          <div className="relative">
            <button
              onClick={() => setIsLayerMenuOpen(!isLayerMenuOpen)}
              className="bg-[#000f20]/90 backdrop-blur-md border border-[#293a50] p-2.5 rounded-xl shadow-xl text-slate-300 hover:text-white hover:border-[#00d1ff] transition-all cursor-pointer active:scale-95"
              title="Capas del Mapa"
            >
              <Layers className="w-5 h-5" />
            </button>

            {isLayerMenuOpen && (
              <div className="absolute top-0 right-12 w-40 bg-[#000f20] border border-[#293a50] rounded-xl shadow-2xl z-30 flex flex-col p-1.5 animate-in fade-in">
                <button
                  onClick={() => {
                    setMapLayer('dark');
                    setIsLayerMenuOpen(false);
                  }}
                  className={`flex items-center space-x-2 px-2.5 py-1.5 text-xs rounded-lg transition-colors cursor-pointer ${
                    mapLayer === 'dark'
                      ? 'bg-[#011428] text-[#00d1ff] font-bold border border-[#00d1ff]/30'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <MapIcon className="w-4 h-4 text-[#00d1ff]" />
                  <span>Estándar</span>
                </button>
                <button
                  onClick={() => {
                    setMapLayer('satellite');
                    setIsLayerMenuOpen(false);
                  }}
                  className={`flex items-center space-x-2 px-2.5 py-1.5 text-xs rounded-lg transition-colors cursor-pointer ${
                    mapLayer === 'satellite'
                      ? 'bg-[#011428] text-[#00d1ff] font-bold border border-[#00d1ff]/30'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Globe className="w-4 h-4 text-emerald-400" />
                  <span>Satélite HD</span>
                </button>
              </div>
            )}
          </div>

          {/* Zoom In */}
          <button
            onClick={() => mapInstanceRef.current?.zoomIn()}
            className="bg-[#000f20]/90 backdrop-blur-md border border-[#293a50] p-2.5 rounded-xl shadow-xl text-slate-300 hover:text-white hover:border-[#00d1ff] transition-all cursor-pointer active:scale-95"
            title="Acercar"
          >
            <Plus className="w-5 h-5" />
          </button>

          {/* Zoom Out */}
          <button
            onClick={() => mapInstanceRef.current?.zoomOut()}
            className="bg-[#000f20]/90 backdrop-blur-md border border-[#293a50] p-2.5 rounded-xl shadow-xl text-slate-300 hover:text-white hover:border-[#00d1ff] transition-all cursor-pointer active:scale-95"
            title="Alejar"
          >
            <Minus className="w-5 h-5" />
          </button>
        </div>

        {/* Route Summary Telemetry Bottom Pill */}
        {trackData && (
          <div className="absolute bottom-4 left-4 right-4 z-20 pointer-events-none">
            <div className="bg-[#000f20]/90 backdrop-blur-md border border-[#293a50] px-3.5 py-2 rounded-xl shadow-2xl flex items-center justify-between text-xs font-mono max-w-md mx-auto pointer-events-auto">
              <div>
                <span className="text-slate-400 text-[10px] block">Distancia Total</span>
                <span className="text-white font-bold">{trackData.totalDistanceKm} km</span>
              </div>
              <div className="border-l border-[#293a50] pl-3">
                <span className="text-slate-400 text-[10px] block">Vel. Máxima</span>
                <span className="text-[#ff9100] font-bold">{trackData.maxSpeedKmH} km/h</span>
              </div>
              <div className="border-l border-[#293a50] pl-3">
                <span className="text-slate-400 text-[10px] block">Promedio</span>
                <span className="text-emerald-400 font-bold">{trackData.avgSpeedKmH} km/h</span>
              </div>
              <div className="border-l border-[#293a50] pl-3">
                <span className="text-slate-400 text-[10px] block">Tiempo Recorrido</span>
                <span className="text-[#00d1ff] font-bold">{trackData.drivingDurationHours}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* EXPORT / CORTE BOTTOM SHEET MODAL (Stitch Design) */}
      {/* ======================================================== */}
      {isCutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#000f20] border border-[#293a50] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col animate-in slide-in-from-bottom-5">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#293a50] bg-[#011428]">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-[#d0e92f]/20 border border-[#d0e92f]/50 flex items-center justify-center text-[#d0e92f]">
                  <Scissors className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-mono font-bold text-white text-sm">
                    Exportar Clip de Video & Telemetría
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Unidad {selectedVehicle?.unitNumber} • Fecha: {selectedDate}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setIsCutModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3.5 text-xs font-mono text-slate-300">
              <div className="bg-slate-900/80 p-3 rounded-xl border border-[#293a50] space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Inicio del Corte:</span>
                  <span className="text-white font-bold">
                    {trackData?.points[cutRangeStart]?.timestamp.split(' ')[1] || '12:40:00'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Fin del Corte:</span>
                  <span className="text-white font-bold">
                    {trackData?.points[cutRangeEnd]?.timestamp.split(' ')[1] || '12:45:00'}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-[#293a50] pt-2">
                  <span className="text-slate-400">Duración del Clip:</span>
                  <span className="text-[#00d1ff] font-bold">5m 00s (300 segundos)</span>
                </div>
              </div>

              {/* Sliders to adjust corte range */}
              <div className="space-y-2">
                <label className="text-[11px] text-slate-400 block">
                  Ajustar Rango de Inicio y Fin:
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="range"
                    min={0}
                    max={totalPoints - 1}
                    value={cutRangeStart}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setCutRangeStart(Math.min(val, cutRangeEnd - 1));
                    }}
                    className="w-full accent-[#00d1ff]"
                  />
                  <input
                    type="range"
                    min={0}
                    max={totalPoints - 1}
                    value={cutRangeEnd}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setCutRangeEnd(Math.max(val, cutRangeStart + 1));
                    }}
                    className="w-full accent-[#d0e92f]"
                  />
                </div>
              </div>

              {/* Formats to include */}
              <div className="bg-[#011428] p-2.5 rounded-xl border border-[#293a50] text-[11px] space-y-1">
                <div className="text-white font-bold">Incluye en el paquete:</div>
                <div className="text-slate-400">
                  • 4 Canales de Video MDVR sincronizados (MP4 H.265)<br />
                  • Archivo de Telemetría y Velocidad GPS (CSV)<br />
                  • Rastro de Ruta Satelital Georreferenciado (KML / GPX)
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="p-4 border-t border-[#293a50] bg-[#011428] flex items-center justify-end space-x-2">
              <button
                onClick={() => setIsCutModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmExport}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#d0e92f] hover:bg-[#b8ce27] text-black font-mono font-bold text-xs transition-all shadow-[0_0_15px_rgba(208,233,47,0.4)] cursor-pointer"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>Descargar Clip (12.4 MB)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};