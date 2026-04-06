"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { startInterview, sendInterviewMessage, endInterview, generateInterviewTTS, API_BASE } from "@/lib/api";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";
import Button from "@/components/ui/Button";
import PhaseIndicator from "@/components/interview/PhaseIndicator";
import InterviewTimer from "@/components/interview/InterviewTimer";
import RubricPanel from "@/components/interview/RubricPanel";
import Scorecard from "@/components/interview/Scorecard";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface InterviewState {
  phase: string;
  exchange_count: number;
  elapsed_minutes: number;
  total_minutes: number;
  effective_difficulty: number;
  level: string;
  concepts_covered: number;
  concepts_total: number;
  rubric_scores: Record<string, number>;
  deep_dive_target: string | null;
  contradictions_found: number;
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
  const [scorecard, setScorecard] = useState<Record<string, unknown> | null>(null);
  const [problemTitle, setProblemTitle] = useState(challengeId.replace(/-/g, " "));

  // Voice state
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { isListening, transcript, isSupported, startListening, stopListening } = useSpeechRecognition();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Sync speech recognition transcript to input
  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  // Play TTS for interviewer messages when voice is enabled
  const playInterviewerAudio = useCallback(async (text: string) => {
    if (!voiceEnabled) return;
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
  }, [voiceEnabled]);

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

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading || !sessionId) return;

    // Stop listening if active
    if (isListening) stopListening();
    // Stop any playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsSpeaking(false);
    }

    const userMessage = input.trim();
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
      stopListening();
      // Auto-send if there's content after stopping
      if (input.trim()) {
        setTimeout(() => handleSend(), 200);
      }
    } else {
      // Stop any playing audio first
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
        setIsSpeaking(false);
      }
      startListening();
    }
  };

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
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800 bg-gray-900/95 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold text-gray-200 capitalize">{problemTitle}</h1>
          <div className="w-px h-5 bg-gray-700" />
          <PhaseIndicator currentPhase={interviewState.phase} />
        </div>
        <div className="flex items-center gap-4">
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
          <div className="w-px h-5 bg-gray-700" />
          {/* Difficulty meter */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 uppercase">Diff</span>
            <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-blue-500 rounded-full"
                animate={{ width: `${(interviewState.effective_difficulty / 10) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
          <div className="w-px h-5 bg-gray-700" />
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
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat area - 60% */}
        <div className="flex-[3] flex flex-col border-r border-gray-800">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
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
            className="border-t border-gray-800 px-6 py-3 flex gap-3 items-center"
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
        </div>

        {/* State panel - 40% */}
        <div className="flex-[2] bg-gray-900/50 overflow-hidden">
          <div className="border-b border-gray-800 px-4 py-3">
            <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Live Assessment
            </h2>
          </div>
          <RubricPanel state={interviewState} />
        </div>
      </div>

      {/* Scorecard overlay */}
      {isComplete && scorecard && (
        <Scorecard
          scorecard={scorecard as never}
          onTryAgain={handleTryAgain}
        />
      )}
    </div>
  );
}
