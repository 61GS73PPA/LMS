import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const competition = JSON.parse(await readFile(new URL("../data/competition.json", import.meta.url)));
const fpl = JSON.parse(await readFile(new URL("../data/fpl.json", import.meta.url)));

assert.equal(competition.players.length, 16, "Expected all 16 competition players");
assert.equal(new Set(competition.players.map((player) => player.name)).size, competition.players.length, "Player names must be unique");
assert.ok(fpl.bootstrap.events.length >= 38, "Expected a full set of gameweeks");
assert.equal(fpl.bootstrap.teams.length, 20, "Expected 20 Premier League teams");
assert.ok(fpl.fixtures.length > 0, "Expected fixture data");

for (const player of competition.players) {
  assert.ok(["alive", "out"].includes(player.status), `${player.name} has an invalid status`);
  assert.equal(typeof player.bio, "string", `${player.name} must have a bio`);
  assert.ok(player.bio.trim().length > 0, `${player.name} bio must not be empty`);
  assert.ok(Array.isArray(player.picks), `${player.name} picks must be an array`);
  const gameweeks = player.picks.map((pick) => pick.gameweek);
  assert.equal(new Set(gameweeks).size, gameweeks.length, `${player.name} has duplicate gameweek picks`);
}

console.log("Competition and FPL data are valid.");
