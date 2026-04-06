"use client";

import { AnimatePresence, motion } from "framer-motion";
import DiagramContainer from "../../core/DiagramContainer";
import Server from "../../core/Server";
import Arrow from "../../core/Arrow";
import NetworkPartition from "../../core/NetworkPartition";
import FlowLabel from "../../core/FlowLabel";

interface CAPTheoremDiagramProps {
  state: string;
  className?: string;
}

// Triangle arrangement
const NODES = [
  { id: "node_a", label: "Node A", x: 400, y: 100 },
  { id: "node_b", label: "Node B", x: 220, y: 350 },
  { id: "node_c", label: "Node C", x: 580, y: 350 },
];

function showNodes(state: string): boolean {
  return [
    "three_nodes",
    "normal_operation",
    "partition_appears",
    "choose_cp",
    "choose_ap",
  ].includes(state);
}

function getNodeStatus(
  nodeId: string,
  state: string
): "active" | "crashed" | "highlighted" {
  if (state === "choose_cp" && nodeId === "node_a") return "crashed";
  if (state === "normal_operation") return "highlighted";
  return "active";
}

function showConnections(state: string): boolean {
  return ["three_nodes", "normal_operation"].includes(state);
}

function showPartition(state: string): boolean {
  return ["partition_appears", "choose_cp", "choose_ap"].includes(state);
}

