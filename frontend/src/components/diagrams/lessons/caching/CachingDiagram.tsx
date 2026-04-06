"use client";

import { AnimatePresence, motion } from "framer-motion";
import DiagramContainer from "../../core/DiagramContainer";
import Client from "../../core/Client";
import Server from "../../core/Server";
import Cache from "../../core/Cache";
import Database from "../../core/Database";
import Arrow from "../../core/Arrow";
import DataPacket from "../../core/DataPacket";
import FlowLabel from "../../core/FlowLabel";

interface CachingDiagramProps {
  state: string;
  className?: string;
}

const CLIENT_POS = { x: 100, y: 250 };
const SERVER_POS = { x: 300, y: 250 };
const CACHE_POS = { x: 500, y: 250 };
const DB_POS = { x: 700, y: 250 };

function showClient(state: string): boolean {
  return state !== "empty";
}

function showServer(state: string): boolean {
  return state !== "empty";
}

function showDB(state: string): boolean {
  return state !== "empty";
}

function showCache(state: string): boolean {
  return [
    "cache_appears",
    "cache_hit",
    "cache_miss",
    "ttl_expiry",
    "cache_aside",
    "write_through",
  ].includes(state);
}

function getCacheStatus(state: string): "idle" | "hit" | "miss" {
  if (state === "cache_hit") return "hit";
  if (state === "cache_miss" || state === "ttl_expiry") return "miss";
  return "idle";
}

