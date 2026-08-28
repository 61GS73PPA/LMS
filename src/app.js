import {
  FPL_BOOTSTRAP_URL,
  FPL_FIXTURES_URL,
  calculatePlayerStatus,
  findCompetitionEvent,
  formatDeadline,
  getCharityRepresentation,
  getCountdownParts,
  getNextFiveDifficulty,
  getPickForEvent,
  getPickResult,
  getPlayerGoalDifference,
  getRoundSummary,
  getStandingMovements,
  getPlayerStatusLabel,
  getTeamMap,
  getUnavailablePlayers,
  getWheelTargetRotation,
  groupFixturesByEvent,
  isFixtureComplete,
  sortPlayersByStanding,
} from "./domain.js";

const LOCAL_FPL_DATA = "./data/fpl.json";
const DEFAULT_ROUTE = "overview";
const COVENTRY_NAME = "Coventry City";
const WHEEL_COLORS = ["#00533f", "#087b5d", "#f4dc00", "#1f1f1f", "#d9c600"];

const state = {
  competition: null,
  bootstrap: null,
  fixtures: [],
  activeEvent: null,
  selectedEvent: null,
  source: "local",
  lastUpdated: null,
  newsFilter: "all",
  deadline: null,
  wheelRotation: 0,
};

const elements = {
  aliveCount: document.querySelector("#alive-count"),
  charityRepresentationList: document.querySelector("#charity-representation-list"),
  countdown: document.querySelector("#countdown"),
  dataNote: document.querySelector("#data-note"),
  dataSourceIndicator: document.querySelector("#data-source-indicator"),
  dataSourceLabel: document.querySelector("#data-source-label"),
  deadlineDate: document.querySelector("#deadline-title"),
  deadlineGameweek: document.querySelector("#deadline-gameweek"),
  easiestList: document.querySelector("#easiest-list"),
  fixturesGrid: document.querySelector("#fixtures-grid"),
  fixturesTitle: document.querySelector("#fixtures-title"),
  gameweekNumber: document.querySelector("#gameweek-number"),
  gameweekSelect: document.querySelector("#gameweek-select"),
  hardestList: document.querySelector("#hardest-list"),
  outCount: document.querySelector("#out-count"),
  nextFixtures: document.querySelector("#next-fixtures"),
  pickMatrixWrap: document.querySelector("#pick-matrix-wrap"),
  playerDialog: document.querySelector("#player-dialog"),
  playerDialogCharity: document.querySelector("#player-dialog-charity"),
  playerDialogHistory: document.querySelector("#player-dialog-history"),
  playerDialogIndex: document.querySelector("#player-dialog-index"),
  playerDialogGoalDifference: document.querySelector("#player-dialog-gd"),
  playerDialogName: document.querySelector("#player-dialog-name"),
  playerDialogPick: document.querySelector("#player-dialog-pick"),
  playerDialogStatus: document.querySelector("#player-dialog-status"),
  playersBody: document.querySelector("#players-body"),
  refreshTeamNews: document.querySelector("#refresh-team-news"),
  roundLabel: document.querySelector("#round-label"),
  roundSummary: document.querySelector("#round-summary"),
  seasonLabel: document.querySelector("#season-label"),
  shareStandings: document.querySelector("#share-standings"),
  spinWheel: document.querySelector("#spin-wheel"),
  teamNewsGrid: document.querySelector("#team-news-grid"),
  teamNewsUpdated: document.querySelector("#team-news-updated"),
  pickReminderCopy: document.querySelector("#pick-reminder-copy"),
  pickReminderList: document.querySelector("#pick-reminder-list"),
  teamWheel: document.querySelector("#team-wheel"),
  wheelResult: document.querySelector("#wheel-result"),
};

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Request failed with ${response.status}`);
  return response.json();
}

async function loadFplData() {
  try {
    const [bootstrap, fixtures] = await Promise.all([
      fetchJson(FPL_BOOTSTRAP_URL),
      fetchJson(FPL_FIXTURES_URL),
    ]);
    state.source = "live";
    state.lastUpdated = new Date();
    return { bootstrap, fixtures };
  } catch (error) {
    console.info("Live FPL data unavailable; using the repository snapshot.", error);
    state.source = "snapshot";
    const snapshot = await fetchJson(LOCAL_FPL_DATA);
    state.lastUpdated = snapshot.bootstrap.updatedAt ? new Date(snapshot.bootstrap.updatedAt) : null;
    return snapshot;
  }
}

async function initialise() {
  bindRouting();

  try {
    const [competition, fpl] = await Promise.all([
      fetchJson("./data/competition.json"),
      loadFplData(),
    ]);
    state.competition = competition;
    state.bootstrap = fpl.bootstrap;
    state.fixtures = fpl.fixtures;
    state.activeEvent = findCompetitionEvent(state.bootstrap.events, state.competition.round);
    state.selectedEvent = state.activeEvent?.id ?? 1;
    state.deadline = state.competition.deadlines?.[state.activeEvent?.id] ?? state.activeEvent?.deadline_time ?? null;

    renderPage();
    bindInteractions();
    updateCountdown();
    window.setInterval(updateCountdown, 1000);
    window.setInterval(refreshLiveData, 60_000);
  } catch (error) {
    console.error(error);
    elements.fixturesGrid.innerHTML = '<p class="empty-state">The competition data could not be loaded. Please try again shortly.</p>';
    elements.dataNote.textContent = "Data is temporarily unavailable.";
  }
}

function renderPage() {
  const alive = state.competition.players.filter((player) => calculatePlayerStatus(player, state.fixtures) === "alive");
  const out = state.competition.players.length - alive.length;
  const seasonStart = new Date(state.bootstrap.events[0].deadline_time).getUTCFullYear();

  elements.aliveCount.textContent = alive.length;
  elements.outCount.textContent = out;
  elements.gameweekNumber.textContent = state.activeEvent?.id ?? "—";
  elements.roundLabel.textContent = `${state.competition.competitionName} · Round ${state.competition.round}`;
  elements.seasonLabel.textContent = `${seasonStart}/${String(seasonStart + 1).slice(-2)} season`;

  if (state.activeEvent && state.deadline) {
    elements.deadlineGameweek.textContent = state.activeEvent.name;
    elements.deadlineDate.textContent = formatDeadline(state.deadline);
  }
  renderDataFreshness();
  renderRoundSummary();
  renderPickReminder();

  renderPlayers("all");
  renderGameweekSelect();
  renderFixtures();
  renderDifficulty();
  renderTeamNews(state.newsFilter);
  renderPickMatrix();
  renderCharityRepresentation();
  renderWheel();
  showRoute(getRequestedRoute());
}

function renderDataFreshness(message = "") {
  const isLive = state.source === "live";
  elements.dataSourceIndicator.classList.toggle("snapshot", !isLive);
  elements.dataSourceLabel.textContent = isLive ? "Live FPL data" : "Fallback data";
  const updated = state.lastUpdated ? formatRelativeTime(state.lastUpdated) : "unknown";
  elements.teamNewsUpdated.textContent = message || `${isLive ? "Live FPL data" : "Fallback snapshot"} · updated ${updated}`;
  elements.dataNote.textContent = `${isLive ? "Live scores and team news are connected" : "Using the saved FPL snapshot"} · updated ${updated}.`;
}

function renderRoundSummary() {
  const teamById = getTeamMap(state.bootstrap.teams);
  const summary = getRoundSummary(state.competition.players, state.fixtures, state.activeEvent?.id);
  const popularTeam = summary.mostPopular ? teamById.get(summary.mostPopular.teamId)?.name ?? "Unknown" : "No picks yet";
  const bestTeam = summary.bestPick ? teamById.get(summary.bestPick.teamId)?.name ?? "Unknown" : null;
  elements.roundSummary.innerHTML = `
    <div><strong>${summary.entrants - summary.eliminated}</strong><span>Still standing</span></div>
    <div><strong>${summary.eliminated}</strong><span>Out this week</span></div>
    <div><strong>${summary.entered}/${summary.entrants}</strong><span>Picks entered</span></div>
    <div><strong>${escapeHtml(bestTeam ?? popularTeam)}</strong><span>${bestTeam ? `Best pick · ${summary.bestPick.goalDifference > 0 ? "+" : ""}${summary.bestPick.goalDifference} GD` : `Most popular${summary.mostPopular ? ` · ${summary.mostPopular.count}` : ""}`}</span></div>`;
}

function renderPickReminder() {
  const summary = getRoundSummary(state.competition.players, state.fixtures, state.activeEvent?.id);
  if (!summary.missing.length) {
    elements.pickReminderCopy.textContent = "Every standing player has a pick recorded for this gameweek.";
    elements.pickReminderList.innerHTML = '<span class="all-entered">✓ Everyone is in</span>';
  } else {
    elements.pickReminderCopy.textContent = `${summary.missing.length} standing player${summary.missing.length === 1 ? " still needs" : "s still need"} a Gameweek ${state.activeEvent?.id} pick.`;
    elements.pickReminderList.innerHTML = summary.missing.map((player) => `<button type="button" data-reminder-player="${state.competition.players.indexOf(player)}">${escapeHtml(player.icon)} ${escapeHtml(player.name)}</button>`).join("");
    elements.pickReminderList.querySelectorAll("[data-reminder-player]").forEach((button) => {
      button.addEventListener("click", () => openPlayerProfile(Number(button.dataset.reminderPlayer)));
    });
  }

  const teamById = getTeamMap(state.bootstrap.teams);
  const fixtures = state.fixtures
    .filter((fixture) => fixture.event === state.activeEvent?.id)
    .sort((a, b) => new Date(a.kickoff_time) - new Date(b.kickoff_time))
    .slice(0, 3);
  elements.nextFixtures.innerHTML = fixtures.length
    ? `<span>Next fixtures</span>${fixtures.map((fixture) => `<a href="#fixtures"><strong>${escapeHtml(teamById.get(fixture.team_h)?.short_name ?? "TBC")}</strong><i>v</i><strong>${escapeHtml(teamById.get(fixture.team_a)?.short_name ?? "TBC")}</strong></a>`).join("")}`
    : "";
}

function movementMarkup(movement) {
  if (!movement) return '<span class="movement same" aria-label="No change">—</span>';
  const direction = movement > 0 ? "up" : "down";
  const label = `${Math.abs(movement)} place${Math.abs(movement) === 1 ? "" : "s"} ${direction}`;
  return `<span class="movement ${direction}" aria-label="${label}" title="${label}">${movement > 0 ? "↑" : "↓"}${Math.abs(movement)}</span>`;
}

function formatRelativeTime(date, now = new Date()) {
  const elapsedSeconds = Math.max(0, Math.floor((now - date) / 1000));
  if (elapsedSeconds < 10) return "just now";
  if (elapsedSeconds < 60) return `${elapsedSeconds} seconds ago`;
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

async function shareStandings() {
  const leaders = sortPlayersByStanding(state.competition.players, state.fixtures)
    .filter((player) => calculatePlayerStatus(player, state.fixtures) === "alive")
    .slice(0, 5);
  const text = [`Kony365 · Gameweek ${state.activeEvent?.id}`, ...leaders.map((player, index) => {
    const gd = getPlayerGoalDifference(player, state.fixtures);
    return `${index + 1}. ${player.name} (${gd > 0 ? "+" : ""}${gd} GD)`;
  }), window.location.href].join("\n");

  try {
    if (navigator.share) await navigator.share({ title: "Kony365 standings", text });
    else {
      await navigator.clipboard.writeText(text);
      elements.shareStandings.firstChild.textContent = "Copied! ";
      window.setTimeout(() => { elements.shareStandings.firstChild.textContent = "Share standings "; }, 1800);
    }
  } catch (error) {
    if (error.name !== "AbortError") console.info("Standings could not be shared.", error);
  }
}

function renderPlayers(filter) {
  const teamById = getTeamMap(state.bootstrap.teams);
  const movements = getStandingMovements(state.competition.players, state.fixtures, state.activeEvent?.id);
  const players = sortPlayersByStanding(state.competition.players, state.fixtures)
    .map((player) => ({ player, index: state.competition.players.indexOf(player) }))
    .filter(({ player }) => {
      const status = calculatePlayerStatus(player, state.fixtures);
      return filter === "all" || filter === status;
    });

  elements.playersBody.innerHTML = players.map(({ player, index }) => {
    const status = calculatePlayerStatus(player, state.fixtures);
    const currentPick = getPickForEvent(player, state.activeEvent?.id);
    const goalDifference = getPlayerGoalDifference(player, state.fixtures);
    const movement = movements.get(player.name) ?? 0;
    return `
      <tr data-status="${status}">
        <td><button class="player-cell player-profile-button" type="button" data-player-index="${index}" aria-label="View ${escapeHtml(player.name)}'s profile"><span class="player-index player-icon" aria-hidden="true">${escapeHtml(player.icon)}</span><span>${escapeHtml(player.name)}</span><span class="profile-arrow" aria-hidden="true">↗</span></button></td>
        <td class="movement-column">${movementMarkup(movement)}</td>
        <td><span class="status ${status}${!currentPick && status === "alive" ? " queued" : ""}">${getPlayerStatusLabel(player, currentPick, state.fixtures)}</span></td>
        <td>${currentPick ? renderCurrentPick(currentPick, teamById) : `<span class="pick-pending">${status === "alive" ? "Pick required" : "Eliminated"}</span>`}</td>
        <td class="goal-difference">${goalDifference > 0 ? "+" : ""}${goalDifference}</td>
        <td><div class="pick-history">${renderPickHistory(player, teamById)}</div></td>
      </tr>`;
  }).join("");

  if (!players.length) {
    elements.playersBody.innerHTML = '<tr><td colspan="6" class="empty-state">No players match this view.</td></tr>';
  }
}

function openPlayerProfile(playerIndex) {
  const player = state.competition.players[playerIndex];
  if (!player) return;

  const teamById = getTeamMap(state.bootstrap.teams);
  const status = calculatePlayerStatus(player, state.fixtures);
  const currentPick = getPickForEvent(player, state.activeEvent?.id);
  elements.playerDialogIndex.textContent = player.icon;
  elements.playerDialogName.textContent = player.name;
  elements.playerDialogCharity.innerHTML = renderCharity(player.charity);
  elements.playerDialogStatus.textContent = getPlayerStatusLabel(player, currentPick, state.fixtures);
  elements.playerDialogPick.textContent = currentPick ? getTeamName(currentPick, teamById) : status === "alive" ? "Pick required" : "Eliminated";
  const goalDifference = getPlayerGoalDifference(player, state.fixtures);
  elements.playerDialogGoalDifference.textContent = `${goalDifference > 0 ? "+" : ""}${goalDifference}`;
  elements.playerDialogHistory.innerHTML = renderPickHistory(player, teamById);
  elements.playerDialog.showModal();
}

function renderCharity(charity) {
  if (!charity) return "Pocketing the money";
  return `<a href="${escapeHtml(charity.url)}" target="_blank" rel="noreferrer">${escapeHtml(charity.name)} <span aria-hidden="true">↗</span></a>`;
}

function wheelMarker(pick) {
  return pick.viaWheel
    ? '<span class="wheel-pick-marker" title="Picked by the wheel" aria-label="Picked by the wheel">◉</span>'
    : "";
}

function renderCurrentPick(pick, teamById) {
  return `<span class="pick-name">${escapeHtml(getTeamName(pick, teamById))}${wheelMarker(pick)}</span>`;
}

function renderPickHistory(player, teamById) {
  if (!player.picks.length) return '<span class="pick-pending">No picks recorded</span>';
  return [...player.picks]
    .sort((a, b) => a.gameweek - b.gameweek)
    .map((pick) => {
      const shortName = teamById.get(pick.teamId)?.short_name ?? pick.team ?? "—";
      const result = getPickResult(pick, state.fixtures);
      const resultClass = result === "win" ? "win" : result === "loss" || result === "no-pick" ? "loss" : "";
      return `<span class="pick-badge ${resultClass}" title="Gameweek ${pick.gameweek}: ${escapeHtml(getTeamName(pick, teamById))}${pick.viaWheel ? " (wheel pick)" : ""}"><small>GW${pick.gameweek}</small><span>${escapeHtml(shortName)}${wheelMarker(pick)}</span></span>`;
    }).join("");
}

function renderGameweekSelect() {
  elements.gameweekSelect.innerHTML = state.bootstrap.events.map((event) =>
    `<option value="${event.id}" ${event.id === state.selectedEvent ? "selected" : ""}>${escapeHtml(event.name)}</option>`,
  ).join("");
}

function renderFixtures() {
  const teamById = getTeamMap(state.bootstrap.teams);
  const grouped = groupFixturesByEvent(state.fixtures);
  const fixtures = grouped[state.selectedEvent] ?? [];
  const event = state.bootstrap.events.find((item) => item.id === state.selectedEvent);
  elements.fixturesTitle.textContent = `${event?.name ?? "Gameweek"} fixtures`;

  if (!fixtures.length) {
    elements.fixturesGrid.innerHTML = '<p class="empty-state">No fixtures have been announced for this gameweek.</p>';
    return;
  }

  elements.fixturesGrid.innerHTML = [...fixtures]
    .sort((a, b) => new Date(a.kickoff_time) - new Date(b.kickoff_time))
    .map((fixture) => fixtureMarkup(fixture, teamById))
    .join("");
}

function fixtureMarkup(fixture, teamById) {
  const home = teamById.get(fixture.team_h);
  const away = teamById.get(fixture.team_a);
  const kickoff = fixture.kickoff_time ? new Date(fixture.kickoff_time) : null;
  const day = kickoff ? new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(kickoff) : "TBC";
  const time = kickoff ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(kickoff) : "—";
  const complete = isFixtureComplete(fixture);
  const matchStatus = complete ? "Full time" : fixture.started ? `${fixture.minutes || 0}' · Live` : day;
  const middle = fixture.started || complete
    ? `<strong class="score">${fixture.team_h_score ?? 0}–${fixture.team_a_score ?? 0}</strong><span>${matchStatus}</span>`
    : `<strong>${time}</strong><span>${day}</span>`;
  const events = fixtureEventMarkup(fixture, home, away);

  return `<article class="fixture-card${fixture.started && !complete ? " live-fixture" : ""}">
    ${teamMarkup(home, "home")}
    <div class="fixture-time">${middle}</div>
    ${teamMarkup(away, "away")}
    ${events}
  </article>`;
}

