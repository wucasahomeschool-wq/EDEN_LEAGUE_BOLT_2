// ============================================================================
// OFFSEASON DATA IMPORT FILE
// ============================================================================
// This is where you paste the offseason data JSON from the separate offseason app.
//
// HOW TO USE:
//   1. Open the offseason app and run it to completion.
//   2. Export the offseason data as JSON (it's a full league-state export).
//   3. Copy the JSON content here, replacing the placeholder below.
//   4. In the Eden League app, go to the Offseason Import screen (appears when
//      the season ends) and click "Load from Codebase" — it will read from
//      this file.
//
// The data is a full league-state export with this shape:
// {
//   exportedAt: "2026-08-01T17:16:28.488Z",
//   kind: "eden-league-full-export",
//   offseasonExport: true,
//   offseasonFromSeason: 1,
//   offseasonToSeason: 2,
//   state: { ... full LeagueState object ... },
//   goldenBoot: [ ... ],
//   assistLeaders: [ ... ],
//   goldenGlove: [ ... ],
// }
//
// The `state` field is a complete LeagueState — the import takes it directly
// and uses it as the starting point for the next season (with pre-season
// fixtures generated and week-level state reset).
// ============================================================================

import type { OffseasonImportData } from "@/state/league";

// Replace this placeholder object with your actual offseason JSON.
export const OFFSEASON_DATA: OffseasonImportData = {
  exportedAt: new Date().toISOString(),
  kind: "eden-league-full-export",
  offseasonExport: true,
  offseasonFromSeason: 1,
  offseasonToSeason: 2,
  state: {
    currentWeek: 1,
    currentDay: "Monday",
    season: 2,
    teamOrder: [],
    teams: {},
    fixtures: [],
    results: {},
    payloads: {},
    freeAgents: [],
    draftPicks: [],
    managers: {},
    settings: undefined,
    salaryCap: 0,
    commissionerAlerts: [],
    tradeProposals: [],
    undoStack: [],
    redoStack: [],
    contractsInitialized: false,
  },
};
