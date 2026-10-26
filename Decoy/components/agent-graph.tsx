"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Boxes, GitBranch, Server, ShieldAlert, X } from "lucide-react";
import type { GraphLink, GraphNode } from "@/lib/store";

interface Positioned extends GraphNode {
  x: number;
  y: number;
  /** Crowded neighbours flip their label above the node so text never overlaps. */
  labelAbove: boolean;
}

const WIDTH = 860;
const HEIGHT = 640;

function layout(nodes: GraphNode[], links: GraphLink[]): Positioned[] {
  const positions: Positioned[] = nodes.map((node, index) => {
    const angle = (index / Math.max(nodes.length, 1)) * Math.PI * 2;
    const radius = node.kind === "agent" ? 150 : node.kind === "tool" ? 280 : 330;
    return {
      ...node,
      x: WIDTH / 2 + Math.cos(angle) * radius,
      y: HEIGHT / 2 + Math.sin(angle) * radius,
      labelAbove: false,
    };
  });
  const indexOf = new Map(positions.map((node, index) => [node.id, index]));

  for (let iteration = 0; iteration < 240; iteration++) {
    // Repulsion between every pair.
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        let dx = positions[i].x - positions[j].x;
        let dy = positions[i].y - positions[j].y;
        let distance = Math.hypot(dx, dy);
        if (distance < 1) {
          dx = (i % 3) - 1 || 0.5;
          dy = (j % 3) - 1 || 0.5;
          distance = 1.4;
        }
        const repulsion = 6400 / (distance * distance);
        const fx = (dx / distance) * repulsion;
        const fy = (dy / distance) * repulsion;
        positions[i].x += fx;
        positions[i].y += fy;
        positions[j].x -= fx;
        positions[j].y -= fy;
      }
    }
    // Spring attraction along edges.
    for (const link of links) {
      const a = positions[indexOf.get(link.source) ?? -1];
      const b = positions[indexOf.get(link.target) ?? -1];
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const desired = a.kind === "agent" && b.kind === "agent" ? 165 : 185;
      const force = (distance - desired) * 0.022;
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;
      a.x += fx;
      a.y += fy;
      b.x -= fx;
      b.y -= fy;
    }
    // Center gravity and bounds.
    for (const node of positions) {
      node.x += (WIDTH / 2 - node.x) * 0.006;
      node.y += (HEIGHT / 2 - node.y) * 0.006;
      node.x = Math.max(58, Math.min(WIDTH - 58, node.x));
      node.y = Math.max(50, Math.min(HEIGHT - 54, node.y));
    }
  }
  // Labels are drawn under their node, so two agents side by side at the same
  // height print on top of each other. One pass, top to bottom: anything
  // sharing a label line with an already-placed neighbour flips above itself.
  const byHeight = [...positions].sort((a, b) => a.y - b.y || a.x - b.x);
  for (let i = 0; i < byHeight.length; i++) {
    for (let j = 0; j < i; j++) {
      const above = byHeight[j];
      if (above.labelAbove) continue;
      if (
        Math.abs(above.x - byHeight[i].x) < 96 &&
        Math.abs(above.y - byHeight[i].y) < 26
      ) {
        byHeight[i].labelAbove = true;
        break;
      }
    }
  }
  return positions;
}

