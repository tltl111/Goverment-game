# Changelog

All notable changes to Government Simulator will be documented here.

---

## [0.9.0] — 2026-05-03

### Added — Infrastructure Megaprojects (Phase 2.7)
- 7 empire-scale infrastructure projects added to the Projects tab under a new "Infrastructure Megaprojects" category:
  - **National Highway Network** ($800M) — −10% infra decay, +0.5% GDP growth
  - **National Rail Network** ($1,500M; requires Basic Automation) — −15% infra decay, +0.8% GDP growth
  - **National Power Grid** ($2,000M; requires Basic Automation) — −20% infra decay, +1.2% GDP growth
  - **National Airport Network** ($2,500M; requires Market Regulation or Banking System) — +10 effective Commerce level, +$100M/turn passive income
  - **Seaport Expansion** ($2,000M; requires Banking System) — +25% all trade route income
  - **Great Dam** ($3,000M; requires Green Industry) — +$200M/turn passive income, +1.0% GDP growth
  - **Internet Infrastructure** ($4,500M; requires Digital Economy) — −25% infra decay, +1.5% GDP growth
- Only 1 infrastructure megaproject may be funded at a time; selecting a new one cancels the previous
- `getProjectEffects()` extended with 5 new effect types: `infraDecayMult`, `gdpGrowthBonus`, `passiveIncome`, `commerceLevelBonus`, `tradeIncomeMult`
- `getTotalNetIncome()` now includes project passive income
- `getTotalTradeIncome()` applies `tradeIncomeMult` from completed projects
- `getEffectiveGrowthRate()` adds `pe.gdpGrowthBonus` and uses effective Commerce level (boosted by Airport Network)
- Infra decay in `endTurn` and `getEffectivePolicyCost` both apply `pe.infraDecayMult`
- Agricultural projects moved to the tech tree (Phase 3+) — better fit as research outcomes
- Projects tab groups cards by category (`research` then `infrastructure`) with section headers
- Array `techRequired` supported — Airport Network locks until either Market Regulation or Banking System is researched

---

## [0.8.0] — 2026-05-03

### Added — Project framework + Research redesign (Phase 2.6)
- **Research Centres removed** entirely; replaced by a `Research` policy (Science tab) that builds `G.researchLevel` (0 – ceiling)
- `G.researchLevel` drives RP/turn: `researchLevel × 0.2 + educationBonus + techBonus`, modified by project speed multiplier
- Tech cards show **"~N turns"** to complete instead of RP cost; calculated live from current RP/turn via `getTurnsToComplete()`
- Research tab header shows "Research level X / ceiling" and RP/turn
- **Three research projects** added (`PROJECTS` constant in `data.js`):
  - **University** ($600M) — +25 research ceiling, +15% research speed
  - **Research Institute** ($1,500M; requires Scientific Method) — +25 ceiling, +20% speed
  - **Advanced Research Lab** ($3,000M; requires AI Administration) — +25 ceiling, −10% all tech costs
- Project funding drains treasury directly each turn (separate from policy budget); `G.projectFunding` and `G.projectProgress` track state
- `getResearchCapacityCeiling()` = base 50 + `researchCeilingBonus` from completed projects
- `getProjectFundingTotal()` deducted from `getTotalNetIncome()`
- Projects tab (renamed from Buildings) shows progress bars and funding inputs per project
- Removed: `G.researchCentres`, `buildingResearchCentre`, `researchCentreBuildFraction`, research centre build UI and CSS

---

## [0.7.0] — 2026-05-03

### Changed — Policy architecture refactor (Phase 2.5)
- **All policies now build accumulated levels (0–100)** over time; no policy has an immediate proportional effect
- New sector levels: `G.healthcareLevel`, `G.educationLevel`, `G.militaryLevel` (same growth model as economic sectors)
- Healthcare/Education decay slowly (`SOCIAL_SECTOR_DECAY = 0.5` levels/turn); Military decays at full rate (`SECTOR_DECAY = 1.0`)
- Effects come from levels, not current spending:
  - `healthcareLevel` → population growth rate + happiness (max +25)
  - `educationLevel` → GDP growth (max +1.5%), RP bonus (max +3), happiness (max +10)
  - `militaryLevel` → `getMilitaryStrength()` (max 50, soft-capped by population) + happiness penalty (max −3)
