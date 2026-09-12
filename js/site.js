(function () {
  const page = document.body.dataset.page || '';
  const links = [
    ['coaching', 'index.html', 'Coaching'],
    ['rankings', 'rankings.html', 'Rankings'],
    ['statistics', 'statistics.html', 'Statistics'],
    ['recruiting', 'recruiting.html', 'Recruiting'],
    ['schedule', 'schedule.html', 'Schedule'],
    ['about', 'about.html', 'About']
  ];

  const header = document.querySelector('[data-site-header]');
  if (header) {
    header.innerHTML = `
      <header class="site-header">
        <div class="nav-shell">
          <a class="brand" href="index.html" aria-label="Sim Wrestling coaching portal">
            <span class="brand-mark" aria-hidden="true"><span></span></span>
            <span>SIM WRESTLING</span>
          </a>
          <nav class="main-nav" aria-label="Main navigation">
            ${links.map(([id, href, label]) => `
              <a href="${href}" ${page === id ? 'aria-current="page"' : ''}>${label}</a>
            `).join('')}
          </nav>
        </div>
      </header>`;
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
      return new URLSearchParams(window.location.search).get(name);
    },
    profileUrl(guid) {
      return `wrestler.html?wrestler=${encodeURIComponent(guid)}`;
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
      if (level === 'COLLEGE' && (requested === 'PBP' || requested === 'ALL')) return 'PBP';
      if (available.has(requested)) return requested;
      const preferred = level === 'HIGH_SCHOOL' ? '106' : '125';
      return available.has(preferred) ? preferred : (level === 'COLLEGE' ? 'PBP' : this.highSchoolWeightOrder.find((weight) => available.has(weight)) || '106');
    },
    weightOptions(rows, includeTeam = false, level = 'COLLEGE') {
      const available = new Set(rows.map((row) => String(row.weight_class_code)));
      const options = [];
      if (includeTeam && level === 'COLLEGE') options.push('<option value="TEAM">Team</option>');
      if (level === 'COLLEGE') options.push('<option value="PBP">Pound-for-Pound</option>');
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
    syncFilters(filters) {
      const url = new URL(window.location.href);
      Object.entries(filters).forEach(([name, value]) => {
        const text = String(value || '').trim();
        const allGeography = ['region','state','county','locality'].includes(name) && text === 'ALL';
        if (!text || allGeography || (name === 'level' && text === 'COLLEGE')) url.searchParams.delete(name);
        else url.searchParams.set(name, text);
      });
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    },
    duration(seconds) {
      const total = Math.max(0, Math.round(Number(seconds || 0)));
      return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
    },
    date(value, includeYear = false) {
      if (!value) return '—';
      const text = String(value).slice(0, 10);
      const parsed = new Date(`${text}T12:00:00`);
      if (Number.isNaN(parsed.getTime())) return text;
      return parsed.toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', ...(includeYear ? { year: 'numeric' } : {})
      });
    },
    seasonLabel(row) {
      return row?.game_season_display || (row?.game_season_number ? `Season ${row.game_season_number}` : 'Current season');
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
})();
