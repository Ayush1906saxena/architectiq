"use client";

import React, { Suspense, lazy, ComponentType } from "react";
import DiagramContainer from "./core/DiagramContainer";

interface DiagramProps {
  state: string;
}

// Lazy-loaded diagram components for code splitting
const diagramRegistry: Record<string, React.LazyExoticComponent<ComponentType<DiagramProps>>> = {
  "consistent-hashing": lazy(
    () => import("./lessons/consistent-hashing/ModHashingDiagram")
  ),
  "load-balancing": lazy(
    () => import("./lessons/load-balancing/LoadBalancingDiagram")
  ),
  "replication": lazy(
    () => import("./lessons/replication/ReplicationDiagram")
  ),
  "caching": lazy(
    () => import("./lessons/caching/CachingDiagram")
  ),
  "cap-theorem": lazy(
    () => import("./lessons/cap-theorem/CAPTheoremDiagram")
  ),
  "networking": lazy(
    () => import("./lessons/networking/NetworkingDiagram")
  ),
  "message-queues": lazy(
    () => import("./lessons/message-queues/MessageQueueDiagram")
  ),
  "url-shortener": lazy(
    () => import("./lessons/url-shortener/URLShortenerDiagram")
  ),
};

// Fallback diagram displayed when no custom diagram exists for a topic
function FallbackDiagram({ state }: DiagramProps) {
  return (
    <DiagramContainer>
      <rect
        x={200}
        y={150}
        width={400}
        height={200}
        rx={16}
        fill="#1e293b"
        stroke="#334155"
        strokeWidth={2}
      />
      <text
        x={400}
        y={230}
        textAnchor="middle"
        fill="#64748b"
        fontSize={16}
        fontFamily="monospace"
      >
        Diagram
      </text>
      <text
        x={400}
        y={260}
        textAnchor="middle"
        fill="#475569"
        fontSize={12}
        fontFamily="monospace"
      >
        State: {state || "idle"}
      </text>
      <text
        x={400}
        y={290}
        textAnchor="middle"
        fill="#334155"
        fontSize={11}
        fontFamily="monospace"
      >
        Custom diagram coming soon
      </text>
    </DiagramContainer>
  );
}

// Loading placeholder shown while lazy components load
function DiagramLoading() {
  return (
    <DiagramContainer>
      <text
        x={400}
        y={250}
        textAnchor="middle"
        fill="#475569"
        fontSize={14}
        fontFamily="monospace"
      >
        Loading diagram...
      </text>
    </DiagramContainer>
  );
}

interface DiagramForTopicProps {
  topicId: string;
  state: string;
  className?: string;
}

export default function DiagramForTopic({
  topicId,
  state,
  className,
}: DiagramForTopicProps) {
  const LazyDiagram = diagramRegistry[topicId];

  if (!LazyDiagram) {
    return <FallbackDiagram state={state} />;
  }

  return (
    <Suspense fallback={<DiagramLoading />}>
      <LazyDiagram state={state} />
    </Suspense>
  );
}
