/* Sim Wrestling v5.0.8 — shared public/coach Wall of Fame renderer. No editing or auth dependencies. */
(function () {
  'use strict';
  const mounted = new WeakMap();
  function mount(host, archive, identity) {
    if (!host || !archive || !Array.isArray(archive.seasons)) throw new Error('Invalid Wall of Fame response.');
    const root = host;
    const previous = mounted.get(root);
    if (previous) root.removeEventListener('click', previous.handler);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const validGuid = value => /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(String(value || ''));
  const safeColor = value => /^#[\da-f]{6}$/i.test(String(value || '')) ? String(value) : null;
  const integer = value => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 0;
  const placement = value => {
    if (value == null || value === '') return '<span class="fame-empty" aria-label="No top-eight finish">—</span>';
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 8) return '<span class="fame-empty">—</span>';
    return `<span class="fame-placement${n === 1 ? ' fame-champion' : ''}" aria-label="${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'} place">${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}</span>`;
  };
  const rank = (value, hasDuals) => {
    if (!hasDuals) return '<span class="fame-unranked">Unranked</span>';
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? `<strong class="fame-rank">#${n}</strong>` : '<span class="fame-empty">—</span>';
  };
  const names = {
    name: 'Wrestler Name', weight_class: 'Weight Class', state_finish: 'State Top 8',
    regional_finish: 'Regional Top 8', national_finish: 'National Top 8',
    bonus_wins: 'Bonus Wins', total_pins: 'Total Pins', total_wins: 'Total Wins'
  };
  const numericFields = new Set(['state_finish', 'regional_finish', 'national_finish', 'bonus_wins', 'total_pins', 'total_wins']);
  const sortBySeason = new Map();
  const expanded = new Set();
  let seasons = [];
  let seasonOrder = {field:'season',direction:'desc'};
  let fameTeamOpen = true, fameIndividualOpen = true;

  function sortGraduates(items, seasonGuid) {
    const preference = sortBySeason.get(seasonGuid) || { field: 'total_wins', direction: 'desc' };
    const { field, direction } = preference;
    return [...items].sort((a, b) => {
      if (numericFields.has(field)) {
        // Missing tournament placements always sort last, regardless of direction.
        const x = a[field] == null ? null : Number(a[field]);
        const y = b[field] == null ? null : Number(b[field]);
        if (x == null && y != null) return 1;
        if (y == null && x != null) return -1;
        if (x != null && y != null && x !== y) return direction === 'asc' ? x - y : y - x;
      } else {
        const x = String(a[field] || '').trim();
        const y = String(b[field] || '').trim();
        const order = x.localeCompare(y, undefined, {numeric: true, sensitivity: 'base'});
        if (order) return direction === 'asc' ? order : -order;
      }
      return String(a.name || '').localeCompare(String(b.name || '')) || String(a.wrestler_guid || '').localeCompare(String(b.wrestler_guid || ''));
    });
  }

  function renderGraduates(season, key) {
    if (season.graduate_history_status !== 'ARCHIVED') {
      return `<div class="fame-archive-message"><strong>Graduating class not archived.</strong><p>Career records for this early season were not preserved in the alumni archive. This does not mean the school had no seniors.</p></div>`;
    }
    const graduates = Array.isArray(season.graduating_seniors) ? season.graduating_seniors : [];
    if (!graduates.length) return '<div class="fame-archive-message">No graduating seniors are recorded for this season.</div>';
    const current = sortBySeason.get(key) || {field:'total_wins',direction:'desc'};
    const header = Object.entries(names).map(([field, label]) => {
      const isActive = field === current.field;
      const sortLabel = isActive ? (current.direction === 'asc' ? 'ascending' : 'descending') : 'none';
      const mark = isActive ? `<span class="fame-sort-mark" aria-hidden="true">${current.direction === 'asc' ? '▲' : '▼'}</span>` : '';
      return `<th scope="col" aria-sort="${sortLabel}"><button type="button" class="fame-sort" data-sort="${field}" data-season="${escape(key)}" aria-label="Sort graduates by ${escape(label)}${isActive ? ', currently ' + sortLabel : ''}">${escape(label)}${mark}</button></th>`;
    }).join('');
    const rows = sortGraduates(graduates, key).map(w => {
      const href = validGuid(w.wrestler_guid) ? `wrestler.html?wrestler=${encodeURIComponent(w.wrestler_guid)}` : null;
      const fullName = escape(w.name || 'Unknown wrestler');
      return `<tr>
        <td class="fame-wrestler">${href ? `<a class="wrestler-link" href="${href}" title="Open final wrestler profile for ${fullName}">${fullName}</a>` : fullName}</td>
        <td>${escape(w.weight_class || '—')}</td>
        <td>${placement(w.state_finish)}</td>
        <td>${placement(w.regional_finish)}</td>
        <td>${placement(w.national_finish)}</td>
        <td>${integer(w.bonus_wins)}</td>
        <td>${integer(w.total_pins)}</td>
        <td><strong>${integer(w.total_wins)}</strong></td>
      </tr>`;
    }).join('');
    return `<div class="fame-alumni-heading"><div><p class="eyebrow">Season ${integer(season.season)} · Alumni</p><h3>Graduating Seniors</h3></div><span class="record-pill">${graduates.length} wrestler${graduates.length === 1 ? '' : 's'}</span></div>
      <div class="table-wrap fame-alumni-scroll" role="region" aria-label="Season ${integer(season.season)} graduated seniors table" tabindex="0">
      <table class="fame-alumni-table"><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></div>
      <p class="fame-table-note">Tournament columns show the wrestler's actual senior-season finish if placed 1st–8th. Bonus wins, pins, and wins are final career totals. Select any column heading to sort.</p>`;
  }

  function sortedSeasons() {
    return [...seasons].sort((a,b)=>{
      const field=seasonOrder.field;
      const av=field==='graduating_seniors' ? (a.graduate_history_status==='ARCHIVED' ? (a.graduating_seniors||[]).length : -1) : field==='record_display' ? Number(a.wins||0)-Number(a.losses||0) : Number(a[field]??-1);
      const bv=field==='graduating_seniors' ? (b.graduate_history_status==='ARCHIVED' ? (b.graduating_seniors||[]).length : -1) : field==='record_display' ? Number(b.wins||0)-Number(b.losses||0) : Number(b[field]??-1);
      return (seasonOrder.direction==='asc' ? av-bv : bv-av)||Number(b.season)-Number(a.season);
    });
  }
  const sortableTeamHead=(field,label)=>`<th scope="col" aria-sort="${seasonOrder.field===field?(seasonOrder.direction==='asc'?'ascending':'descending'):'none'}"><button type="button" class="fame-sort sw-fame-team-sort" data-team-sort="${field}">${escape(label)}${seasonOrder.field===field?(seasonOrder.direction==='asc'?' ▲':' ▼'):''}</button></th>`;
  function renderTable() {
    const host = root.querySelector('#fame-season-results');
    if (!host) return;
    if (!seasons.length) {
      host.innerHTML = '<div class="fame-archive-message">No completed college seasons were returned for this program.</div>';
      return;
    }
    host.innerHTML = `<div class="table-wrap fame-season-scroll"><table class="fame-season-table">
      <thead><tr>${sortableTeamHead('season','Season')}${sortableTeamHead('record_display','W–L')}${sortableTeamHead('final_state_rank','Final State Ranking')}${sortableTeamHead('final_regional_rank','Final Region Ranking')}${sortableTeamHead('final_national_rank','Final National Ranking')}${sortableTeamHead('graduating_seniors','Graduates')}</tr></thead>
      <tbody>${sortedSeasons().map((season, index) => {
        const hasDuals = integer(season.wins)+integer(season.losses)+integer(season.ties)>0;
        const graduates = Array.isArray(season.graduating_seniors) ? season.graduating_seniors : [];
        const count = season.graduate_history_status === 'ARCHIVED' ? `${graduates.length}` : 'Not archived';
        return `<tr class="fame-season-row"><td><strong>${escape(season.season_display || 'Season ' + integer(season.season))}</strong></td>
          <td class="fame-record">${escape(season.record_display || `${integer(season.wins)}-${integer(season.losses)}`)}</td>
          <td>${rank(season.final_state_rank,hasDuals)}</td><td>${rank(season.final_regional_rank,hasDuals)}</td><td>${rank(season.final_national_rank,hasDuals)}</td>
          <td>${season.graduate_history_status === 'ARCHIVED' ? `<span class="fame-graduate-count">${count}</span>` : '<span class="fame-missing">Not archived</span>'}</td></tr>`;
      }).join('')}</tbody></table></div>`;
  }

  function handleClick(event) {
    const groupToggle=event.target.closest('[data-fame-group]');
    if(groupToggle){
      const group=groupToggle.dataset.fameGroup;
      if(group==='team')fameTeamOpen=!fameTeamOpen;else fameIndividualOpen=!fameIndividualOpen;
      root.querySelector('#fame-team-content').hidden=!fameTeamOpen;
      root.querySelector('#fame-individual-content').hidden=!fameIndividualOpen;
      root.querySelector('[data-fame-group="team"]').setAttribute('aria-expanded',String(fameTeamOpen));
      root.querySelector('[data-fame-group="individual"]').setAttribute('aria-expanded',String(fameIndividualOpen));
      return;
    }
    const teamSort=event.target.closest('[data-team-sort]');
    if(teamSort){
      const field=teamSort.dataset.teamSort;
      if(!['season','record_display','final_state_rank','final_regional_rank','final_national_rank','graduating_seniors'].includes(field))return;
      seasonOrder={field,direction:seasonOrder.field===field && seasonOrder.direction==='desc'?'asc':'desc'};
      renderTable();return;
    }
    const sort = event.target.closest('[data-sort]');
    if (sort && root.contains(sort)) {
      const field = sort.dataset.sort;
      const key = sort.dataset.season;
      if (!Object.hasOwn(names, field)) return;
      const prev = sortBySeason.get(key);
      const descendingDefault = numericFields.has(field) && !field.endsWith('_finish');
      const direction = prev?.field === field ? (prev.direction === 'asc' ? 'desc' : 'asc') : descendingDefault ? 'desc' : 'asc';
      sortBySeason.set(key, {field, direction});
      renderIndividuals();
      const next = [...root.querySelectorAll('[data-sort]')].find(button => button.dataset.sort === field && button.dataset.season === key);
      if (next) next.focus({preventScroll:true});
    }
  }

  function renderIndividuals() {
    const target=root.querySelector('#fame-individual-tables');
    if(!target)return;
    target.innerHTML=seasons.filter(season=>season.graduate_history_status==='ARCHIVED').map((season,index)=>{
      const key=validGuid(season.season_guid)?season.season_guid:`individual-${integer(season.season)}-${index}`;
      return `<div class="sw-fame-individual-season">${renderGraduates(season,key)}</div>`;
    }).join('') || '<p class="fame-archive-message">No archived graduates available.</p>';
  }
  const historySource = archive.ranking_source || '';
  seasons = archive.seasons.filter(season => Number.isInteger(Number(season.season)) && Number(season.season) > 0)
    .sort((a,b) => Number(b.season)-Number(a.season));

  const archived = seasons.filter(season => season.graduate_history_status === 'ARCHIVED');
  const alumni = archived.reduce((sum,season)=>sum+(Array.isArray(season.graduating_seniors)?season.graduating_seniors.length:0),0);
  const eligible = seasons.filter(season => integer(season.wins)+integer(season.losses)+integer(season.ties)>0);
  const ranks = eligible.map(season=>Number(season.final_national_rank)).filter(value=>Number.isInteger(value)&&value>0);
  const bestRank = ranks.length ? '#' + Math.min(...ranks) : '—';
  root.classList.add('fame-page');
  root.innerHTML = `
      <section class="fame-intro"><div><p class="eyebrow">The record book</p><h2>Every season writes a chapter.</h2><p>Explore your college's completed seasons, historical team rankings, and the seniors who helped build its legacy.</p></div></section>
      <div class="fame-summary-grid" aria-label="Program history at a glance">
        <article class="fame-summary-card"><span>Completed Seasons</span><strong>${seasons.length}</strong><small>Most recent: ${seasons.length ? `Season ${integer(seasons[0].season)}` : '—'}</small></article>
        <article class="fame-summary-card"><span>Best National Rank</span><strong>${escape(bestRank)}</strong><small>Reconstructed dual standings</small></article>
        <article class="fame-summary-card"><span>Graduated Alumni</span><strong>${alumni}</strong><small>${archived.length} archived graduating class${archived.length === 1 ? '' : 'es'}</small></article>
      </div>
      <section class="panel coach-live-panel fame-history-panel sw-fame-team-section" aria-label="Team season history">
        <div class="panel-heading"><div><p class="eyebrow">College record book</p><h2>Team Statistics</h2></div><span class="record-pill">${seasons.length} completed season${seasons.length === 1 ? '' : 's'}</span></div>
        <button class="sw-fame-collapse" type="button" data-fame-group="team" aria-expanded="true" aria-controls="fame-team-content">Expand / Collapse Team Statistics</button>
        <div id="fame-team-content"><p class="fame-season-help">Select a column heading to sort completed seasons. Rankings are shown for colleges that competed in dual meets.</p>
        <div id="fame-season-results"></div></div>
      </section>
      <section class="panel coach-live-panel sw-fame-individual-section" aria-label="Individual alumni statistics">
        <div class="panel-heading"><div><p class="eyebrow">Individual record book</p><h2>Individual Statistics</h2></div><span class="record-pill">${alumni} archived graduates</span></div>
        <button class="sw-fame-collapse" type="button" data-fame-group="individual" aria-expanded="true" aria-controls="fame-individual-content">Expand / Collapse Individual Statistics</button>
        <div id="fame-individual-content"><p class="fame-season-help">Archived wrestlers by graduating season. Select a column heading to sort, including weight class.</p>
          <div id="fame-individual-tables"></div>
        </div>
      </section>
      ${historySource === 'RECONSTRUCTED_DUAL_STANDINGS_V1' ? '<p class="fame-disclosure"><strong>About the rankings:</strong> Historical State, Regional, and National positions are reconstructed from season-ending dual-meet standings. They have not yet been frozen as official final ranking snapshots. Earlier seasons without a graduating-class archive are labeled accordingly.</p>' : '<p class="fame-disclosure">Ranking positions are supplied by the Sim Wrestling historical records service. Earlier seasons without graduating-class archives are labeled accordingly.</p>'}`;
  if (safeColor(identity?.primary_color)) root.style.setProperty('--fame-college-color',identity.primary_color);
  renderTable();
  renderIndividuals();
  root.addEventListener('click',handleClick);
  mounted.set(root,{handler:handleClick});
  }
  window.SimWallOfFame = {mount};
})();
