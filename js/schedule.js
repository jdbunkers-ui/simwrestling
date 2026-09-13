(async function () {
  const root=document.getElementById('schedule-root');
  const clockPanel=document.getElementById('league-clock');
  const rail=document.getElementById('week-rail');
  const levelFilter=document.getElementById('schedule-level');
  const stateFilter=document.getElementById('schedule-state');
  const seasonLabel=document.getElementById('schedule-season');
  if (!SimSite.configuredOrMessage(root)) return;
  const e=SimSite.escape;
  const statusClass=(value)=>`status-${String(value||'SCHEDULED').toLocaleLowerCase().replaceAll('_','-')}`;
  let rows=[];
  let geography=[];
  let clock=null;
  let selectedWeek=Number(SimSite.query('week'))||0;

  function stateApplies(row) {
    if (stateFilter.value==='ALL') return true;
    return Array.isArray(row.applicable_state_codes)
      ? row.applicable_state_codes.map((value)=>String(value).trim()).includes(stateFilter.value)
      : true;
  }
  function matches(row) {
    return (levelFilter.value==='ALL'||row.competition_level===levelFilter.value) && stateApplies(row);
  }
  function renderClock() {
    if (!clock) { clockPanel.innerHTML='<div class="clock-copy"><div><span>Season status</span><strong>Schedule available</strong></div></div>'; return; }
    clockPanel.innerHTML=`<div class="clock-copy"><div><span>${e(SimSite.seasonLabel(clock))}</span><strong>Week ${clock.current_week_number} · ${e(clock.current_day_name)}</strong></div><p>League date <b>${e(SimSite.date(clock.current_league_date,true))}</b></p></div><div class="season-progress" aria-label="Week ${clock.current_week_number} of 8"><i style="width:${Math.min(100,Number(clock.current_week_number||1)*12.5)}%"></i></div>`;
  }
  function renderRail() {
    rail.innerHTML=Array.from({length:8},(_,index)=>index+1).map((week)=>{
      const qty=rows.filter((row)=>Number(row.week_number)===week&&matches(row)).length;
      return `<button type="button" data-week="${week}" class="${week===selectedWeek?'active ':''}${clock&&Number(clock.current_week_number)===week?'current':''}"><span>Week ${week}</span><small>${qty} listing${qty===1?'':'s'}</small></button>`;
    }).join('');
    rail.querySelectorAll('button').forEach((button)=>button.addEventListener('click',()=>{selectedWeek=Number(button.dataset.week);renderRail();render();}));
  }
  function card(row) {
    const status=`<span class="event-status ${statusClass(row.event_status)}">${e(SimSite.resultLabel(row.event_status))}</span>`;
    const type=row.tournament_type_label?`<span class="schedule-type-badge">${e(row.tournament_type_label)}</span>`:'';
    const body=`${status}${type}<strong>${e(row.event_name)}</strong><i aria-hidden="true">${row.scheduled_event_guid?'→':''}</i>`;
    return row.scheduled_event_guid
      ? `<a class="calendar-event summary-event" href="${SimSite.eventUrl(row.scheduled_event_guid)}">${body}</a>`
      : `<article class="calendar-event summary-event nonlink-event">${body}</article>`;
  }
  function render() {
    SimSite.syncFilters({week:selectedWeek,level:levelFilter.value,state:stateFilter.value});
    const visible=rows.filter((row)=>Number(row.week_number)===selectedWeek&&matches(row));
    if (!visible.length) { root.innerHTML='<div class="state-card"><strong>No schedule listings match these filters.</strong><p>Choose another week, level, or state.</p></div>'; return; }
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
    const states=[...new Set(geography.map((row)=>String(row.state_code||'').trim()).filter(Boolean))].sort();
    stateFilter.innerHTML='<option value="ALL">All states</option>'+states.map((state)=>`<option value="${e(state)}">${e(state)}</option>`).join('');
    const requestedState=String(SimSite.query('state')||'ALL').toUpperCase();
    stateFilter.value=states.includes(requestedState)?requestedState:'ALL';
    selectedWeek=selectedWeek>=1&&selectedWeek<=8?selectedWeek:Number(clock?.current_week_number||1);
    seasonLabel.textContent=`Season ${rows[0].game_season_number}`;
    renderClock();renderRail();render();
    levelFilter.addEventListener('change',()=>{renderRail();render();});
    stateFilter.addEventListener('change',()=>{renderRail();render();});
  } catch (error) {
    SimSite.showError(root,error.message);clockPanel.hidden=true;rail.hidden=true;
  }
})();
