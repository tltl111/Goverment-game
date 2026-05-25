# Changelog

All notable changes to Government Simulator will be documented here.

---

## [Unreleased] — Fuel Storage & Army Fuel Consumption

### Added
- **Fuel Storage installation** (`constants.js`, `actions.js`, `render.js`): New `⛽ Fuel Storage` installation (cost $120M, maintenance $0.5M/turn) buildable in any owned province, max 2 per province. Each adds a flat `+10` fuel units to the stockpile cap (`FUEL_STORAGE_CAPACITY_BONUS`). Cap enforcement in both `buildInstallation()` action and province build panel.
- **Army fuel consumption** (`data.js`, `engine.js`): Each army unit type now has a `fuelConsumption` rate (fuel units per size per turn): Light Infantry 0.05, Artillery/Recon 0.10, Mech. Infantry 0.15, Anti-Air/Anti-Tank 0.08, Armored Corps 0.30. `getFuelArmyDemand()` sums all ready army units; added to `getTotalFuelDemand()`.
- **Army fuel debuffs** (`engine.js`): Fuel shortfall applies two penalties to the army — (1) `getSiegeAttackStrength()` is multiplied by `getFuelRatio()`, reducing offensive power and slowing province capture; (2) `getUnitTurnsPerHop()` factors in `getFuelRatio()` as a speed multiplier, increasing march time per hop when fuel is low.
- **Fuel panel updates** (`render.js`): Army demand row shown in the ⛽ Fuel section when Standing Army is unlocked. Stockpile cap row now shows the bonus from Fuel Storage installations. Army branch card gains a fuel shortfall warning when `getFuelRatio() < 1`.
- **Province build panel** (`render.js`): Fuel Storage button shows "max 2 per province" and is disabled when cap is reached.

### Constants added (`constants.js`)
- `FUEL_STORAGE_CAPACITY_BONUS` (10) — flat fuel unit stockpile bonus per Fuel Storage installation
- `fuelStorage` entry in `INSTALLATION_TYPES` — buildCost 120, maintenance 0.5, maxPerProvince 2

### Unit type changes (`data.js`)
- `fuelConsumption` field added to all 7 army unit types (0.05–0.30)

---

## [Unreleased] — Phase 5.10: Fuel Layer — Navy + Air Force Oil Consumption

### Added
- **Fuel production** (`engine.js` — `getFuelProduced`): Oil output × `(manufacturingLevel / 100)` determines fuel units produced per turn. Both oil deposits AND manufacturing tech investment are required to fuel the military.
- **Fuel demand** (`engine.js` — `getFuelNavyDemand`, `getFuelAirForceDemand`, `getTotalFuelDemand`): Each ready Navy unit consumes `FUEL_PER_NAVY_UNIT_SIZE` (0.10) fuel/turn per size point; each ready Air Force unit consumes `FUEL_PER_AIR_UNIT_SIZE` (0.15) fuel/turn per size point.
- **Fuel stockpile** (`state.js`, `engine.js` — `getFuelStockpileMax`): Surplus fuel accumulates up to `FUEL_STOCKPILE_CAP_TURNS` (8) × production. On deficit, the stockpile is drawn down first before applying the fuel ratio.
- **Fuel stockpile tick** (`actions.js` — `endTurn` section 2.4k): Each turn, stockpile draw fills any production deficit (ratio stored in `G.fuelStockpileDrawRatio`), then surplus is added to the stockpile. Unmet shortfall triggers a warning log.
- **Fuel ratio** (`engine.js` — `getFuelRatio`): Returns 0–1 fraction of total fuel demand met this turn (production + stockpile draw).
- **Navy/Air Force effectiveness penalty** (`engine.js`): `getNavyCommanderEffectiveStrength` and `getAirCommanderEffectiveStrength` both multiply their result by `getFuelRatio()`. Fuel shortfall therefore directly degrades both fleet and air combat output.
- **Fuel section in Military tab** (`render.js`): When Navy or Air Force is unlocked, a ⛽ Fuel section appears in the Military panel showing oil output, refining efficiency, production/turn, demand breakdown, a fuel ratio bar, and a shortfall warning (when `getFuelRatio() < 1`).
- **Branch card fuel shortfall note** (`render.js`): Navy and Air Force branch cards gain an inline shortfall warning when fuel ratio drops below 100%.
- **Fuel CSS** (`style.css`): `.mil-fuel-section`, `.mil-bar-fuel`, `.mil-fuel-shortfall`, `.mil-fuel-note`, `.mil-fuel-hint` added.

### State fields added (`state.js`)
- `G.fuelStockpile` — accumulated surplus fuel units
- `G.fuelStockpileDrawRatio` — fraction of fuel demand covered by stockpile this turn

### Constants added (`constants.js`)
- `FUEL_PER_NAVY_UNIT_SIZE` (0.10), `FUEL_PER_AIR_UNIT_SIZE` (0.15), `FUEL_STOCKPILE_CAP_TURNS` (8)

---

## [Unreleased] — Phase 5.9: Surplus Manufactured Goods Export

### Added
- **Goods stockpile** (`state.js`, `engine.js`): Surplus goods (produced beyond total demand) now accumulate in `G.goodsStockpile` each turn, up to `STOCKPILE_CAP_TURNS × production/turn`. When supply falls into deficit, the stockpile is drawn down first, buffering the supply ratio. `getGoodsStockpileMax()` and `getNationGoodsDemandUnits()` added to engine.
- **Stockpile draw improves supply ratio** (`engine.js`): `getSupplyRatio()` now adds `G.goodsStockpileDrawRatio` to the raw ratio so stockpile coverage shows up in all supply-dependent calculations (army effectiveness, happiness, etc.).
- **Per-route goods export toggle** (`actions.js`, `render.js`): Each trade route gains a `🏭 Goods ON/OFF` toggle button. When enabled, the route absorbs a share of stockpile goods above the player's reserve each turn.
- **AI goods demand** (`engine.js` — `getNationGoodsDemandUnits`): Each nation's demand scales inversely with its `militaryLevel`. Nations with `militaryLevel ≥ GOODS_AI_DEMAND_MIL_CEILING` (80) buy nothing; weaker nations absorb up to `GOODS_EXPORT_MAX_PER_ROUTE` (8) units/turn.
- **Goods export income** (`actions.js` — `endTurn` section 2.4j): Income per route = `allocated × GOODS_EXPORT_BASE_PRICE × maturity × quality × sea control`. Quality multiplier = `1 + (mfgLevel / 100) × GOODS_QUALITY_MFG_BONUS`. Sea disruption applies. Per-route last-turn income stored as `route.goodsExportIncomeLast`.
- **Stockpile reserve control** (`actions.js`, `render.js`): Player sets a reserve floor (range slider 0 → stockpileMax) in the Military tab supply section. Only goods above the reserve are eligible for export. `setGoodsStockpileReserve(value)` action added.
- **Stockpile UI** (`render.js`): Military tab supply section gains a stockpile bar (yellow), reserve slider, and a hint line describing available-for-export units and how many routes have export enabled.
- **Route card UI** (`render.js`): Trade route cards show the `🏭 Goods ON/OFF` toggle and the last-turn goods export income (or a dim note when surplus is zero or the nation has no demand).
- **Stockpile/export CSS** (`style.css`): `.mil-stockpile-section`, `.mil-bar-stockpile`, `.stockpile-reserve-row`, `.stockpile-reserve-label`, `.stockpile-reserve-slider`, `.stockpile-reserve-hint`, `.btn-tr-goods-export`, `.btn-tr-goods-export.active`, `.tr-route-goods-income`, `.tr-route-goods-warning`.

### Constants added (`constants.js`)
- `STOCKPILE_CAP_TURNS` (10), `GOODS_EXPORT_BASE_PRICE` (4.0), `GOODS_QUALITY_MFG_BONUS` (0.5), `GOODS_AI_DEMAND_MIL_CEILING` (80), `GOODS_EXPORT_MAX_PER_ROUTE` (8)

