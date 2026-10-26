import type {
  Agent,
  AgentEvent,
  Alert,
  AlertClassification,
  AlertStatus,
  AuditEntry,
  BlastRadiusNode,
  ChangeEvent,
  Factor,
  Incident,
  RoleManifest,
  User,
} from "@/lib/types";
import { createSeed, type StoreData } from "@/lib/data/seed";
import { appendAudit } from "@/lib/engine/audit";
import { evaluateAgent } from "@/lib/engine/detect";
import { ALERT_THRESHOLD, sensitivityOf } from "@/lib/domain";
import { templateById } from "@/lib/data/roles";
import { buildManifest, createEventFactory, makeAgent, mulberry32, pick, randomInt } from "@/lib/data/generate";

const globalStore = globalThis as unknown as {
  __driftwatchStore?: StoreData;
  __driftwatchEventSeq?: { value: number };
};

export function getStore(): StoreData {
  if (!globalStore.__driftwatchStore) {
    globalStore.__driftwatchStore = createSeed();
    globalStore.__driftwatchEventSeq = {
      value: globalStore.__driftwatchStore.events.length + 10_000,
    };
  }
  return globalStore.__driftwatchStore;
}

export function resetStore(): StoreData {
  globalStore.__driftwatchStore = createSeed();
  globalStore.__driftwatchEventSeq = {
    value: globalStore.__driftwatchStore.events.length + 10_000,
  };
  return globalStore.__driftwatchStore;
}

/* ---------------------------------------------------------------- selectors */

export const getAgent = (id: string): Agent | undefined =>
  getStore().agents.find((agent) => agent.id === id);

export const getAlert = (id: string): Alert | undefined =>
  getStore().alerts.find((alert) => alert.id === id);

export const getIncident = (id: string): Incident | undefined =>
  getStore().incidents.find((incident) => incident.id === id);

export const agentEvents = (agentId: string, sinceMs?: number): AgentEvent[] => {
  const since = sinceMs ? new Date(Date.now() - sinceMs).toISOString() : undefined;
  return getStore()
    .events.filter((event) => event.agentId === agentId && (!since || event.ts >= since))
    .sort((a, b) => (a.ts < b.ts ? -1 : 1));
};

export const recentEvents = (limit = 60): AgentEvent[] =>
  [...getStore().events].sort((a, b) => (a.ts < b.ts ? 1 : -1)).slice(0, limit);

export const agentAlerts = (agentId: string): Alert[] =>
  getStore()
    .alerts.filter((alert) => alert.agentId === agentId)
    .sort((a, b) => (a.ts < b.ts ? 1 : -1));

export const changesForAgent = (agentId: string): ChangeEvent[] =>
  getStore()
    .changeEvents.filter((change) => change.agentId === agentId)
    .sort((a, b) => (a.at < b.at ? 1 : -1));

export function fleetAlignment(): number {
  const agents = getStore().agents.filter((agent) => agent.status !== "retired");
  if (agents.length === 0) return 100;
  return Math.round(agents.reduce((total, agent) => total + agent.alignment, 0) / agents.length);
}

export function overview() {
  const store = getStore();
  const openIncidents = store.incidents.filter((incident) => incident.status === "open");
  const active = store.agents.filter((agent) =>
    ["active", "learning", "degraded"].includes(agent.status),
  );
  const atRisk = store.agents.filter(
    (agent) =>
      agent.alignment < 70 ||
      agent.openAlerts > 0 ||
      agent.containment >= 3 ||
      agent.status === "quarantined" ||
      agent.status === "isolated",
  );
  const labels = store.feedback.truePositives + store.feedback.falsePositives;
  const falsePositiveRate = labels
    ? (store.feedback.falsePositives / labels) * 100
    : 0;
  const openAlerts = store.alerts.filter((alert) =>
    ["open", "acknowledged", "escalated"].includes(alert.status),
  );
  const criticalAlerts = openAlerts.filter((alert) => alert.severity === "critical");

  return {
    activeAgents: active.length,
    totalAgents: store.agents.length,
    agentsAtRisk: atRisk.length,
    openIncidents: openIncidents.length,
    totalIncidents: store.incidents.length,
    openAlerts: openAlerts.length,
    criticalAlerts: criticalAlerts.length,
    fleetAlignment: fleetAlignment(),
    mttfMinutes: store.metrics.mttfMinutes,
    falsePositiveRate,
    feedbackLabels: labels,
    eventsIngested24h: store.metrics.eventsIngested24h,
    detectionP50Seconds: store.metrics.detectionP50Seconds,
    coveragePercent: store.metrics.coveragePercent,
    trend: store.fleetTrend,
    atRiskAgents: [...store.agents]
      .sort((a, b) => b.openAlerts - a.openAlerts || a.alignment - b.alignment)
      .slice(0, 6),
    incidents: openIncidents,
    latestAlerts: [...openAlerts].sort((a, b) => b.score - a.score).slice(0, 5),
  };
}

