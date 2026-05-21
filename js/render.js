// ============================================================
// RENDER — all DOM rendering functions (reads G, writes DOM)
// ============================================================

// World map pan/zoom state (UI state, not game state)
let _mapVB = { x: 0, y: 0, w: 800, h: 560 };
let _mapDrag = null;        // { startClientX, startClientY, startVBX, startVBY, svgW, svgH }
let _mapDragMoved = false;  // distinguishes drag from click
let _mapSelectedNation = null;
let _mapDocListenersAttached = false;

// ============================================================
// NEGOTIATION PANEL — shared helper, used in trade tab + map panel
// ============================================================

// Returns {label, cssClass} for a relations score in the range -100 to +100.
function getRelationsTier(score) {
  if (score >= 60)  return { label: 'Allied',   cssClass: 'rel-allied'   };
  if (score >= 20)  return { label: 'Friendly',  cssClass: 'rel-friendly' };
  if (score > -20)  return { label: 'Neutral',   cssClass: 'rel-neutral'  };
  if (score > -60)  return { label: 'Tense',     cssClass: 'rel-tense'    };
  return              { label: 'Hostile',   cssClass: 'rel-hostile'  };
}

function _buildNegotiationPanel(neg) {
  const def      = NATIONS[neg.nationId];
  const ns       = G.nations[neg.nationId];
  const leverage = getTradeNegotiationLeverage(neg.nationId);
  const leverStr = leverage >= 1.5 ? 'Strong' : leverage >= 0.8 ? 'Neutral' : 'Weak';
  const leverCls = leverage >= 1.5 ? 'stat-pos' : leverage < 0.8 ? 'stat-neg' : '';
  const { label: relLabel, cssClass: relCls } = getRelationsTier(ns.relations);
  const fmt2     = v => fmt(v);

  // Build a table showing what the nation wants and what the player can currently supply/sell.
  function _resourceProfileRows(sectionLabel, profileKey) {
    const profile     = def.trade[profileKey] || {};
    const playerOut   = getPlayerResourceOutput();
    const rows = Object.entries(profile).map(([rid, mult]) => {
      const maxVol    = Math.max(1, Math.round(TRADE_VOLUME_BASE * mult));
      const rt        = RESOURCE_TYPES[rid];
      if (!rt) return '';
      if (profileKey === 'demandByResource') {
        const available = playerOut[rid] || 0;
        const canExport = Math.min(available, maxVol);
        const cls       = canExport > 0 ? 'stat-pos' : 'stat-neg';
        return `<div class="neg-res-row">
          <span class="neg-res-icon">${rt.icon}</span>
          <span class="neg-res-name">${rt.name}</span>
          <span class="neg-res-cap">wants up to ${maxVol} Mt</span>
          <span class="neg-res-avail ${cls}">${canExport > 0 ? 'you have ' + available + ' Mt' : 'none produced'}</span>
        </div>`;
      } else {
        const playerHas  = playerOut[rid] || 0;
        const shortfall  = Math.max(0, maxVol - playerHas);
        const cls        = shortfall > 0 ? 'stat-pos' : 'effect-neutral';
        return `<div class="neg-res-row">
          <span class="neg-res-icon">${rt.icon}</span>
          <span class="neg-res-name">${rt.name}</span>
          <span class="neg-res-cap">offers up to ${maxVol} Mt</span>
          <span class="neg-res-avail ${cls}">${shortfall > 0 ? 'saves ' + shortfall + ' Mt import' : 'you produce this'}</span>
        </div>`;
      }
    }).filter(Boolean).join('');
    return rows ? `<div class="neg-section-label">${sectionLabel}</div>${rows}` : '';
  }

  if (neg.status === 'drafting') {
    // Estimate income at base quality + tech bonuses, full maturity for preview
    const te_prev     = getTechEffects();
    const previewQuality  = Math.min(TRADE_OFFER_QUALITY_MAX, TRADE_OFFER_QUALITY_BASE + te_prev.tradeExportQualityBonus);
    const previewImportQ  = Math.max(0.1, TRADE_IMPORT_PRICE_BASE - te_prev.tradeImportPriceReduction);
    const previewRoute    = { nationId: neg.nationId, exportQuality: previewQuality, importQuality: previewImportQ, maturity: TRADE_ROUTE_MATURITY_TURNS };
    const estExport  = getTradeRouteExportIncome(previewRoute);
    const estImport  = getTradeRouteImportSaving(previewRoute);
    const estTotal   = estExport + estImport;

    const threatened    = neg.threatenNext;
    const threatRelCost = getPushRelationsCost(0, true);
    const threatCollapse = getPushCollapseRisk(neg.nationId, 0, true);
    const threatColCls  = threatCollapse >= 0.3 ? 'stat-neg' : threatCollapse >= 0.1 ? 'effect-neutral' : 'stat-pos';
    const threatQBonus  = (TRADE_OFFER_QUALITY_THREATEN * 100).toFixed(0);

    const exportSection = _resourceProfileRows('They buy (your exports)', 'demandByResource');
    const importSection = _resourceProfileRows('They sell (your imports)', 'supplyByResource');

    return `<div class="neg-panel">
      <div class="neg-header">
        <span class="neg-title">Negotiating with ${def.name}</span>
        <span class="neg-badge">Drafting</span>
      </div>
      <div class="neg-meta">
        Relations: <span class="${relCls}">${ns.relations.toFixed(0)} — ${relLabel}</span>
        &nbsp;·&nbsp; Leverage: <span class="${leverCls}">${leverStr} (${leverage.toFixed(2)}×)</span>
      </div>
      ${exportSection}
      ${importSection}
      ${estTotal > 0 ? `<div class="neg-income-hint">Est. at base quality, full maturity: <span class="stat-pos">+${fmt2(estExport)}/turn</span> export${estImport > 0 ? ` + <span class="stat-pos">+${fmt2(estImport)}/turn</span> import savings` : ''}</div>` : '<div class="neg-income-hint stat-neg">No deposits yet — trade income requires producing resources.</div>'}
      <div class="neg-push-section">
        <label class="neg-threat-toggle">
          <input type="checkbox" ${threatened ? 'checked' : ''} onchange="toggleNegotiationThreat()">
          Include Threat <span class="neg-threat-hint">(+${threatQBonus}% quality, Relations −${threatRelCost}, Collapse ${(threatCollapse * 100).toFixed(0)}%)</span>
        </label>
      </div>
      <div class="neg-actions">
        <button class="btn btn-green" onclick="proposeTradeOffer()">Propose Offer</button>
        <button class="btn btn-muted" onclick="cancelTradeNegotiation()">Cancel</button>
      </div>
    </div>`;
  }

  if (neg.status === 'awaiting') {
    return `<div class="neg-panel">
      <div class="neg-header">
        <span class="neg-title">Negotiating with ${def.name}</span>
        <span class="neg-badge neg-badge-wait">Awaiting…</span>
      </div>
      <div class="neg-waiting">Offer sent — ${def.name} will respond at end of turn.</div>
      <div class="neg-actions">
        <button class="btn btn-muted" onclick="cancelTradeNegotiation()">Cancel</button>
      </div>
    </div>`;
  }

  if (neg.status === 'countered') {
    const offer         = neg.nationOffer;
    const projRoute     = { nationId: neg.nationId, exportQuality: offer.exportQuality, importQuality: offer.importQuality, maturity: TRADE_ROUTE_MATURITY_TURNS };
    const projExport    = getTradeRouteExportIncome(projRoute);
    const projImport    = getTradeRouteImportSaving(projRoute);
    const projTotal     = projExport + projImport;
    const nextPush      = neg.pushCount + 1;
    const threatened    = neg.threatenNext;
    const collapseRisk  = getPushCollapseRisk(neg.nationId, nextPush, threatened);
    const relsCost      = getPushRelationsCost(nextPush, threatened);
    const nextOffer     = getNationCounterOffer(neg.nationId, nextPush, threatened);
    const colCls        = collapseRisk >= 0.3 ? 'stat-neg' : collapseRisk >= 0.1 ? 'effect-neutral' : 'stat-pos';
    const savingNote    = projImport > 0 ? ` + <span class="stat-pos">+${fmt2(projImport)}/turn</span> import savings` : '';
    return `<div class="neg-panel">
      <div class="neg-header">
        <span class="neg-title">Negotiating with ${def.name}</span>
        <span class="neg-badge neg-badge-counter">Counter Offer</span>
      </div>
      <div class="neg-meta">
        Leverage: <span class="${leverCls}">${leverStr} (${leverage.toFixed(2)}×)</span>
        &nbsp;·&nbsp; Pushes so far: ${neg.pushCount}
      </div>
      <div class="neg-offer-box">
        <div class="neg-offer-row"><span>Export quality</span><span class="stat-pos">${(offer.exportQuality * 100).toFixed(0)}%</span></div>
        <div class="neg-offer-row"><span>Import price</span><span class="effect-neutral">${(offer.importQuality * 100).toFixed(0)}% — savings: ${((1 - offer.importQuality) * 100).toFixed(0)}%</span></div>
        <div class="neg-offer-row"><span>Export income at maturity</span><span class="stat-pos">+${fmt2(projExport)}/turn</span></div>
        ${projImport > 0 ? `<div class="neg-offer-row"><span>Import savings at maturity</span><span class="stat-pos">+${fmt2(projImport)}/turn</span></div>` : ''}
        <div class="neg-offer-row"><span>Total value at maturity</span><span class="stat-pos">+${fmt2(projTotal)}/turn</span></div>
      </div>
      <div class="neg-push-section">
        <label class="neg-threat-toggle">
          <input type="checkbox" ${threatened ? 'checked' : ''} onchange="toggleNegotiationThreat()">
          Include Threat <span class="neg-threat-hint">(+${(TRADE_OFFER_QUALITY_THREATEN*100).toFixed(0)}% quality, extra relations cost)</span>
        </label>
        <div class="neg-push-costs">
          <span>Relations: <span class="stat-neg">−${relsCost}</span></span>
          <span>Collapse risk: <span class="${colCls}">${(collapseRisk * 100).toFixed(0)}%</span></span>
          <span>Next quality: ${(nextOffer.exportQuality * 100).toFixed(0)}%</span>
        </div>
        <button class="btn" onclick="pushTradeNegotiation(${threatened})">Push for Better Terms →</button>
      </div>
      <div class="neg-actions">
        <button class="btn btn-green" onclick="acceptNationCounter()">Accept Deal</button>
        <button class="btn" onclick="rejectNationCounter()">Modify Offer</button>
        <button class="btn btn-muted" onclick="cancelTradeNegotiation()">Cancel</button>
      </div>
    </div>`;
  }

  return '';
}

