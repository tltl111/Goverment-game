// ============================================================
// ENGINE — pure calculation functions (no DOM, no G mutation)
// ============================================================

function getTechEffects() {
  const e = {
    gdpGrowthBonus:        0,
    happinessBonus:        0,
    rpResearchCentreBonus: 0,
    allPolicyCostMult:     1.0,
    policyCostMult:        {},
    techCostMult:          1.0,
    infraDecayMult:        1.0,
    infraGrowthMult:       1.0,
  };
  for (const id of G.unlockedTechs) {
    const fx = TECHNOLOGIES[id].effects;
    if (fx.gdpGrowthBonus)        e.gdpGrowthBonus        += fx.gdpGrowthBonus;
    if (fx.happinessBonus)        e.happinessBonus        += fx.happinessBonus;
    if (fx.rpResearchCentreBonus) e.rpResearchCentreBonus += fx.rpResearchCentreBonus;
    if (fx.allPolicyCostMult)     e.allPolicyCostMult     *= fx.allPolicyCostMult;
    if (fx.techCostMult)          e.techCostMult          *= fx.techCostMult;
    if (fx.infraDecayMult)        e.infraDecayMult        *= fx.infraDecayMult;
    if (fx.infraGrowthMult)       e.infraGrowthMult       *= fx.infraGrowthMult;
    if (fx.policyCostMult) {
      for (const [k, v] of Object.entries(fx.policyCostMult)) {
        e.policyCostMult[k] = (e.policyCostMult[k] || 1) * v;
      }
    }
  }
  return e;
}

function getTechCost(techId) {
  return Math.round(TECHNOLOGIES[techId].cost * getTechEffects().techCostMult);
}

function getTaxIncome() {
  // GDP ($B) * taxRate * 10 = income ($M)
  return G.gdp * G.taxRate * 10;
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

function getNetIncome() {
  return getTaxIncome() - getTotalExpenses();
}

// How much a policy's effects are scaled given current income and funding.
// 1.0 = baseline (starting economy, max slider). Grows with GDP.
function policyEffectScale(policyId) {
  const funding = G.policyFunding[policyId] || 0;
  if (funding <= 0) return 0;
  // Infrastructure effects are diverted toward building a research centre
  if (policyId === 'infrastructure' && G.buildingResearchCentre) return 0;
  return getTaxIncome() * (funding / 100) / POLICY_REFERENCE_SPEND;
}

function getEffectiveGrowthRate() {
  let rate = G.gdpGrowthRate;
  for (const id of Object.keys(G.policyFunding)) {
    if (id === 'infrastructure') continue; // infraLevel drives this
    if (id === 'mining' || id === 'manufacturing' || id === 'commerce' || id === 'finance') continue; // sector levels drive these
    if (POLICIES[id].effects.gdpGrowth) {
      rate += POLICIES[id].effects.gdpGrowth * policyEffectScale(id);
    }
  }
  // Infrastructure: GDP bonus scales with accumulated level (0–100)
  rate += POLICIES.infrastructure.effects.gdpGrowth * (G.infraLevel / 100);
  // Mining: GDP bonus up to +0.1% at level 100
  rate += 0.001 * (G.miningLevel / 100);
  // Manufacturing: effective level capped by Mining; GDP bonus up to +0.2% at effective level 100
  const effectiveMfgLevel = Math.min(G.manufacturingLevel, G.miningLevel);
  rate += 0.002 * (effectiveMfgLevel / 100);
  // Commerce: GDP bonus up to +0.2% at level 100, amplified by manufacturing support
  rate += 0.002 * (G.commerceLevel / 100) * (0.5 + 0.5 * effectiveMfgLevel / 100);
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
  const rpPerResearchCentre = RP_PER_RESEARCH_CENTRE + eduBonus + getTechEffects().rpResearchCentreBonus;
  return rpPerResearchCentre * G.researchCentres;
}

function getTradeRouteSlots() {
  return Math.floor(G.financeLevel / TRADE_ROUTE_LEVEL_NEEDED);
}

function getTradeRouteIncomePerRoute() {
  return TRADE_ROUTE_INCOME + G.financeLevel * TRADE_ROUTE_FINANCE_SCALE;
}
