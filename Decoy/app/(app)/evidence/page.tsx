import Link from "next/link";
import {
  ArrowRight,
  EyeOff,
  FileWarning,
  Fingerprint,
  Lock,
  ShieldAlert,
  Timer,
} from "lucide-react";
import { Card, CardHead, EmptyState, PageHeader, SeverityBadge } from "@/components/ui";
import { EventTimeline } from "@/components/event-timeline";
import { FilterMenu } from "@/components/filters";
import { getStore } from "@/lib/store";
import { formatDateTime, relativeTime } from "@/lib/format";
import { hashString } from "@/lib/engine/math";
import { sensitivityOf } from "@/lib/domain";
import type { AgentEvent, Factor, TaintPath, Violation } from "@/lib/types";

export const metadata = { title: "Evidence" };

/* --------------------------------------------------------------- graphics */

const SEVERITY_TONE: Record<string, string> = {
  critical: "var(--red)",
  high: "var(--orange)",
  medium: "var(--orange)",
  low: "var(--lime)",
  info: "var(--lime)",
};

const FACTOR_TONE: Record<Factor["key"], string> = {
  exfiltration: "var(--red)",
  injection: "var(--orange)",
  scope: "var(--orange)",
  delegation: "var(--lime)",
  drift: "var(--lime)",
  sequence: "var(--muted)",
};

function bytesLabel(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

/** Semicircular risk gauge with severity-colored arc. */
function RiskGauge({ score, severity }: { score: number; severity: string }) {
  const tone = SEVERITY_TONE[severity] ?? "var(--lime)";
  const radius = 82;
  const arc = Math.PI * radius; // half circumference
  return (
    <div className="relative mx-auto mt-1 w-full max-w-[228px]">
      {/* severity halo so the score reads as the focal point of the page */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-3 h-[130%]"
        style={{
          background: `radial-gradient(60% 55% at 50% 42%, color-mix(in srgb, ${tone} 22%, transparent), transparent 72%)`,
        }}
      />
      <svg
        className="relative"
        viewBox="0 0 200 118"
        width="100%"
        role="img"
        aria-label={`Risk score ${score} of 100`}
      >
        <path
          d="M18 100 A82 82 0 0 1 182 100"
          fill="none"
          stroke="var(--line)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M18 100 A82 82 0 0 1 182 100"
          fill="none"
          stroke={tone}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * arc} ${arc}`}
        />
        {/* threshold marker at 50 */}
        <line x1="100" y1="14" x2="100" y2="28" stroke="var(--muted-dim)" strokeWidth="1.5" />
        <text x="100" y="76" textAnchor="middle" fontSize="34" fontWeight="700" fill="var(--text)">
          {score}
        </text>
        <text
          x="100"
          y="94"
          textAnchor="middle"
          fontSize="8"
          fill="var(--muted)"
          style={{ letterSpacing: "0.12em" }}
        >
          RISK / 100 · THRESHOLD 50
        </text>
      </svg>
    </div>
  );
}

/** Cumulative risk accumulation across the evidence window. */
function RiskAccumulation({ events }: { events: AgentEvent[] }) {
  const width = 420;
  const height = 150;
  const pad = { top: 12, right: 8, bottom: 22, left: 8 };
  const scored = events.filter((event) => typeof event.risk === "number" || event.label === "attack");
  const series = scored.length ? scored : events;
  let running = 0;
  const cumulative = series.map((event) => {
    running += Number(event.risk ?? 2);
    return running;
  });
  const max = Math.max(1, running);
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const points = cumulative.map((value, index) => {
    const x = pad.left + (index / Math.max(cumulative.length - 1, 1)) * innerW;
    const y = pad.top + innerH - (value / max) * innerH;
    return [x, y] as [number, number];
  });
  const line = points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${(pad.left + innerW).toFixed(1)} ${pad.top + innerH} L${pad.left} ${pad.top + innerH} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label="Cumulative risk accumulation">
      <defs>
        <linearGradient id="risk-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--orange)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--orange)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((fraction) => (
        <line
          key={fraction}
          x1={pad.left}
          x2={width - pad.right}
          y1={pad.top + innerH * fraction}
          y2={pad.top + innerH * fraction}
          stroke="var(--line)"
          strokeDasharray="2 5"
        />
      ))}
      <path d={area} fill="url(#risk-area)" />
      <path d={line} fill="none" stroke="var(--orange)" strokeWidth="2" strokeLinejoin="round" />
      {points.map(([x, y], index) => (
        <circle key={index} cx={x} cy={y} r="2.6" fill="var(--orange)" />
      ))}
      <text x={pad.left} y={height - 6} fontSize="8.5" fill="var(--muted-dim)">
        window start
      </text>
      <text x={width - pad.right} y={height - 6} textAnchor="end" fontSize="8.5" fill="var(--muted-dim)">
        alert fired
      </text>
    </svg>
  );
}

/** Horizontal bar rows used for egress volume and event mix. */
function BarRows({
  rows,
  tone,
  unit,
}: {
  rows: { label: string; value: number; display: string; flag?: boolean }[];
  tone: string;
  unit: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <div className="space-y-2.5">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate font-mono text-[10px] text-[var(--text-soft)]" title={row.label}>
              {row.label}
            </span>
            <span
              className="metric-sm shrink-0 text-[11px] font-semibold"
              style={{ color: row.flag ? "var(--red)" : "var(--text)" }}
            >
              {row.display}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(row.value / max) * 100}%`,
                background: row.flag ? "var(--red)" : tone,
                opacity: row.flag ? 0.9 : 0.8,
              }}
            />
          </div>
        </div>
      ))}
      <p className="pt-1 text-[8.5px] uppercase tracking-wide text-[var(--muted-dim)]">{unit}</p>
    </div>
  );
}

