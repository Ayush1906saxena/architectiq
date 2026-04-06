"use client";

import { AnimatePresence, motion } from "framer-motion";
import DiagramContainer from "../../core/DiagramContainer";
import Server from "../../core/Server";
import Client from "../../core/Client";
import LoadBalancer from "../../core/LoadBalancer";
import Arrow from "../../core/Arrow";
import DataPacket from "../../core/DataPacket";
import FlowLabel from "../../core/FlowLabel";
import StatusIndicator from "../../core/StatusIndicator";

interface LoadBalancingDiagramProps {
  state: string;
  className?: string;
}

const CLIENTS = [
  { id: "client_1", label: "Client 1", x: 160, y: 70 },
  { id: "client_2", label: "Client 2", x: 330, y: 70 },
  { id: "client_3", label: "Client 3", x: 500, y: 70 },
  { id: "client_4", label: "Client 4", x: 670, y: 70 },
];

const SERVERS = [
  { id: "server_a", label: "Server A", x: 200, y: 400 },
  { id: "server_b", label: "Server B", x: 400, y: 400 },
  { id: "server_c", label: "Server C", x: 600, y: 400 },
];

const LB = { x: 400, y: 230 };

const RR_PACKETS = [
  { id: "req_1", label: "R1", target: "server_a", formula: "Req 1 → A" },
  { id: "req_2", label: "R2", target: "server_b", formula: "Req 2 → B" },
  { id: "req_3", label: "R3", target: "server_c", formula: "Req 3 → C" },
  { id: "req_4", label: "R4", target: "server_a", formula: "Req 4 → A" },
];

const WEIGHTED_PACKETS = [
  { id: "w1", label: "R1", target: "server_a", formula: "w=2" },
  { id: "w2", label: "R2", target: "server_a", formula: "w=2" },
  { id: "w3", label: "R3", target: "server_b", formula: "w=1" },
  { id: "w4", label: "R4", target: "server_c", formula: "w=1" },
];

function getServerPos(serverId: string) {
  const server = SERVERS.find((s) => s.id === serverId);
  return server ? { x: server.x, y: server.y } : { x: 400, y: 400 };
}

function showClients(state: string): boolean {
  return [
    "single_server",
    "clients_overwhelming",
    "lb_appears",
    "round_robin_flow",
    "weighted_flow",
    "health_check",
    "server_failure_handled",
  ].includes(state);
}

function showLB(state: string): boolean {
  return [
    "lb_appears",
    "round_robin_flow",
    "weighted_flow",
    "health_check",
    "server_failure_handled",
  ].includes(state);
}

function showAllServers(state: string): boolean {
  return [
    "lb_appears",
    "round_robin_flow",
    "weighted_flow",
    "health_check",
    "server_failure_handled",
  ].includes(state);
}

function getServerStatus(
  serverId: string,
  state: string
): "active" | "crashed" | "highlighted" {
  if (serverId === "server_b" && state === "server_failure_handled") {
    return "crashed";
  }
  if (state === "health_check") return "highlighted";
  return "active";
}