function fixtureEventMarkup(fixture, home, away) {
  const events = (fixture.stats ?? []).flatMap((stat) => [
    ...(stat.h ?? []).map((event) => ({ ...event, side: "home", team: home, type: stat.identifier })),
    ...(stat.a ?? []).map((event) => ({ ...event, side: "away", team: away, type: stat.identifier })),
  ]).filter((event) => ["goals_scored", "red_cards"].includes(event.type));

  if (!events.length) return "";
  return `<div class="fixture-events">${events.map((event) => {
    const icon = event.type === "red_cards" ? "🟥" : "⚽";
    const player = state.bootstrap.elements?.find((item) => item.id === event.element);
    return `<span>${icon} ${escapeHtml(player?.web_name ?? event.team?.short_name ?? "Event")}${event.value > 1 ? ` ×${event.value}` : ""}</span>`;
  }).join("")}</div>`;
}

function teamMarkup(team, side) {
  return `<div class="fixture-team ${side}">${teamBadgeMarkup(team)}<span>${escapeHtml(team?.name ?? "TBC")}</span></div>`;
}

function teamBadgeMarkup(team, className = "team-token") {
  if (!team?.code) return `<span class="${className} team-badge-fallback">${escapeHtml(team?.short_name ?? "TBC")}</span>`;
  return `<span class="${className}"><img src="${teamBadgeUrl(team)}" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="team-badge-fallback-text" hidden>${escapeHtml(team.short_name)}</span></span>`;
}

