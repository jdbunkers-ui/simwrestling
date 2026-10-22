/* v4.4.7 - college-only rankings, mutually exclusive geography, authenticated coach default. */
(async function () {
  'use strict';
  const content = document.getElementById('rankings-content');
  const weightFilter = document.getElementById('weight-filter');
  const geoFilter = document.getElementById('geography-filter');
  const count = document.getElementById('ranking-count');
  const title = document.getElementById('rankings-title');
  const pageTitle = document.getElementById('directory-page-title');
  const pageCopy = document.getElementById('directory-page-copy');
  const seasonBadge = document.getElementById('ranking-season');
  if (!window.SimSite.configuredOrMessage(content)) return;
  const e = SimSite.escape;
  const weights = ['125','133','141','149','157','165','174','184','197','HWT'];
  const cache = new Map();
  let teams = null, inventory = [], renderSequence = 0;
  const option = (value,label) => `<option value="${e(value)}">${e(label)}</option>`;
  const stateName = (code) => {try {return new Intl.DisplayNames(['en'],{type:'region'}).of(code) || code;} catch (_) {return code;}};
  const regions = () => [...new Map(inventory.filter(r=>r.region_code).map(r=>[String(r.region_code).trim(),String(r.region_name||r.region_code).trim()])).entries()].sort((a,b)=>a[1].localeCompare(b[1]));
  const states = () => [...new Set(inventory.map(r=>String(r.state_code||'').trim()).filter(Boolean))].sort((a,b)=>stateName(a).localeCompare(stateName(b)));
  const regionKey = code => `REGION:${code}`;
  const stateKey = code => `STATE:${code}`;
  function populateGeography() {
    geoFilter.innerHTML = option('ALL','All Regions (National)') +
      '<optgroup label="Regions">' + regions().map(([code,name])=>option(regionKey(code),name)).join('') + '</optgroup>' +
      '<optgroup label="States">' + states().map(code=>option(stateKey(code),stateName(code))).join('') + '</optgroup>';
    geoFilter.disabled = false;
  }
  function geography() {
    const value = geoFilter.value;
    return { region:value.startsWith('REGION:')?value.slice(7):null, state:value.startsWith('STATE:')?value.slice(6):null };
  }
  function scopeLabel() {
    const geo=geography();
    if (geo.state) return stateName(geo.state);
    if (geo.region) return regions().find(([code])=>code===geo.region)?.[1]||geo.region;
    return 'National';
  }
  function syncUrl() {
    // Preserve unrelated URL params; only one of region/state can survive.
    const geo=geography();
    const url=new URL(location.href);
    ['level','county','locality','year','q','region','state','weight'].forEach(k=>url.searchParams.delete(k));
    if (geo.region) url.searchParams.set('region',geo.region);
    if (geo.state) url.searchParams.set('state',geo.state);
    if (weightFilter.value!=='TEAM') url.searchParams.set('weight',weightFilter.value);
    history.replaceState(null,'',url.pathname+url.search+url.hash);
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
    const geo=geography();
    const filtered=(teams||[]).filter(row=>(!geo.region||row.region_code===geo.region) && (!geo.state||String(row.state_code||'').trim()===geo.state))
      .sort(teamComparator).map((row,index)=>({...row,display_rank:index+1}));
    const rows=filtered.slice(0,25);
    count.textContent=`Top ${rows.length} of ${filtered.length} team${filtered.length===1?'':'s'}`;
    title.textContent=`${scopeLabel()} College Team Rankings`;
    pageTitle.textContent='College Rankings';
    pageCopy.textContent='College teams ranked nationally, by region or by state.';
    if (!rows.length) {content.innerHTML='<div class="state-card"><p>No teams match the selected geography.</p></div>';return;}
    content.innerHTML=`<div class="table-wrap"><table class="team-ranking-table"><thead><tr><th>Rank</th><th>Team</th><th>City</th><th>Record</th><th>Win %</th><th>Avg. margin</th></tr></thead><tbody>${rows.map(row=>`<tr><td class="rank-number">${row.display_rank}</td><td><a class="wrestler-link" href="${SimSite.teamUrl(row.team_guid)}">${e(row.team_name)}</a></td><td>${e(row.hometown_city||'—')}, ${e(String(row.state_code||'').trim())}</td><td><strong>${e(row.dual_record_display||'0-0')}</strong></td><td>${SimSite.percent(row.dual_win_rate,1)}</td><td>${Number(row.average_dual_margin||0)>0?'+':''}${SimSite.number(row.average_dual_margin,1)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  async function renderWrestlers() {
    const seq=++renderSequence;
    const geo=geography();
    const filters={level:'COLLEGE',weight:weightFilter.value,region:geo.region,state:geo.state,county:null,year:null,search:null,limit:25};
    const key=JSON.stringify(filters);
    content.classList.add('is-loading');
    try {
      let payload=cache.get(key);
      if(!payload){payload=await SimApi.rankingsFiltered(filters);cache.set(key,payload);}
      if(seq!==renderSequence)return;
      const rows=Array.isArray(payload?.rows)?payload.rows:[];
      const total=Number(payload?.total_count||0);
      count.textContent=`Top ${rows.length} of ${total} wrestler${total===1?'':'s'}`;
      const division=weightFilter.value==='PBP'?'Pound-for-Pound':`${weightFilter.value}-Pound`;
      title.textContent=`${scopeLabel()} College ${division} Rankings`;
      pageTitle.textContent='College Rankings';
      pageCopy.textContent='College wrestlers ranked nationally, by region or by state.';
      if(!rows.length){content.innerHTML='<div class="state-card"><p>No wrestlers match the selected filters.</p></div>';return;}
      content.innerHTML=`<div class="table-wrap"><table><thead><tr><th>Rank</th><th>Weight</th><th>Year</th><th>Wrestler</th><th>College team</th><th>Wins</th><th>Losses</th><th>Bonus %</th></tr></thead><tbody>${rows.map(row=>`<tr><td class="rank-number">${row.display_rank}</td><td><strong>${e(row.weight_class_code)}</strong></td><td>${e(row.eligibility_year_display)}</td><td><a class="wrestler-link" href="${SimSite.profileUrl(row.wrestler_guid)}">${e(row.wrestler_name)}</a>${row.roster_status==='BACKUP'?'<span class="subtext">Backup</span>':''}</td><td>${row.team_name?`<a class="table-link" href="${SimSite.teamUrl(row.team_guid)}">${e(row.team_name)}</a>`:'—'}</td><td>${Number(row.win_qty||0)}</td><td>${Number(row.loss_qty||0)}</td><td><span class="bonus-pill">${e(row.bonus_point_percentage_display||'0.0%')}</span></td></tr>`).join('')}</tbody></table></div>`;
    }catch(error){if(seq===renderSequence)SimSite.showError(content,error.message);}
    finally{if(seq===renderSequence)content.classList.remove('is-loading');}
  }
  function render(){ ++renderSequence;syncUrl();if(weightFilter.value==='TEAM')renderTeams();else renderWrestlers(); }
  async function coachState() {
    // Auth failure, guest visitor, or an account without a team => national rankings.
    try {
      const auth=await window.SimAuth.ready;
      if(!auth.user)return null;
      const {data,error}=await auth.client.rpc('get_my_coaching_dashboard_v4_2_0');
      if(error || !data?.team_guid)return null;
      const row=(teams||[]).find(team=>String(team.team_guid)===String(data.team_guid));
      return String(row?.state_code||'').trim()||null;
    }catch(error){console.warn('Rankings coach default unavailable:',error.message);return null;}
  }
  try {
    const [scope,seasonRows,teamRows]=await Promise.all([SimApi.regionStateInventory(),SimApi.season(),SimApi.teamRankings()]);
    inventory=Array.isArray(scope)?scope:[];
    teams=Array.isArray(teamRows)?teamRows:[];
    if(seasonBadge && seasonRows?.[0])seasonBadge.textContent=seasonRows[0].season_name;
    weightFilter.innerHTML=option('TEAM','Teams')+option('PBP','Pound-for-Pound')+weights.map(w=>option(w,w==='HWT'?'Heavyweight':`${w} lb`)).join('');
    populateGeography();
    // Explicit shared links override both authenticated and guest defaults.
    const params=new URLSearchParams(location.search);
    const requestedWeight=String(params.get('weight')||'TEAM').toUpperCase();
    weightFilter.value=[...weightFilter.options].some(o=>o.value===requestedWeight)?requestedWeight:'TEAM';
    const state=String(params.get('state')||'').trim().toUpperCase();
    const region=String(params.get('region')||'').trim().toUpperCase();
    if(state && states().includes(state))geoFilter.value=stateKey(state);
    else if(region && regions().some(([code])=>code===region))geoFilter.value=regionKey(region);
    else {
      const myState=await coachState();
      geoFilter.value=myState && states().includes(myState)?stateKey(myState):'ALL';
    }
    weightFilter.disabled=false;
    weightFilter.addEventListener('change',render);
    geoFilter.addEventListener('change',render);
    render();
  }catch(error){SimSite.showError(content,error.message);count.textContent='Unavailable';}
})();
