(async function () {
  const root = document.getElementById('tournament-root');
  if (!SimSite.configuredOrMessage(root)) return;
  const e = SimSite.escape;
  const tournamentGuid = SimSite.query('tournament');

  async function renderSelector() {
    const wrestlers = await SimApi.rankings();
    const states = SimSite.inventoryStates(wrestlers);
    if (!states.length) throw new Error('No tournament states are available.');
    const initialState = states.includes(String(SimSite.query('state') || '').toUpperCase()) ? String(SimSite.query('state')).toUpperCase() : states[0];
    const weights = SimSite.weightOrder.filter((weight) => wrestlers.some((row) => row.state_code === initialState && row.weight_class_code === weight));
    const requestedWeight = String(SimSite.query('weight') || '125').toUpperCase();
    const initialWeight = weights.includes(requestedWeight) ? requestedWeight : weights[0];

    root.innerHTML = `<section class="page-heading"><p class="eyebrow">State championship test</p><h1>Run Tournament</h1><p>Select a state and weight class. The top four seeds receive first-round byes in a 12-wrestler double-elimination bracket.</p></section>
      <section class="tournament-selector panel"><div><label class="filter-control">State<select id="tournament-state">${states.map((state) => `<option value="${e(state)}" ${state === initialState ? 'selected' : ''}>${e(state)}</option>`).join('')}</select></label><label class="filter-control">Weight class<select id="tournament-weight"></select></label></div><div class="tournament-format"><span>12</span><p><strong>Wrestlers</strong><small>20 bouts · places 1–4</small></p></div><button class="primary-button launch-button" id="run-tournament" type="button">Build the Bracket</button></section><p class="section-note event-message" id="tournament-status"></p>`;
    const state = document.getElementById('tournament-state');
    const weight = document.getElementById('tournament-weight');
    const button = document.getElementById('run-tournament');
    const status = document.getElementById('tournament-status');
    function updateWeights(preferred = '') {
      const available = SimSite.weightOrder.filter((item) => wrestlers.some((row) => row.state_code === state.value && row.weight_class_code === item));
      weight.innerHTML = available.map((item) => `<option value="${e(item)}">${e(item === 'HWT' ? 'HWT' : `${item} lb`)}</option>`).join('');
      weight.value = available.includes(preferred) ? preferred : available[0];
      button.disabled = !available.length;
    }
    updateWeights(initialWeight);
    state.addEventListener('change', () => updateWeights('125'));
    button.addEventListener('click', async () => {
      button.disabled = true; button.textContent = 'Wrestling 20 Bouts…'; status.textContent = 'The engine is resolving the complete bracket. This can take a moment.';
      try {
        const guid = await SimApi.runTournament(state.value, weight.value);
        window.location.href = SimSite.tournamentUrl(guid);
      } catch (error) {
        status.textContent = error.message; button.disabled = false; button.textContent = 'Build the Bracket';
      }
    });
  }

  function bracketColumn(title, bouts) {
    return `<section class="bracket-column"><h3>${e(title)}</h3>${bouts.map((bout) => bracketCard(bout)).join('')}</section>`;
  }
  function bracketCard(bout) {
    const firstWon = bout.winner_wrestler_guid === bout.wrestler_1_guid;
    return `<article class="bracket-match" data-bout-code="${e(bout.bout_code)}" data-order="${bout.bout_order}"><div class="bracket-match-label"><span>${e(bout.bout_code)}</span><small>${e(bout.round_name)}</small></div><div class="bracket-wrestler ${firstWon ? 'eventual-winner' : ''}" data-wrestler="${e(bout.wrestler_1_guid)}"><span>${bout.wrestler_1_seed}</span><a href="${SimSite.profileUrl(bout.wrestler_1_guid)}">${e(bout.wrestler_1_name)}</a><b class="bracket-score">${bout.wrestler_1_match_score}</b></div><div class="bracket-wrestler ${!firstWon ? 'eventual-winner' : ''}" data-wrestler="${e(bout.wrestler_2_guid)}"><span>${bout.wrestler_2_seed}</span><a href="${SimSite.profileUrl(bout.wrestler_2_guid)}">${e(bout.wrestler_2_name)}</a><b class="bracket-score">${bout.wrestler_2_match_score}</b></div><footer><span>${e(SimSite.resultLabel(bout.result_type))}</span><a href="${SimSite.matchUrl(bout.match_guid, `tournament.html?tournament=${tournamentGuid}`)}">PBP →</a></footer></article>`;
  }

  async function renderTournament() {
    const payload = await SimApi.tournament(tournamentGuid);
    if (!payload?.tournament || !payload?.bracket?.length) throw new Error('The completed tournament could not be loaded.');
    const tournament = payload.tournament;
    const bouts = [...payload.bracket].sort((a,b) => a.bout_order - b.bout_order);
    const entries = payload.entries || [];
    const rounds = (codes) => bouts.filter((bout) => codes.includes(bout.round_code));
    document.title = `${tournament.tournament_name} | Sim Wrestling`;

    root.innerHTML = `<section class="tournament-header"><div><p class="eyebrow">Double elimination · Engine v0.1.3</p><h1>${e(tournament.tournament_name)}</h1><p>${tournament.entrant_qty} wrestlers · ${tournament.bout_qty} matches · top four seeds received byes</p></div><div class="tournament-live"><span id="tournament-counter">Opening bracket</span><strong id="tournament-round">Seeds locked</strong></div></section>
      <div class="playback-controls tournament-controls"><p id="bracket-status">The completed tournament is being revealed bout by bout.</p><div class="control-buttons"><button id="bracket-pause" type="button">Pause</button><button id="bracket-show-all" type="button">Show all</button></div></div>
      <section class="bracket-section"><div class="bracket-section-heading"><span>Championship bracket</span><small>Top four seeds enter in the quarterfinals</small></div><div class="bracket-grid championship-grid">${bracketColumn('Round 1',rounds(['CHAMP_R1']))}${bracketColumn('Quarterfinals',rounds(['CHAMP_QF']))}${bracketColumn('Semifinals',rounds(['CHAMP_SF']))}${bracketColumn('Championship',rounds(['CHAMP_FINAL']))}</div></section>
      <section class="bracket-section consolation-section"><div class="bracket-section-heading"><span>Wrestlebacks</span><small>One more loss ends the tournament</small></div><div class="bracket-grid consolation-grid">${bracketColumn('Round 1',rounds(['CONS_R1']))}${bracketColumn('Quarterfinals',rounds(['CONS_QF']))}${bracketColumn('Semifinals',rounds(['CONS_SF']))}${bracketColumn('Third Place',rounds(['THIRD_PLACE']))}</div></section>
      <section class="placements-panel" id="placements-panel" hidden><div><p class="eyebrow">Final standings</p><h2>Podium</h2></div><ol>${entries.filter((row) => row.final_placement).sort((a,b) => a.final_placement-b.final_placement).map((row) => `<li><span>${row.final_placement}</span><div><a href="${SimSite.profileUrl(row.wrestler_guid)}">${e(row.wrestler_name)}</a><small>No. ${row.seed_number} seed · ${e(row.team_name)}</small></div></li>`).join('')}</ol></section>
      <div class="match-return"><a class="secondary-button" href="index.html">Return to Rankings</a></div>`;

    const cards = new Map([...document.querySelectorAll('.bracket-match')].map((card) => [Number(card.dataset.order),card]));
    const counter = document.getElementById('tournament-counter');
    const currentRound = document.getElementById('tournament-round');
    const status = document.getElementById('bracket-status');
    const pause = document.getElementById('bracket-pause');
    const placements = document.getElementById('placements-panel');
    let index = 0, paused = false, timer;

    function activate(bout) {
      document.querySelectorAll('.active-bout').forEach((card) => card.classList.remove('active-bout'));
      const card = cards.get(Number(bout.bout_order));
      card.classList.add('active-bout');
      card.scrollIntoView({ behavior:'smooth', block:'nearest', inline:'nearest' });
      counter.textContent = `Bout ${bout.bout_order} of ${bouts.length}`;
      currentRound.textContent = bout.round_name;
    }
    function reveal(bout) {
      const card = cards.get(Number(bout.bout_order));
      card.classList.add('revealed');
      card.classList.remove('active-bout');
      const winner = card.querySelector(`[data-wrestler="${CSS.escape(bout.winner_wrestler_guid)}"]`);
      winner?.classList.add('bracket-winner-flash');
      const next = bouts.find((candidate) => candidate.bout_order > bout.bout_order && (candidate.wrestler_1_guid === bout.winner_wrestler_guid || candidate.wrestler_2_guid === bout.winner_wrestler_guid));
      if (next) cards.get(Number(next.bout_order))?.querySelector(`[data-wrestler="${CSS.escape(bout.winner_wrestler_guid)}"]`)?.classList.add('advancing-wrestler');
      window.setTimeout(() => document.querySelectorAll('.advancing-wrestler,.bracket-winner-flash').forEach((item) => item.classList.remove('advancing-wrestler','bracket-winner-flash')),1600);
      if (index === bouts.length) { placements.hidden = false; status.textContent = 'The tournament is complete.'; counter.textContent = 'Final'; currentRound.textContent = tournament.champion_wrestler_name; pause.disabled = true; }
    }
    function schedule() {
      clearTimeout(timer);
      if (paused || index >= bouts.length) return;
      const bout = bouts[index]; activate(bout);
      timer = setTimeout(() => { index += 1; reveal(bout); timer = setTimeout(schedule,900); }, index === 0 ? 900 : 1800);
    }
    pause.addEventListener('click', () => { paused = !paused; pause.textContent = paused ? 'Resume' : 'Pause'; if (paused) clearTimeout(timer); else schedule(); });
    document.getElementById('bracket-show-all').addEventListener('click', () => { clearTimeout(timer); paused = true; while (index < bouts.length) { const bout=bouts[index++]; reveal(bout); } placements.hidden=false; counter.textContent='Final'; currentRound.textContent=tournament.champion_wrestler_name; status.textContent='The tournament is complete.'; pause.textContent='Complete'; pause.disabled=true; });
    schedule();
  }

  try { if (tournamentGuid) await renderTournament(); else await renderSelector(); }
  catch (error) { SimSite.showError(root,error.message); }
})();
