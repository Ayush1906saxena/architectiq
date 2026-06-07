"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { startInterview, sendInterviewMessage, endInterview, generateInterviewTTS, API_BASE } from "@/lib/api";
import { InterviewState, Scorecard as ScorecardData } from "@/types/interview";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";
import Button from "@/components/ui/Button";
import PhaseIndicator from "@/components/interview/PhaseIndicator";
import InterviewTimer from "@/components/interview/InterviewTimer";
import RubricPanel from "@/components/interview/RubricPanel";
import DiagramCanvas from "@/components/interview/DiagramCanvas";
import Scorecard from "@/components/interview/Scorecard";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function LiveInterviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const challengeId = params.challengeId as string;
  const careerLevel = searchParams.get("level") || "senior";

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(true);
  const [interviewState, setInterviewState] = useState<InterviewState>({
    phase: "requirements",
    exchange_count: 0,
    phase_exchanges: 0,
    elapsed_minutes: 0,
    total_minutes: 45,
    effective_difficulty: 5,
    level: careerLevel,
    concepts_covered: 0,
    concepts_total: 0,
    rubric_scores: {},
    deep_dive_target: null,
    contradictions_found: 0,
  });
  const [isComplete, setIsComplete] = useState(false);
  const [rightTab, setRightTab] = useState<"assessment" | "whiteboard">("assessment");
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [scorecard, setScorecard] = useState<ScorecardData | null>(null);
  const [problemTitle, setProblemTitle] = useState(challengeId.replace(/-/g, " "));

  // Voice state
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // voiceEnabled in a ref so playInterviewerAudio can read the latest value without
  // depending on it — otherwise toggling voice changes initInterview's identity and
  // re-runs the start effect, restarting the whole interview.
  const voiceEnabledRef = useRef(voiceEnabled);
  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);
  const { isListening, transcript, isSupported, startListening, stopListening } = useSpeechRecognition();
  // Latest transcript + a flag set when the user taps "stop" to auto-send.
  const transcriptRef = useRef("");
  const autoSendRef = useRef(false);
  const wasListeningRef = useRef(false);

  // Score change toasts
  const prevRubricRef = useRef<Record<string, number>>({});
  const [scoreToasts, setScoreToasts] = useState<
    { id: string; dimension: string; from: number; to: number }[]
  >([]);

  useEffect(() => {
    const prev = prevRubricRef.current;
    const current = interviewState.rubric_scores || {};
    const newToasts: { id: string; dimension: string; from: number; to: number }[] = [];

    for (const [key, value] of Object.entries(current)) {
      const prevVal = prev[key] ?? 0;
      if (prevVal !== 0 && value !== prevVal) {
        const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        newToasts.push({
          id: `${key}-${Date.now()}`,
          dimension: label,
          from: prevVal,
          to: value,
        });
      }
    }

    prevRubricRef.current = { ...current };

    if (newToasts.length > 0) {
      setScoreToasts((prev) => [...prev, ...newToasts]);
      // Auto-remove after 3 seconds
      const ids = newToasts.map((t) => t.id);
      setTimeout(() => {
        setScoreToasts((prev) => prev.filter((t) => !ids.includes(t.id)));
      }, 3000);
    }
  }, [interviewState.rubric_scores]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Sync speech recognition transcript to the input — only while actively
  // listening, so it never clobbers text the user typed by hand.
  useEffect(() => {
    transcriptRef.current = transcript;
    if (isListening && transcript) {
      setInput(transcript);
    }
  }, [transcript, isListening]);

  // Play TTS for interviewer messages when voice is enabled. Reads voiceEnabled
  // from a ref so this callback stays stable (see voiceEnabledRef above).
  const playInterviewerAudio = useCallback(async (text: string) => {
    if (!voiceEnabledRef.current) return;
    try {
      setIsSpeaking(true);
      const { audio_url } = await generateInterviewTTS(text);
      const audio = new Audio(`${API_BASE}${audio_url}`);
      audioRef.current = audio;
      audio.onended = () => setIsSpeaking(false);
      audio.onerror = () => setIsSpeaking(false);
      await audio.play();
    } catch {
      setIsSpeaking(false);
    }
  }, []);

  // Stop any audio when leaving the page.
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const initInterview = useCallback(async () => {
    try {
      setIsStarting(true);
      const res = await startInterview(challengeId, careerLevel);
      setSessionId(res.session_id);
      if (res.state) setInterviewState(res.state);
      if (res.opening_message) {
        setMessages([{ role: "assistant", content: res.opening_message }]);
        playInterviewerAudio(res.opening_message);
      }
      if (res.problem_title) setProblemTitle(res.problem_title);
    } catch {
      setMessages([
        {
          role: "assistant",
          content: "Failed to start the interview. Please check the backend is running and try again.",
        },
      ]);
    } finally {
      setIsStarting(false);
      inputRef.current?.focus();
    }
  }, [challengeId, careerLevel, playInterviewerAudio]);

  useEffect(() => {
    initInterview();
  }, [initInterview]);

  const handleSend = async (e?: React.FormEvent, overrideText?: string) => {
    if (e) e.preventDefault();
    const userMessage = (overrideText ?? input).trim();
    if (!userMessage || isLoading || !sessionId) return;

    // Stop listening if active
    if (isListening) stopListening();
    // Stop any playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsSpeaking(false);
    }

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const res = await sendInterviewMessage(sessionId, userMessage);
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
      if (res.state) setInterviewState(res.state);
      if (res.is_complete) {
        setIsComplete(true);
        setScorecard(res.scorecard || null);
      } else {
        playInterviewerAudio(res.reply);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error communicating with the interviewer. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleMicToggle = () => {
    if (isListening) {
      // Request auto-send; the actual send happens once listening fully stops and
      // the final transcript has landed (see the effect below) — not on a timer.
      autoSendRef.current = true;
      stopListening();
    } else {
      // Stop any playing audio first
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
        setIsSpeaking(false);
      }
      autoSendRef.current = false;
      startListening();
    }
  };

  // When listening stops after a user-initiated stop, send the final transcript.
  useEffect(() => {
    if (wasListeningRef.current && !isListening && autoSendRef.current) {
      autoSendRef.current = false;
      const text = transcriptRef.current.trim();
      if (text) handleSend(undefined, text);
    }
    wasListeningRef.current = isListening;
    // handleSend intentionally omitted — captured fresh on each isListening change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening]);

  const handleTryAgain = () => {
    setMessages([]);
    setIsComplete(false);
    setScorecard(null);
    setSessionId(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    initInterview();
  };

  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between px-3 md:px-6 py-2 md:py-3 gap-2 border-b border-gray-800 bg-gray-900/95 backdrop-blur-sm">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <h1 className="text-xs md:text-sm font-semibold text-gray-200 capitalize truncate">{problemTitle}</h1>
          <div className="w-px h-5 bg-gray-700 hidden md:block" />
          <div className="hidden md:block">
            <PhaseIndicator currentPhase={interviewState.phase} />
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          {/* Voice toggle */}
          <button
            onClick={() => {
              setVoiceEnabled(!voiceEnabled);
              if (voiceEnabled && audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
                setIsSpeaking(false);
              }
            }}
            className={`flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded transition-colors ${
              voiceEnabled
                ? "text-green-400 bg-green-500/10 hover:bg-green-500/20"
                : "text-gray-500 hover:text-gray-400 hover:bg-gray-800"
            }`}
            title={voiceEnabled ? "Disable voice" : "Enable voice"}
            aria-label={voiceEnabled ? "Disable interviewer voice" : "Enable interviewer voice"}
            aria-pressed={voiceEnabled}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {voiceEnabled ? (
                <>
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </>
              ) : (
                <>
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </>
              )}
            </svg>
            Voice {voiceEnabled ? "On" : "Off"}
          </button>
          <div className="w-px h-5 bg-gray-700 hidden md:block" />
          {/* Difficulty meter — hidden on mobile */}
          <div className="hidden md:flex items-center gap-2">
            <span className="text-[10px] text-gray-500 uppercase">Diff</span>
            <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-blue-500 rounded-full"
                animate={{ width: `${(interviewState.effective_difficulty / 10) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
          <div className="w-px h-5 bg-gray-700 hidden md:block" />
          <InterviewTimer
            totalMinutes={interviewState.total_minutes}
            elapsedMinutes={interviewState.elapsed_minutes}
          />
          <div className="w-px h-5 bg-gray-700" />
          <button
            onClick={async () => {
              if (!sessionId) return;
              try {
                const res = await endInterview(sessionId);
                if (res.scorecard) {
                  setIsComplete(true);
                  setScorecard(res.scorecard);
                }
              } catch {}
            }}
            disabled={isComplete || !sessionId}
            className="text-[10px] text-red-400 hover:text-red-300 font-medium px-2 py-1 rounded hover:bg-red-500/10 transition-colors disabled:opacity-30"
          >
            End Interview
          </button>
          {/* Mobile panel toggle */}
          <button
            onClick={() => setMobilePanelOpen(!mobilePanelOpen)}
            className={`md:hidden text-[10px] font-medium px-2 py-1 rounded transition-colors ${
              mobilePanelOpen
                ? "text-blue-400 bg-blue-500/10"
                : "text-gray-500 hover:text-gray-400 hover:bg-gray-800"
            }`}
          >
            {mobilePanelOpen ? "Chat" : "Panel"}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Chat area - 60% on desktop, full on mobile (hidden when panel open) */}
        <div className={`flex-[3] flex flex-col border-r border-gray-800 relative ${mobilePanelOpen ? "hidden md:flex" : "flex"}`}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 md:px-6 py-4 space-y-4" aria-live="polite">
            {isStarting && (
              <div className="flex justify-center py-12">
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <motion.div
                    className="w-4 h-4 border-2 border-gray-600 border-t-blue-500 rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                  Starting interview...
                </div>
              </div>
            )}

            <AnimatePresence>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-800 text-gray-200"
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <span className="text-[10px] text-blue-400 font-mono block mb-1">
                        Interviewer
                        {isSpeaking && i === messages.length - 1 && (
                          <span className="ml-2 text-green-400 animate-pulse">Speaking...</span>
                        )}
                      </span>
                    )}
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-800 rounded-xl px-4 py-3 text-sm text-gray-400">
                  <span className="animate-pulse">Thinking...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSend}
            className="border-t border-gray-800 px-3 md:px-6 py-3 flex gap-2 md:gap-3 items-center"
          >
            {/* Mic button */}
            {isSupported && (
              <button
                type="button"
                onClick={handleMicToggle}
                disabled={isLoading || isComplete || !sessionId}
                className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  isListening
                    ? "bg-red-500 text-white animate-pulse"
                    : "bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700"
                } disabled:opacity-30 disabled:cursor-not-allowed`}
                title={isListening ? "Stop recording (sends message)" : "Start voice input"}
                aria-label={isListening ? "Stop recording and send" : "Start voice input"}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </button>
            )}
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                isComplete
                  ? "Interview complete"
                  : isListening
                  ? "Listening... tap mic to send"
                  : "Type your response..."
              }
              disabled={isLoading || isComplete || !sessionId}
              className={`flex-1 bg-gray-800 border rounded-lg px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-50 ${
                isListening ? "border-red-500/50" : "border-gray-700"
              }`}
            />
            <Button type="submit" disabled={isLoading || !input.trim() || isComplete || !sessionId}>
              Send
            </Button>
          </form>

          {/* Score change toasts */}
          <div className="absolute bottom-16 right-6 flex flex-col gap-2 z-20 pointer-events-none">
            <AnimatePresence>
              {scoreToasts.map((toast) => {
                const isUp = toast.to > toast.from;
                return (
                  <motion.div
                    key={toast.id}
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 shadow-lg"
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-400">{toast.dimension}</span>
                      <span className="font-mono text-gray-500">{toast.from.toFixed(1)}</span>
                      <span className="text-gray-600">&rarr;</span>
                      <span
                        className={`font-mono font-semibold ${
                          isUp ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {toast.to.toFixed(1)}
                      </span>
                      {isUp && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-green-400">
                          <polyline points="18 15 12 9 6 15" />
                        </svg>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* State panel - 40% on desktop, full on mobile (hidden by default) */}
        <div className={`flex-[2] bg-gray-900/50 overflow-hidden flex-col ${mobilePanelOpen ? "flex" : "hidden md:flex"}`}>
          <div className="border-b border-gray-800 px-4 py-0 flex gap-0">
            {(["assessment", "whiteboard"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setRightTab(tab)}
                className={`relative px-3 py-3 text-[11px] font-medium uppercase tracking-wider transition-colors ${
                  rightTab === tab
                    ? "text-blue-400"
                    : "text-gray-500 hover:text-gray-400"
                }`}
              >
                {tab === "assessment" ? "Assessment" : "Whiteboard"}
                {rightTab === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-500 rounded-full" />
                )}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-hidden">
            {rightTab === "assessment" ? (
              <RubricPanel state={interviewState} />
            ) : (
              <DiagramCanvas />
            )}
          </div>
        </div>
      </div>

      {/* Scorecard overlay */}
      {isComplete && scorecard && (
        <Scorecard
          scorecard={scorecard}
          onTryAgain={handleTryAgain}
        />
      )}
    </div>
  );
}
