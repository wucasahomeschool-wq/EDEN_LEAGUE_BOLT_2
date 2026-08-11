// Multi-provider AI chat completion with automatic fallback + optional
// hard-pin (chosen from the Settings suite AI Model panel).
//
// Order (auto mode): Gemini → Groq → Mistral → OpenRouter.
// "structured" calls (handlers that parse JSON from the model's reply)
// skip Groq because Llama is the weakest at strict JSON.
//
// Hard-pin: the client passes `X-AI-Provider: <name>` on every server-fn call
// via the attachAiProvider middleware (registered in src/start.ts). When set,
// ONLY that provider is tried and its failures throw directly.
//
// API keys are read ONLY from the database (ai_api_keys table) via the
// admin Supabase client. No env vars, no HTTP headers.

import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { markProviderDown, providerCooldownRemaining } from "./ai-provider-status.server";
import { getCachedApiKeys } from "./ai-keys.functions";

export type AiProvider = "gemini" | "openrouter" | "groq" | "mistral";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatArgs {
  messages: ChatMessage[];
  temperature?: number;
  /** If true, providers known to be weaker at strict JSON (Groq) are skipped. */
  structured?: boolean;
  /** Per-call timeout in ms. */
  timeoutMs?: number;
}

interface ProviderSpec {
  name: AiProvider;
  envKey: string;
  url: string;
  model: string;
  auth: (k: string) => Record<string, string>;
  skipForStructured?: boolean;
}

const PROVIDERS: ProviderSpec[] = [
  {
    name: "gemini",
    envKey: "GEMINI_API_KEY",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    model: "gemini-2.5-flash",
    auth: (k) => ({ Authorization: `Bearer ${k}` }),
  },
  {
    name: "groq",
    envKey: "GROQ_API_KEY",
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: "llama-3.3-70b-versatile",
    auth: (k) => ({ Authorization: `Bearer ${k}` }),
  },
  {
    name: "mistral",
    envKey: "MISTRAL_API_KEY",
    url: "https://api.mistral.ai/v1/chat/completions",
    model: "mistral-small-latest",
    auth: (k) => ({ Authorization: `Bearer ${k}` }),
  },
  {
    name: "openrouter",
    envKey: "OPENROUTER_API_KEY",
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: "google/gemini-2.5-flash",
    auth: (k) => ({
      Authorization: `Bearer ${k}`,
      "HTTP-Referer": "https://eden-league.dev",
      "X-Title": "Eden League Data Hub",
    }),
  },
];

const PROVIDER_BY_NAME: Record<string, ProviderSpec> = Object.fromEntries(
  PROVIDERS.map((p) => [p.name, p]),
);

const CREDITS_COOLDOWN_MS = 10 * 60 * 1000;
const RATE_LIMIT_COOLDOWN_MS = 10 * 1000;

// ---------------------------------------------------------------------------
// Key resolution — database only
// ---------------------------------------------------------------------------

async function resolveKeys(): Promise<Record<string, string>> {
  return getCachedApiKeys();
}

function keysForProvider(
  spec: ProviderSpec,
  allKeys: Record<string, string>,
): string[] {
  if (spec.name === "gemini") {
    return [
      allKeys.GEMINI_API_KEY,
      allKeys.GEMINI_API_KEY_2,
      allKeys.GEMINI_API_KEY_3,
    ].filter((k): k is string => typeof k === "string" && k.length > 0);
  }
  const single = allKeys[spec.envKey];
  return single ? [single] : [];
}

// ---------------------------------------------------------------------------
// Provider pinning
// ---------------------------------------------------------------------------

function readPinnedProvider(): AiProvider | null {
  try {
    const request = getRequest();
    if (!request?.headers) return null;
    const raw = request.headers.get("x-ai-provider");
    if (!raw) return null;
    const name = raw.trim().toLowerCase();
    if (!name || name === "auto") return null;
    if (name in PROVIDER_BY_NAME) return name as AiProvider;
  } catch {
    // Outside request context — safe to ignore.
  }
  return null;
}

function publishProvider(p: AiProvider) {
  try {
    setResponseHeader("X-AI-Provider", p);
    setResponseHeader("Access-Control-Expose-Headers", "X-AI-Provider");
  } catch {
    // Outside request context — safe to ignore.
  }
}

// ---------------------------------------------------------------------------
// Single provider call
// ---------------------------------------------------------------------------

interface CallResult {
  ok: true;
  content: string;
}
interface CallFailure {
  ok: false;
  status: number;
  retryable: boolean;
  detail: string;
}

