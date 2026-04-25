// ============================================================
// RENDER — all DOM rendering functions (reads G, writes DOM)
// ============================================================

function renderAll() {
  renderHeader();
  renderPolicies();
  renderDashboard();
  renderResearch();
}

function updateBudgetProjection() {
  const income   = getTaxIncome();
  const spending = getTotalExpenses();
  const net      = income - spending;

  const incomeEl  = document.getElementById('proj-income');
  const spendEl   = document.getElementById('proj-spending');
  const netEl     = document.getElementById('proj-net');
  const barEl     = document.getElementById('budget-bar-fill');

  if (incomeEl)  incomeEl.textContent  = fmt(income);
  if (spendEl)   spendEl.textContent   = fmt(spending);
  if (netEl) {
    netEl.textContent  = (net >= 0 ? '+' : '') + fmt(net);
    netEl.className    = net < 0 ? 'negative' : net < income * 0.1 ? 'warning' : 'positive';
  }

  if (barEl) {
    const pct = income > 0 ? Math.min((spending / income) * 100, 100) : 0;
    barEl.style.width = pct + '%';
    barEl.className   = 'budget-bar-fill' + (spending > income ? ' over-budget' : spending > income * 0.85 ? ' warn-budget' : '');
  }
}

function renderHeader() {
  document.getElementById('empire-name').textContent = G.empire;
  document.getElementById('year').textContent = G.year;
  document.getElementById('turn').textContent = G.turn;

  const treasury = G.treasury;
  setStatValue('treasury', fmt(treasury),
    treasury < 0 ? 'negative' : treasury < 1000 ? 'warning' : 'positive');

  document.getElementById('gdp').textContent = '$' + G.gdp.toFixed(2) + 'B';

  const happiness = G.happiness;
  setStatValue('approval', Math.round(happiness) + '%',
    happiness < 35 ? 'negative' : happiness < 50 ? 'warning' : 'positive');

  const net = getNetIncome();
  setStatValue('net-income', (net >= 0 ? '+' : '') + fmt(net),
    net < 0 ? 'negative' : 'positive');
}

function setStatValue(id, value, colorClass) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value;
  el.className = 'hstat-value ' + (colorClass || '');
}

