# Government Simulator

A browser-based political strategy game inspired by Democracy 4 and Rebel Inc.

Lead your nation through policy decisions, economic management, and technological progress to survive five election cycles.

## How to Play

Open `index.html` in a browser — no build step required.

1. **Name your empire** and start a new game.
2. **Invest in policies** across healthcare, economy, military, and more each turn.
3. **Balance your budget** — taxes fund all spending.
4. **Research technologies** to unlock powerful bonuses and new mechanics.
5. **Win elections** every 4 turns by maintaining 40%+ approval.
6. Survive **20 turns (5 elections)** to win.

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
