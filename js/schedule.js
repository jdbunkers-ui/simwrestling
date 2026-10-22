/* v4.4.9: Unified college schedule and spoiler-safe results index. */
(async function () {
  'use strict';
  const root=document.getElementById('schedule-root');
  const geographySelect=document.getElementById('schedule-geography');
  const toggle=document.getElementById('schedule-results-toggle');
  const e=SimSite.escape;
  if (!SimSite.configuredOrMessage(root)) return;
  const contiguous={AL:'Alabama',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming'};
  let inventory=[],teams=[],events=[],leagueDate='',showResults=false;
  let openWeek=null,openDay=null;
  const stateCodes=Object.keys(contiguous).sort((a,b)=>contiguous[a].localeCompare(contiguous[b]));
  const regions=()=>[...new Map(inventory.filter(r=>r.region_code).map(r=>[String(r.region_code).trim(),String(r.region_name||r.region_code).trim()])).entries()].sort((a,b)=>a[1].localeCompare(b[1]));
  const geoInfo=()=>{const v=geographySelect.value;return {state:v.startsWith('STATE:')?v.slice(6):null,region:v.startsWith('REGION:')?v.slice(7):null};};
  const regionStates=new Map();
  let teamMap=new Map();
  function matches(ev){
    const g=geoInfo();if(!g.state&&!g.region)return true;
    const codes=(ev.teams||[]).map(t=>String(t.state_code||'').trim().toUpperCase());
    if(g.state)return codes.includes(g.state)||(!codes.length&&String(ev.state_code||'').trim()===g.state);
    const allowed=regionStates.get(g.region)||new Set();
    return codes.some(code=>allowed.has(code))||String(ev.region_code||'').trim()===g.region||(!codes.length&&allowed.has(String(ev.state_code||'').trim()));
  }
  function label(ev){const type=String(ev.event_type||'');if(type==='COLLEGE_QUAD')return 'Dual Match';const kind=type.endsWith('_DUAL')?'Dual Tournament': 'Individual Tournament';const tier=type.includes('_STATE_')?'State':type.includes('_REGIONAL_')?'Regional':type.includes('_NATIONAL_')?'National':type.includes('HOLIDAY')?'Invitational':'';return tier?`${kind} · ${tier}`:kind;}
  function stateRank(guid){const t=teamMap.get(String(guid));return t?.state_team_rank!=null?`#${e(t.state_team_rank)}`:'—';}
  const teamLink=(t)=>`<a href="${SimSite.teamUrl(t.team_guid)}">${e(t.team_name)}</a>`;
  function duels(ev){
    const people=new Map((ev.teams||[]).map(t=>[String(t.team_guid),t]));
    const matches=(ev.duals||[]).filter(d=>d.team_1_guid&&d.team_2_guid);
    if(!matches.length)return '';
    return `<div class="schedule-duals"><h4>Dual matches</h4>${matches.map(d=>{
      const one=people.get(String(d.team_1_guid))||{team_guid:d.team_1_guid,team_name:'Team 1'};
      const two=people.get(String(d.team_2_guid))||{team_guid:d.team_2_guid,team_name:'Team 2'};
      const finished=String(d.processing_status||'').toUpperCase()==='COMPLETED'&&d.dual_guid;
      const score=showResults&&finished&&d.team_1_score!=null&&d.team_2_score!=null?` <strong>${e(d.team_1_score)}–${e(d.team_2_score)}</strong> `:' <span class="schedule-vs">vs.</span> ';
      return `<div class="schedule-dual-row">${teamLink(one)}${score}${teamLink(two)}${finished?`<a class="schedule-watch" href="${SimSite.dualUrl(d.dual_guid)}">Watch PBP →</a>`:''}</div>`;
    }).join('')}</div>`;
  }
  function eventCard(ev){
    const completed=String(ev.session_status||ev.event_status||'').toUpperCase()==='COMPLETED';
    const participants=(ev.teams||[]);
    return `<article class="schedule-event-card"><header><div><span class="schedule-type-badge">${e(label(ev))}</span><h3>${e(ev.event_name)}</h3></div><span class="event-status ${completed?'status-completed':'status-scheduled'}">${completed?'Completed':'Scheduled'}</span></header>
      ${participants.length?`<div class="schedule-participants"><div class="schedule-participant-head"><strong>College</strong><strong>State rank</strong></div>${participants.map(t=>`<div>${teamLink(t)}<span>${stateRank(t.team_guid)}</span></div>`).join('')}</div>`:''}
      ${duels(ev)}
      ${ev.event_type!=='COLLEGE_QUAD'?`<a class="schedule-event-link" href="${SimSite.eventUrl(ev.event_guid)}">${completed?'View Tournament / Brackets':'View Event Details'} →</a>`:''}
    </article>`;
  }
  function dateText(d){return new Date(`${d}T12:00:00`).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});}
  function render(){
    const visible=events.filter(matches);
    let html='';
    for(let week=1;week<=8;week++){
      const weekEvents=visible.filter(ev=>Number(ev.week_number)===week);
      const expanded=openWeek===week;
      const dateSet=[...new Set(weekEvents.map(ev=>ev.scheduled_date))].sort();
      html+=`<section class="schedule-week panel"><button type="button" class="schedule-week-trigger" data-week="${week}" aria-expanded="${expanded}"><span><span class="schedule-chevron">${expanded?'▾':'▸'}</span> Week ${week}</span><small>${weekEvents.length} event session${weekEvents.length===1?'':'s'}</small></button>`;
      if(expanded){
        if(!dateSet.length)html+='<div class="schedule-no-events">No college events for this geography.</div>';
        else dateSet.forEach((date,index)=>{
          const dayEvents=weekEvents.filter(ev=>ev.scheduled_date===date);
          const dayNum=Number(dayEvents[0]?.day_number||index+1);
          const dayOpen=openDay===date;
          html+=`<div class="schedule-day-block"><button class="schedule-day-trigger" type="button" data-date="${e(date)}" aria-expanded="${dayOpen}"><span><span class="schedule-chevron">${dayOpen?'▾':'▸'}</span> Day ${dayNum} · ${e(dateText(date))}</span><small>${dayEvents.length} event${dayEvents.length===1?'':'s'}</small></button>${dayOpen?`<div class="schedule-event-list">${dayEvents.map(eventCard).join('')}</div>`:''}</div>`;
        });
      }
      html+='</section>';
    }
    root.innerHTML=html;
    root.querySelectorAll('[data-week]').forEach(b=>b.addEventListener('click',()=>{const w=Number(b.dataset.week);openWeek=openWeek===w?null:w;openDay=null;render();}));
    root.querySelectorAll('[data-date]').forEach(b=>b.addEventListener('click',()=>{openDay=openDay===b.dataset.date?null:b.dataset.date;render();}));
  }
  function initDefault(){
    const upcoming=events.filter(ev=>ev.scheduled_date>=leagueDate&&String(ev.session_status||'').toUpperCase()!=='COMPLETED').sort((a,b)=>a.scheduled_date.localeCompare(b.scheduled_date)||Number(a.week_number)-Number(b.week_number));
    const next=upcoming.find(matches);
    if(next){openWeek=Number(next.week_number);openDay=next.scheduled_date;}
    else{openWeek=null;openDay=null;}
  }
  async function coachState(){
    try{const auth=await window.SimAuth.ready;if(!auth.user)return null;
      const {data,error}=await auth.client.rpc('get_my_coaching_dashboard_v4_2_0');if(error||!data?.team_guid)return null;
      return String(teamMap.get(String(data.team_guid))?.state_code||'').trim()||null;
    }catch(err){console.warn('Schedule coach default not available:',err.message);return null;}
  }
  try{
    const [payload,scope,rankings]=await Promise.all([SimApi.publicCollegeSchedule(),SimApi.regionStateInventory(),SimApi.teamRankings()]);
    events=Array.isArray(payload?.events)?payload.events:[];
    leagueDate=String(payload?.league_date||'');
    inventory=Array.isArray(scope)?scope:[];
    teams=Array.isArray(rankings)?rankings:[];
    teamMap=new Map(teams.map(t=>[String(t.team_guid),t]));
    regions().forEach(([code])=>regionStates.set(code,new Set(inventory.filter(r=>String(r.region_code||'').trim()===code).map(r=>String(r.state_code||'').trim().toUpperCase()))));
    geographySelect.innerHTML='<option value="ALL">All Regions (National)</option><optgroup label="Regions">'+regions().map(([code,name])=>`<option value="REGION:${e(code)}">${e(name)}</option>`).join('')+'</optgroup><optgroup label="States">'+stateCodes.map(code=>`<option value="STATE:${code}">${e(contiguous[code])}</option>`).join('')+'</optgroup>';
    const params=new URLSearchParams(location.search);
    const state=String(params.get('state')||'').toUpperCase(),region=String(params.get('region')||'').toUpperCase();
    if(stateCodes.includes(state))geographySelect.value='STATE:'+state;
    else if(regions().some(([code])=>code===region))geographySelect.value='REGION:'+region;
    else{const myState=await coachState();geographySelect.value=myState&&stateCodes.includes(myState)?'STATE:'+myState:'ALL';}
    geographySelect.disabled=false;
    document.getElementById('schedule-season').textContent=`Season ${payload?.season_number||'Current'}`;
    function syncUrl(){const u=new URL(location.href);u.searchParams.delete('state');u.searchParams.delete('region');u.searchParams.delete('level');const g=geoInfo();if(g.state)u.searchParams.set('state',g.state);if(g.region)u.searchParams.set('region',g.region);history.replaceState(null,'',u.pathname+u.search+u.hash);}
    geographySelect.addEventListener('change',()=>{syncUrl();initDefault();render();});
    toggle.addEventListener('click',()=>{showResults=!showResults;toggle.textContent=showResults?'Hide Results':'Show Results';toggle.setAttribute('aria-pressed',String(showResults));render();});
    initDefault();render();
  }catch(error){SimSite.showError(root,error.message);}
})();
