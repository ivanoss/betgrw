// Beat Georges Pick'em — server
// Serves the site, pulls live NHL games, stores entries, grades picks automatically.
// No dependencies. Node 18+.

const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const MOCK_FILE = process.env.MOCK_FILE ? path.resolve(process.env.MOCK_FILE) : null;
const PUBLIC_DIR = path.join(__dirname, 'public');
const NHL_SCORE_URL = date => `https://api-web.nhle.com/v1/score/${date}`;
const NHL_SCHEDULE_URL = date => `https://api-web.nhle.com/v1/schedule/${date}`;
const NHL_STANDINGS_URL = 'https://api-web.nhle.com/v1/standings/now';
const VERSION = (process.env.RENDER_GIT_COMMIT || String(Date.now())).slice(0, 12); // changes on every deploy
// Anti-spam: how many entries one internet connection can make per Saturday (a family can share one connection)
const MAX_PER_NETWORK = Math.max(1, Number(process.env.MAX_ENTRIES_PER_NETWORK) || 3);
const NET_SALT = process.env.ENTRY_SALT || 'bg:' + (process.env.ADMIN_PASSWORD || 'beat-georges');
const RESERVED = ['georges', 'laraque', 'georgeslaraque', 'tagliani', 'alextagliani', 'admin', 'betgrw', 'moderator'];

/* ---------- Prize pool ----------
   Edit these amounts to change the payouts. Place 1 first. They add up to the pool shown on the site. */
// Weekly: paid every Saturday. Place 1 first.
const PRIZES = [150, 100, 70, 50, 40, 30, 22, 16, 12, 10];
const PRIZE_POOL = PRIZES.reduce((a, b) => a + b, 0);
// Season: total correct picks over every Saturday from start to end. Paid once, after the last Saturday.
const SEASON = {
  name: '2026–27 season',
  start: /^\d{4}-\d{2}-\d{2}$/.test(process.env.SEASON_START || '') ? process.env.SEASON_START : '2026-11-14', // first Saturday that counts
  end: /^\d{4}-\d{2}-\d{2}$/.test(process.env.SEASON_END || '') ? process.env.SEASON_END : '2027-04-10',       // last Saturday of the NHL regular season
  prizes: [1500, 900, 600, 400, 300, 250, 200, 125, 125, 125, 55, 55, 55, 55, 55, 40, 40, 40, 40, 40]
};
SEASON.pool = SEASON.prizes.reduce((a, b) => a + b, 0);
SEASON.weeks = (() => { let n = 0; for (let d = new Date(SEASON.start + 'T12:00:00Z'); d <= new Date(SEASON.end + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 7)) n++; return n; })();

/* ---------- Dates ----------
   The contest is Saturday games only.
   Sunday and Monday still show last Saturday's results (so the winner can be checked).
   From Tuesday 6 AM Eastern, the site moves on to the coming Saturday so players can pick all week. */
function etDate(d) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
function saturdayFor(now = Date.now()) {
  const today = etDate(new Date(now - 6 * 3600e3)); // a hockey night runs past midnight
  const d = new Date(today + 'T12:00:00Z');
  const dow = d.getUTCDay(); // 0 Sun ... 6 Sat
  const shift = dow === 0 ? -1 : dow === 1 ? -2 : 6 - dow; // Sun/Mon: last Saturday; Tue-Sat: this Saturday
  d.setUTCDate(d.getUTCDate() + shift);
  return d.toISOString().slice(0, 10);
}
async function contestDate() {
  const s = await getRecord('settings', {});
  if (s.contestDate && /^\d{4}-\d{2}-\d{2}$/.test(s.contestDate)) return s.contestDate;
  return saturdayFor();
}

/* ---------- Storage ----------
   Upstash Redis when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set (free, survives restarts),
   otherwise JSON files in DATA_DIR. Everything is kept in memory too, so pages never wait on the database:
   the database is only touched when the server starts and when something changes. */
const UPSTASH_URL = (process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/$/, '');
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const useUpstash = !!(UPSTASH_URL && UPSTASH_TOKEN);
const KEY_PREFIX = 'beatgeorges:';

async function upstash(cmd) {
  const res = await fetch(UPSTASH_URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + UPSTASH_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
    signal: AbortSignal.timeout(8000)
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error('Upstash: ' + (json.error || res.status));
  return json.result;
}
const backend = useUpstash ? {
  async get(key) { const v = await upstash(['GET', KEY_PREFIX + key]); return v ? JSON.parse(v) : null; },
  async set(key, value) { await upstash(['SET', KEY_PREFIX + key, JSON.stringify(value)]); }
} : {
  async get(key) { try { return JSON.parse(await fsp.readFile(path.join(DATA_DIR, key + '.json'), 'utf8')); } catch { return null; } },
  async set(key, value) {
    const file = path.join(DATA_DIR, key + '.json'), tmp = file + '.' + process.pid + '.tmp';
    await fsp.writeFile(tmp, JSON.stringify(value, null, 2));
    await fsp.rename(tmp, file);
  }
};
if (!useUpstash) fs.mkdirSync(DATA_DIR, { recursive: true });

const memory = new Map();
async function getRecord(key, fallback) {
  if (!memory.has(key)) memory.set(key, (await backend.get(key)) ?? fallback);
  return structuredClone(memory.get(key));
}
let writeChain = Promise.resolve();
function putRecord(key, value) {
  const copy = structuredClone(value);
  const job = writeChain.then(async () => { await backend.set(key, copy); memory.set(key, copy); });
  writeChain = job.catch(() => {});
  return job;
}
async function loadContest(date) {
  const c = await getRecord('contest-' + date, {});
  return { ...c, expert: c.expert || {}, entries: Array.isArray(c.entries) ? c.entries : [], okNets: Array.isArray(c.okNets) ? c.okNets : [] };
}
async function saveContest(date, contest) {
  await putRecord('contest-' + date, contest);
  const dates = await contestDates();
  if (!dates.includes(date)) await putRecord('contest-index', [...dates, date].sort());
}
// Every Saturday that has a contest saved, oldest first.
async function contestDates() {
  const idx = await getRecord('contest-index', null);
  if (Array.isArray(idx)) return idx;
  const found = await discoverContests();
  await putRecord('contest-index', found);
  return found;
}
async function discoverContests() {
  try {
    if (useUpstash) {
      const keys = await upstash(['KEYS', KEY_PREFIX + 'contest-????-??-??']);
      return (keys || []).map(k => k.slice(-10)).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
    }
    return (await fsp.readdir(DATA_DIR)).map(f => (f.match(/^contest-(\d{4}-\d{2}-\d{2})\.json$/) || [])[1]).filter(Boolean).sort();
  } catch { return []; }
}
const isDate = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d + 'T12:00:00Z'));
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

