"use client";

import DiagramContainer from "./DiagramContainer";
import Server from "./Server";
import Database from "./Database";
import Cache from "./Cache";
import LoadBalancer from "./LoadBalancer";
import Client from "./Client";
import Queue from "./Queue";
import Arrow from "./Arrow";

interface DiagramNode {
  id: string;
  type: "server" | "db" | "cache" | "lb" | "client" | "queue";
  x: number;
  y: number;
  label: string;
  status?: string;
}

interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
  animated?: boolean;
  color?: string;
}

interface ArchitectureDiagramConfig {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

interface ArchitectureDiagramProps {
  config: ArchitectureDiagramConfig;
  className?: string;
}

export default function ArchitectureDiagram({
  config,
  className,
}: ArchitectureDiagramProps) {
  const nodeMap = new Map<string, DiagramNode>();
  config.nodes.forEach((node) => nodeMap.set(node.id, node));

  function renderNode(node: DiagramNode, index: number) {
    const delay = index * 0.15;

    switch (node.type) {
      case "server":
        return (
          <Server
            key={node.id}
            x={node.x}
            y={node.y}
            label={node.label}
            status={node.status as "active" | "crashed" | "highlighted" | undefined}
            delay={delay}
          />
        );
      case "db":
        return (
          <Database
            key={node.id}
            x={node.x}
            y={node.y}
            label={node.label}
            status={node.status as "active" | "crashed" | "replicated" | undefined}
            delay={delay}
          />
        );
      case "cache":
        return (
          <Cache
            key={node.id}
            x={node.x}
            y={node.y}
            label={node.label}
            status={node.status as "idle" | "hit" | "miss" | undefined}
            delay={delay}
          />
        );
      case "lb":
        return (
          <LoadBalancer
            key={node.id}
            x={node.x}
            y={node.y}
            label={node.label}
            status={node.status as "active" | "idle" | "highlighted" | undefined}
            delay={delay}
          />
        );
      case "client":
        return (
          <Client
            key={node.id}
            x={node.x}
            y={node.y}
            label={node.label}
            status={node.status as "active" | "idle" | "highlighted" | undefined}
            delay={delay}
          />
        );
      case "queue":
        return (
          <Queue
            key={node.id}
            x={node.x}
            y={node.y}
            label={node.label}
            delay={delay}
          />
        );
      default:
        return null;
    }
  }

  function renderEdge(edge: DiagramEdge, index: number) {
    const fromNode = nodeMap.get(edge.from);
    const toNode = nodeMap.get(edge.to);
    if (!fromNode || !toNode) return null;

    return (
      <Arrow
        key={`${edge.from}-${edge.to}-${index}`}
        fromX={fromNode.x}
        fromY={fromNode.y}
        toX={toNode.x}
        toY={toNode.y}
        label={edge.label}
        animated={edge.animated}
        color={edge.color}
        delay={config.nodes.length * 0.15 + index * 0.1}
      />
    );
  }

  return (
    <DiagramContainer className={className}>
      {/* Render edges first (behind nodes) */}
      {config.edges.map((edge, i) => renderEdge(edge, i))}
      {/* Render nodes on top */}
      {config.nodes.map((node, i) => renderNode(node, i))}
    </DiagramContainer>
  );
}
