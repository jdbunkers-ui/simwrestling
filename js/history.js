/* v5.0.6 -- Clickable human-college identity badges throughout championship history. */
(async function () {
  'use strict';
  const root=document.getElementById('history-root');
  if(!SimSite.configuredOrMessage(root))return;
  const e=SimSite.escape;
  const weight=document.getElementById('history-weight');
  const geographyFilter=document.getElementById('history-geography');
  const title=document.getElementById('history-title');
  const count=document.getElementById('history-count');
  const latest=document.getElementById('history-latest-season');
  let inventory=[], individual=[], dual=[], teams=[], teamBadges=new Map();
  // Only active human-coached teams are included by the public identity RPC.
  const safeColor=value=>/^#[0-9a-fA-F]{6}$/.test(String(value||''))?String(value):null;
  function badgeTextColor(hex){
    const channels=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255)
      .map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4);
    return channels[0]*0.2126+channels[1]*0.7152+channels[2]*0.0722>0.179?'#102b43':'#ffffff';
  }
  function identityBadge(row){
    if(!row?.team_guid)return '';
    const data=teamBadges.get(String(row.team_guid));
    if(!data)return '';
    const acronym=String(data.team_acronym||'').trim().slice(0,8);
    const primary=safeColor(data.primary_color),secondary=safeColor(data.secondary_color);
    if(!acronym||!primary)return '';
    const name=e(row.team_name||'college');
    return `<a class="ranking-identity-link history-identity-link" href="${SimSite.teamUrl(row.team_guid)}" aria-label="View ${name} team profile" title="${name}"><span class="ranking-identity-badge" style="background:${primary};color:${badgeTextColor(primary)};border-color:${secondary||primary}">${e(acronym)}</span></a>`;
  }
  const weights=['125','133','141','149','157','165','174','184','197','HWT'];
  const states={AL:'Alabama',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming'};
  const option=(value,label)=>`<option value="${e(value)}">${e(label)}</option>`;
  const regions=()=>[...new Map(inventory.filter(r=>r.region_code).map(r=>[String(r.region_code).trim(),String(r.region_name||r.region_code).trim()])).entries()].sort((a,b)=>a[1].localeCompare(b[1]));
  const regionKey=code=>`REGION:${code}`;
  const stateKey=code=>`STATE:${code}`;
  const allowedStates=Object.keys(states).sort((a,b)=>states[a].localeCompare(states[b]));
  function populateGeo(){geographyFilter.innerHTML=option('ALL','All Regions (National)')+'<optgroup label="Regions">'+regions().map(([code,name])=>option(regionKey(code),name)).join('')+'</optgroup><optgroup label="States">'+allowedStates.map(code=>option(stateKey(code),states[code])).join('')+'</optgroup>';}
  function scope(){const v=geographyFilter.value;if(v.startsWith('STATE:')){const code=v.slice(6);return {level:'STATE',code,label:states[code]||code};}if(v.startsWith('REGION:')){const code=v.slice(7);return {level:'REGION',code,label:regions().find(([c])=>c===code)?.[1]||code};}return {level:'NATIONAL',code:'NATIONAL',label:'National'};}
  function syncUrl(){const url=new URL(location.href);['level','region','state','county','year','q','weight'].forEach(k=>url.searchParams.delete(k));const s=scope();if(s.level==='REGION')url.searchParams.set('region',s.code);if(s.level==='STATE')url.searchParams.set('state',s.code);if(weight.value!=='TEAM')url.searchParams.set('weight',weight.value);history.replaceState(null,'',url.pathname+url.search+url.hash);}
  function personCell(row){
    if(!row)return '<span class="history-empty">—</span>';
    const person=row.wrestler_guid?`<a class="wrestler-link history-wrestler" href="${SimSite.profileUrl(row.wrestler_guid)}">${e(row.wrestler_name||'—')}</a>`:`<strong>${e(row.wrestler_name||'—')}</strong>`;
    const college=row.team_guid?`<a class="history-college" href="${SimSite.teamUrl(row.team_guid)}">${e(row.team_name||'—')}</a>`:`<span class="history-college">${e(row.team_name||'—')}</span>`;
    return person+`<span class="history-college-identity">${college}${identityBadge(row)}</span>`;
  }
  function renderIndividuals(rows){const seasons=[...new Set(rows.map(x=>Number(x.game_season_number)))].sort((a,b)=>b-a);if(!seasons.length)return '<div class="state-card"><strong>No completed placements match these filters.</strong></div>';return `<div class="table-wrap history-table-wrap"><table class="history-placement-table"><thead><tr><th>Season</th>${['1st','2nd','3rd','4th','5th','6th','7th','8th'].map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${seasons.map(season=>{const sr=rows.filter(x=>Number(x.game_season_number)===season);return `<tr><td class="rank-number">S${season}</td>${Array.from({length:8},(_,i)=>`<td>${personCell(sr.find(x=>Number(x.placement)===i+1))}</td>`).join('')}</tr>`;}).join('')}</tbody></table></div>`;}
  function teamCell(row){
    return row?.team_guid?`<span class="history-team-identity"><a class="wrestler-link" href="${SimSite.teamUrl(row.team_guid)}">${e(row.team_name||'—')}</a>${identityBadge(row)}</span>`:'—';
  }
  function renderTeams(rows){const seasons=[...new Set(rows.map(x=>Number(x.game_season_number)))].sort((a,b)=>b-a);if(!seasons.length)return '<div class="state-card"><strong>No completed dual championships match these filters.</strong></div>';return `<div class="table-wrap"><table class="history-team-table"><thead><tr><th>Season</th><th>Champion</th><th>Runner-up</th><th>Score</th><th>Third place</th></tr></thead><tbody>${seasons.map(season=>{const sr=rows.filter(x=>Number(x.game_season_number)===season);const first=sr.find(x=>Number(x.placement)===1),second=sr.find(x=>Number(x.placement)===2),third=sr.find(x=>Number(x.placement)===3);return `<tr><td class="rank-number">S${season}</td><td>${teamCell(first)}</td><td>${teamCell(second)}</td><td><strong>${e(first?.score_display||'—')}</strong></td><td>${teamCell(third)}</td></tr>`;}).join('')}</tbody></table></div>`;}
  function render(){syncUrl();const s=scope(), teamMode=weight.value==='TEAM';const source=(teamMode?dual:individual).filter(row=>row.championship_level===s.level&&row.scope_code===s.code).filter(row=>teamMode||row.weight_class_code===weight.value);const seasonCount=new Set(source.map(row=>row.game_season_number)).size;count.textContent=`${seasonCount} season${seasonCount===1?'':'s'}`;title.textContent=teamMode?`${s.label} College Team Championship History`:`${s.label} College ${weight.value==='HWT'?'Heavyweight':weight.value+'-Pound'} Championship Placements`;root.innerHTML=teamMode?renderTeams(source):renderIndividuals(source);}
  async function coachState(){try{const auth=await window.SimAuth.ready;if(!auth.user)return null;const {data,error}=await auth.client.rpc('get_my_coaching_dashboard_v4_2_0');if(error||!data?.team_guid)return null;const team=teams.find(t=>String(t.team_guid)===String(data.team_guid));return String(team?.state_code||'').trim().toUpperCase()||null;}catch(err){console.warn('History coach geography unavailable:',err.message);return null;}}
  try{
    [inventory,individual,dual,teams]=await Promise.all([SimApi.regionStateInventory(),SimApi.collegeIndividualHistory(),SimApi.collegeDualHistory(),SimApi.teamRankings()]);
    inventory=Array.isArray(inventory)?inventory:[];individual=Array.isArray(individual)?individual:[];dual=Array.isArray(dual)?dual:[];teams=Array.isArray(teams)?teams:[];
    populateGeo();weight.innerHTML=option('TEAM','Teams')+weights.map(w=>option(w,w==='HWT'?'Heavyweight':`${w} lb`)).join('');
    const seasons=[...individual,...dual].map(row=>Number(row.game_season_number)).filter(Boolean);latest.textContent=seasons.length?`Season ${Math.max(...seasons)}`:'No completed seasons';
    const params=new URLSearchParams(location.search);const requestedWeight=String(params.get('weight')||'TEAM').toUpperCase();weight.value=['TEAM',...weights].includes(requestedWeight)?requestedWeight:'TEAM';
    const requestedState=String(params.get('state')||'').toUpperCase(),requestedRegion=String(params.get('region')||'').toUpperCase();
    if(allowedStates.includes(requestedState))geographyFilter.value=stateKey(requestedState);else if(regions().some(([code])=>code===requestedRegion))geographyFilter.value=regionKey(requestedRegion);else{const myState=await coachState();geographyFilter.value=myState&&allowedStates.includes(myState)?stateKey(myState):'ALL';}
    weight.disabled=false;geographyFilter.disabled=false;weight.addEventListener('change',render);geographyFilter.addEventListener('change',render);render();
    // Supplementary cosmetic identity data must never block championship history.
    SimApi.publicTeamIdentityBadges().then(rows=>{
      teamBadges=new Map((Array.isArray(rows)?rows:[]).map(item=>[String(item.team_guid),item]));
      render();
    }).catch(err=>console.warn('History identity badges unavailable:',err.message));
  }catch(err){SimSite.showError(root,err.message);count.textContent='Unavailable';}
})();