/* -------------------------------------------------------------- alert ops */

export function triageAlert(
  alertId: string,
  input: {
    status?: AlertStatus;
    classification?: AlertClassification;
    assignee?: string;
    actor: string;
  },
): Alert | undefined {
  const store = getStore();
  const alert = store.alerts.find((candidate) => candidate.id === alertId);
  if (!alert) return undefined;
  if (input.status) alert.status = input.status;
  if (input.classification) {
    alert.classification = input.classification;
    if (input.classification !== "true_positive") {
      alert.status = "resolved";
    }
    // Feedback loop: labelled outcomes adjust the seeded calibration counters.
    if (input.classification === "false_positive") store.feedback.falsePositives += 1;
    else if (input.classification === "true_positive") store.feedback.truePositives += 1;
    else store.feedback.benignChanges += 1;
  }
  if (input.assignee) alert.assignee = input.assignee;
  appendAudit(store.audit, {
    actor: input.actor,
    actorType: "human",
    action: input.classification ? `alert.classify.${input.classification}` : `alert.${input.status ?? "update"}`,
    target: alert.id,
    detail: `${alert.title} on ${alert.agentName}`,
  });
  return alert;
}

export function escalateAlert(alertId: string, actor: string): Alert | undefined {
  const store = getStore();
  const alert = store.alerts.find((candidate) => candidate.id === alertId);
  if (!alert) return undefined;
  alert.status = "escalated";
  alert.assignee = actor;
  const incident = store.incidents.find((candidate) => candidate.id === alert.incidentId);
  if (incident) {
    incident.status = "open";
    incident.updatedAt = new Date().toISOString();
    if (!incident.alertIds.includes(alert.id)) incident.alertIds.push(alert.id);
  }
  appendAudit(store.audit, {
    actor,
    actorType: "human",
    action: "alert.escalate",
    target: alert.id,
    detail: `Escalated ${alert.severity} alert for ${alert.agentName}`,
  });
  return alert;
}

export function setContainment(
  agentId: string,
  level: number,
  actor: string,
  reason?: string,
): Agent | undefined {
  const store = getStore();
  const agent = store.agents.find((candidate) => candidate.id === agentId);
  if (!agent) return undefined;
  const previous = agent.containment;
  agent.containment = Math.max(0, Math.min(5, level));
  agent.containmentUpdatedAt = new Date().toISOString();
  agent.status =
    level >= 5
      ? "isolated"
      : level >= 4
        ? "quarantined"
        : level >= 2
          ? "degraded"
          : "active";

  const alerts = store.alerts.filter(
    (alert) => alert.agentId === agentId && ["open", "acknowledged"].includes(alert.status),
  );
  if (level >= 3) {
    for (const alert of alerts) alert.status = "acknowledged";
    const incident = store.incidents.find((candidate) => candidate.agentIds.includes(agentId));
    if (incident && level === 5) incident.status = "contained";
  }

  const labels = ["monitor", "notify", "step-up", "restrict", "quarantine", "isolate"];
  appendAudit(store.audit, {
    actor,
    actorType: level > previous ? "human" : "human",
    action: level > previous ? `containment.${labels[agent.containment]}` : "containment.deescalate",
    target: agent.id,
    detail:
      reason ??
      `Containment ${labels[previous] ?? "monitor"} → ${labels[agent.containment]} for ${agent.name}`,
  });
  return agent;
}

/* ----------------------------------------------------------- registry ops */

