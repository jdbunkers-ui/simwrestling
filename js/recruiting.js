(function () {
  const stateFilter = document.getElementById('recruiting-state');
  const prospectTitle = document.getElementById('prospect-title');
  const prospectBoard = document.getElementById('prospect-board');
  const scopeFilter = document.getElementById('class-scope');
  const regionFilter = document.getElementById('class-region');
  const stateClassFilter = document.getElementById('class-state');
  const regionControl = document.getElementById('class-region-control');
  const stateControl = document.getElementById('class-state-control');
  const classTitle = document.getElementById('class-title');
  const classBoard = document.getElementById('class-board');
  const e = SimSite.escape;

  const prospectNames = {
    DE: ['Mason Ford','Elijah Turner','Nolan Brooks','Carter Hayes','Andre Coleman','Isaiah Ward'],
    MD: ['Cameron Ellis','Micah Bennett','Julian Carter','Malcolm Reed','Owen Price','Darius Foster'],
    NJ: ['Micah Torres','Sean Walker','Dominic Russo','Caleb Morgan','Jayden Patel','Elias Rivera'],
    NY: ['Jayden Russo','Miles Johnson','Roman Delgado','Isaac Powell','Tyler Simmons','Noah Grant'],
    PA: ['Elijah Monroe','Gavin Porter','Malik Jenkins','Cole Harrison','Bryce Sullivan','Jonah Martin'],
    WV: ['Wyatt Harper','Logan Perry','Evan Fields','Nico Lawson','Silas Stone','Levi Barrett']
  };
  const weights = ['149','174','133','197','141','HWT'];
  const hometowns = {
    DE:['Wilmington','Dover','Newark','Milford','Seaford','Lewes'],
    MD:['Baltimore','Annapolis','Frederick','Rockville','Bowie','Hagerstown'],
    NJ:['Vineland','Morristown','Hoboken','Paterson','Jersey City','Wildwood'],
    NY:['Albany','Syracuse','Buffalo','Yonkers','Rochester','White Plains'],
    PA:['Philadelphia','Pittsburgh','Erie','Allentown','Scranton','Reading'],
    WV:['Morgantown','Charleston','Wheeling','Beckley','Huntington','Fairmont']
  };
  const schoolPool = [
    'Atlantic City University','Newark State','Jersey City University','Trenton State',
    'University of Paterson','Hoboken University','Pittsburgh State','Philadelphia Tech',
    'Baltimore University','Annapolis State','Albany University','Syracuse Tech',
    'Dover State','Wilmington University','Morgantown Tech','Charleston State'
  ];

  const teamNamesByState = {
    DE:['Rehoboth Coastal College','Seaford University','Millsboro State','Camden Delaware College','Lewes University','Dover State','Milford College','Wilmington Tech','Newark Delaware University','Georgetown State'],
    MD:['Baltimore University','Annapolis State','Frederick Tech','Rockville University','Bowie State','Hagerstown College','College Park A&M','Silver Spring University','Towson Tech','Ocean City State'],
    NJ:['Atlantic City University','Newark State','Jersey City University','Trenton State','University of Paterson','Hoboken University','University of Asbury Park','Morristown University','University of Cape May','Camden State'],
    NY:['Albany University','Syracuse Tech','Buffalo State','White Plains University','Rochester College','Yonkers State','Ithaca A&M','Utica University','Troy Tech','Poughkeepsie State'],
    PA:['Pittsburgh State','Philadelphia Tech','Erie University','Allentown State','Scranton College','Reading A&M','Harrisburg University','Bethlehem Tech','Lancaster State','State College University'],
    WV:['Morgantown Tech','Charleston State','Wheeling University','Beckley College','Huntington State','Fairmont University','Parkersburg Tech','Martinsburg State','Bluefield College','Clarksburg University']
  };
  const signeeFirst = ['Aiden','Malik','Roman','Caleb','Nico','Elijah','Mason','Andre','Jonah','Owen','Silas','Darius'];
  const signeeLast = ['Rivera','Brooks','Jenkins','Holloway','Bennett','Coleman','Patel','Monroe','Russo','Torres','Price','Walker'];

  function rankingSearch(params) {
    const query = new URLSearchParams(params);
    return `rankings.html?${query.toString()}`;
  }

  function prospectsFor(state) {
    return prospectNames[state].map((name, index) => ({
      rank: index + 1,
      name,
      state,
      hometown: hometowns[state][index],
      weight: weights[index],
      schools: schoolPool.slice(index, index + 3 + (index % 4)).map((school, order) => ({ school, order: order + 1 }))
    }));
  }

  function renderProspects() {
    const state = stateFilter.value;
    const rows = prospectsFor(state);
    prospectTitle.textContent = `${state} Most-Recruited High-School Wrestlers`;
    prospectBoard.innerHTML = rows.map((row) => `<article class="prospect-row">
      <span class="prospect-rank">${row.rank}</span>
      <div class="prospect-identity"><a href="${rankingSearch({ level:'HIGH_SCHOOL', state:row.state, weight:row.weight, q:row.name })}">${e(row.name)}</a><small>${e(row.hometown)}, ${e(row.state)} · ${e(row.weight)} lb · Senior</small></div>
      <div class="school-preferences"><span>Current preferred schools</span><ol>${row.schools.map((item) => `<li><b>${item.order}</b><a href="${rankingSearch({ weight:'TEAM', q:item.school })}">${e(item.school)}</a></li>`).join('')}</ol></div>
      <div class="interest-meter"><span>${6 - row.rank + 3} programs recruiting</span><i style="--interest:${96 - row.rank * 8}%"></i><small>Sample interest index</small></div>
    </article>`).join('');
  }

  function mockSignees(state, teamIndex) {
    return [0,1,2].map((offset) => {
      const name = `${signeeFirst[(teamIndex * 2 + offset) % signeeFirst.length]} ${signeeLast[(teamIndex + offset * 3) % signeeLast.length]}`;
      const weight = weights[(teamIndex + offset) % weights.length];
      return { name, weight, state };
    });
  }

  function stateClasses(state) {
    return teamNamesByState[state].map((team, index) => ({
      team,
      state,
      score: 94 - index * 3,
      signees: mockSignees(state, index)
    }));
  }

  function renderClasses() {
    const scope = scopeFilter.value;
    regionControl.hidden = scope !== 'REGION';
    stateControl.hidden = scope !== 'STATE';
    let rows;
    let label;
    if (scope === 'STATE') {
      rows = stateClasses(stateClassFilter.value);
      label = stateClassFilter.value;
    } else {
      const all = Object.keys(teamNamesByState).flatMap((state) => stateClasses(state));
      rows = all.sort((a, b) => b.score - a.score || a.team.localeCompare(b.team)).slice(0, 10);
      label = scope === 'REGION' ? 'Mid-Atlantic Regional' : 'National';
    }
    classTitle.textContent = `${label} Recruiting Class Rankings`;
    classBoard.innerHTML = rows.slice(0, 10).map((row, index) => `<article class="class-row">
      <span class="class-rank">${index + 1}</span>
      <div class="class-team"><a href="${rankingSearch({ weight:'TEAM', state:row.state, q:row.team })}">${e(row.team)}</a><small>${e(row.state)} · Season 2 recruiting class</small></div>
      <div class="class-score"><span>Class score</span><strong>${row.score}</strong></div>
      <div class="signee-list"><span>Signed high-school seniors</span>${row.signees.map((signee) => `<a href="${rankingSearch({ level:'COLLEGE', state:signee.state, weight:signee.weight, q:signee.name })}">${e(signee.name)} <small>${e(signee.weight)} lb</small></a>`).join('')}</div>
    </article>`).join('');
  }

  stateFilter.addEventListener('change', renderProspects);
  scopeFilter.addEventListener('change', renderClasses);
  regionFilter.addEventListener('change', renderClasses);
  stateClassFilter.addEventListener('change', renderClasses);
  renderProspects();
  renderClasses();
})();
