// ============================================================
// ACTIONS — game actions that mutate G and trigger re-renders
// ============================================================

function addLog(message, type) {
  G.eventLog.unshift({ message, type: type || 'info', year: G.year });
  if (G.eventLog.length > 30) G.eventLog.pop();
}

function setPolicyFunding(policyId, value) {
  const funding = Math.max(0, Math.min(20, parseInt(value, 10)));
  G.policyFunding[policyId] = funding;

  const cost = getEffectivePolicyCost(policyId);
  const allocated = getPolicyCost(policyId);

  // Update this card's cost label and active class
  const costEl = document.getElementById('pc-' + policyId);
  if (costEl) {
    costEl.textContent = cost > 0 ? '\u2212' + fmt(cost) + '/turn' : 'Inactive';
    costEl.className = 'policy-cost' + (cost > 0 ? '' : ' inactive');
  }
  const displayEl = document.getElementById('pd-' + policyId);
  if (displayEl) displayEl.textContent = funding + '% of income \u2014 ' + (allocated > 0 ? fmt(allocated) + '/turn allocated' : 'Inactive');

  // Toggle the card's active class so the slider thumb colour updates
  const cardEl = costEl && costEl.closest('.policy-card');
  if (cardEl) cardEl.classList.toggle('active', funding > 0);

  updateBudgetProjection();
  renderHeader();
  renderDashboard();
}

function setTaxRate(value) {
  G.taxRate = parseInt(value, 10) / 100;
  document.getElementById('tax-rate-display').textContent = value + '%';
  document.getElementById('tax-income-label').textContent = '+' + fmt(getTaxIncome()) + '/turn';
  updateBudgetProjection();
  renderHeader();
}

// ============================================================
// TRADE NEGOTIATION
// ============================================================

// Start a negotiation in drafting state.
function startTradeNegotiation(nationId) {
  if (!G.nations[nationId]) return;
  const existing = G.tradeRoutes.find(r => r.nationId === nationId);
  G.activeNegotiation = {
    nationId,
    status:          'drafting',
    pushCount:       0,
    threatenNext:    false,
    nationOffer:     null,
    isRenegotiation: !!existing,
  };
  renderAll();
}

function cancelTradeNegotiation() {
  G.activeNegotiation = null;
  renderAll();
}

function openNegotiationForNation(nationId) {
  startTradeNegotiation(nationId);
}

function openNegotiationFromRoute(nationId) {
  startTradeNegotiation(nationId);
}

// Send drafted offer — nation responds immediately.
function proposeTradeOffer() {
  if (!G.activeNegotiation || G.activeNegotiation.status !== 'drafting') return;
  const neg  = G.activeNegotiation;
  const name = NATIONS[neg.nationId].name;
  if (neg.threatenNext) {
    const relsCost = getPushRelationsCost(0, true);
    const threatNs = G.nations[neg.nationId];
    threatNs.relationsNegPenalty = Math.max(-100, threatNs.relationsNegPenalty - relsCost);
    threatNs.relations = computeNationRelations(neg.nationId);
    addLog('Trade offer sent to ' + name + ' with threat. Relations −' + relsCost + '.', 'warn');
  } else {
    addLog('Trade offer sent to ' + name + '.', 'info');
  }
  neg.status = 'awaiting';
  _processNegotiationResponse();
  renderAll();
}

// Push for better terms (from 'countered'). Applies relations cost immediately.
function pushTradeNegotiation(threaten) {
  if (!G.activeNegotiation || G.activeNegotiation.status !== 'countered') return;
  const neg = G.activeNegotiation;
  neg.pushCount++;
  neg.threatenNext = !!threaten;
  const relsCost = getPushRelationsCost(neg.pushCount, !!threaten);
  const pushNs = G.nations[neg.nationId];
  pushNs.relationsNegPenalty = Math.max(-100, pushNs.relationsNegPenalty - relsCost);
  pushNs.relations = computeNationRelations(neg.nationId);
  neg.status = 'awaiting';
  const name = NATIONS[neg.nationId].name;
  addLog(name + ': pushed terms' + (threaten ? ' with threat' : '') + '. Relations −' + relsCost + '.', 'warn');
  _processNegotiationResponse();
  renderAll();
}

// Toggle threaten flag (checkbox in UI).
function toggleNegotiationThreat() {
  if (!G.activeNegotiation) return;
  G.activeNegotiation.threatenNext = !G.activeNegotiation.threatenNext;
  renderAll();
}

// Accept the nation's counter offer and create or update the trade route.
function acceptNationCounter() {
  if (!G.activeNegotiation || !G.activeNegotiation.nationOffer) return;
  const neg = G.activeNegotiation;
  _finaliseTradeRoute(neg.nationId, neg.nationOffer, neg.isRenegotiation);
  G.activeNegotiation = null;
  renderAll();
}

// Reject counter — go back to drafting so player can review nation profile before re-proposing.
function rejectNationCounter() {
  if (!G.activeNegotiation) return;
  G.activeNegotiation.status    = 'drafting';
  G.activeNegotiation.nationOffer = null;
  renderAll();
}

