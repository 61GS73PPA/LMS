import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const competition = JSON.parse(await readFile(new URL("../data/competition.json", import.meta.url)));
const fpl = JSON.parse(await readFile(new URL("../data/fpl.json", import.meta.url)));

assert.equal(competition.players.length, 20, "Expected all 20 competition players");
assert.equal(new Set(competition.players.map((player) => player.name)).size, competition.players.length, "Player names must be unique");
assert.equal(competition.competitionName, "Kony365", "Expected the Kony365 competition name");
assert.equal(competition.round, 10, "Expected Gameweek 10 to be active");
assert.equal(competition.deadlines["5"], "2026-09-18T16:30:00Z", "Expected the Gameweek 5 pick deadline");
assert.equal(competition.deadlines["6"], "2026-10-09T17:30:00Z", "Expected the Gameweek 6 pick deadline");
assert.equal(competition.deadlines["7"], "2026-10-17T10:30:00Z", "Expected the Gameweek 7 pick deadline");
assert.equal(competition.deadlines["8"], "2026-10-23T18:00:00Z", "Expected the Gameweek 8 pick deadline");
assert.ok(competition.firstGame, "Expected the archived previous game");
assert.equal(competition.firstGame.round, 8, "Expected the archived game to have run through Gameweek 8");
assert.equal(competition.firstGame.players.length, 20, "Expected all 20 archived players");
assert.ok(fpl.bootstrap.events.length >= 38, "Expected a full set of gameweeks");
assert.equal(fpl.bootstrap.teams.length, 20, "Expected 20 Premier League teams");
assert.ok(Array.isArray(fpl.bootstrap.elements), "Expected Premier League player availability data");
assert.ok(fpl.bootstrap.elements.length > 0, "Expected Premier League players");
assert.ok(fpl.fixtures.length > 0, "Expected fixture data");
assert.equal(competition.players.filter((player) => player.status === "alive").length, 6, "Expected 6 Gameweek 10 survivors");
assert.deepEqual(
  competition.players.filter((player) => player.status === "alive").map((player) => player.name).sort(),
  ["Brushel", "Hub", "Matt Coleslaw", "PIG", "Rhod", "Tom Mahon"],
  "Expected the six Gameweek 9 winners to be standing",
);
assert.deepEqual(
  competition.players.filter((player) => player.status === "out").map((player) => player.name).sort(),
  ["Alf Van Bronckhorst", "Beanie", "Bryan", "Cam", "Chris Gill", "Chris Pyke", "Hayter", "Jordan Padel", "Kenny Dufter", "Kony", "Leicester", "Mezzy T", "Tom Davies", "Wikles"],
  "Expected the fourteen Gameweek 9 eliminations",
);
const expectedGameweek5Results = new Map([
  ["Kony", { teamId: 18, result: "loss" }],
  ["Hayter", { teamId: 15, result: "win" }],
  ["Bryan", { teamId: 15, result: "win" }],
  ["Rhod", { teamId: 17, result: "win" }],
  ["Chris Pyke", { teamId: 2, result: "win" }],
  ["Chris Gill", { teamId: 13, result: "loss" }],
  ["Hub", { teamId: 5, result: "win" }],
  ["Leicester", { teamId: 12, result: "loss" }],
  ["Kenny Dufter", { teamId: 14, result: "win" }],
  ["PIG", { teamId: 19, result: "loss" }],
  ["Alf Van Bronckhorst", { teamId: 5, result: "win" }],
  ["Wikles", { teamId: 20, result: "loss" }],
  ["Brushel", { teamId: 10, result: "loss" }],
  ["Beanie", { teamId: 2, result: "win" }],
  ["Jordan Padel", { teamId: 8, result: "loss" }],
  ["Matt Coleslaw", { teamId: 8, result: "loss" }],
  ["Mezzy T", { teamId: 15, result: "win" }],
  ["Tom Davies", { teamId: 12, result: "loss" }],
  ["Tom Mahon", { teamId: 5, result: "win" }],
  ["Cam", { teamId: 18, result: "loss" }],
]);
for (const player of competition.firstGame.players) {
  const gameweek5Picks = player.picks.filter((pick) => pick.gameweek === 5);
  assert.equal(gameweek5Picks.length, 1, `Expected one Gameweek 5 pick for ${player.name}`);
  assert.equal(gameweek5Picks[0].teamId, expectedGameweek5Results.get(player.name).teamId, `Expected ${player.name}'s recorded Gameweek 5 team`);
  assert.equal(gameweek5Picks[0].result, expectedGameweek5Results.get(player.name).result, `Expected ${player.name}'s recorded Gameweek 5 result`);
}
const expectedGameweek6Results = new Map([
  ["Hayter", { teamId: 19, result: "loss" }],
  ["Bryan", { teamId: 1, result: "win" }],
  ["Rhod", { teamId: 1, result: "win" }],
  ["Chris Pyke", { teamId: 20, result: "loss" }],
  ["Hub", { teamId: 1, result: "win" }],
  ["Kenny Dufter", { teamId: 7, result: "win" }],
  ["Alf Van Bronckhorst", { teamId: 16, result: "loss" }],
  ["Beanie", { teamId: 1, result: "win" }],
  ["Mezzy T", { teamId: 5, result: "win" }],
  ["Tom Mahon", { teamId: 1, result: "win" }],
]);
for (const player of competition.firstGame.players) {
  const gameweek6Picks = player.picks.filter((pick) => pick.gameweek === 6);
  if (expectedGameweek6Results.has(player.name)) {
    assert.equal(gameweek6Picks.length, 1, `Expected one Gameweek 6 pick for ${player.name}`);
    assert.equal(gameweek6Picks[0].teamId, expectedGameweek6Results.get(player.name).teamId, `Expected ${player.name}'s recorded Gameweek 6 team`);
    assert.equal(gameweek6Picks[0].result, expectedGameweek6Results.get(player.name).result, `Expected ${player.name}'s recorded Gameweek 6 result`);
  } else {
    assert.equal(gameweek6Picks.length, 0, `Expected no Gameweek 6 pick for ${player.name}`);
  }
}
const expectedGameweek7Results = new Map([
  ["Bryan", { teamId: 5, result: "win" }],
  ["Rhod", { teamId: 15, result: "win" }],
  ["Hub", { teamId: 15, result: "win" }],
  ["Kenny Dufter", { teamId: 16, result: "loss" }],
  ["Beanie", { teamId: 6, result: "win" }],
  ["Mezzy T", { teamId: 2, result: "win" }],
  ["Tom Mahon", { teamId: 13, result: "loss" }],
]);
for (const player of competition.firstGame.players) {
  const gameweek7Picks = player.picks.filter((pick) => pick.gameweek === 7);
  if (expectedGameweek7Results.has(player.name)) {
    assert.equal(gameweek7Picks.length, 1, `Expected one Gameweek 7 pick for ${player.name}`);
    assert.equal(gameweek7Picks[0].teamId, expectedGameweek7Results.get(player.name).teamId, `Expected ${player.name}'s recorded Gameweek 7 team`);
    assert.equal(gameweek7Picks[0].result, expectedGameweek7Results.get(player.name).result, `Expected ${player.name}'s recorded Gameweek 7 result`);
  } else {
    assert.equal(gameweek7Picks.length, 0, `Expected no Gameweek 7 pick for ${player.name}`);
  }
}
const expectedGameweek8Picks = new Map([
  ["Beanie", { teamId: 6, viaWheel: false }],
  ["Rhod", { teamId: 6, viaWheel: false }],
  ["Bryan", { teamId: 6, viaWheel: false }],
  ["Hub", { teamId: 12, viaWheel: false }],
  ["Mezzy T", { teamId: 12, viaWheel: true }],
]);
for (const player of competition.firstGame.players) {
  const gameweek8Picks = player.picks.filter((pick) => pick.gameweek === 8);
  if (expectedGameweek8Picks.has(player.name)) {
    assert.equal(gameweek8Picks.length, 1, `Expected one Gameweek 8 pick for ${player.name}`);
    assert.equal(gameweek8Picks[0].teamId, expectedGameweek8Picks.get(player.name).teamId, `Expected ${player.name}'s recorded Gameweek 8 team`);
    assert.equal(gameweek8Picks[0].result, "pending", `Expected ${player.name}'s Gameweek 8 pick to be pending`);
    assert.equal(gameweek8Picks[0].viaWheel ?? false, expectedGameweek8Picks.get(player.name).viaWheel, `Expected ${player.name}'s Gameweek 8 wheel marker`);
  } else {
    assert.equal(gameweek8Picks.length, 0, `Expected no Gameweek 8 pick for ${player.name}`);
  }
}
const expectedGameweek9Results = new Map([
  ["Kony", { teamId: 2, result: "loss" }],
  ["Hayter", { teamId: 2, result: "loss" }],
  ["Bryan", { teamId: 2, result: "loss" }],
  ["Rhod", { teamId: 19, result: "win" }],
  ["Chris Pyke", { teamId: 11, result: "loss" }],
  ["Chris Gill", { teamId: 17, result: "loss" }],
  ["Hub", { teamId: 3, result: "win" }],
  ["Leicester", { teamId: 2, result: "loss" }],
  ["Kenny Dufter", { teamId: 14, result: "loss" }],
  ["PIG", { teamId: 19, result: "win" }],
  ["Alf Van Bronckhorst", { teamId: 13, result: "loss" }],
  ["Wikles", { teamId: 2, result: "loss" }],
  ["Brushel", { teamId: 1, result: "win" }],
  ["Beanie", { teamId: 2, result: "loss" }],
  ["Jordan Padel", { teamId: 14, result: "loss" }],
  ["Matt Coleslaw", { teamId: 7, result: "win" }],
  ["Mezzy T", { teamId: 18, result: "loss" }],
  ["Tom Davies", { teamId: 10, result: "loss" }],
  ["Tom Mahon", { teamId: 4, result: "win" }],
  ["Cam", { teamId: 20, result: "loss" }],
]);
for (const player of competition.players) {
  const gameweek9Picks = player.picks.filter((pick) => pick.gameweek === 9);
  assert.equal(gameweek9Picks.length, 1, `Expected one Gameweek 9 pick for ${player.name}`);
  assert.equal(gameweek9Picks[0].teamId, expectedGameweek9Results.get(player.name).teamId, `Expected ${player.name}'s recorded Gameweek 9 team`);
  assert.equal(gameweek9Picks[0].result, expectedGameweek9Results.get(player.name).result, `Expected ${player.name}'s recorded Gameweek 9 result`);
  assert.equal(player.picks.length, 1, `Expected only the Gameweek 9 pick for ${player.name}`);
}
assert.deepEqual(
  competition.firstGame.players.filter((player) => player.status === "out").map((player) => player.name).sort(),
  ["Alf Van Bronckhorst", "Brushel", "Cam", "Chris Gill", "Chris Pyke", "Hayter", "Jordan Padel", "Kenny Dufter", "Kony", "Leicester", "Matt Coleslaw", "PIG", "Tom Davies", "Tom Mahon", "Wikles"],
  "Expected the fifteen eliminations through Gameweek 7 in the archived game",
);
assert.equal(
  competition.firstGame.players.filter((player) => player.status === "alive").length,
  5,
  "Expected 5 survivors in the archived game",
);
assert.equal(
  competition.firstGame.players.find((player) => player.name === "Kony").picks.find((pick) => pick.gameweek === 5).result,
  "loss",
  "Kony picked Forest in Gameweek 5 and was eliminated",
);

