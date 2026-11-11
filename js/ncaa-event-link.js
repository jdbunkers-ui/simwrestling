/* Add an NCAA V2 bracket/PDF link to the existing weight-class event picker.
   A valid authorized NCAA V2 payload must exist before a link is shown. */
(async function () {
  'use strict';
  const params=new URLSearchParams(location.search);
  const eventGuid=params.get('event');
  if(!eventGuid || !window.SimApi) return;
  let divisions=[];
  try { divisions=await SimApi.scheduledDivisions(eventGuid); } catch (_) {return;}
  let serial=0;
  async function maybeLink(){
    const detail=document.getElementById('division-detail');
    const active=document.querySelector('[data-division].active');
    if(!detail || !active || !detail.querySelector('.division-summary'))return;
    const division=divisions.find(d=>String(d.scheduled_event_division_guid)===active.dataset.division);
    if(!division?.tournament_guid || detail.querySelector('.ncaa-bracket-link'))return;
    const request=++serial;
    const cfg=window.SIM_WRESTLING_CONFIG||{};
    let token=null;
    try {
      if(window.SimAuth?.ready){const {client}=await SimAuth.ready;const {data}=await client.auth.getSession();token=data?.session?.access_token||null;}
      const res=await fetch(`${String(cfg.supabaseUrl).replace(/\/$/,'')}/rest/v1/rpc/get_ncaa_tournament_payload_v2`,{
        method:'POST',headers:{apikey:cfg.supabasePublishableKey,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},
        body:JSON.stringify({p_tournament_guid:division.tournament_guid})
      });
      if(!res.ok)return;
      const payload=await res.json();
      if(request!==serial || !payload?.matches?.length || !payload?.tournament)return;
      if(document.querySelector('[data-division].active')?.dataset.division!==active.dataset.division)return;
      const link=document.createElement('a');link.className='secondary-button ncaa-bracket-link';
      link.href=`ncaa-bracket.html?tournament=${encodeURIComponent(division.tournament_guid)}`;
      link.textContent='View NCAA Bracket / Download PDF';
      detail.querySelector('.division-summary')?.append(link);
    }catch(_){/* Unauthorized or unsupported tournaments retain existing display. */}
  }
  let scheduled=false;
  const observer=new MutationObserver(()=>{
    if(scheduled)return;scheduled=true;
    setTimeout(()=>{scheduled=false;maybeLink();},80);
  });
  const root=document.getElementById('event-root');if(root)observer.observe(root,{childList:true,subtree:true});
  maybeLink();
})();
