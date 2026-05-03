// ============================================================
// STATE — game state object and initialisation
// ============================================================

let G = null;

function initGame(empireName) {
  G = {
    empire: empireName || 'New Empire',
    year: 2024,
    turn: 1,
    treasury: -100,
    gdp: POPULATION_START * GDP_PER_CAPITA_START / 1000,  // derived: population × gdpPerCapita / 1000
    gdpGrowthRate: 0.00,   // base per-capita productivity growth rate (policies/techs add to this)
    population: POPULATION_START,      // millions
    gdpPerCapita: GDP_PER_CAPITA_START, // productivity index; GDP = population × gdpPerCapita / 1000
    territoryScore: TERRITORY_SCORE_START,
    agriculturalFactor: 1.0,     // multiplier on pop cap (raised by agricultural projects)
    populationCapTechFactor: 1.0, // multiplier on pop cap (raised by future techs)
    taxRate: 0.20,
    infraLevel: 10,
    happiness: 50,
    activeResearch: null,
    researchProgress: 0,

    // Economic sector levels (0–100), built by spending on corresponding policies
    miningLevel: 0,
    manufacturingLevel: 0,
    commerceLevel: 0,
    financeLevel: 0,

    // Social and military sector levels (0–100), built by spending on corresponding policies.
    // Effects come from accumulated levels, not current spending.
    healthcareLevel: 0,
    educationLevel: 0,
    militaryLevel: 0,

    // Research level (0 – ceiling). Ceiling starts at RESEARCH_LEVEL_BASE_CEILING and is raised
    // by completing research projects. Determines RP/turn toward active technology research.
    researchLevel: 0,

    // Projects
    completedProjects: [],   // array of completed project IDs
    projectProgress: {},     // { projectId: $M invested so far }
    projectFunding: {},      // { projectId: $M/turn allocation }

    // Trade routes — array of route objects { id, partnerId, maturity }
    tradeRoutes: [],
    nextTradeRouteId: 1,

    // Funding 0-20 = percentage of tax income allocated to this policy
    policyFunding: {
      mining: 0,
      manufacturing: 0,
      commerce: 0,
      finance: 0,
      infrastructure: 0,
      healthcare: 0,
      education: 0,
      military: 0,
      research: 0,
    },

    unlockedTechs: [],

    // Turn-by-turn snapshots for the Statistics screen (last 50 turns)
    history: [],

    eventLog: [
      { message: 'Welcome! Lead ' + (empireName || 'New Empire') + ' to prosperity!', type: 'info', year: 2024 }
    ],

    // UI state
    currentPolicyTab: 'all',
    currentDashboardTab: 'overview',
  };

  renderAll();
}
