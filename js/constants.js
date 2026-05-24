// ============================================================
// CONSTANTS — all numeric tuning values in one place
// ============================================================

// Baseline spending at which policy effects equal defined values — REMOVED.
// All policy effects now come from accumulated levels, not current spending.

// Research level constants
// Research policy builds researchLevel (0 → RESEARCH_LEVEL_BASE_CEILING, raised by projects).
// Each level contributes RP_PER_RESEARCH_LEVEL RP/turn toward active tech research.
const RESEARCH_LEVEL_BASE_CEILING = 50;   // max level without research projects
const RP_PER_RESEARCH_LEVEL       = 0.2;  // RP/turn per research level

// Infrastructure scaling
const INFRA_REPAIR_PER_M     = 1.0;   // base levels gained per $1M spent (at level 0)
const INFRA_REPAIR_HARDNESS  = 0.04;  // each level makes repair harder: rate ÷ (1 + hardness×level)
// Decay scales with current income so early-game budgets can always keep up.
// Formula: decay = income × INFRA_MAINTAIN_FRAC ÷ (1 + hardness×level)
// This guarantees that (INFRA_MAINTAIN_FRAC × 100)% funding exactly maintains infra at any level.
const INFRA_MAINTAIN_FRAC    = 0.10;  // 10% of income spent on infra = zero net decay

// Treasury interest (scaling)
// Debt rate grows with debt: rate = DEBT_INTEREST_SCALE × √|debt|, capped at DEBT_INTEREST_MAX
// Savings rate diminishes with wealth: rate = 1% / (1 + treasury / SAVINGS_INTEREST_SCALE)
const DEBT_INTEREST_SCALE    = 0.001; // at -$100M → ~1%, -$1000M → ~3.2%, -$5000M → ~7%
const DEBT_INTEREST_MAX      = 0.50;  // cap at 50%/turn — painful but not mathematically unrecoverable
const SAVINGS_INTEREST_BASE  = 0.01;  // 1% at very low savings
const SAVINGS_INTEREST_SCALE = 2000;  // at $5000M savings → ~0.3%

// Happiness pool
const HAPPINESS_BASELINE  = 40;  // happiness target with no policies and 15% tax
const HAPPINESS_DRIFT_CAP = 3;   // max points happiness can change per turn

// Economic sectors (Mining, Manufacturing, Commerce, Finance)
// Each is a level 0–100 built up via policy spending, decays when unfunded.
const SECTOR_GROW_PER_M    = 0.5;   // base levels gained per $1M spent (at level 0)
const SECTOR_GROW_HARDNESS = 0.04;  // diminishing returns: rate ÷ (1 + hardness×level)
const SECTOR_DECAY         = 1.0;   // levels lost/turn when unfunded

// Social policy sector levels (Healthcare, Education) — same growth mechanics but slower decay.
// Military uses full SECTOR_DECAY since force readiness deteriorates quickly without spending.
const SOCIAL_SECTOR_DECAY        = 0.5;   // levels/turn lost when underfunded (half economic rate)

// Maximum effects at level 100 for each social/military policy
const HEALTHCARE_HAPPINESS_MAX   = 25;    // happiness contribution at healthcareLevel 100
const EDUCATION_HAPPINESS_MAX    = 10;    // happiness contribution at educationLevel 100
const EDUCATION_GDP_GROWTH_MAX   = 0.015; // GDP growth bonus at educationLevel 100
const EDUCATION_RP_BONUS_MAX     = 3;     // RP/centre bonus at educationLevel 100

// Military branches (Phase 5.1)
// getDeterrenceRating() returns a 0–100 weighted score (army 50%, navy 25%, air 25%).
// Army strength is further manpower-gated by population × MILITARY_MANPOWER_RATIO.
const ARMY_STRENGTH_MAX      = 30;   // army contribution to deterrence at armyLevel 100 (manpower-gated)
const NAVY_STRENGTH_MAX      = 10;   // navy contribution to deterrence at navyLevel 100
const AIRFORCE_STRENGTH_MAX  = 10;   // air force contribution to deterrence at airForceLevel 100
const ARMY_HAPPINESS_PENALTY = 3;    // happiness penalty at armyLevel 100

// Manufacturing import cost: paid per turn when Manufacturing level exceeds Mining level
const MANUFACTURING_IMPORT_COST_PER_LEVEL = 0.3; // $M/turn per level gap

