(async function () {
  const prospectBoard = document.getElementById('prospect-board');
  const prospectTitle = document.getElementById('prospect-title');
  const prospectCount = document.getElementById('recruiting-count');
  const seasonLabel = document.getElementById('recruiting-season');
  const geographyFilter = document.getElementById('recruiting-geography');
  const weightFilter = document.getElementById('recruiting-weight');
  const classBoard = document.getElementById('class-board');
  const classTitle = document.getElementById('class-title');
  const classCount = document.getElementById('class-count');
  const prospectsTab = document.getElementById('prospects-tab');
  const classesTab = document.getElementById('classes-tab');
  const prospectsPanel = document.getElementById('prospects-panel');
  const classesPanel = document.getElementById('classes-panel');
  const e = SimSite.escape;

  if (!window.SimSite.configuredOrMessage(prospectBoard)) return;

  let prospects = [];
  let recruitingClasses = [];
  let activeTab = 'classes';
  let teams = [], inventory = [], coaches = new Map();

  function option(value, label) {
    return `<option value="${e(value)}">${e(label)}</option>`;
  }

  const contiguous = Object.freeze({
    AL:'Alabama',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming'
  });
  const regions = () => [...new Map(inventory.filter(r => r.region_code).map(r => [String(r.region_code).trim(),String(r.region_name||r.region_code).trim()])).entries()].sort((a,b)=>a[1].localeCompare(b[1]));
  const stateCodes = () => Object.keys(contiguous).sort((a,b)=>contiguous[a].localeCompare(contiguous[b]));
  function geo(){const v=geographyFilter.value;return {region:v.startsWith('REGION:')?v.slice(7):null,state:v.startsWith('STATE:')?v.slice(6):null};}
  function scopeName(){const g=geo();return g.state?contiguous[g.state]:g.region?(regions().find(x=>x[0]===g.region)?.[1]||g.region):'National';}
  function matches(row){const g=geo();return (!g.state||String(row.state_code||'').trim().toUpperCase()===g.state)&&(!g.region||String(row.region_code||'').trim()===g.region);}
  function syncUrl(){const url=new URL(location.href);['state','region','recruiting_tab','recruiting_weight'].forEach(k=>url.searchParams.delete(k));const g=geo();if(g.state)url.searchParams.set('state',g.state);if(g.region)url.searchParams.set('region',g.region);history.replaceState(null,'',url.pathname+url.search+url.hash);}
  async function coachState(){
    try { const auth=await window.SimAuth.ready;if(!auth?.user)return null;
      const {data,error}=await auth.client.rpc('get_my_coaching_dashboard_v4_2_0');if(error||!data?.team_guid)return null;
      const row=teams.find(t=>String(t.team_guid)===String(data.team_guid));return String(row?.state_code||'').trim().toUpperCase()||null;
    }catch(err){console.warn('Recruiting coach geography unavailable:',err.message);return null;}
  }
  async function populateGeography(){
    geographyFilter.innerHTML=option('ALL','All Regions (National)')+'<optgroup label="Regions">'+regions().map(([code,name])=>option('REGION:'+code,name)).join('')+'</optgroup><optgroup label="States">'+stateCodes().map(code=>option('STATE:'+code,contiguous[code])).join('')+'</optgroup>';
    const params=new URLSearchParams(location.search),state=String(params.get('state')||'').toUpperCase(),region=String(params.get('region')||'').toUpperCase();
    if(stateCodes().includes(state))geographyFilter.value='STATE:'+state;
    else if(regions().some(([c])=>c===region))geographyFilter.value='REGION:'+region;
    else {const own=await coachState();geographyFilter.value=own&&stateCodes().includes(own)?'STATE:'+own:'ALL';}
    geographyFilter.disabled=false;
    const availableWeights=new Set(prospects.map(r=>String(r.weight_class_code)));
    weightFilter.innerHTML=option('ALL','All weights')+SimSite.highSchoolWeightOrder.filter(w=>availableWeights.has(w)).map(w=>option(w,w==='HWT'?'HWT':w+' lb')).join('');
    weightFilter.value='ALL';
  }

  function scopedProspects() {
    return prospects.filter((row) => {
      if (!matches(row)) return false;
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
    const geography = scopeName();
    const weight = weightFilter.value === 'ALL' ? ''
      : ` ${weightFilter.value === 'HWT' ? 'HWT' : `${weightFilter.value}-Pound`}`;

    prospectTitle.textContent = `${geography}${weight} Most-Recruited High-School Wrestlers`;
    prospectCount.textContent = `Top ${visible.length} of ${rows.length} senior${rows.length === 1 ? '' : 's'}`;
    syncUrl();

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
    const selected=geo();
    const scope = selected.state ? 'state' : selected.region ? 'regional' : 'national';
    const rankField = `${scope}_class_rank`;
    const geography = scopeName();
    const rows = recruitingClasses.filter((row) => {
      if (Number(row.game_season_number) !== latestSeason) return false;
      return matches(row);
    }).sort((a, b) => Number(a[rankField]) - Number(b[rankField])
      || String(a.team_name).localeCompare(String(b.team_name)));

    classTitle.textContent = `${geography} Recruiting Classes`;
    classCount.textContent = latestSeason
      ? `Season ${latestSeason} incoming classes · ${rows.length} college program${rows.length === 1 ? '' : 's'}`
      : 'Class rankings will publish automatically when the season rolls over.';

    syncUrl();

    if (!rows.length) {
      classBoard.innerHTML = '<div class="state-card"><p>No completed recruiting class matches this geography yet.</p></div>';
      return;
    }

    classBoard.innerHTML = `<div class="table-wrap"><table class="recruiting-classes-table team-ranking-table"><thead><tr><th>Rank</th><th>Team</th><th>Coach</th><th>Class Score</th><th>Top Five Recruits · Final National Rank</th></tr></thead><tbody>${rows.map(row=>{
      const recruits=parsedRecruits(row);
      const links=recruits.length?recruits.map(recruit=>`<a href="${SimSite.profileUrl(recruit.wrestler_guid)}">${e(recruit.wrestler_name)} <small>#${e(recruit.final_national_recruiting_rank ?? '—')} national</small></a>`).join(''):'<small>No ranked signees</small>';
      return `<tr><td class="rank-number">${e(row[rankField]??'—')}</td><td><a class="wrestler-link" href="${SimSite.teamUrl(row.team_guid)}">${e(row.team_name)}</a></td><td>${e(coaches.get(String(row.team_guid))||'')}</td><td class="class-score-cell">${Number(row.class_score||0).toFixed(1)}</td><td><div class="class-recruit-links">${links}</div></td></tr>`;
    }).join('')}</tbody></table></div>`;
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

  geographyFilter.addEventListener('change',()=>{if(activeTab==='classes')renderClasses();else renderProspects();});
  weightFilter.addEventListener('change',renderProspects);
  prospectsTab.addEventListener('click', () => activateTab('prospects'));
  classesTab.addEventListener('click', () => activateTab('classes'));

  try {
    const [prospectResult,classResult,scopeResult,teamResult]=await Promise.allSettled([
      SimApi.recruitingSeniors(),SimApi.recruitingClasses(),SimApi.regionStateInventory(),SimApi.teamRankings()
    ]);
    if(prospectResult.status==='fulfilled')prospects=prospectResult.value||[];
    if(classResult.status==='fulfilled')recruitingClasses=classResult.value||[];
    if(scopeResult.status==='fulfilled')inventory=scopeResult.value||[];
    if(teamResult.status==='fulfilled')teams=teamResult.value||[];
    if(prospectResult.status==='rejected'&&classResult.status==='rejected')throw prospectResult.reason;
    await populateGeography();
    const season=prospects[0]||recruitingClasses[0];
    seasonLabel.textContent=season?.game_season_number?`Season ${season.game_season_number} recruiting center`:'Current season recruiting center';
    activateTab('classes');
    SimApi.publicTeamCoaches().then(rows=>{
      coaches=new Map((Array.isArray(rows)?rows:[]).map(r=>[String(r.team_guid),String(r.coach_name||'')]));
      if(activeTab==='classes')renderClasses();
    }).catch(err=>console.warn('Public coach names unavailable:',err.message));
  } catch (error) {
    SimSite.showError(prospectBoard, error.message);
    prospectCount.textContent = 'Recruiting data unavailable';
    classCount.textContent = 'Recruiting class data unavailable';
  }
})();
