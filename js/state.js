// ============================================================
// STATE — game state object and initialisation
// ============================================================

let G = null;

function initGame(empireName) {
  G = {
    empire: empireName || 'New Empire',
    year: 2024,
    turn: 1,
    treasury: 100000,
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
    techQueue: [],       // ordered list of techIds queued for auto-research (Phase 5.7d)

    // Economic sector levels (0–100), built by spending on corresponding policies
    miningLevel: 10,
    manufacturingLevel: 10,
    logisticsLevel: 0,
    commerceLevel: 0,
    financeLevel: 0,
    prospectingLevel: 0,

    // Social sector levels (0–100), built by spending on corresponding policies.
    // Effects come from accumulated levels, not current spending.
    healthcareLevel: 0,
    educationLevel: 0,

    // Military branch levels (0–100) — Phase 5.1.
    // Army level removed in Phase 5.7e; unit roster + equipment tier replaces it.
    // Navy and Air Force levels removed in Phase 5.7f; unit rosters replace them too.

    // Equipment tiers per ground unit type (Phase 5.7e).
    // Each entry is 1 (Mk.I), 2 (Mk.II), or 3 (Mk.III).
    equipmentTiers: {
      lightInfantry:      1,
      mechanizedInfantry: 1,
      armoredCorps:       1,
      artilleryBattery:   1,
      reconUnit:          1,
      antiAirBattery:     1,
      antiTankBattalion:  1,
    },

    // Active equipment refits — [{ unitType, targetTier, turnsLeft }]
    // Units of the refitting type get status 'refitting' during the countdown.
    activeRefits: [],

    // Research level (0 – ceiling). Ceiling starts at RESEARCH_LEVEL_BASE_CEILING and is raised
    // by completing research projects. Determines RP/turn toward active technology research.
    researchLevel: 0,

    // Projects
    completedProjects: [],   // array of completed project IDs
    projectProgress: {},     // { projectId: $M invested so far }
    projectFunding: {},      // { projectId: $M/turn allocation }

    // Trade routes — array of route objects
    // { id, nationId, exportQuality, importQuality, maturity }
    // exportQuality: what nation pays per export unit (0.25–1.2)
    // importQuality: nation's asking price per import unit (lower = more savings for player)
    // Income is computed dynamically from playerResourceOutput × nation demand/supply profiles.
    tradeRoutes: [],
    nextTradeRouteId: 1,

    // Active trade negotiation (null when not negotiating)
    // { nationId, status:'drafting'|'awaiting'|'countered', pushCount,
    //   threatenNext:bool, nationOffer:{exportQuality,importQuality}|null, isRenegotiation:bool }
    activeNegotiation: null,

    // Funding 0-20 = percentage of tax income allocated to this policy.
    // Army removed in Phase 5.7e; Navy/Air Force removed in Phase 5.7f.
    // Commander budgets handle all military spending directly.
    policyFunding: {
      mining: 0,
      manufacturing: 0,
      logistics: 0,
      commerce: 0,
      finance: 0,
      infrastructure: 0,
      healthcare: 0,
      education: 0,
      research: 0,
      prospecting: 0,
    },

    // TEST: military + diplomacy + equipment techs pre-unlocked
    unlockedTechs: [
      'standingArmy', 'navalFleet', 'airForceEstablishment',
      'tradeAgreements', 'diplomacyCorps', 'culturalExchange',
      'strategicAlliances', 'culturalDiplomacy', 'economicUnions', 'unMembership',
      'basicMetallurgy', 'ballisticsResearch', 'advancedMetallurgy',
    ],

    // Province installations (Phase 5.3) — [{ type: 'airfield'|'navalBase', provinceId: string }]
    installations: [],

    // Global production queue (Phase 5.7f) — naval and air units are built here.
    // Only the first item is actively produced each turn.
    // Shape: { id, commanderId, branch, unitType, size, unitName, turnsTotal, turnsLeft }
    productionQueue: [],
    nextProductionItemId: 1,

    // Commander assessments (Phase 5.7f) — semi-automatic brain recommendations.
    // Shape: { id, commanderId, type: 'recruit'|'increaseBudget', unitType?, size?, amount?, reason }
    // Player accepts (triggers the action) or dismisses (removes from list).
    commanderAssessments: [],
    nextAssessmentId: 1,

    // Per-commander assessment cooldown — { [commanderId]: turnsUntilNextAssessment }
    commanderAssessmentCooldowns: {},

    // Commanders (Phase 5.4 / 5.7f) — strategic directive assignments for each military branch.
    // Army shape: { id, name, branch:'army', budget, nextUnitId, units:[], order:{type,target} }
    // Navy/Air shape (Phase 5.7f): { id, name, branch, budget, nextUnitId, units[], mission, target }
    //   Navy missions: 'tradeProtection' (target: sea zone ID)
    //   Air missions: 'airSuperiority' | 'strategicBombing' | 'airLogistics' (target: sea zone / nation / province)
    //   Unit shape: { id, name, type, size, status:'ready' }  (typeDefs from NAVAL_UNIT_TYPES / AIR_UNIT_TYPES)
    commanders: [],
    nextCommanderId: 1,

    // Active wars (Phase 5.7c) — [{ nationId, declaredTurn, stagingBonus, sueForPeaceOffered }]
    wars: [],
    // Per-province siege state — { [provId]: { progress: 0-100 } }
    // Exists only while a siege is in progress; deleted on capture or peace.
    siegeState: {},
    // Player-occupied enemy provinces (taken in combat, not yet formally annexed).
    // { [provId]: { originalOwner: nationId, resistance: number (0-100), turnsHeld: number } }
    occupiedProvinces: {},

    // Provinces recently annexed via peace deal, currently undergoing integration.
    // During integration, the province does not contribute deposit slots or resources.
    // { [provId]: { turnsRemaining: number } }
    integratingProvinces: {},

    // Bomb damage accumulation per province — Phase 5.8b.
    // Any province (player or enemy) can accumulate damage from strategic bombing.
    // { [provId]: { damage: number, devLost: number, repairTurns: number } }
    provinceBombDamage: {},
    // Per-turn manufacturing debuff and supply drain from AI bombing (0–1 fractions).
    // Recomputed fresh each endTurn; 0 when no active war.
    bombingMfgDebuff:   0,
    bombingSupplyDrain: 0,

    // Goods stockpile — Phase 5.9
    // Surplus goods accumulate here; drawn on deficit; excess above reserve exported.
    goodsStockpile:          0,   // current accumulated units
    goodsStockpileReserve:   0,   // player-set minimum before exporting (units)
    goodsStockpileDrawRatio: 0,   // recomputed each endTurn; fraction of demand covered by stockpile

    // Fuel system — Phase 5.10
    // Oil × mfg efficiency → fuel; shared pool for Navy + Air Force.
    fuelStockpile:        0,   // accumulated surplus fuel units
    fuelStockpileDrawRatio: 0, // recomputed each endTurn; fraction of fuel demand covered by stockpile

    // AI military — mirrored commander+unit structure per nation.
    // { [nationId]: { commanders: [ same shape as player Army commanders ] } }
    aiMilitary: {},

    // Merchant fleet (Phase 5.4) — civilian transport capacity.
    // Grows each turn from active trade routes + Commerce level; decays slowly.
    // Caps total trade throughput: income is scaled down if volume exceeds fleet capacity.
    merchantFleet: 0,

    // Resource types unlocked via Industrial path techs (used by Phase 3.5 deposits)
    // Iron and Coal are always discoverable (no tech required).
    unlockedResources: [],

    // Resource Deposits (Phase 3.5)
    // deposits: array of in-development deposit objects. Statuses:
    //   'anomaly'      — detected; type and potential unknown
    //   'surveying'    — initial survey in progress; type still unknown
    //   'commissioning'— type/tier known; building mine infrastructure (guaranteed, costs money)
    //   'producing'    — mine is active and producing at currentTier
    //   'upgrading'    — upgrade attempt in progress; production paused (25% success on completion)
    // maxTier is hidden from the player until the deposit reaches it.
    // Fields: { id, resourceType, currentTier, maxTier, status, developProgress }
    deposits: [],

    // Fully-developed deposits absorbed into the national industry pool.
    // Keyed by resource type: { sites: N, totalOutput: N } (output in Mt/yr)
    establishedIndustries: {},

    // Global deposit development slider (one active deposit at a time).
    depositDevelopment: {
      activeDepositId: null,
      funding: 0,   // $M/turn
    },

    // AI nations — live state; static definitions are in NATIONS (data.js).
    // { [id]: { gdp, militaryLevel, relations, relationsNegPenalty, relationsFirstContact, relationsStreak, relationsBrokenRoutes } }
    // GDP is initialised from province development (emergent); grows each turn via gdpGrowthRate.
    nations: Object.fromEntries(
      Object.entries(NATIONS).map(([id, n]) => {
        const initialGdp = Object.values(PROVINCES)
          .filter(p => p.nationId === id)
          .reduce((sum, p) => sum + p.development * GDP_PER_PROVINCE_DEVELOPMENT, 0);
        return [id, {
          gdp:                    initialGdp,
          militaryLevel:          n.militaryLevel,
          relations:              0,
          relationsNegPenalty:    0,
          relationsFirstContact:  false,
          relationsStreak:        0,
          relationsBrokenRoutes:  [],
        }];
      })
    ),

    // Active diplomatic deals — Phase 4.4
    // [{ type: 'nap'|'alliance', nationId: string, turnsLeft: number|null }]
    // Alliance: turnsLeft = null (permanent until broken). NAP: turnsLeft = NAP_DURATION.
    diplomaticDeals: [],

    // Turn-by-turn snapshots for the Statistics screen (last 50 turns)
    history: [],

    eventLog: [
      { message: 'Welcome! Lead ' + (empireName || 'New Empire') + ' to prosperity!', type: 'info', year: 2024 }
    ],

    // UI state
    currentPolicyTab: 'all',
    currentDashboardTab: 'overview',
  };

  initAiMilitaries(); // Phase 5.7c: populate AI army rosters from nation province counts
  renderAll();
}
