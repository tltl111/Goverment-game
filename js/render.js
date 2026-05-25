// ============================================================
// RENDER — all DOM rendering functions (reads G, writes DOM)
// ============================================================

// World map pan/zoom state (UI state, not game state)
let _mapVB = { x: 0, y: 0, w: 800, h: 560 };
let _mapDrag = null;        // { startClientX, startClientY, startVBX, startVBY, svgW, svgH }
let _mapDragMoved = false;  // distinguishes drag from click
let _mapSelectedNation = null;
let _mapSelectedProvince = null;
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
  const btnDiplomacy = document.getElementById('tab-btn-diplomacy');
  if (btnDiplomacy) {
    const hasDiplomacy = G.unlockedTechs.includes('diplomacyCorps');
    if (hasDiplomacy) {
      btnDiplomacy.classList.remove('tab-btn-locked');
      btnDiplomacy.textContent = 'Diplomacy';
    } else {
      btnDiplomacy.classList.add('tab-btn-locked');
      btnDiplomacy.textContent = '\uD83D\uDD12 Diplomacy';
    }
  }

  const btnMilitary = document.getElementById('tab-btn-military');
  if (btnMilitary) {
    const hasMilitary = G.unlockedTechs.includes('standingArmy');
    if (hasMilitary) {
      btnMilitary.classList.remove('tab-btn-locked');
      btnMilitary.textContent = 'Military';
    } else {
      btnMilitary.classList.add('tab-btn-locked');
      btnMilitary.textContent = '\uD83D\uDD12 Military';
    }
  }

  const btnEquipment = document.getElementById('tab-btn-equipment');
  if (btnEquipment) {
    const hasEquipment = G.unlockedTechs.includes('basicMetallurgy');
    if (hasEquipment) {
      btnEquipment.classList.remove('tab-btn-locked');
      btnEquipment.textContent = '\u2699\uFE0F Equipment';
    } else {
      btnEquipment.classList.add('tab-btn-locked');
      btnEquipment.textContent = '\uD83D\uDD12 Equipment';
    }
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

  // Installation maintenance summary card (shown if any installations exist)
  const maintCost = getTotalInstallationMaintenance();
  if (maintCost > 0) {
    const count = G.installations.length;
    document.getElementById('policies-list').innerHTML += `
      <div class="policy-card active">
        <div class="policy-header">
          <span class="policy-icon">🏗️</span>
          <span class="policy-name">Province Installations</span>
          <span class="policy-cost">−${fmt(maintCost)}/turn</span>
        </div>
        <p class="policy-desc">${count} installation${count !== 1 ? 's' : ''} — fixed maintenance. Manage via the World Map.</p>
      </div>`;
  }

  updateBudgetProjection();
}

