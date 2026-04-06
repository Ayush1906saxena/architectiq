"use client";

import Button from "@/components/ui/Button";

interface SimulationControlsProps {
  isRunning: boolean;
  speed: number;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
}

export default function SimulationControls({
  isRunning,
  speed,
  onStart,
  onPause,
  onReset,
  onSpeedChange,
}: SimulationControlsProps) {
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-900 border border-gray-800 rounded-lg">
      <Button
        size="sm"
        variant={isRunning ? "secondary" : "primary"}
        onClick={isRunning ? onPause : onStart}
      >
        {isRunning ? "Pause" : "Start"}
      </Button>
      <Button size="sm" variant="ghost" onClick={onReset}>
        Reset
      </Button>

      <div className="w-px h-6 bg-gray-700 mx-1" />

      <span className="text-xs text-gray-500">Speed:</span>
      {[0.5, 1, 2, 4].map((s) => (
        <button
          key={s}
          onClick={() => onSpeedChange(s)}
          className={`px-2 py-1 text-xs rounded ${
            speed === s
              ? "bg-blue-600 text-white"
              : "text-gray-400 hover:bg-gray-800"
          }`}
        >
          {s}x
        </button>
      ))}
    </div>
  );
}
