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

  function rpc(functionName, body) {
    return request(`rpc/${functionName}`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  window.SimApi = {
    isConfigured,
    season: () => query('v_public_season_context', 'select=*'),
    rankings: () => query('v_public_competitor_directory', 'select=*&order=competition_level.asc,wrestler_rank.asc'),
    mediaStatistics: () => query('v_public_competitor_statistics', 'select=*&order=competition_level.asc,wrestler_rank.asc'),
    teamRankings: () => query('v_team_rankings', 'select=*&order=state_code.asc,state_team_rank.asc'),
    teamProfile: (guid) => rpc('get_team_profile', { p_team_guid: guid }),
    profile: (guid) => rpc('get_wrestler_profile', { p_wrestler_guid: guid }),
    runMatch: (firstGuid, secondGuid) => rpc('run_demo_match', {
      p_wrestler_1_guid: firstGuid,
      p_wrestler_2_guid: secondGuid
    }),
    matchFeed: (guid) => query(
      'v_customer_match_experience',
      `select=*&match_guid=eq.${encodeURIComponent(guid)}&order=event_sequence.asc`
    ),
    runDual: (firstTeamGuid, secondTeamGuid) => rpc('run_demo_dual', {
      p_team_1_guid: firstTeamGuid,
      p_team_2_guid: secondTeamGuid
    }),
    dual: (guid) => rpc('get_dual_payload', { p_dual_guid: guid }),
    runTournament: (stateCode, weightClassCode, competitionLevel = 'COLLEGE') =>
      rpc(competitionLevel === 'HIGH_SCHOOL' ? 'run_demo_high_school_tournament' : 'run_demo_tournament', {
        p_state_code: stateCode,
        p_weight_class_code: weightClassCode
      }),
    tournament: (guid) => rpc('get_tournament_payload', { p_tournament_guid: guid })
  };
})();
