(async function () {
  const content = document.getElementById('statistics-content');
  const title = document.getElementById('statistics-title');
  const levelFilter = document.getElementById('statistics-level-filter');
  const weightFilter = document.getElementById('statistics-weight-filter');
  const regionFilter = document.getElementById('statistics-region-filter');
  const stateFilter = document.getElementById('statistics-state-filter');
  const countyFilter = document.getElementById('statistics-county-filter');
  const localityFilter = document.getElementById('statistics-locality-filter');
  const regionControl = document.getElementById('statistics-region-control');
  const countyControl = document.getElementById('statistics-county-control');
  const localityControl = document.getElementById('statistics-locality-control');
  const search = document.getElementById('statistics-search');
  const count = document.getElementById('statistics-count');
  const tabs = [...document.querySelectorAll('[data-statistics-view]')];
  if (!window.SimSite.configuredOrMessage(content)) return;

  let rows = [];
  let view = 'results';
  let sort = { key: 'wrestler_rank', direction: 'asc' };
  let scopeRanks = new Map();
  const e = SimSite.escape;
  const collegeMode = () => levelFilter.value === 'COLLEGE';
  const levelRows = () => rows.filter((row) => row.competition_level === levelFilter.value);
  const numeric = (key) => (row) => Number(row[key] || 0);

  function displayedRank(row) {
    return scopeRanks.get(row.wrestler_guid) || 0;
  }

  const sortValues = {
    wrestler_rank: displayedRank,
    weight: (row) => {
      const index = SimSite.weightOrderFor(levelFilter.value).indexOf(String(row.weight_class_code));
      return index < 0 ? 999 : index;
    },
    wrestler_name: (row) => row.wrestler_name || '',
    team_name: (row) => row.team_name || row.hometown_display || '',
    record: (row) => Number(row.win_pct || 0) * 100000 + Number(row.win_qty || 0) * 100 - Number(row.loss_qty || 0),
    win_pct: numeric('win_pct'), bonus_point_rate: numeric('bonus_point_rate'), match_qty: numeric('match_qty'),
    average_match_points: numeric('average_match_points'), average_point_differential: numeric('average_point_differential'),
    average_takedowns: numeric('average_takedowns'), takedown_success_rate: numeric('takedown_success_rate'),
    average_escapes: numeric('average_escapes'), average_reversals: numeric('average_reversals'),
    average_back_points: numeric('average_back_points'), average_riding_time_seconds: numeric('average_riding_time_seconds')
  };

  function option(value, label) {
    return `<option value="${e(value)}">${e(label)}</option>`;
  }

  function rebuildWeights(preferred = '') {
    weightFilter.innerHTML = SimSite.weightOptions(levelRows(), false, levelFilter.value);
    const values = [...weightFilter.options].map((item) => item.value);
    const fallback = collegeMode() ? '125' : '106';
    weightFilter.value = values.includes(preferred) ? preferred : (values.includes(fallback) ? fallback : values[0]);
  }

  function rebuildRegions(preferred = '') {
    const regions = SimSite.inventoryRegions(levelRows());
    regionFilter.innerHTML = option('ALL', 'All regions · National')
      + regions.map((region) => option(region.code, region.name)).join('');
    regionFilter.value = regions.some((region) => region.code === preferred) ? preferred : 'ALL';
    regionFilter.disabled = false;
  }

  function rebuildStates(preferred = '') {
    const source = collegeMode() && regionFilter.value !== 'ALL'
      ? levelRows().filter((row) => row.region_code === regionFilter.value)
      : levelRows();
    const states = SimSite.inventoryStates(source);
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

  function rankValue(row) {
    if (collegeMode() && weightFilter.value === 'PBP') {
      return Number(stateFilter.value === 'ALL' ? row.pound_for_pound_rank : row.state_pound_for_pound_rank);
    }
    return Number(stateFilter.value === 'ALL' ? row.weight_class_rank : row.state_weight_rank);
  }

  function geographicRows() {
    const college = collegeMode();
    const scoped = levelRows().filter((row) => {
      if (weightFilter.value !== 'PBP' && row.weight_class_code !== weightFilter.value) return false;
      if (college) {
        if (regionFilter.value !== 'ALL' && row.region_code !== regionFilter.value) return false;
        return stateFilter.value === 'ALL' || row.state_code === stateFilter.value;
      }
      if (row.state_code !== stateFilter.value) return false;
      if (countyFilter.value !== 'ALL' && row.county_guid !== countyFilter.value) return false;
      return localityFilter.value === 'ALL' || row.locality_guid === localityFilter.value;
    });
    const rankingOrder = [...scoped].sort((a, b) => rankValue(a) - rankValue(b)
      || String(a.wrestler_name).localeCompare(String(b.wrestler_name))
      || String(a.wrestler_guid).localeCompare(String(b.wrestler_guid)));
    scopeRanks = new Map(rankingOrder.map((row, index) => [row.wrestler_guid, index + 1]));
    return scoped;
  }

  function header(label, key) {
    const active = sort.key === key;
    return `<button class="sort-button${active ? ' active' : ''}" type="button" data-sort="${key}">${label}<span aria-hidden="true">${active ? (sort.direction === 'asc' ? '▲' : '▼') : ''}</span></button>`;
  }

  function visibleRows() {
    const phrase = String(search.value || '').trim().toLowerCase();
    return geographicRows().filter((row) => !phrase
      || `${row.wrestler_name} ${row.team_name || ''} ${row.hometown_display || ''}`.toLowerCase().includes(phrase))
      .sort((a, b) => {
        const getter = sortValues[sort.key] || sortValues.wrestler_rank;
        const av = getter(a), bv = getter(b);
        const difference = typeof av === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' });
        return (sort.direction === 'asc' ? 1 : -1)
          * (difference || displayedRank(a) - displayedRank(b));
      });
  }

  function identityCells(row) {
    const team = collegeMode()
      ? (row.team_name ? `<a class="table-link" href="${SimSite.teamUrl(row.team_guid)}">${e(row.team_name)}</a>` : '—')
      : e(row.hometown_display || row.state_code || '—');
    return `<td class="rank-number">${displayedRank(row)}</td><td><strong>${e(row.weight_class_code)}</strong></td><td><a class="wrestler-link" href="${SimSite.profileUrl(row.wrestler_guid)}">${e(row.wrestler_name)}</a></td><td>${team}</td>`;
  }

  function resultsTable(visible) {
    return `<div class="table-wrap statistics-table-wrap"><table class="statistics-table compact-results"><thead><tr>
      <th>${header('Rank','wrestler_rank')}</th><th>${header('Weight','weight')}</th><th>${header('Wrestler','wrestler_name')}</th><th>${header(collegeMode() ? 'College' : 'Hometown','team_name')}</th>
      <th>${header('Record','record')}</th><th>${header('Win %','win_pct')}</th><th>${header('Bonus %','bonus_point_rate')}</th>
    </tr></thead><tbody>${visible.map((row) => `<tr>${identityCells(row)}<td><strong>${e(row.record_display)}</strong></td><td>${SimSite.percent(row.win_pct,1)}</td><td><span class="bonus-pill">${e(row.bonus_point_percentage_display || '0.0%')}</span></td></tr>`).join('')}</tbody></table></div>`;
  }

  function performanceTable(visible) {
    return `<div class="table-wrap statistics-table-wrap"><table class="statistics-table compact-performance"><thead><tr>
      <th>${header('Rank','wrestler_rank')}</th><th>${header('Weight','weight')}</th><th>${header('Wrestler','wrestler_name')}</th><th>${header('Matches','match_qty')}</th>
      <th>${header('Avg. pts.','average_match_points')}</th><th>${header('Avg. margin','average_point_differential')}</th><th>${header('Avg. TD','average_takedowns')}</th><th>${header('TD %','takedown_success_rate')}</th>
      <th>${header('Avg. ESC','average_escapes')}</th><th>${header('Avg. REV','average_reversals')}</th><th>${header('Avg. back','average_back_points')}</th><th>${header('Avg. ride','average_riding_time_seconds')}</th>
    </tr></thead><tbody>${visible.map((row) => `<tr><td class="rank-number">${displayedRank(row)}</td><td><strong>${e(row.weight_class_code)}</strong></td><td><a class="wrestler-link" href="${SimSite.profileUrl(row.wrestler_guid)}">${e(row.wrestler_name)}</a></td><td>${row.match_qty}</td><td>${SimSite.number(row.average_match_points,1)}</td><td>${Number(row.average_point_differential || 0) > 0 ? '+' : ''}${SimSite.number(row.average_point_differential,1)}</td><td>${SimSite.number(row.average_takedowns,2)}</td><td>${SimSite.percent(row.takedown_success_rate,1)}</td><td>${SimSite.number(row.average_escapes,2)}</td><td>${SimSite.number(row.average_reversals,2)}</td><td>${SimSite.number(row.average_back_points,2)}</td><td>${e(row.average_riding_time_display || '0:00')}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function syncUrl() {
    SimSite.syncFilters({
      level: levelFilter.value,
      weight: weightFilter.value,
      region: collegeMode() ? regionFilter.value : '',
      state: stateFilter.value,
      county: collegeMode() ? '' : countyFilter.value,
      locality: collegeMode() ? '' : localityFilter.value,
      q: search.value.trim(),
      stats: view
    });
  }

  function render() {
    const visible = visibleRows();
    count.textContent = `${visible.length} wrestler${visible.length === 1 ? '' : 's'}`;
    title.textContent = view === 'results' ? 'Season Results' : 'Average Match Performance';
    tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.statisticsView === view));
    search.placeholder = collegeMode() ? 'Start typing a wrestler or college' : 'Start typing a wrestler or hometown';
    syncUrl();
    content.innerHTML = visible.length
      ? (view === 'results' ? resultsTable(visible) : performanceTable(visible))
      : '<div class="state-card"><p>No statistics match the selected filters.</p></div>';
    content.querySelectorAll('[data-sort]').forEach((button) => button.addEventListener('click', () => {
      const key = button.dataset.sort;
      if (sort.key === key) sort.direction = sort.direction === 'asc' ? 'desc' : 'asc';
      else {
        sort.key = key;
        sort.direction = ['wrestler_rank','weight','wrestler_name','team_name'].includes(key) ? 'asc' : 'desc';
      }
      render();
    }));
  }

  try {
    rows = await SimApi.mediaStatistics();
    levelFilter.value = SimSite.selectedLevel();
    view = SimSite.query('stats') === 'performance' ? 'performance' : 'results';
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
      sort = { key: 'wrestler_rank', direction: 'asc' };
      render();
    });
    weightFilter.addEventListener('change', () => { sort = { key: 'wrestler_rank', direction: 'asc' }; render(); });
    regionFilter.addEventListener('change', () => { rebuildStates(); render(); });
    stateFilter.addEventListener('change', () => {
      if (!collegeMode()) { rebuildCounties(); rebuildLocalities(); }
      render();
    });
    countyFilter.addEventListener('change', () => { rebuildLocalities(); render(); });
    localityFilter.addEventListener('change', render);
    search.addEventListener('input', render);
    tabs.forEach((tab) => tab.addEventListener('click', () => {
      view = tab.dataset.statisticsView;
      sort = { key: 'wrestler_rank', direction: 'asc' };
      render();
    }));
    render();
  } catch (error) {
    SimSite.showError(content, error.message);
    count.textContent = 'Unavailable';
  }
})();
