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
    let decisions=new Map();
    let wrestleOffs=[];
    const loadDecisions=async()=>{const {data:rows,error:e}=await auth.client.rpc('get_my_roster_decisions_v4_4_2');if(e)throw e;decisions=new Map((Array.isArray(rows)?rows:[]).map(x=>[x.wrestler_guid,x.action_code]));};
    const loadWrestleOffs=async()=>{const {data:rows,error:e}=await auth.client.rpc('get_my_wrestle_offs_v4_4_2');if(e)throw e;wrestleOffs=Array.isArray(rows)?rows:[];};
    await Promise.all([loadDecisions(),loadWrestleOffs()]);
    let rosterMode='starters';
    let saving=false;
    const today=data.current_league_date;
    document.title=`${data.team_name} — Coaching | Sim Wrestling`;
    root.innerHTML=`
      <section class="coach-live-hero"><div><p class="eyebrow">YOUR COLLEGE · CURRENT SEASON</p><h1>${escape(data.team_name)}</h1></div><div class="coach-hero-seal" aria-hidden="true">SW</div></section>
      <nav class="coach-subnav" aria-label="Private coaching pages"><a href="coach.html" class="active" aria-current="page">Coach</a><a href="coach-matches.html">Matches</a><a href="coach-recruiting.html">Recruit</a><a href="coach-history.html">Program History</a></nav>
      <section class="panel coach-live-panel"><div class="panel-heading coach-roster-heading"><div><p class="eyebrow">CURRENT COLLEGE</p><h2>Roster and starting lineup</h2></div><div class="coach-roster-switch" role="group" aria-label="Roster view"><button type="button" id="roster-full" aria-pressed="false">Full Roster</button><button type="button" id="roster-starters" class="active" aria-pressed="true">Starters</button></div></div>
      <p id="lineup-feedback" class="coach-lineup-feedback" role="status" aria-live="polite"></p>
      <div id="coaching-roster-table"></div>
      <p class="coach-detail-note">Select a starter in the Full Roster view, then confirm the change. Changes affect future competitions, not completed matches. Wrestler names open their private scouting profiles.</p></section>
      <section class="panel coach-live-panel"><div class="panel-heading"><div><p class="eyebrow">UP NEXT</p><h2>Upcoming college schedule</h2></div><span class="record-pill">${schedule.length} entries</span></div>
      ${schedule.length?`<div class="table-wrap"><table class="coach-live-table"><thead><tr><th>Date</th><th>Week</th><th>Event</th><th>Opponent / field</th><th>Result</th></tr></thead><tbody>${schedule.slice(0,40).map(s=>`<tr><td>${escape(dateText(s.scheduled_date))}</td><td>${escape(s.week_number??'—')}</td><td>${escape(s.event_name||s.schedule_type||'Event')}</td><td>${escape(s.opponent_or_field||'—')}</td><td>${escape(s.result_display||'Pending')}</td></tr>`).join('')}</tbody></table></div>`:empty('No future events remain on the published schedule.')}</section>
      <section class="panel coach-live-panel"><div class="panel-heading"><div><p class="eyebrow">CURRENT SEASON · PRIVATE</p><h2>Wrestle-Offs</h2></div></div><p id="wrestle-feedback" class="coach-lineup-feedback" role="status"></p><div id="wrestle-history"></div><div id="wrestle-pbp" hidden></div></section>
      <section class="coach-future-grid"><article class="panel coach-future"><p class="eyebrow">FUTURE COACHING TOOL</p><h2>Off-Season Training Program</h2><p>Plan individual development and training activities between seasons.</p><span class="coach-soon">Under Construction</span></article></section>`;

    const rosterPanel=document.getElementById('coaching-roster-table');
    const feedback=document.getElementById('lineup-feedback');
    const formatStatus=r=>r.starter_ind?'<span class="coach-starter">Starter</span>':'<span class="coach-backup">Roster</span>';
    const renderRoster=()=>{
      const shown=roster.filter(r=>rosterMode==='full'||r.starter_ind);
      rosterPanel.innerHTML=shown.length?`<div class="table-wrap"><table class="coach-live-table"><thead><tr><th>Weight</th><th>Wrestler</th><th>Year</th><th>Status</th><th>W–L</th><th>State rank</th>${rosterMode==='full'?'<th>Starting lineup</th><th>Move Up</th><th>Release</th><th>Wrestle-Off</th>':''}</tr></thead><tbody>${shown.map(r=>{
        const id=safeGuid(r.wrestler_guid);
        const group=roster.filter(w=>w.weight_class_code===r.weight_class_code);
        const current=group.find(w=>w.starter_ind);
        const changeable=!!id&&!!current&&!r.starter_ind;
        return `<tr><td>${escape(r.weight_class_code||'—')}</td><td>${id?`<a class="wrestler-link" href="coach-wrestler.html?wrestler=${encodeURIComponent(id)}">${escape(r.wrestler_name||'Unknown')}</a>`:escape(r.wrestler_name||'Unknown')}<small class="coach-roster-state"> · ${escape(r.hometown_state_code||String(r.hometown_display||'').split(',').pop().trim().toUpperCase().match(/^[A-Z]{2}$/)?.[0]||'—')}</small></td><td>${escape(r.eligibility_year_display||'—')}</td><td>${formatStatus(r)}</td><td>${Number(r.win_qty||0)}–${Number(r.loss_qty||0)}</td><td>${r.state_weight_rank?'#'+escape(r.state_weight_rank):'—'}</td>${rosterMode==='full'?`<td>${r.starter_ind?'<span class="coach-current-pick">Selected</span>':changeable?`<button class="coach-select-starter" type="button" data-wrestler="${id}" ${saving?'disabled':''}>Make Starter</button>`:'—'}</td><td>${!r.starter_ind&&id&&r.weight_class_code!=='HWT'?`<input type="checkbox" class="coach-decision" aria-label="Move up ${escape(r.wrestler_name)}" data-action="MOVE_UP" data-wrestler="${id}" ${decisions.get(id)==='MOVE_UP'?'checked':''} ${saving?'disabled':''}>`:'—'}</td><td>${!r.starter_ind&&id?`<input type="checkbox" class="coach-decision" aria-label="Release ${escape(r.wrestler_name)}" data-action="RELEASE" data-wrestler="${id}" ${decisions.get(id)==='RELEASE'?'checked':''} ${saving?'disabled':''}>`:'—'}</td><td>${changeable?`<button class="coach-wrestle-action" type="button" data-wrestler="${id}" ${saving||wrestleOffs.some(x=>x.challenger_guid===id&&['SCHEDULED','PROCESSING'].includes(x.status))?'disabled':''}>Wrestle-Off</button>`:'—'}</td>`:''}</tr>`;
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
        await loadDecisions();
        feedback.textContent=`Starting lineup saved: ${selected.wrestler_name} at ${selected.weight_class_code}.`;
      }catch(e){feedback.textContent=`Could not save the starting lineup: ${e.message||'Please try again.'}`;}
      finally{saving=false;renderRoster();}
    });
    const historyPanel=document.getElementById('wrestle-history');
    const historyFeedback=document.getElementById('wrestle-feedback');
    const pbpPanel=document.getElementById('wrestle-pbp');
    const renderHistory=()=>{
      historyPanel.innerHTML=wrestleOffs.length?`<div class="table-wrap"><table class="coach-live-table"><thead><tr><th>League date</th><th>Weight</th><th>Starter</th><th>Challenger</th><th>Status</th><th>Result / PBP</th></tr></thead><tbody>${wrestleOffs.map(x=>`<tr><td>${escape(dateText(x.scheduled_league_date))}</td><td>${escape(x.weight_class)}</td><td>${escape(x.starter_name)}</td><td>${escape(x.challenger_name)}</td><td>${escape(x.status)}</td><td>${x.status==='COMPLETED'?`${escape(x.starter_score)}–${escape(x.challenger_score)} · ${escape(x.result_type||'')} <button type="button" class="coach-pbp-action" data-id="${escape(x.wrestle_off_guid)}">View PBP</button>`:'—'}</td></tr>`).join('')}</tbody></table></div>`:empty('No wrestle-offs scheduled this season. Use the Full Roster view to schedule a backup against the starter.');
    };
    rosterPanel.addEventListener('change',async ev=>{
      const input=ev.target.closest('.coach-decision');if(!input||saving)return;
      const id=input.dataset.wrestler, action=input.checked?input.dataset.action:null;
      saving=true; feedback.textContent='Saving roster decision…';renderRoster();
      try{const {error:e}=await auth.client.rpc('set_my_roster_decision_v4_4_2',{p_wrestler_guid:id,p_action_code:action});if(e)throw e;await loadDecisions();feedback.textContent=action?`${action==='MOVE_UP'?'Move Up':'Release'} saved for next season.`:'Roster decision cleared.';}
      catch(e){feedback.textContent=`Could not save decision: ${e.message||'Please try again.'}`;}
      finally{saving=false;renderRoster();}
    });
    rosterPanel.addEventListener('click',async ev=>{
      const btn=ev.target.closest('.coach-wrestle-action');if(!btn||saving)return;
      const r=roster.find(x=>x.wrestler_guid===btn.dataset.wrestler);
      if(!r||!window.confirm(`Schedule a wrestle-off for ${r.wrestler_name} against the current ${r.weight_class_code} starter on the next league day?`))return;
      saving=true;feedback.textContent='Scheduling wrestle-off…';renderRoster();
      try{const {error:e}=await auth.client.rpc('schedule_my_wrestle_off_v4_4_2',{p_challenger_wrestler_guid:r.wrestler_guid});if(e)throw e;await loadWrestleOffs();renderHistory();feedback.textContent=`Wrestle-off scheduled for ${r.wrestler_name}.`;}
      catch(e){feedback.textContent=`Could not schedule wrestle-off: ${e.message||'Please try again.'}`;}
      finally{saving=false;renderRoster();}
    });
    historyPanel.addEventListener('click',async ev=>{
      const btn=ev.target.closest('.coach-pbp-action');if(!btn)return;
      historyFeedback.textContent='Loading play-by-play…';
      try{const {data:events,error:e}=await auth.client.rpc('get_my_wrestle_off_pbp_v4_4_2',{p_wrestle_off_guid:btn.dataset.id});if(e)throw e;
        const match=wrestleOffs.find(x=>x.wrestle_off_guid===btn.dataset.id);
        const entries=Array.isArray(events)?events:[];
        pbpPanel.hidden=false;
        pbpPanel.innerHTML=`<div class="coach-pbp-head"><h3>${escape(match?.starter_name||'Starter')} vs ${escape(match?.challenger_name||'Challenger')}</h3><button class="coach-pbp-close" type="button">Close PBP</button></div><p><strong>${escape(match?.starter_score)}–${escape(match?.challenger_score)}</strong> · ${escape(match?.result_type||'')}</p><ol class="coach-pbp-feed">${entries.map(x=>`<li><span>${escape(x.segment_code?.replaceAll('_',' ')||'')}</span><strong>${escape(x.starter_score)}–${escape(x.challenger_score)}</strong> ${escape(x.pbp_text||'')}</li>`).join('')}</ol>`;
        historyFeedback.textContent='';pbpPanel.scrollIntoView({behavior:'smooth',block:'nearest'});
      }catch(e){historyFeedback.textContent=`Could not load PBP: ${e.message||'Please try again.'}`;}
    });
    pbpPanel.addEventListener('click',ev=>{if(ev.target.closest('.coach-pbp-close')){pbpPanel.hidden=true;pbpPanel.innerHTML='';}});
    renderRoster();renderHistory();
  }catch(err){error(`The coaching dashboard could not be loaded: ${err?.message||'Unexpected error'}`);}
})();