function teamBadgeUrl(team, size = 100) {
  return `https://resources.premierleague.com/premierleague/badges/${size}/t${team.code}.png`;
}

function renderDifficulty() {
  const startEvent = state.activeEvent?.id ?? 1;
  const teamById = getTeamMap(state.bootstrap.teams);
  const ranked = getNextFiveDifficulty(state.bootstrap.teams, state.fixtures, startEvent)
    .filter((entry) => entry.fixtures.length);
  const easiest = [...ranked].sort((a, b) => a.average - b.average).slice(0, 5);
  const hardest = [...ranked].sort((a, b) => b.average - a.average).slice(0, 5);
  elements.easiestList.innerHTML = easiest.map((entry) => difficultyMarkup(entry, teamById)).join("");
  elements.hardestList.innerHTML = hardest.map((entry) => difficultyMarkup(entry, teamById)).join("");
}

function difficultyMarkup(entry, teamById) {
  const fixtures = entry.fixtures.map((fixture) => {
    const opponent = teamById.get(fixture.opponentId);
    return `<span class="fixture-pill difficulty-${fixture.difficulty}" title="Gameweek ${fixture.event}: ${escapeHtml(opponent?.name ?? "TBC")} (${fixture.venue})">${escapeHtml(opponent?.short_name ?? "—")}</span>`;
  }).join("");

  return `<div class="difficulty-row">
    <div class="difficulty-team">${teamBadgeMarkup(entry.team)}<span>${escapeHtml(entry.team.name)}</span></div>
    <div class="fixture-run">${fixtures}</div>
    <span class="difficulty-score">${entry.average.toFixed(1)}</span>
  </div>`;
}