export default function CachingDiagram({
  state,
  className = "",
}: CachingDiagramProps) {
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

      {/* Client */}
      <AnimatePresence>
        {showClient(state) && (
          <Client
            key="client"
            x={CLIENT_POS.x}
            y={CLIENT_POS.y}
            label="Client"
            status="active"
            delay={0.1}
          />
        )}
      </AnimatePresence>

      {/* Server */}
      <AnimatePresence>
        {showServer(state) && (
          <Server
            key="server"
            x={SERVER_POS.x}
            y={SERVER_POS.y}
            label="Server"
            status="active"
            delay={0.2}
          />
        )}
      </AnimatePresence>

      {/* Database */}
      <AnimatePresence>
        {showDB(state) && (
          <Database
            key="database"
            x={DB_POS.x}
            y={DB_POS.y}
            label="Database"
            status="active"
            variant="primary"
            delay={0.3}
          />
        )}
      </AnimatePresence>

      {/* Basic arrows: Client -> Server -> Database (before cache) */}
      <AnimatePresence>
        {(state === "client_server_db" || state === "slow_query") && (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Arrow
              fromX={CLIENT_POS.x + 50}
              fromY={CLIENT_POS.y}
              toX={SERVER_POS.x - 50}
              toY={SERVER_POS.y}
              color="#8b5cf6"
              delay={0.5}
              animated
            />
            <Arrow
              fromX={SERVER_POS.x + 50}
              fromY={SERVER_POS.y}
              toX={DB_POS.x - 50}
              toY={DB_POS.y}
              color="#3b82f6"
              delay={0.7}
              animated
            />
          </motion.g>
        )}
      </AnimatePresence>

      {/* Slow query latency labels */}
      <AnimatePresence>
        {state === "slow_query" && (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.0 }}
          >
            <FlowLabel
              x={500}
              y={210}
              text="200ms query"
              color="#ef4444"
              fontSize={12}
              background
            />
            <FlowLabel
              x={500}
              y={290}
              text="Same query, every time"
              color="#f59e0b"
              fontSize={11}
              background
            />
            {/* Repeated query packets */}
            {[0, 1, 2].map((i) => (
              <DataPacket
                key={`slow_${i}`}
                fromX={SERVER_POS.x + 50}
                fromY={SERVER_POS.y}
                toX={DB_POS.x - 50}
                toY={DB_POS.y}
                label="Q"
                formula="SELECT * ..."
                delay={i * 1.0 + 0.5}
                duration={0.8}
                color="#ef4444"
              />
            ))}
          </motion.g>
        )}
      </AnimatePresence>

      {/* Cache */}
      <AnimatePresence>
        {showCache(state) && (
          <Cache
            key="cache"
            x={CACHE_POS.x}
            y={CACHE_POS.y}
            label="Cache"
            status={getCacheStatus(state)}
            delay={0.3}
          />
        )}
      </AnimatePresence>

      {/* Arrows with cache in the flow */}
      <AnimatePresence>
        {showCache(state) && (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Client -> Server */}
            <Arrow
              fromX={CLIENT_POS.x + 50}
              fromY={CLIENT_POS.y}
              toX={SERVER_POS.x - 50}
              toY={SERVER_POS.y}
              color="#8b5cf6"
              delay={0.5}
            />
            {/* Server -> Cache */}
            <Arrow
              fromX={SERVER_POS.x + 50}
              fromY={SERVER_POS.y}
              toX={CACHE_POS.x - 44}
              toY={CACHE_POS.y}
              color="#f59e0b"
              delay={0.6}
              animated={state === "cache_hit" || state === "cache_miss"}
            />
            {/* Cache -> Database */}
            <Arrow
              fromX={CACHE_POS.x + 44}
              fromY={CACHE_POS.y}
              toX={DB_POS.x - 50}
              toY={DB_POS.y}
              color="#3b82f6"
              delay={0.7}
              animated={state === "cache_miss"}
              dashed={state === "cache_hit"}
            />
          </motion.g>
        )}
      </AnimatePresence>

      {/* Cache hit flow */}
      <AnimatePresence>
        {state === "cache_hit" && (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <FlowLabel
              x={CACHE_POS.x}
              y={CACHE_POS.y - 70}
              text="HIT! 2ms"
              color="#22c55e"
              fontSize={14}
              background
            />
            {/* Fast return packet */}
            <DataPacket
              fromX={CACHE_POS.x}
              fromY={CACHE_POS.y - 44}
              toX={SERVER_POS.x}
              toY={SERVER_POS.y - 35}
              label="R"
              formula="cached result"
              delay={0.8}
              duration={0.6}
              color="#22c55e"
            />
          </motion.g>
        )}
      </AnimatePresence>

      {/* Cache miss flow */}
      <AnimatePresence>
        {state === "cache_miss" && (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <FlowLabel
              x={CACHE_POS.x}
              y={CACHE_POS.y - 70}
              text="MISS"
              color="#ef4444"
              fontSize={14}
              background
            />
            {/* Miss: query goes to DB */}
            <DataPacket
              fromX={CACHE_POS.x + 44}
              fromY={CACHE_POS.y}
              toX={DB_POS.x - 50}
              toY={DB_POS.y}
              label="Q"
              formula="query DB"
              delay={0.8}
              duration={0.8}
              color="#ef4444"
            />
            {/* DB returns and stores in cache */}
            <DataPacket
              fromX={DB_POS.x - 50}
              fromY={DB_POS.y - 20}
              toX={CACHE_POS.x + 44}
              toY={CACHE_POS.y - 20}
              label="R"
              formula="store in cache"
              delay={2.0}
              duration={0.8}
              color="#06b6d4"
            />
          </motion.g>
        )}
      </AnimatePresence>

      {/* TTL expiry */}
      <AnimatePresence>
        {state === "ttl_expiry" && (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <FlowLabel
              x={CACHE_POS.x}
              y={CACHE_POS.y - 70}
              text="TTL expired"
              color="#ef4444"
              fontSize={13}
              background
            />
            {/* Timer countdown */}
            <motion.text
              x={CACHE_POS.x}
              y={CACHE_POS.y + 75}
              textAnchor="middle"
              fill="#f59e0b"
              fontSize={12}
              fontFamily="monospace"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 1, 0.3] }}
              transition={{ delay: 0.8, duration: 3, times: [0, 0.1, 0.7, 1] }}
            >
              TTL: 30s → 0s
            </motion.text>
            {/* Expired entry fading */}
            <motion.rect
              x={CACHE_POS.x - 30}
              y={CACHE_POS.y + 85}
              width={60}
              height={20}
              rx={4}
              fill="#450a0a"
              stroke="#ef4444"
              strokeWidth={1}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.8, 0] }}
              transition={{ delay: 1.5, duration: 2 }}
            />
            <motion.text
              x={CACHE_POS.x}
              y={CACHE_POS.y + 99}
              textAnchor="middle"
              fill="#fca5a5"
              fontSize={9}
              fontFamily="monospace"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.8, 0] }}
              transition={{ delay: 1.5, duration: 2 }}
            >
              EVICTED
            </motion.text>
          </motion.g>
        )}
      </AnimatePresence>

      {/* Cache-aside pattern */}
      <AnimatePresence>
        {state === "cache_aside" && (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <FlowLabel
              x={400}
              y={140}
              text="Cache-Aside Pattern"
              color="#60a5fa"
              fontSize={14}
              background
            />
            {/* Step labels */}
            {[
              { x: 420, y: 220, text: "1. Check cache", delay: 0.5 },
              { x: 600, y: 320, text: "2. Miss → query DB", delay: 1.5 },
              { x: 420, y: 330, text: "3. Store result", delay: 2.5 },
            ].map((step, i) => (
              <motion.text
                key={`aside_step_${i}`}
                x={step.x}
                y={step.y}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize={10}
                fontFamily="monospace"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: step.delay }}
              >
                {step.text}
              </motion.text>
            ))}
          </motion.g>
        )}
      </AnimatePresence>

      {/* Write-through pattern */}
      <AnimatePresence>
        {state === "write_through" && (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <FlowLabel
              x={400}
              y={140}
              text="Write-Through Pattern"
              color="#60a5fa"
              fontSize={14}
              background
            />
            {/* Dual write arrows */}
            <Arrow
              fromX={SERVER_POS.x + 50}
              fromY={SERVER_POS.y - 15}
              toX={CACHE_POS.x - 44}
              toY={CACHE_POS.y - 15}
              color="#f59e0b"
              label="write"
              delay={0.6}
              animated
            />
            <Arrow
              fromX={SERVER_POS.x + 50}
              fromY={SERVER_POS.y + 15}
              toX={DB_POS.x - 50}
              toY={DB_POS.y + 15}
              color="#22c55e"
              label="write"
              delay={0.8}
              animated
            />
            {/* Simultaneous write packets */}
            <DataPacket
              fromX={SERVER_POS.x + 50}
              fromY={SERVER_POS.y - 15}
              toX={CACHE_POS.x - 44}
              toY={CACHE_POS.y - 15}
              label="W"
              formula="to cache"
              delay={1.0}
              duration={0.8}
              color="#f59e0b"
            />
            <DataPacket
              fromX={SERVER_POS.x + 50}
              fromY={SERVER_POS.y + 15}
              toX={DB_POS.x - 50}
              toY={DB_POS.y + 15}
              label="W"
              formula="to DB"
              delay={1.0}
              duration={1.2}
              color="#22c55e"
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
    case "client_server_db":
      return "Basic Three-Tier Architecture";
    case "slow_query":
      return "Repeated Slow Queries";
    case "cache_appears":
      return "Adding a Cache Layer";
    case "cache_hit":
      return "Cache Hit - Lightning Fast!";
    case "cache_miss":
      return "Cache Miss - Fallback to DB";
    case "ttl_expiry":
      return "TTL Expiry";
    case "cache_aside":
      return "Cache-Aside (Lazy Loading)";
    case "write_through":
      return "Write-Through Pattern";
    default:
      return "";
  }
}
