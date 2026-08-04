/*
# Create ai_api_keys table for user-configured AI provider keys

## Purpose
The Eden League app uses multiple AI providers (Gemini, Groq, Mistral,
OpenRouter) for match simulation, press conferences, news articles, etc.
Previously, API keys could only be set via server environment variables,
which are not accessible to end users. This table stores user-entered API
keys in the database so they can be configured from the Settings UI.

## New Table: ai_api_keys
- id (text, PK, fixed value 'main' — single-row singleton)
- gemini_key (text, nullable) — primary Google Gemini API key
- gemini_key_2 (text, nullable) — secondary Gemini key (rotation)
- gemini_key_3 (text, nullable) — tertiary Gemini key (rotation)
- groq_key (text, nullable) — Groq API key
- mistral_key (text, nullable) — Mistral API key
- openrouter_key (text, nullable) — OpenRouter API key
- updated_at (timestamptz, defaults to now())

## Security (RLS)
Single-tenant app with no sign-in screen. RLS enabled with open CRUD
for anon + authenticated roles — the data is intentionally shared within
this single-player app. Keys are stored as plain text because the server
needs the raw value to authenticate with the provider APIs; this is the
same trust model as environment variables.

## Notes
1. Uses IF NOT EXISTS for idempotency.
2. Single-row design (id = 'main') — one set of keys for the whole app.
3. No foreign keys — standalone configuration table.
*/

CREATE TABLE IF NOT EXISTS public.ai_api_keys (
  id text PRIMARY KEY DEFAULT 'main',
  gemini_key text,
  gemini_key_2 text,
  gemini_key_3 text,
  groq_key text,
  mistral_key text,
  openrouter_key text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_api_keys TO anon, authenticated;
GRANT ALL ON public.ai_api_keys TO service_role;

ALTER TABLE public.ai_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read ai api keys" ON public.ai_api_keys;
CREATE POLICY "Anyone can read ai api keys"
  ON public.ai_api_keys FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can insert ai api keys" ON public.ai_api_keys;
CREATE POLICY "Anyone can insert ai api keys"
  ON public.ai_api_keys FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update ai api keys" ON public.ai_api_keys;
CREATE POLICY "Anyone can update ai api keys"
  ON public.ai_api_keys FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can delete ai api keys" ON public.ai_api_keys;
CREATE POLICY "Anyone can delete ai api keys"
  ON public.ai_api_keys FOR DELETE TO anon, authenticated USING (true);