// Shared: create or update a trade route from finalised terms.
function _finaliseTradeRoute(nationId, offer, isRenegotiation) {
  const { exportQuality, importQuality } = offer;
  if (isRenegotiation) {
    const route = G.tradeRoutes.find(r => r.nationId === nationId);
    if (route) {
      route.exportQuality = exportQuality;
      route.importQuality = importQuality;
    }
    addLog('Trade deal with ' + NATIONS[nationId].name + ' renegotiated (export quality ' + (exportQuality * 100).toFixed(0) + '%, import price ' + (importQuality * 100).toFixed(0) + '%).', 'good');
    showNotification('🤝 Trade deal renegotiated with ' + NATIONS[nationId].name + '!', 'good');
  } else {
    G.tradeRoutes.push({
      id:           G.nextTradeRouteId++,
      nationId,
      exportQuality,
      importQuality,
      maturity:     0,
    });
    const firstContactNs = G.nations[nationId];
    if (firstContactNs) {
      if (!firstContactNs.relationsFirstContact) {
        firstContactNs.relationsFirstContact = true;
        addLog('First contact with ' + NATIONS[nationId].name + ' established — relations +5 (permanent).', 'good');
      }
      firstContactNs.relations = computeNationRelations(nationId);
    }
    addLog('Trade route opened with ' + NATIONS[nationId].name + ' (export quality ' + (exportQuality * 100).toFixed(0) + '%, import price ' + (importQuality * 100).toFixed(0) + '%).', 'good');
    showNotification('🚢 Trade route opened with ' + NATIONS[nationId].name + '!', 'good');
  }
}

// Called during endTurn when activeNegotiation.status === 'awaiting'.
function _processNegotiationResponse() {
  const neg = G.activeNegotiation;
  if (!neg) return;
  const name = NATIONS[neg.nationId].name;

  // Check straight-accept (only after at least one push)
  if (neg.pushCount >= 1) {
    const acceptChance = getStraightAcceptChance(neg.nationId, neg.pushCount);
    if (Math.random() < acceptChance) {
      const offer = getNationCounterOffer(neg.nationId, neg.pushCount, neg.threatenNext);
      _finaliseTradeRoute(neg.nationId, offer, neg.isRenegotiation);
      addLog(name + ' accepted your trade terms outright!', 'good');
      showNotification('🎉 ' + name + ' accepted your terms!', 'good');
      G.activeNegotiation = null;
      return;
    }
  }

  // Check collapse (after at least one push, or if the initial offer included a threat)
  if (neg.pushCount >= 1 || neg.threatenNext) {
    const collapseRisk = getPushCollapseRisk(neg.nationId, neg.pushCount, neg.threatenNext);
    if (Math.random() < collapseRisk) {
      const collapseNs = G.nations[neg.nationId];
      collapseNs.relationsNegPenalty = Math.max(-100, collapseNs.relationsNegPenalty - 5);
      collapseNs.relationsBrokenRoutes.push({ turn: G.turn });
      collapseNs.relations = computeNationRelations(neg.nationId);
      addLog('Trade negotiations with ' + name + ' collapsed after ' + neg.pushCount + ' push' + (neg.pushCount !== 1 ? 'es' : '') + '. Relations −5.', 'bad');
      showNotification('💔 Negotiations with ' + name + ' collapsed!', 'bad');
      G.activeNegotiation = null;
      return;
    }
  }

  // Generate counter offer
  const offer = getNationCounterOffer(neg.nationId, neg.pushCount, neg.threatenNext);
  neg.nationOffer  = offer;
  neg.status       = 'countered';
  neg.threatenNext = false;
  addLog(name + ' counter-offered: export quality ' + (offer.exportQuality * 100).toFixed(0) + '%, import price ' + (offer.importQuality * 100).toFixed(0) + '%.', 'info');
  showNotification('💬 ' + name + ' made a counter-offer!', 'info');
}

function closeTradeRoute(routeId) {
  const idx = G.tradeRoutes.findIndex(r => r.id === routeId);
  if (idx === -1) return;
  const route = G.tradeRoutes[idx];
  const nationName = route.nationId && NATIONS[route.nationId] ? NATIONS[route.nationId].name : 'unknown';
  G.tradeRoutes.splice(idx, 1);
  // Cancel any active negotiation with this nation too
  if (G.activeNegotiation && G.activeNegotiation.nationId === route.nationId) {
    G.activeNegotiation = null;
  }
  // Register broken-route penalty — damages relations until it decays
  const closedRouteNs = G.nations[route.nationId];
  if (closedRouteNs) {
    closedRouteNs.relationsBrokenRoutes.push({ turn: G.turn });
    closedRouteNs.relations = computeNationRelations(route.nationId);
  }
  addLog('Trade route with ' + nationName + ' closed. Relations damaged.', 'warn');
  showNotification('Trade route with ' + nationName + ' closed.', 'info');
  renderAll();
}

