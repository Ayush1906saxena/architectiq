"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DiagramContainer from "@/components/diagrams/core/DiagramContainer";
import SimulationControls from "./SimulationControls";

interface EventLog {
  time: string;
  message: string;
  type: "success" | "error" | "warning" | "info";
}

export default function NetworkPartitionSim() {
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [partitioned, setPartitioned] = useState(false);
  const [mode, setMode] = useState<"cp" | "ap">("cp");
  const [events, setEvents] = useState<EventLog[]>([]);
  const [writeCount, setWriteCount] = useState(0);
  const tickRef = useRef<NodeJS.Timeout | null>(null);

  const addEvent = useCallback(
    (message: string, type: EventLog["type"]) => {
      const time = new Date().toLocaleTimeString();
      setEvents((prev) => [...prev.slice(-20), { time, message, type }]);
    },
    []
  );

  const sendWrite = useCallback(() => {
    setWriteCount((c) => c + 1);
    if (!partitioned) {
      addEvent("Write to Leader: SUCCESS. Replicated to Follower.", "success");
    } else if (mode === "cp") {
      addEvent("Write to Leader: REJECTED (partition detected, consistency preserved)", "error");
    } else {
      addEvent("Write to Leader: ACCEPTED (available, but Follower diverges!)", "warning");
    }
  }, [partitioned, mode, addEvent]);

  const sendRead = useCallback(() => {
    if (!partitioned) {
      addEvent("Read from Follower: Fresh data (in sync with Leader)", "success");
    } else if (mode === "cp") {
      addEvent("Read from Follower: UNAVAILABLE (partition, reads blocked)", "error");
    } else {
      addEvent("Read from Follower: STALE DATA (partition, serving old data)", "warning");
    }
  }, [partitioned, mode, addEvent]);

  useEffect(() => {
    if (isRunning) {
      tickRef.current = setInterval(() => {
        if (Math.random() > 0.5) sendWrite();
        else sendRead();
      }, 2000 / speed);
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [isRunning, speed, sendWrite, sendRead]);

  const handleReset = () => {
    setIsRunning(false);
    setPartitioned(false);
    setEvents([]);
    setWriteCount(0);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_300px] gap-4">
        {/* Diagram */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <DiagramContainer>
            {/* Leader */}
            <motion.g>
              <rect x={80} y={150} width={120} height={70} rx={8} fill="#1e293b" stroke="#22c55e" strokeWidth={2} />
              <text x={140} y={175} textAnchor="middle" fill="#86efac" fontSize={11} fontFamily="monospace">Leader</text>
              <text x={140} y={195} textAnchor="middle" fill="#4ade80" fontSize={10} fontFamily="monospace">Writes: {writeCount}</text>
              <circle cx={185} cy={162} r={4} fill="#22c55e" />
            </motion.g>

            {/* Follower */}
            <motion.g>
              <rect x={560} y={150} width={120} height={70} rx={8} fill="#1e293b" stroke="#06b6d4" strokeWidth={2} />
              <text x={620} y={175} textAnchor="middle" fill="#67e8f9" fontSize={11} fontFamily="monospace">Follower</text>
              <text x={620} y={195} textAnchor="middle" fill="#22d3ee" fontSize={10} fontFamily="monospace">{partitioned ? (mode === "cp" ? "BLOCKED" : "STALE") : "In Sync"}</text>
              <circle cx={665} cy={162} r={4} fill={partitioned ? "#ef4444" : "#22c55e"} />
            </motion.g>

            {/* Replication arrow */}
            <line x1={200} y1={185} x2={560} y2={185} stroke={partitioned ? "#ef4444" : "#3b82f6"} strokeWidth={2} strokeDasharray={partitioned ? "6 4" : "none"} markerEnd="url(#arrowhead)" />
            <text x={380} y={175} textAnchor="middle" fill={partitioned ? "#ef4444" : "#94a3b8"} fontSize={10} fontFamily="monospace">
              {partitioned ? "PARTITIONED" : "replication"}
            </text>

            {/* Partition line */}
            <AnimatePresence>
              {partitioned && (
                <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <line x1={380} y1={100} x2={380} y2={280} stroke="#ef4444" strokeWidth={3} strokeDasharray="8 4" />
                  <text x={380} y={95} textAnchor="middle" fill="#ef4444" fontSize={12} fontFamily="monospace" fontWeight="bold">PARTITION</text>
                </motion.g>
              )}
            </AnimatePresence>

            {/* Clients */}
            <rect x={100} y={300} width={80} height={40} rx={6} fill="#1e293b" stroke="#8b5cf6" strokeWidth={1.5} />
            <text x={140} y={325} textAnchor="middle" fill="#a78bfa" fontSize={10} fontFamily="monospace">Client A</text>
            <line x1={140} y1={300} x2={140} y2={220} stroke="#8b5cf6" strokeWidth={1} strokeDasharray="4 3" />

            <rect x={580} y={300} width={80} height={40} rx={6} fill="#1e293b" stroke="#8b5cf6" strokeWidth={1.5} />
            <text x={620} y={325} textAnchor="middle" fill="#a78bfa" fontSize={10} fontFamily="monospace">Client B</text>
            <line x1={620} y1={300} x2={620} y2={220} stroke="#8b5cf6" strokeWidth={1} strokeDasharray="4 3" />

            {/* Mode label */}
            <text x={380} y={40} textAnchor="middle" fill="#94a3b8" fontSize={14} fontFamily="monospace" fontWeight="bold">
              Mode: {mode === "cp" ? "CP (Consistency)" : "AP (Availability)"}
            </text>
          </DiagramContainer>
        </div>

        {/* Event Log */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl flex flex-col">
          <div className="px-4 py-2 border-b border-gray-800 text-xs font-medium text-gray-400">
            Event Log
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1 text-[11px] font-mono max-h-[350px]">
            {events.map((evt, i) => (
              <div
                key={i}
                className={`${
                  evt.type === "success" ? "text-green-400" : evt.type === "error" ? "text-red-400" : evt.type === "warning" ? "text-amber-400" : "text-gray-400"
                }`}
              >
                <span className="text-gray-600">{evt.time}</span> {evt.message}
              </div>
            ))}
            {events.length === 0 && (
              <div className="text-gray-600">Start the simulation to see events...</div>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <SimulationControls
          isRunning={isRunning}
          speed={speed}
          onStart={() => setIsRunning(true)}
          onPause={() => setIsRunning(false)}
          onReset={handleReset}
          onSpeedChange={setSpeed}
        />

        <button
          onClick={() => setPartitioned(!partitioned)}
          className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
            partitioned
              ? "bg-green-600/20 text-green-400 border border-green-600/30 hover:bg-green-600/30"
              : "bg-red-600/20 text-red-400 border border-red-600/30 hover:bg-red-600/30"
          }`}
        >
          {partitioned ? "Heal Network" : "Create Partition"}
        </button>

        <div className="flex gap-2 text-xs">
          <button
            onClick={() => setMode("cp")}
            className={`px-3 py-1.5 rounded ${mode === "cp" ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400"}`}
          >
            CP Mode
          </button>
          <button
            onClick={() => setMode("ap")}
            className={`px-3 py-1.5 rounded ${mode === "ap" ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400"}`}
          >
            AP Mode
          </button>
        </div>

        <button onClick={sendWrite} className="px-3 py-1.5 text-xs bg-gray-800 text-gray-300 rounded hover:bg-gray-700">
          Send Write
        </button>
        <button onClick={sendRead} className="px-3 py-1.5 text-xs bg-gray-800 text-gray-300 rounded hover:bg-gray-700">
          Send Read
        </button>
      </div>
    </div>
  );
}
