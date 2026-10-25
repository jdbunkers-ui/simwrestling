/* Sim Wrestling v5.0.8 — private coaching context, shared Wall of Fame renderer. */
(async function(){
  'use strict';
  const root=document.getElementById('coach-history-root');
  if(!root)return;
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const validGuid=value=>/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(String(value||''));
  try{
    const auth=await window.SimAuth.ready;
    const {data:{user},error:userError}=await auth.client.auth.getUser();
    if(userError||!user)throw new Error('Please sign in to view your college’s Wall of Fame.');
    // Private coaching identity still resolves from the coach's actual assignment, never an arbitrary URL.
    const {data:team,error:teamError}=await auth.client.rpc('get_my_coaching_dashboard_v4_2_0');
    if(teamError)throw teamError;
    if(!validGuid(team?.team_guid))throw new Error('No active college is associated with this account. Select a college from My Account.');
    const [identity,historyResult]=await Promise.all([
      CoachIdentityBanner.load(auth.client,team.team_guid),
      auth.client.rpc('get_team_wall_of_fame_v1',{p_team_guid:team.team_guid})
    ]);
    if(historyResult.error)throw historyResult.error;
    const archive=historyResult.data;
    if(!archive||!Array.isArray(archive.seasons)||String(archive.team_guid)!==String(team.team_guid))throw new Error('The history service returned an unexpected response.');
    const name=String(identity?.display_name||team.team_name||'College');
    document.title=`${name} — Wall of Fame | Sim Wrestling`;
    root.innerHTML=`${CoachIdentityBanner.render({identity,teamName:team.team_name,context:'PROGRAM LEGACY',detail:'Season-by-season history and graduating seniors'})}
      <nav class="coach-subnav" aria-label="Private coaching pages"><a href="coach.html">Team</a><a href="coach-recruiting.html">Recruits</a><a href="coach-matches.html">Schedule</a><a href="coach-history.html" class="active" aria-current="page">Wall of Fame</a><a href="coach-identity.html">Identity</a><a href="team-wall.html?team=${encodeURIComponent(team.team_guid)}">Team Wall</a></nav>
      <div id="coach-wall-of-fame-view"></div>`;
    CoachIdentityBanner.apply(root,identity);
    SimWallOfFame.mount(root.querySelector('#coach-wall-of-fame-view'),archive,identity);
  }catch(error){
    console.error('Wall of Fame failed:',error);
    root.innerHTML=`<section class="panel coach-gate"><h1>Wall of Fame unavailable</h1><p>${escape(error?.message||'Unable to load your college history.')}</p><p><a href="coach.html">Return to Coaching</a> · <a href="account.html">My Account</a> · <a href="login.html">Sign in</a></p></section>`;
  }
})();
