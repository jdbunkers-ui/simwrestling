(async function () {
  const root = document.getElementById('tournament-root');
  if (!SimSite.configuredOrMessage(root)) return;
  const e = SimSite.escape;
  const tournamentGuid = SimSite.query('tournament');

  async function renderSelector() {
    const wrestlers = await SimApi.rankings();
    const requestedLevel = SimSite.selectedLevel();
    root.innerHTML = `<section class="page-heading"><p class="eyebrow">State championship test</p><h1>Run Tournament</h1><p>Select a competition level, state and weight class. The bracket includes every eligible wrestler.</p></section>
      <section class="tournament-selector panel"><div><label class="filter-control">Level<select id="tournament-level"><option value="COLLEGE">College</option><option value="HIGH_SCHOOL">High School</option></select></label><label class="filter-control">State<select id="tournament-state"></select></label><label class="filter-control">Weight class<select id="tournament-weight"></select></label></div><div class="tournament-format"><span id="tournament-entrant-count">—</span><p><strong>Wrestlers</strong><small id="tournament-format-copy">Checking field</small></p></div><button class="primary-button launch-button" id="run-tournament" type="button">Build the Bracket</button></section><p class="section-note event-message" id="tournament-status"></p>`;

    const level = document.getElementById('tournament-level');
    const state = document.getElementById('tournament-state');
    const weight = document.getElementById('tournament-weight');
    const button = document.getElementById('run-tournament');
    const status = document.getElementById('tournament-status');
    const entrantCount = document.getElementById('tournament-entrant-count');
    const formatCopy = document.getElementById('tournament-format-copy');
    level.value = requestedLevel;

    const eligibleRows = () => wrestlers.filter((row) => row.competition_level === level.value && row.match_eligible_ind);
    function updateField() {
      const count = eligibleRows().filter((row) => row.state_code === state.value && row.weight_class_code === weight.value).length;
      entrantCount.textContent = count;
      const valid = level.value === 'COLLEGE' ? count === 16 : count >= 2 && count <= 64;
      formatCopy.textContent = level.value === 'COLLEGE'
        ? (valid ? '28 bouts · places 1–4' : 'College field requires 16')
        : (valid ? 'Adaptive double elimination · places 1–4' : 'Requires 2–64 wrestlers');
      button.disabled = !valid;
    }
    function updateWeights(preferred = '') {
      const available = SimSite.weightOrderFor(level.value).filter((item) => eligibleRows().some((row) => row.state_code === state.value && row.weight_class_code === item));
      weight.innerHTML = available.map((item) => `<option value="${e(item)}">${e(item === 'HWT' ? 'HWT' : `${item} lb`)}</option>`).join('');
      const fallback = level.value === 'HIGH_SCHOOL' ? '106' : '125';
      weight.value = available.includes(preferred) ? preferred : (available.includes(fallback) ? fallback : available[0]);
      updateField();
    }
    function updateStates(preferred = '') {
      const states = SimSite.inventoryStates(eligibleRows());
      state.innerHTML = states.map((item) => `<option value="${e(item)}">${e(item)}</option>`).join('');
      state.value = states.includes(preferred) ? preferred : states[0];
      state.disabled = !states.length;
      updateWeights(String(SimSite.query('weight') || '').toUpperCase());
    }
    updateStates(String(SimSite.query('state') || '').toUpperCase());
    level.addEventListener('change', () => updateStates(''));
    state.addEventListener('change', () => updateWeights(''));
    weight.addEventListener('change', updateField);
    button.addEventListener('click', async () => {
      button.disabled = true; button.textContent = 'Building Bracket…';
      status.textContent = 'The engine is resolving every bout. Larger high-school fields may take a moment.';
      try {
        const guid = await SimApi.runTournament(state.value,weight.value,level.value);
        window.location.href = SimSite.tournamentUrl(guid);
      } catch (error) {
        status.textContent = error.message; button.textContent = 'Build the Bracket'; updateField();
      }
    });
  }

  const bracketCard = (bout) => {
    const firstWon = bout.winner_wrestler_guid === bout.wrestler_1_guid;
    return `<article class="bracket-match" data-bout-code="${e(bout.bout_code)}" data-order="${bout.bout_order}"><div class="bracket-match-label"><span>${e(bout.bout_code)}</span><small>${e(bout.round_name)}</small></div><div class="bracket-wrestler ${firstWon ? 'eventual-winner' : ''}" data-wrestler="${e(bout.wrestler_1_guid)}"><span>${bout.wrestler_1_seed}</span><a href="${SimSite.profileUrl(bout.wrestler_1_guid)}">${e(bout.wrestler_1_name)}</a><b class="bracket-score">${bout.wrestler_1_match_score}</b></div><div class="bracket-wrestler ${!firstWon ? 'eventual-winner' : ''}" data-wrestler="${e(bout.wrestler_2_guid)}"><span>${bout.wrestler_2_seed}</span><a href="${SimSite.profileUrl(bout.wrestler_2_guid)}">${e(bout.wrestler_2_name)}</a><b class="bracket-score">${bout.wrestler_2_match_score}</b></div><footer><span>${e(SimSite.resultLabel(bout.result_type))}</span><a href="${SimSite.matchUrl(bout.match_guid,`tournament.html?tournament=${tournamentGuid}`)}">PBP →</a></footer></article>`;
  };

  function bracketColumns(bouts, side) {
    const sideBouts = bouts.filter((bout) => side === 'CHAMPIONSHIP'
      ? bout.bracket_side === 'CHAMPIONSHIP'
      : bout.bracket_side !== 'CHAMPIONSHIP');
    const rounds = [];
    sideBouts.forEach((bout) => {
      let round = rounds.find((item) => item.code === bout.round_code);
      if (!round) { round = { code:bout.round_code,name:bout.round_name,bouts:[] }; rounds.push(round); }
      round.bouts.push(bout);
    });
    return rounds.map((round) => `<section class="bracket-column"><h3>${e(round.name)}</h3>${round.bouts.map(bracketCard).join('')}</section>`).join('');
  }

  async function renderTournament() {
    const payload = await SimApi.tournament(tournamentGuid);
    if (!payload?.tournament || !payload?.bracket?.length) throw new Error('The completed tournament could not be loaded.');
    const tournament = payload.tournament;
    const bouts = [...payload.bracket].sort((a,b) => a.bout_order-b.bout_order);
    const entries = payload.entries || [];
    const byes = payload.byes || [];
    const levelLabel = SimSite.levelLabel(tournament.competition_level || 'COLLEGE');
    const returnUrl = `index.html?level=${encodeURIComponent(tournament.competition_level || 'COLLEGE')}&state=${encodeURIComponent(tournament.state_code)}&weight=${encodeURIComponent(tournament.weight_class_code)}`;
    document.title = `${tournament.tournament_name} | Sim Wrestling`;
    root.innerHTML = `<section class="tournament-header"><div><p class="eyebrow">${e(levelLabel)} · Double elimination · Engine v0.1.3</p><h1>${e(tournament.tournament_name)}</h1><p>${tournament.entrant_qty} wrestlers · ${tournament.bout_qty} matches${byes.length ? ` · ${byes.length} bracket byes` : ' · no byes'}</p></div><div class="tournament-live"><span id="tournament-counter">Opening bracket</span><strong id="tournament-round">Seeds locked</strong></div></section>
      <div class="playback-controls tournament-controls"><p id="bracket-status">The completed tournament is being revealed bout by bout.</p><div class="control-buttons"><button id="bracket-pause" type="button">Pause</button><button id="bracket-show-all" type="button">Show all</button></div></div>
      <section class="bracket-section"><div class="bracket-section-heading"><span>Championship bracket</span><small>Winners advance toward the title</small></div><div class="bracket-grid championship-grid">${bracketColumns(bouts,'CHAMPIONSHIP')}</div></section>
      <section class="bracket-section consolation-section"><div class="bracket-section-heading"><span>Wrestlebacks</span><small>One more loss ends the tournament</small></div><div class="bracket-grid consolation-grid">${bracketColumns(bouts,'CONSOLATION')}</div></section>
      <section class="placements-panel" id="placements-panel" hidden><div><p class="eyebrow">Final standings</p><h2>Podium</h2></div><ol>${entries.filter((row) => row.final_placement).sort((a,b) => a.final_placement-b.final_placement).map((row) => `<li><span>${row.final_placement}</span><div><a href="${SimSite.profileUrl(row.wrestler_guid)}">${e(row.wrestler_name)}</a><small>No. ${row.seed_number} seed${row.team_name ? ` · ${e(row.team_name)}` : ' · Unattached'}</small></div></li>`).join('')}</ol></section>
      <div class="match-return"><a class="secondary-button" href="${returnUrl}">Return to Rankings</a></div>`;

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
      card?.classList.add('active-bout');
      card?.scrollIntoView({ behavior:'smooth',block:'nearest',inline:'nearest' });
      counter.textContent = `Bout ${bout.bout_order} of ${bouts.length}`; currentRound.textContent = bout.round_name;
    }
    function reveal(bout) {
      const card = cards.get(Number(bout.bout_order));
      card?.classList.add('revealed'); card?.classList.remove('active-bout');
      const winner = card?.querySelector(`[data-wrestler="${CSS.escape(bout.winner_wrestler_guid)}"]`);
      winner?.classList.add('bracket-winner-flash');
      const next = bouts.find((candidate) => candidate.bout_order>bout.bout_order && (candidate.wrestler_1_guid===bout.winner_wrestler_guid || candidate.wrestler_2_guid===bout.winner_wrestler_guid));
      if (next) cards.get(Number(next.bout_order))?.querySelector(`[data-wrestler="${CSS.escape(bout.winner_wrestler_guid)}"]`)?.classList.add('advancing-wrestler');
      window.setTimeout(() => document.querySelectorAll('.advancing-wrestler,.bracket-winner-flash').forEach((item) => item.classList.remove('advancing-wrestler','bracket-winner-flash')),1600);
      if (index===bouts.length) { placements.hidden=false; status.textContent='The tournament is complete.'; counter.textContent='Final'; currentRound.textContent=tournament.champion_wrestler_name; pause.disabled=true; }
    }
    function schedule() {
      clearTimeout(timer); if (paused || index>=bouts.length) return;
      const bout=bouts[index]; activate(bout);
      timer=setTimeout(() => { index+=1; reveal(bout); timer=setTimeout(schedule,900); },index===0?900:1800);
    }
    pause.addEventListener('click',() => { paused=!paused; pause.textContent=paused?'Resume':'Pause'; if (paused) clearTimeout(timer); else schedule(); });
    document.getElementById('bracket-show-all').addEventListener('click',() => { clearTimeout(timer); paused=true; while(index<bouts.length) reveal(bouts[index++]); placements.hidden=false; counter.textContent='Final'; currentRound.textContent=tournament.champion_wrestler_name; status.textContent='The tournament is complete.'; pause.textContent='Complete'; pause.disabled=true; });
    schedule();
  }

  try { if (tournamentGuid) await renderTournament(); else await renderSelector(); }
  catch (error) { SimSite.showError(root,error.message); }
})();
