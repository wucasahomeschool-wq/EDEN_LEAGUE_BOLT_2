import { useMemo, useState } from "react";
import {
  useLeague,
  type FixtureEntry,
  type LeaguePlayer,
  TRAINING_DRILLS,
  DEFAULT_TRAINING_REGIMEN,
} from "@/state/league";
import { useNavigation } from "@/state/navigation";
import { Button } from "@/components/ui/button";
import { TeamBadge } from "@/components/TeamBadge";
import { getTeamColors } from "@/lib/team-branding";
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
import {
  Calendar,
  MessageSquare,
  Handshake,
  Trophy,
  AlertCircle,
  Sparkles,
  CheckCircle,
  FileText,
  Dumbbell,
  ShieldAlert,
  Zap,
  TrendingUp,
} from "lucide-react";

export function HomeDashboardSuite() {
  const {
    state,
    selectedUser,
    standings,
    leaderboards,
    setTrainingRegimen,
    setTrainingOverride,
    setTrainingFocus,
  } = useLeague();
  const { goToSuite } = useNavigation();

  const [customizeTrainingOpen, setCustomizeTrainingOpen] = useState(false);

  const userTeam = selectedUser;
  const team = state.teams[userTeam];
  const manager = state.managers[userTeam];

  // 1. Standings placement
  const rank = useMemo(() => {
    const idx = standings.findIndex((s) => s.team === userTeam);
    return idx >= 0 ? idx + 1 : null;
  }, [standings, userTeam]);

  const standingRow = useMemo(() => {
    return standings.find((s) => s.team === userTeam);
  }, [standings, userTeam]);

  // 2. Upcoming Match
  const upcomingMatch = useMemo(() => {
    const activeWeek = state.currentWeek;
    // Find fixtures for userTeam in current week that are not played
    const matches = state.fixtures.filter(
      (f) => f.week === activeWeek && (f.home === userTeam || f.away === userTeam),
    );
    // Find the one closest to current day or unplayed
    const played = state.results;
    const unplayed = matches.filter((f) => !played[f.id]);
    return unplayed[0] || matches[matches.length - 1] || null;
  }, [state.fixtures, state.results, userTeam, state.currentWeek]);

  // 3. Trade/Negotiation proposals
  const activeProposals = useMemo(() => {
    return state.tradeProposals.filter((p) => p.teamA === userTeam || p.teamB === userTeam);
  }, [state.tradeProposals, userTeam]);

  // 4. Draft notification
  const draftTurnInfo = useMemo(() => {
    if (!state.draft || state.draft.complete) return null;
    const currentPick = state.draft.order[state.draft.currentPickIndex];
    if (!currentPick) return null;

    // Find if the current pick belongs to userTeam
    // Pick structure contains pick.team usually, let's verify in state/league.tsx if needed
    // In DraftSuite.tsx, a pick is drawn from draft.order, and we check state.draft.order
    const activePickId = state.draft.order[state.draft.currentPickIndex];
    const pickDetail = state.draftPicks?.find((p) => p.id === activePickId);
    const isUserTurn = pickDetail?.owner === userTeam;

    return {
      isUserTurn,
      round: pickDetail?.round ?? 1,
      number: 1,
      overall: state.draft.currentPickIndex + 1,
    };
  }, [state.draft, state.draftPicks, userTeam]);

  // 5. Tasks/Reminders
  const tasks = useMemo(() => {
    const list = [];

    // Draft turn
    if (draftTurnInfo?.isUserTurn) {
      list.push({
        id: "draft-turn",
        title: "Your Draft Selection Is Up!",
        description: `You are currently on the clock for Round ${draftTurnInfo.round}, Pick ${draftTurnInfo.number} (Overall ${draftTurnInfo.overall}).`,
        actionLabel: "Go to Draft Room",
        action: () => goToSuite("Draft"),
        severity: "critical",
      });
    }

    // Unresolved trade proposals
    if (activeProposals.length > 0) {
      list.push({
        id: "trades",
        title: "Pending Trade Proposals",
        description: `You have ${activeProposals.length} active trade proposal(s) awaiting your feedback in the Negotiation Suite.`,
        actionLabel: "Open Negotiations",
        action: () => goToSuite("Negotiation"),
        severity: "high",
      });
    }

    // Team needs starters check
    const hasIncompleteLineup = team ? team.lineup.some((p) => !p) : false;
    if (hasIncompleteLineup) {
      list.push({
        id: "lineup",
        title: "Incomplete Lineup",
        description:
          "Your matchday squad has empty starting positions. Fill them in the Team Editor before the next match.",
        actionLabel: "Fix Lineup",
        action: () => goToSuite("Team Editor"),
        severity: "high",
      });
    }

    // Injuries/Suspensions check
    const unavailableCount = team
      ? team.players.filter((p) => p.injuryWeeks > 0 || p.suspensionWeeks > 0).length
      : 0;
    if (unavailableCount > 0) {
      list.push({
        id: "injuries",
        title: "Injured or Suspended Players",
        description: `You currently have ${unavailableCount} player(s) ruled out of matchday selection.`,
        actionLabel: "Review Roster",
        action: () => goToSuite("Team Editor"),
        severity: "medium",
      });
    }

    // CUSTOMIZE TRAINING SESSION Task
    if (team) {
      const isUserGameday =
        state.currentWeek >= 17
          ? (state.playoffs?.rounds?.[state.currentWeek - 17]?.some(
              (m) =>
                (m.home === userTeam || m.away === userTeam) &&
                (m.day ?? "Saturday") === state.currentDay,
            ) ?? false)
          : state.fixtures.some(
              (f) =>
                f.week === state.currentWeek &&
                (f.day ?? "Monday") === state.currentDay &&
                (f.home === userTeam || f.away === userTeam),
            );

      if (state.currentDay !== "OFFSEASON" && !isUserGameday) {
        const currentOverrideKey = state.currentDayTrainingOverride?.[userTeam];
        const dayIndexMap: Record<string, number> = {
          Monday: 0,
          Tuesday: 1,
          Wednesday: 2,
          Thursday: 3,
          Friday: 4,
          Saturday: 5,
          Sunday: 6,
        };
        const dayIdx = dayIndexMap[state.currentDay] ?? 0;
        const defaultDrillKey =
          team.trainingRegimen?.[dayIdx] || DEFAULT_TRAINING_REGIMEN[dayIdx] || "rest";
        const drillKey = currentOverrideKey || defaultDrillKey;
        const drillName = TRAINING_DRILLS[drillKey]?.name || "Rest Day";

        list.push({
          id: "customize-training",
          title: "CUSTOMIZE TRAINING SESSION",
          description: `Today is ${state.currentDay}. Training drill: ${drillName}${currentOverrideKey ? " (Custom Override)" : " (Default Template)"}. Customize today's session.`,
          actionLabel: "Customize Training",
          action: () => setCustomizeTrainingOpen(true),
          severity: "medium",
        });
      }
    }

    // Press Conference Reminder Task
    if (userTeam && state) {
      const DAY_ORDER = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ];
      const currentDayIdx =
        state.currentDay === "OFFSEASON" ? -1 : DAY_ORDER.indexOf(state.currentDay as string);

      // Check regular season pending pre-match press conferences
      const pendingPreReg =
        currentDayIdx >= 0 &&
        state.fixtures.some((f) => {
          if (f.week !== state.currentWeek) return false;
          if (state.results[f.id]) return false;
          if (f.home !== userTeam && f.away !== userTeam) return false;
          const matchDayIdx = DAY_ORDER.indexOf(f.day ?? "Monday");
          const isDayOf = matchDayIdx === currentDayIdx;
          const isDayBefore = (currentDayIdx + 1) % 7 === matchDayIdx;
          return isDayOf || isDayBefore;
        });

      // Check regular season pending post-match press conferences
      const pendingPostReg =
        currentDayIdx >= 0 &&
        state.fixtures.some((f) => {
          if (f.week !== state.currentWeek) return false;
          if (!state.results[f.id]) return false;
          if (f.home !== userTeam && f.away !== userTeam) return false;
          const matchDayIdx = DAY_ORDER.indexOf(f.day ?? "Monday");
          const isDayOf = matchDayIdx === currentDayIdx;
          const isDayAfter = (matchDayIdx + 1) % 7 === currentDayIdx;
          return isDayOf || isDayAfter;
        });

      // Check playoff pending pre-match press conferences
      const pendingPrePlayoff =
        currentDayIdx >= 0 &&
        (state.playoffs?.rounds?.flat() ?? []).some((m) => {
          if (16 + m.round !== state.currentWeek) return false;
          if (m.result) return false;
          if (m.home !== userTeam && m.away !== userTeam) return false;
          const matchDayIdx = DAY_ORDER.indexOf(m.day ?? "Saturday");
          const isDayOf = matchDayIdx === currentDayIdx;
          const isDayBefore = (currentDayIdx + 1) % 7 === matchDayIdx;
          return isDayOf || isDayBefore;
        });

      // Check playoff pending post-match press conferences
      const pendingPostPlayoff =
        currentDayIdx >= 0 &&
        (state.playoffs?.rounds?.flat() ?? []).some((m) => {
          if (16 + m.round !== state.currentWeek) return false;
          if (!m.result) return false;
          if (m.home !== userTeam && m.away !== userTeam) return false;
          const matchDayIdx = DAY_ORDER.indexOf(m.day ?? "Saturday");
          const isDayOf = matchDayIdx === currentDayIdx;
          const isDayAfter = (matchDayIdx + 1) % 7 === currentDayIdx;
          return isDayOf || isDayAfter;
        });

      if (pendingPreReg || pendingPostReg || pendingPrePlayoff || pendingPostPlayoff) {
        list.push({
          id: "press-conference",
          title: "🎤 Press Conference Available",
          description:
            "The media is waiting to speak with you regarding your upcoming or recently completed match.",
          actionLabel: "Go to Newsroom",
          action: () => goToSuite("Newsroom"),
          severity: "medium",
        });
      }
    }

    // Standard reminder if clean
    if (list.length === 0) {
      list.push({
        id: "all-clear",
        title: "Roster and Affairs in Order",
        description:
          "No immediate action required. You are fully prepared for the upcoming matchday.",
        actionLabel: "View Standings",
        action: () => goToSuite("League Standings"),
        severity: "low",
      });
    }

    return list;
  }, [
    draftTurnInfo,
    activeProposals,
    team,
    goToSuite,
    state.currentDay,
    state.currentWeek,
    state.fixtures,
    state.playoffs,
    state.currentDayTrainingOverride,
    userTeam,
  ]);

  if (!team) {
    return (
      <div className="py-20 text-center text-muted-foreground">Loading team dashboard state...</div>
    );
  }

  const { primary } = getTeamColors(userTeam);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div
        className="relative overflow-hidden rounded-2xl border bg-card p-6 md:p-8"
        style={{ borderLeft: `6px solid ${primary}` }}
      >
        <div className="relative z-10 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-3">
              <TeamBadge teamName={userTeam} className="h-12 w-12" />
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight">{userTeam}</h2>
                <p className="text-xs text-muted-foreground">
                  Manager:{" "}
                  <span className="font-semibold text-foreground">{manager?.name || "You"}</span>
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="rounded-lg bg-secondary/50 px-3 py-1.5 text-center">
              <span className="block text-[10px] uppercase font-bold text-muted-foreground">
                Standings
              </span>
              <span className="text-base font-extrabold text-highlight-blue">
                {rank ? `#${rank} in League` : "Unranked"}
              </span>
            </div>
            <div className="rounded-lg bg-secondary/50 px-3 py-1.5 text-center">
              <span className="block text-[10px] uppercase font-bold text-muted-foreground">
                Record
              </span>
              <span className="text-base font-extrabold">
                {standingRow
                  ? `${standingRow.w}W - ${standingRow.d}D - ${standingRow.l}L`
                  : "0-0-0"}
              </span>
            </div>
            <div className="rounded-lg bg-secondary/50 px-3 py-1.5 text-center">
              <span className="block text-[10px] uppercase font-bold text-muted-foreground">
                Reputation
              </span>
              <span className="text-base font-extrabold text-highlight-red">
                {manager?.respect ? `${manager.respect}/100` : "50/100"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column: Tasks and notifications */}
        <div className="space-y-6 md:col-span-2">
          <div className="rounded-xl border bg-card">
            <header className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-highlight-blue" />
                <h3 className="text-sm font-bold uppercase tracking-wider">
                  Dashboard &amp; Tasks
                </h3>
              </div>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                {tasks.length} active
              </span>
            </header>
            <div className="divide-y">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex gap-3">
                    <div className="mt-0.5">
                      {task.severity === "critical" && (
                        <AlertCircle className="h-5 w-5 text-destructive animate-pulse" />
                      )}
                      {task.severity === "high" && (
                        <AlertCircle className="h-5 w-5 text-highlight-red" />
                      )}
                      {task.severity === "medium" && (
                        <AlertCircle className="h-5 w-5 text-highlight-blue" />
                      )}
                      {task.severity === "low" && <CheckCircle className="h-5 w-5 text-primary" />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold">{task.title}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={
                      task.severity === "critical" || task.severity === "high"
                        ? "default"
                        : "outline"
                    }
                    onClick={task.action}
                    className="self-start sm:self-center font-bold text-xs"
                  >
                    {task.actionLabel}
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Team Insights */}
          <div className="rounded-xl border bg-card p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold uppercase tracking-wider">
                Quick Team Roster Insights
              </h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-panel p-3 border">
                <span className="text-xs font-semibold text-muted-foreground">
                  Top Rated Players
                </span>
                <div className="mt-2 space-y-1">
                  {[...team.players]
                    .sort((a, b) => b.rating - a.rating)
                    .slice(0, 3)
                    .map((p) => (
                      <div key={p.name} className="flex items-center justify-between text-xs">
                        <span className="font-medium">
                          {p.name} ({p.position})
                        </span>
                        <span className="font-extrabold text-highlight-blue">{p.rating}</span>
                      </div>
                    ))}
                </div>
              </div>
              <div className="rounded-lg bg-panel p-3 border">
                <span className="text-xs font-semibold text-muted-foreground">
                  Goalscorers in League
                </span>
                <div className="mt-2 space-y-1">
                  {leaderboards.scorers
                    .filter((s) => s.team === userTeam)
                    .slice(0, 3)
                    .map((s) => (
                      <div key={s.name} className="flex items-center justify-between text-xs">
                        <span className="font-medium">{s.name}</span>
                        <span className="font-extrabold text-primary">{s.goals} goals</span>
                      </div>
                    ))}
                  {leaderboards.scorers.filter((s) => s.team === userTeam).length === 0 && (
                    <div className="text-xs text-muted-foreground italic py-1">
                      No goals scored yet
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Upcoming match and Quick navigation shortcuts */}
        <div className="space-y-6">
          {/* Upcoming Match Card */}
          <div className="rounded-xl border bg-card">
            <header className="flex items-center gap-2 border-b px-4 py-3">
              <Calendar className="h-4 w-4 text-highlight-red" />
              <h3 className="text-sm font-bold uppercase tracking-wider">Upcoming Match</h3>
            </header>
            <div className="p-5 text-center">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
                {state.currentDay === "OFFSEASON"
                  ? "OFFSEASON"
                  : state.currentWeek < 0
                    ? `Pre-Season · Week ${Math.abs(state.currentWeek)} · ${state.currentDay}`
                    : `Week ${state.currentWeek} · ${state.currentDay}`}
              </p>

              {upcomingMatch ? (
                <div className="my-4 flex items-center justify-center gap-3">
                  <div className="flex flex-col items-center gap-1 w-24">
                    <TeamBadge teamName={upcomingMatch.home} className="h-10 w-10" />
                    <span className="text-xs font-bold truncate max-w-full text-center">
                      {upcomingMatch.home === userTeam ? "YOU (Home)" : upcomingMatch.home}
                    </span>
                  </div>
                  <span className="text-lg font-black text-muted-foreground px-2">VS</span>
                  <div className="flex flex-col items-center gap-1 w-24">
                    <TeamBadge teamName={upcomingMatch.away} className="h-10 w-10" />
                    <span className="text-xs font-bold truncate max-w-full text-center">
                      {upcomingMatch.away === userTeam ? "YOU (Away)" : upcomingMatch.away}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="my-4 text-xs text-muted-foreground italic">
                  No fixture found for this day
                </div>
              )}

              <p className="text-[11px] text-muted-foreground leading-relaxed mt-2">
                Day advancement and sim controls are located in the League Commissioner page. Notify
                your commissioner when you are ready to play!
              </p>

              <Button
                size="sm"
                variant="outline"
                onClick={() => goToSuite("League Standings")}
                className="mt-4 w-full font-bold text-xs"
              >
                Inspect Schedule &amp; Standings
              </Button>
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Office Shortcuts
            </h3>
            <div className="grid gap-2">
              <button
                onClick={() => goToSuite("Messages")}
                className="flex items-center gap-3 w-full p-2.5 rounded-lg bg-secondary/30 hover:bg-secondary/70 transition-colors border text-left"
              >
                <MessageSquare className="h-4 w-4 text-highlight-blue" />
                <div className="text-xs font-bold">Chat Room / Inbox</div>
              </button>
              <button
                onClick={() => goToSuite("Negotiation")}
                className="flex items-center gap-3 w-full p-2.5 rounded-lg bg-secondary/30 hover:bg-secondary/70 transition-colors border text-left"
              >
                <Handshake className="h-4 w-4 text-highlight-red" />
                <div className="text-xs font-bold">Active Negotiations</div>
              </button>
              <button
                onClick={() => goToSuite("Contracts")}
                className="flex items-center gap-3 w-full p-2.5 rounded-lg bg-secondary/30 hover:bg-secondary/70 transition-colors border text-left"
              >
                <FileText className="h-4 w-4 text-primary" />
                <div className="text-xs font-bold">Manage Squad Contracts</div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SQUAD TRAINING & CAREER DEVELOPMENT CENTER */}
      <div className="rounded-xl border bg-card p-6 space-y-6">
        <div className="flex flex-col gap-2 border-b pb-4 md:flex-row md:items-center md:justify-between md:gap-4">
          <div className="flex items-center gap-3">
            <Dumbbell className="h-6 w-6 text-highlight-blue" />
            <div>
              <h3 className="text-lg font-bold tracking-tight uppercase">
                Squad Training & Career Development
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Set team-wide daily drills, assign personalized player attribute focuses, and track
                development progression across age phases.
              </p>
            </div>
          </div>
        </div>

        {/* Part A: Team-Wide Daily Training Regimen */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-highlight-red animate-pulse" />
              <h4 className="text-sm font-bold uppercase tracking-wider">
                Default Weekly Training Template
              </h4>
            </div>
            <p className="text-xs text-muted-foreground">
              These defaults run automatically for each day, unless overridden temporarily.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
            {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(
              (day, idx) => {
                const currentDrillKey =
                  (team.trainingRegimen ?? DEFAULT_TRAINING_REGIMEN)[idx] || "rest";
                const currentDrill = TRAINING_DRILLS[currentDrillKey] || TRAINING_DRILLS.rest;

                return (
                  <div
                    key={day}
                    className="rounded-lg border bg-panel p-3 flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <span className="text-xs font-extrabold uppercase text-muted-foreground">
                        {day}
                      </span>
                      <div className="mt-2">
                        <Select
                          value={currentDrillKey}
                          onValueChange={(val) => {
                            const newRegimen = [
                              ...(team.trainingRegimen ?? DEFAULT_TRAINING_REGIMEN),
                            ];
                            newRegimen[idx] = val;
                            setTrainingRegimen(userTeam, newRegimen);
                          }}
                        >
                          <SelectTrigger className="w-full text-xs h-9 font-semibold">
                            <SelectValue placeholder="Select drill..." />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(TRAINING_DRILLS).map(([key, d]) => (
                              <SelectItem key={key} value={key} className="text-xs">
                                {d.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="text-[10px] space-y-1.5 border-t pt-2 mt-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Type:</span>
                        <span className="font-semibold text-foreground text-right">
                          {currentDrill.onField ? "On-Field" : "Off-Field"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sharpness:</span>
                        <span
                          className={`font-semibold text-right ${currentDrill.sharpnessChange >= 0 ? "text-primary" : "text-destructive"}`}
                        >
                          {currentDrill.sharpnessChange >= 0 ? "+" : ""}
                          {currentDrill.sharpnessChange}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fatigue:</span>
                        <span
                          className={`font-semibold text-right ${currentDrill.fatigueChange <= 0 ? "text-primary" : "text-highlight-red"}`}
                        >
                          {currentDrill.fatigueChange >= 0 ? "+" : ""}
                          {currentDrill.fatigueChange}
                        </span>
                      </div>
                      <div className="border-t pt-1 mt-1 text-center font-bold text-muted-foreground uppercase text-[8px] tracking-wider">
                        Expected DP Gains
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-center text-[9px] font-bold">
                        <div className="rounded bg-secondary/30 p-1">
                          <div className="text-muted-foreground text-[8px]">PHY</div>
                          <div className="text-highlight-blue">+{currentDrill.dpPhysical}</div>
                        </div>
                        <div className="rounded bg-secondary/30 p-1">
                          <div className="text-muted-foreground text-[8px]">TEC</div>
                          <div className="text-primary">+{currentDrill.dpTechnical}</div>
                        </div>
                        <div className="rounded bg-secondary/30 p-1">
                          <div className="text-muted-foreground text-[8px]">MEN</div>
                          <div className="text-highlight-red">+{currentDrill.dpMental}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              },
            )}
          </div>
        </div>

        {/* Part B: Player Training Focus & Career Phases */}
        <div className="space-y-4 border-t pt-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-bold uppercase tracking-wider">
              Roster Player Focus & Development
            </h4>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-secondary/40 border-b text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                  <th className="p-3">Player / Age</th>
                  <th className="p-3">Career Phase</th>
                  <th className="p-3 text-center">Fatigue / Sharp</th>
                  <th className="p-3 text-center">Physical DP & Focus</th>
                  <th className="p-3 text-center">Technical DP & Focus</th>
                  <th className="p-3 text-center">Mental DP & Focus</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {team.players.map((p) => {
                  const age = p.age ?? 25;
                  let phaseLabel = "Prime";
                  let phaseColor =
                    "bg-highlight-blue/10 text-highlight-blue border-highlight-blue/20";
                  let phaseDesc =
                    "Prime Phase (Ages 23-29): At absolute performance stability. No physical regression; 1.1x multiplier to targeted attribute training DP.";

                  if (age <= 22) {
                    phaseLabel = "Prospect";
                    phaseColor = "bg-primary/10 text-primary border-primary/20";
                    phaseDesc =
                      "Prospect Phase (Ages 17-22): Extreme physical (1.5x DP) and technical (1.25x DP) growth. Offseason decay protected, benched weeks penalize morale.";
                  } else if (age >= 30) {
                    phaseLabel = "Veteran";
                    phaseColor = "bg-amber-500/10 text-amber-600 border-amber-500/20";
                    phaseDesc =
                      "Veteran Phase (Ages 30+): Wisdom allows 1.5x Mental DP gains. On-field drills cost 1.2x fatigue. Offseason triggers physical PAC/STA declines.";
                  }

                  const physicalFocus = p.trainingFocus?.physical || "PAC";
                  const technicalFocus = p.trainingFocus?.technical || "DRI";
                  const mentalFocus = p.trainingFocus?.mental || "VIS";

                  const fatigue = p.fatigue ?? 0;
                  const sharpness = p.sharpness ?? 50;

                  return (
                    <tr key={p.name} className="hover:bg-secondary/20 transition-colors">
                      {/* Name & Position */}
                      <td className="p-3 font-semibold">
                        <div className="font-bold text-foreground">{p.name}</div>
                        <div className="text-[10px] text-muted-foreground font-medium uppercase mt-0.5">
                          {p.position} · OVR {p.rating}
                        </div>
                      </td>

                      {/* Career Phase */}
                      <td className="p-3 max-w-xs">
                        <span
                          className={`inline-block px-2 py-0.5 rounded border text-[9px] font-bold uppercase ${phaseColor}`}
                        >
                          {phaseLabel}
                        </span>
                        <p className="text-[9px] text-muted-foreground mt-1 leading-normal">
                          {phaseDesc}
                        </p>
                      </td>

                      {/* Fatigue / Sharpness Bars */}
                      <td className="p-3 w-40">
                        <div className="space-y-2">
                          <div>
                            <div className="flex justify-between text-[9px] font-medium mb-1">
                              <span className="text-muted-foreground">Fatigue:</span>
                              <span
                                className={
                                  fatigue > 50
                                    ? "text-highlight-red font-bold"
                                    : "text-muted-foreground"
                                }
                              >
                                {fatigue}%
                              </span>
                            </div>
                            <div className="w-full bg-secondary/40 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-1.5 rounded-full ${
                                  fatigue > 60
                                    ? "bg-highlight-red"
                                    : fatigue > 30
                                      ? "bg-amber-500"
                                      : "bg-primary"
                                }`}
                                style={{ width: `${fatigue}%` }}
                              />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-[9px] font-medium mb-1">
                              <span className="text-muted-foreground">Sharpness:</span>
                              <span
                                className={
                                  sharpness >= 75
                                    ? "text-primary font-bold"
                                    : sharpness <= 35
                                      ? "text-highlight-red font-bold"
                                      : "text-muted-foreground"
                                }
                              >
                                {sharpness}%
                              </span>
                            </div>
                            <div className="w-full bg-secondary/40 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-1.5 rounded-full ${
                                  sharpness >= 75
                                    ? "bg-primary"
                                    : sharpness <= 35
                                      ? "bg-highlight-red"
                                      : "bg-highlight-blue"
                                }`}
                                style={{ width: `${sharpness}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Physical DP & Focus Select */}
                      <td className="p-3 text-center min-w-[120px]">
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[9px] font-bold px-1 text-highlight-blue">
                            <span>DP Pool:</span>
                            <span>{Math.round(p.physicalDP ?? 0)}/100</span>
                          </div>
                          <div className="w-full bg-secondary/40 rounded-full h-1 overflow-hidden">
                            <div
                              className="h-1 bg-highlight-blue"
                              style={{ width: `${Math.min(100, p.physicalDP ?? 0)}%` }}
                            />
                          </div>
                          <Select
                            value={physicalFocus}
                            onValueChange={(val) => {
                              setTrainingFocus(userTeam, p.name, "physical", val);
                            }}
                          >
                            <SelectTrigger className="w-full text-[10px] h-7 font-semibold">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {["PAC", "STA", "STR", "AER", "WR"].map((attr) => (
                                <SelectItem key={attr} value={attr} className="text-[10px]">
                                  Target: {attr} ({(p as unknown as Record<string, number>)[attr]})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </td>

                      {/* Technical DP & Focus Select */}
                      <td className="p-3 text-center min-w-[120px]">
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[9px] font-bold px-1 text-primary">
                            <span>DP Pool:</span>
                            <span>{Math.round(p.technicalDP ?? 0)}/100</span>
                          </div>
                          <div className="w-full bg-secondary/40 rounded-full h-1 overflow-hidden">
                            <div
                              className="h-1 bg-primary"
                              style={{ width: `${Math.min(100, p.technicalDP ?? 0)}%` }}
                            />
                          </div>
                          <Select
                            value={technicalFocus}
                            onValueChange={(val) => {
                              setTrainingFocus(userTeam, p.name, "technical", val);
                            }}
                          >
                            <SelectTrigger className="w-full text-[10px] h-7 font-semibold">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {["FIN", "SHO", "PAS", "DRI", "BCO"].map((attr) => (
                                <SelectItem key={attr} value={attr} className="text-[10px]">
                                  Target: {attr} ({(p as unknown as Record<string, number>)[attr]})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </td>

                      {/* Mental DP & Focus Select */}
                      <td className="p-3 text-center min-w-[120px]">
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[9px] font-bold px-1 text-highlight-red">
                            <span>DP Pool:</span>
                            <span>{Math.round(p.mentalDP ?? 0)}/100</span>
                          </div>
                          <div className="w-full bg-secondary/40 rounded-full h-1 overflow-hidden">
                            <div
                              className="h-1 bg-highlight-red"
                              style={{ width: `${Math.min(100, p.mentalDP ?? 0)}%` }}
                            />
                          </div>
                          <Select
                            value={mentalFocus}
                            onValueChange={(val) => {
                              setTrainingFocus(userTeam, p.name, "mental", val);
                            }}
                          >
                            <SelectTrigger className="w-full text-[10px] h-7 font-semibold">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {["DEF", "TAC", "POS_attr", "VIS", "COM"].map((attr) => (
                                <SelectItem key={attr} value={attr} className="text-[10px]">
                                  Target: {attr} ({(p as unknown as Record<string, number>)[attr]})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Daily Training Customization Dialog */}
      <Dialog open={customizeTrainingOpen} onOpenChange={setCustomizeTrainingOpen}>
        <DialogContent className="max-w-md bg-card border text-card-foreground">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold uppercase tracking-tight">
              Customize Today's Training Session
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Select a temporary training drill for <strong>{state.currentDay}</strong>. This
              override is a temporary, one-day thing and will not change your default weekly
              template.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-muted-foreground">
                Select Drill
              </label>
              <Select
                value={state.currentDayTrainingOverride?.[userTeam] || "template"}
                onValueChange={(val) => {
                  if (val === "template") {
                    setTrainingOverride(userTeam, null);
                  } else {
                    setTrainingOverride(userTeam, val);
                  }
                }}
              >
                <SelectTrigger className="w-full text-xs h-10 font-semibold bg-panel border">
                  <SelectValue placeholder="Select drill..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="template" className="text-xs font-semibold text-primary">
                    Use Default Template Drill (
                    {(() => {
                      const dayIndexMap: Record<string, number> = {
                        Monday: 0,
                        Tuesday: 1,
                        Wednesday: 2,
                        Thursday: 3,
                        Friday: 4,
                        Saturday: 5,
                        Sunday: 6,
                      };
                      const dayIdx = dayIndexMap[state.currentDay] ?? 0;
                      const defaultDrillKey =
                        team.trainingRegimen?.[dayIdx] ||
                        DEFAULT_TRAINING_REGIMEN[dayIdx] ||
                        "rest";
                      return TRAINING_DRILLS[defaultDrillKey]?.name || "Rest Day";
                    })()}
                    )
                  </SelectItem>
                  {Object.entries(TRAINING_DRILLS).map(([key, d]) => (
                    <SelectItem key={key} value={key} className="text-xs">
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Display Drill Details */}
            {(() => {
              const currentOverrideKey = state.currentDayTrainingOverride?.[userTeam];
              const dayIndexMap: Record<string, number> = {
                Monday: 0,
                Tuesday: 1,
                Wednesday: 2,
                Thursday: 3,
                Friday: 4,
                Saturday: 5,
                Sunday: 6,
              };
              const dayIdx = dayIndexMap[state.currentDay] ?? 0;
              const defaultDrillKey =
                team.trainingRegimen?.[dayIdx] || DEFAULT_TRAINING_REGIMEN[dayIdx] || "rest";
              const activeDrillKey = currentOverrideKey || defaultDrillKey;
              const drill = TRAINING_DRILLS[activeDrillKey] || TRAINING_DRILLS.rest;

              return (
                <div className="rounded-lg border bg-panel p-3.5 space-y-3.5 text-xs">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground">
                      Active Drill Info
                    </span>
                    <span className="font-bold text-highlight-blue bg-highlight-blue/10 px-2 py-0.5 rounded text-[10px]">
                      {drill.onField ? "On-Field" : "Off-Field"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <span className="text-muted-foreground">Sharpness Impact</span>
                      <div
                        className={`font-bold ${drill.sharpnessChange >= 0 ? "text-primary" : "text-destructive"}`}
                      >
                        {drill.sharpnessChange >= 0 ? "+" : ""}
                        {drill.sharpnessChange}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground">Fatigue Impact</span>
                      <div
                        className={`font-bold ${drill.fatigueChange <= 0 ? "text-primary" : "text-highlight-red"}`}
                      >
                        {drill.fatigueChange >= 0 ? "+" : ""}
                        {drill.fatigueChange}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 border-t pt-2">
                    <span className="font-bold text-[9px] uppercase tracking-wider text-muted-foreground block text-center">
                      Development DP Multipliers
                    </span>
                    <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
                      <div className="rounded bg-secondary/40 p-1.5">
                        <div className="text-muted-foreground text-[8px] uppercase">Physical</div>
                        <div className="text-highlight-blue">+{drill.dpPhysical} DP</div>
                      </div>
                      <div className="rounded bg-secondary/40 p-1.5">
                        <div className="text-muted-foreground text-[8px] uppercase">Technical</div>
                        <div className="text-primary">+{drill.dpTechnical} DP</div>
                      </div>
                      <div className="rounded bg-secondary/40 p-1.5">
                        <div className="text-muted-foreground text-[8px] uppercase">Mental</div>
                        <div className="text-highlight-red">+{drill.dpMental} DP</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          <DialogFooter>
            <Button
              className="w-full font-bold uppercase text-xs tracking-wider"
              onClick={() => setCustomizeTrainingOpen(false)}
            >
              Done / Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
