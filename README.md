# Kony365

A mobile-friendly, sportsbook-inspired Last Man Standing dashboard for a private Premier League competition. It shows player status and picks, gameweek fixtures, the next deadline, five-fixture difficulty rankings, the £360 prize draw, and the game rules.

The top navigation uses hash routes (`#overview`, `#picks`, `#fixtures`, `#difficulty`, `#rules`, `#prize`, and `#pick-for-me`) so each area behaves like a separate page while remaining compatible with static GitHub Pages hosting and browser back/forward navigation.

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
  "icon": "🎅🏻",
  "charity": {
    "name": "War Child",
    "url": "https://www.warchild.org.uk/"
  },
  "picks": [
    { "gameweek": 1, "teamId": 1, "result": "win" },
    { "gameweek": 2, "teamId": 14, "result": "pending" }
  ]
}
```

- `icon` is the player's emoji shown in the table and profile.
- `charity` is shown when somebody clicks the player's name. Use `null` to display “Pocketing the money”.
- `teamId` is the FPL team ID found in `data/fpl.json` under `bootstrap.teams`.
- `result` can be `pending`, `win`, `loss`, or `no-pick`.
- A `loss` or `no-pick` automatically displays that player as out. You can also set `status` to `out` manually.
- Commit and push the JSON change to publish it after the pull request is merged.

### Edit picks and charities on GitHub

1. Open [`data/competition.json`](data/competition.json) on GitHub.
2. Select the pencil icon (**Edit this file**).
3. Add each player's optional `charity` and objects inside their `picks` list.
4. Select **Commit changes**.

The dashboard will show the pick whose `gameweek` matches the current FPL gameweek as the current pick. Competition-specific pick deadlines can be set in the top-level `deadlines` object using an ISO timestamp.

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

The novelty **Pick for me** route builds its wheel from the 20 clubs in the current FPL data. Its result is intentionally fixed to Coventry City.

The rules summary is based on [Football Knockout's Last Man Standing rules](https://football-knockout.co.uk/rules).
