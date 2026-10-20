/* Sim Wrestling v4.2.5 — private, spoiler-safe full-season dual schedule */
(async function () {
  'use strict';
  const root = document.getElementById('coach-matches-root');
  if (!root) return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const guid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || '')) ? String(value) : null;
  const n = value => Number.isFinite(Number(value)) ? Number(value) : null;
  const fmtDate = value => {
    if (!/^\d{4}-\d{2}-\d{2}/.test(String(value || ''))) return 'Date pending';
    const d = new Date(String(value).slice(0, 10) + 'T12:00:00Z');
    return d.toLocaleDateString('en-US', {weekday:'long', month:'short', day:'numeric', timeZone:'UTC'});
  };
  const formatScore = value => {
    const v = n(value);
    return v === null ? '—' : Number.isInteger(v) ? String(v) : v.toFixed(1);
  };
  const nav = `<nav class="coach-subnav" aria-label="Private coaching pages"><a href="coach.html">Team</a><a href="coach-recruiting.html">Recruits</a><a href="coach-matches.html" class="active" aria-current="page">Schedule</a><a href="coach-history.html">Wall of Fame</a></nav>`;
  const fail = message => {root.innerHTML = `<section class="panel coach-gate"><h1>Matches unavailable</h1><p>${esc(message)}</p><p><a href="coach.html">Back to Coach</a> · <a href="login.html">Sign in</a></p></section>`;};
  try {
    const auth = await window.SimAuth.ready;
    const {data: userData, error: userError} = await auth.client.auth.getUser();
    if (userError || !userData?.user) throw Error('Please sign in to view your team dual meets.');
    // The authenticated server RPC enforces active assignment and season entitlement.
    const {data, error} = await auth.client.rpc('get_my_coaching_matches_v4_2_5');
    if (error) throw error;
    if (!data?.team_guid || !Array.isArray(data.matches)) throw Error('The matches service did not return a complete schedule.');
    const matches = data.matches.slice().sort((a,b) => String(a.scheduled_date || '').localeCompare(String(b.scheduled_date || '')) || (Number(a.dual_order || 0) - Number(b.dual_order || 0)) || String(a.scheduled_dual_guid).localeCompare(String(b.scheduled_dual_guid)));
    const completed = matches.filter(m => m.completed === true && guid(m.dual_guid));
    let showResults = false; // Spoiler preference resets on every load, intentionally not persisted.
    document.title = `Matches — ${data.season_code || 'Current Season'} | Sim Wrestling`;
    root.innerHTML = `<section class="coach-live-hero"><div><p class="eyebrow">YOUR COLLEGE · CURRENT SEASON</p><h1>Team Dual Meets</h1><p>${esc(data.season_code || 'Current season')} · Complete dual schedule</p></div><div class="coach-hero-seal" aria-hidden="true">SW</div></section>
      ${nav}
      <section class="panel coach-matches-panel"><div class="coach-matches-heading"><div><p class="eyebrow">SEASON SCHEDULE</p><h2>From Opening Dual to Season Finale</h2><p class="coach-matches-intro">Watch every completed meet without seeing the score first. Opponent rankings and records reflect the current season.</p></div><button type="button" id="coach-reveal-results" class="coach-results-toggle" aria-pressed="false">Show Results</button></div>
        <div class="coach-match-summary"><span><strong>${matches.length}</strong> Dual meets</span><span><strong>${completed.length}</strong> Available to watch</span><span id="coach-spoiler-status" class="coach-spoiler-hidden">Results hidden</span></div>
        <div id="coach-matches-list" class="coach-matches-list" aria-live="polite"></div>
      </section>`;
    const list = document.getElementById('coach-matches-list');
    const toggle = document.getElementById('coach-reveal-results');
    const hint = document.getElementById('coach-spoiler-status');
    const render = () => {
      list.innerHTML = matches.length ? matches.map((m,i) => {
        const done = m.completed === true && !!guid(m.dual_guid);
        const opp = esc(m.opponent_name || 'Opponent pending');
        const state = String(m.opponent_state || '').trim().toUpperCase();
        const rank = n(m.opponent_state_rank);
        const record = esc(m.opponent_record || '0-0');
        const coachName = esc(m.opponent_coach || (m.opponent_control_type === 'HUMAN' ? 'Human Coach' : 'Computer Coach'));
        const cpu = m.opponent_control_type !== 'HUMAN';
        const type = m.match_type === 'Team Tournament Dual' ? 'Team Tournament Dual' : 'Scheduled Dual';
        const result = showResults && done ? `<span class="coach-match-score" aria-label="Final result">${esc(m.result || 'T')} ${formatScore(m.team_score)}–${formatScore(m.opponent_score)}</span>` : done ? `<span class="coach-score-hidden">Result hidden</span>` : `<span class="coach-match-upcoming">Upcoming</span>`;
        return `<article class="coach-match-row" aria-label="Dual ${i+1}"><div class="coach-match-date"><strong>Week ${esc(m.week_number ?? '—')}</strong><span>${esc(fmtDate(m.scheduled_date))}</span><small>${esc(type)}</small></div><div class="coach-match-opponent"><h3>${opp}${state ? ` <span class="coach-match-state">· ${esc(state)}</span>` : ''}</h3><p class="coach-match-meta">${rank && rank>0 ? `State #${rank}` : 'State unranked'} <span aria-hidden="true">·</span> ${record}</p><p class="coach-match-coach">${cpu ? '<span aria-hidden="true">▣</span> ' : '<span aria-hidden="true">♙</span> '}${cpu ? 'Computer Coach' : 'Coach: '+coachName}</p>${type === 'Team Tournament Dual' && m.round_code ? `<p class="coach-match-round">${esc(String(m.round_code).replace(/_/g,' '))}</p>` : ''}</div><div class="coach-match-action">${result}${done ? `<a class="coach-watch-dual" href="dual.html?dual=${encodeURIComponent(m.dual_guid)}" aria-label="Watch dual versus ${opp}">Watch Dual <span aria-hidden="true">↗</span></a>` : `<span class="coach-watch-pending">Awaiting simulation</span>`}</div></article>`;
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