function renderTeamNews(filter = "all") {
  state.newsFilter = filter;
  const teamById = getTeamMap(state.bootstrap.teams);
  const unavailable = getUnavailablePlayers(state.bootstrap.elements ?? [], filter);
  if (!unavailable.length) {
    elements.teamNewsGrid.innerHTML = '<p class="empty-state">No players match this availability filter.</p>';
    return;
  }

  const grouped = unavailable.reduce((groups, player) => {
    (groups[player.team] ??= []).push(player);
    return groups;
  }, {});
  elements.teamNewsGrid.innerHTML = Object.entries(grouped).map(([teamId, players]) => {
    const team = teamById.get(Number(teamId));
    return `<article class="team-news-card">
      <div class="team-news-heading">${teamBadgeMarkup(team)}<div><h3>${escapeHtml(team?.name ?? "Unknown team")}</h3><span>${players.length} update${players.length === 1 ? "" : "s"}</span></div></div>
      <div class="availability-list">${players.map(availabilityMarkup).join("")}</div>
    </article>`;
  }).join("");
}

function availabilityMarkup(player) {
  const chance = player.chance_of_playing_next_round;
  const chanceLabel = chance == null ? statusLabel(player.status) : `${chance}% chance`;
  const category = player.status === "s" ? "Suspended" : chance === 0 || chance == null ? "Out" : "Doubtful";
  return `<div class="availability-row">
    <div><span class="availability-category">${category}</span><strong>${escapeHtml(player.web_name)}</strong><span>${escapeHtml(player.news || statusLabel(player.status))}</span></div>
    <b class="availability-${escapeHtml(player.status)}">${escapeHtml(chanceLabel)}</b>
  </div>`;
}

