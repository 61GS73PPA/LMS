export const FPL_BOOTSTRAP_URL = "https://fantasy.premierleague.com/api/bootstrap-static/";
export const FPL_FIXTURES_URL = "https://fantasy.premierleague.com/api/fixtures/";

export function findActiveEvent(events, now = new Date()) {
  const flagged = events.find((event) => event.is_current || event.is_next);
  if (flagged) return flagged;

  const upcoming = events.find((event) => new Date(event.deadline_time) > now);
  return upcoming ?? events.at(-1) ?? null;
}

export function groupFixturesByEvent(fixtures) {
  return fixtures.reduce((groups, fixture) => {
    if (fixture.event == null) return groups;
    (groups[fixture.event] ??= []).push(fixture);
    return groups;
  }, {});
}

export function getTeamMap(teams) {
  return new Map(teams.map((team) => [team.id, team]));
}

export function getNextFiveDifficulty(teams, fixtures, startingEvent) {
  const upcoming = fixtures.filter(
    (fixture) => fixture.event != null && fixture.event >= startingEvent && !fixture.finished,
  );

  return teams.map((team) => {
    const teamFixtures = upcoming
      .filter((fixture) => fixture.team_h === team.id || fixture.team_a === team.id)
      .sort((a, b) => a.event - b.event || new Date(a.kickoff_time) - new Date(b.kickoff_time))
      .slice(0, 5)
      .map((fixture) => {
        const isHome = fixture.team_h === team.id;
        return {
          event: fixture.event,
          opponentId: isHome ? fixture.team_a : fixture.team_h,
          venue: isHome ? "H" : "A",
          difficulty: isHome ? fixture.team_h_difficulty : fixture.team_a_difficulty,
        };
      });

    const average = teamFixtures.length
      ? teamFixtures.reduce((total, fixture) => total + fixture.difficulty, 0) / teamFixtures.length
      : Number.POSITIVE_INFINITY;

    return { team, fixtures: teamFixtures, average };
  });
}

export function formatDeadline(deadline, locale = "en-GB") {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
    timeZoneName: "short",
  }).format(new Date(deadline));
}

export function getCountdownParts(deadline, now = new Date()) {
  const difference = Math.max(0, new Date(deadline).getTime() - now.getTime());
  return {
    days: Math.floor(difference / 86_400_000),
    hours: Math.floor((difference / 3_600_000) % 24),
    minutes: Math.floor((difference / 60_000) % 60),
    seconds: Math.floor((difference / 1_000) % 60),
    expired: difference === 0,
  };
}

export function getPickForEvent(player, eventId) {
  return player.picks.find((pick) => pick.gameweek === eventId) ?? null;
}

export function getPickResult(pick, fixtures = []) {
  if (pick.result !== "pending") return pick.result;
  const fixture = fixtures.find((item) =>
    item.event === pick.gameweek && (item.team_h === pick.teamId || item.team_a === pick.teamId),
  );
  if (!fixture?.finished || fixture.team_h_score == null || fixture.team_a_score == null) return "pending";

  const pickedHomeTeam = fixture.team_h === pick.teamId;
  const pickedScore = pickedHomeTeam ? fixture.team_h_score : fixture.team_a_score;
  const opponentScore = pickedHomeTeam ? fixture.team_a_score : fixture.team_h_score;
  return pickedScore > opponentScore ? "win" : "loss";
}

export function calculatePlayerStatus(player, fixtures = []) {
  if (player.status === "out") return "out";
  return player.picks.some((pick) => ["loss", "no-pick"].includes(getPickResult(pick, fixtures)))
    ? "out"
    : "alive";
}

export function getPlayerStatusLabel(player, currentPick, fixtures = []) {
  if (calculatePlayerStatus(player, fixtures) === "out") return "6ft deep";
  return currentPick ? "Standing" : "Queuing for the wheel";
}

export function getCharityRepresentation(players, entryFee = 20) {
  const charities = new Map();
  for (const player of players) {
    const key = player.charity?.url ?? "pocketing";
    const current = charities.get(key) ?? {
      name: player.charity?.name ?? "Pocketing the money",
      url: player.charity?.url ?? null,
      players: [],
      amount: 0,
    };
    current.players.push(player.name);
    current.amount += entryFee;
    charities.set(key, current);
  }
  return [...charities.values()].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
}

export function getUnavailablePlayers(elements = []) {
  return elements
    .filter((player) => player.status !== "a" || (player.chance_of_playing_next_round ?? 100) < 100)
    .sort((a, b) => a.team - b.team || a.web_name.localeCompare(b.web_name));
}

export function getWheelTargetRotation(teams, targetName, rotations = 6) {
  const targetIndex = teams.findIndex((team) => team.name === targetName);
  if (targetIndex === -1) return 0;
  const segmentAngle = 360 / teams.length;
  const targetCentre = targetIndex * segmentAngle + segmentAngle / 2;
  return rotations * 360 + (360 - targetCentre) % 360;
}
