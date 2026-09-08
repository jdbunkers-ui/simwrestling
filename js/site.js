(function () {
  const page = document.body.dataset.page || '';
  const links = [
    ['rankings', 'index.html', 'Rankings'],
    ['statistics', 'statistics.html', 'Statistics'],
    ['about', 'about.html', 'About']
  ];

  const header = document.querySelector('[data-site-header]');
  if (header) {
    header.innerHTML = `
      <header class="site-header">
        <div class="nav-shell">
          <a class="brand" href="index.html" aria-label="Sim Wrestling rankings">
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
    matchUrl(guid, returnTo = '') {
      const url = `match.html?match=${encodeURIComponent(guid)}`;
      return returnTo ? `${url}&return=${encodeURIComponent(returnTo)}` : url;
    },
    selectedWeight(rows, includeTeam = false) {
      const available = new Set(rows.map((row) => String(row.weight_class_code)));
      const requested = String(this.query('weight') || '').toUpperCase();
      if (includeTeam && requested === 'TEAM') return 'TEAM';
      if (requested === 'PBP' || requested === 'ALL') return 'PBP';
      if (available.has(requested)) return requested;
      return available.has('125') ? '125' : 'PBP';
    },
    weightOptions(rows, includeTeam = false) {
      const available = new Set(rows.map((row) => String(row.weight_class_code)));
      const options = [];
      if (includeTeam) options.push('<option value="TEAM">Team</option>');
      options.push('<option value="PBP">Pound-for-Pound</option>');
      this.weightOrder.forEach((weight) => {
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
    syncFilters(filters) {
      const url = new URL(window.location.href);
      Object.entries(filters).forEach(([name, value]) => {
        const text = String(value || '').trim();
        if (!text || (name === 'state' && text === 'ALL')) url.searchParams.delete(name);
        else url.searchParams.set(name, text);
      });
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    },
    duration(seconds) {
      const total = Math.max(0, Math.round(Number(seconds || 0)));
      return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
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
    showError(container, message) {
      container.innerHTML = `<div class="state-card error-state"><strong>We couldn't load this page.</strong><p>${this.escape(message)}</p></div>`;
    },
    configuredOrMessage(container) {
      if (window.SimApi.isConfigured()) return true;
      this.showError(container, 'Add your Supabase project URL and publishable key to js/config.js.');
      return false;
    }
  };
})();
