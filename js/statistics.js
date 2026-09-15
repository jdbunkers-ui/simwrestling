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

  const weights = {
    COLLEGE:['125','133','141','149','157','165','174','184','197','HWT'],
    HIGH_SCHOOL:['106','113','120','126','132','138','144','150','157','165','175','190','215','HWT']
  };
  const e = SimSite.escape;
  const numeric = (key) => (row) => Number(row[key] || 0);
  const option = (value,label) => `<option value="${e(value)}">${e(label)}</option>`;
  const collegeMode = () => levelFilter.value === 'COLLEGE';
  let rows = [];
  let regionInventory = [];
  let highSchoolGeography = null;
  let view = 'results';
  let sort = { key:'wrestler_rank',direction:'asc' };
  let scopeRanks = new Map();
  let loadSequence = 0;

  function displayedRank(row) { return scopeRanks.get(row.wrestler_guid) || 0; }
  const sortValues = {
    wrestler_rank:displayedRank,
    weight:(row) => SimSite.weightOrderFor(levelFilter.value).indexOf(String(row.weight_class_code)),
    wrestler_name:(row) => row.wrestler_name || '',
    team_name:(row) => row.team_name || row.hometown_display || '',
    record:(row) => Number(row.win_pct || 0)*100000 + Number(row.win_qty || 0)*100 - Number(row.loss_qty || 0),
    win_pct:numeric('win_pct'),bonus_point_rate:numeric('bonus_point_rate'),match_qty:numeric('match_qty'),
    average_match_points:numeric('average_match_points'),average_point_differential:numeric('average_point_differential'),
    average_takedowns:numeric('average_takedowns'),takedown_success_rate:numeric('takedown_success_rate'),
    average_escapes:numeric('average_escapes'),average_reversals:numeric('average_reversals'),
    average_back_points:numeric('average_back_points'),average_riding_time_seconds:numeric('average_riding_time_seconds')
  };

  function rebuildWeights(preferred='') {
    const values = weights[levelFilter.value] || weights.COLLEGE;
    weightFilter.innerHTML = values.map((code) => option(code,code==='HWT'?'HWT':`${code} lb`)).join('');
    const fallback = collegeMode() ? '125' : '106';
    weightFilter.value = values.includes(preferred) ? preferred : fallback;
  }

  function rebuildRegions(preferred='') {
    const values = SimSite.inventoryRegions(regionInventory);
    regionFilter.innerHTML = option('ALL','All regions · National') + values.map((row)=>option(row.code,row.name)).join('');
    regionFilter.value = values.some((row)=>row.code===preferred) ? preferred : 'ALL';
    regionFilter.disabled = false;
  }

  function rebuildStates(preferred='') {
    const source = collegeMode()
      ? regionInventory.filter((row)=>regionFilter.value==='ALL'||row.region_code===regionFilter.value)
      : (highSchoolGeography || []);
    const values = SimSite.inventoryStates(source);
    stateFilter.innerHTML = (collegeMode()?option('ALL','All states'):'') + values.map((code)=>option(code,code)).join('');
    stateFilter.value = values.includes(preferred) ? preferred : (collegeMode()?'ALL':(values.includes('NJ')?'NJ':values[0]||''));
    stateFilter.disabled = !values.length;
  }

  function rebuildCounties(preferred='') {
    const values = (highSchoolGeography || []).filter((row)=>String(row.state_code||'').trim()===stateFilter.value&&row.county_guid)
      .map((row)=>({guid:row.county_guid,name:row.county_name||'Unnamed county'}));
    const unique = [...new Map(values.map((row)=>[row.guid,row])).values()].sort((a,b)=>a.name.localeCompare(b.name));
    countyFilter.innerHTML = option('ALL','All counties') + unique.map((row)=>option(row.guid,row.name)).join('');
    countyFilter.value = unique.some((row)=>row.guid===preferred) ? preferred : 'ALL';
    countyFilter.disabled = !unique.length;
  }

  function rebuildLocalities(preferred='') {
    const values = countyFilter.value==='ALL' ? [] : (highSchoolGeography || [])
      .filter((row)=>String(row.state_code||'').trim()===stateFilter.value&&row.county_guid===countyFilter.value&&row.locality_guid)
      .map((row)=>({guid:row.locality_guid,name:row.locality_name||'Unnamed locality'}));
    const unique = [...new Map(values.map((row)=>[row.guid,row])).values()].sort((a,b)=>a.name.localeCompare(b.name));
    localityFilter.innerHTML = option('ALL','All towns and cities') + unique.map((row)=>option(row.guid,row.name)).join('');
    localityFilter.value = unique.some((row)=>row.guid===preferred) ? preferred : 'ALL';
    localityFilter.disabled = countyFilter.value==='ALL'||!unique.length;
  }

  async function configureGeography(preferred={}) {
    regionControl.hidden = !collegeMode();
    countyControl.hidden = collegeMode();
    localityControl.hidden = collegeMode();
    if (collegeMode()) {
      rebuildRegions(preferred.region || '');
      rebuildStates(preferred.state || '');
      countyFilter.value='ALL'; localityFilter.value='ALL';
    } else {
      if (!highSchoolGeography) highSchoolGeography = await SimApi.geographyInventory();
      regionFilter.value='ALL';
      rebuildStates(preferred.state || '');
      rebuildCounties(preferred.county || '');
      rebuildLocalities(preferred.locality || '');
    }
  }

  function rankValue(row) {
    return Number(stateFilter.value==='ALL' ? row.weight_class_rank : row.state_weight_rank) || 2147483647;
  }

  function setScopeRanks() {
    const ordered = [...rows].sort((a,b)=>rankValue(a)-rankValue(b)
      || String(a.wrestler_name).localeCompare(String(b.wrestler_name))
      || String(a.wrestler_guid).localeCompare(String(b.wrestler_guid)));
    scopeRanks = new Map(ordered.map((row,index)=>[row.wrestler_guid,index+1]));
  }

  function header(label,key) {
    const active=sort.key===key;
    return `<button class="sort-button${active?' active':''}" type="button" data-sort="${key}">${label}<span aria-hidden="true">${active?(sort.direction==='asc'?'▲':'▼'):''}</span></button>`;
  }

  function visibleRows() {
    const phrase=String(search.value||'').trim().toLowerCase();
    return rows.filter((row)=>!phrase||`${row.wrestler_name} ${row.team_name||''} ${row.hometown_display||''}`.toLowerCase().includes(phrase))
      .sort((a,b)=>{
        const getter=sortValues[sort.key]||sortValues.wrestler_rank;
        const av=getter(a),bv=getter(b);
        const difference=typeof av==='number'?av-bv:String(av).localeCompare(String(bv),undefined,{sensitivity:'base'});
        return (sort.direction==='asc'?1:-1)*(difference||displayedRank(a)-displayedRank(b));
      });
  }

  function identityCells(row) {
    const team=collegeMode()?(row.team_name?`<a class="table-link" href="${SimSite.teamUrl(row.team_guid)}">${e(row.team_name)}</a>`:'—'):e(row.hometown_display||row.state_code||'—');
    return `<td class="rank-number">${displayedRank(row)}</td><td><strong>${e(row.weight_class_code)}</strong></td><td><a class="wrestler-link" href="${SimSite.profileUrl(row.wrestler_guid)}">${e(row.wrestler_name)}</a></td><td>${team}</td>`;
  }

  function resultsTable(visible) {
    return `<div class="table-wrap statistics-table-wrap"><table class="statistics-table compact-results"><thead><tr><th>${header('Rank','wrestler_rank')}</th><th>${header('Weight','weight')}</th><th>${header('Wrestler','wrestler_name')}</th><th>${header(collegeMode()?'College':'Hometown','team_name')}</th><th>${header('Record','record')}</th><th>${header('Win %','win_pct')}</th><th>${header('Bonus %','bonus_point_rate')}</th></tr></thead><tbody>${visible.map((row)=>`<tr>${identityCells(row)}<td><strong>${e(row.record_display)}</strong></td><td>${SimSite.percent(row.win_pct,1)}</td><td><span class="bonus-pill">${e(row.bonus_point_percentage_display||'0.0%')}</span></td></tr>`).join('')}</tbody></table></div>`;
  }

  function performanceTable(visible) {
    return `<div class="table-wrap statistics-table-wrap"><table class="statistics-table compact-performance"><thead><tr><th>${header('Rank','wrestler_rank')}</th><th>${header('Weight','weight')}</th><th>${header('Wrestler','wrestler_name')}</th><th>${header('Matches','match_qty')}</th><th>${header('Avg. pts.','average_match_points')}</th><th>${header('Avg. margin','average_point_differential')}</th><th>${header('Avg. TD','average_takedowns')}</th><th>${header('TD %','takedown_success_rate')}</th><th>${header('Avg. ESC','average_escapes')}</th><th>${header('Avg. REV','average_reversals')}</th><th>${header('Avg. back','average_back_points')}</th><th>${header('Avg. ride','average_riding_time_seconds')}</th></tr></thead><tbody>${visible.map((row)=>`<tr><td class="rank-number">${displayedRank(row)}</td><td><strong>${e(row.weight_class_code)}</strong></td><td><a class="wrestler-link" href="${SimSite.profileUrl(row.wrestler_guid)}">${e(row.wrestler_name)}</a></td><td>${row.match_qty}</td><td>${SimSite.number(row.average_match_points,1)}</td><td>${Number(row.average_point_differential||0)>0?'+':''}${SimSite.number(row.average_point_differential,1)}</td><td>${SimSite.number(row.average_takedowns,2)}</td><td>${SimSite.percent(row.takedown_success_rate,1)}</td><td>${SimSite.number(row.average_escapes,2)}</td><td>${SimSite.number(row.average_reversals,2)}</td><td>${SimSite.number(row.average_back_points,2)}</td><td>${e(row.average_riding_time_display||'0:00')}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function syncUrl() {
    SimSite.syncFilters({level:levelFilter.value,weight:weightFilter.value,region:collegeMode()?regionFilter.value:'',state:stateFilter.value,county:collegeMode()?'':countyFilter.value,locality:collegeMode()?'':localityFilter.value,q:search.value.trim(),stats:view});
  }

  function render() {
    const visible=visibleRows();
    count.textContent=`${visible.length} wrestler${visible.length===1?'':'s'}`;
    title.textContent=view==='results'?'Season Results':'Average Match Performance';
    tabs.forEach((tab)=>tab.classList.toggle('active',tab.dataset.statisticsView===view));
    search.placeholder=collegeMode()?'Start typing a wrestler or college':'Start typing a wrestler or hometown';
    syncUrl();
    content.innerHTML=visible.length?(view==='results'?resultsTable(visible):performanceTable(visible)):'<div class="state-card"><p>No statistics match the selected filters.</p></div>';
    content.querySelectorAll('[data-sort]').forEach((button)=>button.addEventListener('click',()=>{
      const key=button.dataset.sort;
      if(sort.key===key) sort.direction=sort.direction==='asc'?'desc':'asc';
      else { sort.key=key; sort.direction=['wrestler_rank','weight','wrestler_name','team_name'].includes(key)?'asc':'desc'; }
      render();
    }));
  }

  async function loadRows() {
    const sequence=++loadSequence;
    count.textContent='Loading…';
    content.innerHTML='<div class="state-card"><span class="spinner" aria-hidden="true"></span><p>Loading selected statistics…</p></div>';
    try {
      const loaded=await SimApi.mediaStatisticsFiltered({
        level:levelFilter.value,weight:weightFilter.value,
        region:collegeMode()&&regionFilter.value!=='ALL'?regionFilter.value:null,
        state:stateFilter.value&&stateFilter.value!=='ALL'?stateFilter.value:null,
        county:!collegeMode()&&countyFilter.value!=='ALL'?countyFilter.value:null,
        locality:!collegeMode()&&localityFilter.value!=='ALL'?localityFilter.value:null,
        limit:1000
      });
      if(sequence!==loadSequence) return;
      rows=Array.isArray(loaded)?loaded:[];
      setScopeRanks();
      render();
    } catch(error) {
      if(sequence!==loadSequence) return;
      SimSite.showError(content,error.message); count.textContent='Unavailable';
    }
  }

  try {
    regionInventory=await SimApi.regionStateInventory();
    levelFilter.value=SimSite.selectedLevel();
    view=SimSite.query('stats')==='performance'?'performance':'results';
    rebuildWeights(String(SimSite.query('weight')||'').toUpperCase());
    await configureGeography({
      region:String(SimSite.query('region')||SimSite.defaultRegionCode(regionInventory)).toUpperCase(),
      state:String(SimSite.query('state')||'NJ').toUpperCase(),
      county:SimSite.query('county')||'',locality:SimSite.query('locality')||''
    });
    search.value=SimSite.query('q')||'';
    levelFilter.disabled=false; weightFilter.disabled=false;

    levelFilter.addEventListener('change',async()=>{ rebuildWeights(); await configureGeography({state:levelFilter.value==='HIGH_SCHOOL'?'NJ':'ALL'}); sort={key:'wrestler_rank',direction:'asc'}; await loadRows(); });
    weightFilter.addEventListener('change',async()=>{ sort={key:'wrestler_rank',direction:'asc'}; await loadRows(); });
    regionFilter.addEventListener('change',async()=>{ rebuildStates('ALL'); await loadRows(); });
    stateFilter.addEventListener('change',async()=>{ if(!collegeMode()){rebuildCounties();rebuildLocalities();} await loadRows(); });
    countyFilter.addEventListener('change',async()=>{ rebuildLocalities(); await loadRows(); });
    localityFilter.addEventListener('change',loadRows);
    search.addEventListener('input',render);
    tabs.forEach((tab)=>tab.addEventListener('click',()=>{ view=tab.dataset.statisticsView; sort={key:'wrestler_rank',direction:'asc'}; render(); }));
    await loadRows();
  } catch(error) {
    SimSite.showError(content,error.message); count.textContent='Unavailable';
  }
})();
