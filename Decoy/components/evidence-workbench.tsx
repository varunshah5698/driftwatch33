"use client";

import { useState } from "react";
import { ArrowRight, Bot, Loader2, Send, Sparkles, Target } from "lucide-react";
import { EvidenceScene, type SceneNode } from "@/components/evidence-scene";
import type { AgentEvent, TaintNode } from "@/lib/types";
import { formatDateTime } from "@/lib/format";

/** The case file the analyst model answers from. */
export interface AiContext {
  alertTitle: string;
  severity: string;
  score: number;
  confidence: number;
  agent: string;
  role: string;
  factors: { label: string; points: number; detail: string }[];
  source: string;
  chain: string[];
  violations: string[];
  suggestedAction: string;
}

const PROMPTS = [
  "Why is this out of role?",
  "What data left the boundary?",
  "What should I do first?",
];

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--line)] py-2 last:border-b-0">
      <span className="text-[9.5px] uppercase tracking-[0.14em] text-[var(--muted-dim)]">{label}</span>
      <span className="truncate text-right text-[11px] text-[var(--text-soft)]">{value}</span>
    </div>
  );
}

function Analysis({ text }: { text: string }) {
  return (
    <div className="space-y-3">
      {text.split(/\n(?=## )/).map((block, index) => {
        const [heading, ...rest] = block.split("\n");
        const body = rest.join("\n").trim();
        return (
          <div key={index}>
            {heading.startsWith("## ") ? (
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--lime)]">
                {heading.replace("## ", "")}
              </p>
            ) : null}
            <p className="text-[11.5px] leading-relaxed text-[var(--text-soft)] whitespace-pre-wrap">
              {body || heading}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function EvidenceWorkbench({
  nodes,
  events,
  context,
}: {
  nodes: TaintNode[];
  events: AgentEvent[];
  context: AiContext;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scene: SceneNode[] = nodes.map((node) => ({
    label: node.label,
    source: node.kind === "source",
    suspicious: Boolean(node.suspicious),
    kind: node.kind,
  }));

  const active = selected != null ? nodes[selected] : null;
  const activeEvent = active?.eventId ? events.find((event) => event.id === active.eventId) : undefined;

  async function ask(text: string) {
    const prompt = text.trim();
    if (!prompt || busy) return;
    setBusy(true);
    setError(null);
    setQuestion("");
    setAnswer("");
    try {
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: active
            ? `${prompt}\n\nSelected step ${selected! + 1}: ${active.label} (${active.kind})${
                active.suspicious ? " — flagged out of role" : ""
              }`
            : prompt,
          context,
        }),
      });
      const payload = (await response.json()) as { answer?: string; error?: string };
      if (!response.ok || !payload.answer) throw new Error(payload.error ?? "The analyst did not answer.");
      setAnswer(payload.answer);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The analyst request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-3 grid items-start gap-3 xl:grid-cols-12">
      {/* ---------------------------------------------------- 3D taint globe */}
      <section className="relative overflow-hidden rounded-[22px] border border-[var(--line)] bg-[linear-gradient(180deg,var(--panel-hi),var(--panel-soft))] xl:col-span-8">
        <div className="flex flex-wrap items-center gap-2 px-5 pt-4">
          <span className="chip chip-orange">
            <Target size={11} aria-hidden /> taint chain
          </span>
          <span className="text-[11px] text-[var(--muted)]">
            {nodes.length} steps · {context.source}
          </span>
          <span className="ml-auto text-[10px] text-[var(--muted-dim)]">
            {active ? `step ${selected! + 1} selected` : "tap any node to inspect"}
          </span>
        </div>

        <EvidenceScene
          className="h-[440px] w-full sm:h-[560px]"
          nodes={scene}
          selected={selected}
          onSelect={setSelected}
        />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end gap-4 bg-gradient-to-t from-[var(--panel)] via-[var(--panel)]/85 to-transparent px-5 pb-4 pt-12">
          <div>
            <p className="text-[9.5px] uppercase tracking-[0.16em] text-[var(--muted-dim)]">untrusted source</p>
            <p className="mt-1 max-w-[34ch] truncate text-[13px] font-semibold">{context.source}</p>
          </div>
          <div className="ml-auto flex items-center gap-5">
            {[
              { label: "causal hops", value: String(nodes.length - 1), tone: "var(--text)" },
              {
                label: "out of role",
                value: String(nodes.filter((node) => node.suspicious).length),
                tone: "var(--red)",
              },
              { label: "risk", value: `${context.score}`, tone: "var(--orange)" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-[9.5px] uppercase tracking-[0.16em] text-[var(--muted-dim)]">{stat.label}</p>
                <p className="metric-sm mt-1 text-[21px] font-semibold leading-none" style={{ color: stat.tone }}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------ detail + AI side rail */}
      <aside className="flex flex-col gap-3 xl:col-span-4">
        {/* tap-to-inspect */}
        <section className="rounded-[22px] border border-[var(--line)] bg-[var(--panel-soft)]">
          <div className="flex items-center gap-2 border-b border-[var(--line)] px-5 py-3">
            <Sparkles size={13} className="text-[var(--lime)]" aria-hidden />
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em]">Node detail</h3>
            {active ? (
              <span className="chip ml-auto !py-0.5 !text-[9px]">
                step {selected! + 1} / {nodes.length}
              </span>
            ) : null}
          </div>

          {!active ? (
            <div className="px-5 py-8 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line-strong)] text-[var(--muted-dim)]">
                <Target size={17} aria-hidden />
              </div>
              <p className="mt-3 text-[11.5px] leading-relaxed text-[var(--muted)]">
                Tap a node on the globe to inspect that step: what it touched, whether it stayed in role, and
                what the analyst makes of it.
              </p>
            </div>
          ) : (
            <div className="px-5 py-4">
              <p
                className="text-[13px] font-semibold leading-snug"
                style={{ color: active.suspicious ? "var(--red)" : "var(--text)" }}
              >
                {active.label}
              </p>
              <div className="mt-3">
                <Field label="kind" value={active.kind} />
                <Field label="time" value={`${formatDateTime(active.ts)} UTC`} />
                <Field label="trust" value={active.trust ?? "unknown"} />
                <Field label="role" value={active.suspicious ? "out of role" : "inside declared role"} />
                {activeEvent ? <Field label="tool" value={activeEvent.tool ?? "—"} /> : null}
                {activeEvent?.destination ? <Field label="destination" value={activeEvent.destination} /> : null}
                {activeEvent?.dataClass ? <Field label="data class" value={activeEvent.dataClass} /> : null}
                {activeEvent?.bytes ? <Field label="egress" value={`${activeEvent.bytes} bytes`} /> : null}
              </div>
              {activeEvent?.summary ? (
                <p className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[10.5px] leading-relaxed text-[var(--muted)]">
                  {activeEvent.summary}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => ask("Explain this step and what it means for the incident.")}
                className="pill mt-3 w-full justify-center !h-9 !text-[11.5px]"
                disabled={busy}
              >
                {busy ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Bot size={13} aria-hidden />}
                Explain this step
              </button>
            </div>
          )}
        </section>

        {/* the analyst */}
        <section className="rounded-[22px] border border-[var(--line)] bg-[var(--panel-soft)]">
          <div className="flex items-center gap-2 border-b border-[var(--line)] px-5 py-3">
            <Bot size={13} className="text-[var(--orange)]" aria-hidden />
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em]">AI analyst</h3>
            <span className="chip ml-auto !py-0.5 !text-[9px]">deepseek v4.1</span>
          </div>

          <div className="px-5 py-4">
            {!answer && !busy && !error ? (
              <div>
                <p className="text-[11px] leading-relaxed text-[var(--muted)]">
                  Ask anything about this alert. The model sees the score breakdown, the taint chain and every
                  role violation recorded on it.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => ask(prompt)}
                      className="pill !h-8 !px-3 !text-[10.5px]"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {busy ? (
              <p className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
                <Loader2 size={13} className="animate-spin" aria-hidden /> reading the case file…
              </p>
            ) : null}

            {error ? (
              <p className="rounded-xl border border-[color-mix(in_srgb,var(--red)_45%,transparent)] bg-[var(--red-soft)] px-3 py-2 text-[11px] leading-relaxed text-[var(--red)]">
                {error}
              </p>
            ) : null}

            {answer ? <Analysis text={answer} /> : null}
          </div>

          <form
            className="flex items-center gap-2 border-t border-[var(--line)] px-3 py-2.5"
            onSubmit={(event) => {
              event.preventDefault();
              ask(question);
            }}
          >
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask about this incident…"
              aria-label="Ask the AI analyst"
              className="min-w-0 flex-1 bg-transparent px-2 text-[11.5px] text-[var(--text)] outline-none placeholder:text-[var(--muted-dim)]"
            />
            <button
              type="submit"
              className="icon-btn h-8 w-8 shrink-0"
              disabled={busy || !question.trim()}
              aria-label="Send question"
            >
              {busy ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Send size={13} aria-hidden />}
            </button>
          </form>
        </section>

        {/* jump to the full record */}
        <a href="#timeline" className="pill !h-9 justify-center !text-[11px]">
          Full event timeline <ArrowRight size={12} aria-hidden />
        </a>
      </aside>
    </div>
  );
}
