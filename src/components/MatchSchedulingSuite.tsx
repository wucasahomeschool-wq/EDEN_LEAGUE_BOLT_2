import { useLeague, isWeekComplete, PRE_SEASON_WEEKS } from "@/state/league";
import { FixtureBuilder } from "@/components/FixtureBuilder";

const FINAL_FOUR_WEEKS = [13, 14, 15, 16];
const REGULAR_WEEKS = Array.from({ length: 12 }, (_, i) => i + 1);
const PRE_SEASON_WEEK_RANGE = Array.from(
  { length: PRE_SEASON_WEEKS },
  (_, i) => -PRE_SEASON_WEEKS + i,
) as number[];

export function MatchSchedulingSuite() {
  const { state, scheduleFinalFour, schedulePreSeason, scheduleNewSeason } = useLeague();

  const week12Done = isWeekComplete(state, 12);
  const finalFourExists = state.fixtures.some((f) => f.week >= 13);
  const seasonOver = !!state.playoffs?.champion;
  const isPreSeason = state.phase === "preseason";
  const preSeasonFixtures = state.fixtures.filter((f) => f.week < 0);
  const preSeasonComplete = preSeasonFixtures.length > 0 &&
    PRE_SEASON_WEEK_RANGE.every((w) => preSeasonFixtures.some((f) => f.week === w));
  const regularSeasonExists = state.fixtures.some((f) => f.week >= 1 && f.week <= 12);

  // Phase 0: Pre-season scheduling (at the start of a new season, before any pre-season fixtures exist).
  if (isPreSeason && !preSeasonComplete) {
    return (
      <div className="space-y-4">
        <Banner
          title={`Schedule Pre-Season · Season ${state.season}`}
          body={`The new season has started. Schedule ${PRE_SEASON_WEEKS} weeks of pre-season fixtures (Weeks ${PRE_SEASON_WEEK_RANGE.map((w) => Math.abs(w)).join(" and ")}). Every team plays once per week. These matches don't count toward standings — they're for warming up your squad. Pick the two clubs for each match, then save.`}
        />
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <FixtureBuilder
            weeks={PRE_SEASON_WEEK_RANGE}
            title={`Pre-Season Builder (Weeks ${PRE_SEASON_WEEK_RANGE.map((w) => Math.abs(w)).join(" & ")} · ${Math.floor(state.teamOrder.length / 2)} matches each)`}
            commit={schedulePreSeason}
            saveLabelOverride="SAVE PRE-SEASON"
            phase="preseason"
          />
          <StandingsReference />
        </div>
      </div>
    );
  }

  // Phase 0b: Regular season scheduling (pre-season fixtures exist, but no regular season yet).
  if (isPreSeason && preSeasonComplete && !regularSeasonExists) {
    return (
      <div className="space-y-4">
        <Banner
          title={`Schedule Regular Season · Season ${state.season}`}
          body="Pre-season is set. Now schedule the 12-week regular season (Weeks 1-12). Every team plays once per week. Pick the two clubs for each match, add them week by week, then save."
        />
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <FixtureBuilder
            weeks={REGULAR_WEEKS}
            title="Regular Season Builder (Weeks 1-12 · 12 matches each)"
            commit={scheduleNewSeason}
            saveLabelOverride="SAVE REGULAR SEASON"
            phase="regular"
          />
          <StandingsReference />
        </div>
      </div>
    );
  }

  // Phase 1: Final Four scheduling (after Week 12, before Final Four exists).
  if (week12Done && !finalFourExists) {
    return (
      <div className="space-y-4">
        <Banner
          title={`Schedule the Final Four · Season ${state.season}`}
          body="Week 12 is complete. The Final Four spans FOUR full weeks (Weeks 13–16) — schedule all 48 fixtures (12 matches per week, every team plays once a week). Pick the two clubs for each match, add them week by week, then save to append these weeks to the Season Schedule."
        />
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <FixtureBuilder
            weeks={FINAL_FOUR_WEEKS}
            title="Final Four Builder (Weeks 13–16 · 12 matches each)"
            commit={scheduleFinalFour}
            saveLabelOverride="SAVE FINAL FOUR"
            phase="finalfour"
          />
          <StandingsReference />
        </div>
      </div>
    );
  }

  // Otherwise: nothing to schedule right now.
  return (
    <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
      <p className="mb-2 font-semibold text-foreground">No scheduling actions required</p>
      <p>
        The Match Scheduling suite unlocks when there are pre-season or regular season fixtures to
        build, or when Week 12 concludes (to build the Final Four).
      </p>
    </div>
  );
}

function StandingsReference() {
  const { standings } = useLeague();
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <div className="border-b px-4 py-2.5 text-sm font-bold uppercase tracking-wide">
        Standings Reference
      </div>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b bg-panel text-left font-bold uppercase text-muted-foreground">
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Team</th>
            <th className="px-3 py-2 text-center">PTS</th>
            <th className="px-3 py-2 text-center">GD</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row) => (
            <tr key={row.team} className="border-b last:border-0 odd:bg-muted/40">
              <td className="px-3 py-1.5 text-center font-mono tabular-nums">{row.rank}</td>
              <td className="px-3 py-1.5 font-medium">{row.team}</td>
              <td className="px-3 py-1.5 text-center font-mono font-bold tabular-nums text-primary">
                {row.pts}
              </td>
              <td className="px-3 py-1.5 text-center tabular-nums">
                {row.gd > 0 ? `+${row.gd}` : row.gd}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Banner({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border bg-panel/50 p-4 text-sm">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-muted-foreground">{body}</p>
    </div>
  );
}
