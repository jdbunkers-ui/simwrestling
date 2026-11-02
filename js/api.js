(function () {
  const config = window.SIM_WRESTLING_CONFIG || {};
  const baseUrl = String(config.supabaseUrl || '').replace(/\/$/, '');
  const key = String(config.supabasePublishableKey || '');

  function isConfigured() {
    return baseUrl.startsWith('https://') &&
      !baseUrl.includes('YOUR-PROJECT') &&
      key.length > 20 &&
      !key.includes('YOUR-SUPABASE');
  }

  async function request(path, options = {}) {
    if (!isConfigured()) {
      throw new Error('Supabase is not configured. Update js/config.js before deploying.');
    }

    const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: key,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });

    let payload = null;
    const text = await response.text();
    if (text) {
      try { payload = JSON.parse(text); } catch (_) { payload = text; }
    }

    if (!response.ok) {
      const message = payload?.message || payload?.hint || `Supabase request failed (${response.status}).`;
      throw new Error(message);
    }
    return payload;
  }

  // v6.0.7: one fresh public identity directory per page, shared by all reads.
  // The transport below deliberately bypasses rpc() to avoid recursive loading.
  let identityPromise = null;
  let identities = new Map();
  let identityNames = new Map();
  function loadTeamIdentities() {
    if (!identityPromise) {
      identityPromise = (async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        try {
          const rows = await request('rpc/get_public_college_identities_v607', {
            method: 'POST', body: '{}', signal: controller.signal
          });
          if (!Array.isArray(rows)) throw new Error('Unexpected college identity directory response.');
          identities = new Map(rows.filter(row => row?.team_guid).map(row => [String(row.team_guid), row]));
          identityNames = new Map();
          for (const row of rows) {
            if (row?.base_team_name) {
              // A name-only fallback is used only where an older college payload lacks a GUID.
              const name = String(row.base_team_name);
              identityNames.set(name, identityNames.has(name) ? null : row);
            }
          }
          return rows;
        } catch (error) {
          console.warn('Current college identities unavailable; using supplied team labels:', error.message);
          return [];
        } finally { clearTimeout(timer); }
      })();
    }
    return identityPromise;
  }
  function teamIdentity(guid, fallbackName = '') {
    return guid ? identities.get(String(guid)) || null : identityNames.get(String(fallbackName)) || null;
  }
  function teamDisplayName(guid, fallbackName = '') {
    return teamIdentity(guid, fallbackName)?.display_name || fallbackName;
  }
  function applyTeamIdentities(value) {
    if (Array.isArray(value)) return value.map(applyTeamIdentities);
    if (!value || typeof value !== 'object') return value;
    const row = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, applyTeamIdentities(item)]));
    // Pair explicit team identifiers with their labels; never replace arbitrary text,
    // wrestler names, competition records, or stored database snapshots.
    for (const [nameKey, guidKey] of [
      ['team_name', 'team_guid'], ['team_1_name', 'team_1_guid'], ['team_2_name', 'team_2_guid'],
      ['opponent_team_name', 'opponent_team_guid'], ['opponent_name', 'opponent_team_guid'],
      ['home_team_name', 'home_team_guid'], ['away_team_name', 'away_team_guid'],
      ['winner_team_name', 'winner_team_guid'], ['loser_team_name', 'loser_team_guid'],
      ['final_team_name', 'final_team_guid'], ['author_team_name', 'author_team_guid']
    ]) {
      if (row[guidKey] && typeof row[nameKey] === 'string') {
        row[nameKey] = teamDisplayName(row[guidKey], row[nameKey]);
      }
    }
    const identity = row.team_guid && teamIdentity(row.team_guid);
    if (identity) {
      // Replace already-present cosmetic fields without changing payload structure.
      for (const key of ['primary_color', 'secondary_color', 'team_acronym']) {
        if (Object.prototype.hasOwnProperty.call(row, key) && identity[key]) row[key] = identity[key];
      }
    }
    return row;
  }
  async function withTeamIdentities(payloadPromise) {
    const [payload] = await Promise.all([payloadPromise, loadTeamIdentities()]);
    return applyTeamIdentities(payload);
  }

  function query(table, parameters = '') {
    return withTeamIdentities(request(`${table}${parameters ? `?${parameters}` : ''}`));
  }

  async function queryAll(table, parameters = '', pageSize = 500) {
    const rows = [];
    let offset = 0;

    while (true) {
      const page = await request(`${table}${parameters ? `?${parameters}` : ''}`, {
        headers: {
          Range: `${offset}-${offset + pageSize - 1}`,
          'Range-Unit': 'items'
        }
      });
      if (!Array.isArray(page)) throw new Error(`Unexpected response while loading ${table}.`);
      rows.push(...page);
      if (page.length < pageSize) break;
      offset += page.length;
    }

    await loadTeamIdentities();
    return applyTeamIdentities(rows);
  }

  function rpc(functionName, body) {
    return withTeamIdentities(request(`rpc/${functionName}`, {
      method: 'POST',
      body: JSON.stringify(body)
    }));
  }

  const encoded = (value) => encodeURIComponent(String(value));
  const filtered = (table, guidColumn, guid, order = '') => query(
    table,
    `select=*&${guidColumn}=eq.${encoded(guid)}${order ? `&order=${order}` : ''}`
  );

  window.SimApi = {
    isConfigured,
    loadTeamIdentities, teamIdentity, teamDisplayName, applyTeamIdentities,
    teamSortName: row => teamIdentity(row.team_guid)?.base_team_name || row.team_name,
    collegeIdentity: (guid) => rpc('get_college_identity_v459',{p_team_guid:guid}),
    gameUpdates: (options = {}) => rpc('get_public_game_updates_v454', {
      p_limit: options.limit || 51, p_offset: options.offset || 0
    }),
    season: () => query('v_public_season_context', 'select=*'),
    rankings: () => queryAll('v_public_competitor_directory_v2', 'select=*&order=competition_level.asc,wrestler_rank.asc,wrestler_guid.asc'),
    rankingsFiltered: (filters = {}) => rpc('get_public_rankings_v3_9_1', {
      p_competition_level: filters.level || 'COLLEGE',
      p_weight: filters.weight || '125',
      p_region_code: filters.region || null,
      p_state_code: filters.state || null,
      p_county_guid: filters.county || null,
      p_academic_stage: filters.year || null,
      p_search: filters.search || null,
      p_limit: filters.limit || 25
    }),
    geographyInventory: () => queryAll(
      'v_public_geography_inventory',
      'select=*&order=region_code.asc,state_code.asc,county_name.asc,locality_name.asc'
    ),
    regionStateInventory: () => query(
      'v_public_region_state_inventory',
      'select=*&order=region_code.asc,state_code.asc'
    ),
    teamRankings: () => queryAll('v_team_rankings_v2', 'select=*&order=region_code.asc,state_code.asc,state_team_rank.asc,team_guid.asc'),
    recruitingSeniors: () => queryAll(
      'v_public_recruiting_seniors',
      'select=*&order=national_recruiting_rank.asc,wrestler_guid.asc'
    ),
    recruitingClasses: () => queryAll(
      'v_college_recruiting_class_rankings',
      'select=*&order=game_season_number.desc,national_class_rank.asc,team_name.asc'
    ),
    teamProfile: (guid) => rpc('get_team_profile', { p_team_guid: guid }),
    publicTeamSnapshot: (guid) => rpc('get_public_college_team_snapshot_v448', { p_team_guid: guid }),
    teamWallOfFame: (guid) => rpc('get_team_wall_of_fame_v1', { p_team_guid: guid }),
    publicTeamCoaches: () => rpc('get_public_team_coaches_v448', {}),
    publicTeamIdentityBadges: () => loadTeamIdentities(),
    publicCollegeSchedule: () => rpc('get_public_college_schedule_v449', {}),
    // Core and history come from the last atomically completed profile cache.
    // Day-advance work can therefore run without blanking public profiles.
    profile: (guid) => rpc('get_public_wrestler_profile_core_v3_9_5', { p_wrestler_guid: guid }),
    profileCore: (guid) => rpc('get_public_wrestler_profile_core_v3_9_5', { p_wrestler_guid: guid }),
    seniorDecision: (guid) => rpc('get_public_senior_decision_v457', { p_wrestler_guid: guid }),
    profileHistory: (guid) => rpc('get_public_wrestler_profile_history_v3_9_5', { p_wrestler_guid: guid }),
    archivedProfile: (guid) => rpc('get_archived_college_wrestler_profile', { p_wrestler_guid: guid }),
    matchFeed: (guid) => query(
      'v_customer_match_experience',
      `select=*&match_guid=eq.${encodeURIComponent(guid)}&order=event_sequence.asc`
    ),
    dual: (guid) => rpc('get_dual_payload', { p_dual_guid: guid }),
    tournament: (guid) => rpc('get_tournament_payload', { p_tournament_guid: guid })
    ,leagueClock: async () => window.SimSite?.loadLeagueClock ? window.SimSite.loadLeagueClock() : (await query('v_current_league_clock', 'select=*'))?.[0] || null
    ,resultsContext: async () => (await query('v_public_results_context', 'select=*'))?.[0] || null
    ,leagueCalendar: (seasonGuid = '') => queryAll(
      'v_league_calendar',
      `select=*${seasonGuid ? `&season_guid=eq.${encoded(seasonGuid)}` : ''}&order=week_number.asc,starts_on.asc,event_name.asc,scheduled_event_guid.asc`
    )
    ,publicScheduleSummary: (seasonGuid = '') => queryAll(
      'v_public_schedule_summary',
      `select=*${seasonGuid ? `&season_guid=eq.${encoded(seasonGuid)}` : ''}&order=week_number.asc,scheduled_date.asc,competition_level.asc,event_name.asc`
    )
    ,resultsFiltered: (filters = {}) => rpc('get_public_results_v3_5_0', {
      p_competition_level: filters.level || null,
      p_region_code: filters.region || null,
      p_state_code: filters.state || null,
      p_week_number: filters.week ? Number(filters.week) : null,
      p_day_name: filters.day || null,
      p_limit: filters.limit || 500
    })
    ,leagueEvent: async (guid) => (await filtered('v_league_calendar', 'scheduled_event_guid', guid))?.[0] || null
    ,leagueSessions: (guid) => filtered('v_league_event_sessions', 'scheduled_event_guid', guid, 'session_number.asc')
    ,quadSchedule: (guid) => filtered('v_quad_schedule', 'scheduled_event_guid', guid, 'event_date.asc,event_name.asc')
    ,scheduledDuals: (guid) => filtered('v_scheduled_dual_results', 'scheduled_event_guid', guid, 'scheduled_date.asc,dual_order.asc')
    ,scheduledDivisions: (guid) => filtered('v_scheduled_tournament_divisions', 'scheduled_event_guid', guid, 'weight_display_order.asc')
    ,scheduledPlacements: (guid) => filtered('v_scheduled_tournament_placements', 'scheduled_event_guid', guid, 'weight_class_code.asc,final_placement.asc')
    ,eventTeamStandings: (guid) => filtered('v_event_team_standings', 'scheduled_event_guid', guid, 'team_placement.asc,total_points.desc')
    ,wrestlerAwards: (guid) => filtered('v_wrestler_awards', 'wrestler_guid', guid, 'game_season_number.desc,awarded_at.desc')
    ,teamAwards: (guid) => filtered('v_team_awards', 'team_guid', guid, 'game_season_number.desc,awarded_at.desc')
    ,wrestlerSeasonSummary: (guid) => filtered('v_wrestler_season_summary', 'wrestler_guid', guid, 'game_season_number.desc')
    ,wrestlerCareerSummary: (guid) => filtered('v_wrestler_career_summary', 'wrestler_guid', guid, 'competition_level.asc')
    ,teamSeasonSummary: (guid) => filtered('v_team_season_summary', 'team_guid', guid, 'game_season_number.desc')
    ,teamFullSchedule: (guid) => filtered('v_team_full_schedule', 'team_guid', guid, 'week_number.asc,scheduled_date.asc,dual_order.asc')
    ,tournamentBracketRows: (guid) => filtered('v_tournament_bracket', 'tournament_guid', guid, 'bout_order.asc')
    ,collegeIndividualHistory: () => queryAll('v_college_individual_championship_history', 'select=*&order=game_season_number.desc,placement.asc')
    ,collegeDualHistory: () => queryAll('v_college_dual_championship_history', 'select=*&order=game_season_number.desc,placement.asc')
    ,collegeTeamHistory: (guid) => filtered('v_college_team_season_history', 'team_guid', guid, 'game_season_number.desc')
    ,collegeTeamAccomplishments: (guid) => filtered('v_college_team_accomplishment_crosstab', 'team_guid', guid, 'achievement_level.asc')
    ,teamRoster: (guid) => filtered('v_college_team_roster_v3_9_0', 'team_guid', guid, 'weight_class_display_order.asc,depth_order.asc,wrestler_name.asc')
  };
})();
