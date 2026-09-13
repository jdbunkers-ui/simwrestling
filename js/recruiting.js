(async function () {
  const board = document.getElementById('prospect-board');
  const title = document.getElementById('prospect-title');
  const count = document.getElementById('recruiting-count');
  const seasonLabel = document.getElementById('recruiting-season');
  const scopeFilter = document.getElementById('recruiting-scope');
  const regionFilter = document.getElementById('recruiting-region');
  const stateFilter = document.getElementById('recruiting-state');
  const weightFilter = document.getElementById('recruiting-weight');
  const regionControl = document.getElementById('recruiting-region-control');
  const stateControl = document.getElementById('recruiting-state-control');
  const e = SimSite.escape;

  if (!window.SimSite.configuredOrMessage(board)) return;

  let prospects = [];

  function option(value, label) {
    return `<option value="${e(value)}">${e(label)}</option>`;
  }

  function regionName(code) {
    return prospects.find((row) => row.region_code === code)?.region_name || code;
  }

  function rebuildFilters() {
    const regions = SimSite.inventoryRegions(prospects);
    const states = SimSite.inventoryStates(prospects);
    const availableWeights = new Set(prospects.map((row) => String(row.weight_class_code)));

    regionFilter.innerHTML = regions.map((region) => option(region.code, region.name)).join('');
    stateFilter.innerHTML = states.map((state) => option(state, state)).join('');
    if (states.includes('NJ')) stateFilter.value = 'NJ';

    weightFilter.innerHTML = option('ALL', 'All weights')
      + SimSite.highSchoolWeightOrder
        .filter((weight) => availableWeights.has(weight))
        .map((weight) => option(weight, weight === 'HWT' ? 'HWT' : `${weight} lb`))
        .join('');

    const requestedScope = String(SimSite.query('scope') || 'NATIONAL').toUpperCase();
    scopeFilter.value = ['NATIONAL','REGION','STATE'].includes(requestedScope)
      ? requestedScope : 'NATIONAL';

    const requestedRegion = String(SimSite.query('region') || '');
    if (regions.some((region) => region.code === requestedRegion)) {
      regionFilter.value = requestedRegion;
    }

    const requestedState = String(SimSite.query('state') || '');
    if (states.includes(requestedState)) stateFilter.value = requestedState;

    const requestedWeight = String(SimSite.query('weight') || 'ALL').toUpperCase();
    weightFilter.value = requestedWeight === 'ALL' || availableWeights.has(requestedWeight)
      ? requestedWeight : 'ALL';
  }

  function scopeName() {
    if (scopeFilter.value === 'REGION') return regionName(regionFilter.value);
    if (scopeFilter.value === 'STATE') return stateFilter.value;
    return 'National';
  }

  function scopedRows() {
    return prospects.filter((row) => {
      if (scopeFilter.value === 'REGION' && row.region_code !== regionFilter.value) return false;
      if (scopeFilter.value === 'STATE' && row.state_code !== stateFilter.value) return false;
      return weightFilter.value === 'ALL' || row.weight_class_code === weightFilter.value;
    }).sort((a, b) => Number(b.total_recruiting_points) - Number(a.total_recruiting_points)
      || Number(b.recruiting_program_qty) - Number(a.recruiting_program_qty)
      || String(a.wrestler_name).localeCompare(String(b.wrestler_name))
      || String(a.wrestler_guid).localeCompare(String(b.wrestler_guid)));
  }

  function preferredSchools(row) {
    const schools = Array.isArray(row.preferred_schools) ? row.preferred_schools : [];
    if (!schools.length) return '<p class="no-preferences">No preferred schools established</p>';
    return `<ol>${schools.map((school) => `<li><a href="${SimSite.teamUrl(school.team_guid)}">${e(school.team_name)}</a></li>`).join('')}</ol>`;
  }

  function render() {
    const scope = scopeFilter.value;
    regionControl.hidden = scope !== 'REGION';
    stateControl.hidden = scope !== 'STATE';
    const rows = scopedRows();
    const visible = rows.slice(0, 25);
    const geography = scopeName();
    const weight = weightFilter.value === 'ALL' ? ''
      : ` ${weightFilter.value === 'HWT' ? 'HWT' : `${weightFilter.value}-Pound`}`;

    title.textContent = `${geography}${weight} Most-Recruited High-School Wrestlers`;
    count.textContent = `Top ${visible.length} of ${rows.length} senior${rows.length === 1 ? '' : 's'}`;

    SimSite.syncFilters({
      scope,
      region: scope === 'REGION' ? regionFilter.value : '',
      state: scope === 'STATE' ? stateFilter.value : '',
      weight: weightFilter.value
    });

    if (!visible.length) {
      board.innerHTML = '<div class="state-card"><p>No seniors match the selected recruiting filters.</p></div>';
      return;
    }

    const maximumPoints = Math.max(...visible.map((row) => Number(row.total_recruiting_points || 0)), 1);
    board.innerHTML = visible.map((row, index) => {
      const points = Number(row.total_recruiting_points || 0);
      const interest = Math.max(4, Math.round(points / maximumPoints * 100));
      return `<article class="prospect-row">
        <span class="prospect-rank">${index + 1}</span>
        <div class="prospect-identity">
          <a href="${SimSite.profileUrl(row.wrestler_guid)}">${e(row.wrestler_name)}</a>
          <small>${e(row.hometown_city || 'Unknown')}, ${e(row.state_code || '')} · ${e(row.weight_class_code)}${row.weight_class_code === 'HWT' ? '' : ' lb'} · Senior</small>
        </div>
        <div class="school-preferences"><span>Preferred schools</span>${preferredSchools(row)}</div>
        <div class="interest-meter">
          <span>${points} recruiting point${points === 1 ? '' : 's'}</span>
          <i style="--interest:${interest}%"></i>
          <small>${Number(row.recruiting_program_qty || 0)} program${Number(row.recruiting_program_qty || 0) === 1 ? '' : 's'} have recruited him</small>
        </div>
      </article>`;
    }).join('');
  }

  [scopeFilter,regionFilter,stateFilter,weightFilter].forEach((control) => {
    control.addEventListener('change', render);
  });

  try {
    prospects = await SimApi.recruitingSeniors();
    rebuildFilters();
    const season = prospects[0];
    seasonLabel.textContent = season?.game_season_number
      ? `Season ${season.game_season_number} recruiting center`
      : 'Current season recruiting center';
    render();
  } catch (error) {
    SimSite.showError(board, error.message);
    count.textContent = 'Recruiting data unavailable';
  }
})();
