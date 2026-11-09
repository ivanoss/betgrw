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

## Hosting for free (Render + Upstash)
Render's free plan wipes files on every restart, so entries are saved in a free Upstash database instead.

1. **Upstash:** sign up at upstash.com, create a Redis database (free plan), open it and copy the **REST URL** and **REST token**.
2. **Render:** sign up at render.com with GitHub, click **New → Blueprint**, pick this repository. `render.yaml` sets everything up on the free plan.
3. When Render asks, fill in `ADMIN_PASSWORD`, `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
4. Deploy. Your site is at the `onrender.com` address Render shows.

On the free plan the site sleeps after 15 minutes with no visitors; the next visitor waits about a minute while it wakes. Upgrading Render's plan removes that. Page views don't use the database, so Upstash's free limit covers thousands of entries a month.

## Hosting anywhere else
Any Node host works. Settings:
- `ADMIN_PASSWORD` — required for the admin page.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` — save entries in Upstash.
- `DATA_DIR` — without Upstash, entries are saved as JSON files here. Point it at a persistent disk.
- `PORT` — usually set by the host.

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
