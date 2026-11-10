(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let pw = sessionStorage.getItem('bg_admin') || '';
  let state = null;
  let picks = {};

  async function api(route, body) {
    const res = await fetch('/api/admin/' + route, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': pw },
      body: body ? JSON.stringify(body) : undefined
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(json.error || 'Something went wrong.'); e.status = res.status; throw e; }
    return json;
  }
  const say = (id, msg, kind) => { const s = $(id); s.textContent = msg; s.className = 'status' + (kind ? ' ' + kind : ''); };

  async function load() {
    try {
      state = await api('state');
      picks = { ...state.expert };
      sessionStorage.setItem('bg_admin', pw);
      $('#login').hidden = true;
      $('#panel').hidden = false;
      render();
    } catch (err) {
      sessionStorage.removeItem('bg_admin');
      $('#login').hidden = false;
      $('#panel').hidden = true;
      if (pw) say('#login-status', err.message, 'error');
    }
  }

  function jersey(t) {
    const i = window.teamInfo(t);
    return `<span class="jersey" style="--c:${i.color};--t:${i.trim};--i:${window.inkOn(i.color)}" aria-hidden="true">${esc(i.abbr)}</span>`;
  }
  function side(g, t, home) {
    const i = window.teamInfo(t);
    return `<button type="button" class="side ${home ? 'home' : 'away'}" data-game="${esc(g.id)}" data-team="${esc(t.abbr)}" aria-pressed="${picks[g.id] === t.abbr}">
      ${jersey(t)}<span class="side-name"><span class="side-city">${esc(i.city)}</span><span class="side-team">${esc(i.name)}</span></span></button>`;
  }

  function render() {
    const fmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
    const n = state.games.filter(g => picks[g.id]).length;
    $('#slate-info').textContent = `${state.date}${state.override ? ' (set manually)' : ''}. ${state.games.length} games, ${n} picked.${state.locked ? ' Games have started: changes now affect live scoring.' : ''}`;
    $('#admin-games').innerHTML = state.games.length ? state.games.map(g => `<li class="game is-${g.state}">
      ${side(g, g.away, false)}
      <div class="mid"><span class="mid-main">${esc(g.state === 'upcoming' ? fmt.format(new Date(g.start)) : g.state === 'final' ? (g.winner ? g.winner + ' wins' : 'Final') : g.state === 'live' ? 'Live' : 'Postponed')}</span></div>
      ${side(g, g.home, true)}</li>`).join('') : '<li class="empty">No games on this date.</li>';
    renderGrid();
    $('#date').value = state.override || '';
  }


  /* ---------- Players' picks grid ---------- */
  let find = '';
  const when = ms => ms ? new Date(ms).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : '';
  const money = n => n ? '$' + (Number.isInteger(n) ? String(n) : n.toFixed(2)) : '';
  // Entries that share one internet connection get flagged so you can spot multiple entries
  function netCounts() {
    const m = new Map();
    state.entries.forEach(e => { if (e.net) m.set(e.net, (m.get(e.net) || 0) + 1); });
    return m;
  }
  function netCell(e) {
    if (!e.net) return '<td class="net">–</td>';
    const n = netCounts().get(e.net);
    if (n < 2) return `<td class="net"><span class="net-id">${esc(e.net.slice(0, 4))}</span></td>`;
    return `<td class="net shared"><span class="net-id">${esc(e.net.slice(0, 4))}</span> <span class="net-n">${n} entries</span>
      <button class="remove-net" type="button" data-net="${esc(e.net)}" data-count="${n}">Remove all ${n}</button></td>`;
  }
  function sortedEntries() {
    return [...state.entries].sort((a, b) => b.score - a.score || a.username.localeCompare(b.username));
  }
  function cell(g, pick, georges) {
    if (!pick) return '<td class="pick">–</td>';
    let cls = 'pick';
    if (g.winner) cls += pick === g.winner ? ' right' : ' wrong';
    if (!georges && state.expert[g.id] === pick) cls += ' same';
    return `<td class="${cls}">${esc(pick)}</td>`;
  }
  function renderGrid() {
    const games = state.games;
    $('#grid-head').innerHTML = `<tr><th class="rk">#</th><th class="who">Player</th>${games.map(g =>
      `<th>${esc(g.away.abbr)}<small>at ${esc(g.home.abbr)}</small></th>`).join('')}<th>Pts</th><th>Prize</th><th>Last saved</th><th>Connection</th><th><span class="sr">Actions</span></th></tr>`;

    const list = sortedEntries();
    const q = find.trim().toLowerCase();
    const shown = q ? list.filter(e => e.username.toLowerCase().includes(q)) : list;

    const xs = games.reduce((n, g) => n + (g.winner && state.expert[g.id] === g.winner ? 1 : 0), 0);
    const georgesRow = Object.keys(state.expert).length
      ? `<tr class="georges"><td class="rk">GL</td><td class="who">Georges Laraque</td>${games.map(g => cell(g, state.expert[g.id], true)).join('')}<td class="pts">${xs}</td><td></td><td></td><td></td><td></td></tr>`
      : '';
    const rows = shown.map(e => `<tr>
      <td class="rk">${e.rank}</td>
      <td class="who" title="${esc(e.username)}">${esc(e.username)}</td>
      ${games.map(g => cell(g, e.picks && e.picks[g.id], false)).join('')}
      <td class="pts">${e.score}</td>
      <td class="prize">${esc(money(e.prize))}</td>
      <td class="when">${esc(when(e.updated || e.created))}</td>
      ${netCell(e)}
      <td><button class="remove" type="button" data-user="${esc(e.username)}">Remove</button></td></tr>`).join('');
    const cols = games.length + 7;
    $('#admin-rows').innerHTML = georgesRow + (rows || `<tr><td colspan="${cols}" class="board-empty">${state.entries.length ? 'No player matches that name.' : 'No entries yet.'}</td></tr>`);

    $('#grid-foot').innerHTML = state.entries.length ? `<tr><td></td><td class="who">Picked by</td>${games.map(g => {
      const a = state.entries.filter(e => e.picks && e.picks[g.id] === g.away.abbr).length;
      const h = state.entries.filter(e => e.picks && e.picks[g.id] === g.home.abbr).length;
      return `<td>${esc(g.away.abbr)} ${a}<br>${esc(g.home.abbr)} ${h}</td>`;
    }).join('')}<td></td><td></td><td></td><td></td><td></td></tr>` : '';

    $('#grid-count').textContent = `${state.entries.length} ${state.entries.length === 1 ? 'player' : 'players'}${q ? `, ${shown.length} shown` : ''}`;
  }
  $('#find').addEventListener('input', e => { find = e.target.value; if (state) renderGrid(); });

  $('#csv').addEventListener('click', () => {
    if (!state) return;
    const games = state.games;
    const q = v => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [['Place', 'Player', ...games.map(g => `${g.away.abbr} at ${g.home.abbr}`), 'Points', 'Prize', 'Last saved', 'Connection'].map(q).join(',')];
    lines.push(['', 'Georges Laraque', ...games.map(g => state.expert[g.id] || ''), '', '', ''].map(q).join(','));
    lines.push(['', 'Winner', ...games.map(g => g.winner || ''), '', '', ''].map(q).join(','));
    sortedEntries().forEach(e => {
      lines.push([e.rank || '', e.username, ...games.map(g => (e.picks && e.picks[g.id]) || ''), e.score, e.prize ? e.prize.toFixed(2) : '', new Date(e.updated || e.created).toISOString(), e.net ? e.net.slice(0, 4) : ''].map(q).join(','));
    });
    const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `picks-${state.date}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('#login').addEventListener('submit', e => { e.preventDefault(); pw = $('#pw').value; load(); });

  $('#admin-games').addEventListener('click', e => {
    const b = e.target.closest('button.side');
    if (!b) return;
    picks[b.dataset.game] = b.dataset.team;
    render();
    say('#picks-status', 'Not saved yet.');
  });

  $('#save-picks').addEventListener('click', async () => {
    try {
      const r = await api('picks', { picks });
      say('#picks-status', `Saved. ${r.saved} of ${state.games.length} games picked and live on the site.`, 'ok');
      await load();
    } catch (err) { say('#picks-status', err.message, 'error'); }
  });

  $('#admin-rows').addEventListener('click', async e => {
    const nb = e.target.closest('button.remove-net');
    if (nb) {
      const n = Number(nb.dataset.count);
      if (!confirm(`Remove all ${n} entries from this connection? This can’t be undone.`)) return;
      try {
        const r = await api('remove-network', { net: nb.dataset.net });
        say('#rows-status', `Removed ${r.removed} entries from one connection.`, 'ok');
        await load();
      } catch (err) { say('#rows-status', err.message, 'error'); }
      return;
    }
    const b = e.target.closest('button.remove');
    if (!b) return;
    if (!confirm(`Remove ${b.dataset.user}’s entry? This can’t be undone.`)) return;
    try {
      await api('remove-entry', { username: b.dataset.user });
      say('#rows-status', `Removed ${b.dataset.user}.`, 'ok');
      await load();
    } catch (err) { say('#rows-status', err.message, 'error'); }
  });

  $('#date-form').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await api('settings', { contestDate: $('#date').value || null });
      say('#date-status', $('#date').value ? `Now running the ${$('#date').value} slate.` : 'Back to automatic.', 'ok');
      await load();
    } catch (err) { say('#date-status', err.message, 'error'); }
  });
  $('#date-auto').addEventListener('click', async () => {
    try {
      await api('settings', { contestDate: null });
      say('#date-status', 'Back to automatic. The site follows Saturday games.', 'ok');
      await load();
    } catch (err) { say('#date-status', err.message, 'error'); }
  });

  if (pw) load();
})();
