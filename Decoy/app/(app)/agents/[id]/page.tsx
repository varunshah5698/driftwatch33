import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  CalendarClock,
  FileCode2,
  KeyRound,
  MapPin,
  Network,
  Sparkles,
} from "lucide-react";
import {
  AlignmentDial,
  BehaviorRadar,
  CapsuleCompare,
  DotMatrix,
  FactorBars,
  GanttTimeline,
  Sparkline,
} from "@/components/charts";
import {
  BlastRadiusMap,
  DestinationMap,
  type DestinationEntry,
} from "@/components/visuals";
import { ContainmentLadder } from "@/components/containment-ladder";
import {
  Card,
  CardHead,
  EmptyState,
  OwnerAvatar,
  PageHeader,
  SeverityBadge,
  StatusPill,
} from "@/components/ui";
import {
  activityGrid,
  agentAlerts,
  agentEvents,
  blastRadius,
  changesForAgent,
  getAgent,
  getStore,
  sessionTimeline,
  toolDataMatrix,
} from "@/lib/store";
import { scoreWindow } from "@/lib/engine/detect";
import { distributionOf } from "@/lib/engine/baseline";
import { sensitivityOf } from "@/lib/domain";
import { clamp } from "@/lib/engine/math";
import { formatDateTime, formatTime, relativeTime } from "@/lib/format";
import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

