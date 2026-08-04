// Per-provider cooldown book kept in memory. Populated by
// `ai-fallback.server.ts` when a provider returns 429/402, read by the
// server fn `getAiProviderStatus` so the Settings suite can grey out
// unavailable options.

import { getCachedApiKeys } from "./ai-keys.functions";

type ProviderName = "gemini" | "openrouter" | "groq" | "mistral";

interface CooldownEntry {
  until: number;
  reason: "credits" | "rate_limit" | "error";
  note?: string;
}

const cooldowns: Record<string, CooldownEntry | undefined> = {};

export function markProviderDown(
  name: ProviderName,
  reason: CooldownEntry["reason"],
  ms: number,
  note?: string,
) {
  cooldowns[name] = { until: Date.now() + ms, reason, note };
}

export function providerCooldownRemaining(name: ProviderName): CooldownEntry | null {
  const c = cooldowns[name];
  if (!c) return null;
  if (c.until <= Date.now()) {
    delete cooldowns[name];
    return null;
  }
  return c;
}

const ENV_KEY_MAP: Record<Exclude<ProviderName, "gemini">, string> = {
  openrouter: "OPENROUTER_API_KEY",
  groq: "GROQ_API_KEY",
  mistral: "MISTRAL_API_KEY",
};

export async function providerHasKey(name: ProviderName): Promise<boolean> {
  const dbKeys = await getCachedApiKeys();
  if (name === "gemini") {
    return !!dbKeys.GEMINI_API_KEY || !!dbKeys.GEMINI_API_KEY_2 || !!dbKeys.GEMINI_API_KEY_3;
  }
  const envKey = ENV_KEY_MAP[name as Exclude<ProviderName, "gemini">];
  return !!dbKeys[envKey];
}