/* ---------- Team logos ----------
   Official logo files, as listed by the NHL's own feed. Only NHL-hosted addresses are passed on.
   The light version is for white backgrounds, the dark version for the navy bars. */
const LOGO_OK = /^https:\/\/assets\.nhle\.com\/[\w\/.-]+\.svg$/;
function logos(light, dark) {
  const l = typeof light === 'string' && LOGO_OK.test(light) ? light : null;
  let d = typeof dark === 'string' && LOGO_OK.test(dark) ? dark : null;
  if (!d && l && l.endsWith('_light.svg')) d = l.replace(/_light\.svg$/, '_dark.svg');
  return l ? { logo: l, logoDark: d || l } : {};
}

/* ---------- Live NHL games ---------- */
const cache = new Map(); // date -> { at, games, ttl }
function normalizeGame(g) {
  const team = t => ({
    abbr: t.abbrev,
    place: t.placeName?.default || '',
    name: t.commonName?.default || t.name?.default || t.abbrev,
    score: typeof t.score === 'number' ? t.score : null,
    ...logos(t.logo, t.darkLogo)
  });
  const sched = g.gameScheduleState || 'OK';
  let state = 'upcoming';
  if (sched === 'PPD' || sched === 'CNCL') state = 'void';
  else if (g.gameState === 'LIVE' || g.gameState === 'CRIT') state = 'live';
  else if (g.gameState === 'FINAL' || g.gameState === 'OFF') state = 'final';
  const away = team(g.awayTeam), home = team(g.homeTeam);
  let winner = null;
  if (state === 'final' && away.score !== null && home.score !== null && away.score !== home.score) {
    winner = away.score > home.score ? away.abbr : home.abbr;
  }
  const pd = g.periodDescriptor || {};
  return {
    id: String(g.id),
    start: g.startTimeUTC,
    state,
    away, home, winner,
    period: pd.number || g.period || null,
    periodType: pd.periodType || null,
    clock: g.clock?.timeRemaining || null,
    intermission: !!g.clock?.inIntermission,
    endedIn: g.gameOutcome?.lastPeriodType || null
  };
}
async function getGames(date) {
  const hit = cache.get(date);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.games;
  try {
    let raw;
    if (MOCK_FILE) raw = JSON.parse(await fsp.readFile(MOCK_FILE, 'utf8'));
    else {
      const get = async url => {
        const res = await fetch(url, { headers: { 'User-Agent': 'BeatGeorgesPickem/1.0' }, signal: AbortSignal.timeout(8000) });
        if (!res.ok) throw new Error('NHL API ' + res.status);
        return res.json();
      };
      raw = await get(NHL_SCORE_URL(date));
      if (!(raw.games || []).length) {
        // Days ahead, the score feed can be empty; the weekly schedule always lists the games.
        const sched = await get(NHL_SCHEDULE_URL(date));
        const day = (sched.gameWeek || []).find(d => d.date === date);
        raw = { games: (day ? day.games : []).map(g => ({ ...g, gameDate: date })) };
      }
    }
    const games = (raw.games || [])
      .filter(g => !g.gameDate || g.gameDate === date)
      .filter(g => !g.gameType || g.gameType === 2 || g.gameType === 3) // regular season + playoffs
      .map(normalizeGame)
      .sort((a, b) => new Date(a.start) - new Date(b.start));
    const anyLive = games.some(g => g.state === 'live');
    cache.set(date, { at: Date.now(), games, ttl: MOCK_FILE ? 1000 : anyLive ? 15000 : 60000 });
    return games;
  } catch (err) {
    console.error('Score fetch failed:', err.message);
    if (hit) return hit.games; // serve last good data
    throw err;
  }
}

