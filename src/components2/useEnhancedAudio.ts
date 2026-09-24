import { useEffect, useRef, type RefObject } from 'react';

type AudioGraph = {
  context: AudioContext;
  source: MediaElementAudioSourceNode;
  highPass: BiquadFilterNode;
  humNotch: BiquadFilterNode;
  lowPass: BiquadFilterNode;
  compressor: DynamicsCompressorNode;
  gain: GainNode;
  analyser: AnalyserNode;
};

declare global {
  interface Window {
    __csrsAudioAnalysers?: Map<number, AnalyserNode>;
  }
}

// The MDVR audio is narrow-band 8 kHz AAC. This chain removes rumble and hiss
// without transcoding or restarting the live stream.
export function useEnhancedAudio(videoRef: RefObject<HTMLVideoElement | null>, channel: number, enabled: boolean) {
  const graphRef = useRef<AudioGraph | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !window.AudioContext) return;
    // Keep native output at zero to prevent a second unprocessed copy. The
    // muted flag is removed only from an explicit operator activation because
    // Chromium can suppress MediaElementAudioSourceNode while it is muted.
    video.volume = enabled ? 1 : 0;
    video.muted = !enabled;
    let graph = graphRef.current;
    // Do not create a MediaElementAudioSourceNode during initial muted autoplay.
    // Creating it after the operator gesture also avoids browsers that attach a
    // source before flv.js has connected the media element.
    if (!graph && !enabled) return;
    if (!graph) {
      const context = new AudioContext({ latencyHint: 'interactive' });
      const source = context.createMediaElementSource(video);
      const highPass = context.createBiquadFilter();
      highPass.type = 'highpass';
      highPass.frequency.value = 100;
      highPass.Q.value = 0.7;
      const lowPass = context.createBiquadFilter();
      lowPass.type = 'lowpass';
      lowPass.frequency.value = 3600;
      lowPass.Q.value = 0.7;
      const humNotch = context.createBiquadFilter();
      humNotch.type = 'notch';
      humNotch.frequency.value = 60;
      humNotch.Q.value = 8;
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -32;
      compressor.knee.value = 18;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.24;
      const gain = context.createGain();
      gain.gain.value = 0;
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.7;
      source.connect(highPass).connect(humNotch).connect(lowPass).connect(compressor).connect(gain).connect(analyser).connect(context.destination);
      graph = { context, source, highPass, humNotch, lowPass, compressor, gain, analyser };
      graphRef.current = graph;
      window.__csrsAudioAnalysers ||= new Map();
      window.__csrsAudioAnalysers.set(channel, analyser);
    }
    graph.gain.gain.cancelScheduledValues(graph.context.currentTime);
    graph.gain.gain.setTargetAtTime(enabled ? 0.82 : 0, graph.context.currentTime, enabled ? 0.025 : 0.04);
    if (enabled) {
      video.muted = false;
      void graph.context.resume();
      void video.play().catch(() => {});
    }
    return () => {
      // Keep the graph alive while the camera component exists. Disabling audio
      // must not tear down MediaSource or cause a new CMS live session.
    };
  }, [videoRef, channel, enabled]);

  useEffect(() => () => {
    const graph = graphRef.current;
    if (window.__csrsAudioAnalysers) window.__csrsAudioAnalysers.delete(channel);
    graphRef.current = null;
    try { void graph?.context.close(); } catch { /* Camera is already unmounted. */ }
  }, [channel]);
}
