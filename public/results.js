(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const L = window.I18N, t = L.t;
  const LOCALE = L.LOCALE;
  const longFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const shortFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const day = d => new Date(d + 'T12:00:00Z');
  const noYear = d => new Intl.DateTimeFormat(LOCALE, { month: L.fr ? 'long' : 'short', day: 'numeric', timeZone: 'UTC' }).format(day(d));
  const money = n => n ? L.money(n) : '';
  const names = L.names;
  const team = x => L.teamName(window.teamInfo(x));

  // Team logo from the NHL feed, falling back to the team-color square
  const SHOW_LOGOS = window.SHOW_TEAM_LOGOS !== false;
  const dot = t => { const i = window.teamInfo(t); return `<i class="dot" style="--c:${i.color};--t:${i.trim}" aria-hidden="true"></i>`; };
  const logo = t => {
    if (!SHOW_LOGOS || !t.logo) return dot(t);
    const i = window.teamInfo(t);
    return `<img class="tlogo" src="${esc(t.logo)}" alt="" width="24" height="24" loading="lazy" data-c="${esc(i.color)}" data-t="${esc(i.trim)}">`;
  };
  document.addEventListener('error', e => {
    const im = e.target;
    if (!(im instanceof HTMLImageElement) || !im.classList.contains('tlogo')) return;
    const d = document.createElement('i');
    d.className = 'dot'; d.setAttribute('aria-hidden', 'true');
    d.style.setProperty('--c', im.dataset.c); d.style.setProperty('--t', im.dataset.t);
    im.replaceWith(d);
  }, true);

  const status = (msg, kind) => { const s = $('#res-status'); s.textContent = msg; s.className = 'status' + (kind ? ' ' + kind : ''); };

  /* ---------- Season standings ---------- */
  let seasonRows = [], seasonAll = false, seasonData = null;
  function renderSeason() {
    const TOP = 50;
    const list = seasonAll ? seasonRows : seasonRows.slice(0, TOP);
    const georges = seasonData.georges != null
      ? `<tr class="is-g"><td>–</td><td class="rwin"><span class="gname"><img class="gphoto xs" src="georges.jpg" alt="" width="22" height="22">Georges Laraque</span></td><td class="num rnum">${seasonData.georges}</td><td class="num">${seasonData.weeksDone}</td><td class="num">–</td><td class="num">–</td><td class="num"></td></tr>` : '';
    const at = list.findIndex(r => r.score <= seasonData.georges);
    const body = list.map(r => `<tr class="${r.rank === 1 ? 'lead' : ''}">
      <td class="rk">${r.rank}</td><td class="rwin">${esc(r.name)}</td><td class="num rnum">${r.score}</td>
      <td class="num">${r.weeks}</td><td class="num">${r.wins || 0}</td><td class="num">${r.best}</td>
      <td class="num sprize">${r.prize ? money(r.prize) : ''}</td></tr>`);
    if (georges) body.splice(at === -1 ? body.length : at, 0, georges);
    $('#season-rows').innerHTML = body.join('') || `<tr><td colspan="7" class="muted">${esc(t('res.seasonEmpty'))}</td></tr>`;
    const more = $('#season-more');
    more.hidden = seasonRows.length <= TOP;
    more.textContent = seasonAll ? t('res.showTop50') : t('res.showAllN', { n: seasonRows.length });
  }
  $('#season-more').addEventListener('click', () => { seasonAll = !seasonAll; renderSeason(); });
  async function showSeason() {
    try {
      const res = await fetch('/api/season', { cache: 'no-store' });
      const d = await res.json();
      if (!res.ok) throw new Error();
      seasonData = d; seasonRows = d.rows || [];
      $('#season').hidden = false;
      $('#season-h').textContent = t('res.standings', { season: L.seasonName(d.start, d.end) });
      $('#season-sub').textContent = t('season.week', { d: d.weeksDone, n: d.weeks });
      $('#season-note').textContent = d.finished
        ? t('res.seasonFinal')
        : t('res.seasonNow', { pool: money(d.pool), n: d.prizes.length, end: new Intl.DateTimeFormat(LOCALE, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(day(d.end)) });
      const facts = $('#res-facts');
      facts.hidden = false;
      const leaders = seasonRows.filter(r => r.rank === 1).map(r => r.name);
      facts.innerHTML = `
        <div><dt>${esc(t('res.fSeason'))}</dt><dd>${esc(t('res.fSeasonVal', { start: noYear(d.start), end: noYear(d.end) }))}</dd></div>
        <div><dt>${esc(t('res.fPlayed'))}</dt><dd>${esc(t('res.fPlayedVal', { d: d.weeksDone, n: d.weeks }))}</dd></div>
        <div><dt>${esc(t('res.fPool'))}</dt><dd>${money(d.pool)}</dd></div>
        <div><dt>${esc(t('res.fLeader'))}</dt><dd>${leaders.length ? esc(names(leaders)) : '–'}</dd></div>`;
      renderSeason();
      if (location.hash === '#season') $('#season').scrollIntoView();
    } catch { /* season table is optional on this page */ }
  }

  /* ---------- All Saturdays ---------- */
  async function showList() {
    $('#list').hidden = false;
    try {
      const res = await fetch('/api/results', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(t('res.loadFail'));
      const sats = data.saturdays || [];
      $('#list-count').textContent = sats.length ? t(sats.length === 1 ? 'res.satsN1' : 'res.satsN', { n: sats.length }) : '';
      $('#list-rows').innerHTML = sats.length ? sats.map(s => {
        const link = `/results?date=${encodeURIComponent(s.date)}`;
        if (s.unavailable) return `<tr><td><a href="${link}">${esc(shortFmt.format(day(s.date)))}</a></td><td colspan="5" class="muted">${esc(t('res.unavailable'))}</td></tr>`;
        const winner = s.winners && s.winners.length ? esc(names(s.winners)) : `<span class="muted">${esc(t('res.noEntries'))}</span>`;
        return `<tr>
          <td class="rdate"><a href="${link}">${esc(shortFmt.format(day(s.date)))}</a>${s.complete ? '' : ` <span class="tag">${esc(t('res.inProgress'))}</span>`}</td>
          <td class="rwin">${winner}</td>
          <td class="num rnum">${s.topScore ?? '–'}${s.games ? `<small>/${s.games}</small>` : ''}</td>
          <td class="num rnum">${s.georges ?? '–'}${s.georges != null && s.games ? `<small>/${s.games}</small>` : ''}</td>
          <td class="num">${s.beatGeorges || 0}</td>
          <td class="num">${s.players || 0}</td></tr>`;
      }).join('') : `<tr><td colspan="6" class="muted">${esc(t('res.noneYet'))}</td></tr>`;
    } catch (err) { status(err.message, 'error'); }
  }
  $('#list-rows').addEventListener('click', e => {
    const tr = e.target.closest('tr');
    const a = tr && tr.querySelector('a');
    if (a && e.target.tagName !== 'A') location.href = a.href;
  });

  /* ---------- One Saturday ---------- */
  let rows = [], showAll = false;
  function renderStandings() {
    const TOP = 25;
    const list = showAll ? rows : rows.slice(0, TOP + 1);
    $('#final-rows').innerHTML = list.map(r => `<tr class="${r.expert ? 'is-georges' : ''} ${r.rank === 1 ? 'top' : ''}">
      <td class="place">${r.expert ? '–' : r.rank}</td>
      <td class="player">${r.expert ? `<span class="gname"><img class="gphoto xs" src="georges.jpg" alt="" width="22" height="22">${esc(r.name)}</span>` : esc(r.name)}</td>
      <td class="pts">${r.score}</td>
      <td class="num prize-col">${!r.expert && r.prize ? money(r.prize) : ''}</td></tr>`).join('')
      || `<tr><td colspan="4" class="board-empty">${esc(t('res.nobody'))}</td></tr>`;
    const more = $('#final-more');
    more.hidden = rows.length <= TOP + 1;
    more.textContent = showAll ? t('res.showTop25') : t('res.showAllN', { n: rows.length - 1 });
  }
  $('#final-more').addEventListener('click', () => { showAll = !showAll; renderStandings(); });

  async function showDay(date) {
    $('#res-back').hidden = false;
    $('#detail').hidden = false;
    try {
      const res = await fetch('/api/results/' + encodeURIComponent(date), { cache: 'no-store' });
      const r = await res.json();
      if (!res.ok) throw new Error(t('res.dayFail'));
      const s = r.summary;
      document.title = t('res.dayTitle', { date: shortFmt.format(day(date)) });
      $('#res-title').textContent = longFmt.format(day(date));
      $('#res-sub').textContent = r.complete ? t('res.final') : t('res.partial');
      const facts = $('#res-facts');
      facts.hidden = false;
      facts.innerHTML = `
        <div><dt>${esc(t(s.winners.length > 1 ? 'res.winners' : 'res.winner'))}</dt><dd>${s.winners.length ? esc(names(s.winners)) : '–'}</dd></div>
        <div><dt>${esc(t('res.top'))}</dt><dd>${esc(t('res.ofN', { s: s.topScore ?? '–', n: s.games }))}</dd></div>
        <div><dt>Georges</dt><dd>${esc(t('res.ofN', { s: s.georges ?? '–', n: s.games }))}</dd></div>
        <div><dt>${esc(t('res.players'))}</dt><dd>${s.players}</dd></div>`;

      rows = r.rows || [];
      renderStandings();
      $('#final-sub').textContent = t(s.players === 1 ? 'res.finalSub1' : 'res.finalSub', { n: s.players, b: s.beatGeorges });

      const play = r.games.filter(g => g.state !== 'void');
      let hits = 0;
      $('#game-rows').innerHTML = r.games.map(g => {
        const xp = r.expert && r.expert[g.id];
        const side = tm => `<span class="gteam ${g.winner ? (g.winner === tm.abbr ? 'won' : 'lost') : ''}">${logo(tm)}<span>${esc(team(tm))}</span></span>`;
        let gl = '<span class="gl-none">–</span>';
        if (xp) {
          const hit = g.winner && xp === g.winner;
          if (hit) hits++;
          gl = `<span class="gl-pick ${g.winner ? (hit ? 'hit' : 'miss') : ''}" title="${esc(t('picks.georgesPick'))}">${esc(xp)}</span>`;
        }
        const end = t(g.state === 'void' ? 'g.postponed' : g.endedIn === 'OT' ? 'g.finalOT' : g.endedIn === 'SO' ? 'g.finalSO' : g.state === 'final' ? 'g.final' : 'g.notFinal');
        return `<li class="grow ${g.state === 'void' ? 'is-void' : ''}"><span class="gend">${esc(end)}</span><span class="gteams">${side(g.away)}${side(g.home)}</span><span class="gl-col">${gl}</span></li>`;
      }).join('');
      $('#games-sub').textContent = t('res.georgesWent', { w: hits, l: play.filter(g => g.winner).length - hits });
    } catch (err) {
      $('#detail').hidden = true;
      status(err.message + ' ', 'error');
    }
  }

  const date = new URLSearchParams(location.search).get('date');
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) showDay(date); else { showSeason(); showList(); }
})();
