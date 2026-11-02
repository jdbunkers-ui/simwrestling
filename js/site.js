(function () {
  const page = document.body.dataset.page || '';
  const links = [
    ['coach', 'coach.html', 'Coaching'],
    ['rankings', 'rankings.html', 'Rankings'],
    ['recruiting', 'recruiting.html', 'Recruiting'],
    ['schedule', 'schedule.html', 'Schedule'],
    ['history', 'history.html', 'History'],
    ['updates', 'updates.html', 'Game Engine'],
    ['guide', 'guide.html', 'Guide']
  ];
  const sharedFilterNames = ['level','weight','region','state','county','locality','q','week','day'];
  const storedFilters = (() => {
    try { return JSON.parse(sessionStorage.getItem('sim-wrestling-filters') || '{}'); }
    catch (_) { return {}; }
  })();
  let currentParameters = new URLSearchParams(window.location.search);
  sharedFilterNames.forEach((name) => {
    const value = currentParameters.get(name);
    if (value) storedFilters[name] = value;
  });
  if (!storedFilters.level) storedFilters.level = 'COLLEGE';
  if (!storedFilters.state) storedFilters.state = 'NJ';
  try { sessionStorage.setItem('sim-wrestling-filters', JSON.stringify(storedFilters)); } catch (_) {}

  function navigationUrl(href) {
    const url = new URL(href, window.location.href);
    sharedFilterNames.forEach((name) => {
      // v4.5.5: History navigation starts on Teams, independent of other pages' weight filters.
      if (name === 'weight' && url.pathname.endsWith('/history.html')) {
        url.searchParams.delete(name);
        return;
      }
      const value = currentParameters.get(name) || storedFilters[name];
      if (value) url.searchParams.set(name, value);
    });
    return `${url.pathname.split('/').pop()}${url.search}`;
  }

  const header = document.querySelector('[data-site-header]');
  if (header) {
    header.innerHTML = `
      <header class="site-header">
        <div class="nav-shell">
          <div class="brand-block"><a class="brand" href="index.html" aria-label="Sim Wrestling coaching portal">
            <span class="brand-mark" aria-hidden="true"><span></span></span>
            <span>SIM WRESTLING</span>
          </a><span class="game-clock" data-game-clock role="status" aria-live="polite">Loading game clock…</span></div>
          <nav class="main-nav" aria-label="Main navigation">
            ${links.map(([id, href, label]) => `
              <a href="${navigationUrl(href)}" ${page === id || (id === 'coach' && page.startsWith('coach')) ? 'aria-current="page"' : ''}>${label}</a>
            `).join('')}
          </nav>
        </div>
      </header>`;
  }

  // v4.0.0: Account navigation is intentionally independent of public data APIs.
  const mainNav = document.querySelector('.main-nav');
  if (mainNav) {
    const accountLink = document.createElement('a');
    accountLink.className = 'account-nav-link';
    accountLink.href = 'login.html';
    accountLink.textContent = 'Sign In';
    mainNav.appendChild(accountLink);
    const authPage = ['login', 'register', 'forgot-password', 'reset-password', 'account', 'coach', 'coach-wrestler', 'coach-recruiting', 'rankings'].includes(page);
    if (!authPage) {
      const loadAuth = document.createElement('script');
      loadAuth.src = 'js/auth.js?v=4.0.0';
      document.head.appendChild(loadAuth);
    }
  }

  const footer = document.querySelector('[data-site-footer]');
  if (footer) {
    footer.innerHTML = `
      <footer class="site-footer">
        <span>Sim Wrestling · Engine v0.1.3</span>
        <span>Developed by <a href="https://www.whiteblazeanalytics.com/" target="_blank" rel="noopener noreferrer">White Blaze Analytics</a></span>
      </footer>`;
  }

  window.SimSite = {
    collegeWeightOrder: ['125','133','141','149','157','165','174','184','197','HWT'],
    highSchoolWeightOrder: ['106','113','120','126','132','138','144','150','157','165','175','190','215','HWT'],
    weightOrder: ['125','133','141','149','157','165','174','184','197','HWT'],
    escape(value) {
      return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
      })[character]);
    },
    query(name) {
      return new URLSearchParams(window.location.search).get(name) || storedFilters[name] || null;
    },
    profileUrl(guid) {
      return `wrestler.html?wrestler=${encodeURIComponent(guid)}`;
    },
    prospectUrl(guid) {
      return `coach-prospect.html?wrestler=${encodeURIComponent(guid)}`;
    },
    teamUrl(guid) {
      return `team.html?team=${encodeURIComponent(guid)}`;
    },
    dualUrl(guid) {
      return `dual.html?dual=${encodeURIComponent(guid)}`;
    },
    tournamentUrl(guid) {
      return `tournament.html?tournament=${encodeURIComponent(guid)}`;
    },
    eventUrl(guid) {
      return `event.html?event=${encodeURIComponent(guid)}`;
    },
    matchUrl(guid, returnTo = '') {
      const url = `match.html?match=${encodeURIComponent(guid)}`;
      return returnTo ? `${url}&return=${encodeURIComponent(returnTo)}` : url;
    },
    selectedLevel() {
      return String(this.query('level') || 'COLLEGE').toUpperCase() === 'HIGH_SCHOOL'
        ? 'HIGH_SCHOOL' : 'COLLEGE';
    },
    weightOrderFor(level) {
      return level === 'HIGH_SCHOOL' ? this.highSchoolWeightOrder : this.collegeWeightOrder;
    },
    selectedWeight(rows, includeTeam = false, level = 'COLLEGE') {
      const available = new Set(rows.map((row) => String(row.weight_class_code)));
      const requested = String(this.query('weight') || '').toUpperCase();
      if (includeTeam && level === 'COLLEGE' && requested === 'TEAM') return 'TEAM';
      if (requested === 'PBP' || requested === 'ALL') return 'PBP';
      if (available.has(requested)) return requested;
      const preferred = level === 'HIGH_SCHOOL' ? '106' : '125';
      return available.has(preferred) ? preferred : (level === 'COLLEGE' ? 'PBP' : this.highSchoolWeightOrder.find((weight) => available.has(weight)) || '106');
    },
    weightOptions(rows, includeTeam = false, level = 'COLLEGE') {
      const available = new Set(rows.map((row) => String(row.weight_class_code)));
      const options = [];
      if (includeTeam && level === 'COLLEGE') options.push('<option value="TEAM">Team</option>');
      options.push('<option value="PBP">Pound-for-Pound</option>');
      this.weightOrderFor(level).forEach((weight) => {
        if (available.has(weight)) {
          const label = weight === 'HWT' ? 'HWT' : `${weight} lb`;
          options.push(`<option value="${this.escape(weight)}">${this.escape(label)}</option>`);
        }
      });
      return options.join('');
    },
    inventoryStates(rows) {
      return [...new Set(rows.map((row) => String(row.state_code || '').toUpperCase()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b));
    },
    inventoryRegions(rows) {
      const regions = new Map();
      rows.forEach((row) => {
        const code = String(row.region_code || '').trim();
        if (code) regions.set(code, String(row.region_name || code).trim());
      });
      return [...regions].map(([code, name]) => ({ code, name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    defaultRegionCode(rows) {
      const regions = this.inventoryRegions(rows);
      return regions.find((row) => row.name.toUpperCase().replace(/[^A-Z]/g,'') === 'MIDATLANTIC')?.code
        || regions.find((row) => row.code.toUpperCase().replace(/[^A-Z]/g,'') === 'MIDATLANTIC')?.code
        || regions[0]?.code || 'ALL';
    },
    syncFilters(filters) {
      const url = new URL(window.location.href);
      Object.entries(filters).forEach(([name, value]) => {
        const text = String(value || '').trim();
        const allGeography = ['region','state','county','locality'].includes(name) && text === 'ALL';
        if (!text || allGeography || (name === 'level' && text === 'COLLEGE')) url.searchParams.delete(name);
        else url.searchParams.set(name, text);
        if (sharedFilterNames.includes(name)) {
          if (text) storedFilters[name] = allGeography ? 'ALL' : text;
          else delete storedFilters[name];
        }
      });
      try { sessionStorage.setItem('sim-wrestling-filters', JSON.stringify(storedFilters)); } catch (_) {}
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
      currentParameters = new URLSearchParams(url.search);
      document.querySelectorAll('.main-nav a').forEach((link) => {
        const base = link.getAttribute('href').split('?')[0];
        link.setAttribute('href', navigationUrl(base));
      });
    },
    duration(seconds) {
      const total = Math.max(0, Math.round(Number(seconds || 0)));
      return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
    },
    // League days are calendar days: Sunday=1 through Saturday=7.
    // Schedule calculations use UTC date-only arithmetic, never browser time.
    gamePosition(value, context = {}) {
      const raw = String(value || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
      const date = new Date(raw + 'T00:00:00Z');
      if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== raw) return null;
      const seasonMatch = String(context.season_code || context.season_name || '').match(/^(\d{4})[_-]/);
      const year = seasonMatch ? Number(seasonMatch[1]) : date.getUTCFullYear() - (date.getUTCMonth() < 7 ? 1 : 0);
      const first = new Date(Date.UTC(year, 7, 1));
      first.setUTCDate(1 + (7 - first.getUTCDay()) % 7);
      const explicitBase = context.league_starts_on && new Date(String(context.league_starts_on).slice(0,10) + 'T00:00:00Z');
      const base = explicitBase || first;
      if (!Number.isFinite(base.getTime())) return null;
      const season = Number(context.game_season_number || context.season_number) || base.getUTCFullYear() - 2025;
      const offset = Math.round((date - base) / 86400000);
      return {season: season > 0 ? season : null, week: Math.floor(offset / 7) + 1,
        day: date.getUTCDay() + 1, weekday: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][date.getUTCDay()],
        phase: offset < 0 ? 'Preseason' : offset > 55 ? 'Offseason' : null};
    },
    gameDate(value, includeSeason = true, context = {}) {
      const position = this.gamePosition(value, context);
      if (!position) return 'Game day unavailable';
      const prefix = includeSeason && position.season ? `S${position.season} · ` : '';
      return position.phase ? prefix + position.phase : `${prefix}W${position.week} · D${position.day}`;
    },
    gameDay(value) {
      const position = this.gamePosition(value);
      return position ? `Day ${position.day} · ${position.weekday}` : 'Day pending';
    },
    date(value, includeSeason = false, context = {}) {
      return this.gameDate(value, includeSeason, context);
    },
    seasonLabel(row) {
      const year = String(row?.season_code || row?.season_name || '').match(/^(\d{4})[_-]/);
      const season = Number(row?.game_season_number || row?.season_number) || (year ? Number(year[1]) - 2025 : 0);
      return season > 0 ? `Season ${season}` : row?.game_season_display || 'Current season';
    },
    percent(value, digits = 1) {
      return `${(Number(value || 0) * 100).toFixed(digits)}%`;
    },
    number(value, digits = 0) {
      return Number(value || 0).toFixed(digits);
    },
    resultLabel(value) {
      return String(value || '').replaceAll('_', ' ').toLocaleLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
    },
    levelLabel(value) {
      return value === 'HIGH_SCHOOL' ? 'High School' : 'College';
    },
    showError(container, message) {
      container.innerHTML = `<div class="state-card error-state"><strong>We couldn't load this page.</strong><p>${this.escape(message)}</p></div>`;
    },
    configuredOrMessage(container) {
      if (window.SimApi.isConfigured()) return true;
      this.showError(container, 'Add your Supabase project URL and publishable key to js/config.js.');
      return false;
    },
    mobileCollapsibles(container) {
      const mobile = window.matchMedia('(max-width: 680px)');
      [...container.querySelectorAll('[data-collapse-label]')].forEach((section) => {
        if (section.parentElement?.classList.contains('mobile-collapsible')) return;
        const details = document.createElement('details');
        details.className = 'mobile-collapsible';
        details.open = !mobile.matches || section.dataset.mobileOpen === 'true';
        const summary = document.createElement('summary');
        summary.innerHTML = `<span>${this.escape(section.dataset.collapseLabel)}</span><small>Show / hide</small>`;
        section.parentNode.insertBefore(details, section);
        details.append(summary, section);
        mobile.addEventListener('change', (event) => {
          details.open = !event.matches || section.dataset.mobileOpen === 'true';
        });
      });
    }
  };

  let clockRequest = null, clockValue = null, clockLoadedAt = 0;
  window.SimSite.loadLeagueClock = function(force = false) {
    if (clockRequest) return clockRequest;
    if (!force && clockValue && Date.now() - clockLoadedAt < 15000) return Promise.resolve(clockValue);
    clockRequest = (async () => {
      const config = window.SIM_WRESTLING_CONFIG || {};
      if (!config.supabaseUrl || !config.supabasePublishableKey) throw Error('Game clock unavailable');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(String(config.supabaseUrl).replace(/\/$/,'') + '/rest/v1/v_current_league_clock?select=*', {
          headers: {apikey:config.supabasePublishableKey}, signal:controller.signal, cache:'no-store'
        });
        if (!response.ok) throw Error('Game clock unavailable');
        const rows = await response.json();
        if (!Array.isArray(rows) || rows.length !== 1 || !rows[0]?.league_starts_on || !Number(rows[0]?.game_season_number)) throw Error('Game clock unavailable');
        clockValue = rows[0]; clockLoadedAt = Date.now();
        return clockValue;
      } finally { clearTimeout(timer); }
    })().finally(() => {clockRequest = null;});
    return clockRequest;
  };
  async function updateGameClock() {
    const badge = document.querySelector('[data-game-clock]');
    if (!badge || document.hidden) return;
    try {
      const clock = await window.SimSite.loadLeagueClock(true);
      const position = window.SimSite.gamePosition(clock.current_league_date, clock);
      if (!position) throw Error('Game clock unavailable');
      badge.textContent = position.phase
        ? `Season ${position.season} · ${position.phase}`
        : `Season ${position.season} · Week ${position.week} · Day ${position.day}`;
      badge.title = position.phase || `${position.weekday} · Sunday is Day 1; Saturday is Day 7`;
    } catch (_) {
      badge.textContent = 'Game clock unavailable';
      badge.title = 'The current game position could not be loaded. Refresh to retry.';
    }
  }
  if (header) {
    updateGameClock();
    setInterval(updateGameClock, 60000);
    document.addEventListener('visibilitychange', updateGameClock);
    window.addEventListener('focus', updateGameClock);
  }
})();

