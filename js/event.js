(async function () {
  const root = document.getElementById('event-root');
  const eventGuid = SimSite.query('event');
  if (!eventGuid) { SimSite.showError(root, 'No scheduled event was selected.'); return; }
  if (!SimSite.configuredOrMessage(root)) return;
  const e = SimSite.escape;
  const resultTypes = (type) => String(type || '').includes('DUAL') || type === 'COLLEGE_QUAD';
  let event, sessions, divisions, placements, duals, standings;
  let selectedDivision = '';

  function status(value) {
    const css = String(value || 'SCHEDULED').toLocaleLowerCase().replaceAll('_','-');
    return `<span class="event-status status-${e(css)}">${e(SimSite.resultLabel(value))}</span>`;
  }
  function wrestlerLink(guid, name) {
    return guid ? `<a href="${SimSite.profileUrl(guid)}">${e(name || 'Wrestler')}</a>` : e(name || 'TBD');
  }
  function teamLink(guid, name) {
    return guid ? `<a href="${SimSite.teamUrl(guid)}">${e(name || 'Team')}</a>` : e(name || 'TBD');
  }

  function renderHeader() {
    const meta = typeof event.metadata === 'object' && event.metadata ? event.metadata : {};
    const place = event.county_name || event.region_name || event.state_code || 'National';
    return `<section class="event-hero"><div><p class="eyebrow">${e(SimSite.seasonLabel(event))} · Week ${event.week_number}</p><h1>${e(event.event_name)}</h1><p>${e(SimSite.levelLabel(event.competition_level))} · ${e(place)} · ${e(SimSite.date(event.starts_on, true))}${event.ends_on !== event.starts_on ? `–${e(SimSite.date(event.ends_on, true))}` : ''}</p></div><div>${status(event.event_status)}<strong>${event.division_qty ? `${event.division_qty} divisions` : event.invited_team_qty ? `${event.invited_team_qty} teams` : event.format_code || 'Scheduled event'}</strong></div></section>${meta.public_message || meta.message ? `<aside class="public-message">${e(meta.public_message || meta.message)}</aside>` : ''}`;
  }

  function renderSessions() {
    if (!sessions.length) return '';
    return `<section class="session-panel panel"><div class="panel-heading"><div><p class="eyebrow">Event timeline</p><h2>Three-Day Schedule</h2></div></div><div class="session-timeline">${sessions.map((row) => `<article><span>Session ${row.session_number} · ${e(row.day_name)}</span><strong>${e(SimSite.date(row.scheduled_date, true))}</strong><p>${e(row.processing_instruction)}</p>${status(row.session_status)}</article>`).join('')}</div></section>`;
  }

  function renderDuals() {
    if (!duals.length) return '<section class="panel section-block"><div class="state-card"><p>Matchups will appear here after the field is seeded.</p></div></section>';
    return `<section class="panel table-panel section-block"><div class="panel-heading"><div><p class="eyebrow">Dual-meet ledger</p><h2>Schedule and Results</h2></div><span class="record-pill">${duals.length} duals</span></div><div class="table-wrap"><table class="scheduled-dual-table"><thead><tr><th>Date</th><th>Round</th><th>Team 1</th><th>Score</th><th>Team 2</th><th>Status</th></tr></thead><tbody>${duals.map((row) => `<tr><td>${e(SimSite.date(row.scheduled_date))}</td><td>${e(SimSite.resultLabel(row.round_code || `Round ${row.round_number || ''}`))}</td><td>${teamLink(row.team_1_guid,row.team_1_name)}</td><td><strong>${row.dual_guid ? `${row.team_1_score}–${row.team_2_score}` : 'vs.'}</strong>${row.dual_guid ? `<a class="subtext table-link" href="${SimSite.dualUrl(row.dual_guid)}">View dual</a>` : ''}</td><td>${teamLink(row.team_2_guid,row.team_2_name)}</td><td>${status(row.processing_status)}</td></tr>`).join('')}</tbody></table></div></section>`;
  }

  function renderStandings() {
    if (!standings.length) return '';
    return `<section class="panel table-panel section-block"><div class="panel-heading"><div><p class="eyebrow">NCAA tournament scoring</p><h2>Team Standings</h2></div><span class="record-pill">Top ${standings.length}</span></div><div class="table-wrap"><table><thead><tr><th>Place</th><th>Team</th><th>Total</th><th>Advancement</th><th>Bonus</th><th>Placement</th><th>Champions</th></tr></thead><tbody>${standings.map((row) => `<tr><td class="rank-number">${row.team_placement || '—'}</td><td>${teamLink(row.team_guid,row.team_name)}</td><td><strong>${SimSite.number(row.total_points,1)}</strong></td><td>${SimSite.number(row.advancement_points,1)}</td><td>${SimSite.number(row.bonus_points,1)}</td><td>${SimSite.number(row.placement_points,1)}</td><td>${row.champion_qty || 0}</td></tr>`).join('')}</tbody></table></div></section>`;
  }

  function renderDivisionPicker() {
    if (!divisions.length) return '<section class="panel section-block"><div class="state-card"><p>Divisions will appear when this event is seeded.</p></div></section>';
    return `<section class="division-browser section-block"><div class="section-heading"><div><p class="eyebrow">Tournament divisions</p><h2>Select a Weight Class</h2></div><span class="record-pill">${divisions.length} weights</span></div><div class="division-tabs">${divisions.map((row) => `<button type="button" data-division="${e(row.scheduled_event_division_guid)}" class="${row.scheduled_event_division_guid === selectedDivision ? 'active' : ''}"><strong>${e(row.weight_class_code)}</strong><small>${row.entrant_qty}/${row.entrant_capacity || row.entrant_qty} wrestlers</small><span>${e(SimSite.resultLabel(row.division_status))}</span></button>`).join('')}</div><div id="division-detail"></div></section>`;
  }

  async function renderDivisionDetail() {
    const container = document.getElementById('division-detail');
    const division = divisions.find((row) => row.scheduled_event_division_guid === selectedDivision);
    if (!container || !division) return;
    const podium = placements.filter((row) => row.weight_class_code === division.weight_class_code).sort((a,b) => a.final_placement-b.final_placement);
    container.innerHTML = `<article class="division-summary panel"><div><p class="eyebrow">${e(division.weight_class_code)} pounds</p><h2>${e(division.event_name)}</h2><p>${division.entrant_qty} entrants · ${division.completed_bout_qty} completed bouts</p></div>${status(division.division_status)}</article>${podium.length ? `<section class="event-podium"><h3>Placement Winners</h3><ol>${podium.map((row) => `<li><span>${row.final_placement}</span><div><strong>${wrestlerLink(row.wrestler_guid,row.wrestler_name)}</strong><small>${e(row.team_name || row.state_code || 'Unattached')}</small></div></li>`).join('')}</ol></section>` : '<div class="state-card compact-state"><p>Placements will post when the division is complete.</p></div>'}`;
    if (!division.tournament_guid) return;
    const bracketState = document.createElement('section');
    bracketState.className = 'league-bracket';
    bracketState.innerHTML = '<div class="state-card"><span class="spinner" aria-hidden="true"></span><p>Loading bracket results…</p></div>';
    container.append(bracketState);
    try {
      const rows = await SimApi.tournamentBracketRows(division.tournament_guid);
      const rounds = [...new Set(rows.map((row) => row.round_name))];
      bracketState.innerHTML = `<div class="section-heading"><div><p class="eyebrow">Complete bracket</p><h2>${e(division.weight_class_code)} Results</h2></div></div><div class="league-bracket-grid">${rounds.map((round) => `<div class="league-round"><h3>${e(round)}</h3>${rows.filter((row) => row.round_name === round).map((bout) => `<article class="league-bout"><div class="${bout.winner_wrestler_guid === bout.wrestler_1_guid ? 'winner' : ''}"><span>${bout.wrestler_1_seed || '—'}</span>${wrestlerLink(bout.wrestler_1_guid,bout.wrestler_1_name)}<b>${bout.wrestler_1_match_score ?? '—'}</b></div><div class="${bout.winner_wrestler_guid === bout.wrestler_2_guid ? 'winner' : ''}"><span>${bout.wrestler_2_seed || '—'}</span>${wrestlerLink(bout.wrestler_2_guid,bout.wrestler_2_name)}<b>${bout.wrestler_2_match_score ?? '—'}</b></div><footer>${e(SimSite.resultLabel(bout.result_type))}${bout.match_guid ? `<a href="${SimSite.matchUrl(bout.match_guid, SimSite.eventUrl(eventGuid))}">PBP →</a>` : ''}</footer></article>`).join('')}</div>`).join('')}</div>`;
    } catch (error) {
      SimSite.showError(bracketState, error.message);
    }
  }

  function wireDivisions() {
    document.querySelectorAll('[data-division]').forEach((button) => button.addEventListener('click', () => {
      selectedDivision = button.dataset.division;
      document.querySelectorAll('[data-division]').forEach((item) => item.classList.toggle('active', item === button));
      renderDivisionDetail();
    }));
    renderDivisionDetail();
  }

  try {
    [event, sessions, divisions, placements, duals, standings] = await Promise.all([
      SimApi.leagueEvent(eventGuid), SimApi.leagueSessions(eventGuid), SimApi.scheduledDivisions(eventGuid),
      SimApi.scheduledPlacements(eventGuid), SimApi.scheduledDuals(eventGuid), SimApi.eventTeamStandings(eventGuid)
    ]);
    if (!event) throw new Error('The requested league event was not found.');
    document.title = `${event.event_name} | Sim Wrestling`;
    selectedDivision = divisions[0]?.scheduled_event_division_guid || '';
    const tournamentContent = divisions.length ? renderDivisionPicker() : '';
    root.innerHTML = `${renderHeader()}<nav class="profile-actions event-back"><a class="quiet-link" href="schedule.html?week=${event.week_number}">← Return to Week ${event.week_number}</a></nav>${renderSessions()}${resultTypes(event.event_type) ? renderDuals() : tournamentContent}${renderStandings()}`;
    if (divisions.length) wireDivisions();
  } catch (error) {
    SimSite.showError(root, error.message);
  }
})();
