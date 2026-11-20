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
  let draft = [null, null, null];   // driver ids for 1st, 2nd, 3rd
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
      try { draft = JSON.parse(store.get('bg_f1_draft')) || draft; } catch { /* keep empty */ }
      if (data.me && !draft.some(Boolean)) draft = [...data.me.picks];
      const name = data.me ? data.me.username : store.get('bg_username');
      if (name && !$('#username').value) $('#username').value = name;
      const mail = data.me ? data.me.email : store.get('bg_email');
      if (mail && !$('#email').value) $('#email').value = mail;
      $('#optin').checked = data.me ? !!data.me.optIn : store.get('bg_optin') === '1';
    }
    const ids = new Set(data.drivers.map(d => d.id));
    draft = [0, 1, 2].map(i => (ids.has(draft[i]) ? draft[i] : null));
  }
  const saveDraft = () => store.set('bg_f1_draft', JSON.stringify(draft));
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
    const lb = data.leaderboard;
    $('#pool').textContent = L.money(lb.pool);
    $('#prize-h').textContent = t('f1.prizeHead', { n: lb.prizes.length, pool: L.money(lb.pool) });
    const out = [];
    lb.prizes.forEach((p, i) => out.push(`<li><span>${PLACE(i)}</span><b>${L.money(p)}</b></li>`));
    $('#payouts').innerHTML = out.join('');
  }

  // One podium: three cells. `against` is the official podium, to mark right and wrong.
  function pod(ids, against, opts = {}) {
    return [0, 1, 2].map(i => {
      const d = driver(ids && ids[i]);
      let cls = '', mark = '';
      if (d && against) {
        if (against[i] === d.id) { cls = 'hit'; mark = `+${data.points.exact}`; }
        else if (against.includes(d.id)) { cls = 'close'; mark = `+${data.points.onPodium}`; }
        else { cls = 'miss'; mark = '0'; }
      }
      const body = d
        ? `<span class="pod-name"><span class="pod-first">${esc(d.first)} </span>${esc(d.last)}</span><span class="pod-team">${esc(d.team || '')}</span>`
        : `<span class="pod-name empty">${esc(opts.empty || '–')}</span>`;
      const btn = opts.clear && d ? `<button type="button" class="pod-x" data-clear="${i}" aria-label="${esc(t('f1.clear', { place: PLACE(i) }))}">×</button>` : '';
      return `<li class="p${i + 1} ${cls}" style="--team:${d ? teamColor(d.team) : 'transparent'}">
        <span class="pod-pos">${PLACE(i)}</span>${body}${mark ? `<span class="pod-mark">${mark}</span>` : ''}${btn}</li>`;
    }).join('');
  }

  function renderResult() {
    $('#result').hidden = !data.final;
    if (data.final) $('#result-pod').innerHTML = pod(data.podium, null);
  }

  function renderExpert() {
    $('#x-pod').innerHTML = data.expert ? pod(data.expert, data.final ? data.podium : null) : `<li class="pod-wait">${esc(t('f1.notYet'))}</li>`;
    $('#x-pod').classList.toggle('waiting', !data.expert);
    const intro = $('#x-intro');
    intro.hidden = !data.intro;
    intro.textContent = data.intro || '';
  }

  // The spot the next driver tap fills: the one you tapped, otherwise the first empty one
  let slot = null;
  const activeSlot = () => (slot !== null ? slot : draft.indexOf(null));

  function renderMine() {
    const locked = data.locked;
    if (locked) {
      $('#my-pod').innerHTML = pod(data.me ? data.me.picks : [null, null, null], data.final ? data.podium : null, { empty: '–' });
      $('#step').hidden = true;
      return;
    }
    const act = activeSlot();
    $('#my-pod').innerHTML = [0, 1, 2].map(i => {
      const d = driver(draft[i]);
      return `<li class="p${i + 1} ${i === act ? 'active' : ''} ${d ? 'filled' : ''}" style="--team:${d ? teamColor(d.team) : 'transparent'}">
        <button type="button" class="pod-btn" data-slot="${i}" aria-label="${esc(t('f1.slotAria', { place: PLACE(i) }))}">
          <span class="pod-pos">${i === 0 ? esc(t('f1.winner')) : PLACE(i)}</span>
          ${d ? `<span class="pod-name"><span class="pod-first">${esc(d.first)} </span>${esc(d.last)}</span><span class="pod-team">${esc(d.team || '')}</span>`
              : `<span class="pod-name empty">${esc(i === act ? t('f1.tapDriver') : t('f1.choose'))}</span>`}
        </button>
        ${d ? `<button type="button" class="pod-x" data-clear="${i}" aria-label="${esc(t('f1.clear', { place: PLACE(i) }))}">×</button>` : ''}
      </li>`;
    }).join('');
    const step = $('#step');
    step.hidden = false;
    step.className = 'f1-step' + (act === -1 ? ' done' : '');
    step.innerHTML = act === -1 ? esc(t('f1.stepDone'))
      : `<b>${act + 1}</b>${esc(t(['f1.step1', 'f1.step2', 'f1.step3'][act]))}`;
  }

  // Share of players who picked each driver to win, shown once you've entered (or picks are locked)
  function winShare() {
    if (!data.entries || !(data.me || data.locked)) return null;
    const total = Object.values(data.split).reduce((a, b) => a + b, 0);
    return total ? id => Math.round((data.split[id] || 0) / total * 100) : null;
  }

  function renderDrivers() {
    const locked = data.locked;
    const share = winShare();
    const finish = data.final ? data.podium : null;
    $('#drivers').innerHTML = data.drivers.map(d => {
      const mineAt = data.me ? data.me.picks.indexOf(d.id) : -1;
      const sel = locked ? mineAt : draft.indexOf(d.id);
      const fin = finish ? finish.indexOf(d.id) : -1;
      let cls = 'dcard';
      if (sel >= 0) cls += ' sel';
      if (finish && mineAt >= 0) cls += finish[mineAt] === d.id ? ' right' : finish.includes(d.id) ? ' near' : ' wrong';
      if (fin >= 0) cls += ' on-pod';
      const pct = share ? share(d.id) : null;
      return `<li><button type="button" class="${cls}" data-driver="${esc(d.id)}" aria-pressed="${sel >= 0}" ${locked ? 'disabled' : ''} style="--team:${teamColor(d.team)}"
          aria-label="${esc(fullName(d) + (sel >= 0 ? ', ' + PLACE(sel) : ''))}">
        <i class="tbar" aria-hidden="true"></i>
        <span class="dtext"><span class="dn"><span class="dfirst">${esc(d.first)} </span><b>${esc(d.last)}</b></span>
          <small>${esc(d.team || '')}${pct ? ` · ${esc(t('f1.winPct', { p: pct }))}` : ''}</small></span>
        ${sel >= 0 ? `<span class="dsel">${sel === 0 && !locked ? '★ ' : ''}${PLACE(sel)}</span>` : ''}
        ${fin >= 0 ? `<span class="dfin" title="${esc(t('f1.resultTitle'))}">${PLACE(fin)}</span>` : ''}
      </button></li>`;
    }).join('');
    updateEntry();
  }

  function updateEntry() {
    const n = draft.filter(Boolean).length;
    $('#progress-text').textContent = data.locked ? '' : t('f1.progress', { n });
    $('#progress-fill').style.width = (n / 3 * 100) + '%';
    const xp = data.expert;
    const same = xp ? draft.filter((id, i) => id && id === xp[i]).length : 0;
    $('#agree').textContent = xp && n && !data.locked ? t('f1.agree', { a: same }) : '';

    const btn = $('#submit'), name = $('#username');
    const unchanged = data.me && data.me.picks.every((id, i) => id === draft[i]) && data.me.username === name.value.trim()
      && (data.me.email || '') === $('#email').value.trim().toLowerCase() && !!data.me.optIn === $('#optin').checked;
    [name, $('#email'), $('#optin')].forEach(el => { el.disabled = data.locked; });
    const out = data.locked && !data.me; // race started and you didn't enter: just show the list
    $('.entry-form').hidden = out;
    $('#my-pod').hidden = out;
    btn.classList.toggle('saved', !!unchanged);
    if (data.locked) {
      btn.disabled = true;
      btn.textContent = data.me ? t('btn.locked') : t('btn.closed');
      $('#lock-sub').textContent = data.me ? t('f1.lockedMe') : t('f1.lockedNo');
    } else {
      btn.disabled = saving || n !== 3 || unchanged;
      btn.textContent = saving ? t('btn.saving') : unchanged ? t('btn.saved') : data.me ? t('btn.update') : t('btn.submit');
      $('#lock-sub').textContent = t('f1.howTo');
    }
  }

  function renderBoard() {
    const rows = data.leaderboard.rows;
    const myName = data.me && data.me.username.toLowerCase();
    const isMe = r => !r.expert && r.name.toLowerCase() === myName;
    const xr = expertRow();
    $('#board-sub').textContent = t(data.entries === 1 ? 'board.players1' : 'board.playersN', { n: data.entries });
    $('#board-t').classList.toggle('with-prize', data.final);
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
        <td class="num prize-col">${!r.expert && r.prize ? L.money(r.prize) : ''}</td></tr>`;
    });
    $('#rows').innerHTML = rows.length ? html : `<tr><td colspan="4" class="board-empty">${esc(t('board.empty'))}</td></tr>`;
    $('#board-note').textContent = data.final ? t('board.noteFinal') : t('f1.boardPending', { n: data.leaderboard.prizes.length, pool: L.money(data.leaderboard.pool) });
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
  $('#drivers').addEventListener('click', e => {
    const b = e.target.closest('button[data-driver]');
    if (!b || b.disabled || !data || data.locked) return;
    const id = b.dataset.driver;
    const was = draft.indexOf(id);
    if (was >= 0) { draft[was] = null; slot = was; }     // tap a chosen driver again to take him off
    else {
      const at = activeSlot();
      if (at === -1) { setStatus(t('f1.full'), 'error'); return; } // podium full: tap a spot or a chosen driver first
      draft[at] = id;
      slot = null;                                       // move on to the next empty spot
    }
    saveDraft();
    renderMine();
    renderDrivers();
    const again = document.querySelector(`button[data-driver="${CSS.escape(id)}"]`);
    if (again) again.focus({ preventScroll: true });
    setStatus('');
    if (draft.every(Boolean) && was < 0 && !$('#username').value.trim()) $('.entry-form').scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
  $('#my-pod').addEventListener('click', e => {
    if (data.locked) return;
    const x = e.target.closest('button[data-clear]');
    if (x) { draft[Number(x.dataset.clear)] = null; slot = Number(x.dataset.clear); }
    else {
      const b = e.target.closest('button[data-slot]');
      if (!b) return;
      slot = Number(b.dataset.slot);                     // the next driver you tap goes here
    }
    saveDraft(); renderMine(); renderDrivers();
  });
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
