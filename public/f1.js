(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } }
  };
  const L = window.I18N, t = L.t, LOCALE = L.LOCALE;

  let data = null;
  let draft = [];   // driver ids in the order you think they'll finish, 1st first
  let draftLoaded = false;
  let saving = false, showAll = false, pollTimer = null;

  const dayFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', month: 'short', day: 'numeric' });
  const timeFmt = new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit' });
  const longFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', hour: 'numeric', minute: '2-digit' });
  const TEAM_COLORS = {
    'Mercedes': '#00A19C', 'Red Bull': '#3671C6', 'Ferrari': '#E8002D', 'McLaren': '#FF8000', 'Racing Bulls': '#6692FF',
    'Alpine': '#0093CC', 'Haas': '#8D9196', 'Audi': '#B5121B', 'Aston Martin': '#229971', 'Williams': '#1868DB', 'Cadillac': '#1E1E1E'
  };
  const teamColor = team => TEAM_COLORS[team] || Object.entries(TEAM_COLORS).find(([k]) => (team || '').includes(k))?.[1] || '#8C949C';
  const PLACE = i => L.ordinal(i + 1);

  /* ---------- Photo fallback (until tagliani.jpg is added) ---------- */
  const PERSON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4.2" fill="currentColor"/><path d="M3.5 21c.9-4.4 4.3-6.8 8.5-6.8s7.6 2.4 8.5 6.8" fill="currentColor"/></svg>';
  const swapPhoto = im => {
    const d = document.createElement('span');
    d.className = im.className + ' gphoto-fb';
    d.setAttribute('role', 'img');
    d.setAttribute('aria-label', im.alt || 'Alex Tagliani');
    d.innerHTML = PERSON;
    im.replaceWith(d);
  };
  document.addEventListener('error', e => { if (e.target instanceof HTMLImageElement && e.target.classList.contains('gphoto')) swapPhoto(e.target); }, true);
  document.querySelectorAll('img.gphoto').forEach(im => { if (im.complete && im.naturalWidth === 0) swapPhoto(im); });

  /* ---------- Data ---------- */
  async function load() {
    try {
      const res = await fetch('/api/f1/state', { headers: { 'x-entry-token': store.get('bg_token') || '' }, cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      data = json;
      syncDraft();
      render();
    } catch {
      if (!data) $('#sb-strip').textContent = t('f1.loadFail');
    } finally {
      clearTimeout(pollTimer);
      const racing = data && data.locked && !data.final;
      pollTimer = setTimeout(load, racing ? 30000 : 60000);
    }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });

  function syncDraft() {
    if (!draftLoaded) {
      draftLoaded = true;
      try { draft = JSON.parse(store.get('bg_f1_order')) || []; } catch { draft = []; }
      if (data.me && (!Array.isArray(draft) || !draft.length)) draft = [...data.me.picks];
      const name = data.me ? data.me.username : store.get('bg_username');
      if (name && !$('#username').value) $('#username').value = name;
      const mail = data.me ? data.me.email : store.get('bg_email');
      if (mail && !$('#email').value) $('#email').value = mail;
      $('#optin').checked = data.me ? !!data.me.optIn : store.get('bg_optin') === '1';
    }
    const ids = new Set(data.drivers.map(d => d.id));
    draft = (Array.isArray(draft) ? draft : []).filter((id, i, a) => ids.has(id) && a.indexOf(id) === i);
  }
  const saveDraft = () => store.set('bg_f1_order', JSON.stringify(draft));
  const N = () => data.drivers.length;
  const ptsAt = i => (i < data.points.topN ? data.points.top : data.points.rest);
  const driver = id => data.drivers.find(d => d.id === id);
  const fullName = d => d ? `${d.first} ${d.last}` : '';
  const expertRow = () => data.leaderboard.rows.find(r => r.expert);
  const until = ms => L.until(ms);

  /* ---------- Render ---------- */
  function render() {
    renderHub();
    renderPrize();
    renderResult();
    renderExpert();
    renderMine();
    renderDrivers();
    renderBoard();
    renderFeed();
  }

  function renderHub() {
    const start = new Date(data.lockAt);
    $('#date-label').textContent = dayFmt.format(start);
    $('#start-label').textContent = timeFmt.format(start);
    const xr = expertRow();
    $('#sb-expert').textContent = data.final && xr ? xr.score : '–';
    $('#sb-you').textContent = data.final && data.me ? data.me.score : '–';
    $('#sb-you-label').textContent = data.me ? data.me.username : t('duel.you');
    let s;
    if (data.final) {
      const xs = xr ? xr.score : null;
      if (!data.me || xs == null) s = t('f1.stFinal');
      else s = data.me.score > xs ? t('f1.stYouBeat') : data.me.score < xs ? t('f1.stHeWins') : t('f1.stTied');
    } else if (data.locked) s = t('f1.stRacing');
    else s = t('f1.stUpcoming', { time: longFmt.format(start) });
    $('#sb-strip').textContent = s;
    if (!data.locked) { $('#lock-label').textContent = t('hub.lockIn'); $('#lockline').textContent = until(data.lockAt - Date.now()); }
    else { $('#lock-label').textContent = t('hub.status'); $('#lockline').textContent = data.final ? t('f1.final') : t('f1.racing'); }

    const pill = $('#hdr-pill');
    pill.className = 'hdr-pill';
    if (!data.locked) { pill.textContent = t('hdr.lockIn', { t: until(data.lockAt - Date.now()) }); pill.hidden = false; }
    else if (!data.final) { pill.classList.add('live'); pill.textContent = t('f1.racing'); pill.hidden = false; }
    else { pill.textContent = t('hdr.final'); pill.hidden = false; }

    const me = $('#hdr-me');
    if (data.me) {
      me.className = 'hdr-me';
      me.href = '#board';
      me.innerHTML = `<span class="ini" aria-hidden="true">${esc(data.me.username.slice(0, 2).toUpperCase())}</span><span class="nm">${esc(data.me.username)}</span>${data.final ? `<span class="pt">${data.me.score}</span>` : ''}`;
      me.setAttribute('aria-label', data.me.username);
    } else {
      me.className = 'hdr-me cta';
      me.href = data.locked ? '#board' : '#picks';
      me.textContent = data.locked ? t('hdr.see') : t('hdr.make');
      me.removeAttribute('aria-label');
    }
  }

  function renderPrize() {
    $('#pts-max').textContent = data.points.topN * data.points.top + (N() - data.points.topN) * data.points.rest;
    const lb = data.leaderboard;
    // Prize for this race: an Alex Tagliani merch pack for 1st place (no cash)
    $('#pool').textContent = t('f1.merchBig');
    $('#prize-h').textContent = t('f1.merchHead');
    $('#payouts').hidden = true;
  }

  // Top 3 of a finishing order, as three cells. `against` is the official order, to mark right and wrong.
  function pod(ids, against) {
    return [0, 1, 2].map(i => {
      const d = driver(ids && ids[i]);
      let cls = '', mark = '';
      if (d && against) { if (against[i] === d.id) { cls = 'hit'; mark = `+${ptsAt(i)}`; } else { cls = 'miss'; mark = '0'; } }
      const body = d
        ? `<span class="pod-name"><span class="pod-first">${esc(d.first)} </span>${esc(d.last)}</span><span class="pod-team">${esc(d.team || '')}</span>`
        : '<span class="pod-name empty">–</span>';
      return `<li class="p${i + 1} ${cls}" style="--team:${d ? teamColor(d.team) : 'transparent'}">
        <span class="pod-pos">${PLACE(i)}</span>${body}${mark ? `<span class="pod-mark">${mark}</span>` : ''}</li>`;
    }).join('');
  }

  // A full finishing order as rows. With `against`, each row shows where the driver really finished and the points.
  // With `edit`, rows get move up, move down and remove buttons.
  function orderRows(ids, against, edit) {
    return ids.map((id, i) => {
      const d = driver(id);
      if (!d) return '';
      let cls = i < data.points.topN ? 'top3' : '', mark = '';
      if (against) {
        const real = against.indexOf(id);
        if (real === i) { cls += ' hit'; mark = `<span class="or-pts">+${ptsAt(i)}</span>`; }
        else { cls += ' miss'; mark = `<span class="or-real">${real >= 0 ? esc(t('f1.realPos', { place: PLACE(real) })) : '–'}</span>`; }
      }
      const tools = edit ? `<span class="or-tools">
          <button type="button" data-move="up" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="${esc(t('f1.up', { name: fullName(d) }))}">↑</button>
          <button type="button" data-move="down" data-i="${i}" ${i === ids.length - 1 ? 'disabled' : ''} aria-label="${esc(t('f1.down', { name: fullName(d) }))}">↓</button>
          <button type="button" data-move="out" data-i="${i}" aria-label="${esc(t('f1.remove', { name: fullName(d) }))}">×</button></span>` : '';
      return `<li class="${cls}" style="--team:${teamColor(d.team)}">
        <span class="or-pos">${PLACE(i)}</span><i class="tbar" aria-hidden="true"></i>
        <span class="or-name"><span class="dfirst">${esc(d.first)} </span><b>${esc(d.last)}</b><small>${esc(d.team || '')}</small></span>
        ${mark}${tools}</li>`;
    }).join('');
  }

  function renderResult() {
    $('#result').hidden = !data.final;
    if (!data.final) return;
    $('#result-pod').innerHTML = pod(data.order, null);
    $('#result-full').innerHTML = orderRows(data.order, null, false);
  }

  function renderExpert() {
    const x = data.expert;
    $('#x-pod').innerHTML = x ? pod(x, data.final ? data.order : null) : `<li class="pod-wait">${esc(t('f1.notYet'))}</li>`;
    $('#x-pod').classList.toggle('waiting', !x);
    $('#x-more').hidden = !x;
    if (x) $('#x-full').innerHTML = orderRows(x, data.final ? data.order : null, false);
    const intro = $('#x-intro');
    intro.hidden = !data.intro;
    intro.textContent = data.intro || '';
  }

  function renderMine() {
    const locked = data.locked;
    const step = $('#step'), tools = $('#order-tools');
    if (locked) {
      step.hidden = true; tools.hidden = true;
      $('#my-order').innerHTML = data.me ? orderRows(data.me.picks, data.final ? data.order : null, false) : '';
      return;
    }
    const n = draft.length, total = N();
    $('#my-order').innerHTML = orderRows(draft, null, true)
      + (n < total ? `<li class="next ${n < data.points.topN ? 'top3' : ''}"><span class="or-pos">${PLACE(n)}</span><span class="or-name">${esc(t('f1.tapNext'))}</span></li>` : '');
    step.hidden = false;
    step.className = 'f1-step' + (n === total ? ' done' : '');
    step.innerHTML = n === total ? esc(t('f1.orderDone'))
      : `<b>${n + 1}</b>${esc(t(n === 0 ? 'f1.tapWinner' : 'f1.tapPlace', { place: PLACE(n) }))}${n < data.points.topN ? `<span class="step-pts">${esc(t('f1.ptsEach', { n: data.points.top }))}</span>` : ''}`;
    tools.hidden = false;
    $('#fill-rest').hidden = n === total;
    $('#clear-all').hidden = !n;
  }

  // Share of players who picked each driver to win, shown once you've entered (or picks are locked)
  function winShare() {
    if (!data.entries || !(data.me || data.locked)) return null;
    const total = Object.values(data.split).reduce((a, b) => a + b, 0);
    return total ? id => Math.round((data.split[id] || 0) / total * 100) : null;
  }

  // Drivers not placed yet. Tap one and he takes the next place.
  function renderDrivers() {
    const locked = data.locked;
    const share = winShare();
    const left = locked ? [] : data.drivers.filter(d => !draft.includes(d.id));
    $('#drivers').hidden = !left.length;
    $('#drivers').innerHTML = left.map(d => {
      const pct = share ? share(d.id) : null;
      return `<li><button type="button" class="dcard" data-driver="${esc(d.id)}" style="--team:${teamColor(d.team)}" aria-label="${esc(t('f1.placeAria', { name: fullName(d), place: PLACE(draft.length) }))}">
        <i class="tbar" aria-hidden="true"></i>
        <span class="dtext"><span class="dn"><span class="dfirst">${esc(d.first)} </span><b>${esc(d.last)}</b></span>
          <small>${esc(d.team || '')}${pct ? ` · ${esc(t('f1.winPct', { p: pct }))}` : ''}</small></span>
      </button></li>`;
    }).join('');
    updateEntry();
  }

  function updateEntry() {
    const n = draft.length, total = N();
    $('#progress-text').textContent = data.locked ? '' : t('f1.progressN', { n, t: total });
    $('#progress-fill').style.width = (total ? n / total * 100 : 0) + '%';
    const xp = data.expert;
    const same = xp ? draft.filter((id, i) => id === xp[i]).length : 0;
    $('#agree').textContent = xp && n && !data.locked ? t('f1.agreeN', { a: same, n }) : '';

    const btn = $('#submit'), name = $('#username');
    const unchanged = data.me && data.me.picks.length === draft.length && data.me.picks.every((id, i) => id === draft[i]) && data.me.username === name.value.trim()
      && (data.me.email || '') === $('#email').value.trim().toLowerCase() && !!data.me.optIn === $('#optin').checked;
    [name, $('#email'), $('#optin')].forEach(el => { el.disabled = data.locked; });
    const out = data.locked && !data.me; // race started and you didn't enter: just show the list
    $('.entry-form').hidden = out;
    $('#my-order').hidden = out;
    btn.classList.toggle('saved', !!unchanged);
    if (data.locked) {
      btn.disabled = true;
      btn.textContent = data.me ? t('btn.locked') : t('btn.closed');
      $('#lock-sub').textContent = data.me ? t('f1.lockedMe') : t('f1.lockedNo');
    } else {
      btn.disabled = saving || n !== total || unchanged;
      btn.textContent = saving ? t('btn.saving') : unchanged ? t('btn.saved') : data.me ? t('btn.update') : t('btn.submit');
      $('#lock-sub').textContent = data.me && data.me.picks.length < total ? t('f1.redo') : t('f1.howToOrder');
    }
  }

  function renderBoard() {
    const rows = data.leaderboard.rows;
    const myName = data.me && data.me.username.toLowerCase();
    const isMe = r => !r.expert && r.name.toLowerCase() === myName;
    const xr = expertRow();
    $('#board-sub').textContent = t(data.entries === 1 ? 'board.players1' : 'board.playersN', { n: data.entries });
    $('#board').classList.toggle('with-prize', data.final);
    const TOP = 10;
    let shown = rows, hidden = 0;
    if (!showAll && rows.length > TOP + 2) {
      const keep = new Set(rows.slice(0, TOP));
      rows.forEach(r => { if (r.expert || isMe(r)) keep.add(r); });
      shown = rows.filter(r => keep.has(r));
      hidden = rows.length - shown.length;
    }
    let html = '';
    shown.forEach((r, i) => {
      if (i > 0 && rows.indexOf(r) - rows.indexOf(shown[i - 1]) > 1) html += '<tr class="gap"><td colspan="4">…</td></tr>';
      html += `<tr class="${r.expert ? 'is-georges' : ''} ${isMe(r) ? 'is-me' : ''} ${data.final && r.rank === 1 ? 'top' : ''}">
        <td class="place">${r.expert || !data.final ? '–' : r.rank}</td>
        <td class="player">${r.expert ? `<span class="gname"><img class="gphoto xs" src="tagliani.jpg" alt="" width="22" height="22">${esc(r.name)}</span>` : esc(r.name)}${isMe(r) ? `<span class="mark me">${esc(t('mark.you'))}</span>` : ''}${!r.expert && data.final && xr && r.score > xr.score ? `<span class="mark beat">${esc(t('f1.beat'))}</span>` : ''}</td>
        <td class="pts">${data.final ? r.score : ''}</td>
        <td class="num prize-col">${!r.expert && data.final && r.rank === 1 ? `<span class="merch-tag">${esc(t('f1.merchCell'))}</span>` : ''}</td></tr>`;
    });
    $('#rows').innerHTML = rows.length ? html : `<tr><td colspan="4" class="board-empty">${esc(t('board.empty'))}</td></tr>`;
    $('#board-note').textContent = data.final ? t('f1.boardFinalMerch') : t('f1.boardPendingMerch');
    const more = $('#more');
    more.hidden = !hidden && !showAll;
    more.textContent = showAll ? t('board.showTop') : t('board.showFull');
    // facts
    $('#f-players').textContent = data.entries;
    const fav = Object.entries(data.split).sort((a, b) => b[1] - a[1])[0];
    $('#f-fav').textContent = fav ? (driver(fav[0]) || {}).code || '–' : '–';
    $('#f-beat').textContent = data.final && xr ? rows.filter(r => !r.expert && r.score > xr.score).length : 0;
  }

  function renderFeed() {
    const items = data.recent || [];
    $('#feed').innerHTML = items.length ? items.map(r => `<li>
      <time datetime="${new Date(r.at).toISOString()}">${L.ago(r.at)}</time>
      <span><b>${esc(r.name)}</b> <span class="what">${esc(r.edited ? t('feed.updated') : t('feed.in'))}</span></span></li>`).join('')
      : `<li class="empty">${esc(t('f1.feedEmpty'))}</li>`;
  }

  /* ---------- Actions ---------- */
  function setStatus(msg, kind) {
    const s = $('#status');
    s.textContent = msg;
    s.className = 'status' + (kind ? ' ' + kind : '');
  }
  const changed = () => { saveDraft(); renderMine(); renderDrivers(); setStatus(''); };
  $('#drivers').addEventListener('click', e => {
    const b = e.target.closest('button[data-driver]');
    if (!b || !data || data.locked) return;
    if (!draft.includes(b.dataset.driver)) draft.push(b.dataset.driver);   // takes the next place
    changed();
    const next = document.querySelector('#drivers button');
    if (next) next.focus({ preventScroll: true });
    if (draft.length === N() && !$('#username').value.trim()) $('.entry-form').scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
  $('#my-order').addEventListener('click', e => {
    const b = e.target.closest('button[data-move]');
    if (!b || data.locked) return;
    const i = Number(b.dataset.i);
    if (b.dataset.move === 'out') draft.splice(i, 1);                     // later drivers move up one place
    else {
      const j = b.dataset.move === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= draft.length) return;
      [draft[i], draft[j]] = [draft[j], draft[i]];
    }
    changed();
    const again = document.querySelector(`#my-order button[data-move="${b.dataset.move}"][data-i="${b.dataset.move === 'up' ? i - 1 : b.dataset.move === 'down' ? i + 1 : i}"]`);
    if (again && !again.disabled) again.focus({ preventScroll: true });
  });
  $('#fill-rest').addEventListener('click', () => {               // the rest in championship order
    data.drivers.forEach(d => { if (!draft.includes(d.id)) draft.push(d.id); });
    changed();
  });
  $('#clear-all').addEventListener('click', () => { draft = []; changed(); });
  $('#username').addEventListener('input', () => { if (data) updateEntry(); });
  $('#email').addEventListener('input', () => { $('#email').removeAttribute('aria-invalid'); if (data) updateEntry(); });
  $('#optin').addEventListener('change', () => { if (data) updateEntry(); });
  $('#more').addEventListener('click', () => { showAll = !showAll; renderBoard(); });

  // Header menu highlight
  const navLinks = [...document.querySelectorAll('.hnav a[href^="#"]')];
  const setOn = id => navLinks.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + id));
  navLinks.forEach(a => a.addEventListener('click', () => {
    const id = a.getAttribute('href').slice(1);
    setOn(id);
    if (id === 'rules') $('#rules').open = true;
  }));
  window.addEventListener('scroll', () => {
    const wide = window.matchMedia('(min-width: 981px)').matches;
    const ids = wide ? ['tagliani', 'picks', 'rules'] : ['tagliani', 'picks', 'rules', 'board'];
    let cur = ids[0];
    for (const id of ids) { const el = document.getElementById(id); if (el && el.getBoundingClientRect().top <= 110) cur = id; }
    setOn(cur);
  }, { passive: true });

  $('#submit').addEventListener('click', async () => {
    const username = $('#username').value.trim();
    if (!/^[A-Za-z0-9_.\-]{3,20}$/.test(username)) { setStatus(t('err.username'), 'error'); $('#username').focus(); return; }
    const email = $('#email').value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setStatus(t('err.email'), 'error'); $('#email').setAttribute('aria-invalid', 'true'); $('#email').focus(); return;
    }
    saving = true; updateEntry();
    try {
      const res = await fetch('/api/f1/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-entry-token': store.get('bg_token') || '', 'x-lang': L.lang },
        body: JSON.stringify({ username, email, optIn: $('#optin').checked, picks: draft, website: $('#website').value })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(L.tServer(json.error) || t('err.save'));
      if (json.token) store.set('bg_token', json.token);
      store.set('bg_username', json.username);
      store.set('bg_email', email);
      store.set('bg_optin', $('#optin').checked ? '1' : '0');
      setStatus(json.updated ? t('ok.updated') : t('f1.okIn', { name: json.username }), 'ok');
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
    if (Date.now() >= data.lockAt) load(); else renderHub();
  }, 30000);
  load();
})();
