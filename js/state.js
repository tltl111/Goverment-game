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
    buildingCentre: false,
    centreBuildProgress: 0,
    militaryStrength: 0,

    // Economic sector levels (0–100), built by spending on corresponding policies
    industryLevel: 0,
    commerceLevel: 0,
    financeLevel: 0,

    // Trade routes opened via Finance level + treasury investment
    tradeRoutes: 0,

    // Funding 0-20 = percentage of tax income allocated to this policy
    policyFunding: {
      industry: 0,
      commerce: 0,
      finance: 0,
      infrastructure: 0,
      healthcare: 0,
      education: 0,
      military: 0,
    },

    unlockedTechs: [],

    eventLog: [
      { message: 'Welcome! Lead ' + (empireName || 'New Empire') + ' to prosperity!', type: 'info', year: 2024 }
    ],

    // UI state
    currentPolicyTab: 'all',
    currentDashboardTab: 'overview',
  };

  renderAll();
}
