# Basketball Stats — Newport Select Gold 14U

Season stats, game details, player pages and lineup analysis built from the team's GameChanger data.

## View the site

Open `site/index.html` in a browser (double-click works; no server needed).

Pages:

- **Schedule**: record, margin by game, every game (click through for details)
- **Stats**: season averages and totals plus advanced stats (eFG%, TS%, +/-, on-court net rating). You can filter to any set of games.
- **Team**: the roster; click a player to open their page
- **Player**: season line, points by game, game log, on/off court impact, most-used lineups, every GameChanger insight about them
- **Game**: Recap with game-flow chart and scoring by period; Box Score by period with +/-; Insights; Plays with filters; Lineups showing every stint with the same five
- **Lineups**: 5-man lineups plus 4-, 3- and 2-player groups, with filters for games, minimum possessions and players who must be included; on/off for every player

## Data

```
data/raw/          what was captured from GameChanger (season stats, per-game stats, schedule, games/<id>.json)
data/processed/    normalized tables: games, plays, insights, box_scores, season_stats, players
site/data.js       bundle the site reads (generated)
```

## Refresh after new games

1. Capture the new games from GameChanger (see `scripts/capture/`). Start `recv.py` and run `game_capture.js` on each game's page; it writes `data/raw/games/<id>.json`. Re-capture `schedule.json` and the stats pages the same way.
2. `python scripts/normalize.py`
3. `python -m scripts.build_site`
4. `python -m pytest -q tests`. This checks the lineup logic and that box scores rebuilt from plays match GameChanger's official per-game numbers.

## How lineups are computed

Lineups come from the substitutions in the play-by-play (`scripts/analytics.py`). Sometimes the scorer logs a substitution a few plays late. When the next substitution batch arrives within 4 plays and completes a five-player lineup, it is pulled forward. Plays where the scorebook still shows more or fewer than five players checked in have no lineup. They are left out of lineup, +/- and on/off numbers. Coverage is shown on each game's Box Score and on the Lineups page.

Possessions are estimated as `FGA + 0.44×FTA − OREB + TO`. Ratings are points per 100 possessions. Plays carry no game clock, so there are no minutes. Use plays and possessions as the measure of playing time.

## Hosting (Azure Static Web Apps, Free)

- Live: https://purple-mushroom-0fff6840f.5.azurestaticapps.net
- Subscription `SYSTEMSPHERE-PROD`, resource group `basketball-stats-rg`, app `newport-gold-14u-stats` (East US 2), defined in `infra/main.bicep`.
- `site/staticwebapp.config.json` sends `noindex` headers so search engines skip it. The URL is still public to anyone who has it.

Redeploy after rebuilding `site/data.js` (run from the project root; the deploy fails if run from inside `site/`):

```powershell
$env:SWA_CLI_DEPLOYMENT_TOKEN = az staticwebapp secrets list --subscription SYSTEMSPHERE-PROD -n newport-gold-14u-stats -g basketball-stats-rg --query properties.apiKey -o tsv
npx -y @azure/static-web-apps-cli deploy ./site --env production
```
