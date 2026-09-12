(async function () {
  const root = document.getElementById('schedule-root');
  const clockPanel = document.getElementById('league-clock');
  const rail = document.getElementById('week-rail');
  const levelFilter = document.getElementById('schedule-level');
  const stateFilter = document.getElementById('schedule-state');
  const seasonLabel = document.getElementById('schedule-season');
  if (!SimSite.configuredOrMessage(root)) return;
  const e = SimSite.escape;

  const eventLabels = {
    HS_COUNTY_CIRCUIT: 'County Circuit',
    HS_COUNTY_CHAMPIONSHIP: 'County Championships',
    HS_STATE_CHAMPIONSHIP: 'High School State Championships',
    HS_REGIONAL_CHAMPIONSHIP: 'High School Regional Championships',
    HS_NATIONAL_CHAMPIONSHIP: 'High School National Championships',
    HS_GRADUATION: 'High School Graduation',
    COLLEGE_QUAD: 'College Quads',
    COLLEGE_HOLIDAY_INVITATIONAL: 'Holiday Invitationals',
    COLLEGE_STATE_INDIVIDUAL: 'College State Championships',
    COLLEGE_STATE_DUAL: 'State Dual Team Championships',
    COLLEGE_REGIONAL_INDIVIDUAL: 'Regional Championships',
    COLLEGE_REGIONAL_DUAL: 'Regional Dual Team Championships',
    COLLEGE_NATIONAL_INDIVIDUAL: 'National Championships',
    COLLEGE_NATIONAL_DUAL: 'National Dual Team Championships'
  };
  const labelFor = (row) => eventLabels[row.event_type] || SimSite.resultLabel(row.event_type);
  const statusClass = (value) => `status-${String(value || 'SCHEDULED').toLocaleLowerCase().replaceAll('_', '-')}`;
  let events = [];
  let clock = null;
  let selectedWeek = Number(SimSite.query('week')) || 0;

  function matchesLevelAndState(row) {
    const levelMatches = levelFilter.value === 'ALL' || row.competition_level === levelFilter.value;
    if (!levelMatches) return false;
    if (Array.isArray(row.applicable_state_codes) && row.applicable_state_codes.length === 0) return false;
    if (stateFilter.value === 'ALL') return true;
    if (Array.isArray(row.applicable_state_codes)) {
      return row.applicable_state_codes.includes(stateFilter.value);
    }
    return row.state_code === stateFilter.value;
  }

  function renderClock() {
    if (!clock) {
      clockPanel.innerHTML = '<div class="clock-copy"><div><span>Season status</span><strong>Schedule available</strong></div><p>The live league date has not been initialized.</p></div>';
      return;
    }
    clockPanel.innerHTML = `<div class="clock-copy"><div><span>${e(SimSite.seasonLabel(clock))}</span><strong>Week ${clock.current_week_number} · ${e(clock.current_day_name)}</strong></div><p>League date <b>${e(SimSite.date(clock.current_league_date, true))}</b></p></div><div class="season-progress" aria-label="Week ${clock.current_week_number} of 8"><i style="width:${Math.min(100, Number(clock.current_week_number || 1) * 12.5)}%"></i></div>`;
  }

  function renderRail() {
    rail.innerHTML = Array.from({ length: 8 }, (_, index) => index + 1).map((week) => {
      const qty = events.filter((row) => Number(row.week_number) === week && matchesLevelAndState(row)).length;
      return `<button type="button" data-week="${week}" class="${week === selectedWeek ? 'active' : ''}${clock && Number(clock.current_week_number) === week ? ' current' : ''}"><span>Week ${week}</span><small>${qty} event${qty === 1 ? '' : 's'}</small></button>`;
    }).join('');
    rail.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => {
      selectedWeek = Number(button.dataset.week); renderRail(); render();
    }));
  }

  function visibleEvents() {
    return events.filter((row) => Number(row.week_number) === selectedWeek
      && matchesLevelAndState(row));
  }

  function eventCard(row) {
    const place = [row.county_name, row.region_name, row.state_code].find(Boolean) || 'National';
    const meta = typeof row.metadata === 'object' && row.metadata ? row.metadata : {};
    const note = meta.public_message || meta.message || '';
    return `<a class="calendar-event" href="${SimSite.eventUrl(row.scheduled_event_guid)}"><span class="event-status ${statusClass(row.event_status)}">${e(SimSite.resultLabel(row.event_status))}</span><strong>${e(row.event_name)}</strong><small>${e(place)} · ${row.session_qty || 0} session${Number(row.session_qty) === 1 ? '' : 's'}${row.division_qty ? ` · ${row.division_qty} divisions` : ''}</small>${note ? `<p>${e(note)}</p>` : ''}<i aria-hidden="true">→</i></a>`;
  }

  function render() {
    SimSite.syncFilters({ week: selectedWeek, level: levelFilter.value, state: stateFilter.value });
    const rows = visibleEvents();
    if (!rows.length) {
      root.innerHTML = `<div class="state-card"><strong>No events match these filters.</strong><p>Choose another week, level, or state.</p></div>`;
      return;
    }
    const dates = [...new Set(rows.map((row) => row.starts_on))];
    root.innerHTML = dates.map((date) => {
      const dayRows = rows.filter((row) => row.starts_on === date);
      const groups = [...new Set(dayRows.map((row) => row.event_type))];
      const dayName = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' });
      return `<section class="schedule-day"><header><div><p class="eyebrow">${e(dayName)} · ${e(SimSite.date(date, true))}</p><h2>${dayRows.length} scheduled event${dayRows.length === 1 ? '' : 's'}</h2></div></header><div class="event-groups">${groups.map((type) => {
        const group = dayRows.filter((row) => row.event_type === type);
        return `<details class="event-group" open><summary><span>${e(labelFor(group[0]))}</span><b>${group.length}</b></summary><div class="calendar-event-grid">${group.map(eventCard).join('')}</div></details>`;
      }).join('')}</div></section>`;
    }).join('');
  }

  try {
    clock = await SimApi.leagueClock();
    events = await SimApi.leagueCalendar(clock?.season_guid || '');
    if (clock?.season_guid) events = events.filter((row) => row.season_guid === clock.season_guid);
    if (!events.length) throw new Error('No league schedule has been published for the open season.');
    const requestedLevel = String(SimSite.query('level') || 'ALL').toUpperCase();
    levelFilter.value = ['ALL','HIGH_SCHOOL','COLLEGE'].includes(requestedLevel) ? requestedLevel : 'ALL';
    const states = SimSite.inventoryStates(events);
    stateFilter.innerHTML = '<option value="ALL">All states</option>' + states.map((state) => `<option value="${e(state)}">${e(state)}</option>`).join('');
    const requestedState = String(SimSite.query('state') || 'ALL').toUpperCase();
    stateFilter.value = states.includes(requestedState) ? requestedState : 'ALL';
    selectedWeek = selectedWeek >= 1 && selectedWeek <= 8 ? selectedWeek : Number(clock?.current_week_number || 1);
    seasonLabel.textContent = SimSite.seasonLabel(events[0]);
    renderClock(); renderRail(); render();
    levelFilter.addEventListener('change', () => { renderRail(); render(); });
    stateFilter.addEventListener('change', () => { renderRail(); render(); });
  } catch (error) {
    SimSite.showError(root, error.message);
    clockPanel.hidden = true; rail.hidden = true;
  }
})();
