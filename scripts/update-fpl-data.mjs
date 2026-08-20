import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FPL_BOOTSTRAP_URL, FPL_FIXTURES_URL } from "../src/domain.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destination = resolve(root, "data/fpl.json");

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "LMS-Dashboard-Data-Updater/1.0" },
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

const [bootstrap, fixtures] = await Promise.all([
  fetchJson(FPL_BOOTSTRAP_URL),
  fetchJson(FPL_FIXTURES_URL),
]);

const snapshot = {
  bootstrap: {
    updatedAt: new Date().toISOString(),
    events: bootstrap.events,
    teams: bootstrap.teams,
  },
  fixtures,
};

await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, `${JSON.stringify(snapshot)}\n`, "utf8");
console.log(`Updated ${destination} with ${fixtures.length} fixtures.`);
