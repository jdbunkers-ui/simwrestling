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

  async function coachAnalyticsFromViews(guid) {
    const requests = {
      coach_overview: filtered('v_wrestler_coach_overview', 'wrestler_guid', guid),
      coach_neutral: filtered('v_wrestler_coach_neutral_analytics', 'wrestler_guid', guid),
      coach_mat: filtered('v_wrestler_coach_mat_analytics', 'wrestler_guid', guid),
      coach_scramble_discipline: filtered('v_wrestler_coach_scramble_discipline', 'wrestler_guid', guid),
      coach_moves: filtered('v_wrestler_coach_move_analytics', 'wrestler_guid', guid, 'offensive_uses.desc,move_name.asc'),
      coach_periods: filtered('v_wrestler_coach_period_analytics', 'wrestler_guid', guid, 'segment_number.asc'),
      coach_score_states: filtered('v_wrestler_coach_score_state_analytics', 'wrestler_guid', guid, 'score_state.asc'),
      coach_fatigue: filtered('v_wrestler_coach_fatigue_analytics', 'wrestler_guid', guid, 'fatigue_band.asc')
    };
    const names = Object.keys(requests);
    const settled = await Promise.allSettled(Object.values(requests));
    const rows = {};

    settled.forEach((result, index) => {
      const name = names[index];
      if (result.status === 'fulfilled') {
        rows[name] = Array.isArray(result.value) ? result.value : [];
      } else {
        rows[name] = [];
        console.warn(`Coach Analytics dataset failed: ${name}`, result.reason);
      }
    });

    const failed = settled.filter((result) => result.status === 'rejected');
    if (failed.length) throw new Error('Coach Analytics could not be loaded. Please try again.');

    return {
      coach_overview: rows.coach_overview[0] || {},
      coach_neutral: rows.coach_neutral[0] || {},
      coach_mat: rows.coach_mat[0] || {},
      coach_scramble_discipline: rows.coach_scramble_discipline[0] || {},
      coach_moves: rows.coach_moves,
      coach_periods: rows.coach_periods,
      coach_score_states: rows.coach_score_states,
      coach_fatigue: rows.coach_fatigue
    };
  }

  window.SimApi = {
    isConfigured,
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
    mediaStatistics: () => queryAll('v_public_competitor_statistics_v2', 'select=*&order=competition_level.asc,wrestler_rank.asc,wrestler_guid.asc'),
    mediaStatisticsFiltered: (filters = {}) => rpc('get_public_statistics_v3_9_0', {
      p_competition_level: filters.level || 'COLLEGE',
      p_weight: filters.weight || '125',
      p_region_code: filters.region || null,
      p_state_code: filters.state || null,
      p_county_guid: filters.county || null,
      p_locality_guid: filters.locality || null,
      p_search: filters.search || null,
      p_limit: filters.limit || 1000
    }),
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
    // The visible profile shell and historical ledger are deliberately split.
    // This prevents league-wide history work from blocking the initial page.
    profile: (guid) => rpc('get_public_wrestler_profile_core_v3_9_4', { p_wrestler_guid: guid }),
    profileCore: (guid) => rpc('get_public_wrestler_profile_core_v3_9_4', { p_wrestler_guid: guid }),
    profileHistory: (guid) => rpc('get_public_wrestler_profile_history_v3_9_4', { p_wrestler_guid: guid }),
    archivedProfile: (guid) => rpc('get_archived_college_wrestler_profile', { p_wrestler_guid: guid }),
    coachAnalytics: (guid) => rpc('get_wrestler_coach_analytics_v3_9_0', { p_wrestler_guid: guid }),
    matchFeed: (guid) => query(
      'v_customer_match_experience',
      `select=*&match_guid=eq.${encodeURIComponent(guid)}&order=event_sequence.asc`
    ),
    dual: (guid) => rpc('get_dual_payload', { p_dual_guid: guid }),
    tournament: (guid) => rpc('get_tournament_payload', { p_tournament_guid: guid })
    ,leagueClock: async () => (await query('v_current_league_clock', 'select=*'))?.[0] || null
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
