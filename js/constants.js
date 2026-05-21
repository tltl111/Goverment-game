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
const MILITARY_STRENGTH_MAX      = 50;    // military strength at militaryLevel 100
const MILITARY_HAPPINESS_PENALTY = 3;     // happiness penalty at militaryLevel 100

// Manufacturing import cost: paid per turn when Manufacturing level exceeds Mining level
const MANUFACTURING_IMPORT_COST_PER_LEVEL = 0.3; // $M/turn per level gap

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
