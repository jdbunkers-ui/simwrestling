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

  const e = SimSite.escape;
  const weights = {
    COLLEGE: ['125','133','141','149','157','165','174','184','197','HWT'],
    HIGH_SCHOOL: ['106','113','120','126','132','138','144','150','157','165','175','190','215','HWT']
  };
  const cache = new Map();
  let teams = null;
  let geography = null;
  let scopeInventory = [];
  let season = null;
  let renderSequence = 0;
  let searchTimer = null;
  const collegeMode = () => levelFilter.value === 'COLLEGE';
  const teamMode = () => collegeMode() && weightFilter.value === 'TEAM';
  const option = (value, label) => `<option value="${e(value)}">${e(label)}</option>`;
  const selectedLabel = (select) => select.options[select.selectedIndex]?.textContent || '';

  function rebuildWeights(preferred = '') {
    const level = levelFilter.value;
    const choices = level === 'COLLEGE'
      ? [option('TEAM','Team Rankings'), option('PBP','Pound-for-Pound'), ...weights[level].map((value) => option(value, value === 'HWT' ? 'HWT' : `${value} lb`))]
      : [option('PBP','Pound-for-Pound'), ...weights[level].map((value) => option(value, value === 'HWT' ? 'HWT' : `${value} lb`))];
    weightFilter.innerHTML = choices.join('');
    const values = [...weightFilter.options].map((item) => item.value);
    const fallback = level === 'COLLEGE' ? 'TEAM' : '106';
    weightFilter.value = values.includes(preferred) ? preferred : fallback;
  }

  function regions() {
    const map = new Map();
    scopeInventory.forEach((row) => {
      if (row.region_code) map.set(row.region_code, row.region_name || row.region_code);
    });
    return [...map].map(([code,name]) => ({ code,name })).sort((a,b) => a.name.localeCompare(b.name));
  }

  function states() {
    const source = scopeInventory;
    const values = source.filter((row) => !collegeMode() || regionFilter.value === 'ALL' || row.region_code === regionFilter.value)
      .map((row) => String(row.state_code || '').trim()).filter(Boolean);
    return [...new Set(values)].sort();
  }

  function rebuildRegions(preferred = '') {
    const values = regions();
    regionFilter.innerHTML = option('ALL','All regions · National') + values.map((row) => option(row.code,row.name)).join('');
    regionFilter.value = values.some((row) => row.code === preferred) ? preferred : 'ALL';
    regionFilter.disabled = false;
  }

  function rebuildStates(preferred = '') {
    const values = states();
    stateFilter.innerHTML = (collegeMode() ? option('ALL','All states') : '') + values.map((value) => option(value,value)).join('');
    stateFilter.value = values.includes(preferred) ? preferred : (collegeMode() ? 'ALL' : (values.includes('NJ') ? 'NJ' : values[0] || ''));
    stateFilter.disabled = !values.length;
  }

  function rebuildCounties(preferred = '') {
    const values = (geography || []).filter((row) => String(row.state_code || '').trim() === stateFilter.value && row.county_guid)
      .map((row) => ({ guid:row.county_guid,name:row.county_name || 'Unnamed county' }));
    const unique = [...new Map(values.map((row) => [row.guid,row])).values()].sort((a,b) => a.name.localeCompare(b.name));
    countyFilter.innerHTML = option('ALL','All counties') + unique.map((row) => option(row.guid,row.name)).join('');
    countyFilter.value = unique.some((row) => row.guid === preferred) ? preferred : 'ALL';
    countyFilter.disabled = weightFilter.value === 'PBP' || !unique.length;
  }

  function rebuildLocalities(preferred = '') {
    const values = countyFilter.value === 'ALL' ? [] : (geography || []).filter((row) => String(row.state_code || '').trim() === stateFilter.value && row.county_guid === countyFilter.value && row.locality_guid)
      .map((row) => ({ guid:row.locality_guid,name:row.locality_name || 'Unnamed locality' }));
    const unique = [...new Map(values.map((row) => [row.guid,row])).values()].sort((a,b) => a.name.localeCompare(b.name));
    localityFilter.innerHTML = option('ALL','All towns and cities') + unique.map((row) => option(row.guid,row.name)).join('');
    localityFilter.value = unique.some((row) => row.guid === preferred) ? preferred : 'ALL';
    localityFilter.disabled = weightFilter.value === 'PBP' || countyFilter.value === 'ALL' || !unique.length;
  }

  function configureGeography(preferred = {}) {
    regionControl.hidden = !collegeMode();
    countyControl.hidden = collegeMode() || weightFilter.value === 'PBP';
    localityControl.hidden = collegeMode() || weightFilter.value === 'PBP';
    if (collegeMode()) {
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

  function regionName(code) { return regions().find((row) => row.code === code)?.name || code; }
  function scopeLabel() {
    if (collegeMode()) {
      if (stateFilter.value !== 'ALL') return stateFilter.value;
      if (regionFilter.value !== 'ALL') return regionName(regionFilter.value);
      return 'National';
    }
    if (weightFilter.value !== 'PBP' && localityFilter.value !== 'ALL') return selectedLabel(localityFilter);
    if (weightFilter.value !== 'PBP' && countyFilter.value !== 'ALL') return selectedLabel(countyFilter);
    return stateFilter.value;
  }

  function filters() {
    return {
      level:levelFilter.value,
      weight:weightFilter.value,
      region:collegeMode() && regionFilter.value !== 'ALL' ? regionFilter.value : null,
      state:stateFilter.value !== 'ALL' ? stateFilter.value : null,
      county:!collegeMode() && weightFilter.value !== 'PBP' && countyFilter.value !== 'ALL' ? countyFilter.value : null,
      locality:!collegeMode() && weightFilter.value !== 'PBP' && localityFilter.value !== 'ALL' ? localityFilter.value : null,
      search:search.value.trim() || null,
      limit:25
    };
  }

  function syncUrl() {
    SimSite.syncFilters({ level:levelFilter.value,weight:weightFilter.value,region:collegeMode()?regionFilter.value:'',state:stateFilter.value,county:!collegeMode()&&weightFilter.value!=='PBP'?countyFilter.value:'',locality:!collegeMode()&&weightFilter.value!=='PBP'?localityFilter.value:'',q:search.value.trim() });
  }

  function teamComparator(a,b) {
    return (Number(a.dual_qty||0)>0?0:1)-(Number(b.dual_qty||0)>0?0:1)
      || Number(b.dual_win_rate||0)-Number(a.dual_win_rate||0)
      || Number(b.dual_win_qty||0)-Number(a.dual_win_qty||0)
      || Number(b.tied_opponent_win_qty||0)-Number(a.tied_opponent_win_qty||0)
      || Number(b.average_dual_margin||0)-Number(a.average_dual_margin||0)
      || String(a.team_name).localeCompare(String(b.team_name));
  }

  function renderTeams() {
    const phrase = search.value.trim().toLocaleLowerCase();
    const filtered = (teams || []).filter((row) => (regionFilter.value === 'ALL' || row.region_code === regionFilter.value)
      && (stateFilter.value === 'ALL' || String(row.state_code).trim() === stateFilter.value)
      && (!phrase || `${row.team_name} ${row.hometown_city || ''}`.toLocaleLowerCase().includes(phrase)))
      .sort(teamComparator).map((row,index) => ({ ...row,display_rank:index+1 }));
    const rows = filtered.slice(0,25);
    count.textContent = `Top ${rows.length} of ${filtered.length} team${filtered.length===1?'':'s'}`;
    title.textContent = `${scopeLabel()} Team Rankings`;
    pageTitle.textContent = 'Team Rankings';
    pageCopy.textContent = 'Active college programs ranked by dual record and starting-lineup performance.';
    if (!rows.length) { content.innerHTML = '<div class="state-card"><p>No teams match the selected filters.</p></div>'; return; }
    content.innerHTML = `<div class="table-wrap"><table class="team-ranking-table"><thead><tr><th>Rank</th><th>Team</th><th>City</th><th>Record</th><th>Win %</th><th>Avg. margin</th></tr></thead><tbody>${rows.map((row) => `<tr><td class="rank-number">${row.display_rank}</td><td><a class="wrestler-link" href="${SimSite.teamUrl(row.team_guid)}">${e(row.team_name)}</a></td><td>${e(row.hometown_city||'—')}, ${e(String(row.state_code||'').trim())}</td><td><strong>${e(row.dual_record_display||'0-0')}</strong></td><td>${SimSite.percent(row.dual_win_rate,1)}</td><td>${Number(row.average_dual_margin||0)>0?'+':''}${SimSite.number(row.average_dual_margin,1)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  async function renderWrestlers() {
    const sequence = ++renderSequence;
    const currentFilters = filters();
    const key = JSON.stringify(currentFilters);
    syncUrl();
    content.classList.add('is-loading');
    try {
      let payload = cache.get(key);
      if (!payload) {
        payload = await SimApi.rankingsFiltered(currentFilters);
        cache.set(key,payload);
      }
      if (sequence !== renderSequence) return;
      const rows = Array.isArray(payload?.rows) ? payload.rows : [];
      const total = Number(payload?.total_count || 0);
      count.textContent = `Top ${rows.length} of ${total} wrestler${total===1?'':'s'}`;
      const division = weightFilter.value === 'PBP' ? 'Pound-for-Pound' : `${weightFilter.value}-Pound`;
      title.textContent = `${scopeLabel()} ${SimSite.levelLabel(levelFilter.value)} ${division} Rankings`;
      pageTitle.textContent = `${SimSite.levelLabel(levelFilter.value)} Wrestler Rankings`;
      pageCopy.textContent = collegeMode() ? 'Current college wrestlers ranked nationally, regionally or by state.' : 'Current high-school wrestlers ranked within a state, county or hometown.';
      search.placeholder = collegeMode() ? 'Start typing a wrestler or college' : 'Start typing a wrestler or hometown';
      if (!rows.length) { content.innerHTML = '<div class="state-card"><p>No wrestlers match the selected filters.</p></div>'; return; }
      const college = collegeMode();
      content.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Rank</th><th>Weight</th><th>Wrestler</th><th>${college?'College team':'Hometown'}</th>${college?'':'<th>Year</th>'}<th>Wins</th><th>Losses</th><th>Bonus %</th></tr></thead><tbody>${rows.map((row) => `<tr><td class="rank-number">${row.display_rank}</td><td><strong>${e(row.weight_class_code)}</strong></td><td><a class="wrestler-link" href="${SimSite.profileUrl(row.wrestler_guid)}">${e(row.wrestler_name)}</a>${row.roster_status==='BACKUP'?'<span class="subtext">Backup</span>':''}</td><td>${college?(row.team_name?`<a class="table-link" href="${SimSite.teamUrl(row.team_guid)}">${e(row.team_name)}</a>`:'—'):e(row.hometown_display||row.state_code)}</td>${college?'':`<td>${e(row.eligibility_year_display)}</td>`}<td>${row.win_qty}</td><td>${row.loss_qty}</td><td><span class="bonus-pill">${e(row.bonus_point_percentage_display||'0.0%')}</span></td></tr>`).join('')}</tbody></table></div>`;
    } catch (error) {
      if (sequence === renderSequence) SimSite.showError(content,error.message);
    } finally {
      if (sequence === renderSequence) content.classList.remove('is-loading');
    }
  }

  function render() {
    syncUrl();
    if (teamMode()) renderTeams(); else renderWrestlers();
  }

  async function ensureModeData() {
    if (!collegeMode() && !geography) geography = await SimApi.geographyInventory();
    if (teamMode() && !teams) teams = await SimApi.teamRankings();
  }

  async function changeMode(preferred = {}) {
    content.classList.add('is-loading');
    try {
      await ensureModeData();
      configureGeography(preferred);
      render();
    } catch (error) {
      SimSite.showError(content,error.message);
    } finally {
      content.classList.remove('is-loading');
    }
  }

  try {
    [scopeInventory,season] = await Promise.all([SimApi.regionStateInventory(),SimApi.season()]);
    season = season?.[0] || null;
    if (seasonBadge && season) seasonBadge.textContent = season.season_name;
    levelFilter.value = SimSite.selectedLevel();
    rebuildWeights(String(SimSite.query('weight')||'').toUpperCase());
    await ensureModeData();
    configureGeography({ region:String(SimSite.query('region')||SimSite.defaultRegionCode(scopeInventory)).toUpperCase(),state:String(SimSite.query('state')||'NJ').toUpperCase(),county:SimSite.query('county')||'',locality:SimSite.query('locality')||'' });
    search.value = SimSite.query('q') || '';
    levelFilter.disabled = false;
    weightFilter.disabled = false;

    levelFilter.addEventListener('change', async () => { rebuildWeights(); await changeMode({ state:levelFilter.value==='HIGH_SCHOOL'?'NJ':'' }); });
    weightFilter.addEventListener('change', async () => { await ensureModeData(); if (!collegeMode()) configureGeography({ state:stateFilter.value }); render(); });
    regionFilter.addEventListener('change', () => { rebuildStates(); render(); });
    stateFilter.addEventListener('change', () => { if (!collegeMode()) { rebuildCounties(); rebuildLocalities(); } render(); });
    countyFilter.addEventListener('change', () => { rebuildLocalities(); render(); });
    localityFilter.addEventListener('change',render);
    search.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer=setTimeout(render,250); });
    render();
  } catch (error) {
    SimSite.showError(content,error.message);
    count.textContent = 'Unavailable';
  }
})();
