(async function () {
  const content = document.getElementById('statistics-content');
  const levelFilter = document.getElementById('statistics-level-filter');
  const weightFilter = document.getElementById('statistics-weight-filter');
  const stateFilter = document.getElementById('statistics-state-filter');
  const search = document.getElementById('statistics-search');
  const count = document.getElementById('statistics-count');
  if (!window.SimSite.configuredOrMessage(content)) return;

  let rows = [];
  let sort = { key: 'wrestler_rank', direction: 'asc' };

  function displayedRank(row) {
    if (weightFilter.value === 'PBP') {
      return stateFilter.value === 'ALL' ? row.pound_for_pound_rank : row.state_pound_for_pound_rank;
    }
    return stateFilter.value === 'ALL' ? row.weight_class_rank : row.state_weight_rank;
  }

  const sortValues = {
    wrestler_rank: (row) => Number(displayedRank(row) || 0),
    weight: (row) => {
      const index = SimSite.weightOrderFor(levelFilter.value).indexOf(String(row.weight_class_code));
      return index < 0 ? 999 : index;
    },
    wrestler_name: (row) => row.wrestler_name || '',
    team_name: (row) => row.team_name || row.hometown_display || '',
    state_code: (row) => row.state_code || '',
    record: (row) => Number(row.win_pct || 0) * 100000 + Number(row.win_qty || 0) * 100 - Number(row.loss_qty || 0),
    win_pct: (row) => Number(row.win_pct || 0),
    bonus_point_rate: (row) => Number(row.bonus_point_rate || 0),
    takedown_success_rate: (row) => Number(row.takedown_success_rate || 0),
    technical_fall_win_qty: (row) => Number(row.technical_fall_win_qty || 0),
    fall_win_qty: (row) => Number(row.fall_win_qty || 0),
    team_points_earned: (row) => Number(row.team_points_earned || 0),
    average_match_points: (row) => Number(row.average_match_points || 0),
    average_takedowns: (row) => Number(row.average_takedowns || 0),
    average_escapes: (row) => Number(row.average_escapes || 0),
    average_reversals: (row) => Number(row.average_reversals || 0),
    average_back_points: (row) => Number(row.average_back_points || 0),
    average_riding_time_seconds: (row) => Number(row.average_riding_time_seconds || 0)
  };

  function normalized(value) {
    return String(value || '').trim().toLocaleLowerCase();
  }

  function header(label, key) {
    const active = sort.key === key;
    const arrow = active ? (sort.direction === 'asc' ? '▲' : '▼') : '';
    return `<button class="sort-button${active ? ' active' : ''}" type="button" data-sort="${key}">${label}<span aria-hidden="true">${arrow}</span></button>`;
  }

  function compare(a, b) {
    const getter = sortValues[sort.key] || sortValues.wrestler_rank;
    const av = getter(a);
    const bv = getter(b);
    let result;
    if (typeof av === 'number' && typeof bv === 'number') result = av - bv;
    else result = String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' });
    if (!result) result = Number(a.wrestler_rank || 0) - Number(b.wrestler_rank || 0);
    return sort.direction === 'asc' ? result : -result;
  }

  function visibleRows() {
    const level = levelFilter.value;
    const weight = weightFilter.value;
    const state = stateFilter.value;
    const phrase = normalized(search.value);
    return rows.filter((row) => {
      const levelMatches = row.competition_level === level;
      const weightMatches = weight === 'PBP' || row.weight_class_code === weight;
      const stateMatches = state === 'ALL' || row.state_code === state;
      const textMatches = !phrase || normalized(`${row.wrestler_name} ${row.team_name || ''} ${row.hometown_display || ''}`).includes(phrase);
      return levelMatches && weightMatches && stateMatches && textMatches;
    }).sort(compare);
  }

  function pct(value) {
    return SimSite.percent(value, 1);
  }

  function render() {
    const visible = visibleRows();
    count.textContent = `${visible.length} wrestler${visible.length === 1 ? '' : 's'}`;
    SimSite.syncFilters({
      level: levelFilter.value,
      weight: weightFilter.value,
      state: stateFilter.value,
      q: search.value.trim()
    });

    if (!visible.length) {
      content.innerHTML = '<div class="state-card"><p>No statistics match the selected filters.</p></div>';
      return;
    }

    content.innerHTML = `<div class="table-wrap"><table class="statistics-table">
      <thead>
        <tr class="statistics-group-row">
          <th rowspan="2">${header('Rank','wrestler_rank')}</th>
          <th rowspan="2">${header('Weight','weight')}</th>
          <th rowspan="2">${header('Wrestler','wrestler_name')}</th>
          <th rowspan="2">${header(levelFilter.value === 'COLLEGE' ? 'College' : 'Hometown','team_name')}</th>
          <th rowspan="2">${header('State','state_code')}</th>
          <th rowspan="2">${header('Record','record')}</th>
          <th rowspan="2">${header('Win %','win_pct')}</th>
          <th rowspan="2">${header('Bonus %','bonus_point_rate')}</th>
          <th rowspan="2">${header('TD %','takedown_success_rate')}</th>
          <th rowspan="2">${header('Techs','technical_fall_win_qty')}</th>
          <th rowspan="2">${header('Falls','fall_win_qty')}</th>
          <th rowspan="2">${header('Team pts.','team_points_earned')}</th>
          <th class="average-group" colspan="6">Average per match</th>
        </tr>
        <tr>
          <th>${header('Pts.','average_match_points')}</th>
          <th>${header('TDs','average_takedowns')}</th>
          <th>${header('Esc','average_escapes')}</th>
          <th>${header('Rev','average_reversals')}</th>
          <th>${header('Back pts.','average_back_points')}</th>
          <th>${header('Ride time','average_riding_time_seconds')}</th>
        </tr>
      </thead>
      <tbody>${visible.map((row) => `<tr>
        <td class="rank-number">${displayedRank(row)}</td>
        <td>${SimSite.escape(row.weight_class_code)}</td>
        <td><a class="wrestler-link" href="${SimSite.profileUrl(row.wrestler_guid)}">${SimSite.escape(row.wrestler_name)}</a></td>
        <td>${levelFilter.value === 'COLLEGE' ? (row.team_name ? `<a class="table-link" href="${SimSite.teamUrl(row.team_guid)}">${SimSite.escape(row.team_name)}</a>` : '<span class="subtext">—</span>') : SimSite.escape(row.hometown_display || row.wrestler_state_code || row.state_code || '—')}</td>
        <td>${row.state_code ? SimSite.escape(row.state_code) : '—'}</td>
        <td>${SimSite.escape(row.record_display)}</td>
        <td>${pct(row.win_pct)}</td>
        <td>${SimSite.escape(row.bonus_point_percentage_display || '0.0%')}</td>
        <td>${pct(row.takedown_success_rate)}</td>
        <td>${row.technical_fall_win_qty}</td>
        <td>${row.fall_win_qty}</td>
        <td>${SimSite.number(row.team_points_earned,1)}</td>
        <td>${SimSite.number(row.average_match_points,1)}</td>
        <td>${SimSite.number(row.average_takedowns,2)}</td>
        <td>${SimSite.number(row.average_escapes,2)}</td>
        <td>${SimSite.number(row.average_reversals,2)}</td>
        <td>${SimSite.number(row.average_back_points,2)}</td>
        <td>${SimSite.escape(row.average_riding_time_display || '0:00')}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;

    content.querySelectorAll('[data-sort]').forEach((button) => {
      button.addEventListener('click', () => {
        const key = button.dataset.sort;
        if (sort.key === key) sort.direction = sort.direction === 'asc' ? 'desc' : 'asc';
        else {
          sort.key = key;
          sort.direction = ['wrestler_rank','weight','wrestler_name','team_name','state_code'].includes(key) ? 'asc' : 'desc';
        }
        render();
      });
    });
  }

  try {
    rows = await SimApi.mediaStatistics();
    levelFilter.value = SimSite.selectedLevel();
    function rebuildFilters(preferredWeight = '', preferredState = '') {
      const levelRows = rows.filter((row) => row.competition_level === levelFilter.value);
      weightFilter.innerHTML = SimSite.weightOptions(levelRows, false, levelFilter.value);
      const weights = [...weightFilter.options].map((option) => option.value);
      const fallback = levelFilter.value === 'HIGH_SCHOOL' ? '106' : '125';
      weightFilter.value = weights.includes(preferredWeight) ? preferredWeight : (weights.includes(fallback) ? fallback : 'PBP');
      const states = SimSite.inventoryStates(levelRows);
      stateFilter.innerHTML = '<option value="ALL">All states</option>'
        + states.map((state) => `<option value="${SimSite.escape(state)}">${SimSite.escape(state)}</option>`).join('');
      stateFilter.value = states.includes(preferredState) ? preferredState : 'ALL';
      stateFilter.disabled = !states.length;
    }
    rebuildFilters(String(SimSite.query('weight') || '').toUpperCase(), String(SimSite.query('state') || '').toUpperCase());
    search.value = SimSite.query('q') || '';

    levelFilter.disabled = false;
    weightFilter.disabled = false;
    levelFilter.addEventListener('change', () => { rebuildFilters(); render(); });
    weightFilter.addEventListener('change', render);
    stateFilter.addEventListener('change', render);
    search.addEventListener('input', render);
    render();
  } catch (error) {
    SimSite.showError(content, error.message);
    count.textContent = 'Unavailable';
  }
})();
