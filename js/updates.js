(function () {
  'use strict';
  const site = window.SimSite;
  const api = window.SimApi;
  const rows = document.getElementById('updates-rows');
  const panel = document.getElementById('updates-panel');
  const status = document.getElementById('updates-status');
  const more = document.getElementById('updates-more');
  const retry = document.getElementById('updates-retry');
  const escape = site.escape;
  const pageSize = 50;
  const seen = new Set();
  let offset = 0;
  let busy = false;
  const engineLabels = { WRESTLING: 'Wrestling', RECRUITING: 'Recruiting', PLAYER_DEVELOPMENT: 'Player development' };
  const typeLabels = { BUG_FIX: 'Bug fix', BALANCE_ADJUSTMENT: 'Balance adjustment', ENHANCEMENT: 'Enhancement', NEW_FEATURE: 'New feature', RULE_CHANGE: 'Rule change' };
  const dateParts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
  const dateTime = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });

  function deployedDate(value) {
    const parts = Object.fromEntries(dateParts.formatToParts(new Date(value)).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }
  function fact(label, value) {
    return value === null || value === undefined || value === '' ? '' : `<dt>${escape(label)}</dt><dd>${escape(value)}</dd>`;
  }
  function renderEntry(entry) {
    // Use an allowlisted reference to create DOM IDs; escape all database text.
    if (!/^SW-\d+$/.test(entry.public_reference) || !Number.isFinite(Date.parse(entry.deployed_at))) {
      throw new Error('Invalid game update data.');
    }
    const ref = entry.public_reference;
    const detailId = `detail-${ref}`;
    const toggleId = `toggle-${ref}`;
    const tags = [...new Set(entry.engines || [])].map(engine => `<span class="updates-tag">${escape(engineLabels[engine] || engine)}</span>`).join('');
    const season = [entry.game_season_number ? `Season ${entry.game_season_number}` : '', entry.game_week_number ? `Week ${entry.game_week_number}` : ''].filter(Boolean).join(', ');
    return `<tr class="updates-entry"><td><time datetime="${escape(entry.deployed_at)}">${deployedDate(entry.deployed_at)}</time></td><td class="updates-reference">${escape(ref)}</td><td>
      <button class="updates-toggle" type="button" id="${toggleId}" aria-expanded="false" aria-controls="${detailId}" aria-label="${escape(ref + ': ' + entry.title)}"><span class="updates-arrow" aria-hidden="true">▸</span><span class="updates-summary"><span class="updates-title">${escape(entry.title)}</span><span class="updates-tags">${tags}</span></span></button>
      </td></tr><tr class="updates-detail" id="${detailId}" hidden><td colspan="3"><div class="updates-detail-inner" role="region" aria-labelledby="${toggleId}">
      <div class="updates-tags"><span class="updates-tag">${escape(typeLabels[entry.change_type] || entry.change_type)}</span><span class="updates-tag ${entry.significance === 'MAJOR' ? 'updates-major' : ''}">${entry.significance === 'MAJOR' ? 'Major change' : 'Minor change'}</span></div>
      <p>${escape(entry.description)}</p><div class="updates-impact"><strong>WHAT THIS MEANS FOR YOUR STRATEGY</strong><p>${escape(entry.coaching_impact)}</p></div>
      <dl class="updates-facts">${fact('Deployed', dateTime.format(new Date(entry.deployed_at)))}${fact('Game timing', season)}${fact('League date', entry.league_date)}${fact('Applies to', entry.application_scope)}${fact('Previous behavior', entry.previous_behavior)}${fact('Updated behavior', entry.updated_behavior)}</dl>
      </div></td></tr>`;
  }

  rows.addEventListener('click', event => {
    const button = event.target.closest('button[aria-controls]');
    if (!button || !rows.contains(button)) return;
    const expanded = button.getAttribute('aria-expanded') !== 'true';
    document.getElementById(button.getAttribute('aria-controls')).hidden = !expanded;
    button.setAttribute('aria-expanded', String(expanded));
    button.querySelector('.updates-arrow').textContent = expanded ? '▾' : '▸';
    button.closest('tr').classList.toggle('is-expanded', expanded);
  });

  async function load() {
    if (busy) return;
    busy = true;
    more.disabled = true;
    retry.hidden = true;
    status.hidden = false;
    status.dataset.error = 'false';
    status.textContent = offset ? 'Loading older updates…' : 'Loading game updates…';
    try {
      const result = await api.gameUpdates({ limit: pageSize + 1, offset });
      if (!Array.isArray(result)) throw new Error('Unexpected game update response.');
      const page = result.slice(0, pageSize);
      const fresh = page.filter(entry => !seen.has(entry.public_reference));
      const html = fresh.map(renderEntry).join('');
      rows.insertAdjacentHTML('beforeend', html);
      fresh.forEach(entry => seen.add(entry.public_reference));
      offset += page.length;
      panel.hidden = seen.size === 0;
      more.hidden = result.length <= pageSize;
      status.textContent = seen.size ? `${seen.size} deployed update${seen.size === 1 ? '' : 's'} shown.` : 'No game engine updates have been published yet.';
    } catch (error) {
      status.dataset.error = 'true';
      status.textContent = api.isConfigured()
        ? 'Game updates could not be loaded. Please try again.'
        : 'Game updates are not configured yet. Add the Supabase project URL and publishable key to js/config.js.';
      retry.hidden = false;
      more.hidden = true;
      console.error('Game Updates:', error);
    } finally {
      busy = false;
      more.disabled = false;
    }
  }
  more.addEventListener('click', load);
  retry.addEventListener('click', load);
  load();
})();
