"use client";

import Button from "@/components/ui/Button";
import { PlaybackSpeed } from "@/types/lesson";

interface LessonControlsProps {
  isPlaying: boolean;
  isLoading: boolean;
  currentIndex: number;
  totalSegments: number;
  playbackSpeed: PlaybackSpeed;
  onPlay: () => void;
  onPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSpeedChange: (speed: PlaybackSpeed) => void;
}

const SPEEDS: PlaybackSpeed[] = [0.75, 1, 1.25, 1.5];

export default function LessonControls({
  isPlaying,
  isLoading,
  currentIndex,
  totalSegments,
  playbackSpeed,
  onPlay,
  onPause,
  onPrevious,
  onNext,
  onSpeedChange,
}: LessonControlsProps) {
  return (
    <div className="flex items-center justify-center gap-3 py-3">
      {/* Previous */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onPrevious}
        disabled={currentIndex === 0 || isLoading}
        aria-label="Previous segment"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M3 2h2v12H3V2zm3.5 6l7.5 6V2L6.5 8z" />
        </svg>
      </Button>

      {/* Play/Pause */}
      <Button
        variant="primary"
        size="md"
        onClick={isPlaying ? onPause : onPlay}
        disabled={isLoading}
        className="w-12 h-12 rounded-full"
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isLoading ? (
          <svg
            className="animate-spin"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" opacity="0.3" />
            <path d="M12 2a10 10 0 0 1 10 10" />
          </svg>
        ) : isPlaying ? (
          <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 2h3v12H4V2zm5 0h3v12H9V2z" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 2l10 6-10 6V2z" />
          </svg>
        )}
      </Button>

      {/* Next */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onNext}
        disabled={currentIndex >= totalSegments - 1 || isLoading}
        aria-label="Next segment"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M11 2h2v12h-2V2zM2 2l7.5 6L2 14V2z" />
        </svg>
      </Button>

      {/* Divider */}
      <div className="w-px h-6 bg-gray-700 mx-2" />

      {/* Speed selector */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 mr-1">Speed:</span>
        {SPEEDS.map((speed) => (
          <button
            key={speed}
            onClick={() => onSpeedChange(speed)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              playbackSpeed === speed
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
            }`}
          >
            {speed}x
          </button>
        ))}
      </div>

      {/* Segment counter */}
      <div className="w-px h-6 bg-gray-700 mx-2" />
      <span className="text-xs text-gray-500 font-mono">
        {currentIndex + 1} / {totalSegments}
      </span>
    </div>
  );
}