/* v6.0.7: compact, accessible current-college identity in public lists. */
(function () {
  const safeColor = value => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : null;
  function foreground(hex) {
    const rgb = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255)
      .map(x => x <= 0.04045 ? x/12.92 : ((x+0.055)/1.055)**2.4);
    return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722 > 0.179 ? '#102b43' : '#ffffff';
  }
  SimSite.teamIdentityBadge = function (guid, fallbackName = '') {
    const identity = window.SimApi?.teamIdentity(guid, fallbackName);
    const primary = safeColor(identity?.primary_color);
    const secondary = safeColor(identity?.secondary_color);
    const acronym = String(identity?.team_acronym || '').trim().slice(0,8);
    if (!identity || !primary || !acronym) return '';
    return `<span class="college-identity-mini" aria-hidden="true" style="background:${primary};color:${foreground(primary)};border-color:${secondary || primary}">${SimSite.escape(acronym)}</span>`;
  };
  SimSite.collegeLink = function (guid, fallbackName = '') {
    const identity = window.SimApi?.teamIdentity(guid, fallbackName);
    const name = identity?.display_name || fallbackName;
    const teamGuid = guid || identity?.team_guid;
    if (!teamGuid) return SimSite.escape(name);
    return `<a class="college-identity-link" href="${SimSite.teamUrl(teamGuid)}">${SimSite.teamIdentityBadge(teamGuid)}<span>${SimSite.escape(name)}</span></a>`;
  };
})();
