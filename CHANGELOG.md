# Changelog

All notable changes to Government Simulator will be documented here.

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
