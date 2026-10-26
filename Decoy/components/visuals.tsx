import type { BlastRadiusNode, Canary, TaintPath } from "@/lib/types";
import { formatTime } from "@/lib/format";
import { FileWarning, KeyRound, Radio, ShieldAlert } from "lucide-react";

/* -------------------------------------------------------------- taint thread */

export function TaintThread({ path, compact = false }: { path: TaintPath; compact?: boolean }) {
  const nodes = path.nodes.slice(0, 6);
  // Node labels are centered on the node, so the first and last need ~70px of
  // side padding or their labels get clipped by the SVG viewport.
  const width = Math.max(340, 180 + (nodes.length - 1) * 160);
  const height = compact ? 132 : 168;
  const lane = (index: number) => (index % 2 === 0 ? 44 : 78);
  const points = nodes.map((_, index) => {
    const x = 90 + index * 160;
    return [x, lane(index)] as [number, number];
  }).map(([x, y]) => [x, y] as [number, number]);
  const clip = (value: string, max = 24) =>
    value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
  const pathD = points
    .map(([x, y], index) => {
      if (index === 0) return `M${x} ${y}`;
      const [px, py] = points[index - 1];
      return `C${px + 55} ${py}, ${x - 55} ${y}, ${x} ${y}`;
    })
    .join(" ");

  return (
    <div className="scroll-x">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        role="img"
        aria-label={`Taint path from ${path.sourceName} to ${nodes.filter((node) => node.suspicious).length} suspicious actions`}
      >
        <defs>
          <linearGradient id="taint-thread" x1="0" x2="1">
            <stop offset="0%" stopColor="var(--orange)" />
            <stop offset="100%" stopColor="var(--red)" />
          </linearGradient>
        </defs>
        <path d={pathD} fill="none" stroke="url(#taint-thread)" strokeWidth="1.6" strokeDasharray="4 5" opacity="0.85" />
        {nodes.map((node, index) => {
          const [x, y] = points[index];
          const suspicious = Boolean(node.suspicious);
          const source = node.kind === "source";
          const color = source ? "var(--orange)" : suspicious ? "var(--red)" : "var(--muted)";
          return (
            <g key={node.id}>
              <circle cx={x} cy={y} r={source ? 13 : 9} fill="var(--panel)" stroke={color} strokeWidth="1.4" />
              <circle cx={x} cy={y} r={source ? 4 : 2.5} fill={color} />
              <text
                x={x}
                y={y - 20}
                textAnchor="middle"
                fontSize="8"
                fill={color}
                style={{ textTransform: "uppercase", letterSpacing: "0.07em" }}
              >
                {source ? "untrusted source" : suspicious ? "out of role" : node.kind}
              </text>
              <text
                x={x}
                y={height - 30}
                textAnchor="middle"
                fontSize="9.5"
                fill={suspicious ? "var(--orange)" : "var(--text-soft)"}
              >
                <title>{node.label}</title>
                {clip(node.label)}
              </text>
              <text x={x} y={height - 15} textAnchor="middle" fontSize="8" fill="var(--muted-dim)">
                {formatTime(node.ts)} UTC
              </text>
            </g>
          );
        })}
      </svg>
      <p className="px-1 text-[10.5px] text-[var(--muted)]">
        <span className="text-[var(--orange)]">{path.sourceName}</span> → {path.steps} steps →{" "}
        {nodes.filter((node) => node.suspicious).length} out-of-scope action
        {nodes.filter((node) => node.suspicious).length === 1 ? "" : "s"}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- blast radius */

export function BlastRadiusMap({ nodes }: { nodes: BlastRadiusNode[] }) {
  const center = 150;
  const rings = Math.max(1, ...nodes.map((node) => node.depth)) || 1;
  const positions = new Map<string, [number, number]>();
  nodes.forEach((node, index) => {
    if (node.depth === 0) {
      positions.set(node.agentId, [center, center]);
      return;
    }
    const ring = Math.min(node.depth, 3);
    const siblings = nodes.filter((candidate) => Math.min(candidate.depth, 3) === ring);
    const siblingIndex = siblings.findIndex((candidate) => candidate.agentId === node.agentId);
    const angle = (siblingIndex / Math.max(siblings.length, 1)) * Math.PI * 2 + ring * 0.5 + index * 0.15;
    const radius = 46 + ring * 42;
    positions.set(node.agentId, [center + Math.cos(angle) * radius, center + Math.sin(angle) * radius]);
  });
  const color = (node: BlastRadiusNode) =>
    node.status === "isolated" || node.status === "quarantined"
      ? "var(--red)"
      : node.status === "degraded"
        ? "var(--orange)"
        : "var(--lime)";
  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        viewBox="0 0 300 300"
        width="100%"
        height={244}
        role="img"
        aria-label={`Blast radius: ${nodes.length} agents across ${rings} hops`}
      >
        {Array.from({ length: Math.min(rings, 3) }).map((_, index) => {
          const ringRadius = 46 + (index + 1) * 42;
          return (
            <g key={index}>
              <circle
                cx={center}
                cy={center}
                r={ringRadius}
                fill="none"
                stroke="var(--line)"
                strokeDasharray="2 6"
              />
              <text
                x={center}
                y={center - ringRadius - 5}
                textAnchor="middle"
                fontSize="7.5"
                fill="var(--muted-dim)"
                style={{ letterSpacing: "0.06em" }}
              >
                {index + 1} hop{index === 0 ? "" : "s"}
              </text>
            </g>
          );
        })}
        {nodes.map((node) => {
          const position = positions.get(node.agentId);
          if (!position || node.depth === 0) return null;
          const [x, y] = position;
          const [cx, cy] = positions.get(nodes[0].agentId) ?? [center, center];
          return (
            <line
              key={`line-${node.agentId}`}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="var(--line-strong)"
              strokeWidth={1}
            />
          );
        })}
        {nodes.map((node) => {
          const position = positions.get(node.agentId);
          if (!position) return null;
          const [x, y] = position;
          const radius = 8 + Math.min(node.sensitivity, 5) * 2.4;
          return (
            <g key={node.agentId}>
              <circle
                cx={x}
                cy={y}
                r={radius}
                fill={color(node)}
                fillOpacity={node.depth === 0 ? 0.9 : 0.25}
                stroke={color(node)}
                strokeWidth="1.4"
              />
              <text
                x={x}
                y={y + radius + 12}
                textAnchor="middle"
                fontSize="9"
                fill={node.depth === 0 ? "var(--text)" : "var(--text-soft)"}
                style={{
                  paintOrder: "stroke",
                  stroke: "var(--panel-soft)",
                  strokeWidth: 3,
                  strokeLinejoin: "round",
                  fontWeight: node.depth === 0 ? 600 : 500,
                }}
              >
                {node.depth === 0 ? node.name : node.name.split(" ").slice(-1)[0]}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[9.5px] text-[var(--muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[var(--lime)]" /> healthy
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[var(--orange)]" /> degraded
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[var(--red)]" /> contained
        </span>
        <span className="w-full text-center text-[9px] text-[var(--muted-dim)]">
          size = data sensitivity
        </span>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- destination map */

export interface DestinationEntry {
  destination: string;
  bytes: number;
  allowed: boolean;
  hits: number;
}

export function DestinationMap({ entries }: { entries: DestinationEntry[] }) {
  const width = 320;
  const height = 240;
  const center: [number, number] = [width / 2, height / 2];
  const maxBytes = Math.max(1, ...entries.map((entry) => entry.bytes));
  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label="Outbound destination map: allowed versus unapproved egress"
      >
        <circle cx={center[0]} cy={center[1]} r="20" fill="var(--panel-hi)" stroke="var(--line-strong)" />
        <text x={center[0]} y={center[1] + 3} textAnchor="middle" fontSize="8" fill="var(--text)" style={{ textTransform: "uppercase" }}>
          agent
        </text>
        <circle cx={center[0]} cy={center[1]} r="56" fill="none" stroke="var(--lime)" strokeOpacity="0.2" strokeDasharray="3 5" />
        <circle cx={center[0]} cy={center[1]} r="92" fill="none" stroke="var(--orange)" strokeOpacity="0.35" strokeDasharray="3 5" />
        {entries.slice(0, 10).map((entry, index) => {
          const angle = (index / Math.max(entries.slice(0, 10).length, 1)) * Math.PI * 2 - Math.PI / 2;
          const radius = entry.allowed ? 56 : 92;
          const x = center[0] + Math.cos(angle) * radius;
          const y = center[1] + Math.sin(angle) * radius;
          const weight = 1 + (entry.bytes / maxBytes) * 4;
          const color = entry.allowed ? "var(--lime)" : "var(--red)";
          const anchor = Math.cos(angle) > 0.3 ? "start" : Math.cos(angle) < -0.3 ? "end" : "middle";
          return (
            <g key={entry.destination}>
              <line x1={center[0]} y1={center[1]} x2={x} y2={y} stroke={color} strokeWidth={weight} strokeOpacity="0.5" />
              <circle cx={x} cy={y} r={3.4} fill={color}>
                <title>{`${entry.destination} · ${(entry.bytes / 1024).toFixed(0)} KiB · ${entry.hits} calls`}</title>
              </circle>
              <text
                x={x + (Math.cos(angle) > 0.3 ? 7 : Math.cos(angle) < -0.3 ? -7 : 0)}
                y={y + (Math.abs(Math.cos(angle)) < 0.3 ? (Math.sin(angle) > 0 ? 12 : -7) : 3)}
                textAnchor={anchor}
                fontSize="7.4"
                fill={entry.allowed ? "var(--muted)" : "var(--orange)"}
              >
                {entry.destination.length > 24 ? `${entry.destination.slice(0, 22)}…` : entry.destination}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex items-center gap-3 text-[10px] text-[var(--muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[var(--lime)]" /> allowlisted
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[var(--red)]" /> unapproved
        </span>
        <span className="ml-auto text-[var(--muted-dim)]">thickness = volume</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- canary map */

export function CanaryMap({ canaries }: { canaries: Canary[] }) {
  const icon = {
    file: FileWarning,
    endpoint: Radio,
    token: KeyRound,
  };
  const hitCount = canaries.reduce((total, canary) => total + canary.hits.length, 0);
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="eyebrow">Decoy resources</span>
        <span className={`chip ${hitCount ? "chip-red" : "chip-lime"}`}>
          <ShieldAlert size={11} aria-hidden />
          {hitCount} hit{hitCount === 1 ? "" : "s"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {canaries.map((canary) => {
          const Icon = icon[canary.kind];
          const hit = canary.hits.length > 0;
          return (
            <div
              key={canary.id}
              className="rounded-2xl border p-3"
              style={{
                borderColor: hit ? "color-mix(in srgb, var(--red) 45%, transparent)" : "var(--line)",
                background: hit ? "var(--red-soft)" : "var(--panel-soft)",
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <Icon size={14} color={hit ? "var(--red)" : "var(--muted)"} aria-hidden />
                <span className={`h-1.5 w-1.5 rounded-full ${hit ? "bg-[var(--red)]" : "bg-[var(--lime)]"}`} />
              </div>
              <p className="mt-2 truncate text-[10.5px] font-medium" title={canary.name}>
                {canary.name}
              </p>
              <p className="mt-0.5 truncate text-[9px] text-[var(--muted-dim)]">{canary.location}</p>
              <p className="mt-1 text-[9px] uppercase tracking-wide" style={{ color: hit ? "var(--red)" : "var(--muted)" }}>
                {hit ? "touched" : "armed"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
