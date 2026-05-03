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
  return Math.round(TECHNOLOGIES[techId].cost * getTechEffects().techCostMult * getProjectEffects().techCostMult);
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
  // Healthcare and education cost more with a larger population (sub-linear economies of scale)
  if (policyId === 'healthcare' || policyId === 'education') {
    cost *= Math.pow(G.population / POPULATION_REFERENCE, POPULATION_COST_EXPONENT);
  }
  if (te.policyCostMult[policyId]) cost *= te.policyCostMult[policyId];
  cost *= te.allPolicyCostMult;
  return cost;
}

// What will actually leave the treasury for policyId this turn, accounting for the fact
// that a maxed-out sector can't absorb full spend (the rest is automatically saved).
function getEffectivePolicyCost(policyId) {
  const full = getPolicyCost(policyId);
  if (full <= 0) return 0;

  if (policyId === 'infrastructure') {
    const te = getTechEffects();
    const pe = getProjectEffects();
    const L  = G.infraLevel;
    const repairSpend = full;
    const decay = getTaxIncome() * INFRA_MAINTAIN_FRAC / (1 + INFRA_REPAIR_HARDNESS * L) * te.infraDecayMult * pe.infraDecayMult;
    const repairRate = INFRA_REPAIR_PER_M / (1 + INFRA_REPAIR_HARDNESS * L) * te.infraGrowthMult;
    const unclamped = L + repairSpend * repairRate - decay;
    if (unclamped > 100) {
      const refund = (unclamped - 100) / repairRate;
      return repairSpend - refund;
    }
    return full;
  }

  const levelKey = policyId + 'Level';
  if (G[levelKey] === undefined) return full;
  const L = G[levelKey];
  const isSlowDecay = (policyId === 'healthcare' || policyId === 'education' || policyId === 'research');
  const decay = isSlowDecay ? SOCIAL_SECTOR_DECAY : SECTOR_DECAY;
  const growRate = SECTOR_GROW_PER_M / (1 + SECTOR_GROW_HARDNESS * L);
  const unclamped = L + full * growRate - decay;
  const cap = policyId === 'research' ? getResearchCapacityCeiling() : 100;
  if (unclamped > cap) {
    const refund = (unclamped - cap) / growRate;
    return full - refund;
  }
  return full;
}

function getTotalExpenses() {
  return Object.keys(G.policyFunding).reduce((sum, id) => sum + getEffectivePolicyCost(id), 0);
}

function getNetIncome() {
  return getTaxIncome() - getTotalExpenses();
}

// Full per-turn treasury change: policy net + trade route income + project passive income + interest.
function getTotalNetIncome() {
  const pe = getProjectEffects();
  const interestRate = G.treasury < 0 ? getDebtInterestRate() : getSavingsInterestRate();
  const interest = G.treasury * interestRate;
  return getNetIncome() - getProjectFundingTotal() + getTotalTradeIncome() + interest + pe.passiveIncome;
}

// Effects from completed projects — research, infra, trade, and GDP bonuses.
function getProjectEffects() {
  const e = {
    researchCeilingBonus: 0,
    researchSpeedMult:    1.0,
    techCostMult:         1.0,
    infraDecayMult:       1.0,
    gdpGrowthBonus:       0,
    passiveIncome:        0,
    commerceLevelBonus:   0,
    tradeIncomeMult:      1.0,
  };
  for (const id of (G.completedProjects || [])) {
    const fx = PROJECTS[id].effects;
    if (fx.researchCeilingBonus) e.researchCeilingBonus += fx.researchCeilingBonus;
    if (fx.researchSpeedMult)    e.researchSpeedMult    *= fx.researchSpeedMult;
    if (fx.techCostMult)         e.techCostMult         *= fx.techCostMult;
    if (fx.infraDecayMult)       e.infraDecayMult       *= fx.infraDecayMult;
    if (fx.gdpGrowthBonus)       e.gdpGrowthBonus       += fx.gdpGrowthBonus;
    if (fx.passiveIncome)        e.passiveIncome        += fx.passiveIncome;
    if (fx.commerceLevelBonus)   e.commerceLevelBonus   += fx.commerceLevelBonus;
    if (fx.tradeIncomeMult)      e.tradeIncomeMult      *= fx.tradeIncomeMult;
  }
  return e;
}

// Maximum research level achievable (raised by completing research projects).
function getResearchCapacityCeiling() {
  return RESEARCH_LEVEL_BASE_CEILING + getProjectEffects().researchCeilingBonus;
}

// Total treasury drained per turn by active project investments.
function getProjectFundingTotal() {
  let total = 0;
  for (const [id, amount] of Object.entries(G.projectFunding || {})) {
    if (!G.completedProjects.includes(id) && amount > 0) total += amount;
  }
  return total;
}

// Estimated turns to complete a tech at current RP/turn (Infinity if no research capacity).
function getTurnsToComplete(techId) {
  const rp = getRpPerTurn();
  if (rp <= 0) return Infinity;
  const remaining = getTechCost(techId) - (G.activeResearch === techId ? G.researchProgress : 0);
  return Math.ceil(Math.max(0, remaining) / rp);
}

// All policy effects come from accumulated levels, not from current spending.
// policyEffectScale() has been removed — see Phase 2.5 design notes in ideas.md.

