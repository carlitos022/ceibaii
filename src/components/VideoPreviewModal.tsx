import React, { useState, useRef, useEffect } from 'react';
import { DownloadJob, LibraryRecord } from '../types';
import { X, Download, Play, Pause, Volume2, VolumeX, Maximize, FileVideo, CheckCircle2, RotateCcw, FastForward, Radio } from 'lucide-react';

export interface VideoPreviewTarget {
  id: string;
  title: string;
  unitNumber: string;
  channelName?: string;
  videoUrl?: string;
  fileSizeMb?: number | string;
  storageLocation?: string;
  startTime?: string;
  endTime?: string;
}

interface VideoPreviewModalProps {
  target: VideoPreviewTarget | DownloadJob | LibraryRecord | null;
  onClose: () => void;
  onSave?: (item: any) => void;
}

export const VideoPreviewModal: React.FC<VideoPreviewModalProps> = ({
  target,
  onClose,
  onSave
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(30);
  const [bufferedPercent, setBufferedPercent] = useState<number>(15);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!target) return;
    setIsPlaying(true);
    setCurrentTime(0);
    setBufferedPercent(20);

    // Simulate real-time buffering progress
    const bufferInterval = setInterval(() => {
      setBufferedPercent((prev) => {
        if (prev >= 100) {
          clearInterval(bufferInterval);
          return 100;
        }
        return Math.min(100, prev + Math.floor(Math.random() * 15 + 10));
      });
    }, 400);

    return () => clearInterval(bufferInterval);
  }, [target]);

  if (!target) return null;

  const title =
    'title' in target
      ? target.title
      : `${(target as LibraryRecord).channelName || 'Cámara'} - ${(target as LibraryRecord).unitNumber}`;

  const unitNumber = target.unitNumber || '03_LAA4015';
  const size =
    'size' in target
      ? target.size
      : `${(target as LibraryRecord).fileSizeMb || 120} MB`;

  const videoSrc =
    ('downloadUrl' in target && target.downloadUrl && target.downloadUrl !== '#')
      ? target.downloadUrl
      : ('videoUrl' in target && target.videoUrl)
      ? target.videoUrl
      : 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const changePlaybackRate = (rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      if (videoRef.current.duration && !isNaN(videoRef.current.duration)) {
        setDuration(videoRef.current.duration);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleFullScreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const handleSaveToDevice = () => {
    if (onSave) {
      onSave(target);
    }
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md select-none animate-in fade-in">
      <div className="bg-[#000f20] border border-[#293a50] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-[#293a50] bg-[#011428]">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#00d1ff]/15 border border-[#00d1ff]/30 flex items-center justify-center flex-shrink-0">
              <FileVideo className="w-4 h-4 text-[#00d1ff]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h2 className="font-mono font-bold text-white text-xs sm:text-sm leading-tight truncate">
                  {title}
                </h2>
                <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[9px] font-mono">
                  <Radio className="w-2.5 h-2.5 animate-pulse" />
                  <span>Streaming HD</span>
                </span>
              </div>
              <span className="text-[10px] sm:text-[11px] text-slate-400 font-mono">
                Unidad: {unitNumber} • Tamaño: {size}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800/80 rounded-full transition-colors cursor-pointer flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Player */}
        <div className="relative bg-black aspect-video flex items-center justify-center overflow-hidden group">
          <video
            ref={videoRef}
            src={videoSrc}
            autoPlay
            loop
            playsInline
            muted={isMuted}
            onTimeUpdate={handleTimeUpdate}
            onWaiting={() => setIsBuffering(true)}
            onPlaying={() => {
              setIsBuffering(false);
              setIsPlaying(true);
            }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            className="w-full h-full object-contain"
          />

          {/* Buffering Indicator */}
          {isBuffering && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center space-y-2 z-20">
              <div className="w-10 h-10 rounded-full border-3 border-[#00d1ff] border-t-transparent animate-spin" />
              <span className="text-xs font-mono text-[#00d1ff]">Buffering stream MDVR...</span>
            </div>
          )}

          {/* OSD Telematics Overlay on Top */}
          <div className="absolute top-2 left-2 bg-black/75 px-2.5 py-1 rounded text-[10px] font-mono text-[#00d1ff] border border-[#00d1ff]/30 pointer-events-none backdrop-blur-xs flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-bold text-white">{unitNumber}</span>
            <span>• MDVR PLAYBACK</span>
          </div>

          <div className="absolute top-2 right-2 bg-black/75 px-2.5 py-1 rounded text-[10px] font-mono text-emerald-400 border border-emerald-500/30 pointer-events-none backdrop-blur-xs">
            1080P HD • {playbackRate}X • 25 FPS
          </div>

          {/* Video Control Bar Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-2.5 sm:p-3 bg-gradient-to-t from-black/95 via-black/70 to-transparent flex flex-col space-y-2">
            {/* Real-time Streaming Scrubber & Buffer Bar */}
            <div className="relative w-full flex items-center">
              {/* Buffer progress bar */}
              <div
                className="absolute left-0 top-1/2 transform -translate-y-1/2 h-1 bg-slate-600 rounded-full pointer-events-none transition-all"
                style={{ width: `${bufferedPercent}%` }}
              />
              <input
                type="range"
                min={0}
                max={duration || 30}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#00d1ff] relative z-10"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <button
                  onClick={togglePlay}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
                </button>

                <button
                  onClick={toggleMute}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
                </button>

                {/* Playback speed buttons */}
                <div className="flex items-center space-x-1 bg-black/50 p-0.5 rounded border border-[#293a50]">
                  {[1, 2, 4].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => changePlaybackRate(rate)}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors cursor-pointer ${
                        playbackRate === rate
                          ? 'bg-[#00d1ff] text-black font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>

                <span className="text-[10px] font-mono text-slate-300 ml-1">
                  {formatSeconds(currentTime)} / {formatSeconds(duration)}
                </span>
              </div>

              <button
                onClick={handleFullScreen}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Pantalla Completa"
              >
                <Maximize className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer & Actions */}
        <div className="p-3.5 sm:p-4 border-t border-[#293a50] bg-[#011428] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] font-mono text-slate-400 text-center sm:text-left w-full sm:w-auto">
            {savedSuccess ? (
              <span className="text-emerald-400 flex items-center justify-center sm:justify-start space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>¡Descarga iniciada para guardarse en el teléfono móvil!</span>
              </span>
            ) : (
              <span>Grabación en buffer listo para visualización y descarga local</span>
            )}
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white font-mono text-xs cursor-pointer text-center"
            >
              Cerrar
            </button>
            <a
              href={videoSrc}
              download={`${unitNumber}_${target.id || 'video'}.mp4`}
              onClick={handleSaveToDevice}
              target="_blank"
              rel="noreferrer"
              className="flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-4 py-2 rounded-lg bg-[#00d1ff] hover:bg-[#4cd6ff] text-black font-mono font-bold text-xs transition-all shadow-[0_0_12px_rgba(0,209,255,0.4)] cursor-pointer text-center"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Guardar en Móvil</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};