// ============================================================
// ENGINE — pure calculation functions (no DOM, no G mutation)
// ============================================================

function getTechEffects() {
  const e = {
    gdpGrowthBonus:                0,
    happinessBonus:                0,
    rpResearchCentreBonus:         0,
    allPolicyCostMult:             1.0,
    policyCostMult:                {},
    techCostMult:                  1.0,
    infraDecayMult:                1.0,
    infraGrowthMult:               1.0,
    industrialGrowthMult:          1.0,   // applies to mining + manufacturing growth rate
    industrialDecayMult:           1.0,   // applies to mining + manufacturing decay rate
    tradeExportQualityBonus:       0,     // flat bonus to base export quality in negotiations
    tradeImportPriceReduction:     0,     // flat reduction to base import asking price
    culturalExchangeRelationsBonus: 0,    // bonus relations score per active trade route
    cultureDiplomacyRelationsBonus: 0,    // flat relations bonus to all nations from Cultural Diplomacy tech
    unRelationsBonus:               0,    // flat relations bonus to all nations from UN Membership tech
  };
  for (const id of G.unlockedTechs) {
    const fx = TECHNOLOGIES[id].effects;
    if (fx.gdpGrowthBonus)                e.gdpGrowthBonus                += fx.gdpGrowthBonus;
    if (fx.happinessBonus)                e.happinessBonus                += fx.happinessBonus;
    if (fx.rpResearchCentreBonus)         e.rpResearchCentreBonus         += fx.rpResearchCentreBonus;
    if (fx.allPolicyCostMult)             e.allPolicyCostMult             *= fx.allPolicyCostMult;
    if (fx.techCostMult)                  e.techCostMult                  *= fx.techCostMult;
    if (fx.infraDecayMult)                e.infraDecayMult                *= fx.infraDecayMult;
    if (fx.infraGrowthMult)               e.infraGrowthMult               *= fx.infraGrowthMult;
    if (fx.industrialGrowthMult)          e.industrialGrowthMult          *= fx.industrialGrowthMult;
    if (fx.industrialDecayMult)           e.industrialDecayMult           *= fx.industrialDecayMult;
    if (fx.tradeExportQualityBonus)       e.tradeExportQualityBonus       += fx.tradeExportQualityBonus;
    if (fx.tradeImportPriceReduction)     e.tradeImportPriceReduction     += fx.tradeImportPriceReduction;
    if (fx.culturalExchangeRelationsBonus) e.culturalExchangeRelationsBonus += fx.culturalExchangeRelationsBonus;
    if (fx.cultureDiplomacyRelationsBonus) e.cultureDiplomacyRelationsBonus += fx.cultureDiplomacyRelationsBonus;
    if (fx.unRelationsBonus)               e.unRelationsBonus               += fx.unRelationsBonus;
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

// Leverage of the player over a nation during negotiation.
// leverage = clamp(militaryLevel / nationMilitaryLevel × relations/50, 0.1, 3.0)
// A nation with no military (level 0) is treated as level 1 to avoid division by zero.
function getTradeNegotiationLeverage(nationId) {
  const ns  = G.nations[nationId];
  const def = NATIONS[nationId];
  const milRatio = G.militaryLevel / Math.max(1, def.militaryLevel);
  const relFactor = (ns.relations + 100) / 100;
  return Math.max(0.1, Math.min(3.0, milRatio * relFactor));
}

// Deal quality for a given negotiation round and nation.
// Higher leverage and more rounds → better deal.
function getTradeNegotiationDealQuality(nationId, round) {
  const leverage = getTradeNegotiationLeverage(nationId);
  const q = TRADE_OFFER_QUALITY_BASE
    + (leverage / 3) * TRADE_OFFER_QUALITY_LEVERAGE
    + (round - 1)   * TRADE_OFFER_QUALITY_PUSH;
  return Math.max(TRADE_OFFER_QUALITY_MIN, Math.min(TRADE_OFFER_QUALITY_MAX, q));
}

// Max export volume (Mt) the player can offer for a given resource to a given nation.
function getTradeMaxExportVolume(nationId, resourceId) {
  const mult = (NATIONS[nationId].trade.demandByResource || {})[resourceId] || 0;
  return Math.max(1, Math.round(TRADE_VOLUME_BASE * mult));
}

// Max import volume (Mt) a nation can supply for a given resource.
function getTradeMaxImportVolume(nationId, resourceId) {
  const mult = (NATIONS[nationId].trade.supplyByResource || {})[resourceId] || 0;
  return Math.max(1, Math.round(TRADE_VOLUME_BASE * mult));
}

// Nation's counter offer for a given push state.
// exportQuality: what they pay per unit of player's exports (higher = more income for player).
// importQuality: their asking price per unit supplied (lower = more savings for player).
function getNationCounterOffer(nationId, pushCount, threatened) {
  const leverage = getTradeNegotiationLeverage(nationId);
  const te = getTechEffects();
  const exportQuality = Math.max(TRADE_OFFER_QUALITY_MIN, Math.min(TRADE_OFFER_QUALITY_MAX,
    TRADE_OFFER_QUALITY_BASE + te.tradeExportQualityBonus
    + (leverage / 3) * TRADE_OFFER_QUALITY_LEVERAGE
    + pushCount * TRADE_OFFER_QUALITY_PUSH
    + (threatened ? TRADE_OFFER_QUALITY_THREATEN : 0)
  ));
  const importQuality = Math.min(TRADE_IMPORT_PRICE_MAX, Math.max(0.1,
    TRADE_IMPORT_PRICE_BASE - te.tradeImportPriceReduction + pushCount * TRADE_IMPORT_PRICE_PUSH
  ));
  return { exportQuality, importQuality };
}

// Collapse risk if the player has pushed pushCount times (including this push).
function getPushCollapseRisk(nationId, pushCount, threatened) {
  const leverage = getTradeNegotiationLeverage(nationId);
  return Math.max(0, Math.min(0.95,
    pushCount * TRADE_COLLAPSE_RISK_PER_PUSH
    - leverage * TRADE_COLLAPSE_LEVERAGE_REDUCE
    + (threatened ? TRADE_COLLAPSE_THREATEN_ADD : 0)
  ));
}

// Relations cost applied immediately when the player pushes.
function getPushRelationsCost(pushCount, threatened) {
  const base  = TRADE_PUSH_RELATIONS_BASE  + pushCount * TRADE_PUSH_RELATIONS_SCALE;
  const extra = threatened ? TRADE_PUSH_THREATEN_RELATIONS + pushCount * TRADE_PUSH_THREATEN_REL_SCALE : 0;
  return base + extra;
}

// Probability the nation straight-up accepts on the next response (requires pushCount >= 1).
function getStraightAcceptChance(nationId, pushCount) {
  if (pushCount < 1) return 0;
  const leverage = getTradeNegotiationLeverage(nationId);
  const ns = G.nations[nationId];
  return Math.max(0, Math.min(0.7,
    TRADE_STRAIGHT_ACCEPT_BASE
    + Math.max(0, leverage - 1.0) * TRADE_STRAIGHT_ACCEPT_LEVERAGE
    + Math.max(0, ns.relations) * TRADE_STRAIGHT_ACCEPT_RELATIONS
  ));
}

// Total resource output (Mt/yr) across all established industry pools.
function getPlayerResourceOutput() {
  const out = {};
  for (const [rid, data] of Object.entries(G.establishedIndustries || {})) {
    out[rid] = data.totalOutput || 0;
  }
  return out;
}

// Export income from a route: player's resource surplus × nation demand × quality × maturity.
function getTradeRouteExportIncome(route) {
  if (!route.nationId || !NATIONS[route.nationId]) return 0;
  const maturityMult = Math.min(1, route.maturity / TRADE_ROUTE_MATURITY_TURNS);
  const eq = route.exportQuality || 0;
  const playerOutput = getPlayerResourceOutput();
  const demands = NATIONS[route.nationId].trade.demandByResource || {};
  let income = 0;
  for (const [rid, demandMult] of Object.entries(demands)) {
    const maxDemandVol = Math.max(1, Math.round(TRADE_VOLUME_BASE * demandMult));
    const available   = playerOutput[rid] || 0;
    const exportVol   = Math.min(available, maxDemandVol);
    if (exportVol > 0) {
      income += exportVol * (RESOURCE_EXPORT_PRICE[rid] || 0) * eq * maturityMult;
    }
  }
  return income;
}

// Import saving from a route: nation supplies resources the player lacks, reducing effective import cost.
// saving = shortfall × price × RESOURCE_IMPORT_SAVING_FRAC × (1 − importQuality) × maturity
// Lower importQuality = cheaper rate negotiated = more savings.
function getTradeRouteImportSaving(route) {
  if (!route.nationId || !NATIONS[route.nationId]) return 0;
  const maturityMult = Math.min(1, route.maturity / TRADE_ROUTE_MATURITY_TURNS);
  const iq = route.importQuality || 0;
  const savingMult = Math.max(0, 1 - iq);
  if (savingMult <= 0) return 0;
  const playerOutput = getPlayerResourceOutput();
  const supplies = NATIONS[route.nationId].trade.supplyByResource || {};
  let saving = 0;
  for (const [rid, supplyMult] of Object.entries(supplies)) {
    const maxSupplyVol = Math.max(1, Math.round(TRADE_VOLUME_BASE * supplyMult));
    const playerHas   = playerOutput[rid] || 0;
    const shortfall   = Math.max(0, maxSupplyVol - playerHas);
    if (shortfall > 0) {
      saving += shortfall * (RESOURCE_EXPORT_PRICE[rid] || 0) * RESOURCE_IMPORT_SAVING_FRAC * savingMult * maturityMult;
    }
  }
  return saving;
}

// Combined export income + import savings for a route.
function getTradeRouteIncome(route) {
  return getTradeRouteExportIncome(route) + getTradeRouteImportSaving(route);
}

// Total trade income across all active routes, multiplied by Seaport Expansion bonus if complete.
function getTotalTradeIncome() {
  const pe = getProjectEffects();
  return G.tradeRoutes.reduce((sum, r) => sum + getTradeRouteIncome(r), 0) * pe.tradeIncomeMult;
}

// Compute the relations score (-100 to +100) for a nation from all contributing factors.
// Called at end of each turn after per-turn history is updated.
function computeNationRelations(nationId) {
  const ns    = G.nations[nationId];
  const def   = NATIONS[nationId];
  const route = G.tradeRoutes.find(r => r.nationId === nationId);
  let score   = 0;

  // 1. Active trade route presence: +8
  if (route) score += 8;

  // 2. Route maturity bonus: up to +20 (route.maturity normalised against TRADE_ROUTE_MATURITY_TURNS)
  if (route) score += Math.round(Math.min(1, route.maturity / TRADE_ROUTE_MATURITY_TURNS) * 20);

  // 3. Import reliance: +4 per resource the nation demands that the player actually produces (max +16)
  const output = getPlayerResourceOutput();
  const demand = def.trade.demandByResource || {};
  const relianceCount = Object.keys(demand).filter(rid => (output[rid] || 0) > 0).length;
  score += Math.min(relianceCount * 4, 16);

  // 4. Trade volume share: route income as fraction of nation GDP — up to +12
  if (route) {
    const income   = getTradeRouteIncome(route);
    const gdpShare = income / Math.max(1, ns.gdp);
    score += Math.min(12, Math.round(gdpShare * 500));
  }

  // 5. First contact bonus: +5, permanent once earned
  if (ns.relationsFirstContact) score += 5;

  // 6. Streak bonus: +2/turn of consecutive trade, capped at +14
  score += Math.min(14, Math.floor(ns.relationsStreak) * 2);

  // 7. Negotiation pressure penalty (stored as a negative value; recovers over time)
  score += ns.relationsNegPenalty;

  // 8. Broken route penalties: -15 each, recovering +3/turn until expired
  for (const ev of ns.relationsBrokenRoutes) {
    const turnsAgo = G.turn - ev.turn;
    score += Math.min(0, -15 + turnsAgo * 3);
  }

  // 9. Cultural Exchange tech: flat bonus when active route exists
  const ceTechFx = getTechEffects();
  if (route && ceTechFx.culturalExchangeRelationsBonus > 0) score += ceTechFx.culturalExchangeRelationsBonus;

  // 10. Active Alliance: flat per-turn relations bonus
  const alliance = (G.diplomaticDeals || []).find(d => d.type === 'alliance' && d.nationId === nationId);
  if (alliance) score += ALLIANCE_RELATIONS_BONUS;

  // 11. Cultural Diplomacy tech: flat bonus to all nations
  score += ceTechFx.cultureDiplomacyRelationsBonus;

  // 12. UN Membership tech: global relations bonus
  score += ceTechFx.unRelationsBonus;

  const clamped = Math.max(-100, Math.min(100, Math.round(score)));
  // Alliance floor: allied nations can never drop below Friendly tier
  return alliance ? Math.max(ALLIANCE_RELATIONS_FLOOR, clamped) : clamped;
}

// Military strength: scales with accumulated militaryLevel, soft-capped by population manpower.
function getMilitaryStrength() {
  const raw = MILITARY_STRENGTH_MAX * (G.militaryLevel / 100);
  return Math.min(raw, G.population * MILITARY_MANPOWER_RATIO);
}

// Resource Deposits (Phase 3.5) ============================================================

// Returns the max number of deposit slots for a province (stored directly on the province).
function getRegionCapacity(provinceId) {
  const prov = PROVINCES[provinceId];
  if (!prov) return 0;
  return prov.depositSlots || 2;
}

// Returns number of currently active deposits (all statuses) in a province.
function getRegionActiveDepositCount(provinceId) {
  return G.deposits.filter(d => d.regionId === provinceId).length;
}

// Returns player province IDs that still have at least one free deposit slot.
function getFreeSlotProvinces() {
  return Object.keys(PROVINCES)
    .filter(id => PROVINCES[id].nationId === 'player')
    .filter(id => getRegionActiveDepositCount(id) < getRegionCapacity(id));
}

// Regional congestion multiplier: +20% development cost per other deposit in the same region.
function getRegionCongestionMultiplier(dep) {
  if (!dep.regionId) return 1;
  const others = G.deposits.filter(d => d.regionId === dep.regionId && d.id !== dep.id).length;
  return 1 + 0.20 * others;
}

// Returns IDs of all resource types currently discoverable:
// requiresTech === null = always available; otherwise needs that resource ID in G.unlockedResources.
function getAvailableResourceTypes() {
  return Object.keys(RESOURCE_TYPES).filter(id => {
    const req = RESOURCE_TYPES[id].requiresTech;
    return req === null || G.unlockedResources.includes(id);
  });
}

// Per-turn discovery chance. Returns 0 if all province slots are full.
// Otherwise scales with prospectingLevel; diminishes with total active deposits.
function getProspectChance() {
  if (getFreeSlotProvinces().length === 0) return 0;
  const levelBonus = G.prospectingLevel * PROSPECT_LEVEL_SCALE;
  const diminish   = 1 / (1 + G.deposits.length * PROSPECT_DIMINISH_RATE);
  return (PROSPECT_BASE_CHANCE + levelBonus) * diminish;
}

// Total cost ($M) for the current development phase of a deposit, including regional congestion.
function getDepositDevelopCost(dep) {
  const congestion = getRegionCongestionMultiplier(dep);
  let base = 0;
  if (dep.status === 'anomaly' || dep.status === 'surveying') base = DEPOSIT_SURVEY_COST;
  else if (dep.status === 'commissioning') base = DEPOSIT_COMMISSION_COST[dep.currentTier] || 0;
  else if (dep.status === 'upgrading') base = DEPOSIT_TIER_UPGRADE_COST[dep.currentTier] || 0;
  return Math.round(base * congestion);
}

// Whether the player has the tech to attempt an upgrade from a deposit's current tier.
function canUpgradeDeposit(dep) {
  if (dep.status !== 'producing') return false;
  if (dep.currentTier === 'majorReserve') return false;
  const techNeeded = {
    occurrence: 'prospectingMethods',
    vein:       'industrialMining',
    deposit:    'openPitMining',
    reserve:    'deepVeinExtraction',
  };
  const needed = techNeeded[dep.currentTier];
  return needed ? G.unlockedTechs.includes(needed) : false;
}

// Mt/yr produced by a deposit (0 if not currently in 'producing' status).
function getDepositOutput(dep) {
  if (dep.status !== 'producing' || !dep.currentTier) return 0;
  return DEPOSIT_TIER_OUTPUT[dep.currentTier] || 0;
}

// Sum of Mt/yr per resource type: active producing deposits + established industry pool.
function getResourceProduction() {
  const prod = {};
  for (const dep of G.deposits) {
    const units = getDepositOutput(dep);
    if (units > 0 && dep.resourceType) {
      prod[dep.resourceType] = (prod[dep.resourceType] || 0) + units;
    }
  }
  for (const [resType, industry] of Object.entries(G.establishedIndustries || {})) {
    if (industry.totalOutput > 0) {
      prod[resType] = (prod[resType] || 0) + industry.totalOutput;
    }
  }
  return prod;
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
