// ============================================================
// CONSTANTS — all numeric tuning values in one place
// ============================================================

// Baseline spending ($M) at which policy effects equal the values defined in POLICIES.
// = starting GDP ($50B) × starting tax rate (22%) × 10 × max funding (20%)
// Effects scale linearly with actual spending relative to this amount.
const POLICY_REFERENCE_SPEND = 20;

// Research centre constants
const RESEARCH_CENTRE_BUILD_COST = 1000;  // $1,000M of infrastructure spend to build one centre

// Infrastructure scaling
const INFRA_REPAIR_PER_M     = 1.0;   // base levels gained per $1M spent (at level 0)
const INFRA_REPAIR_HARDNESS  = 0.04;  // each level makes repair harder: rate ÷ (1 + hardness×level)
// Decay scales with current income so early-game budgets can always keep up.
// Formula: decay = income × INFRA_MAINTAIN_FRAC ÷ (1 + hardness×level)
// This guarantees that (INFRA_MAINTAIN_FRAC × 100)% funding exactly maintains infra at any level.
const INFRA_MAINTAIN_FRAC    = 0.10;  // 10% of income spent on infra = zero net decay

const RP_PER_RESEARCH_CENTRE = 3;     // base RP/turn per research centre

// Treasury interest (scaling)
// Debt rate grows with debt: rate = DEBT_INTEREST_SCALE × √|debt|, capped at DEBT_INTEREST_MAX
// Savings rate diminishes with wealth: rate = 1% / (1 + treasury / SAVINGS_INTEREST_SCALE)
const DEBT_INTEREST_SCALE    = 0.001; // at -$100M → ~1%, -$1000M → ~3.2%, -$5000M → ~7%
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

// Manufacturing import cost: paid per turn when Manufacturing level exceeds Mining level
const MANUFACTURING_IMPORT_COST_PER_LEVEL = 0.3; // $M/turn per level gap

// Trade routes
const TRADE_ROUTE_COST             = 500;  // one-time $M treasury cost per route
const TRADE_ROUTE_INCOME           = 20;   // base $M/turn per route at finance level 0
const TRADE_ROUTE_FINANCE_SCALE    = 0.5;  // extra $M/turn per route per finance level
const TRADE_ROUTE_LEVEL_NEEDED     = 20;   // finance level needed per additional route slot
