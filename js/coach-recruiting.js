/* Sim Wrestling v7.0.6 — Big Board capacity and removal controls */
(async function () {
  'use strict';
  const root = document.getElementById('coach-recruiting-root');
  if (!root) return;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const text = (...values) => values.find(value => String(value ?? '').trim()) ?? '';
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const label = value => String(value || '').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
  const stageLabel = rank => ({1:'Freshmen+',2:'Sophomores+',3:'Juniors+',4:'Seniors only'})[number(rank)] || 'Unavailable';
  const gradeLabel = stage => ({
    HIGH_SCHOOL_FRESHMAN:'Freshman',
    HIGH_SCHOOL_SOPHOMORE:'Sophomore',
    HIGH_SCHOOL_JUNIOR:'Junior',
    HIGH_SCHOOL_SENIOR:'Senior'
  })[String(stage || '').toUpperCase()] || 'High School';
  const prospectName = row => text(row.wrestler_name, row.display_name, row.name, 'Unknown recruit');
  const empty = message => `<div class="recruit-empty">${esc(message)}</div>`;
  const fail = message => {
    root.innerHTML = `<section class="panel coach-gate"><h1>Recruiting</h1><p>${esc(message)}</p><p><a href="account.html">My Account</a> · <a href="login.html">Sign in</a></p></section>`;
  };
  const recruitingClosed = leagueDate => {
    document.title = 'Recruiting is closed | Sim Wrestling';
    root.innerHTML = `
      <nav class="coach-subnav" aria-label="Private coaching pages"><a href="coach.html">Team</a><a href="coach-recruiting.html" class="active" aria-current="page">Recruits</a><a href="coach-matches.html">Schedule</a><a href="coach-history.html">Wall of Fame</a><a href="coach-identity.html">Identity</a></nav>
      <section class="panel coach-gate" aria-labelledby="recruiting-closed-title">
        <h1 id="recruiting-closed-title">Recruiting is closed</h1>
        <p>Recruiting actions are unavailable on the current game date.</p>
        <p>Current game position: ${esc(SimSite.gameDate(leagueDate))}</p>
        <p>You can continue managing your team or viewing your schedule.</p>
        <p><a href="coach.html">Return to your team</a> · <a href="coach-matches.html">View schedule</a></p>
      </section>`;
  };

  let auth;
  let overview = {};
  let pageActive = true;
  let currentUserId = null;
  let collegeIdentity=null;
  let catalog = [];
  let board = [];
  let pipeline = {};
  let searchRows = [];
  let activeTab = ['search','board','overview'].includes(String(SimSite.query('recruiting_tab') || ''))
    ? String(SimSite.query('recruiting_tab')) : 'board';
  let topOverrides = {};
  const expandedWeights = new Set();
  const requestedPackage = String(SimSite.query('package') || '').trim() || null;
  if (requestedPackage) activeTab = 'search';
  let working = false;
  let openPackage = null;
  let openPackageData = null;
  const searchDraft = {};
  const resources = Object.fromEntries(['board','catalog','pipeline'].map(key =>
    [key,{status:'idle',error:'',pending:null}]));
  const BOARD_LIMIT = 50;
  const boardCount = () => resources.board.status === 'ready' ? board.length : number(overview.active_big_board_qty);

  async function rpc(name, args) {
    const {data, error} = await auth.client.rpc(name, args || {});
    if (error) throw error;
    if(!pageActive)throw new Error('Account changed; reload recruiting.');
    return data;
  }

  async function loadOverview() {
    const data=await rpc('get_my_recruiting_overview_v4_3_0');
    if(!pageActive)return;
    overview=data || {};
    updateSummary();
  }
  function resourceMessage(key, name) {
    const state=resources[key];
    return state.status==='error'
      ? `<p class="coach-empty">${esc(name)} could not be loaded: ${esc(state.error)}</p><button type="button" class="recruit-secondary" data-retry-resource="${key}">Retry ${esc(name)}</button>`
      : `<p class="coach-empty" role="status">Loading ${esc(name.toLowerCase())}…</p>`;
  }
  function renderResource(key) {
    if(!pageActive)return;
    updateSummary();
    if(key==='board' && activeTab==='board') {
      const panel=document.getElementById('recruit-panel');
      if(panel)panel.innerHTML=renderBoard();
    }
    if(key==='pipeline' && activeTab==='search') {
      const host=document.getElementById('pipeline-dashboard');
      if(host)host.innerHTML=renderPipelineDashboard();
    }
    if(key==='catalog' && activeTab==='search') {
      const host=document.getElementById('scouting-market-content');
      if(host){
        host.innerHTML=resources.catalog.status==='ready' ? packageList() : resourceMessage('catalog','Scouting packages');
        if(resources.catalog.status==='ready'){renderPackageControls();renderPackages();}
      }
    }
  }
  function loadResource(key, force=false) {
    const state=resources[key];
    if(!pageActive)return Promise.resolve(false);
    if(state.pending)return state.pending;
    if(state.status==='ready' && !force)return Promise.resolve(true);
    if(state.status==='error' && !force)return Promise.resolve(false);
    state.status='loading';state.error='';renderResource(key);
    state.pending=(async()=>{
      try {
        if(key==='board') {
          const [data,selections]=await Promise.all([
            rpc('get_my_big_board_compact_v7_0_5'),rpc('get_my_top_prospects_v4_4_4')
          ]);
          if(!pageActive)return false;
          board=Array.isArray(data?.recruits)?data.recruits:[];
          topOverrides=Object.fromEntries((Array.isArray(selections)?selections:[])
            .map(x=>[String(x.weight_class_code),String(x.wrestler_guid)]));
        } else if(key==='catalog') {
          const data=await rpc('get_my_scouting_catalog_v4_3_0');
          if(!pageActive)return false;
          catalog=Array.isArray(data?.packages)?data.packages:[];
        } else {
          const data=await rpc('get_my_recruiting_pipeline_v4_4_0');
          if(!pageActive)return false;
          pipeline=data || {};
        }
        state.status='ready';return true;
      } catch(error) {
        if(pageActive){state.status='error';state.error=error?.message || 'Unexpected error';}
        return false;
      } finally {state.pending=null;renderResource(key);}
    })();
    return state.pending;
  }
  function selectTab(tab) {
    if(!['board','search','overview'].includes(tab) || working || !pageActive)return;
    activeTab=tab;
    root.querySelectorAll('[data-tab]').forEach(item=>{
      const selected=item.dataset.tab===activeTab;
      item.classList.toggle('active',selected);item.setAttribute('aria-selected',String(selected));
    });
    renderPanel();
  }

  function shell() {
    document.title = `${collegeIdentity?.display_name || overview.team_name || 'My College'} — Recruiting | Sim Wrestling`;
    root.innerHTML = `
      ${CoachIdentityBanner.render({identity:collegeIdentity,teamName:overview.team_name,context:'WEEK '+(overview.recruiting_week||'—'),detail:[SimSite.seasonLabel(overview),number(overview.available_points)+' recruiting points available'].filter(Boolean).join(' · ')})}
      <nav class="coach-subnav" aria-label="Private coaching pages"><a href="coach.html">Team</a><a href="coach-recruiting.html" class="active" aria-current="page">Recruits</a><a href="coach-matches.html">Schedule</a><a href="coach-history.html">Wall of Fame</a><a href="coach-identity.html">Identity</a></nav>
      <div class="coach-summary-grid recruit-summary">
        <article><span>Available</span><strong data-summary="available">${number(overview.available_points)}</strong><small>Rolled forward this season</small></article>
        <article><span>Awarded</span><strong data-summary="awarded">${number(overview.points_awarded)}</strong><small>100 per week · Weeks 2–8</small></article>
        <article><span>Scouting</span><strong data-summary="scouting">${number(overview.scouting_points_spent)}</strong><small>Points spent on results</small></article>
        <article><span>Persuasion</span><strong data-summary="persuasion">${number(overview.persuasion_points_spent)}</strong><small>Points spent on recruits</small></article>
      </div>
      <div class="recruit-workspace">
        <nav class="recruit-tabs" role="tablist" aria-label="Recruiting workspace">
          <button type="button" data-tab="board" class="${activeTab === 'board' ? 'active' : ''}" aria-selected="${activeTab === 'board'}">Big Board <span>${boardCount()} / ${BOARD_LIMIT}</span></button>
          <button type="button" data-tab="search" class="${activeTab === 'search' ? 'active' : ''}" aria-selected="${activeTab === 'search'}">Search &amp; Scout</button>
          <button type="button" data-tab="overview" class="${activeTab === 'overview' ? 'active' : ''}" aria-selected="${activeTab === 'overview'}">Overview</button>
        </nav>
        <p class="recruit-feedback" id="recruit-feedback" role="status" aria-live="polite"></p>
        <section id="recruit-panel"></section>
      </div>`;
    CoachIdentityBanner.apply(root,collegeIdentity);
    root.querySelector('.recruit-tabs').addEventListener('click', event => {
      const button = event.target.closest('[data-tab]');
      if (!button || working) return;
      selectTab(button.dataset.tab);
    });
    renderPanel();
  }

  function setFeedback(message, kind = '') {
    if(!pageActive)return;
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
    if (badge) badge.textContent = `${boardCount()} / ${BOARD_LIMIT}`;
    const pointsDetail=root.querySelector('.college-hero-meta');
    if(pointsDetail)pointsDetail.textContent=[collegeIdentity?.mascot,SimSite.seasonLabel(overview),number(overview.available_points)+' recruiting points available'].filter(Boolean).join(' · ');
  }

  function renderOverview() {
    const types = Array.isArray(overview.action_types) ? overview.action_types : [];
    const owned = number(overview.unlocked_package_qty);
    return `
      <div class="recruit-overview-grid">
        <section class="panel recruit-card recruit-callout"><p class="eyebrow">THIS WEEK</p><h2>Build information, then build relationships.</h2><p>Search the free geographic inventory, purchase completed result packages, open a prospect and submit one eligible action per recruit each week. Your first point adds him to your Big Board and unlocks his current-season matches.</p><button type="button" class="recruit-primary" data-open-tab="search">Search prospects</button></section>
        <section class="panel recruit-card"><p class="eyebrow">YOUR PIPELINE</p><h2>${boardCount()} / ${BOARD_LIMIT} active targets</h2><dl class="recruit-mini-stats"><div><dt>Scouting packages</dt><dd>${owned}</dd></div><div><dt>Week</dt><dd>${number(overview.recruiting_week)}</dd></div><div><dt>Unused points</dt><dd>${number(overview.available_points)}</dd></div></dl><button type="button" class="recruit-secondary" data-open-tab="board">Open Big Board</button></section>
      </div>
      <section class="panel recruit-section"><div class="panel-heading"><div><p class="eyebrow">PERSUASION MENU</p><h2>Available recruiting actions</h2></div></div>
        <div class="recruit-action-menu">${types.map(action => `<article><strong>${esc(text(action.action_name, action.display_name, label(action.action_code)))}</strong><span>${number(action.point_cost)} points</span><small>${action.once_per_stage_ind ? 'Once per high-school stage' : 'Up to weekly action limits'} · ${esc(stageLabel(action.minimum_stage_rank))}</small></article>`).join('') || empty('No active recruiting actions were returned.')}</div>
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
      return `<article class="recruit-prospect-row"><div><a class="recruit-prospect-link" href="${esc(SimSite.prospectUrl(row.wrestler_guid))}">${esc(prospectName(row))}</a><span>${esc(text(row.weight_class_code, '—'))} · ${esc(label(row.academic_stage || 'High school'))}</span><small>${esc(text(row.county_name, row.hometown_display, row.hometown_city, 'Location unavailable'))}${row.state_code ? `, ${esc(row.state_code)}` : ''}</small></div><button type="button" class="${flagged ? 'recruit-flagged' : 'recruit-secondary'}" data-flag-recruit="${esc(row.wrestler_guid)}" ${flagged ? 'disabled' : ''}>${flagged ? 'On Big Board' : 'Recruit prospect'}</button></article>`;
    }).join('')}</div>`;
  }

  let market = {scope:'COUNTY',state:'',county:'',region:'',week:'',weight:'',query:'',owned:false};
  const stateNames = {DE:'Delaware',MD:'Maryland',NJ:'New Jersey',NY:'New York',PA:'Pennsylvania',WV:'West Virginia'};
  const marketRows = () => catalog.filter(item => item.purchased || (item.result_available && number(item.week_number) <= number(overview.recruiting_week)));
  const optionsFor = (rows, key, name) => [...new Map(rows.filter(x=>x[key]).map(x=>[String(x[key]),text(x[name],stateNames[x[key]],x[key])])).entries()].sort((a,b)=>a[1].localeCompare(b[1]));
  const selectOptions = (options, selected) => options.map(([value,name])=>`<option value="${esc(value)}" ${String(selected)===String(value)?'selected':''}>${esc(name)}</option>`).join('');
  function packageList() {
    return '<div id="package-controls"></div><div id="package-list" aria-live="polite"></div>';
  }
  function renderPackageControls() {
    const host=document.getElementById('package-controls');
    if(!host)return;
    const rows=marketRows().filter(x=>x.scope_level===market.scope);
    const county=market.scope==='COUNTY', regional=market.scope==='REGION';
    const states=optionsFor(rows,'state_code','state_name');
    const counties=optionsFor(rows.filter(x=>!market.state||x.state_code===market.state),'county_guid','county_name');
    const regions=optionsFor(rows,'region_code','region_name');
    const weeks=[...new Set(rows.filter(x=>(!market.state||x.state_code===market.state)&&(!market.county||x.county_guid===market.county)).map(x=>number(x.week_number)))].sort((a,b)=>a-b).map(w=>[w,`Week ${w}`]);
    host.innerHTML=`<div class="recruit-package-tools recruit-market-filters">
      <label>Tournament level<select data-market="scope">${selectOptions([['COUNTY','County · 2 points / all weights'],['STATE','State · 12 points / weight'],['REGION','Regional · 8 points / weight'],['NATIONAL','National · 5 points / weight']],market.scope)}</select></label>
      ${county||market.scope==='STATE'?`<label>State<select data-market="state"><option value="">Choose a state</option>${selectOptions(states,market.state)}</select></label>`:''}
      ${county?`<label>County tournament<select data-market="county" ${!market.state?'disabled':''}><option value="">Choose a county</option>${selectOptions(counties,market.county)}</select></label><label>Week<select data-market="week"><option value="">All completed weeks</option>${selectOptions(weeks,market.week)}</select></label>`:''}
      ${regional&&rows.length?`<label>Regional tournament<select data-market="region"><option value="">Choose a region</option>${selectOptions(regions,market.region)}</select></label>`:''}
      ${!county&&rows.length?`<label>Weight class<select data-market="weight"><option value="">Choose a weight</option>${selectOptions(highSchoolWeights.map(w=>[w,w==='HWT'?'Heavyweight':w+' lb']),market.weight)}</select></label>`:''}
      <label>Find a package<input data-market="query" type="search" placeholder="Event name" value="${esc(market.query)}"></label>
      <label class="recruit-check"><input data-market="owned" type="checkbox" ${market.owned?'checked':''}> Purchased only</label>
    </div>`;
    host.querySelectorAll('[data-market]').forEach(input=>input.addEventListener(input.dataset.market==='query'?'input':'change',()=>{
      const key=input.dataset.market;market[key]=key==='owned'?input.checked:input.value;
      if(key==='scope'){Object.assign(market,{state:'',county:'',region:'',week:'',weight:''});}
      if(key==='state'){market.county='';market.week='';}
      if(key!=='query'&&key!=='owned')renderPackageControls();
      renderPackages();
    }));
  }
  function renderPackages() {
    const host=document.getElementById('package-list');if(!host)return;
    const available=marketRows().filter(x=>x.scope_level===market.scope);
    if(!available.length){host.innerHTML=empty(`${label(market.scope)} tournament packages will appear after results have been processed for this season.`);return;}
    if((market.scope==='COUNTY'&&(!market.state||!market.county)) || (market.scope==='STATE'&&!market.state) || (market.scope==='REGION'&&!market.region)){
      host.innerHTML=empty(market.scope==='COUNTY'?'Choose a state and county to see completed weekly packages.':`Choose a ${market.scope==='STATE'?'state':'region'} to see available brackets.`);return;
    }
    if(market.scope!=='COUNTY'&&!market.weight&&!market.owned){host.innerHTML=empty('Choose a weight class to see available championship brackets.');return;}
    const rows=available.filter(x=>(!market.state||x.state_code===market.state)&&(!market.county||x.county_guid===market.county)&&(!market.region||x.region_code===market.region)&&(!market.week||String(x.week_number)===market.week)&&(!market.weight||x.weight_class_code===market.weight||x.legacy_full_event)&&(!market.owned||x.purchased)&&(!market.query||String(x.package_name).toLowerCase().includes(market.query.trim().toLowerCase())));
    host.innerHTML=rows.length?`<div class="recruit-package-list">${rows.map(item=>`<article class="recruit-package-row"><div><span class="recruit-scope">Week ${esc(item.week_number)} · ${esc(label(item.scope_level))} · ${esc(item.weight_class_code||'All weights')}</span><strong>${esc(item.package_name)}</strong><small>${item.purchased?`Purchased · ${number(item.points_paid??item.point_cost)} points paid`:`${number(item.point_cost)} points`} · ${item.legacy_full_event?'Previously purchased full-event coverage':'Results available'}</small></div><div class="recruit-package-actions">${item.purchased?`<button type="button" class="recruit-primary" data-view-package="${esc(item.scouting_package_guid)}">View results</button>`:`<button type="button" class="recruit-secondary" data-buy-package="${esc(item.scouting_package_guid)}" ${working||number(overview.available_points)<number(item.point_cost)||number(overview.recruiting_week)<2?'disabled':''}>Unlock · ${number(item.point_cost)}</button>`}</div></article>`).join('')}</div>`:empty('No completed packages match these filters.');
  }

  function renderSearch() {
    return `<div id="pipeline-dashboard">${renderPipelineDashboard()}</div><section class="panel recruit-section"><div class="panel-heading"><div><p class="eyebrow">FREE INVENTORY</p><h2>Search prospects</h2><p class="recruit-heading-note">Search is free. Your first recruiting point adds a prospect to your Big Board and unlocks his current-season matches.</p></div></div>${searchForm()}<div id="prospect-results">${prospectRows()}</div></section>
      <section class="panel recruit-section"><div class="panel-heading"><div><p class="eyebrow">SCOUTING MARKET</p><h2>Purchase result packages</h2><p class="recruit-heading-note">County: 2 points for all weights in one county and week. State: 12, regional: 8, national: 5 points per weight-class bracket. Completed results appear below.</p></div></div>${`<div id="scouting-market-content">${resources.catalog.status==='ready'?packageList():resourceMessage('catalog','Scouting packages')}</div>`}</section>
      <section class="panel recruit-results" id="scouting-results" hidden></section>`;
  }

  const classRanks = {HIGH_SCHOOL_SENIOR:4,HIGH_SCHOOL_JUNIOR:3,HIGH_SCHOOL_SOPHOMORE:2,HIGH_SCHOOL_FRESHMAN:1};
  const classRank = item => classRanks[String(item.prospect?.academic_stage || '').toUpperCase()] || number(item.stage_rank);
  function comparePoints(a,b) {
    return number(b.recruiting_points)-number(a.recruiting_points)
      || prospectName(a.prospect || {}).localeCompare(prospectName(b.prospect || {}))
      || String(a.prospect?.wrestler_guid || '').localeCompare(String(b.prospect?.wrestler_guid || ''));
  }
  function filteredBoard() {
    return board.slice().sort((a,b)=>classRank(b)-classRank(a) || comparePoints(a,b));
  }

  function pipelineColumn(title, rows) {
    const values = Array.isArray(rows) ? rows : [];
    return `<section><h3>${esc(title)}</h3>${values.length ? `<ol>${values.map(row => `<li><span>${esc(row.geography_name || row.geography_code)}</span><strong>${number(row.roster_wrestler_qty)}</strong></li>`).join('')}</ol>` : '<p>No current roster pipeline.</p>'}</section>`;
  }

  function renderPipelineDashboard() {
    if(resources.pipeline.status!=='ready')return `<section class="panel recruit-pipeline-panel"><h2>Pipeline Strength</h2>${resourceMessage('pipeline','Pipeline')}</section>`;
    const rules = pipeline.bonus_rules || {};
    return `<section class="panel recruit-pipeline-panel"><div class="panel-heading"><div><p class="eyebrow">PRIVATE PROGRAM ADVANTAGE</p><h2>Pipeline Strength</h2><p class="recruit-heading-note">Current college wrestlers by hometown. Senior bonuses combine region, state and county matches.</p></div><span class="record-pill">${number(pipeline.roster_wrestler_qty)} wrestlers</span></div><div class="recruit-pipeline-grid">${pipelineColumn('Regions', pipeline.region_strengths)}${pipelineColumn('States', pipeline.state_strengths)}${pipelineColumn('Counties', pipeline.county_strengths)}</div><p class="recruit-pipeline-rule">Signing-weight bonus: ${number(rules.region_rate_percent, 2)}% per regional wrestler + ${number(rules.state_rate_percent, 2)}% per state wrestler + ${number(rules.county_rate_percent, 2)}% per county wrestler, capped at ${number(rules.maximum_bonus_percent)}%.</p></section>`;
  }

  const highSchoolWeights = ['106','113','120','126','132','138','144','150','157','165','175','190','215','HWT'];
  function chosenTop(weight, rows) {
    // Keep the existing points-based default when no saved selection exists.
    return rows.find(item => String(item.prospect?.wrestler_guid) === topOverrides[weight])
      || rows.reduce((best,item)=>!best || comparePoints(item,best)<0 ? item : best,null);
  }
  function recordFor(item) {
    const p = item.prospect || {};
    const wins = p.win_qty ?? p.wins ?? p.win_count ?? p.season_wins;
    const losses = p.loss_qty ?? p.losses ?? p.loss_count ?? p.season_losses;
    return wins == null || losses == null ? '—' : `${number(wins)}–${number(losses)}`;
  }
  function standingFor(item) {
    const sr = item.senior_outlook || {};
    return sr.recruiting_status ? label(sr.recruiting_status) : '—';
  }
  function chanceFor(item) {
    const prob = item.senior_outlook?.estimated_signing_probability_percent;
    return prob == null ? '—' : `${number(prob).toFixed(1)}%`;
  }
  function prospectCells(item, weight, selectable, selectedGuid) {
    const p = item.prospect || {};
    const selected = selectedGuid === p.wrestler_guid;
    return `<td class="recruit-prospect-name${selected ? ' is-top' : ''}"><a href="${esc(SimSite.prospectUrl(p.wrestler_guid))}">${esc(prospectName(p))}</a></td><td>${esc(text(p.county_name,'—'))}</td><td class="sw-recruit-state-code">${esc(text(p.state_code, '—'))}</td><td>${esc(gradeLabel(p.academic_stage))}</td><td class="recruit-stat-center">${esc(recordFor(item))}</td><td class="recruit-stat-center">${selectable ? `<input type="radio" name="top-${esc(weight)}" data-set-top="${esc(p.wrestler_guid)}" data-weight="${esc(weight)}" ${selected ? 'checked' : ''} aria-label="Make ${esc(prospectName(p))} top prospect at ${esc(weight)}" />` : '<span class="recruit-top-mark">Top</span>'}</td><td class="recruit-stat-center"><button type="button" class="recruit-remove" data-remove-recruit="${esc(p.wrestler_guid)}" aria-label="Remove ${esc(prospectName(p))} from Big Board" ${working ? 'disabled' : ''}>Remove</button></td><td class="recruit-stat-center">${item.current_week_points == null ? '—' : number(item.current_week_points)}</td><td class="recruit-stat-center">${number(item.recruiting_points)}</td><td class="recruit-stat-center">${item.leader_recruiting_points == null ? '—' : number(item.leader_recruiting_points)}</td><td class="recruit-stat-center">${esc(standingFor(item))}</td><td class="recruit-stat-center">${esc(chanceFor(item))}</td>`;
  }
  function boardRows() {
    if (!board.length) return empty('Your Big Board is empty. Add prospects through Search & Scout.');
    const head = '<thead><tr><th>Weight</th><th>Wrestler</th><th>County</th><th>State</th><th>Year</th><th class="recruit-stat-center">W–L</th><th class="recruit-stat-center">Top Prospect</th><th class="recruit-stat-center">Manage</th><th class="recruit-stat-center">This Week</th><th class="recruit-stat-center" title="Your college’s total recorded recruiting points across seasons">My Points</th><th class="recruit-stat-center" title="Highest total recorded recruiting points invested by any college">Leader</th><th class="recruit-stat-center">Team Standing</th><th class="recruit-stat-center">Signing Chance</th></tr></thead>';
    const sorted=filteredBoard();
    const sections = highSchoolWeights.map(weight => {
      const rows = sorted.filter(item=>String(item.prospect?.weight_class_code || '')===weight);
      const chosen = chosenTop(weight, rows);
      const showAll = expandedWeights.has(weight);
      const other = rows.filter(item => item !== chosen);
      const main = chosen ? `<tr class="recruit-weight-top"><th scope="row"><button type="button" class="recruit-weight-expand" data-expand-weight="${esc(weight)}" aria-expanded="${showAll}">${showAll ? '▾' : '▸'} ${esc(weight)}</button></th>${prospectCells(chosen,weight,false,chosen.prospect?.wrestler_guid)}</tr>` : `<tr class="recruit-weight-empty"><th scope="row">${esc(weight)}</th><td colspan="12">No prospects on your Big Board</td></tr>`;
      const extra = showAll ? other.map(item => `<tr class="recruit-weight-backup"><td></td>${prospectCells(item,weight,true,chosen?.prospect?.wrestler_guid)}</tr>`).join('') : '';
      return main + extra;
    }).join('');
    return `<div class="table-wrap recruit-weight-table-wrap"><table class="coach-live-table recruit-weight-table sw-recruit-v8-table">${head}<tbody>${sections}</tbody></table></div>`;
  }
  function renderBoard() {
    if(resources.board.status!=='ready')return `<section class="panel recruit-section"><h2>Big Board</h2>${resourceMessage('board','Big Board')}</section>`;
    return `<section class="panel recruit-section"><div class="panel-heading"><div><p class="eyebrow">YOUR TARGETS</p><h2>Big Board <span class="recruit-board-count">${boardCount()} / ${BOARD_LIMIT}</span></h2><p class="recruit-heading-note">High school weights 106 through HWT. Expand any weight to see all your recruits; choose one Top Prospect per weight.</p></div></div><p class="recruit-capacity-note${boardCount() >= BOARD_LIMIT ? ' is-full' : ''}" role="status">${boardCount() >= BOARD_LIMIT ? 'Your Big Board is full. Remove a prospect before adding another. You can still recruit prospects already on your board.' : 'Your Big Board holds up to 50 prospects. Removing one frees a place; past recruiting points remain in league history.'}</p><div id="big-board-list">${boardRows()}</div></section>`;
  }
  function refreshBoardResults() {
    const host = document.getElementById('big-board-list');
    if (host) host.innerHTML = boardRows();
  }
  function renderPanel() {
    const panel = document.getElementById('recruit-panel');
    if (!panel) return;
    panel.innerHTML = activeTab === 'search' ? renderSearch() : activeTab === 'overview' ? renderOverview() : renderBoard();
    if (activeTab === 'search') {
      document.getElementById('prospect-search-form')?.addEventListener('submit', runSearch);
      const form=document.getElementById('prospect-search-form');
      Object.entries(searchDraft).forEach(([name,value])=>{if(form?.elements[name])form.elements[name].value=value;});
      if(resources.catalog.status==='ready'){renderPackageControls();renderPackages();}
      if(openPackage && openPackageData)renderPackageResults(openPackageData,openPackage,false);
      void loadResource('catalog');void loadResource('pipeline');
    } else if(activeTab==='board') {void loadResource('board');}
  }
  async function setTopProspect(weight, wrestlerGuid) {
    if (working) return;
    working = true; setFeedback('Saving your Top Prospect selection…');
    try {
      await rpc('set_my_top_prospect_v4_4_4',{p_weight_class_code:weight,p_wrestler_guid:wrestlerGuid});
      topOverrides[weight] = wrestlerGuid;
      refreshBoardResults(); setFeedback('Top Prospect saved to your coaching account.','success');
    } catch(error) { refreshBoardResults(); setFeedback(error.message || 'Could not save Top Prospect.','error'); }
    finally {working=false;}
  }

  async function refreshBoardAndOverview() {
    const [summary,boardReady]=await Promise.allSettled([loadOverview(),loadResource('board',true)]);
    return summary.status==='fulfilled' && boardReady.status==='fulfilled' && boardReady.value;
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
    finally { working = false; if(pageActive && activeTab==='search')renderPackages(); }
  }

  function flagRecruit(wrestlerGuid) {
    window.location.assign(SimSite.prospectUrl(wrestlerGuid));
  }

  async function buyPackage(packageGuid) {
    const item = catalog.find(row => row.scouting_package_guid === packageGuid);
    if (!item || working || !window.confirm(`Spend ${number(item.point_cost)} recruiting points to unlock ${item.package_name}?`)) return;
    working = true; setFeedback('Purchasing scouting package…');
    let receipt;
    try {
      receipt=await rpc('purchase_my_scouting_package_v4_3_0', {p_scouting_package_guid:packageGuid});
    } catch (error) {
      setFeedback(error.message || 'The scouting package could not be purchased.', 'error');
      working=false;renderPackages();return;
    }
    // The purchase succeeded. A later read failure must not be reported as a failed purchase.
    item.purchased=true;
    if(receipt?.available_points!=null)overview.available_points=number(receipt.available_points);
    if(receipt?.purchased){
      overview.unlocked_package_qty=number(overview.unlocked_package_qty)+1;
      overview.scouting_points_spent=number(overview.scouting_points_spent)+number(receipt.points_spent);
    }
    const [summary,packagesReady]=await Promise.allSettled([loadOverview(),loadResource('catalog',true)]);
    working=false;updateSummary();renderPackages();
    const refreshed=summary.status==='fulfilled' && packagesReady.status==='fulfilled' && packagesReady.value;
    setFeedback(`${item.package_name} is unlocked.${refreshed?'':' Some details could not refresh; reload the page or use Retry.'}`, 'success');
  }

  function score(a, b) {
    const left = a == null ? '—' : a;
    const right = b == null ? '—' : b;
    return `${esc(left)}–${esc(right)}`;
  }

  function renderPackageResults(data, packageGuid, shouldScroll=true) {
    const host = document.getElementById('scouting-results');
    if (!host) return;
    const events = Array.isArray(data?.events) ? data.events : [];
    const duals = Array.isArray(data?.duals) ? data.duals : [];
    const tournaments = (Array.isArray(data?.tournaments) ? data.tournaments : []).slice().sort((a,b)=>highSchoolWeights.indexOf(a.weight_class_code)-highSchoolWeights.indexOf(b.weight_class_code));
    const participants = new Map((Array.isArray(data?.participants) ? data.participants : [])
      .map(row => [String(row.wrestler_guid), row]));
    const wrestlerLink = (guid, name) => {
      const participant = participants.get(String(guid || '')) || {};
      const display = text(name, participant.wrestler_name, 'TBD');
      const suffix = guid ? ` (${gradeLabel(participant.academic_stage)})` : '';
      return guid
        ? `<a class="recruit-result-wrestler" href="${esc(SimSite.prospectUrl(guid))}">${esc(display + suffix)}</a>`
        : esc(display);
    };
    const pbpUrl = matchGuid => `coach-scouted-match.html?match=${encodeURIComponent(matchGuid)}&package=${encodeURIComponent(packageGuid)}`;
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
        return `<details><summary><strong>${esc(text(row.tournament_name,row.event_name,'Tournament'))}</strong><span>${esc(text(row.weight_class_code,'—'))} · ${bracket.length} bouts</span></summary><div class="recruit-entry-chips">${entries.filter(entry => entry.wrestler_guid).map(entry => `<span>${wrestlerLink(entry.wrestler_guid,text(entry.wrestler_name,entry.display_name,'Recruit'))}<button type="button" data-flag-recruit="${esc(entry.wrestler_guid)}" data-package="${esc(packageGuid)}">Recruit prospect</button></span>`).join('')}</div><div class="table-wrap"><table class="coach-live-table recruit-bracket-table"><thead><tr><th>Round</th><th>Matchup</th><th>Score</th><th>Result</th><th></th></tr></thead><tbody>${bracket.map(bout => `<tr><td>${esc(text(bout.round_name,bout.round_code,'—'))}</td><td>${wrestlerLink(bout.wrestler_1_guid,bout.wrestler_1_name)} <span class="recruit-versus">vs.</span> ${wrestlerLink(bout.wrestler_2_guid,bout.wrestler_2_name)}</td><td>${score(bout.wrestler_1_match_score,bout.wrestler_2_match_score)}</td><td>${esc(label(bout.result_type || 'Pending'))}</td><td>${bout.match_guid ? `<a class="recruit-pbp-button" href="${esc(pbpUrl(bout.match_guid))}">PBP</a>` : ''}</td></tr>`).join('')}</tbody></table></div></details>`;
      }).join('')}</div>` : ''}`;
    if(shouldScroll)host.scrollIntoView({behavior:'smooth',block:'start'});
  }

  async function viewPackage(packageGuid) {
    if (working) return;
    working = true; openPackage = packageGuid; setFeedback('Loading purchased results…');
    try {
      const data = await rpc('get_my_scouting_package_results_v4_4_1', {p_scouting_package_guid:packageGuid});
      openPackageData=data;
      renderPackageResults(data, packageGuid);
      setFeedback('Purchased scouting results loaded.', 'success');
    } catch (error) { setFeedback(error.message || 'The scouting results could not be loaded.', 'error'); }
    finally { working = false; if(pageActive && activeTab==='search')renderPackages(); }
  }

  async function submitAction(wrestlerGuid, row) {
    const action = row.querySelector('[data-action]').value;
    if (!action) { setFeedback('Choose a recruiting action first.', 'error'); return; }
    if (working || !window.confirm(`Submit ${label(action)} for this recruit?`)) return;
    working = true; setFeedback('Submitting recruiting action…');
    try {
      await rpc('submit_my_recruiting_action_v4_3_0', {p_wrestler_guid:wrestlerGuid,p_action_code:action});
      const refreshed=await refreshBoardAndOverview(); setFeedback(`${label(action)} recorded.${refreshed?'':' Some details could not refresh; reload the page.'}`, 'success');
    } catch (error) { setFeedback(error.message || 'The recruiting action could not be recorded.', 'error'); }
    finally { working = false; if(pageActive && activeTab==='search')renderPackages(); }
  }

  async function removeBoard(wrestlerGuid) {
    const item=board.find(x=>String(x.prospect?.wrestler_guid)===String(wrestlerGuid));
    if (working || !item || !window.confirm(`Remove ${prospectName(item.prospect || {})} from your Big Board? Points already spent will remain in recruiting history and will not be refunded.`)) return;
    working = true; refreshBoardResults(); setFeedback('Removing prospect…');
    try {
      await rpc('remove_my_big_board_recruit_v4_3_0', {p_wrestler_guid:wrestlerGuid});
      // The write succeeded. Keep that fact even if a subsequent read fails.
      board=board.filter(x=>String(x.prospect?.wrestler_guid)!==String(wrestlerGuid));
      Object.keys(topOverrides).forEach(weight=>{if(String(topOverrides[weight])===String(wrestlerGuid))delete topOverrides[weight];});
      overview.active_big_board_qty=board.length;
      updateSummary();
      const refreshed=await refreshBoardAndOverview();
      setFeedback(`Prospect removed from your Big Board.${refreshed?'':' Some details could not refresh; use Retry or reload the page.'}`, 'success');
    } catch (error) { setFeedback(error.message || 'The prospect could not be removed.', 'error'); }
    finally {
      working = false;
      if(pageActive && activeTab==='board' && resources.board.status==='ready') {
        const panel=document.getElementById('recruit-panel');if(panel)panel.innerHTML=renderBoard();
      }
      if(pageActive && activeTab==='search')renderPackages();
    }
  }

  root.addEventListener('input',event=>{
    if(event.target.form?.id==='prospect-search-form' && event.target.name)searchDraft[event.target.name]=event.target.value;
  });
  root.addEventListener('change', event => {
    if(event.target.form?.id==='prospect-search-form' && event.target.name)searchDraft[event.target.name]=event.target.value;
    const radio=event.target.closest('[data-set-top]');
    if(radio) setTopProspect(radio.dataset.weight,radio.dataset.setTop);
  });
  root.addEventListener('click', event => {
    const retry=event.target.closest('[data-retry-resource]');
    if(retry && !working){void loadResource(retry.dataset.retryResource,true);return;}
    const openTab = event.target.closest('[data-open-tab]');
    if (openTab && !working) {
      selectTab(openTab.dataset.openTab);
      return;
    }
    const remove=event.target.closest('[data-remove-recruit]');
    if(remove && !remove.disabled){void removeBoard(remove.dataset.removeRecruit);return;}
    const flag = event.target.closest('[data-flag-recruit]');
    if (flag && !flag.disabled) { flagRecruit(flag.dataset.flagRecruit, flag.dataset.package || null); return; }
    const buy = event.target.closest('[data-buy-package]');
    if (buy) { buyPackage(buy.dataset.buyPackage); return; }
    const view = event.target.closest('[data-view-package]');
    if (view) { viewPackage(view.dataset.viewPackage); return; }
    const close = event.target.closest('[data-close-results]');
    if (close) { const host=document.getElementById('scouting-results'); if(host)host.hidden=true; openPackage=null; openPackageData=null; return; }
    const expand = event.target.closest('[data-expand-weight]');
    if (expand) {const weight=expand.dataset.expandWeight;expandedWeights.has(weight)?expandedWeights.delete(weight):expandedWeights.add(weight);refreshBoardResults();return;}
  });

  try {
    auth = await window.SimAuth.ready;
    const {data:{user}, error} = await auth.client.auth.getUser();
    if (error || !user) { fail('Please sign in to access your recruiting headquarters.'); return; }
    currentUserId=user.id;
    auth.client.auth.onAuthStateChange?.((_event,session)=>{
      if((_event==='SIGNED_OUT') || (session?.user?.id && session.user.id!==currentUserId)) {
        pageActive=false;board=[];catalog=[];pipeline={};searchRows=[];topOverrides={};openPackageData=null;
        fail('Your account changed. Reload this page to load the current coach’s recruiting data.');
      }
    });
    await loadOverview();
    if(!pageActive)return;
    shell();
    // Cosmetic identity lookup never delays the board or the other tabs.
    void CoachIdentityBanner.load(auth.client,overview.team_guid).then(identity=>{
      if(!pageActive)return;
      collegeIdentity=identity;
      const hero=root.querySelector('.college-unified-hero');
      if(hero){
        const template=document.createElement('template');
        template.innerHTML=CoachIdentityBanner.render({identity:collegeIdentity,teamName:overview.team_name,
          context:'WEEK '+(overview.recruiting_week||'—'),detail:[SimSite.seasonLabel(overview),number(overview.available_points)+' recruiting points available'].filter(Boolean).join(' · ')});
        hero.replaceWith(template.content);
      }
      document.title=`${collegeIdentity?.display_name || overview.team_name || 'My College'} — Recruiting | Sim Wrestling`;
      CoachIdentityBanner.apply(root,collegeIdentity);
    }).catch(()=>{/* Keep the recruiting workspace usable when cosmetic data fails. */});
    if(requestedPackage)await viewPackage(requestedPackage);
  } catch (error) {
    const closed = /^RECRUITING_CLOSED_FOR_CURRENT_LEAGUE_DATE_(\d{4}-\d{2}-\d{2})$/.exec(error?.message || '');
    if (closed) { recruitingClosed(closed[1]); return; }
    fail(`The recruiting headquarters could not be loaded: ${error?.message || 'Unexpected error'}`);
  }
})();
