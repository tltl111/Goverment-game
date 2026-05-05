// ============================================================
// RENDER — all DOM rendering functions (reads G, writes DOM)
// ============================================================

// World map pan/zoom state (UI state, not game state)
let _mapVB = { x: 0, y: 0, w: 800, h: 560 };
let _mapDrag = null;        // { startClientX, startClientY, startVBX, startVBY, svgW, svgH }
let _mapDragMoved = false;  // distinguishes drag from click
let _mapSelectedNation = null;
let _mapDocListenersAttached = false;

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

  const popCap = getPopulationCap();
  setStatValue('population', fmtPop(G.population),
    G.population / popCap > 0.95 ? 'negative' : G.population / popCap > 0.80 ? 'warning' : 'positive');

  const happiness = G.happiness;
  setStatValue('approval', Math.round(happiness) + '%',
    happiness < 35 ? 'negative' : happiness < 50 ? 'warning' : 'positive');

  const net = getTotalNetIncome();
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
    const cost = getEffectivePolicyCost(id);
    const allocated = getPolicyCost(id);

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
          ${funding}% of income \u2014 ${allocated > 0 ? fmt(allocated) + '/turn allocated' : 'Inactive'}
        </div>
        <div class="policy-effects-hint">${buildEffectsHint(id)}</div>
      </div>`;
  }

  document.getElementById('policies-list').innerHTML = html;
  updateBudgetProjection();
}

function buildEffectsHint(policyId) {
  const tags = {
    infrastructure:  [['↑ Infra level', 'good'], ['↑ GDP growth', 'good'], ['↑ pop cap', 'good']],
    mining:          [['↑ Mining level', 'good'], ['↑ GDP growth', 'good']],
    manufacturing:   [['↑ Mfg level', 'good'], ['↑ GDP growth', 'good'], ['capped by Mining', 'neutral']],
    commerce:        [['↑ Commerce level', 'good'], ['↑ GDP growth', 'good'], ['amplified by Mfg', 'neutral']],
    finance:         [['↑ Finance level', 'good'], ['↓ debt cost', 'good']],
    healthcare:      [['↑ Healthcare level', 'good'], ['↑ pop growth', 'good'], ['↑ happiness', 'good']],
    education:       [['↑ Education level', 'good'], ['↑ GDP growth', 'good'], ['↑ research speed', 'good'], ['↑ happiness', 'good']],
    military:        [['↑ Military level', 'good'], ['↓ happiness', 'bad']],
    research:        [['↑ Research level', 'good'], ['↑ RP/turn', 'good'], ['↑ tech speed', 'good']],
  };
  return (tags[policyId] || [])
    .map(([label, type]) => `<span class="effect-tag effect-tag-${type}">${label}</span>`)
    .join('');
}

function renderDashboard() {
  const tab = G.currentDashboardTab;

  if (tab === 'overview') {
    const happiness = G.happiness;
    const net = getTotalNetIncome();
    const growth = getEffectiveGrowthRate();
    const rp = getRpPerTurn();
    const activeResearchName = G.activeResearch ? TECHNOLOGIES[G.activeResearch].name : 'None';
    const activeResearchPct = G.activeResearch
      ? Math.round((G.researchProgress / TECHNOLOGIES[G.activeResearch].cost) * 100) : 0;

    const tRate = G.treasury < 0 ? getDebtInterestRate() : getSavingsInterestRate();
    const treasuryInterestRaw = G.treasury * tRate;
    const treasuryInterestUnit = tRate > 0
      ? ' (' + (treasuryInterestRaw >= 0 ? '+' : '') + fmt(treasuryInterestRaw) + '/turn, ' + (tRate * 100).toFixed(2) + '%)' : '';

    const popRate = getPopulationGrowthRate();
    const gdpChange = G.gdp * (growth + popRate);
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
        const repairSpend = totalInfraSpend;
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
      { label: 'GDP per Capita',     value: Math.round(G.gdpPerCapita).toLocaleString(), unit: ' index', max: 100, rawPct: Math.min(100, G.gdpPerCapita / 20), type: growth < 0 ? 'neg' : growth < 0.005 ? 'warn' : 'pos' },
      { label: 'Population',         value: fmtPop(G.population), unit: ' / ' + fmtPop(getPopulationCap()) + ' cap', max: 100, rawPct: Math.min(100, (G.population / getPopulationCap()) * 100), type: G.population / getPopulationCap() > 0.95 ? 'neg' : G.population / getPopulationCap() > 0.80 ? 'warn' : 'pos' },
      { label: 'Pop Growth / Turn',  value: (popRate >= 0 ? '+' : '') + (popRate * 100).toFixed(3) + '%', unit: '', max: 100, rawPct: Math.min(100, popRate * 3333), type: popRate < 0 ? 'neg' : popRate < 0.002 ? 'warn' : 'pos' },
      { label: 'GDP Growth / Year', value: (growth >= 0 ? '+' : '') + (growth * 100).toFixed(2) + '%', unit: '', max: 100, rawPct: Math.min(100, growth * 500), type: growth < 0 ? 'neg' : growth < 0.01 ? 'warn' : 'pos' },
      { label: 'Infra Level',        value: Math.round(G.infraLevel) + '/100', unit: ' (' + infraDeltaStr + '/turn)', max: 100, rawPct: G.infraLevel, type: G.infraLevel < 20 ? 'neg' : G.infraLevel < 50 ? 'warn' : 'pos' },
      { label: 'Mining Level',         value: Math.round(G.miningLevel) + '/100',         unit: ' (GDP +' + (0.001 * G.miningLevel / 100 * 100).toFixed(2) + '%)',                                                                                                            max: 100, rawPct: G.miningLevel,         type: G.miningLevel < 20 ? 'neg' : G.miningLevel < 50 ? 'warn' : 'pos' },
      { label: 'Manufacturing Level',  value: Math.round(G.manufacturingLevel) + '/100',  unit: (() => { const eff = Math.min(G.manufacturingLevel, G.miningLevel); return ' (GDP +' + (0.002 * eff / 100 * 100).toFixed(2) + '%)' + (G.manufacturingLevel > G.miningLevel ? ' \u26a0 Mining' : ''); })(), max: 100, rawPct: G.manufacturingLevel,  type: G.manufacturingLevel < 20 ? 'neg' : G.manufacturingLevel < 50 ? 'warn' : 'pos' },
      { label: 'Commerce Level',       value: Math.round(G.commerceLevel) + '/100',       unit: ' (GDP +' + (0.002 * (G.commerceLevel / 100) * (0.5 + 0.5 * Math.min(G.manufacturingLevel, G.miningLevel) / 100) * 100).toFixed(2) + '%)', max: 100, rawPct: G.commerceLevel,       type: G.commerceLevel < 20 ? 'neg' : G.commerceLevel < 50 ? 'warn' : 'pos' },
      { label: 'Finance Level',     value: Math.round(G.financeLevel) + '/100', unit: ' (↓ debt cost)', max: 100, rawPct: G.financeLevel, type: G.financeLevel < 20 ? 'neg' : G.financeLevel < 50 ? 'warn' : 'pos' },
      { label: 'Healthcare Level',   value: Math.round(G.healthcareLevel) + '/100', unit: ' (pop growth +' + (POP_GROWTH_HEALTHCARE_SCALE * G.healthcareLevel / 100 * 100).toFixed(2) + '%/turn)', max: 100, rawPct: G.healthcareLevel, type: G.healthcareLevel < 20 ? 'neg' : G.healthcareLevel < 50 ? 'warn' : 'pos' },
      { label: 'Education Level',    value: Math.round(G.educationLevel) + '/100', unit: ' (GDP +' + (EDUCATION_GDP_GROWTH_MAX * G.educationLevel / 100 * 100).toFixed(2) + '%)', max: 100, rawPct: G.educationLevel, type: G.educationLevel < 20 ? 'neg' : G.educationLevel < 50 ? 'warn' : 'pos' },
      { label: 'Trade Routes',      value: G.tradeRoutes.length, unit: G.tradeRoutes.length > 0 ? ' active (+' + fmt(getTotalTradeIncome()) + '/turn)' : ' active', max: 100, rawPct: Math.min(100, G.tradeRoutes.length * 20), type: G.tradeRoutes.length === 0 ? 'warn' : 'pos' },
      { label: 'Net Income / Turn', value: (net >= 0 ? '+' : '') + fmt(net), unit: '', max: 100, rawPct: Math.min(100, Math.max(0, (net + 2000) / 40)), type: net < 0 ? 'neg' : 'pos' },
      { label: 'Research Level',   value: G.researchLevel.toFixed(1) + ' / ' + getResearchCapacityCeiling(), unit: '', max: 100, rawPct: Math.min(100, (G.researchLevel / getResearchCapacityCeiling()) * 100), type: G.researchLevel === 0 ? 'warn' : 'pos' },
      { label: 'Research Output',   value: '+' + rp.toFixed(1),      unit: ' RP/turn', max: 100, rawPct: Math.min(100, rp * 3), type: rp === 0 ? 'warn' : 'pos' },
      { label: 'Active Research',   value: activeResearchName, unit: '', max: 100, rawPct: activeResearchPct, type: G.activeResearch ? 'pos' : 'warn' },
      { label: 'Military Level',    value: Math.round(G.militaryLevel) + '/100', unit: ' (strength ' + Math.round(getMilitaryStrength()) + ' / ' + Math.round(G.population * MILITARY_MANPOWER_RATIO) + ' cap)', max: 100, rawPct: G.militaryLevel, type: G.militaryLevel === 0 ? 'warn' : 'pos' },
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
    const count   = G.tradeRoutes.length;
    const totalIncome = getTotalTradeIncome();
    const routeIncomeTotal = count > 0 ? ' · +' + fmt(totalIncome) + '/turn' : '';

    let routeListHtml = '';
    if (count === 0) {
      routeListHtml = '<div class="tr-empty">No active routes. Open one to start earning trade income.</div>';
    } else {
      for (const route of G.tradeRoutes) {
        const routeIncome = getTradeRouteIncome(route);
        const maturityPct = Math.min(100, (route.maturity / TRADE_ROUTE_MATURITY_TURNS) * 100).toFixed(0);
        routeListHtml += `
          <div class="tr-route-card">
            <div class="tr-route-info">
              <span class="tr-route-id">Route #${route.id}</span>
              <span class="tr-route-partner">Partner: <em>TBD</em></span>
              <span class="tr-route-age">${route.maturity} turn${route.maturity !== 1 ? 's' : ''} old · ${maturityPct}% mature</span>
            </div>
            <div class="tr-route-right">
              <span class="tr-route-income">+${fmt(routeIncome)}/turn</span>
              <button class="btn-tr-close-route" onclick="closeTradeRoute(${route.id})">✕</button>
            </div>
          </div>`;
      }
    }

    document.getElementById('tab-trade-routes').innerHTML = `
      <div class="trade-routes-card">
        <div class="tr-header">
          <span class="tr-icon">🚢</span>
          <span class="tr-title">Trade Routes</span>
          <span class="tr-slots">${count} active${routeIncomeTotal}</span>
        </div>
        <p class="tr-desc">Routes are free to open. Income ramps from $0 to <strong>+${fmt(TRADE_ROUTE_INCOME_MAX)}/turn</strong> over ${TRADE_ROUTE_MATURITY_TURNS} turns as the route matures. Closing a route resets its maturity.</p>
        <div class="tr-actions">
          <button class="btn-tr-open" onclick="openTradeRoute()">
            Open Route
          </button>
        </div>
        <div class="tr-route-list">${routeListHtml}</div>
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
      { label: 'Population',     key: 'population',        color: 'var(--teal)',   fmt: v => fmtPop(v) },
      { label: 'Infrastructure', key: 'infraLevel',         color: 'var(--blue)',   fmt: v => v.toFixed(1) + '/100' },
      { label: 'Mining',         key: 'miningLevel',         color: 'var(--yellow)', fmt: v => v.toFixed(1) + '/100' },
      { label: 'Manufacturing',  key: 'manufacturingLevel',  color: 'var(--orange)', fmt: v => v.toFixed(1) + '/100' },
      { label: 'Commerce',       key: 'commerceLevel',       color: 'var(--teal)',   fmt: v => v.toFixed(1) + '/100' },
      { label: 'Finance',        key: 'financeLevel',        color: 'var(--green)',  fmt: v => v.toFixed(1) + '/100' },
      { label: 'Healthcare',     key: 'healthcareLevel',     color: 'var(--red)',    fmt: v => v.toFixed(1) + '/100' },
      { label: 'Education',      key: 'educationLevel',      color: 'var(--blue)',   fmt: v => v.toFixed(1) + '/100' },
      { label: 'Military',       key: 'militaryLevel',       color: 'var(--orange)', fmt: v => v.toFixed(1) + '/100' },
      { label: 'Research',       key: 'researchLevel',       color: 'var(--teal)',   fmt: v => v.toFixed(1) + '/' + getResearchCapacityCeiling() },
    ];
    let sectorRows = '';
    for (const sec of sectors) {
      const val = latest ? (latest[sec.key] || 0) : 0;
      const capVal = sec.key === 'population' && latest ? (latest.populationCap || getPopulationCap()) : 100;
      const pct = (val / capVal * 100).toFixed(0);
      const displayVal = sec.fmt ? sec.fmt(val) : val.toFixed(0) + '/100';
      sectorRows += `
        <div class="stat-sector-row">
          <span class="stat-sector-label">${sec.label}</span>
          <div class="stat-sector-bar-bg">
            <div class="stat-sector-bar-fill" style="width:${pct}%;background:${sec.color}"></div>
          </div>
          <span class="stat-sector-val">${displayVal} ${sectorDelta(sec.key)}</span>
        </div>`;
    }

    // Research Tracker
    let researchRows = '';
    if (!latest) {
      researchRows = '<div class="stat-empty">No data yet.</div>';
    } else {
      const techCount = latest.unlockedTechs;
      const resLevel  = G.researchLevel;
      const ceiling   = getResearchCapacityCeiling();
      const rp = getRpPerTurn();
      const activeLabel = G.activeResearch ? TECHNOLOGIES[G.activeResearch].name : '—';
      const activeCost = G.activeResearch ? getTechCost(G.activeResearch) : 0;
      const progressPct = G.activeResearch ? Math.min(100, (G.researchProgress / activeCost) * 100).toFixed(0) : 0;
      researchRows = `
        <div class="stat-research-grid">
          <div class="stat-research-item">
            <div class="stat-research-label">Research Level</div>
            <div class="stat-research-val">${resLevel.toFixed(1)} / ${ceiling}</div>
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

    // World Status — AI nations table
    let nationRows = '';
    for (const [id, nation] of Object.entries(G.nations)) {
      const def = NATIONS[id];
      const relClass = nation.relations >= 65 ? 'stat-pos' : nation.relations <= 35 ? 'stat-neg' : '';
      const relLabel = nation.relations >= 65 ? 'Friendly' : nation.relations <= 35 ? 'Hostile' : 'Neutral';
      const milPct   = nation.militaryLevel.toFixed(0);
      nationRows += `<tr>
        <td>${def.name}</td>
        <td>$${nation.gdp.toFixed(0)}B</td>
        <td>${milPct}</td>
        <td class="${relClass}">${nation.relations.toFixed(0)} — ${relLabel}</td>
      </tr>`;
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
        <div class="stat-section">
          <div class="stat-section-title">World Status</div>
          <table class="stat-ledger-table stat-nations-table">
            <thead>
              <tr><th>Nation</th><th>GDP</th><th>Military</th><th>Relations</th></tr>
            </thead>
            <tbody>${nationRows}</tbody>
          </table>
        </div>
      </div>`;
  }

  if (tab === 'research') {
    const rp = getRpPerTurn();
    const ceiling = getResearchCapacityCeiling();
    const tiers = [1, 2, 3, 4];
    let html = `
      <div class="research-tab-header">
        <span class="research-tab-stat">🔬 Research level ${G.researchLevel.toFixed(1)} / ${ceiling}</span>
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
        const turnsLeft     = isActive ? getTurnsToComplete(id) : (rp > 0 ? getTurnsToComplete(id) : null);

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
          const turnsRemaining = getTurnsToComplete(id);
          const turnsLabel = isFinite(turnsRemaining) ? '~' + turnsRemaining + ' turns left' : '—';
          actionHtml = `
            <div class="tech-progress-wrap">
              <div class="tech-progress-bar-bg"><div class="tech-progress-bar-fill" style="width:${progressPct}%"></div></div>
              <div class="tech-progress-label">${progressPct}% &nbsp;·&nbsp; ${turnsLabel}</div>
            </div>
            <button class="btn-cancel-research" onclick="setActiveResearch('${id}')">Cancel</button>`;
        } else if (available && !busyElsewhere) {
          actionHtml = `<button class="btn-start-research" onclick="setActiveResearch('${id}')">&#128300; Research</button>`;
        }

        const costDisplay = unlocked ? '✓ Unlocked'
          : isActive ? ''
          : (turnsLeft !== null ? '~' + turnsLeft + ' turns' : 'Fund Research first');

        html += `
          <div class="${cls}" title="${tech.description}">
            <span class="tech-icon">${tech.icon}</span>
            <div class="tech-info">
              <div class="tech-name">${tech.name}</div>
              <div class="tech-cost">${costDisplay}</div>
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
    // Group projects by category for display
    const categoryOrder  = ['research', 'infrastructure'];
    const categoryLabels = { research: 'Research Projects', infrastructure: 'Infrastructure Megaprojects' };
    const categorySubs   = {
      research:       'Direct treasury investments \u00b7 raises Research capacity ceiling',
      infrastructure: 'Direct treasury investments \u00b7 permanent empire-wide effects',
    };

    const grouped = {};
    for (const [id, proj] of Object.entries(PROJECTS)) {
      const cat = proj.category || 'other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push([id, proj]);
    }

    let sectionsHtml = '';
    // Determine which infra project (if any) is currently being funded
    const activeInfraId = Object.keys(G.projectFunding).find(
      id => PROJECTS[id] && PROJECTS[id].category === 'infrastructure' && G.projectFunding[id] > 0
    ) || null;

    for (const cat of categoryOrder) {
      if (!grouped[cat]) continue;
      let cardsHtml = '';
      for (const [id, proj] of grouped[cat]) {
        const completed = G.completedProjects.includes(id);
        const progress  = G.projectProgress[id] || 0;
        const pct       = completed ? 100 : Math.min(100, (progress / proj.cost) * 100);
        const funding   = G.projectFunding[id] || 0;

        // Support array or string techRequired
        const techReq = proj.techRequired;
        let locked   = false;
        let techName = null;
        if (techReq) {
          if (Array.isArray(techReq)) {
            locked   = !techReq.some(t => G.unlockedTechs.includes(t));
            techName = techReq.map(t => TECHNOLOGIES[t].name).join(' or ');
          } else {
            locked   = !G.unlockedTechs.includes(techReq);
            techName = TECHNOLOGIES[techReq].name;
          }
        }

        // Infra projects are blocked when a different infra project is already active
        const infraBlocked = !completed && !locked && proj.category === 'infrastructure'
          && activeInfraId !== null && activeInfraId !== id;

        const turnsLeft = (!completed && !locked && funding > 0)
          ? Math.ceil((proj.cost - progress) / funding) : null;

        const cardCls = 'project-card' + (completed ? ' project-complete' : locked ? ' project-locked' : funding > 0 ? ' project-active' : '');

        const progressBar = `
          <div class="project-progress-wrap">
            <div class="project-progress-bar-bg">
              <div class="project-progress-bar-fill" style="width:${pct}%"></div>
            </div>
            <div class="project-progress-label">
              ${completed ? 'Complete' : ('$' + Math.floor(progress) + 'M / $' + proj.cost + 'M' + (turnsLeft !== null ? ' \u00b7 ~' + turnsLeft + ' turns' : ''))}
            </div>
          </div>`;

        const fundingHtml = completed ? '' : locked
          ? `<div class="project-locked-reason">Requires: ${techName}</div>`
          : infraBlocked
          ? `<div class="project-locked-reason">Another megaproject is in progress</div>`
          : `<div class="project-funding-row">
              <label class="project-funding-label">$/turn investment:</label>
              <input type="number" class="project-funding-input" min="0" step="10" value="${funding}"
                onchange="setProjectFunding('${id}', this.value)">
            </div>`;

        cardsHtml += `
          <div class="${cardCls}">
            <div class="project-header">
              <span class="project-icon">${proj.icon}</span>
              <span class="project-name">${proj.name}</span>
              ${completed ? '<span class="project-badge-done">\u2713 Done</span>' : (locked ? '<span class="project-badge-locked">\ud83d\udd12 Locked</span>' : '')}
            </div>
            <p class="project-desc">${proj.description}</p>
            <div class="project-effect">${proj.effects.effectDesc}</div>
            ${progressBar}
            ${fundingHtml}
          </div>`;
      }

      sectionsHtml += `
        <div class="projects-section">
          <div class="projects-header">
            <span class="projects-title">${categoryLabels[cat] || cat}</span>
            <span class="projects-sub">${categorySubs[cat] || ''}</span>
          </div>
          ${cardsHtml}
        </div>`;
    }

    document.getElementById('tab-buildings').innerHTML = `
      <div class="projects-panel">${sectionsHtml}</div>`;
  }

  if (tab === 'world') {
    renderWorldMap();
  }
}

// ============================================================
// WORLD MAP
// ============================================================

function renderWorldMap() {
  const panelEl = document.getElementById('tab-world');
  if (!panelEl) return;

  const vbStr = `${_mapVB.x.toFixed(1)} ${_mapVB.y.toFixed(1)} ${_mapVB.w.toFixed(1)} ${_mapVB.h.toFixed(1)}`;

  // --- Build SVG ---
  let svg = '';
  // Ocean background (extends beyond viewBox to cover pan)
  svg += `<rect x="-200" y="-200" width="1200" height="960" fill="#0a1422"/>`;

  // Nation regions
  for (const [id, region] of Object.entries(MAP_REGIONS)) {
    if (id === 'player') continue;
    const ns = G.nations[id];
    if (!ns) continue;
    const sel    = _mapSelectedNation === id ? ' map-region-selected' : '';
    const relCls = ns.relations >= 65 ? ' map-region-friendly' : ns.relations <= 35 ? ' map-region-hostile' : '';
    svg += `<polygon class="map-region${relCls}${sel}" points="${region.points}" fill="${region.color}" onclick="selectMapNation('${id}')"/>`;
    svg += `<text class="map-label" x="${region.labelX}" y="${region.labelY}">${NATIONS[id].name}</text>`;
    svg += `<circle class="map-capital" cx="${region.capitalX}" cy="${region.capitalY}" r="3"/>`;
  }

  // Player empire provinces
  const pr = MAP_REGIONS.player;
  for (const prov of Object.values(pr.provinces)) {
    svg += `<polygon class="map-province" points="${prov.points}" fill="${prov.color}"/>`;
    svg += `<text class="map-province-label" x="${prov.labelX}" y="${prov.labelY}">${prov.name}</text>`;
  }
  svg += `<text class="map-label map-player-label" x="${pr.labelX}" y="${pr.labelY}">${G.empire}</text>`;
  svg += `<circle class="map-capital map-player-capital" cx="${pr.capitalX}" cy="${pr.capitalY}" r="4"/>`;

  // --- Info panel for selected nation ---
  let infoHtml = '';
  if (_mapSelectedNation && G.nations[_mapSelectedNation]) {
    const ns  = G.nations[_mapSelectedNation];
    const def = NATIONS[_mapSelectedNation];
    const reg = MAP_REGIONS[_mapSelectedNation];
    const relLabel = ns.relations >= 65 ? 'Friendly' : ns.relations <= 35 ? 'Hostile' : 'Neutral';
    const relCls   = ns.relations >= 65 ? 'stat-pos'  : ns.relations <= 35 ? 'stat-neg'  : '';
    const borders  = (def.adjacency || []).map(a => a === 'player' ? G.empire : (NATIONS[a] ? NATIONS[a].name : a)).join(', ');
    infoHtml = `
      <div class="map-info-panel">
        <div class="map-info-nation" style="border-left:3px solid ${reg.color}">
          <span class="map-info-name">${def.name}</span>
        </div>
        <div class="map-info-grid">
          <div class="map-info-item"><div class="map-info-label">GDP</div><div class="map-info-val">$${ns.gdp.toFixed(0)}B</div></div>
          <div class="map-info-item"><div class="map-info-label">Military</div><div class="map-info-val">${ns.militaryLevel.toFixed(0)} / 100</div></div>
          <div class="map-info-item"><div class="map-info-label">Relations</div><div class="map-info-val ${relCls}">${ns.relations.toFixed(0)} \u2014 ${relLabel}</div></div>
          <div class="map-info-item map-info-item-wide"><div class="map-info-label">Borders</div><div class="map-info-val">${borders}</div></div>
        </div>
      </div>`;
  }

  panelEl.innerHTML = `
    <div class="world-map-container">
      <svg id="world-map-svg" viewBox="${vbStr}" preserveAspectRatio="xMidYMid meet" class="world-map-svg">
        ${svg}
      </svg>
      ${infoHtml}
    </div>`;

  initMapInteraction();
}

function selectMapNation(id) {
  if (_mapDragMoved) return;
  _mapSelectedNation = (_mapSelectedNation === id) ? null : id;
  renderWorldMap();
}

function initMapInteraction() {
  const svg = document.getElementById('world-map-svg');
  if (!svg) return;
  svg.addEventListener('wheel', _mapOnWheel, { passive: false });
  svg.addEventListener('mousedown', _mapOnMouseDown);
  if (!_mapDocListenersAttached) {
    document.addEventListener('mousemove', _mapOnMouseMove);
    document.addEventListener('mouseup', _mapOnMouseUp);
    _mapDocListenersAttached = true;
  }
}

function _mapOnWheel(e) {
  e.preventDefault();
  const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
  const rect = e.currentTarget.getBoundingClientRect();
  const mx = (e.clientX - rect.left) / rect.width;
  const my = (e.clientY - rect.top) / rect.height;
  const cx = _mapVB.x + mx * _mapVB.w;
  const cy = _mapVB.y + my * _mapVB.h;
  _mapVB.w = Math.max(120, Math.min(1200, _mapVB.w * factor));
  _mapVB.h = _mapVB.w * (560 / 800);
  _mapVB.x = cx - mx * _mapVB.w;
  _mapVB.y = cy - my * _mapVB.h;
  _updateMapViewBox();
}

function _mapOnMouseDown(e) {
  if (e.button !== 0) return;
  e.preventDefault();
  const rect = e.currentTarget.getBoundingClientRect();
  _mapDrag = { startClientX: e.clientX, startClientY: e.clientY,
               startVBX: _mapVB.x, startVBY: _mapVB.y,
               svgW: rect.width, svgH: rect.height };
  _mapDragMoved = false;
}

function _mapOnMouseMove(e) {
  if (!_mapDrag) return;
  const dx = e.clientX - _mapDrag.startClientX;
  const dy = e.clientY - _mapDrag.startClientY;
  if (!_mapDragMoved && Math.abs(dx) + Math.abs(dy) < 5) return;
  _mapDragMoved = true;
  _mapVB.x = _mapDrag.startVBX - (dx / _mapDrag.svgW) * _mapVB.w;
  _mapVB.y = _mapDrag.startVBY - (dy / _mapDrag.svgH) * _mapVB.h;
  _updateMapViewBox();
}

function _mapOnMouseUp() {
  _mapDrag = null;
}

function _updateMapViewBox() {
  const svg = document.getElementById('world-map-svg');
  if (svg) svg.setAttribute('viewBox',
    `${_mapVB.x.toFixed(1)} ${_mapVB.y.toFixed(1)} ${_mapVB.w.toFixed(1)} ${_mapVB.h.toFixed(1)}`);
}
