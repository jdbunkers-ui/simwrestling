(async function () {
  const content = document.getElementById('rankings-content');
  const weightFilter = document.getElementById('weight-filter');
  const stateFilter = document.getElementById('state-filter');
  const search = document.getElementById('ranking-search');
  const count = document.getElementById('ranking-count');
  if (!window.SimSite.configuredOrMessage(content)) return;

  let rankings = [];

  function normalized(value) {
    return String(value || '').trim().toLocaleLowerCase();
  }

  function visibleRows() {
    const weight = weightFilter.value;
    const state = stateFilter.value;
    const phrase = normalized(search.value);
    return rankings.filter((row) => {
      const weightMatches = weight === 'PBP' || row.weight_class_code === weight;
      const stateMatches = state === 'ALL' || row.state_code === state;
      const textMatches = !phrase || normalized(`${row.wrestler_name} ${row.team_name || ''}`).includes(phrase);
      return weightMatches && stateMatches && textMatches;
    });
  }

  function render() {
    const rows = visibleRows();
    count.textContent = `${rows.length} wrestler${rows.length === 1 ? '' : 's'}`;
    SimSite.syncFilters({
      weight: weightFilter.value,
      state: stateFilter.value,
      q: search.value.trim()
    });

    if (!rows.length) {
      content.innerHTML = '<div class="state-card"><p>No wrestlers match the selected filters.</p></div>';
      return;
    }

    content.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Rank</th><th>Weight</th><th>Wrestler</th><th>College team</th><th>Wins</th><th>Losses</th><th>Bonus %</th></tr></thead>
      <tbody>${rows.map((row) => `<tr>
        <td class="rank-number">${row.wrestler_rank}</td>
        <td><strong>${SimSite.escape(row.weight_class_code)}</strong></td>
        <td><a class="wrestler-link" href="${SimSite.profileUrl(row.wrestler_guid)}">${SimSite.escape(row.wrestler_name)}</a></td>
        <td>${row.team_name ? SimSite.escape(row.team_name) : '<span class="subtext">—</span>'}</td>
        <td>${row.win_qty}</td><td>${row.loss_qty}</td>
        <td><span class="bonus-pill">${SimSite.escape(row.bonus_point_percentage_display || '0.0%')}</span></td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  }

  try {
    rankings = await SimApi.rankings();
    weightFilter.innerHTML = SimSite.weightOptions(rankings);
    weightFilter.value = SimSite.selectedWeight(rankings);

    const states = SimSite.inventoryStates(rankings);
    stateFilter.innerHTML = '<option value="ALL">All states</option>'
      + states.map((state) => `<option value="${SimSite.escape(state)}">${SimSite.escape(state)}</option>`).join('');
    const requestedState = String(SimSite.query('state') || '').toUpperCase();
    stateFilter.value = states.includes(requestedState) ? requestedState : 'ALL';
    search.value = SimSite.query('q') || '';

    weightFilter.disabled = false;
    stateFilter.disabled = !states.length;
    weightFilter.addEventListener('change', render);
    stateFilter.addEventListener('change', render);
    search.addEventListener('input', render);
    render();
  } catch (error) {
    SimSite.showError(content, error.message);
    count.textContent = 'Unavailable';
  }
})();