### State fields added (`state.js`)
- `G.goodsStockpile` — current stockpile (units)
- `G.goodsStockpileReserve` — player-set reserve before exporting
- `G.goodsStockpileDrawRatio` — fraction of demand covered by stockpile draw this turn

---

## [Unreleased] — Phase 5.8b: Strategic Bombing & Naval Supply Interdiction

### Added
- **Province bomb damage accumulation** (`actions.js` — `endTurn` section 2.4d): Air Force commanders on `strategicBombing` mission now accumulate damage points on target nation provinces each turn (`BOMBING_DAMAGE_PER_STR × effStr / numTargetProvs` per province). When a province reaches `BOMBING_DEV_DROP_THRESHOLD` (10 pts), its development drops by 1.
- **AI symmetric bombing** (`actions.js`): Nations actively at war with the player use `militaryLevel × AI_BOMBING_STRENGTH_FRACTION` as air attack strength against adjacent player provinces each turn.
- **Manufacturing debuff from bombing** (`engine.js`): `getGoodsProduced()` is reduced by up to `BOMBING_MFG_DEBUFF_MAX` (40%) based on `G.bombingMfgDebuff`, which scales with total AI bombing strength.
- **Supply drain from bombing** (`engine.js`): `getSupplyRatio()` is reduced by up to `BOMBING_SUPPLY_DRAIN_MAX` (30%) based on `G.bombingSupplyDrain`, which scales with the number of player provinces under active bombardment.
- **Province bomb damage auto-repair** (`actions.js`): Provinces not bombed in a turn lose `BOMBING_REPAIR_DAMAGE_PER_TURN` (1) damage pt. After `BOMBING_DEV_REPAIR_TURNS` (4) consecutive unbombed turns, lost development recovers by 1.
- **Naval interdiction — enemy mil drain** (`actions.js` — `endTurn` section 2.4i): When the player holds >50% sea control in a zone adjacent to an active war nation, that nation's `militaryLevel` is drained by `(control − 0.5) × 2 × NAVAL_INTERDICTION_MIL_DRAIN` per turn.
- **Naval interdiction — maturity freeze** (`actions.js`): When sea control in a trade route zone drops below `NAVAL_INTERDICTION_MATURITY_FREEZE_THRESHOLD` (0.4), player trade route maturity growth in that zone is cancelled each turn.
- **Bombing penalty rows in supply panel** (`render.js`): Manufacturing debuff % and supply drain % are shown as red warning rows in the Goods Supply section of the Military tab when active.
- **Strategic bombing commander badge update** (`render.js`): Badge now shows both mil drain and total bomb damage per turn.
- **Navy commander badge — interdiction status** (`render.js`): Badge now notes "Interdicting enemy supply" or "Route maturity frozen" when relevant sea control thresholds are reached.
- **Province bomb damage banner** (`render.js`): Player province info panel shows a red banner with current damage accumulation and dev lost when under bombardment.
- **Bomb damage CSS** (`style.css`): `.prov-bomb-damage-banner`, `.prov-bomb-damage-hint`, `.mil-bombing-penalty-row` styles added.

### State fields added (`state.js`)
- `G.provinceBombDamage` — per-province `{ damage, devLost, repairTurns }` accumulation object
- `G.bombingMfgDebuff` — recomputed each turn; fraction by which manufacturing output is reduced
- `G.bombingSupplyDrain` — recomputed each turn; fraction subtracted from supply ratio

### Constants added (`constants.js`)
- `BOMBING_DAMAGE_PER_STR`, `BOMBING_DEV_DROP_THRESHOLD`, `BOMBING_REPAIR_DAMAGE_PER_TURN`, `BOMBING_DEV_REPAIR_TURNS`
- `BOMBING_MFG_DEBUFF_PER_STR`, `BOMBING_MFG_DEBUFF_MAX`
- `BOMBING_SUPPLY_DRAIN_PER_PROV`, `BOMBING_SUPPLY_DRAIN_MAX`
- `AI_BOMBING_STRENGTH_FRACTION`
- `NAVAL_INTERDICTION_MIL_DRAIN`, `NAVAL_INTERDICTION_MATURITY_FREEZE_THRESHOLD`

---

## [Unreleased] — Phase 5.8a: Conquest & Occupation

### Added
- **Occupation resistance** (`actions.js` — `endTurn` section 2.4h): Every occupied enemy province accumulates resistance each turn. Growth scales with province development + distance from capital, reduced by education level. A commander with **Garrison order** suppresses resistance (flat base + per ready unit size). If resistance reaches 100, the province revolts and returns to its original owner.
- **Per-turn occupation admin cost** (`actions.js`): Each occupied province drains `development × $2M/turn` from treasury automatically.
- **Garrison order for army commanders** (`render.js`, `engine.js`, `actions.js`): Army commanders can now be set to "Garrison Occupied Province…" order. Units march to the target occupied province via the extended movement set (player provinces + occupied provinces). `getCommanderDeploymentProvince` handles the new order type.
- **Integration period** (`actions.js` — `offerPeace`, `endTurn`): When a province is formally annexed in a peace deal, it enters an integration countdown (`development × 6 turns`, reduced by `floor(educationLevel / 20) × 2`). During integration the province does not contribute deposit slots or resources.
- **Territory score growth** (`actions.js`): When integration completes, `G.territoryScore` increases by `development × 0.1`.
- **`G.integratingProvinces`** (`state.js`): New state field `{ [provId]: { turnsRemaining } }` tracking integration progress.
- **Occupation info panel** (`render.js`): Clicking an occupied enemy province on the map now shows an info panel with resistance level, turns held, and garrison status instead of the nation panel.
- **Integration banner** (`render.js`): Player province panel shows a blue banner with turns remaining during integration.
- **Peace deal resistance display** (`render.js`): Each province in the peace deal modal shows dev, resistance level (colour-coded), and estimated integration time.
- **Territory Score dashboard card** (`render.js`): New indicator card in the Overview tab showing current territory score and number of provinces currently integrating.

### Constants added (`constants.js`)
- `OCCUPATION_RESISTANCE_BASE_GROWTH`, `OCCUPATION_DISTANCE_RESISTANCE_BONUS`, `OCCUPATION_EDU_SUPPRESSION`, `OCCUPATION_GARRISON_SUPPRESSION_BASE`, `OCCUPATION_GARRISON_SUPPRESSION_PER_SIZE`, `OCCUPATION_ADMIN_COST_PER_DEV`, `OCCUPATION_REVOLT_THRESHOLD`
- `INTEGRATION_TURNS_PER_DEV`, `INTEGRATION_EDU_REDUCTION_PER_20`, `TERRITORY_SCORE_PER_DEV`

---

## [Unreleased] — Phase 5.7f: Commander Brain + Naval/Air Unit Rosters