function buildEffectsHint(policyId) {
  const tags = {
    infrastructure:  [['↑ Infra level', 'good'], ['↑ GDP growth', 'good'], ['↑ pop cap', 'good'], ['↑ supply delivery', 'good']],
    mining:          [['↑ Mining level', 'good'], ['↑ GDP growth', 'good']],
    manufacturing:   [['↑ Mfg level', 'good'], ['↑ GDP growth', 'good'], ['↑ goods supply', 'good'], ['capped by Mining', 'neutral']],
    logistics:       [['↑ Logistics level', 'good'], ['↓ mfg import cost', 'good']],
    prospecting:     [['↑ Prospecting level', 'good'], ['↑ deposit chance/turn', 'good']],
    commerce:        [['↑ Commerce level', 'good'], ['↑ GDP growth', 'good'], ['amplified by Mfg', 'neutral']],
    finance:         [['↑ Finance level', 'good'], ['↓ debt cost', 'good']],
    healthcare:      [['↑ Healthcare level', 'good'], ['↑ pop growth', 'good'], ['↑ happiness', 'good']],
    education:       [['↑ Education level', 'good'], ['↑ GDP growth', 'good'], ['↑ research speed', 'good'], ['↑ happiness', 'good']],
    army:            [['↑ Army level', 'good'], ['↑ deterrence', 'good'], ['↑ leverage', 'good'], ['↓ happiness', 'bad'], ['pop-capped', 'neutral']],
    navy:            [['↑ unit-based Navy', 'good'], ['↑ deterrence', 'good'], ['protects trade', 'good']],
    airForce:        [['↑ unit-based Air Force', 'good'], ['↑ deterrence', 'good']],
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
      { label: 'Goods Supply',          value: Math.round(getSupplyRatio() * 100) + '%',   unit: ' (' + getGoodsDelivered().toFixed(0) + ' delivered / ' + getTotalGoodsDemand().toFixed(0) + ' demanded)', max: 100, rawPct: getSupplyRatio() * 100, type: getSupplyRatio() >= 0.9 ? 'pos' : getSupplyRatio() >= 0.7 ? 'warn' : 'neg' },
      { label: 'Commerce Level',       value: Math.round(G.commerceLevel) + '/100',       unit: ' (GDP +' + (0.002 * (G.commerceLevel / 100) * (0.5 + 0.5 * Math.min(G.manufacturingLevel, G.miningLevel) / 100) * 100).toFixed(2) + '%)', max: 100, rawPct: G.commerceLevel,       type: G.commerceLevel < 20 ? 'neg' : G.commerceLevel < 50 ? 'warn' : 'pos' },
      { label: 'Finance Level',     value: Math.round(G.financeLevel) + '/100', unit: ' (↓ debt cost)', max: 100, rawPct: G.financeLevel, type: G.financeLevel < 20 ? 'neg' : G.financeLevel < 50 ? 'warn' : 'pos' },
      { label: 'Healthcare Level',   value: Math.round(G.healthcareLevel) + '/100', unit: ' (pop growth +' + (POP_GROWTH_HEALTHCARE_SCALE * G.healthcareLevel / 100 * 100).toFixed(2) + '%/turn)', max: 100, rawPct: G.healthcareLevel, type: G.healthcareLevel < 20 ? 'neg' : G.healthcareLevel < 50 ? 'warn' : 'pos' },
      { label: 'Education Level',    value: Math.round(G.educationLevel) + '/100', unit: ' (GDP +' + (EDUCATION_GDP_GROWTH_MAX * G.educationLevel / 100 * 100).toFixed(2) + '%)', max: 100, rawPct: G.educationLevel, type: G.educationLevel < 20 ? 'neg' : G.educationLevel < 50 ? 'warn' : 'pos' },
      { label: 'Trade Routes',      value: G.tradeRoutes.length, unit: G.tradeRoutes.length > 0 ? ' active (+' + fmt(getTotalTradeIncome()) + '/turn)' : ' active', max: 100, rawPct: Math.min(100, G.tradeRoutes.length * 20), type: G.tradeRoutes.length === 0 ? 'warn' : 'pos' },
      { label: 'Net Income / Turn', value: (net >= 0 ? '+' : '') + fmt(net), unit: '', max: 100, rawPct: Math.min(100, Math.max(0, (net + 2000) / 40)), type: net < 0 ? 'neg' : 'pos' },
      { label: 'Research Level',   value: G.researchLevel.toFixed(1) + ' / ' + getResearchCapacityCeiling(), unit: '', max: 100, rawPct: Math.min(100, (G.researchLevel / getResearchCapacityCeiling()) * 100), type: G.researchLevel === 0 ? 'warn' : 'pos' },
      { label: 'Research Output',   value: '+' + rp.toFixed(1),      unit: ' RP/turn', max: 100, rawPct: Math.min(100, rp * 3), type: rp === 0 ? 'warn' : 'pos' },
      { label: 'Active Research',   value: activeResearchName, unit: '', max: 100, rawPct: activeResearchPct, type: G.activeResearch ? 'pos' : 'warn' },
      { label: 'Deterrence Rating', value: getDeterrenceRating().toFixed(0) + '/100', unit: ' (strength ' + Math.round(getTotalMilitaryStrength()) + ')', max: 100, rawPct: getDeterrenceRating(), type: getDeterrenceRating() === 0 ? 'warn' : 'pos' },
      { label: 'Navy Strength',     value: getNavyStrength().toFixed(1) + '/' + NAVY_STRENGTH_MAX, unit: '', max: NAVY_STRENGTH_MAX, rawPct: getNavyStrength() / NAVY_STRENGTH_MAX * 100, type: getNavyStrength() === 0 ? 'warn' : 'pos' },
      { label: 'Air Force Strength',value: getAirForceStrength().toFixed(1) + '/' + AIRFORCE_STRENGTH_MAX, unit: '', max: AIRFORCE_STRENGTH_MAX, rawPct: getAirForceStrength() / AIRFORCE_STRENGTH_MAX * 100, type: getAirForceStrength() === 0 ? 'warn' : 'pos' },
      { label: 'Territory Score',   value: (G.territoryScore || 1).toFixed(1), unit: (() => { const n = Object.keys(G.integratingProvinces || {}).length; return n > 0 ? ` (${n} integrating)` : ''; })(), max: 20, rawPct: Math.min(100, ((G.territoryScore || 1) / 20) * 100), type: 'pos' },
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

        const nationGoodsDemand = getNationGoodsDemandUnits(route.nationId);
        const goodsExportClass  = route.goodsExportEnabled ? 'active' : '';
        const goodsExportLabel  = route.goodsExportEnabled ? '🏭 Goods ON' : '🏭 Goods OFF';
        const goodsExportIncome = route.goodsExportIncomeLast || 0;
        const goodsExportHint   = nationGoodsDemand <= 0
          ? `<span class="tr-route-goods-warning stat-dim">Nation has no demand for manufactured goods</span>`
          : route.goodsExportEnabled && goodsExportIncome > 0
            ? `<span class="tr-route-goods-income">+${fmt(goodsExportIncome)}/turn manufactured goods</span>`
            : route.goodsExportEnabled
              ? `<span class="tr-route-goods-income stat-dim">+0 (no stockpile surplus above reserve)</span>`
              : '';

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
              <button class="btn-tr-goods-export ${goodsExportClass}" onclick="toggleRouteGoodsExport(${route.id})" title="Toggle manufactured goods export for this route">${goodsExportLabel}</button>
              ${goodsExportHint}
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

  if (tab === 'military') {
    renderMilitary();
  }

  if (tab === 'equipment') {
    renderEquipment();
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
      { label: 'Deterrence',    key: 'deterrenceRating',    color: 'var(--blue)',   fmt: v => v.toFixed(1) + '/100' },
      { label: 'Research',       key: 'researchLevel',        color: 'var(--teal)',   fmt: v => v.toFixed(1) + '/' + getResearchCapacityCeiling() },
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
    const rp      = getRpPerTurn();
    const ceiling = getResearchCapacityCeiling();
    document.getElementById('tab-research').innerHTML =
      _buildResearchTab(rp, ceiling);
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
  const playerProvEntries = Object.entries(PROVINCES).filter(([, p]) => p.nationId === 'player');
  const provinceRows = playerProvEntries.map(([provId, prov]) => {
    const used = getRegionActiveDepositCount(provId);
    const cap  = getRegionCapacity(provId);
    const full = used >= cap;
    const pips = Array.from({ length: cap }, (_, i) =>
      `<span class="res-slot-pip ${i < used ? 'used' : ''}"></span>`
    ).join('');
    const isCapital = prov.depositSlots >= 4;
    return `<div class="res-stat-row">
      <span class="res-stat-label">${prov.name}${isCapital ? ' ★' : ''}</span>
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
      const provinceName = dep.regionId && PROVINCES[dep.regionId]
        ? PROVINCES[dep.regionId].name : '';
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
// MILITARY SCREEN (Phase 5.1)
// ============================================================

function renderMilitary() {
  const el = document.getElementById('tab-military');
  if (!el) return;

  if (!G.unlockedTechs.includes('standingArmy')) {
    el.innerHTML = `
      <div class="diplo-locked">
        <div class="diplo-locked-icon">⚔️</div>
        <div class="diplo-locked-title">Standing Army</div>
        <div class="diplo-locked-msg">Research <strong>Standing Army</strong> to unlock the Military screen.</div>
      </div>`;
    return;
  }

  const armyUnlocked     = G.unlockedTechs.includes('standingArmy');
  const navyUnlocked     = G.unlockedTechs.includes('navalFleet');
  const airForceUnlocked = G.unlockedTechs.includes('airForceEstablishment');

  const deterrence       = getDeterrenceRating();
  const armyStr          = getArmyStrength();
  const navyStr          = getNavyStrength();
  const airStr           = getAirForceStrength();
  const totalStr         = getTotalMilitaryStrength();
  const manpowerCap      = G.population * MILITARY_MANPOWER_RATIO;

  const goodsProduced  = getGoodsProduced();
  const deliveryEff    = getGoodsDeliveryEff();
  const goodsDelivered = getGoodsDelivered();
  const civDemand      = getCivilianGoodsDemand();
  const milDemand      = getMilitaryGoodsDemand();
  const supplyRatio    = getSupplyRatio();
  const supplyPenalty  = getSupplyHappinessPenalty();
  const supplyPct      = Math.round(supplyRatio * 100);
  const supplyClass    = supplyRatio >= 0.9 ? 'stat-pos' : supplyRatio >= 0.7 ? 'effect-neutral' : 'stat-neg';
  const supplyNote     = supplyRatio < 1
    ? `⚠️ Deficit — army effectiveness ${supplyPct}%, happiness −${supplyPenalty.toFixed(1)}`
    : `✓ Supply sufficient — army fully provisioned`;

  function branchCard(name, icon, level, strength, maxStrength, unlocked, requiresTechName, fundingKey) {
    if (!unlocked) {
      return `<div class="mil-branch-card mil-branch-locked">
        <div class="mil-branch-header">
          <span class="mil-branch-icon">${icon}</span>
          <span class="mil-branch-name">${name}</span>
          <span class="mil-branch-status locked">🔒 Locked</span>
        </div>
        <div class="mil-branch-locked-msg">Research <strong>${requiresTechName}</strong> to unlock.</div>
      </div>`;
    }
    const strPct = (strength / maxStrength * 100).toFixed(0);
    const cmdrs  = (G.commanders || []).filter(c => c.branch === fundingKey);
    const unitCount = cmdrs.reduce((s, c) => s + (c.units || []).length, 0);
    const budgetTotal = cmdrs.reduce((s, c) => s + (c.budget || 0), 0);
    return `<div class="mil-branch-card">
      <div class="mil-branch-header">
        <span class="mil-branch-icon">${icon}</span>
        <span class="mil-branch-name">${name}</span>
        <span class="mil-branch-status ${unitCount > 0 ? 'active' : 'inactive'}">${unitCount > 0 ? unitCount + ' unit' + (unitCount !== 1 ? 's' : '') : 'No units'}</span>
      </div>
      <div class="mil-branch-stats">
        <div class="mil-stat-row">
          <span class="mil-stat-label">Strength</span>
          <span class="mil-stat-value">${strength.toFixed(1)} / ${maxStrength}</span>
        </div>
        <div class="mil-bar-bg"><div class="mil-bar-fill" style="width:${strPct}%"></div></div>
        <div class="mil-stat-row">
          <span class="mil-stat-label">Commander Budget</span>
          <span class="mil-stat-value">${fmt(budgetTotal)}M/turn allocated</span>
        </div>
      </div>
      <div class="mil-branch-hint">Manage units and budgets in <strong>Commanders</strong> below.</div>
    </div>`;
  }

  const armyCard = (() => {
    if (!armyUnlocked) {
      return `<div class="mil-branch-card mil-branch-locked">
        <div class="mil-branch-header">
          <span class="mil-branch-icon">⚔️</span>
          <span class="mil-branch-name">Army</span>
          <span class="mil-branch-status locked">🔒 Locked</span>
        </div>
        <div class="mil-branch-locked-msg">Research <strong>Standing Army</strong> to unlock.</div>
      </div>`;
    }
    const tierNames = Object.values(G.equipmentTiers || {});
    const avgTier = tierNames.length ? (tierNames.reduce((s, t) => s + t, 0) / tierNames.length).toFixed(1) : '1.0';
    const strPct  = (armyStr / ARMY_STRENGTH_MAX * 100).toFixed(0);
    const activeRefit = (G.activeRefits || []).length > 0;
    return `<div class="mil-branch-card">
      <div class="mil-branch-header">
        <span class="mil-branch-icon">⚔️</span>
        <span class="mil-branch-name">Army</span>
        <span class="mil-branch-status ${activeRefit ? 'active' : 'inactive'}">${activeRefit ? '⚙️ Refitting' : 'Ready'}</span>
      </div>
      <div class="mil-branch-stats">
        <div class="mil-stat-row">
          <span class="mil-stat-label">Strength</span>
          <span class="mil-stat-value">${armyStr.toFixed(1)} / ${ARMY_STRENGTH_MAX}</span>
        </div>
        <div class="mil-bar-bg"><div class="mil-bar-fill" style="width:${strPct}%"></div></div>
        <div class="mil-stat-row">
          <span class="mil-stat-label">Avg. Equipment Tier</span>
          <span class="mil-stat-value">Mk.${avgTier}</span>
        </div>
      </div>
      <div class="mil-branch-hint">Manage units in <strong>Commanders</strong> below. Upgrade equipment in the <strong>⚙️ Equipment</strong> tab.</div>
    </div>`;
  })();
  const navyCard = branchCard(
    'Navy', '⚓', null, navyStr, NAVY_STRENGTH_MAX,
    navyUnlocked, 'Naval Fleet', 'navy'
  );
  const airCard  = branchCard(
    'Air Force', '✈️', null, airStr, AIRFORCE_STRENGTH_MAX,
    airForceUnlocked, 'Air Force', 'airForce'
  );

  const deterClass = deterrence >= 60 ? 'stat-pos' : deterrence >= 30 ? 'effect-neutral' : 'stat-neg';

  el.innerHTML = `
    <div class="mil-panel">
      <div class="mil-panel-header">
        <span class="mil-panel-title">⚔️ Military</span>
        <span class="mil-deterrence-badge ${deterClass}">Deterrence: ${deterrence.toFixed(0)}/100</span>
      </div>
      <div class="mil-deterrence-row">
        <div class="mil-stat-row">
          <span class="mil-stat-label">Combined Strength</span>
          <span class="mil-stat-value">${totalStr.toFixed(1)} / ${ARMY_STRENGTH_MAX + NAVY_STRENGTH_MAX + AIRFORCE_STRENGTH_MAX}</span>
        </div>
        <div class="mil-bar-bg"><div class="mil-bar-fill mil-bar-deterrence" style="width:${deterrence.toFixed(0)}%"></div></div>
        <div class="mil-deterrence-hint">Deterrence = Army 50% + Navy 25% + Air Force 25%</div>
      </div>
      <div class="mil-supply-section">
        <div class="mil-panel-header">
          <span class="mil-panel-title">📦 Goods Supply</span>
          <span class="mil-deterrence-badge ${supplyClass}">${supplyPct}% supplied</span>
        </div>
        <div class="mil-stat-row">
          <span class="mil-stat-label">Produced</span>
          <span class="mil-stat-value">${goodsProduced.toFixed(1)} units/turn (Mfg ${Math.round(G.manufacturingLevel)})</span>
        </div>
        ${(G.bombingMfgDebuff || 0) > 0 ? `<div class="mil-stat-row mil-bombing-penalty-row">
          <span class="mil-stat-label">⚠️ Bombing debuff</span>
          <span class="mil-stat-value stat-neg">−${Math.round((G.bombingMfgDebuff || 0) * 100)}% manufacturing output (enemy air raids)</span>
        </div>` : ''}
        <div class="mil-stat-row">
          <span class="mil-stat-label">Delivery</span>
          <span class="mil-stat-value">${Math.round(deliveryEff * 100)}% efficiency → ${goodsDelivered.toFixed(1)} delivered (Infra ${Math.round(G.infraLevel)})</span>
        </div>
        <div class="mil-stat-row">
          <span class="mil-stat-label">Civilian demand</span>
          <span class="mil-stat-value">${civDemand.toFixed(1)} units/turn (${fmtPop(G.population)})</span>
        </div>
        <div class="mil-stat-row">
          <span class="mil-stat-label">Military demand</span>
          <span class="mil-stat-value">${milDemand.toFixed(1)} units/turn (Army strength ${armyStr.toFixed(1)})</span>
        </div>
        ${(G.bombingSupplyDrain || 0) > 0 ? `<div class="mil-stat-row mil-bombing-penalty-row">
          <span class="mil-stat-label">⚠️ Supply disruption</span>
          <span class="mil-stat-value stat-neg">−${Math.round((G.bombingSupplyDrain || 0) * 100)}% supply ratio (enemy bombardment)</span>
        </div>` : ''}
        <div class="mil-bar-bg"><div class="mil-bar-fill mil-bar-supply" style="width:${Math.min(100, supplyPct)}%"></div></div>
        <div class="mil-supply-note ${supplyClass}">${supplyNote}</div>
        ${(() => {
          const stockMax = getGoodsStockpileMax();
          if (stockMax <= 0) return '';
          const stock    = G.goodsStockpile || 0;
          const reserve  = G.goodsStockpileReserve || 0;
          const stockPct = Math.min(100, (stock / stockMax) * 100);
          const drawPct  = Math.round((G.goodsStockpileDrawRatio || 0) * 100);
          const available = Math.max(0, stock - reserve);
          const enabledCount = G.tradeRoutes.filter(r => r.goodsExportEnabled).length;
          return `
        <div class="mil-stockpile-section">
          <div class="mil-stat-row">
            <span class="mil-stat-label">📦 Goods stockpile</span>
            <span class="mil-stat-value">${stock.toFixed(1)} / ${stockMax.toFixed(1)} units
              ${drawPct > 0 ? `<span class="stat-pos"> · +${drawPct}% supply from stockpile</span>` : ''}
            </span>
          </div>
          <div class="mil-bar-bg"><div class="mil-bar-fill mil-bar-stockpile" style="width:${stockPct}%"></div></div>
          <div class="stockpile-reserve-row">
            <label class="stockpile-reserve-label">Reserve: <strong>${reserve.toFixed(1)} units</strong></label>
            <input type="range" class="stockpile-reserve-slider" min="0" max="${stockMax.toFixed(1)}" step="0.5"
              value="${reserve}" oninput="setGoodsStockpileReserve(this.value)" />
          </div>
          <div class="stockpile-reserve-hint stat-dim">${available > 0
            ? `${available.toFixed(1)} units above reserve — available for export to ${enabledCount} active route${enabledCount !== 1 ? 's' : ''}.`
            : reserve >= stock
              ? 'All stockpile is reserved — nothing available for export.'
              : 'No surplus above reserve yet.'
          }</div>
        </div>`;
        })()}
      </div>
      ${(() => {
        const navyUnlockedForFuel  = G.unlockedTechs.includes('navalFleet');
        const airUnlockedForFuel   = G.unlockedTechs.includes('airForceEstablishment');
        const armyUnlockedForFuel  = G.unlockedTechs.includes('standingArmy');
        if (!navyUnlockedForFuel && !airUnlockedForFuel && !armyUnlockedForFuel) return '';
        const fuelProduced  = getFuelProduced();
        const fuelDemand    = getTotalFuelDemand();
        const fuelRatio     = getFuelRatio();
        const fuelPct       = Math.round(fuelRatio * 100);
        const fuelClass     = fuelRatio >= 0.9 ? 'stat-pos' : fuelRatio >= 0.6 ? 'effect-neutral' : 'stat-neg';
        const navyDemand    = getFuelNavyDemand();
        const airDemand     = getFuelAirForceDemand();
        const armyDemand    = getFuelArmyDemand();
        const oilOutput     = getPlayerResourceOutput().oil || 0;
        const refineEff     = G.manufacturingLevel > 0 ? Math.min(100, G.manufacturingLevel) : 0;
        const storageBonusCount = (G.installations || []).filter(i => i.type === 'fuelStorage').length;
        const stockpileMax  = getFuelStockpileMax();
        const stockpile     = G.fuelStockpile || 0;
        const drawPct       = Math.round((G.fuelStockpileDrawRatio || 0) * 100);
        return `
        <div class="mil-fuel-section">
          <div class="mil-panel-header">
            <span class="mil-panel-title">⛽ Fuel</span>
            <span class="mil-deterrence-badge ${fuelClass}">${fuelPct}% fuelled</span>
          </div>
          <div class="mil-stat-row">
            <span class="mil-stat-label">Production</span>
            <span class="mil-stat-value">${oilOutput > 0
              ? `${fuelProduced.toFixed(2)} units/turn (${oilOutput.toFixed(1)} oil × ${refineEff}% mfg refining)`
              : `0 — no oil deposits active`}
            </span>
          </div>
          ${armyUnlockedForFuel ? `<div class="mil-stat-row">
            <span class="mil-stat-label">Army demand</span>
            <span class="mil-stat-value">${armyDemand.toFixed(2)} units/turn</span>
          </div>` : ''}
          ${navyUnlockedForFuel ? `<div class="mil-stat-row">
            <span class="mil-stat-label">Navy demand</span>
            <span class="mil-stat-value">${navyDemand.toFixed(2)} units/turn</span>
          </div>` : ''}
          ${airUnlockedForFuel ? `<div class="mil-stat-row">
            <span class="mil-stat-label">Air Force demand</span>
            <span class="mil-stat-value">${airDemand.toFixed(2)} units/turn</span>
          </div>` : ''}
          <div class="mil-stat-row">
            <span class="mil-stat-label">Stockpile cap</span>
            <span class="mil-stat-value">${stockpileMax.toFixed(1)} units${storageBonusCount > 0 ? ` (+${storageBonusCount * FUEL_STORAGE_CAPACITY_BONUS} from ${storageBonusCount} storage${storageBonusCount !== 1 ? 's' : ''})` : ''}</span>
          </div>
          <div class="mil-bar-bg"><div class="mil-bar-fill mil-bar-fuel" style="width:${fuelPct}%"></div></div>
          ${fuelRatio < 1 ? `<div class="mil-fuel-note stat-neg">⚠️ Fuel shortage — ${fuelPct}% effectiveness · Stockpile: ${stockpile.toFixed(1)} / ${stockpileMax.toFixed(1)} units${drawPct > 0 ? ` · +${drawPct}% from stockpile` : ''}</div>` : `<div class="mil-fuel-note stat-pos">✓ Fully fuelled${stockpile > 0 ? ` · Stockpile: ${stockpile.toFixed(1)} / ${stockpileMax.toFixed(1)} units` : ''}</div>`}
          ${oilOutput === 0 && fuelDemand > 0 ? `<div class="mil-fuel-hint stat-dim">Establish oil deposits (requires Chemical Industry tech) to fuel your forces. Build ⛽ Fuel Storage to buffer supply.</div>` : ''}
        </div>`;
      })()}
      ${_buildInstallationsSection()}
      ${_buildCommandersSection()}
      <div class="mil-branches">
        ${armyCard}
        ${(() => {
          if (!armyUnlocked) return armyCard;
          const fuelRatio = getFuelRatio();
          const hasFuelDemand = getFuelArmyDemand() > 0;
          if (!hasFuelDemand || fuelRatio >= 1) return armyCard;
          const pct = Math.round(fuelRatio * 100);
          return armyCard.replace('</div>', `<div class="mil-fuel-shortfall">⛽ ${pct}% fuel — attack & march speed reduced</div></div>`);
        })()}
        ${(() => {
          if (!navyUnlocked) return navyCard;
          const fuelRatio = getFuelRatio();
          const hasFuelDemand = getFuelNavyDemand() > 0;
          if (!hasFuelDemand || fuelRatio >= 1) return navyCard;
          const pct = Math.round(fuelRatio * 100);
          return navyCard.replace('</div>', `<div class="mil-fuel-shortfall">⛽ ${pct}% fuel — fleet effectiveness reduced</div></div>`);
        })()}
        ${(() => {
          if (!airForceUnlocked) return airCard;
          const fuelRatio = getFuelRatio();
          const hasFuelDemand = getFuelAirForceDemand() > 0;
          if (!hasFuelDemand || fuelRatio >= 1) return airCard;
          const pct = Math.round(fuelRatio * 100);
          return airCard.replace('</div>', `<div class="mil-fuel-shortfall">⛽ ${pct}% fuel — air effectiveness reduced</div></div>`);
        })()}
      </div>
    </div>`;
}

// ── Equipment Design tab (Phase 5.7e) ─────────────────────────────────────────────────────
function renderEquipment() {
  const el = document.getElementById('tab-equipment');
  if (!el) return;

  const basicUnlocked = G.unlockedTechs.includes('basicMetallurgy');
  if (!basicUnlocked) {
    el.innerHTML = `
      <div class="diplo-locked">
        <div class="diplo-locked-icon">⚙️</div>
        <div class="diplo-locked-title">Equipment Design</div>
        <div class="diplo-locked-msg">Research <strong>Basic Metallurgy</strong> to unlock the Equipment Design screen.</div>
      </div>`;
    return;
  }

  const tierKeys = Object.keys(EQUIPMENT_TIERS).map(Number).sort((a, b) => a - b);

  let cardsHtml = '';
  for (const [typeId, typeDef] of Object.entries(UNIT_TYPES)) {
    const currentTier  = G.equipmentTiers?.[typeId] || 1;
    const currentTierDef = EQUIPMENT_TIERS[currentTier];
    const activeRefit  = (G.activeRefits || []).find(r => r.unitType === typeId);
    const inService    = getUnitTypeInServiceSizes(typeId);
    const atkEff       = getEffectiveUnitAttack(typeId);
    const defEff       = getEffectiveUnitDefense(typeId);
    const spdEff       = getEffectiveUnitSpeed(typeId);

    // Next available tier
    const nextTier = currentTier < 3 ? currentTier + 1 : null;
    const nextTierDef = nextTier ? EQUIPMENT_TIERS[nextTier] : null;
    const nextUnlocked = nextTier
      ? (!nextTierDef.requiresTech || G.unlockedTechs.includes(nextTierDef.requiresTech))
      : false;

    // Stats preview for next tier (base × nextMult × same tech bonuses)
    const te = getTechEffects();
    let nextAtkPreview = '', nextDefPreview = '';
    if (nextTierDef) {
      let aMult = nextTierDef.attackMult * (1 + te.unitAttackBonus);
      let dMult = nextTierDef.defenseMult * (1 + te.unitDefenseBonus);
      if (typeId === 'armoredCorps' || typeId === 'mechanizedInfantry') {
        aMult *= (1 + te.mechanisedCombatBonus);
        dMult *= (1 + te.mechanisedCombatBonus);
      }
      nextAtkPreview = (typeDef.attack * aMult).toFixed(1);
      nextDefPreview = (typeDef.defense * dMult).toFixed(1);
    }

    const refitCost  = nextTier ? getRefitCost(typeId, nextTier) : 0;
    const refitTurns = nextTier ? getRefitTurns(currentTier, nextTier) : 0;

    const canUpgrade = nextTier && nextUnlocked && !activeRefit && G.treasury >= refitCost && inService > 0;
    const btnDisabled = !canUpgrade;
    let btnReason = '';
    if (nextTier && !nextUnlocked) {
      btnReason = `Requires ${TECHNOLOGIES[nextTierDef.requiresTech]?.name}`;
    } else if (activeRefit) {
      btnReason = `Refit in progress (${activeRefit.turnsLeft} turns left)`;
    } else if (inService === 0) {
      btnReason = 'No units in service';
    } else if (nextTier && G.treasury < refitCost) {
      btnReason = `Need ${fmt(refitCost)}M`;
    } else if (!nextTier) {
      btnReason = 'Max tier';
    }

    const tierBadgeClass = currentTier === 3 ? 'equip-tier-badge tier-max'
                         : currentTier === 2 ? 'equip-tier-badge tier-mid'
                         : 'equip-tier-badge tier-base';

    const refitProgressHtml = activeRefit
      ? `<div class="equip-refit-progress">⚙️ Refitting to ${EQUIPMENT_TIERS[activeRefit.targetTier].name} — ${activeRefit.turnsLeft} turn${activeRefit.turnsLeft !== 1 ? 's' : ''} left</div>`
      : '';

    const nextTierHtml = nextTierDef
      ? `<div class="equip-next-tier">
          <span class="equip-next-label">Next: ${nextTierDef.name}</span>
          <span class="equip-next-stats">ATK ${nextAtkPreview} · DEF ${nextDefPreview} · SPD ${spdEff - currentTierDef.speedBonus + nextTierDef.speedBonus}</span>
          ${nextUnlocked
            ? `<button class="equip-upgrade-btn${btnDisabled ? ' disabled' : ''}" ${btnDisabled ? 'disabled' : `onclick="orderRefit('${typeId}', ${nextTier})"`}>
                Refit → ${nextTierDef.name} (${fmt(refitCost)}M · ${refitTurns} turns)
               </button>`
            : `<span class="equip-locked-reason">🔒 ${btnReason}</span>`
          }
          ${btnDisabled && nextUnlocked ? `<span class="equip-locked-reason">${btnReason}</span>` : ''}
        </div>`
      : `<div class="equip-next-tier equip-max-tier">✓ Maximum tier reached</div>`;

    cardsHtml += `
      <div class="equip-card${activeRefit ? ' refitting' : ''}">
        <div class="equip-card-header">
          <span class="equip-unit-name">${typeDef.icon || '🪖'} ${typeDef.name}</span>
          <span class="${tierBadgeClass}">${currentTierDef.name}</span>
        </div>
        <div class="equip-stat-row">
          <span class="equip-stat">⚔️ ATK <strong>${atkEff.toFixed(1)}</strong></span>
          <span class="equip-stat">🛡️ DEF <strong>${defEff.toFixed(1)}</strong></span>
          <span class="equip-stat">💨 SPD <strong>${spdEff}</strong></span>
          <span class="equip-stat">🪖 In service: <strong>${inService}</strong></span>
        </div>
        ${refitProgressHtml}
        ${nextTierHtml}
      </div>`;
  }

  el.innerHTML = `
    <div class="equip-panel">
      <div class="mil-panel-header">
        <span class="mil-panel-title">⚙️ Equipment Design</span>
        <span class="mil-deterrence-badge">Manage unit equipment tiers</span>
      </div>
      <div class="equip-tier-legend">
        <strong>Mk.I</strong> — Baseline · 
        <strong>Mk.II</strong> — Requires Advanced Metallurgy (+40% ATK, +35% DEF, +1 SPD) · 
        <strong>Mk.III</strong> — Requires Composite Armour (+80% ATK, +70% DEF, +2 SPD)
      </div>
      <div class="equip-cards-grid">${cardsHtml}</div>
    </div>`;
}

function _buildInstallationsSection() {
  const totalMaint = getTotalInstallationMaintenance();
  const badge = G.installations.length > 0
    ? `${G.installations.length} built — −${fmt(totalMaint)}/turn`
    : 'None built';
  const badgeCls = G.installations.length > 0 ? 'effect-neutral' : '';

  let listHtml = '';
  if (G.installations.length === 0) {
    listHtml = '<div class="mil-supply-note">No installations — click a player province on the World Map to build.</div>';
  } else {
    // Group by province
    const byProvince = {};
    for (const inst of G.installations) {
      if (!byProvince[inst.provinceId]) byProvince[inst.provinceId] = [];
      byProvince[inst.provinceId].push(inst);
    }
    for (const [provId, insts] of Object.entries(byProvince)) {
      const provName = PROVINCES[provId]?.name || provId;
      const icons = insts.map(i => INSTALLATION_TYPES[i.type]?.icon + ' ' + INSTALLATION_TYPES[i.type]?.name).join(', ');
      const maintHere = insts.reduce((s, i) => s + (INSTALLATION_TYPES[i.type]?.maintenance || 0), 0);
      listHtml += `<div class="mil-install-row">
        <span class="mil-install-province">${provName}</span>
        <span class="mil-install-types">${icons}</span>
        <span class="mil-install-cost stat-neg">−${fmt(maintHere)}/turn</span>
      </div>`;
    }
  }

  return `
    <div class="mil-installations-section">
      <div class="mil-panel-header">
        <span class="mil-panel-title">🏗️ Province Installations</span>
        <span class="mil-deterrence-badge ${badgeCls}">${badge}</span>
      </div>
      ${listHtml}
    </div>`;
}

function _buildCommandersSection() {
  const navyUnlocked = G.unlockedTechs.includes('navalFleet');
  const commanders   = G.commanders || [];
  const fleet        = G.merchantFleet || 0;
  const fleetCap     = getMerchantFleetCapacity();
  const capMult      = getMerchantFleetCapacityMultiplier();
  const capPct       = Math.round(capMult * 100);
  const capClass     = capMult >= 0.95 ? 'stat-pos' : capMult >= 0.6 ? 'effect-neutral' : 'stat-neg';
  const fleetCeiling = getMerchantFleetCeiling();

  // --- Merchant fleet status ---
  const fleetNote = G.tradeRoutes.length === 0
    ? 'No active trade routes — fleet not growing.'
    : capMult >= 0.99
      ? '✓ Fleet capacity sufficient for current trade volume.'
      : `⚠️ Fleet at capacity — trade income reduced to ${capPct}%. Grow Commerce to expand fleet.`;

  const fleetHtml = `
    <div class="mil-fleet-status">
      <div class="mil-stat-row">
        <span class="mil-stat-label">Merchant Fleet</span>
        <span class="mil-stat-value">${fleet.toFixed(1)} / ${fleetCeiling} (capacity ${fmt(fleetCap)}/turn)</span>
      </div>
      <div class="mil-bar-bg"><div class="mil-bar-fill" style="width:${Math.round(fleet / fleetCeiling * 100)}%"></div></div>
      <div class="mil-supply-note ${capClass}">${fleetNote}</div>
    </div>`;

  // --- Sea zone control display ---
  let seaZonesHtml = '';
  if (navyUnlocked) {
    for (const [zoneId, zone] of Object.entries(SEA_PROVINCES)) {
      const playerStr = getPlayerNavyStrengthForZone(zoneId);
      const enemyStr  = getEnemyNavyStrengthForZone(zoneId);
      const ctrl      = getSeaControlForZone(zoneId);
      const ctrlPct   = Math.round(ctrl * 100);
      const ctrlClass = ctrl >= 0.75 ? 'stat-pos' : ctrl >= 0.4 ? 'effect-neutral' : 'stat-neg';
      const seaRoutes = G.tradeRoutes.filter(r => r.seaZone === zoneId);
      const routeNote = seaRoutes.length > 0 ? ` — ${seaRoutes.length} route${seaRoutes.length !== 1 ? 's' : ''} exposed` : ' — no routes here';
      seaZonesHtml += `
        <div class="mil-sea-zone-row">
          <span class="mil-sea-zone-name">🌊 ${zone.name}</span>
          <span class="mil-sea-zone-info">Player fleet: ${playerStr.toFixed(1)} · Enemy: ${enemyStr.toFixed(1)}${routeNote}</span>
          <div class="mil-bar-bg"><div class="mil-bar-fill mil-bar-sea ${ctrl < 0.5 ? 'mil-bar-sea-contested' : ''}" style="width:${ctrlPct}%"></div></div>
          <span class="mil-sea-control-label ${ctrlClass}">${ctrlPct}% sea control</span>
        </div>`;
    }
  }

  // --- Commander cards ---
  const BRANCH_ICONS   = { navy: '⚓', army: '⚔️', airForce: '✈️' };
  const BRANCH_LABELS  = { navy: 'Navy', army: 'Army', airForce: 'Air Force' };
  const MISSION_LABELS = {
    tradeProtection: 'Trade Protection',
    offensivePatrol: 'Offensive Patrol',
    blockade:        'Blockade',
    defend:          'Defend',
    advance:         'Advance',
    garrison:        'Garrison',
    airSuperiority:  'Air Superiority',
    strategicBombing:'Strategic Bombing',
    airLogistics:    'Air Logistics',
  };

  function missionOptions(branch) {
    if (branch === 'navy') {
      return `<option value="tradeProtection">Trade Protection</option>`;
    }
    if (branch === 'army') {
      return `<option value="defend">Defend (Phase 5.6)</option>`;
    }
    // Air Force
    return [
      `<option value="airSuperiority">Air Superiority</option>`,
      `<option value="strategicBombing">Strategic Bombing</option>`,
      `<option value="airLogistics">Air Logistics</option>`,
    ].join('');
  }

  function targetOptions(branch, mission) {
    if (branch === 'navy' && mission === 'tradeProtection') {
      return Object.entries(SEA_PROVINCES)
        .map(([id, z]) => `<option value="${id}">${z.name}</option>`).join('');
    }
    if (branch === 'army') {
      const playerProvinces = Object.entries(PROVINCES).filter(([, p]) => p.nationId === 'player');
      return playerProvinces.map(([id, p]) => `<option value="${id}">${p.name}</option>`).join('');
    }
    if (branch === 'airForce') {
      if (mission === 'airSuperiority') {
        return Object.entries(SEA_PROVINCES)
          .map(([id, z]) => `<option value="${id}">${z.name}</option>`).join('');
      }
      if (mission === 'strategicBombing') {
        return Object.entries(NATIONS)
          .filter(([id]) => id !== 'player')
          .map(([id, n]) => `<option value="${id}">${n.name}</option>`).join('');
      }
      if (mission === 'airLogistics') {
        return Object.entries(PROVINCES)
          .filter(([, p]) => p.nationId === 'player')
          .map(([id, p]) => `<option value="${id}">${p.name}</option>`).join('');
      }
    }
    return `<option value="">N/A</option>`;
  }

  let cmdListHtml = '';
  if (commanders.length === 0) {
    cmdListHtml = '<div class="mil-supply-note">No commanders assigned. Add one below to direct military operations.</div>';
  } else {
    for (const cmd of commanders) {
      const icon      = BRANCH_ICONS[cmd.branch] || '?';
      const branchLbl = BRANCH_LABELS[cmd.branch] || cmd.branch;

      // ── Army commander: budget + unit roster UI ──────────────────────────
      if (cmd.branch === 'army') {
        const order    = cmd.order || { type: 'hold', target: null };
        const upkeep   = getCommanderUnitUpkeep(cmd);
        const free     = getCommanderBudgetFree(cmd);
        const units    = cmd.units || [];
        const deployProv = getCommanderDeploymentProvince(cmd);
        const inPosition = units.filter(u => u.status === 'ready' && u.position === deployProv).length;
        const moving     = units.filter(u => u.status === 'ready' && u.position !== deployProv).length;

        // Order target dropdown
        let orderTargetHtml = '';
        if (order.type === 'stage') {
          const nationOpts = Object.entries(NATIONS)
            .map(([id, n]) => `<option value="${id}" ${order.target === id ? 'selected' : ''}>${n.name}</option>`)
            .join('');
          orderTargetHtml = `<select class="mil-commander-select" onchange="setCommanderOrder('${cmd.id}', 'stage', this.value)">${nationOpts}</select>`;
        } else if (order.type === 'defend') {
          const provOpts = Object.keys(PROVINCES)
            .filter(id => PROVINCES[id].nationId === 'player')
            .map(id => `<option value="${id}" ${order.target === id ? 'selected' : ''}>${PROVINCES[id].name}</option>`)
            .join('');
          orderTargetHtml = `<select class="mil-commander-select" onchange="setCommanderOrder('${cmd.id}', 'defend', this.value)">${provOpts}</select>`;
        } else if (order.type === 'garrison') {
          const occupiedOpts = Object.keys(G.occupiedProvinces || {})
            .map(id => `<option value="${id}" ${order.target === id ? 'selected' : ''}>${PROVINCES[id]?.name || id}</option>`)
            .join('');
          orderTargetHtml = occupiedOpts
            ? `<select class="mil-commander-select" onchange="setCommanderOrder('${cmd.id}', 'garrison', this.value)">${occupiedOpts}</select>`
            : '<span class="stat-dim">No occupied provinces</span>';
        }
        const deployLabel = deployProv ? (PROVINCES[deployProv]?.name || deployProv) : '—';
        const statusBadge = (inPosition + moving) > 0
          ? `<span class="mil-order-status">${inPosition} in position${moving > 0 ? `, ${moving} en route` : ''} → ${deployLabel}</span>`
          : '';

        // Unit roster rows
        let rosterHtml = '';
        if (units.length === 0) {
          rosterHtml = '<div class="mil-unit-empty">No units. Recruit below.</div>';
        } else {
          for (const u of units) {
            const def       = UNIT_TYPES[u.type] || {};
            const upkeepRow = (def.upkeepPerSize || 0) * u.size;
            let statusBadgeUnit;
            if (u.status === 'recruiting') {
              statusBadgeUnit = `<span class="mil-unit-status recruiting">⏳ ${u.recruitTurnsLeft}t</span>`;
            } else if (u.position !== deployProv) {
              const eta = Math.ceil((getUnitTurnsPerHop(u.type) - (u.moveTimer || 0)) +
                (bfsMinHops([u.position], [deployProv]) - 1) * getUnitTurnsPerHop(u.type));
              statusBadgeUnit = `<span class="mil-unit-status moving">🚶 ~${eta}t</span>`;
            } else {
              statusBadgeUnit = `<span class="mil-unit-status ready">✓ Staged</span>`;
            }
            const posName = PROVINCES[u.position]?.name || u.position || '?';
            rosterHtml += `
              <div class="mil-unit-row">
                <span class="mil-unit-icon">${def.icon || '?'}</span>
                <span class="mil-unit-name">${u.name}</span>
                <span class="mil-unit-type">${def.name || u.type}</span>
                <span class="mil-unit-size">×${u.size}</span>
                ${statusBadgeUnit}
                <span class="mil-unit-pos stat-dim">@ ${posName}</span>
                <span class="mil-unit-upkeep stat-dim">${fmt(upkeepRow)}M/t</span>
                <button class="mil-unit-disband" onclick="disbandUnit('${cmd.id}','${u.id}')">✕</button>
              </div>`;
          }
        }

        // Recruit type options
        const typeOptsHtml = Object.entries(UNIT_TYPES)
          .map(([k, v]) => `<option value="${k}">${v.icon} ${v.name} — ${fmt(v.costPerSize)}M/sz, ${fmt(v.upkeepPerSize)}M/t/sz</option>`)
          .join('');

        cmdListHtml += `
          <div class="mil-commander-card">
            <div class="mil-commander-header">
              <span class="mil-commander-icon">${icon}</span>
              <span class="mil-commander-name">${cmd.name}</span>
              <span class="mil-commander-branch">${branchLbl}</span>
              <button class="mil-commander-remove" onclick="removeCommander('${cmd.id}')">✕</button>
            </div>
            <div class="mil-army-order-row">
              <label class="mil-commander-label">Order
                <select class="mil-commander-select" onchange="setCommanderOrder('${cmd.id}', this.value, document.getElementById('otgt_${cmd.id}')?.value)">
                  <option value="hold" ${order.type === 'hold' ? 'selected' : ''}>Hold at Capital</option>
                  <option value="stage" ${order.type === 'stage' ? 'selected' : ''}>Stage Against…</option>
                  <option value="defend" ${order.type === 'defend' ? 'selected' : ''}>Defend Province…</option>
                  <option value="garrison" ${order.type === 'garrison' ? 'selected' : ''}>Garrison Occupied Province…</option>
                </select>
              </label>
              <span id="otgt_${cmd.id}">${orderTargetHtml}</span>
              ${statusBadge}
            </div>
            <div class="mil-army-budget-row">
              <label class="mil-commander-label">Budget
                <input type="number" class="mil-commander-alloc" min="0" step="1" value="${cmd.budget || 0}"
                  onchange="setCommanderBudget('${cmd.id}', this.value)"> M/turn
              </label>
              <span class="mil-budget-summary">
                Upkeep: <strong>${fmt(upkeep)}M</strong> &nbsp;|&nbsp;
                <span class="${free >= 0 ? 'stat-pos' : 'stat-neg'}">${free >= 0 ? 'Free: ' + fmt(free) + 'M' : 'Shortfall: ' + fmt(-free) + 'M'}</span>
              </span>
            </div>
            <div class="mil-unit-roster">${rosterHtml}</div>
            <div class="mil-recruit-form">
              <select id="rtype_${cmd.id}" class="mil-commander-select">${typeOptsHtml}</select>
              <input id="rsize_${cmd.id}" type="number" class="mil-commander-alloc" min="1" max="${UNIT_MAX_SIZE}" value="1" style="width:48px">
              <input id="rname_${cmd.id}" type="text" class="mil-commander-name-input" placeholder="Unit name (optional)" maxlength="30">
              <button class="mil-add-btn" onclick="recruitUnit('${cmd.id}', document.getElementById('rtype_${cmd.id}').value, document.getElementById('rsize_${cmd.id}').value, document.getElementById('rname_${cmd.id}').value)">+ Recruit</button>
            </div>
          </div>`;
        continue;
      }

      // ── Navy / Air Force commander: unit roster + mission/target directive (Phase 5.7f) ──
      {
        const typeDefs = cmd.branch === 'navy' ? NAVAL_UNIT_TYPES : AIR_UNIT_TYPES;
        const upkeep   = getNavalAirCommanderUnitUpkeep(cmd);
        const free     = (cmd.budget || 0) - upkeep;
        const units    = cmd.units || [];

        // Mission effect badge
        const missionOptsHtml = missionOptions(cmd.branch);
        const targetOptsHtml  = targetOptions(cmd.branch, cmd.mission);
        let effectBadge = '';
        if (cmd.branch === 'navy' && cmd.mission === 'tradeProtection' && cmd.target) {
          const ctrl = getSeaControlForZone(cmd.target);
          const isAtWar = (G.wars || []).length > 0;
          const isInterdicting = isAtWar && ctrl > 0.5;
          const isFrozen       = ctrl < NAVAL_INTERDICTION_MATURITY_FREEZE_THRESHOLD;
          let badge = `${Math.round(ctrl * 100)}% control in ${SEA_PROVINCES[cmd.target]?.name || cmd.target}`;
          if (isInterdicting) badge += ' · ⚓ Interdicting enemy supply';
          if (isFrozen)       badge += ' · ❄ Route maturity frozen';
          effectBadge = `<span class="mil-deterrence-badge ${ctrl >= 0.5 ? 'stat-pos' : 'stat-neg'}">→ ${badge}</span>`;
        } else if (cmd.branch === 'airForce' && cmd.mission === 'airSuperiority' && cmd.target) {
          const inRange = isAirMissionInRange('airSuperiority', cmd.target);
          effectBadge = inRange
            ? `<span class="mil-deterrence-badge stat-pos">✈️ ${Math.round(getAirCommanderEffectiveStrength(cmd) * AIR_SEA_STRENGTH_FACTOR * 10) / 10} air str → ${SEA_PROVINCES[cmd.target]?.name || cmd.target}</span>`
            : `<span class="mil-deterrence-badge stat-neg">⚠ Out of range — build Airfield closer</span>`;
        } else if (cmd.branch === 'airForce' && cmd.mission === 'strategicBombing' && cmd.target) {
          const inRange = isAirMissionInRange('strategicBombing', cmd.target);
          if (inRange) {
            const effStr = getAirCommanderEffectiveStrength(cmd);
            const milDrain = (effStr * STRATEGIC_BOMBING_DRAIN).toFixed(3);
            const bombDmg  = (effStr * BOMBING_DAMAGE_PER_STR).toFixed(1);
            effectBadge = `<span class="mil-deterrence-badge stat-pos">✈️ Bombing ${NATIONS[cmd.target]?.name} — −${milDrain} mil/turn | +${bombDmg} bomb dmg/turn</span>`;
          } else {
            effectBadge = `<span class="mil-deterrence-badge stat-neg">⚠ Out of range — build Airfield closer</span>`;
          }
        } else if (cmd.branch === 'airForce' && cmd.mission === 'airLogistics' && cmd.target) {
          const inRange = isAirMissionInRange('airLogistics', cmd.target);
          const bonus   = getAirLogisticsSupplyBonus(cmd.target);
          effectBadge = inRange
            ? `<span class="mil-deterrence-badge stat-pos">✈️ +${(bonus * 100).toFixed(1)}% supply bonus → ${PROVINCES[cmd.target]?.name || cmd.target}</span>`
            : `<span class="mil-deterrence-badge stat-neg">⚠ Out of range — build Airfield closer</span>`;
        }

        // Unit roster rows
        let unitRows = units.length === 0
          ? `<div class="mil-unit-row"><em>No units — queue production below.</em></div>`
          : units.map(u => {
              const def = typeDefs[u.type];
              const icon2 = def?.icon || '•';
              const statusLabel = u.status === 'ready' ? '✅ Ready' : '🏭 Building';
              return `<div class="mil-unit-row">
                <span class="mil-unit-icon">${icon2}</span>
                <span class="mil-unit-name">${u.name}</span>
                <span class="mil-unit-size">×${u.size}</span>
                <span class="mil-unit-status">${statusLabel}</span>
                <button class="mil-unit-disband" onclick="disbandUnit('${cmd.id}', '${u.id}')">✕</button>
              </div>`;
            }).join('');

        // Recruit (queue) form
        const typeOpts = Object.entries(typeDefs)
          .map(([k, d]) => `<option value="${k}">${d.icon || ''} ${d.name} (×1: ${fmt(d.costPerSize)}M, ${d.productionTurns}t)</option>`)
          .join('');

        cmdListHtml += `
          <div class="mil-commander-card">
            <div class="mil-commander-header">
              <span class="mil-commander-icon">${icon}</span>
              <span class="mil-commander-name">${cmd.name}</span>
              <span class="mil-commander-branch">${branchLbl}</span>
              ${effectBadge}
              <button class="mil-commander-remove" onclick="removeCommander('${cmd.id}')">✕</button>
            </div>
            <div class="mil-commander-budget-row">
              <label class="mil-commander-label">Budget (M/turn)
                <input type="number" class="mil-commander-alloc" min="0" step="1" value="${cmd.budget || 0}"
                  onchange="setCommanderBudget('${cmd.id}', this.value)">
              </label>
              <span class="mil-budget-free ${free < 0 ? 'stat-neg' : 'stat-pos'}">Upkeep: ${fmt(upkeep)}M — ${free >= 0 ? fmt(free) + 'M free' : fmt(-free) + 'M shortfall'}</span>
            </div>
            <div class="mil-commander-controls">
              <label class="mil-commander-label">Mission
                <select id="mis_${cmd.id}" class="mil-commander-select" onchange="updateCommanderMission('${cmd.id}', this.value, document.getElementById('tgt_${cmd.id}')?.value)">
                  ${missionOptsHtml.replace(`value="${cmd.mission}"`, `value="${cmd.mission}" selected`)}
                </select>
              </label>
              <label class="mil-commander-label">Target
                <select id="tgt_${cmd.id}" class="mil-commander-select" onchange="updateCommanderMission('${cmd.id}', document.getElementById('mis_${cmd.id}')?.value || '${cmd.mission}', this.value)">
                  ${targetOptsHtml.replace(`value="${cmd.target}"`, `value="${cmd.target}" selected`)}
                </select>
              </label>
            </div>
            <div class="mil-unit-list">${unitRows}</div>
            <div class="mil-recruit-form">
              <select id="qtype_${cmd.id}" class="mil-commander-select">${typeOpts}</select>
              <label class="mil-commander-label">Size <input id="qsize_${cmd.id}" type="number" class="mil-commander-alloc" min="1" max="${UNIT_MAX_SIZE}" value="1"></label>
              <input id="qname_${cmd.id}" type="text" class="mil-commander-name-input" placeholder="Unit name (optional)" maxlength="30">
              <button class="mil-add-btn" onclick="queueProductionItem('${cmd.id}', document.getElementById('qtype_${cmd.id}').value, document.getElementById('qsize_${cmd.id}').value, document.getElementById('qname_${cmd.id}').value)">+ Queue</button>
            </div>
          </div>`;
      }
    }
  }

  // --- Add commander form ---
  const unlockedBranchOptions = [
    G.unlockedTechs.includes('standingArmy')        ? `<option value="army">Army ⚔️</option>`      : '',
    G.unlockedTechs.includes('navalFleet')           ? `<option value="navy">Navy ⚓</option>`      : '',
    G.unlockedTechs.includes('airForceEstablishment')? `<option value="airForce">Air Force ✈️</option>` : '',
  ].join('');

  const addFormHtml = unlockedBranchOptions
    ? `<div class="mil-add-commander">
        <input id="mil-cmd-name" type="text" class="mil-commander-name-input" placeholder="Commander name…" maxlength="30">
        <select id="mil-cmd-branch" class="mil-commander-select">${unlockedBranchOptions}</select>
        <button class="mil-add-btn" onclick="addCommander(document.getElementById('mil-cmd-name').value, document.getElementById('mil-cmd-branch').value); document.getElementById('mil-cmd-name').value='';">+ Assign Commander</button>
      </div>`
    : `<div class="mil-supply-note">Unlock military branches to assign commanders.</div>`;

  return `
    <div class="mil-commanders-section">
      <div class="mil-panel-header">
        <span class="mil-panel-title">🎖️ Command Assignments</span>
        <span class="mil-deterrence-badge">${commanders.length} assigned</span>
      </div>
      ${fleetHtml}
      ${navyUnlocked ? `<div class="mil-sea-zones">${seaZonesHtml}</div>` : ''}
      <div class="mil-commander-list">${cmdListHtml}</div>
      ${addFormHtml}
      ${renderProductionQueueHtml()}
      ${renderCommanderAssessmentsHtml()}
    </div>`;
}

function renderProductionQueueHtml() {
  const queue = G.productionQueue || [];
  if (queue.length === 0) return '';
  let rows = queue.map((item, idx) => {
    const typeDefs = item.branch === 'navy' ? NAVAL_UNIT_TYPES : AIR_UNIT_TYPES;
    const def = typeDefs[item.unitType];
    const cmd = (G.commanders || []).find(c => c.id === item.commanderId);
    const cmdName = cmd ? cmd.name : '?';
    const progress = item.turnsTotal > 0
      ? Math.round((1 - item.turnsLeft / item.turnsTotal) * 100) : 100;
    const statusLabel = idx === 0 ? `🏭 Building — ${Math.ceil(item.turnsLeft)}t left` : `⏳ Queued — ${item.turnsLeft}t`;
    return `<div class="mil-prodqueue-row">
      <span class="mil-unit-icon">${def?.icon || '•'}</span>
      <span class="mil-unit-name">${item.unitName} (×${item.size})</span>
      <span class="mil-unit-size">${cmdName}</span>
      <span class="mil-unit-status">${statusLabel}</span>
      ${idx === 0
        ? `<div class="mil-bar-bg" style="width:80px;display:inline-block"><div class="mil-bar-fill mil-bar-deterrence" style="width:${progress}%"></div></div>`
        : ''}
      <button class="mil-unit-disband" onclick="cancelProductionItem('${item.id}')">✕</button>
    </div>`;
  }).join('');
  return `<div class="mil-prodqueue-section">
    <div class="mil-panel-header">
      <span class="mil-panel-title">🏭 Production Queue</span>
      <span class="mil-deterrence-badge">${queue.length} item${queue.length !== 1 ? 's' : ''}</span>
    </div>
    ${rows}
  </div>`;
}

function renderCommanderAssessmentsHtml() {
  const assessments = G.commanderAssessments || [];
  if (assessments.length === 0) return '';
  const rows = assessments.map(a => {
    return `<div class="mil-assessment-row">
      <span class="mil-assessment-reason">${a.reason}</span>
      <button class="mil-add-btn" onclick="acceptAssessment('${a.id}')">Accept</button>
      <button class="mil-unit-disband" onclick="dismissAssessment('${a.id}')">Dismiss</button>
    </div>`;
  }).join('');
  return `<div class="mil-assessments-section">
    <div class="mil-panel-header">
      <span class="mil-panel-title">📋 Commander Assessments</span>
      <span class="mil-deterrence-badge">${assessments.length} pending</span>
    </div>
    ${rows}
  </div>`;
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
        <div class="diplo-nation-header" style="border-left:3px solid ${def.color}">
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

  // Named sea regions (drawn above background, below land provinces)
  for (const [id, sea] of Object.entries(SEA_PROVINCES)) {
    svg += `<polygon class="map-sea-region" points="${sea.points}" fill="${sea.color}"/>`;
    svg += `<text class="map-sea-label" x="${sea.labelX}" y="${sea.labelY}">${sea.name}</text>`;
  }

  // Build a per-nation province list for efficient rendering
  const nationProvinces = {};
  for (const [id, prov] of Object.entries(PROVINCES)) {
    if (!nationProvinces[prov.nationId]) nationProvinces[prov.nationId] = [];
    nationProvinces[prov.nationId].push({ id, ...prov });
  }

  // AI nation provinces — each province is its own polygon, all clickable for nation selection
  for (const [nationId, provs] of Object.entries(nationProvinces)) {
    if (nationId === 'player') continue;
    const ns  = G.nations[nationId];
    const def = NATIONS[nationId];
    if (!ns || !def) continue;
    const sel    = _mapSelectedNation === nationId ? ' map-region-selected' : '';
    const relCls = ns.relations >= 20 ? ' map-region-friendly' : ns.relations <= -20 ? ' map-region-hostile' : '';
    const atWarCls = isAtWar(nationId) ? ' map-region-at-war' : '';
    for (const prov of provs) {
      // Occupied provinces: render with a distinct overlay instead of nation color
      if (G.occupiedProvinces?.[prov.id]) {
        svg += `<polygon class="map-province-occupied" points="${prov.points}" onclick="selectMapNation('${nationId}')"/>`;
      } else if (G.siegeState?.[prov.id]) {
        svg += `<polygon class="map-region${relCls}${sel}${atWarCls}" points="${prov.points}" fill="${prov.color}" onclick="selectMapNation('${nationId}')"/>`;
        svg += `<polygon class="map-province-contested" points="${prov.points}" fill="none" pointer-events="none"/>`;
      } else {
        svg += `<polygon class="map-region${relCls}${sel}${atWarCls}" points="${prov.points}" fill="${prov.color}" onclick="selectMapNation('${nationId}')"/>`;
      }
    }
    // Nation label and capital dot drawn once, centred in nation territory
    svg += `<text class="map-label" x="${def.labelX}" y="${def.labelY}">${def.name}</text>`;
    svg += `<circle class="map-capital" cx="${def.capitalX}" cy="${def.capitalY}" r="3"/>`;
  }

  // Player empire provinces
  for (const prov of (nationProvinces['player'] || [])) {
    const selCls = _mapSelectedProvince === prov.id ? ' map-province-selected' : '';
    svg += `<polygon class="map-province${selCls}" points="${prov.points}" fill="${prov.color}" onclick="selectMapProvince('${prov.id}')"/>`;
    svg += `<text class="map-province-label" x="${prov.labelX}" y="${prov.labelY}">${prov.name}</text>`;
    // Show installation icons in province
    const provInstalls = getInstallationsInProvince(prov.id);
    if (provInstalls.length > 0) {
      const icons = provInstalls.map(i => INSTALLATION_TYPES[i.type]?.icon || '').join('');
      svg += `<text class="map-install-icons" x="${prov.labelX}" y="${prov.labelY + 12}">${icons}</text>`;
    }
  }
  svg += `<text class="map-label map-player-label" x="${PLAYER_MAP.labelX}" y="${PLAYER_MAP.labelY}">${G.empire}</text>`;
  svg += `<circle class="map-capital map-player-capital" cx="${PLAYER_MAP.capitalX}" cy="${PLAYER_MAP.capitalY}" r="4"/>`;

  // --- Trade route paths (drawn last so they appear on top of provinces) ---
  for (const route of G.tradeRoutes) {
    const path = getTradeRouteLandPath(route.nationId);
    if (!path || path.length < 2) continue;
    const pts = path
      .map(pid => { const p = PROVINCES[pid]; return p ? `${p.labelX},${p.labelY}` : null; })
      .filter(Boolean).join(' ');
    if (!pts) continue;
    const matAlpha = (0.35 + 0.45 * Math.min(1, route.maturity / TRADE_ROUTE_MATURITY_TURNS)).toFixed(2);
    const pathEff  = getRoutePathEfficiencyMultiplier(route);
    const cls      = route.seaZone ? 'map-trade-path map-trade-path-sea' : 'map-trade-path';
    svg += `<polyline class="${cls}" points="${pts}" stroke-opacity="${matAlpha}" data-eff="${pathEff.toFixed(2)}"/>`;
    // Tiny efficiency label at midpoint province
    const midIdx = Math.floor(path.length / 2);
    const midP   = PROVINCES[path[midIdx]];
    if (midP && pathEff < 1) {
      svg += `<text class="map-trade-path-label" x="${midP.labelX}" y="${midP.labelY - 8}">${Math.round(pathEff * 100)}%</text>`;
    }
  }

  // --- Staging province highlight (Phase 5.7b) ---
  // Drawn after player provinces so the glow sits on top of them.
  const stagingProvinces = getStagingProvinces();
  for (const provId of stagingProvinces) {
    const prov = PROVINCES[provId];
    if (prov) svg += `<polygon class="map-province-staging" points="${prov.points}" fill="none" pointer-events="none"/>`;
  }

  // --- Unit icons on the map (Phase 5.7b) ---
  const UNIT_ICON_OFFSETS = [[0,0],[-11,-8],[11,-8],[-11,8],[11,8],[0,-14],[0,14],[-16,0],[16,0]];
  const unitsByProvince = getProvincesWithPlayerUnits();
  for (const [provId, entries] of Object.entries(unitsByProvince)) {
    const prov = PROVINCES[provId];
    if (!prov) continue;
    entries.forEach(({ unit }, i) => {
      const def = UNIT_TYPES[unit.type] || {};
      const off = UNIT_ICON_OFFSETS[i % UNIT_ICON_OFFSETS.length];
      svg += `<text class="map-unit-icon" x="${prov.labelX + off[0]}" y="${prov.labelY + off[1]}">${def.icon || '?'}</text>`;
    });
    if (entries.length > 1) {
      svg += `<circle class="map-unit-count-bg" cx="${prov.labelX + 10}" cy="${prov.labelY - 11}" r="7"/>`;
      svg += `<text class="map-unit-count" x="${prov.labelX + 10}" y="${prov.labelY - 11}">${entries.length}</text>`;
    }
  }

  // --- AI unit icons on the map (Phase 5.7c) ---
  for (const war of (G.wars || [])) {
    const aiUnits = getProvincesWithAiUnits(war.nationId);
    for (const [provId, entries] of Object.entries(aiUnits)) {
      const prov = PROVINCES[provId];
      if (!prov) continue;
      entries.forEach(({ unit }, i) => {
        const def = UNIT_TYPES[unit.type] || {};
        const off = UNIT_ICON_OFFSETS[i % UNIT_ICON_OFFSETS.length];
        svg += `<text class="map-ai-unit-icon" x="${prov.labelX + off[0]}" y="${prov.labelY + off[1]}">${def.icon || '?'}</text>`;
      });
      if (entries.length > 1) {
        svg += `<circle class="map-ai-unit-count-bg" cx="${prov.labelX + 10}" cy="${prov.labelY - 11}" r="7"/>`;
        svg += `<text class="map-ai-unit-count" x="${prov.labelX + 10}" y="${prov.labelY - 11}">${entries.length}</text>`;
      }
    }
  }

  // --- Siege progress labels ---
  for (const [provId, siege] of Object.entries(G.siegeState || {})) {
    const prov = PROVINCES[provId];
    if (!prov) continue;
    svg += `<text class="map-siege-progress" x="${prov.labelX}" y="${prov.labelY + 14}">${Math.round(siege.progress)}%</text>`;
  }

  // --- Info panel for selected nation OR selected player province OR occupied province ---
  let infoHtml = '';
  const isOccupied = !!G.occupiedProvinces?.[_mapSelectedProvince];
  if (_mapSelectedProvince && (PROVINCES[_mapSelectedProvince]?.nationId === 'player' || isOccupied)) {
    infoHtml = _buildProvincePanel(_mapSelectedProvince);
  } else if (_mapSelectedNation && G.nations[_mapSelectedNation]) {
    const id   = _mapSelectedNation;
    const ns   = G.nations[id];
    const def  = NATIONS[id];
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
        <div class="map-info-nation" style="border-left:3px solid ${def.color}">
          <span class="map-info-name">${def.name}</span>
        </div>
        <div class="map-info-grid">
          <div class="map-info-item"><div class="map-info-label">GDP</div><div class="map-info-val">$${ns.gdp.toFixed(0)}B</div></div>
          <div class="map-info-item"><div class="map-info-label">Military</div><div class="map-info-val">${ns.militaryLevel.toFixed(0)} / 100</div></div>
          <div class="map-info-item"><div class="map-info-label">Relations</div><div class="map-info-val ${relCls}">${ns.relations.toFixed(0)} \u2014 ${relLabel}</div></div>
          <div class="map-info-item map-info-item-wide"><div class="map-info-label">Borders</div><div class="map-info-val">${borders}</div></div>
        </div>
        ${tradeHtml}
        ${_buildWarPanel(id)}
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
  _mapSelectedProvince = null;
  renderWorldMap();
}

function selectMapProvince(id) {
  if (_mapDragMoved) return;
  _mapSelectedProvince = (_mapSelectedProvince === id) ? null : id;
  _mapSelectedNation = null;
  renderWorldMap();
}

// ============================================================
// RESEARCH TAB — visual left-to-right tech tree (Phase 5.7d)
// ============================================================

// Path → display row (0 = top). Determines the vertical lane in the tree.
const _TECH_PATH_ROW = {
  economic:    0,
  industrial:  1,
  military:    2,
  militaryEng: 3,
  trade:       4,
  social:      5,
  science:     6,
};

const _TECH_PATH_LABELS = {
  economic:    'Economic',
  industrial:  'Industrial',
  military:    'Military',
  militaryEng: 'Mil. Engineering',
  trade:       'Trade & Diplomacy',
  social:      'Social',
  science:     'Science',
};

const _TECH_PATH_COLORS = {
  economic:    '#d4a017',
  industrial:  '#8b6f47',
  military:    '#c0392b',
  militaryEng: '#7f3fbf',
  trade:       '#1f8c6e',
  social:      '#2a7abf',
  science:     '#4a9e4a',
};

// Compute col (depth) and row for each tech.
// Column = max depth of prerequisite chain. Row = path row.
// Collisions (same col+row) are resolved by small vertical offsets.
function _computeTechTreeLayout() {
  const depthCache = {};
  function getDepth(techId) {
    if (techId in depthCache) return depthCache[techId];
    const tech = TECHNOLOGIES[techId];
    if (!tech || !tech.requires || tech.requires.length === 0) {
      return (depthCache[techId] = 0);
    }
    return (depthCache[techId] = Math.max(...tech.requires.map(getDepth)) + 1);
  }

  const rawPos = {};
  for (const techId of Object.keys(TECHNOLOGIES)) {
    const tech = TECHNOLOGIES[techId];
    rawPos[techId] = {
      col: getDepth(techId),
      row: _TECH_PATH_ROW[tech.path] ?? 4,
    };
  }

  // Resolve collisions: spread same-(col,row) techs vertically
  const buckets = {};
  for (const [id, pos] of Object.entries(rawPos)) {
    const key = `${pos.col},${pos.row}`;
    (buckets[key] = buckets[key] || []).push(id);
  }

  const positions = {};
  for (const ids of Object.values(buckets)) {
    const n = ids.length;
    ids.forEach((id, i) => {
      positions[id] = {
        col: rawPos[id].col,
        row: rawPos[id].row + (i - (n - 1) / 2) * 0.55,
      };
    });
  }
  return positions;
}

function _buildResearchTab(rp, ceiling) {
  const NODE_W  = 152;
  const NODE_H  = 78;
  const COL_W   = 192;  // column stride
  const ROW_H   = 108;  // row stride (base)
  const PAD_X   = 16;
  const PAD_Y   = 20;
  const LABEL_W = 118;

  const positions = _computeTechTreeLayout();

  // Compute canvas size
  let maxCol = 0;
  let maxRowFrac = 0;
  for (const pos of Object.values(positions)) {
    if (pos.col > maxCol) maxCol = pos.col;
    if (pos.row > maxRowFrac) maxRowFrac = pos.row;
  }
  const canvasW = (maxCol + 1) * COL_W + PAD_X * 2;
  const canvasH = Math.ceil(maxRowFrac + 1) * ROW_H + PAD_Y * 2 + 20;

  // Helper: pixel coords for node left-midpoint and right-midpoint
  const nodeX   = (pos) => PAD_X + pos.col * COL_W;
  const nodeY   = (pos) => PAD_Y + pos.row * ROW_H;
  const midY    = (pos) => nodeY(pos) + NODE_H / 2;

  // Build SVG connection lines
  let svgLines = '';
  for (const [techId, tech] of Object.entries(TECHNOLOGIES)) {
    for (const reqId of (tech.requires || [])) {
      const from = positions[reqId];
      const to   = positions[techId];
      if (!from || !to) continue;
      const x1 = nodeX(from) + NODE_W;
      const y1 = midY(from);
      const x2 = nodeX(to);
      const y2 = midY(to);
      const cx = (x1 + x2) / 2;
      const unlocked = G.unlockedTechs.includes(reqId) && G.unlockedTechs.includes(techId);
      const available = G.unlockedTechs.includes(reqId) && !G.unlockedTechs.includes(techId);
      const cls = unlocked ? 'tt-line tt-line-done' : available ? 'tt-line tt-line-avail' : 'tt-line';
      svgLines += `<path d="M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}" class="${cls}"/>`;
    }
  }

  // Build tech nodes
  let nodes = '';
  for (const [id, tech] of Object.entries(TECHNOLOGIES)) {
    const pos = positions[id];
    if (!pos) continue;
    const x = nodeX(pos);
    const y = nodeY(pos);
    const unlocked  = G.unlockedTechs.includes(id);
    const isActive  = G.activeResearch === id;
    const isQueued  = (G.techQueue || []).includes(id);
    const reqMet    = (tech.requires || []).every(r => G.unlockedTechs.includes(r));
    const available = !unlocked && reqMet && !isActive;
    const locked    = !unlocked && !reqMet && !isActive;
    const cost      = getTechCost(id);
    const color     = _TECH_PATH_COLORS[tech.path] || '#888';

    let cls = 'tt-node';
    if (unlocked)       cls += ' tt-done';
    else if (isActive)  cls += ' tt-active';
    else if (isQueued)  cls += ' tt-queued';
    else if (locked)    cls += ' tt-locked';
    else                cls += ' tt-avail';

    const progressPct = isActive
      ? Math.min(100, (G.researchProgress / cost) * 100)
      : 0;

    const queueIdx   = isQueued ? (G.techQueue.indexOf(id) + 1) : 0;
    const turnsLabel = (!unlocked && rp > 0)
      ? '~' + getTurnsToComplete(id) + 't'
      : '';

    const progressBar = isActive
      ? `<div class="tt-progress-bar" style="width:${progressPct.toFixed(1)}%"></div>`
      : '';

    const badge = unlocked    ? '<span class="tt-badge tt-badge-done">✓</span>'
      : isActive  ? `<span class="tt-badge tt-badge-active">${progressPct.toFixed(0)}%</span>`
      : isQueued  ? `<span class="tt-badge tt-badge-queue">#${queueIdx}</span>`
      : '';

    const onclick = (unlocked || isActive)
      ? (isActive ? `cancelResearch()` : '')
      : `enqueueTech('${id}')`;

    nodes += `
      <div class="${cls}" style="left:${x}px;top:${y}px;width:${NODE_W}px;height:${NODE_H}px;border-color:${color}"
           title="${tech.description}${locked ? '\n⚠ Requires: ' + (tech.requires || []).map(r => TECHNOLOGIES[r]?.name || r).join(', ') : ''}"
           ${onclick ? `onclick="${onclick}"` : ''}>
        ${progressBar ? `<div class="tt-progress-track">${progressBar}</div>` : ''}
        <div class="tt-node-body">
          <span class="tt-icon">${tech.icon}</span>
          <div class="tt-text">
            <div class="tt-name">${tech.name}</div>
            <div class="tt-cost">${unlocked ? 'Researched' : isActive ? 'In Progress' : cost + ' RP' + (turnsLabel ? ' · ' + turnsLabel : '')}</div>
          </div>
          ${badge}
        </div>
      </div>`;
  }

  // Path lane labels (left side, fixed column)
  let laneLabels = '';
  const usedRows = new Set(Object.values(_TECH_PATH_ROW));
  for (const [path, row] of Object.entries(_TECH_PATH_ROW)) {
    if (!usedRows.has(row)) continue;
    const y = PAD_Y + row * ROW_H + NODE_H / 2 - 10;
    const color = _TECH_PATH_COLORS[path] || '#888';
    laneLabels += `<div class="tt-lane-label" style="top:${y}px;color:${color}">${_TECH_PATH_LABELS[path]}</div>`;
  }

  // Queue panel
  const activeId   = G.activeResearch;
  const activeTech = activeId ? TECHNOLOGIES[activeId] : null;
  const queue      = G.techQueue || [];
  const activePct  = activeTech
    ? Math.min(100, (G.researchProgress / getTechCost(activeId)) * 100).toFixed(1)
    : 0;
  const activeTurns = activeTech ? getTurnsToComplete(activeId) : null;

  let queueRows = '';
  for (let i = 0; i < queue.length; i++) {
    const t = TECHNOLOGIES[queue[i]];
    if (!t) continue;
    const prereqMet = (t.requires || []).every(r => G.unlockedTechs.includes(r) || queue.slice(0, i).includes(r));
    queueRows += `
      <div class="tt-queue-row ${prereqMet ? '' : 'tt-queue-warn'}" title="${prereqMet ? '' : 'Prerequisites may not be met by the time this is reached'}">
        <span class="tt-queue-num">#${i + 1}</span>
        <span class="tt-queue-icon">${t.icon}</span>
        <span class="tt-queue-name">${t.name}</span>
        <span class="tt-queue-cost">${getTechCost(queue[i])} RP</span>
        <button class="tt-queue-btn" onclick="moveQueueUp('${queue[i]}')" title="Move up" ${i === 0 ? 'disabled' : ''}>▲</button>
        <button class="tt-queue-btn" onclick="moveQueueDown('${queue[i]}')" title="Move down" ${i === queue.length - 1 ? 'disabled' : ''}>▼</button>
        <button class="tt-queue-btn tt-queue-remove" onclick="dequeueTech('${queue[i]}')" title="Remove">✕</button>
      </div>`;
  }

  const queuePanel = `
    <div class="tt-queue-panel">
      <div class="tt-queue-header">Research Queue</div>
      <div class="tt-queue-active">
        <div class="tt-queue-active-label">Now Researching</div>
        ${activeTech
          ? `<div class="tt-queue-active-name">${activeTech.icon} ${activeTech.name}</div>
             <div class="tt-queue-active-bar-track"><div class="tt-queue-active-bar" style="width:${activePct}%"></div></div>
             <div class="tt-queue-active-detail">${activePct}% &nbsp;·&nbsp; ${isFinite(activeTurns) ? '~' + activeTurns + ' turns' : '—'}</div>
             <button class="btn-small btn-neg" onclick="cancelResearch()">Cancel</button>`
          : '<div class="tt-queue-active-empty">Nothing active — click a tech to queue it.</div>'
        }
      </div>
      <div class="tt-queue-list">
        ${queueRows || '<div class="tt-queue-empty">Queue is empty</div>'}
      </div>
      <div class="tt-queue-footer">
        <span>RP/turn: +${rp.toFixed(1)}</span>
        <span>Research: ${G.researchLevel.toFixed(1)} / ${ceiling}</span>
      </div>
    </div>`;

  return `
    <div class="tt-layout">
      <div class="tt-scroll-wrapper">
        <div class="tt-lane-labels" style="height:${canvasH}px">${laneLabels}</div>
        <div class="tt-scroll-area">
          <div class="tt-canvas" style="width:${canvasW}px;height:${canvasH}px">
            <svg class="tt-svg" width="${canvasW}" height="${canvasH}">${svgLines}</svg>
            ${nodes}
          </div>
        </div>
      </div>
      ${queuePanel}
    </div>`;
}

// War section shown in the nation info panel (Phase 5.7c).
function _buildWarPanel(nationId) {
  const atWar = isAtWar(nationId);
  if (!atWar) {
    return `<div class="map-war-section">
      <button class="map-declare-war-btn" onclick="declareWar('${nationId}')">⚔️ Declare War</button>
    </div>`;
  }
  const war        = G.wars.find(w => w.nationId === nationId);
  const occupied   = getPlayerOccupiedProvincesOf(nationId);
  const total      = getNationProvinces(nationId).length;
  const aiMil      = G.aiMilitary[nationId];
  const aiStrength = (aiMil?.commanders || []).flatMap(c => c.units || [])
    .filter(u => u.status === 'ready').reduce((s, u) => s + u.size, 0);
  const sueLabel   = war?.sueForPeaceOffered ? '<span class="map-sue-badge">🏳️ Requesting Peace</span>' : '';
  return `<div class="map-war-section map-war-active">
    <div class="map-war-header">⚔️ AT WAR — Turn ${war?.declaredTurn || '?'}${sueLabel}</div>
    <div class="map-war-stats">
      Occupied: ${occupied.length}/${total} provinces &nbsp;|&nbsp; Enemy units: ${aiStrength}
    </div>
    <button class="map-peace-btn" onclick="openPeaceDeal('${nationId}')">🤝 Offer Peace Deal</button>
  </div>`;
}

// Open the peace deal modal for a nation currently at war.
function openPeaceDeal(nationId) {
  const occupied = getPlayerOccupiedProvincesOf(nationId);
  let rowsHtml = '';
  if (occupied.length === 0) {
    rowsHtml = '<div class="peace-no-provinces">No provinces currently occupied.</div>';
  } else {
    for (const provId of occupied) {
      const name       = PROVINCES[provId]?.name || provId;
      const resistance = G.occupiedProvinces[provId]?.resistance ?? 0;
      const resClass   = resistance >= 70 ? 'peace-res-high' : resistance >= 40 ? 'peace-res-mid' : 'peace-res-low';
      const dev        = PROVINCES[provId]?.development ?? 1;
      const turnsEdu   = Math.floor(G.educationLevel / 20) * INTEGRATION_EDU_REDUCTION_PER_20;
      const intTurns   = Math.max(3, dev * INTEGRATION_TURNS_PER_DEV - turnsEdu);
      rowsHtml += `<label class="peace-province-row">
        <input type="checkbox" class="peace-prov-check" value="${provId}" checked>
        <span class="peace-prov-name">${name}</span>
        <span class="peace-prov-stats">
          Dev ${dev} &nbsp;·&nbsp;
          <span class="${resClass}">Resistance ${resistance.toFixed(0)}%</span>
          &nbsp;·&nbsp; ~${intTurns}t integration
        </span>
      </label>`;
    }
  }
  const modal = document.createElement('div');
  modal.id = 'peace-deal-modal';
  modal.className = 'peace-modal-overlay';
  modal.innerHTML = `
    <div class="peace-modal">
      <div class="peace-modal-title">Peace Deal with ${NATIONS[nationId]?.name}</div>
      <div class="peace-modal-subtitle">Select provinces to annex. Unchecked provinces are returned.</div>
      <div class="peace-province-list">${rowsHtml}</div>
      <div class="peace-modal-actions">
        <button class="btn-primary" onclick="
          const checks = document.querySelectorAll('.peace-prov-check:checked');
          const keep = Array.from(checks).map(c => c.value);
          document.getElementById('peace-deal-modal').remove();
          offerPeace('${nationId}', keep);
        ">Sign Peace Deal</button>
        <button class="btn-secondary" onclick="document.getElementById('peace-deal-modal').remove()">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function _buildProvincePanel(provinceId) {
  const prov = PROVINCES[provinceId];
  if (!prov) return '';

  const isOccupied   = !!G.occupiedProvinces?.[provinceId];
  const isIntegrating = !isOccupied && !!G.integratingProvinces?.[provinceId];
  const occData       = G.occupiedProvinces?.[provinceId];
  const intData       = G.integratingProvinces?.[provinceId];
  const bombData      = G.provinceBombDamage?.[provinceId];

  // Occupied province — show resistance info instead of build UI
  if (isOccupied) {
    const resistance = occData?.resistance ?? 0;
    const resClass   = resistance >= 70 ? 'stat-neg' : resistance >= 40 ? 'stat-warn' : 'stat-pos';
    const turnsHeld  = occData?.turnsHeld ?? 0;
    const hasGarrison = (G.commanders || []).some(
      c => c.branch === 'army' && c.order?.type === 'garrison' && c.order?.target === provinceId
    );
    return `
      <div class="map-info-panel">
        <div class="map-info-nation">
          <span class="map-info-name">${prov.name}</span>
          <span class="map-province-badge occupied-badge">⚔️ Occupied</span>
        </div>
        <div class="map-info-grid">
          <div class="map-info-item"><div class="map-info-label">Dev</div><div class="map-info-val">${prov.development}/5</div></div>
          <div class="map-info-item"><div class="map-info-label">Turns Held</div><div class="map-info-val">${turnsHeld}</div></div>
          <div class="map-info-item"><div class="map-info-label">Resistance</div><div class="map-info-val ${resClass}">${resistance.toFixed(0)}/100</div></div>
          <div class="map-info-item"><div class="map-info-label">Garrison</div><div class="map-info-val ${hasGarrison ? 'stat-pos' : 'stat-neg'}">${hasGarrison ? '✓ Yes' : '✗ None'}</div></div>
        </div>
        <div class="prov-install-section">
          <div class="prov-install-label stat-dim">${hasGarrison ? 'Garrison is suppressing resistance.' : '⚠ No garrison — resistance is growing. Assign a commander with Garrison order.'}</div>
          ${(bombData && (bombData.damage > 0 || bombData.devLost > 0)) ? `<div class="prov-bomb-damage-banner">💥 Under Bombardment — ${bombData.damage.toFixed(1)} / ${BOMBING_DEV_DROP_THRESHOLD} dmg${bombData.devLost > 0 ? ` · ${bombData.devLost} dev lost` : ''}</div>` : ''}
        </div>
      </div>`;
  }

  const existing = getInstallationsInProvince(provinceId);
  let existingHtml = '';
  if (existing.length > 0) {
    existingHtml = '<div class="prov-install-label">Built installations:</div>';
    const counts = {};
    for (const inst of existing) counts[inst.type] = (counts[inst.type] || 0) + 1;
    for (const [type, count] of Object.entries(counts)) {
      const def = INSTALLATION_TYPES[type];
      existingHtml += `<div class="prov-install-item">${def.icon} ${def.name} ×${count} — −${fmt(def.maintenance * count)}/turn</div>`;
    }
  } else {
    existingHtml = '<div class="prov-install-label stat-dim">No installations built.</div>';
  }

  let buildHtml = '<div class="prov-install-label">Build:</div>';
  for (const [type, def] of Object.entries(INSTALLATION_TYPES)) {
    const cost = getInstallationBuildCost(type, provinceId);
    const canAfford = G.treasury >= cost;
    const needsCoastal = def.requiresCoastal && !prov.coastal;
    const atMax = def.maxPerProvince !== undefined &&
      (G.installations || []).filter(i => i.type === type && i.provinceId === provinceId).length >= def.maxPerProvince;
    const disabled = !canAfford || needsCoastal || atMax;
    const disabledAttr = disabled ? 'disabled' : '';
    const hint = atMax ? ` (max ${def.maxPerProvince} per province)` : needsCoastal ? ' (coastal only)' : (!canAfford ? ' (need ' + fmt(cost) + 'M)' : '');
    buildHtml += `<button class="btn btn-sm prov-install-btn" onclick="buildInstallation('${type}','${provinceId}')" ${disabledAttr}>
      ${def.icon} ${def.name} — ${fmt(cost)}M${hint}
    </button>`;
  }

  // Integration progress banner (shown for newly annexed provinces)
  const integrationHtml = isIntegrating
    ? `<div class="prov-integrating-banner">
        ⏳ Integrating — ${intData.turnsRemaining} turn${intData.turnsRemaining !== 1 ? 's' : ''} remaining
        <div class="prov-integrating-hint stat-dim">Deposit slots and resources locked until integration completes.</div>
      </div>`
    : '';

  // Bomb damage banner (shown when province has active bomb damage)
  const bombHtml = (bombData && (bombData.damage > 0 || bombData.devLost > 0))
    ? `<div class="prov-bomb-damage-banner">
        💥 Under Bombardment — ${bombData.damage.toFixed(1)} / ${BOMBING_DEV_DROP_THRESHOLD} dmg
        ${bombData.devLost > 0 ? `<span class="stat-neg"> · ${bombData.devLost} dev lost</span>` : ''}
        <div class="prov-bomb-damage-hint stat-dim">Development will auto-repair after ${BOMBING_DEV_REPAIR_TURNS} unbombed turns.</div>
      </div>`
    : '';

  return `
    <div class="map-info-panel">
      <div class="map-info-nation">
        <span class="map-info-name">${prov.name}</span>
        <span class="map-province-badge">Dev ${prov.development}/5</span>
      </div>
      ${integrationHtml}
      ${bombHtml}
      <div class="map-info-grid">
        <div class="map-info-item"><div class="map-info-label">Infra</div><div class="map-info-val">${prov.infraLevel}/3</div></div>
        <div class="map-info-item"><div class="map-info-label">Coastal</div><div class="map-info-val">${prov.coastal ? '✓ Yes' : '✗ No'}</div></div>
        <div class="map-info-item"><div class="map-info-label">Supply</div><div class="map-info-val ${getProvinceSupplyLevel(provinceId) >= 0.9 ? 'stat-pos' : getProvinceSupplyLevel(provinceId) >= 0.7 ? '' : 'stat-neg'}">${Math.round(getProvinceSupplyLevel(provinceId) * 100)}%</div></div>
        <div class="map-info-item"><div class="map-info-label">Capital dist</div><div class="map-info-val">${provinceId === getCapitalProvinceId() ? '★ Capital' : bfsMinHops([getCapitalProvinceId()], [provinceId]) + ' hop' + (bfsMinHops([getCapitalProvinceId()], [provinceId]) !== 1 ? 's' : '')}</div></div>
      </div>
      <div class="prov-install-section">
        ${existingHtml}
        <div class="prov-install-divider"></div>
        ${buildHtml}
      </div>
    </div>`;
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
