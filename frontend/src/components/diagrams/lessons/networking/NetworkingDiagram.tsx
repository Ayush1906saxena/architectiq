"use client";

import { AnimatePresence, motion } from "framer-motion";
import DiagramContainer from "../../core/DiagramContainer";

interface NetworkingDiagramProps {
  state: string;
  className?: string;
}

export default function NetworkingDiagram({ state, className = "" }: NetworkingDiagramProps) {
  const showBrowser = state !== "empty";
  const showDNS = ["dns_lookup", "tcp_handshake", "http_request", "server_processes", "response_returns", "page_renders"].includes(state);
  const showServer = ["tcp_handshake", "http_request", "server_processes", "response_returns", "page_renders"].includes(state);
  const showHTTP = ["http_request", "server_processes", "response_returns", "page_renders"].includes(state);
  const showResponse = ["response_returns", "page_renders"].includes(state);

  return (
    <DiagramContainer className={className}>
      <motion.text x={400} y={30} textAnchor="middle" fill="#94a3b8" fontSize={14} fontFamily="monospace" fontWeight="bold">
        {getTitle(state)}
      </motion.text>

      {/* Browser */}
      <AnimatePresence>
        {showBrowser && (
          <motion.g initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <rect x={50} y={80} width={160} height={100} rx={8} fill="#1e293b" stroke="#8b5cf6" strokeWidth={2} />
            <rect x={50} y={80} width={160} height={20} rx={8} fill="#374151" />
            <circle cx={65} cy={90} r={4} fill="#ef4444" />
            <circle cx={78} cy={90} r={4} fill="#f59e0b" />
            <circle cx={91} cy={90} r={4} fill="#22c55e" />
            <text x={130} y={93} textAnchor="middle" fill="#94a3b8" fontSize={8} fontFamily="monospace">google.com</text>
            <text x={130} y={140} textAnchor="middle" fill="#a78bfa" fontSize={11} fontFamily="monospace">Browser</text>
          </motion.g>
        )}
      </AnimatePresence>

      {/* DNS Server */}
      <AnimatePresence>
        {showDNS && (
          <motion.g initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}>
            <rect x={300} y={60} width={120} height={60} rx={8} fill="#1e293b" stroke="#f59e0b" strokeWidth={2} />
            <text x={360} y={85} textAnchor="middle" fill="#fbbf24" fontSize={11} fontFamily="monospace">DNS Server</text>
            <text x={360} y={102} textAnchor="middle" fill="#94a3b8" fontSize={9} fontFamily="monospace">142.250.80.46</text>
            {/* Arrow from browser to DNS */}
            <line x1={210} y1={100} x2={300} y2={90} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 3" markerEnd="url(#arrowhead)" />
            <text x={255} y={85} textAnchor="middle" fill="#f59e0b" fontSize={8} fontFamily="monospace">Who is google.com?</text>
          </motion.g>
        )}
      </AnimatePresence>

      {/* Web Server */}
      <AnimatePresence>
        {showServer && (
          <motion.g initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
            <rect x={560} y={80} width={160} height={100} rx={8} fill="#1e293b" stroke="#22c55e" strokeWidth={2} />
            <text x={640} y={120} textAnchor="middle" fill="#86efac" fontSize={11} fontFamily="monospace">Google Server</text>
            <text x={640} y={138} textAnchor="middle" fill="#94a3b8" fontSize={9} fontFamily="monospace">142.250.80.46:443</text>
            <circle cx={705} cy={92} r={4} fill="#22c55e" />
          </motion.g>
        )}
      </AnimatePresence>

      {/* TCP Handshake */}
      <AnimatePresence>
        {state === "tcp_handshake" && (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <line x1={210} y1={140} x2={560} y2={140} stroke="#3b82f6" strokeWidth={1.5} />
            <text x={390} y={135} textAnchor="middle" fill="#60a5fa" fontSize={9} fontFamily="monospace">SYN →</text>
            <text x={390} y={150} textAnchor="middle" fill="#60a5fa" fontSize={9} fontFamily="monospace">← SYN-ACK</text>
            <text x={390} y={165} textAnchor="middle" fill="#60a5fa" fontSize={9} fontFamily="monospace">ACK →</text>
            <text x={390} y={185} textAnchor="middle" fill="#94a3b8" fontSize={10} fontFamily="monospace">TCP 3-Way Handshake</text>
          </motion.g>
        )}
      </AnimatePresence>

      {/* HTTP Request */}
      <AnimatePresence>
        {showHTTP && (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <motion.line x1={210} y1={130} x2={560} y2={130} stroke="#3b82f6" strokeWidth={2} strokeDasharray="8 4"
              animate={{ strokeDashoffset: [0, -24] }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
            <rect x={320} y={200} width={180} height={70} rx={6} fill="#172554" stroke="#3b82f6" strokeWidth={1} />
            <text x={410} y={218} textAnchor="middle" fill="#60a5fa" fontSize={10} fontFamily="monospace" fontWeight="bold">GET / HTTP/1.1</text>
            <text x={410} y={234} textAnchor="middle" fill="#94a3b8" fontSize={9} fontFamily="monospace">Host: google.com</text>
            <text x={410} y={248} textAnchor="middle" fill="#94a3b8" fontSize={9} fontFamily="monospace">Accept: text/html</text>
            <text x={410} y={262} textAnchor="middle" fill="#94a3b8" fontSize={9} fontFamily="monospace">User-Agent: Chrome</text>
          </motion.g>
        )}
      </AnimatePresence>

      {/* Server Processing */}
      <AnimatePresence>
        {state === "server_processes" && (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <text x={640} y={160} textAnchor="middle" fill="#fbbf24" fontSize={9} fontFamily="monospace" className="animate-pulse">Processing...</text>
            <rect x={580} y={200} width={120} height={50} rx={6} fill="#1e293b" stroke="#f59e0b" strokeWidth={1} />
            <text x={640} y={220} textAnchor="middle" fill="#fbbf24" fontSize={9} fontFamily="monospace">Route → Handler</text>
            <text x={640} y={236} textAnchor="middle" fill="#fbbf24" fontSize={9} fontFamily="monospace">Query DB → Render</text>
          </motion.g>
        )}
      </AnimatePresence>

      {/* Response */}
      <AnimatePresence>
        {showResponse && (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <motion.line x1={560} y1={150} x2={210} y2={150} stroke="#22c55e" strokeWidth={2} strokeDasharray="8 4"
              animate={{ strokeDashoffset: [0, 24] }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
            <rect x={320} y={310} width={180} height={70} rx={6} fill="#052e16" stroke="#22c55e" strokeWidth={1} />
            <text x={410} y={328} textAnchor="middle" fill="#86efac" fontSize={10} fontFamily="monospace" fontWeight="bold">200 OK</text>
            <text x={410} y={344} textAnchor="middle" fill="#94a3b8" fontSize={9} fontFamily="monospace">Content-Type: text/html</text>
            <text x={410} y={358} textAnchor="middle" fill="#94a3b8" fontSize={9} fontFamily="monospace">Content-Length: 15234</text>
            <text x={410} y={372} textAnchor="middle" fill="#94a3b8" fontSize={9} fontFamily="monospace">&lt;html&gt;...&lt;/html&gt;</text>
          </motion.g>
        )}
      </AnimatePresence>

      {/* Page Renders */}
      <AnimatePresence>
        {state === "page_renders" && (
          <motion.g initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}>
            <rect x={50} y={320} width={160} height={80} rx={8} fill="#1e293b" stroke="#22c55e" strokeWidth={2} />
            <text x={130} y={345} textAnchor="middle" fill="#86efac" fontSize={10} fontFamily="monospace">DOM → CSSOM</text>
            <text x={130} y={362} textAnchor="middle" fill="#86efac" fontSize={10} fontFamily="monospace">Layout → Paint</text>
            <text x={130} y={379} textAnchor="middle" fill="#22c55e" fontSize={10} fontFamily="monospace" fontWeight="bold">Page Ready!</text>
          </motion.g>
        )}
      </AnimatePresence>

      {/* Timeline at bottom */}
      <AnimatePresence>
        {state !== "empty" && (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 0.5 }}>
            <line x1={50} y1={450} x2={750} y2={450} stroke="#374151" strokeWidth={1} />
            {["DNS", "TCP", "TLS", "HTTP", "Server", "Response", "Render"].map((step, i) => (
              <text key={step} x={100 + i * 95} y={465} textAnchor="middle" fill="#4b5563" fontSize={8} fontFamily="monospace">{step}</text>
            ))}
          </motion.g>
        )}
      </AnimatePresence>
    </DiagramContainer>
  );
}

function getTitle(state: string): string {
  switch (state) {
    case "empty": return "";
    case "browser_types_url": return "You type google.com...";
    case "dns_lookup": return "Step 1: DNS Lookup";
    case "tcp_handshake": return "Step 2: TCP Handshake";
    case "http_request": return "Step 3: HTTP Request";
    case "server_processes": return "Step 4: Server Processes";
    case "response_returns": return "Step 5: Response Returns";
    case "page_renders": return "Step 6: Browser Renders";
    default: return "";
  }
}
