# Beat Georges — BetGRW Pick'em

Georges Laraque's picks on top, fans' picks and usernames in the middle, a live leaderboard at the bottom. Games and results come from the NHL automatically.

## What it does on its own
- Runs on Saturday NHL games only. Last Saturday's results stay up through Monday; on Tuesday at 6 AM Eastern the next Saturday's games open for picks.
- Shows which games are in progress and marks the winner of each game as soon as it ends. No scores are shown, only winners.
- Locks every entry at the first puck drop, on the server, so nobody can sneak picks in late.
- Grades picks as soon as each game goes final, including OT and shootouts.
- Ignores postponed or cancelled games.

## What you do each week
1. Go to `yoursite.com/admin` and sign in with your admin password.
2. Any time from Tuesday until Saturday's first puck drop, tap Georges' winner in each Saturday game and press **Save Georges' picks**. His picks appear on the site right away.
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

## Stopping multiple entries
- Each internet connection can make at most 3 entries per Saturday (enough for a family). Change it with the `MAX_ENTRIES_PER_NETWORK` setting on Render.
- Players can still update their own picks after the cap is reached.
- A hidden form field catches simple bots, and repeated tries are slowed down.
- In `/admin`, entries from the same connection are highlighted in orange with a **Remove all** button. Connections are stored as short anonymous codes, never as addresses.
- The deposit rule is the final check: before paying a prize, confirm the winner's betgrw.com account. Fake usernames won't have deposits.

## Admin page (`/admin`)
- **Saturday picker:** switch between the Saturday on the site, the next two Saturdays, and past ones. Enter Georges' picks for an upcoming Saturday early; they appear when it opens on Tuesday.
- **Flags:** connections with more than one entry. **Mark OK** (a family on one Wi-Fi), **Remove all**, or **Remove and block** (that connection can't enter again until you unblock it).
- **Players' picks:** tick players and use **Remove selected** to remove many at once.

## Past results (`/results`)
- Every finished Saturday with its winners, top score, Georges' score and number of players.
- Click a Saturday for the final standings with prizes, and every game's winner next to Georges' pick.
- Once all of a Saturday's games are final, its results are saved permanently, so they never change, even if the NHL feed does.

## Prizes and season
- **Weekly:** `PRIZES` near the top of `server.js` ($500, top 10). Paid every Saturday.
- **Season:** `SEASON` right below it ($5,000, top 20), with the first and last Saturday that count. Season points are correct picks added up over every Saturday in that range; a missed Saturday counts as 0.
- The banner, leaderboard and rules all follow these tables. One line in the rules section of `public/index.html` also lists the amounts, so update that too.
- Optional Render settings `SEASON_START` and `SEASON_END` (like `2026-11-14`) change the season dates without editing code.
- **Usernames hold for the whole season:** each name belongs to the device that first used it. If a player gets a new phone, release their name in `/admin` under **Release a username**.
- `/admin` has **Download season table (CSV)** for paying season prizes.

## Emails
- Email is required to enter (to contact winners) and is never shown on the public site. One entry per email each Saturday.
- Marketing consent is a separate box, unticked by default. The date a player ticks or unticks it is saved.
- `/admin` → **Download emails (CSV)** lists every email with consent status and dates. Only send reminders and offers to the "yes" rows, and include BetGRW's name, contact details and an unsubscribe link in every email (Canada's anti-spam law, CASL).

## Georges' take
- In `/admin`, above Georges' picks: a short intro for the week, plus an optional one-line reason under each game. They show on his card on the site.