// Goods flow / Supply system (Phase 5.2)
// Production: manufacturingLevel × GOODS_PER_MFG_LEVEL units/turn
// Delivery:   produced × (0.5 + 0.5 × infraLevel/100)  — infra 0 = 50%, infra 100 = 100%
// Demand:     population × GOODS_PER_MILLION_POP  +  armyStrength × GOODS_PER_ARMY_STRENGTH
// Deficit:    happiness penalty (max SUPPLY_HAPPINESS_PENALTY_MAX) + army effectiveness < 1
const GOODS_PER_MFG_LEVEL           = 1.0;  // goods units produced per manufacturing level per turn
const GOODS_PER_MILLION_POP         = 0.5;  // goods units demanded per million civilians per turn
const GOODS_PER_ARMY_STRENGTH       = 1.5;  // goods units demanded per army strength unit per turn
const SUPPLY_HAPPINESS_PENALTY_MAX  = 10;   // max happiness penalty when supply ratio = 0

// Province installations (Phase 5.3)
// Airfield + Naval Base implemented now; Fortifications + Supply Depot deferred.
// Build cost scales: each additional same type in the same province costs more.
const INSTALLATION_TYPES = {
  airfield:  { name: 'Airfield',   icon: '✈️', buildCost: 200, maintenance: 1.0, requiresCoastal: false },
  navalBase: { name: 'Naval Base', icon: '⚓', buildCost: 300, maintenance: 1.5, requiresCoastal: true  },
};
const INSTALLATION_BUILD_COST_SCALE = 0.5;  // +50% build cost per existing same type in same province

// Merchant fleet (Phase 5.4)
// Fleet grows each turn from active trade routes + Commerce level investment.
// Fleet level caps total trade throughput: income multiplied down if volume > capacity.
// Growth = activeRoutes × MERCHANT_FLEET_ROUTE_GROW + commerceLevel × MERCHANT_FLEET_COMMERCE_GROW
const MERCHANT_FLEET_ROUTE_GROW     = 0.5;   // fleet levels gained per active route per turn
const MERCHANT_FLEET_COMMERCE_GROW  = 0.05;  // fleet levels gained per Commerce level point per turn
const MERCHANT_FLEET_DECAY_RATE     = 0.3;   // fleet levels lost per turn (obsolescence)
const MERCHANT_FLEET_BASE_CEILING   = 50;    // max fleet level without Merchant Shipping project
const MERCHANT_FLEET_CAPACITY_PER_LEVEL = 2.0; // $M/turn trade capacity per fleet level

// Sea control (Phase 5.4)
// Enemy navy strength in a sea zone comes from AI nations that border that zone.
// Naval Base staging bonus: commander patrolling a zone with an adjacent Naval Base gets bonus strength.
const NAVY_PRESENCE_FACTOR       = 0.05;  // AI nation militaryLevel × this = enemy navy strength in adjacent zone
const NAVAL_BASE_STAGING_BONUS   = 0.30;  // +30% commander effective strength when adjacent Naval Base exists

// Air Force operations (Phase 5.5)
// Fighters provide air superiority — their strength counts toward sea zone or province control.
// Bombers conduct strategic bombing — slowly drains target nation militaryLevel.
// Range is measured in province-adjacency hops from the nearest player Airfield.
const AIR_SUPERIORITY_RANGE       = 4;     // hops from Airfield to sea-zone coastal province
const STRATEGIC_BOMBING_RANGE     = 6;     // hops from Airfield to target nation province
const AIR_SEA_STRENGTH_FACTOR     = 0.5;   // air superiority strength counts as 0.5× navy for sea control
const STRATEGIC_BOMBING_DRAIN     = 0.002; // militaryLevel drained per effective strength per turn

// Province-level routing (Phase 5.6)
// Trade routes pass through intermediate provinces; their infra quality can only penalise income.
// Supply flows from the capital outward; each province hop loses a fraction of delivery efficiency.
const ROUTE_PATH_INFRA_REFERENCE  = 5;    // infraLevel at or above this = no penalty (multiplier 1.0)
const SUPPLY_DISTANCE_DECAY       = 0.10; // fraction of supply lost per province hop from capital

// Ground unit system (Phase 5.7a)
// Max unit size the player can recruit in a single order.
const UNIT_MAX_SIZE = 20;
// If a commander's total unit upkeep exceeds their budget, units are "underfunded".
// Underfunded units' effective combat power is reduced in 5.7c; here it only triggers a warning.
const UNIT_UNDERFUND_WARNING_THRESHOLD = 0.01; // M/turn shortfall before a warning fires

// Ground unit movement (Phase 5.7b)
// turnsPerHop = ceil(UNIT_MOVEMENT_BASE_TURNS / unitSpeed)
// Speed values from UNIT_TYPES range 1 (Artillery) to 8 (Recon), giving:
//   Recon/speed-8  → 1 turn/hop   Artillery/speed-1 → 6 turns/hop
const UNIT_MOVEMENT_BASE_TURNS = 6;