function renderPolicies() {
  const tab = G.currentPolicyTab;

  // Update tax display
  document.getElementById('tax-rate-display').textContent = Math.round(G.taxRate * 100) + '%';
  document.getElementById('tax-slider').value = Math.round(G.taxRate * 100);
  document.getElementById('tax-income-label').textContent = '+' + fmt(getTaxIncome()) + '/turn';

  let html = '';
  for (const [id, policy] of Object.entries(POLICIES)) {
    if (tab !== 'all' && policy.category !== tab) continue;
    const funding = G.policyFunding[id] || 0;
    const cost = getPolicyCost(id);

    html += `
      <div class="policy-card ${funding > 0 ? 'active' : ''}">
        <div class="policy-header">
          <span class="policy-icon">${policy.icon}</span>
          <span class="policy-name">${policy.name}</span>
          <span class="policy-cost ${funding > 0 ? '' : 'inactive'}" id="pc-${id}">
            ${funding > 0 ? '\u2212' + fmt(cost) + '/turn' : 'Inactive'}
          </span>
        </div>
        <p class="policy-desc">${policy.description}</p>
        <div class="policy-slider-row">
          <span class="policy-slider-pct">0%</span>
          <input type="range" class="policy-slider" min="0" max="20" value="${funding}"
            oninput="setPolicyFunding('${id}', this.value)">
          <span class="policy-slider-pct">20%</span>
        </div>
        <div class="policy-slider-display" id="pd-${id}">
          ${funding}% of income \u2014 ${cost > 0 ? fmt(cost) + '/turn' : 'Inactive'}
        </div>
        <div class="policy-effects-hint">${buildEffectsHint(id, policy.effects)}</div>
      </div>`;
  }

  document.getElementById('policies-list').innerHTML = html;
  updateBudgetProjection();

  // Render trade routes panel (below policy cards)
  const trPanel = document.getElementById('trade-routes-panel');
  if (trPanel) {
    const slots   = getTradeRouteSlots();
    const income  = getTradeRouteIncomePerRoute();
    const canOpen = G.tradeRoutes < slots && G.treasury >= TRADE_ROUTE_COST;
    const canClose = G.tradeRoutes > 0;
    const slotsColor = slots === 0 ? 'var(--text-3)' : 'var(--teal)';
    const routeIncomeTotal = G.tradeRoutes > 0 ? ' · +' + fmt(G.tradeRoutes * income) + '/turn' : '';
    trPanel.innerHTML = `
      <div class="trade-routes-card">
        <div class="tr-header">
          <span class="tr-icon">\ud83d\udea2</span>
          <span class="tr-title">Trade Routes</span>
          <span class="tr-slots" style="color:${slotsColor}">${G.tradeRoutes}/${slots} active${routeIncomeTotal}</span>
        </div>
        <p class="tr-desc">Each route costs <strong>${fmt(TRADE_ROUTE_COST)}</strong> treasury to open and earns <strong>+${fmt(income)}/turn</strong> (scales with Finance level). Unlock route slots by raising Finance to level ${TRADE_ROUTE_LEVEL_NEEDED}, ${TRADE_ROUTE_LEVEL_NEEDED * 2}, ${TRADE_ROUTE_LEVEL_NEEDED * 3}…</p>
        <div class="tr-actions">
          <button class="btn-tr-open${canOpen ? '' : ' disabled'}" onclick="openTradeRoute()" ${canOpen ? '' : 'disabled'}>
            Open Route (\u2212${fmt(TRADE_ROUTE_COST)})
          </button>
          <button class="btn-tr-close${canClose ? '' : ' disabled'}" onclick="closeTradeRoute()" ${canClose ? '' : 'disabled'}>
            Close Route
          </button>
        </div>
        ${slots === 0 ? '<div class="tr-hint">Raise Finance level to ' + TRADE_ROUTE_LEVEL_NEEDED + ' to unlock your first route slot.</div>' : ''}
      </div>`;
  }
}

