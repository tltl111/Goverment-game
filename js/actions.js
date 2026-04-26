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

function toggleBuildResearchCentre() {
  if (!G.buildingResearchCentre && G.policyFunding.infrastructure === 0) {
    showNotification('Set infrastructure funding above 0 first!', 'error');
    return;
  }
  G.buildingResearchCentre = !G.buildingResearchCentre;
  if (!G.buildingResearchCentre) {
    G.researchCentreBuildProgress = 0;
    showNotification('Construction cancelled.', 'info');
  } else {
    showNotification('🏗️ Building research centre — split infra budget with the slider.', 'good');
  }
  renderAll();
}

function setResearchCentreBuildFraction(val) {
  G.researchCentreBuildFraction = Math.max(0, Math.min(100, parseInt(val, 10) || 0));
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
  const missingReqs = tech.requires.filter(r => !G.unlockedTechs.includes(r));
  if (missingReqs.length > 0) {
    showNotification('Prerequisite not met: ' + missingReqs.map(r => TECHNOLOGIES[r].name).join(', '), 'error');
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

  // 1.3. Update economic sector levels (Mining, Manufacturing, Commerce, Finance)
  // Each sector grows with spending and decays 1 level/turn without it.
  for (const sector of ['mining', 'manufacturing', 'commerce', 'finance']) {
    const levelKey = sector + 'Level';
    if (G.policyFunding[sector] > 0) {
      const spend    = getTaxIncome() * (G.policyFunding[sector] / 100);
      const growRate = SECTOR_GROW_PER_M / (1 + SECTOR_GROW_HARDNESS * G[levelKey]);
      const net      = spend * growRate - SECTOR_DECAY;
      const unclamped = G[levelKey] + net;
      if (unclamped > 100) {
        const sectorOverspendRefund = (unclamped - 100) / growRate;
        G.treasury += sectorOverspendRefund;
      }
      G[levelKey]    = Math.min(100, Math.max(0, unclamped));
    } else if (G[levelKey] > 0) {
      G[levelKey] = Math.max(0, G[levelKey] - SECTOR_DECAY);
    }
  }

  // Manufacturing import cost: if Manufacturing level exceeds Mining, raw materials must be imported
  if (G.manufacturingLevel > G.miningLevel) {
    const manufacturingImportCost = (G.manufacturingLevel - G.miningLevel) * MANUFACTURING_IMPORT_COST_PER_LEVEL;
    G.treasury -= manufacturingImportCost;
    addLog('Manufacturing import cost: −' + fmt(manufacturingImportCost) + ' (Mining gap: ' + Math.round(G.manufacturingLevel - G.miningLevel) + ' levels)', 'bad');
  }

  // 1.4. Update infrastructure level
  // Repair rate shrinks at higher levels (harder to improve a mature network).
  // Decay rate grows with level (a bigger network needs more upkeep).
  // Both effects apply simultaneously — insufficient spending makes levels fall even when funded.
  // While building a research centre, infrastructure spend is split: researchCentreBuildFraction% → construction, rest → repair.
  {
    const te = getTechEffects();
    const decay = getTaxIncome() * INFRA_MAINTAIN_FRAC / (1 + INFRA_REPAIR_HARDNESS * G.infraLevel) * te.infraDecayMult;
    if (G.policyFunding.infrastructure > 0) {
      const totalInfraSpend = getTaxIncome() * (G.policyFunding.infrastructure / 100);
      const repairSpend = G.buildingResearchCentre
        ? totalInfraSpend * (1 - G.researchCentreBuildFraction / 100)
        : totalInfraSpend;
      const repairRate = INFRA_REPAIR_PER_M / (1 + INFRA_REPAIR_HARDNESS * G.infraLevel) * te.infraGrowthMult;
      const net = repairSpend * repairRate - decay;
      const unclamped = G.infraLevel + net;
      if (unclamped > 100) {
        // Refund the spend that would have pushed infra past 100
        const infraOverspendRefund = (unclamped - 100) / repairRate;
        G.treasury += infraOverspendRefund;
      }
      G.infraLevel = Math.min(100, Math.max(0, unclamped));
    } else if (G.infraLevel > 0) {
      G.infraLevel = Math.max(0, G.infraLevel - decay);
    }
  }

  // 1.5. Research centre construction: use the build fraction of the infra budget
  if (G.buildingResearchCentre && G.policyFunding.infrastructure > 0) {
    const totalInfraSpend = getTaxIncome() * (G.policyFunding.infrastructure / 100);
    const buildSpend = totalInfraSpend * (G.researchCentreBuildFraction / 100);
    G.researchCentreBuildProgress += buildSpend;
    if (G.researchCentreBuildProgress >= RESEARCH_CENTRE_BUILD_COST) {
      G.researchCentres++;
      G.researchCentreBuildProgress = 0;
      G.buildingResearchCentre = false;
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
    if (G.researchProgress >= getTechCost(G.activeResearch)) {
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

  // 9. Record history snapshot (keep last 50 turns)
  G.history.push({
    year:            G.year,
    turn:            G.turn,
    treasury:        G.treasury,
    gdp:             G.gdp,
    netIncome:       net,
    taxIncome:       getTaxIncome(),
    totalExpenses:   getTotalExpenses(),
    happiness:       G.happiness,
    infraLevel:      G.infraLevel,
    miningLevel:         G.miningLevel,
    manufacturingLevel:  G.manufacturingLevel,
    commerceLevel:       G.commerceLevel,
    financeLevel:    G.financeLevel,
    tradeRoutes:     G.tradeRoutes,
    researchCentres: G.researchCentres,
    militaryStrength: G.militaryStrength,
    activeResearch:  G.activeResearch,
    unlockedTechs:   G.unlockedTechs.length,
  });
  if (G.history.length > 50) G.history.shift();

  renderAll();
}