/** Stacked decomposition bar + per-factor rows; points always sum to score. */
function FactorBreakdown({ factors, score }: { factors: Factor[]; score: number }) {
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {factors.map((factor) => (
          <div
            key={factor.key}
            style={{
              width: `${(factor.points / Math.max(score, 1)) * 100}%`,
              background: FACTOR_TONE[factor.key],
            }}
            title={`${factor.label} +${factor.points}`}
          />
        ))}
      </div>
      <ul className="mt-4 space-y-2">
        {factors.map((factor) => (
          <li key={factor.key} className="rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: FACTOR_TONE[factor.key] }}
                />
                <span className="truncate text-[11px] font-medium">{factor.label}</span>
              </span>
              <span className="metric-sm shrink-0 text-[12px] font-bold text-[var(--text)]">
                +{factor.points}
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <p className="truncate text-[9px] text-[var(--muted-dim)]" title={factor.detail}>
                {factor.observed}
              </p>
              <p className="max-w-[42%] truncate text-right font-mono text-[9px] text-[var(--muted-dim)]" title={factor.expected}>
                exp {factor.expected}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 font-mono text-[9.5px] text-[var(--muted-dim)]">
        Σ points = {factors.reduce((sum, factor) => sum + factor.points, 0)} = score {score} · logistic model
      </p>
    </div>
  );
}

/** Straight numbered taint rail — no zig-zag, labels never collide. */
function TaintRail({ path }: { path: TaintPath }) {
  const nodes = path.nodes.slice(0, 6);
  return (
    <div className="scroll-x">
      <div className="relative flex min-w-[720px] items-start gap-3 pt-1">
        <div
          className="absolute left-0 right-0 top-[18px] h-px"
          aria-hidden
          style={{
            background: "linear-gradient(90deg, var(--orange), var(--red))",
            opacity: 0.55,
          }}
        />
        {nodes.map((node, index) => {
          const source = node.kind === "source";
          const suspicious = Boolean(node.suspicious);
          const tone = source ? "var(--orange)" : suspicious ? "var(--red)" : "var(--muted)";
          return (
            <div key={node.id} className="relative z-10 min-w-0 flex-1">
              <div className="flex items-center">
                <span
                  className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border-2 font-mono text-[9px] font-bold"
                  style={{
                    borderColor: tone,
                    background: "var(--panel)",
                    color: tone,
                  }}
                >
                  {index + 1}
                </span>
                {source ? (
                  <span className="ml-2 font-mono text-[8.5px] uppercase tracking-wide text-[var(--orange)]">
                    untrusted source
                  </span>
                ) : null}
              </div>
              <p
                className="mt-2 truncate text-[10.5px] font-medium"
                title={node.label}
                style={{ color: suspicious ? "var(--orange)" : "var(--text-soft)" }}
              >
                {node.label}
              </p>
              <p className="mt-0.5 font-mono text-[8.5px] text-[var(--muted-dim)]">
                {formatDateTime(node.ts)} UTC
              </p>
              <p
                className="mt-1.5 inline-flex rounded-full px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wide"
                style={{
                  color: tone,
                  background: source ? "var(--orange-soft)" : suspicious ? "var(--red-soft)" : "var(--panel-hi)",
                }}
              >
                {source ? "taint origin" : suspicious ? "out of role" : node.kind}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Sensitivity reach as a 5-step dot scale. */
function SensitivityScale({ level }: { level: number }) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((step) => (
          <span
            key={step}
            className="h-2 flex-1 rounded-full"
            style={{
              background:
                step <= level
                  ? level >= 4
                    ? "var(--red)"
                    : "var(--orange)"
                  : "var(--line)",
            }}
          />
        ))}
      </div>
      <p className="mt-1.5 font-mono text-[9px] text-[var(--muted-dim)]">
        level {level} / 5 · {level >= 4 ? "restricted classes reached" : "within declared classes"}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------- page */

export default async function EvidencePage({
  searchParams,
}: {
  searchParams: Promise<{ alert?: string }>;
}) {
  const params = await searchParams;
  const store = getStore();
  const withTaint = store.alerts.filter((alert) => alert.evidence.taint);
  const selected =
    store.alerts.find((alert) => alert.id === params.alert) ??
    withTaint.sort((a, b) => b.score - a.score)[0] ??
    store.alerts[0];
  const taint = selected?.evidence.taint;
  const agent = selected ? store.agents.find((candidate) => candidate.id === selected.agentId) : undefined;
  const sourceHash = taint ? hashString(taint.sourceName).toString(16).padStart(12, "0") : null;

  const alertOptions = store.alerts
    .filter((alert) => alert.evidence.taint)
    .map((alert) => ({
      label: `${alert.score} · ${alert.agentName}`,
      value: alert.id,
      href: `/evidence?alert=${alert.id}`,
    }));

  // ---- analytics derived from the selected alert's evidence window
  const events: AgentEvent[] = selected?.evidence.events ?? [];
  const violations: Violation[] = selected?.evidence.violations ?? [];
  const egressByDest = new Map<string, { bytes: number; hits: number; unapproved: boolean }>();
  for (const event of events) {
    if (!event.destination) continue;
    const entry = egressByDest.get(event.destination) ?? { bytes: 0, hits: 0, unapproved: false };
    entry.bytes += event.bytes ?? 0;
    entry.hits += 1;
    if (violations.some((violation) => violation.kind === "destination" && violation.value === event.destination)) {
      entry.unapproved = true;
    }
    egressByDest.set(event.destination, entry);
  }
  const egressRows = [...egressByDest.entries()]
    .sort((a, b) => b[1].bytes - a[1].bytes)
    .slice(0, 6)
    .map(([destination, entry]) => ({
      label: `${destination} · ${entry.hits} call${entry.hits === 1 ? "" : "s"}`,
      value: entry.bytes,
      display: bytesLabel(entry.bytes),
      flag: entry.unapproved,
    }));
  const totalExfil = [...egressByDest.values()].reduce((sum, entry) => sum + entry.bytes, 0);
  const unapprovedExfil = [...egressByDest.values()]
    .filter((entry) => entry.unapproved)
    .reduce((sum, entry) => sum + entry.bytes, 0);

  const typeCounts = new Map<string, number>();
  for (const event of events) typeCounts.set(event.type, (typeCounts.get(event.type) ?? 0) + 1);
  const typeRows = [...typeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({
      label: type,
      value: count,
      display: `${count}`,
    }));

  const maxSensitivity = Math.max(
    1,
    ...events.filter((event) => event.dataClass).map((event) => sensitivityOf(event.dataClass ?? "public")),
  );
  const outOfScope = taint ? taint.nodes.filter((node) => node.suspicious).length : 0;
  const detectSeconds =
    selected && taint
      ? Math.max(1, Math.round((new Date(selected.ts).getTime() - new Date(taint.startedAt).getTime()) / 1000))
      : 0;
  const restrictedReads = events.filter(
    (event) => event.dataClass && sensitivityOf(event.dataClass) >= 4,
  ).length;

  return (
    <div>
      <PageHeader
        eyebrow="Forensics · causality"
        title="Taint Explorer"
        description="Follow an untrusted input through the exact actions it influenced. Content is hashed and redacted at the edge; the chain is reconstructed from signed telemetry."
        meta={
          <>
            <span className="chip chip-orange">{withTaint.length} alerts with taint</span>
            <span className="chip">content snapshots redacted</span>
            <span className="chip">no HTML rendering</span>
          </>
        }
        actions={
          <FilterMenu
            label="Alert"
            value={selected ? `${selected.score} · ${selected.agentName}` : "none"}
            options={
              alertOptions.length ? alertOptions : [{ label: "No taint alerts", value: "none", href: "/evidence" }]
            }
          />
        }
      />

      {!selected || !taint ? (
        <Card>
          <EmptyState title="No tainted alerts" description="Nothing untrusted is currently linked to an alert." />
        </Card>
      ) : (
        <>
          {/* ------------------------------------------------- alert context */}
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] px-4 py-3">
            <SeverityBadge severity={selected.severity} showScore={selected.score} />
            <span className="text-[12px] font-medium">{selected.title}</span>
            <span className="text-[10px] text-[var(--muted)]">
              {selected.agentName} · {formatDateTime(selected.ts)} UTC
            </span>
            <Link
              href={`/alerts?alert=${selected.id}`}
              className="chip ml-auto hover:border-[var(--line-strong)]"
            >
              Triage alert <ArrowRight size={10} aria-hidden />
            </Link>
          </div>

          {/* --------------------------------------- analytics row (12-col) */}
          <div className="mb-3 grid items-stretch gap-3 xl:grid-cols-12">
            {/* risk gauge */}
            <Card className="xl:col-span-3">
              <CardHead eyebrow="Composite score" title="Risk posture" />
              <div className="flex flex-1 flex-col px-5 pb-5">
                <RiskGauge score={selected.score} severity={selected.severity} />
                <dl className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-[var(--line)] px-3 py-2">
                    <dt className="text-[8.5px] uppercase tracking-wide text-[var(--muted-dim)]">
                      confidence
                    </dt>
                    <dd className="metric-sm text-[15px] font-semibold">
                      {Math.round(selected.confidence <= 1 ? selected.confidence * 100 : selected.confidence)}%
                    </dd>
                  </div>
                  <div className="rounded-xl border border-[var(--line)] px-3 py-2">
                    <dt className="text-[8.5px] uppercase tracking-wide text-[var(--muted-dim)]">
                      time to detect
                    </dt>
                    <dd className="metric-sm flex items-center gap-1 text-[15px] font-semibold">
                      <Timer size={11} className="text-[var(--lime)]" aria-hidden />
                      {detectSeconds}s
                    </dd>
                  </div>
                </dl>
                <div className="mt-2 rounded-xl border border-[color-mix(in_srgb,var(--lime)_30%,transparent)] bg-[var(--lime-soft)] px-3 py-2">
                  <p className="text-[8.5px] uppercase tracking-wide text-[var(--lime)]">
                    suggested action
                  </p>
                  <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-soft)]">
                    {selected.suggestedAction}
                  </p>
                </div>
              </div>
            </Card>

            {/* factor decomposition */}
            <Card className="xl:col-span-5">
              <CardHead
                eyebrow="Explainability"
                title="Score decomposition"
                subtitle="Every point is attributed to a named signal. Contributions sum to the total."
                right={<span className="chip chip-lime">Σ = {selected.score}</span>}
              />
              <div className="px-5 pb-5">
                {selected.factors.length ? (
                  <FactorBreakdown factors={selected.factors} score={selected.score} />
                ) : (
                  <p className="text-[11px] text-[var(--muted)]">No factor breakdown recorded.</p>
                )}
              </div>
            </Card>

            {/* source snapshot + provenance */}
            <Card className="xl:col-span-4">
              <CardHead
                eyebrow="Source snapshot"
                title="What was ingested"
                right={
                  <span className="chip chip-red">
                    <EyeOff size={10} aria-hidden /> minimized
                  </span>
                }
              />
              <div className="space-y-3 px-5 pb-5">
                <div className="rounded-2xl border border-[color-mix(in_srgb,var(--orange)_35%,transparent)] bg-[var(--orange-soft)] p-3">
                  <div className="flex items-start gap-2">
                    <FileWarning size={16} className="mt-0.5 shrink-0 text-[var(--orange)]" aria-hidden />
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-medium" title={taint.sourceName}>
                        {taint.sourceName}
                      </p>
                      <p className="mt-1 text-[9px] uppercase tracking-wide text-[var(--orange)]">
                        untrusted · indirect prompt injection
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-[var(--muted)]">
                    The document carried an instruction aimed at the agent. Extracted text is withheld
                    by default; only hashes, classifications and provenance are retained.
                  </p>
                </div>
                <dl className="space-y-1.5 text-[10px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--muted-dim)]">content hash</dt>
                    <dd className="font-mono text-[9px] text-[var(--text-soft)]">sha256:{sourceHash}…</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--muted-dim)]">trust level</dt>
                    <dd className="text-[var(--orange)]">untrusted</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--muted-dim)]">retention</dt>
                    <dd>hash + metadata only</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--muted-dim)]">agent</dt>
                    <dd>
                      <Link
                        href={`/agents/${selected.agentId}`}
                        className="text-[var(--lime)] hover:underline"
                      >
                        {selected.agentName}
                      </Link>
                    </dd>
                  </div>
                </dl>
                <div className="flex items-start gap-2 rounded-xl border border-[var(--line)] p-2.5">
                  <Lock size={11} className="mt-0.5 shrink-0 text-[var(--muted-dim)]" aria-hidden />
                  <p className="text-[9px] leading-relaxed text-[var(--muted-dim)]">
                    Raw content is encrypted at rest in object storage with a 24h forensic TTL and is
                    never rendered in this UI.
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* ------------------------------------------------- taint chain */}
          <Card className="mb-3">
            <CardHead
              eyebrow="Taint thread"
              title={`${taint.sourceName} → ${outOfScope} out-of-role actions`}
              subtitle={`Untrusted content read at ${formatDateTime(taint.startedAt)} UTC · ${taint.steps} causal hops before the first violation.`}
              right={
                <span className="chip chip-orange">
                  <Fingerprint size={10} aria-hidden /> {taint.trust}
                </span>
              }
            />
            <div className="px-5 pb-4">
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] p-4">
                <TaintRail path={taint} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {[
                  ["source trust", taint.trust],
                  ["causal hops", String(taint.steps)],
                  ["out-of-scope", String(outOfScope)],
                  ["restricted reads", String(restrictedReads)],
                  ["sensitivity reached", `${maxSensitivity} / 5`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-[var(--line)] px-3 py-2">
                    <p className="metric-sm text-[15px] font-semibold">{value}</p>
                    <p className="text-[8.5px] uppercase tracking-wide text-[var(--muted-dim)]">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* -------------------------------------------- analytics triptych */}
          <div className="mb-3 grid items-stretch gap-3 xl:grid-cols-12">
            <Card className="xl:col-span-4">
              <CardHead
                eyebrow="Timeline"
                title="Risk accumulation"
                subtitle="Cumulative signal strength across the evidence window."
              />
              <div className="px-5 pb-5">
                <div className="mx-auto max-w-[440px]">
                  <RiskAccumulation events={events} />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-[var(--line)] px-3 py-2">
                    <p className="text-[8.5px] uppercase tracking-wide text-[var(--muted-dim)]">
                      window span
                    </p>
                    <p className="metric-sm mt-0.5 text-[12px] font-semibold">
                      {relativeTime(selected.evidence.window.from)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--line)] px-3 py-2">
                    <p className="text-[8.5px] uppercase tracking-wide text-[var(--muted-dim)]">
                      evidence events
                    </p>
                    <p className="metric-sm mt-0.5 text-[12px] font-semibold">{events.length}</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="xl:col-span-4">
              <CardHead
                eyebrow="Exfiltration"
                title="Egress volume by destination"
                right={
                  <span className="chip chip-red">
                    {bytesLabel(unapprovedExfil)} unapproved
                  </span>
                }
              />
              <div className="px-5 pb-5">
                {egressRows.length ? (
                  <BarRows
                    rows={egressRows}
                    tone="var(--lime)"
                    unit={`total observed egress ${bytesLabel(totalExfil)} · bar length = bytes`}
                  />
                ) : (
                  <p className="text-[11px] text-[var(--muted)]">No egress recorded in this window.</p>
                )}
                <div className="mt-3">
                  <p className="mb-2 text-[9px] uppercase tracking-wide text-[var(--muted-dim)]">
                    data sensitivity reached
                  </p>
                  <SensitivityScale level={maxSensitivity} />
                </div>
              </div>
            </Card>

            <Card className="xl:col-span-4">
              <CardHead
                eyebrow="Behavior mix"
                title="Event type distribution"
                subtitle="What the agent actually did inside the window."
              />
              <div className="px-5 pb-5">
                {typeRows.length ? (
                  <BarRows
                    rows={typeRows}
                    tone="var(--orange)"
                    unit="bar length = event count in evidence window"
                  />
                ) : (
                  <p className="text-[11px] text-[var(--muted)]">No events in this window.</p>
                )}
                <div className="mt-3 rounded-xl border border-[var(--line)] px-3 py-2">
                  <p className="text-[8.5px] uppercase tracking-wide text-[var(--muted-dim)]">
                    role boundary
                  </p>
                  <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-soft)]">
                    {violations.length === 0
                      ? "No declared-role violations were required for this alert."
                      : `${violations.length} declared constraints violated · ${violations
                          .map((violation) => violation.value)
                          .slice(0, 3)
                          .join(", ")}${violations.length > 3 ? "…" : ""}`}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* ------------------------------------------- causal steps + notes */}
          <div className="grid items-start gap-3 xl:grid-cols-12">
            <Card className="xl:col-span-7">
              <CardHead
                eyebrow="Causal steps"
                title="What the agent did next"
                subtitle="Every step below is signed by the runtime and stored with its argument hash."
              />
              <div className="px-4 pb-4">
                <EventTimeline events={selected.evidence.events} />
              </div>
            </Card>

            <div className="space-y-3 xl:col-span-5">
              <Card>
                <CardHead
                  eyebrow="Authority"
                  title="Role boundary"
                  right={<span className="chip chip-red">{violations.length} outside</span>}
                />
                <div className="px-5 pb-5">
                  {violations.length === 0 ? (
                    <p className="text-[11px] text-[var(--muted)]">
                      No declared-role violations were required for this alert.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {violations.map((violation) => (
                        <li
                          key={`${violation.kind}-${violation.value}`}
                          className="rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] px-3 py-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10.5px] font-medium text-[var(--orange)]">
                              {violation.value}
                            </span>
                            <span className="chip chip-red !px-1.5 !py-0 !text-[8px]">outside</span>
                          </div>
                          <p className="mt-1 text-[9px] leading-relaxed text-[var(--muted-dim)]">
                            {violation.field} declares: {violation.declared.join(", ") || "nothing"}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 rounded-xl border border-[var(--line)] p-3">
                    <p className="flex items-center gap-1.5 text-[10px] text-[var(--lime)]">
                      <ShieldAlert size={11} aria-hidden /> Valid token, valid permissions
                    </p>
                    <p className="mt-1 text-[9.5px] leading-relaxed text-[var(--muted)]">
                      Authorization checks passed for every call. The failure is behavioral: the
                      declared {agent?.role ?? "Procurement"} role never reaches HR compensation
                      or external hosts.
                    </p>
                  </div>
                </div>
              </Card>

              <Card>
                <CardHead eyebrow="Analyst note" title="Why this matters" />
                <div className="px-5 pb-5 text-[11px] leading-relaxed text-[var(--text-soft)]">
                  <p>{selected.explanation}</p>
                  <p className="mt-2 text-[var(--muted)]">
                    The taint link is a correlation with a bounded causal window, not proof of intent.
                    It raises the injection signal by 30 points; scope and egress evidence carry the
                    alert on their own.
                  </p>
                  <p className="mt-2 text-[9px] text-[var(--muted-dim)]">
                    Observed {relativeTime(taint.startedAt)} · {agent?.environment ?? "unknown"}{" "}
                    environment · retention 24h
                  </p>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
