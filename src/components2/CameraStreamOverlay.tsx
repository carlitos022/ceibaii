import React, { useState, useRef, useEffect } from 'react';
import { useLiveStream } from './useLiveStream';
import { useEnhancedAudio } from './useEnhancedAudio';
import { Vehicle, VideoChannel } from '../types';
import { X, Maximize2, Minimize2, Camera, Volume2, VolumeX, RefreshCw, Radio } from 'lucide-react';

interface CameraStreamOverlayProps {
  vehicle: Vehicle | null;
  onClose: () => void;
}

type PlayerMode = 'loading' | 'live' | 'offline' | 'error' | 'retrying' | 'buffering' | 'vod';

interface PlayerState {
  mode: PlayerMode;
  url?: string;
  error?: string;
  attempt?: number;
  hasAudio?: boolean;
  width?: number;
  height?: number;
}

const CHANNEL_LABELS: Record<number, string> = {
  1: 'CH1 • Cámara 1',
  2: 'CH2 • Cámara 2',
  3: 'CH3 • Cámara 3',
  4: 'CH4 • Cámara 4'
};

const ChannelPlayer: React.FC<{
  vehicle: Vehicle;
  channel: VideoChannel;
  audioEnabled: boolean;
  refreshKey: number;
  streamType: '0' | '1';
  onState: (channelNumber: number, state: PlayerState) => void;
}> = ({ vehicle, channel, audioEnabled, refreshKey, streamType, onState }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stream = useLiveStream(videoRef, vehicle.id, channel.channelNumber, refreshKey, streamType, onState);
  useEnhancedAudio(videoRef, channel.channelNumber, audioEnabled);
  const { mode } = stream;

  // Zoom / Pan controls
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const lastPinchDist = useRef<number | null>(null);

  const clampScale = (s: number) => Math.min(4, Math.max(1, s));
  const onWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    // Keep normal scrolling available until the operator has zoomed the camera.
    if (scale === 1) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    const ns = clampScale(scale + delta);
    if (ns === 1) setPan({ x: 0, y: 0 });
    setScale(ns);
  };
  const onMouseDown: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (scale === 1) return;
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  };
  const onMouseMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!dragging || !dragStart.current) return;
    setPan({ x: dragStart.current.panX + (e.clientX - dragStart.current.x), y: dragStart.current.panY + (e.clientY - dragStart.current.y) });
  };
  const onMouseUp = () => setDragging(false);
  const onTouchStart: React.TouchEventHandler<HTMLDivElement> = (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDist.current = Math.hypot(dx, dy);
    } else if (e.touches.length === 1 && scale > 1) {
      setDragging(true);
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, panX: pan.x, panY: pan.y };
    }
  };
  const onTouchMove: React.TouchEventHandler<HTMLDivElement> = (e) => {
    if (e.touches.length === 2 && lastPinchDist.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const delta = (dist - lastPinchDist.current) * 0.008;
      const ns = clampScale(scale + delta);
      if (ns === 1) setPan({ x: 0, y: 0 });
      setScale(ns);
      lastPinchDist.current = dist;
    } else if (e.touches.length === 1 && dragging && dragStart.current) {
      setPan({ x: dragStart.current.panX + (e.touches[0].clientX - dragStart.current.x), y: dragStart.current.panY + (e.touches[0].clientY - dragStart.current.y) });
    }
  };
  const onTouchEnd: React.TouchEventHandler<HTMLDivElement> = () => {
    lastPinchDist.current = null;
    setDragging(false);
  };
  const resetZoom = () => { setScale(1); setPan({ x: 0, y: 0 }); };

  return (
    <div
      className="w-full h-full bg-black overflow-hidden relative select-none touch-pan-y"
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ cursor: scale > 1 ? (dragging ? 'grabbing' : 'grab') : 'default' }}
    >
      <video
        ref={videoRef}
        poster={channel.posterUrl}
        autoPlay
         // Web Audio owns the output. Keep the native element muted so audio is
         // silent until the operator explicitly enables one or more channels.
         muted
        playsInline
        data-channel={channel.channelNumber}
        className="w-full h-full object-contain bg-black"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, transformOrigin: 'center center', transition: dragging ? 'none' : 'transform 120ms ease-out' }}
      />
      {mode !== 'live' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/55 pointer-events-none">
          <div className="px-3 py-2 rounded-lg bg-black/80 border border-white/15 text-center max-w-[90%]">
            <div className="text-xs font-mono text-amber-300">
              {mode === 'error' ? 'Sin señal de video en vivo' : mode === 'retrying' ? 'Reconectando cámara...' : mode === 'buffering' ? 'Esperando señal...' : 'Conectando cámara...'}
            </div>
            <div className="text-[10px] font-mono text-slate-400 mt-1">{stream.error || 'La señal puede tardar unos segundos'}</div>
          </div>
        </div>
      )}
      {scale > 1 && (
        <button onClick={resetZoom} className="absolute top-2 left-1/2 -translate-x-1/2 z-20 px-2 py-1 rounded bg-black/80 text-white text-[10px] font-mono border border-white/20 shadow-md">
          Restablecer zoom {Math.round(scale * 100)}%
        </button>
      )}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => setScale(s => clampScale(s + 0.3))} className="px-2 py-1 bg-black/80 text-white rounded text-xs hover:bg-[#00d1ff] hover:text-black transition-colors">+</button>
        <button onClick={() => setScale(s => { const ns = clampScale(s - 0.3); if (ns === 1) setPan({ x: 0, y: 0 }); return ns; })} className="px-2 py-1 bg-black/80 text-white rounded text-xs hover:bg-[#00d1ff] hover:text-black transition-colors">−</button>
      </div>
    </div>
  );
};

