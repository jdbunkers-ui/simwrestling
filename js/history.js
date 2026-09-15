(async function () {
  const root = document.getElementById('history-root');
  if (!SimSite.configuredOrMessage(root)) return;
  const e = SimSite.escape;
  const weight = document.getElementById('history-weight');
  const region = document.getElementById('history-region');
  const state = document.getElementById('history-state');
  const search = document.getElementById('history-search');
  const title = document.getElementById('history-title');
  const scopeText = document.getElementById('history-scope');
  const count = document.getElementById('history-count');
  const latest = document.getElementById('history-latest-season');
  let geography = [];
  let individual = [];
  let dual = [];

  const option = (value,label) => `<option value="${e(value)}">${e(label)}</option>`;
  const regionRows = () => SimSite.inventoryRegions(geography);
  const selectedRegionName = () => regionRows().find((item) => item.code === region.value)?.name || region.value;
  const scope = () => state.value !== 'ALL'
    ? { level:'STATE',code:state.value,label:state.value }
    : region.value !== 'ALL'
      ? { level:'REGION',code:region.value,label:selectedRegionName() }
      : { level:'NATIONAL',code:'NATIONAL',label:'National' };

  function statesForRegion() {
    return [...new Set(geography.filter((row) => region.value === 'ALL' || row.region_code === region.value)
      .map((row) => String(row.state_code || '').trim()).filter(Boolean))].sort();
  }

  function rebuildStates(preferred = '') {
    const states = statesForRegion();
    state.innerHTML = option('ALL','All states') + states.map((code) => option(code,code)).join('');
    state.value = states.includes(preferred) ? preferred : 'ALL';
    state.disabled = false;
  }

  function syncUrl() {
    SimSite.syncFilters({level:'COLLEGE',weight:weight.value,region:region.value,state:state.value,q:search.value.trim()});
  }

  function personCell(row) {
    if (!row) return '<span class="history-empty">—</span>';
    return `<a class="wrestler-link history-wrestler" href="${SimSite.profileUrl(row.wrestler_guid)}">${e(row.wrestler_name)}</a>${row.team_guid ? `<a class="history-college" href="${SimSite.teamUrl(row.team_guid)}">${e(row.team_name)}</a>` : `<span class="history-college">${e(row.team_name || '—')}</span>`}`;
  }

  function renderIndividuals(rows) {
    const seasons = [...new Set(rows.map((row) => Number(row.game_season_number)))].sort((a,b) => b-a);
    if (!seasons.length) return '<div class="state-card"><strong>No completed placements match these filters.</strong><p>Try another weight, state, or region.</p></div>';
    return `<div class="table-wrap history-table-wrap"><table class="history-placement-table"><thead><tr><th>Season</th>${Array.from({length:8},(_,i) => `<th>${i+1}${i===0?'st':i===1?'nd':i===2?'rd':'th'}</th>`).join('')}</tr></thead><tbody>${seasons.map((season) => { const seasonRows=rows.filter((row)=>Number(row.game_season_number)===season); return `<tr><th>S${season}</th>${Array.from({length:8},(_,i)=>`<td>${personCell(seasonRows.find((row)=>Number(row.placement)===i+1))}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div>`;
  }

  function teamCell(row) {
    return row ? `<a class="wrestler-link" href="${SimSite.teamUrl(row.team_guid)}">${e(row.team_name)}</a>` : '—';
  }

  function renderTeams(rows) {
    const seasons = [...new Set(rows.map((row) => Number(row.game_season_number)))].sort((a,b) => b-a);
    if (!seasons.length) return '<div class="state-card"><strong>No completed dual championships match these filters.</strong><p>Try another state or region.</p></div>';
    return `<div class="table-wrap"><table class="history-team-table"><thead><tr><th>Season</th><th>Champion</th><th>Runner-up</th><th>Score</th><th>Third place</th></tr></thead><tbody>${seasons.map((season) => { const seasonRows=rows.filter((row)=>Number(row.game_season_number)===season); const champion=seasonRows.find((row)=>Number(row.placement)===1); const runner=seasonRows.find((row)=>Number(row.placement)===2); const third=seasonRows.find((row)=>Number(row.placement)===3); return `<tr><th>S${season}</th><td>${teamCell(champion)}</td><td>${teamCell(runner)}</td><td><strong>${e(champion?.score_display || '—')}</strong></td><td>${teamCell(third)}</td></tr>`; }).join('')}</tbody></table></div>`;
  }

  function render() {
    syncUrl();
    const selectedScope = scope();
    const phrase = search.value.trim().toLowerCase();
    const teamMode = weight.value === 'TEAM';
    const source = (teamMode ? dual : individual).filter((row) => row.championship_level === selectedScope.level && row.scope_code === selectedScope.code)
      .filter((row) => teamMode || row.weight_class_code === weight.value)
      .filter((row) => !phrase || `${row.wrestler_name || ''} ${row.team_name || ''} ${row.opponent_team_name || ''}`.toLowerCase().includes(phrase));
    title.textContent = teamMode ? 'Seasonal Dual Team Champions' : `${weight.value === 'HWT' ? 'HWT' : `${weight.value}-Pound`} Championship Placements`;
    scopeText.textContent = `${selectedScope.label} · ${teamMode ? 'Dual team' : 'Individual'} history`;
    count.textContent = `${new Set(source.map((row)=>row.game_season_number)).size} season${new Set(source.map((row)=>row.game_season_number)).size===1?'':'s'}`;
    root.innerHTML = teamMode ? renderTeams(source) : renderIndividuals(source);
  }

  try {
    [geography,individual,dual] = await Promise.all([
      SimApi.regionStateInventory(),SimApi.collegeIndividualHistory(),SimApi.collegeDualHistory()
    ]);
    const regions = regionRows();
    region.innerHTML = option('ALL','All regions · National') + regions.map((item)=>option(item.code,item.name)).join('');
    const requestedRegion = String(SimSite.query('region') || SimSite.defaultRegionCode(geography)).toUpperCase();
    region.value = regions.some((item)=>item.code===requestedRegion) ? requestedRegion : SimSite.defaultRegionCode(geography);
    rebuildStates(String(SimSite.query('state') || 'NJ').toUpperCase());
    weight.innerHTML = option('TEAM','Team Champions') + SimSite.collegeWeightOrder.map((code)=>option(code,code==='HWT'?'HWT':`${code} lb`)).join('');
    const requestedWeight = String(SimSite.query('weight') || '125').toUpperCase();
    weight.value = ['TEAM',...SimSite.collegeWeightOrder].includes(requestedWeight) ? requestedWeight : '125';
    search.value = SimSite.query('q') || '';
    const seasons = [...individual,...dual].map((row)=>Number(row.game_season_number)).filter(Boolean);
    latest.textContent = seasons.length ? `Season ${Math.max(...seasons)}` : 'No completed season yet';
    weight.disabled = false; region.disabled = false;
    weight.addEventListener('change',render);
    region.addEventListener('change',()=>{ rebuildStates('ALL'); render(); });
    state.addEventListener('change',render);
    search.addEventListener('input',render);
    render();
  } catch (error) {
    SimSite.showError(root,error.message); count.textContent='Unavailable';
  }
})();
