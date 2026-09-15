(async function () {
  const root = document.getElementById('results-root');
  if (!SimSite.configuredOrMessage(root)) return;

  const e = SimSite.escape;
  const level = document.getElementById('results-level');
  const weight = document.getElementById('results-weight');
  const region = document.getElementById('results-region');
  const state = document.getElementById('results-state');
  const week = document.getElementById('results-week');
  const day = document.getElementById('results-day');
  const search = document.getElementById('results-search');
  const count = document.getElementById('results-count');
  const title = document.getElementById('results-title');
  const season = document.getElementById('results-season');
  let geography = [];
  let clock = null;
  let requestNumber = 0;

  const normalized = (value) => value === 'ALL' ? null : value;
  const statusClass = (value) => `status-${String(value || 'IN_PROGRESS').toLowerCase().replaceAll('_', '-')}`;

  function renderWeights() {
    const order = SimSite.weightOrderFor(level.value);
    weight.innerHTML = order.map((code) => `<option value="${e(code)}">${e(code === 'HWT' ? 'HWT' : `${code} lb`)}</option>`).join('');
    const requested = String(SimSite.query('weight') || (level.value === 'HIGH_SCHOOL' ? '106' : '125')).toUpperCase();
    weight.value = order.includes(requested) ? requested : order[0];
  }

  function statesForRegion() {
    const selectedRegion = normalized(region.value);
    return [...new Set(geography
      .filter((row) => !selectedRegion || String(row.region_code) === selectedRegion)
      .map((row) => String(row.state_code || '').trim())
      .filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
  }

  function renderStates(preserve = true) {
    const previous = preserve ? state.value : 'ALL';
    const states = statesForRegion();
    state.innerHTML = '<option value="ALL">All states</option>' +
      states.map((code) => `<option value="${e(code)}">${e(code)}</option>`).join('');
    state.value = states.includes(previous) ? previous : 'ALL';
  }

  function restoreFilters() {
    const requestedLevel = String(SimSite.query('level') || 'COLLEGE').toUpperCase();
    level.value = ['HIGH_SCHOOL', 'COLLEGE'].includes(requestedLevel) ? requestedLevel : 'COLLEGE';
    renderWeights();

    const regions = SimSite.inventoryRegions(geography);
    region.innerHTML = '<option value="ALL">All regions · National</option>' +
      regions.map((item) => `<option value="${e(item.code)}">${e(item.name)}</option>`).join('');
    const requestedRegion = String(SimSite.query('region') || SimSite.defaultRegionCode(geography));
    region.value = regions.some((item) => item.code === requestedRegion) ? requestedRegion : SimSite.defaultRegionCode(geography);

    renderStates(false);
    const availableStates = statesForRegion();
    const requestedState = String(SimSite.query('state') || 'NJ').toUpperCase();
    state.value = availableStates.includes(requestedState) ? requestedState : 'ALL';

    week.innerHTML = '<option value="ALL">All weeks</option>' +
      Array.from({ length: 8 }, (_, index) => `<option value="${index + 1}">Week ${index + 1}</option>`).join('');
    const requestedWeek = Number(SimSite.query('week'));
    week.value = requestedWeek >= 1 && requestedWeek <= 8
      ? String(requestedWeek)
      : String(clock?.latest_result_week_number || clock?.current_week_number || 'ALL');

    const requestedDay = String(SimSite.query('day') || 'ALL');
    day.value = [...day.options].some((option) => option.value.toUpperCase() === requestedDay.toUpperCase())
      ? [...day.options].find((option) => option.value.toUpperCase() === requestedDay.toUpperCase()).value
      : 'ALL';
    search.value = SimSite.query('q') || '';
  }

  function statusText(row) {
    if (row.event_status === 'COMPLETED') return 'Completed';
    if (Number(row.completed_session_qty) > 0 || Number(row.completed_dual_qty) > 0 || Number(row.completed_bout_qty) > 0) return 'In Progress';
    return SimSite.resultLabel(row.event_status || 'IN_PROGRESS');
  }

  function activityText(row) {
    const pieces = [];
    if (Number(row.completed_dual_qty) > 0) pieces.push(`${row.completed_dual_qty} dual${Number(row.completed_dual_qty) === 1 ? '' : 's'} complete`);
    if (Number(row.completed_bout_qty) > 0) pieces.push(`${row.completed_bout_qty} bouts complete`);
    if (!pieces.length && Number(row.completed_session_qty) > 0) pieces.push(`${row.completed_session_qty} of ${row.session_qty} sessions complete`);
    return pieces.join(' · ');
  }

  function eventTypeLabel(row) {
    const type = String(row.event_type || '').toUpperCase();
    const format = String(row.format_code || '').toUpperCase();
    if (type.includes('INDIVIDUAL') || format.includes('DOUBLE_ELIMINATION')) return 'Individual Tournament';
    if (type.includes('QUAD')) return 'College Quad';
    if (type.includes('DUAL') && format.includes('TEAM_')) return 'Dual Meet Tournament';
    if (type.includes('DUAL')) return 'Dual Meet';
    return 'Tournament';
  }

  function rowMarkup(row) {
    const eventUrl = `${SimSite.eventUrl(row.scheduled_event_guid)}&weight=${encodeURIComponent(weight.value)}&region=${encodeURIComponent(region.value)}&state=${encodeURIComponent(state.value)}`;
    return `<tr>
      <td data-label="Week"><strong>Week ${row.week_number}</strong></td>
      <td data-label="Day"><span>${e(row.day_name)}</span><small>${e(SimSite.date(row.event_date, true))}</small></td>
      <td data-label="Event" class="results-event-name"><span class="schedule-type-badge results-type-badge">${e(eventTypeLabel(row))}</span><a href="${eventUrl}">${e(row.display_event_name || row.event_name)}</a><span class="event-status ${statusClass(row.event_status)}">${e(statusText(row))}</span>${activityText(row) ? `<small>${e(activityText(row))}</small>` : ''}</td>
      <td data-label="Details"><a class="results-detail-link" href="${eventUrl}">View Event <span aria-hidden="true">→</span></a></td>
    </tr>`;
  }

  function syncUrl() {
    SimSite.syncFilters({
      level: level.value === 'ALL' ? '' : level.value,
      weight: weight.value,
      region: region.value,
      state: state.value,
      week: week.value === 'ALL' ? '' : week.value,
      day: day.value === 'ALL' ? '' : day.value,
      q: search.value.trim()
    });
  }

  async function loadResults() {
    const thisRequest = ++requestNumber;
    syncUrl();
    root.innerHTML = '<div class="state-card page-state"><span class="spinner" aria-hidden="true"></span><p>Loading results…</p></div>';
    count.textContent = 'Loading';
    try {
      const resultRows = await SimApi.resultsFiltered({
        level: normalized(level.value),
        region: normalized(region.value),
        state: normalized(state.value),
        week: normalized(week.value),
        day: normalized(day.value),
        limit: 5000
      });
      if (thisRequest !== requestNumber) return;
      const phrase = search.value.trim().toLowerCase();
      const rows = resultRows.filter((row) => !phrase || `${row.display_event_name || row.event_name} ${row.event_type || ''}`.toLowerCase().includes(phrase));
      const levelLabel = SimSite.levelLabel(level.value);
      title.textContent = `${levelLabel} Event Results`;
      count.textContent = `${rows.length} event${rows.length === 1 ? '' : 's'}`;
      if (!rows.length) {
        root.innerHTML = '<div class="state-card results-empty"><strong>No results match these filters.</strong><p>Try another week, day, level, region, or state. Future events remain on the Schedule page.</p></div>';
        return;
      }
      root.innerHTML = `<div class="results-table-wrap"><table class="results-table"><thead><tr><th>Week</th><th>Day</th><th>Name of event</th><th>Event detail</th></tr></thead><tbody>${rows.map(rowMarkup).join('')}</tbody></table></div>`;
    } catch (error) {
      if (thisRequest === requestNumber) SimSite.showError(root, error.message);
    }
  }

  try {
    [clock, geography] = await Promise.all([SimApi.resultsContext(), SimApi.regionStateInventory()]);
    season.textContent = SimSite.seasonLabel(clock || {});
    restoreFilters();
    level.addEventListener('change', () => { renderWeights(); loadResults(); });
    weight.addEventListener('change', loadResults);
    region.addEventListener('change', () => { renderStates(false); loadResults(); });
    state.addEventListener('change', loadResults);
    week.addEventListener('change', loadResults);
    day.addEventListener('change', loadResults);
    search.addEventListener('input', loadResults);
    await loadResults();
  } catch (error) {
    SimSite.showError(root, error.message);
  }
})();