// War & siege constants (Phase 5.7c)
// Siege progress: net (attack - defense) is divided by this to get % change per turn.
// e.g. net=100 with divisor=10 → 10% progress per turn → capture in ~10 turns if unchallenged.
const SIEGE_PROGRESS_DIVISOR         = 10;
// Fraction of unit size lost per turn when outgunned (applied proportionally).
const SIEGE_CASUALTY_RATE            = 0.04;
// Treasury drain per active war per turn (M gold).
const WAR_TREASURY_DRAIN_PER_TURN    = 5;
// Happiness penalty subtracted from target while at war, per active war.
const WAR_HAPPINESS_PENALTY          = 8;
// Base unit size per province when initialising AI militaries.
const AI_UNIT_SIZE_PER_PROVINCE      = 8;
// Minimum total AI attack strength before a commander attempts to counter-attack.
const AI_COUNTER_ATTACK_THRESHOLD    = 20;
// Fraction of a nation's provinces that must be occupied before they request peace.
const SUE_FOR_PEACE_THRESHOLD        = 0.6;
// Attack bonus (multiplicative) if player had forces staged at the border when war was declared.
const STAGING_ATTACK_BONUS           = 0.25;

// Trade routes
const TRADE_ROUTE_MATURITY_TURNS       = 50;    // turns for route to reach full maturity

// Trade volume & income
// Max export/import volume for a resource = round(TRADE_VOLUME_BASE × nation demand/supply mult)
const TRADE_VOLUME_BASE                = 10;    // base max volume (Mt) before demand/supply multiplier

// Base export income per Mt traded at quality 1.0, full maturity — per resource type ($M/turn per Mt)
const RESOURCE_EXPORT_PRICE = {
  iron:       0.08,
  coal:       0.06,
  timber:     0.07,
  steel:      0.15,
  oil:        0.40,
  chemicals:  0.25,
  copper:     0.20,
  silicon:    0.35,
  rareEarths: 0.80,
};
// Import saving as a fraction of RESOURCE_EXPORT_PRICE per Mt of supply shortfall
// Saving = price × FRAC × (1 − importQuality) × maturityMult
const RESOURCE_IMPORT_SAVING_FRAC      = 0.30;

// Trade negotiation — nation offer quality
// exportQuality = clamp(BASE + (leverage/3)×LEVERAGE + pushCount×PUSH + threaten?THREATEN:0, MIN, MAX)
const TRADE_OFFER_QUALITY_BASE         = 0.4;
const TRADE_OFFER_QUALITY_LEVERAGE     = 0.4;   // max bonus from leverage (at leverage=3)
const TRADE_OFFER_QUALITY_PUSH         = 0.08;  // bonus per push round
const TRADE_OFFER_QUALITY_THREATEN     = 0.08;  // extra bonus when threatening
const TRADE_OFFER_QUALITY_MIN          = 0.25;
const TRADE_OFFER_QUALITY_MAX          = 1.2;

// Trade negotiation — import price (what nation wants back; stored, used in Phase 3.5)
const TRADE_IMPORT_PRICE_BASE          = 0.6;   // base multiplier
const TRADE_IMPORT_PRICE_PUSH          = 0.08;  // increases per push
const TRADE_IMPORT_PRICE_MAX           = 1.2;

// Trade negotiation — push costs (immediate relations penalty)
const TRADE_PUSH_RELATIONS_BASE        = 3;     // base -relations per push
const TRADE_PUSH_RELATIONS_SCALE       = 1;     // extra per push count
const TRADE_PUSH_THREATEN_RELATIONS    = 3;     // extra -relations when threatening
const TRADE_PUSH_THREATEN_REL_SCALE    = 1;     // extra per push count when threatening

// Trade negotiation — collapse risk (resolved at end of turn)
// risk = max(0, pushCount×PER_PUSH − leverage×LEVERAGE_REDUCE + threaten?ADD:0)
const TRADE_COLLAPSE_RISK_PER_PUSH     = 0.12;  // 12% per push
const TRADE_COLLAPSE_LEVERAGE_REDUCE   = 0.08;  // -8% per leverage point
const TRADE_COLLAPSE_THREATEN_ADD      = 0.05;  // +5% when threatening

// Trade negotiation — straight-accept probability (best outcome, requires pushCount >= 1)
const TRADE_STRAIGHT_ACCEPT_BASE       = 0.05;  // 5% base chance
const TRADE_STRAIGHT_ACCEPT_LEVERAGE   = 0.15;  // +15% per leverage point above 1.0
const TRADE_STRAIGHT_ACCEPT_RELATIONS  = 0.005; // +0.5% per relations point above 0 (neutral)

// Province map
// Nation GDP = Σ(province.development) × GDP_PER_PROVINCE_DEVELOPMENT across all owned provinces.
// Province development is static data (1–5); it represents structural economic capacity.
const GDP_PER_PROVINCE_DEVELOPMENT = 100;   // $B GDP contributed per development level

