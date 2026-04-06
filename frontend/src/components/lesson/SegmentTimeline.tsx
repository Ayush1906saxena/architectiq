"use client";

import { LessonSegment } from "@/types/lesson";

interface SegmentTimelineProps {
  segments: LessonSegment[];
  currentIndex: number;
  onSegmentClick: (index: number) => void;
}

export default function SegmentTimeline({
  segments,
  currentIndex,
  onSegmentClick,
}: SegmentTimelineProps) {
  return (
    <div className="flex items-center gap-1.5 px-4 py-2">
      {segments.map((segment, i) => {
        const isActive = i === currentIndex;
        const isPast = i < currentIndex;

        return (
          <button
            key={segment.id}
            onClick={() => onSegmentClick(i)}
            className="group relative flex-1 h-2 min-w-[8px]"
            aria-label={`Segment ${i + 1}: ${segment.id}`}
          >
            <div
              className={`h-full rounded-full transition-all ${
                isActive
                  ? "bg-blue-500 scale-y-150"
                  : isPast
                    ? "bg-blue-800"
                    : "bg-gray-700 group-hover:bg-gray-600"
              }`}
            />

            {/* Thought prompt indicator */}
            {segment.pause_for_thought && (
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-400" />
            )}

            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 rounded text-[10px] text-gray-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none font-mono">
              {segment.id.replace("seg_", "").replace(/_/g, " ")}
            </div>
          </button>
        );
      })}
    </div>
  );
}