function statusLabel(status) {
  return ({ a: "Available", d: "Doubtful", i: "Injured", s: "Suspended", u: "Unavailable", n: "Not in squad" })[status] ?? "Availability update";
}

function renderPickMatrix() {
  const teams = state.bootstrap.teams;
  const players = [...state.competition.players].sort((a, b) => a.name.localeCompare(b.name, "en-GB"));
  const header = teams.map((team) => `<th title="${escapeHtml(team.name)}">${escapeHtml(team.short_name)}</th>`).join("");
  const rows = players.map((player) => {
    const picksByTeam = new Map(player.picks.map((pick) => [pick.teamId, pick]));
    const cells = teams.map((team) => {
      const pick = picksByTeam.get(team.id);
      if (!pick) return '<td class="pick-available" aria-label="Available">·</td>';
      const result = getPickResult(pick, state.fixtures);
      return `<td class="pick-used ${escapeHtml(result)}" title="${escapeHtml(player.name)} picked ${escapeHtml(team.name)} in Gameweek ${pick.gameweek}${pick.viaWheel ? " via the wheel" : ""}"><span>GW${pick.gameweek}${wheelMarker(pick)}</span></td>`;
    }).join("");
    return `<tr><th scope="row"><span>${escapeHtml(player.icon)}</span>${escapeHtml(player.name)}</th>${cells}</tr>`;
  }).join("");
  elements.pickMatrixWrap.innerHTML = `<table class="pick-matrix"><thead><tr><th scope="col">Player</th>${header}</tr></thead><tbody>${rows}</tbody></table>`;
}