export function registerAgent(input: {
  name: string;
  templateId: string;
  environment: Agent["environment"];
  ownerId: string;
  actor: string;
}): Agent {
  const store = getStore();
  const template = templateById(input.templateId);
  const owner =
    store.agents.flatMap((agent) => [agent.owner]).find((candidate) => candidate.id === input.ownerId) ??
    store.agents[0].owner;
  const index = store.agents.filter((agent) => agent.roleTemplate === template.id).length + 1;
  const manifest = buildManifest(input.name, template, {
    environment: input.environment,
    version: "2026.10.1",
    updatedAt: new Date().toISOString(),
    updatedBy: input.actor,
  });
  const agent = makeAgent({
    id: `agt-${template.id}-${index}-${Date.now().toString(36).slice(-4)}`,
    name: input.name,
    template,
    owner,
    environment: input.environment,
    status: "learning",
    createdAt: new Date().toISOString(),
    manifest,
  });
  agent.confidence = 0.2;
  agent.learningProgress = 0.05;
  agent.alignment = 92;
  agent.status = "learning";
  store.agents.push(agent);
  appendAudit(store.audit, {
    actor: input.actor,
    actorType: "human",
    action: "agent.register",
    target: agent.id,
    detail: `Registered ${agent.name} on ${template.name} template (cold start, priors applied)`,
  });
  return agent;
}

export function updateManifest(
  agentId: string,
  manifest: RoleManifest,
  actor: string,
): Agent | undefined {
  const store = getStore();
  const agent = store.agents.find((candidate) => candidate.id === agentId);
  if (!agent) return undefined;
  agent.manifest = manifest;
  agent.manifestVersion = manifest.metadata.version;
  appendAudit(store.audit, {
    actor,
    actorType: "human",
    action: "manifest.update",
    target: agent.id,
    detail: `Role manifest ${manifest.metadata.version} applied (${manifest.spec.allowed.dataClasses.length} data classes)`,
  });
  return agent;
}

/* ------------------------------------------------------------- ingestion */

export function appendEvents(agentId: string, events: AgentEvent[]): void {
  const store = getStore();
  store.events.push(...events);
  const agent = store.agents.find((candidate) => candidate.id === agentId);
  if (!agent) return;
  agent.lastSeen = events[events.length - 1]?.ts ?? agent.lastSeen;
  agent.actionsToday += events.length;

  const windowEvents = store.events.filter(
    (event) =>
      event.agentId === agentId &&
      event.ts >= new Date(Date.now() - 36 * 3600_000).toISOString(),
  );
  const alert = evaluateAgent({
    agent,
    manifest: agent.manifest,
    baseline: store.baselines[agentId],
    events: windowEvents,
    changes: store.changeEvents,
  });
  if (
    alert &&
    alert.score >= ALERT_THRESHOLD &&
    !store.alerts.some((existing) => existing.id === alert.id)
  ) {
    store.alerts.unshift(alert);
    agent.openAlerts += 1;
    agent.alignment = Math.round(Math.max(0, 100 - alert.score));
    appendAudit(store.audit, {
      actor: "engine",
      actorType: "system",
      action: "alert.create",
      target: alert.id,
      detail: `${alert.severity} ${alert.title} (${alert.score}/100) for ${agent.name}`,
    });
  }
}

/**
 * Live monitor tick: a handful of benign events are emitted by the fleet.
 * This exercises the same ingestion path rather than faking a ticker.
 */
export function emitLiveEvents(count = 2): AgentEvent[] {
  const store = getStore();
  const rng = mulberry32(Date.now() % 100000);
  const factory = createEventFactory(
    (globalStore.__driftwatchEventSeq?.value ?? store.events.length + 10_000) + count,
  );
  const emitted: AgentEvent[] = [];
  for (let i = 0; i < count; i++) {
    const agent = pick(rng, store.agents.filter((candidate) => candidate.status === "active"));
    const template = templateById(agent.roleTemplate);
    const tool = pick(rng, template.tools);
    const dataClass = pick(rng, template.dataClasses);
    const destination = pick(rng, template.destinations);
    const isEgress = rng() < 0.25;
    const isTool = !isEgress && rng() < 0.5;
    const egressBytes = randomInt(rng, 2_000, 50_000);
    const created = factory.event({
      agent,
      sessionId: `ses-${agent.id}-live`,
      ts: new Date(),
      type: isEgress ? "network.egress" : isTool ? "tool.call" : "data.access",
      action: isEgress ? "send" : "read",
      tool: isEgress || !isTool ? undefined : tool,
      dataClass: isEgress || isTool ? undefined : dataClass,
      destination: isEgress ? destination : undefined,
      bytes: isEgress ? egressBytes : undefined,
      trust: "internal",
      summary: isEgress
        ? `Sent ${(egressBytes / 1024).toFixed(1)} KiB to ${destination}`
        : isTool
          ? `Called ${tool}`
          : `Accessed ${dataClass} (${randomInt(rng, 2, 120)} records)`,
      resultSize: randomInt(rng, 500, 40_000),
    });
    emitted.push(created);
    store.events.push(created);
    agent.lastSeen = created.ts;
    agent.actionsToday += 1;
  }
  if (globalStore.__driftwatchEventSeq) {
    globalStore.__driftwatchEventSeq.value += count;
  }
  return emitted;
}

