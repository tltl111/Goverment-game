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
      seaZone:      NATIONS[nationId]?.seaZone || null,
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

// ============================================================
// TECH QUEUE (Phase 5.7d)
// ============================================================

// Internal: start the next valid tech from the queue.
function _startNextQueuedTech() {
  while (G.techQueue.length > 0) {
    const nextId = G.techQueue.shift();
    const tech = TECHNOLOGIES[nextId];
    if (!tech || G.unlockedTechs.includes(nextId)) continue;
    const prereqsMet = tech.requires.every(r => G.unlockedTechs.includes(r));
    if (!prereqsMet) {
      addLog('⚠️ Skipped queued tech "' + tech.name + '" — prerequisites not yet met.', 'warn');
      continue;
    }
    G.activeResearch = nextId;
    G.researchProgress = 0;
    addLog('🔬 Started researching (queue): ' + tech.name, 'info');
    showNotification('🔬 Researching: ' + tech.name, 'good');
    return;
  }
}

// Add a tech to the research queue. If nothing is active, starts it immediately.
function enqueueTech(techId) {
  const tech = TECHNOLOGIES[techId];
  if (!tech) return;
  if (G.unlockedTechs.includes(techId)) return;
  if (G.activeResearch === techId) return;
  if (G.researchLevel <= 0) {
    showNotification('Fund Research policy first!', 'error');
    return;
  }
  // Toggle off if already queued
  if (G.techQueue.includes(techId)) {
    G.techQueue = G.techQueue.filter(id => id !== techId);
    showNotification('Removed from queue: ' + tech.name, 'info');
    renderAll();
    return;
  }
  G.techQueue.push(techId);
  // If nothing is active, immediately pull from queue
  if (!G.activeResearch) {
    _startNextQueuedTech();
  }
  showNotification('⏳ Queued: ' + tech.name, 'info');
  renderAll();
}

// Remove a tech from the queue by ID.
function dequeueTech(techId) {
  G.techQueue = G.techQueue.filter(id => id !== techId);
  renderAll();
}

// Move a queued tech one step earlier in the queue.
function moveQueueUp(techId) {
  const idx = G.techQueue.indexOf(techId);
  if (idx <= 0) return;
  [G.techQueue[idx - 1], G.techQueue[idx]] = [G.techQueue[idx], G.techQueue[idx - 1]];
  renderAll();
}

// Move a queued tech one step later in the queue.
function moveQueueDown(techId) {
  const idx = G.techQueue.indexOf(techId);
  if (idx < 0 || idx >= G.techQueue.length - 1) return;
  [G.techQueue[idx + 1], G.techQueue[idx]] = [G.techQueue[idx], G.techQueue[idx + 1]];
  renderAll();
}

