/* v4.2.0 Private coaching landing page. No caller-supplied team ID. */
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
    const today=data.current_league_date;
    document.title=`${data.team_name} — Coaching | Sim Wrestling`;
    root.innerHTML=`
      <section class="coach-live-hero"><div><p class="eyebrow">YOUR COLLEGE · CURRENT SEASON</p><h1>${escape(data.team_name)}</h1><p>${escape(data.hometown_city||'')}${data.state_code?', '+escape(data.state_code):''} · ${escape(data.season_code||'Current season')}</p></div><div class="coach-hero-seal" aria-hidden="true">SW</div></section>
      <nav class="coach-subnav" aria-label="Private coaching pages"><a class="active" aria-current="page" href="coach.html">Coaching</a><a href="coach-recruiting.html">Recruiting</a><a href="coach-history.html">Program History</a><a href="coach-forum.html">Coaches Forum</a><a href="account.html">My Account</a></nav>
      <div class="coach-summary-grid"><article><span>Roster</span><strong>${roster.length}</strong><small>Current listed wrestlers</small></article><article><span>Starters</span><strong>${starters}</strong><small>Current starting lineup</small></article><article><span>Upcoming events</span><strong>${schedule.length}</strong><small>Published future schedule entries</small></article><article><span>League date</span><strong class="coach-date">${escape(dateText(today))}</strong><small>Simulated season date</small></article></div>
      <section class="panel coach-live-panel"><div class="panel-heading"><div><p class="eyebrow">CURRENT COLLEGE</p><h2>Roster and starting lineup</h2></div><span class="record-pill">${roster.length} wrestlers</span></div>
      ${roster.length?`<div class="table-wrap"><table class="coach-live-table"><thead><tr><th>Weight</th><th>Wrestler</th><th>Year</th><th>Status</th><th>W–L</th><th>State rank</th></tr></thead><tbody>${roster.map(r=>{
        const id=safeGuid(r.wrestler_guid);
        return `<tr><td>${escape(r.weight_class_code||'—')}</td><td>${id?`<a class="wrestler-link" href="coach-wrestler.html?wrestler=${encodeURIComponent(id)}">${escape(r.wrestler_name||'Unknown')}</a>`:escape(r.wrestler_name||'Unknown')}</td><td>${escape(r.eligibility_year_display||'—')}</td><td>${r.starter_ind?'<span class="coach-starter">Starter</span>':'<span class="coach-backup">Roster</span>'}</td><td>${Number(r.win_qty||0)}–${Number(r.loss_qty||0)}</td><td>${r.state_weight_rank?'#'+escape(r.state_weight_rank):'—'}</td></tr>`;
      }).join('')}</tbody></table></div>`:empty('No current roster records were returned for this college.')}
      <p class="coach-detail-note">Wrestler names open a coach-only profile placeholder. Private wrestler details are not enabled yet.</p></section>
      <section class="panel coach-live-panel"><div class="panel-heading"><div><p class="eyebrow">UP NEXT</p><h2>Upcoming college schedule</h2></div><span class="record-pill">${schedule.length} entries</span></div>
      ${schedule.length?`<div class="table-wrap"><table class="coach-live-table"><thead><tr><th>Date</th><th>Week</th><th>Event</th><th>Opponent / field</th><th>Result</th></tr></thead><tbody>${schedule.slice(0,40).map(s=>`<tr><td>${escape(dateText(s.scheduled_date))}</td><td>${escape(s.week_number??'—')}</td><td>${escape(s.event_name||s.schedule_type||'Event')}</td><td>${escape(s.opponent_or_field||'—')}</td><td>${escape(s.result_display||'Pending')}</td></tr>`).join('')}</tbody></table></div>`:empty('No future events remain on the published schedule.')}</section>
      <section class="coach-future-grid"><article class="panel coach-future"><p class="eyebrow">FUTURE COACHING TOOL</p><h2>Wrestle Off</h2><p>Schedule an internal practice match between two wrestlers from your roster.</p><span class="coach-soon">Under Construction</span></article><article class="panel coach-future"><p class="eyebrow">FUTURE COACHING TOOL</p><h2>Off-Season Training Program</h2><p>Plan individual development and training activities between seasons.</p><span class="coach-soon">Under Construction</span></article></section>
      <p class="coach-detail-note">Current release is read-only. Roster changes, wrestle-offs, off-season training and private wrestler details will follow in later releases.</p>`;
  }catch(err){error(`The coaching dashboard could not be loaded: ${err?.message||'Unexpected error'}`);}
})();
