(async function () {
  const root = document.getElementById('event-root');
  const eventGuid = SimSite.query('event');
  if (!eventGuid) { SimSite.showError(root, 'No scheduled event was selected.'); return; }
  if (!SimSite.configuredOrMessage(root)) return;
  const e = SimSite.escape;
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
    const isTeamTournament = String(event.format_code || '').toUpperCase() === 'TEAM_SINGLE_ELIMINATION'
      || /_DUAL(?:_|$)/i.test(String(event.event_type || ''));
    if (isTeamTournament && !String(event.event_type || '').includes('QUAD')) {
      return renderTeamTournamentBracket();
    }
    const heading = String(event.event_type || '').includes('QUAD') ? 'All Quad Dual Meets' : 'Schedule and Results';
    return `<section class="panel table-panel section-block"><div class="panel-heading"><div><p class="eyebrow">Dual-meet ledger</p><h2>${heading}</h2></div><span class="record-pill">${duals.length} duals</span></div><div class="table-wrap"><table class="scheduled-dual-table"><thead><tr><th>Date</th><th>Round</th><th>Team 1</th><th>Score</th><th>Team 2</th><th>Status</th></tr></thead><tbody>${duals.map((row) => `<tr><td>${e(SimSite.date(row.scheduled_date))}</td><td>${e(SimSite.resultLabel(row.round_code || `Round ${row.round_number || ''}`))}</td><td>${teamLink(row.team_1_guid,row.team_1_name)}</td><td><strong>${row.dual_guid ? `${row.team_1_score}–${row.team_2_score}` : 'vs.'}</strong>${row.dual_guid ? `<a class="subtext table-link" href="${SimSite.dualUrl(row.dual_guid)}">View dual</a>` : ''}</td><td>${teamLink(row.team_2_guid,row.team_2_name)}</td><td>${status(row.processing_status)}</td></tr>`).join('')}</tbody></table></div></section>`;
  }

  function teamBracketLine(guid, name, score, winner) {
    const label = name || 'TBD';
    return `<div class="team-bracket-line ${winner ? 'winner' : ''} ${guid ? '' : 'tbd'}">${guid ? teamLink(guid, label) : `<em>${e(label)}</em>`}<b>${score ?? '—'}</b></div>`;
  }

  function teamBracketBout(dual, roundName, slot) {
    if (!dual) {
      return `<article class="visual-bracket-bout team-bracket-bout upcoming"><header><span>Dual ${slot}</span><small>${e(roundName)}</small></header>${teamBracketLine(null, 'TBD')}${teamBracketLine(null, 'TBD')}<footer><span>Upcoming</span></footer></article>`;
    }
    const completed = Boolean(dual.dual_guid);
    const scoreOne = Number(dual.team_1_score);
    const scoreTwo = Number(dual.team_2_score);
    const firstWon = completed && scoreOne > scoreTwo;
    const secondWon = completed && scoreTwo > scoreOne;
    return `<article class="visual-bracket-bout team-bracket-bout ${completed ? 'completed' : 'upcoming'}"><header><span>${e(dual.dual_code || `Dual ${slot}`)}</span><small>${e(SimSite.resultLabel(dual.round_code || roundName))}</small></header>${teamBracketLine(dual.team_1_guid, dual.team_1_name, completed ? dual.team_1_score : null, firstWon)}${teamBracketLine(dual.team_2_guid, dual.team_2_name, completed ? dual.team_2_score : null, secondWon)}<footer><span>${completed ? 'Final' : e(SimSite.resultLabel(dual.processing_status || 'Scheduled'))}</span>${completed ? `<a href="${SimSite.dualUrl(dual.dual_guid)}">View dual →</a>` : ''}</footer></article>`;
  }

  function teamDualRoundGroups(rows) {
    const groups = new Map();
    rows.slice().sort((a, b) => Number(a.dual_order || 0) - Number(b.dual_order || 0)).forEach((dual) => {
      const numericRound = Number(dual.round_number || 0);
      const key = numericRound || roundKey(dual.round_code || 'ROUND_1');
      if (!groups.has(key)) groups.set(key, {
        roundNumber: numericRound,
        name: SimSite.resultLabel(dual.round_code || `Round ${numericRound || groups.size + 1}`),
        duals: []
      });
      groups.get(key).duals.push(dual);
    });
    return Array.from(groups.values()).sort((a, b) => {
      if (a.roundNumber && b.roundNumber) return a.roundNumber - b.roundNumber;
      return Number(a.duals[0]?.dual_order || 0) - Number(b.duals[0]?.dual_order || 0);
    });
  }

  function renderTeamTournamentBracket() {
    const uniqueTeams = new Set();
    duals.forEach((dual) => {
      if (dual.team_1_guid) uniqueTeams.add(dual.team_1_guid);
      if (dual.team_2_guid) uniqueTeams.add(dual.team_2_guid);
    });
    const size = nextPowerOfTwo(Math.max(Number(event.invited_team_qty || 0), uniqueTeams.size, 2));
    const template = championshipTemplate(size);
    const actual = teamDualRoundGroups(duals);
    const rounds = template.map((expected, index) => ({
      name: actual[index]?.name || expected.name,
      duals: actual[index]?.duals || [],
      count: Math.max(expected.count, actual[index]?.duals?.length || 0)
    }));
    if (actual.length > template.length) {
      rounds.push(...actual.slice(template.length).map((group) => ({
        name: group.name,
        duals: group.duals,
        count: group.duals.length
      })));
    }
    const bracketWidth = (rounds.length * 270) + (Math.max(0, rounds.length - 1) * 54);
    const completedQty = duals.filter((dual) => dual.dual_guid).length;
    return `<section class="team-tournament-shell section-block"><div class="visual-bracket-heading"><div><p class="eyebrow">Team championship results</p><h2>${e(event.event_name)}</h2><p>Winners advance through one single-elimination bracket. This team tournament has no wrestlebacks.</p></div><div class="bracket-legend"><span><i class="legend-winner"></i>Winner</span><span><i class="legend-upcoming"></i>Upcoming</span></div></div><section class="visual-bracket-section team-championship-side"><header><div><p class="eyebrow">College dual tournament</p><h3>Championship Bracket</h3></div><span>${completedQty} of ${size - 1} duals completed</span></header><div class="visual-bracket-scroll"><div class="visual-bracket-grid team-bracket-grid" style="--round-count:${rounds.length};--bracket-width:${bracketWidth}px">${rounds.map((round) => `<section class="visual-bracket-round"><h4>${e(round.name)}</h4><div class="visual-bracket-round-bouts">${Array.from({ length: round.count }, (_, index) => teamBracketBout(round.duals[index], round.name, index + 1)).join('')}</div></section>`).join('')}</div></div></section></section>`;
  }

  function renderStandings() {
    if (!standings.length) return '';
    return `<section class="panel table-panel section-block"><div class="panel-heading"><div><p class="eyebrow">NCAA tournament scoring</p><h2>Team Standings</h2></div><span class="record-pill">Top ${standings.length}</span></div><div class="table-wrap"><table><thead><tr><th>Place</th><th>Team</th><th>Total</th><th>Advancement</th><th>Bonus</th><th>Placement</th><th>Champions</th></tr></thead><tbody>${standings.map((row) => `<tr><td class="rank-number">${row.team_placement || '—'}</td><td>${teamLink(row.team_guid,row.team_name)}</td><td><strong>${SimSite.number(row.total_points,1)}</strong></td><td>${SimSite.number(row.advancement_points,1)}</td><td>${SimSite.number(row.bonus_points,1)}</td><td>${SimSite.number(row.placement_points,1)}</td><td>${row.champion_qty || 0}</td></tr>`).join('')}</tbody></table></div></section>`;
  }

  function renderDivisionPicker() {
    if (!divisions.length) return '<section class="panel section-block"><div class="state-card"><p>Divisions will appear when this event is seeded.</p></div></section>';
    return `<section class="division-browser section-block"><div class="section-heading"><div><p class="eyebrow">Tournament divisions</p><h2>Select a Weight Class</h2></div><span class="record-pill">${divisions.length} weights</span></div><div class="division-tabs">${divisions.map((row) => `<button type="button" data-division="${e(row.scheduled_event_division_guid)}" class="${row.scheduled_event_division_guid === selectedDivision ? 'active' : ''}"><strong>${e(row.weight_class_code)}</strong><small>${row.entrant_qty}/${row.entrant_capacity || row.entrant_qty} wrestlers</small><span>${e(SimSite.resultLabel(row.division_status))}</span></button>`).join('')}</div><div id="division-detail"></div></section>`;
  }

  const roundKey = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const nextPowerOfTwo = (value) => {
    let size = 4;
    while (size < Number(value || 0) && size < 64) size *= 2;
    return size;
  };

  function championshipTemplate(size) {
    const rounds = [];
    for (let field = size; field >= 2; field /= 2) {
      const name = field === 2 ? 'Championship'
        : field === 4 ? 'Semifinals'
        : field === 8 ? 'Quarterfinals'
        : `Round of ${field}`;
      rounds.push({ name, count: field / 2 });
    }
    return rounds;
  }

  function consolationTemplate(size) {
    const rounds = [];
    let count = Math.max(1, size / 4);
    const roundQty = Math.max(2, (Math.log2(size) - 1) * 2);
    for (let index = 1; index <= roundQty; index += 1) {
      rounds.push({ name: `Wrestlebacks ${index}`, count });
      if (index % 2 === 0) count = Math.max(1, count / 2);
    }
    return rounds;
  }

  function groupRounds(rows) {
    const groups = [];
    rows.sort((a, b) => Number(a.bout_order) - Number(b.bout_order)).forEach((bout) => {
      const code = roundKey(bout.round_code || bout.round_name);
      let group = groups.find((item) => item.code === code);
      if (!group) {
        group = { code, name: bout.round_name || SimSite.resultLabel(bout.round_code), bouts: [] };
        groups.push(group);
      }
      group.bouts.push(bout);
    });
    return groups;
  }

  function mergeRoundTemplate(template, actualGroups) {
    const used = new Set();
    return template.map((expected, index) => {
      let actualIndex = actualGroups.findIndex((group, candidateIndex) =>
        !used.has(candidateIndex) && roundKey(group.name) === roundKey(expected.name));
      if (actualIndex < 0 && actualGroups[index] && !used.has(index)) actualIndex = index;
      const actual = actualIndex >= 0 ? actualGroups[actualIndex] : null;
      if (actualIndex >= 0) used.add(actualIndex);
      return {
        name: actual?.name || expected.name,
        bouts: actual?.bouts || [],
        count: Math.max(Number(expected.count), actual?.bouts?.length || 0)
      };
    }).concat(actualGroups.filter((_, index) => !used.has(index)).map((group) => ({
      name: group.name,
      bouts: group.bouts,
      count: group.bouts.length
    })));
  }

  function bracketWrestler(guid, name, seed, score, winner) {
    const label = name || 'TBD';
    return `<div class="bracket-line ${winner ? 'winner' : ''} ${guid ? '' : 'tbd'}"><span>${seed || '—'}</span>${guid ? wrestlerLink(guid, label) : `<em>${e(label)}</em>`}<b>${score ?? '—'}</b></div>`;
  }

  function bracketBout(bout, roundName, slot) {
    if (!bout) {
      return `<article class="visual-bracket-bout upcoming"><header><span>Match ${slot}</span><small>${e(roundName)}</small></header>${bracketWrestler(null, 'TBD')}${bracketWrestler(null, 'TBD')}<footer><span>Upcoming</span></footer></article>`;
    }
    const firstWon = bout.winner_wrestler_guid && bout.winner_wrestler_guid === bout.wrestler_1_guid;
    const secondWon = bout.winner_wrestler_guid && bout.winner_wrestler_guid === bout.wrestler_2_guid;
    return `<article class="visual-bracket-bout ${bout.match_guid ? 'completed' : 'upcoming'}"><header><span>${e(bout.bout_code || `Match ${slot}`)}</span><small>${e(bout.round_name || roundName)}</small></header>${bracketWrestler(bout.wrestler_1_guid, bout.wrestler_1_name, bout.wrestler_1_seed, bout.wrestler_1_match_score, firstWon)}${bracketWrestler(bout.wrestler_2_guid, bout.wrestler_2_name, bout.wrestler_2_seed, bout.wrestler_2_match_score, secondWon)}<footer><span>${bout.match_guid ? e(SimSite.resultLabel(bout.result_type)) : 'Upcoming'}</span>${bout.match_guid ? `<a href="${SimSite.matchUrl(bout.match_guid, SimSite.eventUrl(eventGuid))}">PBP →</a>` : ''}</footer></article>`;
  }

  function bracketSection(title, subtitle, rounds, cssClass) {
    const bracketWidth = (rounds.length * 250) + (Math.max(0, rounds.length - 1) * 54);
    return `<section class="visual-bracket-section ${cssClass}"><header><div><p class="eyebrow">${e(subtitle)}</p><h3>${e(title)}</h3></div><span>${rounds.length} rounds</span></header><div class="visual-bracket-scroll"><div class="visual-bracket-grid" style="--round-count:${rounds.length};--bracket-width:${bracketWidth}px">${rounds.map((round) => `<section class="visual-bracket-round"><h4>${e(round.name)}</h4><div class="visual-bracket-round-bouts">${Array.from({ length: round.count }, (_, index) => bracketBout(round.bouts[index], round.name, index + 1)).join('')}</div></section>`).join('')}</div></div></section>`;
  }

  function renderLiveBracket(rows, division) {
    const size = nextPowerOfTwo(Math.max(Number(division.entrant_capacity), Number(division.entrant_qty)));
    const championship = [];
    const consolation = [];
    const placement = [];
    rows.forEach((bout) => {
      const side = String(bout.bracket_side || '').toUpperCase();
      const round = String(bout.round_name || bout.round_code || '');
      if (side === 'CHAMPIONSHIP') championship.push(bout);
      else if (side === 'PLACEMENT' || /PLACE|THIRD|FIFTH|SEVENTH/i.test(round)) placement.push(bout);
      else consolation.push(bout);
    });
    const championshipRounds = mergeRoundTemplate(championshipTemplate(size), groupRounds(championship));
    const consolationRounds = mergeRoundTemplate(consolationTemplate(size), groupRounds(consolation));
    const placementGroups = groupRounds(placement);
    const placementTemplate = event.competition_level === 'HIGH_SCHOOL'
      ? [{ name: 'Seventh Place', count: 1 }, { name: 'Fifth Place', count: 1 }, { name: 'Third Place', count: 1 }]
      : [{ name: 'Third Place', count: 1 }];
    const placementRounds = mergeRoundTemplate(placementTemplate, placementGroups);
    return `<div class="visual-bracket-shell"><div class="visual-bracket-heading"><div><p class="eyebrow">Live tournament results</p><h2>${e(division.weight_class_code)} Double-Elimination Bracket</h2><p>Completed bouts are highlighted. Future positions remain visible as TBD until the next session is processed.</p></div><div class="bracket-legend"><span><i class="legend-winner"></i>Winner</span><span><i class="legend-upcoming"></i>Upcoming</span></div></div>${bracketSection('Championship Bracket', 'Winners advance toward the title', championshipRounds, 'championship-side')}${bracketSection('Wrestlebacks', 'A second loss ends the tournament', consolationRounds, 'consolation-side')}${bracketSection('Placement Matches', 'Final podium positions', placementRounds, 'placement-side')}</div>`;
  }

  async function renderDivisionDetail() {
    const container = document.getElementById('division-detail');
    const division = divisions.find((row) => row.scheduled_event_division_guid === selectedDivision);
    if (!container || !division) return;
    const placementLimit = event.competition_level === 'HIGH_SCHOOL' ? 8 : 4;
    const podium = placements.filter((row) => row.weight_class_code === division.weight_class_code
      && Number(row.final_placement) <= placementLimit).sort((a,b) => a.final_placement-b.final_placement);
    container.innerHTML = `<article class="division-summary panel"><div><p class="eyebrow">${e(division.weight_class_code)} pounds</p><h2>${e(division.event_name)}</h2><p>${division.entrant_qty} entrants · ${division.completed_bout_qty} completed bouts</p></div>${status(division.division_status)}</article>${podium.length ? `<section class="event-podium"><h3>Placement Winners</h3><ol>${podium.map((row) => `<li><span>${row.final_placement}</span><div><strong>${wrestlerLink(row.wrestler_guid,row.wrestler_name)}</strong><small>${e(row.team_name || row.state_code || 'Unattached')}</small></div></li>`).join('')}</ol></section>` : '<div class="state-card compact-state"><p>Placements will post when the division is complete.</p></div>'}`;
    if (!division.tournament_guid) return;
    const bracketState = document.createElement('section');
    bracketState.className = 'league-bracket';
    bracketState.innerHTML = '<div class="state-card"><span class="spinner" aria-hidden="true"></span><p>Loading bracket results…</p></div>';
    container.append(bracketState);
    try {
      const rows = await SimApi.tournamentBracketRows(division.tournament_guid);
      const completedBoutQty = rows.filter((row) => row.match_guid).length;
      const summary = container.querySelector('.division-summary p');
      if (summary) summary.textContent = `${division.entrant_qty} entrants · ${completedBoutQty} completed bouts`;
      bracketState.innerHTML = renderLiveBracket(rows, division);
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
    const requestedWeight = String(SimSite.query('weight') || '').toUpperCase();
    selectedDivision = divisions.find((row) => String(row.weight_class_code).toUpperCase() === requestedWeight)?.scheduled_event_division_guid
      || divisions[0]?.scheduled_event_division_guid || '';
    const tournamentContent = divisions.length ? renderDivisionPicker() : '';
    const eventResults = divisions.length ? tournamentContent : renderDuals();
    root.innerHTML = `${renderHeader()}<nav class="profile-actions event-back"><a class="quiet-link" href="results.html?week=${event.week_number}&level=${encodeURIComponent(event.competition_level)}">← Return to Week ${event.week_number} Results</a><a class="quiet-link" href="schedule.html?week=${event.week_number}&level=${encodeURIComponent(event.competition_level)}">View Schedule</a></nav>${renderSessions()}${eventResults}${renderStandings()}`;
    if (divisions.length) wireDivisions();
  } catch (error) {
    SimSite.showError(root, error.message);
  }
})();
