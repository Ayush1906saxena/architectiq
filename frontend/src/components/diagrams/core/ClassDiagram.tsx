"use client";

import { motion } from "framer-motion";
import DiagramContainer from "./DiagramContainer";

interface ClassDef {
  name: string;
  x: number;
  y: number;
  attributes: string[];
  methods: string[];
  stereotype?: string;
}

interface Relationship {
  from: string;
  to: string;
  type: "extends" | "implements" | "has" | "uses";
  label?: string;
}

interface ClassDiagramProps {
  classes: ClassDef[];
  relationships: Relationship[];
  className?: string;
}

const CLASS_WIDTH = 160;
const LINE_HEIGHT = 16;

function getClassHeight(cls: ClassDef): number {
  return 30 + (cls.attributes.length + cls.methods.length + 1) * LINE_HEIGHT;
}

function getClassCenter(cls: ClassDef): { x: number; y: number } {
  return { x: cls.x + CLASS_WIDTH / 2, y: cls.y + getClassHeight(cls) / 2 };
}

export default function ClassDiagram({
  classes,
  relationships,
  className = "",
}: ClassDiagramProps) {
  const classMap = Object.fromEntries(classes.map((c) => [c.name, c]));

  return (
    <DiagramContainer className={className}>
      {/* Relationships */}
      {relationships.map((rel, i) => {
        const from = classMap[rel.from];
        const to = classMap[rel.to];
        if (!from || !to) return null;

        const fc = getClassCenter(from);
        const tc = getClassCenter(to);

        const strokeStyle =
          rel.type === "implements" ? "6 4" : rel.type === "uses" ? "4 2" : "none";

        return (
          <motion.g
            key={`rel_${i}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 + i * 0.2 }}
          >
            <line
              x1={fc.x}
              y1={fc.y}
              x2={tc.x}
              y2={tc.y}
              stroke="#64748b"
              strokeWidth={1.5}
              strokeDasharray={strokeStyle}
              markerEnd={
                rel.type === "extends"
                  ? "url(#triangle)"
                  : rel.type === "has"
                    ? "url(#diamond)"
                    : "url(#arrowhead)"
              }
            />
            {rel.label && (
              <text
                x={(fc.x + tc.x) / 2}
                y={(fc.y + tc.y) / 2 - 8}
                textAnchor="middle"
                fill="#64748b"
                fontSize={9}
                fontFamily="monospace"
              >
                {rel.label}
              </text>
            )}
          </motion.g>
        );
      })}

      {/* Classes */}
      {classes.map((cls, i) => {
        const height = getClassHeight(cls);
        const attrY = 32;
        const methodY = attrY + (cls.attributes.length + 0.5) * LINE_HEIGHT;

        return (
          <motion.g
            key={cls.name}
            initial={{ opacity: 0, y: cls.y - 10 }}
            animate={{ opacity: 1, y: cls.y }}
            transition={{ delay: i * 0.15, duration: 0.4 }}
          >
            {/* Box */}
            <rect
              x={cls.x}
              y={0}
              width={CLASS_WIDTH}
              height={height}
              rx={4}
              fill="#1e293b"
              stroke="#3b82f6"
              strokeWidth={1.5}
            />

            {/* Stereotype */}
            {cls.stereotype && (
              <text
                x={cls.x + CLASS_WIDTH / 2}
                y={12}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize={8}
                fontFamily="monospace"
              >
                &lt;&lt;{cls.stereotype}&gt;&gt;
              </text>
            )}

            {/* Name */}
            <text
              x={cls.x + CLASS_WIDTH / 2}
              y={cls.stereotype ? 24 : 18}
              textAnchor="middle"
              fill="#e2e8f0"
              fontSize={12}
              fontFamily="monospace"
              fontWeight="bold"
            >
              {cls.name}
            </text>

            {/* Divider */}
            <line
              x1={cls.x}
              y1={attrY - 2}
              x2={cls.x + CLASS_WIDTH}
              y2={attrY - 2}
              stroke="#3b82f6"
              strokeWidth={0.5}
            />

            {/* Attributes */}
            {cls.attributes.map((attr, j) => (
              <text
                key={`attr_${j}`}
                x={cls.x + 8}
                y={attrY + j * LINE_HEIGHT + 10}
                fill="#94a3b8"
                fontSize={9}
                fontFamily="monospace"
              >
                {attr}
              </text>
            ))}

            {/* Divider */}
            <line
              x1={cls.x}
              y1={methodY - 6}
              x2={cls.x + CLASS_WIDTH}
              y2={methodY - 6}
              stroke="#3b82f6"
              strokeWidth={0.5}
            />

            {/* Methods */}
            {cls.methods.map((method, j) => (
              <text
                key={`method_${j}`}
                x={cls.x + 8}
                y={methodY + j * LINE_HEIGHT + 6}
                fill="#60a5fa"
                fontSize={9}
                fontFamily="monospace"
              >
                {method}
              </text>
            ))}
          </motion.g>
        );
      })}

      {/* Marker definitions */}
      <defs>
        <marker id="triangle" markerWidth="12" markerHeight="8" refX="12" refY="4" orient="auto" fill="none" stroke="#64748b" strokeWidth="1.5">
          <polygon points="0 0, 12 4, 0 8" />
        </marker>
        <marker id="diamond" markerWidth="12" markerHeight="8" refX="12" refY="4" orient="auto" fill="#64748b">
          <polygon points="0 4, 6 0, 12 4, 6 8" />
        </marker>
      </defs>
    </DiagramContainer>
  );
}
