import Link from "next/link";
import { ArrowRight, Bot, ShieldAlert, ShieldCheck } from "lucide-react";
import { Card, CardHead, EmptyState, PageHeader, SeverityBadge } from "@/components/ui";
import { EvidenceWorkbench, type AiContext } from "@/components/evidence-workbench";
import { FilterMenu } from "@/components/filters";
import { getStore } from "@/lib/store";
import { formatDateTime } from "@/lib/format";
import { hashString } from "@/lib/engine/math";
import { sensitivityOf } from "@/lib/domain";
import type { AgentEvent, Factor, Violation } from "@/lib/types";

export const metadata = { title: "Evidence" };

/* --------------------------------------------------------------- graphics */

const FACTOR_TONE: Record<Factor["key"], string> = {
  exfiltration: "var(--red)",
  injection: "var(--orange)",
  scope: "var(--orange)",
  delegation: "var(--lime)",
  drift: "var(--lime)",
  sequence: "var(--muted)",
};

const SEVERITY_TONE: Record<string, string> = {
  critical: "var(--red)",
  high: "var(--orange)",
  medium: "var(--orange)",
  low: "var(--lime)",
  info: "var(--lime)",
};

function bytesLabel(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

/** Semicircular risk gauge, capped so it can never blow up its card. */
function RiskGauge({ score, severity }: { score: number; severity: string }) {
  const tone = SEVERITY_TONE[severity] ?? "var(--lime)";
  const radius = 82;
  const arc = Math.PI * radius;
  return (
    <div className="relative mx-auto w-full max-w-[228px]">
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
        <path d="M18 100 A82 82 0 0 1 182 100" fill="none" stroke="var(--line)" strokeWidth="9" strokeLinecap="round" />
        <path
          d="M18 100 A82 82 0 0 1 182 100"
          fill="none"
          stroke={tone}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * arc} ${arc}`}
        />
        <line x1="100" y1="14" x2="100" y2="26" stroke="var(--muted-dim)" strokeWidth="1.5" />
        <text x="100" y="78" textAnchor="middle" fontSize="40" fontWeight="700" fill="var(--text)">
          {score}
        </text>
        <text x="100" y="97" textAnchor="middle" fontSize="10" fill="var(--muted)" style={{ letterSpacing: "0.14em" }}>
          RISK / 100
        </text>
      </svg>
    </div>
  );
}

/** Score decomposition: one stacked bar plus per-signal rows. */
function ScoreBreakdown({ factors, score }: { factors: Factor[]; score: number }) {
  return (
    <div>
      <div className="flex h-3 w-full gap-0.5 overflow-hidden">
        {factors.map((factor) => (
          <div
            key={factor.key}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ width: `${(factor.points / Math.max(score, 1)) * 100}%`, background: FACTOR_TONE[factor.key] }}
            title={`${factor.label} +${factor.points}`}
          />
        ))}
      </div>
      <ul className="mt-4">
        {factors.map((factor) => (
          <li key={factor.key} className="flex items-center gap-3 border-b border-[var(--line)] py-2.5 last:border-b-0">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: FACTOR_TONE[factor.key] }} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-medium text-[var(--text-soft)]">{factor.label}</span>
              <span className="mt-0.5 block truncate text-[11px] text-[var(--muted-dim)]" title={factor.detail}>
                {factor.observed}
              </span>
            </span>
            <span className="metric-sm shrink-0 text-[15px] font-semibold text-[var(--text)]">+{factor.points}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal bar rows for egress volume. */
function BarRows({ rows, unit }: { rows: { label: string; value: number; display: string; flag?: boolean }[]; unit: string }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-[12px] text-[var(--text-soft)]" title={row.label}>
              {row.label}
            </span>
            <span
              className="metric-sm shrink-0 text-[12.5px] font-semibold"
              style={{ color: row.flag ? "var(--red)" : "var(--text)" }}
            >
              {row.display}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--line)]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(row.value / max) * 100}%`,
                background: row.flag ? "var(--red)" : "var(--lime)",
                opacity: row.flag ? 0.95 : 0.8,
              }}
            />
          </div>
        </div>
      ))}
      <p className="pt-1 text-[11px] text-[var(--muted-dim)]">{unit}</p>
    </div>
  );
}

