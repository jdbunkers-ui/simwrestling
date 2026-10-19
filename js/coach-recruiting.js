/* Sim Wrestling v4.3.0 — authenticated recruiting headquarters */
(async function () {
  'use strict';
  const root = document.getElementById('coach-recruiting-root');
  if (!root) return;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const text = (...values) => values.find(value => String(value ?? '').trim()) ?? '';
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const label = value => String(value || '').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
  const prospectName = row => text(row.wrestler_name, row.display_name, row.name, 'Unknown recruit');
  const empty = message => `<div class="recruit-empty">${esc(message)}</div>`;
  const fail = message => {
    root.innerHTML = `<section class="panel coach-gate"><h1>Recruiting</h1><p>${esc(message)}</p><p><a href="account.html">My Account</a> · <a href="login.html">Sign in</a></p></section>`;
  };

  let auth;
  let overview;
  let catalog = [];
  let board = [];
  let searchRows = [];
  let activeTab = 'overview';
  let working = false;
  let openPackage = null;

  async function rpc(name, args) {
    const {data, error} = await auth.client.rpc(name, args || {});
    if (error) throw error;
    return data;
  }

  async function loadCore() {
    const [overviewData, catalogData, boardData] = await Promise.all([
      rpc('get_my_recruiting_overview_v4_3_0'),
      rpc('get_my_scouting_catalog_v4_3_0'),
      rpc('get_my_big_board_v4_3_0')
    ]);
    overview = overviewData || {};
    catalog = Array.isArray(catalogData?.packages) ? catalogData.packages : [];
    board = Array.isArray(boardData?.recruits) ? boardData.recruits : [];
  }

  function shell() {
    document.title = `${overview.team_name || 'My College'} — Recruiting | Sim Wrestling`;
    root.innerHTML = `
      <section class="coach-live-hero recruit-hero">
        <div><p class="eyebrow">YOUR COLLEGE · WEEK ${esc(overview.recruiting_week || '—')}</p><h1>${esc(overview.team_name || 'Recruiting')}</h1><p>${esc(overview.season_code || 'Current season')} · ${esc(overview.league_date || '')}</p></div>
        <div class="recruit-balance-seal"><strong>${number(overview.available_points)}</strong><span>points available</span></div>
      </section>
      <nav class="coach-subnav" aria-label="Private coaching pages"><a href="coach.html">Coach</a><a href="coach-matches.html">Matches</a><a href="coach-recruiting.html" class="active" aria-current="page">Recruit</a><a href="coach-history.html">Program History</a></nav>
      <div class="coach-summary-grid recruit-summary">
        <article><span>Available</span><strong data-summary="available">${number(overview.available_points)}</strong><small>Rolled forward this season</small></article>
        <article><span>Awarded</span><strong data-summary="awarded">${number(overview.points_awarded)}</strong><small>100 points each week</small></article>
        <article><span>Scouting</span><strong data-summary="scouting">${number(overview.scouting_points_spent)}</strong><small>Points spent on results</small></article>
        <article><span>Persuasion</span><strong data-summary="persuasion">${number(overview.persuasion_points_spent)}</strong><small>Points spent on recruits</small></article>
      </div>
      <div class="recruit-workspace">
        <nav class="recruit-tabs" role="tablist" aria-label="Recruiting workspace">
          <button type="button" data-tab="overview" class="active" aria-selected="true">Overview</button>
          <button type="button" data-tab="search" aria-selected="false">Search &amp; Scout</button>
          <button type="button" data-tab="board" aria-selected="false">Big Board <span>${board.length}</span></button>
        </nav>
        <p class="recruit-feedback" id="recruit-feedback" role="status" aria-live="polite"></p>
        <section id="recruit-panel"></section>
      </div>`;
    root.querySelector('.recruit-tabs').addEventListener('click', event => {
      const button = event.target.closest('[data-tab]');
      if (!button || working) return;
      activeTab = button.dataset.tab;
      root.querySelectorAll('[data-tab]').forEach(item => {
        const selected = item.dataset.tab === activeTab;
        item.classList.toggle('active', selected);
        item.setAttribute('aria-selected', String(selected));
      });
      renderPanel();
    });
    renderPanel();
  }

  function setFeedback(message, kind = '') {
    const el = document.getElementById('recruit-feedback');
    if (!el) return;
    el.textContent = message || '';
    el.className = `recruit-feedback ${kind ? `is-${kind}` : ''}`;
  }

  function updateSummary() {
    const sources = {available:'available_points',awarded:'points_awarded',scouting:'scouting_points_spent',persuasion:'persuasion_points_spent'};
    ['available','awarded','scouting','persuasion'].forEach(key => {
      const source = sources[key];
      const el = root.querySelector(`[data-summary="${key}"]`);
      if (el) el.textContent = number(overview[source]);
    });
    const badge = root.querySelector('[data-tab="board"] span');
    if (badge) badge.textContent = board.length;
    const seal = root.querySelector('.recruit-balance-seal strong');
    if (seal) seal.textContent = number(overview.available_points);
  }

  function renderOverview() {
    const types = Array.isArray(overview.action_types) ? overview.action_types : [];
    const owned = catalog.filter(item => item.purchased).length;
    return `
      <div class="recruit-overview-grid">
        <section class="panel recruit-card recruit-callout"><p class="eyebrow">THIS WEEK</p><h2>Build information, then build relationships.</h2><p>Search the free geographic inventory, purchase completed result packages, flag recruits and use up to three eligible actions on a recruit each week.</p><button type="button" class="recruit-primary" data-open-tab="search">Search prospects</button></section>
        <section class="panel recruit-card"><p class="eyebrow">YOUR PIPELINE</p><h2>${board.length} active targets</h2><dl class="recruit-mini-stats"><div><dt>Scouting packages</dt><dd>${owned}</dd></div><div><dt>Week</dt><dd>${number(overview.recruiting_week)}</dd></div><div><dt>Unused points</dt><dd>${number(overview.available_points)}</dd></div></dl><button type="button" class="recruit-secondary" data-open-tab="board">Open Big Board</button></section>
      </div>
      <section class="panel recruit-section"><div class="panel-heading"><div><p class="eyebrow">PERSUASION MENU</p><h2>Available recruiting actions</h2></div></div>
        <div class="recruit-action-menu">${types.map(action => `<article><strong>${esc(text(action.action_name, action.display_name, label(action.action_code)))}</strong><span>${number(action.point_cost)} points</span><small>${action.once_per_stage_ind ? 'Once per high-school stage' : 'Up to weekly action limits'} · Available from stage ${esc(action.minimum_stage_rank || '—')}</small></article>`).join('') || empty('No active recruiting actions were returned.')}</div>
      </section>`;
  }

  function searchForm() {
    return `<form class="recruit-search-form" id="prospect-search-form">
      <label>Name<input name="p_name" type="search" placeholder="Search wrestler name"></label>
      <label>State<input name="p_state_code" maxlength="2" placeholder="NJ"></label>
      <label>Class<select name="p_academic_stage"><option value="">All classes</option><option value="HIGH_SCHOOL_FRESHMAN">Freshman</option><option value="HIGH_SCHOOL_SOPHOMORE">Sophomore</option><option value="HIGH_SCHOOL_JUNIOR">Junior</option><option value="HIGH_SCHOOL_SENIOR">Senior</option></select></label>
      <label>Weight<select name="p_weight_class_code"><option value="">All weights</option>${(window.SimSite?.highSchoolWeightOrder || []).map(weight => `<option>${esc(weight)}</option>`).join('')}</select></label>
      <button class="recruit-primary" type="submit">Find recruits</button>
    </form>`;
  }

  function prospectRows() {
    if (!searchRows.length) return empty('Use the filters above to search the free high-school prospect inventory.');
    return `<div class="recruit-prospect-list">${searchRows.map(row => {
      const flagged = Boolean(row.flagged);
      return `<article class="recruit-prospect-row"><div><strong>${esc(prospectName(row))}</strong><span>${esc(text(row.weight_class_code, '—'))} · ${esc(label(row.academic_stage || 'High school'))}</span><small>${esc(text(row.county_name, row.hometown_display, row.hometown_city, 'Location unavailable'))}${row.state_code ? `, ${esc(row.state_code)}` : ''}</small></div><button type="button" class="${flagged ? 'recruit-flagged' : 'recruit-secondary'}" data-flag-recruit="${esc(row.wrestler_guid)}" ${flagged ? 'disabled' : ''}>${flagged ? 'On Big Board' : 'Flag recruit'}</button></article>`;
    }).join('')}</div>`;
  }

  function packageList() {
    return `<div class="recruit-package-tools"><label>Week<select id="package-week"><option value="">All</option>${[1,2,3,4,5,6,7,8].map(week => `<option value="${week}">Week ${week}</option>`).join('')}</select></label><label>Find a package<input id="package-query" type="search" placeholder="County, state or event"></label><label class="recruit-check"><input id="package-owned" type="checkbox"> Purchased only</label></div><div id="package-list"></div>`;
  }

  function renderPackages() {
    const host = document.getElementById('package-list');
    if (!host) return;
    const week = document.getElementById('package-week')?.value;
    const query = String(document.getElementById('package-query')?.value || '').trim().toLowerCase();
    const ownedOnly = Boolean(document.getElementById('package-owned')?.checked);
    const rows = catalog.filter(item => (!week || String(item.week_number) === week) && (!query || String(item.package_name || '').toLowerCase().includes(query)) && (!ownedOnly || item.purchased)).slice(0, 100);
    host.innerHTML = rows.length ? `<div class="recruit-package-list">${rows.map(item => {
      const locked = !item.result_available || number(item.week_number) > number(overview.recruiting_week);
      return `<article class="recruit-package-row"><div><span class="recruit-scope">Week ${esc(item.week_number)} · ${esc(label(item.scope_level))}</span><strong>${esc(item.package_name)}</strong><small>${item.result_available ? 'Results available' : 'Results have not started'} · ${number(item.point_cost)} points</small></div><div class="recruit-package-actions">${item.purchased ? `<button type="button" class="recruit-primary" data-view-package="${esc(item.scouting_package_guid)}">View results</button>` : `<button type="button" class="recruit-secondary" data-buy-package="${esc(item.scouting_package_guid)}" ${locked || working ? 'disabled' : ''}>Unlock · ${number(item.point_cost)}</button>`}</div></article>`;
    }).join('')}</div>${rows.length === 100 ? '<p class="coach-detail-note">Showing the first 100 matching packages. Narrow the search to find a specific county or event.</p>' : ''}` : empty('No scouting packages match these filters.');
  }

  function renderSearch() {
    return `<section class="panel recruit-section"><div class="panel-heading"><div><p class="eyebrow">FREE INVENTORY</p><h2>Search prospects</h2><p class="recruit-heading-note">Names and geography are free. Results require a scouting package.</p></div></div>${searchForm()}<div id="prospect-results">${prospectRows()}</div></section>
      <section class="panel recruit-section"><div class="panel-heading"><div><p class="eyebrow">SCOUTING MARKET</p><h2>Purchase result packages</h2><p class="recruit-heading-note">A purchase updates as sessions finish and remains available under its season retention rule.</p></div></div>${packageList()}</section>
      <section class="panel recruit-results" id="scouting-results" hidden></section>`;
  }

  function boardRows() {
    if (!board.length) return empty('Your Big Board is empty. Search the prospect inventory or flag a wrestler from purchased results.');
    const types = Array.isArray(overview.action_types) ? overview.action_types : [];
    return `<div class="recruit-board-list">${board.map(item => {
      const p = item.prospect || {};
      return `<article class="recruit-board-row" data-board-row="${esc(p.wrestler_guid)}"><div class="recruit-board-person"><strong>${esc(prospectName(p))}</strong><span>${esc(text(p.weight_class_code, '—'))} · ${esc(label(p.academic_stage || 'High school'))}</span><small>${esc(text(p.county_name, p.hometown_display, p.hometown_city, 'Location unavailable'))}${p.state_code ? `, ${esc(p.state_code)}` : ''} · ${number(item.recruiting_points)} recruiting points</small></div><label>Priority<select data-priority>${[1,2,3,4,5].map(rank => `<option value="${rank}" ${number(item.priority_rank || 3) === rank ? 'selected' : ''}>${rank}</option>`).join('')}</select></label><label class="recruit-note">Coach note<input data-note maxlength="1000" value="${esc(item.coach_note || '')}" placeholder="Fit, needs or follow-up"></label><button type="button" class="recruit-secondary" data-save-board="${esc(p.wrestler_guid)}">Save</button><label>Action<select data-action><option value="">Choose action</option>${types.map(action => `<option value="${esc(action.action_code)}">${esc(text(action.action_name, label(action.action_code)))} · ${number(action.point_cost)}</option>`).join('')}</select></label><button type="button" class="recruit-primary" data-submit-action="${esc(p.wrestler_guid)}">Submit action</button><button type="button" class="recruit-remove" data-remove-board="${esc(p.wrestler_guid)}">Remove</button></article>`;
    }).join('')}</div>`;
  }

  function renderBoard() {
    return `<section class="panel recruit-section"><div class="panel-heading"><div><p class="eyebrow">YOUR TARGETS</p><h2>Big Board</h2><p class="recruit-heading-note">Prioritize recruits, keep notes and spend from the same balance used for scouting.</p></div><span class="record-pill">${board.length} active</span></div><div id="big-board-list">${boardRows()}</div></section>`;
  }

  function renderPanel() {
    const panel = document.getElementById('recruit-panel');
    if (!panel) return;
    panel.innerHTML = activeTab === 'search' ? renderSearch() : activeTab === 'board' ? renderBoard() : renderOverview();
    panel.querySelectorAll('[data-open-tab]').forEach(button => button.addEventListener('click', () => {
      activeTab = button.dataset.openTab;
      root.querySelector(`[data-tab="${activeTab}"]`)?.click();
    }));
    if (activeTab === 'search') {
      document.getElementById('prospect-search-form')?.addEventListener('submit', runSearch);
      ['package-week','package-query','package-owned'].forEach(id => document.getElementById(id)?.addEventListener(id === 'package-query' ? 'input' : 'change', renderPackages));
      renderPackages();
    }
  }

  async function refresh() {
    await loadCore();
    updateSummary();
    renderPanel();
  }

  async function runSearch(event) {
    event.preventDefault();
    if (working) return;
    const form = new FormData(event.currentTarget);
    const args = {p_region_code:null,p_county_guid:null,p_limit:150};
    ['p_name','p_state_code','p_academic_stage','p_weight_class_code'].forEach(key => args[key] = String(form.get(key) || '').trim() || null);
    working = true; setFeedback('Searching prospects…');
    try {
      const data = await rpc('search_my_recruiting_prospects_v4_3_0', args);
      searchRows = Array.isArray(data) ? data : [];
      document.getElementById('prospect-results').innerHTML = prospectRows();
      setFeedback(`${searchRows.length} prospect${searchRows.length === 1 ? '' : 's'} found.`, 'success');
    } catch (error) { setFeedback(error.message || 'The prospect search failed.', 'error'); }
    finally { working = false; }
  }

  async function flagRecruit(wrestlerGuid, packageGuid = null) {
    if (working) return;
    working = true; setFeedback('Adding recruit to your Big Board…');
    try {
      await rpc('set_my_big_board_recruit_v4_3_0', {p_wrestler_guid:wrestlerGuid,p_priority_rank:3,p_coach_note:null,p_scouting_package_guid:packageGuid});
      searchRows.forEach(row => { if (row.wrestler_guid === wrestlerGuid) row.flagged = true; });
      await refresh();
      setFeedback('Recruit added to your Big Board.', 'success');
    } catch (error) { setFeedback(error.message || 'The recruit could not be flagged.', 'error'); }
    finally { working = false; }
  }

  async function buyPackage(packageGuid) {
    const item = catalog.find(row => row.scouting_package_guid === packageGuid);
    if (!item || working || !window.confirm(`Spend ${number(item.point_cost)} recruiting points to unlock ${item.package_name}?`)) return;
    working = true; setFeedback('Purchasing scouting package…');
    try {
      await rpc('purchase_my_scouting_package_v4_3_0', {p_scouting_package_guid:packageGuid});
      await refresh();
      setFeedback(`${item.package_name} is unlocked.`, 'success');
    } catch (error) { setFeedback(error.message || 'The scouting package could not be purchased.', 'error'); }
    finally { working = false; }
  }

  function score(a, b) {
    const left = a == null ? '—' : a;
    const right = b == null ? '—' : b;
    return `${esc(left)}–${esc(right)}`;
  }

  function renderPackageResults(data, packageGuid) {
    const host = document.getElementById('scouting-results');
    if (!host) return;
    const events = Array.isArray(data?.events) ? data.events : [];
    const duals = Array.isArray(data?.duals) ? data.duals : [];
    const tournaments = Array.isArray(data?.tournaments) ? data.tournaments : [];
    host.hidden = false;
    host.innerHTML = `<div class="panel-heading"><div><p class="eyebrow">UNLOCKED RESULTS</p><h2>${esc(data?.package?.package_name || 'Scouting results')}</h2></div><button type="button" class="recruit-close" data-close-results>Close</button></div>
      <div class="recruit-result-events">${events.map(event => `<span>${esc(text(event.display_event_name,event.event_name,'Event'))}</span>`).join('')}</div>
      ${duals.length ? `<h3>Duals</h3><div class="recruit-result-list">${duals.map(row => {
        const p = row.payload || {};
        return `<article><strong>${esc(text(row.display_event_name,row.event_name,p.event_name,'Dual result'))}</strong><span>${esc(text(row.team_1_name,p.team_1_name,'Team 1'))} ${score(row.team_1_score ?? p.team_1_score,row.team_2_score ?? p.team_2_score)} ${esc(text(row.team_2_name,p.team_2_name,'Team 2'))}</span></article>`;
      }).join('')}</div>` : ''}
      ${tournaments.length ? `<h3>Tournaments</h3><div class="recruit-tournament-list">${tournaments.map(row => {
        const payload = row.payload || {};
        const entries = Array.isArray(payload.entries) ? payload.entries : [];
        const bracket = Array.isArray(payload.bracket) ? payload.bracket : [];
        return `<details><summary><strong>${esc(text(row.tournament_name,row.event_name,'Tournament'))}</strong><span>${esc(text(row.weight_class_code,'—'))} · ${bracket.length} bouts</span></summary><div class="recruit-entry-chips">${entries.filter(entry => entry.wrestler_guid).map(entry => `<button type="button" data-flag-recruit="${esc(entry.wrestler_guid)}" data-package="${esc(packageGuid)}">${esc(text(entry.wrestler_name,entry.display_name,'Recruit'))} · Flag</button>`).join('')}</div><div class="table-wrap"><table class="coach-live-table recruit-bracket-table"><thead><tr><th>Round</th><th>Matchup</th><th>Score</th><th>Result</th><th></th></tr></thead><tbody>${bracket.map(bout => `<tr><td>${esc(text(bout.round_name,bout.round_code,'—'))}</td><td>${esc(text(bout.wrestler_1_name,'TBD'))} vs. ${esc(text(bout.wrestler_2_name,'TBD'))}</td><td>${score(bout.wrestler_1_match_score,bout.wrestler_2_match_score)}</td><td>${esc(label(bout.result_type || 'Pending'))}</td><td>${bout.match_guid ? `<button type="button" class="recruit-pbp-button" data-view-pbp="${esc(bout.match_guid)}">PBP</button>` : ''}</td></tr>`).join('')}</tbody></table></div></details>`;
      }).join('')}</div>` : ''}<div id="recruit-pbp"></div>`;
    host.scrollIntoView({behavior:'smooth',block:'start'});
  }

  async function viewPackage(packageGuid) {
    if (working) return;
    working = true; openPackage = packageGuid; setFeedback('Loading purchased results…');
    try {
      const data = await rpc('get_my_scouting_package_results_v4_3_0', {p_scouting_package_guid:packageGuid});
      renderPackageResults(data, packageGuid);
      setFeedback('Purchased scouting results loaded.', 'success');
    } catch (error) { setFeedback(error.message || 'The scouting results could not be loaded.', 'error'); }
    finally { working = false; }
  }

  async function viewPbp(matchGuid) {
    const host = document.getElementById('recruit-pbp');
    if (!host || working) return;
    working = true; host.innerHTML = empty('Loading play-by-play…');
    try {
      const rows = await rpc('get_my_scouted_match_pbp_v4_3_0', {p_match_guid:matchGuid});
      host.innerHTML = `<div class="recruit-pbp"><h3>Match play-by-play</h3>${Array.isArray(rows) && rows.length ? rows.map(row => `<p><span>${esc(row.segment_code || '')} ${row.clock_after_seconds != null ? esc(window.SimSite.duration(row.clock_after_seconds)) : ''}</span>${esc(text(row.pbp_text,row.move_name,row.event_type,'Event'))}</p>`).join('') : empty('No play-by-play events were returned.')}</div>`;
      host.scrollIntoView({behavior:'smooth',block:'nearest'});
    } catch (error) { host.innerHTML = empty(error.message || 'Play-by-play could not be loaded.'); }
    finally { working = false; }
  }

  async function updateBoard(wrestlerGuid, row) {
    if (working) return;
    working = true; setFeedback('Saving Big Board details…');
    try {
      await rpc('update_my_big_board_recruit_v4_3_0', {p_wrestler_guid:wrestlerGuid,p_priority_rank:Number(row.querySelector('[data-priority]').value),p_coach_note:row.querySelector('[data-note]').value || null});
      await refresh(); setFeedback('Big Board details saved.', 'success');
    } catch (error) { setFeedback(error.message || 'The Big Board details could not be saved.', 'error'); }
    finally { working = false; }
  }

  async function submitAction(wrestlerGuid, row) {
    const action = row.querySelector('[data-action]').value;
    if (!action) { setFeedback('Choose a recruiting action first.', 'error'); return; }
    if (working || !window.confirm(`Submit ${label(action)} for this recruit?`)) return;
    working = true; setFeedback('Submitting recruiting action…');
    try {
      await rpc('submit_my_recruiting_action_v4_3_0', {p_wrestler_guid:wrestlerGuid,p_action_code:action});
      await refresh(); setFeedback(`${label(action)} recorded.`, 'success');
    } catch (error) { setFeedback(error.message || 'The recruiting action could not be recorded.', 'error'); }
    finally { working = false; }
  }

  async function removeBoard(wrestlerGuid) {
    if (working || !window.confirm('Remove this recruit from your Big Board? Prior recruiting actions will remain in league history.')) return;
    working = true; setFeedback('Removing recruit…');
    try {
      await rpc('remove_my_big_board_recruit_v4_3_0', {p_wrestler_guid:wrestlerGuid});
      await refresh(); setFeedback('Recruit removed from your Big Board.', 'success');
    } catch (error) { setFeedback(error.message || 'The recruit could not be removed.', 'error'); }
    finally { working = false; }
  }

  root.addEventListener('click', event => {
    const flag = event.target.closest('[data-flag-recruit]');
    if (flag && !flag.disabled) { flagRecruit(flag.dataset.flagRecruit, flag.dataset.package || null); return; }
    const buy = event.target.closest('[data-buy-package]');
    if (buy) { buyPackage(buy.dataset.buyPackage); return; }
    const view = event.target.closest('[data-view-package]');
    if (view) { viewPackage(view.dataset.viewPackage); return; }
    const close = event.target.closest('[data-close-results]');
    if (close) { const host=document.getElementById('scouting-results'); if(host)host.hidden=true; openPackage=null; return; }
    const pbp = event.target.closest('[data-view-pbp]');
    if (pbp) { viewPbp(pbp.dataset.viewPbp); return; }
    const save = event.target.closest('[data-save-board]');
    if (save) { updateBoard(save.dataset.saveBoard, save.closest('[data-board-row]')); return; }
    const submit = event.target.closest('[data-submit-action]');
    if (submit) { submitAction(submit.dataset.submitAction, submit.closest('[data-board-row]')); return; }
    const remove = event.target.closest('[data-remove-board]');
    if (remove) removeBoard(remove.dataset.removeBoard);
  });

  try {
    auth = await window.SimAuth.ready;
    const {data:{user}, error} = await auth.client.auth.getUser();
    if (error || !user) { fail('Please sign in to access your recruiting headquarters.'); return; }
    await loadCore();
    shell();
  } catch (error) {
    fail(`The recruiting headquarters could not be loaded: ${error?.message || 'Unexpected error'}`);
  }
})();
