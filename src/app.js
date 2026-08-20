import {
  FPL_BOOTSTRAP_URL,
  FPL_FIXTURES_URL,
  calculatePlayerStatus,
  findActiveEvent,
  formatDeadline,
  getCountdownParts,
  getNextFiveDifficulty,
  getPickForEvent,
  getTeamMap,
  groupFixturesByEvent,
} from "./domain.js";

const LOCAL_FPL_DATA = "./data/fpl.json";
const TEAM_COLORS = ["#175940", "#1b5572", "#70402d", "#6b2e3c", "#403b76", "#86651f"];

const state = {
  competition: null,
  bootstrap: null,
  fixtures: [],
  activeEvent: null,
  selectedEvent: null,
  source: "local",
  deadline: null,
};

const elements = {
  aliveCount: document.querySelector("#alive-count"),
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
  playerDialog: document.querySelector("#player-dialog"),
  playerDialogBio: document.querySelector("#player-dialog-bio"),
  playerDialogHistory: document.querySelector("#player-dialog-history"),
  playerDialogIndex: document.querySelector("#player-dialog-index"),
  playerDialogName: document.querySelector("#player-dialog-name"),
  playerDialogPick: document.querySelector("#player-dialog-pick"),
  playerDialogStatus: document.querySelector("#player-dialog-status"),
  playersBody: document.querySelector("#players-body"),
  roundLabel: document.querySelector("#round-label"),
  seasonLabel: document.querySelector("#season-label"),
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
  try {
    const [competition, fpl] = await Promise.all([
      fetchJson("./data/competition.json"),
      loadFplData(),
    ]);
    state.competition = competition;
    state.bootstrap = fpl.bootstrap;
    state.fixtures = fpl.fixtures;
    state.activeEvent = findActiveEvent(state.bootstrap.events);
    state.selectedEvent = state.activeEvent?.id ?? 1;
    state.deadline = state.competition.deadlines?.[state.activeEvent?.id] ?? state.activeEvent?.deadline_time ?? null;

    renderPage();
    bindInteractions();
    updateCountdown();
    window.setInterval(updateCountdown, 1000);
  } catch (error) {
    console.error(error);
    elements.fixturesGrid.innerHTML = '<p class="empty-state">The competition data could not be loaded. Please try again shortly.</p>';
    elements.dataNote.textContent = "Data is temporarily unavailable.";
  }
}

function renderPage() {
  const alive = state.competition.players.filter((player) => calculatePlayerStatus(player) === "alive");
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
  elements.dataNote.textContent = "Kony365 deadline · picks lock one hour before the first kick-off.";

  renderPlayers("all");
  renderGameweekSelect();
  renderFixtures();
  renderDifficulty();
}

function renderPlayers(filter) {
  const teamById = getTeamMap(state.bootstrap.teams);
  const players = state.competition.players.filter((player) => {
    const status = calculatePlayerStatus(player);
    return filter === "all" || filter === status;
  });

  elements.playersBody.innerHTML = players.map((player) => {
    const status = calculatePlayerStatus(player);
    const currentPick = getPickForEvent(player, state.activeEvent?.id);
    return `
      <tr data-status="${status}">
        <td><button class="player-cell player-profile-button" type="button" data-player-index="${state.competition.players.indexOf(player)}" aria-label="View ${escapeHtml(player.name)}'s profile"><span class="player-index player-icon" aria-hidden="true">${escapeHtml(player.icon)}</span><span>${escapeHtml(player.name)}</span><span class="profile-arrow" aria-hidden="true">↗</span></button></td>
        <td><span class="status ${status}">${status === "alive" ? "Standing" : "Out"}</span></td>
        <td>${currentPick ? `<span class="pick-name">${escapeHtml(getTeamName(currentPick, teamById))}</span>` : '<span class="pick-pending">Not entered yet</span>'}</td>
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
  const status = calculatePlayerStatus(player);
  const currentPick = getPickForEvent(player, state.activeEvent?.id);
  elements.playerDialogIndex.textContent = player.icon;
  elements.playerDialogName.textContent = player.name;
  elements.playerDialogBio.textContent = player.bio || "Player bio coming soon.";
  elements.playerDialogStatus.textContent = status === "alive" ? "Standing" : "Out";
  elements.playerDialogPick.textContent = currentPick ? getTeamName(currentPick, teamById) : "Not entered yet";
  elements.playerDialogHistory.innerHTML = renderPickHistory(player, teamById);
  elements.playerDialog.showModal();
}

function renderPickHistory(player, teamById) {
  if (!player.picks.length) return '<span class="pick-pending">No picks recorded</span>';
  return [...player.picks]
    .sort((a, b) => a.gameweek - b.gameweek)
    .map((pick) => {
      const shortName = teamById.get(pick.teamId)?.short_name ?? pick.team ?? "—";
      const resultClass = pick.result === "win" ? "win" : pick.result === "loss" || pick.result === "no-pick" ? "loss" : "";
      return `<span class="pick-badge ${resultClass}" title="Gameweek ${pick.gameweek}: ${escapeHtml(getTeamName(pick, teamById))}">${escapeHtml(shortName)}</span>`;
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
  const middle = fixture.started || fixture.finished
    ? `<strong class="score">${fixture.team_h_score ?? 0}–${fixture.team_a_score ?? 0}</strong><span>${fixture.finished ? "Full time" : "Live"}</span>`
    : `<strong>${time}</strong><span>${day}</span>`;

  return `<article class="fixture-card">
    ${teamMarkup(home, "home")}
    <div class="fixture-time">${middle}</div>
    ${teamMarkup(away, "away")}
  </article>`;
}

function teamMarkup(team, side) {
  const color = TEAM_COLORS[(team?.id ?? 0) % TEAM_COLORS.length];
  return `<div class="fixture-team ${side}"><span class="team-token" style="background:${color}">${escapeHtml(team?.short_name ?? "TBC")}</span><span>${escapeHtml(team?.name ?? "TBC")}</span></div>`;
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
  const color = TEAM_COLORS[entry.team.id % TEAM_COLORS.length];
  const fixtures = entry.fixtures.map((fixture) => {
    const opponent = teamById.get(fixture.opponentId);
    return `<span class="fixture-pill difficulty-${fixture.difficulty}" title="Gameweek ${fixture.event}: ${escapeHtml(opponent?.name ?? "TBC")} (${fixture.venue})">${escapeHtml(opponent?.short_name ?? "—")}</span>`;
  }).join("");

  return `<div class="difficulty-row">
    <div class="difficulty-team"><span class="team-token" style="background:${color}">${escapeHtml(entry.team.short_name)}</span><span>${escapeHtml(entry.team.name)}</span></div>
    <div class="fixture-run">${fixtures}</div>
    <span class="difficulty-score">${entry.average.toFixed(1)}</span>
  </div>`;
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

  const sections = [...document.querySelectorAll("main section[id]")];
  const navLinks = [...document.querySelectorAll(".primary-nav a")];
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    navLinks.forEach((link) => link.classList.toggle("active", link.hash === `#${visible.target.id}`));
  }, { rootMargin: "-30% 0px -60%", threshold: [0, 0.1, 0.5] });
  sections.forEach((section) => observer.observe(section));
}

function getTeamName(pick, teamById) {
  return teamById.get(pick.teamId)?.name ?? pick.team ?? "No pick";
}

function formatUpdatedAt(value) {
  if (!value) return "recently";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
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
