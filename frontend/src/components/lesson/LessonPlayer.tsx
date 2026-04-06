"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/store/useAppStore";
import { useAudioAnalyzer } from "@/hooks/useAudioAnalyzer";
import { useTTS } from "@/hooks/useTTS";
import { fetchLesson, fetchModuleLessons, getAudioUrl } from "@/lib/api";
import AvatarCanvas from "@/components/avatar/AvatarCanvas";
import DiagramForTopic from "@/components/diagrams/DiagramRegistry";
import LessonControls from "./LessonControls";
import SegmentTimeline from "./SegmentTimeline";
import ThoughtPrompt from "./ThoughtPrompt";
import Button from "@/components/ui/Button";
import { PlaybackSpeed } from "@/types/lesson";

interface LessonPlayerProps {
  topicId: string;
  lessonId: string;
}

interface ModuleLesson {
  id: string;
  title: string;
  path: string;
}

export default function LessonPlayer({ topicId, lessonId }: LessonPlayerProps) {
  const router = useRouter();
  const store = useAppStore();
  const { amplitudeRef, playAudio, stopAudio, pauseAudio, resumeAudio, cleanup } =
    useAudioAnalyzer();
  const { getTTSForSegment, preloadSegment } = useTTS(topicId, lessonId);
  const isTransitioningRef = useRef(false);

  // Module navigation state
  const [moduleLessons, setModuleLessons] = useState<ModuleLesson[]>([]);
  const [isLessonComplete, setIsLessonComplete] = useState(false);
  const [highestSegmentReached, setHighestSegmentReached] = useState(0);

  // Load lesson + module lessons on mount
  useEffect(() => {
    async function load() {
      store.setLoading(true);
      try {
        const [lesson, moduleData] = await Promise.all([
          fetchLesson(topicId, lessonId),
          fetchModuleLessons(topicId).catch(() => ({ lessons: [] })),
        ]);
        store.setLesson(lesson);
        setModuleLessons(moduleData.lessons || []);
      } catch (err) {
        console.error("Failed to load lesson:", err);
      } finally {
        store.setLoading(false);
      }
    }
    load();
    setIsLessonComplete(false);
    setHighestSegmentReached(0);
    return () => {
      cleanup();
      store.reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId, lessonId]);

  // Track progress
  const updateProgress = useCallback((segmentIndex: number) => {
    setHighestSegmentReached((prev) => Math.max(prev, segmentIndex));
  }, []);

  const playSegment = useCallback(
    async (index: number) => {
      const lesson = useAppStore.getState().currentLesson;
      if (!lesson || index >= lesson.segments.length || isTransitioningRef.current) return;

      isTransitioningRef.current = true;
      const segment = lesson.segments[index];

      store.setSegmentIndex(index);
      store.setLoading(true);
      updateProgress(index);

      store.setAvatarState(segment.avatar_emotion);
      store.setDiagramState(segment.diagram_state);

      try {
        const ttsResponse = await getTTSForSegment(segment.id, segment.text);
        const audioUrl = getAudioUrl(ttsResponse.audio_url);

        store.setLoading(false);
        store.setPlaying(true);

        if (index + 1 < lesson.segments.length) {
          const next = lesson.segments[index + 1];
          preloadSegment(next.id, next.text);
        }

        const speed = useAppStore.getState().playbackSpeed;

        await playAudio(audioUrl, speed, () => {
          isTransitioningRef.current = false;

          if (segment.pause_for_thought && segment.thought_prompt) {
            store.showThought(segment.thought_prompt);
          } else {
            const nextIndex = index + 1;
            if (nextIndex < lesson.segments.length) {
              playSegment(nextIndex);
            } else {
              // Lesson complete!
              store.setPlaying(false);
              setIsLessonComplete(true);
            }
          }
        });
      } catch (err) {
        console.error("Failed to play segment:", err);
        store.setLoading(false);
        isTransitioningRef.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getTTSForSegment, playAudio, preloadSegment, updateProgress]
  );

  const handlePlay = useCallback(() => {
    const state = useAppStore.getState();
    if (state.isPlaying) return;
    if (!isTransitioningRef.current) {
      playSegment(state.currentSegmentIndex);
    } else {
      resumeAudio();
      store.setPlaying(true);
    }
  }, [playSegment, resumeAudio, store]);

  const handlePause = useCallback(() => {
    pauseAudio();
    store.setPlaying(false);
  }, [pauseAudio, store]);

  const handlePrevious = useCallback(() => {
    const state = useAppStore.getState();
    if (state.currentSegmentIndex > 0) {
      stopAudio();
      isTransitioningRef.current = false;
      setIsLessonComplete(false);
      playSegment(state.currentSegmentIndex - 1);
    }
  }, [playSegment, stopAudio]);

  const handleNext = useCallback(() => {
    const state = useAppStore.getState();
    const lesson = state.currentLesson;
    if (lesson && state.currentSegmentIndex < lesson.segments.length - 1) {
      stopAudio();
      isTransitioningRef.current = false;
      playSegment(state.currentSegmentIndex + 1);
    }
  }, [playSegment, stopAudio]);

  const handleSegmentClick = useCallback(
    (index: number) => {
      stopAudio();
      isTransitioningRef.current = false;
      setIsLessonComplete(false);
      playSegment(index);
    },
    [playSegment, stopAudio]
  );

  const handleSpeedChange = useCallback(
    (speed: PlaybackSpeed) => {
      store.setPlaybackSpeed(speed);
    },
    [store]
  );

  const handleDismissThought = useCallback(() => {
    store.dismissThought();
    const state = useAppStore.getState();
    const lesson = state.currentLesson;
    if (lesson) {
      const nextIndex = state.currentSegmentIndex + 1;
      if (nextIndex < lesson.segments.length) {
        playSegment(nextIndex);
      } else {
        setIsLessonComplete(true);
      }
    }
  }, [store, playSegment]);

  // Navigation helpers
  const currentLessonIndex = moduleLessons.findIndex((l) => l.id === lessonId);
  const nextLesson = currentLessonIndex >= 0 && currentLessonIndex < moduleLessons.length - 1
    ? moduleLessons[currentLessonIndex + 1]
    : null;
  const prevLesson = currentLessonIndex > 0
    ? moduleLessons[currentLessonIndex - 1]
    : null;

  const lesson = store.currentLesson;
  const totalSegments = lesson?.segments.length || 1;
  const progressPercent = Math.round(((highestSegmentReached + 1) / totalSegments) * 100);

  if (!lesson) {
    return (
      <div className="lesson-fullscreen flex items-center justify-center h-screen bg-gray-950 text-gray-400">
        <div className="flex items-center gap-3">
          <motion.div
            className="w-5 h-5 border-2 border-gray-600 border-t-blue-500 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
          />
          Loading lesson...
        </div>
      </div>
    );
  }

  const currentSegment = lesson.segments[store.currentSegmentIndex];

  return (
    <div className="lesson-fullscreen flex flex-col h-screen bg-gray-950 text-gray-200">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-800">
        <a
          href={`/curriculum`}
          className="text-gray-400 hover:text-gray-200 text-sm transition-colors"
        >
          &larr; Back
        </a>
        <div className="flex flex-col items-center">
          <h1 className="text-sm font-medium text-gray-300 font-mono">
            {lesson.title}
          </h1>
          {moduleLessons.length > 1 && (
            <span className="text-[10px] text-gray-500 font-mono">
              Lesson {currentLessonIndex + 1} of {moduleLessons.length}
            </span>
          )}
        </div>
        {/* Module lesson switcher */}
        <div className="flex items-center gap-2">
          {prevLesson && (
            <button
              onClick={() => router.push(`/lesson/${topicId}/${prevLesson.id}`)}
              className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
              title={prevLesson.title}
            >
              &larr; Prev
            </button>
          )}
          {nextLesson && (
            <button
              onClick={() => router.push(`/lesson/${topicId}/${nextLesson.id}`)}
              className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
              title={nextLesson.title}
            >
              Next &rarr;
            </button>
          )}
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-gray-800">
        <motion.div
          className="h-full bg-blue-500"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Main content area */}
      <div className="flex-1 grid grid-cols-[35%_65%] min-h-0 relative">
        {/* Avatar */}
        <div className="border-r border-gray-800 bg-gray-900/50 flex items-center justify-center p-4">
          <AvatarCanvas
            avatarState={store.avatarState}
            amplitudeRef={amplitudeRef}
          />
        </div>

        {/* Diagram */}
        <div className="flex items-center justify-center p-4">
          <DiagramForTopic topicId={topicId} state={store.diagramState} />
        </div>

        {/* Thought prompt overlay */}
        <ThoughtPrompt
          show={store.showThoughtPrompt}
          prompt={store.thoughtPromptText}
          onContinue={handleDismissThought}
        />

        {/* Lesson Complete overlay */}
        <AnimatePresence>
          {isLessonComplete && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-10"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="bg-gray-900 border border-gray-700 rounded-2xl p-8 max-w-md mx-4 text-center shadow-2xl"
              >
                <div className="text-4xl mb-3">&#10003;</div>
                <h2 className="text-xl font-bold text-white mb-2">Lesson Complete!</h2>
                <p className="text-gray-400 text-sm mb-6">
                  {lesson.title}
                </p>

                {/* Module progress */}
                {moduleLessons.length > 1 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-1 justify-center mb-2">
                      {moduleLessons.map((ml, i) => (
                        <div
                          key={ml.id}
                          className={`h-2 flex-1 max-w-[40px] rounded-full ${
                            i <= currentLessonIndex ? "bg-blue-500" : "bg-gray-700"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-500 font-mono">
                      {currentLessonIndex + 1}/{moduleLessons.length} lessons in module
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  {nextLesson ? (
                    <Button
                      size="lg"
                      onClick={() => router.push(`/lesson/${topicId}/${nextLesson.id}`)}
                      className="w-full"
                    >
                      Next: {nextLesson.title} &rarr;
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      onClick={() => router.push(`/quiz/${topicId}`)}
                      className="w-full"
                    >
                      Take the Quiz &rarr;
                    </Button>
                  )}

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setIsLessonComplete(false);
                      stopAudio();
                      isTransitioningRef.current = false;
                      playSegment(0);
                    }}
                  >
                    Replay Lesson
                  </Button>

                  <button
                    onClick={() => router.push("/curriculum")}
                    className="text-xs text-gray-500 hover:text-gray-300 mt-1 transition-colors"
                  >
                    Back to Curriculum
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Subtitle / current text */}
      <div className="px-8 py-4 border-t border-gray-800 bg-gray-900/30">
        <p className="text-center text-base leading-relaxed text-gray-300 max-w-3xl mx-auto min-h-[3rem]">
          {currentSegment?.text}
        </p>
      </div>

      {/* Timeline */}
      <SegmentTimeline
        segments={lesson.segments}
        currentIndex={store.currentSegmentIndex}
        onSegmentClick={handleSegmentClick}
      />

      {/* Controls */}
      <div className="border-t border-gray-800 bg-gray-900/50">
        <LessonControls
          isPlaying={store.isPlaying}
          isLoading={store.isLoading}
          currentIndex={store.currentSegmentIndex}
          totalSegments={lesson.segments.length}
          playbackSpeed={store.playbackSpeed}
          onPlay={handlePlay}
          onPause={handlePause}
          onPrevious={handlePrevious}
          onNext={handleNext}
          onSpeedChange={handleSpeedChange}
        />
      </div>
    </div>
  );
}
