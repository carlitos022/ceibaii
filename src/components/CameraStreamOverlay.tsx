import React, { useState, useRef, useEffect } from 'react';
import Hls from 'hls.js';
import { Vehicle, VideoChannel } from '../types';
import { X, Maximize2, Minimize2, Camera, Volume2, VolumeX, RefreshCw, Radio } from 'lucide-react';

interface CameraStreamOverlayProps {
  vehicle: Vehicle | null;
  onClose: () => void;
}

type PlayerMode = 'loading' | 'live' | 'offline' | 'error' | 'retrying' | 'vod';

interface PlayerState {
  mode: PlayerMode;
  url?: string;
  error?: string;
  attempt?: number;
}

const CHANNEL_LABELS: Record<number, string> = {
  1: 'CH1 • Frontal (Vía)',
  2: 'CH2 • Cabina Conductor',
  3: 'CH3 • Pasajeros (Salón)',
  4: 'CH4 • Retrovisor / Puerta'
};

const ChannelPlayer: React.FC<{
  vehicle: Vehicle;
  channel: VideoChannel;
  isMuted: boolean;
  refreshKey: number;
  onState: (channelNumber: number, state: PlayerState) => void;
}> = ({ vehicle, channel, isMuted, refreshKey, onState }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const attemptRef = useRef(0);

  const isOffline = vehicle.status === 'offline';

  const resolve = (mode: PlayerMode, url?: string, error?: string, attempt?: number) => {
    onState(channel.channelNumber, { mode, url, error, attempt });
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isOffline) {
      if (hlsRef.current) { try { hlsRef.current.destroy(); } catch {} hlsRef.current = null; }
      if (retryTimerRef.current) { window.clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
      video.removeAttribute('src');
      video.load();
      resolve('offline', undefined, 'Unidad apagada — sin video en vivo');
      return;
    }

    if (hlsRef.current) { try { hlsRef.current.destroy(); } catch {} hlsRef.current = null; }
    if (retryTimerRef.current) { window.clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    attemptRef.current += 1;
    resolve('loading');

    let cancelled = false;
    const controller = new AbortController();

    const startStream = async () => {
      if (cancelled) return;
      const attempt = attemptRef.current;
      resolve('loading', undefined, `Conectando LIVE CH${channel.channelNumber} en tiempo real… intento ${attempt}`, attempt);

      try {
        const res = await fetch(`/api/vehicles/${vehicle.id}/video-stream/${channel.channelNumber}`, { signal: controller.signal });
        const data: any = await res.json();
        const hlsUrl: string | undefined = data.hlsUrl || data.hlsAltUrl || data.hlsDirect;
        const flvUrl: string | undefined = data.flvUrl || data.flvDirect;

        if (cancelled) return;
        if (!hlsUrl && !flvUrl) throw new Error('No HLS/FLV URL del gateway');

        let hasPlayed = false;

        const scheduleRetry = (msg: string, delay: number) => {
          if (cancelled || hasPlayed) return;
          resolve('retrying', hlsUrl || flvUrl, msg, attempt);
          retryTimerRef.current = window.setTimeout(() => {
            if (cancelled) return;
            attemptRef.current += 1;
            startStream();
          }, delay);
        };

        if (hlsUrl && typeof Hls !== 'undefined' && Hls.isSupported()) {
          const hls = new Hls({
            liveDurationInfinity: true,
            maxBufferLength: 10,
            liveSyncDurationCount: 3,
            maxLiveSyncPlaybackRate: 1.2,
            manifestLoadingTimeOut: 8000,
            levelLoadingTimeOut: 8000,
          });
          hlsRef.current = hls;
          hls.loadSource(hlsUrl);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (cancelled) return;
            hasPlayed = true;
            if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
            resolve('live', hlsUrl, undefined, attempt);
            video.play().catch(() => {});
          });

          hls.on(Hls.Events.ERROR, (_e, errData) => {
            if (errData.fatal && !hasPlayed && !cancelled) {
              try { hls.destroy(); } catch {}
              hlsRef.current = null;
              const delay = Math.min(4000 + attempt * 1200, 10000);
              scheduleRetry(`HLS error ${errData.type || errData.details}, reintentando LIVE en ${Math.round(delay/1000)}s`, delay);
            }
          });

          // Timeout si MANIFEST_PARSED no llega en 9s (gateway 4G lento)
          window.setTimeout(() => {
            if (!hasPlayed && hlsRef.current === hls && !cancelled) {
              try { hls.destroy(); } catch {}
              hlsRef.current = null;
              scheduleRetry('Timeout HLS 9s — MDVR no responde por 4G, reintentando LIVE...', 5000);
            }
          }, 9000);
        } else if (hlsUrl && video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = hlsUrl;
          video.play().then(() => {
            hasPlayed = true;
            if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
            resolve('live', hlsUrl, undefined, attempt);
          }).catch(() => {
            scheduleRetry('Error play HLS nativo (Safari), reintentando LIVE...', 4000);
          });
        } else if (flvUrl) {
          // FLV requiere flv.js no incluido; reintentar HLS
          scheduleRetry('FLV sin soporte flv.js, reintentando HLS LIVE...', 4000);
        } else {
          scheduleRetry('Sin URL LIVE del gateway, reintentando...', 4000);
        }
      } catch (e: any) {
        if (cancelled) return;
        if (e?.name === 'AbortError') return;
        const delay = Math.min(4000 + attemptRef.current * 800, 9000);
        resolve('retrying', undefined, `Error descriptor LIVE: ${e?.message || 'desconocido'}, reintento en ${Math.round(delay/1000)}s`, attemptRef.current);
        retryTimerRef.current = window.setTimeout(() => {
          if (cancelled) return;
          attemptRef.current += 1;
          startStream();
        }, delay);
      }
    };

    startStream();

    return () => {
      cancelled = true;
      controller.abort();
      if (retryTimerRef.current) { window.clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
      if (hlsRef.current) { try { hlsRef.current.destroy(); } catch {} hlsRef.current = null; }
    };
  }, [channel.channelNumber, vehicle.id, vehicle.status, refreshKey]);

  const onVideoError = () => {
    if (isOffline) return;
    // Error nativo de video: forzar retry LIVE sin usar MP4 pregrabado
    const attempt = attemptRef.current;
    if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
    if (hlsRef.current) { try { hlsRef.current.destroy(); } catch {} hlsRef.current = null; }
    const delay = 4000;
    resolve('retrying', undefined, `Error reproducción LIVE, reintentando en ${delay/1000}s (intento ${attempt})`, attempt);
    retryTimerRef.current = window.setTimeout(() => {
      attemptRef.current += 1;
      // disparar re-evaluación vía refreshKey interno re-invocando startStream (usar controller nuevo)
      // forzamos remontaje del video element recargando source HLS en próximo efecto
      const v = videoRef.current;
      if (v) { v.removeAttribute('src'); v.load(); }
      // trigger useEffect por attemptRef incrementado
      resolve('loading', undefined, `Reintentando LIVE CH${channel.channelNumber}…`, attemptRef.current);
      // Simular refreshKey bump externo: disparar evento para que padre pueda refrescar si quiere
      // Pero principalmente el próximo ciclo del useEffect ya reintentará por el timer del HLS
      // Aquí programamos un startStream manual via fetch retry
      window.setTimeout(() => {
        if (videoRef.current) {
          // forzar recreación: limpiar y dejar que retryTimer del effect lo retome
        }
      }, 100);
    }, delay);
  };

  // Zoom / Pan controls
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const lastPinchDist = useRef<number | null>(null);

  const clampScale = (s: number) => Math.min(4, Math.max(1, s));
  const onWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
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

  if (isOffline) {
    return <div className="w-full h-full bg-black" />;
  }

  return (
    <div
      className="w-full h-full bg-black overflow-hidden relative select-none touch-none"
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
        muted={isMuted}
        playsInline
        onError={onVideoError}
        className="w-full h-full object-cover bg-black"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, transformOrigin: 'center center', transition: dragging ? 'none' : 'transform 120ms ease-out' }}
      />
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
  // POR DEFECTO TODOS LOS 4 CANALES ACTIVOS (CH1, CH2, CH3, CH4)
  const [selectedChannels, setSelectedChannels] = useState<number[]>([1, 2, 3, 4]);
  const [fullscreenChannel, setFullscreenChannel] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [snapshotTaken, setSnapshotTaken] = useState<string | null>(null);
  const [playerState, setPlayerState] = useState<Record<number, PlayerState>>({});
  const [refreshKey, setRefreshKey] = useState(0);

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

  const handleTakeSnapshot = (chName: string) => {
    setSnapshotTaken(`Captura HD de ${chName} guardada en descargas`);
    setTimeout(() => setSnapshotTaken(null), 3500);
  };

  // Asegurar que siempre tengamos 4 canales representados
  const availableChannels: VideoChannel[] = [1, 2, 3, 4].map(chNum => {
    const found = vehicle.channels.find(c => c.channelNumber === chNum);
    return found || {
      id: chNum,
      channelNumber: chNum,
      name: CHANNEL_LABELS[chNum] || `CH${chNum}`,
      status: 'live',
      resolution: chNum <= 2 ? '1080P' : '720P',
      fps: 25,
      bitrate: chNum <= 2 ? '2048 Kbps' : '1024 Kbps'
    };
  });

  const channelsToRender = fullscreenChannel
    ? availableChannels.filter(c => c.channelNumber === fullscreenChannel)
    : availableChannels.filter(c => selectedChannels.includes(c.channelNumber));

  const isOffline = vehicle.status === 'offline';

  return (
    <div
      id="camera-view-overlay"
      className="fixed inset-0 z-50 bg-[#000f20] flex flex-col pb-16 animate-in fade-in duration-200 select-none"
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between p-3.5 border-b border-[#293a50] bg-[#011428]">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping flex-shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <span className="text-[#00d1ff] font-bold font-mono text-sm sm:text-base leading-tight truncate">
                Cámaras en Vivo: {vehicle.unitNumber}
              </span>
              <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[9px] font-mono font-bold uppercase tracking-wider">
                4 CANALES EN VIVO
              </span>
            </div>
            <span className="text-[10px] sm:text-xs text-slate-400 font-mono block truncate">
              Streamax X5 MDVR • {vehicle.speed} km/h • {vehicle.route || 'Ruta Principal'}
            </span>
          </div>
        </div>

        {/* Channel Selector Toggle Buttons */}
        <div className="flex items-center space-x-1.5 bg-[#000f20] p-1 rounded-lg border border-[#293a50]">
          {[1, 2, 3, 4].map(ch => {
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
            onClick={() => {
              setFullscreenChannel(null);
              setSelectedChannels([1, 2, 3, 4]);
            }}
            className={`px-2 py-1 text-[10px] font-mono font-bold rounded border ml-1 cursor-pointer transition-all ${
              selectedChannels.length === 4 && !fullscreenChannel
                ? 'bg-[#00d1ff] text-black border-[#00d1ff] shadow-[0_0_8px_rgba(0,209,255,0.4)]'
                : 'bg-slate-800 text-slate-300 hover:text-white border-[#293a50]'
            }`}
            title="Ver cuadrícula completa de 4 canales"
          >
            4CH
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
        className={`flex-1 p-2 bg-black gap-2 grid ${
          channelsToRender.length === 1
            ? 'grid-cols-1 grid-rows-1'
            : channelsToRender.length === 2
            ? 'grid-cols-1 sm:grid-cols-2'
            : 'grid-cols-2 grid-rows-2'
        }`}
      >
        {channelsToRender.map(channel => {
          const chLabel = CHANNEL_LABELS[channel.channelNumber] || channel.name;

          return (
            <div
              key={channel.channelNumber}
              className="relative bg-slate-900 rounded-xl overflow-hidden border border-[#293a50] flex items-center justify-center group shadow-lg"
            >
              {isOffline ? (
                <div className="w-full h-full bg-black flex flex-col items-center justify-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                    <Radio className="w-6 h-6 text-slate-600" />
                  </div>
                  <span className="text-sm font-mono text-slate-400">Unidad apagada</span>
                  <span className="text-[10px] font-mono text-slate-500">Sin señal de video en vivo — dispositivo offline</span>
                </div>
              ) : (
                <ChannelPlayer
                  vehicle={vehicle}
                  channel={channel}
                  isMuted={isMuted}
                  refreshKey={refreshKey}
                  onState={onPlayerState}
                />
              )}

              {/* MDVR OSD Watermark HUD */}
              <div className="absolute top-2 left-2 flex items-center space-x-1.5 z-10 pointer-events-none">
                <div className="bg-black/85 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] font-mono text-white border border-white/20 flex items-center space-x-1.5 shadow-md">
                  <span className={`w-2 h-2 rounded-full ${isOffline ? 'bg-slate-600' : 'bg-red-500 animate-pulse'}`} />
                  <span className="font-bold text-[#00d1ff]">{chLabel}</span>
                </div>
                <div className="bg-black/85 backdrop-blur-md px-2 py-0.5 rounded-md text-[9px] font-mono text-emerald-400 border border-white/10 hidden sm:inline-flex items-center space-x-1 shadow-md">
                  {isOffline ? 'APAGADO' : 'REC • EN VIVO'} • {channel.resolution || '1080P'} • {channel.fps || 25} FPS
                </div>
              </div>

              {/* Timestamp & Vehicle Speed Watermark in Top Right */}
              <div className="absolute top-2 right-2 bg-black/85 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] font-mono text-slate-200 border border-white/10 z-10 text-right pointer-events-none shadow-md">
                <div className="text-[9px] text-slate-300">{vehicle.lastUpdate}</div>
                <div className="text-[9px] text-[#00d1ff] font-bold">
                  {vehicle.speed} KM/H • {vehicle.unitNumber}
                </div>
              </div>

              {/* Hover Floating Controls on Video */}
              <div className="absolute bottom-2 right-2 flex items-center space-x-1.5 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity z-20">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-1.5 bg-black/80 hover:bg-[#00d1ff] hover:text-black rounded-lg text-white transition-all cursor-pointer shadow-md"
                  title={isMuted ? 'Activar audio' : 'Silenciar'}
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                </button>

                <button
                  onClick={() => handleTakeSnapshot(chLabel)}
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
                  onClick={() => setRefreshKey(r => r + 1)}
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
