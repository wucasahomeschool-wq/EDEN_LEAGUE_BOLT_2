import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { LeagueProvider, useLeague } from "@/state/league";
import { SimulationTerminal } from "@/components/SimulationTerminal";
import { ScheduleSuite } from "@/components/ScheduleSuite";
import { StandingsSuite } from "@/components/StandingsSuite";
import { TeamEditorSuite } from "@/components/TeamEditorSuite";
import { MatchSchedulingSuite } from "@/components/MatchSchedulingSuite";
import { TradesSuite } from "@/components/TradesSuite";
import { ContractsSuite } from "@/components/ContractsSuite";
import { SettingsSuite } from "@/components/SettingsSuite";
import { SaveVersionButton } from "@/components/SaveVersionButton";
import { NotificationCenter } from "@/components/NotificationCenter";
import { NewsSuite } from "@/components/NewsSuite";
import { NegotiationSuite } from "@/components/NegotiationSuite";
import { DraftSuite } from "@/components/DraftSuite";
import { OffseasonImportDialog } from "@/components/OffseasonImportDialog";
import { MessagesSuite } from "@/components/MessagesSuite";
import { ManagerGenerationWatcher } from "@/components/ManagerGenerationWatcher";
import { AiPressConferenceWatcher } from "@/components/AiPressConferenceWatcher";
import { NewsAutogenWatcher } from "@/components/NewsAutogenWatcher";
import { AiProviderSyncer } from "@/components/AiProviderSyncer";
import { LeagueHistorySuite } from "@/components/LeagueHistorySuite";
import { NavigationProvider, useNavigation } from "@/state/navigation";
import { HomeDashboardSuite } from "@/components/HomeDashboardSuite";
import {
  downloadLeagueExport,
  restoreManagerMessages,
  type ManagerMessageRow,
} from "@/lib/league-export";
import { getTeamColors } from "@/lib/team-branding";
import { Button } from "@/components/ui/button";
import { Lock, RefreshCw } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import edenLogo from "@/assets/eden-league-logo.svg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Eden League Data Hub" },
      {
        name: "description",
        content:
          "Central database, simulation engine, standings and roster control center for the 24-team Eden League.",
      },
      { property: "og:title", content: "Eden League Data Hub" },
      {
        property: "og:description",
        content:
          "Simulation terminal, schedule, live standings and roster editor for the Eden League.",
      },
    ],
  }),
  component: () => (
    <LeagueProvider>
      <LeagueAppWrapper />
    </LeagueProvider>
  ),
});

const COMMISSIONER_SUITES = [
  { name: "Season Schedule", render: () => <ScheduleSuite /> },
  { name: "League Standings", render: () => <StandingsSuite /> },
  { name: "Team Editor", render: () => <TeamEditorSuite /> },
  { name: "Newsroom", render: () => <NewsSuite /> },
  { name: "Trades", render: () => <TradesSuite /> },
  { name: "Simulation Terminal", render: () => <SimulationTerminal /> },
  { name: "Match Scheduling", render: () => <MatchSchedulingSuite /> },
  { name: "Draft", render: () => <DraftSuite /> },
  { name: "League History", render: () => <LeagueHistorySuite /> },
  { name: "Settings", render: () => <SettingsSuite /> },
];

const USER_SUITES = [
  { name: "Home", render: () => <HomeDashboardSuite /> },
  { name: "League Standings", render: () => <StandingsSuite /> },
  { name: "Team Editor", render: () => <TeamEditorSuite /> },
  { name: "Newsroom", render: () => <NewsSuite /> },
  { name: "Messages", render: () => <MessagesSuite /> },
  { name: "Negotiation", render: () => <NegotiationSuite /> },
  { name: "Contracts", render: () => <ContractsSuite /> },
  { name: "Draft", render: () => <DraftSuite /> },
];

function LeagueAppWrapper() {
  const { selectedUser } = useLeague();

  const suites = useMemo(() => {
    return selectedUser === "commissioner" ? COMMISSIONER_SUITES : USER_SUITES;
  }, [selectedUser]);

  const suiteNames = useMemo(() => {
    return suites.map((s) => s.name);
  }, [suites]);

  const isCommissioner = selectedUser === "commissioner";

  return (
    <NavigationProvider key={isCommissioner ? "commissioner" : "user"} suites={suiteNames}>
      <Hub suites={suites} />
    </NavigationProvider>
  );
}

