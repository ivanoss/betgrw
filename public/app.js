(function () {
  'use strict';

  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } }
  };

  let data = null;          // last /api/state response
  let draft = {};           // gameId -> abbr
  let draftDate = null;
  let saving = false;
  let pollTimer = null;
  const prevBoard = {};

  const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
  const fmtTime = iso => timeFmt.format(new Date(iso));

  /* ---------- Data ---------- */
  async function load() {
    try {
      const res = await fetch('/api/state', { headers: { 'x-entry-token': store.get('bg_token') || '' }, cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not load the games.');
      data = json;
      syncDraft();
      render();
    } catch (err) {
      if (!data) $('#sb-strip').textContent = 'Tonight’s games couldn’t load. Retrying shortly.';
    } finally {
      schedule();
    }
  }
  function schedule() {
    clearTimeout(pollTimer);
    const live = data && data.games.some(g => g.state === 'live');
    pollTimer = setTimeout(load, live ? 15000 : 60000);
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
  function saveDraft() { store.set('bg_draft_' + draftDate, JSON.stringify(draft)); }

  /* ---------- Helpers ---------- */
  const playable = () => data.games.filter(g => g.state !== 'void');
  function statusOf(g) {
    if (g.state === 'void') return ['Postponed', ''];
    if (g.state === 'upcoming') return [fmtTime(g.start), 'Puck drop'];
    if (g.state === 'final') {
      return [g.winner ? g.winner + ' wins' : 'Final', g.endedIn === 'OT' ? 'In overtime' : g.endedIn === 'SO' ? 'In a shootout' : 'Final'];
    }
    return ['Live', 'In progress'];
  }
  function jersey(t) {
    const info = window.teamInfo(t);
    return `<span class="jersey" style="--c:${info.color};--t:${info.trim};--i:${window.inkOn(info.color)}" aria-hidden="true">${esc(info.abbr)}</span>`;
  }
  function untilText(ms) {
    const m = Math.max(0, Math.round(ms / 60000));
    if (m < 60) return m + ' min';
    const h = Math.floor(m / 60), r = m % 60;
    return h + ' h' + (r ? ' ' + r + ' min' : '');
  }

  /* ---------- Render ---------- */
  function render() {
    renderBoard();
    renderTickets();
    renderGames();
    renderLeaderboard();
  }

  function setNum(id, value) {
    const el = $(id);
    if (el.textContent !== String(value)) {
      if (prevBoard[id] !== undefined && value !== '--') {
        el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
      }
      el.textContent = value;
      prevBoard[id] = value;
    }
  }

  function renderBoard() {
    const games = playable();
    const live = games.filter(g => g.state === 'live').length;
    const final = games.filter(g => g.state === 'final').length;
    const rows = data.leaderboard.rows;
    const g = rows.find(r => r.expert);
    const fans = rows.filter(r => !r.expert);

    setNum('#sb-georges', g ? g.score : 0);
    setNum('#sb-you', data.me ? data.me.score : '--');
    $('#sb-you-label').textContent = data.me ? data.me.username : 'You';
    if (fans.length) {
      setNum('#sb-lead', fans[0].score);
      $('#sb-lead-label').textContent = fans[0].name;
    } else {
      setNum('#sb-lead', '--');
      $('#sb-lead-label').textContent = 'Top fan';
    }

    let strip;
    if (!games.length) strip = 'No NHL games on the schedule tonight';
    else if (final === games.length) strip = `All ${games.length} games final`;
    else if (!live && !final) strip = `${games.length} games tonight. First puck drop at ${fmtTime(data.lockAt)}`;
    else strip = `${final} of ${games.length} final${live ? `, ${live} in progress` : ''}`;
    $('#sb-strip').textContent = strip;

    const pill = $('#live-pill');
    pill.hidden = !live;
    pill.textContent = live === 1 ? '1 game live' : `${live} games live`;
  }

  function renderTickets() {
    const games = data.games;
    const picks = data.expert;
    const n = games.filter(g => picks[g.id]).length;
    const list = $('#tickets');
    if (!n) {
      list.innerHTML = `<li class="empty">${games.length ? 'Georges hasn’t posted tonight’s picks yet. Check back before the first puck drop.' : 'No games tonight. Georges will be back for the next slate.'}</li>`;
      return;
    }
    list.innerHTML = games.filter(g => picks[g.id]).map(g => {
      const pick = picks[g.id];
      const t = pick === g.away.abbr ? g.away : g.home;
      const info = window.teamInfo(t);
      let cls = '', result;
      const [main, sub] = statusOf(g);
      if (g.state === 'final' && g.winner) { cls = g.winner === pick ? 'hit' : 'miss'; result = g.winner === pick ? 'Called it' : 'Missed'; }
      else if (g.state === 'live') { cls = 'live'; result = 'In progress'; }
      else if (g.state === 'void') result = 'Postponed, doesn’t count';
      else result = main;
      const meta = `${g.away.abbr} at ${g.home.abbr}`;
      return `<li class="ticket ${cls}">${jersey(t)}<div class="ticket-body">
        <span class="ticket-team">${esc(info.name)}</span>
        <span class="ticket-meta">${esc(meta)}</span>
        <span class="result">${esc(result)}</span></div></li>`;
    }).join('');
    $('#georges-sub').textContent = data.leaderboard.graded
      ? `${data.leaderboard.rows.find(r => r.expert)?.score ?? 0} right out of ${data.leaderboard.graded} finished so far.`
      : 'His winner in each game. Results mark themselves as games finish.';
  }

  function sideBtn(g, t, home) {
    const info = window.teamInfo(t);
    const picked = draft[g.id] === t.abbr;
    const georges = data.expert[g.id] === t.abbr;
    const locked = data.locked || g.state === 'void';
    let cls = home ? 'side home' : 'side away';
    if (g.winner === t.abbr) cls += ' won';
    let mark = '';
    if (g.winner && data.me && data.me.picks[g.id] === t.abbr) {
      mark = g.winner === t.abbr ? '<span class="you-mark right">You got it</span>' : '<span class="you-mark wrong">Missed</span>';
    }
    const tags = (g.winner === t.abbr ? '<span class="win-tag">Winner</span>' : '') + (georges ? '<span class="gl-tag">Georges</span>' : '') + mark;
    return `<button type="button" class="${cls}" data-game="${esc(g.id)}" data-team="${esc(t.abbr)}"
      aria-pressed="${picked}" ${locked ? 'disabled' : ''}
      aria-label="${esc(info.city + ' ' + info.name)}${georges ? ', Georges’ pick' : ''}${g.winner === t.abbr ? ', winner' : ''}">
      ${jersey(t)}
      <span class="side-name"><span class="side-city">${esc(info.city)}</span><span class="side-team">${esc(info.name)}</span>${tags ? `<span class="side-tags">${tags}</span>` : ''}</span>
    </button>`;
  }

  function renderGames() {
    const games = data.games;
    const list = $('#games');
    if (!games.length) {
      list.innerHTML = '<li class="empty">No NHL games on the schedule tonight. The next slate will show up here automatically.</li>';
    } else {
      list.innerHTML = games.map(g => {
        const [main, sub] = statusOf(g);
        return `<li class="game is-${g.state}">
          ${sideBtn(g, g.away, false)}
          <div class="mid"><span class="mid-main">${esc(main)}</span><span class="mid-sub">${esc(sub || (g.state === 'upcoming' ? '' : ''))}</span></div>
          ${sideBtn(g, g.home, true)}
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

    const expertSet = games.filter(g => data.expert[g.id]);
    const agree = expertSet.filter(g => draft[g.id] === data.expert[g.id]).length;
    const compared = expertSet.filter(g => draft[g.id]).length;
    $('#agree').textContent = compared ? `Same as Georges on ${agree} of ${compared}` : '';

    const btn = $('#submit');
    const name = $('#username');
    const same = data.me && games.every(g => data.me.picks[g.id] === draft[g.id]) && data.me.username === name.value.trim();
    name.disabled = data.locked;
    btn.classList.toggle('saved', !!same);
    if (data.locked) {
      btn.disabled = true;
      btn.textContent = data.me ? 'Picks locked' : 'Entries closed';
      $('#lockline').textContent = data.me
        ? 'Your picks are locked in. Follow along as the winners come in.'
        : 'Picks locked at the first puck drop. Come back for the next slate.';
    } else {
      btn.disabled = saving || !total || n !== total || same;
      btn.textContent = saving ? 'Saving' : same ? 'Picks saved' : data.me ? 'Update picks' : 'Submit picks';
      $('#lockline').textContent = data.lockAt
        ? `Picks lock at ${fmtTime(data.lockAt)}, in ${untilText(data.lockAt - Date.now())}. Overtime and shootouts count.`
        : 'Pick the winner of every game, overtime and shootouts included.';
    }
  }

  function renderLeaderboard() {
    const { rows, graded } = data.leaderboard;
    const georges = rows.find(r => r.expert);
    $('#board-sub').textContent = graded
      ? `${graded} of ${playable().length} games final. One point per correct pick.`
      : `${data.entries} ${data.entries === 1 ? 'player is' : 'players are'} in. Points start counting when the first game goes final.`;
    const myName = data.me && data.me.username.toLowerCase();
    $('#rows').innerHTML = rows.length ? rows.map(r => {
      const me = !r.expert && r.name.toLowerCase() === myName;
      const beat = !r.expert && georges && graded && r.score > georges.score;
      return `<tr class="${r.expert ? 'is-georges' : ''} ${me ? 'is-me' : ''}">
        <td class="place">${r.rank}</td>
        <td class="player">${esc(r.name)}${me ? '<span class="mark me">You</span>' : ''}${beat ? '<span class="mark beat">Beat Georges</span>' : ''}</td>
        <td class="pts">${r.score}</td></tr>`;
    }).join('') : '<tr><td colspan="3" class="board-empty">No entries yet. Make your picks and be the first name up here.</td></tr>';
  }

  /* ---------- Actions ---------- */
  $('#games').addEventListener('click', e => {
    const b = e.target.closest('button.side');
    if (!b || b.disabled || !data || data.locked) return;
    draft[b.dataset.game] = b.dataset.team;
    saveDraft();
    renderGames();
    const again = document.querySelector(`.side[data-game="${CSS.escape(b.dataset.game)}"][data-team="${CSS.escape(b.dataset.team)}"]`);
    if (again) again.focus();
    setStatus('');
  });
  $('#username').addEventListener('input', () => { if (data) updateEntry(); });

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

  setInterval(() => { if (data && !data.locked) { if (data.lockAt && Date.now() >= data.lockAt) load(); else updateEntry(); } }, 30000);
  load();
})();
