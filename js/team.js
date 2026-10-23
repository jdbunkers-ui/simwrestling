/* v4.4.8 public college profile: lightweight starters first; lazy Schedule and Wall of Fame. */
(async function () {
 'use strict';
 const root=document.getElementById('team-root');
 const guid=SimSite.query('team');
 if(!guid){SimSite.showError(root,'No team was selected.');return;}
 if(!SimSite.configuredOrMessage(root))return;
 const e=SimSite.escape;
 const year=x=>String(x||'—').replace(/^College\s+/i,'');
 const loading=label=>`<div class="state-card"><p>Loading ${e(label)}…</p></div>`;
 const errorCard=error=>`<div class="state-card"><p>Unable to load this section: ${e(error.message||String(error))}</p></div>`;
 const awardFinish=value=>value?`${value}${Number(value)===1?'st':Number(value)===2?'nd':Number(value)===3?'rd':'th'}`:'—';
 const views={};
 function renderTeam(lineup){
  if(!lineup.length)return '<p class="coach-empty-note">No current starters are available.</p>';
  return `<div class="table-wrap"><table class="coach-live-table"><thead><tr><th>Weight</th><th>Wrestler</th><th>Year</th><th>Status</th><th>W–L</th><th>State rank</th></tr></thead><tbody>${lineup.map(row=>`<tr><td>${e(row.weight_class_code||'—')}</td><td>${row.wrestler_guid?`<a class="wrestler-link" href="${SimSite.profileUrl(row.wrestler_guid)}">${e(row.wrestler_name||row.display_name||'Unknown')}</a>`:e(row.wrestler_name||'Unknown')}</td><td>${e(year(row.eligibility_year_display||row.academic_stage_display))}</td><td><span class="coach-starter">Starter</span></td><td>${Number(row.win_qty||0)}–${Number(row.loss_qty||0)}</td><td>${row.state_weight_rank?'#'+e(row.state_weight_rank):'—'}</td></tr>`).join('')}</tbody></table></div>`;
 }
 function renderSchedule(schedule){
  const items=[...schedule].sort((a,b)=>Number(a.week_number)-Number(b.week_number)||String(a.scheduled_date).localeCompare(String(b.scheduled_date))||Number(a.dual_order||0)-Number(b.dual_order||0));
  if(!items.length)return '<p class="coach-empty-note">No schedule has been published for this college.</p>';
  return `<div class="table-wrap"><table class="coach-live-table"><thead><tr><th>Week / Date</th><th>Event</th><th>Opponent / Field</th><th>Result</th></tr></thead><tbody>${items.map(item=>{const complete=item.result_display&&item.result_display!=='Not Simulated Yet';const href=item.dual_guid?SimSite.dualUrl(item.dual_guid):item.scheduled_event_guid?SimSite.eventUrl(item.scheduled_event_guid):null;return `<tr><td>Week ${e(item.week_number)}<small class="subtext">${e(SimSite.date(item.scheduled_date))}</small></td><td>${e(item.event_name)}</td><td>${e(item.opponent_or_field||'—')}</td><td>${complete&&href?`<a class="table-link" href="${href}">${e(item.result_display)}</a>`:e(item.result_display||'Not Simulated Yet')}</td></tr>`;}).join('')}</tbody></table></div>`;
 }
 function renderFame(awards,seasons,archived,accomplishments){
   const history=archived.length?archived:seasons;
   const awardBlock=awards.length?`<section class="panel coach-live-panel"><div class="panel-heading"><h2>Team Awards</h2></div><div class="public-fame-awards">${awards.map(a=>`<p><strong>${e(a.award_display_text||'Award')}</strong> · ${e(a.event_name||'')} · Season ${e(a.game_season_number||'—')}</p>`).join('')}</div></section>`:'';
   const seasonBlock=`<section class="panel coach-live-panel"><div class="panel-heading"><h2>Season-by-Season Record</h2></div>${history.length?`<div class="table-wrap"><table class="coach-live-table"><thead><tr><th>Season</th><th>Record</th><th>Holiday Tournament</th><th>State Dual</th><th>Regional Dual</th><th>National Dual</th></tr></thead><tbody>${history.map(x=>`<tr><td>Season ${e(x.game_season_number)}</td><td>${e(x.record_display||'—')}</td><td>${awardFinish(x.holiday_tournament_placement)}</td><td>${awardFinish(x.state_dual_finish)}</td><td>${awardFinish(x.regional_dual_finish)}</td><td>${awardFinish(x.national_dual_finish)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="coach-empty-note">No historical seasons available.</p>'}</section>`;
   const honors=['All-State','All-Region','All-American'];
   const honorBlock=`<section class="panel coach-live-panel"><div class="panel-heading"><h2>Individual Accomplishments</h2></div><div class="table-wrap"><table class="coach-live-table"><thead><tr><th>Honor</th><th>1st</th><th>2nd</th><th>3rd</th><th>4th</th><th>5th</th><th>6th</th><th>7th</th><th>8th</th><th>Total</th></tr></thead><tbody>${honors.map(h=>{const x=accomplishments.find(a=>a.achievement_level===h)||{};return `<tr><td>${e(h)}</td>${['first','second','third','fourth','fifth','sixth','seventh','eighth','total'].map(c=>`<td>${Number(x[c+'_qty']||0)}</td>`).join('')}</tr>`;}).join('')}</tbody></table></div></section>`;
   return awardBlock+seasonBlock+honorBlock;
 }
 try {
  const result=await SimApi.publicTeamSnapshot(guid);
  if(!result?.profile)throw Error('The requested college profile was not found.');
  let identity=null;try {identity=await SimApi.collegeIdentity(guid);}catch(err){console.warn('College identity unavailable:',err.message);}
  const p=result.profile,lineup=Array.isArray(result.starting_lineup)?result.starting_lineup:[];
  const abbrev=identity?.abbreviation||String(p.team_name||'').split(/\s+/).map(w=>w[0]).join('').slice(0,3);
  const rank=p.state_team_rank?'#'+e(p.state_team_rank)+' - ':'';
  const record=p.dual_record_display?' ('+e(p.dual_record_display)+')':'';
  document.title=String(identity?.display_name||p.team_name)+' | Sim Wrestling';
  root.classList.add('coach-live-shell');
  root.innerHTML=`<section class="coach-live-hero" id="public-college-identity-hero"><div><p class="eyebrow">COLLEGE · CURRENT SEASON</p><h1>${rank}${e(identity?.display_name||p.team_name)}${record}</h1>${identity?.mascot?`<p>${e(identity.mascot)}</p>`:""}</div><div class="coach-hero-seal" aria-hidden="true">${e(abbrev)}</div></section><nav class="coach-subnav" aria-label="College profile sections"><a href="#team" data-section="team" class="active" aria-current="page">Team</a><a href="#schedule" data-section="schedule">Schedule</a><a href="#fame" data-section="fame">Wall of Fame</a><a href="team-wall.html?team=${encodeURIComponent(guid)}">Team Wall</a></nav><div id="public-team-section" aria-live="polite"></div>`;
  if(identity?.primary_color){const hero=document.getElementById('public-college-identity-hero'),accent=identity.secondary_color||'#E6AD24';hero.style.background=identity.primary_color;hero.querySelector('.eyebrow').style.color=accent;hero.querySelector('.coach-hero-seal').style.color=accent;hero.querySelector('.coach-hero-seal').style.borderColor=accent;}
  const holder=document.getElementById('public-team-section');
  views.team=`<section class="panel coach-live-panel"><div class="panel-heading"><div><p class="eyebrow">CURRENT COLLEGE</p><h2>Roster and starting lineup</h2></div></div>${renderTeam(lineup)}</section>`;
  async function activate(which){
    if(!['team','schedule','fame'].includes(which))which='team';
    root.querySelectorAll('[data-section]').forEach(a=>{const selected=a.dataset.section===which;a.classList.toggle('active',selected);if(selected)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    if(views[which]){holder.innerHTML=views[which];return;}
    holder.innerHTML=loading(which==='fame'?'Wall of Fame':'schedule');
    try {
      if(which==='schedule'){const rows=await SimApi.teamFullSchedule(guid);views.schedule=`<section class="panel coach-live-panel"><div class="panel-heading"><h2>College schedule and results</h2></div>${renderSchedule(rows||[])}</section>`;}
      else {
        const [a,s,h,c]=await Promise.allSettled([SimApi.teamAwards(guid),SimApi.teamSeasonSummary(guid),SimApi.collegeTeamHistory(guid),SimApi.collegeTeamAccomplishments(guid)]);
        const get=x=>x.status==='fulfilled'&&Array.isArray(x.value)?x.value:[];
        views.fame=renderFame(get(a),get(s),get(h),get(c));
        if([a,s,h,c].some(x=>x.status==='rejected'))views.fame+='<p class="coach-empty-note">Some historical records are temporarily unavailable.</p>';
      }
      if(location.hash.slice(1)===which || (!location.hash&&which==='team'))holder.innerHTML=views[which];
    }catch(error){if(location.hash.slice(1)===which)holder.innerHTML=errorCard(error);}
  }
  root.querySelectorAll('[data-section]').forEach(a=>a.addEventListener('click',()=>setTimeout(()=>activate(location.hash.slice(1)),0)));
  window.addEventListener('hashchange',()=>activate(location.hash.slice(1)));
  activate(location.hash.slice(1)||'team');
 }catch(error){SimSite.showError(root,error.message);}
})();
