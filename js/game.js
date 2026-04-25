// ============================================================
// GOVERNMENT SIMULATOR — game.js
// ============================================================

// Baseline spending ($M) at which policy effects equal the values defined in POLICIES.
// = starting GDP ($50B) × starting tax rate (22%) × 10 × max funding (20%)
// Effects scale linearly with actual spending relative to this amount.
const POLICY_REFERENCE_SPEND = 20;

// Research centre constants
const CENTRE_BUILD_COST      = 1000;  // $1,000M of infrastructure spend to build one centre

// Infrastructure scaling
const INFRA_REPAIR_PER_M     = 1.0;   // base levels gained per $1M spent (at level 0)
const INFRA_REPAIR_HARDNESS  = 0.04;  // each level makes repair harder: rate ÷ (1 + hardness×level)
const INFRA_DECAY_BASE       = 2;     // levels lost/turn at level 0 with no funding
const INFRA_DECAY_SCALE      = 0.10;  // extra decay per level (level 100 → −12/turn)

const RP_PER_CENTRE          = 3;     // base RP/turn per centre

// Treasury interest (scaling)
// Debt rate grows with debt: rate = DEBT_INTEREST_SCALE × √|debt|, capped at DEBT_INTEREST_MAX
// Savings rate diminishes with wealth: rate = 1% / (1 + treasury / SAVINGS_INTEREST_SCALE)
const DEBT_INTEREST_SCALE    = 0.001; // at -$100M → ~1%, -$1000M → ~3.2%, -$5000M → ~7%
const SAVINGS_INTEREST_BASE  = 0.01;  // 1% at very low savings
const SAVINGS_INTEREST_SCALE = 2000;  // at $5000M savings → ~0.3%

// Happiness pool
const HAPPINESS_BASELINE  = 40;  // happiness target with no policies and 15% tax
const HAPPINESS_DRIFT_CAP = 3;   // max points happiness can change per turn

// Economic sectors (Industry, Commerce, Finance)
// Each is a level 0–100 built up via policy spending, decays when unfunded.
const SECTOR_GROW_PER_M    = 0.5;   // base levels gained per $1M spent (at level 0)
const SECTOR_GROW_HARDNESS = 0.04;  // diminishing returns: rate ÷ (1 + hardness×level)
const SECTOR_DECAY         = 1.0;   // levels lost/turn when unfunded

// Trade routes
const TRADE_ROUTE_COST             = 500;  // one-time $M treasury cost per route
const TRADE_ROUTE_INCOME           = 20;   // base $M/turn per route at finance level 0
const TRADE_ROUTE_FINANCE_SCALE    = 0.5;  // extra $M/turn per route per finance level
const TRADE_ROUTE_LEVEL_NEEDED     = 20;   // finance level needed per additional route slot

// ============================================================
// POLICY DEFINITIONS
// ============================================================
// Effects are the values achieved at $220M spending (baseline full funding).
// Actual effect = effect × (actualSpending / POLICY_REFERENCE_SPEND).
const POLICIES = {
  industry: {
    id: 'industry',
    name: 'Industry',
    category: 'economy',
    icon: '🏭',
    description: 'Build manufacturing and production capacity. Grows Industry level, boosting GDP growth.',
    maxFunding: 20,
    effects: {}
  },
  commerce: {
    id: 'commerce',
    name: 'Commerce',
    category: 'economy',
    icon: '🏪',
    description: 'Develop markets and retail networks. Grows Commerce level, multiplying all tax income.',
    maxFunding: 20,
    effects: {}
  },
  finance: {
    id: 'finance',
    name: 'Finance',
    category: 'economy',
    icon: '🏦',
    description: 'Build financial institutions. Grows Finance level, reducing debt costs and unlocking trade routes.',
    maxFunding: 20,
    effects: {}
  },
  infrastructure: {
    id: 'infrastructure',
    name: 'Infrastructure',
    category: 'economy',
    icon: '🏗️',
    description: 'Build roads, power grids, and transport networks.',
    maxFunding: 20,
    effects: { gdpGrowth: 0.020 }  // max GDP bonus when infraLevel = 100
  },
  healthcare: {
    id: 'healthcare',
    name: 'Healthcare',
    category: 'social',
    icon: '🏥',
    description: 'Fund hospitals and public health programs.',
    maxFunding: 20,
    effects: { happiness: 25 }
  },
  education: {
    id: 'education',
    name: 'Education',
    category: 'social',
    icon: '🎓',
    description: 'Fund schools and universities to develop human capital.',
    maxFunding: 20,
    effects: { rpBonus: 3, gdpGrowth: 0.015, happiness: 10 }
  },
  military: {
    id: 'military',
    name: 'Military',
    category: 'security',
    icon: '⚔️',
    description: 'Armed forces for national defense. (War system coming soon!)',
    maxFunding: 20,
    effects: { militaryStrength: 50, happiness: -3 }
  },
};

