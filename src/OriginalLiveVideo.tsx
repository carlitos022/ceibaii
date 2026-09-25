import { useEffect, useRef, useState } from 'react';
import flvjs from 'flv.js';
import type { Vehicle } from './types';

type Props = {
  token: string;
  vehicle: Vehicle;
  onBack: () => void;
};

export default function OriginalLiveVideo({ token, vehicle, onBack }: Props) {
  const channels = vehicle.channels?.filter(ch => ch.channelNumber > 0) || [];
  const [channel, setChannel] = useState(channels[0]?.channelNumber || 1);
  const [state, setState] = useState('Conectando...');
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const current = videoRef.current;
    if (!current) return;
    const media: HTMLVideoElement = current;
    let disposed = false;
    let player: ReturnType<typeof flvjs.createPlayer> | null = null;
    const controller = new AbortController();

    async function start() {
      setState('Conectando...');
      try {
        const response = await fetch(
          `/api/monitor/vehicle/${encodeURIComponent(vehicle.id)}/video-stream/${channel}?audio=1&stream=1`,
          { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal }
        );
        const data = await response.json();
        if (!response.ok || !data.flvUrl) throw new Error(data.error || 'No se pudo iniciar el canal');
        if (!flvjs.isSupported()) throw new Error('Este dispositivo no admite FLV/MSE');

        player = flvjs.createPlayer(
          { type: 'flv', isLive: true, url: data.flvUrl },
          {
            enableStashBuffer: false,
            lazyLoad: false,
            enableWorker: false,
            fixAudioTimestampGap: true,
            autoCleanupSourceBuffer: true,
            autoCleanupMaxBackwardDuration: 20,
            autoCleanupMinBackwardDuration: 10
          }
        );
        player.on(flvjs.Events.ERROR, (_type: string, detail: string) => {
          if (!disposed) setState('Error de video: ' + detail);
        });
        media.onplaying = () => { if (!disposed) setState('En vivo'); };
        media.onwaiting = () => { if (!disposed) setState('Esperando datos...'); };
        player.attachMediaElement(media);
        player.load();
        try {
          await media.play();
        } catch {
          media.muted = true;
          await media.play().catch(() => {});
        }
      } catch (error: any) {
        if (!disposed && error?.name !== 'AbortError') setState(error?.message || 'No se pudo abrir video');
      }
    }

    void start();
    return () => {
      disposed = true;
      controller.abort();
      media.onplaying = null;
      media.onwaiting = null;
      try { player?.destroy(); } catch {}
    };
  }, [vehicle.id, channel, token]);

  return (
    <section className="ceiba-live-screen">
      <header className="ceiba-live-head">
        <button onClick={onBack}>‹</button>
        <strong>{vehicle.unitNumber}</strong>
        <span>{state}</span>
      </header>
      <div className="ceiba-live-video-wrap">
        <video ref={videoRef} className="ceiba-live-video" playsInline controls />
      </div>
      <div className="ceiba-live-channels">
        {channels.map(ch => (
          <button
            key={ch.channelNumber}
            className={channel === ch.channelNumber ? 'active' : ''}
            onClick={() => setChannel(ch.channelNumber)}
          >
            CH{ch.channelNumber}
            <span>{ch.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
