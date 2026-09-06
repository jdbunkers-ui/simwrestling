(async function () {
  const content = document.getElementById('statistics-content');
  const filter = document.getElementById('statistics-weight-filter');
  const count = document.getElementById('statistics-count');
  if (!window.SimSite.configuredOrMessage(content)) return;

  let rows = [];
  function pct(value) { return SimSite.percent(value, 1); }
  function render() {
    const selected = filter.value;
    const visible = selected === 'ALL' ? rows : rows.filter((row) => row.weight_class_code === selected);
    count.textContent = `${visible.length} wrestler${visible.length === 1 ? '' : 's'}`;
    if (!visible.length) {
      content.innerHTML = '<div class="state-card"><p>No statistics are available for this weight class.</p></div>';
      return;
    }
    content.innerHTML = `<div class="table-wrap"><table class="statistics-table">
      <thead><tr><th>Rank</th><th>Weight</th><th>Wrestler</th><th>Record</th><th>Win %</th><th>Bonus %</th><th>Match pts.</th><th>Avg. pts.</th><th>TD</th><th>TD %</th><th>Esc</th><th>Rev</th><th>Back pts.</th><th>Ride time</th><th>Majors</th><th>Techs</th><th>Falls</th><th>Team pts.</th></tr></thead>
      <tbody>${visible.map((row) => `<tr>
        <td class="rank-number">${row.wrestler_rank}</td>
        <td>${SimSite.escape(row.weight_class_code)}</td>
        <td><a class="wrestler-link" href="${SimSite.profileUrl(row.wrestler_guid)}">${SimSite.escape(row.wrestler_name)}</a></td>
        <td>${row.win_qty}-${row.loss_qty}</td><td>${pct(row.win_pct)}</td><td>${SimSite.escape(row.bonus_point_percentage_display)}</td>
        <td>${row.match_points_scored}</td><td>${SimSite.number(row.average_match_points,1)}</td><td>${row.takedown_qty}</td><td>${pct(row.takedown_success_rate)}</td>
        <td>${row.escape_qty}</td><td>${row.reversal_qty}</td><td>${row.back_point_qty}</td><td>${SimSite.escape(row.riding_time_display)}</td>
        <td>${row.major_decision_win_qty}</td><td>${row.technical_fall_win_qty}</td><td>${row.fall_win_qty}</td><td>${SimSite.number(row.team_points_earned,1)}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  }

  try {
    const [rankings, statistics] = await Promise.all([SimApi.rankings(), SimApi.mediaStatistics()]);
    const statsByWrestler = new Map(statistics.map((row) => [row.wrestler_guid, row]));
    rows = rankings.map((ranking) => ({ ...ranking, ...(statsByWrestler.get(ranking.wrestler_guid) || {}) }));
    const weights = [...new Set(rows.map((row) => row.weight_class_code))];
    filter.innerHTML = '<option value="ALL">All weights</option>' + weights.map((weight) => `<option value="${SimSite.escape(weight)}">${SimSite.escape(weight)} lb</option>`).join('');
    filter.disabled = false;
    filter.addEventListener('change', render);
    render();
  } catch (error) {
    SimSite.showError(content, error.message);
    count.textContent = 'Unavailable';
  }
})();