function buildEffectsHint(policyId, effects) {
  if (policyId === 'infrastructure') {
    const lvl         = G.infraLevel;
    const decay       = (INFRA_DECAY_BASE + INFRA_DECAY_SCALE * lvl).toFixed(1);
    const repairRate  = INFRA_REPAIR_PER_M / (1 + INFRA_REPAIR_HARDNESS * lvl);
    // Maintenance spend = spend needed so that repair exactly offsets decay ($M/turn)
    const maintainM   = (INFRA_DECAY_BASE + INFRA_DECAY_SCALE * lvl) / repairRate;
    const income = getTaxIncome();
    const maintainPct = income > 0 ? (maintainM / income * 100).toFixed(1) : '∞';
    const currentGdpPct = (effects.gdpGrowth * (lvl / 100) * 100).toFixed(2);
    const lvlClass    = lvl < 20 ? 'effect-bad' : lvl < 50 ? 'effect-warn' : 'effect-good';
    return [
      `<span class="${lvlClass}">Level ${Math.round(lvl)}/100 → GDP +${currentGdpPct}%</span>`,
      `<span class="effect-bad">−2${decay === '2.0' ? '' : '\u2013' + decay} lvl/turn decay</span>`,
      `<span class="effect-warn">~${maintainPct}% income to maintain</span>`,
    ].join(' · ');
  }
  // Economic sector policies — show level, effect, decay, and net growth preview
  if (policyId === 'industry' || policyId === 'commerce' || policyId === 'finance') {
    const levelKey = policyId + 'Level';
    const lvl = G[levelKey];
    const lvlClass = lvl < 20 ? 'effect-bad' : lvl < 50 ? 'effect-warn' : 'effect-good';
    const funding = G.policyFunding[policyId] || 0;
    let effectStr = '';
    if (policyId === 'industry')  effectStr = 'GDP +' + (0.02 * lvl / 100 * 100).toFixed(2) + '%';
    if (policyId === 'commerce')  effectStr = 'Tax income ×' + (1 + 0.3 * lvl / 100).toFixed(2);
    if (policyId === 'finance') {
      const discount = (0.5 * lvl / 100 * 100).toFixed(0);
      const slots = Math.floor(lvl / TRADE_ROUTE_LEVEL_NEEDED);
      effectStr = 'Debt rate \u2212' + discount + '% · ' + slots + ' route slot' + (slots !== 1 ? 's' : '');
    }
    let netStr = '';
    if (funding > 0) {
      const spend    = getTaxIncome() * (funding / 100);
      const growRate = SECTOR_GROW_PER_M / (1 + SECTOR_GROW_HARDNESS * lvl);
      const net      = spend * growRate - SECTOR_DECAY;
      netStr = ' · <span class="' + (net >= 0 ? 'effect-good' : 'effect-bad') + '">' + (net >= 0 ? '+' : '') + net.toFixed(1) + ' lvl/turn</span>';
    } else {
      netStr = ' · <span class="effect-bad">−' + SECTOR_DECAY.toFixed(1) + ' lvl/turn (unfunded)</span>';
    }
    return `<span class="${lvlClass}">Level ${Math.round(lvl)}/100 → ${effectStr}</span>${netStr}`;
  }
  // Show what effects would be at max funding given the current economy.
  const maxScale = getTaxIncome() * 0.20 / POLICY_REFERENCE_SPEND;
  const parts = [];
  if (effects.happiness)         parts.push(span(Math.round(effects.happiness * maxScale), 'Happiness', ' @max'));
  if (effects.gdpGrowth)         parts.push(spanPct(effects.gdpGrowth * maxScale, 'GDP growth', ' @max'));
  if (effects.rpBonus)           parts.push(`<span class="effect-good">+${(effects.rpBonus * maxScale).toFixed(1)} bonus RP/centre @max</span>`);
  if (effects.militaryStrength)  parts.push(`<span class="effect-good">+${Math.round(effects.militaryStrength * maxScale)} Mil @max</span>`);
  return parts.join(' · ');
}

function span(val, label, suffix) {
  const cls = val >= 0 ? 'effect-good' : 'effect-bad';
  const sign = val >= 0 ? '+' : '';
  return `<span class="${cls}">${label} ${sign}${val}${suffix || ''}</span>`;
}

function spanPct(val, label, suffix) {
  const cls = val >= 0 ? 'effect-good' : 'effect-bad';
  const sign = val >= 0 ? '+' : '';
  return `<span class="${cls}">${label} ${sign}${(val * 100).toFixed(1)}%${suffix || ''}</span>`;
}

