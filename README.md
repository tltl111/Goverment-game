# Government Simulator

A browser-based political strategy game inspired by Democracy 4 and Rebel Inc.

Lead your nation through policy decisions, economic management, and technological progress to survive five election cycles.

## How to Play

Open `index.html` in a browser — no build step required.

1. **Name your empire** and start a new game.
2. **Fund policies** across economy, infrastructure, social, and security each turn.
3. **Balance your budget** — taxes fund all spending.
4. **Build industry** — invest in Mining and Manufacturing to grow GDP; keep Mining ahead or pay import costs.
5. **Research technologies** to unlock bonuses and reduce costs across the tech tree.
6. **Open trade routes** via Finance level for passive income.
7. **Build Research Centres** via infrastructure spending to accelerate research.

## Current Features

- Turn-based economy with GDP growth, tax income, debt/savings interest
- Eight policies: Mining, Manufacturing, Commerce, Finance, Infrastructure, Healthcare, Education, Military
- Four sector levels (Mining, Manufacturing, Commerce, Finance 0–100) with diminishing-returns growth and decay
- Manufacturing hard-capped by Mining level; import costs when gap exists
- Commerce GDP contribution amplified by Manufacturing level
- Infrastructure level with income-proportional decay and research centre construction
- Trade routes unlocked by Finance level
- 17-tech tree across 4 tiers with path grouping (Economic / Social / Science), web prerequisites, and three effect types (techCostMult, infraDecayMult, infraGrowthMult)
- Dashboard tabs: Overview · Trade Routes · Research · Buildings · Statistics · Events Log
- Statistics screen: Economy Ledger, Sector Status, Research Tracker
- Happiness pool with target-convergence model
- Overspend refunds when sectors are at max capacity

## Project Structure

```
index.html          # Game UI and script loading
css/style.css       # Styles
js/
  utils.js          # fmt() money formatter
  constants.js      # Numeric tuning constants
  data.js           # Policy and technology definitions
  state.js          # Game state (G) and initGame()
  engine.js         # Pure calculation functions
  render.js         # DOM rendering functions
  actions.js        # State-mutating game actions
  ui.js             # Tab switching, notifications, boot
ideas.md            # Design notes & roadmap
```