// ============================================================
// TECHNOLOGY DEFINITIONS
// ============================================================
const TECHNOLOGIES = {
  // --- TIER 1 ---
  basicAutomation: {
    id: 'basicAutomation', name: 'Basic Automation',
    tier: 1, cost: 20, icon: '⚙️',
    description: 'Automate basic industrial processes.',
    requires: null,
    effects: { gdpGrowthBonus: 0.005, effectDesc: '+0.5% GDP growth' }
  },
  healthcareReform: {
    id: 'healthcareReform', name: 'Healthcare Reform',
    tier: 1, cost: 20, icon: '💊',
    description: 'Improve healthcare system efficiency.',
    requires: null,
    effects: { policyCostMult: { healthcare: 0.80 }, effectDesc: '-20% healthcare cost' }
  },
  educationProgram: {
    id: 'educationProgram', name: 'Education Initiative',
    tier: 1, cost: 20, icon: '📚',
    description: 'Boosts research centre output.',
    requires: null,
    effects: { rpCentreBonus: 2, effectDesc: '+2 bonus RP/centre/turn' }
  },
  // --- TIER 2 ---
  greenIndustry: {
    id: 'greenIndustry', name: 'Green Industry',
    tier: 2, cost: 50, icon: '♻️',
    description: 'Sustainable industry for long-term growth.',
    requires: 'basicAutomation',
    effects: { gdpGrowthBonus: 0.01, happinessBonus: 5, effectDesc: '+1% GDP growth, +5 happiness' }
  },
  universalHealthcare: {
    id: 'universalHealthcare', name: 'Universal Healthcare',
    tier: 2, cost: 50, icon: '🏥',
    description: 'Extend healthcare to all citizens.',
    requires: 'healthcareReform',
    effects: { happinessBonus: 18, effectDesc: '+18 happiness' }
  },
  aiAdministration: {
    id: 'aiAdministration', name: 'AI Administration',
    tier: 2, cost: 50, icon: '🤖',
    description: 'AI streamlines all government operations.',
    requires: 'educationProgram',
    effects: { allPolicyCostMult: 0.90, effectDesc: '-10% all policy costs' }
  },
  // --- TIER 3 ---
  digitalEconomy: {
    id: 'digitalEconomy', name: 'Digital Economy',
    tier: 3, cost: 100, icon: '💻',
    description: 'Lead the global digital transformation.',
    requires: 'greenIndustry',
    effects: { gdpGrowthBonus: 0.02, effectDesc: '+2% GDP growth' }
  },
  advancedWelfare: {
    id: 'advancedWelfare', name: 'Advanced Welfare',
    tier: 3, cost: 100, icon: '🌟',
    description: 'Comprehensive citizen support systems.',
    requires: 'universalHealthcare',
    effects: { happinessBonus: 25, effectDesc: '+25 happiness' }
  },
  spaceProgram: {
    id: 'spaceProgram', name: 'Space Program',
    tier: 3, cost: 100, icon: '🚀',
    description: 'National prestige and scientific advancement.',
    requires: 'aiAdministration',
    effects: { happinessBonus: 10, gdpGrowthBonus: 0.01, rpCentreBonus: 5, effectDesc: '+10 happiness, +1% GDP growth, +5 bonus RP/centre' }
  },
};

// ============================================================
// GAME STATE
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

// ============================================================
// PURE CALCULATION FUNCTIONS
// ============================================================

function getTechEffects() {
  const e = {
    gdpGrowthBonus:    0,
    happinessBonus:    0,
    rpCentreBonus:     0,
    allPolicyCostMult: 1.0,
    policyCostMult:    {},
  };
  for (const id of G.unlockedTechs) {
    const fx = TECHNOLOGIES[id].effects;
    if (fx.gdpGrowthBonus)       e.gdpGrowthBonus    += fx.gdpGrowthBonus;
    if (fx.happinessBonus)       e.happinessBonus    += fx.happinessBonus;
    if (fx.rpCentreBonus)        e.rpCentreBonus     += fx.rpCentreBonus;
    if (fx.allPolicyCostMult)    e.allPolicyCostMult *= fx.allPolicyCostMult;
    if (fx.policyCostMult) {
      for (const [k, v] of Object.entries(fx.policyCostMult)) {
        e.policyCostMult[k] = (e.policyCostMult[k] || 1) * v;
      }
    }
  }
  return e;
}

// Cost = (funding% / 100) * tax income, modified by tech multipliers
function getPolicyCost(policyId) {
  const funding = G.policyFunding[policyId] || 0;
  if (funding <= 0) return 0;
  const te = getTechEffects();
  let cost = getTaxIncome() * (funding / 100);
  if (te.policyCostMult[policyId]) cost *= te.policyCostMult[policyId];
  cost *= te.allPolicyCostMult;
  return cost;
}

function getTotalExpenses() {
  return Object.keys(G.policyFunding).reduce((sum, id) => sum + getPolicyCost(id), 0);
}

function getTaxIncome() {
  // GDP ($B) * taxRate * 10 = income ($M), boosted by Commerce level
  const commerceBonus = 1 + 0.3 * (G.commerceLevel / 100);
  return G.gdp * G.taxRate * 10 * commerceBonus;
}

function getNetIncome() {
  return getTaxIncome() - getTotalExpenses();
}

// How much a policy's effects are scaled given current income and funding.
// 1.0 = baseline (starting economy, max slider). Grows with GDP.
function policyEffectScale(policyId) {
  const funding = G.policyFunding[policyId] || 0;
  if (funding <= 0) return 0;
  // Infrastructure effects are diverted toward building a research centre
  if (policyId === 'infrastructure' && G.buildingCentre) return 0;
  return getTaxIncome() * (funding / 100) / POLICY_REFERENCE_SPEND;
}

function getEffectiveGrowthRate() {
  let rate = G.gdpGrowthRate;
  for (const id of Object.keys(G.policyFunding)) {
    if (id === 'infrastructure') continue; // infraLevel drives this
    if (id === 'industry' || id === 'commerce' || id === 'finance') continue; // sector levels drive these
    if (POLICIES[id].effects.gdpGrowth) {
      rate += POLICIES[id].effects.gdpGrowth * policyEffectScale(id);
    }
  }
  // Infrastructure: GDP bonus scales with accumulated level (0–100)
  rate += POLICIES.infrastructure.effects.gdpGrowth * (G.infraLevel / 100);
  // Industry sector: GDP bonus scales with accumulated level (up to +2% at level 100)
  rate += 0.02 * (G.industryLevel / 100);
  rate += getTechEffects().gdpGrowthBonus;

  // --- Negative drag factors ---

  // High tax: above 20% each extra % costs 0.2% GDP growth
  const taxPct = G.taxRate * 100;
  if (taxPct > 20) rate -= (taxPct - 20) * 0.002;
  
  // Low happiness: below 40 causes unrest drag (up to -2% at 0 happiness)
  const unhappiness = Math.max(0, 40 - G.happiness);
  rate -= unhappiness * 0.0005;

  // High debt: above $500M debt, crowding-out effect (-0.05% per $100M over threshold)
  if (G.treasury < -500) rate -= (Math.abs(G.treasury) - 500) * 0.0000005;

  // Military overspend: happiness penalty already covers morale; military itself has no extra drag

  return rate;
}

