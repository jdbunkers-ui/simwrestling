(async function () {
  const root = document.getElementById('dual-root');
  if (!SimSite.configuredOrMessage(root)) return;
  const e = SimSite.escape;
  const existingDual = SimSite.query('dual');
  const preferredTeam = SimSite.query('team');

  function teamChoice(team, side, selected) {
    return `<label class="team-radio ${selected ? 'selected' : ''}" data-team-card="${e(team.team_guid)}"><input type="radio" name="team-${side}" value="${e(team.team_guid)}" ${selected ? 'checked' : ''}><span><strong>#${team.state_team_rank} ${e(team.team_name)}</strong><small>${e(team.dual_record_display || '0-0')} · ${e(team.hometown_city || team.state_code)}</small></span></label>`;
  }

  async function renderSelector() {
    const teams = await SimApi.teamRankings();
    if (!teams.length) throw new Error('No active teams are available.');
    const states = [...new Set(teams.map((team) => team.state_code).filter(Boolean))].sort();
    const preferredTeamRow = teams.find((team) => team.team_guid === preferredTeam);
    const initialState = preferredTeamRow?.state_code || (states.includes(String(SimSite.query('state') || '').toUpperCase()) ? String(SimSite.query('state')).toUpperCase() : states[0]);
    let leftTeam = preferredTeamRow ? preferredTeam : '';
    let rightTeam = '';

    root.innerHTML = `
      <section class="page-heading compact-heading"><div><p class="eyebrow">Head-to-head competition</p><h1>Run a Dual Meet</h1><p>Select one program on each side. All ten starters will wrestle from 125 pounds through heavyweight.</p></div><a class="quiet-link" href="index.html?weight=TEAM">Team Rankings</a></section>
      <section class="dual-selector">
        <article class="selection-panel"><div class="selection-heading"><span>Home team</span><label>State<select id="left-state">${states.map((state) => `<option value="${e(state)}" ${state === initialState ? 'selected' : ''}>${e(state)}</option>`).join('')}</select></label></div><div class="team-radio-list" id="left-teams"></div></article>
        <div class="versus-mark" aria-hidden="true">VS</div>
        <article class="selection-panel"><div class="selection-heading"><span>Opposition</span><label>State<select id="right-state">${states.map((state) => `<option value="${e(state)}" ${state === initialState ? 'selected' : ''}>${e(state)}</option>`).join('')}</select></label></div><div class="team-radio-list" id="right-teams"></div></article>
      </section>
      <div class="event-launch"><p id="dual-selection-status">Choose two different teams.</p><button class="primary-button launch-button" id="run-dual" type="button" disabled>Wrestle the Dual</button></div>`;

    const leftState = document.getElementById('left-state');
    const rightState = document.getElementById('right-state');
    const leftList = document.getElementById('left-teams');
    const rightList = document.getElementById('right-teams');
    const button = document.getElementById('run-dual');
    const status = document.getElementById('dual-selection-status');

    function updateButton() {
      const valid = leftTeam && rightTeam && leftTeam !== rightTeam;
      button.disabled = !valid;
      status.textContent = leftTeam && rightTeam && leftTeam === rightTeam ? 'Select two different programs.' : valid ? 'Both lineups are ready.' : 'Choose two different teams.';
    }
    function renderSide(side) {
      const isLeft = side === 'left';
      const state = isLeft ? leftState.value : rightState.value;
      const list = isLeft ? leftList : rightList;
      const selected = isLeft ? leftTeam : rightTeam;
      const available = teams.filter((team) => team.state_code === state);
      list.innerHTML = available.map((team) => teamChoice(team, side, team.team_guid === selected)).join('');
      list.querySelectorAll('input').forEach((input) => input.addEventListener('change', () => {
        if (isLeft) leftTeam = input.value; else rightTeam = input.value;
        renderSide(side);
        updateButton();
      }));
    }
    leftState.addEventListener('change', () => { leftTeam = ''; renderSide('left'); updateButton(); });
    rightState.addEventListener('change', () => { rightTeam = ''; renderSide('right'); updateButton(); });
    renderSide('left'); renderSide('right'); updateButton();

    button.addEventListener('click', async () => {
      if (!leftTeam || !rightTeam || leftTeam === rightTeam) return;
      button.disabled = true; button.textContent = 'Wrestling…'; status.textContent = 'The engine is resolving all ten bouts.';
      try {
        const dualGuid = await SimApi.runDual(leftTeam, rightTeam);
        window.location.href = SimSite.dualUrl(dualGuid);
      } catch (error) {
        status.textContent = error.message; button.disabled = false; button.textContent = 'Wrestle the Dual';
      }
    });
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
      <div class="match-return"><a class="secondary-button" href="index.html?weight=TEAM">Return to Team Rankings</a></div>`;

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

  try { if (existingDual) await renderDual(existingDual); else await renderSelector(); }
  catch (error) { SimSite.showError(root, error.message); }
})();
