(async function () {
  const root = document.getElementById('match-root');
  const matchGuid = SimSite.query('match');
  const requestedReturn = SimSite.query('return') || '';
  const safeReturn = /^(dual|tournament|wrestler)\.html\?/.test(requestedReturn) ? requestedReturn : 'index.html';
  const returnLabel = safeReturn.startsWith('dual.html') ? 'Return to Dual Meet' : safeReturn.startsWith('tournament.html') ? 'Return to Tournament' : safeReturn.startsWith('wrestler.html') ? 'Return to Wrestler' : 'Return to Rankings';
  if (!matchGuid) {
    SimSite.showError(root, 'No match was selected.');
    root.insertAdjacentHTML('beforeend',`<div class="match-return"><a class="secondary-button" href="${SimSite.escape(safeReturn)}">${returnLabel}</a></div>`);
    return;
  }
  if (!window.SimSite.configuredOrMessage(root)) return;

  try {
    const events = await SimApi.matchFeed(matchGuid);
    if (!events.length) throw new Error('The match exists, but its public play-by-play is not available.');
    const first = events[0];
    document.title = `${first.wrestler_1_name} vs. ${first.wrestler_2_name} | Sim Wrestling`;
    root.innerHTML = `
      <section class="scoreboard" aria-label="Match scoreboard">
        <div class="scoreboard-top"><span id="score-period">${SimSite.escape(first.period)}</span><span>·</span><span id="score-time">${SimSite.escape(first.time_remaining)}</span></div>
        <div class="scoreboard-main">
          <div class="score-wrestler"><span>${SimSite.escape(first.wrestler_1_name)}</span><strong id="score-one">${first.wrestler_1_score}</strong></div>
          <div class="clock"><strong id="event-number">1</strong><span>of ${events.length}</span></div>
          <div class="score-wrestler"><span>${SimSite.escape(first.wrestler_2_name)}</span><strong id="score-two">${first.wrestler_2_score}</strong></div>
        </div>
      </section>
      <div class="playback-controls">
        <p>The completed match is being revealed at review speed.</p>
        <div class="control-buttons"><button id="pause-button" type="button">Pause</button><button class="active" data-speed="1800" type="button">Review</button><button data-speed="700" type="button">Fast</button><button id="show-all" type="button">Show all</button></div>
      </div>
      <section class="pbp-feed" id="pbp-feed" aria-label="Match play-by-play"></section>
      <div class="match-return"><a class="secondary-button" href="${SimSite.escape(safeReturn)}">${returnLabel}</a></div>`;

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
      const scoringEvent = wrestlerOneScored || wrestlerTwoScored;
      feed.insertAdjacentHTML('beforeend', `<article class="pbp-event ${scoringEvent ? 'scoring-event' : ''} ${final ? 'final-event' : ''}">
        <div class="event-time"><strong>${SimSite.escape(event.period)}</strong><span>${SimSite.escape(event.time_remaining)}</span></div>
        <div><p class="event-copy">${SimSite.escape(event.play_by_play)}</p><span class="event-score">${SimSite.escape(event.wrestler_1_name)} ${event.wrestler_1_score} – ${event.wrestler_2_score} ${SimSite.escape(event.wrestler_2_name)}</span></div>
      </article>`);
      period.textContent = event.period;
      time.textContent = event.time_remaining;
      scoreOne.textContent = event.wrestler_1_score;
      scoreTwo.textContent = event.wrestler_2_score;
      if (wrestlerOneScored) flashScorer(scoreOne);
      if (wrestlerTwoScored) flashScorer(scoreTwo);
      eventNumber.textContent = eventIndex + 1;
      feed.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function schedule() {
      clearTimeout(timer);
      if (paused || index >= events.length) return;
      timer = setTimeout(() => {
        addEvent(events[index], index);
        index += 1;
        schedule();
      }, index === 0 ? 200 : delay);
    }

    pause.addEventListener('click', () => {
      paused = !paused;
      pause.textContent = paused ? 'Resume' : 'Pause';
      if (!paused) schedule(); else clearTimeout(timer);
    });
    document.querySelectorAll('[data-speed]').forEach((button) => button.addEventListener('click', () => {
      delay = Number(button.dataset.speed);
      document.querySelectorAll('[data-speed]').forEach((item) => item.classList.toggle('active', item === button));
      if (!paused) schedule();
    }));
    document.getElementById('show-all').addEventListener('click', () => {
      clearTimeout(timer); paused = true; pause.textContent = 'Complete'; pause.disabled = true;
      while (index < events.length) { addEvent(events[index], index); index += 1; }
    });
    schedule();
  } catch (error) {
    SimSite.showError(root, error.message);
    root.insertAdjacentHTML('beforeend',`<div class="match-return"><a class="secondary-button" href="${SimSite.escape(safeReturn)}">${returnLabel}</a></div>`);
  }
})();