// Computes the happiness value that current policies/tax/tech are "pulling" toward.
// The actual G.happiness pool converges toward this target slowly each turn.
function calcHappinessTarget() {
  let h = HAPPINESS_BASELINE;
  for (const id of Object.keys(G.policyFunding)) {
    if (POLICIES[id].effects.happiness) {
      h += POLICIES[id].effects.happiness * policyEffectScale(id);
    }
  }
  // Tax: 0% gives +15 happiness, 15% neutral, higher = penalty
  h -= Math.round((G.taxRate - 0.15) * 100);
  h += getTechEffects().happinessBonus;
  return Math.max(0, Math.min(100, h));
}

function getDebtInterestRate() {
  if (G.treasury >= 0) return 0;
  // Finance level reduces debt interest by up to 50% at level 100
  const financeDiscount = 1 - 0.5 * (G.financeLevel / 100);
  return DEBT_INTEREST_SCALE * Math.sqrt(Math.abs(G.treasury)) * financeDiscount;
}

function getSavingsInterestRate() {
  if (G.treasury <= 0) return 0;
  return SAVINGS_INTEREST_BASE / (1 + G.treasury / SAVINGS_INTEREST_SCALE);
}

function getRpPerTurn() {
  if (G.researchCentres === 0) return 0;
  // Base RP per centre + education policy bonus + tech bonus
  const eduBonus = POLICIES.education.effects.rpBonus * policyEffectScale('education');
  const perCentre = RP_PER_CENTRE + eduBonus + getTechEffects().rpCentreBonus;
  return perCentre * G.researchCentres;
}

// ============================================================
// GAME ACTIONS
// ============================================================

function setPolicyFunding(policyId, value) {
  const funding = Math.max(0, Math.min(20, parseInt(value, 10)));
  G.policyFunding[policyId] = funding;

  const cost = getPolicyCost(policyId);

  // Update this card's cost label and active class
  const costEl = document.getElementById('pc-' + policyId);
  if (costEl) {
    costEl.textContent = cost > 0 ? '\u2212' + fmt(cost) + '/turn' : 'Inactive';
    costEl.className = 'policy-cost' + (cost > 0 ? '' : ' inactive');
  }
  const displayEl = document.getElementById('pd-' + policyId);
  if (displayEl) displayEl.textContent = funding + '% of income \u2014 ' + (cost > 0 ? fmt(cost) + '/turn' : 'Inactive');

  // Toggle the card's active class so the slider thumb colour updates
  const cardEl = costEl && costEl.closest('.policy-card');
  if (cardEl) cardEl.classList.toggle('active', funding > 0);

  updateBudgetProjection();
  renderHeader();
}

function setTaxRate(value) {
  G.taxRate = parseInt(value, 10) / 100;
  document.getElementById('tax-rate-display').textContent = value + '%';
  document.getElementById('tax-income-label').textContent = '+' + fmt(getTaxIncome()) + '/turn';
  updateBudgetProjection();
  renderHeader();
}

function toggleBuildCentre() {
  if (!G.buildingCentre && G.policyFunding.infrastructure === 0) {
    showNotification('Set infrastructure funding above 0 first!', 'error');
    return;
  }
  G.buildingCentre = !G.buildingCentre;
  if (!G.buildingCentre) {
    G.centreBuildProgress = 0;
    showNotification('Construction cancelled.', 'info');
  } else {
    showNotification('🏗️ Building research centre — infrastructure budget diverted.', 'good');
  }
  renderAll();
}

function getTradeRouteSlots() {
  return Math.floor(G.financeLevel / TRADE_ROUTE_LEVEL_NEEDED);
}

function getTradeRouteIncomePerRoute() {
  return TRADE_ROUTE_INCOME + G.financeLevel * TRADE_ROUTE_FINANCE_SCALE;
}

function openTradeRoute() {
  const slots = getTradeRouteSlots();
  if (G.tradeRoutes >= slots) {
    const needed = (G.tradeRoutes + 1) * TRADE_ROUTE_LEVEL_NEEDED;
    showNotification('Need Finance level ' + needed + ' to open another route.', 'error');
    return;
  }
  if (G.treasury < TRADE_ROUTE_COST) {
    showNotification('Need ' + fmt(TRADE_ROUTE_COST) + ' treasury to open a route.', 'error');
    return;
  }
  G.treasury -= TRADE_ROUTE_COST;
  G.tradeRoutes++;
  addLog('Trade route #' + G.tradeRoutes + ' opened (\u2212' + fmt(TRADE_ROUTE_COST) + '). Income: +' + fmt(getTradeRouteIncomePerRoute()) + '/turn per route.', 'good');
  showNotification('\ud83d\udea2 Trade route #' + G.tradeRoutes + ' opened!', 'good');
  renderAll();
}

function closeTradeRoute() {
  if (G.tradeRoutes <= 0) return;
  G.tradeRoutes--;
  showNotification('Trade route closed. (' + G.tradeRoutes + ' remaining)', 'info');
  renderAll();
}

function setActiveResearch(techId) {
  const tech = TECHNOLOGIES[techId];
  if (G.unlockedTechs.includes(techId)) return;
  if (tech.requires && !G.unlockedTechs.includes(tech.requires)) {
    showNotification('Prerequisite not met: ' + TECHNOLOGIES[tech.requires].name, 'error');
    return;
  }
  if (G.researchCentres === 0) {
    showNotification('Build a research centre first!', 'error');
    return;
  }
  if (G.activeResearch === techId) {
    G.activeResearch = null;
    G.researchProgress = 0;
    showNotification('Research cancelled.', 'info');
  } else {
    G.activeResearch = techId;
    G.researchProgress = 0;
    addLog('Started researching: ' + tech.name, 'info');
    showNotification('🔬 Researching: ' + tech.name, 'good');
  }
  renderAll();
}