export default async function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = getAgent(id);
  if (!agent) notFound();
  const store = getStore();
  const user = await getSessionUser();
  const baseline = store.baselines[agent.id];
  const events = agentEvents(agent.id, 7 * 86_400_000);
  const alerts = agentAlerts(agent.id);
  const topAlert = [...alerts].sort((a, b) => b.score - a.score)[0];
  const evaluation = scoreWindow({ manifest: agent.manifest, baseline, events });
  const factors = topAlert?.score && topAlert.score > evaluation.result.score ? topAlert.factors : evaluation.result.factors;
  const riskScore = topAlert?.score ?? evaluation.result.score;
  const sessions = sessionTimeline(agent.id);
  const activity = activityGrid(agent.id);
  const matrix = toolDataMatrix(agent.id);
  const radius = blastRadius(agent.id);
  const changes = changesForAgent(agent.id);

  const destinations = (() => {
    const map = new Map<string, DestinationEntry>();
    for (const event of events) {
      if (event.type !== "network.egress" || !event.destination) continue;
      const existing = map.get(event.destination) ?? {
        destination: event.destination,
        bytes: 0,
        allowed: agent.manifest.spec.allowed.destinations.includes(event.destination),
        hits: 0,
      };
      existing.bytes += event.bytes ?? 0;
      existing.hits += 1;
      map.set(event.destination, existing);
    }
    return [...map.values()].sort((a, b) => b.bytes - a.bytes);
  })();

  const currentData = distributionOf(events, (event) => event.dataClass);
  const topClasses = [...new Set(events.map((event) => event.dataClass).filter(Boolean) as string[])]
    .sort((a, b) => (currentData[b] ?? 0) - (currentData[a] ?? 0))
    .slice(0, 5);
  const capsuleItems = topClasses.map((dataClass) => ({
    label: dataClass.split(".").slice(-1)[0],
    primary: Math.round((baseline.dataDist[dataClass] ?? 0) * 100),
    secondary: Math.round((currentData[dataClass] ?? 0) * 100),
  }));

  const allowed = agent.manifest.spec.allowed;
  const totalBytes = events
    .filter((event) => event.type === "network.egress")
    .reduce((total, event) => total + (event.bytes ?? 0), 0);
  const avgSensitivity =
    events.filter((event) => event.type === "data.access").length > 0
      ? events
          .filter((event) => event.type === "data.access")
          .reduce((total, event) => total + sensitivityOf(event.dataClass ?? "public"), 0) /
        events.filter((event) => event.type === "data.access").length
      : 1;
  const currentTools = new Set(events.map((event) => event.tool).filter(Boolean)).size;
  const currentClasses = new Set(events.map((event) => event.dataClass).filter(Boolean)).size;
  const delegationCount = events.filter((event) => event.type === "delegation").length;
  const baselineEventsPerDay = baseline.sampleCount / 10;
  const radarAxes = ["tool breadth", "data breadth", "egress", "sensitivity", "delegation", "tempo"];
  const radarCurrent = [
    clamp(currentTools / Math.max(1, allowed.tools.length)),
    clamp(currentClasses / Math.max(1, allowed.dataClasses.length)),
    clamp(totalBytes / Math.max(1, baseline.p95EgressBytes * 12)),
    clamp(avgSensitivity / 5),
    clamp((delegationCount / Math.max(events.length, 1)) * 18),
    clamp(events.length / 7 / Math.max(1, baselineEventsPerDay) / 2.5),
  ];
  const radarBaseline = [
    clamp(Object.keys(baseline.toolDist).length / Math.max(1, allowed.tools.length)),
    clamp(Object.keys(baseline.dataDist).length / Math.max(1, allowed.dataClasses.length)),
    clamp(baseline.avgEgressBytes / Math.max(1, baseline.p95EgressBytes * 3)),
    clamp(
      Object.entries(baseline.dataDist).reduce(
        (total, [dataClass, weight]) => total + sensitivityOf(dataClass) * weight,
        0,
      ) / 5,
    ),
    clamp(baseline.delegationRate * 18),
    0.55,
  ];

  const canApply = Boolean(user && can(user.role, "containment:apply"));
  const taint = topAlert?.evidence.taint;
  const observedSummary = {
    events: events.length,
    sessions: sessions.length,
    tools: currentTools,
    dataClasses: currentClasses,
    delegated: delegationCount,
    bytes: totalBytes,
  };

  return (
    <div>
      <PageHeader
        eyebrow={`${agent.roleTemplate} · ${agent.environment}`}
        title={agent.name}
        description={agent.description}
        meta={
          <>
            <StatusPill status={agent.status} />
            <span className="chip">manifest v{agent.manifestVersion}</span>
            <span className="chip">
              <CalendarClock size={11} aria-hidden /> baseline v{baseline.version} · {Math.round(baseline.confidence * 100)}% confidence
            </span>
            <span className="chip">
              owner <OwnerAvatar initials={agent.owner.initials} color={agent.owner.color} name={agent.owner.name} size={16} />
              <span className="ml-1">{agent.owner.name}</span>
            </span>
            <span className={`chip ${agent.containment >= 3 ? "chip-red" : agent.containment >= 2 ? "chip-orange" : "chip-lime"}`}>
              level {agent.containment} · {["monitor", "notify", "step-up", "restrict", "quarantine", "isolate"][agent.containment]}
            </span>
          </>
        }
        actions={
          <>
            <Link href={`/roles?agent=${agent.id}`} className="pill !h-10 !text-[12px]">
              <FileCode2 size={14} aria-hidden /> Manifest
            </Link>
            <Link href={`/chain?agent=${agent.id}`} className="pill !h-10 !text-[12px]">
              <Network size={14} aria-hidden /> Chain
            </Link>
            {topAlert ? (
              <Link href={`/alerts?alert=${topAlert.id}`} className="pill pill-active !h-10 !text-[12px]">
                Triage alert <ArrowRight size={13} aria-hidden />
              </Link>
            ) : null}
          </>
        }
      />

      {topAlert ? (
        <div
          className="mb-4 flex flex-col gap-3 rounded-[22px] border p-4 sm:flex-row sm:items-center"
          style={{
            borderColor: "color-mix(in srgb, var(--red) 35%, transparent)",
            background: "linear-gradient(90deg, var(--red-soft), transparent 70%)",
          }}
        >
          <span className="metric-sm flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--red)] text-[16px] font-bold text-[var(--red)]">
            {topAlert.score}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[13px] font-semibold">{topAlert.title}</p>
              <SeverityBadge severity={topAlert.severity} />
              {topAlert.benignChange ? <span className="chip chip-violet">change-managed</span> : null}
            </div>
            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[var(--muted)]">
              {topAlert.explanation}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {taint ? <span className="chip chip-orange">taint: {taint.sourceName}</span> : null}
            <Link href={`/alerts?alert=${topAlert.id}`} className="btn btn-danger !h-9">
              Investigate
            </Link>
          </div>
        </div>
      ) : (
        <div className="mb-4 flex items-center gap-3 rounded-[22px] border border-[var(--line)] bg-[var(--lime-soft)] px-4 py-3">
          <Sparkles size={16} className="text-[var(--lime)]" aria-hidden />
          <p className="text-[11.5px] text-[var(--text-soft)]">
            No active drift alert. The latest 7-day window scores{" "}
            <span className="font-semibold text-[var(--lime)]">{evaluation.result.score}/100</span> against
            the declared role.
          </p>
        </div>
      )}

      <div className="mb-3 grid gap-3 xl:grid-cols-12">
        <Card className="xl:col-span-4">
          <CardHead eyebrow="Role alignment" title="Score decomposition" subtitle="Weighted-logistic contributions sum exactly to the score." />
          <div className="flex flex-col items-center gap-4 px-6 pb-6 sm:flex-row">
            <AlignmentDial score={100 - riskScore} size={196} confidence={baseline.confidence} />
            <div className="w-full flex-1">
              <FactorBars factors={factors.slice(0, 5)} compact />
              <p className="mt-3 border-t border-[var(--line)] pt-2 text-[9.5px] text-[var(--muted-dim)]">
                Σ {factors.reduce((total, factor) => total + factor.points, 0)} / {riskScore} points ·{" "}
                {baseline.sampleCount.toLocaleString()} baseline events · alignment = 100 − risk
              </p>
            </div>
          </div>
          <div className="mx-6 mb-6 rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] p-3">
            <p className="eyebrow mb-2">Observed vs baseline · data classes</p>
            <CapsuleCompare items={capsuleItems} primaryLabel="Baseline" secondaryLabel="Current" height={156} />
          </div>
        </Card>

        <Card className="xl:col-span-4">
          <CardHead eyebrow="Fingerprint" title="Behavior radar" subtitle="Declared baseline polygon versus the live 7-day window. Changed axes turn orange." />
          <div className="px-5 pb-3">
            <BehaviorRadar
              baseline={radarBaseline}
              current={radarCurrent}
              axes={radarAxes}
              size={280}
            />
          </div>
          <div className="mx-6 mb-5 grid grid-cols-3 gap-2 text-[9.5px]">
            {[
              ["sessions", observedSummary.sessions],
              ["tool calls", observedSummary.tools],
              ["egress", `${(observedSummary.bytes / 1024 / 1024).toFixed(1)} MiB`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-[var(--line)] px-2.5 py-2">
                <p className="metric-sm text-[13px] font-semibold">{value}</p>
                <p className="text-[8.5px] uppercase tracking-wide text-[var(--muted-dim)]">{label}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="xl:col-span-4">
          <CardHead
            eyebrow="Declared vs live"
            title="Role conformance"
            subtitle={`Manifest ${agent.manifestVersion} · updated ${formatDateTime(agent.manifest.metadata.updatedAt)}`}
            right={<span className={`chip ${evaluation.bundle.violations.length ? "chip-orange" : "chip-lime"}`}>{evaluation.bundle.violations.length} violations</span>}
          />
          <div className="space-y-3 px-6 pb-6">
            <div>
              <p className="eyebrow mb-1.5">Declared data classes</p>
              <div className="flex flex-wrap gap-1">
                {allowed.dataClasses.map((dataClass) => (
                  <span key={dataClass} className="chip !px-2 !py-0.5 !text-[9px]">{dataClass}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="eyebrow mb-1.5">Live data reach</p>
              <div className="flex flex-wrap gap-1">
                {[...new Set(events.filter((event) => event.dataClass).map((event) => event.dataClass as string))]
                  .slice(0, 8)
                  .map((dataClass) => {
                    const declared = allowed.dataClasses.includes(dataClass);
                    return (
                      <span
                        key={dataClass}
                        className={`chip !px-2 !py-0.5 !text-[9px] ${declared ? "" : "chip-red"}`}
                        title={declared ? "declared" : "outside role manifest"}
                      >
                        {declared ? "" : "▲ "}{dataClass}
                      </span>
                    );
                  })}
              </div>
            </div>
            <div className="hairline" />
            <div>
              <p className="eyebrow mb-1.5">Violations</p>
              {evaluation.bundle.violations.length === 0 ? (
                <p className="text-[10.5px] text-[var(--muted)]">
                  No action is outside the declared role. Drift is distributional, not a hard-rule break.
                </p>
              ) : (
                <ul className="space-y-1">
                  {evaluation.bundle.violations.map((violation) => (
                    <li key={`${violation.kind}-${violation.value}`} className="flex items-start justify-between gap-2 text-[10px]">
                      <span className="min-w-0">
                        <span className="text-[var(--orange)]">{violation.value}</span>
                        <span className="ml-1 text-[var(--muted-dim)]">({violation.kind})</span>
                      </span>
                      <span className="shrink-0 text-[8.5px] uppercase tracking-wide text-[var(--muted-dim)]">undeclared</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] p-2.5">
              <p className="flex items-center gap-1.5 text-[9.5px] text-[var(--muted-dim)]">
                <MapPin size={10} aria-hidden /> operating window{" "}
                {String(allowed ? agent.manifest.spec.operatingHours.start : 0).padStart(2, "0")}:00–
                {String(agent.manifest.spec.operatingHours.end).padStart(2, "0")}:00 UTC · max depth{" "}
                {agent.manifest.spec.maxCallDepth}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="mb-3 grid gap-3 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHead
            eyebrow="Last 36 hours"
            title="Session timeline"
            subtitle="Rounded bars are agent sessions; length maps to duration, colour maps to session risk."
            right={<span className="chip">{sessions.length} sessions</span>}
          />
          <div className="px-6 pb-6">
            <GanttTimeline
              sessions={sessions}
              people={store.agents.map((candidate) => ({
                initials: candidate.owner.initials,
                color: candidate.owner.color,
                name: candidate.id,
              }))}
            />
          </div>
        </Card>

        <Card className="xl:col-span-4">
          <CardHead eyebrow="Response" title="Containment ladder" subtitle="Restrict surgically, then verify legitimate calls still pass." />
          <div className="px-5 pb-5">
            <ContainmentLadder
              agentId={agent.id}
              agentName={agent.name}
              level={agent.containment}
              allowed={{
                tools: allowed.tools,
                dataClasses: allowed.dataClasses,
                destinations: allowed.destinations,
              }}
              canApply={canApply}
            />
          </div>
        </Card>
      </div>

      <div className="mb-3 grid gap-3 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <CardHead eyebrow="Tool × data" title="Access heatmap" subtitle="A tool call followed by a data read within five steps." />
          <div className="px-6 pb-6">
            {matrix.tools.length === 0 || matrix.dataClasses.length === 0 ? (
              <EmptyState title="No tool/data pairs" description="This agent has not produced paired tool and data events yet." />
            ) : (
              <div className="overflow-x-auto">
                <div className="grid gap-1" style={{ gridTemplateColumns: `96px repeat(${matrix.dataClasses.length}, 1fr)` }}>
                  <span />
                  {matrix.dataClasses.map((dataClass) => (
                    <span
                      key={dataClass}
                      className="truncate text-center text-[8px] uppercase tracking-wide text-[var(--muted-dim)]"
                      title={dataClass}
                    >
                      {dataClass.split(".").slice(-1)[0]}
                    </span>
                  ))}
                  {matrix.tools.map((tool, rowIndex) => (
                    <div key={tool} className="contents">
                      <span className="truncate pr-2 text-[9px] text-[var(--muted)]" title={tool}>{tool}</span>
                      {matrix.dataClasses.map((dataClass, colIndex) => {
                        const value = matrix.cells[rowIndex]?.[colIndex] ?? 0;
                        const intensity = value / matrix.max;
                        return (
                          <button
                            key={`${tool}-${dataClass}`}
                            type="button"
                            className="flex h-8 items-center justify-center rounded-lg border border-transparent transition-colors hover:border-[var(--line-strong)]"
                            title={`${tool} → ${dataClass}: ${value} co-occurrences`}
                          >
                            <span
                              className="rounded-full"
                              style={{
                                width: 10 + intensity * 10,
                                height: 10 + intensity * 10,
                                background: value === 0 ? "var(--line)" : intensity > 0.6 ? "var(--orange)" : "var(--lime)",
                                opacity: value === 0 ? 0.7 : 0.35 + intensity * 0.65,
                              }}
                            />
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[9px] text-[var(--muted-dim)]">
                  {matrix.tools.length} tools × {matrix.dataClasses.length} data classes · peak {matrix.max} co-occurrences
                </p>
              </div>
            )}
          </div>
        </Card>

        <Card className="xl:col-span-4">
          <CardHead eyebrow="Network" title="Destination map" subtitle="Allowlisted egress inside the ring; unapproved calls outside." />
          <div className="px-6 pb-6">
            <DestinationMap entries={destinations} />
          </div>
        </Card>

        <Card className="xl:col-span-3">
          <CardHead eyebrow="Propagation" title="Blast radius" subtitle="Who received this agent's outputs." />
          <div className="px-4 pb-5">
            <BlastRadiusMap nodes={radius} />
            <div className="mt-2 rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] p-2.5">
              <p className="text-[9px] leading-relaxed text-[var(--muted)]">
                {radius.length > 1
                  ? `${radius.length - 1} downstream agent${radius.length === 2 ? "" : "s"} within ${Math.max(...radius.map((node) => node.depth))} hop${Math.max(...radius.map((node) => node.depth)) === 1 ? "" : "s"}.`
                  : "No downstream delegation observed in the last 14 days."}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="mb-3 grid gap-3 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHead
            eyebrow="Causal evidence"
            title="Taint thread"
            subtitle={taint ? "Untrusted input followed by out-of-role behavior." : "No untrusted input is causally linked to current behavior."}
          />
          <div className="px-5 pb-5">
            {taint ? (
              <>
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] p-3">
                  <div className="mb-2 flex items-center gap-2 text-[10px] text-[var(--orange)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--orange)]" />
                    taint source · {taint.trust}
                  </div>
                  <p className="text-[12px] font-medium">{taint.sourceName}</p>
                  <p className="mt-1 text-[10px] text-[var(--muted)]">
                    First seen {formatTime(taint.startedAt)} UTC · reached{" "}
                    {taint.nodes.filter((node) => node.suspicious).length} out-of-scope actions in {taint.steps} steps
                  </p>
                </div>
                <ol className="mt-3 space-y-1.5">
                  {taint.nodes.map((node, index) => (
                    <li key={node.id} className="flex items-start gap-3 rounded-xl px-2 py-1.5 hover:bg-[var(--panel-soft)]">
                      <span className="metric-sm mt-0.5 w-10 shrink-0 text-[9px] text-[var(--muted-dim)]">{formatTime(node.ts)}</span>
                      <span
                        className="mt-1 h-2 w-2 shrink-0 rounded-full"
                        style={{
                          background: node.suspicious ? "var(--red)" : node.kind === "source" ? "var(--orange)" : "var(--muted-dim)",
                        }}
                      />
                      <div className="min-w-0">
                        <p className={`text-[11px] ${node.suspicious ? "text-[var(--orange)]" : "text-[var(--text-soft)]"}`}>
                          {node.label}
                        </p>
                        <p className="text-[8.5px] uppercase tracking-wide text-[var(--muted-dim)]">
                          step {index + 1} · {node.kind}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
                {topAlert ? (
                  <Link href={`/evidence?alert=${topAlert.id}`} className="mt-3 inline-flex items-center gap-1 text-[10.5px] text-[var(--lime)]">
                    Open full evidence explorer <ArrowRight size={11} aria-hidden />
                  </Link>
                ) : null}
              </>
            ) : (
              <EmptyState title="Clean causal trail" description="No untrusted content precedes the current behavior window." />
            )}
          </div>
        </Card>

        <Card className="xl:col-span-4">
          <CardHead eyebrow="Registry data" title="Role manifest" right={<Link href={`/roles?agent=${agent.id}`} className="chip hover:border-[var(--line-strong)]">Edit</Link>} />
          <div className="space-y-3 px-6 pb-6">
            <div>
              <p className="eyebrow mb-1.5">Allowed tools</p>
              <div className="flex flex-wrap gap-1">
                {allowed.tools.map((tool) => <span key={tool} className="chip !px-2 !py-0.5 !text-[9px]">{tool}</span>)}
              </div>
            </div>
            <div>
              <p className="eyebrow mb-1.5">Destinations</p>
              <div className="flex flex-wrap gap-1">
                {allowed.destinations.map((destination) => <span key={destination} className="chip !px-2 !py-0.5 !text-[9px]">{destination}</span>)}
              </div>
            </div>
            <div>
              <p className="eyebrow mb-1.5">Runtime tokens</p>
              {agent.tokens.map((token) => (
                <div key={token.id} className="flex items-center gap-2 rounded-xl border border-[var(--line)] px-2.5 py-2">
                  <KeyRound size={12} className="text-[var(--lime)]" aria-hidden />
                  <span className="text-[10px] text-[var(--text-soft)]">{token.label}</span>
                  <span className="ml-auto text-[8.5px] text-[var(--muted-dim)]">used {relativeTime(token.lastUsed)}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="eyebrow mb-1.5">Activity · 7 × 24h</p>
              <DotMatrix counts={activity.counts} cols={24} rows={7} hue="mixed" cell={5} gap={4} label="Agent activity density" />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHead eyebrow="History" title="Alerts for this agent" right={<Link href="/alerts" className="chip">Queue</Link>} />
          <div className="px-3 pb-4">
            {alerts.length === 0 ? (
              <EmptyState title="No alerts" description="This agent has not crossed the review threshold." />
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {alerts.map((alert) => (
                  <li key={alert.id}>
                    <Link href={`/alerts?alert=${alert.id}`} className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-[var(--panel-hi)]">
                      <span className="metric-sm w-8 text-[14px] font-bold" style={{ color: alert.severity === "critical" ? "var(--red)" : "var(--orange)" }}>{alert.score}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11.5px]">{alert.title}</p>
                        <p className="text-[9.5px] text-[var(--muted)]">
                          {formatDateTime(alert.ts)} · {alert.status}
                          {alert.classification ? ` · ${alert.classification.replace("_", " ")}` : ""}
                        </p>
                      </div>
                      <SeverityBadge severity={alert.severity} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="xl:col-span-4">
          <CardHead eyebrow="Change management" title="Approved changes" />
          <div className="px-5 pb-5">
            {changes.length === 0 ? (
              <p className="text-[10.5px] text-[var(--muted)]">No change events. Expectation follows the learned baseline only.</p>
            ) : (
              <ul className="space-y-2">
                {changes.map((change) => (
                  <li key={change.id} className="rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[8.5px] uppercase tracking-wide text-[var(--muted-dim)]">{change.type}</span>
                      <span className={`chip !px-1.5 !py-0 !text-[8px] ${change.status === "active" ? "chip-lime" : ""}`}>{change.status}</span>
                    </div>
                    <p className="mt-1 text-[10.5px] font-medium">{change.title}</p>
                    <p className="mt-0.5 text-[9px] text-[var(--muted-dim)]">{formatDateTime(change.at)} · {change.approvedBy} · {change.graceHours}h grace</p>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--line)] p-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--lime-soft)] text-[var(--lime)]"><Sparkles size={13} aria-hidden /></span>
              <div>
                <p className="text-[10px] font-medium">Drift pulse</p>
                <p className="text-[9px] text-[var(--muted-dim)]">median {baseline.sampleCount.toLocaleString()} events</p>
              </div>
              <span className="ml-auto w-16">
                <Sparkline values={baseline.alignmentSeries.slice(-12).map((point) => point.score)} color="var(--lime)" height={22} area={false} id={`detail-${agent.id}`} />
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
