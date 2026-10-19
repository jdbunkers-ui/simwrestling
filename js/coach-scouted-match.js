/* Sim Wrestling v4.4.1 — authenticated scouted match viewer */
(async function () {
  'use strict';
  const root = document.getElementById('scouted-match-root');
  if (!root) return;
  const e = value => SimSite.escape(value ?? '');
  const matchGuid = String(SimSite.query('match') || '').trim();
  const packageGuid = String(SimSite.query('package') || '').trim();
  const returnUrl = `coach-recruiting.html?recruiting_tab=search${packageGuid ? `&package=${encodeURIComponent(packageGuid)}` : ''}`;

  function showFailure(message) {
    SimSite.showError(root, message);
    root.insertAdjacentHTML('beforeend', `<div class="match-return"><a class="secondary-button" href="${e(returnUrl)}">Return to Scouting Results</a></div>`);
  }

  if (!matchGuid) { showFailure('No scouted match was selected.'); return; }

  try {
    const auth = await window.SimAuth.ready;
    const {data:{user}, error:userError} = await auth.client.auth.getUser();
    if (userError || !user) { showFailure('Please sign in to view purchased scouting results.'); return; }
    const {data, error} = await auth.client.rpc(
      'get_my_scouted_match_experience_v4_4_1',
      {p_match_guid:matchGuid}
    );
    if (error) throw error;
    const events = Array.isArray(data) ? data : [];
    if (!events.length) throw new Error('No play-by-play events were returned for this match.');

    const first = events[0];
    document.title = `${first.wrestler_1_name} vs. ${first.wrestler_2_name} | Sim Wrestling`;
    root.innerHTML = `
      <section class="scoreboard" aria-label="Match scoreboard">
        <div class="scoreboard-top"><span id="score-period">${e(first.period)}</span><span>·</span><span id="score-time">${e(first.time_remaining)}</span></div>
        <div class="scoreboard-main">
          <div class="score-wrestler"><span>${e(first.wrestler_1_name)}</span><strong id="score-one">${Number(first.wrestler_1_score) || 0}</strong></div>
          <div class="clock"><strong id="event-number">1</strong><span>of ${events.length}</span></div>
          <div class="score-wrestler"><span>${e(first.wrestler_2_name)}</span><strong id="score-two">${Number(first.wrestler_2_score) || 0}</strong></div>
        </div>
      </section>
      <div class="playback-controls">
        <p>Purchased scouting report · completed match review</p>
        <div class="control-buttons"><button id="pause-button" type="button">Pause</button><button class="active" data-speed="1800" type="button">Review</button><button data-speed="700" type="button">Fast</button><button id="show-all" type="button">Show all</button></div>
      </div>
      <section class="pbp-feed" id="pbp-feed" aria-label="Match play-by-play"></section>
      <div class="match-return"><a class="secondary-button" href="${e(returnUrl)}">Return to Scouting Results</a></div>`;

    const feed = document.getElementById('pbp-feed');
    const period = document.getElementById('score-period');
    const time = document.getElementById('score-time');
    const scoreOne = document.getElementById('score-one');
    const scoreTwo = document.getElementById('score-two');
    const eventNumber = document.getElementById('event-number');
    const pause = document.getElementById('pause-button');
    let index = 0, delay = 1800, timer = null, paused = false;

    function flashScorer(element) {
      const wrestler = element.closest('.score-wrestler');
      wrestler.classList.remove('score-flash');
      void wrestler.offsetWidth;
      wrestler.classList.add('score-flash');
      window.setTimeout(() => wrestler.classList.remove('score-flash'), 3000);
    }

    function addEvent(event, eventIndex) {
      const final = eventIndex === events.length - 1;
      const previous = eventIndex > 0 ? events[eventIndex - 1] : event;
      const wrestlerOneScored = Number(event.wrestler_1_score) > Number(previous.wrestler_1_score);
      const wrestlerTwoScored = Number(event.wrestler_2_score) > Number(previous.wrestler_2_score);
      feed.insertAdjacentHTML('beforeend', `<article class="pbp-event ${wrestlerOneScored || wrestlerTwoScored ? 'scoring-event' : ''} ${final ? 'final-event' : ''}">
        <div class="event-time"><strong>${e(event.period)}</strong><span>${e(event.time_remaining)}</span></div>
        <div><p class="event-copy">${e(event.play_by_play)}</p><span class="event-score">${e(event.wrestler_1_name)} ${Number(event.wrestler_1_score) || 0} – ${Number(event.wrestler_2_score) || 0} ${e(event.wrestler_2_name)}</span></div>
      </article>`);
      period.textContent = event.period;
      time.textContent = event.time_remaining;
      scoreOne.textContent = Number(event.wrestler_1_score) || 0;
      scoreTwo.textContent = Number(event.wrestler_2_score) || 0;
      if (wrestlerOneScored) flashScorer(scoreOne);
      if (wrestlerTwoScored) flashScorer(scoreTwo);
      eventNumber.textContent = eventIndex + 1;
      feed.lastElementChild.scrollIntoView({behavior:'smooth',block:'nearest'});
    }

    function schedule() {
      clearTimeout(timer);
      if (paused || index >= events.length) return;
      timer = window.setTimeout(() => {
        addEvent(events[index], index);
        index += 1;
        schedule();
      }, index === 0 ? 200 : delay);
    }

    pause.addEventListener('click', () => {
      paused = !paused;
      pause.textContent = paused ? 'Resume' : 'Pause';
      if (paused) clearTimeout(timer); else schedule();
    });
    root.querySelectorAll('[data-speed]').forEach(button => button.addEventListener('click', () => {
      delay = Number(button.dataset.speed);
      root.querySelectorAll('[data-speed]').forEach(item => item.classList.toggle('active', item === button));
      if (!paused) schedule();
    }));
    document.getElementById('show-all').addEventListener('click', () => {
      clearTimeout(timer);
      paused = true;
      pause.textContent = 'Complete';
      pause.disabled = true;
      while (index < events.length) { addEvent(events[index], index); index += 1; }
    });
    schedule();
  } catch (error) {
    showFailure(error?.message || 'The scouted match could not be loaded.');
  }
})();
