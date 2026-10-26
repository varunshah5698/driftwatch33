"use client";

import { useState } from "react";
import { Bot, Loader2, Send, Sparkles, Target } from "lucide-react";
import { EvidenceScene, type SceneNode } from "@/components/evidence-scene";
import { EventTimeline } from "@/components/event-timeline";
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

function Field({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--line)] py-2 last:border-b-0">
      <span className="shrink-0 text-[10.5px] uppercase tracking-[0.12em] text-[var(--muted-dim)]">{label}</span>
      <span className="truncate text-right text-[12px] text-[var(--text-soft)]" style={tone ? { color: tone } : undefined}>
        {value}
      </span>
    </div>
  );
}

function Analysis({ text }: { text: string }) {
  return (
    <div className="space-y-3.5">
      {text.split(/\n(?=## )/).map((block, index) => {
        const [heading, ...rest] = block.split("\n");
        const body = rest.join("\n").trim();
        return (
          <div key={index}>
            {heading.startsWith("## ") ? (
              <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--lime)]">
                {heading.replace("## ", "")}
              </p>
            ) : null}
            <p className="text-[12.5px] leading-relaxed text-[var(--text-soft)] whitespace-pre-wrap">
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
    <>
      <div className="mb-3 grid items-stretch gap-3 xl:grid-cols-12">
        {/* ------------------------------------------------ 3D role boundary */}
        <section className="relative flex min-h-[420px] flex-col overflow-hidden rounded-[22px] border border-[color-mix(in_srgb,var(--orange)_20%,var(--line))] bg-[#080807] xl:col-span-7">
          {/* the canvas fills the card, so it can never leave a void behind */}
          <EvidenceScene
            className="absolute inset-0"
            nodes={scene}
            selected={selected}
            onSelect={setSelected}
          />

          {/* stage header */}
          <div className="relative flex items-start justify-between gap-3 px-5 pt-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {[
                { label: "out of role", color: "var(--red)" },
                { label: "inside role", color: "var(--lime)" },
                { label: "untrusted source", color: "var(--orange)" },
              ].map((key) => (
                <span key={key.label} className="inline-flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
                  <span className="h-2 w-2 rounded-full" style={{ background: key.color }} />
                  {key.label}
                </span>
              ))}
            </div>
            <span className="shrink-0 rounded-full border border-[var(--line)] bg-[rgba(8,8,7,0.7)] px-2.5 py-1 text-[10.5px] text-[var(--muted-dim)] backdrop-blur">
              {active ? "step selected — click empty space to clear" : "drag to turn · tap a step"}
            </span>
          </div>

          {/* stage footer: the three numbers that matter */}
          <div className="relative mt-auto flex flex-wrap items-end justify-between gap-4 px-5 pb-4">
            <div className="min-w-0">
              <p className="text-[10.5px] uppercase tracking-[0.16em] text-[var(--muted-dim)]">untrusted source</p>
              <p className="mt-1 max-w-[30ch] truncate text-[14px] font-semibold">{context.source}</p>
            </div>
            <div className="flex items-end gap-5">
              {[
                { label: "hops", value: String(Math.max(0, nodes.length - 1)), tone: "var(--text)" },
                {
                  label: "out of role",
                  value: String(nodes.filter((node) => node.suspicious).length),
                  tone: "var(--red)",
                },
                { label: "risk", value: `${context.score}`, tone: "var(--orange)" },
              ].map((stat) => (
                <div key={stat.label} className="text-right">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted-dim)]">{stat.label}</p>
                  <p className="metric-sm mt-1 text-[24px] font-semibold leading-none" style={{ color: stat.tone }}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------ detail + AI side rail */}
        <aside className="flex min-h-[420px] flex-col gap-3 xl:col-span-5">
          {/* tap-to-inspect */}
          <section className="rounded-[22px] border border-[var(--line)] bg-[var(--panel-soft)]">
            <div className="flex items-center gap-2 border-b border-[var(--line)] px-5 py-3">
              <Target size={13} className="text-[var(--lime)]" aria-hidden />
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em]">Step detail</h3>
              {active ? (
                <span className="chip ml-auto !py-1 !text-[10.5px]">
                  step {selected! + 1} of {nodes.length}
                </span>
              ) : (
                <span className="ml-auto text-[11px] text-[var(--muted-dim)]">nothing selected</span>
              )}
            </div>

            {!active ? (
              <p className="px-5 py-6 text-[12.5px] leading-relaxed text-[var(--muted)]">
                Pick a step on the globe. Steps that sit <span className="text-[var(--red)]">outside the wireframe</span>{" "}
                broke the agent&apos;s declared role; steps on the surface stayed inside it.
              </p>
            ) : (
              <div className="px-5 py-4">
                <p
                  className="text-[14px] font-semibold leading-snug"
                  style={{ color: active.suspicious ? "var(--red)" : "var(--text)" }}
                >
                  {active.label}
                </p>
                <div className="mt-2.5">
                  <Field label="kind" value={active.kind} />
                  <Field label="time" value={`${formatDateTime(active.ts)} UTC`} />
                  <Field label="trust" value={active.trust ?? "unknown"} />
                  <Field
                    label="role"
                    value={active.suspicious ? "out of role" : "inside declared role"}
                    tone={active.suspicious ? "var(--red)" : "var(--lime)"}
                  />
                  {activeEvent ? <Field label="tool" value={activeEvent.tool ?? "—"} /> : null}
                  {activeEvent?.destination ? <Field label="destination" value={activeEvent.destination} /> : null}
                  {activeEvent?.dataClass ? <Field label="data class" value={activeEvent.dataClass} /> : null}
                  {activeEvent?.bytes ? (
                    <Field label="egress" value={`${(activeEvent.bytes / 1024).toFixed(1)} KiB`} tone="var(--red)" />
                  ) : null}
                </div>
                {activeEvent?.summary ? (
                  <p className="mt-3 text-[12px] leading-relaxed text-[var(--muted)]">{activeEvent.summary}</p>
                ) : null}
                <button
                  type="button"
                  onClick={() => ask("Explain this step and what it means for the incident.")}
                  className="btn mt-3 w-full !h-10 !text-[12.5px]"
                  disabled={busy}
                >
                  {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Bot size={14} aria-hidden />}
                  Ask the analyst about this step
                </button>
              </div>
            )}
          </section>

          {/* the analyst */}
          <section className="flex flex-1 flex-col rounded-[22px] border border-[var(--line)] bg-[var(--panel-soft)]">
            <div className="flex items-center gap-2 border-b border-[var(--line)] px-5 py-3">
              <Sparkles size={13} className="text-[var(--orange)]" aria-hidden />
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em]">AI analyst</h3>
              <span className="chip chip-lime ml-auto !py-1 !text-[10.5px]">live</span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {!answer && !busy && !error ? (
                <div>
                  <p className="text-[12.5px] leading-relaxed text-[var(--muted)]">
                    Ask anything about this alert. The model is given the score breakdown, the causal chain and
                    every role violation recorded on it.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => ask(prompt)}
                        className="pill !h-9 !px-3.5 !text-[11.5px]"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {busy ? (
                <p className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
                  <Loader2 size={13} className="animate-spin" aria-hidden /> reading the case file…
                </p>
              ) : null}

              {error ? (
                <p className="rounded-xl border border-[color-mix(in_srgb,var(--red)_45%,transparent)] bg-[var(--red-soft)] px-3 py-2.5 text-[12px] leading-relaxed text-[var(--red)]">
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
                placeholder={active ? `Ask about “${active.label}”…` : "Ask about this incident…"}
                aria-label="Ask the AI analyst"
                className="min-w-0 flex-1 bg-transparent px-2 text-[12.5px] text-[var(--text)] outline-none placeholder:text-[var(--muted-dim)]"
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
        </aside>
      </div>

      {/* ------------------------- signed record, linked to the globe ------- */}
      <section className="mb-3 rounded-[22px] border border-[var(--line)] bg-[var(--panel)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3">
          <div>
            <p className="eyebrow mb-1.5">Causal steps</p>
            <h2 className="display-tight text-[17px] tracking-wide">What the agent did, in order</h2>
          </div>
          <p className="text-[11.5px] text-[var(--muted-dim)]">
            Selecting a step on the globe brings its signed record here.
          </p>
        </div>
        <div className="max-h-[380px] overflow-y-auto px-4 py-3">
          <EventTimeline events={events} highlightId={activeEvent?.id ?? null} />
        </div>
      </section>
    </>
  );
}