// Resource Deposit actions (Phase 3.5) =====================================================

// Set how much to spend per turn on the active deposit development ($M/turn).
function setDepositDevelopmentFunding(amountStr) {
  G.depositDevelopment.funding = Math.max(0, parseFloat(amountStr) || 0);
  renderAll();
}

// Assign a deposit to receive development funding.
// Starts the appropriate phase transition based on current status.
function assignDepositDevelopment(depositId) {
  const dep = G.deposits.find(d => d.id === depositId);
  if (!dep) return;
  if (dep.status === 'anomaly') {
    dep.status = 'surveying';
  } else if (dep.status === 'producing') {
    if (!canUpgradeDeposit(dep)) {
      showNotification('Research a deposit upgrade tech first.', 'error');
      return;
    }
    dep.status = 'upgrading';
  } else if (dep.status === 'surveying' || dep.status === 'commissioning' || dep.status === 'upgrading') {
    // Resuming an in-progress phase — just redirect funding
  } else {
    return;
  }
  G.depositDevelopment.activeDepositId = depositId;
  renderAll();
}

// Cancel an upgrade attempt, restoring production (loses all progress).
function cancelDepositUpgrade(depositId) {
  const dep = G.deposits.find(d => d.id === depositId);
  if (!dep || dep.status !== 'upgrading') return;
  dep.status = 'producing';
  dep.developProgress = 0;
  if (G.depositDevelopment.activeDepositId === depositId) {
    G.depositDevelopment.activeDepositId = null;
  }
  addLog('\u26cf\ufe0f Upgrade attempt cancelled. Progress lost.', 'warn');
  renderAll();
}

// Absorb a fully-developed deposit into the national industry pool and remove it from active list.
function _poolDeposit(dep) {
  const resType      = dep.resourceType;
  const output       = DEPOSIT_TIER_OUTPUT[dep.currentTier] || 0;
  const provinceName = dep.regionId && PROVINCES[dep.regionId]
    ? PROVINCES[dep.regionId].name
    : '';
  if (!G.establishedIndustries[resType]) {
    G.establishedIndustries[resType] = { sites: 0, totalOutput: 0 };
  }
  G.establishedIndustries[resType].sites       += 1;
  G.establishedIndustries[resType].totalOutput += output;
  G.deposits = G.deposits.filter(d => d.id !== dep.id);
  G.depositDevelopment.activeDepositId = null;
  addLog('\u2699\ufe0f ' + RESOURCE_TYPES[resType].name + ' mine (' + dep.currentTier
    + (provinceName ? ', ' + provinceName : '')
    + ') fully established — absorbed into national industry. +'
    + output + ' Mt/yr (permanent). Province slot freed.', 'good');
  showNotification('\u2699\ufe0f ' + RESOURCE_TYPES[resType].name + ' mine fully established!', 'good');
}

// Internal: called when deposit development progress reaches 100%.
function _completeDepositStep(dep) {
  const TIER_ORDER = ['occurrence', 'vein', 'deposit', 'reserve', 'majorReserve'];

  if (dep.status === 'surveying') {
    // Survey complete — reveal resource type, enter commissioning at occurrence level
    const availTypes = getAvailableResourceTypes();
    dep.resourceType    = availTypes.length > 0
      ? availTypes[Math.floor(Math.random() * availTypes.length)]
      : 'iron'; // fallback if no types unlocked
    dep.currentTier     = 'occurrence';
    dep.status          = 'commissioning';
    dep.developProgress = 0;
    // Keep activeDepositId so funding continues into commissioning
    addLog('\u26cf\ufe0f Survey complete: ' + RESOURCE_TYPES[dep.resourceType].name
      + ' occurrence identified. Now commissioning the mine (\u2212$'
      + DEPOSIT_COMMISSION_COST.occurrence + 'M).', 'good');
    showNotification('\u26cf\ufe0f ' + RESOURCE_TYPES[dep.resourceType].name + ' occurrence found — commissioning…', 'good');

  } else if (dep.status === 'commissioning') {
    // Commissioning complete — mine is now producing. If at max tier, pool it.
    dep.developProgress = 0;
    G.depositDevelopment.activeDepositId = null;
    if (dep.currentTier === dep.maxTier) {
      _poolDeposit(dep); // also logs
    } else {
      dep.status = 'producing';
      addLog('\u26cf\ufe0f ' + RESOURCE_TYPES[dep.resourceType].name + ' mine commissioned ('
        + dep.currentTier + '). Now producing ' + DEPOSIT_TIER_OUTPUT[dep.currentTier] + ' Mt/yr.', 'good');
      showNotification('\u2713 ' + RESOURCE_TYPES[dep.resourceType].name + ' mine online — '
        + DEPOSIT_TIER_OUTPUT[dep.currentTier] + ' Mt/yr.', 'good');
    }

  } else if (dep.status === 'upgrading') {
    G.depositDevelopment.activeDepositId = null;
    const atMax   = dep.currentTier === dep.maxTier;
    const success = !atMax && Math.random() < DEPOSIT_UPGRADE_SUCCESS;

    if (atMax) {
      // Deposit is already at its geological max — reveal and pool
      dep.status          = 'commissioning';
      dep.developProgress = 0;
      addLog('\u26cf\ufe0f Expansion surveys complete: this ' + RESOURCE_TYPES[dep.resourceType].name
        + ' deposit has reached its full geological potential. Finalising…', 'info');
      // Let commissioning completion handle pooling
    } else if (success) {
      const nextTier = TIER_ORDER[TIER_ORDER.indexOf(dep.currentTier) + 1];
      dep.currentTier     = nextTier;
      dep.status          = 'commissioning';
      dep.developProgress = 0;
      addLog('\u26cf\ufe0f Upgrade successful: ' + RESOURCE_TYPES[dep.resourceType].name
        + ' deposit expanded to ' + nextTier + '. Commissioning new infrastructure (\u2212$'
        + DEPOSIT_COMMISSION_COST[nextTier] + 'M)…', 'good');
      showNotification('\u2191 ' + RESOURCE_TYPES[dep.resourceType].name + ' expanded to '
        + nextTier + ' — commissioning…', 'good');
    } else {
      // Failure — store 5% partial progress, resume production
      dep.status          = 'producing';
      dep.developProgress = 5;
      addLog('\u26cf\ufe0f Upgrade attempt failed. Partial surveys stored (5%). Retry to continue.', 'warn');
      showNotification('\u26cf\ufe0f Upgrade failed — retry at 5% progress.', 'warn');
    }
  }
}

