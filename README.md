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
11. **Build your military** — research Standing Army to unlock the Military screen. Recruit units via Commanders. Research Basic Metallurgy to unlock Equipment Design — upgrade all units of a type to Mk.II/Mk.III for significantly improved combat stats. Build out Navy and Air Force branches with further techs. Each branch contributes to your Deterrence Rating, which drives leverage in trade negotiations.

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
- Dashboard tabs: Overview · Trade Routes · Research · Projects · Statistics · **World** · Events Log · **Resources** · **Military** · **⚙️ Equipment** · **Diplomacy**
- **Commander System** (Phase 5.4 / 5.7f): assign named commanders to Army, Navy, or Air Force branches via the Military tab. Army commanders use direct unit recruitment; Navy and Air Force commanders use a **production queue** — units have production turn requirements and cost upfront. Navy missions: Trade Protection. Air Force missions: Air Superiority, Strategic Bombing, Air Logistics.
- **Naval unit types** (Phase 5.7f): Destroyer, Frigate, Cruiser, Battleship, Submarine (blockade bonus), Carrier (fleet multiplier). Each type has distinct cost, upkeep, production time, and combat stats.
- **Air unit types** (Phase 5.7f): Fighter, Ground Attack, Strategic Bomber, Transport, Recon/Spy. Per-unit `missionBonus` values determine effectiveness per Air Force mission.
- **Production queue** (Phase 5.7f): global manufacturing queue for Navy and Air Force units. Supply ratio below threshold slows production. Items can be cancelled (50% refund if not yet active).
- **Commander brain** (Phase 5.7f): every `COMMANDER_ASSESSMENT_INTERVAL` turns, Navy/Air commanders post a recommendation (recruit unit or request budget increase) as a dismissable assessment card. Player can Accept or Dismiss.
- **Air Logistics mission** (Phase 5.7f): Air Force commanders can target a player province for logistics support, granting a supply bonus to that province scaled by Transport unit `missionBonus`.
- **Equipment Design screen** (Phase 5.7e, unlocked by Basic Metallurgy tech): per-unit-type equipment tier cards. Tiers Mk.I → Mk.II → Mk.III improve attack, defense, and speed. Refit upgrades all in-service units at treasury cost over several turns. Army strength, siege attack, and defense now scale with effective equipment stats rather than a policy level.
- **Occupation & Integration** (Phase 5.8a): occupied provinces accumulate resistance each turn (scales with province development and distance from capital, reduced by education level). A commander set to **Garrison Occupied Province** suppresses resistance. Provinces with no garrison revolt when resistance hits 100. Each occupied province costs `development × $2M/turn` in admin upkeep. Formally annexed provinces enter an **integration period** (`dev × 6 turns`, shortened by Education) during which deposit slots and resources are locked. When integration completes, **Territory Score** increases. All occupation and integration details visible on map province click and in the peace deal modal.
- **Strategic Bombing & Naval Interdiction** (Phase 5.8b): Air Force commanders on Strategic Bombing now accumulate bomb damage points on target provinces — at threshold, the province loses 1 development. Damage auto-repairs when not under attack. AI nations bomb player provinces symmetrically, applying a manufacturing debuff (up to −40%) and supply ratio drain (up to −30%). Naval dominance (>50% sea control) drains enemy military level each turn; enemy sea superiority below 40% control freezes player trade route maturity growth in that zone. All effects are surfaced in the Military tab supply panel, commander badges, and the province info panel.
- **Surplus Goods Export** (Phase 5.9): Goods produced beyond domestic demand accumulate in a player stockpile (up to 10 turns of production). The stockpile automatically buffers supply deficits. Players set a reserve floor; goods above the reserve can be exported via trade routes. Each route has a per-route goods export toggle; income scales with route maturity, manufacturing quality, and the partner nation's demand (weaker nations buy more). Sea control disruption applies to goods exports too.
- **Fuel Layer** (Phase 5.10): Oil deposits + manufacturing efficiency jointly determine fuel production (oil output × mfg%). Navy, Air Force, and Army units each consume fuel proportional to their deployed unit sizes (unit-type-specific rates). Surplus fuel accumulates in a stockpile; shortfalls are drawn from it first. Unmet shortfall reduces fleet and air effective strength proportionally, and reduces army siege attack + march speed. Build ⛽ Fuel Storage installations (any province, max 2 per province) for +10 flat stockpile capacity each.

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
