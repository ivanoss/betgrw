(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let pw = sessionStorage.getItem('bg_admin') || '';
  let sat = sessionStorage.getItem('bg_admin_sat') || '';   // the Saturday being edited ('' = the one on the site)
  let state = null;
  let picks = {};
  let notes = {};
  let find = '';
  const selected = new Set();

  const LOCALE = 'en-US';
  const satFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const fmtSat = d => satFmt.format(new Date(d + 'T12:00:00Z'));
  const timeFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  const when = ms => ms ? timeFmt.format(new Date(ms)) : '';
  const money = n => n ? '$' + (Number.isInteger(n) ? String(n) : n.toFixed(2)) : '';

  async function api(route, body) {
    const q = sat ? '?date=' + encodeURIComponent(sat) : '';
    const res = await fetch('/api/admin/' + route + q, {
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
      notes = { ...(state.notes || {}) };
      $('#intro').value = state.intro || '';
      selected.clear();
      sessionStorage.setItem('bg_admin', pw);
      $('#login').hidden = true;
      $('#panel').hidden = false;
      render();
    } catch (err) {
      if (err.status === 401) { sessionStorage.removeItem('bg_admin'); pw = ''; }
      $('#login').hidden = false;
      $('#panel').hidden = true;
      say('#login-status', err.message, 'error');
    }
  }

  /* ---------- Saturday picker ---------- */
  function renderSatbar() {
    const cur = state.current;
    $('#sat').innerHTML = state.saturdays.map(d => {
      const tag = d === cur ? ' (on the site now)' : d > cur ? ' (upcoming)' : '';
      return `<option value="${esc(d)}" ${d === state.date ? 'selected' : ''}>${esc(fmtSat(d) + tag)}</option>`;
    }).join('');
    const tag = $('#sat-tag');
    const kind = state.date === cur ? 'now' : state.date > cur ? 'next' : 'past';
    tag.className = 'sat-tag ' + kind;
    tag.textContent = kind === 'now' ? 'On the site now' : kind === 'next' ? 'Upcoming' : 'Past';
    $('#sat-note').textContent = kind === 'now'
      ? 'This is the Saturday players see. The site moves to the next Saturday on its own every Tuesday at 6 AM Eastern.'
      : kind === 'next'
        ? `Players can’t see this one yet. Enter Georges’ picks now and they’ll appear when this Saturday opens.`
        : 'A finished Saturday. Its results are on the Past results page.';
  }
  $('#sat').addEventListener('change', e => {
    sat = e.target.value === state.current ? '' : e.target.value;
    sessionStorage.setItem('bg_admin_sat', sat);
    load();
  });

  /* ---------- Georges' picks ---------- */
  function jersey(t) {
    const i = window.teamInfo(t);
    return `<span class="jersey" style="--c:${i.color};--t:${i.trim};--i:${window.inkOn(i.color)}" aria-hidden="true">${esc(i.abbr)}</span>`;
  }
  function side(g, t, home) {
    const i = window.teamInfo(t);
    return `<button type="button" class="side ${home ? 'home' : 'away'}" data-game="${esc(g.id)}" data-team="${esc(t.abbr)}" aria-pressed="${picks[g.id] === t.abbr}">
      ${jersey(t)}<span class="side-name"><span class="side-city">${esc(i.city)}</span><span class="side-team">${esc(i.name)}</span></span></button>`;
  }
  function renderPicks() {
    const fmt = new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit' });
    const n = state.games.filter(g => picks[g.id]).length;
    $('#slate-info').textContent = state.gamesError
      || `${fmtSat(state.date)}${state.override && state.date === state.current ? ' (set manually)' : ''}. ${state.games.length} games, ${n} picked.${state.locked ? ' Games have started: changes now affect scoring.' : ''}`;
    $('#admin-games').innerHTML = state.games.length ? state.games.map(g => `<li class="game is-${g.state}">
      ${side(g, g.away, false)}
      <div class="mid"><span class="mid-main">${esc(g.state === 'upcoming' ? fmt.format(new Date(g.start)) : g.state === 'final' ? (g.winner ? g.winner + ' wins' : 'Final') : g.state === 'live' ? 'Live' : 'Postponed')}</span></div>
      ${side(g, g.home, true)}
      <input class="why" type="text" maxlength="160" data-note="${esc(g.id)}" value="${esc(notes[g.id] || '')}" placeholder="Why this pick? (optional, one line)" aria-label="Georges’ reason for ${esc(g.away.abbr)} at ${esc(g.home.abbr)}"></li>`).join('') : `<li class="empty">${state.gamesError ? 'Games couldn’t load.' : 'No NHL games on this Saturday yet. The NHL usually posts the schedule well ahead.'}</li>`;
  }

  /* ---------- Flags ---------- */
  function groups() {
    const m = new Map();
    state.entries.forEach(e => { if (e.net) { if (!m.has(e.net)) m.set(e.net, []); m.get(e.net).push(e); } });
    return [...m].filter(([, list]) => list.length > 1);
  }
  const isOk = net => state.okNets.includes(net);
  function renderFlags() {
    const all = groups();
    const open = all.filter(([n]) => !isOk(n));
    const ok = all.filter(([n]) => isOk(n));
    let html = open.length ? '' : '<p class="flag-empty">No flags. Every connection has one entry, or you’ve marked it OK.</p>';
    html += open.map(([net, list]) => `<div class="flag">
      <div class="flag-main"><span class="net-id">${esc(net.slice(0, 4))}</span><b>${list.length} entries</b> from one connection:
        <span class="flag-names">${list.map(e => esc(e.username)).join(', ')}</span></div>
      <div class="flag-actions">
        <button type="button" class="fbtn ok" data-act="ok" data-net="${esc(net)}">Mark OK</button>
        <button type="button" class="fbtn" data-act="remove" data-net="${esc(net)}" data-count="${list.length}">Remove all ${list.length}</button>
        <button type="button" class="fbtn danger" data-act="block" data-net="${esc(net)}" data-count="${list.length}">Remove and block</button>
      </div></div>`).join('');
    if (ok.length) html += `<p class="flag-oklist">Marked OK: ${ok.map(([net, list]) => `<span><span class="net-id">${esc(net.slice(0, 4))}</span> ${list.map(e => esc(e.username)).join(', ')} <button type="button" class="linkbtn" data-act="unok" data-net="${esc(net)}">Undo</button></span>`).join(' · ')}</p>`;
    $('#flags').innerHTML = html;

    const b = Object.entries(state.blocked || {});
    $('#blocked').innerHTML = b.length ? `<ul class="blocked-list">${b.map(([net, info]) => `<li>
      <span class="net-id">${esc(net.slice(0, 4))}</span>
      <span>Blocked ${esc(new Date(info.at).toLocaleDateString(LOCALE, { month: 'short', day: 'numeric' }))}${info.names && info.names.length ? ` · was used by ${info.names.map(esc).join(', ')}` : ''}</span>
      <button type="button" class="linkbtn" data-act="unblock" data-net="${esc(net)}">Unblock</button></li>`).join('')}</ul>`
      : '<p class="flag-empty">No blocked connections.</p>';
  }
  async function flagAction(btn) {
    const act = btn.dataset.act, net = btn.dataset.net, n = Number(btn.dataset.count || 0);
    try {
      if (act === 'ok') { await api('mark-ok', { net }); say('#flags-status', 'Marked OK. This connection won’t be flagged this Saturday.', 'ok'); }
      if (act === 'unok') { await api('mark-ok', { net, ok: false }); say('#flags-status', 'Flag restored.', 'ok'); }
      if (act === 'remove') {
        if (!confirm(`Remove all ${n} entries from this connection? This can’t be undone.`)) return;
        const r = await api('remove-network', { net }); say('#flags-status', `Removed ${r.removed} entries.`, 'ok');
      }
      if (act === 'block') {
        if (!confirm(`Remove all ${n} entries and block this connection from entering again? You can unblock it later.`)) return;
        const r = await api('block', { net, removeEntries: true }); say('#flags-status', `Removed ${r.removed} entries and blocked the connection.`, 'ok');
      }
      if (act === 'unblock') { await api('unblock', { net }); say('#flags-status', 'Unblocked. That connection can enter again.', 'ok'); }
      await load();
    } catch (err) { say('#flags-status', err.message, 'error'); }
  }
  $('#flags').addEventListener('click', e => { const b = e.target.closest('button[data-act]'); if (b) flagAction(b); });
  $('#blocked').addEventListener('click', e => { const b = e.target.closest('button[data-act]'); if (b) flagAction(b); });

  /* ---------- Players' picks grid ---------- */
  function netCell(e) {
    if (!e.net) return '<td class="net">–</td>';
    const n = state.entries.filter(x => x.net === e.net).length;
    if (n < 2) return `<td class="net"><span class="net-id">${esc(e.net.slice(0, 4))}</span></td>`;
    if (isOk(e.net)) return `<td class="net okd"><span class="net-id">${esc(e.net.slice(0, 4))}</span> ${n} entries, marked OK</td>`;
    return `<td class="net shared"><span class="net-id">${esc(e.net.slice(0, 4))}</span> <span class="net-n">${n} entries</span></td>`;
  }
  const sortedEntries = () => [...state.entries].sort((a, b) => b.score - a.score || a.username.localeCompare(b.username));
  function cell(g, pick, georges) {
    if (!pick) return '<td class="pick">–</td>';
    let cls = 'pick';
    if (g.winner) cls += pick === g.winner ? ' right' : ' wrong';
    if (!georges && state.expert[g.id] === pick) cls += ' same';
    return `<td class="${cls}">${esc(pick)}</td>`;
  }
  function renderGrid() {
    const games = state.games;
    const list = sortedEntries();
    const q = find.trim().toLowerCase();
    const shown = q ? list.filter(e => e.username.toLowerCase().includes(q)) : list;
    const allSel = shown.length > 0 && shown.every(e => selected.has(e.username));
    $('#grid-head').innerHTML = `<tr><th class="sel"><input type="checkbox" id="sel-all" aria-label="Select all shown players" ${allSel ? 'checked' : ''}></th><th class="rk">#</th><th class="who">Player</th>${games.map(g =>
      `<th>${esc(g.away.abbr)}<small>at ${esc(g.home.abbr)}</small></th>`).join('')}<th>Pts</th><th>Prize</th><th>Last saved</th><th>Email</th><th>Connection</th><th><span class="sr">Actions</span></th></tr>`;

    const xs = games.reduce((n, g) => n + (g.winner && state.expert[g.id] === g.winner ? 1 : 0), 0);
    const georgesRow = Object.keys(state.expert).length
      ? `<tr class="georges"><td class="sel"></td><td class="rk">–</td><td class="who">Georges Laraque</td>${games.map(g => cell(g, state.expert[g.id], true)).join('')}<td class="pts">${xs}</td><td></td><td></td><td></td><td></td><td></td></tr>`
      : '';
    const rows = shown.map(e => `<tr class="${selected.has(e.username) ? 'is-sel' : ''}">
      <td class="sel"><input type="checkbox" class="pick-sel" data-user="${esc(e.username)}" aria-label="Select ${esc(e.username)}" ${selected.has(e.username) ? 'checked' : ''}></td>
      <td class="rk">${e.rank || ''}</td>
      <td class="who" title="${esc(e.username)}">${esc(e.username)}</td>
      ${games.map(g => cell(g, e.picks && e.picks[g.id], false)).join('')}
      <td class="pts">${e.score}</td>
      <td class="prize">${esc(money(e.prize))}</td>
      <td class="when">${esc(when(e.updated || e.created))}</td>
      <td class="email">${e.email ? `<a href="mailto:${esc(e.email)}">${esc(e.email)}</a>${e.optIn ? ' <span class="optin">opted in</span>' : ''}` : '<span class="muted">–</span>'}</td>
      ${netCell(e)}
      <td><button class="remove" type="button" data-user="${esc(e.username)}">Remove</button></td></tr>`).join('');
    const cols = games.length + 9;
    $('#admin-rows').innerHTML = georgesRow + (rows || `<tr><td colspan="${cols}" class="board-empty">${state.entries.length ? 'No player matches that name.' : 'No entries yet.'}</td></tr>`);

    $('#grid-foot').innerHTML = state.entries.length ? `<tr><td></td><td></td><td class="who">Picked by</td>${games.map(g => {
      const a = state.entries.filter(e => e.picks && e.picks[g.id] === g.away.abbr).length;
      const h = state.entries.filter(e => e.picks && e.picks[g.id] === g.home.abbr).length;
      return `<td>${esc(g.away.abbr)} ${a}<br>${esc(g.home.abbr)} ${h}</td>`;
    }).join('')}<td></td><td></td><td></td><td></td><td></td><td></td></tr>` : '';

    $('#grid-count').textContent = `${state.entries.length} ${state.entries.length === 1 ? 'player' : 'players'}${q ? `, ${shown.length} shown` : ''}`;
    const btn = $('#remove-sel');
    btn.disabled = !selected.size;
    btn.textContent = selected.size ? `Remove selected (${selected.size})` : 'Remove selected';
  }
  $('#find').addEventListener('input', e => { find = e.target.value; if (state) renderGrid(); });
  $('#grid-head').addEventListener('change', e => {
    if (e.target.id !== 'sel-all') return;
    const q = find.trim().toLowerCase();
    state.entries.filter(x => !q || x.username.toLowerCase().includes(q)).forEach(x => e.target.checked ? selected.add(x.username) : selected.delete(x.username));
    renderGrid();
  });
  $('#admin-rows').addEventListener('change', e => {
    const c = e.target.closest('input.pick-sel');
    if (!c) return;
    c.checked ? selected.add(c.dataset.user) : selected.delete(c.dataset.user);
    renderGrid();
  });
  $('#remove-sel').addEventListener('click', async () => {
    const names = [...selected];
    if (!names.length) return;
    if (!confirm(`Remove ${names.length} ${names.length === 1 ? 'entry' : 'entries'}? This can’t be undone.\n\n${names.slice(0, 15).join(', ')}${names.length > 15 ? '…' : ''}`)) return;
    try {
      const r = await api('remove-many', { usernames: names });
      say('#rows-status', `Removed ${r.removed} ${r.removed === 1 ? 'entry' : 'entries'}.`, 'ok');
      await load();
    } catch (err) { say('#rows-status', err.message, 'error'); }
  });
  $('#admin-rows').addEventListener('click', async e => {
    const b = e.target.closest('button.remove');
    if (!b) return;
    if (!confirm(`Remove ${b.dataset.user}’s entry? This can’t be undone.`)) return;
    try {
      await api('remove-entry', { username: b.dataset.user });
      say('#rows-status', `Removed ${b.dataset.user}.`, 'ok');
      await load();
    } catch (err) { say('#rows-status', err.message, 'error'); }
  });

  $('#csv').addEventListener('click', () => {
    if (!state) return;
    const games = state.games;
    const q = v => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [['Place', 'Player', ...games.map(g => `${g.away.abbr} at ${g.home.abbr}`), 'Points', 'Prize', 'Last saved', 'Email', 'Opted in', 'Connection'].map(q).join(',')];
    lines.push(['', 'Georges Laraque', ...games.map(g => state.expert[g.id] || ''), '', '', '', '', '', ''].map(q).join(','));
    lines.push(['', 'Winner', ...games.map(g => g.winner || ''), '', '', '', '', '', ''].map(q).join(','));
    sortedEntries().forEach(e => {
      lines.push([e.rank || '', e.username, ...games.map(g => (e.picks && e.picks[g.id]) || ''), e.score, e.prize ? e.prize.toFixed(2) : '', new Date(e.updated || e.created).toISOString(), e.email || '', e.optIn ? 'yes' : 'no', e.net ? e.net.slice(0, 4) : ''].map(q).join(','));
    });
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `picks-${state.date}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $('#csv-season').addEventListener('click', async () => {
    try {
      const res = await fetch('/api/season', { cache: 'no-store' });
      const d = await res.json();
      const q = v => `"${String(v).replace(/"/g, '""')}"`;
      const lines = [['Place', 'Player', 'Season points', 'Saturdays played', 'Weekly wins', 'Best week', 'Season prize'].map(q).join(',')];
      (d.rows || []).forEach(r => lines.push([r.rank, r.name, r.score, r.weeks, r.wins || 0, r.best, r.prize ? r.prize.toFixed(2) : ''].map(q).join(',')));
      const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `season-${d.start}-to-${d.end}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch { say('#rows-status', 'The season table couldn’t load. Try again.', 'error'); }
  });
  $('#csv-emails').addEventListener('click', async () => {
    try {
      const d = await api('contacts');
      const q = v => `"${String(v).replace(/"/g, '""')}"`;
      const iso = ms => ms ? new Date(ms).toISOString() : '';
      const lines = [['Email', 'Usernames', 'Opted in to marketing', 'Opted in at', 'Opted out at', 'First entry', 'Last entry'].map(q).join(',')];
      d.contacts.forEach(c => lines.push([c.email, (c.usernames || []).join(' '), c.optIn ? 'yes' : 'no', iso(c.optInAt), iso(c.optOutAt), iso(c.first), iso(c.last)].map(q).join(',')));
      const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `emails-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      say('#rows-status', `Downloaded ${d.contacts.length} emails. Only send marketing to the ones marked “yes”.`, 'ok');
    } catch (err) { say('#rows-status', err.message, 'error'); }
  });
  $('#release-form').addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('#release-name').value.trim();
    if (!name) return;
    if (!confirm(`Release ${name}? The next device to enter with this username will own it for the rest of the season.`)) return;
    try {
      await api('release-username', { username: name });
      say('#release-status', `Released ${name}. They can enter with it from their new device now.`, 'ok');
      $('#release-name').value = '';
    } catch (err) { say('#release-status', err.message, 'error'); }
  });

  function render() {
    renderSatbar();
    renderPicks();
    renderFlags();
    renderGrid();
    $('#date').value = state.override || '';
  }

  $('#login').addEventListener('submit', e => { e.preventDefault(); pw = $('#pw').value; load(); });
  $('#admin-games').addEventListener('input', e => {
    const f = e.target.closest('input.why');
    if (!f) return;
    notes[f.dataset.note] = f.value;
    say('#picks-status', 'Not saved yet.');
  });
  $('#intro').addEventListener('input', () => say('#picks-status', 'Not saved yet.'));
  $('#admin-games').addEventListener('click', e => {
    const b = e.target.closest('button.side');
    if (!b) return;
    picks[b.dataset.game] = b.dataset.team;
    renderPicks();
    say('#picks-status', 'Not saved yet.');
  });
  $('#save-picks').addEventListener('click', async () => {
    try {
      const r = await api('picks', { picks, notes, intro: $('#intro').value });
      const live = state.date === state.current ? 'live on the site' : state.date > state.current ? 'saved for when this Saturday opens' : 'saved';
      say('#picks-status', `Saved. ${r.saved} of ${state.games.length} games picked and ${live}.`, 'ok');
      await load();
    } catch (err) { say('#picks-status', err.message, 'error'); }
  });

  $('#date-form').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await api('settings', { contestDate: $('#date').value || null });
      say('#date-status', $('#date').value ? `The site now shows ${$('#date').value}.` : 'Back to automatic.', 'ok');
      sat = ''; sessionStorage.removeItem('bg_admin_sat');
      await load();
    } catch (err) { say('#date-status', err.message, 'error'); }
  });
  $('#date-auto').addEventListener('click', async () => {
    try {
      await api('settings', { contestDate: null });
      say('#date-status', 'Back to automatic. The site follows Saturday games.', 'ok');
      sat = ''; sessionStorage.removeItem('bg_admin_sat');
      await load();
    } catch (err) { say('#date-status', err.message, 'error'); }
  });

  if (pw) load();
})();
