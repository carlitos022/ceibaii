import { useEffect, useRef, useState, type RefObject } from 'react';
import flvjs from 'flv.js';

export interface LiveState {
  mode: 'loading' | 'live' | 'error' | 'retrying' | 'buffering';
  url?: string;
  error?: string;
  attempt?: number;
  hasAudio?: boolean;
  width?: number;
  height?: number;
}

// A session belongs to a device/channel, never to a GPS snapshot or mute button.
export function useLiveStream(videoRef: RefObject<HTMLVideoElement | null>, vehicleId: string,
  channel: number, refreshKey: number, streamType: '0' | '1', onState: (channel: number, state: LiveState) => void) {
  const [state, setState] = useState<LiveState>({ mode: 'loading' });
  const callback = useRef(onState);
  callback.current = onState;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let disposed = false;
    let player: ReturnType<typeof flvjs.createPlayer> | null = null;
    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let watchdog: ReturnType<typeof setInterval> | undefined;
    let attempt = 0;
    let failures = 0;
    let generation = 0;
    let current: LiveState = { mode: 'loading' };
    const publish = (next: Partial<LiveState>) => {
      if (disposed) return;
      current = { ...current, ...next };
      setState(current);
      callback.current(channel, current);
    };
    const release = () => {
      generation++;
      clearTimeout(timer);
      clearInterval(watchdog);
      controller?.abort();
      controller = null;
      video.onplaying = null;
      video.onerror = null;
      video.onended = null;
      video.onwaiting = null;
      const old = player;
      player = null;
      try { old?.destroy(); } catch { /* Already detached after a decode error. */ }
    };
    const retry = (reason: string) => {
      if (disposed) return;
      release();
      const delay = Math.min(12000, 750 * 2 ** Math.min(failures++, 4));
      publish({ mode: 'retrying', error: reason });
      timer = setTimeout(start, delay + channel * 150);
    };
    const start = async () => {
      if (disposed) return;
      release();
      const id = generation;
      const active = () => !disposed && id === generation;
      publish({ mode: 'loading', attempt: ++attempt, error: undefined, hasAudio: undefined, width: undefined, height: undefined });
      controller = new AbortController();
      timer = setTimeout(() => { if (active()) retry('El CMS no entregó la primera imagen a tiempo'); }, 35000);
      try {
        // Keep each AAC track attached: switching sound must not restart two cameras.
        let token: string | undefined;
        try { token = JSON.parse(localStorage.getItem('csrs_auth') || '{}').token; } catch {}
        if (!token) {
          release();
          publish({ mode: 'error', error: 'Inicie sesión para ver video en vivo' });
          return;
        }
        const headers = { Authorization: `Bearer ${token}` };
        const response = await fetch(`/api/vehicles/${encodeURIComponent(vehicleId)}/video-stream/${channel}?audio=1&stream=${streamType}`, { signal: controller.signal, headers });
        const data = await response.json();
        if (!active()) return;
        if (response.status === 401 || response.status === 403) {
          release();
          publish({ mode: 'error', error: data.error || 'Inicie sesión con una cuenta del CMS' });
          return;
        }
        if (!response.ok || !data.flvUrl) throw new Error(data.error || 'No se pudo iniciar el canal');
        if (!flvjs.isSupported()) {
          release();
          publish({ mode: 'error', error: 'Este navegador no admite video FLV/MSE. Use Chrome o Edge actualizado.' });
          return;
        }
        // The descriptor returns a short-lived token scoped to this vehicle/channel.
        // This is reliable across all flv.js loaders, including worker/fetch variants.
        const instance = flvjs.createPlayer({ type: 'flv', isLive: true, url: data.flvUrl }, {
          enableStashBuffer: false,
          lazyLoad: false,
          enableWorker: false,
          fixAudioTimestampGap: true,
          autoCleanupSourceBuffer: true,
          autoCleanupMaxBackwardDuration: 20,
          autoCleanupMinBackwardDuration: 10
        });
        player = instance;
        publish({ url: data.flvUrl });
        let lastProgress = Date.now();
        let lastTime = -1;
        let started = false;
        instance.on(flvjs.Events.ERROR, (_type: string, detail: string) => {
          if (active()) retry(`Se interrumpió el canal: ${detail}`);
        });
        instance.on(flvjs.Events.LOADING_COMPLETE, () => {
          if (active()) retry('El CMS cerró la transmisión');
        });
        instance.on(flvjs.Events.MEDIA_INFO, (info: any) => {
          if (active()) publish({ hasAudio: !!info.hasAudio, width: info.width, height: info.height });
        });
        video.onplaying = () => {
          if (!active()) return;
          started = true;
          clearTimeout(timer);
          lastProgress = Date.now();
          publish({ mode: 'live', error: undefined, width: video.videoWidth, height: video.videoHeight });
        };
        video.onerror = () => { if (active()) retry(video.error?.message || 'Error de decodificación'); };
        video.onwaiting = () => { if (active() && started) publish({ mode: 'buffering', error: 'Esperando datos del MDVR…' }); };
        video.onended = () => { if (active()) retry('La transmisión terminó'); };
        instance.attachMediaElement(video);
        instance.load();
        const play = () => Promise.resolve(video.play()).catch(e => {
          if (!active()) return;
          if (e.name === 'NotAllowedError') {
            video.muted = true;
            publish({ error: 'Pulse el altavoz para autorizar el sonido' });
            void video.play().catch(() => {});
          }
        });
        void play();
        watchdog = setInterval(() => {
          if (!active()) return;
          const now = Date.now();
          if (video.currentTime > lastTime + 0.05 && video.readyState >= 2) {
            lastTime = video.currentTime;
            lastProgress = now;
            if (started && video.currentTime > 10) failures = 0;
          }
          // Catch cellular stalls even when the socket stays open and emits no error.
          if (started && now - lastProgress > 18000) {
            retry('La imagen dejó de avanzar; recuperando señal');
            return;
          }
          if (video.buffered.length) {
            const end = video.buffered.end(video.buffered.length - 1);
            if (end - video.currentTime > 12) video.currentTime = Math.max(video.buffered.start(video.buffered.length - 1), end - 3);
          }
          if (started && video.paused) void play();
        }, 1000);
      } catch (e: any) {
        if (active()) retry(e.message || 'No se pudo conectar al CMS');
      }
    };
    timer = setTimeout(start, 0);
    return () => { disposed = true; release(); };
  }, [vehicleId, channel, refreshKey, streamType, videoRef]);
  return state;
}
