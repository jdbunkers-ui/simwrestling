(async function () {
  const root=document.getElementById('schedule-root');
  const clockPanel=document.getElementById('league-clock');
  const rail=document.getElementById('week-rail');
  const levelFilter=document.getElementById('schedule-level');
  const regionFilter=document.getElementById('schedule-region');
  const seasonLabel=document.getElementById('schedule-season');
  if (!SimSite.configuredOrMessage(root)) return;
  const e=SimSite.escape;
  const statusClass=(value)=>`status-${String(value||'SCHEDULED').toLocaleLowerCase().replaceAll('_','-')}`;
  let rows=[];
  let geography=[];
  let regionStates=new Map();
  let clock=null;
  let selectedWeek=Number(SimSite.query('week'))||0;

  function regionApplies(row) {
    if (regionFilter.value==='ALL') return true;
    if (String(row.region_code||'').trim()===regionFilter.value) return true;
    return Array.isArray(row.applicable_state_codes)
      ? row.applicable_state_codes.some((value)=>regionStates.get(regionFilter.value)?.has(String(value).trim().toUpperCase()))
      : true;
  }
  function matches(row) {
    return (levelFilter.value==='ALL'||row.competition_level===levelFilter.value) && regionApplies(row);
  }
  function renderClock() {
    if (!clock) { clockPanel.innerHTML='<div class="clock-copy"><div><span>Season status</span><strong>Schedule available</strong></div></div>'; return; }
    clockPanel.innerHTML=`<div class="clock-copy"><div><span>${e(SimSite.seasonLabel(clock))}</span><strong>Week ${clock.current_week_number} · ${e(clock.current_day_name)}</strong></div></div><div class="season-progress" aria-label="Week ${clock.current_week_number} of 8"><i style="width:${Math.min(100,Number(clock.current_week_number||1)*12.5)}%"></i></div>`;
  }
  function renderRail() {
    rail.innerHTML=Array.from({length:8},(_,index)=>index+1).map((week)=>{
      const qty=rows.filter((row)=>Number(row.week_number)===week&&matches(row)).length;
      return `<button type="button" data-week="${week}" class="${week===selectedWeek?'active ':''}${clock&&Number(clock.current_week_number)===week?'current':''}"><span>Week ${week}</span><small>${qty} listing${qty===1?'':'s'}</small></button>`;
    }).join('');
    rail.querySelectorAll('button').forEach((button)=>button.addEventListener('click',()=>{selectedWeek=Number(button.dataset.week);renderRail();render();}));
  }
  function tournamentType(row) {
    const code=String(row.public_group_code||row.event_type||'').trim().toUpperCase();
    if (code.endsWith('_INDIVIDUAL')||code==='COLLEGE_HOLIDAY_INVITATIONAL') return 'Individual Tournament';
    if (code.endsWith('_DUAL')) return 'Dual Tournament';
    const label=String(row.tournament_type_label||'').trim();
    if (/individual/i.test(label)) return 'Individual Tournament';
    if (/dual/i.test(label)&&/tournament/i.test(label)) return 'Dual Tournament';
    return label;
  }
  function card(row) {
    const status=`<span class="event-status ${statusClass(row.event_status)}">${e(SimSite.resultLabel(row.event_status))}</span>`;
    const typeLabel=tournamentType(row);
    const type=typeLabel?`<span class="schedule-type-badge">${e(typeLabel)}</span>`:'';
    return `<article class="calendar-event summary-event nonlink-event">${status}${type}<strong>${e(row.event_name)}</strong></article>`;
  }
  function render() {
    SimSite.syncFilters({week:selectedWeek,level:levelFilter.value,region:regionFilter.value});
    const visible=rows.filter((row)=>Number(row.week_number)===selectedWeek&&matches(row));
    if (!visible.length) { root.innerHTML='<div class="state-card"><strong>No schedule listings match these filters.</strong><p>Choose another week, level, or region.</p></div>'; return; }
    const dates=[...new Set(visible.map((row)=>row.scheduled_date))].sort();
    root.innerHTML=dates.map((date)=>{
      const dayRows=visible.filter((row)=>row.scheduled_date===date);
      const dayName=new Date(`${date}T12:00:00`).toLocaleDateString(undefined,{weekday:'long'});
      return `<section class="schedule-day"><header><div><p class="eyebrow">${e(dayName)} · ${e(SimSite.date(date,true))}</p><h2>${dayRows.length} schedule listing${dayRows.length===1?'':'s'}</h2></div></header><div class="calendar-event-grid summary-event-grid">${dayRows.map(card).join('')}</div></section>`;
    }).join('');
  }
  try {
    clock=await SimApi.leagueClock();
    [rows,geography]=await Promise.all([SimApi.publicScheduleSummary(clock?.season_guid||''),SimApi.regionStateInventory()]);
    if (!rows.length) throw new Error('No public schedule has been published for the open season.');
    const requestedLevel=String(SimSite.query('level')||'ALL').toUpperCase();
    levelFilter.value=['ALL','HIGH_SCHOOL','COLLEGE'].includes(requestedLevel)?requestedLevel:'ALL';
    const regions=SimSite.inventoryRegions(geography);
    regionStates=new Map(regions.map((region)=>[
      region.code,
      new Set(geography.filter((row)=>String(row.region_code||'').trim()===region.code).map((row)=>String(row.state_code||'').trim().toUpperCase()).filter(Boolean))
    ]));
    regionFilter.innerHTML='<option value="ALL">All regions</option>'+regions.map((region)=>`<option value="${e(region.code)}">${e(region.name)}</option>`).join('');
    const requestedRegion=String(SimSite.query('region')||'ALL').toUpperCase();
    regionFilter.value=regions.some((region)=>region.code===requestedRegion)?requestedRegion:'ALL';
    selectedWeek=selectedWeek>=1&&selectedWeek<=8?selectedWeek:Number(clock?.current_week_number||1);
    seasonLabel.textContent=`Season ${rows[0].game_season_number}`;
    renderClock();renderRail();render();
    levelFilter.addEventListener('change',()=>{renderRail();render();});
    regionFilter.addEventListener('change',()=>{renderRail();render();});
  } catch (error) {
    SimSite.showError(root,error.message);clockPanel.hidden=true;rail.hidden=true;
  }
})();
