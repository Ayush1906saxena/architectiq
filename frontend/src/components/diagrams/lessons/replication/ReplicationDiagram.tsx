"use client";

import { AnimatePresence, motion } from "framer-motion";
import DiagramContainer from "../../core/DiagramContainer";
import Database from "../../core/Database";
import Arrow from "../../core/Arrow";
import DataPacket from "../../core/DataPacket";
import FlowLabel from "../../core/FlowLabel";
import StatusIndicator from "../../core/StatusIndicator";

interface ReplicationDiagramProps {
  state: string;
  className?: string;
}

const LEADER = { x: 400, y: 130, label: "Leader" };

const FOLLOWERS = [
  { id: "follower_1", label: "Follower 1", x: 220, y: 370 },
  { id: "follower_2", label: "Follower 2", x: 580, y: 370 },
];

function showLeader(state: string): boolean {
  return ![
    "empty",
    "follower_promotion",
  ].includes(state);
}

function showFollowers(state: string): boolean {
  return [
    "followers_appear",
    "write_to_leader",
    "replication_flow",
    "replication_lag",
    "leader_crash",
    "follower_promotion",
  ].includes(state);
}

function getLeaderStatus(
  state: string
): "active" | "crashed" | "replicated" {
  if (state === "leader_crash") return "crashed";
  return "active";
}

function getFollowerStatus(
  followerId: string,
  state: string
): "active" | "crashed" | "replicated" {
  if (state === "replication_flow" || state === "replication_lag") {
    return "replicated";
  }
  return "active";
}

function getFollowerVariant(
  followerId: string,
  state: string
): "primary" | "replica" {
  // In follower_promotion, follower_1 becomes the new leader
  if (state === "follower_promotion" && followerId === "follower_1") {
    return "primary";
  }
  return "replica";
}

