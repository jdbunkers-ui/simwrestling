/* Sim Wrestling v4.2.5 — private, spoiler-safe full-season dual schedule */
(async function () {
  'use strict';
  const root = document.getElementById('coach-matches-root');
  if (!root) return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const guid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || '')) ? String(value) : null;
  const n = value => Number.isFinite(Number(value)) ? Number(value) : null;
  const formatScore = value => {
    const v = n(value);
    return v === null ? '—' : Number.isInteger(v) ? String(v) : v.toFixed(1);
  };
  const stateNames = {AL:'Alabama',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming'};
  const stateFull = code => stateNames[String(code||'').trim().toUpperCase()] || String(code||'—');
  const nav = `<nav class="coach-subnav" aria-label="Private coaching pages"><a href="coach.html">Team</a><a href="coach-recruiting.html">Recruits</a><a href="coach-matches.html" class="active" aria-current="page">Schedule</a><a href="coach-history.html">Wall of Fame</a><a href="coach-identity.html">Identity</a></nav>`;
  const fail = message => {root.innerHTML = `<section class="panel coach-gate"><h1>Matches unavailable</h1><p>${esc(message)}</p><p><a href="coach.html">Back to Coach</a> · <a href="login.html">Sign in</a></p></section>`;
    };
  try {
    const auth = await window.SimAuth.ready;
    const {data: userData, error: userError} = await auth.client.auth.getUser();
    if (userError || !userData?.user) throw Error('Please sign in to view your team dual meets.');
    // The authenticated server RPC enforces active assignment and season entitlement.
    const {data, error} = await auth.client.rpc('get_my_coaching_matches_v4_2_5');
    if (error) throw error;
    if (!data?.team_guid || !Array.isArray(data.matches)) throw Error('The matches service did not return a complete schedule.');
    await SimApi.loadTeamIdentities();
    const collegeIdentity=await CoachIdentityBanner.load(auth.client,data.team_guid);
    const matches = data.matches.slice().sort((a,b) => String(a.scheduled_date || '').localeCompare(String(b.scheduled_date || '')) || (Number(a.dual_order || 0) - Number(b.dual_order || 0)) || String(a.scheduled_dual_guid).localeCompare(String(b.scheduled_dual_guid)));
    const completed = matches.filter(m => m.completed === true && guid(m.dual_guid));
    let showResults = false; // Spoiler preference resets on every load, intentionally not persisted.
    document.title = `Matches — ${SimSite.seasonLabel(data)} | Sim Wrestling`;
    root.innerHTML = `${CoachIdentityBanner.render({identity:collegeIdentity,teamName:data.team_name||'My College',context:'CURRENT SEASON',detail:SimSite.seasonLabel(data)+' · Team dual meets'})}
      ${nav}
      <section class="panel coach-matches-panel"><div class="coach-matches-heading"><div><p class="eyebrow">SEASON SCHEDULE</p><h2>From Opening Dual to Season Finale</h2><p class="coach-matches-intro">Watch every completed meet without seeing the score first. Opponent rankings and records reflect the current season.</p></div><button type="button" id="coach-reveal-results" class="coach-results-toggle" aria-pressed="false">Show Results</button></div>
        <div class="coach-match-summary"><span><strong>${matches.length}</strong> Dual meets</span><span><strong>${completed.length}</strong> Available to watch</span><span id="coach-spoiler-status" class="coach-spoiler-hidden">Results hidden</span></div>
        <div class="sw-v8-schedule-heading"><span>Week / Day</span><span>State Rank</span><span>Record</span><span>College Name</span><span>State</span><span>Result</span></div><div id="coach-matches-list" class="coach-matches-list" aria-live="polite"></div>
      </section>`;
    CoachIdentityBanner.apply(root,collegeIdentity);
    const list = document.getElementById('coach-matches-list');
    const toggle = document.getElementById('coach-reveal-results');
    const hint = document.getElementById('coach-spoiler-status');
    const render = () => {
      list.innerHTML = matches.length ? matches.map((m,i) => {
        const done = m.completed === true && !!guid(m.dual_guid);
        const opponentGuid = m.opponent_team_guid || m.opponent_guid;
        const opponentName = SimApi.teamDisplayName(opponentGuid,m.opponent_name || 'Opponent pending');
        const opp = esc(opponentName);
        const opponentBadge = SimSite.teamIdentityBadge(opponentGuid,m.opponent_name);
        const state = String(m.opponent_state || '').trim().toUpperCase();
        const rank = n(m.opponent_state_rank);
        const record = esc(m.opponent_record || '0-0');
        const coachName = esc(m.opponent_coach || (m.opponent_control_type === 'HUMAN' ? 'Human Coach' : 'Computer Coach'));
        const cpu = m.opponent_control_type !== 'HUMAN';
        const type = m.match_type === 'Team Tournament Dual' ? 'Team Tournament Dual' : 'Scheduled Dual';
        const result = showResults && done ? `<span class="coach-match-score" aria-label="Final result">${esc(m.result || 'T')} ${formatScore(m.team_score)}–${formatScore(m.opponent_score)}</span>` : done ? `<span class="coach-score-hidden">Result hidden</span>` : `<span class="coach-match-upcoming">Upcoming</span>`;
        return `<article class="coach-match-row sw-v8-schedule-row" aria-label="Dual ${i+1}">
          <div class="coach-match-date"><strong>Week ${esc(m.week_number ?? '—')}</strong><span class="sw-v8-day">${esc(SimSite.gameDay(m.scheduled_date))}</span><small>${esc(type)}</small></div>
          <div class="sw-v8-schedule-rank">${rank && rank>0 ? `#${rank}` : '—'}</div>
          <div class="sw-v8-schedule-record">${record}</div>
          <div class="coach-match-opponent sw-v8-schedule-opponent"><h3>${opponentBadge}${opp}</h3><p class="coach-match-coach">${cpu ? '▣ Computer Coach' : 'Coach: '+coachName}</p></div>
          <div class="sw-v8-schedule-state">${esc(stateFull(state))}</div>
          <div class="coach-match-action">${result}${done ? `<a class="coach-watch-dual" href="dual.html?dual=${encodeURIComponent(m.dual_guid)}" aria-label="Watch dual versus ${opp}">Watch Dual <span aria-hidden="true">↗</span></a>` : `<span class="coach-watch-pending">Awaiting simulation</span>`}</div>
        </article>`;
      }).join('') : '<div class="coach-empty-note">No team dual meets are scheduled for this season.</div>';
      toggle.textContent = showResults ? 'Hide Results' : 'Show Results';
      toggle.setAttribute('aria-pressed', String(showResults));
      hint.textContent = showResults ? 'Results visible' : 'Results hidden';
      hint.className = showResults ? 'coach-spoiler-shown' : 'coach-spoiler-hidden';
    };
    toggle.addEventListener('click', () => {showResults = !showResults; render();});
    render();
  } catch (err) {fail(err?.message || 'Unable to retrieve the team schedule.');}
})();
