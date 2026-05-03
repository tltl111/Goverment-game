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

// Trade routes — maturity-based income (placeholder until goods/resources system in Phase 3.5)
const TRADE_ROUTE_MATURITY_TURNS  = 50;   // turns for a route to reach full income
const TRADE_ROUTE_INCOME_MAX      = 15;   // $M/turn per route at full maturity

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