function renderCharityRepresentation() {
  const representation = getCharityRepresentation(state.competition.players);
  elements.charityRepresentationList.innerHTML = representation.map((charity) => {
    const name = charity.url
      ? `<a href="${escapeHtml(charity.url)}" target="_blank" rel="noreferrer">${escapeHtml(charity.name)} ↗</a>`
      : escapeHtml(charity.name);
    return `<article class="representation-row">
      <div><strong>${name}</strong><span>${escapeHtml(charity.players.join(", "))}</span></div>
      <b>£${charity.amount}</b>
    </article>`;
  }).join("");
}

async function refreshLiveData({ force = false } = {}) {
  if ((!force && state.source !== "live") || document.hidden) return;
  try {
    const [bootstrap, fixtures] = await Promise.all([
      fetchJson(FPL_BOOTSTRAP_URL),
      fetchJson(FPL_FIXTURES_URL),
    ]);
    state.bootstrap = bootstrap;
    state.fixtures = fixtures;
    state.source = "live";
    state.lastUpdated = new Date();
    renderPlayers(document.querySelector("[data-filter].active")?.dataset.filter ?? "all");
    renderFixtures();
    renderDifficulty();
    renderTeamNews(state.newsFilter);
    renderDataFreshness();
    renderRoundSummary();
    renderPickReminder();
    renderPickMatrix();
    const alive = state.competition.players.filter((player) => calculatePlayerStatus(player, state.fixtures) === "alive");
    elements.aliveCount.textContent = alive.length;
    elements.outCount.textContent = state.competition.players.length - alive.length;
  } catch (error) {
    console.info("Live data refresh failed; retaining the last known data.", error);
    renderDataFreshness("Refresh failed — showing the last successful update");
  } finally {
    elements.refreshTeamNews.disabled = false;
    elements.refreshTeamNews.classList.remove("refreshing");
  }
}