export default function ReplicationDiagram({
  state,
  className = "",
}: ReplicationDiagramProps) {
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

      {/* Single DB (before leader/follower distinction) */}
      <AnimatePresence>
        {state === "single_db" && (
          <Database
            key="single_db"
            x={400}
            y={250}
            label="Database"
            status="active"
            variant="primary"
            delay={0.3}
          />
        )}
      </AnimatePresence>

      {/* App write arrow to single DB */}
      <AnimatePresence>
        {state === "single_db" && (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Arrow
              fromX={200}
              fromY={180}
              toX={355}
              toY={240}
              color="#94a3b8"
              label="reads & writes"
              delay={0.5}
              animated
            />
          </motion.g>
        )}
      </AnimatePresence>

      {/* Leader DB */}
      <AnimatePresence>
        {showLeader(state) && (
          <Database
            key="leader"
            x={LEADER.x}
            y={LEADER.y}
            label={LEADER.label}
            status={getLeaderStatus(state)}
            variant="primary"
            delay={0.2}
          />
        )}
      </AnimatePresence>

      {/* Leader label badge */}
      <AnimatePresence>
        {state === "leader_appears" && (
          <motion.g
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            <rect
              x={355}
              y={75}
              width={90}
              height={24}
              rx={12}
              fill="#052e16"
              stroke="#22c55e"
              strokeWidth={1.5}
            />
            <text
              x={400}
              y={91}
              textAnchor="middle"
              fill="#22c55e"
              fontSize={11}
              fontFamily="monospace"
              fontWeight="bold"
            >
              PRIMARY
            </text>
          </motion.g>
        )}
      </AnimatePresence>

      {/* Followers */}
      <AnimatePresence>
        {showFollowers(state) &&
          FOLLOWERS.map((follower, i) => (
            <Database
              key={follower.id}
              x={follower.x}
              y={follower.y}
              label={
                state === "follower_promotion" &&
                follower.id === "follower_1"
                  ? "New Leader"
                  : follower.label
              }
              status={getFollowerStatus(follower.id, state)}
              variant={getFollowerVariant(follower.id, state)}
              delay={i * 0.4 + 0.3}
            />
          ))}
      </AnimatePresence>

      {/* Replication arrows (leader to followers) */}
      <AnimatePresence>
        {[
          "followers_appear",
          "write_to_leader",
          "replication_flow",
          "replication_lag",
        ].includes(state) &&
          FOLLOWERS.map((follower, i) => (
            <Arrow
              key={`rep_arrow_${follower.id}`}
              fromX={LEADER.x}
              fromY={LEADER.y + 45}
              toX={follower.x}
              toY={follower.y - 45}
              color="#06b6d4"
              delay={i * 0.3 + 0.6}
              animated={
                state === "replication_flow" || state === "replication_lag"
              }
              dashed
            />
          ))}
      </AnimatePresence>

      {/* Write packet to leader */}
      <AnimatePresence>
        {state === "write_to_leader" && (
          <DataPacket
            key="write_packet"
            fromX={150}
            fromY={80}
            toX={LEADER.x}
            toY={LEADER.y - 45}
            label="W"
            formula="INSERT INTO..."
            delay={0.3}
            duration={1.0}
            color="#22c55e"
          />
        )}
      </AnimatePresence>

      {/* WAL replication flow packets */}
      <AnimatePresence>
        {state === "replication_flow" &&
          FOLLOWERS.map((follower, i) => (
            <DataPacket
              key={`wal_${follower.id}`}
              fromX={LEADER.x}
              fromY={LEADER.y + 45}
              toX={follower.x}
              toY={follower.y - 55}
              label="WAL"
              formula="replication stream"
              delay={i * 0.8 + 0.5}
              duration={1.2}
              color="#06b6d4"
            />
          ))}
      </AnimatePresence>

      {/* Read arrows from followers */}
      <AnimatePresence>
        {state === "replication_flow" &&
          FOLLOWERS.map((follower, i) => (
            <motion.g
              key={`read_${follower.id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.4 + 1.5 }}
            >
              <Arrow
                fromX={follower.x + (follower.id === "follower_1" ? -60 : 60)}
                fromY={follower.y + 30}
                toX={follower.x + (follower.id === "follower_1" ? -10 : 10)}
                toY={follower.y + 10}
                color="#94a3b8"
                label="reads"
                delay={0}
              />
            </motion.g>
          ))}
      </AnimatePresence>

      {/* Replication lag indicator */}
      <AnimatePresence>
        {state === "replication_lag" && (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <FlowLabel
              x={580}
              y={310}
              text="lag: 200ms"
              color="#f59e0b"
              fontSize={13}
              background
            />
            <StatusIndicator
              x={640}
              y={370}
              status="degraded"
              label="STALE"
              delay={1.0}
            />
          </motion.g>
        )}
      </AnimatePresence>

      {/* Broken arrows on leader crash */}
      <AnimatePresence>
        {state === "leader_crash" &&
          FOLLOWERS.map((follower, i) => (
            <motion.g
              key={`broken_${follower.id}`}
              initial={{ opacity: 1 }}
              animate={{ opacity: 0.3 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              <Arrow
                fromX={LEADER.x}
                fromY={LEADER.y + 45}
                toX={follower.x}
                toY={follower.y - 45}
                color="#ef4444"
                delay={0}
                dashed
              />
            </motion.g>
          ))}
      </AnimatePresence>

      {/* Follower promotion */}
      <AnimatePresence>
        {state === "follower_promotion" && (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {/* Crown icon above new leader */}
            <motion.text
              x={220}
              y={290}
              textAnchor="middle"
              fill="#f59e0b"
              fontSize={24}
              initial={{ opacity: 0, y: 270 }}
              animate={{ opacity: 1, y: 290 }}
              transition={{ delay: 0.5, duration: 0.6, ease: "easeOut" }}
            >
              {"👑"}
            </motion.text>

            {/* New leader badge */}
            <motion.g
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8, duration: 0.4 }}
            >
              <rect
                x={175}
                y={310}
                width={90}
                height={24}
                rx={12}
                fill="#052e16"
                stroke="#22c55e"
                strokeWidth={1.5}
              />
              <text
                x={220}
                y={326}
                textAnchor="middle"
                fill="#22c55e"
                fontSize={11}
                fontFamily="monospace"
                fontWeight="bold"
              >
                PROMOTED
              </text>
            </motion.g>

            {/* New replication arrow from new leader to remaining follower */}
            <Arrow
              fromX={220}
              fromY={FOLLOWERS[0].y + 45}
              toX={580}
              toY={FOLLOWERS[1].y - 45}
              color="#06b6d4"
              animated
              dashed
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
    case "single_db":
      return "Single Database";
    case "leader_appears":
      return "Designating a Leader";
    case "followers_appear":
      return "Adding Followers";
    case "write_to_leader":
      return "Writes Go to Leader";
    case "replication_flow":
      return "Replication Stream";
    case "replication_lag":
      return "Replication Lag";
    case "leader_crash":
      return "Leader Crashes!";
    case "follower_promotion":
      return "Follower Promoted to Leader";
    default:
      return "";
  }
}
