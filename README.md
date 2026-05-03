# Government Simulator

A browser-based political strategy game inspired by Democracy 4 and Rebel Inc.

Lead your nation through policy decisions, economic management, and technological progress to survive five election cycles.

## How to Play

Open `index.html` in a browser — no build step required.

1. **Name your empire** and start a new game.
2. **Fund policies** across Economy, Social, Security, and Science tabs each turn.
3. **Balance your budget** — taxes fund all policy spending; watch the net income indicator.
4. **Build industry** — invest in Mining and Manufacturing to grow GDP; keep Mining ahead of Manufacturing or pay import costs.
5. **Invest in social sectors** — Healthcare and Education build levels over time, growing your population and boosting research.
6. **Research technologies** to unlock bonuses and reduce costs across the tech tree.
7. **Open trade routes** for passive income that grows with maturity over time.
8. **Fund projects** — Research projects raise your Research ceiling; Infrastructure megaprojects permanently reduce decay and boost GDP. Only one megaproject can be built at a time.

## Current Features

- Turn-based economy: GDP growth, tax income, population, debt/savings interest
- **Ten policies** across four tabs: Mining, Manufacturing, Commerce, Finance, Infrastructure, Healthcare, Education, Military, Research
- **Sector levels (0–100)**: all policies build accumulated levels with diminishing-returns growth and slow decay — effects come from levels, not current spending
- Manufacturing hard-capped by Mining level; Commerce amplified by Manufacturing; Education boosts GDP growth and research speed
- **Population system**: millions of citizens; GDP = population × per-capita productivity; population grows toward a territory/infra cap
- **Policy costs scale with population** for Healthcare and Education (sub-linear)
- **Infrastructure** level with income-proportional decay; reduced by tech and project bonuses
- **Trade routes**: objects with maturity tracking; income ramps from $0 to $15M/turn over 50 turns; closing a route resets maturity
- **17-tech tree** across 4 tiers with path grouping (Economic / Social / Science), web prerequisites, and multiple effect types
- **Projects tab** with two categories:
  - *Research Projects*: University, Research Institute, Advanced Research Lab — raise research ceiling and speed
  - *Infrastructure Megaprojects*: 7 empire-scale projects — reduce infra decay, boost GDP growth, add passive income or trade bonuses; one active at a time
- **Research system**: Research policy builds Research level (0–ceiling); RP/turn drives tech progress; techs show estimated turns to complete
- Happiness pool with target-convergence model; tax, military, healthcare, education, and tech all contribute
- Debt interest capped at 50%/turn; Finance level discounts interest
- Dashboard tabs: Overview · Trade Routes · Research · Projects · Statistics · Events Log
- Statistics screen: Economy Ledger, Sector Status, Research Tracker

## Project Structure

```
index.html          # Game UI and script loading
css/style.css       # Styles
js/
  utils.js          # fmt() money formatter
  constants.js      # Numeric tuning constants
  data.js           # Policy, technology, and project definitions
  state.js          # Game state (G) and initGame()
  engine.js         # Pure calculation functions
  render.js         # DOM rendering functions
  actions.js        # State-mutating game actions
  ui.js             # Tab switching, notifications, boot
```
