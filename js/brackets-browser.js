/* NCAA V2 bracket browser. Public schedule metadata only; wrestler entries stay behind the NCAA V2 RPC. */
(function () {
  'use strict';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const validGuid = v => /^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(String(v || ''));
  const weightOrder = ['106','113','120','125','126','132','133','138','141','144','149','150','157','165','174','175','184','190','197','215','HWT'];
  const fmtDate = row => {
    const d = row.starts_on || row.scheduled_date || '';
    return window.SimSite?.gameDate ? SimSite.gameDate(d,true) : String(d).slice(0,10);
  };
  const levelOf = row => String(row.competition_level || (String(row.event_type||'').startsWith('HS_')?'HIGH_SCHOOL':'COLLEGE')).toUpperCase();
  const isTournament = row => /CHAMPIONSHIP|CIRCUIT|INDIVIDUAL|TOURNAMENT/i.test(String(row.event_type||'')+' '+String(row.format_code||''));
  const safeUrl = guid => `ncaa-bracket.html?tournament=${encodeURIComponent(guid)}`;

  async function mount(host, options={}) {
    if (!host) return;
    const generation = Symbol('bracket-browser');
    host.__ncaaGeneration = generation;
    const fixedLevel = options.level === 'HIGH_SCHOOL' ? 'HIGH_SCHOOL' : null;
    let level = fixedLevel || (new URLSearchParams(location.search).get('level') === 'HIGH_SCHOOL' ? 'HIGH_SCHOOL' : 'COLLEGE');
    let all=[],selected=null,serial=0;
    host.innerHTML='<section class="ncaa-browser"><p class="ncaa-browser-summary">Loading tournament schedule…</p></section>';
    try {
      if(!window.SimApi?.isConfigured()) throw Error('Supabase is not configured.');
      const data = await SimApi.leagueCalendar();
      if(host.__ncaaGeneration !== generation)return;
      all=(Array.isArray(data)?data:[]).filter(row => validGuid(row.scheduled_event_guid) && isTournament(row));
    } catch(err) {
      if(host.__ncaaGeneration === generation) host.innerHTML=`<section class="ncaa-browser"><h2>Brackets</h2><p class="ncaa-browser-empty">Unable to load the tournament schedule: ${esc(err.message)}</p></section>`;
      return;
    }
    function scoped(){return all.filter(r=>levelOf(r)===level);}
    function draw(){
      const events=scoped();
      const states=[...new Set(events.map(r=>String(r.state_code||'').trim()).filter(Boolean))].sort();
      host.innerHTML=`<section class="ncaa-browser">
        <div class="ncaa-browser-head"><p class="eyebrow">Season 5+ · NCAA V2</p><h2>${fixedLevel?'HS Brackets':'Tournament Brackets'}</h2><p>Browse scheduled tournaments and select a weight class to view its bracket or export a PDF.</p></div>
        <div class="ncaa-browser-filters">
          ${fixedLevel?'':`<label>Competition<select data-ncaa-filter="level"><option value="COLLEGE" ${level==='COLLEGE'?'selected':''}>College</option><option value="HIGH_SCHOOL" ${level==='HIGH_SCHOOL'?'selected':''}>High School</option></select></label>`}
          <label>State<select data-ncaa-filter="state"><option value="">All states</option>${states.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('')}</select></label>
          <label>Find tournament<input data-ncaa-filter="search" type="search" placeholder="County, state, event…"></label>
        </div>
        <p class="ncaa-browser-summary" id="ncaa-browser-summary"></p>
        <div class="ncaa-browser-events" id="ncaa-browser-events"></div>
        <div id="ncaa-browser-selected"></div>
        ${level==='HIGH_SCHOOL'?'<p class="ncaa-browser-note">High-school wrestler names and brackets require an authenticated coach with scouting coverage for that event and weight. Unavailable brackets stay protected.</p>':''}
      </section>`;
      const state=host.querySelector('[data-ncaa-filter="state"]');
      const search=host.querySelector('[data-ncaa-filter="search"]');
      host.querySelector('[data-ncaa-filter="level"]')?.addEventListener('change',ev=>{level=ev.target.value;selected=null;draw();});
      state.addEventListener('change',list);
      search.addEventListener('input',list);
      list();
    }
    function list(){
      const state=host.querySelector('[data-ncaa-filter="state"]')?.value||'';
      const q=(host.querySelector('[data-ncaa-filter="search"]')?.value||'').trim().toLowerCase();
      const rows=scoped().filter(r=>(!state||String(r.state_code).trim()===state)&&(!q||String(r.event_name||r.tournament_name||'').toLowerCase().includes(q)));
      const limited=rows.slice(0,120);
      const summary=host.querySelector('#ncaa-browser-summary');
      if(summary)summary.textContent=`${rows.length} matching scheduled tournament events${rows.length>limited.length?' · first 120 displayed':''}`;
      const out=host.querySelector('#ncaa-browser-events');
      if(!out)return;
      out.innerHTML=limited.length ? limited.map(r=>`<button type="button" class="ncaa-event-choice" data-ncaa-event="${esc(r.scheduled_event_guid)}" aria-expanded="${String(selected===r.scheduled_event_guid)}"><span><strong>${esc(r.event_name||'Tournament')}</strong><small>${esc(String(r.state_code||'').trim())} · ${esc(fmtDate(r))}</small></span><span>Weights ›</span></button>`).join(''):'<div class="ncaa-browser-empty">No tournament events match these filters.</div>';
      out.querySelectorAll('[data-ncaa-event]').forEach(b=>b.addEventListener('click',()=>void choose(b.dataset.ncaaEvent)));
    }
    async function choose(id){
      selected=id;const request=++serial;
      const target=host.querySelector('#ncaa-browser-selected');
      if(!target)return;
      list();
      target.innerHTML='<p class="ncaa-browser-summary">Loading weight-class divisions…</p>';
      try{
        const divisions=await SimApi.scheduledDivisions(id);
        if(host.__ncaaGeneration!==generation||request!==serial||selected!==id)return;
        const rows=(Array.isArray(divisions)?divisions:[]).slice().sort((a,b)=>weightOrder.indexOf(String(a.weight_class_code))-weightOrder.indexOf(String(b.weight_class_code)));
        const event=all.find(e=>e.scheduled_event_guid===id);
        target.innerHTML=`<section class="panel section-block"><h3>${esc(event?.event_name||'Tournament')} — Weight classes</h3>
        <p>Brackets become available after initialization. A protected high-school bracket requires the correct scouting coverage.</p>
        ${rows.length?`<div class="ncaa-weights">${rows.map(row=>`<div class="ncaa-weight-card"><strong>${esc(row.weight_class_code||'—')} lb</strong><small>${Number(row.entrant_qty||0)} entrants · ${esc(row.division_status||'Scheduled')}</small>${validGuid(row.tournament_guid)?`<a href="${safeUrl(row.tournament_guid)}">View bracket / PDF</a>`:'<small>Bracket not initialized yet</small>'}</div>`).join('')}</div>`:'<p class="ncaa-browser-empty">No weight-class divisions are available for this tournament yet.</p>'}
        <p><a href="event.html?event=${encodeURIComponent(id)}">View full tournament event</a></p></section>`;
        target.scrollIntoView({block:'nearest',behavior:'smooth'});
      }catch(err){if(request===serial && host.__ncaaGeneration===generation)target.innerHTML=`<p class="ncaa-browser-empty">Could not load tournament weights: ${esc(err.message)}</p>`;}
    }
    draw();
  }
  window.SimNcaaBracketBrowser={mount};
  const host=document.getElementById('brackets-root');
  if(host)void mount(host);
})();