function endTurn() {

  // 1. Grow GDP first so income calculation matches what's displayed
  const growth = getEffectiveGrowthRate();
  G.gdp = G.gdp * (1 + growth);

  // 1.3. Update economic sector levels (Industry, Commerce, Finance)
  // Each sector grows with spending and decays 1 level/turn without it.
  for (const sector of ['industry', 'commerce', 'finance']) {
    const levelKey = sector + 'Level';
    if (G.policyFunding[sector] > 0) {
      const spend    = getTaxIncome() * (G.policyFunding[sector] / 100);
      const growRate = SECTOR_GROW_PER_M / (1 + SECTOR_GROW_HARDNESS * G[levelKey]);
      const net      = spend * growRate - SECTOR_DECAY;
      G[levelKey]    = Math.min(100, Math.max(0, G[levelKey] + net));
    } else if (G[levelKey] > 0) {
      G[levelKey] = Math.max(0, G[levelKey] - SECTOR_DECAY);
    }
  }

  // 1.4. Update infrastructure level
  // Repair rate shrinks at higher levels (harder to improve a mature network).
  // Decay rate grows with level (a bigger network needs more upkeep).
  // Both effects apply simultaneously — insufficient spending makes levels fall even when funded.
  if (!G.buildingCentre) {
    const decay = INFRA_DECAY_BASE + INFRA_DECAY_SCALE * G.infraLevel;
    if (G.policyFunding.infrastructure > 0) {
      const infraSpend = getTaxIncome() * (G.policyFunding.infrastructure / 100);
      const repairRate = INFRA_REPAIR_PER_M / (1 + INFRA_REPAIR_HARDNESS * G.infraLevel);
      const net = infraSpend * repairRate - decay;
      G.infraLevel = Math.min(100, Math.max(0, G.infraLevel + net));
    } else if (G.infraLevel > 0) {
      G.infraLevel = Math.max(0, G.infraLevel - decay);
    }
  }

  // 1.5. Research centre construction: divert infrastructure budget into build progress
  if (G.buildingCentre && G.policyFunding.infrastructure > 0) {
    const infraSpend = getTaxIncome() * (G.policyFunding.infrastructure / 100);
    G.centreBuildProgress += infraSpend;
    if (G.centreBuildProgress >= CENTRE_BUILD_COST) {
      G.researchCentres++;
      G.centreBuildProgress = 0;
      G.buildingCentre = false;
      addLog('Research Centre #' + G.researchCentres + ' built via infrastructure investment — ' + getRpPerTurn().toFixed(1) + ' RP/turn.', 'good');
      showNotification('🏗️ Research Centre #' + G.researchCentres + ' complete!', 'good');
    }
  }

  // 2. Apply net income (using grown GDP — same value the UI shows)
  const net = getNetIncome();
  G.treasury += net;

  // 2.4. Trade route income (passive, scales with finance level)
  if (G.tradeRoutes > 0) {
    const routeIncome = G.tradeRoutes * (TRADE_ROUTE_INCOME + G.financeLevel * TRADE_ROUTE_FINANCE_SCALE);
    G.treasury += routeIncome;
    addLog('Trade route income: +' + fmt(routeIncome) + ' (' + G.tradeRoutes + ' routes, Finance lvl ' + Math.round(G.financeLevel) + ')', 'good');
  }

  // 2.5. Apply scaling interest on treasury
  const interestRate = G.treasury < 0 ? getDebtInterestRate() : getSavingsInterestRate();
  const interest = G.treasury * interestRate;
  G.treasury += interest;
  if (interest !== 0) {
    const ratePct = (interestRate * 100).toFixed(2) + '%';
    const prevTreasury = G.treasury - interest;
    addLog(
      prevTreasury < 0
        ? 'Debt interest: ' + fmt(interest) + ' (' + ratePct + ' on ' + fmt(prevTreasury) + ' debt)'
        : 'Savings interest: +' + fmt(interest) + ' (' + ratePct + ' on ' + fmt(prevTreasury) + ' savings)',
      interest < 0 ? 'bad' : 'good'
    );
  }

  // 4. Research progress
  if (G.activeResearch && G.researchCentres > 0) {
    G.researchProgress += getRpPerTurn();
    const activeTech = TECHNOLOGIES[G.activeResearch];
    if (G.researchProgress >= activeTech.cost) {
      G.unlockedTechs.push(G.activeResearch);
      addLog('Research complete: ' + activeTech.name + ' — ' + activeTech.effects.effectDesc, 'good');
      showNotification('✓ ' + activeTech.name + ' research complete!', 'good');
      G.activeResearch = null;
      G.researchProgress = 0;
    }
  }

  // 5. Military strength
  G.militaryStrength = (POLICIES.military.effects.militaryStrength || 0) * policyEffectScale('military');

  // 6. Advance time
  G.year++;
  G.turn++;

  // 7. Update happiness pool: converges toward calcHappinessTarget() at 5%/turn, capped at HAPPINESS_DRIFT_CAP
  const happinessTarget = calcHappinessTarget();
  const happinessDelta = Math.max(-HAPPINESS_DRIFT_CAP, Math.min(HAPPINESS_DRIFT_CAP,
    (happinessTarget - G.happiness) * 0.05));
  G.happiness = Math.max(0, Math.min(100, G.happiness + happinessDelta));

  // 8. Log turn summary
  const happiness = G.happiness;
  addLog(
    'Year ' + G.year + ' — Net: ' + (net >= 0 ? '+' : '') + fmt(net) +
    ' | GDP: $' + G.gdp.toFixed(2) + 'B | Happiness: ' + Math.round(happiness) + '%',
    net < 0 ? 'bad' : 'info'
  );

  renderAll();
}

function addLog(message, type) {
  G.eventLog.unshift({ message, type: type || 'info', year: G.year });
  if (G.eventLog.length > 30) G.eventLog.pop();
}

// ============================================================
// RENDERING
// ============================================================

function renderAll() {
  renderHeader();
  renderPolicies();
  renderDashboard();
  renderResearch();
}