// Cancel the currently active research (does not clear the rest of the queue).
function cancelResearch() {
  if (!G.activeResearch) return;
  const name = TECHNOLOGIES[G.activeResearch]?.name || G.activeResearch;
  G.activeResearch = null;
  G.researchProgress = 0;
  showNotification('Research cancelled: ' + name, 'info');
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

// ============================================================
// COMMANDER MANAGEMENT (Phase 5.4)
// ============================================================

function addCommander(name, branch) {
  if (!name || !name.trim()) return;
  const defaultMissions = { navy: 'tradeProtection', army: null, airForce: 'airSuperiority' };
  const firstSeaZone  = Object.keys(SEA_PROVINCES)[0] || null;
  const defaultTargets = {
    navy:      firstSeaZone,
    army:      null,
    airForce:  firstSeaZone,
  };

  const base = {
    id:     'cmd_' + G.nextCommanderId++,
    name:   name.trim(),
    branch,
  };

  if (branch === 'army') {
    Object.assign(base, {
      budget:      0,
      nextUnitId:  1,
      units:       [],
      order:       { type: 'hold', target: null },
    });
  } else {
    // Navy and Air Force: same budget + unit roster model as Army (Phase 5.7f).
    // Additionally retain mission + target for strategic directive.
    Object.assign(base, {
      budget:      0,
      nextUnitId:  1,
      units:       [],
      mission:     defaultMissions[branch] || null,
      target:      defaultTargets[branch]  || null,
    });
  }

  G.commanders.push(base);
  renderAll();
}

function updateCommanderMission(id, mission, target) {
  const cmd = G.commanders.find(c => c.id === id);
  if (!cmd) return;
  cmd.mission = mission;
  cmd.target  = target || null;
  renderAll();
}

function removeCommander(id) {
  G.commanders = G.commanders.filter(c => c.id !== id);
  // Also cancel any queued production items for this commander
  G.productionQueue = (G.productionQueue || []).filter(item => item.commanderId !== id);
  // Remove any assessments for this commander
  G.commanderAssessments = (G.commanderAssessments || []).filter(a => a.commanderId !== id);
  renderAll();
}

// ============================================================
// ARMY UNIT ACTIONS — Phase 5.7a
// ============================================================

function setCommanderBudget(commanderId, value) {
  const cmd = G.commanders.find(c => c.id === commanderId);
  if (!cmd) return;
  cmd.budget = Math.max(0, Number(value) || 0);
  renderAll();
}

// Recruit a new unit under an Army commander.
// Deducts one-time cost from treasury immediately; unit enters 'recruiting' state.
function recruitUnit(commanderId, unitType, size, unitName) {
  const cmd = G.commanders.find(c => c.id === commanderId);
  if (!cmd || cmd.branch !== 'army') return;
  const def = UNIT_TYPES[unitType];
  if (!def) return;
  const clampedSize = Math.max(1, Math.min(UNIT_MAX_SIZE, Number(size) || 1));
  const cost = def.costPerSize * clampedSize;
  if (G.treasury < cost) {
    addLog(`Not enough funds to recruit ${def.name} (need ${fmt(cost)}M).`, 'bad');
    return;
  }
  G.treasury -= cost;
  const unitId = commanderId + '_u' + cmd.nextUnitId;
  cmd.units.push({
    id:               unitId,
    name:             (unitName && unitName.trim()) ? unitName.trim() : `${def.name} #${cmd.nextUnitId}`,
    type:             unitType,
    size:             clampedSize,
    status:           'recruiting',
    recruitTurnsLeft: def.recruitTurns,
    position:         getCapitalProvinceId(),
    moveTimer:        0,
  });
  cmd.nextUnitId++;
  addLog(`${cmd.name}: recruiting "${cmd.units[cmd.units.length - 1].name}" — ready in ${def.recruitTurns} turn${def.recruitTurns !== 1 ? 's' : ''}.`, 'good');
  renderAll();
}

function disbandUnit(commanderId, unitId) {
  const cmd = G.commanders.find(c => c.id === commanderId);
  if (!cmd) return;
  const unit = (cmd.units || []).find(u => u.id === unitId);
  if (!unit) return;
  cmd.units = cmd.units.filter(u => u.id !== unitId);
  addLog(`${cmd.name}: "${unit.name}" disbanded.`, 'neutral');
  renderAll();
}

function setCommanderOrder(commanderId, orderType, target) {
  const cmd = G.commanders.find(c => c.id === commanderId);
  if (!cmd || cmd.branch !== 'army') return;
  cmd.order = { type: orderType, target: target || null };
  // Reset all unit move timers so they start fresh toward new deployment
  for (const unit of (cmd.units || [])) unit.moveTimer = 0;
  renderAll();
}

// ============================================================
// NAVAL / AIR UNIT PRODUCTION QUEUE — Phase 5.7f
// ============================================================

// Add a Navy or Air Force unit to the global production queue.
// Cost is deducted from treasury up-front; unit joins the queue and is created
// when it reaches the front and completes its production countdown.
function queueProductionItem(commanderId, unitType, size, unitName) {
  const cmd = G.commanders.find(c => c.id === commanderId);
  if (!cmd || (cmd.branch !== 'navy' && cmd.branch !== 'airForce')) return;
  const typeDefs = cmd.branch === 'navy' ? NAVAL_UNIT_TYPES : AIR_UNIT_TYPES;
  const def = typeDefs[unitType];
  if (!def) return;
  const clampedSize = Math.max(1, Math.min(UNIT_MAX_SIZE, Number(size) || 1));
  const cost = def.costPerSize * clampedSize;
  if (G.treasury < cost) {
    addLog(`Not enough funds to build ${def.name} (need ${fmt(cost)}M).`, 'bad');
    return;
  }
  G.treasury -= cost;
  const itemId = 'prod_' + (G.nextProductionItemId++);
  const resolvedName = (unitName && unitName.trim()) ? unitName.trim()
    : `${def.name} #${cmd.nextUnitId}`;
  cmd.nextUnitId = (cmd.nextUnitId || 1) + 1;
  G.productionQueue.push({
    id:          itemId,
    commanderId,
    branch:      cmd.branch,
    unitType,
    size:        clampedSize,
    unitName:    resolvedName,
    turnsTotal:  def.productionTurns,
    turnsLeft:   def.productionTurns,
  });
  addLog(`${cmd.name}: ${def.name} (×${clampedSize}) queued for production — ${def.productionTurns} turn${def.productionTurns !== 1 ? 's' : ''} to complete.`, 'good');
  renderAll();
}

function cancelProductionItem(itemId) {
  const idx = (G.productionQueue || []).findIndex(i => i.id === itemId);
  if (idx < 0) return;
  const item = G.productionQueue[idx];
  const typeDefs = item.branch === 'navy' ? NAVAL_UNIT_TYPES : AIR_UNIT_TYPES;
  const def = typeDefs[item.unitType];
  // Partial refund: 50% if not yet started (not front of queue), 0% if in production
  const isActive = idx === 0;
  const refund = isActive ? 0 : Math.floor((def?.costPerSize || 0) * item.size * 0.5);
  if (refund > 0) G.treasury += refund;
  G.productionQueue.splice(idx, 1);
  addLog(`Production of "${item.unitName}" cancelled.${refund > 0 ? ` +${fmt(refund)}M refunded.` : ''}`, 'neutral');
  renderAll();
}

// ============================================================
// COMMANDER ASSESSMENTS — Phase 5.7f
// ============================================================

function acceptAssessment(assessmentId) {
  const assess = (G.commanderAssessments || []).find(a => a.id === assessmentId);
  if (!assess) return;
  G.commanderAssessments = G.commanderAssessments.filter(a => a.id !== assessmentId);
  if (assess.type === 'recruit') {
    queueProductionItem(assess.commanderId, assess.unitType, assess.size, null);
  } else if (assess.type === 'increaseBudget') {
    const cmd = G.commanders.find(c => c.id === assess.commanderId);
    if (cmd) {
      cmd.budget = (cmd.budget || 0) + assess.amount;
      addLog(`${cmd.name}: budget raised by +${fmt(assess.amount)}M/turn as recommended.`, 'good');
      renderAll();
    }
  }
}

function dismissAssessment(assessmentId) {
  G.commanderAssessments = (G.commanderAssessments || []).filter(a => a.id !== assessmentId);
  renderAll();
}

// ============================================================
// AI MILITARY & WAR SYSTEM — Phase 5.7c
// ============================================================

// Names pool for AI commanders (index by nation position in NATIONS, then by commander index).
const _AI_GENERAL_NAMES = {
  valdoria: ['General Harwick',   'Commander Sela'],
  kethara:  ['General Voss',      'Commander Aira'],
  orzhan:   ['Marshal Drak',      'Colonel Brennar'],
  sorenia:  ['Admiral Brenn',     'Captain Lysa'],
  iravan:   ['General Karim',     'Commander Zara'],
  durenna:  ['Marshal Theron',    'Commander Bess'],
  marveth:  ['General Kale',      'Commander Lira'],
  nocthar:  ['General Morvath',   'Colonel Ashton'],
};

// Initialise AI militaries for all nations. Called once at game start.
function initAiMilitaries() {
  G.aiMilitary = {};
  for (const nationId of Object.keys(NATIONS)) {
    const provinces = Object.keys(PROVINCES).filter(id => PROVINCES[id].nationId === nationId);
    const provCount  = provinces.length;
    if (provCount === 0) continue;

    const cmdCount  = Math.max(1, Math.ceil(provCount / 3));
    const namePool  = _AI_GENERAL_NAMES[nationId] || ['General', 'Commander'];
    const commanders = [];

    for (let i = 0; i < cmdCount; i++) {
      const myProvs = provinces.filter((_, idx) => idx % cmdCount === i);
      const units   = [];

      // One light infantry unit garrisoning each assigned province
      for (const provId of myProvs) {
        units.push({
          id:        `${nationId}_c${i}_inf_${provId}`,
          name:      `${NATIONS[nationId].name} Infantry`,
          type:      'lightInfantry',
          size:      AI_UNIT_SIZE_PER_PROVINCE,
          status:    'ready',
          position:  provId,
          moveTimer: 0,
        });
      }
      // Lead commander of larger nations also gets an armoured unit
      if (i === 0 && provCount >= 4) {
        units.push({
          id:        `${nationId}_c${i}_armor`,
          name:      `${NATIONS[nationId].name} Armored Corps`,
          type:      'armoredCorps',
          size:      Math.max(3, Math.floor(provCount * 2)),
          status:    'ready',
          position:  provinces[0],
          moveTimer: 0,
        });
      }

      commanders.push({
        id:     `${nationId}_cmd${i}`,
        name:   namePool[i] || `${NATIONS[nationId].name} Commander ${i + 1}`,
        branch: 'army',
        units,
        order:  { type: 'hold', target: null },
      });
    }

    G.aiMilitary[nationId] = { commanders };
  }
}

// Declare war on a nation. Converts staged commanders to 'advance' order and pauses trade routes.
function declareWar(nationId) {
  if (!nationId || isAtWar(nationId)) return;

  // Check for staging bonus — any commander already staged toward this nation
  let stagingBonus = false;
  for (const cmd of G.commanders) {
    if (cmd.branch === 'army' && cmd.order?.type === 'stage' && cmd.order?.target === nationId) {
      cmd.order = { type: 'advance', target: nationId };
      for (const unit of (cmd.units || [])) unit.moveTimer = 0;
      stagingBonus = true;
    }
  }

  G.wars.push({ nationId, declaredTurn: G.turn, stagingBonus, sueForPeaceOffered: false });
  G.nations[nationId].relations = -100;

  // Pause trade routes
  for (const route of G.tradeRoutes) {
    if (route.nationId === nationId) route.paused = true;
  }

  addLog(`⚔️ WAR DECLARED on ${NATIONS[nationId]?.name}!${stagingBonus ? ' Staging bonus active.' : ''}`, 'bad');
  renderAll();
}

// End a war with nationId. keepProvIds = province IDs to formally annex; others are returned.
function offerPeace(nationId, keepProvIds) {
  const keepSet = new Set(keepProvIds || []);

  // Formally transfer kept provinces to player empire
  for (const provId of keepSet) {
    if (G.occupiedProvinces[provId]?.originalOwner === nationId) {
      PROVINCES[provId].nationId = 'player';
      delete G.occupiedProvinces[provId];
    }
  }
  // Return all other occupied provinces of this nation
  for (const [provId, data] of Object.entries(G.occupiedProvinces)) {
    if (data.originalOwner === nationId) delete G.occupiedProvinces[provId];
  }
  // Clear siege state involving this nation
  for (const provId of Object.keys(G.siegeState)) {
    if (PROVINCES[provId]?.nationId === nationId || keepSet.has(provId)) {
      delete G.siegeState[provId];
    }
  }
  // Remove AI units that ended up in player territory; rebase the rest to home provinces
  const aiMil = G.aiMilitary[nationId];
  if (aiMil) {
    const homeProvs = Object.keys(PROVINCES).filter(id => PROVINCES[id].nationId === nationId);
    for (const cmd of aiMil.commanders) {
      cmd.units = (cmd.units || []).filter(u => PROVINCES[u.position]?.nationId !== 'player');
      for (const unit of cmd.units) {
        if (!homeProvs.includes(unit.position) && homeProvs.length > 0) {
          unit.position = homeProvs[0];
        }
      }
    }
  }
  // Resume trade routes
  for (const route of G.tradeRoutes) {
    if (route.nationId === nationId) route.paused = false;
  }

  G.wars = G.wars.filter(w => w.nationId !== nationId);
  addLog(`🤝 Peace deal signed with ${NATIONS[nationId]?.name}. ${keepSet.size} province(s) annexed.`, 'good');
  renderAll();
}

// Apply size casualties to all player units in a province. ratio = opposing strength / own strength.
function _applyCasualtiesToPlayerSide(provId, ratio) {
  const rate = SIEGE_CASUALTY_RATE * Math.min(ratio, 4); // cap ratio at 4× to avoid one-shot wipes
  for (const cmd of G.commanders) {
    if (cmd.branch !== 'army') continue;
    for (const unit of (cmd.units || [])) {
      if (unit.status !== 'ready' || unit.position !== provId) continue;
      unit.size = Math.max(0, unit.size - Math.max(1, Math.round(unit.size * rate)));
    }
    cmd.units = cmd.units.filter(u => u.size > 0);
  }
}

// Apply size casualties to all AI units of a nation in a province.
function _applyCasualtiesToAiSide(nationId, provId, ratio) {
  const rate   = SIEGE_CASUALTY_RATE * Math.min(ratio, 4);
  const aiMil  = G.aiMilitary[nationId];
  if (!aiMil) return;
  for (const cmd of aiMil.commanders) {
    for (const unit of (cmd.units || [])) {
      if (unit.status !== 'ready' || unit.position !== provId) continue;
      unit.size = Math.max(0, unit.size - Math.max(1, Math.round(unit.size * rate)));
    }
    cmd.units = cmd.units.filter(u => u.size > 0);
  }
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

  // 1.6. (Navy/Air Force level-building removed in Phase 5.7f — replaced by unit rosters.)

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
  // Sea control multiplier (per route) and fleet capacity multiplier (global) both applied.
  if (G.tradeRoutes.length > 0) {
    let routeIncome = 0;
    for (const route of G.tradeRoutes) {
      route.maturity++;
      routeIncome += getTradeRouteIncome(route);  // already includes sea control per route
    }
    const capMult = getMerchantFleetCapacityMultiplier();
    routeIncome *= capMult;
    G.treasury += routeIncome;
    if (routeIncome > 0) addLog('Trade route income: +' + fmt(routeIncome) + ' (' + G.tradeRoutes.length + ' route' + (G.tradeRoutes.length !== 1 ? 's' : '') + ')', 'good');
  }

  // 2.4c. Merchant fleet — grow from active routes + Commerce level; decay when trade is sparse
  {
    const activeRoutes = G.tradeRoutes.length;
    const growth = activeRoutes * MERCHANT_FLEET_ROUTE_GROW + G.commerceLevel * MERCHANT_FLEET_COMMERCE_GROW;
    const ceiling = getMerchantFleetCeiling();
    const prev = G.merchantFleet;
    G.merchantFleet = Math.min(ceiling, Math.max(0, G.merchantFleet + growth - MERCHANT_FLEET_DECAY_RATE));
    // Log only if the fleet has reached a meaningful level and changed noticeably
    if (Math.floor(G.merchantFleet / 5) !== Math.floor(prev / 5) && G.merchantFleet > 0) {
      addLog('Merchant fleet: ' + G.merchantFleet.toFixed(1) + ' (capacity ' + fmt(getMerchantFleetCapacity()) + '/turn)', 'info');
    }
  }
  // (responses are now instant; this should not fire)
  // if (G.activeNegotiation?.status === 'awaiting') { _processNegotiationResponse(); }

  // 2.4d. Strategic bombing — Air Force bombers degrade target nation militaryLevel
  for (const cmd of (G.commanders || [])) {
    if (cmd.branch !== 'airForce' || cmd.mission !== 'strategicBombing' || !cmd.target) continue;
    const effStr = getAirCommanderEffectiveStrength(cmd);
    if (effStr <= 0) continue;
    const nation = G.nations[cmd.target];
    if (!nation) continue;
    const drain = effStr * STRATEGIC_BOMBING_DRAIN;
    nation.militaryLevel = Math.max(0, nation.militaryLevel - drain);
    if (drain > 0.05) {
      addLog('✈️ Strategic bombing of ' + NATIONS[cmd.target]?.name + ': enemy military −' + drain.toFixed(2), 'good');
    }
  }

  // 2.4e. Army unit upkeep and recruiting countdown (Phase 5.7a)
  for (const cmd of (G.commanders || [])) {
    if (cmd.branch !== 'army') continue;
    // Deduct unit upkeep from treasury
    const upkeep = getCommanderUnitUpkeep(cmd);
    if (upkeep > 0) {
      G.treasury -= upkeep;
      const shortfall = getCommanderBudgetFree(cmd);
      if (shortfall < -UNIT_UNDERFUND_WARNING_THRESHOLD) {
        addLog(`⚠ ${cmd.name}: unit upkeep (${fmt(upkeep)}M) exceeds budget (${fmt(cmd.budget || 0)}M).`, 'bad');
      }
    }
    // Advance recruit timers
    for (const unit of (cmd.units || [])) {
      if (unit.status !== 'recruiting') continue;
      unit.recruitTurnsLeft = Math.max(0, unit.recruitTurnsLeft - 1);
      if (unit.recruitTurnsLeft === 0) {
        unit.status = 'ready';
        addLog(`✅ ${cmd.name}: "${unit.name}" is ready.`, 'good');
      }
    }
  }

  // 2.4e-r. Equipment refit countdown (Phase 5.7e)
  for (const refit of (G.activeRefits || [])) {
    refit.turnsLeft = Math.max(0, refit.turnsLeft - 1);
    if (refit.turnsLeft === 0) {
      G.equipmentTiers[refit.unitType] = refit.targetTier;
      for (const cmd of (G.commanders || [])) {
        if (cmd.branch !== 'army') continue;
        for (const unit of (cmd.units || [])) {
          if (unit.type === refit.unitType && unit.status === 'refitting') unit.status = 'ready';
        }
      }
      addLog(`✅ ${UNIT_TYPES[refit.unitType]?.name || refit.unitType} upgraded to ${EQUIPMENT_TIERS[refit.targetTier].name}.`, 'good');
    }
  }
  G.activeRefits = (G.activeRefits || []).filter(r => r.turnsLeft > 0);

  // 2.4e-nav. Navy and Air Force unit upkeep + budget shortfall warnings (Phase 5.7f)
  for (const cmd of (G.commanders || [])) {
    if (cmd.branch !== 'navy' && cmd.branch !== 'airForce') continue;
    const upkeep = getNavalAirCommanderUnitUpkeep(cmd);
    if (upkeep > 0) {
      G.treasury -= upkeep;
      const free = (cmd.budget || 0) - upkeep;
      if (free < -UNIT_UNDERFUND_WARNING_THRESHOLD) {
        addLog(`⚠ ${cmd.name}: unit upkeep (${fmt(upkeep)}M) exceeds budget (${fmt(cmd.budget || 0)}M).`, 'bad');
      }
    }
  }

  // 2.4e-pq. Global production queue processing (Phase 5.7f)
  // Only the first item in the queue is actively built each turn.
  // Supply shortfall below PRODUCTION_SUPPLY_SLOW_THRESHOLD slows progress.
  {
    const queue = (G.productionQueue || []);
    if (queue.length > 0) {
      const item = queue[0];
      const supplyRatio = getSupplyRatio();
      const speedMult = supplyRatio < PRODUCTION_SUPPLY_SLOW_THRESHOLD ? supplyRatio : 1;
      item.turnsLeft = Math.max(0, item.turnsLeft - speedMult);
      if (item.turnsLeft <= 0) {
        // Production complete — add unit to commander
        const cmd = (G.commanders || []).find(c => c.id === item.commanderId);
        if (cmd) {
          const unitId = item.commanderId + '_u' + (cmd.nextUnitId || 1);
          if (!cmd.nextUnitId) cmd.nextUnitId = 1;
          cmd.units = cmd.units || [];
          cmd.units.push({
            id:     unitId,
            name:   item.unitName,
            type:   item.unitType,
            size:   item.size,
            status: 'ready',
          });
          cmd.nextUnitId++;
          const typeDefs = item.branch === 'navy' ? NAVAL_UNIT_TYPES : AIR_UNIT_TYPES;
          const defName = typeDefs[item.unitType]?.name || item.unitType;
          addLog(`✅ ${cmd.name}: "${item.unitName}" (${defName} ×${item.size}) production complete.`, 'good');
        }
        G.productionQueue.shift();
        if (G.productionQueue.length > 0) {
          const next = G.productionQueue[0];
          const nextDef = (next.branch === 'navy' ? NAVAL_UNIT_TYPES : AIR_UNIT_TYPES)[next.unitType];
          addLog(`🏭 Production started: ${nextDef?.name || next.unitType} for ${(G.commanders||[]).find(c=>c.id===next.commanderId)?.name || 'unknown'}.`, 'info');
        }
      }
    }
  }

  // 2.4e-as. Commander brain assessments (Phase 5.7f)
  // Semi-automatic: each Navy/Air commander posts one recommendation per COMMANDER_ASSESSMENT_INTERVAL
  // turns if they have no pending assessment already.
  {
    const cooldowns = G.commanderAssessmentCooldowns || {};
    for (const cmd of (G.commanders || [])) {
      if (cmd.branch !== 'navy' && cmd.branch !== 'airForce') continue;
      // Tick down cooldown
      if (!cooldowns[cmd.id]) cooldowns[cmd.id] = 0;
      if (cooldowns[cmd.id] > 0) { cooldowns[cmd.id]--; continue; }
      // Skip if assessment already pending for this commander
      if ((G.commanderAssessments || []).some(a => a.commanderId === cmd.id)) continue;
      const readyAttack = getNavalAirCommanderReadyAttack(cmd);
      const upkeep = getNavalAirCommanderUnitUpkeep(cmd);
      const shortfall = upkeep - (cmd.budget || 0);
      let assessed = false;
      // Priority 1: recommend recruiting if attack power is low
      if (!assessed && readyAttack < COMMANDER_ASSESS_RECRUIT_THRESHOLD && (cmd.budget || 0) > 0) {
        const typeDefs = cmd.branch === 'navy' ? NAVAL_UNIT_TYPES : AIR_UNIT_TYPES;
        const cheapestType = Object.entries(typeDefs)
          .filter(([, d]) => d.attack > 0)
          .sort(([, a], [, b]) => a.costPerSize - b.costPerSize)[0];
        if (cheapestType) {
          const [unitType, unitDef] = cheapestType;
          G.commanderAssessments = G.commanderAssessments || [];
          G.commanderAssessments.push({
            id:          'assess_' + (G.nextAssessmentId++),
            commanderId: cmd.id,
            type:        'recruit',
            unitType,
            size:        1,
            reason:      `${cmd.name} has low combat strength (${readyAttack.toFixed(0)} attack). Recommends recruiting ${unitDef.name}.`,
          });
          assessed = true;
        }
      }
      // Priority 2: recommend budget increase if in significant shortfall
      if (!assessed && shortfall > COMMANDER_ASSESS_BUDGET_THRESHOLD) {
        G.commanderAssessments = G.commanderAssessments || [];
        G.commanderAssessments.push({
          id:          'assess_' + (G.nextAssessmentId++),
          commanderId: cmd.id,
          type:        'increaseBudget',
          amount:      Math.ceil(shortfall),
          reason:      `${cmd.name}: unit upkeep (${fmt(upkeep)}M/t) exceeds budget (${fmt(cmd.budget||0)}M/t). Recommends +${fmt(Math.ceil(shortfall))}M/turn.`,
        });
        assessed = true;
      }
      if (assessed) cooldowns[cmd.id] = COMMANDER_ASSESSMENT_INTERVAL;
    }
    G.commanderAssessmentCooldowns = cooldowns;
  }

  // 2.4f. Army unit movement toward deployment province (Phase 5.7b)
  // Only for non-wartime orders (hold/stage/defend); 'advance' is handled in 2.4g.
  {
    const playerSet = new Set(Object.keys(PROVINCES).filter(id => PROVINCES[id].nationId === 'player'));
    for (const cmd of (G.commanders || [])) {
      if (cmd.branch !== 'army') continue;
      if (cmd.order?.type === 'advance') continue; // handled in war section below
      const deployProv = getCommanderDeploymentProvince(cmd);
      for (const unit of (cmd.units || [])) {
        if (unit.status !== 'ready' || !unit.position || unit.position === deployProv) continue;
        unit.moveTimer = (unit.moveTimer || 0) + 1;
        const turnsPerHop = getUnitTurnsPerHop(unit.type);
        if (unit.moveTimer >= turnsPerHop) {
          unit.moveTimer = 0;
          const path = bfsPath([unit.position], [deployProv], playerSet);
          if (path && path.length >= 2) {
            unit.position = path[1];
          }
        }
      }
    }
  }

  // 2.4g. War processing: advance movement, siege resolution, AI counter-attack (Phase 5.7c)
  for (const war of (G.wars || [])) {
    const nationId = war.nationId;
    const aiMil    = G.aiMilitary[nationId];

    // Build set of provinces accessible to player advance (player + occupied + the target nation)
    const advanceSet = new Set([
      ...Object.keys(PROVINCES).filter(id => PROVINCES[id].nationId === 'player'),
      ...Object.keys(G.occupiedProvinces),
      ...Object.keys(PROVINCES).filter(id => PROVINCES[id].nationId === nationId),
    ]);

    // --- Player 'advance' commander movement ---
    for (const cmd of (G.commanders || [])) {
      if (cmd.branch !== 'army' || cmd.order?.type !== 'advance' || cmd.order?.target !== nationId) continue;
      const target = getAdvanceTargetProvince(nationId);
      if (!target) continue;
      for (const unit of (cmd.units || [])) {
        if (unit.status !== 'ready' || !unit.position || unit.position === target) continue;
        unit.moveTimer = (unit.moveTimer || 0) + 1;
        const turnsPerHop = getUnitTurnsPerHop(unit.type);
        if (unit.moveTimer >= turnsPerHop) {
          unit.moveTimer = 0;
          const path = bfsPath([unit.position], [target], advanceSet);
          if (path && path.length >= 2) unit.position = path[1];
        }
      }
    }

    // --- Siege resolution: player units in enemy provinces ---
    const enemyProvIds = Object.keys(PROVINCES).filter(id => PROVINCES[id].nationId === nationId);
    for (const provId of enemyProvIds) {
      const atk = getSiegeAttackStrength(provId);
      if (atk <= 0) continue;
      if (!G.siegeState[provId]) G.siegeState[provId] = { progress: 0 };
      const def = getAiDefenseStrength(provId, nationId);
      const bonus = war.stagingBonus ? STAGING_ATTACK_BONUS : 0;
      const net   = atk * (1 + bonus) - def;
      G.siegeState[provId].progress = Math.min(100, Math.max(0,
        G.siegeState[provId].progress + net / SIEGE_PROGRESS_DIVISOR
      ));
      // Casualties
      if (atk > 0 && def > 0) {
        _applyCasualtiesToPlayerSide(provId, def / atk);
        _applyCasualtiesToAiSide(nationId, provId, atk / def);
      } else if (atk > 0 && def === 0) {
        // Undefended — just progress, no casualties
      }
      // Capture
      if (G.siegeState[provId].progress >= 100) {
        G.occupiedProvinces[provId] = { originalOwner: nationId };
        delete G.siegeState[provId];
        addLog(`⚔️ ${PROVINCES[provId]?.name || provId} captured!`, 'good');
      }
    }

    // --- AI counter-attack movement ---
    if (aiMil) {
      for (const cmd of (aiMil.commanders || [])) {
        const totalAtk = (cmd.units || [])
          .filter(u => u.status === 'ready')
          .reduce((s, u) => s + (UNIT_TYPES[u.type]?.attack || 0) * u.size, 0);
        if (totalAtk < AI_COUNTER_ATTACK_THRESHOLD) continue;
        const target = getAiCounterAttackTarget(cmd);
        if (!target) continue;
        for (const unit of (cmd.units || [])) {
          if (unit.status !== 'ready' || !unit.position || unit.position === target) continue;
          unit.moveTimer = (unit.moveTimer || 0) + 1;
          const turnsPerHop = getUnitTurnsPerHop(unit.type);
          if (unit.moveTimer >= turnsPerHop) {
            unit.moveTimer = 0;
            const path = bfsPath([unit.position], [target]);
            if (path && path.length >= 2) unit.position = path[1];
          }
        }
      }

      // --- Siege resolution: AI units in player/occupied provinces ---
      for (const cmd of (aiMil.commanders || [])) {
        for (const unit of (cmd.units || [])) {
          if (unit.status !== 'ready' || !unit.position) continue;
          const owner = getProvinceEffectiveOwner(unit.position);
          if (owner !== 'player') continue;
          const aiAtk  = (UNIT_TYPES[unit.type]?.attack || 0) * unit.size;
          const plrDef = getPlayerDefenseStrength(unit.position);
          if (aiAtk <= 0) continue;
          if (!G.siegeState[unit.position]) G.siegeState[unit.position] = { progress: 100 };
          const net = aiAtk - plrDef;
          G.siegeState[unit.position].progress = Math.min(100, Math.max(0,
            G.siegeState[unit.position].progress - net / SIEGE_PROGRESS_DIVISOR
          ));
          // Casualties
          if (aiAtk > 0 && plrDef > 0) {
            _applyCasualtiesToAiSide(nationId, unit.position, plrDef / aiAtk);
            _applyCasualtiesToPlayerSide(unit.position, aiAtk / plrDef);
          }
          // Province recaptured by AI
          if (G.siegeState[unit.position].progress <= 0) {
            delete G.siegeState[unit.position];
            if (G.occupiedProvinces[unit.position]) {
              delete G.occupiedProvinces[unit.position];
              addLog(`⚔️ ${PROVINCES[unit.position]?.name || unit.position} was recaptured by ${NATIONS[nationId]?.name}!`, 'bad');
            }
          }
        }
      }
    }

    // --- War treasury drain ---
    G.treasury -= WAR_TREASURY_DRAIN_PER_TURN;

    // --- Auto-sue for peace check ---
    if (!war.sueForPeaceOffered && getOccupiedFraction(nationId) >= SUE_FOR_PEACE_THRESHOLD) {
      war.sueForPeaceOffered = true;
      addLog(`🏳️ ${NATIONS[nationId]?.name} is requesting peace negotiations.`, 'neutral');
    }
  }

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
      // Auto-advance to next queued tech
      _startNextQueuedTech();
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

// ── Equipment refit (Phase 5.7e) ──────────────────────────────────────────────────────────
// Order a refit of all in-service units of unitType to targetTier.
function orderRefit(unitType, targetTier) {
  if (!G.equipmentTiers) return;
  const currentTier = G.equipmentTiers[unitType] || 1;
  if (targetTier <= currentTier) return;
  const reqTech = EQUIPMENT_TIERS[targetTier]?.requiresTech;
  if (reqTech && !G.unlockedTechs.includes(reqTech)) {
    showNotification('Requires ' + TECHNOLOGIES[reqTech].name + ' to upgrade.', 'bad');
    return;
  }
  if ((G.activeRefits || []).some(r => r.unitType === unitType)) {
    showNotification('Refit already in progress for this unit type.', 'bad');
    return;
  }
  const cost = getRefitCost(unitType, targetTier);
  if (G.treasury < cost) {
    showNotification('Not enough treasury — need ' + fmt(cost) + 'M.', 'bad');
    return;
  }
  G.treasury -= cost;
  for (const cmd of (G.commanders || [])) {
    if (cmd.branch !== 'army') continue;
    for (const unit of (cmd.units || [])) {
      if (unit.type === unitType && (unit.status === 'ready' || unit.status === 'recruiting')) {
        unit.status = 'refitting';
      }
    }
  }
  const turns = getRefitTurns(currentTier, targetTier);
  G.activeRefits.push({ unitType, targetTier, turnsLeft: turns });
  addLog(`⚙️ Refit started: ${UNIT_TYPES[unitType]?.name} → ${EQUIPMENT_TIERS[targetTier].name}. (${turns} turns, −${fmt(cost)}M)`, 'info');
  renderAll();
}
