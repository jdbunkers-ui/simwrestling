(async function () {
  const content = document.getElementById('rankings-content');
  const levelFilter = document.getElementById('competition-level-filter');
  const weightFilter = document.getElementById('weight-filter');
  const stateFilter = document.getElementById('state-filter');
  const search = document.getElementById('ranking-search');
  const count = document.getElementById('ranking-count');
  const title = document.getElementById('rankings-title');
  const pageTitle = document.getElementById('directory-page-title');
  const pageCopy = document.getElementById('directory-page-copy');
  const dualAction = document.getElementById('dual-action');
  const tournamentAction = document.getElementById('tournament-action');
  const seasonBadge = document.getElementById('ranking-season');
  if (!window.SimSite.configuredOrMessage(content)) return;

  let rankings = [];
  let teams = [];
  let season = null;
  const normalized = (value) => String(value || '').trim().toLocaleLowerCase();
  const levelRows = () => rankings.filter((row) => row.competition_level === levelFilter.value);

  function rankFor(row) {
    const stateSelected = stateFilter.value !== 'ALL';
    if (weightFilter.value === 'PBP') {
      return stateSelected ? row.state_pound_for_pound_rank : row.pound_for_pound_rank;
    }
    return stateSelected ? row.state_weight_rank : row.weight_class_rank;
  }

  function rebuildStates(preferred = '') {
    const states = [...new Set([
      ...SimSite.inventoryStates(levelRows()),
      ...(levelFilter.value === 'COLLEGE' ? teams.map((team) => team.state_code).filter(Boolean) : [])
    ])].sort();
    stateFilter.innerHTML = '<option value="ALL">All states</option>'
      + states.map((state) => `<option value="${SimSite.escape(state)}">${SimSite.escape(state)}</option>`).join('');
    stateFilter.value = states.includes(preferred) ? preferred : 'ALL';
    stateFilter.disabled = !states.length;
  }

  function rebuildWeights(preferred = '') {
    const rows = levelRows();
    weightFilter.innerHTML = SimSite.weightOptions(rows, true, levelFilter.value);
    const options = [...weightFilter.options].map((option) => option.value);
    const fallback = levelFilter.value === 'HIGH_SCHOOL' ? '106' : '125';
    weightFilter.value = options.includes(preferred) ? preferred : (options.includes(fallback) ? fallback : 'PBP');
  }

  function visibleRows() {
    const phrase = normalized(search.value);
    return levelRows().filter((row) => {
      const weightMatches = weightFilter.value === 'PBP' || row.weight_class_code === weightFilter.value;
      const stateMatches = stateFilter.value === 'ALL' || row.state_code === stateFilter.value;
      const textMatches = !phrase || normalized(`${row.wrestler_name} ${row.team_name || ''} ${row.hometown_display || ''}`).includes(phrase);
      return weightMatches && stateMatches && textMatches;
    }).sort((a, b) => rankFor(a) - rankFor(b));
  }

  function visibleTeams() {
    const phrase = normalized(search.value);
    return teams.filter((row) => {
      const stateMatches = stateFilter.value === 'ALL' || row.state_code === stateFilter.value;
      const textMatches = !phrase || normalized(`${row.team_name} ${row.hometown_city || ''}`).includes(phrase);
      return stateMatches && textMatches;
    });
  }

  function syncActions() {
    const level = levelFilter.value;
    dualAction.hidden = level !== 'COLLEGE';
    tournamentAction.href = `tournament.html?level=${encodeURIComponent(level)}${stateFilter.value !== 'ALL' ? `&state=${encodeURIComponent(stateFilter.value)}` : ''}${!['TEAM','PBP'].includes(weightFilter.value) ? `&weight=${encodeURIComponent(weightFilter.value)}` : ''}`;
    tournamentAction.querySelector('span').textContent = level === 'HIGH_SCHOOL' ? 'State · variable field' : '16-wrestler bracket';
  }

  function render() {
    const level = levelFilter.value;
    const teamMode = level === 'COLLEGE' && weightFilter.value === 'TEAM';
    const levelLabel = SimSite.levelLabel(level);
    search.placeholder = teamMode ? 'Start typing a college or city' : (level === 'HIGH_SCHOOL' ? 'Start typing a wrestler or hometown' : 'Start typing a wrestler or college');
    syncActions();
    SimSite.syncFilters({ level, weight: weightFilter.value, state: stateFilter.value, q: search.value.trim() });

    if (teamMode) {
      const rows = visibleTeams();
      count.textContent = `${rows.length} team${rows.length === 1 ? '' : 's'}`;
      title.textContent = 'Team Rankings';
      pageTitle.textContent = 'Team Rankings';
      pageCopy.textContent = 'Active college programs ranked by dual record and starting-lineup performance.';
      if (!rows.length) { content.innerHTML = '<div class="state-card"><p>No teams match the selected filters.</p></div>'; return; }
      content.innerHTML = `<div class="table-wrap"><table class="team-ranking-table"><thead><tr><th>Rank</th><th>Team</th><th>City</th><th>Record</th><th>Win %</th><th>Avg. margin</th></tr></thead><tbody>${rows.map((row) => `<tr><td class="rank-number">${row.state_team_rank}</td><td><a class="wrestler-link" href="${SimSite.teamUrl(row.team_guid)}">${SimSite.escape(row.team_name)}</a><span class="subtext">${SimSite.escape(row.ranking_basis === 'DUAL_RECORD' ? 'Ranked by dual results' : 'Ranked by starting ten')}</span></td><td>${SimSite.escape(row.hometown_city || '—')}, ${SimSite.escape(row.state_code || '')}</td><td><strong>${SimSite.escape(row.dual_record_display || '0-0')}</strong></td><td>${SimSite.percent(row.dual_win_rate,1)}</td><td>${Number(row.average_dual_margin || 0) > 0 ? '+' : ''}${SimSite.number(row.average_dual_margin,1)}</td></tr>`).join('')}</tbody></table></div>`;
      return;
    }

    const rows = visibleRows();
    count.textContent = `${rows.length} wrestler${rows.length === 1 ? '' : 's'}`;
    title.textContent = weightFilter.value === 'PBP' ? `${levelLabel} Pound-for-Pound` : `${levelLabel} ${weightFilter.value}-Pound Rankings`;
    pageTitle.textContent = `${levelLabel} Wrestler Rankings`;
    pageCopy.textContent = level === 'HIGH_SCHOOL'
      ? 'Current high-school wrestlers ranked by state, weight class and season performance.'
      : 'Current college wrestlers ranked across every program and weight class.';
    if (!rows.length) { content.innerHTML = '<div class="state-card"><p>No wrestlers match the selected filters.</p></div>'; return; }

    const college = level === 'COLLEGE';
    content.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Rank</th><th>Weight</th><th>Wrestler</th><th>${college ? 'College team' : 'Hometown'}</th>${college ? '' : '<th>Year</th>'}<th>Wins</th><th>Losses</th><th>Bonus %</th></tr></thead><tbody>${rows.map((row) => `<tr><td class="rank-number">${rankFor(row)}</td><td><strong>${SimSite.escape(row.weight_class_code)}</strong></td><td><a class="wrestler-link" href="${SimSite.profileUrl(row.wrestler_guid)}">${SimSite.escape(row.wrestler_name)}</a>${row.roster_status === 'BACKUP' ? '<span class="subtext">Backup</span>' : ''}</td><td>${college ? (row.team_name ? `<a class="table-link" href="${SimSite.teamUrl(row.team_guid)}">${SimSite.escape(row.team_name)}</a>` : '—') : SimSite.escape(row.hometown_display || row.state_code)}</td>${college ? '' : `<td>${SimSite.escape(row.eligibility_year_display)}</td>`}<td>${row.win_qty}</td><td>${row.loss_qty}</td><td><span class="bonus-pill">${SimSite.escape(row.bonus_point_percentage_display || '0.0%')}</span></td></tr>`).join('')}</tbody></table></div>`;
  }

  try {
    [rankings, teams, season] = await Promise.all([SimApi.rankings(), SimApi.teamRankings(), SimApi.season()]);
    season = season?.[0] || null;
    if (seasonBadge && season) seasonBadge.textContent = season.season_name;
    levelFilter.value = SimSite.selectedLevel();
    rebuildStates(String(SimSite.query('state') || '').toUpperCase());
    rebuildWeights(String(SimSite.query('weight') || '').toUpperCase());
    search.value = SimSite.query('q') || '';
    levelFilter.disabled = false; weightFilter.disabled = false;
    levelFilter.addEventListener('change', () => { rebuildStates(''); rebuildWeights(''); render(); });
    weightFilter.addEventListener('change', render);
    stateFilter.addEventListener('change', render);
    search.addEventListener('input', render);
    render();
  } catch (error) {
    SimSite.showError(content,error.message); count.textContent = 'Unavailable';
  }
})();
