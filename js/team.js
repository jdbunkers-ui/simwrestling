(async function () {
  const root = document.getElementById('team-root');
  const teamGuid = SimSite.query('team');
  if (!teamGuid) { SimSite.showError(root, 'No team was selected.'); return; }
  if (!SimSite.configuredOrMessage(root)) return;
  const e = SimSite.escape;

  try {
    const [payload, awards, seasons, fullSchedule, archivedSeasons, accomplishments, roster] = await Promise.all([
      SimApi.teamProfile(teamGuid), SimApi.teamAwards(teamGuid), SimApi.teamSeasonSummary(teamGuid), SimApi.teamFullSchedule(teamGuid),
      SimApi.collegeTeamHistory(teamGuid), SimApi.collegeTeamAccomplishments(teamGuid), SimApi.teamRoster(teamGuid)
    ]);
    if (!payload?.profile) throw new Error('The requested team profile was not found.');
    const p = payload.profile;
    const lineup = payload.starting_lineup || [];
    const rosterRows = Array.isArray(roster) ? roster : [];
    const yearLabel = (value) => String(value || '—').replace(/^College\s+/i,'');
    const recruitTag = (row) => Number(row.final_national_recruiting_rank) > 0
      ? `<span class="recruit-rank-tag">HS Recruit #${Number(row.final_national_recruiting_rank)}</span>` : '';
    const seasonNumber = (item) => Number(item?.game_season_number || 0);
    const awardSeasons = [...new Set(awards.map((item) => seasonNumber(item)))].sort((a,b) => b-a);
    const schedule = [...fullSchedule].sort((a,b) => Number(a.week_number)-Number(b.week_number)
      || String(a.scheduled_date).localeCompare(String(b.scheduled_date))
      || Number(a.dual_order||0)-Number(b.dual_order||0));
    const seasonRows = archivedSeasons.length ? archivedSeasons : seasons;
    const finish = (value) => value ? `${value}${Number(value)===1?'st':Number(value)===2?'nd':Number(value)===3?'rd':'th'}` : '—';
    const accomplishmentOrder = ['All-State','All-Region','All-American'];
    const accomplishmentRows = accomplishmentOrder.map((label) => accomplishments.find((row) => row.achievement_level === label) || { achievement_level:label });
    const initials = String(p.team_name || '').split(/\s+/).map((word) => word[0]).join('').slice(0,3);
    document.title = `${p.team_name} | Sim Wrestling`;
    const section = (label, body, open = false) => `<section class="panel table-panel section-block" data-collapse-label="${e(label)}"${open ? ' data-mobile-open="true"' : ''}>${body}</section>`;

    root.innerHTML = `
      <section class="profile-hero team-hero">
        <div class="athlete-id"><div class="monogram" aria-hidden="true">${e(initials)}</div><div>
          <p class="eyebrow">No. ${p.state_team_rank} · ${e(p.state_code)} team rankings</p><h1>${e(p.team_name)}</h1>
          <p class="origin">${e(p.hometown_city || 'New Jersey')}, ${e(p.state_code)} · ${p.starter_qty || 0} starters</p>
        </div></div>
        <dl class="hero-record"><div><dt>Dual record</dt><dd>${e(p.dual_record_display || '0-0')}</dd></div><div><dt>Win rate</dt><dd>${SimSite.percent(p.dual_win_rate,1)}</dd></div><div><dt>Avg. margin</dt><dd>${Number(p.average_dual_margin || 0) > 0 ? '+' : ''}${SimSite.number(p.average_dual_margin,1)}</dd></div><div><dt>State rank</dt><dd>#${p.state_team_rank}</dd></div></dl>
      </section>
      <nav class="profile-actions single-action"><a class="quiet-link" href="rankings.html?weight=TEAM&state=${encodeURIComponent(p.state_code)}">Return to Team Rankings</a></nav>
      ${awards.length ? `<section class="award-board section-block" data-collapse-label="Team Awards"><div class="section-heading"><div><p class="eyebrow">Program honors</p><h2>Team Awards Board</h2></div><span class="record-pill">${awards.length} award${awards.length===1?'':'s'}</span></div><div class="season-award-groups">${awardSeasons.map((number) => { const rows=awards.filter((item)=>seasonNumber(item)===number); return `<section class="season-award-group"><header><h3>Season ${number}</h3><span>${rows.length} award${rows.length===1?'':'s'}</span></header><div class="award-grid">${rows.map((item) => `<article><span class="placement-medal place-${Math.min(3,Number(item.placement||4))}">${item.placement}</span><div><strong>${e(item.award_display_text)}</strong><small>${e(item.event_name)}</small></div></article>`).join('')}</div></section>`; }).join('')}</div></section>` : ''}
      ${section('Team Roster', `<div class="panel-heading"><div><p class="eyebrow">Starters and depth</p><h2>Team Roster</h2></div><span class="record-pill">${rosterRows.length} wrestler${rosterRows.length===1?'':'s'}</span></div>${rosterRows.length ? `<div class="table-wrap"><table class="lineup-table full-roster-table"><thead><tr><th>Weight</th><th>State rank</th><th>Wrestler</th><th>Hometown</th><th>Year</th><th>Wins</th><th>Losses</th><th>Bonus %</th></tr></thead><tbody>${rosterRows.map((row) => `<tr class="${row.starter_ind?'roster-starter-row':'roster-backup-row'}"><td><strong>${row.starter_ind?e(row.weight_class_code):''}</strong></td><td class="rank-number">${row.starter_ind&&row.state_weight_rank?`#${row.state_weight_rank}`:''}</td><td><a class="wrestler-link" href="${SimSite.profileUrl(row.wrestler_guid)}">${e(row.wrestler_name)}</a>${recruitTag(row)}</td><td>${e(row.hometown_display || '—')}</td><td>${e(yearLabel(row.eligibility_year_display))}</td><td>${row.win_qty||0}</td><td>${row.loss_qty||0}</td><td><span class="bonus-pill">${e(row.bonus_point_percentage_display || '0.0%')}</span></td></tr>`).join('')}</tbody></table></div>` : (lineup.length ? '<p class="coach-empty">The full roster endpoint has not been deployed yet.</p>' : '<p class="coach-empty">No active roster is available.</p>')}`, true)}
      ${section('Season-by-Season Record', `<div class="panel-heading"><div><p class="eyebrow">Program history</p><h2>Season-by-Season Record</h2></div><span class="record-pill">${seasonRows.length} seasons</span></div>${seasonRows.length ? `<div class="table-wrap"><table class="season-summary-table"><thead><tr><th>Season</th><th>Final record</th><th>Holiday tournament</th><th>State Dual</th><th>Regional Dual</th><th>National Dual</th></tr></thead><tbody>${seasonRows.map((row) => `<tr><td><strong>S${row.game_season_number}</strong></td><td>${e(row.record_display || '—')}</td><td>${finish(row.holiday_tournament_placement)}</td><td>${finish(row.state_dual_finish)}</td><td>${finish(row.regional_dual_finish)}</td><td>${finish(row.national_dual_finish)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="coach-empty">Season summaries will appear after the first completed season.</p>'}`)}
      ${section('Individual Accomplishments', `<div class="panel-heading"><div><p class="eyebrow">Program totals</p><h2>Individual Accomplishments</h2></div></div><div class="table-wrap"><table class="accomplishment-table"><thead><tr><th>Honor</th><th>1st</th><th>2nd</th><th>3rd</th><th>4th</th><th>5th</th><th>6th</th><th>7th</th><th>8th</th><th>Total</th></tr></thead><tbody>${accomplishmentRows.map((row) => `<tr><th>${e(row.achievement_level)}</th><td>${row.first_qty||0}</td><td>${row.second_qty||0}</td><td>${row.third_qty||0}</td><td>${row.fourth_qty||0}</td><td>${row.fifth_qty||0}</td><td>${row.sixth_qty||0}</td><td>${row.seventh_qty||0}</td><td>${row.eighth_qty||0}</td><td><strong>${row.total_qty||0}</strong></td></tr>`).join('')}</tbody></table></div>`)}
      ${section('Full Team Schedule', `<div class="panel-heading"><div><p class="eyebrow">Week 1 through Week 8</p><h2>Full Team Schedule</h2></div><span class="record-pill">${schedule.length} scheduled item${schedule.length===1?'':'s'}</span></div>${schedule.length?`<div class="table-wrap"><table class="team-schedule-table"><thead><tr><th>Type</th><th>Week / Day</th><th>Scheduled Event</th><th>Opponent / Field</th><th>Result</th></tr></thead><tbody>${schedule.map((item) => { const completed=item.result_display!=='Not Simulated Yet'; const resultClass=String(item.result_display||'').startsWith('W ')?'result-win':String(item.result_display||'').startsWith('L ')?'result-loss':''; const result=item.dual_guid?`<a class="history-result ${resultClass}" href="${SimSite.dualUrl(item.dual_guid)}">${e(item.result_display)}</a>`:(completed&&item.scheduled_event_guid?`<a class="history-result ${resultClass}" href="${SimSite.eventUrl(item.scheduled_event_guid)}">${e(item.result_display)}</a>`:`<span class="schedule-pending">${e(item.result_display||'Not Simulated Yet')}</span>`); return `<tr><td><span class="schedule-type-badge">${e(item.schedule_type)}</span></td><td><strong>Week ${item.week_number}</strong><span class="subtext">${e(item.scheduled_day)} · ${e(SimSite.date(item.scheduled_date))}</span></td><td>${e(item.event_name)}</td><td>${e(item.opponent_or_field||'—')}</td><td>${result}</td></tr>`; }).join('')}</tbody></table></div>`:'<p class="coach-empty team-empty">No schedule has been published for this team.</p>'}`)}
    `;
    SimSite.mobileCollapsibles(root);
  } catch (error) { SimSite.showError(root,error.message); }
})();
