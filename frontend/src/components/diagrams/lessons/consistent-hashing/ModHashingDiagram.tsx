"use client";

import { AnimatePresence, motion } from "framer-motion";
import DiagramContainer from "../../core/DiagramContainer";
import Server from "../../core/Server";
import DataPacket from "../../core/DataPacket";
import Arrow from "../../core/Arrow";

interface ModHashingDiagramProps {
  state: string;
  className?: string;
}

const SERVERS = [
  { id: "server_0", label: "Server 0", x: 140, y: 350 },
  { id: "server_1", label: "Server 1", x: 320, y: 350 },
  { id: "server_2", label: "Server 2", x: 500, y: 350 },
  { id: "server_3", label: "Server 3", x: 680, y: 350 },
];

const DATA_PACKETS = [
  {
    id: "data_7",
    label: "7",
    formula: "7 % 4 = 3",
    targetServer: "server_3",
  },
  {
    id: "data_12",
    label: "12",
    formula: "12 % 4 = 0",
    targetServer: "server_0",
  },
  {
    id: "data_25",
    label: "25",
    formula: "25 % 4 = 1",
    targetServer: "server_1",
  },
];

const REMAP_DATA = [
  {
    id: "data_7",
    label: "7",
    oldFormula: "7 % 4 = 3",
    newFormula: "7 % 3 = 1",
    from: "server_3",
    to: "server_1",
    moved: true,
  },
  {
    id: "data_12",
    label: "12",
    oldFormula: "12 % 4 = 0",
    newFormula: "12 % 3 = 0",
    from: "server_0",
    to: "server_0",
    moved: false,
  },
  {
    id: "data_25",
    label: "25",
    oldFormula: "25 % 4 = 1",
    newFormula: "25 % 3 = 1",
    from: "server_1",
    to: "server_1",
    moved: false,
  },
];

function getServerPos(serverId: string) {
  const server = SERVERS.find((s) => s.id === serverId);
  return server ? { x: server.x, y: server.y } : { x: 400, y: 350 };
}

function showServers(state: string): boolean {
  return state !== "empty" && state !== "teaser_ring";
}

function getServerStatus(
  serverId: string,
  state: string
): "active" | "crashed" | "highlighted" {
  if (
    serverId === "server_2" &&
    (state === "server_crash" ||
      state === "show_remapping" ||
      state === "show_cascade")
  ) {
    return "crashed";
  }
  if (state === "all_data_placed" || state === "show_mod_routing") {
    return "highlighted";
  }
  return "active";
}

function isServerVisible(serverId: string, state: string): boolean {
  if (
    serverId === "server_2" &&
    (state === "show_remapping" || state === "show_cascade")
  ) {
    return false;
  }
  return true;
}

