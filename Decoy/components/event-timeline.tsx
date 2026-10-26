"use client";

import { useEffect, useRef } from "react";
import {
  ArrowUpRight,
  Database,
  FileText,
  GitBranch,
  Globe2,
  Play,
  ScanSearch,
  TerminalSquare,
  UserRound,
} from "lucide-react";
import type { AgentEvent } from "@/lib/types";
import { formatDateTime } from "@/lib/format";

const ICONS: Record<string, typeof Database> = {
  "session.start": Play,
  "session.end": Play,
  prompt: UserRound,
  "content.read": FileText,
  "tool.call": TerminalSquare,
  "data.access": Database,
  "network.egress": Globe2,
  delegation: GitBranch,
  "policy.decision": ScanSearch,
};

export function EventTimeline({
  events,
  dense = false,
  highlightId,
}: {
  events: AgentEvent[];
  dense?: boolean;
  /** Brings this event into view and marks it — used to follow a globe selection. */
  highlightId?: string | null;
}) {
  const rows = useRef(new Map<string, HTMLLIElement>());

  useEffect(() => {
    if (!highlightId) return;
    rows.current.get(highlightId)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlightId]);

  if (events.length === 0) {
    return <p className="px-4 py-8 text-center text-[11px] text-[var(--muted)]">No events in this window.</p>;
  }
  return (
    <ol className={`relative ${dense ? "space-y-0" : "space-y-1"} before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-px before:bg-[var(--line)]`}>
      {events.map((event) => {
        const Icon = ICONS[event.type] ?? ScanSearch;
        const suspicious =
          event.canary ||
          event.trust === "untrusted" ||
          event.label === "attack" ||
          event.tool === "dataset.export";
        const highlighted = event.id === highlightId;
        return (
          <li
            key={event.id}
            ref={(node) => {
              if (node) rows.current.set(event.id, node);
              else rows.current.delete(event.id);
            }}
            className={`relative flex gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-[var(--panel-soft)] ${
              highlighted ? "bg-[var(--lime-soft)] ring-1 ring-[color-mix(in_srgb,var(--lime)_45%,transparent)]" : ""
            }`}
          >
            <span
              className="relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border"
              style={{
                borderColor: suspicious ? "color-mix(in srgb, var(--red) 50%, transparent)" : "var(--line)",
                background: suspicious ? "var(--red-soft)" : "var(--panel-soft)",
                color: suspicious ? "var(--red)" : "var(--muted)",
              }}
            >
              <Icon size={12} aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span className="text-[11px] text-[var(--muted-dim)]">
                  {formatDateTime(event.ts)} UTC
                </span>
                <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--muted-dim)]">
                  {event.type.replace(".", " ")}
                </span>
                {event.canary ? (
                  <span className="chip chip-red !px-2 !py-0.5 !text-[9.5px]">canary</span>
                ) : null}
                {event.trust === "untrusted" ? (
                  <span className="chip chip-orange !px-2 !py-0.5 !text-[9.5px]">untrusted</span>
                ) : null}
                {event.label === "attack" ? (
                  <span className="chip chip-red !px-2 !py-0.5 !text-[9.5px]">adversarial</span>
                ) : null}
              </div>
              <p className={`mt-1 leading-snug ${dense ? "text-[11.5px]" : "text-[12.5px]"} ${suspicious ? "text-[var(--orange)]" : "text-[var(--text-soft)]"}`}>
                {event.summary}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] text-[var(--muted-dim)]">
                {event.tool ? <span>tool: {event.tool}</span> : null}
                {event.dataClass ? <span>data: {event.dataClass}</span> : null}
                {event.destination ? <span>dest: {event.destination}</span> : null}
                {event.bytes ? <span>{(event.bytes / 1024).toFixed(1)} KiB</span> : null}
                {event.targetAgentId ? <span>agent: {event.targetAgentId}</span> : null}
                {event.argsHash ? <span className="font-mono">args {event.argsHash.slice(0, 18)}…</span> : null}
              </div>
            </div>
            <ArrowUpRight size={11} className="mt-2 shrink-0 text-[var(--muted-dim)]" aria-hidden />
          </li>
        );
      })}
    </ol>
  );
}
