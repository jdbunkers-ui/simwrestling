(async function () {
  const content = document.getElementById('rankings-content');
  const filter = document.getElementById('weight-filter');
  const count = document.getElementById('ranking-count');
  if (!window.SimSite.configuredOrMessage(content)) return;

  let rankings = [];
  function render() {
    const weight = filter.value;
    const rows = weight === 'ALL' ? rankings : rankings.filter((row) => row.weight_class_code === weight);
    count.textContent = `${rows.length} wrestler${rows.length === 1 ? '' : 's'}`;
    if (!rows.length) {
      content.innerHTML = '<div class="state-card"><p>No wrestlers are available in this weight class.</p></div>';
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
    const weights = [...new Set(rankings.map((row) => row.weight_class_code))];
    filter.innerHTML = '<option value="ALL">All weights</option>' + weights.map((weight) => `<option value="${SimSite.escape(weight)}">${SimSite.escape(weight)} lb</option>`).join('');
    filter.disabled = false;
    filter.addEventListener('change', render);
    render();
  } catch (error) {
    SimSite.showError(content, error.message);
    count.textContent = 'Unavailable';
  }
})();
