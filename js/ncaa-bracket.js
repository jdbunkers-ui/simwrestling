/* NCAA V2 read-only bracket / PDF viewer. Never advances the league clock. */
(async function () {
  'use strict';
  const root = document.getElementById('ncaa-bracket-root');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const guid = new URLSearchParams(location.search).get('tournament');
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(guid || '')) { root.innerHTML = '<div class="state-card">Invalid tournament URL. <a href="schedule.html">Return to schedule</a>.</div>'; return; }
  const cfg = window.SIM_WRESTLING_CONFIG || {};
  if (!window.SimApi?.isConfigured()) { SimSite.showError(root, 'Supabase configuration unavailable.'); return; }
  let payload;
  try {
    let token = null;
    if (window.SimAuth?.ready) {
      try {
        const {client} = await window.SimAuth.ready;
        const {data} = await client.auth.getSession();
        token = data?.session?.access_token || null;
      } catch (_) { /* Anonymous college access remains possible. */ }
    }
    const res = await fetch(`${String(cfg.supabaseUrl).replace(/\/$/,'')}/rest/v1/rpc/get_ncaa_tournament_payload_v2`, {
      method: 'POST', cache:'no-store', headers: {
        'apikey':cfg.supabasePublishableKey,
        'Content-Type':'application/json',
        ...(token ? {'Authorization':`Bearer ${token}`} : {})
      }, body: JSON.stringify({p_tournament_guid:guid})
    });
    if (!res.ok) throw new Error('Could not load this tournament.');
    payload = await res.json();
    if (!payload?.tournament || payload.version !== 'NCAA_V2' || !Array.isArray(payload.matches) || !payload.matches.length) {
      throw new Error('This NCAA V2 bracket is unavailable or your account does not have coverage for this event and weight.');
    }
  } catch (error) { SimSite.showError(root, error.message); return; }

  const t = payload.tournament;
  const entries = new Map((payload.entries || []).map(e => [Number(e.seed_number),e]));
  const byGuid = new Map((payload.entries || []).map(e => [String(e.wrestler_guid),e]));
  const matches = payload.matches.slice().sort((a,b) => Number(a.display_order)-Number(b.display_order));
  const rounds = {CHAMPIONSHIP:[],CONSOLATION:[],PLACEMENT:[]};
  const friendly = (code) => ({R64:'Round of 64',R32:'Round of 32',R16:'Round of 16',QF:'Quarterfinals',SF:'Semifinals',FINAL:'Championship',CONS_R1:'Wrestlebacks 1',CONS_R2:'Wrestlebacks 2',CONS_R3:'Wrestlebacks 3',CONS_R4:'Wrestlebacks 4',CONS_R5:'Wrestlebacks 5',CONS_R6:'Wrestlebacks 6',CONS_QF:'Consolation QF',CONS_SF:'Consolation SF',THIRD_PLACE:'3rd Place',FIFTH_PLACE:'5th Place',SEVENTH_PLACE:'7th Place'}[code] || code.replaceAll('_',' '));
  matches.forEach(m => {
    const side = rounds[m.bracket_side] ? m.bracket_side : 'PLACEMENT';
    let round = rounds[side].find(r => r.code === m.round_code);
    if (!round) {round={code:m.round_code,number:m.round_number,matches:[]};rounds[side].push(round);}
    round.matches.push(m);
  });
  // A SEED input resolves from the frozen entry list, not from the currently null participant GUID.
  function slot(m, pos) {
    const inp = (m.inputs||[]).find(i => Number(i.position) === pos);
    const resolvedGuid = m[`participant_${pos}_wrestler_guid`];
    if (resolvedGuid) {
      const e=byGuid.get(String(resolvedGuid));
      return {name:e?.wrestler_name || 'Wrestler',seed:e?.seed_number,team:e?.team_name || '',guid:resolvedGuid,won:m.winner_wrestler_guid === resolvedGuid};
    }
    if (inp?.source_type === 'SEED') {
      const e=entries.get(Number(inp.seed_number));
      return e ? {name:e.wrestler_name,seed:e.seed_number,team:e.team_name || '',guid:e.wrestler_guid,won:false}
        : {name:'BYE',seed:null,team:'',guid:null,won:false};
    }
    if (inp?.source_type === 'BYE') return {name:'BYE',seed:null,team:'',guid:null,won:false};
    return {name:`${inp?.source_type === 'LOSER' ? 'Loser' : 'Winner'} of ${inp?.source_match_code || '?'}`,seed:null,team:'',guid:null,won:false};
  }
  function matchHTML(m) {
    const slots=[slot(m,1),slot(m,2)];
    return `<article class="ncaa-match"><header><span>${esc(m.match_code)}</span><span>${esc(m.match_status)}</span></header>${slots.map(s=>`<div class="ncaa-slot ${s.won?'winner':''}"><strong>${s.seed ? '#'+esc(s.seed)+' ':''}${esc(s.name)}</strong>${s.team?`<small>${esc(s.team)}</small>`:''}</div>`).join('')}${m.completed_bout_guid?`<div class="ncaa-slot"><a href="${SimSite.matchUrl(m.completed_bout_guid,`ncaa-bracket.html?tournament=${guid}`)}">Bout details</a></div>`:''}</article>`;
  }
  const title=t.tournament_name||'NCAA V2 Tournament';
  document.title=title+' | Sim Wrestling';
  root.innerHTML=`<section class="ncaa-header"><div><p class="eyebrow">NCAA V2 · Season 5+</p><h1>${esc(title)}</h1><p class="ncaa-info">${(payload.entries||[]).length} wrestlers · ${matches.length} bracket matches · ${esc(t.processing_status||'PENDING')}</p></div><div class="ncaa-actions"><button class="ncaa-button" id="ncaa-pdf" type="button">Download PDF</button><button class="ncaa-button" id="ncaa-print" type="button">Print bracket</button><a class="ncaa-button" href="schedule.html">Return to schedule</a></div></section><nav class="ncaa-tabs" aria-label="Bracket sections">${['CHAMPIONSHIP','CONSOLATION','PLACEMENT'].map((side,i)=>`<button type="button" class="ncaa-button ncaa-tab" data-side="${side}" aria-selected="${i===0}">${side==='CONSOLATION'?'Wrestlebacks':side[0]+side.slice(1).toLowerCase()}</button>`).join('')}</nav><section class="ncaa-scroll" id="ncaa-bracket-display"></section><p class="ncaa-info">Pending match slots show their source match until the wrestlers advance. PDFs reflect the state at download time.</p>`;
  let selected='CHAMPIONSHIP';
  const target=document.getElementById('ncaa-bracket-display');
  function render(){target.innerHTML=`<div class="ncaa-columns">${rounds[selected].map(r=>`<section class="ncaa-round"><h2>${esc(friendly(r.code))}</h2>${r.matches.map(matchHTML).join('')}</section>`).join('')}</div>`;}
  document.querySelectorAll('.ncaa-tab').forEach(b=>b.addEventListener('click',()=>{selected=b.dataset.side;document.querySelectorAll('.ncaa-tab').forEach(x=>x.setAttribute('aria-selected',String(x===b)));render();}));
  document.getElementById('ncaa-print').addEventListener('click',()=>window.print());
  render();

  // PDF export is on demand. No PDFs or proprietary wrestler data are stored publicly.
  async function getPdfLibrary(){
    if(window.jspdf?.jsPDF) return window.jspdf.jsPDF;
    await new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      script.onload=resolve;script.onerror=()=>reject(new Error('PDF library unavailable; use Print bracket and Save as PDF.'));
      document.head.appendChild(script);
    });
    if (!window.jspdf?.jsPDF) throw Error('PDF library failed to initialize.');
    return window.jspdf.jsPDF;
  }
  document.getElementById('ncaa-pdf').addEventListener('click',async (ev)=>{
    const btn=ev.currentTarget;btn.disabled=true;btn.textContent='Building PDF…';
    try {
      const JsPDF=await getPdfLibrary();
      const doc=new JsPDF({orientation:'landscape',unit:'pt',format:'a3'});
      const W=doc.internal.pageSize.getWidth(),H=doc.internal.pageSize.getHeight(),margin=36;
      let page=0;
      const line=(text,max)=>doc.splitTextToSize(String(text||''),max)[0]||'';
      function newPage(side,code,from,to){
        if(page++)doc.addPage();doc.setTextColor(22,48,67);doc.setFont('helvetica','bold');doc.setFontSize(15);
        doc.text('SIM WRESTLING · NCAA V2',margin,35);doc.setFontSize(11);
        doc.text(line(title,W-2*margin),margin,53);doc.setFont('helvetica','normal');doc.setFontSize(9);
        doc.text(`${side} · ${friendly(code)} · Matches ${from}-${to}`,margin,69);
        doc.setDrawColor(180,192,204);doc.line(margin,77,W-margin,77);
      }
      // Paginate each round into readable 2-column sheets; no overflowing tiny text for 64 fields.
      for (const side of ['CHAMPIONSHIP','CONSOLATION','PLACEMENT']) for (const round of rounds[side]) {
        const group=round.matches;
        const perPage=16, perCol=8;
        for (let start=0;start<group.length;start+=perPage){
          const chunk=group.slice(start,start+perPage);newPage(side,round.code,start+1,start+chunk.length);
          const boxW=(W-margin*3)/2,boxH=74,gap=8;
          chunk.forEach((m,i)=>{
            const col=Math.floor(i/perCol),row=i%perCol,x=margin+col*(boxW+margin),y=94+row*(boxH+gap);
            doc.setDrawColor(130,145,155);doc.rect(x,y,boxW,boxH);
            doc.setFillColor(32,75,106);doc.rect(x,y,boxW,18,'F');doc.setTextColor(255,255,255);
            doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text(`${m.match_code}  |  ${m.match_status}`,x+7,y+12);
            [slot(m,1),slot(m,2)].forEach((s,k)=>{
              const sy=y+35+k*20;doc.setTextColor(s.won?14:31,s.won?113:47,s.won?40:63);
              doc.setFont('helvetica',s.won?'bold':'normal');doc.setFontSize(10);
              doc.text(line(`${s.seed?'#'+s.seed+' ':''}${s.name}${s.team?' · '+s.team:''}`,boxW-14),x+7,sy);
            });
          });
        }
      }
      const file=title.replace(/[^a-z0-9_-]+/gi,'_').slice(0,65)||'Tournament';
      doc.save(`${file}_NCAA_V2_Bracket.pdf`);
    }catch(err){alert(err.message+' You can also use Print bracket → Save as PDF.');}
    finally{btn.disabled=false;btn.textContent='Download PDF';}
  });
})();
