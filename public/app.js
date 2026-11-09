(function () {
  'use strict';

  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } }
  };

  let data = null;      // last /api/state response
  let draft = {};       // gameId -> team abbr
  let draftDate = null;
  let saving = false;
  let showAll = false;
  let pollTimer = null;

  const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
  const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const fmtTime = iso => timeFmt.format(new Date(iso));

  /* ---------- Data ---------- */
  async function load() {
    try {
      const res = await fetch('/api/state', { headers: { 'x-entry-token': store.get('bg_token') || '' }, cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Tonight’s games couldn’t load.');
      data = json;
      syncDraft();
      render();
    } catch (err) {
      if (!data) $('#sb-strip').textContent = 'Tonight’s games couldn’t load. Retrying shortly.';
    } finally {
      clearTimeout(pollTimer);
      const live = data && data.games.some(g => g.state === 'live');
      pollTimer = setTimeout(load, live ? 15000 : 60000);
    }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });

  function syncDraft() {
    if (draftDate !== data.date) {
      draftDate = data.date;
      try { draft = JSON.parse(store.get('bg_draft_' + data.date)) || {}; } catch { draft = {}; }
      if (!Object.keys(draft).length && data.me) draft = { ...data.me.picks };
      const name = data.me ? data.me.username : store.get('bg_username');
      if (name && !$('#username').value) $('#username').value = name;
    }
    const valid = {};
    for (const g of data.games) if (draft[g.id] === g.away.abbr || draft[g.id] === g.home.abbr) valid[g.id] = draft[g.id];
    draft = valid;
  }
  const saveDraft = () => store.set('bg_draft_' + draftDate, JSON.stringify(draft));

  /* ---------- Helpers ---------- */
  const playable = () => data.games.filter(g => g.state !== 'void');
  const info = t => window.teamInfo(t);
  const dot = t => { const i = info(t); return `<i class="dot" style="--c:${i.color};--t:${i.trim}" aria-hidden="true"></i>`; };
  function statusText(g) {
    if (g.state === 'void') return 'Postponed';
    if (g.state === 'upcoming') return fmtTime(g.start);
    if (g.state === 'live') return 'Live';
    return g.endedIn === 'OT' ? 'Final/OT' : g.endedIn === 'SO' ? 'Final/SO' : 'Final';
  }
  function untilText(ms) {
    const m = Math.max(0, Math.round(ms / 60000));
    if (m < 60) return m + ' min';
    const h = Math.floor(m / 60), r = m % 60;
    return h + ' h' + (r ? ' ' + r + ' min' : '');
  }
  const georgesRow = () => data.leaderboard.rows.find(r => r.expert);

  /* ---------- Render ---------- */
  function render() {
    renderStrip();
    renderDuel();
    renderExpert();
    renderGames();
    renderBoard();
  }

  function renderStrip() {
    const el = $('#strip');
    if (!data.games.length) { el.innerHTML = '<li class="chip"><span class="chip-status">No games tonight</span></li>'; return; }
    el.innerHTML = data.games.map(g => {
      const team = t => {
        const cls = g.winner ? (g.winner === t.abbr ? 'won' : 'lost') : '';
        return `<span class="chip-team ${cls}">${dot(t)}${esc(t.abbr)}</span>`;
      };
      return `<li class="chip is-${g.state}"><span class="chip-status">${esc(statusText(g))}</span>${team(g.away)}${team(g.home)}</li>`;
    }).join('');
    const live = playable().filter(g => g.state === 'live').length;
    const pill = $('#live-pill');
    pill.hidden = !live;
    pill.textContent = live + ' live';
  }

  function bump(id, value) {
    const el = $(id), v = String(value);
    if (el.textContent !== v) {
      if (el.dataset.seen) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
      el.dataset.seen = '1';
      el.textContent = v;
    }
  }

  function renderDuel() {
    $('#date-label').textContent = dayFmt.format(new Date(data.date + 'T12:00:00Z'));
    const games = playable();
    const live = games.filter(g => g.state === 'live').length;
    const final = games.filter(g => g.state === 'final').length;
    const gs = georgesRow() ? georgesRow().score : 0;
    bump('#sb-georges', gs);
    bump('#sb-you', data.me ? data.me.score : '–');
    $('#sb-you-label').textContent = data.me ? data.me.username : 'You';
    $('#you-avatar').textContent = data.me ? data.me.username.slice(0, 2).toUpperCase() : '?';

    let s;
    if (!games.length) s = 'No NHL games tonight. The next slate shows up here automatically.';
    else if (final === games.length) {
      if (!data.me) s = `All ${games.length} games are final. Georges got ${gs} right.`;
      else if (data.me.score > gs) s = 'All games final. You beat Georges tonight.';
      else if (data.me.score < gs) s = 'All games final. Georges wins this one.';
      else s = 'All games final. You tied Georges.';
    } else if (!live && !final) s = `${games.length} games tonight. First puck drop at ${fmtTime(data.lockAt)}.`;
    else s = `${final} of ${games.length} games final${live ? `, ${live} in progress` : ''}.`;
    $('#sb-strip').textContent = s;
    $('#lockline').textContent = !data.locked && data.lockAt ? `Picks lock in ${untilText(data.lockAt - Date.now())}` : '';
  }

  function renderExpert() {
    const games = data.games.filter(g => data.expert[g.id]);
    const list = $('#tickets');
    if (!games.length) {
      list.innerHTML = `<li class="empty">${data.games.length ? 'Georges hasn’t posted tonight’s picks yet. Check back before the first puck drop.' : 'No games tonight. Georges will be back for the next slate.'}</li>`;
      $('#x-record').textContent = '0–0';
      return;
    }
    let w = 0, l = 0;
    list.innerHTML = games.map(g => {
      const pick = data.expert[g.id];
      const t = pick === g.away.abbr ? g.away : g.home;
      let cls = '', res = statusText(g);
      if (g.winner) { if (g.winner === pick) { cls = 'hit'; res = 'Called it'; w++; } else { cls = 'miss'; res = 'Missed'; l++; } }
      else if (g.state === 'live') { cls = 'live'; res = 'Live'; }
      return `<li class="xrow ${cls}">
        <span class="xmatch">${esc(g.away.abbr)} at ${esc(g.home.abbr)}</span>
        <span class="xpick">${dot(t)}${esc(info(t).city)} ${esc(info(t).name)}</span>
        <span class="xres">${esc(res)}</span></li>`;
    }).join('');
    $('#x-record').textContent = `${w}–${l}`;
    $('#georges-sub').textContent = w + l ? `${w} right out of ${w + l} finished so far` : 'His winner in every game tonight';
  }

  function oddBtn(g, t, home) {
    const i = info(t);
    const picked = draft[g.id] === t.abbr;
    const locked = data.locked || g.state === 'void';
    let cls = 'odd';
    if (g.winner && data.me && data.me.picks[g.id] === t.abbr) cls += g.winner === t.abbr ? ' right' : ' wrong';
    return `<button type="button" class="${cls}" data-game="${esc(g.id)}" data-team="${esc(t.abbr)}" aria-pressed="${picked}" ${locked ? 'disabled' : ''}
      aria-label="Pick ${esc(i.city + ' ' + i.name)}"><b>${esc(t.abbr)}</b><small>${home ? 'Home' : 'Away'}</small></button>`;
  }

  function splitLine(g) {
    const sp = data.split && data.split[g.id];
    const saved = data.me && data.me.picks[g.id];
    if (!sp || !(saved || data.locked)) return '';
    const a = sp[g.away.abbr] || 0, h = sp[g.home.abbr] || 0, total = a + h;
    if (!total) return '';
    const pa = Math.round(a / total * 100);
    return `<div class="split" aria-label="${pa}% of players picked ${esc(g.away.abbr)}, ${100 - pa}% picked ${esc(g.home.abbr)}">
      <span>${esc(g.away.abbr)} ${pa}%</span><span class="split-bar"><i style="width:${pa}%"></i></span><span>${100 - pa}% ${esc(g.home.abbr)}</span></div>`;
  }

  function renderGames() {
    const list = $('#games');
    if (!data.games.length) {
      list.innerHTML = '<li class="empty">No NHL games on the schedule tonight. The next slate will show up here automatically.</li>';
    } else {
      list.innerHTML = data.games.map(g => {
        const team = t => {
          const i = info(t);
          const cls = g.winner ? (g.winner === t.abbr ? 'won' : 'lost') : '';
          return `<span class="pteam ${cls}">${dot(t)}<span>${esc(i.city)} ${esc(i.name)}</span></span>`;
        };
        const xp = data.expert[g.id];
        const gl = xp
          ? `<div class="pgl ${g.winner && g.winner !== xp ? 'miss' : ''}"><small>Georges</small><b title="Georges’ pick">${esc(xp)}</b></div>`
          : '<div class="pgl none">–</div>';
        return `<li class="prow is-${g.state}">
          <div class="pmatch"><span class="pstat ${g.state}">${esc(statusText(g))}</span>${team(g.away)}${team(g.home)}</div>
          <div class="pbtns">${oddBtn(g, g.away, false)}${oddBtn(g, g.home, true)}</div>
          ${gl}
          ${splitLine(g)}
        </li>`;
      }).join('');
    }
    updateEntry();
  }

  function updateEntry() {
    const games = playable();
    const n = games.filter(g => draft[g.id]).length;
    const total = games.length;
    $('#progress-text').textContent = `${n} of ${total} picked`;
    $('#progress-fill').style.width = total ? (n / total * 100) + '%' : '0';
    const withX = games.filter(g => data.expert[g.id] && draft[g.id]);
    const agree = withX.filter(g => draft[g.id] === data.expert[g.id]).length;
    $('#agree').textContent = withX.length ? `Same as Georges on ${agree} of ${withX.length}` : '';

    const btn = $('#submit'), name = $('#username');
    const same = data.me && games.every(g => data.me.picks[g.id] === draft[g.id]) && data.me.username === name.value.trim();
    name.disabled = data.locked;
    btn.classList.toggle('saved', !!same);
    if (data.locked) {
      btn.disabled = true;
      btn.textContent = data.me ? 'Picks locked' : 'Entries closed';
      $('#lock-sub').textContent = data.me ? 'Your picks are locked in. Winners mark themselves as games end.' : 'Picks locked at the first puck drop. Come back for the next slate.';
    } else {
      btn.disabled = saving || !total || n !== total || same;
      btn.textContent = saving ? 'Saving' : same ? 'Picks saved' : data.me ? 'Update picks' : 'Submit picks';
      $('#lock-sub').textContent = data.lockAt
        ? `Pick the winner of every game. Picks lock at ${fmtTime(data.lockAt)}.`
        : 'Pick the winner of every game. Overtime and shootouts count.';
    }
  }

  function renderBoard() {
    const { rows, graded } = data.leaderboard;
    const g = georgesRow();
    const total = playable().length;
    const fans = rows.filter(r => !r.expert);
    const beat = g && graded ? fans.filter(r => r.score > g.score).length : 0;
    $('#f-players').textContent = data.entries;
    $('#f-final').textContent = `${graded}/${total}`;
    $('#f-beat').textContent = beat;
    $('#board-sub').textContent = graded ? `${graded} of ${total} games final` : 'Points start when the first game ends';

    const myName = data.me && data.me.username.toLowerCase();
    const isMe = r => !r.expert && r.name.toLowerCase() === myName;
    const TOP = 10;
    let shown = rows;
    let hidden = 0;
    if (!showAll && rows.length > TOP + 2) {
      const keep = new Set(rows.slice(0, TOP));
      rows.forEach(r => { if (r.expert || isMe(r)) keep.add(r); });
      shown = rows.filter(r => keep.has(r));
      hidden = rows.length - shown.length;
    }
    const row = r => `<tr class="${r.expert ? 'is-georges' : ''} ${isMe(r) ? 'is-me' : ''} ${r.rank === 1 && !r.expert ? 'top1' : ''}">
      <td class="place">${r.rank}</td>
      <td class="player">${esc(r.name)}${isMe(r) ? '<span class="mark me">You</span>' : ''}${!r.expert && g && graded && r.score > g.score ? '<span class="mark beat">Beat Georges</span>' : ''}</td>
      <td class="pts">${r.score}</td></tr>`;
    let html = '';
    shown.forEach((r, i) => {
      if (i > 0 && rows.indexOf(r) - rows.indexOf(shown[i - 1]) > 1) html += '<tr class="gap"><td colspan="3">…</td></tr>';
      html += row(r);
    });
    $('#rows').innerHTML = rows.length ? html : '<tr><td colspan="3" class="board-empty">No entries yet. Make your picks and be the first name here.</td></tr>';
    const more = $('#more');
    more.hidden = !hidden && !showAll;
    more.textContent = showAll ? 'Show top 10' : `Show all ${rows.length} players`;
  }

  /* ---------- Actions ---------- */
  $('#games').addEventListener('click', e => {
    const b = e.target.closest('button.odd');
    if (!b || b.disabled || !data || data.locked) return;
    draft[b.dataset.game] = b.dataset.team;
    saveDraft();
    renderGames();
    const again = document.querySelector(`.odd[data-game="${CSS.escape(b.dataset.game)}"][data-team="${CSS.escape(b.dataset.team)}"]`);
    if (again) again.focus();
    setStatus('');
  });
  $('#username').addEventListener('input', () => { if (data) updateEntry(); });
  $('#more').addEventListener('click', () => { showAll = !showAll; renderBoard(); });

  // Mark the menu link that was used
  const links = [...document.querySelectorAll('.nav-links a')];
  links.forEach(a => a.addEventListener('click', () => {
    links.forEach(l => l.classList.toggle('on', l === a));
    if (a.getAttribute('href') === '#rules') $('#rules').open = true;
  }));

  function setStatus(msg, kind) {
    const s = $('#status');
    s.textContent = msg;
    s.className = 'status' + (kind ? ' ' + kind : '');
  }

  $('#submit').addEventListener('click', async () => {
    const username = $('#username').value.trim();
    if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) {
      setStatus('Add a username first: 3 to 16 letters, numbers or underscores.', 'error');
      $('#username').focus();
      return;
    }
    saving = true; updateEntry();
    try {
      const res = await fetch('/api/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-entry-token': store.get('bg_token') || '' },
        body: JSON.stringify({ username, picks: draft })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Your picks weren’t saved. Try again.');
      if (json.token) store.set('bg_token', json.token);
      store.set('bg_username', json.username);
      setStatus(json.updated ? 'Picks updated.' : `You’re in, ${json.username}. Good luck against Georges.`, 'ok');
      saving = false;
      await load();
    } catch (err) {
      saving = false;
      setStatus(err.message, 'error');
      updateEntry();
    }
  });

  setInterval(() => {
    if (!data || data.locked) return;
    if (data.lockAt && Date.now() >= data.lockAt) load();
    else { renderDuel(); updateEntry(); }
  }, 30000);
  load();
})();
