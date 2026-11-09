# Beat Georges — BetGRW Pick'em

Georges Laraque's picks on top, fans' picks and usernames in the middle, a live leaderboard at the bottom. Games and results come from the NHL automatically.

## What it does on its own
- Loads tonight's NHL games (it rolls over to the next slate at 6 AM Eastern).
- Shows which games are in progress and marks the winner of each game as soon as it ends. No scores are shown, only winners.
- Locks every entry at the first puck drop, on the server, so nobody can sneak picks in late.
- Grades picks as soon as each game goes final, including OT and shootouts.
- Ignores postponed or cancelled games.

## What you do each night
1. Go to `yoursite.com/admin` and sign in with your admin password.
2. Tap Georges' winner in each game and press **Save Georges' picks**. His picks appear on the site right away.
3. That's it. Use the Players list to remove an entry with an offensive username.

## Run it
Needs Node 18 or newer. No packages to install.

```
ADMIN_PASSWORD=choose-a-strong-one npm start
```
The site runs on port 3000 (set `PORT` to change it).

To preview with sample games and no internet:
```
npm run demo          # before puck drop
npm run demo -- live  # games in progress
```
The demo admin password is `demo`.

## Hosting
Any Node host works (Render, Railway, Fly.io, a VPS). Settings:
- `ADMIN_PASSWORD` — required for the admin page.
- `DATA_DIR` — where entries are saved. On Render/Railway, point this at a **persistent disk**, otherwise entries are wiped on every redeploy.
- `PORT` — usually set by the host.

Entries are saved as one small JSON file per night in `DATA_DIR`, which is plenty for thousands of players. If you outgrow it, the storage functions (`loadContest`, `writeJSON`) are the only part to swap for a database.

## Good to know
- Players are remembered on their device. They can change their picks from the same phone or browser until puck drop. One username per player per night.
- Game results come from the NHL's public web API (`api-web.nhle.com`). It's free and unofficial, so check your use with the NHL before launching a contest with prizes.
- No NHL or team logos are used, only team colors and abbreviations.
- Prize terms, age checks and account verification aren't part of this; connect them to your BetGRW accounts before running a real contest.

## Files
- `server.js` — the server: games and winners, entries, grading, admin.
- `public/index.html`, `styles.css`, `app.js` — the site.
- `public/admin.html`, `admin.css`, `admin.js` — the admin page.
- `public/teams.js` — team colors and names.
- `scripts/demo.js` — sample games for previewing.
