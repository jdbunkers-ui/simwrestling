/* Sim Wrestling v4.3.1 — authenticated, intentionally concise prospect profile */
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
      <nav class="coach-subnav coach-profile-nav" aria-label="Private coaching pages"><a href="coach.html">Coach</a><a href="coach-matches.html">Matches</a><a href="coach-recruiting.html" class="active" aria-current="page">Recruit</a><a href="coach-history.html">Program History</a></nav>
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
    render({...core, ...history});
  } catch (error) {
    SimSite.showError(root, error?.message || 'The prospect profile could not be loaded.');
  }
})();
