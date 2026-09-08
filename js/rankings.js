(async function () {
  const content = document.getElementById('rankings-content');
  const weightFilter = document.getElementById('weight-filter');
  const stateFilter = document.getElementById('state-filter');
  const search = document.getElementById('ranking-search');
  const count = document.getElementById('ranking-count');
  const title = document.getElementById('rankings-title');
  const pageTitle = document.getElementById('directory-page-title');
  const pageCopy = document.getElementById('directory-page-copy');
  if (!window.SimSite.configuredOrMessage(content)) return;

  let rankings = [];
  let teams = [];

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

  function visibleTeams() {
    const state = stateFilter.value;
    const phrase = normalized(search.value);
    return teams.filter((row) => {
      const stateMatches = state === 'ALL' || row.state_code === state;
      const textMatches = !phrase || normalized(`${row.team_name} ${row.hometown_city || ''}`).includes(phrase);
      return stateMatches && textMatches;
    });
  }

  function render() {
    const teamMode = weightFilter.value === 'TEAM';
    search.placeholder = teamMode ? 'Start typing a college or city' : 'Start typing a name or college';
    if (teamMode) {
      const teamRows = visibleTeams();
      count.textContent = `${teamRows.length} team${teamRows.length === 1 ? '' : 's'}`;
      title.textContent = 'Team Rankings';
      pageTitle.textContent = 'Team Rankings';
      pageCopy.textContent = 'Every active program, ranked by dual record and starting-lineup performance.';
      SimSite.syncFilters({ weight: 'TEAM', state: stateFilter.value, q: search.value.trim() });
      if (!teamRows.length) {
        content.innerHTML = '<div class="state-card"><p>No teams match the selected filters.</p></div>';
        return;
      }
      content.innerHTML = `<div class="table-wrap"><table class="team-ranking-table">
        <thead><tr><th>Rank</th><th>Team</th><th>City</th><th>Record</th><th>Win %</th><th>Avg. margin</th></tr></thead>
        <tbody>${teamRows.map((row) => `<tr>
          <td class="rank-number">${row.state_team_rank}</td>
          <td><a class="wrestler-link" href="${SimSite.teamUrl(row.team_guid)}">${SimSite.escape(row.team_name)}</a><span class="subtext">${SimSite.escape(row.ranking_basis === 'DUAL_RECORD' ? 'Ranked by dual results' : 'Ranked by starting ten')}</span></td>
          <td>${SimSite.escape(row.hometown_city || '—')}, ${SimSite.escape(row.state_code || '')}</td>
          <td><strong>${SimSite.escape(row.dual_record_display || '0-0')}</strong></td>
          <td>${SimSite.percent(row.dual_win_rate,1)}</td>
          <td>${Number(row.average_dual_margin || 0) > 0 ? '+' : ''}${SimSite.number(row.average_dual_margin,1)}</td>
        </tr>`).join('')}</tbody>
      </table></div>`;
      return;
    }

    const rows = visibleRows();
    count.textContent = `${rows.length} wrestler${rows.length === 1 ? '' : 's'}`;
    SimSite.syncFilters({
      weight: weightFilter.value,
      state: stateFilter.value,
      q: search.value.trim()
    });
    title.textContent = weightFilter.value === 'PBP' ? 'Pound-for-Pound Rankings' : `${weightFilter.value}-Pound Rankings`;
    pageTitle.textContent = 'Wrestler Rankings';
    pageCopy.textContent = 'Every active wrestler, ranked across all weight classes.';

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
        <td>${row.team_name ? `<a class="table-link" href="${SimSite.teamUrl(row.team_guid)}">${SimSite.escape(row.team_name)}</a>` : '<span class="subtext">—</span>'}</td>
        <td>${row.win_qty}</td><td>${row.loss_qty}</td>
        <td><span class="bonus-pill">${SimSite.escape(row.bonus_point_percentage_display || '0.0%')}</span></td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  }

  try {
    [rankings, teams] = await Promise.all([SimApi.rankings(), SimApi.teamRankings()]);
    weightFilter.innerHTML = SimSite.weightOptions(rankings, true);
    weightFilter.value = SimSite.selectedWeight(rankings, true);

    const states = [...new Set([...SimSite.inventoryStates(rankings), ...teams.map((team) => team.state_code).filter(Boolean)])].sort();
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