function updateBudgetProjection() {
  const income   = getTaxIncome();
  const spending = getTotalExpenses();
  const net      = income - spending;

  const incomeEl  = document.getElementById('proj-income');
  const spendEl   = document.getElementById('proj-spending');
  const netEl     = document.getElementById('proj-net');
  const barEl     = document.getElementById('budget-bar-fill');

  if (incomeEl)  incomeEl.textContent  = fmt(income);
  if (spendEl)   spendEl.textContent   = fmt(spending);
  if (netEl) {
    netEl.textContent  = (net >= 0 ? '+' : '') + fmt(net);
    netEl.className    = net < 0 ? 'negative' : net < income * 0.1 ? 'warning' : 'positive';
  }

  if (barEl) {
    const pct = income > 0 ? Math.min((spending / income) * 100, 100) : 0;
    barEl.style.width = pct + '%';
    barEl.className   = 'budget-bar-fill' + (spending > income ? ' over-budget' : spending > income * 0.85 ? ' warn-budget' : '');
  }
}

function renderHeader() {
  document.getElementById('empire-name').textContent = G.empire;
  document.getElementById('year').textContent = G.year;
  document.getElementById('turn').textContent = G.turn;

  const treasury = G.treasury;
  setStatValue('treasury', fmt(treasury),
    treasury < 0 ? 'negative' : treasury < 1000 ? 'warning' : 'positive');

  document.getElementById('gdp').textContent = '$' + G.gdp.toFixed(2) + 'B';

  const happiness = G.happiness;
  setStatValue('approval', Math.round(happiness) + '%',
    happiness < 35 ? 'negative' : happiness < 50 ? 'warning' : 'positive');

  const net = getNetIncome();
  setStatValue('net-income', (net >= 0 ? '+' : '') + fmt(net),
    net < 0 ? 'negative' : 'positive');

}

function setStatValue(id, value, colorClass) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value;
  el.className = 'hstat-value ' + (colorClass || '');
}

function renderPolicies() {
  const tab = G.currentPolicyTab;

  // Update tax display
  document.getElementById('tax-rate-display').textContent = Math.round(G.taxRate * 100) + '%';
  document.getElementById('tax-slider').value = Math.round(G.taxRate * 100);
  document.getElementById('tax-income-label').textContent = '+' + fmt(getTaxIncome()) + '/turn';

  let html = '';
  for (const [id, policy] of Object.entries(POLICIES)) {
    if (tab !== 'all' && policy.category !== tab) continue;
    const funding = G.policyFunding[id] || 0;
    const cost = getPolicyCost(id);

    html += `
      <div class="policy-card ${funding > 0 ? 'active' : ''}">
        <div class="policy-header">
          <span class="policy-icon">${policy.icon}</span>
          <span class="policy-name">${policy.name}</span>
          <span class="policy-cost ${funding > 0 ? '' : 'inactive'}" id="pc-${id}">
            ${funding > 0 ? '\u2212' + fmt(cost) + '/turn' : 'Inactive'}
          </span>
        </div>
        <p class="policy-desc">${policy.description}</p>
        <div class="policy-slider-row">
          <span class="policy-slider-pct">0%</span>
          <input type="range" class="policy-slider" min="0" max="20" value="${funding}"
            oninput="setPolicyFunding('${id}', this.value)">
          <span class="policy-slider-pct">20%</span>
        </div>
        <div class="policy-slider-display" id="pd-${id}">
          ${funding}% of income \u2014 ${cost > 0 ? fmt(cost) + '/turn' : 'Inactive'}
        </div>
        <div class="policy-effects-hint">${buildEffectsHint(id, policy.effects)}</div>
      </div>`;
  }

  document.getElementById('policies-list').innerHTML = html;
  updateBudgetProjection();

  // Render trade routes panel (below policy cards)
  const trPanel = document.getElementById('trade-routes-panel');
  if (trPanel) {
    const slots   = getTradeRouteSlots();
    const income  = getTradeRouteIncomePerRoute();
    const canOpen = G.tradeRoutes < slots && G.treasury >= TRADE_ROUTE_COST;
    const canClose = G.tradeRoutes > 0;
    const slotsColor = slots === 0 ? 'var(--text-3)' : 'var(--teal)';
    const routeIncomeTotal = G.tradeRoutes > 0 ? ' · +' + fmt(G.tradeRoutes * income) + '/turn' : '';
    trPanel.innerHTML = `
      <div class="trade-routes-card">
        <div class="tr-header">
          <span class="tr-icon">\ud83d\udea2</span>
          <span class="tr-title">Trade Routes</span>
          <span class="tr-slots" style="color:${slotsColor}">${G.tradeRoutes}/${slots} active${routeIncomeTotal}</span>
        </div>
        <p class="tr-desc">Each route costs <strong>${fmt(TRADE_ROUTE_COST)}</strong> treasury to open and earns <strong>+${fmt(income)}/turn</strong> (scales with Finance level). Unlock route slots by raising Finance to level ${TRADE_ROUTE_LEVEL_NEEDED}, ${TRADE_ROUTE_LEVEL_NEEDED * 2}, ${TRADE_ROUTE_LEVEL_NEEDED * 3}…</p>
        <div class="tr-actions">
          <button class="btn-tr-open${canOpen ? '' : ' disabled'}" onclick="openTradeRoute()" ${canOpen ? '' : 'disabled'}>
            Open Route (\u2212${fmt(TRADE_ROUTE_COST)})
          </button>
          <button class="btn-tr-close${canClose ? '' : ' disabled'}" onclick="closeTradeRoute()" ${canClose ? '' : 'disabled'}>
            Close Route
          </button>
        </div>
        ${slots === 0 ? '<div class="tr-hint">Raise Finance level to ' + TRADE_ROUTE_LEVEL_NEEDED + ' to unlock your first route slot.</div>' : ''}
      </div>`;
  }
}

