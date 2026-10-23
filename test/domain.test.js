import test from "node:test";
import assert from "node:assert/strict";
import {
  calculatePlayerStatus,
  calculatePlayerStatusAtEvent,
  findActiveEvent,
  findCompetitionEvent,
  getCharityRepresentation,
  getCountdownParts,
  getNextFiveDifficulty,
  getPickResult,
  getPlayerGoalDifference,
  getPlayerStatusLabel,
  getRoundSummary,
  getStandingMovements,
  getUnavailablePlayers,
  getWheelTargetRotation,
  groupFixturesByEvent,
  isFixtureComplete,
  sortPlayersByStanding,
} from "../src/domain.js";

test("findActiveEvent prefers the event flagged by FPL", () => {
  const events = [
    { id: 1, deadline_time: "2025-01-01T00:00:00Z", is_next: false },
    { id: 2, deadline_time: "2025-01-08T00:00:00Z", is_next: true },
  ];
  assert.equal(findActiveEvent(events, new Date("2024-12-01")).id, 2);
});

test("findCompetitionEvent follows the configured competition round", () => {
  const events = [
    { id: 1, is_current: true },
    { id: 2, is_next: true },
  ];
  assert.equal(findCompetitionEvent(events, 2).id, 2);
});

test("findActiveEvent falls back to the next future deadline", () => {
  const events = [
    { id: 1, deadline_time: "2025-01-01T00:00:00Z" },
    { id: 2, deadline_time: "2025-01-08T00:00:00Z" },
  ];
  assert.equal(findActiveEvent(events, new Date("2025-01-02")).id, 2);
});

test("groupFixturesByEvent ignores unscheduled fixtures", () => {
  const grouped = groupFixturesByEvent([{ id: 1, event: 3 }, { id: 2, event: null }]);
  assert.deepEqual(Object.keys(grouped), ["3"]);
});

test("provisionally finished fixtures count as complete", () => {
  assert.equal(isFixtureComplete({ finished: false, finished_provisional: true }), true);
});

test("getNextFiveDifficulty uses team-specific home and away ratings", () => {
  const teams = [{ id: 1, name: "Home" }, { id: 2, name: "Away" }];
  const fixtures = [{
    event: 4,
    finished: false,
    kickoff_time: "2025-01-01T00:00:00Z",
    team_h: 1,
    team_a: 2,
    team_h_difficulty: 2,
    team_a_difficulty: 5,
  }];
  const result = getNextFiveDifficulty(teams, fixtures, 4);
  assert.equal(result[0].fixtures[0].difficulty, 2);
  assert.equal(result[1].fixtures[0].difficulty, 5);
});

test("getCountdownParts never returns negative values", () => {
  assert.deepEqual(getCountdownParts("2025-01-01T00:00:00Z", new Date("2025-01-02T00:00:00Z")), {
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    expired: true,
  });
});

test("a losing pick marks a player as out", () => {
  const player = { status: "alive", picks: [{ gameweek: 1, result: "loss" }] };
  assert.equal(calculatePlayerStatus(player), "out");
});

test("finished fixtures automatically resolve picks and eliminate non-winners", () => {
  const fixtures = [{ event: 1, finished: false, finished_provisional: true, team_h: 1, team_a: 2, team_h_score: 1, team_a_score: 1 }];
  const pick = { gameweek: 1, teamId: 1, result: "pending" };
  const player = { status: "alive", picks: [pick] };
  assert.equal(getPickResult(pick, fixtures), "loss");
  assert.equal(calculatePlayerStatus(player, fixtures), "out");
});

test("finished fixtures keep winning picks standing", () => {
  const fixtures = [{ event: 1, finished: true, team_h: 1, team_a: 2, team_h_score: 2, team_a_score: 0 }];
  const pick = { gameweek: 1, teamId: 1, result: "pending" };
  assert.equal(getPickResult(pick, fixtures), "win");
});

test("charity representation allocates one entry fee per player", () => {
  const players = [
    { name: "A", charity: { name: "Shared", url: "https://example.com" } },
    { name: "B", charity: { name: "Shared", url: "https://example.com" } },
    { name: "C", charity: null },
  ];
  assert.deepEqual(getCharityRepresentation(players), [
    { name: "Shared", url: "https://example.com", players: ["A", "B"], amount: 40 },
    { name: "Pocketing the money", url: null, players: ["C"], amount: 20 },
  ]);
});

test("availability list includes injured and doubtful players", () => {
  const players = [
    { team: 1, web_name: "Available", status: "a", chance_of_playing_next_round: null },
    { team: 1, web_name: "Doubtful", status: "d", chance_of_playing_next_round: 50 },
    { team: 2, web_name: "Injured", status: "i", chance_of_playing_next_round: 0 },
  ];
  assert.deepEqual(getUnavailablePlayers(players).map((player) => player.web_name), ["Doubtful", "Injured"]);
});


test("wheel rotation centres the requested team beneath the top pointer", () => {
  const teams = Array.from({ length: 20 }, (_, index) => ({ name: index === 6 ? "Coventry City" : `Team ${index}` }));
  const rotation = getWheelTargetRotation(teams, "Coventry City", 6);
  const segmentAngle = 360 / teams.length;
  const targetCentre = 6 * segmentAngle + segmentAngle / 2;
  assert.equal((rotation + targetCentre) % 360, 0);
  assert.ok(rotation >= 6 * 360);
});


