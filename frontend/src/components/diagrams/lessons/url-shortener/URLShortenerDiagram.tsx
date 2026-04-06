"use client";

import { AnimatePresence, motion } from "framer-motion";
import DiagramContainer from "../../core/DiagramContainer";

interface URLShortenerDiagramProps {
  state: string;
  className?: string;
}

export default function URLShortenerDiagram({ state, className = "" }: URLShortenerDiagramProps) {
  const showLB = ["read_path", "write_path", "caching_layer", "full_architecture"].includes(state);
  const showServers = ["read_path", "write_path", "caching_layer", "full_architecture"].includes(state);
  const showDB = ["database_schema", "read_path", "write_path", "caching_layer", "full_architecture"].includes(state);
  const showCache = ["caching_layer", "full_architecture"].includes(state);

  return (
    <DiagramContainer className={className}>
      <motion.text x={400} y={25} textAnchor="middle" fill="#94a3b8" fontSize={13} fontFamily="monospace" fontWeight="bold">
        {getTitle(state)}
      </motion.text>

      {/* Requirements */}
      <AnimatePresence>
        {state === "requirements_overview" && (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <rect x={150} y={60} width={500} height={180} rx={10} fill="#1e293b" stroke="#3b82f6" strokeWidth={1.5} />
            <text x={400} y={90} textAnchor="middle" fill="#60a5fa" fontSize={14} fontFamily="monospace" fontWeight="bold">Requirements</text>
            {["POST /api/shorten → short URL", "GET /:code → 301 redirect", "100M new URLs/day", "10:1 read-to-write ratio", "URLs expire after configurable TTL", "Analytics: click count, geography"].map((req, i) => (
              <text key={i} x={180} y={115 + i * 22} fill="#94a3b8" fontSize={11} fontFamily="monospace">• {req}</text>
            ))}
          </motion.g>
        )}
      </AnimatePresence>

      {/* API Design */}
      <AnimatePresence>
        {state === "api_design" && (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <rect x={100} y={60} width={280} height={120} rx={8} fill="#172554" stroke="#3b82f6" strokeWidth={1.5} />
            <text x={240} y={85} textAnchor="middle" fill="#60a5fa" fontSize={12} fontFamily="monospace" fontWeight="bold">Write API</text>
            <text x={120} y={108} fill="#86efac" fontSize={10} fontFamily="monospace">POST /api/shorten</text>
            <text x={120} y={125} fill="#94a3b8" fontSize={9} fontFamily="monospace">{"{"} "url": "https://very-long..." {"}"}</text>
            <text x={120} y={145} fill="#94a3b8" fontSize={9} fontFamily="monospace">→ {"{"} "short": "abc123" {"}"}</text>

            <rect x={420} y={60} width={280} height={120} rx={8} fill="#052e16" stroke="#22c55e" strokeWidth={1.5} />
            <text x={560} y={85} textAnchor="middle" fill="#86efac" fontSize={12} fontFamily="monospace" fontWeight="bold">Read API</text>
            <text x={440} y={108} fill="#86efac" fontSize={10} fontFamily="monospace">GET /abc123</text>
            <text x={440} y={125} fill="#94a3b8" fontSize={9} fontFamily="monospace">→ 301 Redirect</text>
            <text x={440} y={145} fill="#94a3b8" fontSize={9} fontFamily="monospace">Location: https://very-long...</text>
          </motion.g>
        )}
      </AnimatePresence>

      {/* Encoding Strategy */}
      <AnimatePresence>
        {state === "encoding_strategy" && (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <rect x={150} y={70} width={500} height={150} rx={10} fill="#1e293b" stroke="#f59e0b" strokeWidth={1.5} />
            <text x={400} y={95} textAnchor="middle" fill="#fbbf24" fontSize={13} fontFamily="monospace" fontWeight="bold">Base62 Encoding</text>
            <text x={180} y={120} fill="#94a3b8" fontSize={11} fontFamily="monospace">Characters: [a-z][A-Z][0-9] = 62 chars</text>
            <text x={180} y={142} fill="#94a3b8" fontSize={11} fontFamily="monospace">7 chars → 62⁷ = 3.5 trillion URLs</text>
            <text x={180} y={164} fill="#86efac" fontSize={11} fontFamily="monospace">Auto-increment ID → Base62 → "abc123x"</text>
            <text x={180} y={190} fill="#fbbf24" fontSize={10} fontFamily="monospace">No collisions! IDs are unique by design.</text>
          </motion.g>
        )}
      </AnimatePresence>

      {/* Database Schema */}
      <AnimatePresence>
        {showDB && (
          <motion.g initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: state === "database_schema" ? 0 : 0.5 }}>
            <ellipse cx={400} cy={state === "database_schema" ? 160 : 400} rx={80} ry={18} fill="#1e293b" stroke="#22c55e" strokeWidth={2} />
            <rect x={320} y={state === "database_schema" ? 160 : 400} width={160} height={50} fill="#1e293b" stroke="#22c55e" strokeWidth={2} />
            <ellipse cx={400} cy={state === "database_schema" ? 210 : 450} rx={80} ry={18} fill="#1e293b" stroke="#22c55e" strokeWidth={2} />
            <text x={400} y={state === "database_schema" ? 190 : 430} textAnchor="middle" fill="#86efac" fontSize={10} fontFamily="monospace">urls_db</text>
            {state === "database_schema" && (
              <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                <rect x={180} y={250} width={440} height={100} rx={6} fill="#172554" stroke="#3b82f6" strokeWidth={1} />
                <text x={400} y={272} textAnchor="middle" fill="#60a5fa" fontSize={11} fontFamily="monospace" fontWeight="bold">urls table</text>
                <text x={200} y={292} fill="#94a3b8" fontSize={9} fontFamily="monospace">id BIGINT PK | short_code VARCHAR(7) UNIQUE</text>
                <text x={200} y={308} fill="#94a3b8" fontSize={9} fontFamily="monospace">original_url TEXT | created_at TIMESTAMP</text>
                <text x={200} y={324} fill="#94a3b8" fontSize={9} fontFamily="monospace">expires_at TIMESTAMP | click_count BIGINT</text>
              </motion.g>
            )}
          </motion.g>
        )}
      </AnimatePresence>

      {/* Full Architecture */}
      <AnimatePresence>
        {showLB && (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Client */}
            <rect x={30} y={150} width={80} height={50} rx={6} fill="#1e293b" stroke="#8b5cf6" strokeWidth={1.5} />
            <text x={70} y={180} textAnchor="middle" fill="#a78bfa" fontSize={10} fontFamily="monospace">Client</text>

            {/* LB */}
            <polygon points="200,145 260,145 270,200 190,200" fill="#1e293b" stroke="#a855f7" strokeWidth={2} />
            <text x={230} y={178} textAnchor="middle" fill="#c084fc" fontSize={9} fontFamily="monospace">LB</text>
            <line x1={110} y1={175} x2={190} y2={175} stroke="#8b5cf6" strokeWidth={1.5} markerEnd="url(#arrowhead)" />
          </motion.g>
        )}

        {showServers && (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            {[0, 1, 2].map((i) => (
              <motion.g key={i}>
                <rect x={320} y={120 + i * 55} width={90} height={40} rx={6} fill="#1e293b" stroke="#3b82f6" strokeWidth={1.5} />
                <text x={365} y={145 + i * 55} textAnchor="middle" fill="#60a5fa" fontSize={9} fontFamily="monospace">App {i + 1}</text>
                <line x1={270} y1={175} x2={320} y2={140 + i * 55} stroke="#3b82f6" strokeWidth={1} />
              </motion.g>
            ))}
          </motion.g>
        )}

        {showCache && (
          <motion.g initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}>
            <polygon points="530,140 570,160 570,200 530,220 490,200 490,160" fill="#1e293b" stroke="#f59e0b" strokeWidth={2} />
            <text x={530} y={185} textAnchor="middle" fill="#fbbf24" fontSize={9} fontFamily="monospace">Redis</text>
            <line x1={410} y1={155} x2={490} y2={175} stroke="#f59e0b" strokeWidth={1} strokeDasharray="4 3" />
          </motion.g>
        )}
      </AnimatePresence>
    </DiagramContainer>
  );
}

function getTitle(state: string): string {
  switch (state) {
    case "empty": return "";
    case "requirements_overview": return "URL Shortener — Requirements";
    case "api_design": return "API Design";
    case "encoding_strategy": return "Base62 Encoding Strategy";
    case "database_schema": return "Database Schema";
    case "read_path": return "Read Path (GET /:code)";
    case "write_path": return "Write Path (POST /shorten)";
    case "caching_layer": return "Adding a Cache Layer";
    case "full_architecture": return "Complete Architecture";
    default: return "";
  }
}