### Added
- **`NAVAL_UNIT_TYPES`** (`data.js`): 6 naval unit types — Destroyer, Frigate, Cruiser, Battleship, Submarine (blockade bonus), Carrier (fleet multiplier bonus). Each has `costPerSize`, `upkeepPerSize`, `productionTurns`, `attack`, `defense`, `speed`.
- **`AIR_UNIT_TYPES`** (`data.js`): 5 air unit types — Fighter, Ground Attack, Strategic Bomber, Transport, Recon/Spy. Each has per-mission `missionBonus` and optional `reconBonus`.
- **Production queue** (`state.js`): `G.productionQueue` — global ordered queue for navy/air unit production. `G.nextProductionItemId`, `G.commanderAssessments`, `G.nextAssessmentId`, `G.commanderAssessmentCooldowns`.
- **New constants** (`constants.js`): `NAVY_DETERRENCE_ATTACK_SCALE`, `AIR_DETERRENCE_ATTACK_SCALE`, `PRODUCTION_SUPPLY_SLOW_THRESHOLD`, `COMMANDER_ASSESSMENT_INTERVAL`, `COMMANDER_ASSESS_RECRUIT_THRESHOLD`, `COMMANDER_ASSESS_BUDGET_THRESHOLD`. Raised `NAVY_STRENGTH_MAX` and `AIRFORCE_STRENGTH_MAX` to 25.
- **Unit-based navy/air strength** (`engine.js`): `getNavyCommanderRawAttack`, updated `getNavyCommanderEffectiveStrength`, `getAirCommanderEffectiveStrength`, `getAirLogisticsSupplyBonus`, `getNavyStrength`, `getAirForceStrength`, `getNavalAirCommanderUnitUpkeep`, `getNavalAirCommanderReadyAttack`. `isAirMissionInRange` extended to support `airLogistics` (player province target).
- **Production queue actions** (`actions.js`): `queueProductionItem` — deducts cost upfront, enqueues item; `cancelProductionItem` — 50% refund if not active. `acceptAssessment`, `dismissAssessment` for the commander brain panel.
- **Naval/Air upkeep & production processing** (`actions.js` `nextTurn`): Navy/air unit upkeep deducted per turn; production queue item advanced each turn (slowed when supply ratio < threshold); completed items spawn the unit on the commander. Commander brain assessments generated every `COMMANDER_ASSESSMENT_INTERVAL` turns (recruit recommendation or budget increase request).
- **Unit-roster commander UI** (`render.js`): Navy/Air commander cards now show budget input, unit roster list, and production queue form (unit type + size + name). `airLogistics` mission option added with player-province targets. `renderProductionQueueHtml()` and `renderCommanderAssessmentsHtml()` standalone sections below commander list.
- **CSS** (`style.css`): `.mil-prodqueue-section`, `.mil-prodqueue-row`, `.mil-assessments-section`, `.mil-assessment-row`, `.mil-assessment-reason`, `.mil-commander-budget-row`, `.mil-budget-free`.

### Changed
- **Navy/Air commander shape**: `strengthAlloc` removed; replaced by `budget`, `nextUnitId`, `units[]`. `mission` and `target` retained.
- **`branchCard()`**: Navy/Air cards no longer show Level or Funding — show unit count and total strength instead.
- **Dashboard stats**: Navy Level and Air Force Level replaced with Navy Strength and Air Force Strength.
- **History chart**: `navyLevel`/`airForceLevel` entries replaced with `deterrenceRating`.
- **`getDeterrenceRating()`**: Now uses `getNavyStrength()` and `getAirForceStrength()` instead of `G.navyLevel`/`G.airForceLevel`.

### Removed
- **`G.navyLevel`**, **`G.airForceLevel`**: Removed from state. Unit rosters replace them.
- **`policyFunding.navy`**, **`policyFunding.airForce`**: Removed. Navy/Air strength is now purely unit-roster-based, funded via per-commander budget.
- **`updateCommanderAlloc()`**: Removed. Navy/Air commanders no longer have a strength allocation slider.
- **Navy/Air level-building loop** (`nextTurn`): Section 1.6 removed.

---

## [Unreleased] — Phase 5.7e: Equipment Design

### Added
- **`EQUIPMENT_TIERS`** (`data.js`): 3-tier equipment table — Mk.I (baseline), Mk.II (requires Advanced Metallurgy: +40% ATK, +35% DEF, +1 SPD), Mk.III (requires Composite Armour: +80% ATK, +70% DEF, +2 SPD).
- **`G.equipmentTiers`** (`state.js`): Per-unit-type tier tracking (all 7 ground types start at 1). **`G.activeRefits`**: list of in-progress refits `{ unitType, targetTier, turnsLeft }`.
- **Equipment refit helpers** (`engine.js`): `getEffectiveUnitAttack()`, `getEffectiveUnitDefense()`, `getEffectiveUnitSpeed()` — compute actual unit stats incorporating equipment tier multipliers and tech bonuses. `getRefitCost()`, `getRefitTurns()`, `getUnitTypeInServiceSizes()` — calculate refit economics.
- **`orderRefit(unitType, targetTier)`** (`actions.js`): Deducts treasury cost, marks all in-service units of the type as `'refitting'`, and queues a refit. Validates: tech prerequisite, no active refit for that type, sufficient treasury, and units in service.
- **Refit countdown** (`actions.js` endTurn, section 2.4e-r): Each turn decrements `turnsLeft`; at 0 the tier is upgraded, all `'refitting'` units of that type revert to `'ready'`, and a log entry is added.
- **Equipment tab** (`index.html`, `render.js`, `css/style.css`): New `⚙️ Equipment` tab (unlocked by Basic Metallurgy). Shows a card per unit type with current effective stats, tier badge, in-service count, next-tier preview stats, cost/turns, and Refit button. Disabled if tech locked, already max tier, refit in progress, no units, or insufficient treasury.
- **Equipment constants** (`constants.js`): `EQUIPMENT_REFIT_COST_FRACTION`, `EQUIPMENT_REFIT_BASE_COST`, `EQUIPMENT_REFIT_TURNS_PER_TIER`, `ARMY_DETERRENCE_ATTACK_SCALE`, `ARMY_HAPPINESS_PER_UNIT_SIZE`.
- **`materialScience` effect** (`data.js`): Now applies `equipmentRefitCostMult: 0.80` (−20% refit cost) in `getTechEffects()`.

### Changed
- **`G.armyLevel` removed** (`state.js`, `engine.js`, `actions.js`, `render.js`): Army level as a 0–100 policy lever is gone. Army strength is now derived entirely from the unit roster (`getArmyStrength()` sums effective attack power of ready units).
- **`policyFunding.army` removed** (`state.js`): Army branch no longer receives policy funding. The section 1.6 military branch funding loop now iterates only `['navy', 'airForce']`.
- **`getDeterrenceRating()`** (`engine.js`): Rewritten — Army contributes via `getArmyStrength() / ARMY_STRENGTH_MAX × 50`; tech `deterrenceBonus` is added.
- **`getArmyStrength()`** (`engine.js`): Rewritten — sums `getEffectiveUnitAttack(type) × size` for all ready units, normalised by `ARMY_DETERRENCE_ATTACK_SCALE`, capped at `ARMY_STRENGTH_MAX`.
- **`calcHappinessTarget()`** (`engine.js`): Army happiness penalty now scales with total unit sizes in service (all statuses) × `ARMY_HAPPINESS_PER_UNIT_SIZE`, not `armyLevel`.
- **`getUnitTurnsPerHop()`** (`engine.js`): Now uses `getEffectiveUnitSpeed()` so equipment tier speed bonuses affect movement.
- **`getSiegeAttackStrength()`** (`engine.js`): Uses `getEffectiveUnitAttack()` per unit; artillery applies `supportAttackBonus` as a multiplier on combined non-artillery attack.
- **`getPlayerDefenseStrength()`** (`engine.js`): Uses `getEffectiveUnitDefense()` per unit.
- **Overview indicators** (`render.js`): "Army Level" indicator removed.
- **Statistics sector status** (`render.js`): "Army" row removed from the sector chart.
- **Military screen Army card** (`render.js`): Replaced policy-level branchCard with a unit-roster card showing strength, average equipment tier, and a hint to use the Equipment tab.
- **History snapshots** (`actions.js`): `armyLevel` removed from the per-turn snapshot object.
- **`ARMY_STRENGTH_MAX` comment** (`constants.js`): Constant retained (used for deterrence normalisation).

---

## [Unreleased] — Phase 5.7d: Research Tree Redesign