function Hub({ suites }: { suites: Array<{ name: string; render: () => React.ReactNode }> }) {
  const { index: idx, next, prev } = useNavigation();
  const { state, selectedUser, setSelectedUser } = useLeague();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Multi-window cooperative lock
  const [isLocked, setIsLocked] = useState(false);
  const windowSessionId = useMemo(() => Math.random().toString(36).substring(2, 11), []);

  useEffect(() => {
    if (!mounted) return;

    // Register this tab as the active session
    localStorage.setItem("eden_active_session_id", windowSessionId);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "eden_active_session_id") {
        if (e.newValue && e.newValue !== windowSessionId) {
          setIsLocked(true);
        }
      }
    };

    window.addEventListener("storage", handleStorage);

    // Cross-tab lock handovers
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("eden_league_session_lock");
      bc.onmessage = (e) => {
        if (e.data?.type === "closed") {
          const activeId = localStorage.getItem("eden_active_session_id");
          if (!activeId) {
            localStorage.setItem("eden_active_session_id", windowSessionId);
            setIsLocked(false);
          }
        } else if (e.data?.type === "acquire" && e.data?.sessionId !== windowSessionId) {
          setIsLocked(true);
        }
      };
    } catch {
      console.debug("BroadcastChannel init failed");
    }

    return () => {
      window.removeEventListener("storage", handleStorage);
      if (bc) {
        try {
          if (localStorage.getItem("eden_active_session_id") === windowSessionId) {
            localStorage.removeItem("eden_active_session_id");
            bc.postMessage({ type: "closed", sessionId: windowSessionId });
          }
          bc.close();
        } catch {
          console.debug("BroadcastChannel close failed");
        }
      }
    };
  }, [mounted, windowSessionId]);

  const acquireLock = () => {
    localStorage.setItem("eden_active_session_id", windowSessionId);
    setIsLocked(false);
    try {
      const bc = new BroadcastChannel("eden_league_session_lock");
      bc.postMessage({ type: "acquire", sessionId: windowSessionId });
      bc.close();
    } catch {
      console.debug("BroadcastChannel acquire failed");
    }
  };

  const isOffseason = state.currentDay === "OFFSEASON";
  const isCommissioner = selectedUser === "commissioner";
  const userControlledTeams = useMemo(() => {
    return Object.entries(state.managers)
      .filter(([_, m]) => (m.personality ?? "").trim().toUpperCase() === "USER CONTROLLED")
      .map(([teamName, m]) => ({
        team: teamName,
        manager: m.name,
      }));
  }, [state.managers]);

  const dynamicBgStyle = useMemo(() => {
    if (!mounted || selectedUser === "commissioner") {
      return {};
    }
    const t = state.teams[selectedUser];
    const colors = getTeamColors(t ?? { name: selectedUser });
    const primary = colors.primary ?? "#1f9d4d";
    const secondary = colors.secondary ?? "#ffffff";

    // Team-branded linear gradient matching exact hex key in top-left, fading lighter down & right
    const gradient = `linear-gradient(160deg, ${primary} 0%, color-mix(in srgb, ${primary} 35%, white) 55%, color-mix(in srgb, ${primary} 10%, white) 100%)`;

    return {
      backgroundImage: `${gradient}, repeating-linear-gradient(90deg, color-mix(in oklab, #ffffff 6%, transparent) 0 56px, transparent 56px 112px)`,
      backgroundAttachment: "fixed",
      // Secondary background accents and tailwind override custom properties
      "--primary": primary,
      "--border": `color-mix(in srgb, ${primary} 25%, transparent)`,
      "--highlight-blue": primary,
      "--highlight-red": secondary,
    } as React.CSSProperties;
  }, [mounted, selectedUser, state.teams]);

  return (
    <div className="min-h-screen" style={dynamicBgStyle}>
      {isLocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md">
          <div className="max-w-md rounded-2xl border bg-card p-8 shadow-2xl text-center flex flex-col items-center">
            <div className="rounded-full bg-destructive/10 p-4 mb-4 text-destructive">
              <Lock className="h-8 w-8 animate-pulse" />
            </div>
            <h2 className="text-xl font-bold tracking-tight mb-2">Conflicting Session Detected</h2>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Another window or tab of the Eden League Hub is currently active. To prevent
              conflicting changes and database corruption, operations in this tab have been
              suspended.
            </p>
            <Button onClick={acquireLock} className="w-full flex items-center justify-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Acquire Lock & Resume
            </Button>
          </div>
        </div>
      )}

      <ManagerGenerationWatcher />
      <AiPressConferenceWatcher />
      <NewsAutogenWatcher />
      <AiProviderSyncer />
      {mounted && isOffseason && isCommissioner && <OffseasonImportDialog />}
      <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur">
        <div
          className="h-1 w-full"
          style={
            selectedUser !== "commissioner"
              ? {
                  background: `linear-gradient(90deg, var(--primary) 0%, var(--highlight-red) 100%)`,
                }
              : { backgroundImage: "var(--gradient-rb)" }
          }
        />
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="relative flex items-center justify-center gap-2 min-h-[44px]">
            {/* Left Side: Active Role Dropdown Selector */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-10">
              <label htmlFor="role-select" className="sr-only">
                Active Role
              </label>
              <select
                id="role-select"
                value={mounted ? selectedUser : "commissioner"}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="h-8 rounded-lg border bg-background px-2.5 py-1 text-xs font-bold text-highlight-blue focus:outline-none focus:ring-1 focus:ring-highlight-blue cursor-pointer shadow-sm hover:bg-secondary/25 transition-colors"
              >
                <option value="commissioner">League Commissioner</option>
                {mounted &&
                  userControlledTeams.map(({ team, manager }) => (
                    <option key={team} value={team}>
                      {team} ({manager})
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex items-center justify-center gap-4">
              <button
                onClick={prev}
                aria-label="Previous suite"
                className="select-none text-3xl font-black text-highlight-blue transition-colors hover:opacity-70 z-10 w-8 text-right"
              >
                ‹
              </button>
              <div className="flex flex-col items-center text-center w-[240px] sm:w-[280px] md:w-[320px] shrink-0">
                <div className="flex items-center gap-2">
                  <img src={edenLogo} alt="Eden League crest" className="h-8 w-8 object-contain" />
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Eden League Data Hub
                  </div>
                </div>
                <h1 className="text-lg font-extrabold tracking-tight sm:text-xl truncate max-w-full">
                  {suites[idx]?.name || "Home"}
                </h1>
              </div>
              <button
                onClick={next}
                aria-label="Next suite"
                className="select-none text-3xl font-black text-highlight-red transition-colors hover:opacity-70 z-10 w-8 text-left"
              >
                ›
              </button>
            </div>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10">
              <NotificationCenter />
            </div>
          </div>
          <Toolbar />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {mounted && isOffseason && !isCommissioner ? (
          <div className="mx-auto max-w-md py-20 text-center">
            <div className="rounded-full bg-muted p-4 mx-auto mb-4 w-fit">
              <Lock className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold tracking-tight mb-2">Season Over</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Season {state.season} has ended. The league is in offseason. The commissioner is
              managing the offseason transition — check back soon for Season {state.season + 1}!
            </p>
          </div>
        ) : mounted && suites[idx] ? (
          suites[idx].render()
        ) : (
          <div className="py-20 text-center text-sm text-muted-foreground">
            Loading league state…
          </div>
        )}
      </main>
    </div>
  );
}

function Toolbar() {
  const { undo, redo, canUndo, canRedo, state, standings, leaderboards, importLeagueExport } =
    useLeague();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [pendingImport, setPendingImport] = useState<{
    name: string;
    data: Record<string, unknown>;
  } | null>(null);

  const onPickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result ?? "")) as Record<string, unknown>;
        setPendingImport({ name: file.name, data: parsed });
      } catch (err) {
        toast.error(
          `Could not parse JSON: ${err instanceof Error ? err.message : "unknown error"}`,
        );
      }
    };
    reader.onerror = () => toast.error("Could not read the file.");
    reader.readAsText(file);
  };

  const handleImportConfirm = () => {
    if (!pendingImport) return;
    try {
      const res = importLeagueExport(pendingImport.data);
      if (!res.ok) {
        toast.error(`Import failed: ${res.error}`);
        setPendingImport(null);
        return;
      }
      // Restore the Cloud-only DM history (lives outside LeagueState).
      const msgs = Array.isArray(pendingImport.data.messages)
        ? (pendingImport.data.messages as ManagerMessageRow[])
        : [];
      void restoreManagerMessages(msgs).catch((err) => {
        console.warn("[import] DM restore failed", err);
      });
      toast.success("League state imported successfully!");
    } catch (err) {
      toast.error(`Import failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
    setPendingImport(null);
  };

  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
      <Button
        size="sm"
        variant="outline"
        onClick={undo}
        disabled={!canUndo}
        title="Undo the last action across any suite"
        className="font-semibold"
      >
        ↶ UNDO
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={redo}
        disabled={!canRedo}
        title="Redo the last undone action"
        className="font-semibold"
      >
        ↷ REDO
      </Button>
      <SaveVersionButton />
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          void downloadLeagueExport(state, standings, leaderboards);
        }}
        title="Download all league data as a JSON file (includes DM history, manager respect, relations and settings)"
        className="font-semibold"
      >
        ⬇ EXPORT LEAGUE DATA
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => fileRef.current?.click()}
        title="Restore league data from an exported JSON file (replaces current league)"
        className="font-semibold"
      >
        ⬆ IMPORT LEAGUE DATA
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={onPickFile}
      />

      <AlertDialog
        open={pendingImport !== null}
        onOpenChange={(open) => {
          if (!open) setPendingImport(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import League Data?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to import <strong>{pendingImport?.name}</strong>?
              <br />
              <br />
              This <strong>REPLACES</strong> the current league (teams, rosters, schedule, results,
              standings, managers, relations, settings, DM history) with the contents of the file.
              <br />
              <br />
              You can <strong>↶ UNDO</strong> the league-state part immediately after if it looks
              wrong.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleImportConfirm}>Confirm Import</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
