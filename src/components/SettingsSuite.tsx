import { useCallback, useEffect, useState } from "react";
import { useLeague, DEFAULT_FORMATION } from "@/state/league";
import { DEFAULT_SALARY_CAP } from "@/lib/contracts";
import { DEFAULT_SETTINGS, type EngineSettings } from "@/lib/engine-settings";
import { getAiKeyStatus, saveAiKey, type AiKeyStatus } from "@/lib/ai-keys.functions";
import { getAiProviderStatus, type ProviderStatus } from "@/lib/ai-status.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { KeyRound, Eye, EyeOff, Check, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export function SettingsSuite() {
  const { state, setSalaryCap, setSettings, resetMorale } = useLeague();
  const s: EngineSettings = state.settings ?? DEFAULT_SETTINGS;

  return (
    <div className="space-y-6">
      <LeagueSettings
        s={s}
        cap={state.salaryCap ?? 0}
        teamOrder={state.teamOrder}
        setSalaryCap={setSalaryCap}
        setSettings={setSettings}
        resetMorale={resetMorale}
      />
    </div>
  );
}

// ---------------- League Settings (all editable) ----------------
function LeagueSettings({
  s,
  cap,
  teamOrder,
  setSalaryCap,
  setSettings,
  resetMorale,
}: {
  s: EngineSettings;
  cap: number;
  teamOrder: string[];
  setSalaryCap: (n: number) => void;
  setSettings: (patch: Partial<EngineSettings>) => void;
  resetMorale: () => void;
}) {
  const [capDraft, setCapDraft] = useState("");
  const [confirmResetMorale, setConfirmResetMorale] = useState(false);

  function commitCap() {
    const v = parseFloat(capDraft);
    if (!Number.isNaN(v) && v > 0) setSalaryCap(v);
    setCapDraft("");
  }

  function resetAll() {
    setSettings({
      ...DEFAULT_SETTINGS,
      contractExemptTeams: [...DEFAULT_SETTINGS.contractExemptTeams],
      manualSimTeams: [...DEFAULT_SETTINGS.manualSimTeams],
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-card/70 p-4 shadow-lg">
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-primary">
            League Settings
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Every value below is a live tuning knob — the simulation, contract, trade and morale
            engines read these in real time. Changes sync to the Cloud save instantly and are
            covered by UNDO. Structural facts (team count, season length, formation, playoff
            seeding) stay fixed.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={resetAll}>
          Reset to defaults
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SettingsCard title="Simulation Engine">
          {/* Continuous tempo slider (0.1× – 2.0×). Previously a 3-option
              select (Slow/Normal/Fast); the user asked for full free-form
              control. Any decimal in-range is now allowed. */}
          <div className="rounded-lg border bg-panel/40 p-3">
            <div className="flex items-baseline justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Default tempo
              </label>
              <span className="font-mono font-bold text-primary">{s.defaultTempo.toFixed(2)}×</span>
            </div>
            <Slider
              value={[s.defaultTempo]}
              min={0.1}
              max={2}
              step={0.05}
              onValueChange={([v]) => setSettings({ defaultTempo: Math.round(v * 100) / 100 })}
              className="mt-2"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Slower = fewer goals & chances per minute. 1.0× is baseline; 2.0× is chaotic
              end-to-end.
            </p>
          </div>

          <NumberSetting
            label="Goal multiplier (default)"
            value={s.goalMultiplier}
            step={0.05}
            min={0.1}
            max={2}
            onCommit={(v) => setSettings({ goalMultiplier: v })}
          />
          <NumberSetting
            label="Identity boost weight"
            value={s.identityBoostWeight}
            step={0.1}
            min={0}
            max={5}
            onCommit={(v) => setSettings({ identityBoostWeight: v })}
          />
          <ToggleSetting
            label="Dynamic tactics (live shifts)"
            checked={s.dynamicTactics}
            onChange={(v) => setSettings({ dynamicTactics: v })}
          />
          <ToggleSetting
            label="Weather effects"
            checked={s.weatherEffects}
            onChange={(v) => setSettings({ weatherEffects: v })}
          />
          <ToggleSetting
            label="Playoff penalties (draw → shootout)"
            checked={s.playoffPenalties}
            onChange={(v) => setSettings({ playoffPenalties: v })}
          />

          <div className="py-2">
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Parity multiplier (skill-gap)</span>
              <span className="font-mono font-bold text-primary">
                {s.parityMultiplier.toFixed(2)}×
              </span>
            </div>
            <Slider
              value={[s.parityMultiplier]}
              min={0.5}
              max={2}
              step={0.05}
              onValueChange={([v]) => setSettings({ parityMultiplier: Math.round(v * 100) / 100 })}
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Controls how much raw player attributes matter.{" "}
              <span className="font-semibold text-foreground">1.00×</span> is normal. Lower (e.g.
              0.50×) shrinks the gap between good and bad teams for tight, upset-prone games; higher
              (1.50–2.00×) exaggerates it so favourites demolish weaker sides.
            </p>
          </div>

          <NumberSetting
            label="Blowout dampener — trigger margin (goals)"
            value={s.blowoutThreshold}
            step={1}
            min={1}
            max={10}
            onCommit={(v) => setSettings({ blowoutThreshold: Math.round(v) })}
          />
          <NumberSetting
            label="Blowout dampener — steepness (exponential)"
            value={s.blowoutDecay}
            step={0.05}
            min={0}
            onCommit={(v) => setSettings({ blowoutDecay: Math.max(0, v) })}
          />
          <p className="-mt-1 pb-1 text-[11px] text-muted-foreground">
            Once a side leads by the trigger margin ({s.blowoutThreshold}+ goals), scoring is
            suppressed and the penalty grows{" "}
            <span className="font-semibold text-foreground">exponentially</span> with every further
            goal of the lead. The steepness value controls how exponential it is — higher = harsher
            per-goal suppression, lower = gentler,{" "}
            <span className="font-semibold text-foreground">0</span> disables it. The dampener also
            eases back automatically if the trailing team scores and closes the gap. Any value is
            allowed.
          </p>

          <ExemptSetting
            label="Manual-only clubs (games entered by hand, never simulated)"
            teamOrder={teamOrder}
            selected={s.manualSimTeams}
            onChange={(list) => setSettings({ manualSimTeams: list })}
          />
        </SettingsCard>

        <SettingsCard title="Contract Engine">
          <Row label="Hard salary cap" value={`$${cap.toFixed(1)}M`} highlight />
          <div className="flex items-center gap-2 py-1.5">
            <Input
              type="number"
              min={1}
              step={1}
              value={capDraft}
              placeholder="new cap ($M)"
              onChange={(e) => setCapDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && commitCap()}
              className="h-8 w-32 text-center font-mono"
            />
            <Button size="sm" variant="secondary" onClick={commitCap} disabled={!capDraft}>
              SET CAP
            </Button>
          </div>
          <Row label="Default cap baseline" value={`$${DEFAULT_SALARY_CAP}M`} />
          <NumberSetting
            label="Demand modifier — min"
            value={s.demandModifierMin}
            step={0.05}
            min={0.1}
            max={s.demandModifierMax}
            onCommit={(v) => setSettings({ demandModifierMin: v })}
          />
          <NumberSetting
            label="Demand modifier — max"
            value={s.demandModifierMax}
            step={0.05}
            min={s.demandModifierMin}
            max={5}
            onCommit={(v) => setSettings({ demandModifierMax: v })}
          />
          <NumberSetting
            label="Veteran paycut (%)"
            value={Math.round(s.veteranPaycut * 100)}
            step={1}
            min={0}
            max={90}
            onCommit={(v) => setSettings({ veteranPaycut: Math.max(0, Math.min(0.9, v / 100)) })}
          />
          <ExemptSetting
            teamOrder={teamOrder}
            selected={s.contractExemptTeams}
            onChange={(list) => setSettings({ contractExemptTeams: list })}
          />
        </SettingsCard>

        <SettingsCard title="Trade Engine">
          <NumberSetting
            label="Utility threshold"
            value={s.utilityThreshold}
            step={0.5}
            min={0}
            max={50}
            onCommit={(v) => setSettings({ utilityThreshold: v })}
          />
          <NumberSetting
            label="Transfer window — last week"
            value={s.transferWindowLastWeek}
            step={1}
            min={1}
            max={52}
            onCommit={(v) => setSettings({ transferWindowLastWeek: Math.round(v) })}
          />
          <NumberSetting
            label="Cash utility weight"
            value={s.cashUtilityWeight}
            step={0.05}
            min={0}
            max={2}
            onCommit={(v) => setSettings({ cashUtilityWeight: v })}
          />
          <NumberSetting
            label="Bench rating weight"
            value={s.benchRatingWeight}
            step={0.05}
            min={0}
            max={2}
            onCommit={(v) => setSettings({ benchRatingWeight: v })}
          />
        </SettingsCard>

        <SettingsCard title="Morale Engine">
          <NumberSetting
            label="Baseline"
            value={s.moraleBaseline}
            step={1}
            min={0}
            max={100}
            onCommit={(v) => setSettings({ moraleBaseline: Math.round(v) })}
          />
          <NumberSetting
            label="High band"
            value={s.highMorale}
            step={1}
            min={0}
            max={100}
            onCommit={(v) => setSettings({ highMorale: Math.round(v) })}
          />
          <NumberSetting
            label="Low band"
            value={s.lowMorale}
            step={1}
            min={0}
            max={100}
            onCommit={(v) => setSettings({ lowMorale: Math.round(v) })}
          />
          <NumberSetting
            label="Sack threshold (manager respect)"
            value={s.sackThreshold}
            step={1}
            min={0}
            max={100}
            onCommit={(v) => setSettings({ sackThreshold: Math.round(v) })}
          />
          <NumberSetting
            label="Manager renewal morale"
            value={s.managerRenewalMorale}
            step={1}
            min={0}
            max={100}
            onCommit={(v) => setSettings({ managerRenewalMorale: Math.round(v) })}
          />
          <NumberSetting
            label="Season carry-over reset"
            value={s.seasonMoraleReset}
            step={1}
            min={0}
            max={50}
            onCommit={(v) => setSettings({ seasonMoraleReset: Math.round(v) })}
          />

          <div className="py-2">
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Morale volatility (non-match)</span>
              <span className="font-mono font-bold text-primary">
                {s.moraleVolatility.toFixed(2)}×
              </span>
            </div>
            <Slider
              value={[s.moraleVolatility]}
              min={0}
              max={2}
              step={0.05}
              onValueChange={([v]) => setSettings({ moraleVolatility: Math.round(v * 100) / 100 })}
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Scales EVERYTHING except match results — offseason drift, trades, sackings, weekly
              bench/starter morale.
              <span className="font-semibold text-foreground"> 1.00×</span> is the engine default.
            </p>
          </div>

          <div className="py-2">
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Match Result Volatility (morale)</span>
              <span className="font-mono font-bold text-primary">
                {(s.moraleMatchResultVolatility ?? 1).toFixed(2)}×
              </span>
            </div>
            <Slider
              value={[s.moraleMatchResultVolatility ?? 1]}
              min={0}
              max={3}
              step={0.05}
              onValueChange={([v]) =>
                setSettings({ moraleMatchResultVolatility: Math.round(v * 100) / 100 })
              }
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Dedicated multiplier for team &amp; player morale swings caused by MATCH RESULTS only
              (win/loss/draw, goals, assists, cards, injuries, clean sheets). Crank it up to make
              every result matter more to the dressing room.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 py-2">
            <p className="text-[11px] text-muted-foreground">
              Instantly restore <span className="font-semibold text-foreground">every</span> club
              &amp; player to the baseline.
            </p>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setConfirmResetMorale(true)}
              className="font-semibold"
            >
              ⚠ RESET MORALE
            </Button>
          </div>
        </SettingsCard>

        <Dialog open={confirmResetMorale} onOpenChange={setConfirmResetMorale}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>⚠ Reset all morale to {s.moraleBaseline}?</DialogTitle>
              <DialogDescription>
                This sets <span className="font-semibold text-foreground">every team's morale</span>{" "}
                and <span className="font-semibold text-foreground">every player's morale</span>{" "}
                across the entire league back to the baseline ({s.moraleBaseline}). It does not undo
                any sackings that already happened. This is a big, league-wide change — you can
                reverse it with the UNDO button afterwards.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmResetMorale(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  resetMorale();
                  setConfirmResetMorale(false);
                }}
              >
                Yes, reset all morale
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <SettingsCard title="Manager & Influence">
          <div className="py-2">
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Press influence baseline</span>
              <span className="font-mono font-bold text-primary">
                {s.pressInfluenceBaseline.toFixed(2)}×
              </span>
            </div>
            <Slider
              value={[s.pressInfluenceBaseline]}
              min={0}
              max={3}
              step={0.05}
              onValueChange={([v]) =>
                setSettings({ pressInfluenceBaseline: Math.round(v * 100) / 100 })
              }
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              How loud a manager's words land. Scales every press-conference + DM morale &
              relationship swing.
              <span className="font-semibold text-foreground"> 1.00×</span> is the default;
              respected managers still hit harder than disrespected ones on top of this.
            </p>
          </div>
          <div className="py-2">
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Manager rating volatility</span>
              <span className="font-mono font-bold text-primary">
                {s.managerRatingVolatility.toFixed(2)}×
              </span>
            </div>
            <Slider
              value={[s.managerRatingVolatility]}
              min={0}
              max={3}
              step={0.05}
              onValueChange={([v]) =>
                setSettings({ managerRatingVolatility: Math.round(v * 100) / 100 })
              }
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              How wildly the respect rating swings each week based on standings + harshness
              extremes. This is the SEASONAL/match-results dial — press-conference swings have their
              own slider below.
            </p>
          </div>
          <div className="py-2">
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Match Result Volatility (respect)</span>
              <span className="font-mono font-bold text-primary">
                {(s.managerMatchResultVolatility ?? 1).toFixed(2)}×
              </span>
            </div>
            <Slider
              value={[s.managerMatchResultVolatility ?? 1]}
              min={0}
              max={5}
              step={0.1}
              onValueChange={([v]) =>
                setSettings({ managerMatchResultVolatility: Math.round(v * 100) / 100 })
              }
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Dedicated multiplier for respect swings caused by MATCH RESULTS only — margin of
              victory, opponent quality, and streak momentum. Keeps standings drift (above)
              independent so a team already top of the table can still gain/lose respect purely off
              results.
            </p>
          </div>
          <div className="py-2">
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Press conference volatility</span>
              <span className="font-mono font-bold text-primary">
                {(s.pressConferenceVolatility ?? 1).toFixed(2)}×
              </span>
            </div>
            <Slider
              value={[s.pressConferenceVolatility ?? 1]}
              min={0}
              max={5}
              step={0.1}
              onValueChange={([v]) =>
                setSettings({ pressConferenceVolatility: Math.round(v * 100) / 100 })
              }
            />

            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Dedicated multiplier for respect movement caused by press-conference answers ONLY.
              Crank this up for high-drama interviews without changing weekly match drift.
            </p>
          </div>
          <div className="py-2">
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Standings weight (respect drift)</span>
              <span className="font-mono font-bold text-primary">
                {(s.standingsWeight ?? 1).toFixed(2)}×
              </span>
            </div>
            <Slider
              value={[s.standingsWeight ?? 1]}
              min={0.5}
              max={4}
              step={0.1}
              onValueChange={([v]) => setSettings({ standingsWeight: Math.round(v * 100) / 100 })}
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              How much league position pulls a manager's respect each week. Higher = the top of the
              table earns much more respect than the bottom.
            </p>
          </div>
          <NumberSetting
            label="Relations baseline"
            value={s.relationsBaseline}
            step={1}
            min={0}
            max={100}
            onCommit={(v) => setSettings({ relationsBaseline: Math.round(v) })}
          />
          <div className="py-2">
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Relations volatility</span>
              <span className="font-mono font-bold text-primary">
                {s.relationsVolatility.toFixed(2)}×
              </span>
            </div>
            <Slider
              value={[s.relationsVolatility]}
              min={0}
              max={3}
              step={0.05}
              onValueChange={([v]) =>
                setSettings({ relationsVolatility: Math.round(v * 100) / 100 })
              }
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              How quickly managers warm up or cool off after each interaction. Hot-headed
              personalities swing harder on top of this.
            </p>
          </div>
        </SettingsCard>

        <SettingsCard title="Newsroom (Auto-Articles)">
          <div className="py-2">
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Auto-article frequency</span>
              <span className="font-mono font-bold text-primary">
                {Math.round((s.newsFrequency ?? 0.5) * 100)}%
              </span>
            </div>
            <Slider
              value={[(s.newsFrequency ?? 0.5) * 100]}
              min={0}
              max={100}
              step={5}
              onValueChange={([v]) =>
                setSettings({ newsFrequency: Math.max(0, Math.min(1, v / 100)) })
              }
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Chance an eligible event (upsets, blowouts, streaks, leader changes, trades, sackings)
              spawns an AI-written article filed to the Newsroom archive.{" "}
              <span className="font-semibold text-foreground">0%</span> disables all auto-articles;{" "}
              <span className="font-semibold text-foreground">100%</span> writes one for every
              event.
            </p>
          </div>
        </SettingsCard>

        <AiModelCard s={s} setSettings={setSettings} />
        <ApiKeyCard />

        <SettingsCard title="Player Development">
          <NumberSetting
            label="Upgrade DP Threshold"
            value={s.trainingDpThreshold ?? 100}
            step={5}
            min={10}
            max={5000}
            onCommit={(v) => setSettings({ trainingDpThreshold: Math.round(v) })}
          />
          <p className="py-2 text-[11px] text-muted-foreground leading-normal">
            Controls how many Development Points (DPs) a player must accumulate to trigger a 0.1
            rating upgrade. Lower values accelerate player growth and training speed, while higher
            values slow down development. Default is 100.
          </p>
        </SettingsCard>

        <SettingsCard title="League Structure (reference)">
          <Row label="Teams" value="24 · 9v9" />
          <Row label="Default formation" value={DEFAULT_FORMATION} />
          <Row label="Regular season" value="12 weeks" />
          <Row label="Final Four" value="Weeks 13–16 (48 games)" />
          <Row label="Playoffs" value="Top 14 seeded, byes for seeds 1–2" />
        </SettingsCard>
      </div>
    </div>
  );
}