/* ---------- NHL standings (sidebar) ---------- */
let standingsCache = null; // { at, teams }
function mockStandings() {
  // Sample standings for the preview (npm run demo); not real data.
  const divs = {
    Atlantic: ['FLA', 'TOR', 'TBL', 'BOS', 'MTL', 'OTT', 'DET', 'BUF'],
    Metropolitan: ['WSH', 'CAR', 'NJD', 'NYR', 'PIT', 'PHI', 'CBJ', 'NYI'],
    Central: ['WPG', 'DAL', 'COL', 'MIN', 'STL', 'UTA', 'NSH', 'CHI'],
    Pacific: ['VGK', 'EDM', 'LAK', 'VAN', 'CGY', 'SEA', 'ANA', 'SJS']
  };
  const teams = [];
  for (const [div, list] of Object.entries(divs)) {
    list.forEach((abbr, i) => {
      const gp = 16 + (i % 3), w = 12 - i, otl = i % 3, l = gp - w - otl;
      teams.push({ abbr, name: abbr, ...logos(`https://assets.nhle.com/logos/nhl/svg/${abbr}_light.svg`), conf: div === 'Atlantic' || div === 'Metropolitan' ? 'Eastern' : 'Western', div, gp, w, l, otl, pts: w * 2 + otl });
    });
  }
  return teams;
}
async function getStandings() {
  if (standingsCache && Date.now() - standingsCache.at < 30 * 60e3) return standingsCache.teams;
  try {
    let teams;
    if (MOCK_FILE) teams = mockStandings();
    else {
      const res = await fetch(NHL_STANDINGS_URL, { headers: { 'User-Agent': 'BeatGeorgesPickem/1.0' }, signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error('NHL API ' + res.status);
      const raw = await res.json();
      teams = (raw.standings || []).map(t => ({
        abbr: t.teamAbbrev?.default || '',
        name: t.teamCommonName?.default || t.teamName?.default || '',
        ...logos(t.teamLogo),
        conf: t.conferenceName || '',
        div: t.divisionName || '',
        gp: t.gamesPlayed ?? 0, w: t.wins ?? 0, l: t.losses ?? 0, otl: t.otLosses ?? 0, pts: t.points ?? 0
      })).filter(t => t.abbr);
    }
    standingsCache = { at: Date.now(), teams };
    return teams;
  } catch (err) {
    console.error('Standings fetch failed:', err.message);
    if (standingsCache) return standingsCache.teams;
    throw err;
  }
}

/* ---------- Contest logic ---------- */
const playable = games => games.filter(g => g.state !== 'void');
function lockTime(games) {
  const starts = playable(games).map(g => new Date(g.start).getTime()).filter(Number.isFinite);
  return starts.length ? Math.min(...starts) : null;
}
const isLocked = games => {
  const t = lockTime(games);
  return t !== null && Date.now() >= t;
};
function scorePicks(picks, games) {
  let correct = 0;
  for (const g of games) if (g.winner && picks[g.id] === g.winner) correct++;
  return correct;
}
// Ranks and prizes count players only (rows must be sorted best first, with .score).
// Tied players share the prizes for the places they cover.
function splitPrizes(rows, prizes) {
  for (let i = 0; i < rows.length;) {
    let j = i;
    while (j < rows.length && rows[j].score === rows[i].score) j++;
    let pot = 0;
    for (let k = i; k < j; k++) pot += prizes[k] || 0;
    const each = pot ? Math.floor(pot / (j - i) * 100) / 100 : 0;
    for (let k = i; k < j; k++) { rows[k].rank = i + 1; rows[k].prize = each; rows[k].tied = j - i > 1; }
    i = j;
  }
  return rows;
}
function leaderboard(contest, games) {
  const graded = games.filter(g => g.winner).length;
  const fans = contest.entries.map(e => ({ name: e.username, score: scorePicks(e.picks, games) }));
  fans.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  splitPrizes(fans, PRIZES);
  const rows = [...fans];
  const expertCount = playable(games).filter(g => contest.expert[g.id]).length;
  if (expertCount) {
    const xs = scorePicks(contest.expert, games);
    const at = rows.findIndex(r => r.score <= xs); // Georges sits above players he ties with
    rows.splice(at === -1 ? rows.length : at, 0, { name: 'Georges Laraque', score: xs, expert: true, rank: null, prize: 0 });
  }
  return { graded, rows, prizes: PRIZES, pool: PRIZE_POOL };
}
const hashToken = t => crypto.createHash('sha256').update(String(t)).digest('hex');
// username (lowercase) -> device key hash. Built from this season's entries the first time it's needed.
async function usernameOwners() {
  let reg = await getRecord('usernames', null);
  if (reg && typeof reg === 'object') return reg;
  reg = {};
  const dates = (await contestDates()).filter(d => d >= SEASON.start && d <= SEASON.end);
  for (const d of dates) { // later Saturdays win: that's the key the player's device holds now
    const c = await loadContest(d);
    for (const e of c.entries) if (e.tokenHash) reg[e.username.toLowerCase()] = e.tokenHash;
  }
  await putRecord('usernames', reg);
  return reg;
}
// Email list for contacting winners and, with consent, sending reminders. Admin-only; never sent to the public site.
async function saveContact(email, username, optIn) {
  const list = await getRecord('contacts', {});
  const now = Date.now();
  const c = list[email] || { email, usernames: [], first: now, optIn: false };
  if (!c.usernames.includes(username)) c.usernames = [...c.usernames, username].slice(-5);
  if (optIn && !c.optIn) c.optInAt = now;            // when consent was given (keep this record)
  if (!optIn && c.optIn) c.optOutAt = now;           // unticked later: stop marketing emails
  c.optIn = optIn; c.last = now;
  list[email] = c;
  await putRecord('contacts', list);
}
async function claimUsername(name, tokenHash) {
  const reg = await usernameOwners();
  if (!reg[name.toLowerCase()]) { reg[name.toLowerCase()] = tokenHash; await putRecord('usernames', reg); }
}
function findByToken(contest, token) {
  if (!token) return null;
  const h = hashToken(token);
  return contest.entries.find(e => e.tokenHash === h) || null;
}

/* ---------- Past results ----------
   Once every game of a Saturday is final, the results are saved with the contest
   so they never change and never need the NHL feed again. */
function publicGame(g) {
  const t = x => ({ abbr: x.abbr, place: x.place, name: x.name, logo: x.logo, logoDark: x.logoDark });
  return { id: g.id, start: g.start, state: g.state, away: t(g.away), home: t(g.home), winner: g.winner, endedIn: g.endedIn };
}
async function resultsFor(date) {
  const contest = await loadContest(date);
  if (contest.final) return contest.final;
  const games = await getGames(date);
  const play = playable(games);
  const complete = play.length > 0 && play.every(g => g.state === 'final' && g.winner);
  const lb = leaderboard(contest, games);
  const snap = {
    date, complete, players: contest.entries.length, graded: lb.graded, pool: lb.pool,
    games: games.map(publicGame), expert: contest.expert,
    rows: lb.rows.map(r => ({ name: r.name, score: r.score, rank: r.rank, prize: r.prize || 0, expert: !!r.expert }))
  };
  if (complete) { contest.final = { ...snap, savedAt: Date.now() }; await saveContest(date, contest); }
  return snap;
}
function summarize(r) {
  const fans = r.rows.filter(x => !x.expert);
  const georges = r.rows.find(x => x.expert);
  const top = fans.length ? fans[0].score : null;
  return {
    date: r.date, complete: r.complete, players: r.players, games: r.games.filter(g => g.state !== 'void').length,
    winners: fans.filter(x => x.rank === 1).map(x => x.name), topScore: top,
    georges: georges ? georges.score : null, beatGeorges: georges ? fans.filter(x => x.score > georges.score).length : 0
  };
}
let resultsListCache = null;
async function handleResultsList(res) {
  if (resultsListCache && Date.now() - resultsListCache.at < 60e3) return send(res, 200, resultsListCache.body);
  const current = await contestDate();
  const past = (await contestDates()).filter(d => d < current).reverse();
  const list = [];
  for (const d of past.slice(0, 52)) {
    try { list.push(summarize(await resultsFor(d))); } catch { list.push({ date: d, unavailable: true }); }
  }
  const body = { current, saturdays: list };
  resultsListCache = { at: Date.now(), body };
  send(res, 200, body);
}
async function handleResultsDay(res, date) {
  if (!isDate(date) || !(await contestDates()).includes(date)) return send(res, 404, { error: 'No contest on that date.' });
  const r = await resultsFor(date);
  send(res, 200, { ...r, summary: summarize(r) });
}

/* ---------- Season standings ----------
   Adds up every Saturday in the season. A Saturday a player skips counts as 0. */
let seasonCache = null;
async function seasonStandings() {
  if (seasonCache && Date.now() - seasonCache.at < 60e3) return seasonCache.body;
  const current = await contestDate();
  const dates = (await contestDates()).filter(d => d >= SEASON.start && d <= SEASON.end && d <= current);
  const players = new Map();
  let georges = 0, weeksDone = 0;
  for (const d of dates) {
    let r;
    try { r = await resultsFor(d); } catch { continue; }
    if (!r.graded) continue; // no game finished yet that day
    weeksDone++;
    for (const row of r.rows) {
      if (row.expert) { georges += row.score; continue; }
      const key = row.name.toLowerCase();
      const p = players.get(key) || { name: row.name, score: 0, weeks: 0, best: 0, wins: 0 };
      p.name = row.name; p.score += row.score; p.weeks++; p.best = Math.max(p.best, row.score);
      if (row.rank === 1 && r.complete) p.wins++;
      players.set(key, p);
    }
  }
  const rows = splitPrizes([...players.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)), SEASON.prizes)
    .map(({ tied, ...r }) => r);
  const finished = current > SEASON.end || (dates.includes(SEASON.end) && (await resultsFor(SEASON.end).catch(() => ({}))).complete);
  const body = {
    name: SEASON.name, start: SEASON.start, end: SEASON.end, weeks: SEASON.weeks, weeksDone,
    pool: SEASON.pool, prizes: SEASON.prizes, finished: !!finished, georges: weeksDone ? georges : null, rows
  };
  seasonCache = { at: Date.now(), body };
  return body;
}

/* ---------- HTTP helpers ---------- */
function send(res, status, body, headers = {}) {
  const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(status, {
    'Content-Type': isObj ? 'application/json; charset=utf-8' : headers['Content-Type'] || 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    ...headers
  });
  res.end(isObj ? JSON.stringify(body) : body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > 20000) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); } catch { reject(new Error('bad json')); } });
    req.on('error', reject);
  });
}
const hits = new Map();
// The visitor's real address. Render sits behind Cloudflare, which sets cf-connecting-ip.
function clientIp(req) {
  const h = req.headers;
  return String(h['cf-connecting-ip'] || h['true-client-ip'] || (h['x-forwarded-for'] || '').split(',')[0] || req.socket.remoteAddress || '').trim();
}
// A short, anonymous ID for the connection (the address itself is never stored).
// Phones on IPv6 get a whole block of addresses, so those are grouped by their first 4 parts.
function networkId(ip) {
  let key = ip.replace(/^::ffff:/i, '');
  if (key.includes(':')) key = key.split(':').slice(0, 4).join(':') + '::/64';
  return crypto.createHash('sha256').update(NET_SALT + '|' + key).digest('hex').slice(0, 10);
}
setInterval(() => { // forget old rate-limit records
  const now = Date.now();
  for (const [k, list] of hits) if (!list.some(t => now - t < 60000)) hits.delete(k);
}, 5 * 60000).unref();
function rateLimited(ip, limit = 20) {
  const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < 60000);
  list.push(now); hits.set(ip, list);
  return list.length > limit;
}
function isAdmin(req) {
  if (!ADMIN_PASSWORD) return false;
  const given = Buffer.from(String(req.headers['x-admin-password'] || ''));
  const real = Buffer.from(ADMIN_PASSWORD);
  return given.length === real.length && crypto.timingSafeEqual(given, real);
}
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

