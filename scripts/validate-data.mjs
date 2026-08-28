import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const competition = JSON.parse(await readFile(new URL("../data/competition.json", import.meta.url)));
const fpl = JSON.parse(await readFile(new URL("../data/fpl.json", import.meta.url)));

assert.equal(competition.players.length, 20, "Expected all 20 competition players");
assert.equal(new Set(competition.players.map((player) => player.name)).size, competition.players.length, "Player names must be unique");
assert.equal(competition.competitionName, "Kony365", "Expected the Kony365 competition name");
assert.equal(competition.round, 2, "Expected Gameweek 2 to be active");
assert.equal(competition.deadlines["1"], "2026-08-21T18:00:00Z", "Expected the Gameweek 1 pick deadline");
assert.equal(competition.deadlines["2"], "2026-08-28T18:00:00Z", "Expected the Gameweek 2 pick deadline");
assert.ok(fpl.bootstrap.events.length >= 38, "Expected a full set of gameweeks");
assert.equal(fpl.bootstrap.teams.length, 20, "Expected 20 Premier League teams");
assert.ok(Array.isArray(fpl.bootstrap.elements), "Expected Premier League player availability data");
assert.ok(fpl.bootstrap.elements.length > 0, "Expected Premier League players");
assert.ok(fpl.fixtures.length > 0, "Expected fixture data");
assert.equal(competition.players.filter((player) => player.status === "alive").length, 16, "Expected 16 Gameweek 2 survivors");
assert.deepEqual(
  competition.players.filter((player) => player.status === "out").map((player) => player.name).sort(),
  ["Cam", "Leicester", "Tom Davies", "Tom Mahon"],
  "Expected the four Gameweek 1 eliminations",
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

console.log("Competition and FPL data are valid.");