test("player status labels reflect picks and elimination", () => {
  const alive = { status: "alive", picks: [] };
  const out = { status: "alive", picks: [{ gameweek: 1, result: "loss" }] };
  assert.equal(getPlayerStatusLabel(alive, null), "Queuing for the wheel");
  assert.equal(getPlayerStatusLabel(alive, { gameweek: 1 }), "Standing");
  assert.equal(getPlayerStatusLabel(out, null), "6ft deep");
});

test("player goal difference totals the results of every completed picked fixture", () => {
  const player = {
    picks: [
      { gameweek: 1, teamId: 5, result: "win" },
      { gameweek: 2, teamId: 16, result: "pending" },
    ],
  };
  const fixtures = [
    { event: 1, finished: true, team_h: 5, team_a: 2, team_h_score: 4, team_a_score: 0 },
    { event: 2, finished: true, team_h: 16, team_a: 12, team_h_score: 2, team_a_score: 1 },
  ];
  assert.equal(getPlayerGoalDifference(player, fixtures), 5);
});

test("players are sorted by status, then goal difference, then name", () => {
  const players = [
    { name: "Out", status: "out", picks: [{ gameweek: 1, teamId: 3, result: "loss" }] },
    { name: "Arsenal", status: "alive", picks: [{ gameweek: 1, teamId: 1, result: "win" }] },
    { name: "Brighton", status: "alive", picks: [{ gameweek: 1, teamId: 5, result: "win" }] },
  ];
  const fixtures = [
    { event: 1, finished: true, team_h: 1, team_a: 4, team_h_score: 3, team_a_score: 0 },
    { event: 1, finished: true, team_h: 5, team_a: 2, team_h_score: 4, team_a_score: 0 },
    { event: 1, finished: true, team_h: 3, team_a: 6, team_h_score: 0, team_a_score: 1 },
  ];
  assert.deepEqual(sortPlayersByStanding(players, fixtures).map((player) => player.name), ["Brighton", "Arsenal", "Out"]);
});


test("historical standings ignore later picks and eliminations", () => {
  const players = [
    { name: "A", status: "alive", picks: [{ gameweek: 1, teamId: 1, result: "win" }, { gameweek: 2, teamId: 2, result: "loss" }] },
    { name: "B", status: "alive", picks: [{ gameweek: 1, teamId: 3, result: "win" }, { gameweek: 2, teamId: 4, result: "win" }] },
  ];
  const fixtures = [
    { event: 1, finished: true, team_h: 1, team_a: 5, team_h_score: 1, team_a_score: 0 },
    { event: 1, finished: true, team_h: 3, team_a: 6, team_h_score: 3, team_a_score: 0 },
    { event: 2, finished: true, team_h: 2, team_a: 7, team_h_score: 0, team_a_score: 1 },
    { event: 2, finished: true, team_h: 4, team_a: 8, team_h_score: 1, team_a_score: 0 },
  ];
  assert.equal(calculatePlayerStatusAtEvent(players[0], fixtures, 1), "alive");
  assert.deepEqual(sortPlayersByStanding(players, fixtures, 1).map((player) => player.name), ["B", "A"]);
});

test("standing movements compare current and previous gameweek order", () => {
  const players = [
    { name: "A", status: "alive", picks: [{ gameweek: 1, teamId: 1, result: "win" }, { gameweek: 2, teamId: 2, result: "win" }] },
    { name: "B", status: "alive", picks: [{ gameweek: 1, teamId: 3, result: "win" }, { gameweek: 2, teamId: 4, result: "win" }] },
  ];
  const fixtures = [
    { event: 1, finished: true, team_h: 1, team_a: 5, team_h_score: 1, team_a_score: 0 },
    { event: 1, finished: true, team_h: 3, team_a: 6, team_h_score: 2, team_a_score: 0 },
    { event: 2, finished: true, team_h: 2, team_a: 7, team_h_score: 3, team_a_score: 0 },
    { event: 2, finished: true, team_h: 4, team_a: 8, team_h_score: 1, team_a_score: 0 },
  ];
  assert.deepEqual([...getStandingMovements(players, fixtures, 2)], [["A", 1], ["B", -1]]);
});

test("round summary reports picks, reminders, eliminations, and popularity", () => {
  const players = [
    { name: "A", status: "alive", picks: [{ gameweek: 1, teamId: 1, result: "win" }, { gameweek: 2, teamId: 2, result: "win" }] },
    { name: "B", status: "alive", picks: [{ gameweek: 1, teamId: 1, result: "win" }, { gameweek: 2, teamId: 2, result: "loss" }] },
    { name: "C", status: "alive", picks: [{ gameweek: 1, teamId: 1, result: "win" }] },
  ];
  const summary = getRoundSummary(players, [], 2);
  assert.equal(summary.entrants, 3);
  assert.equal(summary.entered, 2);
  assert.deepEqual(summary.missing.map((player) => player.name), ["C"]);
  assert.equal(summary.eliminated, 1);
  assert.deepEqual(summary.mostPopular, { teamId: 2, count: 2 });
  assert.equal(summary.bestPick, null);
});

test("availability filters group doubtful, out, and suspended players", () => {
  const players = [
    { team: 1, web_name: "Doubt", status: "d", chance_of_playing_next_round: 50 },
    { team: 1, web_name: "Out", status: "i", chance_of_playing_next_round: 0 },
    { team: 1, web_name: "Ban", status: "s", chance_of_playing_next_round: 0 },
  ];
  assert.deepEqual(getUnavailablePlayers(players, "doubtful").map((player) => player.web_name), ["Doubt"]);
  assert.deepEqual(getUnavailablePlayers(players, "out").map((player) => player.web_name), ["Out"]);
  assert.deepEqual(getUnavailablePlayers(players, "suspended").map((player) => player.web_name), ["Ban"]);
});
