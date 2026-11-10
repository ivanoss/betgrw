// Preview the site with sample games: `npm run demo` (before puck drop) or `npm run demo -- live` (games in progress).
// Writes sample games in the NHL API's format, then starts the server against them.
const fs = require('fs');
const path = require('path');

const mode = process.argv[2] || 'pre';
const now = Date.now();
// Same Saturday the server picks (see saturdayFor in server.js)
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now - 6 * 3600e3));
const sat = new Date(today + 'T12:00:00Z'), dow = sat.getUTCDay();
sat.setUTCDate(sat.getUTCDate() + (dow === 0 ? -1 : dow === 1 ? -2 : 6 - dow));
const date = sat.toISOString().slice(0, 10);
const matchups = [
  ['MTL', 'TOR'], ['BOS', 'NYR'], ['OTT', 'DET'], ['FLA', 'TBL'], ['PIT', 'PHI'],
  ['WPG', 'MIN'], ['COL', 'DAL'], ['EDM', 'CGY'], ['VAN', 'SEA']
];
const offsets = [0, 0, 0, 0, 30, 60, 60, 180, 180]; // minutes after first puck drop
const live = mode === 'live';
const satEvening = Date.parse(date + 'T23:00:00Z'); // about 6-7 PM Eastern on Saturday
const first = live ? now - 95 * 60e3 : (satEvening > now ? satEvening : now + 2 * 3600e3);

const games = matchups.map(([a, h], i) => {
  const start = new Date(first + offsets[i] * 60e3);
  const g = {
    id: 2026020900 + i, gameType: 2, gameDate: date, startTimeUTC: start.toISOString(),
    gameState: 'FUT', gameScheduleState: 'OK',
    awayTeam: { abbrev: a, name: { default: a }, logo: `https://assets.nhle.com/logos/nhl/svg/${a}_light.svg` }, homeTeam: { abbrev: h, name: { default: h }, logo: `https://assets.nhle.com/logos/nhl/svg/${h}_light.svg` }
  };
  if (live) {
    if (i < 3) { g.gameState = 'OFF'; g.awayTeam.score = [2, 4, 3][i]; g.homeTeam.score = [3, 1, 2][i]; g.gameOutcome = { lastPeriodType: i === 2 ? 'OT' : 'REG' }; }
    else if (i < 6) { g.gameState = 'LIVE'; g.awayTeam.score = [1, 0, 2][i - 3]; g.homeTeam.score = [1, 2, 2][i - 3]; g.periodDescriptor = { number: [3, 2, 1][i - 3], periodType: 'REG' }; g.clock = { timeRemaining: ['04:12', '11:37', '00:00'][i - 3], inIntermission: i === 5 }; }
  }
  return g;
});

const file = path.join(__dirname, '..', 'sample', 'demo-score.json');
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify({ currentDate: date, games }, null, 2));
process.env.MOCK_FILE = file;
process.env.DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'sample', 'data');
if (!process.env.ADMIN_PASSWORD) process.env.ADMIN_PASSWORD = 'demo';
console.log(`Sample games written (${mode}). Admin password for the demo: ${process.env.ADMIN_PASSWORD}`);
require('../server.js');