/* ------------------------------------------------------------ dashboard ops */

export interface GraphNode {
  id: string;
  name: string;
  kind: "agent" | "tool" | "external";
  status: Agent["status"];
  risk: number;
  roleTemplate?: string;
}

export interface GraphLink {
  source: string;
  target: string;
  kind: "delegation" | "tool" | "egress";
  value: number;
}

export function securityGraph(limitTools = 16): { nodes: GraphNode[]; links: GraphLink[] } {
  const store = getStore();
  const delegation = store.events.filter(
    (event) => event.type === "delegation" && event.targetAgentId,
  );
  const involved = new Set<string>();
  delegation.forEach((event) => {
    involved.add(event.agentId);
    if (event.targetAgentId) involved.add(event.targetAgentId);
  });
  const agents = store.agents.filter(
    (agent) =>
      involved.has(agent.id) ||
      agent.openAlerts > 0 ||
      agent.containment >= 3 ||
      agent.alignment < 70,
  );
  const agentIds = new Set(agents.map((agent) => agent.id));

  const linkCounts = new Map<string, GraphLink>();
  const toolCounts = new Map<string, number>();
  for (const event of store.events) {
    if (event.ts < new Date(Date.now() - 7 * 86_400_000).toISOString()) continue;
    if (event.type === "delegation" && event.targetAgentId && agentIds.has(event.agentId)) {
      const target = event.targetAgentId;
      if (!agents.some((agent) => agent.id === target)) {
        // Unknown sub-agent stays visible as a ghost node, flagged by status.
        agents.push({
          ...store.agents[0],
          id: target,
          name: target,
          status: "degraded",
          alignment: 22,
          openAlerts: 1,
          role: "Unregistered sub-agent",
          roleTemplate: "unknown",
          manifest: store.agents[0].manifest,
        });
        agentIds.add(target);
      }
      const key = `${event.agentId}->${target}`;
      const existing = linkCounts.get(key);
      linkCounts.set(key, {
        source: event.agentId,
        target,
        kind: "delegation",
        value: (existing?.value ?? 0) + 1,
      });
    }
    if (event.type === "tool.call" && event.tool && agentIds.has(event.agentId)) {
      toolCounts.set(event.tool, (toolCounts.get(event.tool) ?? 0) + 1);
    }
  }

  const topTools = [...toolCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limitTools);

  const nodes: GraphNode[] = agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    kind: "agent",
    status: agent.status,
    risk: 100 - agent.alignment,
    roleTemplate: agent.roleTemplate,
  }));

  const links: GraphLink[] = [...linkCounts.values()];
  for (const [tool] of topTools) {
    nodes.push({
      id: `tool:${tool}`,
      name: tool,
      kind: "tool",
      status: "active",
      risk: 0,
    });
    for (const agent of agents) {
      const uses = store.events.filter(
        (event) =>
          event.agentId === agent.id &&
          event.tool === tool &&
          event.ts >= new Date(Date.now() - 7 * 86_400_000).toISOString(),
      ).length;
      if (uses > 0) {
        links.push({
          source: agent.id,
          target: `tool:${tool}`,
          kind: "tool",
          value: uses,
        });
      }
    }
  }

  for (const alert of store.alerts.slice(0, 5)) {
    const taint = alert.evidence.taint;
    const destination = alert.evidence.violations.find(
      (violation) => violation.kind === "destination",
    );
    if (!destination) continue;
    const nodeId = `external:${destination.value}`;
    if (!nodes.some((node) => node.id === nodeId)) {
      nodes.push({
        id: nodeId,
        name: destination.value,
        kind: "external",
        status: "degraded",
        risk: alert.score,
      });
      links.push({
        source: alert.agentId,
        target: nodeId,
        kind: "egress",
        value: taint?.nodes.length ?? 1,
      });
    }
  }

  return { nodes, links: links.slice(0, 180) };
}