function buildEffectsHint(policyId, effects) {
  if (policyId === 'infrastructure') {
    const lvl         = G.infraLevel;
    const decay       = (INFRA_DECAY_BASE + INFRA_DECAY_SCALE * lvl).toFixed(1);
    const repairRate  = INFRA_REPAIR_PER_M / (1 + INFRA_REPAIR_HARDNESS * lvl);
    // Maintenance spend = spend needed so that repair exactly offsets decay ($M/turn)
    const maintainM   = (INFRA_DECAY_BASE + INFRA_DECAY_SCALE * lvl) / repairRate;
    const income = getTaxIncome();
    const maintainPct = income > 0 ? (maintainM / income * 100).toFixed(1) : '∞';
    const currentGdpPct = (effects.gdpGrowth * (lvl / 100) * 100).toFixed(2);
    const lvlClass    = lvl < 20 ? 'effect-bad' : lvl < 50 ? 'effect-warn' : 'effect-good';
    return [
      `<span class="${lvlClass}">Level ${Math.round(lvl)}/100 → GDP +${currentGdpPct}%</span>`,
      `<span class="effect-bad">−2${decay === '2.0' ? '' : '\u2013' + decay} lvl/turn decay</span>`,
      `<span class="effect-warn">~${maintainPct}% income to maintain</span>`,
    ].join(' · ');
  }
  // Economic sector policies — show level, effect, decay, and net growth preview
  if (policyId === 'industry' || policyId === 'commerce' || policyId === 'finance') {
    const levelKey = policyId + 'Level';
    const lvl = G[levelKey];
    const lvlClass = lvl < 20 ? 'effect-bad' : lvl < 50 ? 'effect-warn' : 'effect-good';
    const funding = G.policyFunding[policyId] || 0;
    let effectStr = '';
    if (policyId === 'industry')  effectStr = 'GDP +' + (0.02 * lvl / 100 * 100).toFixed(2) + '%';
    if (policyId === 'commerce')  effectStr = 'Tax income ×' + (1 + 0.3 * lvl / 100).toFixed(2);
    if (policyId === 'finance') {
      const discount = (0.5 * lvl / 100 * 100).toFixed(0);
      const slots = Math.floor(lvl / TRADE_ROUTE_LEVEL_NEEDED);
      effectStr = 'Debt rate \u2212' + discount + '% · ' + slots + ' route slot' + (slots !== 1 ? 's' : '');
    }
    let netStr = '';
    if (funding > 0) {
      const spend    = getTaxIncome() * (funding / 100);
      const growRate = SECTOR_GROW_PER_M / (1 + SECTOR_GROW_HARDNESS * lvl);
      const net      = spend * growRate - SECTOR_DECAY;
      netStr = ' · <span class="' + (net >= 0 ? 'effect-good' : 'effect-bad') + '">' + (net >= 0 ? '+' : '') + net.toFixed(1) + ' lvl/turn</span>';
    } else {
      netStr = ' · <span class="effect-bad">−' + SECTOR_DECAY.toFixed(1) + ' lvl/turn (unfunded)</span>';
    }
    return `<span class="${lvlClass}">Level ${Math.round(lvl)}/100 → ${effectStr}</span>${netStr}`;
  }
  // Show what effects would be at max funding given the current economy.
  const maxScale = getTaxIncome() * 0.20 / POLICY_REFERENCE_SPEND;
  const parts = [];
  if (effects.happiness)         parts.push(span(Math.round(effects.happiness * maxScale), 'Happiness', ' @max'));
  if (effects.gdpGrowth)         parts.push(spanPct(effects.gdpGrowth * maxScale, 'GDP growth', ' @max'));
  if (effects.rpBonus)           parts.push(`<span class="effect-good">+${(effects.rpBonus * maxScale).toFixed(1)} bonus RP/centre @max</span>`);
  if (effects.militaryStrength)  parts.push(`<span class="effect-good">+${Math.round(effects.militaryStrength * maxScale)} Mil @max</span>`);
  return parts.join(' · ');
}

function span(val, label, suffix) {
  const cls = val >= 0 ? 'effect-good' : 'effect-bad';
  const sign = val >= 0 ? '+' : '';
  return `<span class="${cls}">${label} ${sign}${val}${suffix || ''}</span>`;
}

function spanPct(val, label, suffix) {
  const cls = val >= 0 ? 'effect-good' : 'effect-bad';
  const sign = val >= 0 ? '+' : '';
  return `<span class="${cls}">${label} ${sign}${(val * 100).toFixed(1)}%${suffix || ''}</span>`;
}