/* ---------- F1: Beat Tagliani, Las Vegas Grand Prix ----------
   Players pick the podium (winner, 2nd, 3rd). Alex Tagliani makes his picks in /admin/f1.
   Results come from the Jolpica F1 feed (Ergast format). The official podium can also be typed in /admin/f1,
   which overrides the feed. While the contest is on, it's the homepage; the NHL site stays at /nhl. */
const F1 = {
  key: 'f1-vegas-2026',
  season: 2026,
  circuit: 'vegas',
  name: 'Las Vegas Grand Prix',
  start: '2026-11-22T04:00:00Z',   // Saturday Nov 21, 8 PM Las Vegas / 11 PM Eastern (the feed's time wins if it differs)
  homeUntil: process.env.F1_HOME_UNTIL || '2026-11-24T11:00:00Z', // Tuesday 6 AM Eastern: the homepage goes back to the NHL
  // Points: right driver in the right spot = 3, right driver on the podium but in another spot = 1. Max 9.
  exact: 3, onPodium: 1,
  prizes: [],      // no cash for this race: 1st place wins an Alex Tagliani merch pack
  merch: 'Alex Tagliani merch pack'
};
F1.pool = F1.prizes.reduce((a, b) => a + b, 0);
const F1_MOCK_FILE = process.env.F1_MOCK_FILE ? path.resolve(process.env.F1_MOCK_FILE) : null;
const F1_API = 'https://api.jolpi.ca/ergast/f1';
// 2026 grid, used if the feed can't be reached. Ordered by the championship before Las Vegas.
const F1_GRID = [
  ['antonelli', 'ANT', 'Andrea Kimi', 'Antonelli', 'Mercedes'], ['max_verstappen', 'VER', 'Max', 'Verstappen', 'Red Bull'],
  ['russell', 'RUS', 'George', 'Russell', 'Mercedes'], ['hamilton', 'HAM', 'Lewis', 'Hamilton', 'Ferrari'],
  ['leclerc', 'LEC', 'Charles', 'Leclerc', 'Ferrari'], ['norris', 'NOR', 'Lando', 'Norris', 'McLaren'],
  ['piastri', 'PIA', 'Oscar', 'Piastri', 'McLaren'], ['hadjar', 'HAD', 'Isack', 'Hadjar', 'Red Bull'],
  ['lawson', 'LAW', 'Liam', 'Lawson', 'Racing Bulls'], ['gasly', 'GAS', 'Pierre', 'Gasly', 'Alpine'],
  ['lindblad', 'LIN', 'Arvid', 'Lindblad', 'Racing Bulls'], ['colapinto', 'COL', 'Franco', 'Colapinto', 'Alpine'],
  ['bearman', 'BEA', 'Oliver', 'Bearman', 'Haas'], ['bortoleto', 'BOR', 'Gabriel', 'Bortoleto', 'Audi'],
  ['hulkenberg', 'HUL', 'Nico', 'Hülkenberg', 'Audi'], ['ocon', 'OCO', 'Esteban', 'Ocon', 'Haas'],
  ['alonso', 'ALO', 'Fernando', 'Alonso', 'Aston Martin'], ['sainz', 'SAI', 'Carlos', 'Sainz', 'Williams'],
  ['albon', 'ALB', 'Alexander', 'Albon', 'Williams'], ['stroll', 'STR', 'Lance', 'Stroll', 'Aston Martin'],
  ['bottas', 'BOT', 'Valtteri', 'Bottas', 'Cadillac'], ['perez', 'PER', 'Sergio', 'Pérez', 'Cadillac']
].map(([id, code, first, last, team]) => ({ id, code, first, last, team }));