### Added
- **27 new technologies** (`data.js`): Spread across `military` (fortification doctrines, military logistics, military intelligence), new `militaryEng` path (basic metallurgy, ballistics research, commander autonomy, naval unit development, advanced metallurgy, air unit development, mechanised warfare, precision engineering, jet propulsion, composite armour, nuclear deterrence), `trade` (trade intelligence, financial services, international mediation), `economic` (corporate law, advanced finance), `industrial` (synthetic materials, automated logistics), `social` (civil rights, civic education, social safety net), and `science` (computer science, biotechnology, material science). Total ~57 techs.
- **`G.techQueue`** (`state.js`): New ordered array of queued techIds, initialized as `[]` in `initGame()`.
- **Queue actions** (`actions.js`):
  - `enqueueTech(techId)` — toggles a tech on/off in the queue; starts it immediately if nothing is active.
  - `dequeueTech(techId)` — removes a tech from the queue.
  - `moveQueueUp(techId)` / `moveQueueDown(techId)` — reorder queue entries.
  - `cancelResearch()` — clears the active research and progress.
  - `_startNextQueuedTech()` (internal) — dequeues the next valid tech (skips already-unlocked or unmet prerequisites) and sets it as the active research.
- **Auto-advance from queue** (`actions.js` endTurn): After a tech completes, `_startNextQueuedTech()` is called automatically to begin the next queued tech.
- **Visual tech tree** (`render.js` — `_buildResearchTab`, `_computeTechTreeLayout`): Replaces the old flat tier list. Layout algorithm assigns each tech a column equal to its max prerequisite depth and a row equal to its path lane. Collisions at the same column+row are resolved with fractional row offsets. Renders as:
  - **SVG bezier connection lines** between prerequisite pairs, colour-coded (green = both unlocked, medium = prereq done, grey = neither done).
  - **Absolute-positioned tech nodes** with status variants: done (green), active (pulsing blue with progress bar), queued (orange badge showing queue position), available, locked (dimmed, unclickable). Clicking an available or queued tech calls `enqueueTech(id)`.
  - **Seven path lane labels** on the left (Economic, Industrial, Military, Mil. Engineering, Trade & Diplomacy, Social, Science), colour-coded per path.
  - **Queue panel** on the right (280 px): current research name + animated progress bar + turns-remaining + Cancel button; queued techs list with ↑ ↓ reorder and × remove; RP/turn and research level footer.

### Changed
- Research tab render completely replaced — old `.research-tab-tree` / `.tech-card` / `.research-tier` / `.tier-label` markup no longer generated (CSS kept for safety until confirmed unused).

### New CSS classes
`.tt-layout`, `.tt-scroll-wrapper`, `.tt-lane-labels`, `.tt-lane-label`, `.tt-scroll-area`, `.tt-canvas`, `.tt-svg`, `.tt-line` (+ `.tt-line-avail`, `.tt-line-done`), `.tt-node` (+ `.tt-done`, `.tt-active`, `.tt-queued`, `.tt-locked`, `.tt-avail`), `.tt-progress-track`, `.tt-progress-bar`, `.tt-node-body`, `.tt-icon`, `.tt-name`, `.tt-cost`, `.tt-badge` (+ `.tt-badge-done`, `.tt-badge-active`, `.tt-badge-queue`), `.tt-queue-panel`, `.tt-queue-header`, `.tt-queue-active`, `.tt-queue-active-label`, `.tt-queue-active-name`, `.tt-queue-active-bar-track`, `.tt-queue-active-bar`, `.tt-queue-active-detail`, `.tt-queue-active-empty`, `.tt-queue-list`, `.tt-queue-empty`, `.tt-queue-row`, `.tt-queue-warn`, `.tt-queue-num`, `.tt-queue-icon`, `.tt-queue-name`, `.tt-queue-cost`, `.tt-queue-btn`, `.tt-queue-remove`, `.tt-queue-footer`.

---

## [Unreleased] — Phase 5.7c: War Declaration & Combat

### Added
- **AI mirror militaries** (`actions.js` — `initAiMilitaries`): All 8 AI nations start with commanders and units scaled to their province count. 1 commander per 3 provinces (min 1), each garrisoning `lightInfantry` (size 8 per assigned province). Nations with 4+ provinces also get one `armoredCorps` unit on their lead commander.
- **`declareWar(nationId)`** (`actions.js`): Adds a war entry to `G.wars`, sets relations to −100, pauses all trade routes, auto-converts any `stage` orders targeting that nation to `advance` orders (with a staging bonus applied to siege calculations).
- **`advance` order type**: Units on `advance` orders path through both player and enemy territory (unrestricted BFS). Each turn they step toward the nearest unoccupied enemy province.
- **Siege mechanics** (endTurn section 2.4g): Each turn, every enemy province with player units accumulates siege progress: `net = atk × stagingBonus − def` → `progress += net / 10`. Province captured when progress ≥ 100. Both sides take proportional unit size casualties each turn (`4%` × clamp(ratio, 1, 4)).
- **AI counter-attack**: AI commanders with total attack ≥ 20 march toward the nearest player province and apply a reverse siege (progress counts down from 100; reaching 0 recaptures the province).
- **`offerPeace(nationId, keepProvIds)`** (`actions.js`): Annexes checked provinces (mutates `PROVINCES[id].nationId`), returns unchecked provinces, rebases AI units to home, resumes trade routes, removes war entry.
- **Auto-sue for peace**: Enemy auto-flags `sueForPeaceOffered = true` in the log when ≥ 60% of their provinces are occupied.
- **War costs**: −5 treasury/turn and −8 happiness per active war.
- **War panel in nation info** (`render.js` — `_buildWarPanel`): Shows "Declare War" button when at peace; shows occupied province count, AI unit count, elapsed turns, and "Offer Peace Deal" button when at war. Peace-requesting nations show a badge.
- **Peace deal modal** (`render.js` — `openPeaceDeal`): Checkbox list of occupied provinces; player selects which to annex before signing.
- **Map province states**: Occupied provinces render dark green (`.map-province-occupied`); sieged provinces show an animated orange dashed border (`.map-province-contested`); siege progress % label appears below the province name.
- **AI unit icons on map**: Enemy units during war render as emoji icons in their current province with a red drop-shadow (`.map-ai-unit-icon`).
- **War border tint**: Nations currently at war with the player show a red province outline (`.map-region-at-war`).

### Changed
- `calcHappinessTarget` now subtracts `G.wars.length × 8` (war happiness penalty).
- endTurn section 2.4f now skips commanders on `advance` orders (handled by 2.4g instead).

### New engine helpers
`isAtWar`, `getProvinceEffectiveOwner`, `getNationProvinces`, `getPlayerOccupiedProvincesOf`, `getOccupiedFraction`, `getSiegeAttackStrength`, `getAiDefenseStrength`, `getPlayerDefenseStrength`, `getAdvanceTargetProvince`, `getAiCounterAttackTarget`, `getProvincesWithAiUnits`.

---

## [Unreleased] — Phase 5.7b: Unit Movement & Pre-War Staging

### Added
- **Commander orders**: Army commanders now have an `order` object (`type: 'hold' | 'stage' | 'defend'`, `target`). Set via a new **Order row** at the top of each Army commander card (order type dropdown + context-sensitive target dropdown for nation or player province).
- **`setCommanderOrder(commanderId, type, target)`** (`actions.js`): mutates the commander's order and resets all unit `moveTimer`s.
- **`getCommanderDeploymentProvince(cmd)`** (`engine.js`): translates an order into a single deployment province — Hold → capital; Defend → named province; Stage → nearest player border province to the target nation (via `getTradeRouteLandPath()[0]`).
- **`getUnitTurnsPerHop(unitType)`** (`engine.js`): `ceil(UNIT_MOVEMENT_BASE_TURNS / speed)` — Recon/Armored 1 t/hop, Mechanized/Anti-Tank 2 t/hop, Infantry/Anti-Air 3 t/hop, Artillery 6 t/hop.
- **Unit position state**: recruited units now initialise with `position: capital` and `moveTimer: 0`. Units march toward their commander's deployment province each turn.
- **endTurn 2.4f movement loop** (`actions.js`): each ready unit that is not at its deployment province increments `moveTimer`; when it reaches `turnsPerHop`, the unit advances one hop via player-province-only BFS and the timer resets.
- **`bfsPath` restriction parameter** (`engine.js`): optional third argument `restrictToSet` limits traversal to a set of province IDs (used to keep pre-war units inside player territory).
- **`getProvincesWithPlayerUnits()`** and **`getStagingProvinces()`** (`engine.js`): map helpers for the renderer.
- **Map unit icons**: ready units drawn as emoji icons at their province (`labelX/labelY` with offsets for multiple units). Count badge when >1 unit shares a province.
- **Staging province highlight**: provinces designated as the deployment target of a "Stage Against" order get an orange border ring on the map (`.map-province-staging`).
- **Roster ETA**: unit rows show current province and estimated arrival turn count while en route.
- Constant `UNIT_MOVEMENT_BASE_TURNS = 6` added to `constants.js`.