- Science policy tab added in index.html
- `getEffectivePolicyCost()` added — mirrors endTurn refund logic so displayed costs match actual treasury deductions
- `getTotalExpenses()` now sums effective costs; net income display corrected
- Debt interest capped at `DEBT_INTEREST_MAX = 0.50` (50%/turn) to prevent runaway debt spirals
- Removed: `policyEffectScale()`, `POLICY_REFERENCE_SPEND`, `G.militaryStrength`

---

## [0.6.0] — 2026-04-27

### Added — Population system (Phase 2.2) + Trade routes as objects (Phases 2.3–2.4)
- `G.population` (millions), `G.gdpPerCapita` (productivity index), `G.territoryScore`, `G.agriculturalFactor`, `G.populationCapTechFactor` added to state
- GDP is now `population × gdpPerCapita / 1000`; `gdpPerCapita` grows at the effective growth rate each turn
- Population cap: `territoryScore × BASE_TERRITORY_CAP × infraFactor × agriculturalFactor × populationCapTechFactor`
- Population grows toward cap; rate driven by base + happiness + healthcare level; declines if overpopulated
- Policy costs for Healthcare and Education scale sub-linearly with population
- Military strength soft-capped by population manpower (`population × MILITARY_MANPOWER_RATIO`)
- `G.tradeRoutes` changed from a count to an array of route objects `{ id, partnerId, maturity }`
- Routes are free to open; maturity increments each turn; income ramps linearly from $0 to $15M/turn over 50 turns
- Individual route close buttons; closing a route resets maturity to 0

---


- Replaced single `industry` policy and `G.industryLevel` with two new independent policies:
  - **Mining** (`G.miningLevel`) — +0.1% GDP growth at level 100
  - **Manufacturing** (`G.manufacturingLevel`) — effective output capped by Mining level; +0.2% GDP at effective level 100
- Manufacturing import cost: `(manufacturingLevel − miningLevel) × $0.3M/turn` auto-deducted when Manufacturing outpaces Mining
- Commerce no longer multiplies tax income; now contributes +0.2% GDP growth at level 100, amplified by effective Manufacturing level (halved without Manufacturing)
- `getTaxIncome()` simplified — Commerce tax multiplier removed
- `MANUFACTURING_IMPORT_COST_PER_LEVEL = 0.3` added to constants.js
- `--orange` CSS variable added for Manufacturing sector bar colour
- Overview, Statistics, and policy hint displays updated for new sectors

---

## [0.4.0] — 2026-04-26

### Added — 8 new technologies + 3 new engine effect types (Phase 1.4)
- Three new `getTechEffects()` fields (all multiplicative): `techCostMult`, `infraDecayMult`, `infraGrowthMult`
- New helper `getTechCost(techId)` — returns `round(tech.cost × techCostMult)`; replaces all raw `tech.cost` references in render and action logic
- Infra decay and repair rate in both `endTurn()` and overview preview now apply tech multipliers
- Eight new technologies:
  - Tier 2: Market Regulation (⚠ commerce cost), Banking System (⚠ finance cost), Scientific Method (−10% RP cost), Public Housing (+8 happiness)
  - Tier 3: Renewable Energy (−20% infra decay), Mental Health Services (+8 happiness), Quantum Computing (−20% RP cost; requires AI Administration + Scientific Method)
  - Tier 4: Smart Grid (+0.5% GDP, +20% infra growth; requires Renewable Energy)
- Tech tree tier display expanded to include Tier 4

---

## [0.3.0] — 2026-04-26

### Added — Tech tree architecture (Phase 1.3)
- `requires` field on all technologies changed from `null | string` to `string[]` (always an array)
- `path` field added to all technologies: `'economic' | 'social' | 'science'`
- `unlocks` field added to all technologies (currently `null`; reserved for future gate unlocks)
- Engine and action guards updated to use `.every()` / `.filter()` array checks

