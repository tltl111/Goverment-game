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
7. **Negotiate trade deals** with AI nations — set export/import volumes per category, propose your offer, wait for the nation's counter-offer, then accept, modify, or push for better terms (with optional threats); leverage and relations shape the outcome; collapse risk and relations damage create real stakes.
8. **Prospect for resources** — the Prospecting policy rolls each turn to discover geological anomalies in your provinces. Survey them ($50M), commission the mine (tier-based cost), then decide when to attempt tier upgrades (25% success; failure costs you little but rewards patience). Maxed-out mines graduate into Established Industries, freeing the provincial slot for a new discovery. Regional congestion adds +20% cost per extra deposit in the same province — diversify across provinces to keep costs down.
9. **Fund projects** — Research projects raise your Research ceiling; Infrastructure megaprojects permanently reduce decay and boost GDP. Only one megaproject can be built at a time.
10. **Manage diplomacy** — research Diplomacy Corps to unlock the Diplomacy screen. Propose Non-Aggression Pacts and Alliances with nations you've built trade relationships with. Cultural Diplomacy and UN Membership techs passively boost relations globally.

## Current Features

- Turn-based economy: GDP growth, tax income, population, debt/savings interest
- **Ten policies** across four tabs: Mining, Manufacturing, Commerce, Finance, Infrastructure, Healthcare, Education, Military, Research
- **Sector levels (0–100)**: all policies build accumulated levels with diminishing-returns growth and slow decay — effects come from levels, not current spending
- Manufacturing hard-capped by Mining level; Commerce amplified by Manufacturing; Education boosts GDP growth and research speed
- **Population system**: millions of citizens; GDP = population × per-capita productivity; population grows toward a territory/infra cap
- **Policy costs scale with population** for Healthcare and Education (sub-linear)
- **Infrastructure** level with income-proportional decay; reduced by tech and project bonuses
- **Trade negotiation system (v2)**: propose volume-based offers (per-category units), turn-based responses (nation responds at end of turn), counter-offer / push / threaten flow; collapse risk and relations costs create real stakes; straight-accept as the best outcome; income = `volume × quality × maturity`; renegotiating preserves maturity
- **Resource Deposits system**: Prospecting policy discovers geological anomalies in your 4 provinces; 5-tier mine progression (Occurrence 1 Mt/yr → Major Reserve 100 Mt/yr); three-phase flow (Survey → Commission → Producing); 25% upgrade success; failed upgrades return 5% progress; maxed mines graduate into Established Industries; **provincial slot limits** (Capital: 4, Medium: 2) make deposits scarce; regional congestion adds +20% cost per extra mine in the same province
- **17-tech tree** across 4 tiers with path grouping (Economic / Social / Science / Industrial), web prerequisites, and multiple effect types; Industrial path (9 techs: Industrialisation → Nanotechnology) + Mining sub-branch (4 techs gating deposit tier upgrades)
- **Projects tab** with two categories:
  - *Research Projects*: University, Research Institute, Advanced Research Lab — raise research ceiling and speed
  - *Infrastructure Megaprojects*: 7 empire-scale projects — reduce infra decay, boost GDP growth, add passive income or trade bonuses; one active at a time
- **Research system**: Research policy builds Research level (0–ceiling); RP/turn drives tech progress; techs show estimated turns to complete
- Happiness pool with target-convergence model; tax, military, healthcare, education, and tech all contribute
- Debt interest capped at 50%/turn; Finance level discounts interest
- Dashboard tabs: Overview · Trade Routes · Research · Projects · Statistics · **World** · Events Log · **Resources**
- Statistics screen: Economy Ledger, Sector Status, Research Tracker
- **World map**: zoomable/pannable SVG continent; 36 provinces across 9 nations; player empire as 6 provinces; AI nations rendered as multi-province territories; click a nation to open trade negotiations or view existing routes
- **AI nations**: 8 nations tick each turn (GDP emergent from province development sum, grows by gdpGrowthRate; military drift; relations drift toward neutral); each has per-resource demand/supply profiles (iron, coal, timber, steel, oil, chemicals, copper, silicon, rare earths)
- **Trade routes**: income driven by actual resource output vs nation demand; import savings when trade partners supply resources the player doesn't produce; export quality and import discount negotiated independently
- **Relations system**: each AI nation has a relation score (−100 to +100) computed each turn from 12 factors (trade history, route maturity, streak, penalties, techs, deals). Five tiers: Hostile / Tense / Neutral / Friendly / Allied. Relations shown on world map, route cards, and Diplomacy screen.
- **Diplomacy screen** (unlocked by Diplomacy Corps tech): nation cards with relation badge, GDP/military/streak stats, and active deals. Action buttons: Propose NAP (20-turn pact), Propose Alliance (permanent; +3 relations/turn + Friendly floor), Break Alliance. Cultural Diplomacy tech (+12 global relations); UN Membership tech (+5 global relations + UN panel). 7 techs in the Trade & Diplomacy path.

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