// ---------------- AI model selector (hard-pin, no fallback) ----------------
const PROVIDER_DEFS: { name: string; label: string; model: string }[] = [
  { name: "gemini", label: "Google Gemini (2.5 Flash)", model: "gemini-2.5-flash" },
  { name: "openrouter", label: "OpenRouter (Gemini 2.5 Flash)", model: "google/gemini-2.5-flash" },
  { name: "groq", label: "Groq (Llama 3.3 70B)", model: "llama-3.3-70b-versatile" },
  { name: "mistral", label: "Mistral (Small Latest)", model: "mistral-small-latest" },
];

function AiModelCard({
  s,
  setSettings,
}: {
  s: EngineSettings;
  setSettings: (p: Partial<EngineSettings>) => void;
}) {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const statusRes = await getAiKeyStatus();
      const providerRes = await getAiProviderStatus();
      const out: ProviderStatus[] = PROVIDER_DEFS.map((p) => {
        let hasKey = false;
        if (p.name === "gemini") {
          hasKey = statusRes.gemini || statusRes.gemini2 || statusRes.gemini3;
        } else if (p.name === "openrouter") hasKey = statusRes.openrouter;
        else if (p.name === "groq") hasKey = statusRes.groq;
        else if (p.name === "mistral") hasKey = statusRes.mistral;
        const cd = providerRes.providers?.find((sp) => sp.name === p.name);
        return {
          name: p.name as ProviderStatus["name"],
          label: p.label,
          model: p.model,
          hasKey,
          cooldownMs: cd?.cooldownMs ?? 0,
          reason: cd?.reason ?? null,
        };
      });
      setProviders(out);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load AI status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 60_000);
    const onKeysChanged = () => void refresh();
    window.addEventListener("ai-keys-changed", onKeysChanged);
    return () => {
      clearInterval(id);
      window.removeEventListener("ai-keys-changed", onKeysChanged);
    };
  }, [refresh]);

  const chosen = s.aiProvider ?? "auto";
  return (
    <SettingsCard title="AI Model (Hard-Pinned)">
      <p className="pt-2 text-[11px] text-muted-foreground">
        Choose which provider handles every AI call in the app. Hard-pinned: if the chosen provider
        fails, the call surfaces an error instead of silently falling back. Pick{" "}
        <span className="font-semibold text-foreground">Auto</span> to keep the original
        multi-provider fallback chain.
      </p>
      <div className="py-2">
        <button
          type="button"
          onClick={() => setSettings({ aiProvider: "auto" })}
          className={`mb-2 w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
            chosen === "auto"
              ? "border-primary bg-primary/10 font-semibold text-foreground"
              : "border-border bg-background hover:border-primary/50"
          }`}
        >
          <div className="flex items-center justify-between">
            <span>Auto (fallback chain)</span>
            <span className="rounded bg-success/20 px-2 py-0.5 text-[10px] font-bold uppercase text-success">
              Always ready
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Tries Lovable AI first; falls through to Gemini, Mistral, OpenRouter, Groq on failure.
            Gemini rotates through 3 API keys before moving on.
          </div>
        </button>
        {loading && providers.length === 0 && (
          <div className="px-1 py-2 text-[11px] text-muted-foreground">
            Checking provider status…
          </div>
        )}
        {providers.map((p) => {
          const cooldownMin = Math.ceil(p.cooldownMs / 60_000);
          const locked = !p.hasKey || p.cooldownMs > 0;
          const isActive = chosen === p.name;
          const status = !p.hasKey
            ? { label: "NO KEY", tone: "muted" as const }
            : p.reason === "credits"
              ? { label: `CREDITS EXHAUSTED — ${cooldownMin}m`, tone: "destructive" as const }
              : p.reason === "rate_limit"
                ? { label: `RATE LIMITED — ${cooldownMin}m`, tone: "destructive" as const }
                : p.reason === "error"
                  ? { label: "ERROR", tone: "destructive" as const }
                  : { label: "READY", tone: "success" as const };
          return (
            <button
              key={p.name}
              type="button"
              disabled={locked}
              onClick={() => setSettings({ aiProvider: p.name })}
              className={`mb-2 w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                locked
                  ? "cursor-not-allowed border-border bg-muted/40 opacity-60"
                  : isActive
                    ? "border-primary bg-primary/10 font-semibold text-foreground"
                    : "border-border bg-background hover:border-primary/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{p.label}</span>
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                    status.tone === "success"
                      ? "bg-success/20 text-success"
                      : status.tone === "destructive"
                        ? "bg-destructive/20 text-destructive"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {status.label}
                </span>
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                Model: <span className="font-mono">{p.model}</span>
              </div>
            </button>
          );
        })}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-muted-foreground">
            Status auto-refreshes every 60s.{" "}
            {err && <span className="text-destructive">· {err}</span>}
          </span>
          <Button size="sm" variant="ghost" onClick={() => void refresh()}>
            ↻ Refresh
          </Button>
        </div>
      </div>
    </SettingsCard>
  );
}

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow">
      <div className="border-b bg-panel px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="divide-y px-4">{children}</div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`text-right font-medium ${highlight ? "font-mono font-extrabold text-primary" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

// Numeric setting with a local draft committed on blur/Enter.
function NumberSetting({
  label,
  value,
  step,
  min,
  max,
  onCommit,
}: {
  label: string;
  value: number;
  step?: number;
  min?: number;
  max?: number;
  onCommit: (v: number) => void;
}) {
  const [draft, setDraft] = useState<string>(String(value));
  const [editing, setEditing] = useState(false);

  // Keep the field in sync when the underlying value changes externally.
  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  function commit() {
    setEditing(false);
    let v = parseFloat(draft);
    if (!Number.isNaN(v)) {
      // Clamp to the field's declared bounds so invalid values (e.g. morale 200,
      // or an inverted demand min/max) can never be committed.
      if (min != null) v = Math.max(min, v);
      if (max != null) v = Math.min(max, v);
      onCommit(v);
      setDraft(String(v));
    } else {
      setDraft(String(value));
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Input
        type="number"
        step={step}
        min={min}
        max={max}
        value={draft}
        onFocus={() => setEditing(true)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="h-8 w-24 text-center font-mono"
      />
    </div>
  );
}

function ToggleSetting({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function SelectSetting({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// Multi-select for contract-exempt clubs.
function ExemptSetting({
  teamOrder,
  selected,
  onChange,
  label = "Exempt clubs (auto contract engine skips these)",
}: {
  teamOrder: string[];
  selected: string[];
  onChange: (list: string[]) => void;
  label?: string;
}) {
  function toggle(name: string) {
    onChange(selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name]);
  }
  return (
    <div className="py-2 text-sm">
      <div className="mb-1.5 text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {teamOrder.map((name) => {
          const on = selected.includes(name);
          return (
            <button
              key={name}
              type="button"
              onClick={() => toggle(name)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                on
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-primary/50"
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── API Key Management Card ──────────────────────────────────────────
// Lets users enter API keys for each AI provider directly in the UI.
// Keys are stored in the ai_api_keys table and used server-side when
// env vars are absent. After saving, dispatches an event so the
// AiModelCard above refreshes its provider status.
const KEY_FIELDS: {
  field: keyof AiKeyStatus;
  label: string;
  envHint: string;
  signupUrl: string;
  placeholder: string;
}[] = [
  {
    field: "gemini",
    label: "Google Gemini (Primary)",
    envHint: "GEMINI_API_KEY",
    signupUrl: "https://aistudio.google.com/apikey",
    placeholder: "AIza…",
  },
  {
    field: "gemini2",
    label: "Google Gemini (Key 2 — rotation)",
    envHint: "GEMINI_API_KEY_2",
    signupUrl: "https://aistudio.google.com/apikey",
    placeholder: "AIza…",
  },
  {
    field: "gemini3",
    label: "Google Gemini (Key 3 — rotation)",
    envHint: "GEMINI_API_KEY_3",
    signupUrl: "https://aistudio.google.com/apikey",
    placeholder: "AIza…",
  },
  {
    field: "groq",
    label: "Groq",
    envHint: "GROQ_API_KEY",
    signupUrl: "https://console.groq.com/keys",
    placeholder: "gsk_…",
  },
  {
    field: "mistral",
    label: "Mistral",
    envHint: "MISTRAL_API_KEY",
    signupUrl: "https://console.mistral.ai/api-keys",
    placeholder: "…",
  },
  {
    field: "openrouter",
    label: "OpenRouter",
    envHint: "OPENROUTER_API_KEY",
    signupUrl: "https://openrouter.ai/keys",
    placeholder: "sk-or-…",
  },
];

function ApiKeyCard() {
  const [status, setStatus] = useState<AiKeyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await getAiKeyStatus();
      setStatus(res);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function upsertKey(field: string, value: string) {
    const res = await saveAiKey({ data: { field, value } });
    if (!res.ok) throw new Error(res.error ?? "save failed");
  }

  async function handleSave(field: string) {
    const value = values[field] ?? "";
    if (!value.trim()) {
      toast.error("Enter a key first.");
      return;
    }
    setSaving(field);
    try {
      await upsertKey(field, value);
      toast.success("API key saved.");
      setValues((v) => ({ ...v, [field]: "" }));
      await refresh();
      window.dispatchEvent(new CustomEvent("ai-keys-changed"));
    } catch (e) {
      toast.error(`Failed to save key: ${e instanceof Error ? e.message : "unknown error"}`);
    } finally {
      setSaving(null);
    }
  }

  async function handleClear(field: string) {
    setSaving(field);
    try {
      await upsertKey(field, "");
      toast.success("API key cleared.");
      await refresh();
      window.dispatchEvent(new CustomEvent("ai-keys-changed"));
    } catch (e) {
      toast.error(`Failed to clear key: ${e instanceof Error ? e.message : "unknown error"}`);
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="rounded-xl border bg-card">
      <div className="border-b bg-panel px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
          <KeyRound className="h-4 w-4" />
          AI Provider API Keys
        </div>
      </div>
      <div className="space-y-1 p-4">
        <p className="mb-4 text-xs text-muted-foreground leading-relaxed">
          Enter API keys for the AI providers used by the league engine (match simulation, press
          conferences, news articles, etc.). Keys are stored securely in the cloud database and
          used automatically when the server has no environment-variable key configured. Get a free
          key from any provider's console linked below.
        </p>
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading key status…
          </div>
        ) : (
          <div className="space-y-3">
            {KEY_FIELDS.map((kf) => {
              const isSet = status?.[kf.field] ?? false;
              return (
                <div key={kf.field} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{kf.label}</span>
                      {isSet && (
                        <span className="flex items-center gap-1 rounded bg-success/15 px-2 py-0.5 text-[10px] font-bold uppercase text-success">
                          <Check className="h-3 w-3" />
                          Configured
                        </span>
                      )}
                    </div>
                    <a
                      href={kf.signupUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                    >
                      Get key <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={visible[kf.field] ? "text" : "password"}
                        value={values[kf.field] ?? ""}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [kf.field]: e.target.value }))
                        }
                        placeholder={kf.placeholder}
                        className="pr-9 font-mono text-xs"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setVisible((v) => ({ ...v, [kf.field]: !v[kf.field] }))
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {visible[kf.field] ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <Button
                      size="sm"
                      variant="default"
                      disabled={saving === kf.field || !(values[kf.field] ?? "").trim()}
                      onClick={() => handleSave(kf.field)}
                      className="h-9"
                    >
                      {saving === kf.field ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Save"
                      )}
                    </Button>
                    {isSet && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={saving === kf.field}
                        onClick={() => handleClear(kf.field)}
                        className="h-9"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    Env var: <code className="bg-muted px-1 py-0.5 rounded">{kf.envHint}</code>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