// Population
const POPULATION_START            = 10;     // starting population (millions)
const GDP_PER_CAPITA_START        = 500;    // starting GDP per capita (arbitrary index units)
const TERRITORY_SCORE_START       = 1.0;    // starting territory score
const BASE_TERRITORY_CAP          = 30;     // pop cap base per territory point (millions, at infra 0)
const INFRA_POP_CAP_SCALE         = 0.005;  // infraFactor = 1 + infraLevel × this  (+50% at lvl 100)
const POP_GROWTH_BASE             = 0.008;  // base population growth rate per turn
const POP_GROWTH_HAPPINESS_SCALE  = 0.0005; // growth modifier per happiness point above/below 50
const POP_GROWTH_HEALTHCARE_SCALE = 0.004;  // maximum healthcare contribution to growth rate
const POP_GROWTH_MIN              = -0.01;  // floor: mass emigration at very low happiness
const POP_GROWTH_MAX              = 0.03;   // ceiling: optimal conditions
const POPULATION_REFERENCE        = 10;     // reference pop for social policy cost scaling (M)
const POPULATION_COST_EXPONENT    = 0.7;    // sub-linear exponent for healthcare/education costs
const MILITARY_MANPOWER_RATIO     = 25;     // soft military strength cap per million citizens

// AI Nations — per-turn tick behaviour (same for all nations in Phase 3.1)
const NATION_MILITARY_DRIFT_RATE            = 0.05;  // fraction of gap closed per turn toward starting militaryLevel
const NATION_RELATIONS_NEG_PENALTY_RECOVERY = 2;     // points/turn the negotiation penalty recovers toward 0 (neutral)
const NATION_RELATIONS_BROKEN_ROUTE_TURNS   = 5;     // turns a broken-route penalty takes to fully expire

// Diplomacy Deals — Phase 4.4
const NAP_DURATION             = 20;   // turns a Non-Aggression Pact lasts
const ALLIANCE_MIN_PROPOSE_REL = 40;   // minimum relations score to propose an alliance
const NAP_MIN_PROPOSE_REL      = 0;    // minimum relations score to propose a NAP
const ALLIANCE_ACCEPT_REL      = 50;   // AI accepts an alliance proposal at this relations level or above
const NAP_ACCEPT_REL           = 0;    // AI accepts a NAP proposal at this relations level or above
const ALLIANCE_BREAK_PENALTY   = -25;  // added to relationsNegPenalty when breaking an alliance
const ALLIANCE_RELATIONS_FLOOR = 20;   // allied nations' relations can't drop below this (Friendly tier)
const ALLIANCE_RELATIONS_BONUS = 3;    // flat bonus added to allied nations' score in computeNationRelations

// Resource Deposits — Phase 3.5
// Prospecting policy builds G.prospectingLevel (0–100); level drives per-turn discovery chance.
const PROSPECT_BASE_CHANCE        = 0.01;   // 1% base chance per turn
const PROSPECT_LEVEL_SCALE        = 0.0015; // +0.15% per prospecting level (at 10 → ~2.5%)
const PROSPECT_DIMINISH_RATE      = 0.15;   // each deposit reduces chance by 15% multiplicatively

// Deposit development: each deposit starts as an anomaly and is developed in funded stages.
// Tier order: occurrence → vein → deposit → reserve → majorReserve
// Statuses: anomaly → surveying → commissioning → producing (or upgrading → commissioning)
const DEPOSIT_SURVEY_COST         = 50;    // $M total cost to complete an initial survey

// Commissioning cost per tier ($M) — paid after survey/successful upgrade, guaranteed
const DEPOSIT_COMMISSION_COST     = { occurrence: 50, vein: 100, deposit: 200, reserve: 400, majorReserve: 800 };

// Upgrade attempt cost per tier transition ($M, 25% success chance):
const DEPOSIT_TIER_UPGRADE_COST   = { occurrence: 100, vein: 200, deposit: 400, reserve: 800 };

// Mt/yr produced by each tier when in 'producing' status:
const DEPOSIT_TIER_OUTPUT         = { occurrence: 1, vein: 5, deposit: 15, reserve: 40, majorReserve: 100 };

const DEPOSIT_UPGRADE_SUCCESS     = 0.25;  // 25% success chance when upgrade progress hits 100%
const DEPOSIT_PROGRESS_DECAY      = 2.0;   // % per turn, for in-progress (unfunded) deposits
// Max-tier distribution weights for newly detected anomalies:
const DEPOSIT_MAX_TIER_WEIGHTS    = [35, 30, 20, 10, 5]; // occurrence / vein / deposit / reserve / majorReserve