function renderDashboard() {
  const tab = G.currentDashboardTab;

  if (tab === 'overview') {
    const happiness = G.happiness;
    const net = getNetIncome();
    const growth = getEffectiveGrowthRate();
    const rp = getRpPerTurn();
    const activeResearchName = G.activeResearch ? TECHNOLOGIES[G.activeResearch].name : 'None';
    const activeResearchPct = G.activeResearch
      ? Math.round((G.researchProgress / TECHNOLOGIES[G.activeResearch].cost) * 100) : 0;

    const tRate = G.treasury < 0 ? getDebtInterestRate() : getSavingsInterestRate();
    const treasuryInterestRaw = G.treasury * tRate;
    const treasuryInterestUnit = tRate > 0
      ? ' (' + (treasuryInterestRaw >= 0 ? '+' : '') + fmt(treasuryInterestRaw) + '/turn, ' + (tRate * 100).toFixed(2) + '%)' : '';

    const gdpChange = G.gdp * growth;
    const gdpChangeStr = (gdpChange >= 0 ? '+' : '') + '$' + (Math.abs(gdpChange) < 1 ? Math.abs(gdpChange).toFixed(3) : Math.abs(gdpChange).toFixed(2)) + 'B';

    // Happiness next-turn delta preview
    const happinessTarget = calcHappinessTarget();
    const happinessDelta = Math.max(-HAPPINESS_DRIFT_CAP, Math.min(HAPPINESS_DRIFT_CAP, (happinessTarget - happiness) * 0.05));
    const happinessDeltaStr = (happinessDelta >= 0 ? '+' : '') + happinessDelta.toFixed(2);

    // Infra level next-turn delta preview
    let infraDelta = 0;
    if (!G.buildingCentre) {
      const infraDecay = INFRA_DECAY_BASE + INFRA_DECAY_SCALE * G.infraLevel;
      if (G.policyFunding.infrastructure > 0) {
        const infraSpend = getTaxIncome() * (G.policyFunding.infrastructure / 100);
        const repairRate = INFRA_REPAIR_PER_M / (1 + INFRA_REPAIR_HARDNESS * G.infraLevel);
        infraDelta = Math.min(100, Math.max(0, G.infraLevel + infraSpend * repairRate - infraDecay)) - G.infraLevel;
      } else {
        infraDelta = Math.max(0, G.infraLevel - infraDecay) - G.infraLevel;
      }
    }
    const infraDeltaStr = (infraDelta >= 0 ? '+' : '') + infraDelta.toFixed(2);

    const indicators = [
      { label: 'Happiness',         value: (happiness >= 0 ? '+' : '') + Math.round(happiness), unit: '% (' + happinessDeltaStr + '/turn)',   max: 100, type: happiness < 30 ? 'neg' : happiness < 50 ? 'warn' : 'pos' },
      { label: 'Treasury',          value: (G.treasury >= 0 ? '+' : '') + fmt(G.treasury),    unit: treasuryInterestUnit,    max: 100, rawPct: Math.min(100, Math.max(0, (G.treasury + 8000) / 160)), type: G.treasury < 0 ? 'neg' : G.treasury < 2000 ? 'warn' : 'pos' },
      { label: 'GDP',               value: '$' + G.gdp.toFixed(2) + 'B', unit: ' (' + gdpChangeStr + '/turn)', max: 100, rawPct: Math.min(100, G.gdp / 20), type: growth < 0 ? 'neg' : 'pos' },
      { label: 'GDP Growth / Year', value: (growth >= 0 ? '+' : '') + (growth * 100).toFixed(2) + '%', unit: '', max: 100, rawPct: Math.min(100, growth * 500), type: growth < 0 ? 'neg' : growth < 0.01 ? 'warn' : 'pos' },
      { label: 'Infra Level',        value: Math.round(G.infraLevel) + '/100', unit: ' (' + infraDeltaStr + '/turn)', max: 100, rawPct: G.infraLevel, type: G.infraLevel < 20 ? 'neg' : G.infraLevel < 50 ? 'warn' : 'pos' },
      { label: 'Industry Level',    value: Math.round(G.industryLevel) + '/100', unit: ' (GDP +' + (0.02 * G.industryLevel / 100 * 100).toFixed(2) + '%)', max: 100, rawPct: G.industryLevel, type: G.industryLevel < 20 ? 'neg' : G.industryLevel < 50 ? 'warn' : 'pos' },
      { label: 'Commerce Level',    value: Math.round(G.commerceLevel) + '/100', unit: ' (Tax \xd7' + (1 + 0.3 * G.commerceLevel / 100).toFixed(2) + ')', max: 100, rawPct: G.commerceLevel, type: G.commerceLevel < 20 ? 'neg' : G.commerceLevel < 50 ? 'warn' : 'pos' },
      { label: 'Finance Level',     value: Math.round(G.financeLevel) + '/100', unit: ' (' + getTradeRouteSlots() + ' route slots)', max: 100, rawPct: G.financeLevel, type: G.financeLevel < 20 ? 'neg' : G.financeLevel < 50 ? 'warn' : 'pos' },
      { label: 'Trade Routes',      value: G.tradeRoutes + '/' + getTradeRouteSlots(), unit: G.tradeRoutes > 0 ? ' (+' + fmt(G.tradeRoutes * getTradeRouteIncomePerRoute()) + '/turn)' : '', max: 100, rawPct: getTradeRouteSlots() > 0 ? (G.tradeRoutes / getTradeRouteSlots()) * 100 : 0, type: G.tradeRoutes === 0 ? 'warn' : 'pos' },
      { label: 'Net Income / Turn', value: (net >= 0 ? '+' : '') + fmt(net), unit: '', max: 100, rawPct: Math.min(100, Math.max(0, (net + 2000) / 40)), type: net < 0 ? 'neg' : 'pos' },
      { label: 'Research Centres',  value: G.researchCentres,  unit: '',    max: 100, rawPct: Math.min(100, G.researchCentres * 10), type: 'pos' },
      { label: 'Research Output',   value: '+' + rp.toFixed(1),      unit: ' RP/turn', max: 100, rawPct: Math.min(100, rp * 3), type: rp === 0 ? 'warn' : 'pos' },
      { label: 'Active Research',   value: activeResearchName, unit: '', max: 100, rawPct: activeResearchPct, type: G.activeResearch ? 'pos' : 'warn' },
      { label: 'Military Strength', value: (G.militaryStrength >= 0 ? '+' : '') + Math.round(G.militaryStrength), unit: '',    max: 100, rawPct: Math.min(100, G.militaryStrength * 2), type: 'pos' },
    ];

    const barClass = t => t === 'neg' ? 'bar-red' : t === 'warn' ? 'bar-yellow' : 'bar-green';

    let html = '<div class="indicators-grid">';
    for (const ind of indicators) {
      const pct = ind.rawPct !== undefined ? ind.rawPct : Math.min(100, (parseInt(ind.value) / ind.max) * 100);
      const valClass = ind.type === 'neg' ? 'negative' : ind.type === 'warn' ? 'warning' : 'positive';
      html += `
        <div class="indicator-card">
          <div class="indicator-label">${ind.label}</div>
          <div class="indicator-value ${valClass}">${ind.value}${ind.unit}</div>
          <div class="indicator-bar-bg">
            <div class="indicator-bar ${barClass(ind.type)}" style="width:${Math.max(0, pct).toFixed(1)}%"></div>
          </div>
        </div>`;
    }
    html += '</div>';
    document.getElementById('tab-overview').innerHTML = html;
  }

  if (tab === 'events') {
    let html = '';
    for (const e of G.eventLog) {
      html += `<div class="event-item ${e.type || 'info'}">
        <span class="event-year">[${e.year}]</span> ${e.message}
      </div>`;
    }
    document.getElementById('events-list').innerHTML = html || '<p style="color:var(--text-3);padding:8px">No events yet.</p>';
  }
}

