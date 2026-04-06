"use client";

interface MasteryBadgeProps {
  badge: string;
  size?: "sm" | "md" | "lg";
}

const BADGE_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  none: { color: "text-gray-600", bg: "bg-gray-800", label: "—" },
  bronze: { color: "text-amber-600", bg: "bg-amber-900/20", label: "Bronze" },
  silver: { color: "text-gray-300", bg: "bg-gray-600/20", label: "Silver" },
  gold: { color: "text-yellow-400", bg: "bg-yellow-900/20", label: "Gold" },
  diamond: { color: "text-cyan-300", bg: "bg-cyan-900/20", label: "Diamond" },
};

const SIZES = {
  sm: "text-[10px] px-1.5 py-0.5",
  md: "text-xs px-2 py-1",
  lg: "text-sm px-3 py-1.5",
};

export default function MasteryBadge({ badge, size = "md" }: MasteryBadgeProps) {
  const config = BADGE_CONFIG[badge] || BADGE_CONFIG.none;
  if (badge === "none") return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium font-mono ${config.color} ${config.bg} ${SIZES[size]}`}
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-current" />
      {config.label}
    </span>
  );
}
