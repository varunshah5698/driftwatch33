import { NextResponse } from "next/server";
import { AI_MODEL, chat, type AiContext } from "@/lib/ai";

export const runtime = "nodejs";

const SYSTEM = `You are the incident analyst inside Driftwatch, an identity-drift detection console for autonomous AI agents.
You are given one alert: a declared role, a baseline, and a chain of actions an agent took after touching untrusted content.

Answer the analyst's question about THIS alert using only the case file below. Be concrete: cite the named factors, tools, data classes and destinations instead of speaking generally. Plain text only.

When the question is open-ended ("analyze", "what happened", "why does this matter"), answer in exactly these sections:
## What happened
## Why it matters
## Recommended action
Otherwise answer the question directly in two to four sentences.

Never invent evidence that is not in the case file.`;

function caseFile(context: AiContext) {
  return [
    `Alert: ${context.alertTitle} (${context.severity}, risk ${context.score}/100, confidence ${context.confidence}%)`,
    `Agent: ${context.agent}, declared role: ${context.role}`,
    `Untrusted source: ${context.source}`,
    `Causal chain (${context.chain.length} steps):`,
    ...context.chain.map((step, index) => `  ${index + 1}. ${step}`),
    `Score factors:`,
    ...context.factors.map((factor) => `  - ${factor.label}: +${factor.points} — ${factor.detail}`),
    `Role violations: ${context.violations.length ? context.violations.join("; ") : "none recorded"}`,
    `Suggested containment: ${context.suggestedAction}`,
  ].join("\n");
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { question, context } = (body ?? {}) as { question?: unknown; context?: AiContext };
  if (typeof question !== "string" || !question.trim()) {
    return NextResponse.json({ error: "A question is required." }, { status: 400 });
  }
  if (!context || typeof context.alertTitle !== "string") {
    return NextResponse.json({ error: "Case context is required." }, { status: 400 });
  }

  try {
    const answer = await chat([
      { role: "system", content: SYSTEM },
      { role: "user", content: `${caseFile(context)}\n\nQuestion: ${question.trim().slice(0, 2000)}` },
    ]);
    return NextResponse.json({ answer: answer || "The model returned no analysis.", model: AI_MODEL });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The analysis request failed." },
      { status: 502 },
    );
  }
}