function renderDashboard() {
  const tab = G.currentDashboardTab;

  if (tab === 'overview') {
    const happiness = G.happiness;
    const net = getNetIncome();
    const growth = getEffectiveGrowthRate();
    const rp = getRpPerTurn();
    const activeResearchName = G.activeResearch ? TECHNOLOGIES[G.activeResearch].name : 'None';
    const activeResearchPct = G.activeResearch
      ? Math.round((G.researchProgress / TECHNOLOGIES[G.activeResearch].cost) * 100) : 0;

    const tRate = G.treasury < 0 ? getDebtInterestRate() : getSavingsInterestRate();
    const treasuryInterestRaw = G.treasury * tRate;
    const treasuryInterestUnit = tRate > 0
      ? ' (' + (treasuryInterestRaw >= 0 ? '+' : '') + fmt(treasuryInterestRaw) + '/turn, ' + (tRate * 100).toFixed(2) + '%)' : '';

    const gdpChange = G.gdp * growth;
    const gdpChangeStr = (gdpChange >= 0 ? '+' : '') + '$' + (Math.abs(gdpChange) < 1 ? Math.abs(gdpChange).toFixed(3) : Math.abs(gdpChange).toFixed(2)) + 'B';

    // Happiness next-turn delta preview
    const happinessTarget = calcHappinessTarget();
    const happinessDelta = Math.max(-HAPPINESS_DRIFT_CAP, Math.min(HAPPINESS_DRIFT_CAP, (happinessTarget - happiness) * 0.05));
    const happinessDeltaStr = (happinessDelta >= 0 ? '+' : '') + happinessDelta.toFixed(2);

    // Infra level next-turn delta preview
    let infraDelta = 0;
    if (!G.buildingCentre) {
      const infraDecay = INFRA_DECAY_BASE + INFRA_DECAY_SCALE * G.infraLevel;
      if (G.policyFunding.infrastructure > 0) {
        const infraSpend = getTaxIncome() * (G.policyFunding.infrastructure / 100);
        const repairRate = INFRA_REPAIR_PER_M / (1 + INFRA_REPAIR_HARDNESS * G.infraLevel);
        infraDelta = Math.min(100, Math.max(0, G.infraLevel + infraSpend * repairRate - infraDecay)) - G.infraLevel;
      } else {
        infraDelta = Math.max(0, G.infraLevel - infraDecay) - G.infraLevel;
      }
    }
    const infraDeltaStr = (infraDelta >= 0 ? '+' : '') + infraDelta.toFixed(2);

    const indicators = [
      { label: 'Happiness',         value: (happiness >= 0 ? '+' : '') + Math.round(happiness), unit: '% (' + happinessDeltaStr + '/turn)',   max: 100, type: happiness < 30 ? 'neg' : happiness < 50 ? 'warn' : 'pos' },
      { label: 'Treasury',          value: (G.treasury >= 0 ? '+' : '') + fmt(G.treasury),    unit: treasuryInterestUnit,    max: 100, rawPct: Math.min(100, Math.max(0, (G.treasury + 8000) / 160)), type: G.treasury < 0 ? 'neg' : G.treasury < 2000 ? 'warn' : 'pos' },
      { label: 'GDP',               value: '$' + G.gdp.toFixed(2) + 'B', unit: ' (' + gdpChangeStr + '/turn)', max: 100, rawPct: Math.min(100, G.gdp / 20), type: growth < 0 ? 'neg' : 'pos' },
      { label: 'GDP Growth / Year', value: (growth >= 0 ? '+' : '') + (growth * 100).toFixed(2) + '%', unit: '', max: 100, rawPct: Math.min(100, growth * 500), type: growth < 0 ? 'neg' : growth < 0.01 ? 'warn' : 'pos' },
      { label: 'Infra Level',        value: Math.round(G.infraLevel) + '/100', unit: ' (' + infraDeltaStr + '/turn)', max: 100, rawPct: G.infraLevel, type: G.infraLevel < 20 ? 'neg' : G.infraLevel < 50 ? 'warn' : 'pos' },
      { label: 'Industry Level',    value: Math.round(G.industryLevel) + '/100', unit: ' (GDP +' + (0.02 * G.industryLevel / 100 * 100).toFixed(2) + '%)', max: 100, rawPct: G.industryLevel, type: G.industryLevel < 20 ? 'neg' : G.industryLevel < 50 ? 'warn' : 'pos' },
      { label: 'Commerce Level',    value: Math.round(G.commerceLevel) + '/100', unit: ' (Tax \xd7' + (1 + 0.3 * G.commerceLevel / 100).toFixed(2) + ')', max: 100, rawPct: G.commerceLevel, type: G.commerceLevel < 20 ? 'neg' : G.commerceLevel < 50 ? 'warn' : 'pos' },
      { label: 'Finance Level',     value: Math.round(G.financeLevel) + '/100', unit: ' (' + getTradeRouteSlots() + ' route slots)', max: 100, rawPct: G.financeLevel, type: G.financeLevel < 20 ? 'neg' : G.financeLevel < 50 ? 'warn' : 'pos' },
      { label: 'Trade Routes',      value: G.tradeRoutes + '/' + getTradeRouteSlots(), unit: G.tradeRoutes > 0 ? ' (+' + fmt(G.tradeRoutes * getTradeRouteIncomePerRoute()) + '/turn)' : '', max: 100, rawPct: getTradeRouteSlots() > 0 ? (G.tradeRoutes / getTradeRouteSlots()) * 100 : 0, type: G.tradeRoutes === 0 ? 'warn' : 'pos' },
      { label: 'Net Income / Turn', value: (net >= 0 ? '+' : '') + fmt(net), unit: '', max: 100, rawPct: Math.min(100, Math.max(0, (net + 2000) / 40)), type: net < 0 ? 'neg' : 'pos' },
      { label: 'Research Centres',  value: G.researchCentres,  unit: '',    max: 100, rawPct: Math.min(100, G.researchCentres * 10), type: 'pos' },
      { label: 'Research Output',   value: '+' + rp.toFixed(1),      unit: ' RP/turn', max: 100, rawPct: Math.min(100, rp * 3), type: rp === 0 ? 'warn' : 'pos' },
      { label: 'Active Research',   value: activeResearchName, unit: '', max: 100, rawPct: activeResearchPct, type: G.activeResearch ? 'pos' : 'warn' },
      { label: 'Military Strength', value: (G.militaryStrength >= 0 ? '+' : '') + Math.round(G.militaryStrength), unit: '',    max: 100, rawPct: Math.min(100, G.militaryStrength * 2), type: 'pos' },
    ];

    const barClass = t => t === 'neg' ? 'bar-red' : t === 'warn' ? 'bar-yellow' : 'bar-green';

    let html = '<div class="indicators-grid">';
    for (const ind of indicators) {
      const pct = ind.rawPct !== undefined ? ind.rawPct : Math.min(100, (parseInt(ind.value) / ind.max) * 100);
      const valClass = ind.type === 'neg' ? 'negative' : ind.type === 'warn' ? 'warning' : 'positive';
      html += `
        <div class="indicator-card">
          <div class="indicator-label">${ind.label}</div>
          <div class="indicator-value ${valClass}">${ind.value}${ind.unit}</div>
          <div class="indicator-bar-bg">
            <div class="indicator-bar ${barClass(ind.type)}" style="width:${Math.max(0, pct).toFixed(1)}%"></div>
          </div>
        </div>`;
    }
    html += '</div>';
    document.getElementById('tab-overview').innerHTML = html;
  }

  if (tab === 'events') {
    let html = '';
    for (const e of G.eventLog) {
      html += `<div class="event-item ${e.type || 'info'}">
        <span class="event-year">[${e.year}]</span> ${e.message}
      </div>`;
    }
    document.getElementById('events-list').innerHTML = html || '<p style="color:var(--text-3);padding:8px">No events yet.</p>';
  }
}

