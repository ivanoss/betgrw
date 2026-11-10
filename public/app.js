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

  const LOCALE = 'en-US'; // keep dates and times in English to match the page
  const timeFmt = new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit' });
  const dayFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const shortDayFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  const fmtTime = iso => timeFmt.format(new Date(iso));
  const wdFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'long' });
  const fmtDay = ms => {
    const d = new Date(ms), now = new Date();
    if (d.toDateString() === now.toDateString()) return 'today';
    return 'on ' + wdFmt.format(d);
  };

  const GEORGES_PHOTO = 'georges.jpg';

  /* ---------- Data ---------- */
  async function load() {
    try {
      const res = await fetch('/api/state', { headers: { 'x-entry-token': store.get('bg_token') || '' }, cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Saturday’s games couldn’t load.');
      data = json;
      syncDraft();
      render();
    } catch (err) {
      if (!data) $('#sb-strip').textContent = 'Saturday’s games couldn’t load. Retrying shortly.';
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
      const mail = data.me ? data.me.email : store.get('bg_email');
      if (mail && !$('#email').value) $('#email').value = mail;
      $('#optin').checked = data.me ? !!data.me.optIn : store.get('bg_optin') === '1';
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
  // Real team logo from the NHL feed; falls back to the color square if it's missing or fails to load
  const SHOW_LOGOS = window.SHOW_TEAM_LOGOS !== false;
  const logo = (t, onDark) => {
    const src = onDark ? (t.logoDark || t.logo) : t.logo;
    if (!SHOW_LOGOS || !src) return dot(t);
    const i = info(t);
    return `<img class="tlogo" src="${esc(src)}" alt="" width="24" height="24" loading="lazy" decoding="async" data-c="${esc(i.color)}" data-t="${esc(i.trim)}">`;
  };
  const PERSON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4.2" fill="currentColor"/><path d="M3.5 21c.9-4.4 4.3-6.8 8.5-6.8s7.6 2.4 8.5 6.8" fill="currentColor"/></svg>';
  document.addEventListener('error', e => {
    const im = e.target;
    if (!(im instanceof HTMLImageElement) || !im.classList.contains('gphoto')) return;
    const d = document.createElement('span');
    d.className = im.className + ' gphoto-fb';
    d.setAttribute('role', 'img');
    d.setAttribute('aria-label', im.alt || 'Georges Laraque');
    d.innerHTML = PERSON;
    im.replaceWith(d);
  }, true);
  // Photos that already failed before this script ran
  document.querySelectorAll('img.gphoto').forEach(im => {
    if (im.complete && im.naturalWidth === 0) im.dispatchEvent(new Event('error'));
  });
  document.addEventListener('error', e => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.classList.contains('tlogo')) return;
    const d = document.createElement('i');
    d.className = 'dot';
    d.setAttribute('aria-hidden', 'true');
    d.style.setProperty('--c', img.dataset.c);
    d.style.setProperty('--t', img.dataset.t);
    img.replaceWith(d);
  }, true);
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
    if (h < 24) return h + ' h' + (r ? ' ' + r + ' min' : '');
    const d = Math.floor(h / 24), rh = h % 24;
    return d + (d === 1 ? ' day' : ' days') + (rh ? ' ' + rh + ' h' : '');
  }
  const georgesRow = () => data.leaderboard.rows.find(r => r.expert);

  /* ---------- Render ---------- */
  function render() {
    renderStrip();
    renderDuel();
    renderExpert();
    renderGames();
    renderBoard();
    renderFeed();
    renderStandings();
  }

  function renderStrip() {
    const el = $('#strip');
    if (!data.games.length) { el.innerHTML = '<li class="chip"><span class="chip-status">No games this Saturday</span></li>'; return; }
    el.innerHTML = data.games.map(g => {
      const team = t => {
        const cls = g.winner ? (g.winner === t.abbr ? 'won' : 'lost') : '';
        return `<span class="chip-team ${cls}">${logo(t)}${esc(t.abbr)}</span>`;
      };
      return `<li class="chip is-${g.state}"><span class="chip-status">${esc(statusText(g))}</span>${team(g.away)}${team(g.home)}</li>`;
    }).join('');
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
    const day = new Date(data.date + 'T12:00:00Z');
    $('#date-label').textContent = shortDayFmt.format(day);
    $('#day-label').textContent = dayFmt.format(day);
    const games = playable();
    const live = games.filter(g => g.state === 'live').length;
    const final = games.filter(g => g.state === 'final').length;
    const gs = georgesRow() ? georgesRow().score : 0;
    bump('#sb-georges', gs);
    bump('#sb-you', data.me ? data.me.score : '–');
    $('#sb-you-label').textContent = data.me ? data.me.username : 'You';

    let s;
    if (!games.length) s = 'No NHL games this Saturday. The next Saturday shows up here automatically.';
    else if (final === games.length) {
      if (!data.me) s = `All ${games.length} games are final. Georges got ${gs} right.`;
      else if (data.me.score > gs) s = 'All games final. You beat Georges this Saturday.';
      else if (data.me.score < gs) s = 'All games final. Georges wins this one.';
      else s = 'All games final. You tied Georges.';
    } else if (!live && !final) s = `${games.length} games on Saturday. First puck drop at ${fmtTime(data.lockAt)}.`;
    else s = `${final} of ${games.length} games final${live ? `, ${live} in progress` : ''}.`;
    $('#sb-strip').textContent = s;
    $('#f-games').textContent = games.length ? `${games.length} NHL games` : 'No games';
    if (!data.locked && data.lockAt) { $('#lock-label').textContent = 'Picks lock in'; $('#lockline').textContent = untilText(data.lockAt - Date.now()); }
    else { $('#lock-label').textContent = 'Status'; $('#lockline').textContent = !games.length ? '–' : final === games.length ? 'All games final' : live ? `${live} live now` : 'Picks locked'; }
    renderPrize();
    renderHeader(live, final, games.length);
  }

  /* ---------- Prize pool ---------- */
  const money = n => '$' + (Number.isInteger(n) ? n.toLocaleString(LOCALE) : n.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const ordinalPlace = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  function tiles(prizes) {
    const out = [];
    for (let i = 0; i < prizes.length;) {
      let j = i;
      while (j + 1 < prizes.length && prizes[j + 1] === prizes[i]) j++;
      const label = i === j ? ordinalPlace(i + 1) : `${ordinalPlace(i + 1)}–${ordinalPlace(j + 1)}`;
      out.push(`<li><span>${label}</span><b>${money(prizes[i])}</b></li>`);
      i = j + 1;
    }
    return out.join('');
  }
  const shortDate = d => new Intl.DateTimeFormat(LOCALE, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'));
  function renderPrize() {
    const lb = data.leaderboard;
    if (lb.prizes && lb.prizes.length) {
      $('#pool').textContent = money(lb.pool);
      $('#prize-h').textContent = `The top ${lb.prizes.length} split ${money(lb.pool)} every Saturday`;
      $('#payouts').innerHTML = tiles(lb.prizes);
    }
    const se = data.season;
    if (se && se.prizes) {
      $('#s-pool').textContent = money(se.pool);
      $('#s-head').textContent = `The top ${se.prizes.length} of the ${se.name} split ${money(se.pool)}`;
      $('#s-payouts').innerHTML = tiles(se.prizes);
      $('#s-note').textContent = `Season points are your correct picks added up over every Saturday from ${shortDate(se.start)} to ${shortDate(se.end)}. Miss a Saturday and it counts as 0.`;
    }
  }

  /* ---------- Header: status pill and your entry ---------- */
  const CLOCK = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 4.5V8l2.5 1.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  function renderHeader(live, final, total) {
    const pill = $('#hdr-pill');
    pill.className = 'hdr-pill';
    if (live) { pill.classList.add('live'); pill.textContent = `${live} live`; pill.hidden = false; }
    else if (!data.locked && data.lockAt) { pill.innerHTML = `${CLOCK}<span>Picks lock in ${esc(untilText(data.lockAt - Date.now()))}</span>`; pill.hidden = false; }
    else if (total && final === total) { pill.textContent = 'Final results'; pill.hidden = false; }
    else pill.hidden = true;

    const me = $('#hdr-me');
    if (data.me) {
      me.className = 'hdr-me';
      me.href = '#board';
      me.innerHTML = `<span class="ini" aria-hidden="true">${esc(data.me.username.slice(0, 2).toUpperCase())}</span><span class="nm">${esc(data.me.username)}</span><span class="pt" title="Your points">${data.me.score}</span>`;
      me.setAttribute('aria-label', `${data.me.username}, ${data.me.score} points. See the leaderboard`);
    } else {
      me.className = 'hdr-me cta';
      me.href = data.locked ? '#board' : '#picks';
      me.textContent = data.locked ? 'See results' : 'Make your picks';
      me.removeAttribute('aria-label');
    }
  }

  function renderExpert() {
    const games = data.games.filter(g => data.expert[g.id]);
    const list = $('#tickets');
    let w = 0, l = 0;
    if (!games.length) {
      list.innerHTML = `<li class="empty">${data.games.length ? 'Georges hasn’t posted his Saturday picks yet. Check back before the first puck drop.' : 'No games this Saturday. Georges will be back next Saturday.'}</li>`;
    } else {
      list.innerHTML = games.map(g => {
        const pick = data.expert[g.id];
        const t = pick === g.away.abbr ? g.away : g.home;
        let cls = '', res = statusText(g);
        if (g.winner) { if (g.winner === pick) { cls = 'hit'; res = 'Called it'; w++; } else { cls = 'miss'; res = 'Missed'; l++; } }
        else if (g.state === 'live') { cls = 'live'; res = 'Live'; }
        const note = data.notes && data.notes[g.id];
        return `<li class="xrow ${cls} ${note ? 'has-note' : ''}">
          <span class="xmatch">${esc(g.away.abbr)} at ${esc(g.home.abbr)}</span>
          <span class="xpick">${logo(t)}<span>${esc(info(t).city)} ${esc(info(t).name)}</span></span>
          <span class="xres">${esc(res)}</span>
          ${note ? `<span class="xnote">${esc(note)}</span>` : ''}</li>`;
      }).join('');
    }
    list.classList.toggle('with-notes', !!(data.notes && Object.keys(data.notes).length));
    const intro = $('#x-intro');
    intro.hidden = !data.intro;
    intro.textContent = data.intro || '';
    $('#x-record').textContent = `${w}–${l}`;
    $('#x-rate').textContent = w + l ? Math.round(w / (w + l) * 100) + '%' : '–';
    updateAgree();
  }

  function updateAgree() {
    const both = playable().filter(g => data.expert[g.id] && draft[g.id]);
    const agree = both.filter(g => draft[g.id] === data.expert[g.id]).length;
    $('#x-agree').textContent = both.length ? `${agree}/${both.length}` : '–';
    $('#agree').textContent = both.length ? `Same as Georges on ${agree} of ${both.length}` : '';
  }

  // Share of players on each side, shown inside the pick buttons once you've saved (or picks are locked)
  function shares(g) {
    const sp = data.split && data.split[g.id];
    if (!sp || !((data.me && data.me.picks[g.id]) || data.locked)) return null;
    const a = sp[g.away.abbr] || 0, h = sp[g.home.abbr] || 0;
    if (!a && !h) return null;
    const pa = Math.round(a / (a + h) * 100);
    return { [g.away.abbr]: pa, [g.home.abbr]: 100 - pa };
  }

  function oddBtn(g, t, home, sh) {
    const i = info(t);
    const picked = draft[g.id] === t.abbr;
    const locked = data.locked || g.state === 'void';
    let cls = 'odd';
    if (g.winner && data.me && data.me.picks[g.id] === t.abbr) cls += g.winner === t.abbr ? ' right' : ' wrong';
    const sub = sh ? `${sh[t.abbr]}%` : (home ? 'Home' : 'Away');
    const label = `Pick ${i.city} ${i.name}` + (sh ? `, picked by ${sh[t.abbr]}% of players` : '');
    return `<button type="button" class="${cls}" data-game="${esc(g.id)}" data-team="${esc(t.abbr)}" aria-pressed="${picked}" ${locked ? 'disabled' : ''}
      aria-label="${esc(label)}"><b>${esc(t.abbr)}</b><small>${esc(sub)}</small></button>`;
  }

  function renderGames() {
    const list = $('#games');
    if (!data.games.length) {
      list.innerHTML = '<li class="empty" style="padding-left:16px">No NHL games on the schedule this Saturday. The next Saturday will show up here automatically.</li>';
    } else {
      list.innerHTML = data.games.map(g => {
        const team = t => {
          const i = info(t);
          const cls = g.winner ? (g.winner === t.abbr ? 'won' : 'lost') : '';
          return `<span class="mteam ${cls}">${logo(t)}<span><span class="city">${esc(i.city)} </span>${esc(i.name)}</span></span>`;
        };
        const xp = data.expert[g.id];
        const gl = xp
          ? `<div class="mgl ${g.winner ? (g.winner === xp ? 'hit' : 'miss') : ''}"><b title="Georges’ pick">${esc(xp)}</b></div>`
          : '<div class="mgl none">–</div>';
        const sh = shares(g);
        return `<li class="mrow is-${g.state}">
          <span class="mtime ${g.state}">${esc(statusText(g))}</span>
          <div class="mteams">${team(g.away)}${team(g.home)}</div>
          <div class="mbtns">${oddBtn(g, g.away, false, sh)}${oddBtn(g, g.home, true, sh)}</div>
          ${gl}
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
    updateAgree();

    const btn = $('#submit'), name = $('#username');
    const same = data.me && games.every(g => data.me.picks[g.id] === draft[g.id]) && data.me.username === name.value.trim()
      && (data.me.email || '') === $('#email').value.trim().toLowerCase() && !!data.me.optIn === $('#optin').checked;
    name.disabled = data.locked;
    $('#email').disabled = data.locked;
    $('#optin').disabled = data.locked;
    btn.classList.toggle('saved', !!same);
    if (data.locked) {
      btn.disabled = true;
      btn.textContent = data.me ? 'Picks locked' : 'Entries closed';
      $('#lock-sub').textContent = data.me ? 'Your picks are locked in. Winners mark themselves as games end.' : 'Picks locked at the first puck drop. Come back next Saturday.';
    } else {
      btn.disabled = saving || !total || n !== total || same;
      btn.textContent = saving ? 'Saving' : same ? 'Picks saved' : data.me ? 'Update picks' : 'Submit picks';
      $('#lock-sub').textContent = data.lockAt
        ? `Pick the winner of every Saturday game. Picks lock ${fmtDay(data.lockAt)} at ${fmtTime(data.lockAt)}.`
        : 'Pick the winner of every Saturday game. Overtime and shootouts count.';
    }
  }

  /* ---------- Season leaderboard ---------- */
  let boardView = store.get('bg_board_view') === 'season' ? 'season' : 'week';
  let season = null;
  async function loadSeason() {
    try {
      const res = await fetch('/api/season', { cache: 'no-store' });
      if (!res.ok) throw new Error();
      season = await res.json();
      if (boardView === 'season' && data) renderBoard();
    } catch { /* keep the last season table */ }
  }
  document.querySelector('.board-seg').addEventListener('click', e => {
    const b = e.target.closest('button[data-board]');
    if (!b) return;
    boardView = b.dataset.board;
    store.set('bg_board_view', boardView);
    showAll = false;
    if (boardView === 'season' && !season) loadSeason();
    renderBoard();
  });
  function renderSeasonBoard() {
    const tbl = $('#board');
    tbl.classList.add('with-prize');
    const myName = ((data.me && data.me.username) || store.get('bg_username') || '').toLowerCase();
    if (!season) {
      $('#board-sub').textContent = '';
      $('#rows').innerHTML = '<tr><td colspan="4" class="board-empty">Loading the season.</td></tr>';
      $('#board-note').textContent = '';
      $('#more').hidden = true;
      return;
    }
    $('#board-sub').textContent = `Week ${season.weeksDone} of ${season.weeks}`;
    const rows = season.rows;
    const TOP = 10;
    const isMe = r => r.name.toLowerCase() === myName;
    let shown = rows;
    if (!showAll && rows.length > TOP + 1) {
      shown = rows.filter((r, i) => i < TOP || isMe(r));
    }
    let html = '';
    const gRow = `<tr class="is-georges"><td class="place">–</td><td class="player"><span class="gname"><img class="gphoto xs" src="${GEORGES_PHOTO}" alt="" width="22" height="22">Georges Laraque</span></td><td class="pts">${season.georges}</td><td class="num prize-col"></td></tr>`;
    let gDone = season.georges == null;
    shown.forEach((r, i) => {
      if (!gDone && r.score <= season.georges) { html += gRow; gDone = true; } // Georges sits at his score, above players he ties
      if (i > 0 && rows.indexOf(r) - rows.indexOf(shown[i - 1]) > 1) html += '<tr class="gap"><td colspan="4">…</td></tr>';
      html += `<tr class="${isMe(r) ? 'is-me' : ''} ${r.rank === 1 ? 'top' : ''}">
        <td class="place">${r.rank}</td>
        <td class="player">${esc(r.name)}${isMe(r) ? '<span class="mark me">You</span>' : ''}<span class="wk"> · ${r.weeks} ${r.weeks === 1 ? 'week' : 'weeks'}</span></td>
        <td class="pts">${r.score}</td>
        <td class="num prize-col">${r.prize ? money(r.prize) : ''}</td></tr>`;
    });
    if (!gDone) html += gRow;
    $('#rows').innerHTML = rows.length ? html : '<tr><td colspan="4" class="board-empty">The season table starts once the first game this Saturday ends.</td></tr>';
    $('#board-note').textContent = season.finished
      ? 'Final season standings. Ties share the prizes for the places they cover. Winners must be eligible.'
      : `Season prizes as things stand now, paid after the last Saturday (${shortDate(season.end)}). Ties share the prizes for the places they cover.`;
    const more = $('#more');
    more.hidden = rows.length <= TOP + 1;
    more.textContent = showAll ? 'Show top 10' : 'Show full season table';
  }

  function renderBoard() {
    document.querySelectorAll('.board-seg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.board === boardView)));
    if (boardView === 'season') { renderFacts(); return renderSeasonBoard(); }
    const { rows, graded } = data.leaderboard;
    const g = georgesRow();
    const total = playable().length;
    const fans = rows.filter(r => !r.expert);
    renderFacts();
    $('#board-sub').textContent = graded ? `${graded} of ${total} final` : `${data.entries} ${data.entries === 1 ? 'player' : 'players'}`;

    const myName = data.me && data.me.username.toLowerCase();
    const isMe = r => !r.expert && r.name.toLowerCase() === myName;
    const TOP = 10;
    let shown = rows, hidden = 0;
    if (!showAll && rows.length > TOP + 2) {
      const keep = new Set(rows.slice(0, TOP));
      rows.forEach(r => { if (r.expert || isMe(r)) keep.add(r); });
      shown = rows.filter(r => keep.has(r));
      hidden = rows.length - shown.length;
    }
    const showPrize = graded > 0;
    $('#board').classList.toggle('with-prize', showPrize);
    const row = r => `<tr class="${r.expert ? 'is-georges' : ''} ${isMe(r) ? 'is-me' : ''} ${r.rank === 1 && graded ? 'top' : ''}">
      <td class="place">${r.expert ? '–' : r.rank}</td>
      <td class="player">${r.expert ? `<span class="gname"><img class="gphoto xs" src="${GEORGES_PHOTO}" alt="" width="22" height="22">${esc(r.name)}</span>` : esc(r.name)}${isMe(r) ? '<span class="mark me">You</span>' : ''}${!r.expert && g && graded && r.score > g.score ? '<span class="mark beat">Beat Georges</span>' : ''}</td>
      <td class="pts">${r.score}</td>
      <td class="num prize-col">${!r.expert && r.prize ? money(r.prize) : ''}</td></tr>`;
    let html = '';
    shown.forEach((r, i) => {
      if (i > 0 && rows.indexOf(r) - rows.indexOf(shown[i - 1]) > 1) html += '<tr class="gap"><td colspan="4">…</td></tr>';
      html += row(r);
    });
    $('#rows').innerHTML = rows.length ? html : '<tr><td colspan="4" class="board-empty">No entries yet. Make your picks and be the first name here.</td></tr>';
    const allFinal = graded && graded === total;
    $('#board-note').textContent = !showPrize ? `Top ${data.leaderboard.prizes.length} split ${money(data.leaderboard.pool)}. Prizes show here once the first game ends.`
      : allFinal ? 'Final prizes. Ties share the prizes for the places they cover. Winners must be eligible.'
      : 'Prizes as things stand now. Ties share the prizes for the places they cover. Winners must be eligible.';
    const more = $('#more');
    more.hidden = !hidden && !showAll;
    more.textContent = showAll ? 'Show top 10' : 'Show full leaderboard';
  }

  function renderFacts() {
    const { rows, graded } = data.leaderboard;
    const g = georgesRow();
    const fans = rows.filter(r => !r.expert);
    $('#f-players').textContent = data.entries;
    $('#f-final').textContent = `${graded}/${playable().length}`;
    $('#f-beat').textContent = g && graded ? fans.filter(r => r.score > g.score).length : 0;
  }

  const ago = ms => {
    const m = Math.max(0, Math.round((Date.now() - ms) / 60000));
    if (m < 1) return 'now';
    if (m < 60) return m + 'm';
    const h = Math.round(m / 60);
    if (h < 24) return h + 'h';
    return Math.round(h / 24) + 'd';
  };
  function renderFeed() {
    const items = data.recent || [];
    $('#feed').innerHTML = items.length ? items.map(r => `<li>
      <time datetime="${new Date(r.at).toISOString()}">${ago(r.at)}</time>
      <span><b>${esc(r.name)}</b> <span class="what">${r.edited ? 'updated their picks' : 'is in'}</span></span></li>`).join('')
      : '<li class="empty">No entries yet this Saturday.</li>';
  }


  /* ---------- NHL standings ---------- */
  let standings = null;
  let nhlView = store.get('bg_nhl_view') || 'Atlantic';
  async function loadStandings() {
    try {
      const res = await fetch('/api/standings', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !Array.isArray(json.teams) || !json.teams.length) throw new Error('no standings');
      standings = json.teams;
      $('#nhl').hidden = false;
      renderStandings();
    } catch {
      if (!standings) $('#nhl').hidden = true;
    }
  }
  function renderStandings() {
    if (!standings) return;
    const views = ['Atlantic', 'Metropolitan', 'Central', 'Pacific', 'League'];
    if (!views.includes(nhlView)) nhlView = 'Atlantic';
    document.querySelectorAll('.seg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === nhlView)));
    const sorted = [...standings].sort((a, b) => b.pts - a.pts || a.gp - b.gp || b.w - a.w);
    const list = nhlView === 'League' ? sorted : sorted.filter(t => t.div === nhlView);
    const playing = new Set();
    if (data) data.games.forEach(g => { playing.add(g.away.abbr); playing.add(g.home.abbr); });
    $('#nhl-rows').innerHTML = list.map((t, i) => {
      const ti = info({ abbr: t.abbr, name: t.name });
      const cls = [nhlView !== 'League' && i === 2 && list.length > 3 ? 'cut' : '', playing.has(t.abbr) ? 'sat' : ''].join(' ');
      return `<tr class="${cls}"><td>${i + 1}</td>
        <td><span class="nt">${logo(t)}<b>${esc(t.abbr)}</b><span>${esc(ti.name)}</span></span></td>
        <td class="num">${t.gp}</td><td class="num">${t.w}</td><td class="num">${t.l}</td><td class="num">${t.otl}</td><td class="num p">${t.pts}</td></tr>`;
    }).join('');
    $('#nhl-sub').textContent = nhlView === 'League' ? 'All 32 teams' : nhlView + ' Division';
    const notes = [];
    if (playing.size) notes.push('<span><i></i>Plays this Saturday</span>');
    if (nhlView !== 'League') notes.push('<span>Line: top 3 in the division make the playoffs, plus 2 wild cards per conference.</span>');
    $('#nhl-note').innerHTML = notes.join(' ');
  }
  document.querySelector('.seg').addEventListener('click', e => {
    const b = e.target.closest('button[data-view]');
    if (!b) return;
    nhlView = b.dataset.view;
    store.set('bg_nhl_view', nhlView);
    renderStandings();
  });

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
  $('#email').addEventListener('input', () => { $('#email').removeAttribute('aria-invalid'); if (data) updateEntry(); });
  $('#optin').addEventListener('change', () => { if (data) updateEntry(); });
  $('#more').addEventListener('click', () => { showAll = !showAll; renderBoard(); });

  // Header menu: highlight the section you're looking at
  const navLinks = [...document.querySelectorAll('.hnav a')];
  const setOn = id => navLinks.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + id));
  let spyPausedUntil = 0;
  navLinks.forEach(a => a.addEventListener('click', () => {
    const id = a.getAttribute('href').slice(1);
    setOn(id);
    spyPausedUntil = Date.now() + 1000;
    if (id === 'rules') $('#rules').open = true;
  }));
  $('#hdr-me').addEventListener('click', e => setOn(e.currentTarget.getAttribute('href').slice(1)));
  function spy() {
    if (Date.now() < spyPausedUntil) return;
    const wide = window.matchMedia('(min-width: 981px)').matches;
    // On wide screens the leaderboard and standings sit beside the main column, so only the main column is tracked.
    const ids = wide ? ['georges', 'picks', 'rules'] : ['georges', 'picks', 'rules', 'board', 'nhl'];
    const line = 110;
    let current = ids[0];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el && !el.hidden && el.getBoundingClientRect().top <= line) current = id;
    }
    if ((window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 4) {
      const last = [...ids].reverse().find(id => { const el = document.getElementById(id); return el && !el.hidden; });
      if (last && !wide) current = last;
    }
    setOn(current);
  }
  let spyQueued = false;
  window.addEventListener('scroll', () => {
    if (spyQueued) return;
    spyQueued = true;
    requestAnimationFrame(() => { spyQueued = false; spy(); });
  }, { passive: true });

  function setStatus(msg, kind) {
    const s = $('#status');
    s.textContent = msg;
    s.className = 'status' + (kind ? ' ' + kind : '');
  }

  $('#submit').addEventListener('click', async () => {
    const username = $('#username').value.trim();
    if (!/^[A-Za-z0-9_.\-]{3,20}$/.test(username)) {
      setStatus('Add your BetGRW username first: 3 to 20 letters, numbers, dots, dashes or underscores.', 'error');
      $('#username').focus();
      return;
    }
    const email = $('#email').value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setStatus('Add your email so we can contact you if you win.', 'error');
      $('#email').setAttribute('aria-invalid', 'true');
      $('#email').focus();
      return;
    }
    saving = true; updateEntry();
    try {
      const res = await fetch('/api/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-entry-token': store.get('bg_token') || '' },
        body: JSON.stringify({ username, email, optIn: $('#optin').checked, picks: draft, website: $('#website').value })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Your picks weren’t saved. Try again.');
      if (json.token) store.set('bg_token', json.token);
      store.set('bg_username', json.username);
      store.set('bg_email', email);
      store.set('bg_optin', $('#optin').checked ? '1' : '0');
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
    else { renderDuel(); updateEntry(); renderFeed(); }
  }, 30000);
  load();
  loadSeason();
  setInterval(loadSeason, 60000);
  loadStandings();
  setInterval(loadStandings, 30 * 60000);
})();
