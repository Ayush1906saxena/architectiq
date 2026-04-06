"use client";

import { useRef, useCallback } from "react";
import { generateTTS, getAudioUrl } from "@/lib/api";
import { TTSResponse } from "@/types/lesson";

interface TTSCache {
  [segmentId: string]: TTSResponse;
}

export function useTTS(topicId: string, lessonId: string) {
  const cacheRef = useRef<TTSCache>({});

  const getTTSForSegment = useCallback(
    async (segmentId: string, text: string): Promise<TTSResponse> => {
      // Check cache
      if (cacheRef.current[segmentId]) {
        return cacheRef.current[segmentId];
      }

      // Generate TTS
      const response = await generateTTS(text, segmentId, topicId, lessonId);
      cacheRef.current[segmentId] = response;
      return response;
    },
    [topicId, lessonId]
  );

  const getFullAudioUrl = useCallback(
    (ttsResponse: TTSResponse): string => {
      return getAudioUrl(ttsResponse.audio_url);
    },
    []
  );

  const preloadSegment = useCallback(
    async (segmentId: string, text: string) => {
      // Fire and forget — preload into cache
      try {
        await getTTSForSegment(segmentId, text);
      } catch {
        // Preload failure is non-critical
      }
    },
    [getTTSForSegment]
  );

  return {
    getTTSForSegment,
    getFullAudioUrl,
    preloadSegment,
  };
}
