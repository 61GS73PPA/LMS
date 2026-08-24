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
  getPlayerStatusLabel,
  getTeamMap,
  getUnavailablePlayers,
  getWheelTargetRotation,
  groupFixturesByEvent,
  isFixtureComplete,
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
  deadline: null,
  wheelRotation: 0,
};

const elements = {
  aliveCount: document.querySelector("#alive-count"),
  charityRepresentationList: document.querySelector("#charity-representation-list"),
  countdown: document.querySelector("#countdown"),
  dataNote: document.querySelector("#data-note"),
  deadlineDate: document.querySelector("#deadline-title"),
  deadlineGameweek: document.querySelector("#deadline-gameweek"),
  easiestList: document.querySelector("#easiest-list"),
  fixturesGrid: document.querySelector("#fixtures-grid"),
  fixturesTitle: document.querySelector("#fixtures-title"),
  gameweekNumber: document.querySelector("#gameweek-number"),
  gameweekSelect: document.querySelector("#gameweek-select"),
  hardestList: document.querySelector("#hardest-list"),
  outCount: document.querySelector("#out-count"),
  pickMatrixWrap: document.querySelector("#pick-matrix-wrap"),
  playerDialog: document.querySelector("#player-dialog"),
  playerDialogCharity: document.querySelector("#player-dialog-charity"),
  playerDialogHistory: document.querySelector("#player-dialog-history"),
  playerDialogIndex: document.querySelector("#player-dialog-index"),
  playerDialogName: document.querySelector("#player-dialog-name"),
  playerDialogPick: document.querySelector("#player-dialog-pick"),
  playerDialogStatus: document.querySelector("#player-dialog-status"),
  playersBody: document.querySelector("#players-body"),
  roundLabel: document.querySelector("#round-label"),
  seasonLabel: document.querySelector("#season-label"),
  spinWheel: document.querySelector("#spin-wheel"),
  teamNewsGrid: document.querySelector("#team-news-grid"),
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
    return { bootstrap, fixtures };
  } catch (error) {
    console.info("Live FPL data unavailable; using the repository snapshot.", error);
    state.source = "snapshot";
    return fetchJson(LOCAL_FPL_DATA);
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
  elements.dataNote.textContent = `All ${alive.length} remaining players need a new pick · picks lock one hour before the first kick-off.`;

  renderPlayers("all");
  renderGameweekSelect();
  renderFixtures();
  renderDifficulty();
  renderTeamNews();
  renderPickMatrix();
  renderCharityRepresentation();
  renderWheel();
  showRoute(getRequestedRoute());
}

function renderPlayers(filter) {
  const teamById = getTeamMap(state.bootstrap.teams);
  const players = state.competition.players
    .map((player, index) => ({ player, index }))
    .filter(({ player }) => {
      const status = calculatePlayerStatus(player, state.fixtures);
      return filter === "all" || filter === status;
    })
    .sort((a, b) => a.player.name.localeCompare(b.player.name, "en-GB", { sensitivity: "base" }));

  elements.playersBody.innerHTML = players.map(({ player, index }) => {
    const status = calculatePlayerStatus(player, state.fixtures);
    const currentPick = getPickForEvent(player, state.activeEvent?.id);
    return `
      <tr data-status="${status}">
        <td><button class="player-cell player-profile-button" type="button" data-player-index="${index}" aria-label="View ${escapeHtml(player.name)}'s profile"><span class="player-index player-icon" aria-hidden="true">${escapeHtml(player.icon)}</span><span>${escapeHtml(player.name)}</span><span class="profile-arrow" aria-hidden="true">↗</span></button></td>
        <td><span class="status ${status}${!currentPick && status === "alive" ? " queued" : ""}">${getPlayerStatusLabel(player, currentPick, state.fixtures)}</span></td>
        <td>${currentPick ? `<span class="pick-name">${escapeHtml(getTeamName(currentPick, teamById))}</span>` : `<span class="pick-pending">${status === "alive" ? "Pick required" : "Eliminated"}</span>`}</td>
        <td><div class="pick-history">${renderPickHistory(player, teamById)}</div></td>
      </tr>`;
  }).join("");

  if (!players.length) {
    elements.playersBody.innerHTML = '<tr><td colspan="4" class="empty-state">No players match this view.</td></tr>';
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
  elements.playerDialogHistory.innerHTML = renderPickHistory(player, teamById);
  elements.playerDialog.showModal();
}

function renderCharity(charity) {
  if (!charity) return "Pocketing the money";
  return `<a href="${escapeHtml(charity.url)}" target="_blank" rel="noreferrer">${escapeHtml(charity.name)} <span aria-hidden="true">↗</span></a>`;
}

function renderPickHistory(player, teamById) {
  if (!player.picks.length) return '<span class="pick-pending">No picks recorded</span>';
  return [...player.picks]
    .sort((a, b) => a.gameweek - b.gameweek)
    .map((pick) => {
      const shortName = teamById.get(pick.teamId)?.short_name ?? pick.team ?? "—";
      const result = getPickResult(pick, state.fixtures);
      const resultClass = result === "win" ? "win" : result === "loss" || result === "no-pick" ? "loss" : "";
      return `<span class="pick-badge ${resultClass}" title="Gameweek ${pick.gameweek}: ${escapeHtml(getTeamName(pick, teamById))}"><small>GW${pick.gameweek}</small>${escapeHtml(shortName)}</span>`;
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

function renderTeamNews() {
  const teamById = getTeamMap(state.bootstrap.teams);
  const unavailable = getUnavailablePlayers(state.bootstrap.elements ?? []);
  if (!unavailable.length) {
    elements.teamNewsGrid.innerHTML = '<p class="empty-state">No injuries or availability doubts are currently flagged by FPL.</p>';
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
  return `<div class="availability-row">
    <div><strong>${escapeHtml(player.web_name)}</strong><span>${escapeHtml(player.news || statusLabel(player.status))}</span></div>
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
      return `<td class="pick-used ${escapeHtml(result)}" title="${escapeHtml(player.name)} picked ${escapeHtml(team.name)} in Gameweek ${pick.gameweek}"><span>GW${pick.gameweek}</span></td>`;
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

async function refreshLiveData() {
  if (state.source !== "live" || document.hidden) return;
  try {
    const fixtures = await fetchJson(FPL_FIXTURES_URL);
    state.fixtures = fixtures;
    renderPlayers(document.querySelector("[data-filter].active")?.dataset.filter ?? "all");
    renderFixtures();
    renderPickMatrix();
    const alive = state.competition.players.filter((player) => calculatePlayerStatus(player, state.fixtures) === "alive");
    elements.aliveCount.textContent = alive.length;
    elements.outCount.textContent = state.competition.players.length - alive.length;
  } catch (error) {
    console.info("Live fixture refresh failed; retaining the last known scores.", error);
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
