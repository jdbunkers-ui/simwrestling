(async function () {
  const root = document.getElementById('profile-root');
  let coachClient=null; let privateAttrs=[]; const analyticsCache={};
  const wrestlerGuid = SimSite.query('wrestler');
  if (!wrestlerGuid) { SimSite.showError(root, 'No wrestler was selected.'); return; }
  if (!window.SimSite.configuredOrMessage(root)) return;
  const e = SimSite.escape;
  const pct = (value) => SimSite.percent(value, 1);
  const num = (value, digits = 0) => SimSite.number(value, digits);

  function stat(label, value, detail) {
    return `<dl><dt>${e(label)}</dt><dd>${e(value)}</dd><span>${e(detail)}</span></dl>`;
  }
  function renderProfile(payload, activeTab = 'public') {
    const seasonHistory = payload.season_history || [];
    const careerSummary = payload.career_summary || [];
    const detailsPending = Boolean(payload.details_pending);
    const detailsError = payload.details_error || '';
    const p = payload.profile;
    const a = privateAttrs;
    const m = payload.media_statistics || {};
    const seasonNumber = (item) => Number(item?.game_season_number || 0);
    const seasonText = (item) => seasonNumber(item) ? `Season ${seasonNumber(item)}` : 'Season unavailable';
    const chronology = (item, field) => new Date(item?.[field] || 0).getTime();
    const history = [...(payload.match_history || [])].sort((x, y) => chronology(y, 'match_date') - chronology(x, 'match_date'));
    const achievements = [...(payload.tournament_achievements || [])].sort((x, y) =>
      seasonNumber(y) - seasonNumber(x) || chronology(y, 'tournament_date') - chronology(x, 'tournament_date'));
    const honors = achievements;
    const honorSeasons = [...new Set(honors.map((item) => seasonNumber(item)))].sort((a,b) => b-a);
    const historyByLevel = (level) => seasonHistory.filter((item) => item.competition_level === level)
      .sort((a,b) => seasonNumber(b)-seasonNumber(a));
    const careerFor = (level) => careerSummary.find((item) => item.competition_level === level);
    const honorLabel = (item) => item.achievement_label || item.award_display_text || SimSite.resultLabel(item.award_type);
    const honorEvent = (item) => item.tournament_name || item.event_name || 'Tournament';
    const honorWeight = (item) => item.weight_class_code ? `${item.weight_class_code} lb` : '';
    const honorPlacement = (item) => Number(item.final_placement || item.placement || 0);
    const yearOnly = (value) => String(value || '—')
      .replace(/^(?:College|High School)\s*(?:[·•|\-]\s*)?/i,'');
    const accomplishmentsForSeason = (item, level) => {
      const rows = achievements.filter((achievement) => seasonNumber(achievement) === seasonNumber(item)
        && (achievement.competition_level || (p.archived_ind ? 'COLLEGE' : '')) === level
        && honorPlacement(achievement) >= 1 && honorPlacement(achievement) <= 8);
      return rows.length
        ? rows.map((achievement) => `${honorLabel(achievement)} at ${honorEvent(achievement)}`).join(' | ')
        : (item.accomplishments || '—');
    };
    const careerTable = (level, heading) => {
      const rows = historyByLevel(level);
      const total = careerFor(level);
      if (!rows.length && !total) return `<section class="career-level-group"><div class="career-level-heading"><h3>${e(heading)}</h3></div><p class="coach-empty">No ${e(heading.toLocaleLowerCase())} history is available.</p></section>`;
      return `<section class="career-level-group"><div class="career-level-heading"><h3>${e(heading)}</h3><span>${rows.length} season${rows.length===1?'':'s'}</span></div><div class="table-wrap"><table class="season-summary-table"><thead><tr><th>Season</th><th>Year / Team</th><th>Weight</th><th>Record</th><th>Win %</th><th>Bonus %</th><th>State rank</th><th>Accomplishments</th></tr></thead><tbody>${rows.map((item) => `<tr><td><strong>${e(item.game_season_display || item.season_name)}</strong></td><td>${e(yearOnly(item.academic_stage_display))}${item.team_name?`<span class="subtext">${e(item.team_name)}</span>`:''}</td><td>${e(item.weight_class_code)}</td><td>${e(item.record_display)}</td><td>${pct(item.win_percentage)}</td><td>${pct(item.bonus_point_rate)}</td><td>${item.final_state_rank?`#${item.final_state_rank}<span class="subtext">${e(SimSite.resultLabel(item.rank_status))}</span>`:'—'}</td><td>${e(accomplishmentsForSeason(item,level))}</td></tr>`).join('')}${total?`<tr class="career-total-row"><td><strong>Career Total</strong></td><td>—</td><td aria-label="Weight not applicable">—</td><td><strong>${e(total.record_display)}</strong><span class="subtext">${total.win_qty} wins · ${total.loss_qty} losses</span></td><td><strong>${pct(total.career_win_percentage)}</strong></td><td><strong>${pct(total.career_bonus_percentage)}</strong></td><td>—</td><td>${total.match_qty} matches</td></tr>`:''}</tbody></table></div></section>`;
    };
    const initials = `${p.first_name?.[0] || ''}${p.last_name?.[0] || ''}` || String(p.wrestler_name || '').split(/\s+/).map((word)=>word[0]).join('').slice(0,2);
    const matchQty = Number(m.match_qty || 0);
    const perMatch = (value) => matchQty ? Number(value || 0) / matchQty : 0;
    const bonusWins = Number(m.major_decision_win_qty || 0) + Number(m.technical_fall_win_qty || 0) + Number(m.fall_win_qty || 0) + Number(m.forfeit_win_qty || 0);
    const bonusRate = Number(m.win_qty || 0) ? bonusWins / Number(m.win_qty) : 0;
    const ratingOrder = ['NOVICE','LIMITED','DEVELOPING','BELOW_AVERAGE','AVERAGE','SOLID','ABOVE_AVERAGE','ADVANCED','HIGH_LEVEL','EXCEPTIONAL','MASTERY'];
    const topTraits = [...a].sort((x,y) => ratingOrder.indexOf(y.rating_band_code)-ratingOrder.indexOf(x.rating_band_code)).slice(0,2).map((x) => x.category_name);
    document.title = `${p.wrestler_name} | Sim Wrestling`;

    root.innerHTML = `
      <nav class="coach-subnav coach-profile-nav" aria-label="Private coaching pages"><a href="coach.html" class="active" aria-current="page">Team</a><a href="coach-recruiting.html">Recruits</a><a href="coach-matches.html">Schedule</a><a href="coach-history.html">Wall of Fame</a></nav>
      <a class="coach-back-link" href="coach.html">← Back to Coaching Roster</a>
      <section class="profile-hero">
        <div class="athlete-id"><div class="monogram" aria-hidden="true">${e(initials)}</div><div>
          <p class="eyebrow">${e(p.competition_level_display)} · ${e(p.weight_class_name)} · ${e(p.eligibility_year_display)}</p>
          <h1>${e(p.wrestler_name)}</h1>
          <p class="origin">${e(p.hometown_display || 'Hometown unavailable')} · ${e(p.height_display)} · ${num(p.current_weight_lbs,1)} lb${p.team_name ? ` · <a href="${SimSite.teamUrl(p.team_guid)}">${e(p.team_name)}</a>` : ''}</p>
          <div class="style-tags">${achievements.some((item) => Number(item.final_placement) === 1) ? '<span class="champion-tag">Tournament Champion</span>' : ''}<span>${e(p.stance_display)}</span></div>
        </div></div>
        <dl class="hero-record"><div><dt>Record</dt><dd>${m.win_qty || 0}–${m.loss_qty || 0}</dd></div><div><dt>Win rate</dt><dd>${pct(m.win_pct)}</dd></div><div><dt>Bonus wins</dt><dd>${bonusWins}</dd></div><div><dt>Avg. points</dt><dd>${num(m.average_match_points,1)}</dd></div></dl>
      </section>
      <nav class="tabs" aria-label="Wrestler profile sections"><button class="tab active" data-tab="public" type="button">Profile</button><button class="tab" data-tab="history" type="button">Match history</button><button class="tab" data-tab="stats" type="button">Detailed statistics</button><button class="tab" data-tab="pbp" type="button">Play-by-play</button></nav>
      <div class="tab-panel" id="public-panel">
        <section class="section-block" data-collapse-label="Private Attribute Summary" data-mobile-open="true"><div class="section-heading"><div><p class="eyebrow">Coach-only scouting</p><h2>Attribute Summary <span class="coach-soon">Private</span></h2></div></div><div class="attribute-grid">${a.length?a.map(item=>`<article class="attribute-card"><div><h3>${e(item.category_name)}</h3><p>${e(item.category_description)}</p></div><span class="rating">${e(item.rating_label)}</span></article>`).join(''):'<p>No attribute summary available.</p>'}</div></section>
        ${honors.length ? `<section class="award-board section-block" data-collapse-label="Podium Finishes"><div class="section-heading"><div><p class="eyebrow">Tournament honors</p><h2>Podium Finishes</h2></div><span class="record-pill">${honors.length} finish${honors.length===1?'':'es'}</span></div><div class="season-award-groups">${honorSeasons.map((number) => `<section class="season-award-group"><header><h3>Season ${number}</h3><span>${honors.filter((item)=>seasonNumber(item)===number).length} honor${honors.filter((item)=>seasonNumber(item)===number).length===1?'':'s'}</span></header><div class="award-grid">${honors.filter((item)=>seasonNumber(item)===number).map((item) => { const place=honorPlacement(item); const body=`<span class="placement-medal place-${Math.min(3,place||4)}">${place||'—'}</span><div><strong>${e(honorLabel(item))}</strong><small>${e([honorEvent(item),honorWeight(item),item.seed_number?`No. ${item.seed_number} seed`:null].filter(Boolean).join(' · '))}</small></div>${item.tournament_guid?'<i aria-hidden="true">→</i>':''}`; return item.tournament_guid?`<a class="award-card-link" href="${SimSite.tournamentUrl(item.tournament_guid)}">${body}</a>`:`<article>${body}</article>`; }).join('')}</div></section>`).join('')}</div></section>` : ''}
        <section class="panel season-timeline section-block" data-collapse-label="Career Progression"><div class="panel-heading"><div><p class="eyebrow">Career progression</p><h2>Season and Career Records</h2></div><span class="record-pill">${detailsPending?'Loading…':`${seasonHistory.length} seasons`}</span></div><div class="career-level-groups">${detailsPending?'<div class="state-card page-state"><span class="spinner" aria-hidden="true"></span><p>Loading career history…</p></div>':detailsError?`<div class="state-card page-state"><strong>Career history could not be loaded.</strong><p>${e(detailsError)}</p></div>`:`${careerTable('COLLEGE','College Career')}${careerTable('HIGH_SCHOOL','High School Career')}`}</div></section>
      </div>
      <div class="tab-panel" id="history-panel" hidden><section class="panel section-block" data-collapse-label="Complete Match History" data-mobile-open="true"><div class="panel-heading"><div><p class="eyebrow">Complete ledger</p><h2>Match History</h2></div><span class="record-pill">${detailsPending?'Loading…':`${history.length} matches`}</span></div>${detailsPending?'<div class="state-card page-state"><span class="spinner" aria-hidden="true"></span><p>Loading match history…</p></div>':detailsError?`<div class="state-card page-state"><strong>Match history could not be loaded.</strong><p>${e(detailsError)}</p></div>`:history.length ? `<div class="table-wrap"><table><thead><tr><th>Season</th><th>Opponent</th><th>Context</th><th>Result</th><th>Method</th><th>Team pts.</th></tr></thead><tbody>${history.map((match) => `<tr><td>${e(seasonText(match))}</td><td><a class="history-link" href="${SimSite.matchUrl(match.match_guid)}">${e(match.opponent_name)}</a></td><td>${e(match.match_context)}</td><td><a class="history-result ${match.result_outcome === 'WIN' ? 'result-win' : 'result-loss'}" href="${SimSite.matchUrl(match.match_guid)}">${e(match.result_outcome)} ${e(match.score_display)}</a></td><td>${e(String(match.result_type).replaceAll('_',' '))}</td><td>${num(match.team_points_earned,1)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="coach-empty">No historical matches yet.</p>'}</section></div>
      <div class="tab-panel" id="pbp-panel" hidden><section class="panel section-block"><div class="panel-heading"><div><p class="eyebrow">Match review</p><h2>Play-by-Play</h2></div></div><p class="coach-detail-note">Choose a completed match to watch its play-by-play. Match reviews open in the dedicated match viewer.</p>${detailsPending?'<p>Loading matches…</p>':detailsError?`<p>${e(detailsError)}</p>`:history.length?`<div class="coach-pbp-list">${history.map(match=>`<a class="coach-pbp-link" href="${e(SimSite.matchUrl(match.match_guid))}"><span><strong>${e(match.opponent_name||'Opponent')}</strong><small>${e(seasonText(match))} · ${e(match.match_context||'Match')}</small></span><span>${e(match.result_outcome||'')} ${e(match.score_display||'')} <span aria-hidden="true">→</span></span></a>`).join('')}</div>`:'<p>No completed matches available.</p>'}</section></div>
      <div class="tab-panel" id="stats-panel" hidden><section class="panel section-block"><div class="panel-heading"><div><p class="eyebrow">Restricted to your college</p><h2>Detailed Coaching Statistics</h2></div></div><p class="coach-detail-note">View move efficiency, neutral and mat performance, situations, and fatigue. These records are private to your authorized college.</p><div id="private-stat-controls" class="coach-stat-controls"></div><div id="private-stat-results" aria-live="polite"></div></section></div>`;

    const tabButtons = [...document.querySelectorAll('.tab')];
    const panels = { public:document.getElementById('public-panel'), history:document.getElementById('history-panel'), stats:document.getElementById('stats-panel'), pbp:document.getElementById('pbp-panel') };
    tabButtons.forEach((button) => button.classList.toggle('active',button.dataset.tab===activeTab));
    Object.entries(panels).forEach(([name,panel]) => { panel.hidden = name !== activeTab; });
    tabButtons.forEach((button) => button.addEventListener('click', () => {
      tabButtons.forEach((item) => item.classList.toggle('active',item===button));
      Object.entries(panels).forEach(([name,panel]) => { panel.hidden = name !== button.dataset.tab; });
    }));
    if(activeTab==='stats') setupPrivateStats();
    tabButtons.forEach(button=>button.addEventListener('click',()=>{if(button.dataset.tab==='stats')setupPrivateStats();}));
    SimSite.mobileCollapsibles(root);
  }

  // Keep the legacy coach-details RPC solely for private attribute authorization.
  // All eight analytics sections use the server-authorized current-season cache RPCs.
  async function loadPrivateSection(section){
    if(section==='attributes'){
      const {data,error}=await coachClient.rpc('get_my_wrestler_coach_details_v4_2_2',{p_wrestler_guid:wrestlerGuid,p_section:'attributes'});
      if(error)throw error;
      return Array.isArray(data?.rows)?data.rows:[];
    }
    if(analyticsCache[section])return analyticsCache[section];
    const rpc=section==='moves'?'get_my_current_season_moves_cached_v423':'get_my_current_season_analytics_cached_v423';
    const params={p_wrestler_guid:wrestlerGuid};
    if(section!=='moves')params.p_section_code=section;
    const {data,error}=await coachClient.rpc(rpc,params);
    if(error)throw error;
    if(!data?.cache_ready)return {ready:false,rows:[]};
    const value={ready:true,rows:Array.isArray(data.rows)?data.rows:[],refreshed:data.refreshed_at};
    analyticsCache[section]=value;
    return value;
  }
  const headings={overview:'Current Season Performance',moves:'Individual Moves',neutral:'Neutral Wrestling',mat:'Mat Wrestling',scramble:'Scrambling and Discipline',period:'Period Splits',score:'Score Situations',fatigue:'Fatigue and Conditioning'};
  const keyName=k=>String(k).replace(/_/g,' ').replace(/\b\w/g,x=>x.toUpperCase());
  const ignored=new Set(['wrestler_guid','wrestler_name','move_guid','move_code','action_type','move_family','move_name']);
  function formatStat(v,k){
    if(v===null||v===undefined)return '—';
    if(typeof v==='number')return /rate|percentage|probability/.test(k)?`${(v*100).toFixed(1)}%`:Number.isInteger(v)?v.toLocaleString():v.toFixed(2);
    return String(v);
  }
  function statCards(row,fields,featured=false){
    return `<div class="coach-metric-grid ${featured?'coach-metric-featured':''}">${fields.filter(k=>row[k]!==undefined).map(k=>`<dl class="coach-metric-card"><dt>${e(keyName(k))}</dt><dd>${e(formatStat(row[k],k))}</dd></dl>`).join('')}</div>`;
  }
  function renderMetrics(section,rows){
    if(section==='moves'){
      const fieldNames=['offensive_uses','offensive_successes','offensive_failures','takedowns','points_created','attempts_faced','defensive_stops','points_allowed'];
      const cards=rows.map(r=>`<article class="coach-move-card"><header><strong>${e(r.move_name||r.move_code||'Move')}</strong><small>${e(String(r.move_family||'').replaceAll('_',' '))}</small></header><div class="coach-move-highlight"><span><b>${e(r.offensive_uses??0)}</b> Uses</span><span><b>${e(r.offensive_successes??0)}</b> Successful</span><span><b>${e(r.points_created??0)}</b> Points</span></div><details><summary>Full move breakdown</summary>${statCards(r,fieldNames)}</details></article>`).join('');
      return `<div class="coach-move-list">${cards}</div>`;
    }
    const groupKey={period:'period_display',score:'score_state',fatigue:'fatigue_band'}[section];
    return rows.map((r,i)=>{
      const label=groupKey?String(r[groupKey]||`Group ${i+1}`).replaceAll('_',' '):null;
      const keys=Object.keys(r).filter(k=>!ignored.has(k)&&k!==groupKey&&k!=='segment_code'&&k!=='segment_number'&&k!=='period_display');
      const priority={overview:['win_qty','loss_qty','win_rate','takedowns','points_for','points_against'],neutral:['open_takedowns','open_conversion_rate','overall_defense_rate'],mat:['turns','escapes','reversals'],scramble:['scramble_wins','scramble_win_rate'],period:['points_for','takedowns'],score:['points_for','takedowns'],fatigue:['scoring_action_rate','points_for']}[section]||[];const lead=priority.filter(k=>keys.includes(k));return `<section class="coach-metric-group">${label?`<h4>${e(label)}</h4>`:''}${lead.length?statCards(r,lead,true):''}<div class="coach-metric-secondary">${statCards(r,keys.filter(k=>!lead.includes(k)))}</div></section>`;
    }).join('');
  }
  function setupPrivateStats(){
    const controls=document.getElementById('private-stat-controls'),results=document.getElementById('private-stat-results');
    if(!controls||controls.dataset.ready)return;controls.dataset.ready='true';
    controls.innerHTML=Object.entries(headings).map(([k,title],i)=>`<button type="button" class="coach-stat-tab ${i===0?'active':''}" data-section="${k}">${title}</button>`).join('');
    let request=0;
    async function display(section){
      const selected=++request;
      controls.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.section===section));
      results.innerHTML='<p>Loading current-season analytics…</p>';
      try{
        const data=await loadPrivateSection(section);
        if(selected!==request)return;
        if(!data.ready){results.innerHTML='<p class="coach-empty">This season’s statistics are being prepared. Please check back shortly.</p>';return;}
        if(!data.rows.length){results.innerHTML='<p class="coach-empty">No completed current-season statistics are available in this category.</p>';return;}
        const updated=data.refreshed?`<p class="coach-detail-note">Last refreshed: ${e(new Date(data.refreshed).toLocaleString())}</p>`:'';
        results.innerHTML=`<h3>${e(headings[section])}</h3><p class="coach-detail-note">Current college season only</p>${updated}${renderMetrics(section,data.rows)}`;
      }catch(err){if(selected===request)results.innerHTML=`<p class="coach-lineup-feedback">Could not load this analytics section: ${e(err.message||'Unknown error')}</p>`;}
    }
    controls.addEventListener('click',ev=>{const b=ev.target.closest('button[data-section]');if(b)display(b.dataset.section);});
    display('overview');
  }
  try {
    const auth=await window.SimAuth.ready; coachClient=auth.client;
    const {data:{user},error:userError}=await coachClient.auth.getUser();
    if(userError||!user)throw Error('Please sign in to view your private wrestler profile.');
    privateAttrs=await loadPrivateSection('attributes'); // Server verifies current ownership and entitlement.
    let payload = null;
    let currentProfileError = null;
    try { payload = await SimApi.profileCore(wrestlerGuid); } catch (error) { currentProfileError = error; }
    if (!payload?.profile || payload.profile.roster_status === 'GRADUATED') {
      try {
        const archivedPayload = await SimApi.archivedProfile(wrestlerGuid);
        if (archivedPayload?.profile) payload = archivedPayload;
      } catch (_) {
        // An active wrestler does not require an archived-profile lookup.
      }
    }
    if (!payload?.profile && currentProfileError) throw currentProfileError;
    if (!payload?.profile) throw new Error('The requested wrestler profile was not found.');

    if (payload.profile.archived_ind) {
      renderProfile(payload);
    } else {
      renderProfile({ ...payload, details_pending:true });
      try {
        const details = await SimApi.profileHistory(wrestlerGuid);
        const activeTab = document.querySelector('.tab.active')?.dataset.tab || 'public';
        renderProfile({ ...payload, ...(details || {}), details_pending:false },activeTab);
      } catch (error) {
        const activeTab = document.querySelector('.tab.active')?.dataset.tab || 'public';
        renderProfile({ ...payload, details_pending:false,details_error:error.message },activeTab);
      }
    }
  } catch (error) {
    SimSite.showError(root,error.message);
  }
})();
