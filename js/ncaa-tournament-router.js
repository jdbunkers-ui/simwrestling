/* Preserve legacy tournaments, route NCAA V2 tournaments to the new viewer. */
(async function () {
  'use strict';
  const guid=new URLSearchParams(location.search).get('tournament');
  let isNcaa=false;
  if(guid && /^[0-9a-f-]{36}$/i.test(guid)){
    const config=window.SIM_WRESTLING_CONFIG||{};
    let token=null;
    try{
      if(window.SimAuth?.ready){const {client}=await SimAuth.ready;const {data}=await client.auth.getSession();token=data?.session?.access_token||null;}
      const response=await fetch(`${String(config.supabaseUrl).replace(/\/$/,'')}/rest/v1/rpc/get_ncaa_tournament_payload_v2`,{
        method:'POST',headers:{apikey:config.supabasePublishableKey,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({p_tournament_guid:guid})
      });
      if(response.ok){const payload=await response.json();isNcaa=payload?.version==='NCAA_V2' && Array.isArray(payload?.matches) && payload.matches.length>0;}
    }catch(_){/* The legacy page remains available. */}
  }
  if(isNcaa){location.replace(`ncaa-bracket.html?tournament=${encodeURIComponent(guid)}`);return;}
  const script=document.createElement('script');script.src='js/tournament.js?v=6.0.8';document.body.appendChild(script);
})();