---

## [Unreleased] — Phase 5.7a: Unit System

### Added
- **`UNIT_TYPES` data** (`data.js`): 7 ground unit types — Light Infantry, Mechanized Infantry, Armored Corps, Artillery Battery, Recon Unit, Anti-Air Battery, Anti-Tank Battalion — each with `costPerSize`, `upkeepPerSize`, `recruitTurns`, `attack`, `defense`, `speed`, and type-specific special fields (`supportAttackBonus`, `airDefenseStrength`, `armorPiercingBonus`).
- **Army commander shape** split from Navy/Air Force: Army commanders now carry `budget` (M gold/turn), `units[]`, and `nextUnitId` instead of `strengthAlloc`/`mission`/`target`.
- **`recruitUnit(commanderId, type, size, name)`**: deducts one-time cost from treasury, adds a unit in `recruiting` state; recruit timer counts down each turn.
- **`disbandUnit(commanderId, unitId)`**: removes a unit immediately.
- **`setCommanderBudget(commanderId, value)`**: sets a commander's authorized per-turn upkeep budget.
- **endTurn unit logic**: deducts all ready-unit upkeep from treasury each turn; advances recruit timers; fires `✅ ready` log when a unit completes training; warns when upkeep exceeds commander budget.
- **Army commander card** redesigned: shows budget input, upkeep summary, free-budget indicator (green/red), full unit roster with status badges (⏳ recruiting / ✓ Ready), per-unit disband button, and an inline recruit form (type dropdown, size input, name field).
- **Engine helpers**: `getCommanderUnitUpkeep`, `getCommanderBudgetFree`, `getTotalArmyBudgetAllocated`, `getTotalArmyUnitUpkeep`, `getCommanderReadyUnits`, `getCommanderCombatPower`.
- Constants `UNIT_MAX_SIZE = 20` and `UNIT_UNDERFUND_WARNING_THRESHOLD = 0.01` added.

---

## Phase 5.6: Province-Level Routing for Trade and Supply

### Added
- **BFS path finder** (`bfsPath`): Returns the full shortest province-adjacency path between two province sets — separate from the hop-count function used by air range.
- **Trade route land paths** (`getTradeRouteLandPath`): Shortest province path from any player province to the nearest province of the target nation; computed live from the adjacency graph.
- **Path efficiency multiplier** (`getRoutePathEfficiencyMultiplier`): Intermediate third-party provinces (neither player nor target) penalise trade income when their average `infraLevel` < 5. Multiplier = `min(1, avgInfra / 5)` — penalty-only, applied to `getTradeRouteIncome`.
- **Supply routing from capital** (`getPlayerProvinceSupplyLevels`, `getProvinceSupplyLevel`): BFS from Arvenmoor through player provinces only, 10% supply decay per hop. Capital province = 100%; outermost provinces ≈ 70–80%.
- **Trade route path visualisation**: Active trade routes draw dashed polylines on the SVG world map connecting province label centres. Gold for overland routes, blue for sea routes. Opacity increases with route maturity (0.35 → 0.80). A small efficiency-% label appears at the midpoint when a penalty applies.
- **Province panel supply info**: Province click panel now shows Supply (%) and Capital distance (hop count) rows in its info grid.
- Constants `ROUTE_PATH_INFRA_REFERENCE = 5` and `SUPPLY_DISTANCE_DECAY = 0.10` added to `constants.js`.

---

## Phase 5.5: Air Force Operations

### Added
- **Air Superiority mission**: Air Force commanders targeting a sea zone add strength (at 0.5× factor) to that zone's sea control — air cover stacks with Navy patrols.
- **Strategic Bombing mission**: Air Force commanders targeting an enemy nation drain that nation's `militaryLevel` by `effectiveStrength × 0.002` per turn.
- **Province-hop range system**: `bfsMinHops()` traverses the province adjacency graph to check whether a player Airfield is within range of a mission target. Air Superiority range = 4 hops; Strategic Bombing range = 6 hops.
- **Out-of-range badge**: Commanders targeting a zone/nation outside Airfield range display ⚠ "Out of range — build Airfield closer" and contribute zero effect.
- **Coastal province→sea zone mapping**: `getSeaZoneCoastalProvinces()` derives the province set adjacent to each sea zone from the `adjacentNations` list.
- Default target assigned to new commanders on creation (sea zone for Navy/Air Force; player province for Army).

---

## Phase 5.4: Naval Command System + Merchant Fleet + Sea Control

### Added
- **Commander System**: Assign named commanders to Army, Navy, or Air Force with a `strengthAlloc` percentage of their branch level and a mission + target. UI in the Military tab: create, configure, and remove commanders.
- **Merchant Fleet**: `G.merchantFleet` civilian capacity level grows from active trade routes × Commerce investment, decays slowly each turn, and caps total trade income throughput when capacity is below demand.
- **Sea Control per zone**: Each sea zone (Vael Sea, Grey Reach) has a sea control score = player navy strength / (player + enemy). Navy commanders on `tradeProtection` mission directed at a zone contribute player strength; AI nation military levels near each zone set enemy strength. Trade routes crossing a sea zone have their income multiplied by that zone's sea control.
- **Naval Base staging bonus**: Navy commanders gain +30% effective strength if any Naval Base is installed in a province adjacent to their target sea zone.
- **Sea zone status panel**: Military tab shows per-zone player/enemy fleet strength, sea control bar, and active route count.
- `seaZone` tagged on each trade route at creation (null for overland routes).
- `adjacentNations` field on `SEA_PROVINCES` entries to determine which AI nations contribute enemy fleet strength.

### Changed
- Trade route income now applies both per-route sea control multiplier and global merchant fleet capacity multiplier.

---

## Phase 5.3: Province Installations + Map Sea

### Added
- **Province installations system**: Build Airfields and Naval Bases in your provinces. Build cost scales +50% per duplicate type in the same province. Maintenance auto-deducted each turn.
- **Installation UI — three entry points**: map province click panel, Military screen installations section, Policy screen maintenance card.
- **Province click panel on world map**: Click any player province to see its stats, existing installations, and build buttons.
- **Vael Sea and Grey Reach**: Two named sea regions now rendered as blue polygons on the world map, tracing the exact coastline of all bordering land provinces. The Vael Sea wraps the north, east, and west of the continent; the Grey Reach covers the south.
- **Coastal provinces** (18 land provinces): `venmoor`, `stormfen`, `greenvale`, `ashwood`, `gorrath`, `ashpeak`, `aldenmere`, `ironspire`, `havenport`, `marport`, `silverwatch`, `deepstone`, `iraboreal`, `irastone`, `greensward`, `midvale`, `ashbrook`, `dawncoast` now have `coastal: true` and can host Naval Bases. Player provinces are landlocked — sea access requires expansion.
- `SEA_PROVINCES` constant in data.js holds sea polygon geometry and labels.
- Sea regions rendered with `.map-sea-region` / `.map-sea-label` CSS classes (italic, light-blue tinted labels).

### Changed
- Trade negotiations are now instant (AI responds immediately instead of waiting for end-of-turn).
- Military and Diplomacy techs pre-unlocked in `state.js` for testing Phase 5.3.