export default function CAPTheoremDiagram({
  state,
  className = "",
}: CAPTheoremDiagramProps) {
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

      {/* Server nodes */}
      <AnimatePresence>
        {showNodes(state) &&
          NODES.map((node, i) => (
            <Server
              key={node.id}
              x={node.x}
              y={node.y}
              label={node.label}
              status={getNodeStatus(node.id, state)}
              delay={i * 0.3}
            />
          ))}
      </AnimatePresence>

      {/* Bidirectional connections (all three edges of triangle) */}
      <AnimatePresence>
        {showConnections(state) && (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* A <-> B */}
            <Arrow
              fromX={NODES[0].x - 30}
              fromY={NODES[0].y + 35}
              toX={NODES[1].x + 30}
              toY={NODES[1].y - 35}
              color="#3b82f6"
              delay={0.5}
              animated={state === "normal_operation"}
            />
            <Arrow
              fromX={NODES[1].x + 40}
              fromY={NODES[1].y - 30}
              toX={NODES[0].x - 20}
              toY={NODES[0].y + 40}
              color="#3b82f6"
              delay={0.6}
              animated={state === "normal_operation"}
            />
            {/* B <-> C */}
            <Arrow
              fromX={NODES[1].x + 50}
              fromY={NODES[1].y}
              toX={NODES[2].x - 50}
              toY={NODES[2].y}
              color="#3b82f6"
              delay={0.7}
              animated={state === "normal_operation"}
            />
            <Arrow
              fromX={NODES[2].x - 50}
              fromY={NODES[2].y + 5}
              toX={NODES[1].x + 50}
              toY={NODES[1].y + 5}
              color="#3b82f6"
              delay={0.8}
              animated={state === "normal_operation"}
            />
            {/* A <-> C */}
            <Arrow
              fromX={NODES[0].x + 30}
              fromY={NODES[0].y + 35}
              toX={NODES[2].x - 30}
              toY={NODES[2].y - 35}
              color="#3b82f6"
              delay={0.9}
              animated={state === "normal_operation"}
            />
            <Arrow
              fromX={NODES[2].x - 40}
              fromY={NODES[2].y - 30}
              toX={NODES[0].x + 20}
              toY={NODES[0].y + 40}
              color="#3b82f6"
              delay={1.0}
              animated={state === "normal_operation"}
            />
          </motion.g>
        )}
      </AnimatePresence>

      {/* Sync label during normal operation */}
      <AnimatePresence>
        {state === "normal_operation" && (
          <FlowLabel
            x={400}
            y={260}
            text="All nodes in sync"
            color="#22c55e"
            fontSize={12}
            background
          />
        )}
      </AnimatePresence>

      {/* Surviving connections when partition splits A from B,C */}
      <AnimatePresence>
        {showPartition(state) && (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {/* B <-> C still connected */}
            <Arrow
              fromX={NODES[1].x + 50}
              fromY={NODES[1].y}
              toX={NODES[2].x - 50}
              toY={NODES[2].y}
              color="#3b82f6"
              delay={0.6}
              animated
            />
            <Arrow
              fromX={NODES[2].x - 50}
              fromY={NODES[2].y + 5}
              toX={NODES[1].x + 50}
              toY={NODES[1].y + 5}
              color="#3b82f6"
              delay={0.7}
              animated
            />
          </motion.g>
        )}
      </AnimatePresence>

      {/* Network partition line */}
      <AnimatePresence>
        {showPartition(state) && (
          <NetworkPartition
            x1={100}
            y1={200}
            x2={700}
            y2={200}
            delay={0.3}
          />
        )}
      </AnimatePresence>

      {/* CP mode labels */}
      <AnimatePresence>
        {state === "choose_cp" && (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            {/* Node A: unavailable */}
            <motion.g
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.0, duration: 0.4 }}
            >
              <rect
                x={330}
                y={55}
                width={140}
                height={24}
                rx={12}
                fill="#450a0a"
                stroke="#ef4444"
                strokeWidth={1.5}
              />
              <text
                x={400}
                y={71}
                textAnchor="middle"
                fill="#fca5a5"
                fontSize={11}
                fontFamily="monospace"
                fontWeight="bold"
              >
                UNAVAILABLE
              </text>
            </motion.g>

            {/* Nodes B & C: consistent */}
            {[NODES[1], NODES[2]].map((node, i) => (
              <motion.g
                key={`cp_label_${node.id}`}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.2 + i * 0.2, duration: 0.4 }}
              >
                <rect
                  x={node.x - 55}
                  y={node.y + 40}
                  width={110}
                  height={24}
                  rx={12}
                  fill="#052e16"
                  stroke="#22c55e"
                  strokeWidth={1.5}
                />
                <text
                  x={node.x}
                  y={node.y + 56}
                  textAnchor="middle"
                  fill="#86efac"
                  fontSize={11}
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  CONSISTENT
                </text>
              </motion.g>
            ))}

            {/* CP badge */}
            <motion.g
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.6 }}
            >
              <rect
                x={350}
                y={440}
                width={100}
                height={30}
                rx={15}
                fill="#172554"
                stroke="#3b82f6"
                strokeWidth={2}
              />
              <text
                x={400}
                y={460}
                textAnchor="middle"
                fill="#60a5fa"
                fontSize={14}
                fontFamily="monospace"
                fontWeight="bold"
              >
                CP Mode
              </text>
            </motion.g>
          </motion.g>
        )}
      </AnimatePresence>

      {/* AP mode labels */}
      <AnimatePresence>
        {state === "choose_ap" && (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            {/* Node A: available but stale */}
            <motion.g
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.0, duration: 0.4 }}
            >
              <rect
                x={330}
                y={40}
                width={140}
                height={24}
                rx={12}
                fill="#052e16"
                stroke="#22c55e"
                strokeWidth={1.5}
              />
              <text
                x={400}
                y={56}
                textAnchor="middle"
                fill="#86efac"
                fontSize={11}
                fontFamily="monospace"
                fontWeight="bold"
              >
                AVAILABLE
              </text>
            </motion.g>

            {/* Stale data warning on Node A */}
            <motion.g
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.3 }}
            >
              <rect
                x={340}
                y={67}
                width={120}
                height={22}
                rx={11}
                fill="#422006"
                stroke="#f59e0b"
                strokeWidth={1}
              />
              <text
                x={400}
                y={82}
                textAnchor="middle"
                fill="#fbbf24"
                fontSize={10}
                fontFamily="monospace"
                fontWeight="bold"
              >
                STALE DATA
              </text>
            </motion.g>

            {/* Nodes B & C: available */}
            {[NODES[1], NODES[2]].map((node, i) => (
              <motion.g
                key={`ap_label_${node.id}`}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.2 + i * 0.2, duration: 0.4 }}
              >
                <rect
                  x={node.x - 50}
                  y={node.y + 40}
                  width={100}
                  height={24}
                  rx={12}
                  fill="#052e16"
                  stroke="#22c55e"
                  strokeWidth={1.5}
                />
                <text
                  x={node.x}
                  y={node.y + 56}
                  textAnchor="middle"
                  fill="#86efac"
                  fontSize={11}
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  AVAILABLE
                </text>
              </motion.g>
            ))}

            {/* AP badge */}
            <motion.g
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.6 }}
            >
              <rect
                x={350}
                y={440}
                width={100}
                height={30}
                rx={15}
                fill="#172554"
                stroke="#3b82f6"
                strokeWidth={2}
              />
              <text
                x={400}
                y={460}
                textAnchor="middle"
                fill="#60a5fa"
                fontSize={14}
                fontFamily="monospace"
                fontWeight="bold"
              >
                AP Mode
              </text>
            </motion.g>
          </motion.g>
        )}
      </AnimatePresence>

      {/* Real world examples */}
      <AnimatePresence>
        {state === "real_world_examples" && (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {/* CAP Triangle */}
            <motion.polygon
              points="400,80 180,400 620,400"
              fill="none"
              stroke="#3b82f6"
              strokeWidth={2}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.6 }}
              transition={{ duration: 1.5 }}
            />

            {/* C label */}
            <text
              x={400}
              y={70}
              textAnchor="middle"
              fill="#60a5fa"
              fontSize={18}
              fontFamily="monospace"
              fontWeight="bold"
            >
              C
            </text>
            <text
              x={400}
              y={55}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize={10}
              fontFamily="monospace"
            >
              Consistency
            </text>

            {/* A label */}
            <text
              x={160}
              y={420}
              textAnchor="middle"
              fill="#22c55e"
              fontSize={18}
              fontFamily="monospace"
              fontWeight="bold"
            >
              A
            </text>
            <text
              x={160}
              y={438}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize={10}
              fontFamily="monospace"
            >
              Availability
            </text>

            {/* P label */}
            <text
              x={640}
              y={420}
              textAnchor="middle"
              fill="#ef4444"
              fontSize={18}
              fontFamily="monospace"
              fontWeight="bold"
            >
              P
            </text>
            <text
              x={640}
              y={438}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize={10}
              fontFamily="monospace"
            >
              Partition Tolerance
            </text>

            {/* AP examples */}
            {[
              { text: "DynamoDB", y: 340 },
              { text: "Cassandra", y: 360 },
              { text: "CouchDB", y: 380 },
            ].map((ex, i) => (
              <motion.text
                key={`ap_ex_${i}`}
                x={230}
                y={ex.y}
                textAnchor="middle"
                fill="#22c55e"
                fontSize={12}
                fontFamily="monospace"
                initial={{ opacity: 0, x: 210 }}
                animate={{ opacity: 1, x: 230 }}
                transition={{ delay: 0.8 + i * 0.3 }}
              >
                {ex.text} (AP)
              </motion.text>
            ))}

            {/* CP examples */}
            {[
              { text: "Spanner", y: 340 },
              { text: "etcd", y: 360 },
              { text: "HBase", y: 380 },
            ].map((ex, i) => (
              <motion.text
                key={`cp_ex_${i}`}
                x={560}
                y={ex.y}
                textAnchor="middle"
                fill="#60a5fa"
                fontSize={12}
                fontFamily="monospace"
                initial={{ opacity: 0, x: 580 }}
                animate={{ opacity: 1, x: 560 }}
                transition={{ delay: 0.8 + i * 0.3 }}
              >
                {ex.text} (CP)
              </motion.text>
            ))}
          </motion.g>
        )}
      </AnimatePresence>

      {/* PACELC extension */}
      <AnimatePresence>
        {state === "pacelc_extension" && (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {/* PACELC title */}
            <motion.text
              x={400}
              y={80}
              textAnchor="middle"
              fill="#e2e8f0"
              fontSize={22}
              fontFamily="monospace"
              fontWeight="bold"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              PACELC
            </motion.text>

            {/* Decision tree boxes */}
            {/* If Partition */}
            <motion.g
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              <rect
                x={130}
                y={110}
                width={220}
                height={40}
                rx={8}
                fill="#1e293b"
                stroke="#ef4444"
                strokeWidth={1.5}
              />
              <text
                x={240}
                y={135}
                textAnchor="middle"
                fill="#fca5a5"
                fontSize={13}
                fontFamily="monospace"
              >
                If Partition: A or C?
              </text>
            </motion.g>

            {/* Else */}
            <motion.g
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.1 }}
            >
              <rect
                x={440}
                y={110}
                width={230}
                height={40}
                rx={8}
                fill="#1e293b"
                stroke="#3b82f6"
                strokeWidth={1.5}
              />
              <text
                x={555}
                y={135}
                textAnchor="middle"
                fill="#93c5fd"
                fontSize={13}
                fontFamily="monospace"
              >
                Else: L or C?
              </text>
            </motion.g>

            {/* System classifications */}
            {[
              { system: "DynamoDB", classification: "PA / EL", x: 160, y: 200, color: "#22c55e" },
              { system: "Cassandra", classification: "PA / EL", x: 160, y: 240, color: "#22c55e" },
              { system: "Spanner", classification: "PC / EC", x: 400, y: 200, color: "#60a5fa" },
              { system: "MongoDB", classification: "PA / EC", x: 400, y: 240, color: "#f59e0b" },
            ].map((item, i) => (
              <motion.g
                key={`pacelc_${i}`}
                initial={{ opacity: 0, y: item.y - 10 }}
                animate={{ opacity: 1, y: item.y }}
                transition={{ delay: 1.4 + i * 0.3 }}
              >
                <rect
                  x={item.x - 70}
                  y={item.y - 16}
                  width={260}
                  height={30}
                  rx={6}
                  fill="#0f172a"
                  stroke={item.color}
                  strokeWidth={1}
                  opacity={0.8}
                />
                <text
                  x={item.x}
                  y={item.y + 4}
                  fill="#e2e8f0"
                  fontSize={12}
                  fontFamily="monospace"
                >
                  {item.system}
                </text>
                <text
                  x={item.x + 140}
                  y={item.y + 4}
                  textAnchor="end"
                  fill={item.color}
                  fontSize={12}
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {item.classification}
                </text>
              </motion.g>
            ))}

            {/* Legend at bottom */}
            <motion.g
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.8 }}
            >
              <text
                x={400}
                y={320}
                textAnchor="middle"
                fill="#64748b"
                fontSize={11}
                fontFamily="monospace"
              >
                P = Partition | A = Availability | C = Consistency | E = Else | L = Latency
              </text>
            </motion.g>
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
    case "three_nodes":
      return "Three Database Nodes";
    case "normal_operation":
      return "Normal Operation - All Synced";
    case "partition_appears":
      return "Network Partition!";
    case "choose_cp":
      return "Choosing Consistency (CP)";
    case "choose_ap":
      return "Choosing Availability (AP)";
    case "real_world_examples":
      return "CAP in the Real World";
    case "pacelc_extension":
      return "Beyond CAP: PACELC";
    default:
      return "";
  }
}
