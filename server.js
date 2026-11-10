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
const RESERVED = ['georges', 'laraque', 'georgeslaraque', 'admin', 'betgrw', 'moderator'];

/* ---------- Prize pool ----------
   Edit these amounts to change the payouts. Place 1 first. They add up to the pool shown on the site. */
const PRIZES = [300, 200, 125, 100, 75, 60, 45, 35, 30, 30];
const PRIZE_POOL = PRIZES.reduce((a, b) => a + b, 0);

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
  return { expert: c.expert || {}, entries: Array.isArray(c.entries) ? c.entries : [] };
}
const saveContest = (date, contest) => putRecord('contest-' + date, contest);

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
function leaderboard(contest, games) {
  const graded = games.filter(g => g.winner).length;
  const fans = contest.entries.map(e => ({ name: e.username, score: scorePicks(e.picks, games) }));
  fans.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  // Ranks and prizes count players only. Tied players share the prizes for the places they cover.
  for (let i = 0; i < fans.length;) {
    let j = i;
    while (j < fans.length && fans[j].score === fans[i].score) j++;
    let pot = 0;
    for (let k = i; k < j; k++) pot += PRIZES[k] || 0;
    const each = pot ? Math.floor(pot / (j - i) * 100) / 100 : 0;
    for (let k = i; k < j; k++) { fans[k].rank = i + 1; fans[k].prize = each; fans[k].tied = j - i > 1; }
    i = j;
  }
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
function findByToken(contest, token) {
  if (!token) return null;
  const h = hashToken(token);
  return contest.entries.find(e => e.tokenHash === h) || null;
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
    recent: [...contest.entries].sort((a, b) => (b.updated || 0) - (a.updated || 0)).slice(0, 8)
      .map(e => ({ name: e.username, at: e.updated || e.created, edited: (e.updated || 0) - (e.created || 0) > 1000 })),
    me: me ? { username: me.username, picks: me.picks, score: scorePicks(me.picks, games) } : null,
    leaderboard: leaderboard(contest, games),
    entries: contest.entries.length
  });
}

async function handleEntry(req, res, ip) {
  if (rateLimited(ip)) return send(res, 429, { error: 'Too many tries. Wait a minute and submit again.' });
  const body = await readBody(req);
  const date = await contestDate();
  const games = await getGames(date);
  if (!playable(games).length) return send(res, 400, { error: 'There are no games on Saturday’s slate.' });
  if (isLocked(games)) return send(res, 403, { error: 'Picks locked at the first puck drop.' });

  const username = String(body.username || '').trim();
  if (!/^[A-Za-z0-9_.\-]{3,20}$/.test(username)) return send(res, 400, { error: 'Usernames are 3 to 20 letters, numbers, dots, dashes or underscores.' });
  if (RESERVED.includes(username.toLowerCase().replace(/[_.\-]/g, ''))) return send(res, 400, { error: 'That username is reserved. Pick another one.' });

  const picks = {};
  for (const g of playable(games)) {
    const p = body.picks?.[g.id];
    if (p !== g.away.abbr && p !== g.home.abbr) return send(res, 400, { error: `Pick a winner for ${g.away.abbr} at ${g.home.abbr}.` });
    picks[g.id] = p;
  }

  const contest = await loadContest(date);
  const mine = findByToken(contest, req.headers['x-entry-token']);
  const taken = contest.entries.find(e => e.username.toLowerCase() === username.toLowerCase());
  if (taken && taken !== mine) return send(res, 409, { error: 'That username is taken tonight. Pick another one.' });

  let token = null;
  if (mine) { mine.username = username; mine.picks = picks; mine.updated = Date.now(); }
  else {
    token = crypto.randomBytes(24).toString('hex');
    contest.entries.push({ username, picks, tokenHash: hashToken(token), created: Date.now(), updated: Date.now() });
  }
  await saveContest(date, contest);
  send(res, 200, { ok: true, username, token, updated: !!mine });
}

async function handleAdmin(req, res, route) {
  if (!ADMIN_PASSWORD) return send(res, 503, { error: 'Set ADMIN_PASSWORD on the server to turn on the admin page.' });
  if (!isAdmin(req)) return send(res, 401, { error: 'Wrong password.' });
  const date = await contestDate();

  if (route === 'state' && req.method === 'GET') {
    const games = await getGames(date);
    const contest = await loadContest(date);
    const settings = await getRecord('settings', {});
    return send(res, 200, {
      date, override: settings.contestDate || null, locked: isLocked(games), games, expert: contest.expert,
      prizes: PRIZES, pool: PRIZE_POOL,
      entries: (() => {
        const lb = leaderboard(contest, games).rows.filter(r => !r.expert);
        const byName = new Map(lb.map(r => [r.name, r]));
        return contest.entries.map(e => ({ username: e.username, created: e.created, updated: e.updated, picks: e.picks, score: scorePicks(e.picks, games), rank: byName.get(e.username)?.rank, prize: byName.get(e.username)?.prize || 0 }));
      })()
    });
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  const body = await readBody(req);

  if (route === 'picks') {
    const games = await getGames(date);
    const contest = await loadContest(date);
    const expert = {};
    for (const g of games) {
      const p = body.picks?.[g.id];
      if (p === g.away.abbr || p === g.home.abbr) expert[g.id] = p;
    }
    contest.expert = expert;
    await saveContest(date, contest);
    return send(res, 200, { ok: true, saved: Object.keys(expert).length });
  }
  if (route === 'remove-entry') {
    const contest = await loadContest(date);
    const before = contest.entries.length;
    contest.entries = contest.entries.filter(e => e.username.toLowerCase() !== String(body.username || '').toLowerCase());
    await saveContest(date, contest);
    return send(res, 200, { ok: true, removed: before - contest.entries.length });
  }
  if (route === 'settings') {
    const d = body.contestDate;
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return send(res, 400, { error: 'Use a date like 2026-11-14.' });
    await putRecord('settings', { contestDate: d || null });
    return send(res, 200, { ok: true });
  }
  send(res, 404, { error: 'Not found' });
}

async function serveStatic(req, res, pathname) {
  if (pathname === '/') pathname = '/index.html';
  if (pathname === '/admin') pathname = '/admin.html';
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
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
  try {
    if (url.pathname === '/api/state' && req.method === 'GET') return await handleState(req, res);
    if (url.pathname === '/api/entry' && req.method === 'POST') return await handleEntry(req, res, ip);
    if (url.pathname === '/api/standings' && req.method === 'GET') return send(res, 200, { teams: await getStandings() });
    if (url.pathname.startsWith('/api/admin/')) return await handleAdmin(req, res, url.pathname.slice(11));
    if (url.pathname.startsWith('/api/')) return send(res, 404, { error: 'Not found' });
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
    return await serveStatic(req, res, url.pathname);
  } catch (err) {
    console.error(err);
    send(res, 502, { error: 'Tonight’s games couldn’t load. The page will retry on its own.' });
  }
});
server.listen(PORT, () => console.log(`Beat Georges running on http://localhost:${PORT}${MOCK_FILE ? ' (sample data)' : ''}${useUpstash ? ' — saving to Upstash' : ' — saving to ' + DATA_DIR}${ADMIN_PASSWORD ? '' : ' — admin off: set ADMIN_PASSWORD'}`));