export default function LoadBalancingDiagram({
  state,
  className = "",
}: LoadBalancingDiagramProps) {
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

      {/* Clients */}
      <AnimatePresence>
        {showClients(state) &&
          CLIENTS.map((client, i) => (
            <Client
              key={client.id}
              x={client.x}
              y={client.y}
              label={client.label}
              status="active"
              delay={i * 0.15}
            />
          ))}
      </AnimatePresence>

      {/* Single server (before LB) */}
      <AnimatePresence>
        {(state === "single_server" || state === "clients_overwhelming") && (
          <Server
            key="solo_server"
            x={400}
            y={300}
            label="Server"
            status={state === "clients_overwhelming" ? "crashed" : "active"}
            delay={0.3}
          />
        )}
      </AnimatePresence>

      {/* Arrows from clients to single server */}
      <AnimatePresence>
        {state === "single_server" &&
          CLIENTS.map((client, i) => (
            <Arrow
              key={`solo_arrow_${client.id}`}
              fromX={client.x}
              fromY={client.y + 35}
              toX={400}
              toY={265}
              color="#8b5cf6"
              delay={i * 0.2 + 0.5}
              animated
            />
          ))}
      </AnimatePresence>

      {/* Overwhelming flood arrows */}
      <AnimatePresence>
        {state === "clients_overwhelming" && (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {CLIENTS.map((client, i) => (
              <Arrow
                key={`flood_${client.id}`}
                fromX={client.x}
                fromY={client.y + 35}
                toX={400}
                toY={265}
                color="#ef4444"
                delay={i * 0.1}
                animated
              />
            ))}
            <FlowLabel
              x={400}
              y={210}
              text="OVERLOADED!"
              color="#ef4444"
              fontSize={16}
              background
            />
          </motion.g>
        )}
      </AnimatePresence>

      {/* Load Balancer */}
      <AnimatePresence>
        {showLB(state) && (
          <LoadBalancer
            key="lb"
            x={LB.x}
            y={LB.y}
            label="Load Balancer"
            status={state === "health_check" ? "highlighted" : "active"}
            delay={0.2}
          />
        )}
      </AnimatePresence>

      {/* Arrows from clients to LB */}
      <AnimatePresence>
        {showLB(state) &&
          CLIENTS.map((client, i) => (
            <Arrow
              key={`client_lb_${client.id}`}
              fromX={client.x}
              fromY={client.y + 35}
              toX={LB.x}
              toY={LB.y - 30}
              color="#8b5cf6"
              delay={i * 0.15 + 0.4}
            />
          ))}
      </AnimatePresence>

      {/* Servers (multi-server states) */}
      <AnimatePresence>
        {showAllServers(state) &&
          SERVERS.map((server, i) => (
            <Server
              key={server.id}
              x={server.x}
              y={server.y}
              label={server.label}
              status={getServerStatus(server.id, state)}
              delay={i * 0.2 + 0.5}
            />
          ))}
      </AnimatePresence>

      {/* Arrows from LB to servers */}
      <AnimatePresence>
        {showAllServers(state) &&
          SERVERS.map((server, i) => {
            if (
              server.id === "server_b" &&
              state === "server_failure_handled"
            ) {
              return null;
            }
            const strokeWidth =
              state === "weighted_flow" && server.id === "server_a" ? 3 : 2;
            return (
              <Arrow
                key={`lb_server_${server.id}`}
                fromX={LB.x}
                fromY={LB.y + 30}
                toX={server.x}
                toY={server.y - 35}
                color={
                  state === "server_failure_handled" &&
                  server.id === "server_b"
                    ? "#ef4444"
                    : "#a855f7"
                }
                delay={i * 0.2 + 0.7}
                animated={
                  state === "round_robin_flow" || state === "weighted_flow"
                }
              />
            );
          })}
      </AnimatePresence>

      {/* Weight labels */}
      <AnimatePresence>
        {state === "weighted_flow" &&
          SERVERS.map((server) => {
            const weight =
              server.id === "server_a" ? "w=2" : "w=1";
            return (
              <FlowLabel
                key={`weight_${server.id}`}
                x={server.x}
                y={server.y - 55}
                text={weight}
                color={server.id === "server_a" ? "#f59e0b" : "#94a3b8"}
                fontSize={11}
                background
              />
            );
          })}
      </AnimatePresence>

      {/* Round robin packets */}
      <AnimatePresence>
        {state === "round_robin_flow" &&
          RR_PACKETS.map((packet, i) => {
            const target = getServerPos(packet.target);
            return (
              <DataPacket
                key={packet.id}
                fromX={LB.x}
                fromY={LB.y + 30}
                toX={target.x}
                toY={target.y - 55}
                label={packet.label}
                formula={packet.formula}
                delay={i * 1.0}
                duration={0.9}
              />
            );
          })}
      </AnimatePresence>

      {/* Weighted packets */}
      <AnimatePresence>
        {state === "weighted_flow" &&
          WEIGHTED_PACKETS.map((packet, i) => {
            const target = getServerPos(packet.target);
            return (
              <DataPacket
                key={packet.id}
                fromX={LB.x}
                fromY={LB.y + 30}
                toX={target.x}
                toY={target.y - 55}
                label={packet.label}
                formula={packet.formula}
                delay={i * 0.8}
                duration={0.9}
                color={packet.target === "server_a" ? "#f59e0b" : "#3b82f6"}
              />
            );
          })}
      </AnimatePresence>

      {/* Health check pings */}
      <AnimatePresence>
        {state === "health_check" &&
          SERVERS.map((server, i) => (
            <motion.g
              key={`hc_${server.id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.6 }}
            >
              <StatusIndicator
                x={server.x + 55}
                y={server.y - 30}
                status="healthy"
                label="OK"
                delay={i * 0.6 + 0.3}
              />
            </motion.g>
          ))}
      </AnimatePresence>

      {/* Server failure reroute annotation */}
      <AnimatePresence>
        {state === "server_failure_handled" && (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <FlowLabel
              x={400}
              y={340}
              text="Traffic rerouted to A & C"
              color="#f59e0b"
              fontSize={12}
              background
            />
            {/* Dashed reroute arrows */}
            <Arrow
              fromX={LB.x - 20}
              fromY={LB.y + 30}
              toX={200}
              toY={365}
              color="#f59e0b"
              dashed
              animated
              delay={1.0}
            />
            <Arrow
              fromX={LB.x + 20}
              fromY={LB.y + 30}
              toX={600}
              toY={365}
              color="#f59e0b"
              dashed
              animated
              delay={1.2}
            />
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
    case "single_server":
      return "Single Server Setup";
    case "clients_overwhelming":
      return "Too Many Requests!";
    case "lb_appears":
      return "Enter the Load Balancer";
    case "round_robin_flow":
      return "Round Robin Distribution";
    case "weighted_flow":
      return "Weighted Load Balancing";
    case "health_check":
      return "Health Checks";
    case "server_failure_handled":
      return "Handling Server Failure";
    default:
      return "";
  }
}
