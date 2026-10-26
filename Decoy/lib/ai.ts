/**
 * River AI client. Server-only: the API key never reaches the browser, so the
 * only way to run an analysis is through our own /api/ai/analyze route.
 */

const BASE_URL = process.env.RIVER_BASE_URL ?? "https://api.river.ai/v1";
const API_KEY =
  process.env.RIVER_API_KEY ?? "rv_afzaFYZtc_hMAp5pKpXKc2nByM5g-tfYL8jcFr8xxNM";
const MODEL = process.env.RIVER_MODEL ?? "deepseek-ai/DeepSeek-V4.1-Flash-1017";

export const AI_CONFIGURED = Boolean(API_KEY);
export const AI_MODEL = MODEL;

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/** The compact case file we send to the model for every question. */
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

export async function chat(messages: ChatMessage[]): Promise<string> {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 700,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`AI request failed (${response.status}) ${detail.slice(0, 200)}`);
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return payload.choices?.[0]?.message?.content?.trim() ?? "";
}
