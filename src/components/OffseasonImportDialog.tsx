import { useRef, useState } from "react";
import { useLeague } from "@/state/league";
import { OFFSEASON_DATA } from "@/data/offseason-data";
import { Button } from "@/components/ui/button";
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
import { Upload, Play, FileJson, Lock } from "lucide-react";
import { toast } from "sonner";

export function OffseasonImportDialog() {
  const { state, importOffseasonData, advanceToNextSeason } = useLeague();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [showAdvanceConfirm, setShowAdvanceConfirm] = useState(false);

  const isOffseason = state.currentDay === "OFFSEASON";
  const hasImported = !!state.offseasonImport;

  const handleLoadFromFile = () => {
    try {
      const res = importOffseasonData(OFFSEASON_DATA);
      if (!res.ok) {
        toast.error(`Import failed: ${res.error}`);
        return;
      }
      toast.success("Offseason data loaded from the codebase file.");
    } catch (err) {
      toast.error(
        `Could not load offseason data: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    }
  };

  const handleLoadFromUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result ?? ""));
        const res = importOffseasonData(parsed);
        if (!res.ok) {
          toast.error(`Import failed: ${res.error}`);
          return;
        }
        toast.success("Offseason data loaded from uploaded file.");
      } catch (err) {
        toast.error(
          `Could not parse JSON: ${err instanceof Error ? err.message : "unknown error"}`,
        );
      }
    };
    reader.onerror = () => toast.error("Could not read the file.");
    reader.readAsText(file);
  };

  const handleAdvance = () => {
    const res = advanceToNextSeason();
    if (!res.ok) {
      toast.error(`Could not advance to next season: ${res.error}`);
      return;
    }
    toast.success(`Season ${importedSeason} has begun! Schedule your pre-season in Match Scheduling.`);
  };

  if (!isOffseason) return null;

  const importedState = state.offseasonImport?.state;
  const importedTeamCount = importedState?.teams ? Object.keys(importedState.teams).length : 0;
  const importedFreeAgentCount = importedState?.freeAgents?.length ?? 0;
  const importedDraftPickCount = importedState?.draftPicks?.length ?? 0;
  const importedSeason =
    state.offseasonImport?.offseasonToSeason ?? importedState?.season ?? state.season + 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4">
      <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="rounded-full bg-muted p-3 mb-3">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold tracking-tight mb-1">Offseason — League Locked</h2>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">
            Season {state.season} is complete. Import the offseason data from the separate offseason
            app and advance to the next season.
          </p>
        </div>

        {/* Step 1: Import */}
        <div className="rounded-xl border p-4 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              1
            </span>
            <h3 className="text-sm font-semibold">Import Offseason Data</h3>
          </div>
          <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
            Load the offseason data JSON. You can upload the file directly, or paste it into{" "}
            <code className="text-[10px] bg-muted px-1 py-0.5 rounded">src/data/offseason-data.ts</code>{" "}
            and click "Load from Codebase".
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="default"
              onClick={handleLoadFromFile}
              disabled={hasImported}
              className="flex items-center gap-1.5 h-8 text-xs"
            >
              <FileJson className="h-3.5 w-3.5" />
              Load from Codebase
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={hasImported}
              className="flex items-center gap-1.5 h-8 text-xs"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload JSON File
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) handleLoadFromUpload(file);
              }}
            />
          </div>
        </div>

        {/* Step 2: Review & Advance */}
        <div
          className={`rounded-xl border p-4 transition-opacity ${
            hasImported ? "opacity-100" : "opacity-40 pointer-events-none"
          }`}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              2
            </span>
            <h3 className="text-sm font-semibold">Review & Advance</h3>
          </div>
          {hasImported ? (
            <>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="rounded-lg bg-muted/50 p-2 text-center">
                  <div className="text-xl font-bold">{importedTeamCount}</div>
                  <div className="text-[10px] text-muted-foreground">Teams</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-2 text-center">
                  <div className="text-xl font-bold">{importedFreeAgentCount}</div>
                  <div className="text-[10px] text-muted-foreground">Free Agents</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-2 text-center">
                  <div className="text-xl font-bold">{importedDraftPickCount}</div>
                  <div className="text-[10px] text-muted-foreground">Draft Picks</div>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
                Clicking "Advance to Season {importedSeason}" will load the imported league state
                (updated rosters, aged players, draft results, free agents) and unlock the league.
                You'll then schedule pre-season fixtures manually in Match Scheduling.
              </p>
              <Button
                size="sm"
                variant="default"
                onClick={() => setShowAdvanceConfirm(true)}
                className="flex items-center gap-1.5 w-full h-9"
              >
                <Play className="h-4 w-4" />
                Advance to Season {importedSeason}
              </Button>
            </>
          ) : (
            <p className="text-[11px] text-muted-foreground">Import offseason data first.</p>
          )}
        </div>

        <AlertDialog open={showAdvanceConfirm} onOpenChange={setShowAdvanceConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Advance to Season {importedSeason}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will load the imported league state (updated rosters, aged players, draft
                results, free agents) and start the new season. The league will be unlocked and the
                offseason data will be cleared. You'll schedule pre-season fixtures in Match
                Scheduling.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleAdvance}>Advance to Next Season</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