export function AgentGraph({
  nodes,
  links,
  focusId,
}: {
  nodes: GraphNode[];
  links: GraphLink[];
  focusId?: string;
}) {
  const [selected, setSelected] = useState<string | null>(focusId ?? null);
  // Agent names stay on by default; tool labels are the noise floor, so they
  // only appear with the toggle, or for the node you are inspecting.
  const [allLabels, setAllLabels] = useState(false);
  const positioned = useMemo(() => layout(nodes, links), [nodes, links]);
  const byId = new Map(positioned.map((node) => [node.id, node]));

  const neighbours = useMemo(() => {
    if (!selected) return new Set<string>();
    const set = new Set<string>([selected]);
    for (const link of links) {
      if (link.source === selected) set.add(link.target);
      if (link.target === selected) set.add(link.source);
    }
    return set;
  }, [links, selected]);

  const active = selected ? byId.get(selected) : undefined;
  const connections = active
    ? links.filter((link) => link.source === active.id || link.target === active.id)
    : [];

  const colorFor = (node: GraphNode) => {
    if (node.kind === "external") return "var(--red)";
    if (node.kind === "tool") return "var(--muted)";
    if (node.status === "quarantined" || node.status === "isolated") return "var(--red)";
    if (node.risk >= 60) return "var(--red)";
    if (node.risk >= 25) return "var(--orange)";
    return "var(--lime)";
  };
  const radiusFor = (node: GraphNode) =>
    node.kind === "agent" ? 11 + Math.min(node.risk, 90) * 0.09 : node.kind === "tool" ? 7 : 8;

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_230px]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 px-1 pb-2.5">
          <span className="chip">{nodes.filter((node) => node.kind === "agent").length} agents</span>
          <span className="chip">{nodes.filter((node) => node.kind === "tool").length} tools</span>
          <span className="chip">{links.length} edges</span>
          <div className="ml-auto flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
            <span className="inline-flex items-center gap-1.5 text-[9.5px] text-[var(--muted-dim)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--lime)]" /> healthy
            </span>
            <span className="inline-flex items-center gap-1.5 text-[9.5px] text-[var(--muted-dim)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--orange)]" /> drift
            </span>
            <span className="inline-flex items-center gap-1.5 text-[9.5px] text-[var(--muted-dim)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--red)]" /> contained
            </span>
            <span className="inline-flex items-center gap-1.5 text-[9.5px] text-[var(--muted-dim)]">
              <Boxes size={10} aria-hidden /> tool
            </span>
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-[9.5px] text-[var(--muted)]">
              <input
                type="checkbox"
                checked={allLabels}
                onChange={(event) => setAllLabels(event.target.checked)}
                className="h-3 w-3 accent-[var(--lime)]"
              />
              all labels
            </label>
          </div>
        </div>
      <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] graph-field">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          width="100%"
          role="img"
          aria-label="Agent-to-agent, agent-to-tool and egress call graph"
          className="block"
        >
          <defs>
            <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0 L8 4 L0 8 z" fill="var(--muted-dim)" />
            </marker>
          </defs>
          {links.map((link, index) => {
            const a = byId.get(link.source);
            const b = byId.get(link.target);
            if (!a || !b) return null;
            const dimmed = selected ? !(neighbours.has(link.source) && neighbours.has(link.target)) : false;
            const isDelegation = link.kind === "delegation";
            const external = link.kind === "egress";
            return (
              <line
                key={`${link.source}-${link.target}-${index}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={external ? "var(--red)" : isDelegation ? "var(--orange)" : "var(--line-strong)"}
                strokeWidth={Math.min(3.2, 0.7 + Math.log1p(link.value) * 0.7)}
                strokeDasharray={isDelegation ? "4 4" : undefined}
                markerEnd="url(#arrow)"
                opacity={dimmed ? 0.16 : external ? 0.55 : 0.45}
              />
            );
          })}
          {positioned.map((node) => {
            const dimmed = selected ? !neighbours.has(node.id) : false;
            const isActive = selected === node.id;
            const showLabel = isActive || node.kind === "agent" || allLabels;
            const color = colorFor(node);
            return (
              <g
                key={node.id}
                transform={`translate(${node.x},${node.y})`}
                onClick={() => setSelected(node.id)}
                style={{ cursor: "pointer" }}
                opacity={dimmed ? 0.45 : 1}
                tabIndex={0}
                role="button"
                aria-label={`${node.name}, ${node.kind}, risk ${node.risk}`}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") setSelected(node.id);
                }}
              >
                {isActive ? <circle r={radiusFor(node) + 8} fill="none" stroke={color} strokeOpacity="0.45" /> : null}
                {node.kind === "tool" ? (
                  <rect
                    x={-6}
                    y={-6}
                    width={12}
                    height={12}
                    rx={3}
                    fill={color}
                    fillOpacity={dimmed ? 0.4 : 0.85}
                    stroke="var(--panel)"
                    strokeWidth="1.4"
                  />
                ) : (
                  <circle
                    r={radiusFor(node)}
                    fill={node.kind === "external" ? "var(--red-soft)" : "var(--panel-hi)"}
                    stroke={color}
                    strokeWidth={isActive ? 2.2 : 1.5}
                  />
                )}
                {node.kind === "agent" ? (
                  <circle r={radiusFor(node) * 0.42} fill={color} opacity="0.9" />
                ) : null}
                {showLabel ? (
                  <text
                    y={(node.labelAbove ? -1 : 1) * (radiusFor(node) + (node.kind === "agent" ? 15 : 13))}
                    textAnchor="middle"
                    fontSize={node.kind === "agent" ? 11 : 9.5}
                    fill={isActive ? "var(--text)" : node.kind === "agent" ? "var(--text-soft)" : "var(--muted)"}
                    style={{
                      paintOrder: "stroke",
                      stroke: "var(--panel-soft)",
                      strokeWidth: 3.5,
                      strokeLinejoin: "round",
                      fontWeight: node.kind === "agent" ? 600 : 500,
                      letterSpacing: "0.005em",
                    }}
                  >
                    {node.name.length > 30 ? `${node.name.slice(0, 28)}…` : node.name}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
      </div>

      <aside className="flex min-w-0 flex-col self-start rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] p-3.5 xl:sticky xl:top-4">
        {active ? (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="eyebrow">{active.kind}</p>
                <p className="mt-1.5 text-[13px] font-semibold leading-tight" title={active.name}>
                  {active.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="icon-btn h-6 w-6 shrink-0"
                aria-label="Clear selection"
              >
                <X size={11} aria-hidden />
              </button>
            </div>

            <div className="mt-3 flex items-end gap-3 border-y border-[var(--line)] py-2.5">
              <span
                className="kpi-num !text-[30px]"
                style={{ color: active.risk >= 60 ? "var(--red)" : active.risk >= 25 ? "var(--orange)" : "var(--lime)" }}
              >
                {active.risk}
              </span>
              <span className="pb-1 text-[9.5px] leading-tight text-[var(--muted-dim)]">
                risk score
                <br />status {active.status}
              </span>
              <span className="ml-auto pb-1 text-right text-[9.5px] text-[var(--muted-dim)]">
                {connections.length}
                <br />edges
              </span>
            </div>

            <p className="eyebrow mt-3 !text-[9px]">Traces</p>
            <ul className="mt-1.5 space-y-1">
              {connections.slice(0, 5).map((link) => {
                const otherId = link.source === active.id ? link.target : link.source;
                const other = byId.get(otherId);
                return (
                  <li key={`${link.source}-${link.target}`} className="flex items-center gap-1.5 text-[10px] text-[var(--muted)]">
                    {link.kind === "delegation" ? <GitBranch size={10} className="shrink-0 text-[var(--orange)]" aria-hidden /> : link.kind === "tool" ? <Server size={10} className="shrink-0" aria-hidden /> : <ShieldAlert size={10} className="shrink-0 text-[var(--red)]" aria-hidden />}
                    <span className="truncate">{other?.name ?? otherId}</span>
                  </li>
                );
              })}
              {connections.length > 5 ? (
                <li className="text-[10px] text-[var(--muted-dim)]">+{connections.length - 5} more</li>
              ) : null}
            </ul>

            {active.kind === "agent" ? (
              <Link
                href={`/agents/${active.id}`}
                className="mt-auto inline-flex items-center gap-1 pt-3 text-[10.5px] font-medium text-[var(--lime)]"
              >
                Open agent <ArrowRight size={11} aria-hidden />
              </Link>
            ) : null}
          </>
        ) : (
          <div className="my-auto">
            <p className="eyebrow">Nothing selected</p>
            <p className="mt-2 text-[10.5px] leading-relaxed text-[var(--muted)]">
              Select a node to trace what it reaches — delegation, tool calls and egress in one
              place.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
