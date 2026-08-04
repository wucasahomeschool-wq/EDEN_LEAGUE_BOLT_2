import { useState } from "react";
import { useLeague, type LeaguePlayer } from "@/state/league";
import { calculateMarketValue } from "@/lib/contracts";
import { isContractExempt } from "@/lib/engine-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AgentNegotiationDialog } from "@/components/AgentNegotiationDialog";

export function ContractsSuite() {
  const { state, setSalaryCap, selectedUser } = useLeague();
  const [capDraft, setCapDraft] = useState("");

  // Agent negotiation state.
  const [negotiating, setNegotiating] = useState<{
    team: string;
    index: number;
    player: LeaguePlayer;
  } | null>(null);

  const cap = state.salaryCap ?? 0;
  const userTeams =
    selectedUser !== "commissioner" ? [selectedUser] : state.teamOrder.filter(isContractExempt);

  function commitCap() {
    const v = parseFloat(capDraft);
    if (!Number.isNaN(v) && v > 0) setSalaryCap(v);
    setCapDraft("");
  }

  const capEditor = (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Hard Salary Cap
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="font-mono text-2xl font-extrabold text-primary">${cap.toFixed(1)}M</span>
        <Input
          type="number"
          min={1}
          step={1}
          value={capDraft}
          placeholder="edit"
          onChange={(e) => setCapDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && commitCap()}
          className="h-8 w-24 text-center font-mono"
        />
        <Button size="sm" variant="secondary" onClick={commitCap} disabled={!capDraft}>
          SET CAP
        </Button>
      </div>
    </div>
  );

  const agentDialog = (
    <AgentNegotiationDialog
      open={!!negotiating}
      team={negotiating?.team ?? ""}
      index={negotiating?.index ?? 0}
      player={negotiating?.player ?? null}
      onClose={() => setNegotiating(null)}
    />
  );

  // Always-visible: contract editor for the user's clubs (item 5 — the only
  // place to change a user-club contract now that the Team Editor locks them).
  const userClubsPanel =
    userTeams.length === 0 ? null : (
      <div className="space-y-4">
        <div className="rounded-lg border-l-4 border-stadium-gold bg-card px-4 py-2 text-xs text-muted-foreground">
          Your contract talks. Open{" "}
          <span className="font-semibold text-foreground">RENEGOTIATE</span> to talk to each
          player's agent — every agent has their own personality and tolerance. These contracts are
          no longer editable in the Team Editor.
        </div>
        {userTeams.map((team) => {
          const t = state.teams[team];
          if (!t) return null;
          const payroll = t.players.reduce((s, p) => s + (p.salary ?? 0), 0);
          return (
            <div
              key={team}
              className="overflow-hidden rounded-xl border border-border bg-card shadow"
            >
              <div className="flex items-center justify-between border-b bg-panel px-3 py-2 text-xs font-bold uppercase tracking-wide">
                <span>{team}</span>
                <span className="font-mono text-muted-foreground">
                  Payroll ${payroll.toFixed(1)}M
                </span>
              </div>
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-3 py-1.5 text-left">Player</th>
                    <th className="px-3 py-1.5 text-right">Salary</th>
                    <th className="px-3 py-1.5 text-right">Years</th>
                    <th className="px-3 py-1.5 text-right">Market</th>
                    <th className="px-3 py-1.5 text-right" />
                  </tr>
                </thead>
                <tbody>
                  {t.players.map((p, i) => (
                    <tr key={`${p.name}-${i}`} className="border-b last:border-0">
                      <td className="px-3 py-1.5 font-medium">
                        {p.name} <span className="text-muted-foreground">({p.position})</span>
                        {p.agent && (
                          <span className="ml-2 text-[10px] text-muted-foreground">
                            agent: {p.agent.name}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                        ${(p.salary ?? 0).toFixed(1)}M
                      </td>
                      <td
                        className={`px-3 py-1.5 text-right font-mono tabular-nums ${(p.contractYears ?? 0) <= 1 ? "text-destructive font-bold" : ""}`}
                      >
                        {p.contractYears ?? 0}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                        ${calculateMarketValue(p.rating).toFixed(1)}M
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[11px] font-semibold"
                          onClick={() => setNegotiating({ team, index: i, player: p })}
                        >
                          RENEGOTIATE
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    );

  // The offseason contract cycle is now handled by the separate offseason app.
  // This suite only shows contract status and allows in-season renegotiation.
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card/70 p-4 shadow-lg">
        <div className="flex flex-wrap items-center gap-4">
          {capEditor}
          <p className="max-w-xl text-xs text-muted-foreground">
            The offseason contract cycle (auto-renewals, releases, free-agency) is now handled by
            the separate Eden League Offseason app. Use the{" "}
            <strong className="text-foreground">Offseason Import</strong> suite after the season
            ends to import the results. You can still renegotiate your own players below at any time
            during the season.
          </p>
        </div>
      </div>

      {userClubsPanel}
      {agentDialog}
    </div>
  );
}
