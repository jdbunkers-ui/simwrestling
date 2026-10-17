/* Sim Wrestling v4.1.0 — Live college selection (allowlisted server-side). */
(async function () {
  'use strict';
  const section=document.querySelector('[data-college-section]');
  if(!section)return;
  const get=(name)=>section.querySelector(`[data-${name}]`);
  const status=get('college-status'),browser=get('college-browser'),active=get('active-coach');
  const regionFilter=get('region-filter'),stateFilter=get('state-filter'),listing=get('college-list');
  const count=get('college-count'),selection=get('college-selection'),selectedLabel=get('selected-team');
  const claimButton=get('claim-button'),claimStatus=get('claim-status');
  const stateNames={DE:'Delaware',MD:'Maryland',NJ:'New Jersey',NY:'New York',PA:'Pennsylvania',WV:'West Virginia'};
  const option=(v,l)=>{const el=document.createElement('option');el.value=v;el.textContent=l;return el;};
  let colleges=[],selected=null,client=null,requestPending=false;
  function message(el,value,isError=false){el.textContent=value;el.classList.toggle('auth-status-error',isError);}
  function render(){
    const region=regionFilter.value,state=stateFilter.value;
    const states=[...new Set(colleges.filter(t=>!region||t.region_code===region).map(t=>t.state_code))].sort();
    const nextState=states.includes(state)?state:'';
    stateFilter.replaceChildren(option('','All available states'),...states.map(s=>option(s,stateNames[s]||s)));
    stateFilter.value=nextState;
    const rows=colleges.filter(t=>(!region||t.region_code===region)&&(!nextState||t.state_code===nextState));
    count.textContent=`${rows.length} available ${rows.length===1?'college':'colleges'}`;
    listing.replaceChildren();
    for(const t of rows){
      const btn=document.createElement('button');btn.type='button';btn.className='college-choice';btn.disabled=requestPending;
      btn.setAttribute('aria-pressed',String(selected===t.team_guid));
      const name=document.createElement('strong');name.textContent=t.team_name;
      const loc=document.createElement('small');loc.textContent=[t.hometown_city,t.state_code].filter(Boolean).join(', ');
      btn.append(name,loc);
      btn.addEventListener('click',()=>{selected=t.team_guid;selectedLabel.textContent=`Selected: ${t.team_name}`;selection.hidden=false;message(claimStatus,'');render();});
      listing.append(btn);
    }
    if(!rows.length)count.textContent='No available colleges match these filters.';
    if(selected&&!colleges.some(t=>t.team_guid===selected)){selected=null;selection.hidden=true;}
  }
  async function loadCoach(){
    const {data,error}=await client.rpc('get_my_coaching_status_v4_1_0');
    if(error)throw error;
    if(data?.active_assignment){
      status.hidden=true;browser.hidden=true;active.hidden=false;
      get('coach-team').textContent=data.active_assignment.team_name;
      const entitlements=(data.season_entitlements||[]).filter(e=>e.status==='ACTIVE')
        .map(e=>`Season ${e.season_sequence}: ${e.kind==='INTRO_PARTIAL'?'partial free':e.kind==='INTRO_FULL'?'full free':e.kind.toLowerCase()}`);
      get('coach-entitlements').textContent=entitlements.join(' · ');
      get('assist-checkbox').checked=Boolean(data.active_assignment.cpu_recruiting_enabled);
      return true;
    }
    if(data?.reservation){
      status.textContent='Your previous college is reserved for renewal until '+new Date(data.reservation.expires_at).toLocaleString()+'. Contact support for renewal assistance.';
      status.hidden=false;browser.hidden=true;active.hidden=true;return true;
    }
    return false;
  }
  async function loadAvailable(){
    const {data,error}=await client.rpc('get_available_colleges_v4_1_0');
    if(error)throw error;
    colleges=Array.isArray(data)?data:[];
    const regions=new Map(colleges.map(t=>[t.region_code,t.region_name]));
    regionFilter.replaceChildren(option('','All active regions'),...[...regions].sort((a,b)=>a[1].localeCompare(b[1])).map(([code,name])=>option(code,name)));
    browser.hidden=false;active.hidden=true;status.hidden=true;render();
  }
  try{
    const auth=await window.SimAuth.ready;client=auth.client;
    const {data:{user},error}=await client.auth.getUser();
    if(error||!user)return;
    section.hidden=false;
    if(!(await loadCoach()))await loadAvailable();
    regionFilter.addEventListener('change',render);stateFilter.addEventListener('change',render);
    claimButton.addEventListener('click',async()=>{
      if(requestPending||!selected)return;
      const team=colleges.find(t=>t.team_guid===selected);
      if(!team)return;
      const confirmed=window.confirm(`Claim ${team.team_name}?\n\nThis is a REAL production assignment. It starts your one-time introductory offer and cannot be undone by signing out or choosing another team. You cannot switch colleges during your entitled season.\n\nContinue?`);
      if(!confirmed)return;
      requestPending=true;claimButton.disabled=true;claimButton.textContent='Claiming college…';
      message(claimStatus,'Saving your college selection…');
      try{
        const {data,error:claimError}=await client.rpc('claim_college_v4_1_0',{p_team_guid:selected});
        if(claimError)throw claimError;
        if(!data?.assignment_guid)throw new Error('Claim response was incomplete. Refresh My Account before trying again.');
        message(claimStatus,`${data.team_name||team.team_name} claimed successfully.`);
        if(!(await loadCoach()))throw new Error('Claim saved but account refresh has not completed. Reload My Account.');
      }catch(err){
        message(claimStatus,`College claim could not be completed: ${err?.message||'Please try again.'}`,true);
        try{if(!(await loadCoach()))await loadAvailable();}catch(_){/* Preserve original error. */}
      }finally{requestPending=false;claimButton.disabled=false;claimButton.textContent='Claim This College';}
    });
    get('assist-save').addEventListener('click',async()=>{
      const enabled=get('assist-checkbox').checked;
      const button=get('assist-save');button.disabled=true;button.textContent='Saving…';
      message(get('assist-status'),'Saving recruiting preference…');
      try{
        const {error}=await client.rpc('set_cpu_recruiting_assistance_v4_1_0',{p_enabled:enabled});
        if(error)throw error;
        message(get('assist-status'),`Computer-Assisted Recruiting is now ${enabled?'ON':'OFF'}.`);
        await loadCoach();
      }catch(err){message(get('assist-status'),`Could not save: ${err?.message||'Unknown error'}`,true);try{await loadCoach();}catch(_){} }
      finally{button.disabled=false;button.textContent='Save Recruiting Preference';}
    });
  }catch(err){section.hidden=false;status.textContent='College information could not be loaded: '+(err?.message||'Try again later.');}
})();
