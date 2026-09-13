(async function () {
  const root = document.getElementById('dual-root');
  if (!SimSite.configuredOrMessage(root)) return;
  const e = SimSite.escape;
  const existingDual = SimSite.query('dual');
  if (!existingDual) {
    root.innerHTML = '<div class="state-card"><strong>Dual meets are created by the league scheduler.</strong><p><a class="secondary-button" href="schedule.html?level=COLLEGE">View League Schedule</a></p></div>';
    return;
  }

  async function renderDual(dualGuid) {
    const payload = await SimApi.dual(dualGuid);
    if (!payload?.dual || !payload?.bouts?.length) throw new Error('The completed dual could not be loaded.');
    const dual = payload.dual;
    const bouts = payload.bouts;
    document.title = `${dual.team_1_name} vs. ${dual.team_2_name} | Sim Wrestling`;
    root.innerHTML = `
      <section class="dual-scoreboard" aria-label="Dual meet scoreboard"><div class="dual-score-top"><span>DUAL MEET</span><strong id="dual-weight">Opening lineups</strong></div><div class="dual-score-main"><div><a href="${SimSite.teamUrl(dual.team_1_guid)}">${e(dual.team_1_name)}</a><strong id="dual-score-one">0</strong></div><span class="dual-bout-count"><b id="dual-bout-number">0</b><small>of ${bouts.length} bouts</small></span><div><a href="${SimSite.teamUrl(dual.team_2_guid)}">${e(dual.team_2_name)}</a><strong id="dual-score-two">0</strong></div></div></section>
      <div class="playback-controls"><p id="dual-status">The completed dual is being revealed one weight at a time.</p><div class="control-buttons"><button id="dual-pause" type="button">Pause</button><button id="dual-show-all" type="button">Show all</button></div></div>
      <section class="dual-feed" id="dual-feed"></section>
      <div class="event-summary" id="dual-summary" hidden><p class="eyebrow">Final team score</p><h2>${e(dual.team_1_name)} ${SimSite.number(dual.team_1_score,0)} · ${SimSite.number(dual.team_2_score,0)} ${e(dual.team_2_name)}</h2></div>
      <div class="match-return"><a class="secondary-button" href="rankings.html?weight=TEAM">Return to Team Rankings</a></div>`;

    const feed = document.getElementById('dual-feed');
    const scoreOne = document.getElementById('dual-score-one');
    const scoreTwo = document.getElementById('dual-score-two');
    const weight = document.getElementById('dual-weight');
    const boutNumber = document.getElementById('dual-bout-number');
    const status = document.getElementById('dual-status');
    const summary = document.getElementById('dual-summary');
    const pause = document.getElementById('dual-pause');
    let index = 0, paused = false, timer;

    function reveal(bout) {
      weight.textContent = `${bout.weight_class_code} lb`;
      scoreOne.textContent = SimSite.number(bout.team_1_score,0);
      scoreTwo.textContent = SimSite.number(bout.team_2_score,0);
      boutNumber.textContent = bout.bout_order;
      const returnUrl = `dual.html?dual=${dualGuid}`;
      feed.insertAdjacentHTML('beforeend', `<article class="dual-bout-result"><div class="dual-weight"><span>${e(bout.weight_class_code)}</span><small>Weight</small></div><div class="dual-competitor"><span>#${bout.wrestler_1_state_weight_rank}</span><a href="${SimSite.profileUrl(bout.wrestler_1_guid)}">${e(bout.wrestler_1_name)}</a><strong>${bout.wrestler_1_match_score}</strong></div><div class="dual-result"><strong>${e(SimSite.resultLabel(bout.result_type))}</strong><a href="${SimSite.matchUrl(bout.match_guid, returnUrl)}">View PBP →</a></div><div class="dual-competitor away"><strong>${bout.wrestler_2_match_score}</strong><a href="${SimSite.profileUrl(bout.wrestler_2_guid)}">${e(bout.wrestler_2_name)}</a><span>#${bout.wrestler_2_state_weight_rank}</span></div></article>`);
      feed.lastElementChild.scrollIntoView({ behavior:'smooth', block:'nearest' });
      if (index === bouts.length) { summary.hidden = false; status.textContent = 'The dual meet is complete.'; pause.disabled = true; }
    }
    function schedule() {
      clearTimeout(timer);
      if (paused || index >= bouts.length) return;
      timer = setTimeout(() => { const bout = bouts[index++]; reveal(bout); schedule(); }, index === 0 ? 500 : 2300);
    }
    pause.addEventListener('click', () => { paused = !paused; pause.textContent = paused ? 'Resume' : 'Pause'; if (paused) clearTimeout(timer); else schedule(); });
    document.getElementById('dual-show-all').addEventListener('click', () => { clearTimeout(timer); paused = true; while (index < bouts.length) reveal(bouts[index++]); pause.textContent = 'Complete'; pause.disabled = true; });
    schedule();
  }

  try { await renderDual(existingDual); }
  catch (error) { SimSite.showError(root, error.message); }
})();
