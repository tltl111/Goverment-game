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
11. **Build your military** — research Standing Army to unlock the Military screen and Army policy. Build out Navy and Air Force branches with further techs. Each branch independently contributes to your Deterrence Rating, which drives leverage in trade negotiations.

## Current Features

- Turn-based economy: GDP growth, tax income, population, debt/savings interest
- **Eleven policies** across four tabs: Mining, Manufacturing, Commerce, Finance, Infrastructure, Healthcare, Education, Army, Navy, Air Force, Research
- **Sector levels (0–100)**: all policies build accumulated levels with diminishing-returns growth and slow decay — effects come from levels, not current spending
- Manufacturing hard-capped by Mining level; Commerce amplified by Manufacturing; Education boosts GDP growth and research speed
- **Population system**: millions of citizens; GDP = population × per-capita productivity; population grows toward a territory/infra cap
- **Policy costs scale with population** for Healthcare and Education (sub-linear)
- **Infrastructure** level with income-proportional decay; reduced by tech and project bonuses
- **Trade negotiation system (v2)**: propose volume-based offers (per-category units), turn-based responses (nation responds at end of turn), counter-offer / push / threaten flow; collapse risk and relations costs create real stakes; straight-accept as the best outcome; income = `volume × quality × maturity`; renegotiating preserves maturity
- **Resource Deposits system**: Prospecting policy discovers geological anomalies in your 4 provinces; 5-tier mine progression (Occurrence 1 Mt/yr → Major Reserve 100 Mt/yr); three-phase flow (Survey → Commission → Producing); 25% upgrade success; failed upgrades return 5% progress; maxed mines graduate into Established Industries; **provincial slot limits** (Capital: 4, Medium: 2) make deposits scarce; regional congestion adds +20% cost per extra mine in the same province
- **20-tech tree** across multiple tiers with path grouping (Economic / Social / Science / Industrial / Trade / **Military**), web prerequisites, and multiple effect types; Industrial path (9 techs: Industrialisation → Nanotechnology) + Mining sub-branch (4 techs gating deposit tier upgrades); Military path (3 techs: Standing Army → Naval Fleet → Air Force)
- **Projects tab** with two categories:
  - *Research Projects*: University, Research Institute, Advanced Research Lab — raise research ceiling and speed
  - *Infrastructure Megaprojects*: 7 empire-scale projects — reduce infra decay, boost GDP growth, add passive income or trade bonuses; one active at a time
- **Research system**: Research policy builds Research level (0–ceiling); RP/turn drives tech progress; techs show estimated turns to complete
- Happiness pool with target-convergence model; tax, army, healthcare, education, and tech all contribute
- Debt interest capped at 50%/turn; Finance level discounts interest
- Dashboard tabs: Overview · Trade Routes · Research · Projects · Statistics · **World** · Events Log · **Resources** · **Military** · **Diplomacy**
- Statistics screen: Economy Ledger, Sector Status, Research Tracker
- **World map**: zoomable/pannable SVG continent; 36 provinces across 9 nations; player empire as 6 provinces; AI nations rendered as multi-province territories; click a nation to open trade negotiations or view existing routes. **Vael Sea** (north/east/west) and **Grey Reach** (south) are named sea regions rendered as blue polygons tracing the exact province coastlines — 18 land provinces are marked coastal.
- **Province installations** (Phase 5.3): click any player province on the world map to build **Airfields** (any province) or **Naval Bases** (coastal provinces only). Build cost scales +50% per duplicate in the same province; maintenance auto-deducted each turn. Also accessible from Military screen and Policy screen.
- **Commander System** (Phase 5.4): assign named commanders to Army, Navy, or Air Force branches via the Military tab. Each commander has a `strengthAlloc` % of their branch level, a mission, and a target. Navy commanders on **Trade Protection** patrol sea zones and generate player fleet strength for sea control calculations.
- **Merchant Fleet** (Phase 5.4): `G.merchantFleet` is a civilian transport capacity level that grows from active trade routes × Commerce investment and decays slowly. When fleet capacity is below total trade demand, all route income is proportionally reduced — making trade feel physical rather than magical.
- **Sea Zone Control** (Phase 5.4): each sea zone (Vael Sea, Grey Reach) has a sea control score based on player vs enemy navy strength. Routes crossing contested zones have their income reduced proportionally. Naval Bases in adjacent provinces grant a +30% staging bonus to patrolling commanders.
- **Air Force operations** (Phase 5.5): Air Force commanders use the same commander framework. **Air Superiority** (target: sea zone) stacks with Navy to boost sea control. **Strategic Bombing** (target: nation) slowly drains enemy `militaryLevel` per turn. All missions require an Airfield within province-hop range (fighters range 4, bombers range 6) — commanders out of range show a warning badge and deal zero effect.
- **AI nations**: 8 nations tick each turn (GDP emergent from province development sum, grows by gdpGrowthRate; military drift; relations drift toward neutral); each has per-resource demand/supply profiles (iron, coal, timber, steel, oil, chemicals, copper, silicon, rare earths)
- **Trade routes**: income driven by actual resource output vs nation demand; import savings when trade partners supply resources the player doesn't produce; export quality and import discount negotiated independently
- **Relations system**: each AI nation has a relation score (−100 to +100) computed each turn from 12 factors (trade history, route maturity, streak, penalties, techs, deals). Five tiers: Hostile / Tense / Neutral / Friendly / Allied. Relations shown on world map, route cards, and Diplomacy screen.
- **Military screen** (unlocked by Standing Army tech): shows Army, Navy, and Air Force branch levels, funding status, manpower cap, combined Deterrence Rating, and **Goods Supply panel** (production, delivery efficiency, civilian vs military demand, supply ratio).
- **Goods flow / Supply system**: Manufacturing produces goods each turn; Infrastructure acts as delivery efficiency multiplier (50% base + 50% from infra level). Civilian demand scales with population; Army demand scales with army strength. Deficit applies happiness penalty (max −10) and army effectiveness modifier. Surplus = export potential (future phase).
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