function setActiveResearch(techId) {
  const tech = TECHNOLOGIES[techId];
  if (G.unlockedTechs.includes(techId)) return;
  const missingReqs = tech.requires.filter(r => !G.unlockedTechs.includes(r));
  if (missingReqs.length > 0) {
    showNotification('Prerequisite not met: ' + missingReqs.map(r => TECHNOLOGIES[r].name).join(', '), 'error');
    return;
  }
  if (G.researchLevel <= 0) {
    showNotification('Set Research policy funding above 0 first!', 'error');
    return;
  }
  if (G.activeResearch === techId) {
    G.activeResearch = null;
    G.researchProgress = 0;
    showNotification('Research cancelled.', 'info');
  } else {
    G.activeResearch = techId;
    G.researchProgress = 0;
    addLog('Started researching: ' + tech.name, 'info');
    showNotification('🔬 Researching: ' + tech.name, 'good');
  }
  renderAll();
}

function setProjectFunding(projectId, amountStr) {
  const amount = Math.max(0, parseInt(amountStr, 10) || 0);
  if (G.completedProjects.includes(projectId)) return;

  // Only 1 infrastructure megaproject may be funded at a time.
  // If funding a new infra project, cancel all other active infra projects first.
  if (amount > 0 && PROJECTS[projectId].category === 'infrastructure') {
    for (const id of Object.keys(G.projectFunding)) {
      if (id !== projectId && PROJECTS[id] && PROJECTS[id].category === 'infrastructure') {
        delete G.projectFunding[id];
      }
    }
  }

  if (amount === 0) {
    delete G.projectFunding[projectId];
  } else {
    G.projectFunding[projectId] = amount;
  }
  updateBudgetProjection();
  renderHeader();
  renderDashboard();
}

// ============================================================
// DIPLOMACY ACTIONS — Phase 4.4
// ============================================================

function proposeAlliance(nationId) {
  const ns  = G.nations[nationId];
  const def = NATIONS[nationId];
  if (!G.unlockedTechs.includes('strategicAlliances')) {
    showNotification('Requires Strategic Alliances technology.', 'warn');
    return;
  }
  if (ns.relations < ALLIANCE_MIN_PROPOSE_REL) {
    showNotification(`Relations must be at least ${ALLIANCE_MIN_PROPOSE_REL} (mid-Friendly) to propose an alliance.`, 'warn');
    return;
  }
  if (G.diplomaticDeals.find(d => d.type === 'alliance' && d.nationId === nationId)) {
    showNotification(`Already allied with ${def.name}.`, 'warn');
    return;
  }
  if (ns.relations >= ALLIANCE_ACCEPT_REL) {
    G.diplomaticDeals.push({ type: 'alliance', nationId, turnsLeft: null });
    ns.relations = computeNationRelations(nationId);
    addLog(`${def.name} accepted your Alliance proposal.`, 'success');
    showNotification(`Alliance formed with ${def.name}!`, 'success');
  } else {
    ns.relationsNegPenalty = Math.max(-50, ns.relationsNegPenalty - 3);
    ns.relations = computeNationRelations(nationId);
    addLog(`${def.name} declined your Alliance proposal.`, 'warn');
    showNotification(`${def.name} declined the alliance proposal.`, 'warn');
  }
  renderAll();
}

