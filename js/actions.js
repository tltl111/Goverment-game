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

  const cost = getPolicyCost(policyId);

  // Update this card's cost label and active class
  const costEl = document.getElementById('pc-' + policyId);
  if (costEl) {
    costEl.textContent = cost > 0 ? '\u2212' + fmt(cost) + '/turn' : 'Inactive';
    costEl.className = 'policy-cost' + (cost > 0 ? '' : ' inactive');
  }
  const displayEl = document.getElementById('pd-' + policyId);
  if (displayEl) displayEl.textContent = funding + '% of income \u2014 ' + (cost > 0 ? fmt(cost) + '/turn' : 'Inactive');

  // Toggle the card's active class so the slider thumb colour updates
  const cardEl = costEl && costEl.closest('.policy-card');
  if (cardEl) cardEl.classList.toggle('active', funding > 0);

  updateBudgetProjection();
  renderHeader();
}

function setTaxRate(value) {
  G.taxRate = parseInt(value, 10) / 100;
  document.getElementById('tax-rate-display').textContent = value + '%';
  document.getElementById('tax-income-label').textContent = '+' + fmt(getTaxIncome()) + '/turn';
  updateBudgetProjection();
  renderHeader();
}

function toggleBuildCentre() {
  if (!G.buildingCentre && G.policyFunding.infrastructure === 0) {
    showNotification('Set infrastructure funding above 0 first!', 'error');
    return;
  }
  G.buildingCentre = !G.buildingCentre;
  if (!G.buildingCentre) {
    G.centreBuildProgress = 0;
    showNotification('Construction cancelled.', 'info');
  } else {
    showNotification('🏗️ Building research centre — infrastructure budget diverted.', 'good');
  }
  renderAll();
}

function openTradeRoute() {
  const slots = getTradeRouteSlots();
  if (G.tradeRoutes >= slots) {
    const needed = (G.tradeRoutes + 1) * TRADE_ROUTE_LEVEL_NEEDED;
    showNotification('Need Finance level ' + needed + ' to open another route.', 'error');
    return;
  }
  if (G.treasury < TRADE_ROUTE_COST) {
    showNotification('Need ' + fmt(TRADE_ROUTE_COST) + ' treasury to open a route.', 'error');
    return;
  }
  G.treasury -= TRADE_ROUTE_COST;
  G.tradeRoutes++;
  addLog('Trade route #' + G.tradeRoutes + ' opened (\u2212' + fmt(TRADE_ROUTE_COST) + '). Income: +' + fmt(getTradeRouteIncomePerRoute()) + '/turn per route.', 'good');
  showNotification('\ud83d\udea2 Trade route #' + G.tradeRoutes + ' opened!', 'good');
  renderAll();
}

function closeTradeRoute() {
  if (G.tradeRoutes <= 0) return;
  G.tradeRoutes--;
  showNotification('Trade route closed. (' + G.tradeRoutes + ' remaining)', 'info');
  renderAll();
}

