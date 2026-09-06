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
    matchUrl(guid) {
      return `match.html?match=${encodeURIComponent(guid)}`;
    },
    percent(value, digits = 1) {
      return `${(Number(value || 0) * 100).toFixed(digits)}%`;
    },
    number(value, digits = 0) {
      return Number(value || 0).toFixed(digits);
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