### Constants added (constants.js)
- `INSTALLATION_TYPES` — airfield and naval base definitions (build cost, maintenance, `requiresCoastal`)
- `INSTALLATION_BUILD_COST_SCALE = 0.5`

---

## [0.22.0] — Phase 5.2: Goods Flow / Supply System

### Added
- **Goods flow system**: Manufacturing level produces goods each turn; Infrastructure level acts as a delivery efficiency multiplier (50% base + 50% from infra level). Civilian demand scales with population; military demand scales with Army strength.
- **Guns-vs-butter tension**: When goods delivered < total demand, a supply deficit applies a happiness penalty (max −10) and an army effectiveness modifier (0–1, used by Phase 5.6 war system).
- **Supply functions in engine.js**: `getGoodsProduced()`, `getGoodsDeliveryEff()`, `getGoodsDelivered()`, `getCivilianGoodsDemand()`, `getMilitaryGoodsDemand()`, `getTotalGoodsDemand()`, `getSupplyRatio()`, `getSupplyHappinessPenalty()`, `getArmySupplyEffectiveness()`.
- **Goods Supply overview indicator**: Always-visible ratio bar showing delivered vs demanded.
- **Supply panel in Military screen**: Breakdown of production, delivery efficiency, civilian demand, military demand, ratio bar, and deficit/surplus note.
- **buildEffectsHint updates**: Infrastructure hints now include `↑ supply delivery`; Manufacturing hints include `↑ goods supply`.

### Changed
- Starting `miningLevel` and `manufacturingLevel` both raised from 0 → 10 (matching starting infra of 10) so the game does not open in a supply deficit.
- `calcHappinessTarget()` now subtracts `getSupplyHappinessPenalty()`.

### Constants added
- `GOODS_PER_MFG_LEVEL = 1.0`
- `GOODS_PER_MILLION_POP = 0.5`
- `GOODS_PER_ARMY_STRENGTH = 1.5`
- `SUPPLY_HAPPINESS_PENALTY_MAX = 10`

---

## [0.21.0] — Phase 5.1: Military Branch Architecture + Military Screen

### Added
- **Three military branch policies**: `army`, `navy`, `airForce` — each built via the same level-growth model as other sectors (full `SECTOR_DECAY` when unfunded). Each requires a corresponding tech to unlock.
- **Three military techs** forming a new `military` path in the tech tree:
  - **Standing Army** (tier 1, 30 RP, no prerequisites) — unlocks Army policy + Military screen tab.
  - **Naval Fleet** (tier 2, 80 RP, requires Standing Army) — unlocks Navy policy.
  - **Air Force** (tier 3, 160 RP, requires Naval Fleet + Mass Production) — unlocks Air Force policy.
- **`G.armyLevel`**, **`G.navyLevel`**, **`G.airForceLevel`** — replace the old single `G.militaryLevel`.
- **`getDeterrenceRating()`** in `engine.js` — weighted 0–100 score (Army 50%, Navy 25%, Air Force 25%). Used for trade negotiation leverage and the Military screen.
- **`getArmyStrength()`**, **`getNavyStrength()`**, **`getAirForceStrength()`**, **`getTotalMilitaryStrength()`** — branch-specific strength functions; Army is manpower-gated by population × `MILITARY_MANPOWER_RATIO`.
- **Military tab** in the dashboard (locked behind Standing Army tech) — shows branch levels, funding status, manpower cap, and combined deterrence rating.
- **CSS** for Military screen: `.mil-panel`, `.mil-branch-card`, `.mil-branch-locked`, `.mil-stat-row`, `.mil-bar-*`, `.mil-deterrence-badge`.
- `ARMY_STRENGTH_MAX = 30`, `NAVY_STRENGTH_MAX = 10`, `AIRFORCE_STRENGTH_MAX = 10`, `ARMY_HAPPINESS_PENALTY = 3` in `constants.js`.

### Changed
- **`calcHappinessTarget()`** — happiness penalty now tied to `G.armyLevel` (via `ARMY_HAPPINESS_PENALTY`) instead of the old `G.militaryLevel`.
- **`getTradeNegotiationLeverage()`** — uses `getDeterrenceRating()` instead of `G.militaryLevel` for the military ratio.
- **Overview indicators** — single "Military Level" indicator replaced with Deterrence Rating, Army Level, Navy Level, Air Force Level.
- **Statistics tab** sector rows — `Military` row replaced with Army, Navy, Air Force rows.
- **History snapshots** — `militaryLevel` field replaced with `armyLevel`, `navyLevel`, `airForceLevel`, `deterrenceRating`.
- **`policyFunding`** in state — `military` key replaced with `army`, `navy`, `airForce`.
- **`renderTabBar()`** — now handles both Diplomacy and Military tab lock/unlock.
- `buildEffectsHint()` updated for new branch policy keys.

### Removed
- `G.militaryLevel` — split into three branch levels.
- `POLICIES.military` — replaced by `POLICIES.army`, `POLICIES.navy`, `POLICIES.airForce`.
- `MILITARY_STRENGTH_MAX`, `MILITARY_HAPPINESS_PENALTY` constants — replaced by branch-specific constants.
- `getMilitaryStrength()` remains as a legacy alias for `getTotalMilitaryStrength()`.

---

## [0.20.0] — Phase 5.0: Province Map Redesign

### Added
- **36-province world map** replacing the 8-polygon Phase 3.2 placeholder. Each province is an independent data entity with its own SVG polygon, adjacency list, development level (1–5), `infraLevel`, `deposit`, and `depositSlots`.
- **`PROVINCES`** constant in `data.js` — flat object keyed by province ID. Province nations: Sorenia (3), Kethara (4), Marveth (4), Valdoria (4), Player (6), Orzhan (3), Nocthar (4), Iravan (4), Durenna (4).
- **`PLAYER_MAP`** constant in `data.js` — stores player empire label and capital marker positions separately from individual provinces.
- **`GDP_PER_PROVINCE_DEVELOPMENT = 100`** constant in `constants.js` — $100M GDP contributed per development level per province.
- Two new player provinces: **Dawnford** and **Crestmere** (development 1, 2 deposit slots each), bringing the player's starting territory to 6 provinces.

### Changed
- **Emergent nation GDP** — nation GDP is no longer a hardcoded constant in `NATIONS`. It is now computed at game start from `Σ(province.development) × GDP_PER_PROVINCE_DEVELOPMENT` across all owned provinces, then grows each turn by the nation's `gdpGrowthRate`.
- **`NATIONS`** entries updated: removed `gdp` field, added `color`, `labelX`, `labelY`, `capitalX`, `capitalY` for map rendering.
- **`MAP_REGIONS`** constant removed — replaced by `PROVINCES` + `PLAYER_MAP`.
- **`getRegionCapacity(provinceId)`** in `engine.js` now reads `PROVINCES[provinceId].depositSlots` directly; `REGION_CAPACITY_BY_SIZE` lookup removed.
- **`getFreeSlotProvinces()`** in `engine.js` now filters `PROVINCES` by `nationId === 'player'`.
- **`renderWorldMap()`** in `render.js` rewritten to iterate `PROVINCES` grouped by `nationId`. AI nations render all their province polygons then one label/capital dot; player provinces each get their own polygon and label.
- Resources tab province rows and deposit province name lookups updated to use `PROVINCES` instead of `MAP_REGIONS.player.provinces`.
- Diplomacy panel and map info panel nation colour now sourced from `NATIONS[id].color` instead of `MAP_REGIONS[id].color`.
- Province deposit-slot capacity star indicator changed from `prov.size === 'capital'` to `prov.depositSlots >= 4`.
- **Thornhaven** and **Selmark** polygon boundaries adjusted to accommodate the two new southern provinces.

---

## [0.19.0] — Phase 4.4: Strategic Alliances, Cultural Diplomacy, UN Membership