function proposeNap(nationId) {
  const ns  = G.nations[nationId];
  const def = NATIONS[nationId];
  if (!G.unlockedTechs.includes('diplomacyCorps')) {
    showNotification('Requires Diplomacy Corps technology.', 'warn');
    return;
  }
  if (ns.relations < NAP_MIN_PROPOSE_REL) {
    showNotification('Relations must be Neutral or better to propose a Non-Aggression Pact.', 'warn');
    return;
  }
  if (G.diplomaticDeals.find(d => (d.type === 'nap' || d.type === 'alliance') && d.nationId === nationId)) {
    showNotification('An existing pact or alliance is already active with this nation.', 'warn');
    return;
  }
  if (ns.relations >= NAP_ACCEPT_REL) {
    G.diplomaticDeals.push({ type: 'nap', nationId, turnsLeft: NAP_DURATION });
    addLog(`${def.name} agreed to a Non-Aggression Pact (${NAP_DURATION} turns).`, 'success');
    showNotification(`Non-Aggression Pact signed with ${def.name}!`, 'success');
  } else {
    addLog(`${def.name} declined your Non-Aggression Pact proposal.`, 'warn');
    showNotification(`${def.name} declined the NAP proposal.`, 'warn');
  }
  renderAll();
}

function breakAlliance(nationId) {
  const idx = G.diplomaticDeals.findIndex(d => d.type === 'alliance' && d.nationId === nationId);
  if (idx === -1) return;
  G.diplomaticDeals.splice(idx, 1);
  const ns  = G.nations[nationId];
  const def = NATIONS[nationId];
  ns.relationsNegPenalty = Math.max(-100, ns.relationsNegPenalty + ALLIANCE_BREAK_PENALTY);
  ns.relations = computeNationRelations(nationId);
  addLog(`Alliance with ${def.name} dissolved. Relations damaged.`, 'warn');
  showNotification(`Alliance with ${def.name} dissolved.`, 'warn');
  renderAll();
}

