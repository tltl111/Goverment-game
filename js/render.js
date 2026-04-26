// ============================================================
// RENDER — all DOM rendering functions (reads G, writes DOM)
// ============================================================

function renderAll() {
  renderHeader();
  renderPolicies();
  renderDashboard();
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
}

function buildEffectsHint(policyId, effects) {
  if (policyId === 'infrastructure') {
    const lvl         = G.infraLevel;
    const income      = getTaxIncome();
    const decay       = (income * INFRA_MAINTAIN_FRAC / (1 + INFRA_REPAIR_HARDNESS * lvl)).toFixed(1);
    const maintainPct = (INFRA_MAINTAIN_FRAC * 100).toFixed(0);
    const currentGdpPct = (effects.gdpGrowth * (lvl / 100) * 100).toFixed(2);
    const lvlClass    = lvl < 20 ? 'effect-bad' : lvl < 50 ? 'effect-warn' : 'effect-good';
    return [
      `<span class="${lvlClass}">Level ${Math.round(lvl)}/100 → GDP +${currentGdpPct}%</span>`,
      `<span class="effect-bad">−${decay} lvl/turn decay</span>`,
      `<span class="effect-warn">~${maintainPct}% income to maintain</span>`,
    ].join(' · ');
  }
  // Economic sector policies — show level, effect, decay, and net growth preview
  if (policyId === 'mining' || policyId === 'manufacturing' || policyId === 'commerce' || policyId === 'finance') {
    const levelKey = policyId + 'Level';
    const lvl = G[levelKey];
    const lvlClass = lvl < 20 ? 'effect-bad' : lvl < 50 ? 'effect-warn' : 'effect-good';
    const funding = G.policyFunding[policyId] || 0;
    let effectStr = '';
    if (policyId === 'mining') {
      effectStr = 'GDP +' + (0.001 * lvl / 100 * 100).toFixed(2) + '%';
    }
    if (policyId === 'manufacturing') {
      const effectiveMfgLevel = Math.min(G.manufacturingLevel, G.miningLevel);
      effectStr = 'Effective ' + Math.round(effectiveMfgLevel) + '/100 => GDP +' + (0.002 * effectiveMfgLevel / 100 * 100).toFixed(2) + '%';
    }
    if (policyId === 'commerce') {
      const effectiveMfgLevel = Math.min(G.manufacturingLevel, G.miningLevel);
      effectStr = 'GDP +' + (0.002 * (lvl / 100) * (0.5 + 0.5 * effectiveMfgLevel / 100) * 100).toFixed(2) + '%';
    }
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
    let importWarning = '';
    if (policyId === 'manufacturing' && G.manufacturingLevel > G.miningLevel) {
      const importCost = (G.manufacturingLevel - G.miningLevel) * MANUFACTURING_IMPORT_COST_PER_LEVEL;
      importWarning = ' · <span class="effect-bad">Import -' + importCost.toFixed(1) + ' $M/turn</span>';
    }
    return `<span class="${lvlClass}">Level ${Math.round(lvl)}/100 => ${effectStr}</span>${netStr}${importWarning}`;
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
    {
      const _te = getTechEffects();
      const infraDecay = getTaxIncome() * INFRA_MAINTAIN_FRAC / (1 + INFRA_REPAIR_HARDNESS * G.infraLevel) * _te.infraDecayMult;
      if (G.policyFunding.infrastructure > 0) {
        const totalInfraSpend = getTaxIncome() * (G.policyFunding.infrastructure / 100);
        const repairSpend = G.buildingResearchCentre
          ? totalInfraSpend * (1 - G.researchCentreBuildFraction / 100)
          : totalInfraSpend;
        const repairRate = INFRA_REPAIR_PER_M / (1 + INFRA_REPAIR_HARDNESS * G.infraLevel) * _te.infraGrowthMult;
        const infraUnclamped = G.infraLevel + repairSpend * repairRate - infraDecay;
        infraDelta = Math.min(100, Math.max(0, infraUnclamped)) - G.infraLevel;
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
      { label: 'Mining Level',         value: Math.round(G.miningLevel) + '/100',         unit: ' (GDP +' + (0.001 * G.miningLevel / 100 * 100).toFixed(2) + '%)',                                                                                                            max: 100, rawPct: G.miningLevel,         type: G.miningLevel < 20 ? 'neg' : G.miningLevel < 50 ? 'warn' : 'pos' },
      { label: 'Manufacturing Level',  value: Math.round(G.manufacturingLevel) + '/100',  unit: (() => { const eff = Math.min(G.manufacturingLevel, G.miningLevel); return ' (GDP +' + (0.002 * eff / 100 * 100).toFixed(2) + '%)' + (G.manufacturingLevel > G.miningLevel ? ' \u26a0 Mining' : ''); })(), max: 100, rawPct: G.manufacturingLevel,  type: G.manufacturingLevel < 20 ? 'neg' : G.manufacturingLevel < 50 ? 'warn' : 'pos' },
      { label: 'Commerce Level',       value: Math.round(G.commerceLevel) + '/100',       unit: ' (GDP +' + (0.002 * (G.commerceLevel / 100) * (0.5 + 0.5 * Math.min(G.manufacturingLevel, G.miningLevel) / 100) * 100).toFixed(2) + '%)', max: 100, rawPct: G.commerceLevel,       type: G.commerceLevel < 20 ? 'neg' : G.commerceLevel < 50 ? 'warn' : 'pos' },
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

  if (tab === 'trade-routes') {
    const slots   = getTradeRouteSlots();
    const income  = getTradeRouteIncomePerRoute();
    const canOpen = G.tradeRoutes < slots && G.treasury >= TRADE_ROUTE_COST;
    const canClose = G.tradeRoutes > 0;
    const slotsColor = slots === 0 ? 'var(--text-3)' : 'var(--teal)';
    const routeIncomeTotal = G.tradeRoutes > 0 ? ' · +' + fmt(G.tradeRoutes * income) + '/turn' : '';
    document.getElementById('tab-trade-routes').innerHTML = `
      <div class="trade-routes-card">
        <div class="tr-header">
          <span class="tr-icon">🚢</span>
          <span class="tr-title">Trade Routes</span>
          <span class="tr-slots" style="color:${slotsColor}">${G.tradeRoutes}/${slots} active${routeIncomeTotal}</span>
        </div>
        <p class="tr-desc">Each route costs <strong>${fmt(TRADE_ROUTE_COST)}</strong> treasury to open and earns <strong>+${fmt(income)}/turn</strong> (scales with Finance level). Unlock route slots by raising Finance to level ${TRADE_ROUTE_LEVEL_NEEDED}, ${TRADE_ROUTE_LEVEL_NEEDED * 2}, ${TRADE_ROUTE_LEVEL_NEEDED * 3}…</p>
        <div class="tr-actions">
          <button class="btn-tr-open${canOpen ? '' : ' disabled'}" onclick="openTradeRoute()" ${canOpen ? '' : 'disabled'}>
            Open Route (−${fmt(TRADE_ROUTE_COST)})
          </button>
          <button class="btn-tr-close${canClose ? '' : ' disabled'}" onclick="closeTradeRoute()" ${canClose ? '' : 'disabled'}>
            Close Route
          </button>
        </div>
        ${slots === 0 ? '<div class="tr-hint">Raise Finance level to ' + TRADE_ROUTE_LEVEL_NEEDED + ' to unlock your first route slot.</div>' : ''}
      </div>`;
  }

  if (tab === 'statistics') {
    const h = G.history;
    const noData = h.length === 0;

    // Helper: format a number with sign
    const fmtDelta = v => (v >= 0 ? '+' : '') + fmt(v);

    // Economy Ledger — last 10 turns
    let ledgerRows = '';
    if (noData) {
      ledgerRows = '<tr><td colspan="5" class="stat-empty">No data yet — end a turn to begin recording.</td></tr>';
    } else {
      const slice = h.slice(-10).reverse();
      for (const s of slice) {
        const netClass = s.netIncome >= 0 ? 'stat-pos' : 'stat-neg';
        ledgerRows += `<tr>
          <td>${s.year}</td>
          <td>$${s.gdp.toFixed(2)}B</td>
          <td>${fmt(s.taxIncome)}</td>
          <td>${fmt(s.totalExpenses)}</td>
          <td class="${netClass}">${fmtDelta(s.netIncome)}</td>
        </tr>`;
      }
    }

    // Sector Status — latest snapshot
    const latest = h.length > 0 ? h[h.length - 1] : null;
    const prevTwo = h.length > 1 ? h[h.length - 2] : null;
    const sectorDelta = (key) => {
      if (!latest || !prevTwo) return '';
      const d = latest[key] - prevTwo[key];
      if (Math.abs(d) < 0.01) return '<span class="stat-neutral">→</span>';
      return d > 0 ? '<span class="stat-pos">▲' + d.toFixed(1) + '</span>' : '<span class="stat-neg">▼' + Math.abs(d).toFixed(1) + '</span>';
    };
    const sectors = [
      { label: 'Infrastructure', key: 'infraLevel',         color: 'var(--blue)' },
      { label: 'Mining',         key: 'miningLevel',         color: 'var(--yellow)' },
      { label: 'Manufacturing',  key: 'manufacturingLevel',  color: 'var(--orange)' },
      { label: 'Commerce',       key: 'commerceLevel',       color: 'var(--teal)' },
      { label: 'Finance',        key: 'financeLevel',        color: 'var(--green)' },
    ];
    let sectorRows = '';
    for (const sec of sectors) {
      const val = latest ? latest[sec.key] : 0;
      const pct = val.toFixed(0);
      sectorRows += `
        <div class="stat-sector-row">
          <span class="stat-sector-label">${sec.label}</span>
          <div class="stat-sector-bar-bg">
            <div class="stat-sector-bar-fill" style="width:${pct}%;background:${sec.color}"></div>
          </div>
          <span class="stat-sector-val">${pct}/100 ${sectorDelta(sec.key)}</span>
        </div>`;
    }

    // Research Tracker
    let researchRows = '';
    if (!latest) {
      researchRows = '<div class="stat-empty">No data yet.</div>';
    } else {
      const techCount = latest.unlockedTechs;
      const centres = latest.researchCentres;
      const rp = getRpPerTurn();
      const activeLabel = G.activeResearch ? TECHNOLOGIES[G.activeResearch].name : '—';
      const activeCost = G.activeResearch ? getTechCost(G.activeResearch) : 0;
      const progressPct = G.activeResearch ? Math.min(100, (G.researchProgress / activeCost) * 100).toFixed(0) : 0;
      researchRows = `
        <div class="stat-research-grid">
          <div class="stat-research-item">
            <div class="stat-research-label">Research Centres</div>
            <div class="stat-research-val">${centres}</div>
          </div>
          <div class="stat-research-item">
            <div class="stat-research-label">RP / Turn</div>
            <div class="stat-research-val">${rp.toFixed(1)}</div>
          </div>
          <div class="stat-research-item">
            <div class="stat-research-label">Techs Unlocked</div>
            <div class="stat-research-val">${techCount}</div>
          </div>
          <div class="stat-research-item">
            <div class="stat-research-label">Active Research</div>
            <div class="stat-research-val stat-research-active">${activeLabel}</div>
          </div>
        </div>
        ${G.activeResearch ? `
        <div class="stat-research-progress-wrap">
          <div class="stat-research-progress-label">Progress: ${progressPct}%</div>
          <div class="stat-research-bar-bg">
            <div class="stat-research-bar-fill" style="width:${progressPct}%"></div>
          </div>
        </div>` : ''}`;
    }

    document.getElementById('tab-statistics').innerHTML = `
      <div class="statistics-panel">
        <div class="stat-section">
          <div class="stat-section-title">Economy Ledger <span class="stat-section-sub">(last 10 turns)</span></div>
          <table class="stat-ledger-table">
            <thead>
              <tr>
                <th>Year</th><th>GDP</th><th>Income</th><th>Expenses</th><th>Net</th>
              </tr>
            </thead>
            <tbody>${ledgerRows}</tbody>
          </table>
        </div>
        <div class="stat-section">
          <div class="stat-section-title">Sector Status</div>
          <div class="stat-sectors">${sectorRows}</div>
        </div>
        <div class="stat-section">
          <div class="stat-section-title">Research Tracker</div>
          ${researchRows}
        </div>
      </div>`;
  }

  if (tab === 'research') {
    const rp = getRpPerTurn();
    const tiers = [1, 2, 3, 4];
    let html = `
      <div class="research-tab-header">
        <span class="research-tab-stat">🏗️ ${G.researchCentres} centre${G.researchCentres !== 1 ? 's' : ''}</span>
        <span class="research-tab-stat">+${rp.toFixed(1)} RP/turn</span>
      </div>
      <div class="research-tab-tree">`;

    for (const tier of tiers) {
      html += `<div class="research-tier"><div class="tier-label">Tier ${tier}</div><div class="tier-techs">`;
      for (const [id, tech] of Object.entries(TECHNOLOGIES)) {
        if (tech.tier !== tier) continue;
        const unlocked      = G.unlockedTechs.includes(id);
        const reqMet        = tech.requires.every(r => G.unlockedTechs.includes(r));
        const isActive      = G.activeResearch === id;
        const busyElsewhere = !!G.activeResearch && !isActive;
        const available     = !unlocked && reqMet;
        const effectiveCost = getTechCost(id);
        const progressPct   = isActive ? Math.min(100, (G.researchProgress / effectiveCost) * 100).toFixed(1) : 0;

        let cls = 'tech-card ';
        if (unlocked)           cls += 'tech-unlocked';
        else if (isActive)      cls += 'tech-available tech-researching';
        else if (!reqMet)       cls += 'tech-locked';
        else if (busyElsewhere) cls += 'tech-available tech-busy';
        else                    cls += 'tech-available';

        const missingReqs = tech.requires.filter(r => !G.unlockedTechs.includes(r));
        const reqText = missingReqs.length > 0 && !unlocked
          ? `<div class="tech-req">Req: ${missingReqs.map(r => TECHNOLOGIES[r].name).join(', ')}</div>` : '';

        let actionHtml = '';
        if (isActive) {
          actionHtml = `
            <div class="tech-progress-wrap">
              <div class="tech-progress-bar-bg"><div class="tech-progress-bar-fill" style="width:${progressPct}%"></div></div>
              <div class="tech-progress-label">${Math.floor(G.researchProgress)} / ${effectiveCost} RP</div>
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
              <div class="tech-cost">${unlocked ? '✓ Unlocked' : effectiveCost + ' RP needed'}</div>
              <div class="tech-effect">${tech.effects.effectDesc}</div>
              ${reqText}
              ${actionHtml}
            </div>
            <span class="tech-tier-badge">T${tier}</span>
          </div>`;
      }
      html += '</div></div>';
    }

    html += '</div>';
    document.getElementById('tab-research').innerHTML = html;
  }

  if (tab === 'buildings') {
    const infraFunded     = G.policyFunding.infrastructure > 0;
    const totalInfraSpend = getTaxIncome() * (G.policyFunding.infrastructure / 100);
    const buildFrac       = G.researchCentreBuildFraction / 100;
    const buildSpendPT    = totalInfraSpend * buildFrac;
    const progressPct     = Math.min(100, (G.researchCentreBuildProgress / RESEARCH_CENTRE_BUILD_COST) * 100).toFixed(1);
    const turnsLeft       = (buildSpendPT > 0 && G.buildingResearchCentre)
      ? Math.ceil((RESEARCH_CENTRE_BUILD_COST - G.researchCentreBuildProgress) / buildSpendPT)
      : '—';

    const toggleCls   = G.buildingResearchCentre ? 'btn-toggle-research-centre active' : 'btn-toggle-research-centre';
    const toggleLabel = G.buildingResearchCentre ? 'Building…' : 'Build';
    const hint = !infraFunded && !G.buildingResearchCentre
      ? '<div class="build-research-centre-hint">Requires infrastructure funding</div>' : '';

    const splitSliderHtml = G.buildingResearchCentre ? `
      <div class="build-split-row">
        <label class="build-split-label">Construction split</label>
        <div class="build-split-controls">
          <span class="build-split-val">Repair ${100 - G.researchCentreBuildFraction}%</span>
          <input type="range" min="0" max="100" step="5" value="${G.researchCentreBuildFraction}"
            oninput="setResearchCentreBuildFraction(this.value)" class="build-split-slider">
          <span class="build-split-val">Build ${G.researchCentreBuildFraction}%</span>
        </div>
        <div class="build-split-hint">+$${Math.round(buildSpendPT)}M/turn to construction · +$${Math.round(totalInfraSpend - buildSpendPT)}M/turn to repair</div>
      </div>` : '';

    const progressHtml = G.buildingResearchCentre ? `
      <div class="build-progress-wrap">
        <div class="build-progress-bar-bg"><div class="build-progress-bar-fill" style="width:${progressPct}%"></div></div>
        <div class="build-progress-label">$${Math.floor(G.researchCentreBuildProgress)}M / $${RESEARCH_CENTRE_BUILD_COST}M &nbsp;·&nbsp; ~${turnsLeft} turns left</div>
      </div>` : '';

    document.getElementById('tab-buildings').innerHTML = `
      <div class="buildings-tab-panel">
        <div class="build-research-centre-row">
          <div class="build-research-centre-info">
            <span class="build-research-centre-title">🏗️ Research Centre</span>
            <span class="build-research-centre-sub">Split infra budget between construction and repair · $${RESEARCH_CENTRE_BUILD_COST}M total</span>
          </div>
          <button class="${toggleCls}" onclick="toggleBuildResearchCentre()">${toggleLabel}</button>
        </div>
        ${splitSliderHtml}
        ${progressHtml}
        ${hint}
      </div>`;
  }
}