### Added — Research & Buildings dashboard tabs; UI restructure
- Right-hand Research panel removed; layout changed from 3-column to 2-column (Policies | Dashboard)
- Dashboard tabs expanded: Overview · Trade Routes · Research · Buildings · Statistics · Events Log
- Research tab: header row (centre count + RP/turn), full tiered tech tree with progress bars
- Buildings tab: Research Centre build toggle, construction split slider, progress bar

### Added — Statistics dashboard tab (Phase 1.2)
- Economy Ledger: last 10 turns of Year / GDP / Income / Expenses / Net
- Sector Status: progress bars for all sector levels with ▲/▼ delta vs. previous turn
- Research Tracker: centres, RP/turn, techs unlocked, active research with progress bar

### Added — `G.history` array (Phase 1.1)
- Snapshot of key stats pushed each turn; capped at 50 entries

### Added — Build fraction slider
- Infrastructure budget can be split between repair and Research Centre construction via a percentage slider

### Changed — Overspend refunds
- When a sector or infra level would exceed 100, the excess spend is refunded to treasury

### Changed — Naming convention
- All `centre` symbols renamed to `ResearchCentre` variants per project naming conventions
- Naming convention documented in `.github/copilot-instructions.md`

### Changed — Infrastructure decay balance
- Decay made income-proportional so early-game budgets can always keep up

---

## [0.2.0] — 2026-04-26

### Changed
- Split monolithic `js/game.js` into eight focused modules loaded via plain script tags:
  - `js/utils.js` — `fmt()` money formatter
  - `js/constants.js` — all numeric tuning constants
  - `js/data.js` — `POLICIES` and `TECHNOLOGIES` static definitions
  - `js/state.js` — game state object `G` and `initGame()`
  - `js/engine.js` — pure calculation functions (no DOM access)
  - `js/render.js` — all DOM rendering functions
  - `js/actions.js` — state-mutating game actions (`endTurn`, `setPolicyFunding`, etc.)
  - `js/ui.js` — tab switching, notifications, `startGame`, and boot listener
- `index.html` updated to load modules in dependency order.
- `js/game.js` retained with a tombstone comment; no longer loaded.

---

## [0.1.0] — 2026-04-25

### Initial release

**Core game loop**
- Turn-based gameplay across 20 turns (5 election cycles), one year per turn.
- Win condition: survive all 5 elections with ≥ 40% approval each cycle.

**Economy**
- Adjustable tax rate (0–50%); higher rates penalise GDP growth above 20%.
- GDP growth driven by policies, infrastructure, industry level, tech bonuses, and modulated by tax drag, happiness unrest, and debt crowding-out.
- Scaling treasury interest: debt rate grows with `√|debt|`; savings rate diminishes with wealth.

**Policy system**
- Seven policies: Industry, Commerce, Finance, Infrastructure, Healthcare, Education, Military.
- Each policy has a 0–20% funding slider (percentage of tax income).
- Effects scale linearly with actual spending relative to a reference baseline.

**Economic sectors**
- Three sector levels (Industry 0–100, Commerce 0–100, Finance 0–100) that grow when funded and decay when neglected.
- Industry boosts GDP growth (up to +2% at level 100).
- Commerce multiplies all tax income (up to ×1.30 at level 100).
- Finance reduces debt interest (up to −50% at level 100) and unlocks trade route slots.

**Infrastructure**
- Separate infrastructure level (0–100) with diminishing-returns repair and level-scaled decay.
- Grants up to +2% GDP growth bonus at level 100.
- Infrastructure budget can be diverted to construct Research Centres ($1 000M per centre).

**Trade routes**
- Unlocked by raising Finance level (one slot per 20 levels).
- Each route costs $500M treasury to open and earns passive income that scales with Finance level.