/** Sensitivity reach as a 5-step scale. */
function SensitivityScale({ level }: { level: number }) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((step) => (
          <span
            key={step}
            className="h-2 flex-1 rounded-full"
            style={{
              background: step <= level ? (level >= 4 ? "var(--red)" : "var(--orange)") : "var(--line)",
            }}
          />
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-[var(--muted-dim)]">
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

  const maxSensitivity = Math.max(
    1,
    ...events.filter((event) => event.dataClass).map((event) => sensitivityOf(event.dataClass ?? "public")),
  );
  const outOfScope = taint ? taint.nodes.filter((node) => node.suspicious).length : 0;
  const restrictedReads = events.filter((event) => event.dataClass && sensitivityOf(event.dataClass) >= 4).length;

  // ---- the case file the AI analyst answers from
  const factors: Factor[] = selected?.factors ?? [];
  const aiContext: AiContext = selected
    ? {
        alertTitle: selected.title,
        severity: selected.severity,
        score: selected.score,
        confidence: Math.round(selected.confidence <= 1 ? selected.confidence * 100 : selected.confidence),
        agent: selected.agentName,
        role: agent?.role ?? "unspecified",
        factors: factors.map((factor) => ({
          label: factor.label,
          points: factor.points,
          detail: factor.detail,
        })),
        source: taint?.sourceName ?? "unknown",
        chain:
          taint?.nodes.map(
            (node) => `${node.label} [${node.kind}${node.suspicious ? ", OUT OF ROLE" : ""}]`,
          ) ?? [],
        violations: violations.map((violation) => `${violation.value} (${violation.field})`),
        suggestedAction: selected.suggestedAction,
      }
    : {
        alertTitle: "",
        severity: "info",
        score: 0,
        confidence: 0,
        agent: "",
        role: "",
        factors: [],
        source: "",
        chain: [],
        violations: [],
        suggestedAction: "",
      };

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
            <span className="chip">
              <Bot size={10} aria-hidden /> ai analyst
            </span>
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
            <span className="text-[11.5px] text-[var(--muted)]">
              {selected.agentName} · {formatDateTime(selected.ts)} UTC
            </span>
            <Link
              href={`/alerts?alert=${selected.id}`}
              className="chip ml-auto hover:border-[var(--line-strong)]"
            >
              Triage alert <ArrowRight size={10} aria-hidden />
            </Link>
          </div>

          {/* --------------------------------- interactive 3D workbench + AI */}
          <EvidenceWorkbench nodes={taint.nodes} events={events} context={aiContext} />

          {/* -------------------------------------------- score + posture */}
          <div className="mb-3 grid items-stretch gap-3 xl:grid-cols-12">
            <Card className="xl:col-span-4">
              <CardHead eyebrow="Composite score" title="Risk posture" />
              <div className="flex flex-1 flex-col px-5 pb-5">
                <RiskGauge score={selected.score} severity={selected.severity} />
                <dl className="mt-4">
                  {[
                    {
                      label: "confidence",
                      value: `${Math.round(selected.confidence <= 1 ? selected.confidence * 100 : selected.confidence)}%`,
                    },
                    { label: "restricted reads", value: String(restrictedReads) },
                    { label: "out-of-role steps", value: String(outOfScope) },
                    { label: "sensitivity reached", value: `${maxSensitivity} / 5` },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="flex items-baseline justify-between gap-3 border-b border-[var(--line)] py-2 last:border-b-0"
                    >
                      <dt className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted-dim)]">
                        {stat.label}
                      </dt>
                      <dd className="metric-sm text-[15px] font-semibold">{stat.value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-3 rounded-xl border border-[color-mix(in_srgb,var(--lime)_30%,transparent)] bg-[var(--lime-soft)] px-3.5 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--lime)]">
                    suggested action
                  </p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--text-soft)]">
                    {selected.suggestedAction}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="xl:col-span-4">
              <CardHead
                eyebrow="Explainability"
                title="Score decomposition"
                subtitle="Every point is attributed to a named signal. Contributions sum to the total."
                right={<span className="chip chip-lime">Σ = {selected.score}</span>}
              />
              <div className="px-5 pb-5">
                {factors.length ? (
                  <ScoreBreakdown factors={factors} score={selected.score} />
                ) : (
                  <p className="text-[12px] text-[var(--muted)]">No factor breakdown recorded.</p>
                )}
              </div>
            </Card>

            <Card className="xl:col-span-4">
              <CardHead
                eyebrow="Source snapshot"
                title="What was ingested"
                right={
                  <span className="chip chip-red">
                    <ShieldAlert size={10} aria-hidden /> minimized
                  </span>
                }
              />
              <div className="space-y-3 px-5 pb-5">
                <div className="rounded-2xl border border-[color-mix(in_srgb,var(--orange)_35%,transparent)] bg-[var(--orange-soft)] p-3">
                  <p className="truncate text-[12px] font-medium" title={taint.sourceName}>
                    {taint.sourceName}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--orange)]">
                    untrusted · indirect prompt injection
                  </p>
                </div>
                <dl className="space-y-2 text-[11.5px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--muted-dim)]">content hash</dt>
                    <dd className="font-mono text-[11px] text-[var(--text-soft)]">sha256:{sourceHash}…</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--muted-dim)]">trust level</dt>
                    <dd className="text-[var(--orange)]">{taint.trust}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--muted-dim)]">retention</dt>
                    <dd>hash + metadata only</dd>
                  </div>
                </dl>
                <div className="flex items-start gap-2 rounded-xl border border-[var(--line)] p-3">
                  <ShieldCheck size={12} className="mt-0.5 shrink-0 text-[var(--muted-dim)]" aria-hidden />
                  <p className="text-[11px] leading-relaxed text-[var(--muted-dim)]">
                    Raw content is encrypted at rest with a 24h forensic TTL and is never rendered in this UI.
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* ----------------------------------------------------- data + boundary */}
          <div className="mb-3 grid items-stretch gap-3 xl:grid-cols-12">
            <Card className="xl:col-span-7">
              <CardHead
                eyebrow="Exfiltration"
                title="Egress volume by destination"
                right={<span className="chip chip-red">{bytesLabel(unapprovedExfil)} unapproved</span>}
              />
              <div className="px-5 pb-5">
                {egressRows.length ? (
                  <BarRows
                    rows={egressRows}
                    unit={`total observed egress ${bytesLabel(totalExfil)} · bar length = bytes`}
                  />
                ) : (
                  <p className="text-[12px] text-[var(--muted)]">No egress recorded in this window.</p>
                )}
                <div className="mt-4">
                  <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-dim)]">
                    data sensitivity reached
                  </p>
                  <SensitivityScale level={maxSensitivity} />
                </div>
              </div>
            </Card>

            <Card className="xl:col-span-5">
              <CardHead
                eyebrow="Authority"
                title="Role boundary"
                right={<span className="chip chip-red">{violations.length} outside</span>}
              />
              <div className="px-5 pb-5">
                {violations.length === 0 ? (
                  <p className="text-[12px] text-[var(--muted)]">
                    No declared-role violations were required for this alert.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {violations.slice(0, 6).map((violation) => (
                      <li
                        key={`${violation.kind}-${violation.value}`}
                        className="flex items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] px-3.5 py-2.5"
                      >
                        <span className="truncate text-[12px] font-medium text-[var(--orange)]">
                          {violation.value}
                        </span>
                        <span className="chip chip-red shrink-0 !px-2.5 !py-1 !text-[10.5px]">outside</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 rounded-xl border border-[var(--line)] p-3">
                  <p className="flex items-center gap-1.5 text-[11.5px] text-[var(--lime)]">
                    <ShieldCheck size={12} aria-hidden /> Valid token, valid permissions
                  </p>
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-[var(--muted)]">
                    Authorization checks passed for every call. The failure is behavioral: the declared{" "}
                    {agent?.role ?? "Procurement"} role never reaches these resources.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