export function blastRadius(agentId: string, depthLimit = 3): BlastRadiusNode[] {
  const store = getStore();
  const results = new Map<string, BlastRadiusNode>();
  const queue: { id: string; depth: number }[] = [{ id: agentId, depth: 0 }];
  const seen = new Set<string>();
  const recentCutoff = new Date(Date.now() - 14 * 86_400_000).toISOString();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (seen.has(current.id)) continue;
    seen.add(current.id);
    const agent = store.agents.find((candidate) => candidate.id === current.id);
    const events = store.events.filter(
      (event) => event.agentId === current.id && event.ts >= recentCutoff,
    );
    const sensitivity = events.reduce(
      (max, event) =>
        event.type === "data.access"
          ? Math.max(max, sensitivityOf(event.dataClass ?? "public"))
          : max,
      1,
    );
    results.set(current.id, {
      agentId: current.id,
      name: agent?.name ?? current.id,
      depth: current.depth,
      sensitivity,
      status: agent?.status ?? "degraded",
    });
    if (current.depth >= depthLimit) continue;
    const downstream = store.events.filter(
      (event) =>
        event.ts >= recentCutoff &&
        ((event.type === "delegation" && event.agentId === current.id && event.targetAgentId) ||
          (event.type === "delegation" && event.targetAgentId === current.id)),
    );
    for (const event of downstream) {
      const other =
        event.agentId === current.id ? event.targetAgentId : event.agentId;
      if (other && !seen.has(other) && other !== agentId) {
        queue.push({ id: other, depth: current.depth + 1 });
      }
    }
  }

  return [...results.values()].sort((a, b) => a.depth - b.depth);
}

/** 7 days × 24 hours activity density for the dot-matrix grid. */
export function activityGrid(agentId: string): { counts: number[]; max: number } {
  const events = agentEvents(agentId, 7 * 86_400_000);
  const counts = Array(7 * 24).fill(0);
  const now = new Date();
  for (const event of events) {
    const date = new Date(event.ts);
    const dayOffset = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
    if (dayOffset < 0 || dayOffset > 6) continue;
    const slot = (6 - dayOffset) * 24 + date.getUTCHours();
    counts[slot] += 1;
  }
  return { counts, max: Math.max(1, ...counts) };
}

export interface SessionSlice {
  sessionId: string;
  start: string;
  end: string;
  steps: number;
  risk: number;
  delegated: string[];
  tools: string[];
}

export function sessionTimeline(agentId: string): SessionSlice[] {
  const now = Date.now();
  const events = agentEvents(agentId, 36 * 3600_000).filter(
    (event) => new Date(event.ts).getTime() <= now,
  );
  const sessions = new Map<string, AgentEvent[]>();
  for (const event of events) {
    const list = sessions.get(event.sessionId) ?? [];
    list.push(event);
    sessions.set(event.sessionId, list);
  }
  return [...sessions.entries()]
    .map(([sessionId, sessionEvents]) => {
      const sorted = [...sessionEvents].sort((a, b) => (a.ts < b.ts ? -1 : 1));
      const attackSession = sorted.some(
        (event) => event.label === "attack" || event.canary,
      );
      const alert = attackSession
        ? getStore().alerts.find(
            (candidate) => candidate.agentId === agentId && candidate.canary !== undefined,
          ) ?? getStore().alerts.find((candidate) => candidate.agentId === agentId)
        : undefined;
      return {
        sessionId,
        start: sorted[0].ts,
        end: sorted[sorted.length - 1].ts,
        steps: sorted.length,
        risk: attackSession ? alert?.score ?? 92 : 8,
        delegated: sorted
          .filter((event) => event.type === "delegation" && event.targetAgentId)
          .map((event) => event.targetAgentId as string),
        tools: [...new Set(sorted.map((event) => event.tool).filter(Boolean) as string[])],
      };
    })
    .sort((a, b) => (a.start < b.start ? 1 : -1));
}