function getEffectiveGrowthRate() {
  let rate = G.gdpGrowthRate;
  const pe = getProjectEffects();
  // Infrastructure: GDP bonus scales with accumulated level (0–100)
  rate += POLICIES.infrastructure.effects.gdpGrowth * (G.infraLevel / 100);
  // Mining: GDP bonus up to +0.1% at level 100
  rate += 0.001 * (G.miningLevel / 100);
  // Manufacturing: effective level capped by Mining; GDP bonus up to +0.2% at effective level 100
  const effectiveMfgLevel = Math.min(G.manufacturingLevel, G.miningLevel);
  rate += 0.002 * (effectiveMfgLevel / 100);
  // Commerce: GDP bonus up to +0.2% at effective level 100 (Airport project adds +10), amplified by manufacturing
  const effectiveCommerceLevel = Math.min(100, G.commerceLevel + pe.commerceLevelBonus);
  rate += 0.002 * (effectiveCommerceLevel / 100) * (0.5 + 0.5 * effectiveMfgLevel / 100);
  // Education: GDP bonus scales with accumulated level (up to EDUCATION_GDP_GROWTH_MAX at 100)
  rate += EDUCATION_GDP_GROWTH_MAX * (G.educationLevel / 100);
  rate += getTechEffects().gdpGrowthBonus;
  // Project GDP growth bonuses (Highway, Rail, Power Grid, Great Dam, Internet)
  rate += pe.gdpGrowthBonus;

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

// Computes the happiness value that current policies/tax/tech are pulling toward.
// The actual G.happiness pool converges toward this target slowly each turn.
function calcHappinessTarget() {
  let h = HAPPINESS_BASELINE;
  // Social policy levels contribute happiness based on accumulated investment
  h += HEALTHCARE_HAPPINESS_MAX * (G.healthcareLevel / 100);
  h += EDUCATION_HAPPINESS_MAX  * (G.educationLevel  / 100);
  h -= MILITARY_HAPPINESS_PENALTY * (G.militaryLevel / 100);
  // Tax: 0% gives +15 happiness, 15% neutral, higher = penalty
  h -= Math.round((G.taxRate - 0.15) * 100);
  h += getTechEffects().happinessBonus;
  return Math.max(0, Math.min(100, h));
}

function getDebtInterestRate() {
  if (G.treasury >= 0) return 0;
  // Finance level reduces debt interest by up to 50% at level 100
  const financeDiscount = 1 - 0.5 * (G.financeLevel / 100);
  return Math.min(DEBT_INTEREST_MAX, DEBT_INTEREST_SCALE * Math.sqrt(Math.abs(G.treasury))) * financeDiscount;
}

function getSavingsInterestRate() {
  if (G.treasury <= 0) return 0;
  return SAVINGS_INTEREST_BASE / (1 + G.treasury / SAVINGS_INTEREST_SCALE);
}

function getRpPerTurn() {
  if (G.researchLevel <= 0) return 0;
  const pe = getProjectEffects();
  const te = getTechEffects();
  // Base RP from accumulated research level
  const base = G.researchLevel * RP_PER_RESEARCH_LEVEL;
  // Education bonus (flat, scales with education level)
  const eduBonus = EDUCATION_RP_BONUS_MAX * (G.educationLevel / 100);
  // Tech bonus (rpResearchCentreBonus — legacy name, still a flat RP bonus)
  const techBonus = te.rpResearchCentreBonus || 0;
  return (base + eduBonus + techBonus) * pe.researchSpeedMult;
}

// Income for a single route: ramps linearly from $0 to TRADE_ROUTE_INCOME_MAX over TRADE_ROUTE_MATURITY_TURNS.
function getTradeRouteIncome(route) {
  return TRADE_ROUTE_INCOME_MAX * Math.min(1, route.maturity / TRADE_ROUTE_MATURITY_TURNS);
}

// Total trade income across all active routes, multiplied by Seaport Expansion bonus if complete.
function getTotalTradeIncome() {
  const pe = getProjectEffects();
  return G.tradeRoutes.reduce((sum, r) => sum + getTradeRouteIncome(r), 0) * pe.tradeIncomeMult;
}

// Military strength: scales with accumulated militaryLevel, soft-capped by population manpower.
function getMilitaryStrength() {
  const raw = MILITARY_STRENGTH_MAX * (G.militaryLevel / 100);
  return Math.min(raw, G.population * MILITARY_MANPOWER_RATIO);
}

// Population capacity: territory × base × infrastructure multiplier × project/tech multipliers.
function getPopulationCap() {
  const infraFactor = 1 + G.infraLevel * INFRA_POP_CAP_SCALE;
  return G.territoryScore * BASE_TERRITORY_CAP * infraFactor
    * G.agriculturalFactor * G.populationCapTechFactor;
}

// Population growth rate this turn: base + happiness + healthcare level mods, capped by capacity.
function getPopulationGrowthRate() {
  const cap = getPopulationCap();
  const capMult = Math.max(0, 1 - Math.pow(G.population / cap, 2));
  const happinessMod = (G.happiness - 50) * POP_GROWTH_HAPPINESS_SCALE;
  // Healthcare level drives population growth (max contribution at level 100)
  const healthcareMod = (G.healthcareLevel / 100) * POP_GROWTH_HEALTHCARE_SCALE;
  const rawRate = POP_GROWTH_BASE + happinessMod + healthcareMod;
  const clampedRate = Math.max(POP_GROWTH_MIN, Math.min(POP_GROWTH_MAX, rawRate));
  return clampedRate * capMult;
}
