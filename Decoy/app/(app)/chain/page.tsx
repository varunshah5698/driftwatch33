import Link from "next/link";
import { ArrowRight, GitBranch, Network, ShieldAlert } from "lucide-react";
import { Card, CardHead, PageHeader, StatusPill } from "@/components/ui";
import { AgentGraph } from "@/components/agent-graph";
import { BlastRadiusMap } from "@/components/visuals";
import { FilterMenu } from "@/components/filters";
import { blastRadius, getStore, securityGraph } from "@/lib/store";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Agent chains" };

export default async function ChainPage({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string }>;
}) {
  const params = await searchParams;
  const store = getStore();
  const graph = securityGraph();
  const focusAgent =
    store.agents.find((agent) => agent.id === params.agent) ??
    [...store.agents].sort((a, b) => b.openAlerts - a.openAlerts || a.alignment - b.alignment)[0];
  const radius = focusAgent ? blastRadius(focusAgent.id) : [];
  const delegations = store.events
    .filter((event) => event.type === "delegation")
    .sort((a, b) => (a.ts < b.ts ? 1 : -1))
    .slice(0, 12);
  const unknown = delegations.filter(
    (event) => !store.agents.some((agent) => agent.id === event.targetAgentId),
  );
  const focusOptions = [...store.agents]
    .sort((a, b) => b.openAlerts - a.openAlerts || a.alignment - b.alignment)
    .slice(0, 10)
    .map((agent) => ({
      label: `${agent.name}`,
      value: agent.id,
      href: `/chain?agent=${agent.id}`,
    }));

  return (
    <div>
      <PageHeader
        eyebrow="Delegation · propagation"
        title="Agent Chains"
        description="Authority blurs when one agent calls another. This graph is built from signed delegation and tool events, then highlighted with blast radius so a compromise stops looking like a single node."
        meta={
          <>
            <span className="chip chip-lime">{graph.nodes.filter((node) => node.kind === "agent").length} agent nodes</span>
            <span className="chip">{graph.links.filter((link) => link.kind === "delegation").length} delegation edges</span>
            <span className="chip chip-red">{unknown.length} unregistered targets</span>
            <span className="chip">last 7 days</span>
          </>
        }
        actions={
          <FilterMenu
            label="Focus agent"
            value={focusAgent?.name ?? "none"}
            options={focusOptions}
          />
        }
      />

      <div className="grid gap-3 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHead
            eyebrow="Call topology"
            title="Live chain graph"
            subtitle="Edges animate by call volume. Delegation is dashed orange, tool calls grey, unapproved egress red."
            right={<span className="chip"><Network size={10} aria-hidden /> force layout</span>}
          />
          <div className="px-4 pb-4">
            <AgentGraph nodes={graph.nodes} links={graph.links} focusId={focusAgent?.id} />
          </div>
        </Card>

        <div className="space-y-3 xl:col-span-4">
          <Card>
            <CardHead
              eyebrow="Blast radius"
              title={focusAgent?.name ?? "No focus"}
              subtitle={`${radius.length - 1} downstream agent${radius.length === 2 ? "" : "s"} in the last 14 days.`}
              right={focusAgent ? <StatusPill status={focusAgent.status} /> : undefined}
            />
            <div className="px-5 pb-4">
              <BlastRadiusMap nodes={radius} />
              <div className="mt-2 space-y-1">
                {radius.filter((node) => node.depth > 0).map((node) => (
                  <div key={node.agentId} className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] px-2.5 py-2 text-[10.5px]">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--orange)]" />
                    <span className="min-w-0 flex-1 truncate">{node.name}</span>
                    <span className="shrink-0 text-[var(--muted-dim)]">{node.depth} hop{node.depth === 1 ? "" : "s"}</span>
                    <span className="chip shrink-0 !px-1.5 !py-0 !text-[9px]">sens {node.sensitivity}</span>
                  </div>
                ))}
                {radius.length <= 1 ? (
                  <p className="rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] px-2.5 py-2.5 text-[10.5px] leading-relaxed text-[var(--muted)]">
                    No downstream delegation observed. The agent still reaches{" "}
                    {graph.links.filter((link) => link.source === focusAgent?.id).length} tool or egress nodes.
                  </p>
                ) : null}
              </div>
              {focusAgent ? (
                <Link href={`/agents/${focusAgent.id}`} className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--lime)]">
                  Open agent detail <ArrowRight size={11} aria-hidden />
                </Link>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHead eyebrow="Risk" title="Why chains matter" />
            <div className="px-5 pb-5">
              <p className="text-[11.5px] leading-relaxed text-[var(--muted)]">
                A compromised agent can pass a poisoned instruction to a peer with more authority.
                Driftwatch resolves each hop to a registered identity, checks the approved
                delegation graph and keeps the downstream reach visible during containment.
              </p>
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] p-2.5">
                <ShieldAlert size={13} className="mt-0.5 shrink-0 text-[var(--orange)]" aria-hidden />
                <p className="text-[10.5px] leading-relaxed text-[var(--muted)]">
                  Unknown targets such as <span className="text-[var(--orange)]">agent-ghost-7</span> are
                  rendered as ghost nodes, flagged as unregistered, and blocked by policy pol-105.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-3">
        <CardHead
          eyebrow="Recent delegations"
          title="Delegation ledger"
          subtitle="Each hop carries the calling agent, the target, depth, and whether the target is registered."
        />
        <div className="scroll-x px-5 pb-5">
          <table className="w-full min-w-[680px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[var(--line)] text-[9.5px] uppercase tracking-[0.08em] text-[var(--muted-dim)]">
                <th className="py-2.5 pr-4 font-medium">Time</th>
                <th className="py-2.5 pr-4 font-medium">From</th>
                <th className="py-2.5 pr-4 font-medium">Target</th>
                <th className="py-2.5 pr-4 font-medium">Depth</th>
                <th className="py-2.5 pr-4 font-medium">Registry</th>
                <th className="py-2.5 font-medium">Approved</th>
              </tr>
            </thead>
            <tbody>
              {delegations.map((event) => {
                const source = store.agents.find((agent) => agent.id === event.agentId);
                const target = store.agents.find((agent) => agent.id === event.targetAgentId);
                return (
                  <tr key={event.id} className="border-b border-[var(--line)] text-[11px] transition-colors last:border-0 hover:bg-[var(--panel-hi)]">
                    <td className="py-3 pr-4 text-[var(--muted-dim)]">{formatDateTime(event.ts)}</td>
                    <td className="py-3 pr-4">
                      <Link href={`/agents/${event.agentId}`} className="hover:text-[var(--lime)]">
                        {source?.name ?? event.agentId}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-[var(--text-soft)]">
                      <span className="inline-flex items-center gap-1.5">
                        <GitBranch size={11} className="text-[var(--orange)]" aria-hidden />
                        {target?.name ?? event.targetAgentId}
                      </span>
                    </td>
                    <td className="py-3 pr-4 metric-sm">{event.callDepth ?? 1}</td>
                    <td className="py-3 pr-4">
                      {target ? <span className="chip chip-lime !px-1.5 !py-0 !text-[9px]">registered</span> : <span className="chip chip-red !px-1.5 !py-0 !text-[9px]">unknown</span>}
                    </td>
                    <td className="py-3">
                      {source?.manifest.spec.approvedDelegates.includes(event.targetAgentId ?? "") || (event.callDepth ?? 1) <= (source?.manifest.spec.maxCallDepth ?? 1) ? (
                        <span className="text-[10.5px] text-[var(--lime)]">within policy</span>
                      ) : (
                        <span className="text-[10.5px] text-[var(--red)]">blocked by pol-105</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
