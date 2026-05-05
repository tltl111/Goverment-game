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

function openTradeRoute() {
  const route = { id: G.nextTradeRouteId++, partnerId: null, maturity: 0 };
  G.tradeRoutes.push(route);
  addLog('Trade route #' + route.id + ' opened. Income ramps to +' + fmt(TRADE_ROUTE_INCOME_MAX) + '/turn over ' + TRADE_ROUTE_MATURITY_TURNS + ' turns.', 'good');
  showNotification('\ud83d\udea2 Trade route #' + route.id + ' opened!', 'good');
  renderAll();
}

function closeTradeRoute(routeId) {
  const idx = G.tradeRoutes.findIndex(r => r.id === routeId);
  if (idx === -1) return;
  G.tradeRoutes.splice(idx, 1);
  showNotification('Trade route #' + routeId + ' closed. (' + G.tradeRoutes.length + ' remaining)', 'info');
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

function endTurn() {

  // 1. Grow GDP per-capita (productivity growth). Total GDP = population × gdpPerCapita / 1000.
  const growth = getEffectiveGrowthRate();
  G.gdpPerCapita = G.gdpPerCapita * (1 + growth);
  G.gdp = G.population * G.gdpPerCapita / 1000;

  // 1.3. Update economic sector levels (Mining, Manufacturing, Commerce, Finance)
  // Each sector grows with spending and decays 1 level/turn without it.
  for (const sector of ['mining', 'manufacturing', 'commerce', 'finance']) {
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

  // Manufacturing import cost: if Manufacturing level exceeds Mining, raw materials must be imported
  if (G.manufacturingLevel > G.miningLevel) {
    const manufacturingImportCost = (G.manufacturingLevel - G.miningLevel) * MANUFACTURING_IMPORT_COST_PER_LEVEL;
    G.treasury -= manufacturingImportCost;
    addLog('Manufacturing import cost: −' + fmt(manufacturingImportCost) + ' (Mining gap: ' + Math.round(G.manufacturingLevel - G.miningLevel) + ' levels)', 'bad');
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

  // 1.6. Update military level — full SECTOR_DECAY (force readiness degrades quickly without spending)
  {
    const militarySpend = G.policyFunding.military > 0
      ? getTaxIncome() * (G.policyFunding.military / 100) : 0;
    if (militarySpend > 0) {
      const growRate  = SECTOR_GROW_PER_M / (1 + SECTOR_GROW_HARDNESS * G.militaryLevel);
      const net       = militarySpend * growRate - SECTOR_DECAY;
      G.militaryLevel = Math.min(100, Math.max(0, G.militaryLevel + net));
    } else if (G.militaryLevel > 0) {
      G.militaryLevel = Math.max(0, G.militaryLevel - SECTOR_DECAY);
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

  // 2.4. Trade route income — maturity-based, ramps linearly over TRADE_ROUTE_MATURITY_TURNS
  if (G.tradeRoutes.length > 0) {
    let routeIncome = 0;
    for (const route of G.tradeRoutes) {
      route.maturity++;
      routeIncome += getTradeRouteIncome(route);
    }
    G.treasury += routeIncome;
    if (routeIncome > 0) addLog('Trade route income: +' + fmt(routeIncome) + ' (' + G.tradeRoutes.length + ' route' + (G.tradeRoutes.length !== 1 ? 's' : '') + ')', 'good');
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
      G.activeResearch = null;
      G.researchProgress = 0;
    }
  }

  // 5. Military strength — derived from militaryLevel via getMilitaryStrength() (engine.js)

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
    militaryLevel:   G.militaryLevel,
    researchLevel:   G.researchLevel,
    tradeRoutes:     G.tradeRoutes.length,
    militaryStrength: getMilitaryStrength(),
    activeResearch:  G.activeResearch,
    unlockedTechs:   G.unlockedTechs.length,
  });
  if (G.history.length > 50) G.history.shift();

  // 10. Tick AI nations — GDP growth, military drift, relations drift toward neutral
  for (const [id, nation] of Object.entries(G.nations)) {
    const def = NATIONS[id];
    nation.gdp           *= (1 + def.gdpGrowthRate);
    nation.militaryLevel += NATION_MILITARY_DRIFT_RATE * (def.militaryLevel - nation.militaryLevel);
    nation.relations     += NATION_RELATIONS_DRIFT_RATE * (50 - nation.relations);
    nation.militaryLevel  = Math.max(0, Math.min(100, nation.militaryLevel));
    nation.relations      = Math.max(0, Math.min(100, nation.relations));
  }

  renderAll();
}
