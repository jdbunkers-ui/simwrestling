/* Sim Wrestling v4.4.6 — authenticated prospect profile and coach recruiting actions */
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
  let submitting = false;
  const submittedThisVisit = [];
  async function privateRpc(name, params = {}) {
    const client = (await window.SimAuth.ready).client;
    const {data, error} = await client.rpc(name, params);
    if (error) throw error;
    return data;
  }
  function boardEntry(data) {
    return (Array.isArray(data?.recruits) ? data.recruits : []).find(row =>
      String(row?.prospect?.wrestler_guid || row?.wrestler_guid) === String(wrestlerGuid));
  }
  function actionBox() {
    if (!recruiting) return '';
    const {overview, entry, stageRank, loadError} = recruiting;
    if (loadError) return `<section class="panel section-block prospect-recruit-actions"><div class="panel-heading"><div><p class="eyebrow">COACH RECRUITING</p><h2>Recruiting Actions</h2></div></div><p class="coach-empty">Could not load recruiting availability: ${e(loadError)}</p></section>`;
    const types = Array.isArray(overview?.action_types) ? overview.action_types : [];
    const used = new Set(Array.isArray(entry?.used_stage_action_codes) ? entry.used_stage_action_codes : []);
    const remaining = entry ? Math.max(0,3-Number(entry.current_week_action_qty || 0)) : 0;
    const senior = stageRank === 4;
    const isContender = !senior || Boolean(entry?.senior_outlook?.is_contender);
    const options = types.filter(action => Number(action.minimum_stage_rank || 1) <= stageRank).map(action => {
      const onceUsed = Boolean(action.once_per_stage_ind && used.has(action.action_code));
      const blocked = onceUsed || !isContender || remaining === 0;
      return `<option value="${e(action.action_code)}" ${blocked ? 'disabled' : ''}>${e(action.action_name || action.display_name || actionName(action.action_code))} — ${Number(action.point_cost || 0)} pts${onceUsed ? ' (already used this stage)' : ''}</option>`;
    }).join('');
    const feedback = `<p id="prospect-action-feedback" class="recruit-feedback" role="status" aria-live="polite"></p>`;
    const newActions = submittedThisVisit.length ? `<div class="prospect-new-actions"><strong>Actions submitted this visit</strong><ul>${submittedThisVisit.map(x=>`<li>${e(x)}</li>`).join('')}</ul></div>` : '';
    const headline = `<div class="panel-heading"><div><p class="eyebrow">COACH RECRUITING</p><h2>Recruiting Actions</h2><p class="recruit-heading-note">${e(stageNames[stageRank] || 'High school')} eligibility · ${Number(overview.available_points || 0)} recruiting points available${entry ? ` · ${remaining} of 3 weekly actions remaining` : ''}</p></div></div>`;
    if (!entry) return `<section class="panel section-block prospect-recruit-actions">${headline}<p>This wrestler is not currently on your Big Board. Add the prospect to your board before submitting recruiting actions.</p><button class="recruit-primary" id="prospect-add-board" type="button">Add to Big Board</button>${feedback}${newActions}</section>`;
    return `<section class="panel section-block prospect-recruit-actions">${headline}<form id="prospect-action-form" class="prospect-action-form"><label for="prospect-action-choice">Eligible recruiting action</label><div class="prospect-action-controls"><select id="prospect-action-choice" required ${remaining === 0 || !isContender ? 'disabled' : ''}><option value="">${remaining === 0 ? 'Weekly limit reached' : !isContender ? 'Not eligible for senior recruiting actions' : 'Choose an action'}</option>${options}</select><button type="submit" class="recruit-primary" ${remaining === 0 || !isContender || !options ? 'disabled' : ''}>Submit action</button></div></form><p class="coach-detail-note">One action per recruit per week is subject to the league rules. Once-per-stage actions cannot be repeated. The server validates cost and eligibility.</p>${feedback}${newActions}</section>`;
  }
  function showActionFeedback(message, error = false) {
    const el = document.getElementById('prospect-action-feedback');
    if (el) {el.textContent = message;el.className = `recruit-feedback ${error ? 'is-error' : 'is-success'}`;}
  }
  async function loadRecruiting(profile) {
    const stageRank = stageRanks[String(profile.academic_stage || '').toUpperCase()] ||
      ({freshman:1,sophomore:2,junior:3,senior:4}[String(profile.eligibility_year_display || '').toLowerCase().trim()] || 0);
    if (String(profile.competition_level || '').toUpperCase() !== 'HIGH_SCHOOL' &&
        !String(profile.competition_level_display || '').toLowerCase().includes('high school')) return;
    recruiting = {stageRank, overview:{}, entry:null};
    try {
      const [overview, board] = await Promise.all([
        privateRpc('get_my_recruiting_overview_v4_3_0'),
        privateRpc('get_my_big_board_v4_4_0')
      ]);
      recruiting = {stageRank:boardEntry(board)?.stage_rank || stageRank, overview:overview || {}, entry:boardEntry(board)};
    } catch (error) {
      recruiting = {stageRank, loadError:error?.message || 'Unexpected error'};
    }
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
      await privateRpc('submit_my_recruiting_action_v4_3_0', {p_wrestler_guid:wrestlerGuid,p_action_code:code});
      submittedThisVisit.unshift(name);
      const [overview,board] = await Promise.all([
        privateRpc('get_my_recruiting_overview_v4_3_0'),privateRpc('get_my_big_board_v4_4_0')
      ]);
      recruiting.overview = overview || {};
      recruiting.entry = boardEntry(board);
      updateRecruitingPanel();
      showActionFeedback(`${name} submitted and recorded. Recruiting totals refreshed.`);
    } catch (error) {
      showActionFeedback(error?.message || 'The action could not be submitted.', true);
      if (button) button.disabled = false;
    } finally {submitting = false;}
  }
  root.addEventListener('submit', handleRecruitingAction);
  root.addEventListener('click', async event => {
    if (event.target?.id !== 'prospect-add-board' || submitting) return;
    submitting = true;
    event.target.disabled = true;
    try {
      await privateRpc('set_my_big_board_recruit_v4_3_0', {p_wrestler_guid:wrestlerGuid,p_priority_rank:3,p_coach_note:null,p_scouting_package_guid:null});
      const [overview,board] = await Promise.all([
        privateRpc('get_my_recruiting_overview_v4_3_0'),privateRpc('get_my_big_board_v4_4_0')
      ]);
      recruiting.overview = overview || {};
      recruiting.entry = boardEntry(board);
      updateRecruitingPanel();
      showActionFeedback('Added to Big Board. You can now select a recruiting action.');
    } catch (error) {showActionFeedback(error?.message || 'Unable to add this prospect.', true);event.target.disabled=false;}
    finally {submitting = false;}
  });
  const yearOnly = value => String(value || '—').replace(/^(?:College|High School)\s*(?:[·•|\-]\s*)?/i, '');

  function render(payload) {
    const p = payload.profile;
    const m = payload.media_statistics || {};
    const detailsError = payload.details_error || '';
    const history = [...(payload.season_history || [])].sort((a, b) => seasonNumber(b) - seasonNumber(a));
    const achievements = [...(payload.tournament_achievements || [])]
      .filter(item => placement(item) >= 1 && placement(item) <= 8)
      .sort((a, b) => seasonNumber(b) - seasonNumber(a) || new Date(b.tournament_date || 0) - new Date(a.tournament_date || 0));
    const career = payload.career_summary || [];
    const honorSeasons = [...new Set(achievements.map(seasonNumber))].sort((a, b) => b - a);
    const initials = `${p.first_name?.[0] || ''}${p.last_name?.[0] || ''}` || String(p.wrestler_name || '').split(/\s+/).map(word => word[0]).join('').slice(0, 2);
    const bonusWins = Number(m.major_decision_win_qty || 0) + Number(m.technical_fall_win_qty || 0) + Number(m.fall_win_qty || 0) + Number(m.forfeit_win_qty || 0);

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
      <nav class="coach-subnav coach-profile-nav" aria-label="Private coaching pages"><a href="coach.html">Team</a><a href="coach-recruiting.html" class="active" aria-current="page">Recruits</a><a href="coach-matches.html">Schedule</a><a href="coach-history.html">Wall of Fame</a></nav>
      <a class="coach-back-link" href="coach-recruiting.html?recruiting_tab=board">← Back to Big Board</a>
      <section class="profile-hero">
        <div class="athlete-id"><div class="monogram" aria-hidden="true">${e(initials)}</div><div>
          <p class="eyebrow">${e(p.competition_level_display)} · ${e(p.weight_class_name)} · ${e(p.eligibility_year_display)}</p>
          <h1>${e(p.wrestler_name)}</h1>
          <p class="origin">${e(p.hometown_display || 'Hometown unavailable')} · ${e(p.height_display)} · ${num(p.current_weight_lbs, 1)} lb</p>
          <div class="style-tags">${achievements.some(item => placement(item) === 1) ? '<span class="champion-tag">Tournament Champion</span>' : ''}${p.stance_display ? `<span>${e(p.stance_display)}</span>` : ''}</div>
        </div></div>
        <dl class="hero-record"><div><dt>Record</dt><dd>${num(m.win_qty)}–${num(m.loss_qty)}</dd></div><div><dt>Win rate</dt><dd>${pct(m.win_pct)}</dd></div><div><dt>Bonus wins</dt><dd>${bonusWins}</dd></div><div><dt>Avg. points</dt><dd>${num(m.average_match_points, 1)}</dd></div></dl>
      </section>
      <div id="prospect-recruit-panel">${actionBox()}</div>
      <section class="award-board section-block" data-collapse-label="Podium Finishes"><div class="section-heading"><div><p class="eyebrow">Tournament honors</p><h2>Podium Finishes</h2></div><span class="record-pill">${detailsError ? '—' : `${achievements.length} finish${achievements.length === 1 ? '' : 'es'}`}</span></div>${detailsError ? `<p class="coach-empty">Podium finishes could not be loaded: ${e(detailsError)}</p>` : achievements.length ? `<div class="season-award-groups">${honorSeasons.map(number => `<section class="season-award-group"><header><h3>Season ${number}</h3><span>${achievements.filter(item => seasonNumber(item) === number).length} honor${achievements.filter(item => seasonNumber(item) === number).length === 1 ? '' : 's'}</span></header><div class="award-grid">${achievements.filter(item => seasonNumber(item) === number).map(item => { const place = placement(item); const body = `<span class="placement-medal place-${Math.min(3, place || 4)}">${place || '—'}</span><div><strong>${e(honorLabel(item))}</strong><small>${e([item.tournament_name || item.event_name || 'Tournament', item.weight_class_code ? `${item.weight_class_code} lb` : '', item.seed_number ? `No. ${item.seed_number} seed` : ''].filter(Boolean).join(' · '))}</small></div>${item.tournament_guid ? '<i aria-hidden="true">→</i>' : ''}`; return item.tournament_guid ? `<a class="award-card-link" href="${e(SimSite.tournamentUrl(item.tournament_guid))}">${body}</a>` : `<article>${body}</article>`; }).join('')}</div></section>`).join('')}</div>` : '<p class="coach-empty">No podium finishes are recorded yet.</p>'}</section>
      <section class="panel season-timeline section-block" data-collapse-label="Career Progression"><div class="panel-heading"><div><p class="eyebrow">Career progression</p><h2>Season and Career Records</h2></div><span class="record-pill">${detailsError ? '—' : `${history.length} season${history.length === 1 ? '' : 's'}`}</span></div><div class="career-level-groups">${detailsError ? `<p class="coach-empty">Season and career records could not be loaded: ${e(detailsError)}</p>` : `${careerTable('HIGH_SCHOOL')}${careerTable('COLLEGE') || ''}${history.length || career.length ? '' : '<p class="coach-empty">No season records are available yet.</p>'}`}</div></section>`;
    SimSite.mobileCollapsibles(root);
  }

  try {
    const auth = await window.SimAuth.ready;
    const {data:{user}, error} = await auth.client.auth.getUser();
    if (error || !user) throw new Error('Please sign in to view prospect profiles.');
    const core = await SimApi.profileCore(wrestlerGuid);
    if (!core?.profile) throw new Error('The requested prospect profile was not found.');
    let history = {};
    try { history = await SimApi.profileHistory(wrestlerGuid) || {}; }
    catch (error) { history = {details_error:error?.message || 'Unexpected error'}; }
    await loadRecruiting(core.profile);
    render({...core, ...history});
  } catch (error) {
    SimSite.showError(root, error?.message || 'The prospect profile could not be loaded.');
  }
})();
