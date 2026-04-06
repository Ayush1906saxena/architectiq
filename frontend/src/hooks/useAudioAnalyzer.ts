"use client";

import { useRef, useCallback } from "react";

export function useAudioAnalyzer() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const amplitudeRef = useRef<number>(0);
  const animFrameRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const onEndedCallbackRef = useRef<(() => void) | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.connect(audioContextRef.current.destination);
    }
    return {
      context: audioContextRef.current,
      analyser: analyserRef.current!,
    };
  }, []);

  const startAmplitudeLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let smoothed = 0;
    const smoothingFactor = 0.3;

    const loop = () => {
      if (!isPlayingRef.current) return;

      analyser.getByteFrequencyData(dataArray);
      const raw =
        dataArray.reduce((sum, val) => sum + val, 0) /
        (dataArray.length * 255);
      smoothed = smoothed * (1 - smoothingFactor) + raw * smoothingFactor;
      amplitudeRef.current = smoothed;

      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
  }, []);

  const playAudio = useCallback(
    async (
      audioUrl: string,
      playbackRate: number = 1,
      onEnded?: () => void
    ) => {
      const { context, analyser } = getAudioContext();

      // Resume if suspended (browser autoplay policy)
      if (context.state === "suspended") {
        await context.resume();
      }

      // Stop any currently playing source
      if (sourceRef.current) {
        try {
          sourceRef.current.stop();
        } catch {
          // Already stopped
        }
      }

      // Fetch and decode audio
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await context.decodeAudioData(arrayBuffer);

      // Create new source
      const source = context.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = playbackRate;
      source.connect(analyser);

      sourceRef.current = source;
      onEndedCallbackRef.current = onEnded || null;
      isPlayingRef.current = true;

      source.onended = () => {
        isPlayingRef.current = false;
        amplitudeRef.current = 0;
        cancelAnimationFrame(animFrameRef.current);
        onEndedCallbackRef.current?.();
      };

      source.start();
      startAmplitudeLoop();
    },
    [getAudioContext, startAmplitudeLoop]
  );

  const stopAudio = useCallback(() => {
    isPlayingRef.current = false;
    amplitudeRef.current = 0;
    cancelAnimationFrame(animFrameRef.current);

    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch {
        // Already stopped
      }
      sourceRef.current = null;
    }
  }, []);

  const pauseAudio = useCallback(() => {
    const ctx = audioContextRef.current;
    if (ctx && ctx.state === "running") {
      ctx.suspend();
      isPlayingRef.current = false;
      cancelAnimationFrame(animFrameRef.current);
    }
  }, []);

  const resumeAudio = useCallback(() => {
    const ctx = audioContextRef.current;
    if (ctx && ctx.state === "suspended") {
      ctx.resume();
      isPlayingRef.current = true;
      startAmplitudeLoop();
    }
  }, [startAmplitudeLoop]);

  const cleanup = useCallback(() => {
    stopAudio();
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
      analyserRef.current = null;
    }
  }, [stopAudio]);

  return {
    amplitudeRef,
    playAudio,
    stopAudio,
    pauseAudio,
    resumeAudio,
    cleanup,
  };
}
