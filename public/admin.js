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
    $('#admin-rows').innerHTML = state.entries.length ? state.entries.map(e => `<tr>
      <td class="player">${esc(e.username)}</td>
      <td>${new Date(e.created).toLocaleString()}</td>
      <td class="pts">${e.score}</td>
      <td class="num"><button class="remove" type="button" data-user="${esc(e.username)}">Remove</button></td></tr>`).join('')
      : '<tr><td colspan="4" class="board-empty">No entries yet.</td></tr>';
    $('#date').value = state.override || '';
  }

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
