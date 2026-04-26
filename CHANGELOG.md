# Changelog

All notable changes to Government Simulator will be documented here.

---

## [0.5.0] — 2026-04-26

### Changed — Industry branch split (Phase 2.1)
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
