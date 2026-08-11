/*
# Rebuild AI API Keys Table — Clean Slate

## What This Does
Drops the existing `ai_api_keys` table and recreates it from scratch.
This is a full rebuild of the AI key storage system as part of a
complete rewrite of the AI key infrastructure.

## New Table: ai_api_keys
- `id` — text PK, always `'main'` (singleton row)
- `gemini_key` — primary Google Gemini API key
- `gemini_key_2` — second Gemini key (for rotation)
- `gemini_key_3` — third Gemini key (for rotation)
- `groq_key` — Groq API key
- `mistral_key` — Mistral API key
- `openrouter_key` — OpenRouter API key
- `updated_at` — last modification timestamp

## Security
- RLS enabled with full open access for anon + authenticated (single-tenant app, no sign-in screen).
- Keys stored as plain text because the server needs raw values to make AI calls.
- All four CRUD policies use `USING (true)` / `WITH CHECK (true)` — intentional for this no-auth single-tenant app.
*/

DROP TABLE IF EXISTS ai_api_keys CASCADE;

CREATE TABLE ai_api_keys (
  id text PRIMARY KEY DEFAULT 'main',
  gemini_key text,
  gemini_key_2 text,
  gemini_key_3 text,
  groq_key text,
  mistral_key text,
  openrouter_key text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ai_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_ai_keys" ON ai_api_keys;
CREATE POLICY "anon_select_ai_keys" ON ai_api_keys FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_ai_keys" ON ai_api_keys;
CREATE POLICY "anon_insert_ai_keys" ON ai_api_keys FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_ai_keys" ON ai_api_keys;
CREATE POLICY "anon_update_ai_keys" ON ai_api_keys FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_ai_keys" ON ai_api_keys;
CREATE POLICY "anon_delete_ai_keys" ON ai_api_keys FOR DELETE
  TO anon, authenticated USING (true);
