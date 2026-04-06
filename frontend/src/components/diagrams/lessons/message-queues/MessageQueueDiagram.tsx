"use client";

import { AnimatePresence, motion } from "framer-motion";
import DiagramContainer from "../../core/DiagramContainer";

interface MessageQueueDiagramProps {
  state: string;
  className?: string;
}

export default function MessageQueueDiagram({ state, className = "" }: MessageQueueDiagramProps) {
  return (
    <DiagramContainer className={className}>
      <motion.text x={400} y={30} textAnchor="middle" fill="#94a3b8" fontSize={14} fontFamily="monospace" fontWeight="bold">
        {getTitle(state)}
      </motion.text>

      {/* Sync coupling - direct arrows */}
      <AnimatePresence>
        {(state === "sync_coupling" || state === "sync_failure") && (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Service A */}
            <rect x={100} y={150} width={120} height={60} rx={8} fill="#1e293b" stroke="#3b82f6" strokeWidth={2} />
            <text x={160} y={185} textAnchor="middle" fill="#60a5fa" fontSize={11} fontFamily="monospace">Service A</text>
            {/* Service B */}
            <rect x={340} y={150} width={120} height={60} rx={8} fill="#1e293b" stroke={state === "sync_failure" ? "#ef4444" : "#3b82f6"} strokeWidth={2} />
            <text x={400} y={185} textAnchor="middle" fill={state === "sync_failure" ? "#fca5a5" : "#60a5fa"} fontSize={11} fontFamily="monospace">Service B</text>
            {/* Service C */}
            <rect x={580} y={150} width={120} height={60} rx={8} fill="#1e293b" stroke="#3b82f6" strokeWidth={2} />
            <text x={640} y={185} textAnchor="middle" fill="#60a5fa" fontSize={11} fontFamily="monospace">Service C</text>
            {/* Arrows */}
            <line x1={220} y1={180} x2={340} y2={180} stroke={state === "sync_failure" ? "#ef4444" : "#3b82f6"} strokeWidth={2} markerEnd="url(#arrowhead)" />
            <line x1={460} y1={180} x2={580} y2={180} stroke={state === "sync_failure" ? "#ef4444" : "#3b82f6"} strokeWidth={2} markerEnd="url(#arrowhead)" />
            <text x={280} y={170} textAnchor="middle" fill="#94a3b8" fontSize={9} fontFamily="monospace">sync call</text>
            <text x={520} y={170} textAnchor="middle" fill="#94a3b8" fontSize={9} fontFamily="monospace">sync call</text>

            {state === "sync_failure" && (
              <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <line x1={370} y1={160} x2={430} y2={200} stroke="#ef4444" strokeWidth={3} />
                <line x1={430} y1={160} x2={370} y2={200} stroke="#ef4444" strokeWidth={3} />
                <rect x={280} y={240} width={240} height={35} rx={6} fill="#450a0a" stroke="#ef4444" strokeWidth={1} />
                <text x={400} y={262} textAnchor="middle" fill="#fca5a5" fontSize={11} fontFamily="monospace">B fails → A blocked → C never called!</text>
              </motion.g>
            )}
          </motion.g>
        )}
      </AnimatePresence>

      {/* Queue appears */}
      <AnimatePresence>
        {["queue_appears", "producer_consumer", "buffering_demo", "pubsub_pattern", "kafka_partitions"].includes(state) && (
          <motion.g initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
            {/* Producer */}
            <rect x={60} y={160} width={100} height={55} rx={8} fill="#1e293b" stroke="#3b82f6" strokeWidth={2} />
            <text x={110} y={192} textAnchor="middle" fill="#60a5fa" fontSize={11} fontFamily="monospace">Producer</text>

            {/* Queue */}
            <rect x={280} y={145} width={200} height={80} rx={8} fill="#1e293b" stroke="#ec4899" strokeWidth={2} />
            <text x={380} y={170} textAnchor="middle" fill="#f472b6" fontSize={12} fontFamily="monospace" fontWeight="bold">Message Queue</text>
            {/* Messages in queue */}
            {[0, 1, 2, 3].map((i) => (
              <motion.rect key={i} x={295 + i * 42} y={180} width={35} height={25} rx={4} fill="#831843" stroke="#ec4899" strokeWidth={1}
                initial={{ x: 160 }} animate={{ x: 295 + i * 42 }} transition={{ delay: 0.3 + i * 0.15, duration: 0.4 }} />
            ))}

            {/* Consumer */}
            <rect x={600} y={160} width={100} height={55} rx={8} fill="#1e293b" stroke="#22c55e" strokeWidth={2} />
            <text x={650} y={192} textAnchor="middle" fill="#86efac" fontSize={11} fontFamily="monospace">Consumer</text>

            {/* Arrows */}
            <line x1={160} y1={187} x2={280} y2={187} stroke="#ec4899" strokeWidth={2} markerEnd="url(#arrowhead)" />
            <line x1={480} y1={187} x2={600} y2={187} stroke="#22c55e" strokeWidth={2} markerEnd="url(#arrowhead)" />

            {/* Benefits */}
            {state === "buffering_demo" && (
              <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <rect x={250} y={260} width={260} height={55} rx={8} fill="#172554" stroke="#3b82f6" strokeWidth={1} />
                <text x={380} y={280} textAnchor="middle" fill="#60a5fa" fontSize={10} fontFamily="monospace">Decoupled: B can fail, A keeps going</text>
                <text x={380} y={295} textAnchor="middle" fill="#60a5fa" fontSize={10} fontFamily="monospace">Buffered: Handle traffic spikes</text>
                <text x={380} y={310} textAnchor="middle" fill="#60a5fa" fontSize={10} fontFamily="monospace">Async: No waiting for response</text>
              </motion.g>
            )}
          </motion.g>
        )}
      </AnimatePresence>

      {/* Pub-Sub pattern */}
      <AnimatePresence>
        {state === "pubsub_pattern" && (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <text x={380} y={260} textAnchor="middle" fill="#f472b6" fontSize={10} fontFamily="monospace">Topic: "order.created"</text>
            {/* Multiple consumers */}
            <rect x={520} y={270} width={90} height={35} rx={6} fill="#1e293b" stroke="#22c55e" strokeWidth={1.5} />
            <text x={565} y={292} textAnchor="middle" fill="#86efac" fontSize={9} fontFamily="monospace">Email Svc</text>
            <rect x={620} y={270} width={90} height={35} rx={6} fill="#1e293b" stroke="#22c55e" strokeWidth={1.5} />
            <text x={665} y={292} textAnchor="middle" fill="#86efac" fontSize={9} fontFamily="monospace">Invoice Svc</text>
            <rect x={520} y={315} width={90} height={35} rx={6} fill="#1e293b" stroke="#22c55e" strokeWidth={1.5} />
            <text x={565} y={337} textAnchor="middle" fill="#86efac" fontSize={9} fontFamily="monospace">Analytics</text>
            <line x1={480} y1={225} x2={520} y2={287} stroke="#22c55e" strokeWidth={1} />
            <line x1={480} y1={225} x2={620} y2={287} stroke="#22c55e" strokeWidth={1} />
            <line x1={480} y1={225} x2={520} y2={332} stroke="#22c55e" strokeWidth={1} />
          </motion.g>
        )}
      </AnimatePresence>

      {/* Kafka Partitions */}
      <AnimatePresence>
        {state === "kafka_partitions" && (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <text x={380} y={270} textAnchor="middle" fill="#f472b6" fontSize={11} fontFamily="monospace" fontWeight="bold">Kafka Topic: orders</text>
            {[0, 1, 2].map((p) => (
              <motion.g key={p} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + p * 0.2 }}>
                <rect x={200} y={285 + p * 40} width={360} height={30} rx={4} fill="#1e293b" stroke="#ec4899" strokeWidth={1} />
                <text x={220} y={305 + p * 40} fill="#f472b6" fontSize={9} fontFamily="monospace">P{p}</text>
                {[0, 1, 2, 3, 4].map((m) => (
                  <rect key={m} x={250 + m * 55} y={290 + p * 40} width={45} height={20} rx={3} fill="#831843" stroke="#ec4899" strokeWidth={0.5} />
                ))}
              </motion.g>
            ))}
            <text x={620} y={305} textAnchor="start" fill="#94a3b8" fontSize={9} fontFamily="monospace">Consumer Group A</text>
            <text x={620} y={345} textAnchor="start" fill="#94a3b8" fontSize={9} fontFamily="monospace">Consumer Group B</text>
          </motion.g>
        )}
      </AnimatePresence>
    </DiagramContainer>
  );
}

function getTitle(state: string): string {
  switch (state) {
    case "empty": return "";
    case "sync_coupling": return "Synchronous Communication";
    case "sync_failure": return "When Sync Breaks...";
    case "queue_appears": return "Enter: The Message Queue";
    case "producer_consumer": return "Producer-Consumer Pattern";
    case "buffering_demo": return "Why Queues Are Powerful";
    case "pubsub_pattern": return "Pub-Sub: One Event, Many Listeners";
    case "kafka_partitions": return "Kafka: Partitioned Event Log";
    default: return "";
  }
}
