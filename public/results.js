(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LOCALE = 'en-US';
  const longFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const shortFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const day = d => new Date(d + 'T12:00:00Z');
  const money = n => n ? '$' + (Number.isInteger(n) ? n.toLocaleString(LOCALE) : n.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : '';
  const names = list => list.length <= 2 ? list.join(' and ') : `${list.slice(0, 2).join(', ')} and ${list.length - 2} more`;

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
    $('#season-rows').innerHTML = body.join('') || '<tr><td colspan="7" class="muted">The season table starts once the first Saturday game ends.</td></tr>';
    const more = $('#season-more');
    more.hidden = seasonRows.length <= TOP;
    more.textContent = seasonAll ? 'Show top 50' : `Show all ${seasonRows.length} players`;
  }
  $('#season-more').addEventListener('click', () => { seasonAll = !seasonAll; renderSeason(); });
  async function showSeason() {
    try {
      const res = await fetch('/api/season', { cache: 'no-store' });
      const d = await res.json();
      if (!res.ok) throw new Error();
      seasonData = d; seasonRows = d.rows || [];
      $('#season').hidden = false;
      $('#season-h').textContent = `${d.name.charAt(0).toUpperCase() + d.name.slice(1)} standings`;
      $('#season-sub').textContent = `Week ${d.weeksDone} of ${d.weeks}`;
      $('#season-note').textContent = d.finished
        ? 'Final season standings. Winners must be eligible. Ties share the prizes for the places they cover.'
        : `Prizes as things stand now. The ${money(d.pool)} season pool is paid to the top ${d.prizes.length} after the last Saturday (${new Intl.DateTimeFormat(LOCALE, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(day(d.end))}).`;
      const facts = $('#res-facts');
      facts.hidden = false;
      const leaders = seasonRows.filter(r => r.rank === 1).map(r => r.name);
      facts.innerHTML = `
        <div><dt>Season</dt><dd>${esc(shortFmt.format(day(d.start)).replace(/, \d{4}$/, ''))} to ${esc(shortFmt.format(day(d.end)).replace(/, \d{4}$/, ''))}</dd></div>
        <div><dt>Saturdays played</dt><dd>${d.weeksDone} of ${d.weeks}</dd></div>
        <div><dt>Season pool</dt><dd>${money(d.pool)}</dd></div>
        <div><dt>Leader</dt><dd>${leaders.length ? esc(names(leaders)) : '–'}</dd></div>`;
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
      if (!res.ok) throw new Error(data.error || 'Past results couldn’t load.');
      const sats = data.saturdays || [];
      $('#list-count').textContent = sats.length ? `${sats.length} ${sats.length === 1 ? 'Saturday' : 'Saturdays'}` : '';
      $('#list-rows').innerHTML = sats.length ? sats.map(s => {
        const link = `/results?date=${encodeURIComponent(s.date)}`;
        if (s.unavailable) return `<tr><td><a href="${link}">${esc(shortFmt.format(day(s.date)))}</a></td><td colspan="5" class="muted">Results unavailable right now</td></tr>`;
        const winner = s.winners && s.winners.length ? esc(names(s.winners)) : '<span class="muted">No entries</span>';
        return `<tr>
          <td class="rdate"><a href="${link}">${esc(shortFmt.format(day(s.date)))}</a>${s.complete ? '' : ' <span class="tag">In progress</span>'}</td>
          <td class="rwin">${winner}</td>
          <td class="num rnum">${s.topScore ?? '–'}${s.games ? `<small>/${s.games}</small>` : ''}</td>
          <td class="num rnum">${s.georges ?? '–'}${s.georges != null && s.games ? `<small>/${s.games}</small>` : ''}</td>
          <td class="num">${s.beatGeorges || 0}</td>
          <td class="num">${s.players || 0}</td></tr>`;
      }).join('') : '<tr><td colspan="6" class="muted">No finished Saturdays yet. Results show up here after the first Saturday is over.</td></tr>';
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
      || '<tr><td colspan="4" class="board-empty">Nobody entered this Saturday.</td></tr>';
    const more = $('#final-more');
    more.hidden = rows.length <= TOP + 1;
    more.textContent = showAll ? 'Show top 25' : `Show all ${rows.length - 1} players`;
  }
  $('#final-more').addEventListener('click', () => { showAll = !showAll; renderStandings(); });

  async function showDay(date) {
    $('#res-back').hidden = false;
    $('#detail').hidden = false;
    try {
      const res = await fetch('/api/results/' + encodeURIComponent(date), { cache: 'no-store' });
      const r = await res.json();
      if (!res.ok) throw new Error(r.error || 'That Saturday couldn’t load.');
      const s = r.summary;
      document.title = `${shortFmt.format(day(date))} results | Beat Georges`;
      $('#res-title').textContent = longFmt.format(day(date));
      $('#res-sub').textContent = r.complete ? 'Final results' : 'Results so far. Some games weren’t final yet.';
      const facts = $('#res-facts');
      facts.hidden = false;
      facts.innerHTML = `
        <div><dt>${s.winners.length > 1 ? 'Winners' : 'Winner'}</dt><dd>${s.winners.length ? esc(names(s.winners)) : '–'}</dd></div>
        <div><dt>Top score</dt><dd>${s.topScore ?? '–'} of ${s.games}</dd></div>
        <div><dt>Georges</dt><dd>${s.georges ?? '–'} of ${s.games}</dd></div>
        <div><dt>Players</dt><dd>${s.players}</dd></div>`;

      rows = r.rows || [];
      renderStandings();
      $('#final-sub').textContent = `${s.players} ${s.players === 1 ? 'player' : 'players'}, ${s.beatGeorges} beat Georges`;

      const play = r.games.filter(g => g.state !== 'void');
      let hits = 0;
      $('#game-rows').innerHTML = r.games.map(g => {
        const xp = r.expert && r.expert[g.id];
        const team = t => `<span class="gteam ${g.winner ? (g.winner === t.abbr ? 'won' : 'lost') : ''}">${logo(t)}<span>${esc(window.teamInfo(t).city)} ${esc(window.teamInfo(t).name)}</span></span>`;
        let gl = '<span class="gl-none">–</span>';
        if (xp) {
          const hit = g.winner && xp === g.winner;
          if (hit) hits++;
          gl = `<span class="gl-pick ${g.winner ? (hit ? 'hit' : 'miss') : ''}" title="Georges’ pick">${esc(xp)}</span>`;
        }
        const end = g.state === 'void' ? 'Postponed' : g.endedIn === 'OT' ? 'Final/OT' : g.endedIn === 'SO' ? 'Final/SO' : g.state === 'final' ? 'Final' : 'Not final';
        return `<li class="grow ${g.state === 'void' ? 'is-void' : ''}"><span class="gend">${esc(end)}</span><span class="gteams">${team(g.away)}${team(g.home)}</span><span class="gl-col">${gl}</span></li>`;
      }).join('');
      $('#games-sub').textContent = `Georges went ${hits}–${play.filter(g => g.winner).length - hits}`;
    } catch (err) {
      $('#detail').hidden = true;
      status(err.message + ' ', 'error');
    }
  }

  const date = new URLSearchParams(location.search).get('date');
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) showDay(date); else { showSeason(); showList(); }
})();