function setActiveResearch(techId) {
  const tech = TECHNOLOGIES[techId];
  if (G.unlockedTechs.includes(techId)) return;
  if (tech.requires && !G.unlockedTechs.includes(tech.requires)) {
    showNotification('Prerequisite not met: ' + TECHNOLOGIES[tech.requires].name, 'error');
    return;
  }
  if (G.researchCentres === 0) {
    showNotification('Build a research centre first!', 'error');
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

function endTurn() {

  // 1. Grow GDP first so income calculation matches what's displayed
  const growth = getEffectiveGrowthRate();
  G.gdp = G.gdp * (1 + growth);

  // 1.3. Update economic sector levels (Industry, Commerce, Finance)
  // Each sector grows with spending and decays 1 level/turn without it.
  for (const sector of ['industry', 'commerce', 'finance']) {
    const levelKey = sector + 'Level';
    if (G.policyFunding[sector] > 0) {
      const spend    = getTaxIncome() * (G.policyFunding[sector] / 100);
      const growRate = SECTOR_GROW_PER_M / (1 + SECTOR_GROW_HARDNESS * G[levelKey]);
      const net      = spend * growRate - SECTOR_DECAY;
      G[levelKey]    = Math.min(100, Math.max(0, G[levelKey] + net));
    } else if (G[levelKey] > 0) {
      G[levelKey] = Math.max(0, G[levelKey] - SECTOR_DECAY);
    }
  }

  // 1.4. Update infrastructure level
  // Repair rate shrinks at higher levels (harder to improve a mature network).
  // Decay rate grows with level (a bigger network needs more upkeep).
  // Both effects apply simultaneously — insufficient spending makes levels fall even when funded.
  if (!G.buildingCentre) {
    const decay = INFRA_DECAY_BASE + INFRA_DECAY_SCALE * G.infraLevel;
    if (G.policyFunding.infrastructure > 0) {
      const infraSpend = getTaxIncome() * (G.policyFunding.infrastructure / 100);
      const repairRate = INFRA_REPAIR_PER_M / (1 + INFRA_REPAIR_HARDNESS * G.infraLevel);
      const net = infraSpend * repairRate - decay;
      G.infraLevel = Math.min(100, Math.max(0, G.infraLevel + net));
    } else if (G.infraLevel > 0) {
      G.infraLevel = Math.max(0, G.infraLevel - decay);
    }
  }

  // 1.5. Research centre construction: divert infrastructure budget into build progress
  if (G.buildingCentre && G.policyFunding.infrastructure > 0) {
    const infraSpend = getTaxIncome() * (G.policyFunding.infrastructure / 100);
    G.centreBuildProgress += infraSpend;
    if (G.centreBuildProgress >= CENTRE_BUILD_COST) {
      G.researchCentres++;
      G.centreBuildProgress = 0;
      G.buildingCentre = false;
      addLog('Research Centre #' + G.researchCentres + ' built via infrastructure investment — ' + getRpPerTurn().toFixed(1) + ' RP/turn.', 'good');
      showNotification('🏗️ Research Centre #' + G.researchCentres + ' complete!', 'good');
    }
  }

  // 2. Apply net income (using grown GDP — same value the UI shows)
  const net = getNetIncome();
  G.treasury += net;

  // 2.4. Trade route income (passive, scales with finance level)
  if (G.tradeRoutes > 0) {
    const routeIncome = G.tradeRoutes * (TRADE_ROUTE_INCOME + G.financeLevel * TRADE_ROUTE_FINANCE_SCALE);
    G.treasury += routeIncome;
    addLog('Trade route income: +' + fmt(routeIncome) + ' (' + G.tradeRoutes + ' routes, Finance lvl ' + Math.round(G.financeLevel) + ')', 'good');
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
  if (G.activeResearch && G.researchCentres > 0) {
    G.researchProgress += getRpPerTurn();
    const activeTech = TECHNOLOGIES[G.activeResearch];
    if (G.researchProgress >= activeTech.cost) {
      G.unlockedTechs.push(G.activeResearch);
      addLog('Research complete: ' + activeTech.name + ' — ' + activeTech.effects.effectDesc, 'good');
      showNotification('✓ ' + activeTech.name + ' research complete!', 'good');
      G.activeResearch = null;
      G.researchProgress = 0;
    }
  }

  // 5. Military strength
  G.militaryStrength = (POLICIES.military.effects.militaryStrength || 0) * policyEffectScale('military');

  // 6. Advance time
  G.year++;
  G.turn++;

  // 7. Update happiness pool: converges toward calcHappinessTarget() at 5%/turn, capped at HAPPINESS_DRIFT_CAP
  const happinessTarget = calcHappinessTarget();
  const happinessDelta = Math.max(-HAPPINESS_DRIFT_CAP, Math.min(HAPPINESS_DRIFT_CAP,
    (happinessTarget - G.happiness) * 0.05));
  G.happiness = Math.max(0, Math.min(100, G.happiness + happinessDelta));

  // 8. Log turn summary
  const happiness = G.happiness;
  addLog(
    'Year ' + G.year + ' — Net: ' + (net >= 0 ? '+' : '') + fmt(net) +
    ' | GDP: $' + G.gdp.toFixed(2) + 'B | Happiness: ' + Math.round(happiness) + '%',
    net < 0 ? 'bad' : 'info'
  );

  renderAll();
}
