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
    gdp: 5,          // in billions
    gdpGrowthRate: 0.00,
    taxRate: 0.20,
    infraLevel: 10,
    happiness: 50,
    researchCentres: 0,
    activeResearch: null,
    researchProgress: 0,
    buildingResearchCentre: false,
    researchCentreBuildProgress: 0,
    researchCentreBuildFraction: 50,  // % of infra budget sent to construction (rest goes to repair)
    militaryStrength: 0,

    // Economic sector levels (0–100), built by spending on corresponding policies
    miningLevel: 0,
    manufacturingLevel: 0,
    commerceLevel: 0,
    financeLevel: 0,

    // Trade routes opened via Finance level + treasury investment
    tradeRoutes: 0,

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
