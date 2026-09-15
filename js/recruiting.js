(async function () {
  const prospectBoard = document.getElementById('prospect-board');
  const prospectTitle = document.getElementById('prospect-title');
  const prospectCount = document.getElementById('recruiting-count');
  const seasonLabel = document.getElementById('recruiting-season');
  const regionFilter = document.getElementById('recruiting-region');
  const stateFilter = document.getElementById('recruiting-state');
  const weightFilter = document.getElementById('recruiting-weight');
  const classBoard = document.getElementById('class-board');
  const classTitle = document.getElementById('class-title');
  const classCount = document.getElementById('class-count');
  const classRegion = document.getElementById('class-region');
  const classState = document.getElementById('class-state');
  const prospectsTab = document.getElementById('prospects-tab');
  const classesTab = document.getElementById('classes-tab');
  const prospectsPanel = document.getElementById('prospects-panel');
  const classesPanel = document.getElementById('classes-panel');
  const e = SimSite.escape;

  if (!window.SimSite.configuredOrMessage(prospectBoard)) return;

  let prospects = [];
  let recruitingClasses = [];
  let activeTab = String(SimSite.query('recruiting_tab') || 'prospects') === 'classes'
    ? 'classes' : 'prospects';

  function option(value, label) {
    return `<option value="${e(value)}">${e(label)}</option>`;
  }

  function regionCatalog() {
    const regions = new Map();
    [...prospects, ...recruitingClasses].forEach((row) => {
      const code = String(row.region_code || '').trim();
      if (!code) return;
      const supplied = String(row.region_name || '').trim();
      const fallback = code === 'MID_ATLANTIC'
        ? 'Mid-Atlantic Region'
        : code.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
      regions.set(code, supplied || fallback);
    });
    return [...regions].map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function regionName(code) {
    return regionCatalog().find((row) => row.code === code)?.name || code;
  }

  function sourceStates(regionCode) {
    return [...new Set([...prospects, ...recruitingClasses]
      .filter((row) => regionCode === 'ALL' || row.region_code === regionCode)
      .map((row) => String(row.state_code || '').toUpperCase())
      .filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
  }

  function rebuildStateFilter(control, regionCode, preferredState) {
    const states = sourceStates(regionCode);
    control.innerHTML = option('ALL', 'All states')
      + states.map((state) => option(state, state)).join('');
    control.value = states.includes(preferredState) ? preferredState : 'ALL';
  }

  function rebuildFilters() {
    const regions = regionCatalog();
    const regionOptions = option('ALL', 'All regions · National')
      + regions.map((region) => option(region.code, region.name)).join('');
    regionFilter.innerHTML = regionOptions;
    classRegion.innerHTML = regionOptions;

    const requestedRegion = String(
      SimSite.query('region') ||
      SimSite.defaultRegionCode([...prospects, ...recruitingClasses]) ||
      'MID_ATLANTIC'
    );
    const selectedRegion = regions.some((region) => region.code === requestedRegion)
      ? requestedRegion : 'ALL';
    regionFilter.value = selectedRegion;
    classRegion.value = selectedRegion;

    const requestedState = String(SimSite.query('state') || 'NJ').toUpperCase();
    rebuildStateFilter(stateFilter, selectedRegion, requestedState);
    rebuildStateFilter(classState, selectedRegion, requestedState);

    const availableWeights = new Set(
      prospects.map((row) => String(row.weight_class_code))
    );
    weightFilter.innerHTML = option('ALL', 'All weights')
      + SimSite.highSchoolWeightOrder
        .filter((weight) => availableWeights.has(weight))
        .map((weight) => option(
          weight, weight === 'HWT' ? 'HWT' : `${weight} lb`
        )).join('');

    const requestedWeight = String(
      SimSite.query('recruiting_weight') || 'ALL'
    ).toUpperCase();
    weightFilter.value = requestedWeight === 'ALL' || availableWeights.has(requestedWeight)
      ? requestedWeight : 'ALL';
  }

  function scopeName(region, state) {
    if (state !== 'ALL') return state;
    if (region !== 'ALL') return regionName(region);
    return 'National';
  }

  function syncGeography(sourceRegion, sourceState) {
    const region = sourceRegion.value;
    const state = sourceState.value;
    regionFilter.value = region;
    classRegion.value = region;
    rebuildStateFilter(stateFilter, region, state);
    rebuildStateFilter(classState, region, state);
    SimSite.syncFilters({ region, state: stateFilter.value });
  }

  function scopedProspects() {
    return prospects.filter((row) => {
      if (regionFilter.value !== 'ALL' && row.region_code !== regionFilter.value) return false;
      if (stateFilter.value !== 'ALL' && row.state_code !== stateFilter.value) return false;
      return weightFilter.value === 'ALL' || row.weight_class_code === weightFilter.value;
    }).sort((a, b) => Number(b.total_recruiting_points) - Number(a.total_recruiting_points)
      || Number(b.recruiting_program_qty) - Number(a.recruiting_program_qty)
      || String(a.wrestler_name).localeCompare(String(b.wrestler_name))
      || String(a.wrestler_guid).localeCompare(String(b.wrestler_guid)));
  }

  function preferredSchools(row) {
    const schools = Array.isArray(row.preferred_schools) ? row.preferred_schools : [];
    if (!schools.length) {
      return '<p class="no-preferences">No preferred schools established</p>';
    }
    return `<ol>${schools.map((school) => `<li><a href="${SimSite.teamUrl(school.team_guid)}">${e(school.team_name)}</a></li>`).join('')}</ol>`;
  }

  function renderProspects() {
    const rows = scopedProspects();
    const visible = rows.slice(0, 25);
    const geography = scopeName(regionFilter.value, stateFilter.value);
    const weight = weightFilter.value === 'ALL' ? ''
      : ` ${weightFilter.value === 'HWT' ? 'HWT' : `${weightFilter.value}-Pound`}`;

    prospectTitle.textContent = `${geography}${weight} Most-Recruited High-School Wrestlers`;
    prospectCount.textContent = `Top ${visible.length} of ${rows.length} senior${rows.length === 1 ? '' : 's'}`;
    SimSite.syncFilters({
      region: regionFilter.value,
      state: stateFilter.value,
      recruiting_weight: weightFilter.value,
      recruiting_tab: activeTab
    });

    if (!visible.length) {
      prospectBoard.innerHTML = '<div class="state-card"><p>No seniors match the selected recruiting filters.</p></div>';
      return;
    }

    const maximumPoints = Math.max(
      ...visible.map((row) => Number(row.total_recruiting_points || 0)),1
    );
    prospectBoard.innerHTML = visible.map((row, index) => {
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

  function parsedRecruits(row) {
    if (Array.isArray(row.top_five_recruits)) return row.top_five_recruits;
    try {
      const parsed = JSON.parse(row.top_five_recruits || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function renderClasses() {
    const latestSeason = Math.max(
      0,...recruitingClasses.map((row) => Number(row.game_season_number || 0))
    );
    const scope = classState.value !== 'ALL' ? 'state'
      : classRegion.value !== 'ALL' ? 'regional' : 'national';
    const rankField = `${scope}_class_rank`;
    const geography = scopeName(classRegion.value, classState.value);
    const rows = recruitingClasses.filter((row) => {
      if (Number(row.game_season_number) !== latestSeason) return false;
      if (classRegion.value !== 'ALL' && row.region_code !== classRegion.value) return false;
      return classState.value === 'ALL' || row.state_code === classState.value;
    }).sort((a, b) => Number(a[rankField]) - Number(b[rankField])
      || String(a.team_name).localeCompare(String(b.team_name)));

    classTitle.textContent = `${geography} Recruiting Classes`;
    classCount.textContent = latestSeason
      ? `Season ${latestSeason} incoming classes · ${rows.length} college program${rows.length === 1 ? '' : 's'}`
      : 'Class rankings will publish automatically when the season rolls over.';

    SimSite.syncFilters({
      region: classRegion.value,
      state: classState.value,
      recruiting_weight: weightFilter.value,
      recruiting_tab: activeTab
    });

    if (!rows.length) {
      classBoard.innerHTML = '<div class="state-card"><p>No completed recruiting class matches this geography yet.</p></div>';
      return;
    }

    classBoard.innerHTML = rows.map((row) => {
      const recruits = parsedRecruits(row);
      const recruitLinks = recruits.length
        ? recruits.map((recruit) => `<a href="${SimSite.profileUrl(recruit.wrestler_guid)}">${e(recruit.wrestler_name)} <small>#${Number(recruit.final_national_recruiting_rank)} national</small></a>`).join('')
        : '<small>No ranked signees</small>';
      return `<article class="class-row">
        <span class="class-rank">${Number(row[rankField])}</span>
        <div class="class-team">
          <a href="${SimSite.teamUrl(row.team_guid)}">${e(row.team_name)}</a>
          <small>${e(row.state_code || '')} · ${Number(row.signed_recruit_qty || 0)} signees</small>
        </div>
        <div class="class-score"><span>Class score</span><strong>${Number(row.class_score || 0).toFixed(1)}</strong></div>
        <div class="signee-list"><span>Top five recruits · final national rank</span>${recruitLinks}</div>
      </article>`;
    }).join('');
  }

  function activateTab(name) {
    activeTab = name === 'classes' ? 'classes' : 'prospects';
    const showClasses = activeTab === 'classes';
    prospectsTab.classList.toggle('active', !showClasses);
    prospectsTab.setAttribute('aria-selected', String(!showClasses));
    classesTab.classList.toggle('active', showClasses);
    classesTab.setAttribute('aria-selected', String(showClasses));
    prospectsPanel.hidden = showClasses;
    classesPanel.hidden = !showClasses;
    if (showClasses) renderClasses(); else renderProspects();
  }

  regionFilter.addEventListener('change', () => {
    rebuildStateFilter(stateFilter, regionFilter.value, stateFilter.value);
    syncGeography(regionFilter, stateFilter);
    renderProspects();
  });
  stateFilter.addEventListener('change', () => {
    syncGeography(regionFilter, stateFilter);
    renderProspects();
  });
  weightFilter.addEventListener('change', renderProspects);
  classRegion.addEventListener('change', () => {
    rebuildStateFilter(classState, classRegion.value, classState.value);
    syncGeography(classRegion, classState);
    renderClasses();
  });
  classState.addEventListener('change', () => {
    syncGeography(classRegion, classState);
    renderClasses();
  });
  prospectsTab.addEventListener('click', () => activateTab('prospects'));
  classesTab.addEventListener('click', () => activateTab('classes'));

  try {
    const [prospectResult, classResult] = await Promise.allSettled([
      SimApi.recruitingSeniors(),SimApi.recruitingClasses()
    ]);
    if (prospectResult.status === 'fulfilled') prospects = prospectResult.value;
    if (classResult.status === 'fulfilled') recruitingClasses = classResult.value;
    if (prospectResult.status === 'rejected' && classResult.status === 'rejected') {
      throw prospectResult.reason;
    }

    rebuildFilters();
    const season = prospects[0] || recruitingClasses[0];
    seasonLabel.textContent = season?.game_season_number
      ? `Season ${season.game_season_number} recruiting center`
      : 'Current season recruiting center';
    activateTab(activeTab);
  } catch (error) {
    SimSite.showError(prospectBoard, error.message);
    prospectCount.textContent = 'Recruiting data unavailable';
    classCount.textContent = 'Recruiting class data unavailable';
  }
})();