function renderResearch() {
  const centreEl = document.getElementById('centre-count');
  const rpEl     = document.getElementById('rp-per-turn');
  if (centreEl) centreEl.textContent = G.researchCentres;
  if (rpEl)     rpEl.textContent = getRpPerTurn();

  const buildBar = document.getElementById('build-centre-bar');
  if (buildBar) {
    const infraFunded  = G.policyFunding.infrastructure > 0;
    const infraSpend   = Math.round(getTaxIncome() * (G.policyFunding.infrastructure / 100));
    const progressPct  = Math.min(100, (G.centreBuildProgress / CENTRE_BUILD_COST) * 100).toFixed(1);
    const turnsLeft    = (infraSpend > 0 && G.buildingCentre)
      ? Math.ceil((CENTRE_BUILD_COST - G.centreBuildProgress) / infraSpend)
      : '—';

    const toggleCls = G.buildingCentre ? 'btn-toggle-build active' : 'btn-toggle-build';
    const toggleLabel = G.buildingCentre ? 'Building…' : 'Build';
    const hint = !infraFunded && !G.buildingCentre
      ? '<div class="build-centre-hint">Requires infrastructure funding</div>' : '';
    const progressHtml = G.buildingCentre ? `
      <div class="build-progress-wrap">
        <div class="build-progress-bar-bg"><div class="build-progress-bar-fill" style="width:${progressPct}%"></div></div>
        <div class="build-progress-label">$${Math.floor(G.centreBuildProgress)}M / $${CENTRE_BUILD_COST}M &nbsp;·&nbsp; ~${turnsLeft} turns left</div>
      </div>` : '';

    buildBar.innerHTML = `
      <div class="build-centre-row">
        <div class="build-centre-info">
          <span class="build-centre-title">🏗️ Research Centre</span>
          <span class="build-centre-sub">Uses infrastructure budget · $${CENTRE_BUILD_COST}M total</span>
        </div>
        <button class="${toggleCls}" onclick="toggleBuildCentre()">${toggleLabel}</button>
      </div>
      ${progressHtml}
      ${hint}`;
  }

  const tiers = [1, 2, 3];
  let html = '';

  for (const tier of tiers) {
    html += `<div class="research-tier"><div class="tier-label">Tier ${tier}</div><div class="tier-techs">`;
    for (const [id, tech] of Object.entries(TECHNOLOGIES)) {
      if (tech.tier !== tier) continue;
      const unlocked      = G.unlockedTechs.includes(id);
      const reqMet        = !tech.requires || G.unlockedTechs.includes(tech.requires);
      const isActive      = G.activeResearch === id;
      const busyElsewhere = !!G.activeResearch && !isActive;
      const available     = !unlocked && reqMet;
      const progressPct   = isActive ? Math.min(100, (G.researchProgress / tech.cost) * 100).toFixed(1) : 0;

      let cls = 'tech-card ';
      if (unlocked)          cls += 'tech-unlocked';
      else if (isActive)     cls += 'tech-available tech-researching';
      else if (!reqMet)      cls += 'tech-locked';
      else if (busyElsewhere) cls += 'tech-available tech-busy';
      else                   cls += 'tech-available';

      const reqText = tech.requires && !unlocked
        ? `<div class="tech-req">Req: ${TECHNOLOGIES[tech.requires].name}</div>` : '';

      let actionHtml = '';
      if (isActive) {
        actionHtml = `
          <div class="tech-progress-wrap">
            <div class="tech-progress-bar-bg"><div class="tech-progress-bar-fill" style="width:${progressPct}%"></div></div>
            <div class="tech-progress-label">${Math.floor(G.researchProgress)} / ${tech.cost} RP</div>
          </div>
          <button class="btn-cancel-research" onclick="setActiveResearch('${id}')">Cancel</button>`;
      } else if (available && !busyElsewhere) {
        actionHtml = `<button class="btn-start-research" onclick="setActiveResearch('${id}')">&#128300; Research</button>`;
      }

      html += `
        <div class="${cls}" title="${tech.description}">
          <span class="tech-icon">${tech.icon}</span>
          <div class="tech-info">
            <div class="tech-name">${tech.name}</div>
            <div class="tech-cost">${unlocked ? '✓ Unlocked' : tech.cost + ' RP needed'}</div>
            <div class="tech-effect">${tech.effects.effectDesc}</div>
            ${reqText}
            ${actionHtml}
          </div>
          <span class="tech-tier-badge">T${tier}</span>
        </div>`;
    }
    html += '</div></div>';
  }

  document.getElementById('research-tree').innerHTML = html;
}
