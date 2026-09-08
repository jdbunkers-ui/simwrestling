(async function () {
  const root = document.getElementById('team-root');
  const teamGuid = SimSite.query('team');
  if (!teamGuid) { SimSite.showError(root, 'No team was selected.'); return; }
  if (!SimSite.configuredOrMessage(root)) return;
  const e = SimSite.escape;

  try {
    const payload = await SimApi.teamProfile(teamGuid);
    if (!payload?.profile) throw new Error('The requested team profile was not found.');
    const p = payload.profile;
    const lineup = payload.starting_lineup || [];
    const history = payload.dual_history || [];
    const initials = String(p.team_name || '').split(/\s+/).map((word) => word[0]).join('').slice(0,3);
    document.title = `${p.team_name} | Sim Wrestling`;

    root.innerHTML = `
      <section class="profile-hero team-hero">
        <div class="athlete-id"><div class="monogram" aria-hidden="true">${e(initials)}</div><div>
          <p class="eyebrow">No. ${p.state_team_rank} · ${e(p.state_code)} team rankings</p>
          <h1>${e(p.team_name)}</h1>
          <p class="origin">${e(p.hometown_city || 'New Jersey')}, ${e(p.state_code)} · ${p.starter_qty || 0} starters</p>
          <div class="style-tags"><span>${e(p.ranking_basis === 'DUAL_RECORD' ? 'Dual record ranking' : 'Starting-ten ranking')}</span><span>Engine v0.1.3</span></div>
        </div></div>
        <dl class="hero-record"><div><dt>Dual record</dt><dd>${e(p.dual_record_display || '0-0')}</dd></div><div><dt>Win rate</dt><dd>${SimSite.percent(p.dual_win_rate,1)}</dd></div><div><dt>Avg. margin</dt><dd>${Number(p.average_dual_margin || 0) > 0 ? '+' : ''}${SimSite.number(p.average_dual_margin,1)}</dd></div><div><dt>State rank</dt><dd>#${p.state_team_rank}</dd></div></dl>
      </section>
      <nav class="profile-actions"><a class="primary-button" href="dual.html?team=${encodeURIComponent(teamGuid)}">Run a Dual Meet</a><a class="quiet-link" href="index.html?weight=TEAM&state=${encodeURIComponent(p.state_code)}">Return to Team Rankings</a></nav>
      <section class="panel table-panel section-block">
        <div class="panel-heading"><div><p class="eyebrow">Automatic starters</p><h2>Starting Ten</h2></div><span class="record-pill">${lineup.length} weights</span></div>
        ${lineup.length ? `<div class="table-wrap"><table class="lineup-table"><thead><tr><th>Weight</th><th>State rank</th><th>Wrestler</th><th>Year</th><th>Wins</th><th>Losses</th><th>Bonus %</th></tr></thead><tbody>${lineup.map((row) => `<tr>
          <td><strong>${e(row.weight_class_code)}</strong></td><td class="rank-number">#${row.state_weight_rank}</td><td><a class="wrestler-link" href="${SimSite.profileUrl(row.wrestler_guid)}">${e(row.wrestler_name)}</a></td><td>${e(row.eligibility_year_display || '—')}</td><td>${row.win_qty}</td><td>${row.loss_qty}</td><td><span class="bonus-pill">${e(row.bonus_point_percentage_display || '0.0%')}</span></td>
        </tr>`).join('')}</tbody></table></div>` : '<p class="coach-empty">No active lineup is available.</p>'}
      </section>
      <section class="panel table-panel section-block">
        <div class="panel-heading"><div><p class="eyebrow">Team results</p><h2>Dual History</h2></div><span class="record-pill">${history.length} dual${history.length === 1 ? '' : 's'}</span></div>
        ${history.length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Opponent</th><th>Result</th><th>Score</th><th>Environment</th></tr></thead><tbody>${history.map((dual) => `<tr><td>${dual.dual_date ? new Date(dual.dual_date).toLocaleDateString() : '—'}</td><td><a class="table-link" href="${SimSite.dualUrl(dual.dual_guid)}">${e(dual.opponent_team_name)}</a></td><td><a class="history-result ${dual.result_outcome === 'WIN' ? 'result-win' : dual.result_outcome === 'LOSS' ? 'result-loss' : ''}" href="${SimSite.dualUrl(dual.dual_guid)}">${e(dual.result_outcome)}</a></td><td>${e(dual.score_display)}</td><td>${e(dual.simulation_environment_code)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="coach-empty team-empty">No completed dual meets yet.</p>'}
      </section>`;
  } catch (error) {
    SimSite.showError(root, error.message);
  }
})();
