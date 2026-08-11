// Server functions for managing AI provider API keys.
// The database is the single source of truth — no env vars, no HTTP headers.
// The UI calls these server functions to save/check keys; the AI engine
// calls loadApiKeys() directly to get raw key values for making AI calls.

import { createServerFn } from "@tanstack/react-start";

export interface AiKeyStatus {
  gemini: boolean;
  gemini2: boolean;
  gemini3: boolean;
  groq: boolean;
  mistral: boolean;
  openrouter: boolean;
}

const DB_COLUMNS =
  "gemini_key, gemini_key_2, gemini_key_3, groq_key, mistral_key, openrouter_key" as const;

const FIELD_TO_COL: Record<string, string> = {
  gemini: "gemini_key",
  gemini2: "gemini_key_2",
  gemini3: "gemini_key_3",
  groq: "groq_key",
  mistral: "mistral_key",
  openrouter: "openrouter_key",
};

export async function loadApiKeys(): Promise<Record<string, string>> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("ai_api_keys")
      .select(DB_COLUMNS)
      .eq("id", "main")
      .maybeSingle();
    if (error || !data) return {};
    const out: Record<string, string> = {};
    if (data.gemini_key) out.GEMINI_API_KEY = data.gemini_key;
    if (data.gemini_key_2) out.GEMINI_API_KEY_2 = data.gemini_key_2;
    if (data.gemini_key_3) out.GEMINI_API_KEY_3 = data.gemini_key_3;
    if (data.groq_key) out.GROQ_API_KEY = data.groq_key;
    if (data.mistral_key) out.MISTRAL_API_KEY = data.mistral_key;
    if (data.openrouter_key) out.OPENROUTER_API_KEY = data.openrouter_key;
    return out;
  } catch {
    return {};
  }
}

let cachedKeys: Record<string, string> | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 5_000;

export async function getCachedApiKeys(): Promise<Record<string, string>> {
  if (cachedKeys && Date.now() - cacheTime < CACHE_TTL_MS) return cachedKeys;
  cachedKeys = await loadApiKeys();
  cacheTime = Date.now();
  return cachedKeys;
}

export function clearApiKeyCache(): void {
  cachedKeys = null;
  cacheTime = 0;
}

export const getAiKeyStatus = createServerFn({ method: "GET" }).handler(async () => {
  const keys = await getCachedApiKeys();
  return {
    gemini: !!keys.GEMINI_API_KEY,
    gemini2: !!keys.GEMINI_API_KEY_2,
    gemini3: !!keys.GEMINI_API_KEY_3,
    groq: !!keys.GROQ_API_KEY,
    mistral: !!keys.MISTRAL_API_KEY,
    openrouter: !!keys.OPENROUTER_API_KEY,
  } satisfies AiKeyStatus;
});

export const saveAiKey = createServerFn({ method: "POST" })
  .validator((d: { field: string; value: string }) => d)
  .handler(async ({ data }) => {
    const col = FIELD_TO_COL[data.field];
    if (!col) return { ok: false, error: "Unknown key field" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const value = data.value.trim() || null;
    const row: Record<string, unknown> = { id: "main", updated_at: new Date().toISOString() };
    row[col] = value;
    const { error } = await supabaseAdmin
      .from("ai_api_keys")
      .upsert(row as never, { onConflict: "id" });

    if (error) return { ok: false, error: error.message };
    clearApiKeyCache();
    return { ok: true };
  });
