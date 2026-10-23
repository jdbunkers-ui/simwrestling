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
  const prospectEyebrow = document.querySelector('#prospects-panel .eyebrow');
  const classEyebrow = document.querySelector('#classes-panel .eyebrow');
  const classSeasonProminent = document.getElementById('class-season-prominent');
  const prospectSeasonProminent = document.getElementById('prospect-season-prominent');

  if (!window.SimSite.configuredOrMessage(prospectBoard)) return;

  let prospects = [];
  let recruitingClasses = [];
  let activeTab = 'classes';
  let teams = [], inventory = [], coaches = new Map();
  let prospectLoadError = null;

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
    const selected = geo();
    const rankField = selected.state ? 'state_recruiting_rank'
      : selected.region ? 'region_recruiting_rank' : 'national_recruiting_rank';
    const rank = (row, field) => {
      const value = Number(row[field]);
      return Number.isFinite(value) && value > 0 ? value : Infinity;
    };
    return prospects.filter((row) => {
      if (!matches(row)) return false;
      return weightFilter.value === 'ALL' || row.weight_class_code === weightFilter.value;
    }).sort((a, b) => rank(a, rankField) - rank(b, rankField)
      || rank(a, 'national_recruiting_rank') - rank(b, 'national_recruiting_rank')
      || String(a.wrestler_name).localeCompare(String(b.wrestler_name))
      || String(a.wrestler_guid).localeCompare(String(b.wrestler_guid)));
  }

  function preferredSchools(row) {
    const schools = Array.isArray(row.preferred_schools) ? row.preferred_schools : [];
    if (!schools.length) {
      return '<p class="no-preferences">No preferred schools established</p>';
    }
    return `<div class="class-recruit-links">${schools.map((school) => `<a href="${SimSite.teamUrl(school.team_guid)}">${e(school.team_name)}</a>`).join('')}</div>`;
  }

  function renderProspects() {
    const rows = scopedProspects();
    const visible = rows.slice(0, 25);
    const geography = scopeName();
    const weight = weightFilter.value === 'ALL' ? ''
      : ` ${weightFilter.value === 'HWT' ? 'HWT' : `${weightFilter.value}-Pound`}`;

    const activeSeasonNumber = Number(prospects[0]?.game_season_number || 0);
    prospectTitle.textContent = `${geography}${weight} High-School Senior Rankings`;
    prospectSeasonProminent.textContent = activeSeasonNumber ? `SEASON ${activeSeasonNumber}` : 'CURRENT SEASON';
    prospectEyebrow.textContent = activeSeasonNumber ? `Season ${activeSeasonNumber} · Active recruiting · Seniors only` : 'Current season · Active recruiting · Seniors only';
    prospectCount.textContent = `Top ${visible.length} of ${rows.length} senior${rows.length === 1 ? '' : 's'}`;
    syncUrl();

    if (prospectLoadError) {
      SimSite.showError(prospectBoard, prospectLoadError.message || 'Senior rankings could not be loaded. Please refresh to try again.');
      prospectCount.textContent = 'Senior rankings unavailable';
      return;
    }

    if (!visible.length) {
      prospectBoard.innerHTML = '<div class="state-card"><p>No seniors match the selected recruiting filters.</p></div>';
      return;
    }

    const body = visible.map((row, index) => {
      const points = Number(row.total_recruiting_points || 0);
      const finishes = [
        ['National', row.national_finish],
        ['Regional', row.regional_finish],
        ['State', row.state_finish]
      ].filter(([, value]) => Number(value) > 0)
        .map(([label, value]) => `${label} #${Number(value)}`);
      if (row.record_display) finishes.push(`Record ${row.record_display}`);
      return `<tr>
        <td class="rank-number">${index + 1}</td>
        <td><a class="wrestler-link" href="${SimSite.profileUrl(row.wrestler_guid)}">${e(row.wrestler_name)}</a>
          <span class="subtext">${e(row.hometown_city || 'Unknown')}, ${e(row.state_code || '')} · ${e(row.weight_class_code)}${row.weight_class_code === 'HWT' ? '' : ' lb'} · Senior</span>
          ${finishes.length ? `<span class="subtext senior-results">${e(finishes.join(' · '))}</span>` : ''}
        </td>
        <td>${preferredSchools(row)}</td>
        <td class="class-score-cell">${points.toLocaleString('en-US')}
          <span class="subtext">${Number(row.recruiting_program_qty || 0)} program${Number(row.recruiting_program_qty || 0) === 1 ? '' : 's'} have recruited him</span>
        </td>
      </tr>`;
    }).join('');
    prospectBoard.innerHTML = `<div class="table-wrap"><table class="recruiting-classes-table team-ranking-table senior-ranking-table"><thead><tr><th scope="col">Rank</th><th scope="col">Wrestler</th><th scope="col">Preferred Schools</th><th scope="col">Recruiting Points</th></tr></thead><tbody>${body}</tbody></table></div>`;
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

    const signingSeasonNumber = Number(rows[0]?.game_season_number || 0);
    const recruitingSeasonNumber = Math.max(0, signingSeasonNumber - 1);
    classTitle.textContent = `${geography} Recruiting Classes · Final Standings`;
    classSeasonProminent.textContent = recruitingSeasonNumber ? `SEASON ${recruitingSeasonNumber}` : 'PREVIOUS SEASON';
    classEyebrow.textContent = recruitingSeasonNumber ? `Season ${recruitingSeasonNumber} · Final recruiting results` : 'Last completed recruiting season · Final results';
    classCount.textContent = latestSeason
      ? `Season ${recruitingSeasonNumber || latestSeason} recruiting class · Final standings · ${rows.length} college program${rows.length === 1 ? '' : 's'}`
      : 'Class rankings will publish automatically when the season rolls over.';

    syncUrl();

    if (!rows.length) {
      classBoard.innerHTML = '<div class="state-card"><p>No completed recruiting class matches this geography yet.</p></div>';
      return;
    }

    classBoard.innerHTML = `<div class="table-wrap"><table class="recruiting-classes-table team-ranking-table"><thead><tr><th>Rank</th><th>Team</th><th>Coach</th><th>Class Score</th><th>Top Five Recruits · Final National Rank</th></tr></thead><tbody>${rows.map(row=>{
      const recruits=parsedRecruits(row);
      const links=recruits.length?recruits.map(recruit=>`<a href="${SimSite.profileUrl(recruit.wrestler_guid)}">${e(recruit.wrestler_name)} <small>#${e(recruit.final_national_recruiting_rank ?? '—')} national</small></a>`).join(''):'<small>No ranked signees</small>';
      return `<tr><td class="rank-number">${e(row[rankField]??'—')}</td><td><a class="wrestler-link" href="${SimSite.teamUrl(row.team_guid)}">${e(row.team_name)}</a></td><td>${e(coaches.get(String(row.team_guid))||'')}</td><td class="class-score-cell">${(Number(row.class_score||0)/20).toFixed(2)}</td><td><div class="class-recruit-links">${links}</div></td></tr>`;
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
    else prospectLoadError=prospectResult.reason;
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
