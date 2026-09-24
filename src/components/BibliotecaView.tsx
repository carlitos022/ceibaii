import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Vehicle, LibraryRecord } from '../types';
import { VideoPreviewModal } from './VideoPreviewModal';
import {
  Folder,
  Play,
  Download,
  Film,
  HardDrive,
  Calendar as CalendarIcon,
  Search,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
  Activity,
  PowerOff,
  Video,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Radio,
} from 'lucide-react';

interface BibliotecaViewProps {
  vehicles: Vehicle[];
  library: LibraryRecord[];
  onPlayRecording: (record: LibraryRecord) => void;
  onDownloadRecording: (record: LibraryRecord) => void;
  onBulkDownload?: (unitNumber: string, channels: number[], date: string, startTime: string, endTime: string) => void;
}

function getToken() {
  try {
    const s = localStorage.getItem('csrs_auth');
    if (s) return JSON.parse(s).token;
  } catch {}
  return null;
}
function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: 'Bearer ' + t } : {};
}
function formatDateStr(d: Date) {
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function toSec(t: string) {
  const p = String(t || '').split(':');
  return (+p[0] || 0) * 3600 + (+p[1] || 0) * 60 + (+p[2] || 0);
}
function extractTime(s: string) {
  const m = String(s || '').match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
  if (!m) return '00:00:00';
  const parts = m[1].split(':');
  return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:${(parts[2] || '00').padStart(2, '0')}`;
}
function pad(n: number) {
  return n < 10 ? '0' + n : '' + n;
}

export const BibliotecaView: React.FC<BibliotecaViewProps> = ({ vehicles }) => {
  const [selectedUnit, setSelectedUnit] = useState<Vehicle | null>(null);
  const [unitSearch, setUnitSearch] = useState('');
  const [selectedChannels, setSelectedChannels] = useState<number[]>([1, 2, 3, 4]);
  const [availableChannels, setAvailableChannels] = useState<{ id: number; name: string }[]>([
    { id: 1, name: 'Cámara 1 [1]' },
    { id: 2, name: 'Cámara 2 [2]' },
    { id: 3, name: 'Cámara 3 [3]' },
    { id: 4, name: 'Cámara 4 [4]' },
  ]);
  const [selectedDate, setSelectedDate] = useState<string>(formatDateStr(new Date()));
  const [startTime, setStartTime] = useState<string>('00:00:00');
  const [endTime, setEndTime] = useState<string>('23:59:59');
  const [streamType, setStreamType] = useState<string>('1');
  const [filterTrigger] = useState<'all' | 'continuous' | 'alarm'>('all');
  const [downloadSuccessNotice, setDownloadSuccessNotice] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [previewClip, setPreviewClip] = useState<LibraryRecord | null>(null);
  const [currentYearMonth, setCurrentYearMonth] = useState<{ year: number; month: number }>(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [calendarData, setCalendarData] = useState<{ day: number; count: number; level: string }[]>([]);
  const [videoFiles, setVideoFiles] = useState<any[]>([]);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  // Load channels when unit selected
  useEffect(() => {
    if (!selectedUnit) return;
    const devNo = (selectedUnit as any).deviceno || selectedUnit.id;
    fetch(`/api/vehicles/${selectedUnit.id}/channels`, { headers: { ...authHeaders() } })
      .then((r) => r.json())
      .then((data) => {
        const chs = data.result || data;
        if (Array.isArray(chs) && chs.length > 0) {
          setAvailableChannels(chs);
          setSelectedChannels(chs.map((c: any) => c.id));
        } else {
          setAvailableChannels([
            { id: 1, name: 'Cámara 1 [1]' },
            { id: 2, name: 'Cámara 2 [2]' },
            { id: 3, name: 'Cámara 3 [3]' },
            { id: 4, name: 'Cámara 4 [4]' },
          ]);
          setSelectedChannels([1, 2, 3, 4]);
        }
      })
      .catch(() => {
        setAvailableChannels([
          { id: 1, name: 'Cámara 1 [1]' },
          { id: 2, name: 'Cámara 2 [2]' },
          { id: 3, name: 'Cámara 3 [3]' },
          { id: 4, name: 'Cámara 4 [4]' },
        ]);
      });
  }, [selectedUnit?.id]);

  // Load calendar
  const loadCalendar = async () => {
    if (!selectedUnit) return;
    const devNo = (selectedUnit as any).deviceno || selectedUnit.id;
    const ym = `${currentYearMonth.year}-${pad(currentYearMonth.month + 1)}`;
    setIsLoadingCalendar(true);
    setCalendarError(null);
    try {
      const r = await fetch(`/api/video/calendar/${devNo}?yearmonth=${ym}&streamtype=${streamType}`, { headers: { ...authHeaders() } });
      const data = await r.json();
      const result = data.result || data;
      if (Array.isArray(result)) {
        setCalendarData(result);
        // Auto-select latest day if selectedDate not in current month
        if (result.length > 0) {
          const sel = new Date(selectedDate);
          if (sel.getFullYear() !== currentYearMonth.year || sel.getMonth() !== currentYearMonth.month) {
            const maxDay = Math.max(...result.map((d: any) => d.day));
            setSelectedDate(`${ym}-${pad(maxDay)}`);
          }
        }
      } else {
        setCalendarData([]);
      }
      if (data.code !== 200 && data.errorcase) setCalendarError(data.errorcase);
    } catch (e: any) {
      setCalendarData([]);
      setCalendarError(e.message);
    } finally {
      setIsLoadingCalendar(false);
    }
  };

  useEffect(() => {
    loadCalendar();
  }, [selectedUnit?.id, currentYearMonth.year, currentYearMonth.month, streamType]);

  // Load filelist when date/channels/streamType change
  const loadVideoFiles = async () => {
    if (!selectedUnit || !selectedDate) return;
    const devNo = (selectedUnit as any).deviceno || selectedUnit.id;
    setIsLoadingFiles(true);
    const allFiles: any[] = [];
    for (const ch of selectedChannels) {
      try {
        const r = await fetch(`/api/video/filelist/${devNo}?date=${selectedDate}&channel=${ch}&streamtype=${streamType}`, { headers: { ...authHeaders() } });
        const data = await r.json();
        const arr = data.result || data;
        if (Array.isArray(arr)) {
          for (const f of arr) {
            allFiles.push({ ...f, _channel: ch });
          }
        }
      } catch {}
    }
    allFiles.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '') || (a._channel - b._channel));
    setVideoFiles(allFiles);
    if (allFiles.length > 0) {
      const first = extractTime(allFiles[0].startTime);
      const last = extractTime(allFiles[allFiles.length - 1].endTime);
      setStartTime(first);
      setEndTime(last);
    }
    setIsLoadingFiles(false);
  };

  useEffect(() => {
    loadVideoFiles();
  }, [selectedDate, selectedChannels.join(','), streamType, selectedUnit?.id]);

  const { onlineVehicles, offlineVehicles } = useMemo(() => {
    const search = unitSearch.toLowerCase().trim();
    const filtered = vehicles.filter(
      (v) =>
        v.unitNumber.toLowerCase().includes(search) ||
        v.plate.toLowerCase().includes(search) ||
        (v.driverName && v.driverName.toLowerCase().includes(search))
    );
    const online = filtered.filter((v) => v.status === 'moving' || v.status === 'online' || v.status === 'stopped');
    const offline = filtered.filter((v) => v.status === 'offline');
    return { onlineVehicles: online, offlineVehicles: offline };
  }, [vehicles, unitSearch]);

  const handleToggleChannel = (chNum: number) => {
    if (selectedChannels.includes(chNum)) {
      if (selectedChannels.length === 1) return;
      setSelectedChannels(selectedChannels.filter((c) => c !== chNum));
    } else {
      setSelectedChannels([...selectedChannels, chNum].sort());
    }
  };

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const firstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();
  const calendarDays = useMemo(() => {
    const { year, month } = currentYearMonth;
    const totalDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);
    const days: any[] = [];
    for (let i = 0; i < startDay; i++) days.push({ dayNumber: 0, dateStr: '', hasVideo: false, isCurrentMonth: false });
    for (let d = 1; d <= totalDays; d++) {
      const dayStr = pad(d);
      const monthStr = pad(month + 1);
      const dateStr = `${year}-${monthStr}-${dayStr}`;
      const info = calendarData.find((c) => c.day === d);
      days.push({ dayNumber: d, dateStr, hasVideo: !!info, level: info?.level || 'low', count: info?.count || 0, isCurrentMonth: true });
    }
    return days;
  }, [currentYearMonth, calendarData]);

  const handleTriggerBulkDownload = async () => {
    if (!selectedUnit || selectedChannels.length === 0) return;
    const devNo = (selectedUnit as any).deviceno || selectedUnit.id;
    const taskName = `${selectedUnit.unitNumber}_${selectedDate}_CH${selectedChannels.join('')}`;
    try {
      const r = await fetch('/api/download/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ deviceNo: devNo, date: selectedDate, startTime, endTime, channels: selectedChannels, taskName, streamType }),
      });
      const data = await r.json();
      if (data.code === 200) {
        setDownloadSuccessNotice(data.message || `Se crearon ${selectedChannels.length} tareas. Revisa Descargas.`);
      } else {
        setDownloadSuccessNotice(data.error || data.errorcase || 'Error al crear descarga');
      }
      setTimeout(() => setDownloadSuccessNotice(null), 4500);
    } catch (e: any) {
      setDownloadSuccessNotice('Error: ' + e.message);
      setTimeout(() => setDownloadSuccessNotice(null), 4500);
    }
  };

  const estimatedSizeMb = useMemo(() => {
    const s = toSec(startTime);
    const e = toSec(endTime);
    let dur = e - s;
    if (dur <= 0) dur = 60;
    return Math.round((selectedChannels.length * dur * 1.8) / 60);
  }, [selectedChannels, startTime, endTime]);

  const clipRange = (s: string, e: string) => {
    setStartTime(extractTime(s));
    setEndTime(extractTime(e));
  };
  const nudgeRange = (edge: 'start' | 'end', minutes: number) => {
    const sec = edge === 'start' ? toSec(startTime) : toSec(endTime);
    let ns = sec + minutes * 60;
    ns = Math.max(0, Math.min(86399, ns));
    const h = Math.floor(ns / 3600);
    const m = Math.floor((ns % 3600) / 60);
    const s = ns % 60;
    const t = `${pad(h)}:${pad(m)}:${pad(s)}`;
    if (edge === 'start') setStartTime(t);
    else setEndTime(t);
  };
  const expandRange = (minutes: number) => {
    const s = toSec(startTime);
    const e = toSec(endTime);
    const mid = Math.floor((s + e) / 2);
    const half = Math.max(30, (minutes * 60) / 2);
    let ns = Math.max(0, mid - half);
    let ne = Math.min(86399, mid + half);
    setStartTime(`${pad(Math.floor(ns / 3600))}:${pad(Math.floor((ns % 3600) / 60))}:${pad(ns % 60)}`);
    setEndTime(`${pad(Math.floor(ne / 3600))}:${pad(Math.floor((ne % 3600) / 60))}:${pad(ne % 60)}`);
  };
  const setQuickRange = (minutes: number) => {
    const e = toSec(endTime);
    let s = Math.max(0, e - minutes * 60);
    setStartTime(`${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`);
  };

  if (!selectedUnit) {
    return (
      <div className="flex-1 flex flex-col bg-[#000f20] overflow-hidden select-none pb-20 pt-16 px-3 sm:px-4 max-w-4xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 border-b border-[#293a50]/60 pb-3">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-white flex items-center space-x-2 font-mono">
              <Folder className="w-5 h-5 text-[#00d1ff]" />
              <span>Biblioteca de Grabaciones MDVR</span>
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-0.5">Selecciona una unidad para acceder a calendario y descarga real Ceiba</p>
          </div>
          <div className="flex items-center space-x-2 text-xs font-mono">
            <span className="px-2 py-1 rounded bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{onlineVehicles.length} Encendidas</span>
            </span>
            <span className="px-2 py-1 rounded bg-slate-800/80 border border-slate-700 text-slate-400 flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              <span>{offlineVehicles.length} Apagadas</span>
            </span>
          </div>
        </div>
        <div className="mb-3 relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input type="text" value={unitSearch} onChange={(e) => setUnitSearch(e.target.value)} placeholder="Buscar unidad por número o placa..." className="w-full bg-[#011428] border border-[#293a50] rounded-xl text-xs py-2.5 pl-9 pr-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#00d1ff] font-mono" />
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
          <div>
            <div className="flex items-center space-x-2 text-xs font-mono font-bold text-emerald-400 mb-2 uppercase tracking-wider px-1">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Unidades Encendidas en Línea ({onlineVehicles.length})</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {onlineVehicles.map((veh) => (
                <div key={veh.id} onClick={() => setSelectedUnit(veh)} className="p-3.5 rounded-xl bg-[#011428] border border-emerald-500/30 hover:border-[#00d1ff] hover:bg-[#021d38] transition-all cursor-pointer shadow-md group flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                        <Video className="w-5 h-5 group-hover:scale-110 transition-transform" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-white font-bold font-mono text-sm group-hover:text-[#00d1ff] transition-colors">{veh.unitNumber}</h3>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">{veh.plate}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono truncate max-w-[180px] sm:max-w-[220px]">{veh.route || veh.statusText}</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-950 text-emerald-400 border border-emerald-800">{veh.status === 'moving' ? `${veh.speed} km/h` : 'En Línea'}</span>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-[#293a50]/60 flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span className="flex items-center space-x-1 text-emerald-300">
                      <HardDrive className="w-3.5 h-3.5" />
                      <span>MDVR 4CH</span>
                    </span>
                    <span className="text-[#00d1ff] font-bold flex items-center space-x-1 group-hover:translate-x-1 transition-transform">
                      <span>Ver Grabaciones</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2 text-xs font-mono font-bold text-slate-400 mb-2 uppercase tracking-wider px-1">
              <PowerOff className="w-4 h-4 text-slate-500" />
              <span>Unidades Apagadas ({offlineVehicles.length})</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {offlineVehicles.map((veh) => (
                <div key={veh.id} onClick={() => setSelectedUnit(veh)} className="p-3.5 rounded-xl bg-[#011428]/70 border border-[#293a50]/70 hover:border-[#00d1ff]/60 hover:bg-[#021d38] transition-all cursor-pointer shadow-md group flex flex-col justify-between opacity-85 hover:opacity-100">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-400">
                        <Film className="w-5 h-5 group-hover:scale-110 transition-transform" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-slate-200 font-bold font-mono text-sm group-hover:text-[#00d1ff] transition-colors">{veh.unitNumber}</h3>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800/80 text-slate-400 border border-slate-700">{veh.plate}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono truncate max-w-[180px] sm:max-w-[220px]">Últ. reporte: {veh.lastUpdate}</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-slate-800 text-slate-400 border border-slate-700">Apagado</span>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-[#293a50]/60 flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span className="flex items-center space-x-1 text-slate-400">
                      <HardDrive className="w-3.5 h-3.5 text-slate-500" />
                      <span>Historial en Disco</span>
                    </span>
                    <span className="text-slate-300 font-bold flex items-center space-x-1 group-hover:text-[#00d1ff] group-hover:translate-x-1 transition-transform">
                      <span>Consultar Video</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Selected unit view
  const isOnline = selectedUnit.status !== 'offline';
  return (
    <div className="flex-1 flex flex-col bg-[#000f20] overflow-hidden select-none pb-20 pt-16 px-3 sm:px-4 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between gap-2 mb-3 border-b border-[#293a50]/60 pb-3">
        <button onClick={() => setSelectedUnit(null)} className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#011428] hover:bg-slate-800 border border-[#293a50] text-slate-300 hover:text-white text-xs font-mono transition-all cursor-pointer flex-shrink-0">
          <ArrowLeft className="w-4 h-4 text-[#00d1ff]" />
          <span>Volver a Unidades</span>
        </button>
        <div className="flex items-center space-x-2 text-right min-w-0">
          <div className="flex items-center space-x-1 bg-black/60 px-2 py-1 rounded-lg border border-[#293a50]">
            <button onClick={() => setZoomLevel((p) => Math.max(85, p - 10))} className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setZoomLevel(100)} className="text-[10px] font-mono text-slate-300 hover:text-[#00d1ff] px-1 cursor-pointer">
              {zoomLevel}%
            </button>
            <button onClick={() => setZoomLevel((p) => Math.min(140, p + 10))} className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="min-w-0">
            <div className="flex items-center justify-end space-x-2">
              <span className="font-bold text-white font-mono text-sm sm:text-base truncate">{selectedUnit.unitNumber}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">{selectedUnit.plate}</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono hidden sm:inline-block">MDVR: {selectedUnit.deviceModel || 'Streamax X5'}</span>
          </div>
          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${isOnline ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>{isOnline ? 'En Línea' : 'Apagado'}</span>
        </div>
      </div>
      {downloadSuccessNotice && (
        <div className="mb-3 p-2.5 bg-emerald-950/80 border border-emerald-500/60 rounded-xl text-xs font-mono text-emerald-300 flex items-center space-x-2 animate-in fade-in shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{downloadSuccessNotice}</span>
        </div>
      )}
      <div className="relative flex-1 min-h-0 flex flex-col">
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1 touch-pan-y transition-all" style={{ fontSize: `${zoomLevel}%` }}>
          <div className="bg-[#011428] border border-[#293a50] rounded-2xl p-3.5 sm:p-4 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div className="flex items-center space-x-2">
                <Video className="w-4 h-4 text-[#00d1ff]" />
                <h2 className="text-xs sm:text-sm font-bold text-white font-mono uppercase tracking-wide">1. Selección de Canales ({selectedChannels.length}/4)</h2>
              </div>
              <div className="flex items-center space-x-2">
                <button onClick={() => setSelectedChannels(availableChannels.map((c) => c.id))} className="text-[11px] font-mono px-2.5 py-1 rounded bg-[#00d1ff]/10 hover:bg-[#00d1ff] hover:text-black border border-[#00d1ff]/30 text-[#00d1ff] transition-all cursor-pointer">Marcar las 4</button>
                <button onClick={() => setSelectedChannels([availableChannels[0]?.id || 1])} className="text-[11px] font-mono px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer">Solo CH1</button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {availableChannels.map((ch) => {
                const isSelected = selectedChannels.includes(ch.id);
                return (
                  <div key={ch.id} onClick={() => handleToggleChannel(ch.id)} className={`relative rounded-xl border p-2.5 transition-all cursor-pointer select-none flex flex-col justify-between overflow-hidden ${isSelected ? 'bg-[#00d1ff]/10 border-[#00d1ff] shadow-[0_0_12px_rgba(0,209,255,0.25)]' : 'bg-slate-900/80 border-[#293a50]/70 opacity-70 hover:opacity-95 hover:border-slate-500'}`}>
                    <div className="relative h-20 sm:h-24 rounded-lg overflow-hidden bg-black mb-2 border border-[#293a50] flex items-center justify-center">
                      <div className="text-2xl font-bold text-[#00d1ff] font-mono">CH{ch.id}</div>
                      <div className="absolute top-1.5 left-1.5 bg-black/80 px-1.5 py-0.5 rounded text-[9px] font-mono text-[#00d1ff] border border-[#00d1ff]/30">CH{ch.id}</div>
                      <div className="absolute top-1.5 right-1.5">
                        <div className={`w-5 h-5 rounded flex items-center justify-center transition-all ${isSelected ? 'bg-[#00d1ff] text-black shadow-md' : 'bg-black/70 border border-slate-500 text-transparent'}`}>
                          <CheckCircle2 className="w-4 h-4 fill-black text-white stroke-[2.5]" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className={`text-xs font-bold font-mono truncate ${isSelected ? 'text-white' : 'text-slate-400'}`}>{ch.name}</h4>
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-0.5">
                        <span>CH{ch.id}</span>
                        <span className={isSelected ? 'text-[#00d1ff] font-bold' : 'text-slate-500'}>{isSelected ? '✓ Seleccionada' : 'Sin seleccionar'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-[#011428] border border-[#293a50] rounded-2xl p-3.5 sm:p-4 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <CalendarIcon className="w-4 h-4 text-[#00d1ff]" />
                <h2 className="text-xs sm:text-sm font-bold text-white font-mono uppercase tracking-wide">2. Selector de Días con Video Disponible</h2>
              </div>
              <div className="flex items-center space-x-2 text-xs font-mono">
                <span className="text-slate-400 font-bold">{monthNames[currentYearMonth.month]} {currentYearMonth.year}</span>
                <div className="flex items-center space-x-1">
                  <button onClick={() => setCurrentYearMonth((p) => ({ year: p.month === 0 ? p.year - 1 : p.year, month: p.month === 0 ? 11 : p.month - 1 }))} className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer">
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setCurrentYearMonth((p) => ({ year: p.month === 11 ? p.year + 1 : p.year, month: p.month === 11 ? 0 : p.month + 1 }))} className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2 mb-3 overflow-x-auto pb-1 text-xs font-mono">
              <span className="text-slate-500 text-[10px] flex-shrink-0">Acceso Rápido:</span>
              {['2026-08-18', '2026-08-17', '2026-08-16', '2026-08-15', '2026-08-14'].map((dStr) => (
                <button key={dStr} onClick={() => setSelectedDate(dStr)} className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex-shrink-0 text-xs ${selectedDate === dStr ? 'bg-[#00d1ff] text-black font-bold shadow-[0_0_8px_rgba(0,209,255,0.5)]' : 'bg-slate-900 border border-[#293a50] text-slate-300 hover:text-white'}`}>
                  {dStr === '2026-08-18' ? 'Hoy (18 Ago)' : dStr === '2026-08-17' ? 'Ayer (17 Ago)' : `${dStr.substring(8)} Ago`}
                </button>
              ))}
              <select value={streamType} onChange={(e) => setStreamType(e.target.value)} className="ml-2 bg-slate-900 border border-[#293a50] rounded-lg px-2 py-1 text-xs text-slate-300">
                <option value="1">Principal 1080P</option>
                <option value="0">Secundario 720P</option>
              </select>
            </div>
            <div className="bg-slate-950/60 rounded-xl p-2.5 border border-[#293a50]/60">
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-mono text-slate-500 font-bold uppercase mb-1">
                <span>Dom</span>
                <span>Lun</span>
                <span>Mar</span>
                <span>Mié</span>
                <span>Jue</span>
                <span>Vie</span>
                <span>Sáb</span>
              </div>
              <div className="grid grid-cols-7 gap-1 text-xs font-mono">
                {calendarDays.map((cell: any, idx: number) => {
                  if (!cell.isCurrentMonth) return <div key={`empty-${idx}`} className="h-9 sm:h-10 rounded-lg" />;
                  const isSelected = selectedDate === cell.dateStr;
                  const hasVideo = cell.hasVideo;
                  return (
                    <button key={cell.dateStr} disabled={!hasVideo} onClick={() => setSelectedDate(cell.dateStr)} className={`h-9 sm:h-10 rounded-lg flex flex-col items-center justify-center relative transition-all cursor-pointer ${isSelected ? 'bg-[#00d1ff] text-black font-bold shadow-[0_0_10px_rgba(0,209,255,0.6)] scale-105 z-10' : hasVideo ? (cell.level === 'high' ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-600/40' : cell.level === 'medium' ? 'bg-[#011428] text-white border border-[#00d1ff]/40' : 'bg-slate-800/60 text-slate-300 border border-slate-700') : 'bg-slate-900/30 text-slate-600 border border-slate-900 opacity-40 cursor-not-allowed'}`}>
                      <span className="text-xs">{cell.dayNumber}</span>
                      {hasVideo && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-black' : cell.level === 'high' ? 'bg-emerald-400' : 'bg-[#00d1ff]'}`} />}
                      {hasVideo && cell.count > 1 && <span className="text-[8px]">{cell.count}</span>}
                    </button>
                  );
                })}
              </div>
              {isLoadingCalendar && <div className="text-center text-xs font-mono text-[#00d1ff] mt-2">Cargando calendario...</div>}
              {calendarError && <div className="text-center text-xs font-mono text-amber-400 mt-2">{calendarError}</div>}
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-2.5 pt-2 border-t border-slate-800 px-1">
                <span className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#00d1ff]" />
                  <span>Días con video {isLoadingCalendar ? '...' : `(${calendarData.length})`}</span>
                </span>
                <span className="text-[#00d1ff] font-bold">Fecha: {selectedDate}</span>
              </div>
            </div>
          </div>

          <div className="bg-[#011428] border border-[#293a50] rounded-2xl p-3.5 sm:p-4 shadow-lg space-y-3">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-[#00d1ff]" />
              <h2 className="text-xs sm:text-sm font-bold text-white font-mono uppercase tracking-wide">3. Selector de Rango Horario</h2>
              {isLoadingFiles && <span className="text-xs font-mono text-[#00d1ff] animate-pulse">Cargando timeline...</span>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center space-x-2 bg-slate-900/80 p-2.5 rounded-xl border border-[#293a50]">
                <div className="flex-1">
                  <label className="text-[10px] font-mono text-slate-400 block mb-1">Hora Inicio (Desde):</label>
                  <input type="time" step={1} value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full bg-[#000f20] border border-[#293a50] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-[#00d1ff]" />
                </div>
                <div className="text-slate-500 font-mono text-xs pt-4">→</div>
                <div className="flex-1">
                  <label className="text-[10px] font-mono text-slate-400 block mb-1">Hora Fin (Hasta):</label>
                  <input type="time" step={1} value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full bg-[#000f20] border border-[#293a50] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-[#00d1ff]" />
                </div>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-[#293a50] flex flex-col justify-between">
                <span className="text-[10px] font-mono text-slate-400 block mb-1">Rangos de Turno:</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px] font-mono">
                  <button onClick={() => { setStartTime('06:00:00'); setEndTime('12:00:00'); }} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-center cursor-pointer">Mañana (6-12h)</button>
                  <button onClick={() => { setStartTime('12:00:00'); setEndTime('18:00:00'); }} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-center cursor-pointer">Tarde (12-18h)</button>
                  <button onClick={() => { setStartTime('18:00:00'); setEndTime('23:59:59'); }} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-center cursor-pointer">Noche (18-24h)</button>
                  <button onClick={() => { setStartTime('00:00:00'); setEndTime('23:59:59'); }} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-center col-span-2 sm:col-span-3 cursor-pointer">Día Completo (00:00 a 23:59)</button>
                </div>
              </div>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-xl border border-[#293a50]">
              <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1.5">
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>23:59</span>
              </div>
              <div className="relative h-6 bg-slate-900 rounded-md overflow-hidden border border-slate-800 flex items-center">
                {videoFiles.map((f: any, idx: number) => {
                  const s = toSec(extractTime(f.startTime));
                  const e = toSec(extractTime(f.endTime));
                  const left = (s / 86400) * 100;
                  const width = Math.max(0.4, ((e - s) / 86400) * 100);
                  const colors: any = { 1: '#00d1ff', 2: '#22c55e', 3: '#f59e0b', 4: '#ef4444' };
                  return <div key={idx} onClick={() => clipRange(f.startTime, f.endTime)} title={`CH${f._channel || f.chn}: ${extractTime(f.startTime)} - ${extractTime(f.endTime)}`} className="absolute h-4 rounded-sm cursor-pointer hover:opacity-80 transition-opacity" style={{ left: `${left}%`, width: `${width}%`, backgroundColor: colors[f._channel || f.chn] || '#00d1ff', top: '4px' }} />;
                })}
                <div className="absolute h-full bg-[#00d1ff]/20 border-x-2 border-[#00d1ff] pointer-events-none" style={{ left: `${(toSec(startTime) / 86400) * 100}%`, width: `${Math.max(1, ((toSec(endTime) - toSec(startTime)) / 86400) * 100)}%` }} />
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-1.5">
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-xs bg-[#00d1ff]" />
                  <span>Grabación {videoFiles.length} segmentos</span>
                </span>
                <span className="flex items-center space-x-2">
                  <button onClick={() => nudgeRange('start', -5)} className="px-1 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 cursor-pointer">-5m Inicio</button>
                  <button onClick={() => nudgeRange('end', 5)} className="px-1 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 cursor-pointer">+5m Fin</button>
                  <button onClick={() => expandRange(15)} className="px-1 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 cursor-pointer">Expand 15m</button>
                  <button onClick={() => setQuickRange(30)} className="px-1 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 cursor-pointer">30m</button>
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-r from-[#011428] via-[#021d38] to-[#011428] border border-[#00d1ff]/50 shadow-[0_0_20px_rgba(0,209,255,0.15)] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs font-mono text-slate-300 space-y-1 w-full sm:w-auto">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-[#00d1ff]" />
                <span className="font-bold text-white text-sm">Resumen de Exportación:</span>
              </div>
              <div className="text-[11px] text-slate-300">
                <span className="text-[#00d1ff] font-bold">{selectedChannels.length} Cámara(s)</span> (CH {selectedChannels.join(', ')}) • Fecha: <span className="text-white font-bold">{selectedDate}</span> • Horario: <span className="text-white font-bold">{startTime} - {endTime}</span>
              </div>
              <div className="text-[10px] text-slate-400">Tamaño Estimado: ~{estimatedSizeMb} MB • Stream: {streamType === '1' ? 'Principal' : 'Secundario'} • Segmentos: {videoFiles.length}</div>
            </div>
            <button onClick={handleTriggerBulkDownload} disabled={selectedChannels.length === 0 || videoFiles.length === 0} className="w-full sm:w-auto flex items-center justify-center space-x-2 px-5 py-3 rounded-xl bg-[#00d1ff] hover:bg-[#4cd6ff] text-black font-mono font-bold text-xs sm:text-sm transition-all shadow-[0_0_15px_rgba(0,209,255,0.5)] cursor-pointer disabled:opacity-30">
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>Descargar Seleccionadas ({selectedChannels.length} Canales)</span>
            </button>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#293a50]/60 pb-2">
              <h3 className="text-xs sm:text-sm font-bold text-white font-mono flex items-center space-x-2">
                <Film className="w-4 h-4 text-[#00d1ff]" />
                <span>Clips del Día ({selectedDate}) - {videoFiles.length} segmentos</span>
              </h3>
              <span className="text-xs font-mono text-slate-400">{isLoadingFiles ? 'Cargando...' : `${videoFiles.length} archivos`}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {videoFiles.slice(0, 12).map((f: any, idx: number) => (
                <div key={idx} className="bg-[#011428] border border-[#293a50] rounded-xl overflow-hidden shadow-lg flex flex-col hover:border-[#00d1ff]/50 transition-all">
                  <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="flex justify-between items-center">
                        <h4 className="text-white font-bold font-mono text-xs truncate">CH{f._channel || f.chn} - {extractTime(f.startTime)} → {extractTime(f.endTime)}</h4>
                        <span className="text-[10px] font-mono text-slate-400">{f.size ? (f.size / 1024 / 1024).toFixed(1) + ' MB' : ''}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-1">Inicio: {f.startTime} | Fin: {f.endTime}</div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-[#293a50]/60">
                      <button onClick={() => clipRange(f.startTime, f.endTime)} className="text-[11px] font-mono px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer">Usar rango</button>
                      <span className="text-[10px] font-mono text-emerald-400">CH{f._channel || f.chn}</span>
                    </div>
                  </div>
                </div>
              ))}
              {videoFiles.length === 0 && !isLoadingFiles && <div className="col-span-2 text-center py-8 text-slate-500 font-mono text-xs">Sin grabaciones para este día/canal/stream. Prueba otro día del calendario o cambia a Secundario.</div>}
            </div>
          </div>
        </div>
      </div>
      {previewClip && <VideoPreviewModal target={previewClip} onClose={() => setPreviewClip(null)} onSave={() => setPreviewClip(null)} />}
    </div>
  );
};