function renderAll() {
  renderHeader();
  renderPolicies();
  renderDashboard();
  renderTabBar();
}

// Update tab button locked/unlocked state based on current tech unlocks.
function renderTabBar() {
  const btn = document.getElementById('tab-btn-diplomacy');
  if (!btn) return;
  const hasTech = G.unlockedTechs.includes('diplomacyCorps');
  if (hasTech) {
    btn.classList.remove('tab-btn-locked');
    btn.textContent = 'Diplomacy';
  } else {
    btn.classList.add('tab-btn-locked');
    btn.textContent = '\uD83D\uDD12 Diplomacy';
  }
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
    logistics:       [['↑ Logistics level', 'good'], ['↓ mfg import cost', 'good']],
    prospecting:     [['↑ Prospecting level', 'good'], ['↑ deposit chance/turn', 'good']],
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
    const count        = G.tradeRoutes.length;
    const totalIncome  = getTotalTradeIncome();
    const routeTotal   = count > 0 ? ' · +' + fmt(totalIncome) + '/turn' : '';

    const negotiationHtml = G.activeNegotiation ? _buildNegotiationPanel(G.activeNegotiation) : '';
    const hintHtml = !G.activeNegotiation
      ? `<div class="tr-hint">Select a nation on the <strong>World</strong> map to open trade negotiations.</div>`
      : '';

    let routeListHtml = '';
    if (count === 0) {
      routeListHtml = '<div class="tr-empty">No active trade routes.</div>';
    } else {
      const playerOut = getPlayerResourceOutput();
      for (const route of G.tradeRoutes) {
        const routeExport  = getTradeRouteExportIncome(route);
        const routeImport  = getTradeRouteImportSaving(route);
        const routeIncome  = routeExport + routeImport;
        const maturityPct  = Math.min(100, (route.maturity / TRADE_ROUTE_MATURITY_TURNS) * 100).toFixed(0);
        const nationName   = NATIONS[route.nationId]?.name || 'Unknown';
        const eqLabel      = route.exportQuality ? (route.exportQuality * 100).toFixed(0) + '%' : '—';
        const iqLabel      = route.importQuality ? (route.importQuality * 100).toFixed(0) + '%' : '—';
        const isNegotiating = G.activeNegotiation?.nationId === route.nationId;
        const routeNs      = G.nations[route.nationId];
        const routeRelTier = routeNs ? getRelationsTier(routeNs.relations) : { label: 'Neutral', cssClass: 'rel-neutral' };

        // Build compact resource summary for export/import lines
        const demands  = NATIONS[route.nationId]?.trade.demandByResource || {};
        const supplies = NATIONS[route.nationId]?.trade.supplyByResource || {};
        const expParts = Object.entries(demands)
          .filter(([rid, m]) => (playerOut[rid] || 0) > 0)
          .map(([rid]) => RESOURCE_TYPES[rid]?.icon + ' ' + RESOURCE_TYPES[rid]?.name)
          .join(', ');
        const impParts = Object.entries(supplies)
          .filter(([rid, m]) => Math.max(0, Math.max(1, Math.round(TRADE_VOLUME_BASE * m)) - (playerOut[rid] || 0)) > 0)
          .map(([rid]) => RESOURCE_TYPES[rid]?.icon + ' ' + RESOURCE_TYPES[rid]?.name)
          .join(', ');

        const incomeBreakdown = routeImport > 0
          ? `+${fmt(routeExport)} export +${fmt(routeImport)} savings`
          : `+${fmt(routeExport)} export`;

        routeListHtml += `
          <div class="tr-route-card">
            <div class="tr-route-info">
              <span class="tr-route-partner">${nationName}</span><span class="tr-route-rel ${routeRelTier.cssClass}">${routeRelTier.label}</span>
              ${expParts ? `<span class="tr-route-cats">Exports: ${expParts}</span>` : `<span class="tr-route-cats stat-neg">No matching exports (no deposits)</span>`}
              ${impParts ? `<span class="tr-route-cats">Import savings: ${impParts}</span>` : ''}
              <span class="tr-route-age">${route.maturity} turn${route.maturity !== 1 ? 's' : ''} · ${maturityPct}% mature · Export ${eqLabel} · Import ${iqLabel}</span>
            </div>
            <div class="tr-route-right">
              <span class="tr-route-income">+${fmt(routeIncome)}/turn</span>
              <span class="tr-route-breakdown">${incomeBreakdown}</span>
              ${!isNegotiating ? `<button class="btn-tr-renegotiate" onclick="openNegotiationFromRoute('${route.nationId}')">Renegotiate</button>` : ''}
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
          <span class="tr-slots">${count} active${routeTotal}</span>
        </div>
        ${negotiationHtml}
        ${hintHtml}
        <div class="tr-route-list">${routeListHtml}</div>
      </div>`;
  }

  if (tab === 'diplomacy') {
    renderDiplomacy();
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
      const { label: relLabel, cssClass: relClass } = getRelationsTier(nation.relations);
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
    const tiers = [...new Set(Object.values(TECHNOLOGIES).map(t => t.tier))].sort((a, b) => a - b);
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

  if (tab === 'resources') {
    renderResourcesTab();
  }
}

// ============================================================
// RESOURCES TAB (Phase 3.5)
// ============================================================

function renderResourcesTab() {
  const el = document.getElementById('tab-resources');
  if (!el) return;

  const TIER_ORDER  = ['occurrence', 'vein', 'deposit', 'reserve', 'majorReserve'];
  const TIER_LABEL  = { occurrence: 'Occurrence', vein: 'Vein', deposit: 'Deposit', reserve: 'Reserve', majorReserve: 'Major Reserve' };
  const available   = getAvailableResourceTypes();
  const prod        = getResourceProduction();
  const chance      = (getProspectChance() * 100).toFixed(1);
  const activeId    = G.depositDevelopment.activeDepositId;
  const funding     = G.depositDevelopment.funding;

  // --- Development control panel ---
  const activeDep = activeId ? G.deposits.find(d => d.id === activeId) : null;
  let activeLabel = 'None — click a deposit below to assign development';
  let progressPct = 0;
  let progressDesc = '';
  if (activeDep) {
    const rt = activeDep.resourceType ? RESOURCE_TYPES[activeDep.resourceType].name : 'Unknown';
    if (activeDep.status === 'surveying') {
      activeLabel  = 'Initial Survey (type unknown)';
      progressPct  = activeDep.developProgress;
      progressDesc = `$${DEPOSIT_SURVEY_COST}M total · ${progressPct.toFixed(0)}% complete`;
    } else if (activeDep.status === 'commissioning') {
      const commCost = DEPOSIT_COMMISSION_COST[activeDep.currentTier] || 0;
      activeLabel  = `${rt} — Commissioning ${TIER_LABEL[activeDep.currentTier]}`;
      progressPct  = activeDep.developProgress;
      progressDesc = `$${commCost}M total · ${progressPct.toFixed(0)}% complete · Guaranteed`;
    } else if (activeDep.status === 'upgrading') {
      const upgCost  = DEPOSIT_TIER_UPGRADE_COST[activeDep.currentTier] || 0;
      const nextTier = TIER_ORDER[TIER_ORDER.indexOf(activeDep.currentTier) + 1] || '?';
      activeLabel  = `${rt} — ${TIER_LABEL[activeDep.currentTier]} → ${TIER_LABEL[nextTier] || nextTier} expansion`;
      progressPct  = activeDep.developProgress;
      progressDesc = `$${upgCost}M total · ${progressPct.toFixed(0)}% complete · 25% success`;
    }
  }

  const devHtml = `
    <div class="res-section">
      <div class="res-section-title">Development</div>
      <div class="res-dev-row">
        <span class="res-stat-label">Active</span>
        <span class="res-stat-value">${activeLabel}</span>
      </div>
      ${activeDep ? `
        <div class="res-progress-bar-wrap">
          <div class="res-progress-bar" style="width:${progressPct.toFixed(0)}%"></div>
        </div>
        <div class="res-progress-desc">${progressDesc}</div>
      ` : ''}
      <div class="res-dev-row res-dev-slider-row">
        <span class="res-stat-label">Funding</span>
        <input type="range" min="0" max="50" step="1" value="${funding}"
          oninput="setDepositDevelopmentFunding(this.value)">
        <span class="res-stat-value">$${funding}M/turn</span>
      </div>
      ${funding === 0 && activeDep ? '<p class="res-hint" style="margin-top:6px">⚠ Funding is 0 — set slider above 0 to make progress.</p>' : ''}
    </div>`;

  // --- Prospecting status + province capacity ---
  const provinceRows = Object.entries(MAP_REGIONS.player.provinces).map(([provId, prov]) => {
    const used = getRegionActiveDepositCount(provId);
    const cap  = getRegionCapacity(provId);
    const full = used >= cap;
    const pips = Array.from({ length: cap }, (_, i) =>
      `<span class="res-slot-pip ${i < used ? 'used' : ''}"></span>`
    ).join('');
    return `<div class="res-stat-row">
      <span class="res-stat-label">${prov.name}${prov.size === 'capital' ? ' ★' : ''}</span>
      <span class="res-province-slots">${pips}</span>
      <span class="res-stat-value ${full ? 'res-slots-full' : ''}">${used}/${cap}</span>
    </div>`;
  }).join('');

  const allFull = getFreeSlotProvinces().length === 0;
  const prospHtml = `
    <div class="res-section">
      <div class="res-section-title">Prospecting</div>
      <div class="res-stat-row"><span class="res-stat-label">Prospecting Level</span><span class="res-stat-value">${Math.round(G.prospectingLevel)} / 100</span></div>
      <div class="res-stat-row"><span class="res-stat-label">Discovery chance / turn</span><span class="res-stat-value ${allFull ? 'res-slots-full' : ''}">${allFull ? '0% (all provinces full)' : chance + '%'}</span></div>
      <div class="res-stat-row"><span class="res-stat-label">Discoverable types</span><span class="res-stat-value">${available.map(id => RESOURCE_TYPES[id].name).join(', ') || 'None yet'}</span></div>
      <div class="res-section-subtitle" style="margin-top:8px;margin-bottom:4px;font-size:11px;color:var(--text-3);font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Province Slots</div>
      ${provinceRows}
      ${allFull ? '<p class="res-hint" style="margin-top:6px">⚠ All province slots occupied. Fully establish mines to free slots for new discoveries.</p>' : ''}
      <p class="res-hint">Fund the <strong>Prospecting</strong> policy (Economy tab) to increase discovery chance each turn.</p>
    </div>`;

  // --- Active deposits (anomaly / surveying / commissioning / producing / upgrading) ---
  let depositsHtml = '';
  if (G.deposits.length > 0) {
    const cards = G.deposits.map(dep => {
      const isActive     = dep.id === activeId;
      const rt           = dep.resourceType ? RESOURCE_TYPES[dep.resourceType] : null;
      const icon         = rt ? rt.icon : '❓';
      const name         = rt ? rt.name : 'Unknown';
      const provinceName = dep.regionId && MAP_REGIONS.player.provinces[dep.regionId]
        ? MAP_REGIONS.player.provinces[dep.regionId].name : '';
      const regionTag    = provinceName ? ` · <span class="res-region-tag">${provinceName}</span>` : '';
      const devCost      = getDepositDevelopCost(dep);
      const congestion   = dep.regionId ? getRegionCongestionMultiplier(dep) : 1;
      const congTag      = congestion > 1 ? ` · <span class="res-congestion-tag">+${Math.round((congestion-1)*100)}% congestion</span>` : '';

      if (dep.status === 'anomaly') {
        const canAssign = !activeId || activeId === dep.id;
        return `<div class="res-deposit-card res-deposit-anomaly">
          <span class="res-deposit-card-icon">❓</span>
          <div class="res-deposit-card-info">
            <span class="res-deposit-card-name">Geological Anomaly${regionTag}</span>
            <span class="res-deposit-card-sub">Type unknown · Potential unknown · Survey: $${devCost}M${congTag}</span>
          </div>
          <div class="res-deposit-card-actions">
            <button class="res-btn res-btn-confirm ${canAssign ? '' : 'disabled'}"
              onclick="${canAssign ? `assignDepositDevelopment('${dep.id}')` : ''}"
              ${canAssign ? '' : 'disabled'}>
              ${isActive ? 'Assigned' : 'Start Survey'}
            </button>
          </div>
        </div>`;
      }

      if (dep.status === 'surveying') {
        const prog = dep.developProgress.toFixed(0);
        return `<div class="res-deposit-card res-deposit-inprogress ${isActive ? 'res-deposit-active' : ''}">
          <span class="res-deposit-card-icon">🔍</span>
          <div class="res-deposit-card-info">
            <span class="res-deposit-card-name">Geological Survey in progress…${regionTag}</span>
            <span class="res-deposit-card-sub">$${devCost}M total · ${prog}% complete${congTag}${!isActive ? ' · <em>Unfunded — progress decaying</em>' : ''}</span>
          </div>
          ${!isActive ? `<div class="res-deposit-card-actions">
            <button class="res-btn res-btn-confirm" onclick="assignDepositDevelopment('${dep.id}')">Resume</button>
          </div>` : ''}
        </div>`;
      }

      if (dep.status === 'commissioning') {
        const prog    = dep.developProgress.toFixed(0);
        const tierLbl = TIER_LABEL[dep.currentTier] || dep.currentTier;
        return `<div class="res-deposit-card res-deposit-inprogress ${isActive ? 'res-deposit-active' : ''}">
          <span class="res-deposit-card-icon">${icon}</span>
          <div class="res-deposit-card-info">
            <span class="res-deposit-card-name">${name} — Commissioning ${tierLbl} mine${regionTag}</span>
            <span class="res-deposit-card-sub">$${devCost}M total · ${prog}% complete${congTag}${!isActive ? ' · <em>Unfunded — decaying</em>' : ' · Guaranteed'}</span>
          </div>
          ${!isActive ? `<div class="res-deposit-card-actions">
            <button class="res-btn res-btn-confirm" onclick="assignDepositDevelopment('${dep.id}')">Resume</button>
          </div>` : ''}
        </div>`;
      }

      if (dep.status === 'producing') {
        const output      = DEPOSIT_TIER_OUTPUT[dep.currentTier];
        const tierLbl     = TIER_LABEL[dep.currentTier] || dep.currentTier;
        const canUp       = canUpgradeDeposit(dep);
        const hasProgress = dep.developProgress > 0;
        const upgCostTag  = canUp ? ` · Expand: $${getDepositDevelopCost({...dep, status:'upgrading'})}M` : '';
        return `<div class="res-deposit-card res-deposit-producing">
          <span class="res-deposit-card-icon">${icon}</span>
          <div class="res-deposit-card-info">
            <span class="res-deposit-card-name">${name}${regionTag}</span>
            <span class="res-deposit-card-sub">
              <span class="res-deposit-tier res-deposit-tier-${dep.currentTier}">${tierLbl}</span>
              · ${output} Mt/yr${congTag}${upgCostTag}
              ${hasProgress ? ` · <span class="res-partial">Partial expansion: ${dep.developProgress.toFixed(0)}%</span>` : ''}
            </span>
          </div>
          ${canUp ? `<div class="res-deposit-card-actions">
            <button class="res-btn res-btn-confirm" onclick="assignDepositDevelopment('${dep.id}')">Expand</button>
          </div>` : `<div class="res-deposit-card-actions">
            <span class="res-btn-locked" title="Requires deposit expansion tech">🔒 Expand</span>
          </div>`}
        </div>`;
      }

      if (dep.status === 'upgrading') {
        const prog       = dep.developProgress.toFixed(0);
        const nextIdx    = TIER_ORDER.indexOf(dep.currentTier) + 1;
        const nextTier   = TIER_ORDER[nextIdx];
        const nextLabel  = TIER_LABEL[nextTier] || nextTier || '?';
        const currentLbl = TIER_LABEL[dep.currentTier] || dep.currentTier;
        return `<div class="res-deposit-card res-deposit-inprogress ${isActive ? 'res-deposit-active' : ''}">
          <span class="res-deposit-card-icon">${icon}</span>
          <div class="res-deposit-card-info">
            <span class="res-deposit-card-name">${name} — Expanding ${currentLbl} → ${nextLabel}${regionTag}</span>
            <span class="res-deposit-card-sub">$${devCost}M total · ${prog}% complete${congTag}${!isActive ? ' · <em>Unfunded — decaying</em>' : ' · 25% success on completion'}</span>
          </div>
          <div class="res-deposit-card-actions">
            ${!isActive ? `<button class="res-btn res-btn-confirm" onclick="assignDepositDevelopment('${dep.id}')">Resume</button>` : ''}
            <button class="res-btn res-btn-dismiss" onclick="cancelDepositUpgrade('${dep.id}')">Cancel</button>
          </div>
        </div>`;
      }

      return '';
    }).join('');

    depositsHtml = `
      <div class="res-section">
        <div class="res-section-title">Active Sites (${G.deposits.length})</div>
        <div class="res-deposits-list">${cards}</div>
      </div>`;
  }

  // --- Established Industries (pooled max-tier deposits) ---
  let industriesHtml = '';
  const industryEntries = Object.entries(G.establishedIndustries || {});
  if (industryEntries.length > 0) {
    const rows = industryEntries.map(([resId, ind]) => {
      const rt = RESOURCE_TYPES[resId];
      return `<div class="res-industry-row">
        <span class="res-industry-icon">${rt ? rt.icon : '⚙'}</span>
        <span class="res-industry-name">${rt ? rt.name : resId} Industry</span>
        <span class="res-industry-sites">${ind.sites} site${ind.sites !== 1 ? 's' : ''}</span>
        <span class="res-industry-output">+${ind.totalOutput} Mt/yr</span>
      </div>`;
    }).join('');
    industriesHtml = `
      <div class="res-section">
        <div class="res-section-title">⚙ Established Industries</div>
        <div class="res-industry-list">${rows}</div>
      </div>`;
  }

  // --- Production summary (all sources) ---
  let prodHtml = '';
  const prodEntries = Object.entries(prod);
  if (prodEntries.length > 0) {
    const rows = prodEntries.map(([id, rate]) => {
      const rt = RESOURCE_TYPES[id];
      return `<div class="res-prod-row"><span>${rt ? rt.icon + ' ' + rt.name : id}</span><span class="res-prod-rate">+${rate} Mt/yr</span></div>`;
    }).join('');
    prodHtml = `
      <div class="res-section">
        <div class="res-section-title">Total Production</div>
        <div class="res-prod-list">${rows}</div>
      </div>`;
  }

  const emptyMsg = G.deposits.length === 0 && industryEntries.length === 0
    ? `<p class="res-empty">No anomalies found yet. Fund the Prospecting policy to begin searching.</p>`
    : '';

  el.innerHTML = `<div class="resources-panel">${devHtml}${prospHtml}${depositsHtml}${industriesHtml}${prodHtml}${emptyMsg}</div>`;
}

// ============================================================
// WORLD MAP
// ============================================================

function renderDiplomacy() {
  const el = document.getElementById('tab-diplomacy');
  if (!el) return;

  if (!G.unlockedTechs.includes('diplomacyCorps')) {
    el.innerHTML = `
      <div class="diplo-locked">
        <div class="diplo-locked-icon">🤝</div>
        <div class="diplo-locked-title">Diplomacy Corps</div>
        <div class="diplo-locked-msg">Research <strong>Diplomacy Corps</strong> to unlock the Diplomacy screen.</div>
      </div>`;
    return;
  }

  const hasAlliances = G.unlockedTechs.includes('strategicAlliances');
  const hasUN        = G.unlockedTechs.includes('unMembership');

  let html = '<div class="diplo-panel">';
  html += '<div class="diplo-panel-title">Diplomatic Relations</div>';
  html += '<div class="diplo-nation-list">';

  for (const [id, ns] of Object.entries(G.nations)) {
    const def      = NATIONS[id];
    const reg      = MAP_REGIONS[id];
    const tier     = getRelationsTier(ns.relations);
    const route    = G.tradeRoutes.find(r => r.nationId === id);
    const matPct   = route ? Math.min(100, (route.maturity / TRADE_ROUTE_MATURITY_TURNS) * 100).toFixed(0) : 0;
    const routeIncome = route ? getTradeRouteIncome(route) : 0;
    const deal     = G.diplomaticDeals.find(d => d.nationId === id);
    const nap      = deal && deal.type === 'nap'      ? deal : null;
    const alliance = deal && deal.type === 'alliance' ? deal : null;

    // --- Deals ---
    let dealsHtml = '';
    if (route) {
      dealsHtml += `<span class="diplo-deal diplo-deal-active">🚢 Trade Route · ${route.maturity} turn${route.maturity !== 1 ? 's' : ''} · ${matPct}% mature · +${fmt(routeIncome)}/turn</span>`;
    }
    if (alliance) {
      dealsHtml += `<span class="diplo-deal diplo-deal-alliance">🛡️ Allied</span>`;
    }
    if (nap) {
      dealsHtml += `<span class="diplo-deal diplo-deal-nap">🕊️ Non-Aggression Pact — ${nap.turnsLeft} turn${nap.turnsLeft !== 1 ? 's' : ''} remaining</span>`;
    }
    if (!route && !alliance && !nap) {
      dealsHtml += '<span class="diplo-deal diplo-deal-none">No active deals</span>';
    }

    // --- Action buttons ---
    let actionsHtml = '';
    if (hasAlliances && !alliance) {
      const canAlliance = ns.relations >= ALLIANCE_MIN_PROPOSE_REL;
      actionsHtml += `<button class="diplo-action-btn${canAlliance ? '' : ' diplo-action-btn-disabled'}" onclick="proposeAlliance('${id}')" ${canAlliance ? '' : 'disabled'} title="${canAlliance ? 'Propose an Alliance' : `Requires ${ALLIANCE_MIN_PROPOSE_REL}+ relations`}">🛡️ Propose Alliance</button>`;
    }
    if (alliance) {
      actionsHtml += `<button class="diplo-action-btn diplo-action-btn-danger" onclick="breakAlliance('${id}')">Break Alliance</button>`;
    }
    if (!nap && !alliance) {
      const canNap = ns.relations >= NAP_MIN_PROPOSE_REL;
      actionsHtml += `<button class="diplo-action-btn${canNap ? '' : ' diplo-action-btn-disabled'}" onclick="proposeNap('${id}')" ${canNap ? '' : 'disabled'} title="${canNap ? 'Propose a Non-Aggression Pact' : 'Requires Neutral relations (0+)'}">🕊️ Propose NAP</button>`;
    }

    html += `
      <div class="diplo-nation-card">
        <div class="diplo-nation-header" style="border-left:3px solid ${reg.color}">
          <span class="diplo-nation-name">${def.name}</span>
          <span class="diplo-rel-badge ${tier.cssClass}">${ns.relations > 0 ? '+' : ''}${ns.relations} — ${tier.label}</span>
        </div>
        <div class="diplo-nation-meta">
          <span>GDP $${ns.gdp.toFixed(0)}B</span>
          <span>Military ${ns.militaryLevel.toFixed(0)}/100</span>
          <span>Streak ${Math.floor(ns.relationsStreak)} turns</span>
        </div>
        <div class="diplo-deals">${dealsHtml}</div>
        ${actionsHtml ? `<div class="diplo-actions">${actionsHtml}</div>` : ''}
      </div>`;
  }

  html += '</div>';

  if (hasUN) {
    html += `
      <div class="diplo-un-panel">
        <span class="diplo-un-title">🌐 UN Member</span>
        <span class="diplo-un-desc">International recognition grants +5 relations with all nations globally.</span>
      </div>`;
  }

  html += '</div>';
  el.innerHTML = html;
}

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
    const relCls = ns.relations >= 20 ? ' map-region-friendly' : ns.relations <= -20 ? ' map-region-hostile' : '';
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
    const id   = _mapSelectedNation;
    const ns   = G.nations[id];
    const def  = NATIONS[id];
    const reg  = MAP_REGIONS[id];
    const { label: relLabel, cssClass: relCls } = getRelationsTier(ns.relations);
    const borders  = (def.adjacency || []).map(a => a === 'player' ? G.empire : (NATIONS[a] ? NATIONS[a].name : a)).join(', ');
    const activeRoute   = G.tradeRoutes.find(r => r.nationId === id);
    const isNegotiating = G.activeNegotiation?.nationId === id;

    // Trade section
    let tradeHtml = '';
    if (isNegotiating) {
      tradeHtml = _buildNegotiationPanel(G.activeNegotiation);
    } else if (activeRoute) {
      const routeExport = getTradeRouteExportIncome(activeRoute);
      const routeImport = getTradeRouteImportSaving(activeRoute);
      const income  = routeExport + routeImport;
      const matPct  = Math.min(100, (activeRoute.maturity / TRADE_ROUTE_MATURITY_TURNS) * 100).toFixed(0);
      const eqLbl   = activeRoute.exportQuality ? (activeRoute.exportQuality * 100).toFixed(0) + '%' : '—';
      const iqLbl   = activeRoute.importQuality ? (activeRoute.importQuality * 100).toFixed(0) + '%' : '—';
      const playerOut = getPlayerResourceOutput();
      const demands   = def.trade.demandByResource || {};
      const supplies  = def.trade.supplyByResource || {};
      const expParts  = Object.entries(demands)
        .filter(([rid]) => (playerOut[rid] || 0) > 0)
        .map(([rid]) => RESOURCE_TYPES[rid]?.icon + ' ' + RESOURCE_TYPES[rid]?.name).join(', ') || '—';
      const impParts  = Object.entries(supplies)
        .filter(([rid, m]) => Math.max(0, Math.max(1, Math.round(TRADE_VOLUME_BASE * m)) - (playerOut[rid] || 0)) > 0)
        .map(([rid]) => RESOURCE_TYPES[rid]?.icon + ' ' + RESOURCE_TYPES[rid]?.name).join(', ') || '—';
      tradeHtml = `
        <div class="map-trade-active">
          <div class="map-trade-status">🚢 Active Trade Route</div>
          <div class="map-trade-detail">Exports: ${expParts}</div>
          ${routeImport > 0 ? `<div class="map-trade-detail">Import savings: ${impParts}</div>` : ''}
          <div class="map-trade-detail">Export ${eqLbl} · Import ${iqLbl} · ${matPct}% mature · +${fmt(income)}/turn</div>
          <button class="btn btn-sm" onclick="openNegotiationFromRoute('${id}')">Renegotiate</button>
          <button class="btn btn-sm btn-muted" onclick="closeTradeRoute(${activeRoute.id})">Close Route</button>
        </div>`;
    } else {
      tradeHtml = `
        <div class="map-trade-none">
          <button class="btn btn-green" onclick="openNegotiationForNation('${id}')">Negotiate Trade Deal</button>
        </div>`;
    }

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
        ${tradeHtml}
      </div>`;
  }

  panelEl.innerHTML = `
    <div class="world-map-container">
      <div class="world-map-svg-wrap">
        <svg id="world-map-svg" viewBox="${vbStr}" preserveAspectRatio="xMidYMid meet" class="world-map-svg">
          ${svg}
        </svg>
      </div>
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
