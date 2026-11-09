/* Sim Wrestling v7.0.6 — progressive profile with clear Big Board capacity errors */
(async function () {
  'use strict';
  const root = document.getElementById('prospect-profile-root');
  const wrestlerGuid = SimSite.query('wrestler');
  if (!root || !wrestlerGuid) { SimSite.showError(root, 'No prospect was selected.'); return; }
  if (!window.SimSite.configuredOrMessage(root)) return;

  const e = SimSite.escape;
  const pct = value => SimSite.percent(value, 1);
  const num = (value, digits = 0) => SimSite.number(value, digits);
  const seasonNumber = item => Number(item?.game_season_number || 0);
  const placement = item => Number(item.final_placement || item.placement || 0);
  const honorLabel = item => item.achievement_label || item.award_display_text || SimSite.resultLabel(item.award_type);
  const actionName = value => String(value || '').replaceAll('_',' ').toLowerCase().replace(/\b\w/g, x => x.toUpperCase());
  const stageRanks = {HIGH_SCHOOL_FRESHMAN:1,HIGH_SCHOOL_SOPHOMORE:2,HIGH_SCHOOL_JUNIOR:3,HIGH_SCHOOL_SENIOR:4};
  const stageNames = {1:'Freshman',2:'Sophomore',3:'Junior',4:'Senior'};
  let recruiting = null;
  let profilePayload = null;
  let submitting = false;
  let historyRequest = 0;
  let historyPending = null;
  let lookupPending = null;
  let feedbackState = {message:"", error:false};
  const submittedThisVisit = [];
  async function privateRpc(name, params = {}) {
    const client = (await window.SimAuth.ready).client;
    const {data, error} = await client.rpc(name, params);
    if (error) throw error;
    return data;
  }
  function applyLookup(data) {
    const actionState = {current_week_action_qty:data.current_week_action_qty,
      used_stage_action_codes:data.used_stage_action_codes};
    recruiting = {stageRank:data.stage_rank, overview:data.overview || {},
      actionState, isContender:data.is_contender,
      entry:data.big_board_guid ? {big_board_guid:data.big_board_guid,...actionState} : null};
    profilePayload.current_season_statistics = data.current_season_statistics;
  }
  function actionBox() {
    if (!recruiting || recruiting.pending) return '<section class="panel section-block"><h2>Recruiting Actions</h2><p role="status">Loading recruiting availability…</p></section>';
    const {overview, entry, stageRank, loadError} = recruiting;
    if (loadError) return `<section class="panel section-block prospect-recruit-actions"><div class="panel-heading"><div><p class="eyebrow">COACH RECRUITING</p><h2>Recruiting Actions</h2></div></div><p class="coach-empty">Could not load recruiting availability: ${e(loadError)}</p><button type="button" data-retry-prospect="recruiting">Retry recruiting availability</button></section>`;
    const types = Array.isArray(overview?.action_types) ? overview.action_types : [];
    const used = new Set(Array.isArray(recruiting.actionState?.used_stage_action_codes) ? recruiting.actionState.used_stage_action_codes : []);
    const weekOpen = Number(overview.recruiting_week)>=2 && Number(overview.recruiting_week)<=8 && new Date(String(overview.league_date)+'T00:00:00Z').getUTCDay()!==6;
    const remaining = weekOpen ? Math.max(0,1-Number(recruiting.actionState?.current_week_action_qty || 0)) : 0;
    const senior = stageRank === 4;
    const isContender = !senior || Boolean(recruiting.isContender);
    const options = types.filter(action => Number(action.minimum_stage_rank || 1) <= stageRank).map(action => {
      const onceUsed = Boolean(action.once_per_stage_ind && used.has(action.action_code));
      const blocked = onceUsed || !isContender || remaining === 0 || Number(action.point_cost)>Number(overview.available_points);
      return `<option value="${e(action.action_code)}" ${blocked ? 'disabled' : ''}>${e(action.action_name || action.display_name || actionName(action.action_code))} — ${Number(action.point_cost || 0)} pts${onceUsed ? ' (already used this stage)' : ''}</option>`;
    }).join('');
    const feedback = `<p id="prospect-action-feedback" class="recruit-feedback ${feedbackState.error ? 'is-error' : 'is-success'}" role="status" aria-live="polite">${e(feedbackState.message)}</p>`;
    const newActions = submittedThisVisit.length ? `<div class="prospect-new-actions"><strong>Actions submitted this visit</strong><ul>${submittedThisVisit.map(x=>`<li>${e(x)}</li>`).join('')}</ul></div>` : '';
    const headline = `<div class="panel-heading"><div><p class="eyebrow">COACH RECRUITING</p><h2>Recruiting Actions</h2><p class="recruit-heading-note">${e(stageNames[stageRank] || 'High school')} eligibility · ${Number(overview.available_points || 0)} recruiting points available · ${remaining} of 1 weekly action remaining</p></div></div>`;
    return `<section class="panel section-block prospect-recruit-actions">${headline}<form id="prospect-action-form" class="prospect-action-form"><label for="prospect-action-choice">Eligible recruiting action</label><div class="prospect-action-controls"><select id="prospect-action-choice" required ${remaining === 0 || !isContender ? 'disabled' : ''}><option value="">${remaining === 0 ? 'Weekly limit reached' : !isContender ? 'Not eligible for senior recruiting actions' : 'Choose an action'}</option>${options}</select><button type="submit" class="recruit-primary" ${remaining === 0 || !isContender || !options ? 'disabled' : ''}>Submit action</button></div></form><p class="coach-detail-note">${!entry?'Your first recruiting point adds this prospect to your Big Board and unlocks his current-season matches. ':''}${!weekOpen?'Recruiting actions are closed for this game date. ':'Submit before advancing from Day 6 to Day 7. '}One action per recruit per week. Once-per-stage actions cannot be repeated. The server validates cost and eligibility.</p>${feedback}${newActions}</section>`;
  }
  function showActionFeedback(message, error = false) {
    feedbackState={message,error};
    const el = document.getElementById('prospect-action-feedback');
    if (el) {el.textContent = message;el.className = `recruit-feedback ${error ? 'is-error' : 'is-success'}`;}
  }
  function loadRecruiting() {
    if (lookupPending) return lookupPending;
    lookupPending = (async () => {
      try {
        const data = await privateRpc('get_my_recruiting_prospect_v7_0_1', {p_wrestler_guid:wrestlerGuid});
        applyLookup(data);
      } catch(error) {
        recruiting={loadError:error?.message || 'Unexpected error'};
      } finally {
        lookupPending=null;
        render(profilePayload, false);
      }
    })();
    return lookupPending;
  }
  function loadHistory(force = false) {
    if (historyPending && !force) return historyPending;
    const request=++historyRequest;
    profilePayload.loading_details=true;
    profilePayload.details_error='';
    render(profilePayload);
    const pending=(async () => {
      try {
        const history=await SimApi.profileHistory(wrestlerGuid) || {};
        if(request!==historyRequest)return;
        profilePayload={...profilePayload,...history,details_error:'',loading_details:false};
      } catch(error) {
        if(request!==historyRequest)return;
        profilePayload={...profilePayload,details_error:error?.message || 'Unexpected error',loading_details:false};
      } finally {
        if(request===historyRequest){historyPending=null;render(profilePayload);}
      }
    })();
    historyPending=pending;
    return pending;
  }
  async function updateRecruitingPanel() {
    const panel = document.getElementById('prospect-recruit-panel');
    if (panel) panel.innerHTML = actionBox();
  }
  async function handleRecruitingAction(event) {
    if (event.target?.id !== 'prospect-action-form') return;
    event.preventDefault();
    if (submitting) return;
    const field = document.getElementById('prospect-action-choice');
    const code = field?.value;
    if (!code) return showActionFeedback('Choose a recruiting action.', true);
    const choice = (recruiting?.overview?.action_types || []).find(a => a.action_code === code);
    const name = choice?.action_name || choice?.display_name || actionName(code);
    if (!window.confirm(`Submit ${name} for this wrestler?`)) return;
    submitting = true;
    const button = event.target.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    showActionFeedback('Submitting recruiting action…');
    try {
      const receipt = await privateRpc('submit_my_recruiting_action_v4_3_0', {p_wrestler_guid:wrestlerGuid,p_action_code:code});
      submittedThisVisit.unshift(name);
      recruiting.entry = {...(recruiting.entry||{}),current_week_action_qty:1};
      recruiting.actionState={...(recruiting.actionState||{}),current_week_action_qty:1};
      recruiting.overview.available_points = receipt.available_points;
      updateRecruitingPanel();
      showActionFeedback(`${name} recorded. Match access is refreshing…`);
      await Promise.allSettled([loadRecruiting(),loadHistory(true)]);
      // A successful paid action remains successful if a subsequent read fails.
      showActionFeedback(`${name} recorded. ${profilePayload.details_error || recruiting.loadError ? 'Use Retry to reload unavailable details.' : 'Big Board and match access refreshed.'}`);
    } catch (error) {
      showActionFeedback(String(error?.message || '').includes('BIG_BOARD_LIMIT_50_REMOVE_A_PROSPECT_FIRST')
        ? 'Your Big Board is full (50 / 50). Remove a prospect from your Big Board, then try again. This action was not recorded and no points were spent.'
        : error?.message || 'The action could not be submitted.', true);
      if (button) button.disabled = false;
    } finally {submitting = false;}
  }
  root.addEventListener('submit', handleRecruitingAction);
  const yearOnly = value => String(value || '—').replace(/^(?:College|High School)\s*(?:[·•|\-]\s*)?/i, '');

  function render(payload, preserveActions = true) {
    const oldPanel=preserveActions ? document.getElementById('prospect-recruit-panel') : null;
    const p = payload.profile;
    const senior = payload.senior_recruiting || null;
    const isCurrentSenior = !p.archived_ind && p.competition_level === 'HIGH_SCHOOL' && p.academic_stage === 'HIGH_SCHOOL_SENIOR';
    const pointsByStage = senior?.points_by_stage || {};
    const yearPoints = [['HIGH_SCHOOL_FRESHMAN','Freshman'],['HIGH_SCHOOL_SOPHOMORE','Sophomore'],['HIGH_SCHOOL_JUNIOR','Junior'],['HIGH_SCHOOL_SENIOR','Senior']].map(([stage,label]) => ({stage,label,points:pointsByStage[stage]}));
    const detailsError = payload.details_error || '';
    const history = [...(payload.season_history || [])].sort((a, b) => seasonNumber(b) - seasonNumber(a));
    const achievements = [...(payload.tournament_achievements || [])]
      .filter(item => placement(item) >= 1 && placement(item) <= 8)
      .sort((a, b) => seasonNumber(b) - seasonNumber(a) || new Date(b.tournament_date || 0) - new Date(a.tournament_date || 0));
    const career = payload.career_summary || [];
    const activeSeason = history.find(item => String(item.season_guid) === String(p.season_guid));
    const honorSeasons = [...new Set(achievements.map(seasonNumber))].sort((a, b) => b - a);
    const seasonMatches = (payload.match_history||[]).filter(match=>String(match.season_guid)===String(p.season_guid)).sort((a,b)=>new Date(b.match_date)-new Date(a.match_date));
    const seasonStats = payload.current_season_statistics?.season_guid === p.season_guid ? payload.current_season_statistics : (!detailsError && !payload.loading_details ? activeSeason : null);
    const detailState = payload.loading_details ? '<p class="coach-empty" role="status">Loading profile history…</p>' : detailsError ? `<p class="coach-empty">Profile history could not be loaded: ${e(detailsError)}</p><button type="button" data-retry-prospect="history">Retry profile history</button>` : '';
    const initials = `${p.first_name?.[0] || ''}${p.last_name?.[0] || ''}` || String(p.wrestler_name || '').split(/\s+/).map(word => word[0]).join('').slice(0, 2);

    const accomplishments = item => {
      const rows = achievements.filter(honor => seasonNumber(honor) === seasonNumber(item)
        && (!honor.competition_level || honor.competition_level === item.competition_level));
      return rows.length ? rows.map(honor => `${honorLabel(honor)} at ${honor.tournament_name || honor.event_name || 'Tournament'}`).join(' | ') : (item.accomplishments || '—');
    };
    const careerTable = level => {
      const rows = history.filter(item => item.competition_level === level);
      const total = career.find(item => item.competition_level === level);
      if (!rows.length && !total) return '';
      const heading = level === 'COLLEGE' ? 'College Career' : 'High School Career';
      return `<section class="career-level-group"><div class="career-level-heading"><h3>${heading}</h3><span>${rows.length} season${rows.length === 1 ? '' : 's'}</span></div><div class="table-wrap"><table class="season-summary-table"><thead><tr><th>Season</th><th>Year / Team</th><th>Weight</th><th>Record</th><th>Win %</th><th>Bonus %</th><th>State rank</th><th>Accomplishments</th></tr></thead><tbody>${rows.map(item => `<tr><td><strong>${e(item.game_season_display || item.season_name)}</strong></td><td>${e(yearOnly(item.academic_stage_display))}${item.team_name ? `<span class="subtext">${e(item.team_name)}</span>` : ''}</td><td>${e(item.weight_class_code)}</td><td>${e(item.record_display)}</td><td>${pct(item.win_percentage)}</td><td>${pct(item.bonus_point_rate)}</td><td>${item.final_state_rank ? `#${e(item.final_state_rank)}<span class="subtext">${e(SimSite.resultLabel(item.rank_status))}</span>` : '—'}</td><td>${e(accomplishments(item))}</td></tr>`).join('')}${total ? `<tr class="career-total-row"><td><strong>Career Total</strong></td><td>—</td><td>—</td><td><strong>${e(total.record_display)}</strong><span class="subtext">${num(total.win_qty)} wins · ${num(total.loss_qty)} losses</span></td><td><strong>${pct(total.career_win_percentage)}</strong></td><td><strong>${pct(total.career_bonus_percentage)}</strong></td><td>—</td><td>${num(total.match_qty)} matches</td></tr>` : ''}</tbody></table></div></section>`;
    };

    document.title = `${p.wrestler_name} — Prospect | Sim Wrestling`;
    root.innerHTML = `
      <nav class="coach-subnav coach-profile-nav" aria-label="Private coaching pages"><a href="coach.html">Team</a><a href="coach-recruiting.html" class="active" aria-current="page">Recruits</a><a href="coach-matches.html">Schedule</a><a href="coach-history.html">Wall of Fame</a><a href="coach-identity.html">Identity</a></nav>
      <a class="sw-return-button" data-sw-return href="coach-recruiting.html?recruiting_tab=board">Return</a>
      <section class="profile-hero">
        <div class="athlete-id"><div class="monogram" aria-hidden="true">${e(initials)}</div><div>
          <p class="eyebrow">${e(p.competition_level_display)} · ${e(p.weight_class_name)} · ${e(p.eligibility_year_display)}</p>
          <h1>${e(p.wrestler_name)}</h1>
          <p class="origin">${e(p.hometown_display || 'Hometown unavailable')} · ${e(p.height_display)} · ${num(p.current_weight_lbs, 1)} lb</p>
          <div class="style-tags">${achievements.some(item => placement(item) === 1) ? '<span class="champion-tag">Tournament Champion</span>' : ''}${p.stance_display ? `<span>${e(p.stance_display)}</span>` : ''}</div>
        </div></div>
        <dl class="hero-record"><div><dt>Season record</dt><dd>${seasonStats ? `${num(seasonStats.win_qty)}–${num(seasonStats.loss_qty)}` : '—'}</dd></div><div><dt>Season win rate</dt><dd>${seasonStats ? pct(seasonStats.win_percentage??seasonStats.win_pct) : '—'}</dd></div><div><dt>Season bonus wins</dt><dd>${seasonStats ? num(seasonStats.bonus_win_qty) : '—'}</dd></div><div><dt>Avg. point diff.</dt><dd>${seasonStats ? num(seasonStats.average_point_differential, 1) : '—'}</dd></div></dl>
      </section>
      <div id="prospect-recruit-panel">${actionBox()}</div>
      <section class="award-board section-block" data-collapse-label="Podium Finishes"><div class="section-heading"><div><p class="eyebrow">Tournament honors</p><h2>Podium Finishes</h2></div><span class="record-pill">${detailsError || payload.loading_details ? '—' : `${achievements.length} finish${achievements.length === 1 ? '' : 'es'}`}</span></div>${detailState ? detailState : achievements.length ? `<div class="season-award-groups">${honorSeasons.map(number => `<section class="season-award-group"><header><h3>Season ${number}</h3><span>${achievements.filter(item => seasonNumber(item) === number).length} honor${achievements.filter(item => seasonNumber(item) === number).length === 1 ? '' : 's'}</span></header><div class="award-grid">${achievements.filter(item => seasonNumber(item) === number).map(item => { const place = placement(item); const body = `<span class="placement-medal place-${Math.min(3, place || 4)}">${place || '—'}</span><div><strong>${e(honorLabel(item))}</strong><small>${e([item.tournament_name || item.event_name || 'Tournament', item.weight_class_code ? `${item.weight_class_code} lb` : '', item.seed_number ? `No. ${item.seed_number} seed` : ''].filter(Boolean).join(' · '))}</small></div>${item.tournament_guid ? '<i aria-hidden="true">→</i>' : ''}`; return item.tournament_guid ? `<a class="award-card-link" href="${e(SimSite.tournamentUrl(item.tournament_guid))}">${body}</a>` : `<article>${body}</article>`; }).join('')}</div></section>`).join('')}</div>` : '<p class="coach-empty">No podium finishes are recorded yet.</p>'}</section>
      <section class="panel season-timeline section-block" data-collapse-label="Career Progression"><div class="panel-heading"><div><p class="eyebrow">Career progression</p><h2>Season and Career Records</h2></div><span class="record-pill">${detailsError || payload.loading_details ? '—' : `${history.length} season${history.length === 1 ? '' : 's'}`}</span></div><div class="career-level-groups">${detailState ? detailState : `${careerTable('HIGH_SCHOOL')}${careerTable('COLLEGE') || ''}${history.length || career.length ? '' : '<p class="coach-empty">No season records are available yet.</p>'}`}</div></section>
      ${isCurrentSenior ? `<section class="panel section-block decision-time" data-collapse-label="Decision Time"><div class="panel-heading"><div><p class="eyebrow">Road to Signing Day · Season ${e(senior?.game_season_number || seasonNumber(activeSeason) || '—')}</p><h2>Decision Time</h2></div><span class="record-pill">Senior recruiting watch</span></div>${!senior ? `<p class="coach-empty">${payload.loading_decision ? 'Loading recruiting preferences…' : 'Recruiting preferences could not be loaded.'}</p>${payload.loading_decision ? '' : '<button type="button" data-retry-prospect="decision">Retry recruiting preferences</button>'}` : `<div class="decision-time-inner"><div class="decision-time-highlights"><div><span>State · Weight-Class Rank</span><strong>${senior.state_weight_rank ? `#${e(senior.state_weight_rank)}` : '—'}</strong><small>${e(senior.state_code || p.hometown_state_code || '')} · ${e(senior.weight_class_code || p.weight_class_code || '')} lb</small></div><div><span>Career Recruiting Points</span><strong>${num(senior.total_recruiting_points || 0)}</strong><small>Across all recruiting programs</small></div></div><h3>Schools Under Consideration</h3><div class="decision-time-schools">${(senior.preferred_schools || []).length ? senior.preferred_schools.map(team=>`<a href="${SimSite.teamUrl(team.team_guid)}">${e(team.team_name)}</a>`).join('') : '<span class="subtext">No preferred schools established</span>'}</div><h3>Recruiting Points by School Year</h3><div class="decision-time-years">${yearPoints.map(item=>`<div><span>${e(item.label)}</span><strong>${item.points === null || item.points === undefined ? '—' : num(item.points)}</strong></div>`).join('')}<div class="decision-time-total"><span>Career Total</span><strong>${num(senior.total_recruiting_points || 0)}</strong></div></div><p class="decision-time-note">Recruiting totals include all recorded team actions. A dash indicates unavailable historical coverage, not zero points. Preferred schools reflect the latest completed recruiting week.</p></div>`}</section>` : ''}
      <section class="panel section-block prospect-season-matches"><div class="panel-heading"><div><p class="eyebrow">CURRENT SEASON</p><h2>Match History</h2><p class="recruit-heading-note">${recruiting?.entry?'Big Board access · All recorded current-season matches.':'Submit a recruiting action to unlock all current-season matches. Purchased coverage may reveal individual matches.'}</p></div></div>${detailState ? detailState :seasonMatches.length?`<div class="table-wrap"><table><thead><tr><th>Season</th><th>Opponent</th><th>Result</th><th>Method</th><th>Review</th></tr></thead><tbody>${seasonMatches.map(match=>`<tr><td>${e(match.game_season_display||'Current season')}</td><td>${match.opponent_wrestler_guid?`<a href="${e(SimSite.prospectUrl(match.opponent_wrestler_guid))}">${e(match.opponent_name)}</a>`:e(match.opponent_name||'Forfeit')}</td><td class="${match.result_outcome==='WIN'?'result-win':'result-loss'}">${e(match.result_outcome)} ${e(match.score_display)}</td><td>${e(String(match.result_type||'').replaceAll('_',' '))}</td><td><a href="coach-scouted-match.html?match=${encodeURIComponent(match.match_guid)}&amp;prospect=${encodeURIComponent(wrestlerGuid)}">PBP →</a></td></tr>`).join('')}</tbody></table></div>`:'<p class="coach-empty">No accessible current-season matches are available yet.</p>'}</section>`;
    if(oldPanel)document.getElementById('prospect-recruit-panel').replaceWith(oldPanel);
    SimSite.mobileCollapsibles(root);
  }

  let decisionPending=null;
  function loadDecision() {
    if(decisionPending)return decisionPending;
    profilePayload.loading_decision=true;
    decisionPending=(async()=>{
      try{profilePayload.senior_recruiting=await SimApi.seniorDecision(wrestlerGuid);}
      catch{profilePayload.senior_recruiting=null;}
      finally{profilePayload.loading_decision=false;decisionPending=null;render(profilePayload);}
    })();
    return decisionPending;
  }
  root.addEventListener('click',event=>{
    const button=event.target.closest('[data-retry-prospect]');
    if(!button)return;
    button.disabled=true;
    const kind=button.dataset.retryProspect;
    if(kind==='history')loadHistory();
    if(kind==='recruiting')loadRecruiting();
    if(kind==='decision')loadDecision();
  });
  try {
    const auth = await window.SimAuth.ready;
    const {data:{user}, error} = await auth.client.auth.getUser();
    if (error || !user) throw new Error('Please sign in to view prospect profiles.');
    const core = await SimApi.profileCore(wrestlerGuid);
    if (!core?.profile) throw new Error('The requested prospect profile was not found.');
    const isSenior = !core.profile.archived_ind && core.profile.competition_level === 'HIGH_SCHOOL' && core.profile.academic_stage === 'HIGH_SCHOOL_SENIOR';
    recruiting={pending:true};
    profilePayload={...core,loading_details:true,loading_decision:isSenior};
    render(profilePayload,false);
    // Render the core immediately. Each remaining request settles independently.
    await Promise.allSettled([loadRecruiting(),loadHistory(),...(isSenior?[loadDecision()]:[])]);
  } catch (error) {
    SimSite.showError(root, error?.message || 'The prospect profile could not be loaded.');
  }
})();