let f1Cache = null; // { at, ttl, data }
async function f1Feed() {
  if (f1Cache && Date.now() - f1Cache.at < f1Cache.ttl) return f1Cache.data;
  const prev = f1Cache && f1Cache.data;
  let data = { start: F1.start, drivers: F1_GRID, podium: null, fromFeed: false };
  try {
    if (F1_MOCK_FILE) {
      const m = JSON.parse(await fsp.readFile(F1_MOCK_FILE, 'utf8'));
      data = { start: m.start || F1.start, drivers: F1_GRID, podium: m.podium || null, fromFeed: true };
    } else {
      const get = async u => {
        const r = await fetch(F1_API + u, { headers: { 'User-Agent': 'BeatGeorgesPickem/1.0' }, signal: AbortSignal.timeout(8000) });
        if (!r.ok) throw new Error('F1 API ' + r.status);
        return (await r.json()).MRData;
      };
      const races = (await get(`/${F1.season}.json?limit=40`)).RaceTable.Races || [];
      const race = races.find(r => r.Circuit && r.Circuit.circuitId === F1.circuit);
      if (race) {
        if (race.date && race.time) data.start = new Date(`${race.date}T${race.time}`).toISOString();
        // Drivers: the race entry list once qualifying has run, otherwise the season's drivers
        const toDriver = (d, team) => ({ id: d.driverId, code: d.code || d.familyName.slice(0, 3).toUpperCase(), first: d.givenName, last: d.familyName, team });
        let list = [];
        try {
          const q = (await get(`/${F1.season}/${race.round}/qualifying.json?limit=40`)).RaceTable.Races[0];
          if (q) list = q.QualifyingResults.map(x => toDriver(x.Driver, x.Constructor && x.Constructor.name));
        } catch { /* qualifying not out yet */ }
        const res = (await get(`/${F1.season}/${race.round}/results.json?limit=40`)).RaceTable.Races[0];
        if (res && res.Results && res.Results.length >= 3) {
          const byPos = res.Results.slice().sort((a, b) => Number(a.position) - Number(b.position));
          data.podium = byPos.slice(0, 3).map(x => x.Driver.driverId);
          if (!list.length) list = byPos.map(x => toDriver(x.Driver, x.Constructor && x.Constructor.name));
        }
        if (list.length >= 15) {
          // keep the championship order for drivers we know, then anyone new (a stand-in driver)
          const order = new Map(F1_GRID.map((d, i) => [d.id, i]));
          data.drivers = list.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99))
            .map(d => ({ ...d, team: (F1_GRID.find(g => g.id === d.id) || {}).team || d.team || '' }));
        }
        data.fromFeed = true;
      }
    }
  } catch (err) {
    console.error('F1 fetch failed:', err.message);
    if (prev) data = prev;
  }
  const raceOn = Date.now() > Date.parse(data.start) && !data.podium;
  f1Cache = { at: Date.now(), ttl: F1_MOCK_FILE ? 1000 : raceOn ? 60e3 : 10 * 60e3, data };
  return data;
}
async function loadF1() {
  const c = await getRecord(F1.key, {});
  return { ...c, expert: Array.isArray(c.expert) ? c.expert : [], entries: Array.isArray(c.entries) ? c.entries : [], okNets: Array.isArray(c.okNets) ? c.okNets : [] };
}
const saveF1 = c => putRecord(F1.key, c);
function scorePodium(picks, podium) {
  if (!podium || !Array.isArray(picks)) return 0;
  let s = 0;
  picks.forEach((p, i) => { if (p === podium[i]) s += F1.exact; else if (podium.includes(p)) s += F1.onPodium; });
  return s;
}
// Everything the F1 page needs: race, drivers, Tagliani, leaderboard
async function f1Snapshot(contest) {
  const feed = await f1Feed();
  const podium = Array.isArray(contest.result) && contest.result.length === 3 ? contest.result : feed.podium;
  const lockAt = Date.parse(feed.start);
  const fans = contest.entries.map(e => ({ name: e.username, score: scorePodium(e.picks, podium) }));
  fans.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  if (podium) splitPrizes(fans, F1.prizes); else fans.forEach(f => { f.rank = null; f.prize = 0; });
  const rows = [...fans];
  if (contest.expert.length === 3) {
    const xs = scorePodium(contest.expert, podium);
    const at = podium ? rows.findIndex(r => r.score <= xs) : 0;
    rows.splice(at === -1 ? rows.length : at, 0, { name: 'Alex Tagliani', score: xs, expert: true, rank: null, prize: 0 });
  }
  return { feed, podium, lockAt, locked: Date.now() >= lockAt, final: !!podium, rows };
}
function validPodium(p, drivers) {
  const ids = new Set(drivers.map(d => d.id));
  return Array.isArray(p) && p.length === 3 && p.every(x => typeof x === 'string' && ids.has(x)) && new Set(p).size === 3;
}
async function f1IsHome() {
  const s = await getRecord('settings', {});
  if (s.home === 'f1') return true;
  if (s.home === 'nhl') return false;
  return Date.now() < Date.parse(F1.homeUntil);
}

async function handleF1State(req, res) {
  const contest = await loadF1();
  const snap = await f1Snapshot(contest);
  const me = findByToken(contest, req.headers['x-entry-token']);
  const split = {}; // how many players picked each driver to win
  for (const e of contest.entries) if (e.picks && e.picks[0]) split[e.picks[0]] = (split[e.picks[0]] || 0) + 1;
  send(res, 200, {
    race: { name: F1.name, start: snap.lockAt }, now: Date.now(), lockAt: snap.lockAt, locked: snap.locked, final: snap.final,
    drivers: snap.feed.drivers, podium: snap.podium, points: { exact: F1.exact, onPodium: F1.onPodium },
    expert: contest.expert.length === 3 ? contest.expert : null, intro: contest.intro || '',
    split, entries: contest.entries.length,
    leaderboard: { rows: snap.rows, prizes: F1.prizes, pool: F1.pool, merch: true },
    recent: [...contest.entries].sort((a, b) => (b.updated || 0) - (a.updated || 0)).slice(0, 8)
      .map(e => ({ name: e.username, at: e.updated || e.created, edited: (e.updated || 0) - (e.created || 0) > 1000 })),
    me: me ? { username: me.username, picks: me.picks, email: me.email || '', optIn: !!me.optIn, score: scorePodium(me.picks, snap.podium) } : null
  });
}