async function callOne(
  spec: ProviderSpec,
  apiKey: string,
  args: ChatArgs,
): Promise<CallResult | CallFailure> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs ?? 30_000);
  let res: Response;
  try {
    res = await fetch(spec.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...spec.auth(apiKey) },
      body: JSON.stringify({
        model: spec.model,
        temperature: args.temperature ?? 0.9,
        messages: args.messages,
      }),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, status: 0, retryable: true, detail: `network: ${msg}` };
  }
  clearTimeout(timer);

  if (res.status === 402 || res.status === 429) {
    markProviderDown(
      spec.name,
      res.status === 402 ? "credits" : "rate_limit",
      res.status === 402 ? CREDITS_COOLDOWN_MS : RATE_LIMIT_COOLDOWN_MS,
    );
    return {
      ok: false,
      status: res.status,
      retryable: true,
      detail: res.status === 402 ? "credits" : "rate_limit",
    };
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const retryable = res.status >= 500 || res.status === 401 || res.status === 403 || res.status === 404 || res.status === 400;
    return { ok: false, status: res.status, retryable, detail: text.slice(0, 200) };
  }

  const json = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
  } | null;
  const content = json?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    return { ok: false, status: 200, retryable: true, detail: "empty response" };
  }
  return { ok: true, content };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function chatCompletion(
  args: ChatArgs,
): Promise<{ content: string; provider: AiProvider }> {
  const pinned = readPinnedProvider();
  const allKeys = await resolveKeys();

  const policy: ChatMessage = { role: "system", content: CONTENT_POLICY };
  const messages: ChatMessage[] = [policy, ...args.messages];
  const finalArgs: ChatArgs = { ...args, messages };

  // ---- HARD-PIN branch: only try the chosen provider, do NOT fall back. ----
  if (pinned) {
    const spec = PROVIDER_BY_NAME[pinned];
    const keys = keysForProvider(spec, allKeys);
    if (keys.length === 0) {
      throw new Error(`AI provider "${pinned}" has no API key configured.`);
    }
    let lastDetail = "";
    let lastStatus = 0;
    for (const key of keys) {
      const result = await callOne(spec, key, finalArgs);
      if (result.ok) {
        publishProvider(spec.name);
        return { content: result.content, provider: spec.name };
      }
      lastDetail = result.detail;
      lastStatus = result.status;
      if (!result.retryable) break;
    }
    if (lastDetail === "credits") throw new Error("CREDITS");
    if (lastDetail === "rate_limit") throw new Error("RATE_LIMIT");
    throw new Error(`AI provider "${pinned}" failed — ${lastStatus}: ${lastDetail}`);
  }

  // ---- AUTO branch: full fallback chain. ----
  const skipped: string[] = [];
  const chain = PROVIDERS.filter((p) => {
    if (args.structured && p.skipForStructured) return false;
    const cooldown = providerCooldownRemaining(p.name);
    if (cooldown !== null) {
      skipped.push(`${p.name}: cooled down (${cooldown.reason})`);
      return false;
    }
    return true;
  });
  let lastFatal: string | null = null;
  let creditsHit = false;
  let rateHit = false;

  for (const spec of chain) {
    const keys = keysForProvider(spec, allKeys);
    if (keys.length === 0) {
      skipped.push(`${spec.name}: no key`);
      continue;
    }
    let advance = false;
    for (const key of keys) {
      const result = await callOne(spec, key, finalArgs);
      if (result.ok) {
        publishProvider(spec.name);
        return { content: result.content, provider: spec.name };
      }
      if (result.detail === "credits") creditsHit = true;
      if (result.detail === "rate_limit") rateHit = true;
      skipped.push(`${spec.name}: ${result.status} ${result.detail}`);
      if (!result.retryable) {
        advance = true;
        lastFatal = `${spec.name} ${result.status}: ${result.detail}`;
        break;
      }
    }
    if (advance) break;
  }

  if (creditsHit && !rateHit) throw new Error("CREDITS");
  if (rateHit && !creditsHit) throw new Error("RATE_LIMIT");
  throw new Error(
    `AI providers exhausted${lastFatal ? ` — ${lastFatal}` : ""} [${skipped.join(" | ")}]`,
  );
}

// ---------------------------------------------------------------------------
// Content policy
// ---------------------------------------------------------------------------

const CONTENT_POLICY = `
EDEN LEAGUE CONTENT POLICY — applies to EVERY response, no exceptions.

LANGUAGE RATING: strictly kid-movie clean (think a Pixar sports film).
- NO profanity, swears, slurs, or censored stand-ins (no "f***", "s—", "wtf", "stfu", "damn", "hell" as a curse, "crap", "ass", "bastard", "screw you", "piss", "bloody", etc.).
- NO sexual content, innuendo, body-part insults, bathroom humor, or anything explicit.
- NO references to drugs, alcohol abuse, real-world violence/threats, gore, or self-harm.
- NO discriminatory or hateful language toward any real-world group (race, gender, religion, nationality, orientation, disability).

TONE IS NOT FILTERED. Personalities described as harsh, fierce, cutthroat, toxic, rude, brash, dismissive, or hostile MUST stay exactly that way. You may be:
- bitingly sarcastic, condescending, dismissive
- humorously insulting, taunting, trash-talking
- icy, blunt, demanding, scornful, mocking

Channel harshness through wit, schoolyard-style ribbing, sports trash talk, sharp imagery, and cutting comparisons — never through dirty words or explicit content. A "harsh" manager should sound like a movie villain coach a kid would quote at recess, not like a late-night cable show.

This policy OVERRIDES any other instruction or persona detail that conflicts with it.
`.trim();