function renderWheel() {
  const teams = state.bootstrap.teams;
  const segmentAngle = 360 / teams.length;
  const gradient = teams.map((team, index) => {
    const start = index * segmentAngle;
    const end = (index + 1) * segmentAngle;
    return `${WHEEL_COLORS[index % WHEEL_COLORS.length]} ${start}deg ${end}deg`;
  }).join(", ");
  elements.teamWheel.style.background = `conic-gradient(from 0deg, ${gradient})`;
  elements.teamWheel.innerHTML = teams.map((team, index) => {
    const angle = index * segmentAngle + segmentAngle / 2 - 90;
    return `<span class="wheel-team" style="--team-angle:${angle}deg"><span>${escapeHtml(team.short_name)}</span></span>`;
  }).join("");
}

function spinWheel() {
  const teams = state.bootstrap.teams;
  const nextRotation = getWheelTargetRotation(teams, COVENTRY_NAME, 6 + Math.ceil(state.wheelRotation / 360));
  state.wheelRotation = nextRotation;
  elements.wheelResult.hidden = true;
  elements.spinWheel.disabled = true;
  elements.spinWheel.classList.add("spinning");
  elements.spinWheel.firstChild.textContent = "Spinning… ";
  elements.teamWheel.style.transform = `rotate(${nextRotation}deg)`;

  window.setTimeout(() => {
    elements.spinWheel.disabled = false;
    elements.spinWheel.classList.remove("spinning");
    elements.spinWheel.firstChild.textContent = "Spin again ";
    elements.wheelResult.hidden = false;
    elements.wheelResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, 5200);
}

function updateCountdown() {
  if (!state.deadline) return;
  const parts = getCountdownParts(state.deadline);
  const values = [parts.days, parts.hours, parts.minutes, parts.seconds];
  elements.countdown.querySelectorAll("strong").forEach((element, index) => {
    element.textContent = String(values[index]).padStart(2, "0");
  });
}

function bindInteractions() {
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-filter]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      renderPlayers(button.dataset.filter);
    });
  });

  elements.playersBody.addEventListener("click", (event) => {
    const button = event.target.closest("[data-player-index]");
    if (button) openPlayerProfile(Number(button.dataset.playerIndex));
  });

  document.querySelector("[data-close-player]").addEventListener("click", () => elements.playerDialog.close());
  elements.playerDialog.addEventListener("click", (event) => {
    if (event.target === elements.playerDialog) elements.playerDialog.close();
  });

  elements.gameweekSelect.addEventListener("change", (event) => {
    state.selectedEvent = Number(event.target.value);
    renderFixtures();
  });

  document.querySelectorAll("[data-news-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-news-filter]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      renderTeamNews(button.dataset.newsFilter);
    });
  });

  elements.refreshTeamNews.addEventListener("click", () => {
    elements.refreshTeamNews.disabled = true;
    elements.refreshTeamNews.classList.add("refreshing");
    refreshLiveData({ force: true });
  });
  elements.shareStandings.addEventListener("click", shareStandings);
  elements.spinWheel.addEventListener("click", spinWheel);
}

