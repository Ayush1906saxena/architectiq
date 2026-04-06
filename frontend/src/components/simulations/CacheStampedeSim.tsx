"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DiagramContainer from "@/components/diagrams/core/DiagramContainer";
import SimulationControls from "./SimulationControls";

interface SimState {
  cacheHits: number;
  cacheMisses: number;
  dbLoad: number;
  ttlRemaining: number;
  dbOverloaded: boolean;
}

export default function CacheStampedeSim() {
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [mitigation, setMitigation] = useState<"none" | "lock" | "probabilistic">("none");
  const [state, setState] = useState<SimState>({
    cacheHits: 0,
    cacheMisses: 0,
    dbLoad: 0,
    ttlRemaining: 100,
    dbOverloaded: false,
  });
  const [events, setEvents] = useState<string[]>([]);
  const tickRef = useRef<NodeJS.Timeout | null>(null);

  const addEvent = useCallback((msg: string) => {
    setEvents((prev) => [...prev.slice(-15), msg]);
  }, []);

  useEffect(() => {
    if (!isRunning) {
      if (tickRef.current) clearInterval(tickRef.current);
      return;
    }

    tickRef.current = setInterval(() => {
      setState((prev) => {
        const ttl = prev.ttlRemaining - 2 * speed;
        const cacheValid = ttl > 0;

        // Probabilistic early expiry: some requests miss early
        const earlyMiss = mitigation === "probabilistic" && ttl < 20 && Math.random() < 0.3;

        if (cacheValid && !earlyMiss) {
          addEvent(`Request → Cache HIT (TTL: ${Math.round(ttl)}s)`);
          return { ...prev, cacheHits: prev.cacheHits + 1, ttlRemaining: ttl, dbLoad: Math.max(0, prev.dbLoad - 1), dbOverloaded: false };
        }

        // Cache expired!
        if (mitigation === "lock" && prev.dbLoad > 0) {
          addEvent("Request → Cache MISS → Waiting for lock (another request rebuilding)");
          return { ...prev, cacheMisses: prev.cacheMisses + 1, ttlRemaining: ttl };
        }

        const newDbLoad = prev.dbLoad + (mitigation === "none" ? 5 : 1);
        const overloaded = newDbLoad > 15;

        if (overloaded) {
          addEvent("DANGER: Database overloaded! Response times > 10s");
        } else if (earlyMiss) {
          addEvent(`Request → Early refresh (probabilistic, TTL: ${Math.round(ttl)}s) → DB query`);
        } else {
          addEvent(`Request → Cache MISS (TTL expired) → ${mitigation === "none" ? "ALL" : "1"} request(s) hit DB`);
        }

        // Auto-refresh cache after some time
        const newTtl = newDbLoad > 10 ? 100 : ttl;

        return {
          ...prev,
          cacheMisses: prev.cacheMisses + 1,
          dbLoad: newDbLoad,
          ttlRemaining: newTtl > 0 ? newTtl : (overloaded ? -10 : 100),
          dbOverloaded: overloaded,
        };
      });
    }, 500 / speed);

    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [isRunning, speed, mitigation, addEvent]);

  const handleReset = () => {
    setIsRunning(false);
    setState({ cacheHits: 0, cacheMisses: 0, dbLoad: 0, ttlRemaining: 100, dbOverloaded: false });
    setEvents([]);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_280px] gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <DiagramContainer>
            {/* Clients */}
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.g key={i}>
                <rect x={30 + i * 50} y={30} width={40} height={30} rx={4} fill="#1e293b" stroke="#8b5cf6" strokeWidth={1} />
                <text x={50 + i * 50} y={50} textAnchor="middle" fill="#a78bfa" fontSize={8} fontFamily="monospace">C{i + 1}</text>
              </motion.g>
            ))}

            {/* Arrows to cache */}
            {[0, 1, 2, 3, 4].map((i) => (
              <line key={`arr_${i}`} x1={50 + i * 50} y1={60} x2={350} y2={140} stroke="#8b5cf6" strokeWidth={0.5} opacity={0.3} />
            ))}

            {/* Cache */}
            <motion.g animate={{ scale: state.ttlRemaining > 0 ? 1 : [1, 1.05, 1] }} transition={{ duration: 0.3 }}>
              <polygon points="350,120 400,145 400,195 350,220 300,195 300,145" fill={state.ttlRemaining > 0 ? "#1e293b" : "#450a0a"} stroke={state.ttlRemaining > 0 ? "#f59e0b" : "#ef4444"} strokeWidth={2} />
              <text x={350} y={165} textAnchor="middle" fill={state.ttlRemaining > 0 ? "#fbbf24" : "#ef4444"} fontSize={12} fontFamily="monospace">Cache</text>
              <text x={350} y={182} textAnchor="middle" fill="#94a3b8" fontSize={9} fontFamily="monospace">
                TTL: {Math.max(0, Math.round(state.ttlRemaining))}s
              </text>
            </motion.g>

            {/* Arrow to DB */}
            <line x1={350} y1={220} x2={350} y2={300} stroke={state.dbLoad > 10 ? "#ef4444" : "#94a3b8"} strokeWidth={state.dbLoad > 5 ? 3 : 1} />

            {/* Database */}
            <motion.g animate={{ x: state.dbOverloaded ? [0, -3, 3, -2, 2, 0] : 0 }} transition={{ duration: 0.3 }}>
              <ellipse cx={350} cy={310} rx={60} ry={15} fill="#1e293b" stroke={state.dbOverloaded ? "#ef4444" : "#22c55e"} strokeWidth={2} />
              <rect x={290} y={310} width={120} height={50} fill="#1e293b" stroke={state.dbOverloaded ? "#ef4444" : "#22c55e"} strokeWidth={2} />
              <ellipse cx={350} cy={360} rx={60} ry={15} fill="#1e293b" stroke={state.dbOverloaded ? "#ef4444" : "#22c55e"} strokeWidth={2} />
              <text x={350} y={340} textAnchor="middle" fill={state.dbOverloaded ? "#fca5a5" : "#86efac"} fontSize={11} fontFamily="monospace">Database</text>
              <text x={350} y={355} textAnchor="middle" fill="#94a3b8" fontSize={9} fontFamily="monospace">Load: {state.dbLoad}</text>
            </motion.g>

            {/* Stats */}
            <text x={600} y={140} textAnchor="middle" fill="#86efac" fontSize={11} fontFamily="monospace">Hits: {state.cacheHits}</text>
            <text x={600} y={160} textAnchor="middle" fill="#fca5a5" fontSize={11} fontFamily="monospace">Misses: {state.cacheMisses}</text>
            <text x={600} y={190} textAnchor="middle" fill="#94a3b8" fontSize={10} fontFamily="monospace">
              Mitigation: {mitigation}
            </text>
          </DiagramContainer>
        </div>

        {/* Event Log */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl flex flex-col">
          <div className="px-4 py-2 border-b border-gray-800 text-xs font-medium text-gray-400">Events</div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1 text-[10px] font-mono max-h-[350px]">
            {events.map((evt, i) => (
              <div key={i} className={evt.includes("DANGER") ? "text-red-400" : evt.includes("HIT") ? "text-green-400" : "text-amber-400"}>
                {evt}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <SimulationControls isRunning={isRunning} speed={speed} onStart={() => setIsRunning(true)} onPause={() => setIsRunning(false)} onReset={handleReset} onSpeedChange={setSpeed} />

        <div className="flex gap-2 text-xs">
          <span className="text-gray-500 self-center">Mitigation:</span>
          {(["none", "lock", "probabilistic"] as const).map((m) => (
            <button key={m} onClick={() => setMitigation(m)} className={`px-3 py-1.5 rounded capitalize ${mitigation === m ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400"}`}>
              {m === "none" ? "None" : m === "lock" ? "Lock" : "Early Refresh"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
