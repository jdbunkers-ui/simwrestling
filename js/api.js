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

  function query(table, parameters = '') {
    return request(`${table}${parameters ? `?${parameters}` : ''}`);
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

    return rows;
  }

  function rpc(functionName, body) {
    return request(`rpc/${functionName}`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  const encoded = (value) => encodeURIComponent(String(value));
  const filtered = (table, guidColumn, guid, order = '') => query(
    table,
    `select=*&${guidColumn}=eq.${encoded(guid)}${order ? `&order=${order}` : ''}`
  );

  window.SimApi = {
    isConfigured,
    season: () => query('v_public_season_context', 'select=*'),
    rankings: () => queryAll('v_public_competitor_directory_v2', 'select=*&order=competition_level.asc,wrestler_rank.asc,wrestler_guid.asc'),
    mediaStatistics: () => queryAll('v_public_competitor_statistics_v2', 'select=*&order=competition_level.asc,wrestler_rank.asc,wrestler_guid.asc'),
    teamRankings: () => queryAll('v_team_rankings_v2', 'select=*&order=region_code.asc,state_code.asc,state_team_rank.asc,team_guid.asc'),
    teamProfile: (guid) => rpc('get_team_profile', { p_team_guid: guid }),
    profile: (guid) => rpc('get_wrestler_profile', { p_wrestler_guid: guid }),
    matchFeed: (guid) => query(
      'v_customer_match_experience',
      `select=*&match_guid=eq.${encodeURIComponent(guid)}&order=event_sequence.asc`
    ),
    dual: (guid) => rpc('get_dual_payload', { p_dual_guid: guid }),
    tournament: (guid) => rpc('get_tournament_payload', { p_tournament_guid: guid })
    ,leagueClock: async () => (await query('v_current_league_clock', 'select=*'))?.[0] || null
    ,leagueCalendar: () => query('v_league_calendar', 'select=*&order=week_number.asc,starts_on.asc,event_name.asc')
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
    ,teamSeasonSummary: (guid) => filtered('v_team_season_summary', 'team_guid', guid, 'game_season_number.desc')
    ,tournamentBracketRows: (guid) => filtered('v_tournament_bracket', 'tournament_guid', guid, 'bout_order.asc')
  };
})();