async function handleF1Entry(req, res, ip) {
  if (rateLimited(networkId(ip))) return send(res, 429, { error: 'Too many tries. Wait a minute and submit again.' });
  const body = await readBody(req);
  const feed = await f1Feed();
  if (Date.now() >= Date.parse(feed.start)) return send(res, 403, { error: 'Picks locked when the race started.' });
  if (body.website) return send(res, 400, { error: 'Your picks weren’t saved. Try again.' });
  const blocked = await getRecord('blocked', {});
  if (blocked[networkId(ip)]) return send(res, 403, { error: 'Entries from this internet connection aren’t accepted. Contact BetGRW support if you think this is a mistake.' });

  const username = String(body.username || '').trim();
  if (!/^[A-Za-z0-9_.\-]{3,20}$/.test(username)) return send(res, 400, { error: 'Usernames are 3 to 20 letters, numbers, dots, dashes or underscores.' });
  if (RESERVED.includes(username.toLowerCase().replace(/[_.\-]/g, ''))) return send(res, 400, { error: 'That username is reserved. Pick another one.' });
  const email = String(body.email || '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return send(res, 400, { error: 'Enter a valid email address. We use it to contact you if you win.' });
  const optIn = body.optIn === true;
  if (!validPodium(body.picks, feed.drivers)) return send(res, 400, { error: 'Pick three different drivers: 1st, 2nd and 3rd.' });
  const picks = body.picks.slice(0, 3);

  const contest = await loadF1();
  const sent = String(req.headers['x-entry-token'] || '');
  const mine = findByToken(contest, sent);
  if (contest.entries.some(e => e.email === email && e !== mine)) return send(res, 409, { error: 'That email already has an entry for this race. It’s one entry per person.' });
  const taken = contest.entries.find(e => e.username.toLowerCase() === username.toLowerCase());
  if (taken && taken !== mine) return send(res, 409, { error: 'That username is taken for this race. Pick another one.' });
  const owners = await usernameOwners();
  const deviceHash = /^[0-9a-f]{48}$/.test(sent) ? hashToken(sent) : null;
  const owner = owners[username.toLowerCase()];
  const ownHash = mine ? mine.tokenHash : deviceHash;
  if (owner && owner !== ownHash) return send(res, 409, { error: 'That username is already used by another player this season. If it’s yours, enter from the device you used before, or contact BetGRW support.' });
  const net = networkId(ip);
  if (!mine && contest.entries.filter(e => e.net === net).length >= MAX_PER_NETWORK) {
    return send(res, 429, { error: `This internet connection already has ${MAX_PER_NETWORK} ${MAX_PER_NETWORK === 1 ? 'entry' : 'entries'} for this race. It’s one entry per person. To change your picks, use the device you entered with.` });
  }
  let token = null, tokenHash;
  if (mine) { Object.assign(mine, { username, picks, email, optIn, updated: Date.now() }); if (!mine.net) mine.net = net; tokenHash = mine.tokenHash; }
  else {
    if (deviceHash) tokenHash = deviceHash;
    else { token = crypto.randomBytes(24).toString('hex'); tokenHash = hashToken(token); }
    contest.entries.push({ username, picks, email, optIn, tokenHash, net, created: Date.now(), updated: Date.now() });
  }
  await saveF1(contest);
  if (!owner) await claimUsername(username, tokenHash);
  await saveContact(email, username, optIn);
  send(res, 200, { ok: true, username, token, updated: !!mine });
}

async function handleF1Admin(req, res, route) {
  if (route === 'f1/state' && req.method === 'GET') {
    const contest = await loadF1();
    const snap = await f1Snapshot(contest);
    const settings = await getRecord('settings', {});
    const byName = new Map(snap.rows.filter(r => !r.expert).map(r => [r.name, r]));
    return send(res, 200, {
      race: F1.name, lockAt: snap.lockAt, locked: snap.locked, drivers: snap.feed.drivers, fromFeed: snap.feed.fromFeed,
      feedPodium: snap.feed.podium, result: contest.result || null, podium: snap.podium,
      expert: contest.expert, intro: contest.intro || '', home: settings.home || 'auto', homeUntil: F1.homeUntil, homeNow: await f1IsHome(),
      prizes: F1.prizes, maxPerNetwork: MAX_PER_NETWORK, okNets: contest.okNets,
      entries: contest.entries.map(e => ({
        username: e.username, email: e.email || '', optIn: !!e.optIn, created: e.created, updated: e.updated, picks: e.picks, net: e.net || '',
        score: scorePodium(e.picks, snap.podium), rank: byName.get(e.username)?.rank, prize: byName.get(e.username)?.prize || 0
      }))
    });
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  const body = await readBody(req);
  const feed = await f1Feed();
  const contest = await loadF1();
  if (route === 'f1/picks') {
    if (body.picks && body.picks.length && !validPodium(body.picks, feed.drivers)) return send(res, 400, { error: 'Pick three different drivers.' });
    contest.expert = body.picks && body.picks.length ? body.picks.slice(0, 3) : [];
    contest.intro = String(body.intro || '').replace(/\s+/g, ' ').trim().slice(0, 400);
    await saveF1(contest);
    return send(res, 200, { ok: true });
  }
  if (route === 'f1/result') { // official podium typed in by hand; empty = use the feed
    if (body.result && body.result.length && !validPodium(body.result, feed.drivers)) return send(res, 400, { error: 'Pick three different drivers.' });
    contest.result = body.result && body.result.length ? body.result.slice(0, 3) : null;
    await saveF1(contest);
    return send(res, 200, { ok: true });
  }
  if (route === 'f1/remove-many') {
    const names = new Set((Array.isArray(body.usernames) ? body.usernames : []).map(n => String(n || '').toLowerCase()));
    const before = contest.entries.length;
    contest.entries = contest.entries.filter(e => !names.has(e.username.toLowerCase()));
    await saveF1(contest);
    return send(res, 200, { ok: true, removed: before - contest.entries.length });
  }
  if (route === 'f1/home') {
    const h = ['auto', 'f1', 'nhl'].includes(body.home) ? body.home : 'auto';
    const s = await getRecord('settings', {});
    await putRecord('settings', { ...s, home: h === 'auto' ? undefined : h });
    return send(res, 200, { ok: true });
  }
  send(res, 404, { error: 'Not found' });
}

/* ---------- Routes ---------- */
async function handleState(req, res) {
  const date = await contestDate();
  const games = await getGames(date);
  const contest = await loadContest(date);
  const locked = isLocked(games);
  const me = findByToken(contest, req.headers['x-entry-token']);
  const ids = new Set(games.map(g => g.id));
  const expert = Object.fromEntries(Object.entries(contest.expert).filter(([id]) => ids.has(id)));
  const split = {}; // how many players picked each team, per game
  for (const e of contest.entries) {
    for (const [id, team] of Object.entries(e.picks || {})) {
      if (!ids.has(id)) continue;
      split[id] = split[id] || {};
      split[id][team] = (split[id][team] || 0) + 1;
    }
  }
  send(res, 200, {
    date, now: Date.now(), lockAt: lockTime(games), locked,
    games, expert, split,
    notes: Object.fromEntries(Object.entries(contest.notes || {}).filter(([id]) => ids.has(id))), intro: contest.intro || '',
    season: { name: SEASON.name, pool: SEASON.prizes.reduce((x, y) => x + y, 0), prizes: SEASON.prizes, start: SEASON.start, end: SEASON.end, weeks: SEASON.weeks },
    recent: [...contest.entries].sort((a, b) => (b.updated || 0) - (a.updated || 0)).slice(0, 8)
      .map(e => ({ name: e.username, at: e.updated || e.created, edited: (e.updated || 0) - (e.created || 0) > 1000 })),
    me: me ? { username: me.username, picks: me.picks, email: me.email || '', optIn: !!me.optIn, score: scorePicks(me.picks, games) } : null,
    leaderboard: leaderboard(contest, games),
    entries: contest.entries.length,
    f1: await f1IsHome()
  });
}

async function handleEntry(req, res, ip) {
  if (rateLimited(networkId(ip))) return send(res, 429, { error: 'Too many tries. Wait a minute and submit again.' });
  const body = await readBody(req);
  const date = await contestDate();
  const games = await getGames(date);
  if (!playable(games).length) return send(res, 400, { error: 'There are no games on Saturday’s slate.' });
  if (isLocked(games)) return send(res, 403, { error: 'Picks locked at the first puck drop.' });

  if (body.website) return send(res, 400, { error: 'Your picks weren’t saved. Try again.' }); // hidden trap field, only bots fill it in
  const blocked = await getRecord('blocked', {});
  if (blocked[networkId(ip)]) return send(res, 403, { error: 'Entries from this internet connection aren’t accepted. Contact BetGRW support if you think this is a mistake.' });

  const username = String(body.username || '').trim();
  if (!/^[A-Za-z0-9_.\-]{3,20}$/.test(username)) return send(res, 400, { error: 'Usernames are 3 to 20 letters, numbers, dots, dashes or underscores.' });
  if (RESERVED.includes(username.toLowerCase().replace(/[_.\-]/g, ''))) return send(res, 400, { error: 'That username is reserved. Pick another one.' });
  const email = String(body.email || '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return send(res, 400, { error: 'Enter a valid email address. We use it to contact you if you win.' });
  const optIn = body.optIn === true; // marketing consent: only when the box was ticked

  const picks = {};
  for (const g of playable(games)) {
    const p = body.picks?.[g.id];
    if (p !== g.away.abbr && p !== g.home.abbr) return send(res, 400, { error: `Pick a winner for ${g.away.abbr} at ${g.home.abbr}.` });
    picks[g.id] = p;
  }

  const contest = await loadContest(date);
  const sent = String(req.headers['x-entry-token'] || '');
  const mine = findByToken(contest, sent);
  if (contest.entries.some(e => e.email === email && e !== mine)) {
    return send(res, 409, { error: 'That email already has an entry this Saturday. It’s one entry per person.' });
  }
  const taken = contest.entries.find(e => e.username.toLowerCase() === username.toLowerCase());
  if (taken && taken !== mine) return send(res, 409, { error: 'That username is taken this Saturday. Pick another one.' });

  // Season points follow the username, so each name belongs to the device that first used it this season.
  const owners = await usernameOwners();
  const deviceHash = /^[0-9a-f]{48}$/.test(sent) ? hashToken(sent) : null;
  const owner = owners[username.toLowerCase()];
  const ownHash = mine ? mine.tokenHash : deviceHash;
  if (owner && owner !== ownHash) {
    return send(res, 409, { error: 'That username is already used by another player this season. If it’s yours, enter from the device you used before, or contact BetGRW support.' });
  }

  const net = networkId(ip);
  if (!mine && contest.entries.filter(e => e.net === net).length >= MAX_PER_NETWORK) {
    return send(res, 429, { error: `This internet connection already has ${MAX_PER_NETWORK} ${MAX_PER_NETWORK === 1 ? 'entry' : 'entries'} this Saturday. It’s one entry per person. To change your picks, use the device you entered with.` });
  }

  let token = null;
  let tokenHash;
  if (mine) { mine.username = username; mine.picks = picks; mine.email = email; mine.optIn = optIn; mine.updated = Date.now(); if (!mine.net) mine.net = net; tokenHash = mine.tokenHash; }
  else {
    // Returning players keep their device key from earlier Saturdays; new players get one.
    if (deviceHash) tokenHash = deviceHash;
    else { token = crypto.randomBytes(24).toString('hex'); tokenHash = hashToken(token); }
    contest.entries.push({ username, picks, email, optIn, tokenHash, net, created: Date.now(), updated: Date.now() });
  }
  await saveContest(date, contest);
  if (!owner) await claimUsername(username, tokenHash);
  await saveContact(email, username, optIn);
  send(res, 200, { ok: true, username, token, updated: !!mine });
}

async function handleAdmin(req, res, route, url) {
  if (!ADMIN_PASSWORD) return send(res, 503, { error: 'Set ADMIN_PASSWORD on the server to turn on the admin page.' });
  if (!isAdmin(req)) return send(res, 401, { error: 'Wrong password.' });
  if (route.startsWith('f1/')) return handleF1Admin(req, res, route);
  const current = await contestDate();
  // Admin can work on any Saturday: the one on the site, past ones, or upcoming ones (to enter Georges' picks early)
  const asked = url.searchParams.get('date');
  const date = asked && isDate(asked) && new Date(asked + 'T12:00:00Z').getUTCDay() === 6 ? asked : current;

  if (route === 'state' && req.method === 'GET') {
    let games = [];
    let gamesError = null;
    try { games = await getGames(date); } catch { gamesError = 'The NHL schedule for this Saturday couldn’t load. Try again in a minute.'; }
    const contest = await loadContest(date);
    const settings = await getRecord('settings', {});
    const blocked = await getRecord('blocked', {});
    const known = await contestDates();
    const upcoming = [current, addDays(current, 7), addDays(current, 14)];
    const saturdays = [...new Set([...upcoming, ...known])].sort().reverse();
    const lb = leaderboard(contest, games).rows.filter(r => !r.expert);
    const byName = new Map(lb.map(r => [r.name, r]));
    return send(res, 200, {
      date, current, saturdays, gamesError,
      override: settings.contestDate || null, locked: isLocked(games), games, expert: contest.expert,
      prizes: PRIZES, pool: PRIZE_POOL, maxPerNetwork: MAX_PER_NETWORK,
      okNets: contest.okNets, blocked, notes: contest.notes || {}, intro: contest.intro || '',
      entries: contest.entries.map(e => ({
        username: e.username, email: e.email || '', optIn: !!e.optIn, created: e.created, updated: e.updated, picks: e.picks, net: e.net || '',
        score: scorePicks(e.picks, games), rank: byName.get(e.username)?.rank, prize: byName.get(e.username)?.prize || 0
      }))
    });
  }
  if (route === 'contacts' && req.method === 'GET') {
    const list = Object.values(await getRecord('contacts', {})).sort((a, b) => (b.last || 0) - (a.last || 0));
    return send(res, 200, { contacts: list });
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  const body = await readBody(req);
  const validNet = n => typeof n === 'string' && /^[0-9a-f]{10}$/.test(n);
  resultsListCache = null;
  seasonCache = null;

  if (route === 'picks') {
    const games = await getGames(date);
    const contest = await loadContest(date);
    const expert = {};
    for (const g of games) {
      const p = body.picks?.[g.id];
      if (p === g.away.abbr || p === g.home.abbr) expert[g.id] = p;
    }
    contest.expert = expert;
    // Georges' take: a short intro for the week and an optional one-line reason per pick
    const clean = (t, max) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, max);
    const notes = {};
    for (const g of games) { const n = clean(body.notes?.[g.id], 160); if (n) notes[g.id] = n; }
    contest.notes = notes;
    contest.intro = clean(body.intro, 400);
    delete contest.final; // recompute saved results with the new picks
    await saveContest(date, contest);
    return send(res, 200, { ok: true, saved: Object.keys(expert).length });
  }
  if (route === 'remove-entry' || route === 'remove-many') {
    const names = new Set((route === 'remove-many' ? (Array.isArray(body.usernames) ? body.usernames : []) : [body.username])
      .map(n => String(n || '').toLowerCase()).filter(Boolean));
    const contest = await loadContest(date);
    const before = contest.entries.length;
    contest.entries = contest.entries.filter(e => !names.has(e.username.toLowerCase()));
    delete contest.final;
    await saveContest(date, contest);
    return send(res, 200, { ok: true, removed: before - contest.entries.length });
  }
  if (route === 'remove-network') {
    if (!validNet(body.net)) return send(res, 400, { error: 'Unknown connection.' });
    const contest = await loadContest(date);
    const before = contest.entries.length;
    contest.entries = contest.entries.filter(e => e.net !== body.net);
    delete contest.final;
    await saveContest(date, contest);
    return send(res, 200, { ok: true, removed: before - contest.entries.length });
  }
  if (route === 'mark-ok') { // e.g. a family sharing Wi-Fi: stop flagging this connection for this Saturday
    if (!validNet(body.net)) return send(res, 400, { error: 'Unknown connection.' });
    const contest = await loadContest(date);
    contest.okNets = body.ok === false ? contest.okNets.filter(n => n !== body.net) : [...new Set([...contest.okNets, body.net])];
    await saveContest(date, contest);
    return send(res, 200, { ok: true });
  }
  if (route === 'block' || route === 'unblock') {
    if (!validNet(body.net)) return send(res, 400, { error: 'Unknown connection.' });
    const blocked = await getRecord('blocked', {});
    let removed = 0;
    if (route === 'block') {
      const contest = await loadContest(date);
      const names = contest.entries.filter(e => e.net === body.net).map(e => e.username);
      blocked[body.net] = { at: Date.now(), names: names.slice(0, 20) };
      if (body.removeEntries) {
        const before = contest.entries.length;
        contest.entries = contest.entries.filter(e => e.net !== body.net);
        removed = before - contest.entries.length;
        delete contest.final;
        await saveContest(date, contest);
      }
    } else delete blocked[body.net];
    await putRecord('blocked', blocked);
    return send(res, 200, { ok: true, removed });
  }
  if (route === 'release-username') { // let a player use their name from a new device
    const reg = await usernameOwners();
    const key = String(body.username || '').toLowerCase();
    if (!reg[key]) return send(res, 404, { error: 'That username isn’t claimed.' });
    delete reg[key];
    await putRecord('usernames', reg);
    return send(res, 200, { ok: true });
  }
  if (route === 'settings') {
    const d = body.contestDate;
    if (d && !isDate(d)) return send(res, 400, { error: 'Use a date like 2026-11-14.' });
    const prev = await getRecord('settings', {});
    await putRecord('settings', { ...prev, contestDate: d || null });
    return send(res, 200, { ok: true });
  }
  send(res, 404, { error: 'Not found' });
}

async function serveStatic(req, res, pathname) {
  if (pathname === '/') pathname = (await f1IsHome()) ? '/f1.html' : '/index.html';
  if (pathname === '/nhl') pathname = '/index.html';
  if (pathname === '/f1') pathname = '/f1.html';
  if (pathname === '/admin/f1') pathname = '/admin-f1.html';
  if (pathname === '/admin') pathname = '/admin.html';
  if (pathname === '/results') pathname = '/results.html';
  const file = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 404, 'Not found');
  try {
    let data = await fsp.readFile(file);
    const ext = path.extname(file);
    if (ext === '.html') data = Buffer.from(data.toString('utf8').replaceAll('__V__', VERSION));
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https://assets.nhle.com; connect-src 'self'; frame-ancestors 'self'"
    });
    res.end(data);
  } catch { send(res, 404, 'Not found'); }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const ip = clientIp(req);
  try {
    if (url.pathname === '/api/state' && req.method === 'GET') return await handleState(req, res);
    if (url.pathname === '/api/entry' && req.method === 'POST') return await handleEntry(req, res, ip);
    if (url.pathname === '/api/f1/state' && req.method === 'GET') return await handleF1State(req, res);
    if (url.pathname === '/api/f1/entry' && req.method === 'POST') return await handleF1Entry(req, res, ip);
    if (url.pathname === '/api/standings' && req.method === 'GET') return send(res, 200, { teams: await getStandings() });
    if (url.pathname === '/api/season' && req.method === 'GET') return send(res, 200, await seasonStandings());
    if (url.pathname === '/api/results' && req.method === 'GET') return await handleResultsList(res);
    if (url.pathname.startsWith('/api/results/') && req.method === 'GET') return await handleResultsDay(res, url.pathname.slice(13));
    if (url.pathname.startsWith('/api/admin/')) return await handleAdmin(req, res, url.pathname.slice(11), url);
    if (url.pathname.startsWith('/api/')) return send(res, 404, { error: 'Not found' });
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
    return await serveStatic(req, res, url.pathname);
  } catch (err) {
    console.error(err);
    send(res, 502, { error: 'Tonight’s games couldn’t load. The page will retry on its own.' });
  }
});
server.listen(PORT, () => console.log(`Beat Georges running on http://localhost:${PORT}${MOCK_FILE ? ' (sample data)' : ''}${useUpstash ? ' — saving to Upstash' : ' — saving to ' + DATA_DIR}${ADMIN_PASSWORD ? '' : ' — admin off: set ADMIN_PASSWORD'}`));