function renderResearch() {
  const centreEl = document.getElementById('centre-count');
  const rpEl     = document.getElementById('rp-per-turn');
  if (centreEl) centreEl.textContent = G.researchCentres;
  if (rpEl)     rpEl.textContent = getRpPerTurn();

  const buildBar = document.getElementById('build-centre-bar');
  if (buildBar) {
    const infraFunded  = G.policyFunding.infrastructure > 0;
    const infraSpend   = Math.round(getTaxIncome() * (G.policyFunding.infrastructure / 100));
    const progressPct  = Math.min(100, (G.centreBuildProgress / CENTRE_BUILD_COST) * 100).toFixed(1);
    const turnsLeft    = (infraSpend > 0 && G.buildingCentre)
      ? Math.ceil((CENTRE_BUILD_COST - G.centreBuildProgress) / infraSpend)
      : '—';

    const toggleCls = G.buildingCentre ? 'btn-toggle-build active' : 'btn-toggle-build';
    const toggleLabel = G.buildingCentre ? 'Building…' : 'Build';
    const hint = !infraFunded && !G.buildingCentre
      ? '<div class="build-centre-hint">Requires infrastructure funding</div>' : '';
    const progressHtml = G.buildingCentre ? `
      <div class="build-progress-wrap">
        <div class="build-progress-bar-bg"><div class="build-progress-bar-fill" style="width:${progressPct}%"></div></div>
        <div class="build-progress-label">$${Math.floor(G.centreBuildProgress)}M / $${CENTRE_BUILD_COST}M &nbsp;·&nbsp; ~${turnsLeft} turns left</div>
      </div>` : '';

    buildBar.innerHTML = `
      <div class="build-centre-row">
        <div class="build-centre-info">
          <span class="build-centre-title">🏗️ Research Centre</span>
          <span class="build-centre-sub">Uses infrastructure budget · $${CENTRE_BUILD_COST}M total</span>
        </div>
        <button class="${toggleCls}" onclick="toggleBuildCentre()">${toggleLabel}</button>
      </div>
      ${progressHtml}
      ${hint}`;
  }

  const tiers = [1, 2, 3];
  let html = '';

  for (const tier of tiers) {
    html += `<div class="research-tier"><div class="tier-label">Tier ${tier}</div><div class="tier-techs">`;
    for (const [id, tech] of Object.entries(TECHNOLOGIES)) {
      if (tech.tier !== tier) continue;
      const unlocked      = G.unlockedTechs.includes(id);
      const reqMet        = !tech.requires || G.unlockedTechs.includes(tech.requires);
      const isActive      = G.activeResearch === id;
      const busyElsewhere = !!G.activeResearch && !isActive;
      const available     = !unlocked && reqMet;
      const progressPct   = isActive ? Math.min(100, (G.researchProgress / tech.cost) * 100).toFixed(1) : 0;

      let cls = 'tech-card ';
      if (unlocked)          cls += 'tech-unlocked';
      else if (isActive)     cls += 'tech-available tech-researching';
      else if (!reqMet)      cls += 'tech-locked';
      else if (busyElsewhere) cls += 'tech-available tech-busy';
      else                   cls += 'tech-available';

      const reqText = tech.requires && !unlocked
        ? `<div class="tech-req">Req: ${TECHNOLOGIES[tech.requires].name}</div>` : '';

      let actionHtml = '';
      if (isActive) {
        actionHtml = `
          <div class="tech-progress-wrap">
            <div class="tech-progress-bar-bg"><div class="tech-progress-bar-fill" style="width:${progressPct}%"></div></div>
            <div class="tech-progress-label">${Math.floor(G.researchProgress)} / ${tech.cost} RP</div>
          </div>
          <button class="btn-cancel-research" onclick="setActiveResearch('${id}')">Cancel</button>`;
      } else if (available && !busyElsewhere) {
        actionHtml = `<button class="btn-start-research" onclick="setActiveResearch('${id}')">&#128300; Research</button>`;
      }

      html += `
        <div class="${cls}" title="${tech.description}">
          <span class="tech-icon">${tech.icon}</span>
          <div class="tech-info">
            <div class="tech-name">${tech.name}</div>
            <div class="tech-cost">${unlocked ? '✓ Unlocked' : tech.cost + ' RP needed'}</div>
            <div class="tech-effect">${tech.effects.effectDesc}</div>
            ${reqText}
            ${actionHtml}
          </div>
          <span class="tech-tier-badge">T${tier}</span>
        </div>`;
    }
    html += '</div></div>';
  }

  document.getElementById('research-tree').innerHTML = html;
}

// ============================================================
// TAB SWITCHING
// ============================================================

function showPolicyTab(tab, btn) {
  G.currentPolicyTab = tab;
  document.querySelectorAll('#policy-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderPolicies();
}

function showDashboardTab(tab, btn) {
  G.currentDashboardTab = tab;
  document.querySelectorAll('#dashboard-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  document.querySelectorAll('.dashboard-tab').forEach(el => el.classList.add('hidden'));
  document.getElementById('tab-' + tab).classList.remove('hidden');

  renderDashboard();
}

// ============================================================
// NOTIFICATIONS
// ============================================================

function showNotification(message, type) {
  const container = document.getElementById('notification-container');
  const notif = document.createElement('div');
  notif.className = 'notification ' + (type || 'info');
  notif.textContent = message;
  container.appendChild(notif);
  setTimeout(() => {
    notif.style.transition = 'opacity 0.4s';
    notif.style.opacity = '0';
    setTimeout(() => notif.remove(), 400);
  }, 2800);
}

// ============================================================
// HELPERS
// ============================================================

function fmt(amount) {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  if (abs < 1 && abs > 0) return sign + '$' + abs.toFixed(2) + 'M';
  return sign + '$' + Math.round(abs).toLocaleString() + 'M';
}

// ============================================================
// START GAME
// ============================================================

function startGame() {
  const name = (document.getElementById('empire-input').value || '').trim();
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('app').classList.remove('hidden');
  initGame(name || 'New Empire');
}

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('empire-input');
  if (input) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') startGame();
    });
    input.focus();
  }
});