function endTurn() {

  // 1. Grow GDP per-capita (productivity growth). Total GDP = population × gdpPerCapita / 1000.
  const growth = getEffectiveGrowthRate();
  G.gdpPerCapita = G.gdpPerCapita * (1 + growth);
  G.gdp = G.population * G.gdpPerCapita / 1000;

  // 1.3. Update economic sector levels (Mining, Manufacturing, Commerce, Finance, Logistics)
  // Each sector grows with spending and decays 1 level/turn without it.
  // Industrial sectors (mining, manufacturing) use industrialGrowthMult/industrialDecayMult from tech.
  // Locked policies (requiresTech not yet researched) are skipped.
  {
    const te = getTechEffects();
    for (const sector of ['mining', 'manufacturing', 'logistics', 'prospecting', 'commerce', 'finance']) {
      const levelKey = sector + 'Level';
      const policyDef = POLICIES[sector];
      const isLocked = policyDef && policyDef.requiresTech && !G.unlockedTechs.includes(policyDef.requiresTech);
      if (isLocked) {
        // Decay still applies if level was somehow set from a previous run
        if (G[levelKey] > 0) G[levelKey] = Math.max(0, G[levelKey] - SECTOR_DECAY);
        continue;
      }
      const isIndustrial = (sector === 'mining' || sector === 'manufacturing');
      const growMult  = isIndustrial ? te.industrialGrowthMult  : 1.0;
      const decayMult = isIndustrial ? te.industrialDecayMult   : 1.0;
      if (G.policyFunding[sector] > 0) {
        const spend    = getTaxIncome() * (G.policyFunding[sector] / 100);
        const growRate = SECTOR_GROW_PER_M / (1 + SECTOR_GROW_HARDNESS * G[levelKey]) * growMult;
        const net      = spend * growRate - SECTOR_DECAY * decayMult;
        G[levelKey]    = Math.min(100, Math.max(0, G[levelKey] + net));
      } else if (G[levelKey] > 0) {
        G[levelKey] = Math.max(0, G[levelKey] - SECTOR_DECAY * decayMult);
      }
    }
  }

  // Manufacturing import cost: if Manufacturing level exceeds Mining, raw materials must be imported.
  // Logistics level reduces this penalty by up to 100%.
  if (G.manufacturingLevel > G.miningLevel) {
    const logisticsReduction = Math.min(1.0, G.logisticsLevel / 100);
    const rawCost = (G.manufacturingLevel - G.miningLevel) * MANUFACTURING_IMPORT_COST_PER_LEVEL;
    const manufacturingImportCost = rawCost * (1 - logisticsReduction);
    if (manufacturingImportCost > 0) {
      G.treasury -= manufacturingImportCost;
      const logLabel = logisticsReduction > 0 ? ' (' + Math.round(logisticsReduction * 100) + '% mitigated by Logistics)' : '';
      addLog('Manufacturing import cost: −' + fmt(manufacturingImportCost) + ' (Mining gap: ' + Math.round(G.manufacturingLevel - G.miningLevel) + ' levels)' + logLabel, 'bad');
    }
  }

  // 1.3b. Installation maintenance — flat per-turn cost for all built installations
  {
    const maintCost = getTotalInstallationMaintenance();
    if (maintCost > 0) {
      G.treasury -= maintCost;
      addLog('Installation maintenance: −' + fmt(maintCost) + ' (' + G.installations.length + ' installation' + (G.installations.length !== 1 ? 's' : '') + ')', 'bad');
    }
  }

  // 1.4. Update infrastructure level
  {
    const te = getTechEffects();
    const pe = getProjectEffects();
    const decay = getTaxIncome() * INFRA_MAINTAIN_FRAC / (1 + INFRA_REPAIR_HARDNESS * G.infraLevel) * te.infraDecayMult * pe.infraDecayMult;
    if (G.policyFunding.infrastructure > 0) {
      const repairSpend = getTaxIncome() * (G.policyFunding.infrastructure / 100);
      const repairRate = INFRA_REPAIR_PER_M / (1 + INFRA_REPAIR_HARDNESS * G.infraLevel) * te.infraGrowthMult;
      const net = repairSpend * repairRate - decay;
      G.infraLevel = Math.min(100, Math.max(0, G.infraLevel + net));
    } else if (G.infraLevel > 0) {
      G.infraLevel = Math.max(0, G.infraLevel - decay);
    }
  }

  // 1.5. Update social sector levels (Healthcare, Education) — same growth model as economic
  // sectors but slower decay (SOCIAL_SECTOR_DECAY). Spend uses population-scaled cost since
  // larger populations require proportionally more healthcare/education investment.
  for (const policyId of ['healthcare', 'education']) {
    const levelKey = policyId + 'Level';
    if (G.policyFunding[policyId] > 0) {
      const spend    = getPolicyCost(policyId);
      const growRate = SECTOR_GROW_PER_M / (1 + SECTOR_GROW_HARDNESS * G[levelKey]);
      const net      = spend * growRate - SOCIAL_SECTOR_DECAY;
      G[levelKey] = Math.min(100, Math.max(0, G[levelKey] + net));
    } else if (G[levelKey] > 0) {
      G[levelKey] = Math.max(0, G[levelKey] - SOCIAL_SECTOR_DECAY);
    }
  }

  // 1.6. Update military branch levels (Army, Navy, Air Force).
  // Each branch requires its respective tech; locked branches still decay.
  {
    for (const branchId of ['army', 'navy', 'airForce']) {
      const levelKey  = branchId + 'Level';
      const policyDef = POLICIES[branchId];
      const isLocked  = policyDef && policyDef.requiresTech && !G.unlockedTechs.includes(policyDef.requiresTech);
      if (isLocked) {
        if (G[levelKey] > 0) G[levelKey] = Math.max(0, G[levelKey] - SECTOR_DECAY);
        continue;
      }
      const spend = (G.policyFunding[branchId] || 0) > 0
        ? getTaxIncome() * (G.policyFunding[branchId] / 100) : 0;
      if (spend > 0) {
        const growRate = SECTOR_GROW_PER_M / (1 + SECTOR_GROW_HARDNESS * G[levelKey]);
        const net      = spend * growRate - SECTOR_DECAY;
        G[levelKey]    = Math.min(100, Math.max(0, G[levelKey] + net));
      } else if (G[levelKey] > 0) {
        G[levelKey] = Math.max(0, G[levelKey] - SECTOR_DECAY);
      }
    }
  }

  // 1.7. Research level — same growth model as social sectors, capped at getResearchCapacityCeiling()
  {
    const ceiling = getResearchCapacityCeiling();
    if (G.policyFunding.research > 0) {
      const spend    = getPolicyCost('research');
      const growRate = SECTOR_GROW_PER_M / (1 + SECTOR_GROW_HARDNESS * G.researchLevel);
      const net      = spend * growRate - SOCIAL_SECTOR_DECAY;
      G.researchLevel = Math.min(ceiling, Math.max(0, G.researchLevel + net));
    } else if (G.researchLevel > 0) {
      G.researchLevel = Math.max(0, G.researchLevel - SOCIAL_SECTOR_DECAY);
    }
  }

  // 1.8. Project progress — direct treasury investment per active project
  for (const [projId, amount] of Object.entries(G.projectFunding)) {
    if (amount <= 0 || G.completedProjects.includes(projId)) continue;
    if (!G.projectProgress[projId]) G.projectProgress[projId] = 0;
    G.treasury -= amount;
    G.projectProgress[projId] += amount;
    const proj = PROJECTS[projId];
    if (G.projectProgress[projId] >= proj.cost) {
      G.completedProjects.push(projId);
      delete G.projectFunding[projId];
      addLog('Project complete: ' + proj.name + ' — ' + proj.effects.effectDesc, 'good');
      showNotification('✓ ' + proj.name + ' complete!', 'good');
    }
  }

  // 2. Apply net income (using grown GDP — same value the UI shows)
  const net = getNetIncome();
  G.treasury += net;

  // 2.4. Trade route income — maturity ramps over TRADE_ROUTE_MATURITY_TURNS
  if (G.tradeRoutes.length > 0) {
    let routeIncome = 0;
    for (const route of G.tradeRoutes) {
      route.maturity++;
      routeIncome += getTradeRouteIncome(route);
    }
    G.treasury += routeIncome;
    if (routeIncome > 0) addLog('Trade route income: +' + fmt(routeIncome) + ' (' + G.tradeRoutes.length + ' route' + (G.tradeRoutes.length !== 1 ? 's' : '') + ')', 'good');
  }

  // 2.4b. Active negotiation — safety fallback (responses are now instant; this should not fire)
  // if (G.activeNegotiation?.status === 'awaiting') { _processNegotiationResponse(); }

  // 2.5. Apply scaling interest on treasury
  const interestRate = G.treasury < 0 ? getDebtInterestRate() : getSavingsInterestRate();
  const interest = G.treasury * interestRate;
  G.treasury += interest;
  if (interest !== 0) {
    const ratePct = (interestRate * 100).toFixed(2) + '%';
    const prevTreasury = G.treasury - interest;
    addLog(
      prevTreasury < 0
        ? 'Debt interest: ' + fmt(interest) + ' (' + ratePct + ' on ' + fmt(prevTreasury) + ' debt)'
        : 'Savings interest: +' + fmt(interest) + ' (' + ratePct + ' on ' + fmt(prevTreasury) + ' savings)',
      interest < 0 ? 'bad' : 'good'
    );
  }

  // 4. Research progress
  if (G.activeResearch && G.researchLevel > 0) {
    G.researchProgress += getRpPerTurn();
    const activeTech = TECHNOLOGIES[G.activeResearch];
    if (G.researchProgress >= getTechCost(G.activeResearch)) {
      G.unlockedTechs.push(G.activeResearch);
      addLog('Research complete: ' + activeTech.name + ' — ' + activeTech.effects.effectDesc, 'good');
      showNotification('✓ ' + activeTech.name + ' research complete!', 'good');
      // Process unlocks
      if (activeTech.unlocks) {
        if (activeTech.unlocks.resources) {
          for (const r of activeTech.unlocks.resources) {
            if (!G.unlockedResources.includes(r)) {
              G.unlockedResources.push(r);
            }
          }
        }
        if (activeTech.unlocks.policies) {
          for (const p of activeTech.unlocks.policies) {
            if (POLICIES[p]) addLog('🔓 Policy unlocked: ' + POLICIES[p].name, 'good');
          }
        }
      }
      G.activeResearch = null;
      G.researchProgress = 0;
    }
  }

  // 4.5. Prospect roll — fires when prospectingLevel > 0
  // getProspectChance() returns 0 if all province slots are full
  if (G.prospectingLevel > 0) {
    const freeProvinces = getFreeSlotProvinces();
    if (freeProvinces.length > 0) {
      const chance = getProspectChance();
      if (Math.random() < chance) {
        // Assign to a random province that still has a free slot
        const provinceId = freeProvinces[Math.floor(Math.random() * freeProvinces.length)];
        const provinceName = PROVINCES[provinceId]?.name ?? provinceId;
        // Pick a random max tier using weighted distribution
        const tiers = ['occurrence', 'vein', 'deposit', 'reserve', 'majorReserve'];
        const weights = DEPOSIT_MAX_TIER_WEIGHTS;
        const totalW = weights.reduce((s, w) => s + w, 0);
        let roll = Math.random() * totalW;
        let maxTier = tiers[tiers.length - 1];
        for (let i = 0; i < weights.length; i++) {
          roll -= weights[i];
          if (roll <= 0) { maxTier = tiers[i]; break; }
        }
        const anomalyId = 'dep_' + G.turn + '_' + Math.floor(Math.random() * 9999);
        G.deposits.push({
          id: anomalyId,
          regionId: provinceId,
          resourceType: null,
          currentTier: null,
          maxTier,
          status: 'anomaly',
          developProgress: 0,
        });
        addLog('\u26cf\ufe0f Geological anomaly detected in ' + provinceName + '. Assign Development funding to begin a survey.', 'good');
        showNotification('\u26cf\ufe0f Anomaly in ' + provinceName + ' \u2014 assign development to survey!', 'good');
      }
    }
  }

  // 4.6. Deposit development — fund the active deposit, decay unfunded in-progress deposits
  {
    const activeId = G.depositDevelopment.activeDepositId;
    const funding  = G.depositDevelopment.funding;
    if (activeId && funding > 0) {
      const dep = G.deposits.find(d => d.id === activeId);
      if (dep && dep.status !== 'producing') {
        const cost = getDepositDevelopCost(dep);
        if (cost > 0) {
          const remaining = cost * (1 - dep.developProgress / 100);
          const spent     = Math.min(funding, remaining);
          G.treasury     -= spent;
          dep.developProgress = Math.min(100, dep.developProgress + (spent / cost) * 100);
          if (dep.developProgress >= 100) {
            _completeDepositStep(dep);
          }
        }
      }
    }
    // Decay progress on in-progress deposits that are not actively funded
    for (const dep of G.deposits) {
      if ((dep.status === 'surveying' || dep.status === 'commissioning' || dep.status === 'upgrading')
          && dep.id !== activeId) {
        dep.developProgress = Math.max(0, dep.developProgress - DEPOSIT_PROGRESS_DECAY);
      }
    }
  }

  // 6. Advance time
  G.year++;
  G.turn++;

  // 7. Update happiness pool: converges toward calcHappinessTarget() at 5%/turn, capped at HAPPINESS_DRIFT_CAP
  const happinessTarget = calcHappinessTarget();
  const happinessDelta = Math.max(-HAPPINESS_DRIFT_CAP, Math.min(HAPPINESS_DRIFT_CAP,
    (happinessTarget - G.happiness) * 0.05));
  G.happiness = Math.max(0, Math.min(100, G.happiness + happinessDelta));

  // 7.5. Population growth (uses final happiness from this turn, before logging)
  const popGrowthRate = getPopulationGrowthRate();
  G.population = G.population * (1 + popGrowthRate);
  G.gdp = G.population * G.gdpPerCapita / 1000;

  // 8. Log turn summary
  const happiness = G.happiness;
  addLog(
    'Year ' + G.year + ' — Net: ' + (net >= 0 ? '+' : '') + fmt(net) +
    ' | GDP: $' + G.gdp.toFixed(2) + 'B | Happiness: ' + Math.round(happiness) + '%',
    net < 0 ? 'bad' : 'info'
  );

  // 9. Record history snapshot (keep last 50 turns)
  G.history.push({
    year:            G.year,
    turn:            G.turn,
    treasury:        G.treasury,
    gdp:             G.gdp,
    gdpPerCapita:    G.gdpPerCapita,
    population:      G.population,
    populationCap:   getPopulationCap(),
    netIncome:       net,
    taxIncome:       getTaxIncome(),
    totalExpenses:   getTotalExpenses(),
    happiness:       G.happiness,
    infraLevel:      G.infraLevel,
    miningLevel:         G.miningLevel,
    manufacturingLevel:  G.manufacturingLevel,
    commerceLevel:       G.commerceLevel,
    financeLevel:    G.financeLevel,
    healthcareLevel: G.healthcareLevel,
    educationLevel:  G.educationLevel,
    armyLevel:       G.armyLevel,
    navyLevel:       G.navyLevel,
    airForceLevel:   G.airForceLevel,
    deterrenceRating: getDeterrenceRating(),
    researchLevel:   G.researchLevel,
    tradeRoutes:     G.tradeRoutes.length,
    militaryStrength: getMilitaryStrength(),
    activeResearch:  G.activeResearch,
    unlockedTechs:   G.unlockedTechs.length,
  });
  if (G.history.length > 50) G.history.shift();

  // 10. Tick AI nations — GDP growth, military drift, relations recompute
  for (const [id, nation] of Object.entries(G.nations)) {
    const def = NATIONS[id];
    nation.gdp           *= (1 + def.gdpGrowthRate);
    nation.militaryLevel += NATION_MILITARY_DRIFT_RATE * (def.militaryLevel - nation.militaryLevel);
    nation.militaryLevel  = Math.max(0, Math.min(100, nation.militaryLevel));
    // Relations: recover neg penalty, expire broken route events, update streak, recompute
    nation.relationsNegPenalty   = Math.min(0, nation.relationsNegPenalty + NATION_RELATIONS_NEG_PENALTY_RECOVERY);
    nation.relationsBrokenRoutes = nation.relationsBrokenRoutes.filter(ev => G.turn - ev.turn < NATION_RELATIONS_BROKEN_ROUTE_TURNS);
    nation.relationsStreak       = G.tradeRoutes.some(r => r.nationId === id) ? nation.relationsStreak + 1 : 0;
    nation.relations             = computeNationRelations(id);
  }

  // 11. Tick diplomatic deals — expire NAPs
  G.diplomaticDeals = G.diplomaticDeals.filter(deal => {
    if (deal.turnsLeft === null) return true; // alliances are permanent until broken
    deal.turnsLeft--;
    if (deal.turnsLeft <= 0) {
      addLog(`Non-Aggression Pact with ${NATIONS[deal.nationId].name} has expired.`, 'info');
      return false;
    }
    return true;
  });

  renderAll();
}

function buildInstallation(type, provinceId) {
  const province = PROVINCES[provinceId];
  if (!province || province.nationId !== 'player') return;
  const def = INSTALLATION_TYPES[type];
  if (!def) return;
  if (def.requiresCoastal && !province.coastal) return;
  const cost = getInstallationBuildCost(type, provinceId);
  if (G.treasury < cost) {
    showNotification('Not enough treasury — need ' + fmt(cost) + 'M to build ' + def.name, 'bad');
    return;
  }
  G.treasury -= cost;
  G.installations.push({ type, provinceId });
  addLog('Built ' + def.icon + ' ' + def.name + ' in ' + province.name + ': −' + fmt(cost) + ' (maintenance: −' + fmt(def.maintenance) + '/turn)', 'neutral');
  renderAll();
}
