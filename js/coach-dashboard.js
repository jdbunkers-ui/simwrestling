/* v4.2.1 Private coaching landing page. No caller-supplied team ID. */
(async function(){
  'use strict';
  const root=document.getElementById('coach-root');if(!root)return;
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeGuid=value=>/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(value||''))?String(value):null;
  const empty=msg=>`<div class="coach-empty-note">${escape(msg)}</div>`;
  const error=msg=>{root.innerHTML=`<section class="panel coach-gate"><h1>Coaching portal</h1><p>${escape(msg)}</p><p><a href="account.html">My Account</a> · <a href="login.html">Sign in</a></p></section>`;};
  const dateText=value=>{if(!value)return '—';const d=new Date(String(value).slice(0,10)+'T12:00:00');return isNaN(d)?String(value):d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});};
  try{
    const auth=await window.SimAuth.ready;
    const {data:{user},error:userError}=await auth.client.auth.getUser();
    if(userError||!user){error('Please sign in to access your college.');return;}
    const {data,error:rpcError}=await auth.client.rpc('get_my_coaching_dashboard_v4_2_0');
    if(rpcError)throw rpcError;
    if(!data?.team_guid)throw new Error('No active college was returned. Visit My Account to select a college.');
    const roster=Array.isArray(data.roster)?data.roster:[];
    const schedule=Array.isArray(data.upcoming_schedule)?data.upcoming_schedule:[];
    const starters=roster.filter(r=>r.starter_ind).length;
    let rosterMode='starters';
    let saving=false;
    const today=data.current_league_date;
    document.title=`${data.team_name} — Coaching | Sim Wrestling`;
    root.innerHTML=`
      <section class="coach-live-hero"><div><p class="eyebrow">YOUR COLLEGE · CURRENT SEASON</p><h1>${escape(data.team_name)}</h1><p>${escape(data.hometown_city||'')}${data.state_code?', '+escape(data.state_code):''} · ${escape(data.season_code||'Current season')}</p></div><div class="coach-hero-seal" aria-hidden="true">SW</div></section>
      <nav class="coach-subnav" aria-label="Private coaching pages"><a class="active" aria-current="page" href="coach.html">Coaching</a><a href="coach-recruiting.html">Recruiting</a><a href="coach-history.html">Program History</a></nav>
      <div class="coach-summary-grid"><article><span>Roster</span><strong>${roster.length}</strong><small>Current listed wrestlers</small></article><article><span>Starters</span><strong>${starters}</strong><small>Current starting lineup</small></article><article><span>Upcoming events</span><strong>${schedule.length}</strong><small>Published future schedule entries</small></article><article><span>League date</span><strong class="coach-date">${escape(dateText(today))}</strong><small>Simulated season date</small></article></div>
      <section class="panel coach-live-panel"><div class="panel-heading coach-roster-heading"><div><p class="eyebrow">CURRENT COLLEGE</p><h2>Roster and starting lineup</h2></div><div class="coach-roster-switch" role="group" aria-label="Roster view"><button type="button" id="roster-full" aria-pressed="false">Full Roster</button><button type="button" id="roster-starters" class="active" aria-pressed="true">Starters</button></div></div>
      <p id="lineup-feedback" class="coach-lineup-feedback" role="status" aria-live="polite"></p>
      <div id="coaching-roster-table"></div>
      <p class="coach-detail-note">Select a starter in the Full Roster view, then confirm the change. Changes affect future competitions, not completed matches. Wrestler names open their private scouting profiles.</p></section>
      <section class="panel coach-live-panel"><div class="panel-heading"><div><p class="eyebrow">UP NEXT</p><h2>Upcoming college schedule</h2></div><span class="record-pill">${schedule.length} entries</span></div>
      ${schedule.length?`<div class="table-wrap"><table class="coach-live-table"><thead><tr><th>Date</th><th>Week</th><th>Event</th><th>Opponent / field</th><th>Result</th></tr></thead><tbody>${schedule.slice(0,40).map(s=>`<tr><td>${escape(dateText(s.scheduled_date))}</td><td>${escape(s.week_number??'—')}</td><td>${escape(s.event_name||s.schedule_type||'Event')}</td><td>${escape(s.opponent_or_field||'—')}</td><td>${escape(s.result_display||'Pending')}</td></tr>`).join('')}</tbody></table></div>`:empty('No future events remain on the published schedule.')}</section>
      <section class="coach-future-grid"><article class="panel coach-future"><p class="eyebrow">FUTURE COACHING TOOL</p><h2>Wrestle Off</h2><p>Schedule an internal practice match between two wrestlers from your roster.</p><span class="coach-soon">Under Construction</span></article><article class="panel coach-future"><p class="eyebrow">FUTURE COACHING TOOL</p><h2>Off-Season Training Program</h2><p>Plan individual development and training activities between seasons.</p><span class="coach-soon">Under Construction</span></article></section>
      <p class="coach-detail-note">Wrestle-offs and off-season training will follow in later releases.</p>`;

    const rosterPanel=document.getElementById('coaching-roster-table');
    const feedback=document.getElementById('lineup-feedback');
    const formatStatus=r=>r.starter_ind?'<span class="coach-starter">Starter</span>':'<span class="coach-backup">Roster</span>';
    const renderRoster=()=>{
      const shown=roster.filter(r=>rosterMode==='full'||r.starter_ind);
      rosterPanel.innerHTML=shown.length?`<div class="table-wrap"><table class="coach-live-table"><thead><tr><th>Weight</th><th>Wrestler</th><th>Year</th><th>Status</th><th>W–L</th><th>State rank</th>${rosterMode==='full'?'<th>Starting lineup</th>':''}</tr></thead><tbody>${shown.map(r=>{
        const id=safeGuid(r.wrestler_guid);
        const group=roster.filter(w=>w.weight_class_code===r.weight_class_code);
        const current=group.find(w=>w.starter_ind);
        const changeable=!!id&&!!current&&!r.starter_ind;
        return `<tr><td>${escape(r.weight_class_code||'—')}</td><td>${id?`<a class="wrestler-link" href="coach-wrestler.html?wrestler=${encodeURIComponent(id)}">${escape(r.wrestler_name||'Unknown')}</a>`:escape(r.wrestler_name||'Unknown')}<small class="coach-roster-state"> · ${escape(r.hometown_state_code||String(r.hometown_display||'').split(',').pop().trim().toUpperCase().match(/^[A-Z]{2}$/)?.[0]||'—')}</small></td><td>${escape(r.eligibility_year_display||'—')}</td><td>${formatStatus(r)}</td><td>${Number(r.win_qty||0)}–${Number(r.loss_qty||0)}</td><td>${r.state_weight_rank?'#'+escape(r.state_weight_rank):'—'}</td>${rosterMode==='full'?`<td>${r.starter_ind?'<span class="coach-current-pick">Selected</span>':changeable?`<button class="coach-select-starter" type="button" data-wrestler="${id}" ${saving?'disabled':''}>Make Starter</button>`:'—'}</td>`:''}</tr>`;
      }).join('')}</tbody></table></div>`:empty('No roster records were returned.');
      document.getElementById('roster-full').classList.toggle('active',rosterMode==='full');
      document.getElementById('roster-starters').classList.toggle('active',rosterMode==='starters');
      document.getElementById('roster-full').setAttribute('aria-pressed',String(rosterMode==='full'));
      document.getElementById('roster-starters').setAttribute('aria-pressed',String(rosterMode==='starters'));
    };
    document.getElementById('roster-full').addEventListener('click',()=>{rosterMode='full';renderRoster();});
    document.getElementById('roster-starters').addEventListener('click',()=>{rosterMode='starters';renderRoster();});
    rosterPanel.addEventListener('click',async ev=>{
      const button=ev.target.closest('.coach-select-starter');if(!button||saving)return;
      const selected=roster.find(r=>r.wrestler_guid===button.dataset.wrestler);
      const previous=roster.find(r=>r.starter_ind&&r.weight_class_code===selected?.weight_class_code);
      if(!selected||!previous||!window.confirm(`Replace ${previous.wrestler_name} with ${selected.wrestler_name} as the ${selected.weight_class_code} starter?`))return;
      saving=true;feedback.textContent='Saving lineup change…';renderRoster();
      try{
        const {error}=await auth.client.rpc('set_my_college_starter_v4_2_1',{p_wrestler_guid:selected.wrestler_guid});
        if(error)throw error;
        const {data:updated,error:loadError}=await auth.client.rpc('get_my_coaching_dashboard_v4_2_0');
        if(loadError)throw loadError;
        roster.splice(0,roster.length,...(Array.isArray(updated?.roster)?updated.roster:[]));
        document.querySelector('.coach-summary-grid article:nth-child(2) strong').textContent=roster.filter(r=>r.starter_ind).length;
        feedback.textContent=`Starting lineup saved: ${selected.wrestler_name} at ${selected.weight_class_code}.`;
      }catch(e){feedback.textContent=`Could not save the starting lineup: ${e.message||'Please try again.'}`;}
      finally{saving=false;renderRoster();}
    });
    renderRoster();
  }catch(err){error(`The coaching dashboard could not be loaded: ${err?.message||'Unexpected error'}`);}
})();