export const CameraStreamOverlay: React.FC<CameraStreamOverlayProps> = ({
  vehicle,
  onClose
}) => {
  // One channel avoids exhausting the mobile MDVR uplink; 4CH remains opt-in.
  const [selectedChannels, setSelectedChannels] = useState<number[]>(vehicle?.channels[0] ? [vehicle.channels[0].channelNumber] : []);
  const [fullscreenChannel, setFullscreenChannel] = useState<number | null>(null);
  // All AAC tracks stay attached; operators explicitly enable any combination.
  const [enabledAudioChannels, setEnabledAudioChannels] = useState<number[]>([]);
  const [snapshotTaken, setSnapshotTaken] = useState<string | null>(null);
  const [playerState, setPlayerState] = useState<Record<number, PlayerState>>({});
  const [refreshKeys, setRefreshKeys] = useState<Record<number, number>>({});
  const [streamType, setStreamType] = useState<'0' | '1'>('1');

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      const channel = Number(event.key);
      if (vehicle?.channels.some(c => c.channelNumber === channel)) {
        setFullscreenChannel(null);
        setSelectedChannels([channel]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, vehicle?.id, vehicle?.channels]);

  if (!vehicle) return null;

  const onPlayerState = (channelNumber: number, state: PlayerState) => {
    setPlayerState((prev) => ({ ...prev, [channelNumber]: state }));
  };

  const toggleChannel = (chNum: number) => {
    if (selectedChannels.includes(chNum)) {
      if (selectedChannels.length > 1) {
        setSelectedChannels(selectedChannels.filter(c => c !== chNum));
      }
    } else {
      setSelectedChannels([...selectedChannels, chNum].sort());
    }
  };

  const handleTakeSnapshot = (channelNumber: number) => {
    const video = document.querySelector<HTMLVideoElement>(`#camera-view-overlay video[data-channel="${channelNumber}"]`);
    if (!video || video.readyState < 2 || !video.videoWidth) {
      setSnapshotTaken('Espere a que la cámara entregue una imagen');
      setTimeout(() => setSnapshotTaken(null), 3500);
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${vehicle.unitNumber}-CH${channelNumber}-${Date.now()}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setSnapshotTaken(`Captura CH${channelNumber} enviada a descargas`);
      setTimeout(() => setSnapshotTaken(null), 3500);
    }, 'image/png');
  };

  const toggleChannelAudio = (channelNumber: number) => {
    setEnabledAudioChannels(channels => channels.includes(channelNumber)
      ? channels.filter(channel => channel !== channelNumber)
      : [...channels, channelNumber].sort());
  };

  const toggleAllAudio = () => {
    setEnabledAudioChannels(channels => {
      const numbers = vehicle?.channels.map(c => c.channelNumber) || [];
      const enable = channels.length !== numbers.length;
      if (enable) {
        setSelectedChannels(numbers);
        setFullscreenChannel(null);
      }
      return enable ? numbers : [];
    });
  };

  const availableChannels: VideoChannel[] = vehicle.channels;

  const channelsToRender = fullscreenChannel
    ? availableChannels.filter(c => c.channelNumber === fullscreenChannel)
    : availableChannels.filter(c => selectedChannels.includes(c.channelNumber));

  return (
    <div
      id="camera-view-overlay"
      className="fixed inset-0 z-50 bg-[#000f20] flex flex-col pb-16 lg:pb-0 overflow-hidden animate-in fade-in duration-200 select-none"
    >
      {/* Top Bar */}
      <div className="shrink-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3.5 border-b border-[#293a50] bg-[#011428]">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping flex-shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center space-x-2 flex-wrap">
              <span className="text-[#00d1ff] font-bold font-mono text-sm sm:text-base leading-tight truncate">
                Cámaras en Vivo: {vehicle.unitNumber}
              </span>
              <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[9px] font-mono font-bold uppercase tracking-wider">
                {availableChannels.length} CANALES CONFIGURADOS
              </span>
            </div>
            <span className="text-[10px] sm:text-xs text-slate-400 font-mono block truncate">
              {vehicle.deviceModel || 'MDVR'} • {vehicle.speed} km/h • Grupo: {vehicle.route || 'Sin dato'}
            </span>
          </div>
        </div>

        {/* Channel Selector Toggle Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#000f20] p-1 rounded-lg border border-[#293a50]">
          {availableChannels.map(({channelNumber: ch}) => {
            const isSelected = selectedChannels.includes(ch);
            return (
              <button
                key={ch}
                onClick={() => {
                  setFullscreenChannel(null);
                  toggleChannel(ch);
                }}
                className={`w-7 h-7 flex items-center justify-center rounded text-xs font-bold font-mono transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#00d1ff] text-black shadow-[0_0_8px_rgba(0,209,255,0.5)]'
                    : 'text-slate-400 hover:text-white border border-[#293a50]'
                }`}
                title={CHANNEL_LABELS[ch] || `Canal ${ch}`}
              >
                {ch}
              </button>
            );
          })}

          <button
            onClick={toggleAllAudio}
            className={`px-2 py-1 text-[10px] font-mono font-bold rounded border cursor-pointer transition-all ${enabledAudioChannels.length === availableChannels.length && availableChannels.length > 0 ? 'bg-emerald-400 text-black border-emerald-300' : 'bg-slate-800 text-slate-300 border-[#293a50]'}`}
            title={enabledAudioChannels.length === availableChannels.length ? 'Silenciar todos los canales' : 'Activar audio de todos los canales'}
          >
            {enabledAudioChannels.length === availableChannels.length ? 'SILENCIAR' : 'AUDIO'}
          </button>
          <button
            onClick={() => {
              setFullscreenChannel(null);
              setSelectedChannels(availableChannels.map(c => c.channelNumber));
            }}
            className={`px-2 py-1 text-[10px] font-mono font-bold rounded border cursor-pointer transition-all ${
              selectedChannels.length === availableChannels.length && !fullscreenChannel
                ? 'bg-[#00d1ff] text-black border-[#00d1ff] shadow-[0_0_8px_rgba(0,209,255,0.4)]'
                : 'bg-slate-800 text-slate-300 hover:text-white border-[#293a50]'
            }`}
            title="Ver todos los canales configurados"
          >
            {availableChannels.length}CH
          </button>
          <button
            onClick={() => setStreamType(type => type === '1' ? '0' : '1')}
            className="px-2 py-1 text-[10px] font-mono font-bold rounded border border-[#293a50] bg-slate-800 text-slate-200 hover:text-white"
            title="Cambiar flujo del MDVR; la resolución depende de la configuración y señal del equipo"
          >
            FLUJO {streamType}
          </button>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-full transition-colors cursor-pointer flex-shrink-0 ml-2"
          aria-label="Cerrar reproductor de cámaras"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Snapshot Toast notification */}
      {snapshotTaken && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-mono shadow-xl border border-emerald-400 animate-in fade-in slide-in-from-top-2">
          {snapshotTaken}
        </div>
      )}

      {/* Video Feeds Grid (Cuadrícula 2x2 para los 4 canales) */}
      <div
        className={`flex-1 min-h-0 overflow-auto p-2 bg-black gap-2 grid auto-rows-[minmax(220px,1fr)] ${
          channelsToRender.length === 1 ? 'grid-cols-1 grid-rows-1' : 'grid-cols-1 sm:grid-cols-2'
        }`}
      >
        {channelsToRender.map(channel => {
          const chLabel = channel.name || CHANNEL_LABELS[channel.channelNumber];

          return (
            <div
              key={channel.channelNumber}
              className="relative min-h-[220px] bg-slate-900 rounded-xl overflow-hidden border border-[#293a50] flex items-center justify-center group shadow-lg"
            >
              <ChannelPlayer
                vehicle={vehicle}
                channel={channel}
                audioEnabled={enabledAudioChannels.includes(channel.channelNumber)}
                refreshKey={refreshKeys[channel.channelNumber] || 0}
                streamType={streamType}
                onState={onPlayerState}
              />

              {/* MDVR OSD Watermark HUD */}
              <div className="absolute top-2 left-2 flex items-center space-x-1.5 z-10 pointer-events-none">
                <div className="bg-black/85 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] font-mono text-white border border-white/20 flex items-center space-x-1.5 shadow-md">
                  <span className={`w-2 h-2 rounded-full ${playerState[channel.channelNumber]?.mode === 'live' ? 'bg-red-500 animate-pulse' : 'bg-amber-400 animate-pulse'}`} />
                  <span className="font-bold text-[#00d1ff]">{chLabel}</span>
                </div>
                <div className="bg-black/85 backdrop-blur-md px-2 py-0.5 rounded-md text-[9px] font-mono text-emerald-400 border border-white/10 hidden sm:inline-flex items-center space-x-1 shadow-md">
                   {playerState[channel.channelNumber]?.mode === 'live' ? 'EN VIVO' : 'CONECTANDO'}
                   {playerState[channel.channelNumber]?.width ? ` • ${playerState[channel.channelNumber].width}×${playerState[channel.channelNumber].height}` : ''}
                   {playerState[channel.channelNumber]?.hasAudio === false ? ' • Sin pista de audio' : ''}
                </div>
              </div>

              {/* Timestamp & Vehicle Speed Watermark in Top Right */}
              <div className="absolute top-2 right-2 bg-black/85 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] font-mono text-slate-200 border border-white/10 z-10 text-right pointer-events-none shadow-md">
                <div className="text-[9px] text-slate-300">GPS: {vehicle.lastUpdate || 'sin reporte'}</div>
                <div className="text-[9px] text-[#00d1ff] font-bold">
                  {vehicle.speed} KM/H • {vehicle.unitNumber}
                </div>
              </div>

              {/* Hover Floating Controls on Video */}
              <div className="absolute bottom-2 right-2 flex items-center space-x-1.5 opacity-90 sm:opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity z-20">
                <button
                  onClick={() => toggleChannelAudio(channel.channelNumber)}
                  className="p-1.5 bg-black/80 hover:bg-[#00d1ff] hover:text-black rounded-lg text-white transition-all cursor-pointer shadow-md"
                   title={enabledAudioChannels.includes(channel.channelNumber) ? 'Silenciar este canal' : 'Activar audio en este canal'}
                   aria-pressed={enabledAudioChannels.includes(channel.channelNumber)}
                >
                   {enabledAudioChannels.includes(channel.channelNumber) ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-red-400" />}
                </button>

                <button
                   onClick={() => handleTakeSnapshot(channel.channelNumber)}
                  className="p-1.5 bg-black/80 hover:bg-emerald-500 hover:text-white rounded-lg text-white transition-all cursor-pointer shadow-md"
                  title="Capturar foto instantánea HD"
                >
                  <Camera className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    if (fullscreenChannel === channel.channelNumber) {
                      setFullscreenChannel(null);
                    } else {
                      setFullscreenChannel(channel.channelNumber);
                    }
                  }}
                  className="p-1.5 bg-black/80 hover:bg-[#00d1ff] hover:text-black rounded-lg text-white transition-all cursor-pointer shadow-md"
                  title={fullscreenChannel === channel.channelNumber ? 'Volver a cuadrícula 4CH' : 'Maximizar este canal'}
                >
                  {fullscreenChannel === channel.channelNumber ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </button>

                <button
                   onClick={() => setRefreshKeys(keys => ({ ...keys, [channel.channelNumber]: (keys[channel.channelNumber] || 0) + 1 }))}
                  className="p-1.5 bg-black/80 hover:bg-slate-700 rounded-lg text-white transition-all cursor-pointer shadow-md"
                  title="Recargar señal del canal"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
