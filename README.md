# The Last One

A mobile-friendly Last Man Standing dashboard for a private Premier League competition. It shows player status and picks, gameweek fixtures, the next deadline, five-fixture difficulty rankings, and the game rules.

## Run locally

```bash
npm run dev
```

Open `http://localhost:4173`.

## Record player picks

The manual competition data lives in [`data/competition.json`](data/competition.json). Each player has a status and a list of picks:

```json
{
  "name": "Kony",
  "status": "alive",
  "icon": "🎅",
  "bio": "A short introduction to Kony.",
  "picks": [
    { "gameweek": 1, "teamId": 1, "result": "win" },
    { "gameweek": 2, "teamId": 14, "result": "pending" }
  ]
}
```

- `icon` is the player's emoji shown in the table and profile.
- `bio` is shown when somebody clicks the player's name.
- `teamId` is the FPL team ID found in `data/fpl.json` under `bootstrap.teams`.
- `result` can be `pending`, `win`, `loss`, or `no-pick`.
- A `loss` or `no-pick` automatically displays that player as out. You can also set `status` to `out` manually.
- Commit and push the JSON change to publish it after the pull request is merged.

### Edit picks and bios on GitHub

1. Open [`data/competition.json`](data/competition.json) on GitHub.
2. Select the pencil icon (**Edit this file**).
3. Add each player's `bio` and objects inside their `picks` list.
4. Select **Commit changes**.

The dashboard will show the pick whose `gameweek` matches the current FPL gameweek as the current pick.

## Premier League data

The browser first requests the official Fantasy Premier League API. If that request is blocked or unavailable, it uses the checked-in `data/fpl.json` snapshot. The `Update Premier League data` GitHub Actions workflow refreshes the snapshot every six hours.

To refresh it manually:

```bash
npm run update-data
npm run check
```

## Deployment

The included Pages workflow deploys `main`. In the repository's **Settings → Pages**, choose **GitHub Actions** as the source if GitHub does not enable it automatically after the first merge.

## Checks

```bash
npm run check
```

The rules summary is based on [Football Knockout's Last Man Standing rules](https://football-knockout.co.uk/rules).
