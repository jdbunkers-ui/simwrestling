(async function () {
  const root = document.getElementById('profile-root');
  const wrestlerGuid = SimSite.query('wrestler');
  if (!wrestlerGuid) { SimSite.showError(root, 'No wrestler was selected.'); return; }
  if (!window.SimSite.configuredOrMessage(root)) return;
  const e = SimSite.escape;
  const pct = (value) => SimSite.percent(value, 1);
  const num = (value, digits = 0) => SimSite.number(value, digits);

  function stat(label, value, detail) {
    return `<dl><dt>${e(label)}</dt><dd>${e(value)}</dd><span>${e(detail)}</span></dl>`;
  }
  function mini(label, value, detail = '') {
    return `<div><span>${e(label)}</span><strong>${e(value)}</strong>${detail ? `<small>${e(detail)}</small>` : ''}</div>`;
  }

  try {
    const [payload, rankings] = await Promise.all([SimApi.profile(wrestlerGuid), SimApi.rankings()]);
    if (!payload?.profile) throw new Error('The requested wrestler profile was not found.');
    const p = payload.profile;
    const a = payload.attributes || [];
    const m = payload.media_statistics || {};
    const coach = payload.coach_overview || {};
    const neutral = payload.coach_neutral || {};
    const mat = payload.coach_mat || {};
    const scramble = payload.coach_scramble_discipline || {};
    const moves = payload.coach_moves || [];
    const periods = payload.coach_periods || [];
    const scoreStates = payload.coach_score_states || [];
    const fatigue = payload.coach_fatigue || [];
    const history = payload.match_history || [];
    const achievements = payload.tournament_achievements || [];
    const seasonHistory = payload.season_history || [];
    const opponents = rankings.filter((row) => row.competition_level === p.competition_level && row.weight_class_code === p.weight_class_code && row.match_eligible_ind && row.wrestler_guid !== wrestlerGuid);
    const initials = `${p.first_name?.[0] || ''}${p.last_name?.[0] || ''}`;
    const matchQty = Number(m.match_qty || 0);
    const perMatch = (value) => matchQty ? Number(value || 0) / matchQty : 0;
    const bonusWins = Number(m.major_decision_win_qty || 0) + Number(m.technical_fall_win_qty || 0) + Number(m.fall_win_qty || 0);
    const bonusRate = Number(m.win_qty || 0) ? bonusWins / Number(m.win_qty) : 0;
    const ratingOrder = ['NOVICE','LIMITED','DEVELOPING','BELOW_AVERAGE','AVERAGE','SOLID','ABOVE_AVERAGE','ADVANCED','HIGH_LEVEL','EXCEPTIONAL','MASTERY'];
    const topTraits = [...a].sort((x,y) => ratingOrder.indexOf(y.rating_band_code)-ratingOrder.indexOf(x.rating_band_code)).slice(0,2).map((x) => x.category_name);
    document.title = `${p.wrestler_name} | Sim Wrestling`;

    root.innerHTML = `
      <section class="profile-hero">
        <div class="athlete-id"><div class="monogram" aria-hidden="true">${e(initials)}</div><div>
          <p class="eyebrow">${e(p.competition_level_display)} · ${e(p.weight_class_name)} · ${e(p.eligibility_year_display)}</p>
          <h1>${e(p.wrestler_name)}</h1>
          <p class="origin">${e(p.hometown_display || 'Hometown unavailable')} · ${e(p.height_display)} · ${num(p.current_weight_lbs,1)} lb${p.team_name ? ` · <a href="${SimSite.teamUrl(p.team_guid)}">${e(p.team_name)}</a>` : ''}</p>
          <div class="style-tags">${achievements.some((item) => Number(item.final_placement) === 1) ? '<span class="champion-tag">Tournament Champion</span>' : ''}<span>${e(p.stance_display)}</span>${topTraits.map((trait) => `<span>${e(trait)}</span>`).join('')}</div>
        </div></div>
        <dl class="hero-record"><div><dt>Record</dt><dd>${m.win_qty || 0}–${m.loss_qty || 0}</dd></div><div><dt>Win rate</dt><dd>${pct(m.win_pct)}</dd></div><div><dt>Bonus wins</dt><dd>${bonusWins}</dd></div><div><dt>Avg. points</dt><dd>${num(m.average_match_points,1)}</dd></div></dl>
      </section>
      <section class="match-selector${p.match_eligible_ind === false ? ' unavailable' : ''}" aria-labelledby="matchup-title">
        <div><p class="eyebrow">Create a match</p><h2 id="matchup-title">Choose ${e(p.first_name)}'s opponent</h2><p>Only active ${e(p.weight_class_code)}-pound wrestlers are eligible.</p></div>
        <label>Eligible opponent<select id="opponent-select"><option value="">Select a wrestler</option>${opponents.map((opponent) => `<option value="${e(opponent.wrestler_guid)}">${e(opponent.wrestler_name)}${opponent.team_name ? ` · ${e(opponent.team_name)}` : ''}</option>`).join('')}</select></label>
        <button class="primary-button" id="wrestle-button" type="button" disabled>${p.match_eligible_ind === false ? 'Backup roster' : "Let's Wrestle!"}</button>
      </section>
      <p id="match-status" class="section-note" role="status"></p>
      <nav class="tabs" aria-label="Wrestler profile sections"><button class="tab active" data-tab="public" type="button">Public profile</button><button class="tab" data-tab="coach" type="button">Coach analytics <span class="coach-tag">C</span></button><button class="tab" data-tab="history" type="button">Match history</button></nav>
      <div class="tab-panel" id="public-panel">
        <section class="section-block"><div class="section-heading"><div><p class="eyebrow">Scouting profile</p><h2>Attribute Summary</h2></div><p class="section-note">Descriptive bands are public. Exact engine attributes remain hidden.</p></div>
          <div class="attribute-grid">${a.map((item) => `<article class="attribute-card"><div><h3>${e(item.category_name)}</h3><p>${e(item.category_description)}</p></div><span class="rating">${e(item.rating_label)}</span></article>`).join('')}</div>
        </section>
        ${achievements.length ? `<section class="achievement-panel section-block"><div><p class="eyebrow">Tournament honors</p><h2>Podium Finishes</h2></div><div class="achievement-list">${achievements.map((item) => `<a href="${SimSite.tournamentUrl(item.tournament_guid)}"><span class="placement-medal place-${item.final_placement}">${item.final_placement}</span><div><strong>${e(item.achievement_label)}</strong><small>${e(item.tournament_name)} · No. ${item.seed_number} seed</small></div><i aria-hidden="true">→</i></a>`).join('')}</div></section>` : ''}
        ${seasonHistory.length ? `<section class="panel season-timeline section-block"><div class="panel-heading"><div><p class="eyebrow">Career progression</p><h2>Season History</h2></div></div><div class="timeline-list">${seasonHistory.map((item) => `<div><strong>${e(item.season_name)}</strong><span>${e(String(item.competition_level).replace('_',' '))} · ${e(String(item.academic_stage).replaceAll('_',' ').toLocaleLowerCase().replace(/\b\w/g,(letter)=>letter.toUpperCase()))}</span><small>${e(item.weight_class_code)} lb${item.team_name ? ` · ${e(item.team_name)}` : ''}</small></div>`).join('')}</div></section>` : ''}
        <section class="two-column section-block"><article class="panel"><div class="panel-heading"><div><p class="eyebrow">Average per match</p><h2>Media Statistics</h2></div><span class="record-pill">${m.match_qty || 0} matches</span></div><div class="media-stats">
          ${stat('Takedowns',num(perMatch(m.takedown_qty),2),`${pct(m.takedown_success_rate)} conversion`)}${stat('Escapes',num(perMatch(m.escape_qty),2),'per match')}${stat('Reversals',num(perMatch(m.reversal_qty),2),'per match')}${stat('Back points',num(perMatch(m.back_point_qty),2),'per match')}${stat('Riding time',SimSite.duration(m.average_riding_time_seconds),'per match')}${stat('Team points',num(perMatch(m.team_points_earned),2),`${pct(bonusRate)} bonus wins`)}</div></article>
          <article class="panel"><div class="panel-heading"><div><p class="eyebrow">Recent results</p><h2>Latest Matches</h2></div></div>${history.length ? `<div class="history-list">${history.slice(0,5).map((match) => `<div class="history-row"><span>${match.match_date ? new Date(match.match_date).toLocaleDateString(undefined,{month:'short',day:'numeric'}) : '—'}</span><strong><a class="history-link" href="${SimSite.matchUrl(match.match_guid)}">${e(match.opponent_name)}</a><span>${e(match.match_context)}</span></strong><a class="history-result ${match.result_outcome === 'WIN' ? 'result-win' : 'result-loss'}" href="${SimSite.matchUrl(match.match_guid)}">${e(match.result_outcome === 'WIN' ? 'W' : 'L')} ${e(match.score_display)}</a><span>${e(String(match.result_type).replaceAll('_',' '))}</span></div>`).join('')}</div>` : '<p class="coach-empty">No completed matches yet.</p>'}</article>
        </section>
      </div>
      <div class="tab-panel" id="coach-panel" hidden>
        <section class="coach-banner section-block"><div><p class="eyebrow">Coach view</p><h2>Development and Matchup Intelligence</h2></div><p>Every attempt, finish, defense, position and match state is derived from the event ledger.</p></section>
        <section class="kpi-strip"><article><span>TD conversion</span><strong>${pct(coach.takedown_conversion_rate)}</strong><small>${coach.takedowns || 0} of ${coach.takedown_attempts || 0}</small></article><article><span>TD defense</span><strong>${pct(coach.takedown_defense_rate)}</strong><small>${coach.takedowns_allowed || 0} allowed</small></article><article><span>Turn rate</span><strong>${pct(coach.turn_rate)}</strong><small>${coach.turns || 0} of ${coach.turn_attempts || 0}</small></article><article><span>Scramble rate</span><strong>${pct(coach.scramble_win_rate)}</strong><small>${coach.scramble_wins || 0} wins</small></article><article><span>Avg. margin</span><strong>${Number(coach.average_margin || 0) >= 0 ? '+' : ''}${num(coach.average_margin,1)}</strong><small>points per match</small></article></section>
        <section class="coach-grid section-block"><article class="panel"><div class="panel-heading"><div><p class="eyebrow">Neutral phase</p><h2>Attack Profile</h2></div></div><div class="metric-list">${[
          ['Open neutral',neutral.open_conversion_rate],['Clinch offense',neutral.clinch_conversion_rate],['Counters',neutral.counter_conversion_rate],['Throws',neutral.throw_conversion_rate],['Takedown defense',neutral.overall_defense_rate]
        ].map(([label,value]) => `<div class="metric-row"><span>${e(label)}</span><div class="metric-bar"><i style="width:${Math.min(100,Number(value||0)*100)}%"></i></div><strong>${pct(value)}</strong></div>`).join('')}</div></article>
          <article class="panel"><div class="panel-heading"><div><p class="eyebrow">Mat wrestling</p><h2>Top and Bottom</h2></div></div><div class="mini-grid">${mini('Breakdown rate',pct(mat.breakdown_rate),`${mat.breakdowns || 0} finishes`)}${mini('Turn rate',pct(mat.turn_rate),`${mat.back_points || 0} back points`)}${mini('Ride / match',`${num(mat.riding_time_per_match,0)} sec.`)}${mini('Escape rate',pct(mat.escape_rate),`${mat.escapes || 0} escapes`)}${mini('Reversal rate',pct(mat.reversal_rate),`${mat.reversals || 0} reversals`)}${mini('Danger time',`${mat.danger_seconds || 0} sec.`)}</div></article></section>
        <section class="panel section-block"><div class="panel-heading"><div><p class="eyebrow">Move intelligence</p><h2>Offense and Defense by Move</h2></div><span class="record-pill">Top ${Math.min(12,moves.length)}</span></div>${moves.length ? `<div class="table-wrap"><table class="move-table"><thead><tr><th>Move</th><th>Uses</th><th>Success</th><th>Points</th><th>Faced</th><th>Stops</th><th>Stop %</th></tr></thead><tbody>${moves.slice(0,12).map((move) => `<tr><td><strong>${e(move.move_name)}</strong><span class="subtext">${e(move.action_type)}</span></td><td>${move.offensive_uses}</td><td>${pct(move.offensive_success_rate)}</td><td>${move.points_created}</td><td>${move.attempts_faced}</td><td>${move.defensive_stops}</td><td>${pct(move.defensive_stop_rate)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="coach-empty">Move analytics will appear after completed matches.</p>'}</section>
        <section class="split-grid section-block"><article class="panel"><div class="panel-heading"><div><p class="eyebrow">Period splits</p><h2>Scoring by Period</h2></div></div><div class="mini-grid">${periods.length ? periods.map((period) => mini(period.period_display,`${period.points_for}-${period.points_against}`,`${period.takedowns} TD · ${period.riding_time_seconds}s ride`)).join('') : mini('No data','—','Complete a match')}</div></article><article class="panel"><div class="panel-heading"><div><p class="eyebrow">Situational splits</p><h2>Match State and Fatigue</h2></div></div><div class="mini-grid">${scoreStates.map((state) => mini(String(state.score_state).toLowerCase(),`${state.points_for}-${state.points_against}`,`${state.takedowns} takedowns`)).join('')}${fatigue.slice(0,3).map((band) => mini(String(band.fatigue_band).replaceAll('_',' ').toLowerCase(),pct(band.scoring_action_rate),`${band.offensive_actions} actions`)).join('')}</div></article></section>
        <section class="panel section-block"><div class="panel-heading"><div><p class="eyebrow">Scramble and discipline</p><h2>Control Under Pressure</h2></div></div><div class="mini-grid">${mini('Scrambles entered',scramble.scrambles_entered || 0)}${mini('Scramble wins',scramble.scramble_wins || 0)}${mini('Neutral scrambles',scramble.neutral_scrambles || 0)}${mini('Stall warnings',scramble.stall_warnings || 0)}${mini('Warnings drawn',scramble.opponent_stall_warnings_drawn || 0)}${mini('Penalty points conceded',scramble.penalty_points_conceded || 0)}</div></section>
      </div>
      <div class="tab-panel" id="history-panel" hidden><section class="panel section-block"><div class="panel-heading"><div><p class="eyebrow">Complete ledger</p><h2>Match History</h2></div><span class="record-pill">${history.length} matches</span></div>${history.length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Opponent</th><th>Context</th><th>Result</th><th>Method</th><th>Team pts.</th></tr></thead><tbody>${history.map((match) => `<tr><td>${match.match_date ? new Date(match.match_date).toLocaleDateString() : '—'}</td><td><a class="history-link" href="${SimSite.matchUrl(match.match_guid)}">${e(match.opponent_name)}</a></td><td>${e(match.match_context)}</td><td><a class="history-result ${match.result_outcome === 'WIN' ? 'result-win' : 'result-loss'}" href="${SimSite.matchUrl(match.match_guid)}">${e(match.result_outcome)} ${e(match.score_display)}</a></td><td>${e(String(match.result_type).replaceAll('_',' '))}</td><td>${num(match.team_points_earned,1)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="coach-empty">No historical matches yet.</p>'}</section></div>`;

    const opponentSelect = document.getElementById('opponent-select');
    const wrestleButton = document.getElementById('wrestle-button');
    const status = document.getElementById('match-status');
    opponentSelect.disabled = !opponents.length || p.match_eligible_ind === false;
    opponentSelect.addEventListener('change', () => { wrestleButton.disabled = !opponentSelect.value; });
    wrestleButton.addEventListener('click', async () => {
      if (!opponentSelect.value) return;
      wrestleButton.disabled = true; opponentSelect.disabled = true; wrestleButton.textContent = 'Wrestling…'; status.textContent = 'The engine is resolving the match.';
      try {
        const matchGuid = await SimApi.runMatch(wrestlerGuid, opponentSelect.value);
        window.location.href = SimSite.matchUrl(matchGuid);
      } catch (error) {
        status.textContent = error.message; wrestleButton.disabled = false; opponentSelect.disabled = false; wrestleButton.textContent = "Let's Wrestle!";
      }
    });

    const tabButtons = [...document.querySelectorAll('.tab')];
    const panels = { public:document.getElementById('public-panel'), coach:document.getElementById('coach-panel'), history:document.getElementById('history-panel') };
    tabButtons.forEach((button) => button.addEventListener('click', () => {
      tabButtons.forEach((item) => item.classList.toggle('active',item===button));
      Object.entries(panels).forEach(([name,panel]) => { panel.hidden = name !== button.dataset.tab; });
    }));
  } catch (error) {
    SimSite.showError(root,error.message);
  }
})();
