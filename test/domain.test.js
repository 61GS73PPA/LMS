import test from "node:test";
import assert from "node:assert/strict";
import {
  calculatePlayerStatus,
  findActiveEvent,
  getCountdownParts,
  getNextFiveDifficulty,
  getPlayerStatusLabel,
  getWheelTargetRotation,
  groupFixturesByEvent,
} from "../src/domain.js";

test("findActiveEvent prefers the event flagged by FPL", () => {
  const events = [
    { id: 1, deadline_time: "2025-01-01T00:00:00Z", is_next: false },
    { id: 2, deadline_time: "2025-01-08T00:00:00Z", is_next: true },
  ];
  assert.equal(findActiveEvent(events, new Date("2024-12-01")).id, 2);
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


test("wheel rotation centres the requested team on the pointer", () => {
  const teams = Array.from({ length: 20 }, (_, index) => ({ name: index === 6 ? "Coventry City" : `Team ${index}` }));
  const rotation = getWheelTargetRotation(teams, "Coventry City", 6);
  const segmentAngle = 360 / teams.length;
  const targetCentre = 6 * segmentAngle + segmentAngle / 2;
  assert.equal((rotation + targetCentre) % 360, 270);
  assert.ok(rotation >= 6 * 360);
});


test("player status labels reflect picks and elimination", () => {
  const alive = { status: "alive", picks: [] };
  const out = { status: "alive", picks: [{ gameweek: 1, result: "loss" }] };
  assert.equal(getPlayerStatusLabel(alive, null), "Queuing for the wheel");
  assert.equal(getPlayerStatusLabel(alive, { gameweek: 1 }), "Standing");
  assert.equal(getPlayerStatusLabel(out, null), "6ft deep");
});