export default function ModHashingDiagram({
  state,
  className = "",
}: ModHashingDiagramProps) {
  return (
    <DiagramContainer className={className}>
      {/* Title */}
      <motion.text
        x={400}
        y={30}
        textAnchor="middle"
        fill="#94a3b8"
        fontSize={14}
        fontFamily="monospace"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {getTitleForState(state)}
      </motion.text>

      {/* Formula overlay */}
      <AnimatePresence>
        {state === "show_mod_formula" && (
          <motion.g
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <rect
              x={250}
              y={55}
              width={300}
              height={50}
              rx={8}
              fill="#1e293b"
              stroke="#3b82f6"
              strokeWidth={1.5}
            />
            <text
              x={400}
              y={85}
              textAnchor="middle"
              fill="#60a5fa"
              fontSize={18}
              fontFamily="monospace"
              fontWeight="bold"
            >
              server = ID % N
            </text>
          </motion.g>
        )}
      </AnimatePresence>

      {/* Servers */}
      <AnimatePresence>
        {showServers(state) &&
          SERVERS.map((server, i) =>
            isServerVisible(server.id, state) ? (
              <Server
                key={server.id}
                x={server.x}
                y={server.y}
                label={server.label}
                status={getServerStatus(server.id, state)}
                delay={i * 0.3}
              />
            ) : null
          )}
      </AnimatePresence>

      {/* Data packets flowing to servers */}
      <AnimatePresence>
        {state === "show_mod_routing" &&
          DATA_PACKETS.map((packet, i) => {
            const target = getServerPos(packet.targetServer);
            return (
              <DataPacket
                key={packet.id}
                fromX={target.x}
                fromY={80}
                toX={target.x}
                toY={target.y - 55}
                label={packet.label}
                formula={packet.formula}
                delay={i * 1.2}
                duration={1.0}
              />
            );
          })}
      </AnimatePresence>

      {/* Data placed at servers */}
      <AnimatePresence>
        {(state === "all_data_placed" || state === "server_crash") &&
          DATA_PACKETS.map((packet) => {
            const target = getServerPos(packet.targetServer);
            return (
              <motion.g
                key={`placed_${packet.id}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <circle
                  cx={target.x}
                  cy={target.y - 55}
                  r={12}
                  fill="#3b82f6"
                  opacity={0.8}
                />
                <text
                  x={target.x}
                  y={target.y - 51}
                  textAnchor="middle"
                  fill="white"
                  fontSize={10}
                  fontFamily="monospace"
                >
                  {packet.label}
                </text>
              </motion.g>
            );
          })}
      </AnimatePresence>

      {/* Remapping arrows */}
      <AnimatePresence>
        {state === "show_remapping" &&
          REMAP_DATA.map((remap, i) => {
            const from = getServerPos(remap.from);
            const to = getServerPos(remap.to);

            if (remap.moved) {
              return (
                <motion.g
                  key={`remap_${remap.id}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.8 }}
                >
                  <Arrow
                    fromX={from.x}
                    fromY={from.y - 60}
                    toX={to.x}
                    toY={to.y - 60}
                    color="#f59e0b"
                    animated
                    dashed
                  />
                  <DataPacket
                    fromX={from.x}
                    fromY={from.y - 80}
                    toX={to.x}
                    toY={to.y - 80}
                    label={remap.label}
                    formula={remap.newFormula}
                    delay={i * 0.8 + 0.3}
                    color="#f59e0b"
                  />
                </motion.g>
              );
            }

            // Data that stays
            return (
              <motion.g
                key={`stay_${remap.id}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.8 }}
              >
                <circle
                  cx={to.x}
                  cy={to.y - 55}
                  r={12}
                  fill="#22c55e"
                  opacity={0.8}
                />
                <text
                  x={to.x}
                  y={to.y - 51}
                  textAnchor="middle"
                  fill="white"
                  fontSize={10}
                  fontFamily="monospace"
                >
                  {remap.label}
                </text>
                <text
                  x={to.x}
                  y={to.y - 75}
                  textAnchor="middle"
                  fill="#86efac"
                  fontSize={10}
                  fontFamily="monospace"
                >
                  stays
                </text>
              </motion.g>
            );
          })}
      </AnimatePresence>

      {/* Cascade annotation */}
      <AnimatePresence>
        {state === "show_cascade" && (
          <motion.g
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <rect
              x={200}
              y={130}
              width={400}
              height={70}
              rx={12}
              fill="#450a0a"
              stroke="#ef4444"
              strokeWidth={2}
            />
            <text
              x={400}
              y={160}
              textAnchor="middle"
              fill="#fca5a5"
              fontSize={20}
              fontFamily="monospace"
              fontWeight="bold"
            >
              ~75% of data must move!
            </text>
            <text
              x={400}
              y={185}
              textAnchor="middle"
              fill="#f87171"
              fontSize={13}
              fontFamily="monospace"
            >
              Cache miss storm → Database overload → Cascading failure
            </text>
          </motion.g>
        )}
      </AnimatePresence>

      {/* Teaser ring */}
      <AnimatePresence>
        {state === "teaser_ring" && (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            transition={{ duration: 2 }}
          >
            <circle
              cx={400}
              cy={250}
              r={180}
              fill="none"
              stroke="#3b82f6"
              strokeWidth={2}
              strokeDasharray="8 6"
            />
            <text
              x={400}
              y={255}
              textAnchor="middle"
              fill="#60a5fa"
              fontSize={16}
              fontFamily="monospace"
            >
              Next: The Hash Ring →
            </text>
          </motion.g>
        )}
      </AnimatePresence>
    </DiagramContainer>
  );
}

function getTitleForState(state: string): string {
  switch (state) {
    case "empty":
      return "";
    case "four_servers_visible":
      return "Our Database Cluster";
    case "show_mod_formula":
      return "Modulo Hashing";
    case "show_mod_routing":
      return "Routing Data with Modulo Hashing";
    case "all_data_placed":
      return "All Data Has a Home";
    case "server_crash":
      return "Server 2 Crashes!";
    case "show_remapping":
      return "The Rehashing Cascade";
    case "show_cascade":
      return "The Rehashing Problem";
    case "teaser_ring":
      return "";
    default:
      return "";
  }
}
