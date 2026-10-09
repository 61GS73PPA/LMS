import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const competition = JSON.parse(await readFile(new URL("../data/competition.json", import.meta.url)));
const fpl = JSON.parse(await readFile(new URL("../data/fpl.json", import.meta.url)));

assert.equal(competition.players.length, 20, "Expected all 20 competition players");
assert.equal(new Set(competition.players.map((player) => player.name)).size, competition.players.length, "Player names must be unique");
assert.equal(competition.competitionName, "Kony365", "Expected the Kony365 competition name");
assert.equal(competition.round, 6, "Expected Gameweek 6 to be active");
assert.equal(competition.deadlines["5"], "2026-09-18T16:30:00Z", "Expected the Gameweek 5 pick deadline");
assert.equal(competition.deadlines["6"], "2026-10-09T17:30:00Z", "Expected the Gameweek 6 pick deadline");
assert.ok(competition.firstGame, "Expected the archived first game");
assert.equal(competition.firstGame.round, 4, "Expected the first game to have run through Gameweek 4");
assert.equal(competition.firstGame.players.length, 20, "Expected all 20 first-game players");
assert.ok(fpl.bootstrap.events.length >= 38, "Expected a full set of gameweeks");
assert.equal(fpl.bootstrap.teams.length, 20, "Expected 20 Premier League teams");
assert.ok(Array.isArray(fpl.bootstrap.elements), "Expected Premier League player availability data");
assert.ok(fpl.bootstrap.elements.length > 0, "Expected Premier League players");
assert.ok(fpl.fixtures.length > 0, "Expected fixture data");
assert.equal(competition.players.filter((player) => player.status === "alive").length, 10, "Expected 10 Gameweek 6 survivors");
assert.deepEqual(
  competition.players.filter((player) => player.status === "out").map((player) => player.name).sort(),
  ["Brushel", "Cam", "Chris Gill", "Jordan Padel", "Kony", "Leicester", "Matt Coleslaw", "PIG", "Tom Davies", "Wikles"],
  "Expected the ten eliminations through Gameweek 5",
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
for (const player of competition.players) {
  const gameweek5Picks = player.picks.filter((pick) => pick.gameweek === 5);
  assert.equal(gameweek5Picks.length, 1, `Expected one Gameweek 5 pick for ${player.name}`);
  assert.equal(gameweek5Picks[0].teamId, expectedGameweek5Results.get(player.name).teamId, `Expected ${player.name}'s recorded Gameweek 5 team`);
  assert.equal(gameweek5Picks[0].result, expectedGameweek5Results.get(player.name).result, `Expected ${player.name}'s recorded Gameweek 5 result`);
  assert.equal(player.picks.some((pick) => pick.gameweek === 6), false, `Expected no Gameweek 6 pick for ${player.name} yet`);
}
assert.deepEqual(
  competition.firstGame.players.filter((player) => player.status === "out").map((player) => player.name).sort(),
  ["Brushel", "Cam", "Hub", "Jordan Padel", "Kony", "Leicester", "Matt Coleslaw", "Mezzy T", "Rhod", "Tom Davies", "Tom Mahon"],
  "Expected the eleven first-game eliminations",
);
assert.equal(
  competition.firstGame.players.find((player) => player.name === "Leicester").picks.find((pick) => pick.gameweek === 3).result,
  "loss",
  "Leicester picked Coventry in Gameweek 3 and is eliminated",
);
assert.equal(
  competition.firstGame.players.find((player) => player.name === "Matt Coleslaw").picks.find((pick) => pick.gameweek === 3).result,
  "loss",
  "Matt Coleslaw picked Hull in Gameweek 3 and is eliminated",
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
  assert.ok(["alive", "out"].includes(player.status), `First-game ${player.name} has an invalid status`);
  assert.ok(Array.isArray(player.picks), `First-game ${player.name} picks must be an array`);
  const gameweeks = player.picks.map((pick) => pick.gameweek);
  assert.equal(new Set(gameweeks).size, gameweeks.length, `First-game ${player.name} has duplicate gameweek picks`);
  for (const pick of player.picks) {
    assert.ok(["pending", "win", "loss", "no-pick"].includes(pick.result), `First-game ${player.name} has an invalid pick result`);
    assert.ok(fpl.bootstrap.teams.some((team) => team.id === pick.teamId), `First-game ${player.name} has an invalid team ID`);
  }
}

console.log("Competition and FPL data are valid.");