export function toolDataMatrix(agentId: string): {
  tools: string[];
  dataClasses: string[];
  cells: number[][];
  max: number;
} {
  const events = agentEvents(agentId, 7 * 86_400_000);
  const toolCounts = new Map<string, number>();
  const dataCounts = new Map<string, number>();
  for (const event of events) {
    if (event.tool) toolCounts.set(event.tool, (toolCounts.get(event.tool) ?? 0) + 1);
    if (event.dataClass) dataCounts.set(event.dataClass, (dataCounts.get(event.dataClass) ?? 0) + 1);
  }
  const tools = [...toolCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([tool]) => tool);
  const dataClasses = [...dataCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([dataClass]) => dataClass);
  const cells = tools.map(() => dataClasses.map(() => 0));

  // Heat = a tool call followed by a data access within five steps, i.e. the
  // tool-to-data workflows this agent actually performs.
  events.forEach((event, index) => {
    if (event.type !== "tool.call" || !event.tool) return;
    const toolIndex = tools.indexOf(event.tool);
    if (toolIndex < 0) return;
    const seen = new Set<number>();
    for (let j = index + 1; j <= Math.min(index + 5, events.length - 1); j++) {
      const candidate = events[j];
      if (candidate.type !== "data.access" || !candidate.dataClass) continue;
      const dataIndex = dataClasses.indexOf(candidate.dataClass);
      if (dataIndex >= 0 && !seen.has(dataIndex)) {
        cells[toolIndex][dataIndex] += 1;
        seen.add(dataIndex);
      }
    }
  });

  return {
    tools,
    dataClasses,
    cells,
    max: Math.max(1, ...cells.flat()),
  };
}

export function users(): User[] {
  return getStore().users;
}

/** Palette reused for seeded owners so new accounts match the design system. */
const SIGNUP_COLORS = ["#c9f76f", "#f2a35a", "#8ab4ff", "#b9a4ff", "#7ee0d0", "#ffb3c7"];

/**
 * Register a new console account. New self-serve signups start as Agent Owner:
 * they can register agents and edit manifests, but containment and policy
 * changes stay with analysts and admins.
 */
export function createUser(input: {
  name: string;
  email: string;
  credential: { hash: string; salt: string };
  role?: User["role"];
}): User | { error: string } {
  const store = getStore();
  const email = input.email.trim().toLowerCase();
  if (store.users.some((candidate) => candidate.email.toLowerCase() === email)) {
    return { error: "An account with this email already exists." };
  }

  const initials = input.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "NA";

  const user: User = {
    id: `usr-${Date.now().toString(36)}`,
    name: input.name.trim(),
    email,
    role: input.role ?? "owner",
    initials,
    color: SIGNUP_COLORS[store.users.length % SIGNUP_COLORS.length],
    lastActive: new Date().toISOString(),
  };

  store.users.push(user);
  store.credentials[email] = input.credential;
  appendAudit(store.audit, {
    actor: user.name,
    actorType: "human",
    action: "user.signup",
    target: user.id,
    detail: `Created ${user.role} account ${email} (self-serve signup)`,
  });
  return user;
}

/** Provision an account from a verified Convex/Google identity. */
export function provisionSsoUser(input: {
  email: string;
  name: string;
  provider: "google";
}): User {
  const store = getStore();
  const email = input.email.trim().toLowerCase();
  const existing = store.users.find((candidate) => candidate.email.toLowerCase() === email);
  if (existing) {
    existing.lastActive = new Date().toISOString();
    return existing;
  }

  const initials =
    input.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "NA";
  const user: User = {
    id: `usr-sso-${Date.now().toString(36)}`,
    name: input.name.trim() || email.split("@")[0],
    email,
    role: "owner",
    initials,
    color: SIGNUP_COLORS[store.users.length % SIGNUP_COLORS.length],
    lastActive: new Date().toISOString(),
  };
  store.users.push(user);
  appendAudit(store.audit, {
    actor: user.name,
    actorType: "human",
    action: "user.sso_provision",
    target: user.id,
    detail: `Provisioned ${email} via ${input.provider} (SSO)`,
  });
  return user;
}

export function auditEntries(): AuditEntry[] {
  return [...getStore().audit].sort((a, b) => b.seq - a.seq);
}

export function factorTotal(factors: Factor[]): number {
  return factors.reduce((total, factor) => total + factor.points, 0);
}