### Added
- **`proposeAlliance(nationId)`** — proposes a permanent strategic alliance with a nation (requires Strategic Alliances tech and ≥40 relations). AI accepts if relations ≥ 50. Active alliances grant +3 relations/turn and prevent the relation score dropping below 20 (Friendly floor).
- **`proposeNap(nationId)`** — proposes a Non-Aggression Pact lasting 20 turns (requires Diplomacy Corps, ≥0 relations). Shown in Diplomacy screen with turns remaining. Expires automatically with an event log entry. Will block war declarations when Phase 5 is implemented.
- **`breakAlliance(nationId)`** — dissolves an active alliance, applying a −25 `relationsNegPenalty` to the nation.
- **Cultural Diplomacy tech** (tier 5, trade path) — new tech unlocking a passive +12 base relations bonus with all nations globally.
- **UN Membership tech** (tier 6, trade path) — new tech granting +5 relations with all nations globally and displaying a "🌐 UN Member" panel at the bottom of the Diplomacy screen.
- **`G.diplomaticDeals`** — new state array tracking active NAP and Alliance deals: `[{ type, nationId, turnsLeft }]`. Alliances use `turnsLeft: null` (permanent); NAPs use a countdown.
- **Diplomacy screen action buttons** — each nation card now shows context-appropriate action buttons: "Propose Alliance" (disabled if relations < 40), "Propose NAP" (disabled if relations < 0), "Break Alliance" (when allied).
- **Deal status badges** — nation cards display active alliance ("🛡️ Allied") and NAP ("🕊️ NAP — N turns remaining") deal badges.
- 8 new constants: `NAP_DURATION`, `ALLIANCE_MIN_PROPOSE_REL`, `NAP_MIN_PROPOSE_REL`, `ALLIANCE_ACCEPT_REL`, `NAP_ACCEPT_REL`, `ALLIANCE_BREAK_PENALTY`, `ALLIANCE_RELATIONS_FLOOR`, `ALLIANCE_RELATIONS_BONUS`.

### Changed
- **`computeNationRelations`** — extended with steps 10–12: alliance bonus (+3), Cultural Diplomacy tech bonus, UN Membership tech bonus. End of function now applies an alliance floor clamp (result ≥ 20 when allied).
- **`getTechEffects`** — two new accumulated fields: `cultureDiplomacyRelationsBonus` and `unRelationsBonus`.
- **`endTurn`** — new step 11 ticks NAP `turnsLeft` and removes expired deals.
- **`strategicAlliances` tech** effectDesc updated to reflect NAP + Alliance actions are both unlocked.

---

## [0.18.0] — Phase 4.2–4.3: Diplomacy Corps + Diplomacy Screen

### Added
- **Trade & Diplomacy tech branch** — 5 new techs in a new path section of the tech tree:
  - `tradeAgreements` (T3): +10% base export quality in all negotiations (requires Banking System + Market Regulation)
  - `diplomacyCorps` (T4): unlocks Diplomacy screen tab
  - `culturalExchange` (T5): +8 relations with every active trade partner
  - `strategicAlliances` (T5): unlocks Alliance/NAP actions (Phase 4.4)
  - `economicUnions` (T6): −15% import asking price in all negotiations
- **Diplomacy screen tab** — visible but locked (🔒) until Diplomacy Corps is researched. Nation cards show relation score + tier badge, GDP, military level, trade streak, and active deals.
- **`renderTabBar()`** — updates the Diplomacy tab button to locked/unlocked state; called on every `renderAll()`.
- **Negotiation preview** now accounts for Trade Agreements and Economic Unions bonuses when estimating deal income.

---

## [0.17.0] — Phase 4.1: Relations Score

### Added
- **`computeNationRelations(nationId)`** — fully recomputed each turn from 9 weighted factors (active route, maturity, import reliance, trade volume share, first contact, streak, negotiation penalty, broken routes, Cultural Exchange tech bonus). Score range: −100 to +100.
- **Five named tiers** — Allied (≥60), Friendly (≥20), Neutral (>−20), Tense (>−60), Hostile (≤−60) — via `getRelationsTier(score)` helper in render.js.
- Tier badges shown on trade route cards, world map region shading, map info panel, statistics table, and (later) Diplomacy screen.
- New nation state fields: `relationsNegPenalty`, `relationsFirstContact`, `relationsStreak`, `relationsBrokenRoutes`.
- 2 new constants: `NATION_RELATIONS_NEG_PENALTY_RECOVERY`, `NATION_RELATIONS_BROKEN_ROUTE_TURNS`.

### Changed
- Relations leverage formula updated from `ns.relations / 50` to `(ns.relations + 100) / 100` for the −100…+100 scale.
- `getStraightAcceptChance` reference point updated (0 = neutral on new scale).
- All 6 relations-mutation call sites in actions.js updated to use `relationsNegPenalty`/`relationsBrokenRoutes` instead of direct `relations` assignment.

---

## [0.15.0] — Phase 3.6: Demand Profiles

### Changed
- **Trade route income** is now driven by actual resource types and deposit output instead of abstract volume categories
  - Export income: player's established industry output × nation's per-resource demand multiplier × export quality × maturity
  - Import savings: shortfall between player's output and nation's supply capacity × 30% of resource base price × import discount × maturity
  - Accepting a deal with low `importQuality` (< 1.0) means higher import savings; pushing too hard reduces them
- **Negotiation panel** replaced volume sliders with a live resource profile table showing what the nation buys/sells and how much the player can currently supply
- **Route cards** show actual resource names and icons for active exports/imports, plus a breakdown of export income vs import savings
- **Nation trade profiles** updated from abstract `demand`/`supply` categories to per-resource `demandByResource`/`supplyByResource` maps (iron, coal, timber, steel, oil, chemicals, copper, silicon, rareEarths)
- `activeNegotiation` no longer carries `exportItems`/`importItems`; route objects no longer carry these arrays
- `TRADE_EXPORT_INCOME_PER_UNIT` constant removed; replaced by `RESOURCE_EXPORT_PRICE` per-resource price table and `RESOURCE_IMPORT_SAVING_FRAC`

### Added
- `RESOURCE_EXPORT_PRICE` — base income ($M/Mt) per resource type
- `RESOURCE_IMPORT_SAVING_FRAC` — fraction of base price saved per Mt of supply shortfall
- `getPlayerResourceOutput()` — returns `{resourceId: Mt/yr}` from established industries
- `getTradeRouteExportIncome(route)` — export leg income calculation
- `getTradeRouteImportSaving(route)` — import savings calculation
- `getTradeMaxExportVolume(nationId, resourceId)` and `getTradeMaxImportVolume(nationId, resourceId)`

---

## [0.14.0] — Phase 3.5: Resource Deposits

### Added
- **Resources tab** — new dashboard tab with deposit cards, province slot indicators, and established industries list
- **Deposit system** — 5-tier geological progression: Occurrence (1 Mt/yr) → Vein (5) → Deposit (15) → Reserve (40) → Major Reserve (100)
- **Three-phase mine flow**: Anomaly → Survey ($50M guaranteed) → Commissioning (tier-based cost) → Producing; mine halts during upgrade attempts
- **Upgrade mechanic**: 25% success chance; failure returns 5% partial progress and resumes Producing; success restarts Commissioning at the next tier
- **Pooling**: mines that complete Commissioning at max tier graduate into `establishedIndustries` — slot freed, output accumulates permanently
- **Provincial deposit slots**: each province has a capacity (Capital: 4, Medium: 2); when all slots are full, prospecting stops; slot usage shown as pip indicators
- **Regional congestion**: +20% development cost per other active deposit in the same province; displayed per-card in yellow
- **Province visibility**: each deposit card shows the province it occupies; anomaly roll assigns to a random province with a free slot
- **Established Industries panel**: shows pooled resource types, site count, and aggregate Mt/yr output

