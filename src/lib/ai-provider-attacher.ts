// Client-side function middleware that attaches the user's chosen AI
// provider to every serverFn RPC as a header. The server-side
// `chatCompletion` reads it to decide whether to hard-pin a single
// provider or use the auto fallback chain.
//
// API keys are NOT sent from the browser. The server reads them directly
// from the database via the admin Supabase client.

import { createMiddleware } from "@tanstack/react-start";

export const AI_PROVIDER_STORAGE_KEY = "eden_ai_provider";

export const attachAiProvider = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    let name = "";
    try {
      if (typeof window !== "undefined") {
        name = (window.localStorage.getItem(AI_PROVIDER_STORAGE_KEY) ?? "").trim();
      }
    } catch {
      /* ignore */
    }
    const headers: Record<string, string> = {};
    if (name && name !== "auto") headers["X-AI-Provider"] = name;
    return next({ headers });
  },
);
