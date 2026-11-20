(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let pw = sessionStorage.getItem('bg_admin') || '';
  let state = null, find = '';
  const selected = new Set();
  const ord = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  const timeFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short' });
  const money = n => n ? '$' + (Number.isInteger(n) ? String(n) : n.toFixed(2)) : '';

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
  const name = id => { const d = state.drivers.find(x => x.id === id); return d ? `${d.first} ${d.last}` : (id || ''); };

  async function load() {
    try {
      state = await api('f1/state');
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

  function selects(box, values, disabled) {
    const opts = sel => '<option value="">Choose a driver</option>' + state.drivers.map(d =>
      `<option value="${esc(d.id)}" ${d.id === sel ? 'selected' : ''}>${esc(d.first + ' ' + d.last)}${d.team ? ' · ' + esc(d.team) : ''}</option>`).join('');
    $(box).innerHTML = state.drivers.map((_, i) => `<label>${ord(i + 1)}<select data-i="${i}" ${disabled ? 'disabled' : ''}>${opts(values && values[i])}</select></label>`).join('');
  }
  const read = box => [...document.querySelectorAll(box + ' select')].map(s => s.value);
  // Fill the empty spots with the drivers not used yet, in championship order
  const fillRest = box => {
    const sel = [...document.querySelectorAll(box + ' select')];
    const used = new Set(sel.map(s => s.value).filter(Boolean));
    const left = state.drivers.map(d => d.id).filter(id => !used.has(id));
    sel.forEach(s => { if (!s.value) s.value = left.shift() || ''; });
  };
  document.addEventListener('click', e => { const b = e.target.closest('[data-fill]'); if (b) fillRest(b.dataset.fill); });

  function render() {
    $('#home').value = state.home;
    $('#home-tag').textContent = state.homeNow ? 'F1 is on the homepage now' : 'NHL is on the homepage now';
    $('#home-tag').className = 'sat-tag ' + (state.homeNow ? 'next' : 'now');
    $('#home-note').textContent = `Automatic: the F1 page is the homepage until ${timeFmt.format(new Date(state.homeUntil))}, then the NHL site comes back. The NHL site is always at /nhl and the F1 page at /f1.`;

    $('#race-info').textContent = `${state.race}. Lights out ${timeFmt.format(new Date(state.lockAt))}. ` +
      (state.locked ? 'The race has started, so players can’t change their picks. You can still fix Tagliani’s order.' : 'Players can pick until lights out.') +
      (state.fromFeed ? '' : ' The F1 feed isn’t reachable right now, so the built-in 2026 driver list is used.');
    $('#intro').value = state.intro;
    selects('#x-selects', state.expert);

    selects('#r-selects', state.result || state.feedOrder);
    $('#result-info').textContent = state.result
      ? `You entered the order by hand (winner: ${name(state.result[0])}). It overrides the automatic result.`
      : state.feedOrder
        ? `Automatic result from the F1 feed (winner: ${name(state.feedOrder[0])}). Only change it if the feed is wrong, for example after a post-race penalty.`
        : 'The full order fills in automatically from the F1 feed after the race, usually within an hour. If it doesn’t, set the order here and save.';
    renderRows();
  }

  function renderRows() {
    const pod = state.order;
    const nets = {};
    state.entries.forEach(e => { if (e.net) nets[e.net] = (nets[e.net] || 0) + 1; });
    const list = state.entries
      .filter(e => !find || e.username.toLowerCase().includes(find) || e.email.includes(find))
      .sort((a, b) => (b.score - a.score) || a.username.localeCompare(b.username));
    $('#grid-count').textContent = `${state.entries.length} ${state.entries.length === 1 ? 'player' : 'players'}`;
    $('#rows').innerHTML = list.map(e => {
      const cell = (id, i) => {
        let cls = '';
        if (pod) cls = pod[i] === id ? 'hit' : 'miss';
        return `<td class="${cls}">${esc(name(id))}</td>`;
      };
      const shared = e.net && nets[e.net] > 1 && !state.okNets.includes(e.net);
      return `<tr class="${shared ? 'shared' : ''}">
        <td><input type="checkbox" data-name="${esc(e.username)}" ${selected.has(e.username) ? 'checked' : ''} aria-label="Select ${esc(e.username)}"></td>
        <td>${pod && e.rank ? e.rank : ''}</td><td>${esc(e.username)}</td><td>${esc(e.email)}${e.optIn ? ' ✓' : ''}</td>
        ${(e.picks || []).slice(0, 3).map(cell).join('')}
        <td class="num">${pod ? e.score : ''}</td><td class="num">${pod && e.rank === 1 ? 'Merch pack' : ''}</td>
        <td>${e.net ? `<span class="net-id">${esc(e.net)}</span>${shared ? ` ×${nets[e.net]}` : ''}` : ''}</td>
        <td>${e.created ? esc(timeFmt.format(new Date(e.created))) : ''}</td></tr>`;
    }).join('') || '<tr><td colspan="11" class="board-empty">No entries yet.</td></tr>';
    $('#remove-sel').disabled = !selected.size;
    $('#remove-sel').textContent = selected.size ? `Remove selected (${selected.size})` : 'Remove selected';
  }

  $('#login').addEventListener('submit', e => { e.preventDefault(); pw = $('#pw').value; load(); });
  $('#home').addEventListener('change', async () => {
    try { await api('f1/home', { home: $('#home').value }); await load(); } catch (err) { alert(err.message); }
  });
  $('#save-picks').addEventListener('click', async () => {
    const picks = read('#x-selects');
    const filled = picks.filter(Boolean);
    if (filled.length && (filled.length < picks.length || new Set(filled).size < picks.length)) return say('#picks-status', 'Put every driver in once, or leave them all empty.', 'error');
    try { await api('f1/picks', { picks: filled.length ? picks : [], intro: $('#intro').value }); say('#picks-status', 'Saved. It’s on the site now.', 'ok'); await load(); }
    catch (err) { say('#picks-status', err.message, 'error'); }
  });
  $('#save-result').addEventListener('click', async () => {
    const r = read('#r-selects');
    if (r.some(x => !x) || new Set(r).size < r.length) return say('#result-status', 'Put every driver in once.', 'error');
    if (!confirm(`Set the official order (winner: ${name(r[0])})? Points update right away.`)) return;
    try { await api('f1/result', { result: r }); say('#result-status', 'Saved. Points and prizes are updated.', 'ok'); await load(); }
    catch (err) { say('#result-status', err.message, 'error'); }
  });
  $('#clear-result').addEventListener('click', async () => {
    try { await api('f1/result', { result: [] }); say('#result-status', 'Back to the automatic result.', 'ok'); await load(); }
    catch (err) { say('#result-status', err.message, 'error'); }
  });
  $('#find').addEventListener('input', () => { find = $('#find').value.trim().toLowerCase(); renderRows(); });
  $('#rows').addEventListener('change', e => {
    const b = e.target.closest('input[data-name]');
    if (!b) return;
    if (b.checked) selected.add(b.dataset.name); else selected.delete(b.dataset.name);
    renderRows();
  });
  $('#remove-sel').addEventListener('click', async () => {
    if (!selected.size || !confirm(`Remove ${selected.size} ${selected.size === 1 ? 'entry' : 'entries'}? This can’t be undone.`)) return;
    try { const r = await api('f1/remove-many', { usernames: [...selected] }); selected.clear(); say('#rows-status', `Removed ${r.removed}.`, 'ok'); await load(); }
    catch (err) { say('#rows-status', err.message, 'error'); }
  });
  $('#csv').addEventListener('click', () => {
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['Place', 'Username', 'Email', 'Marketing opt-in', 'Predicted order', 'Points', 'Prize', 'Connection', 'Entered'].map(q).join(',')];
    [...state.entries].sort((a, b) => b.score - a.score).forEach(e => lines.push([
      state.order ? e.rank : '', e.username, e.email, e.optIn ? 'yes' : 'no', (e.picks || []).map((id, i) => `${i + 1}. ${name(id)}`).join(' | '),
      state.order ? e.score : '', state.order && e.rank === 1 ? 'Alex Tagliani merch pack' : '', e.net, e.created ? new Date(e.created).toISOString() : ''
    ].map(q).join(',')));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = 'f1-las-vegas-2026.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  if (pw) load(); else { $('#login').hidden = false; }
})();