function bindRouting() {
  window.addEventListener("hashchange", () => showRoute(getRequestedRoute()));
  showRoute(getRequestedRoute());
}

function getRequestedRoute() {
  const route = window.location.hash.slice(1);
  return document.querySelector(`[data-page="${route}"]`) ? route : DEFAULT_ROUTE;
}

function showRoute(route) {
  document.querySelectorAll("[data-page]").forEach((page) => {
    const isActive = page.dataset.page === route;
    page.hidden = !isActive;
    page.classList.toggle("active", isActive);
  });
  document.querySelectorAll("[data-route]").forEach((link) => {
    const isActive = link.dataset.route === route;
    link.classList.toggle("active", isActive);
    if (isActive) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  document.title = `${routeTitle(route)} | Kony365`;
  window.scrollTo({ top: 0, behavior: "auto" });
}

function routeTitle(route) {
  return ({
    overview: "Last Man Standing",
    picks: "Picks",
    "pick-grid": "Pick Grid",
    fixtures: "Live Scores",
    "team-news": "Team News & Injuries",
    difficulty: "Fixture Difficulty",
    rules: "Rules",
    prize: "Prize Draw",
    "pick-for-me": "Pick for me",
  })[route] ?? "Last Man Standing";
}

function getTeamName(pick, teamById) {
  return teamById.get(pick.teamId)?.name ?? pick.team ?? "No pick";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character]);
}

initialise();