**Research**
- Research Centres built via Infrastructure spending; each centre produces 3 RP/turn (base).
- Education policy and certain techs add bonus RP per centre.
- Nine technologies across three tiers with linear prerequisites:
  - Tier 1: Basic Automation, Healthcare Reform, Education Initiative.
  - Tier 2: Green Industry, Universal Healthcare, AI Administration.
  - Tier 3: Digital Economy, Advanced Welfare, Space Program.

**Happiness**
- Happiness pool converges toward a target value each turn (capped at ±3/turn).
- Target driven by social policies and tax rate; tech bonuses add flat happiness.

**UI**
- Header stat bar: treasury, GDP, approval, net income.
- Policies tab with category filters (All / Economy / Social / Security) and live budget projection.
- Dashboard tab with Overview indicator grid and Event Log.
- Research tab showing centres, RP output, tech tree, and centre build progress bar.
- Notifications system for key game events.


### Changed
- Split monolithic `js/game.js` into eight focused modules loaded via plain script tags:
  - `js/utils.js` — `fmt()` money formatter
  - `js/constants.js` — all numeric tuning constants
  - `js/data.js` — `POLICIES` and `TECHNOLOGIES` static definitions
  - `js/state.js` — game state object `G` and `initGame()`
  - `js/engine.js` — pure calculation functions (no DOM access)
  - `js/render.js` — all DOM rendering functions
  - `js/actions.js` — state-mutating game actions (`endTurn`, `setPolicyFunding`, etc.)
  - `js/ui.js` — tab switching, notifications, `startGame`, and boot listener
- `index.html` updated to load modules in dependency order.
- `js/game.js` retained with a tombstone comment; no longer loaded.

---

## [0.1.0] — 2026-04-25

### Initial release

**Core game loop**
- Turn-based gameplay across 20 turns (5 election cycles), one year per turn.
- Win condition: survive all 5 elections with ≥ 40% approval each cycle.

**Economy**
- Adjustable tax rate (0–50%); higher rates penalise GDP growth above 20%.
- GDP growth driven by policies, infrastructure, industry level, tech bonuses, and modulated by tax drag, happiness unrest, and debt crowding-out.
- Scaling treasury interest: debt rate grows with `√|debt|`; savings rate diminishes with wealth.

**Policy system**
- Seven policies: Industry, Commerce, Finance, Infrastructure, Healthcare, Education, Military.
- Each policy has a 0–20% funding slider (percentage of tax income).
- Effects scale linearly with actual spending relative to a reference baseline.

**Economic sectors**
- Three sector levels (Industry 0–100, Commerce 0–100, Finance 0–100) that grow when funded and decay when neglected.
- Industry boosts GDP growth (up to +2% at level 100).
- Commerce multiplies all tax income (up to ×1.30 at level 100).
- Finance reduces debt interest (up to −50% at level 100) and unlocks trade route slots.

**Infrastructure**
- Separate infrastructure level (0–100) with diminishing-returns repair and level-scaled decay.
- Grants up to +2% GDP growth bonus at level 100.
- Infrastructure budget can be diverted to construct Research Centres ($1 000M per centre).

**Trade routes**
- Unlocked by raising Finance level (one slot per 20 levels).
- Each route costs $500M treasury to open and earns passive income that scales with Finance level.

**Research**
- Research Centres built via Infrastructure spending; each centre produces 3 RP/turn (base).
- Education policy and certain techs add bonus RP per centre.
- Nine technologies across three tiers with linear prerequisites:
  - Tier 1: Basic Automation, Healthcare Reform, Education Initiative.
  - Tier 2: Green Industry, Universal Healthcare, AI Administration.
  - Tier 3: Digital Economy, Advanced Welfare, Space Program.

**Happiness**
- Happiness pool converges toward a target value each turn (capped at ±3/turn).
- Target driven by social policies and tax rate; tech bonuses add flat happiness.

**UI**
- Header stat bar: treasury, GDP, approval, net income.
- Policies tab with category filters (All / Economy / Social / Security) and live budget projection.
- Dashboard tab with Overview indicator grid and Event Log.
- Research tab showing centres, RP output, tech tree, and centre build progress bar.
- Notifications system for key game events.
