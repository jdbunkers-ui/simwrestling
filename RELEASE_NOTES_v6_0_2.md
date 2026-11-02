# Sim Wrestling v6.0.2 — Game time displays

Baseline: Sim_Wrestling_Public_Prototype_v6_0_1_FULL.zip.

Upload the extracted CHANGES_ONLY contents to the GitHub dev branch, preserving paths.
Test the dev Vercel deployment before merging dev into main. No SQL is required.
The FULL archive contains the entire baseline plus this enhancement.

The shared site header displays Season N · Week N · Day N from the connected database.
It refreshes every minute while visible and when returning to the page.
Unavailable clock data is identified explicitly; no game position is guessed for the header.

Days use the seven-day engine clock: Sunday 1, Monday 2, Tuesday 3, Wednesday 4,
Thursday 5, Friday 6, Saturday 7. The old public schedule numbered its three meet
days 1–3; these now use the same seven-day numbering as the banner and coaching
schedule. Week 2 Tuesday therefore displays Day 3 · Tuesday.

Compact event labels use S5 · W2 · D3. Week-grouped schedules keep their week
heading and show only Day N · Weekday below it. Dates outside the eight-week
window display Preseason or Offseason, rather than incorrectly reporting Week 8.
Event date conversion uses the existing season-year convention and first Sunday
in August, with UTC date-only arithmetic. The header uses league_starts_on and
game_season_number returned by v_current_league_clock.

Updated surfaces: shared banner, public and private schedules, event timelines,
results dates, wrestle-off history, recruiting-closed screen, and current-season
labels. Raw dates remain in database values, sorting, filters, and link data.
Real-world Team Wall timestamps and release-note timestamps are unchanged.

Checks: JavaScript syntax, dev build, date boundaries and invalid dates,
UTC/Honolulu/Tokyo consistency, clock request sharing and failures, public schedule,
coach schedule and hidden/revealed results. Desktop and 390px preview inspected
with mock data. Live dev verification remains necessary after upload.

Many HTML files change only to invalidate the shared header/style cache. Pages
without configuration loading now load js/config.js before the shared header.
Vercel environment configuration and build safeguards are retained.

## Files changed from v6.0.1
- about-archive.html
- account.html
- assets/styles.css
- coach-history.html
- coach-identity.html
- coach-matches.html
- coach-prospect.html
- coach-recruiting.html
- coach-scouted-match.html
- coach-wrestler.html
- coach.html
- dual.html
- event.html
- forgot-password.html
- guide.html
- history.html
- index.html
- js/api.js
- js/coach-dashboard.js
- js/coach-matches.js
- js/coach-mock-pages.js
- js/coach-recruiting.js
- js/event.js
- js/rankings.js
- js/schedule.js
- js/site.js
- js/team.js
- login.html
- match.html
- rankings.html
- recruiting.html
- register.html
- reset-password.html
- results.html
- schedule.html
- team-wall.html
- team.html
- tournament.html
- updates.html
- wrestler.html
