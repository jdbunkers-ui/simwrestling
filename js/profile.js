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
  function renderProfile(payload, activeTab = 'public') {
    const seasonHistory = payload.season_history || [];
    const careerSummary = payload.career_summary || [];
    const detailsPending = Boolean(payload.details_pending);
    const detailsError = payload.details_error || '';
    const p = payload.profile;
    const a = payload.attributes || [];
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
      <section class="profile-hero">
        <div class="athlete-id"><div class="monogram" aria-hidden="true">${e(initials)}</div><div>
          <p class="eyebrow">${e(p.competition_level_display)} · ${e(p.weight_class_name)} · ${e(p.eligibility_year_display)}</p>
          <h1>${e(p.wrestler_name)}</h1>
          <p class="origin">${e(p.hometown_display || 'Hometown unavailable')} · ${e(p.height_display)} · ${num(p.current_weight_lbs,1)} lb${p.team_name ? ` · <a href="${SimSite.teamUrl(p.team_guid)}">${e(p.team_name)}</a>` : ''}</p>
          <div class="style-tags">${achievements.some((item) => Number(item.final_placement) === 1) ? '<span class="champion-tag">Tournament Champion</span>' : ''}<span>${e(p.stance_display)}</span>${topTraits.map((trait) => `<span>${e(trait)}</span>`).join('')}</div>
        </div></div>
        <dl class="hero-record"><div><dt>Record</dt><dd>${m.win_qty || 0}–${m.loss_qty || 0}</dd></div><div><dt>Win rate</dt><dd>${pct(m.win_pct)}</dd></div><div><dt>Bonus wins</dt><dd>${bonusWins}</dd></div><div><dt>Avg. points</dt><dd>${num(m.average_match_points,1)}</dd></div></dl>
      </section>
      <nav class="tabs" aria-label="Wrestler profile sections"><button class="tab active" data-tab="public" type="button">Public profile</button><button class="tab" data-tab="history" type="button">Match history</button></nav>
      <div class="tab-panel" id="public-panel">
        <section class="section-block" data-collapse-label="Attribute Summary" data-mobile-open="true"><div class="section-heading"><div><p class="eyebrow">Scouting profile</p><h2>Attribute Summary</h2></div><p class="section-note">Descriptive bands are public. Exact engine attributes remain hidden.</p></div>
          <div class="attribute-grid">${a.map((item) => `<article class="attribute-card"><div><h3>${e(item.category_name)}</h3><p>${e(item.category_description)}</p></div><span class="rating">${e(item.rating_label)}</span></article>`).join('')}</div>
        </section>
        ${honors.length ? `<section class="award-board section-block" data-collapse-label="Podium Finishes"><div class="section-heading"><div><p class="eyebrow">Tournament honors</p><h2>Podium Finishes</h2></div><span class="record-pill">${honors.length} finish${honors.length===1?'':'es'}</span></div><div class="season-award-groups">${honorSeasons.map((number) => `<section class="season-award-group"><header><h3>Season ${number}</h3><span>${honors.filter((item)=>seasonNumber(item)===number).length} honor${honors.filter((item)=>seasonNumber(item)===number).length===1?'':'s'}</span></header><div class="award-grid">${honors.filter((item)=>seasonNumber(item)===number).map((item) => { const place=honorPlacement(item); const body=`<span class="placement-medal place-${Math.min(3,place||4)}">${place||'—'}</span><div><strong>${e(honorLabel(item))}</strong><small>${e([honorEvent(item),honorWeight(item),item.seed_number?`No. ${item.seed_number} seed`:null].filter(Boolean).join(' · '))}</small></div>${item.tournament_guid?'<i aria-hidden="true">→</i>':''}`; return item.tournament_guid?`<a class="award-card-link" href="${SimSite.tournamentUrl(item.tournament_guid)}">${body}</a>`:`<article>${body}</article>`; }).join('')}</div></section>`).join('')}</div></section>` : ''}
        <section class="panel season-timeline section-block" data-collapse-label="Career Progression"><div class="panel-heading"><div><p class="eyebrow">Career progression</p><h2>Season and Career Records</h2></div><span class="record-pill">${detailsPending?'Loading…':`${seasonHistory.length} seasons`}</span></div><div class="career-level-groups">${detailsPending?'<div class="state-card page-state"><span class="spinner" aria-hidden="true"></span><p>Loading career history…</p></div>':detailsError?`<div class="state-card page-state"><strong>Career history could not be loaded.</strong><p>${e(detailsError)}</p></div>`:`${careerTable('COLLEGE','College Career')}${careerTable('HIGH_SCHOOL','High School Career')}`}</div></section>
        <section class="two-column section-block" data-collapse-label="Media Statistics and Recent Results"><article class="panel"><div class="panel-heading"><div><p class="eyebrow">Average per match</p><h2>Media Statistics</h2></div><span class="record-pill">${m.match_qty || 0} matches</span></div><div class="media-stats">
          ${stat('Takedowns',num(perMatch(m.takedown_qty),2),`${pct(m.takedown_success_rate)} conversion`)}${stat('Escapes',num(perMatch(m.escape_qty),2),'per match')}${stat('Reversals',num(perMatch(m.reversal_qty),2),'per match')}${stat('Back points',num(perMatch(m.back_point_qty),2),'per match')}${stat('Riding time',SimSite.duration(m.average_riding_time_seconds),'per match')}${stat('Team points',num(perMatch(m.team_points_earned),2),`${pct(bonusRate)} bonus wins`)}</div></article>
          <article class="panel"><div class="panel-heading"><div><p class="eyebrow">Recent results</p><h2>Latest Matches</h2></div></div>${detailsPending?'<div class="state-card page-state"><span class="spinner" aria-hidden="true"></span><p>Loading recent results…</p></div>':detailsError?`<p class="coach-empty">${e(detailsError)}</p>`:history.length ? `<div class="history-list">${history.slice(0,5).map((match) => `<div class="history-row"><span>${e(seasonText(match))}</span><strong><a class="history-link" href="${SimSite.matchUrl(match.match_guid)}">${e(match.opponent_name)}</a><span>${e(match.match_context)}</span></strong><a class="history-result ${match.result_outcome === 'WIN' ? 'result-win' : 'result-loss'}" href="${SimSite.matchUrl(match.match_guid)}">${e(match.result_outcome === 'WIN' ? 'W' : 'L')} ${e(match.score_display)}</a><span>${e(String(match.result_type).replaceAll('_',' '))}</span></div>`).join('')}</div>` : '<p class="coach-empty">No completed matches yet.</p>'}</article>
        </section>
      </div>
      <div class="tab-panel" id="history-panel" hidden><section class="panel section-block" data-collapse-label="Complete Match History" data-mobile-open="true"><div class="panel-heading"><div><p class="eyebrow">Complete ledger</p><h2>Match History</h2></div><span class="record-pill">${detailsPending?'Loading…':`${history.length} matches`}</span></div>${detailsPending?'<div class="state-card page-state"><span class="spinner" aria-hidden="true"></span><p>Loading match history…</p></div>':detailsError?`<div class="state-card page-state"><strong>Match history could not be loaded.</strong><p>${e(detailsError)}</p></div>`:history.length ? `<div class="table-wrap"><table><thead><tr><th>Season</th><th>Opponent</th><th>Context</th><th>Result</th><th>Method</th><th>Team pts.</th></tr></thead><tbody>${history.map((match) => `<tr><td>${e(seasonText(match))}</td><td><a class="history-link" href="${SimSite.matchUrl(match.match_guid)}">${e(match.opponent_name)}</a></td><td>${e(match.match_context)}</td><td><a class="history-result ${match.result_outcome === 'WIN' ? 'result-win' : 'result-loss'}" href="${SimSite.matchUrl(match.match_guid)}">${e(match.result_outcome)} ${e(match.score_display)}</a></td><td>${e(String(match.result_type).replaceAll('_',' '))}</td><td>${num(match.team_points_earned,1)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="coach-empty">No historical matches yet.</p>'}</section></div>`;

    const tabButtons = [...document.querySelectorAll('.tab')];
    const panels = { public:document.getElementById('public-panel'), history:document.getElementById('history-panel') };
    tabButtons.forEach((button) => button.classList.toggle('active',button.dataset.tab===activeTab));
    Object.entries(panels).forEach(([name,panel]) => { panel.hidden = name !== activeTab; });
    tabButtons.forEach((button) => button.addEventListener('click', () => {
      tabButtons.forEach((item) => item.classList.toggle('active',item===button));
      Object.entries(panels).forEach(([name,panel]) => { panel.hidden = name !== button.dataset.tab; });
    }));
    SimSite.mobileCollapsibles(root);
  }

  try {
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