for (const player of competition.players) {
  assert.ok(["alive", "out"].includes(player.status), `${player.name} has an invalid status`);
  assert.equal(typeof player.icon, "string", `${player.name} must have an emoji icon`);
  assert.ok(player.icon.trim().length > 0, `${player.name} icon must not be empty`);
  assert.ok(player.charity === null || typeof player.charity === "object", `${player.name} charity must be an object or null`);
  if (player.charity) {
    assert.equal(typeof player.charity.name, "string", `${player.name} charity must have a name`);
    assert.equal(typeof player.charity.url, "string", `${player.name} charity must have a URL`);
    assert.ok(player.charity.name.trim().length > 0, `${player.name} charity name must not be empty`);
    assert.match(player.charity.url, /^https:\/\//, `${player.name} charity URL must use HTTPS`);
  }
  assert.ok(Array.isArray(player.picks), `${player.name} picks must be an array`);
  const gameweeks = player.picks.map((pick) => pick.gameweek);
  assert.equal(new Set(gameweeks).size, gameweeks.length, `${player.name} has duplicate gameweek picks`);
  for (const pick of player.picks) {
    assert.ok(["pending", "win", "loss", "no-pick"].includes(pick.result), `${player.name} has an invalid pick result`);
    assert.ok(fpl.bootstrap.teams.some((team) => team.id === pick.teamId), `${player.name} has an invalid team ID`);
    assert.ok(pick.viaWheel === undefined || typeof pick.viaWheel === "boolean", `${player.name} has an invalid wheel marker`);
  }
}

for (const player of competition.firstGame.players) {
  assert.ok(["alive", "out"].includes(player.status), `Archived ${player.name} has an invalid status`);
  assert.ok(Array.isArray(player.picks), `Archived ${player.name} picks must be an array`);
  const gameweeks = player.picks.map((pick) => pick.gameweek);
  assert.equal(new Set(gameweeks).size, gameweeks.length, `Archived ${player.name} has duplicate gameweek picks`);
  for (const pick of player.picks) {
    assert.ok(["pending", "win", "loss", "no-pick"].includes(pick.result), `Archived ${player.name} has an invalid pick result`);
    assert.ok(fpl.bootstrap.teams.some((team) => team.id === pick.teamId), `Archived ${player.name} has an invalid team ID`);
  }
}

console.log("Competition and FPL data are valid.");

