import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const competition = JSON.parse(await readFile(new URL("../data/competition.json", import.meta.url)));
const fpl = JSON.parse(await readFile(new URL("../data/fpl.json", import.meta.url)));

assert.equal(competition.players.length, 17, "Expected all 17 competition players");
assert.equal(new Set(competition.players.map((player) => player.name)).size, competition.players.length, "Player names must be unique");
assert.equal(competition.competitionName, "Kony365", "Expected the Kony365 competition name");
assert.equal(competition.deadlines["1"], "2026-08-21T18:00:00Z", "Expected the Gameweek 1 pick deadline");
assert.ok(fpl.bootstrap.events.length >= 38, "Expected a full set of gameweeks");
assert.equal(fpl.bootstrap.teams.length, 20, "Expected 20 Premier League teams");
assert.ok(fpl.fixtures.length > 0, "Expected fixture data");

for (const player of competition.players) {
  assert.ok(["alive", "out"].includes(player.status), `${player.name} has an invalid status`);
  assert.equal(typeof player.icon, "string", `${player.name} must have an emoji icon`);
  assert.ok(player.icon.trim().length > 0, `${player.name} icon must not be empty`);
  assert.equal(typeof player.bio, "string", `${player.name} must have a bio`);
  assert.ok(player.bio.trim().length > 0, `${player.name} bio must not be empty`);
  assert.ok(Array.isArray(player.picks), `${player.name} picks must be an array`);
  const gameweeks = player.picks.map((pick) => pick.gameweek);
  assert.equal(new Set(gameweeks).size, gameweeks.length, `${player.name} has duplicate gameweek picks`);
  for (const pick of player.picks) {
    assert.ok(["pending", "win", "loss", "no-pick"].includes(pick.result), `${player.name} has an invalid pick result`);
    assert.ok(fpl.bootstrap.teams.some((team) => team.id === pick.teamId), `${player.name} has an invalid team ID`);
  }
}

console.log("Competition and FPL data are valid.");
