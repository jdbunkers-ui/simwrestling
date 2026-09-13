(async function () {
  const content = document.getElementById('rankings-content');
  const levelFilter = document.getElementById('competition-level-filter');
  const weightFilter = document.getElementById('weight-filter');
  const regionFilter = document.getElementById('region-filter');
  const stateFilter = document.getElementById('state-filter');
  const countyFilter = document.getElementById('county-filter');
  const localityFilter = document.getElementById('locality-filter');
  const regionControl = document.getElementById('region-filter-control');
  const countyControl = document.getElementById('county-filter-control');
  const localityControl = document.getElementById('locality-filter-control');
  const search = document.getElementById('ranking-search');
  const count = document.getElementById('ranking-count');
  const title = document.getElementById('rankings-title');
  const pageTitle = document.getElementById('directory-page-title');
  const pageCopy = document.getElementById('directory-page-copy');
  const seasonBadge = document.getElementById('ranking-season');
  if (!window.SimSite.configuredOrMessage(content)) return;

  let rankings = [];
  let teams = [];
  let season = null;
  const e = SimSite.escape;
  const normalized = (value) => String(value || '').trim().toLocaleLowerCase();
  const collegeMode = () => levelFilter.value === 'COLLEGE';
  const levelRows = () => rankings.filter((row) => row.competition_level === levelFilter.value);

  function option(value, label) {
    return `<option value="${e(value)}">${e(label)}</option>`;
  }

  function regionName(code) {
    return SimSite.inventoryRegions([...rankings, ...teams]).find((region) => region.code === code)?.name || code;
  }

  function selectedLabel(select) {
    return select.options[select.selectedIndex]?.textContent || '';
  }

  function rebuildWeights(preferred = '') {
    const rows = levelRows();
    weightFilter.innerHTML = SimSite.weightOptions(rows, true, levelFilter.value);
    const values = [...weightFilter.options].map((item) => item.value);
    const fallback = collegeMode() ? '125' : '106';
    weightFilter.value = values.includes(preferred) ? preferred : (values.includes(fallback) ? fallback : values[0]);
  }

  function rebuildRegions(preferred = '') {
    const regions = SimSite.inventoryRegions([...levelRows(), ...teams]);
    regionFilter.innerHTML = option('ALL', 'All regions · National')
      + regions.map((region) => option(region.code, region.name)).join('');
    regionFilter.value = regions.some((region) => region.code === preferred) ? preferred : 'ALL';
    regionFilter.disabled = false;
  }

  function rebuildStates(preferred = '') {
    const source = collegeMode() ? [...levelRows(), ...teams] : levelRows();
    const scoped = collegeMode() && regionFilter.value !== 'ALL'
      ? source.filter((row) => row.region_code === regionFilter.value)
      : source;
    const states = SimSite.inventoryStates(scoped);
    if (collegeMode()) {
      stateFilter.innerHTML = option('ALL', 'All states') + states.map((state) => option(state, state)).join('');
      stateFilter.value = states.includes(preferred) ? preferred : 'ALL';
    } else {
      stateFilter.innerHTML = states.map((state) => option(state, state)).join('');
      stateFilter.value = states.includes(preferred) ? preferred : (states.includes('NJ') ? 'NJ' : states[0] || '');
    }
    stateFilter.disabled = !states.length;
  }

  function rebuildCounties(preferred = '') {
    const counties = new Map();
    levelRows().filter((row) => row.state_code === stateFilter.value).forEach((row) => {
      if (row.county_guid) counties.set(row.county_guid, row.county_name || 'Unnamed county');
    });
    const ordered = [...counties].map(([guid, name]) => ({ guid, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    countyFilter.innerHTML = option('ALL', 'All counties')
      + ordered.map((county) => option(county.guid, county.name)).join('');
    countyFilter.value = ordered.some((county) => county.guid === preferred) ? preferred : 'ALL';
    countyFilter.disabled = !ordered.length;
  }

  function rebuildLocalities(preferred = '') {
    const localities = new Map();
    if (countyFilter.value !== 'ALL') {
      levelRows().filter((row) => row.state_code === stateFilter.value && row.county_guid === countyFilter.value)
        .forEach((row) => {
          if (row.locality_guid) localities.set(row.locality_guid, row.locality_name || row.hometown_city || 'Unnamed locality');
        });
    }
    const ordered = [...localities].map(([guid, name]) => ({ guid, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    localityFilter.innerHTML = option('ALL', 'All towns and cities')
      + ordered.map((locality) => option(locality.guid, locality.name)).join('');
    localityFilter.value = ordered.some((locality) => locality.guid === preferred) ? preferred : 'ALL';
    localityFilter.disabled = countyFilter.value === 'ALL' || !ordered.length;
  }

  function configureGeography(preferred = {}) {
    const college = collegeMode();
    regionControl.hidden = !college;
    countyControl.hidden = college;
    localityControl.hidden = college;
    if (college) {
      rebuildRegions(preferred.region || '');
      rebuildStates(preferred.state || '');
      countyFilter.value = 'ALL';
      localityFilter.value = 'ALL';
    } else {
      regionFilter.value = 'ALL';
      rebuildStates(preferred.state || '');
      rebuildCounties(preferred.county || '');
      rebuildLocalities(preferred.locality || '');
    }
  }

  function wrestlerRankValue(row) {
    if (collegeMode() && weightFilter.value === 'PBP') {
      return Number(stateFilter.value === 'ALL' ? row.pound_for_pound_rank : row.state_pound_for_pound_rank);
    }
    return Number(stateFilter.value === 'ALL' ? row.weight_class_rank : row.state_weight_rank);
  }

  function scopedWrestlers() {
    const college = collegeMode();
    return levelRows().filter((row) => {
      if (weightFilter.value !== 'PBP' && row.weight_class_code !== weightFilter.value) return false;
      if (college) {
        if (regionFilter.value !== 'ALL' && row.region_code !== regionFilter.value) return false;
        return stateFilter.value === 'ALL' || row.state_code === stateFilter.value;
      }
      if (row.state_code !== stateFilter.value) return false;
      if (countyFilter.value !== 'ALL' && row.county_guid !== countyFilter.value) return false;
      return localityFilter.value === 'ALL' || row.locality_guid === localityFilter.value;
    }).sort((a, b) => wrestlerRankValue(a) - wrestlerRankValue(b)
      || String(a.wrestler_name).localeCompare(String(b.wrestler_name))
      || String(a.wrestler_guid).localeCompare(String(b.wrestler_guid)))
      .map((row, index) => ({ ...row, display_rank: index + 1 }));
  }

  function teamComparator(a, b) {
    return (Number(a.dual_qty || 0) > 0 ? 0 : 1) - (Number(b.dual_qty || 0) > 0 ? 0 : 1)
      || Number(b.dual_win_rate || 0) - Number(a.dual_win_rate || 0)
      || Number(b.dual_win_qty || 0) - Number(a.dual_win_qty || 0)
      || Number(b.tied_opponent_win_qty || 0) - Number(a.tied_opponent_win_qty || 0)
      || Number(b.average_dual_margin || 0) - Number(a.average_dual_margin || 0)
      || Number(b.starter_win_rate || 0) - Number(a.starter_win_rate || 0)
      || Number(b.starter_bonus_rate || 0) - Number(a.starter_bonus_rate || 0)
      || Number(a.aggregate_state_rank || 9999) - Number(b.aggregate_state_rank || 9999)
      || String(a.team_name).localeCompare(String(b.team_name))
      || String(a.team_guid).localeCompare(String(b.team_guid));
  }

  function scopedTeams() {
    return teams.filter((row) => (regionFilter.value === 'ALL' || row.region_code === regionFilter.value)
      && (stateFilter.value === 'ALL' || row.state_code === stateFilter.value))
      .sort(teamComparator).map((row, index) => ({ ...row, display_rank: index + 1 }));
  }

  function visibleWrestlers() {
    const phrase = normalized(search.value);
    return scopedWrestlers().filter((row) => !phrase
      || normalized(`${row.wrestler_name} ${row.team_name || ''} ${row.hometown_display || ''}`).includes(phrase));
  }

  function visibleTeams() {
    const phrase = normalized(search.value);
    return scopedTeams().filter((row) => !phrase
      || normalized(`${row.team_name} ${row.hometown_city || ''}`).includes(phrase));
  }

  function scopeLabel() {
    if (collegeMode()) {
      if (stateFilter.value !== 'ALL') return stateFilter.value;
      if (regionFilter.value !== 'ALL') return regionName(regionFilter.value);
      return 'National';
    }
    if (localityFilter.value !== 'ALL') return selectedLabel(localityFilter);
    if (countyFilter.value !== 'ALL') return selectedLabel(countyFilter);
    return stateFilter.value;
  }

  function syncUrl() {
    SimSite.syncFilters({
      level: levelFilter.value,
      weight: weightFilter.value,
      region: collegeMode() ? regionFilter.value : '',
      state: stateFilter.value,
      county: collegeMode() ? '' : countyFilter.value,
      locality: collegeMode() ? '' : localityFilter.value,
      q: search.value.trim()
    });
  }

  function render() {
    const level = levelFilter.value;
    const teamMode = collegeMode() && weightFilter.value === 'TEAM';
    const levelLabel = SimSite.levelLabel(level);
    const scope = scopeLabel();
    search.placeholder = teamMode ? 'Start typing a college or city'
      : (collegeMode() ? 'Start typing a wrestler or college' : 'Start typing a wrestler or hometown');
    syncUrl();

    if (teamMode) {
      const filteredRows = visibleTeams();
      const rows = filteredRows.slice(0, 25);
      count.textContent = `Top ${rows.length} of ${filteredRows.length} team${filteredRows.length === 1 ? '' : 's'}`;
      title.textContent = `${scope} Team Rankings`;
      pageTitle.textContent = 'Team Rankings';
      pageCopy.textContent = 'Active college programs ranked by dual record and starting-lineup performance.';
      if (!rows.length) { content.innerHTML = '<div class="state-card"><p>No teams match the selected filters.</p></div>'; return; }
      content.innerHTML = `<div class="table-wrap"><table class="team-ranking-table"><thead><tr><th>Rank</th><th>Team</th><th>City</th><th>Record</th><th>Win %</th><th>Avg. margin</th></tr></thead><tbody>${rows.map((row) => `<tr><td class="rank-number">${row.display_rank}</td><td><a class="wrestler-link" href="${SimSite.teamUrl(row.team_guid)}">${e(row.team_name)}</a><span class="subtext">${e(row.ranking_basis === 'DUAL_RECORD' ? 'Ranked by dual results' : 'Ranked by starting ten')}</span></td><td>${e(row.hometown_city || '—')}, ${e(row.state_code || '')}</td><td><strong>${e(row.dual_record_display || '0-0')}</strong></td><td>${SimSite.percent(row.dual_win_rate,1)}</td><td>${Number(row.average_dual_margin || 0) > 0 ? '+' : ''}${SimSite.number(row.average_dual_margin,1)}</td></tr>`).join('')}</tbody></table></div>`;
      return;
    }

    const filteredRows = visibleWrestlers();
    const rows = filteredRows.slice(0, 25);
    count.textContent = `Top ${rows.length} of ${filteredRows.length} wrestler${filteredRows.length === 1 ? '' : 's'}`;
    const division = weightFilter.value === 'PBP' ? 'Pound-for-Pound' : `${weightFilter.value}-Pound`;
    title.textContent = `${scope} ${levelLabel} ${division} Rankings`;
    pageTitle.textContent = `${levelLabel} Wrestler Rankings`;
    pageCopy.textContent = collegeMode()
      ? 'Current college wrestlers ranked nationally, regionally or by state.'
      : 'Current high-school wrestlers ranked within a state, county or hometown.';
    if (!rows.length) { content.innerHTML = '<div class="state-card"><p>No wrestlers match the selected filters.</p></div>'; return; }

    const college = collegeMode();
    content.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Rank</th><th>Weight</th><th>Wrestler</th><th>${college ? 'College team' : 'Hometown'}</th>${college ? '' : '<th>Year</th>'}<th>Wins</th><th>Losses</th><th>Bonus %</th></tr></thead><tbody>${rows.map((row) => `<tr><td class="rank-number">${row.display_rank}</td><td><strong>${e(row.weight_class_code)}</strong></td><td><a class="wrestler-link" href="${SimSite.profileUrl(row.wrestler_guid)}">${e(row.wrestler_name)}</a>${row.roster_status === 'BACKUP' ? '<span class="subtext">Backup</span>' : ''}</td><td>${college ? (row.team_name ? `<a class="table-link" href="${SimSite.teamUrl(row.team_guid)}">${e(row.team_name)}</a>` : '—') : e(row.hometown_display || row.state_code)}</td>${college ? '' : `<td>${e(row.eligibility_year_display)}</td>`}<td>${row.win_qty}</td><td>${row.loss_qty}</td><td><span class="bonus-pill">${e(row.bonus_point_percentage_display || '0.0%')}</span></td></tr>`).join('')}</tbody></table></div>`;
  }

  try {
    [rankings, teams, season] = await Promise.all([SimApi.rankings(), SimApi.teamRankings(), SimApi.season()]);
    season = season?.[0] || null;
    if (seasonBadge && season) seasonBadge.textContent = season.season_name;
    levelFilter.value = SimSite.selectedLevel();
    rebuildWeights(String(SimSite.query('weight') || '').toUpperCase());
    configureGeography({
      region: String(SimSite.query('region') || '').toUpperCase(),
      state: String(SimSite.query('state') || '').toUpperCase(),
      county: SimSite.query('county') || '',
      locality: SimSite.query('locality') || ''
    });
    search.value = SimSite.query('q') || '';
    levelFilter.disabled = false;
    weightFilter.disabled = false;

    levelFilter.addEventListener('change', () => {
      rebuildWeights();
      configureGeography({ state: levelFilter.value === 'HIGH_SCHOOL' ? 'NJ' : '' });
      render();
    });
    weightFilter.addEventListener('change', render);
    regionFilter.addEventListener('change', () => { rebuildStates(); render(); });
    stateFilter.addEventListener('change', () => {
      if (!collegeMode()) { rebuildCounties(); rebuildLocalities(); }
      render();
    });
    countyFilter.addEventListener('change', () => { rebuildLocalities(); render(); });
    localityFilter.addEventListener('change', render);
    search.addEventListener('input', render);
    render();
  } catch (error) {
    SimSite.showError(content, error.message);
    count.textContent = 'Unavailable';
  }
})();