### Constants
- `DEPOSIT_TIER_OUTPUT`, `DEPOSIT_COMMISSION_COST`, `DEPOSIT_TIER_UPGRADE_COST`, `DEPOSIT_UPGRADE_SUCCESS`, `DEPOSIT_PROGRESS_DECAY`, `DEPOSIT_MAX_TIER_WEIGHTS`, `PROSPECT_BASE_CHANCE`, `PROSPECT_LEVEL_SCALE`, `PROSPECT_DIMINISH_RATE`, `DEPOSIT_SURVEY_COST`

---

## [0.13.0] — Phase 3.4: Tech Unlock Mechanic + Industrial Path

### Added
- **Industrial tech path** (9 techs): Industrialisation → Steel Production → Mass Production → Heavy Industry → Chemical Industry → Electronics → Advanced Manufacturing → Robotics → Nanotechnology
- **Mining sub-branch** (4 techs): Prospecting Methods (T3) → Industrial Mining (T5) → Open-Pit Mining (T7) → Deep Vein Extraction (T9); each unlocks the next deposit-tier upgrade
- **Tech unlock system**: techs using the `unlocks` field correctly gate downstream panels; an in-game notification fires when a new panel is unlocked

---

## [0.12.0] — Phase 3.3 redesign

### Changed — Trade Negotiation System (complete redesign)
- **Volume sliders** replace checkboxes: each category now has a range/number input for units exported/imported, capped by the nation's demand/supply profile (`TRADE_VOLUME_BASE × multiplier`)
- **Turn-based responses**: proposing an offer sets status to `awaiting`; the nation responds at end of turn via `_processNegotiationResponse()`. No more instant round cycling
- **Counter-offers** replace round acceptance: the nation returns `{ exportQuality, importQuality }` based on leverage, push count, and threat
- **Push from counter-offer**: player can push after seeing the nation's counter, paying a relations cost immediately; relations cost scales with push count and whether a threat was included
- **Threaten toggle**: checkbox in the countered panel — enabling it boosts export quality gained but adds collapse risk and extra relations damage
- **Collapse risk**: if the player has pushed at least once, each response has a `getPushCollapseRisk()` chance of the negotiations collapsing (relations −5)
- **Straight-accept** chance: after ≥1 push, high-leverage + good-relations nations may accept your terms outright (best outcome) before any counter is made
- **Reject counter** → returns to drafting so player can modify volumes
- **Income formula**: `volume × TRADE_EXPORT_INCOME_PER_UNIT × exportQuality × maturityMult`; import income removed until Phase 3.5
- Shared `_buildNegotiationPanel(neg)` renders the same panel in both the Trade Routes tab and the World map info panel
- Route cards now display `exportItems`/`importItems` volume arrays and `exportQuality` instead of flat category lists and `dealQuality`

### Removed
- `toggleNegotiationExport`, `toggleNegotiationImport`, `acceptTradeNegotiation` (replaced by new flow)
- `getTradeNegotiationMaxRounds` engine function
- Old `TRADE_DEAL_*`, `TRADE_ROUTE_BASE_EXPORT`, `TRADE_ROUTE_BASE_IMPORT` constants
- Old round-based negotiation expiry in endTurn (replaced by `_processNegotiationResponse`)
- Old CSS: `.tr-negotiation-panel`, `.tr-neg-*`, `.map-trade-negotiation`, `.map-neg-*` (replaced by `.neg-*`)

---

## [0.11.0] — 2026-05-05

### Added — Trade Negotiation System (Phase 3.3)
- **Multi-round trade negotiations** replace the old "Open Route" button
- Click any nation on the World map → "Negotiate Trade Deal" opens an inline negotiation panel
- Choose **export** and **import** goods categories: Raw Materials, Manufactured Goods, Financial Services
- Accept the current deal or **push for better terms** (uses extra rounds to improve deal quality)
- **Leverage** determines how strong your position is: `clamp(militaryLevel / nationMilitaryLevel × relations/50, 0.1, 3.0)`
- **Max rounds** = `ceil(relations/20)` — hostile nations grant 1 round; friendly nations up to 4–5
- **Deal quality** improves with leverage and patience: `clamp(0.4 + (leverage/3)×0.4 + (round−1)×0.1, 0.3, 1.2)`
- **Route income** = export income + import saving, both scaled by nation demand/supply profiles and maturity
- Demand/supply profiles (scale 0.5–2.0) added to all 8 NATIONS entries in `data.js`
- **Renegotiation** updates route terms in-place and **preserves maturity**
- Active negotiations expire at end of turn if the final round is unused
- Trade Routes tab redesigned: shows active negotiation at top, route cards with nation name/categories/income/maturity
- Negotiation panel shown inline in the World map nation info panel
- Added shared CSS button utilities: `.btn`, `.btn-green`, `.btn-muted`, `.btn-sm`

### Removed
- `openTradeRoute()` action (replaced by negotiation flow)
- `TRADE_ROUTE_INCOME_MAX` constant (replaced by `TRADE_ROUTE_BASE_EXPORT` / `TRADE_ROUTE_BASE_IMPORT`)

---


### Added — Trade Negotiation System (Phase 3.3)
- **Multi-round trade negotiations** replace the old "Open Route" button
- Click any nation on the World map → "Negotiate Trade Deal" opens an inline negotiation panel
- Choose **export** and **import** goods categories: Raw Materials, Manufactured Goods, Financial Services
- Accept the current deal or **push for better terms** (uses extra rounds to improve deal quality)
- **Leverage** determines how strong your position is: `clamp(militaryLevel / nationMilitaryLevel × relations/50, 0.1, 3.0)`
- **Max rounds** = `ceil(relations/20)` — hostile nations grant 1 round; friendly nations up to 4–5
- **Deal quality** improves with leverage and patience: `clamp(0.4 + (leverage/3)×0.4 + (round−1)×0.1, 0.3, 1.2)`
- **Route income** = export income + import saving, both scaled by nation demand/supply profiles and maturity
- Demand/supply profiles (scale 0.5–2.0) added to all 8 NATIONS entries in `data.js`
- **Renegotiation** updates route terms in-place and **preserves maturity**
- Active negotiations expire at end of turn if the final round is unused
- Trade Routes tab redesigned: shows active negotiation at top, route cards with nation name/categories/income/maturity
- Negotiation panel shown inline in the World map nation info panel
- Added shared CSS button utilities: `.btn`, `.btn-green`, `.btn-muted`, `.btn-sm`

### Removed
- `openTradeRoute()` action (replaced by negotiation flow)
- `TRADE_ROUTE_INCOME_MAX` constant (replaced by `TRADE_ROUTE_BASE_EXPORT` / `TRADE_ROUTE_BASE_IMPORT`)

---

## [0.10.0] — 2026-05-05

### Added — World Map (Phase 3.2)
- New **World** dashboard tab with a zoomable, pannable SVG map of the continent
- 8 AI nations rendered as clickable coloured polygon regions
- Player empire subdivided into 4 provinces: **Arvenmoor**, **Caldrath**, **Thornhaven**, **Selmark**
- Capital dot markers and nation name labels on every region
- Click a nation to open an info panel showing GDP, Military, Relations, and border neighbours; click again to deselect
- Scroll to zoom (cursor-centred), drag to pan; viewport state persists between tab switches
- Drag vs. click distinguished by a 5 px movement threshold (drag never triggers nation selection)
- `MAP_REGIONS` constant added to `data.js` with polygon coordinates, colours, province definitions
- `adjacency` field added to all 8 NATIONS entries
- Module-level pan/zoom state in `render.js` (`_mapVB`, `_mapDrag`, `_mapSelectedNation`)

### Design
- Province data model designed for Phase 5.0: provinces have `development`, `infraLevel`, `deposit`, `owner`, `adjacency`; nation GDP/military will become emergent from province composition
- Phase 5.0 (EU4-style high-density province map redesign) added to roadmap
- Phase 5.5 conquest updated to territorial.io adjacency mechanic (province-by-province, adjacency-gated)
- Prospecting (Phase 3.5) clarified to operate on owned provinces, starting with the 4 starting provinces

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
