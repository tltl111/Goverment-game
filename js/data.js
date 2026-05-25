// ============================================================
// DATA — static game data: policy and technology definitions
// ============================================================

// Policy effects now come from accumulated levels, not from current spending (see Phase 2.5).
const POLICIES = {
  mining: {
    id: 'mining',
    name: 'Mining',
    category: 'economy',
    icon: '⛏️',
    description: 'Extract raw materials to power the economy. Grows Mining level, boosting GDP growth.',
    maxFunding: 20,
    requiresTech: 'industrialisation',
    effects: {}
  },
  manufacturing: {
    id: 'manufacturing',
    name: 'Manufacturing',
    category: 'economy',
    icon: '🏭',
    description: 'Convert raw materials into goods. Effective output is capped by Mining level.',
    maxFunding: 20,
    requiresTech: 'steelProduction',
    effects: {}
  },
  logistics: {
    id: 'logistics',
    name: 'Logistics',
    category: 'economy',
    icon: '🚛',
    description: 'Streamline supply chains and distribution. Grows Logistics level, reducing the manufacturing import cost penalty.',
    maxFunding: 20,
    requiresTech: 'massProduction',
    effects: {}
  },
  commerce: {
    id: 'commerce',
    name: 'Commerce',
    category: 'economy',
    icon: '🏪',
    description: 'Develop markets and retail networks. Grows Commerce level, boosting GDP growth (amplified by Manufacturing).',
    maxFunding: 20,
    effects: {}
  },
  finance: {
    id: 'finance',
    name: 'Finance',
    category: 'economy',
    icon: '🏦',
    description: 'Build financial institutions. Grows Finance level, reducing debt costs and unlocking trade routes.',
    maxFunding: 20,
    effects: {}
  },
  infrastructure: {
    id: 'infrastructure',
    name: 'Infrastructure',
    category: 'economy',
    icon: '🏗️',
    description: 'Build roads, power grids, and transport networks.',
    maxFunding: 20,
    effects: { gdpGrowth: 0.020 }  // max GDP bonus when infraLevel = 100
  },
  healthcare: {
    id: 'healthcare',
    name: 'Healthcare',
    category: 'social',
    icon: '🏥',
    description: 'Fund hospitals and public health programs. Builds Healthcare level, increasing population growth rate and happiness.',
    maxFunding: 20,
    effects: {}
  },
  education: {
    id: 'education',
    name: 'Education',
    category: 'social',
    icon: '🎓',
    description: 'Fund schools and universities. Builds Education level, boosting GDP growth, research speed, and happiness.',
    maxFunding: 20,
    effects: {}
  },
  research: {
    id: 'research',
    name: 'Research',
    category: 'science',
    icon: '🔬',
    description: 'Fund scientific research programmes. Builds Research level, increasing technology research speed. Research projects raise the capacity ceiling.',
    maxFunding: 20,
    effects: {}
  },
  prospecting: {
    id: 'prospecting',
    name: 'Prospecting',
    category: 'economy',
    icon: '⛏️',
    description: 'Fund geological surveys and exploration teams. Builds Prospecting level, increasing the chance of discovering a resource deposit each turn.',
    maxFunding: 20,
    effects: {}
  },
};

// ============================================================
// RESOURCE_TYPES — static definitions for all resource types
// requiresTech: the Industrial path tech that unlocks this type for discovery.
//   null = always discoverable. Once the tech is researched, the resource ID is
//   added to G.unlockedResources, and Prospecting can find deposits of that type.
// ============================================================
const RESOURCE_TYPES = {
  iron:      { id: 'iron',      name: 'Iron',           tier: 'raw',       requiresTech: null,                icon: '🪨' },
  coal:      { id: 'coal',      name: 'Coal',           tier: 'raw',       requiresTech: null,                icon: '🖤' },
  timber:    { id: 'timber',    name: 'Timber',         tier: 'raw',       requiresTech: 'industrialisation', icon: '🪵' },
  steel:     { id: 'steel',     name: 'Steel',          tier: 'processed', requiresTech: 'steelProduction',   icon: '⚙️' },
  oil:       { id: 'oil',       name: 'Oil',            tier: 'raw',       requiresTech: 'chemicalIndustry',  icon: '🛢️' },
  chemicals: { id: 'chemicals', name: 'Chemicals',      tier: 'processed', requiresTech: 'chemicalIndustry',  icon: '⚗️' },
  copper:    { id: 'copper',    name: 'Copper',         tier: 'raw',       requiresTech: 'electronics',       icon: '🔶' },
  silicon:   { id: 'silicon',   name: 'Silicon',        tier: 'processed', requiresTech: 'electronics',       icon: '💡' },
  rareEarths:{ id: 'rareEarths',name: 'Rare Earth Metals', tier: 'rare',   requiresTech: 'nanotechnology',    icon: '✨' },
};

const TECHNOLOGIES = {
  // --- TIER 1 ---
  basicAutomation: {
    id: 'basicAutomation', name: 'Basic Automation',
    tier: 1, path: 'economic', cost: 20, icon: '⚙️',
    description: 'Automate basic industrial processes.',
    requires: [],
    unlocks: null,
    effects: { gdpGrowthBonus: 0.005, effectDesc: '+0.5% GDP growth' }
  },
  healthcareReform: {
    id: 'healthcareReform', name: 'Healthcare Reform',
    tier: 1, path: 'social', cost: 20, icon: '💊',
    description: 'Improve healthcare system efficiency.',
    requires: [],
    unlocks: null,
    effects: { policyCostMult: { healthcare: 0.80 }, effectDesc: '-20% healthcare cost' }
  },
  educationProgram: {
    id: 'educationProgram', name: 'Education Initiative',
    tier: 1, path: 'science', cost: 20, icon: '📚',
    description: 'Boosts research centre output.',
    requires: [],
    unlocks: null,
    effects: { rpResearchCentreBonus: 2, effectDesc: '+2 bonus RP/research centre/turn' }
  },
  // --- TIER 2 ---
  greenIndustry: {
    id: 'greenIndustry', name: 'Green Industry',
    tier: 2, path: 'economic', cost: 50, icon: '♻️',
    description: 'Sustainable industry for long-term growth.',
    requires: ['basicAutomation'],
    unlocks: null,
    effects: { gdpGrowthBonus: 0.01, happinessBonus: 5, effectDesc: '+1% GDP growth, +5 happiness' }
  },
  universalHealthcare: {
    id: 'universalHealthcare', name: 'Universal Healthcare',
    tier: 2, path: 'social', cost: 50, icon: '🏥',
    description: 'Extend healthcare to all citizens.',
    requires: ['healthcareReform'],
    unlocks: null,
    effects: { happinessBonus: 18, effectDesc: '+18 happiness' }
  },
  aiAdministration: {
    id: 'aiAdministration', name: 'AI Administration',
    tier: 2, path: 'science', cost: 50, icon: '🤖',
    description: 'AI streamlines all government operations.',
    requires: ['educationProgram'],
    unlocks: null,
    effects: { allPolicyCostMult: 0.90, effectDesc: '-10% all policy costs' }
  },
  // --- TIER 3 ---
  digitalEconomy: {
    id: 'digitalEconomy', name: 'Digital Economy',
    tier: 3, path: 'economic', cost: 100, icon: '💻',
    description: 'Lead the global digital transformation.',
    requires: ['greenIndustry'],
    unlocks: null,
    effects: { gdpGrowthBonus: 0.02, effectDesc: '+2% GDP growth' }
  },
  advancedWelfare: {
    id: 'advancedWelfare', name: 'Advanced Welfare',
    tier: 3, path: 'social', cost: 100, icon: '🌟',
    description: 'Comprehensive citizen support systems.',
    requires: ['universalHealthcare'],
    unlocks: null,
    effects: { happinessBonus: 25, effectDesc: '+25 happiness' }
  },
  spaceProgram: {
    id: 'spaceProgram', name: 'Space Program',
    tier: 3, path: 'science', cost: 100, icon: '🚀',
    description: 'National prestige and scientific advancement.',
    requires: ['aiAdministration'],
    unlocks: null,
    effects: { happinessBonus: 10, gdpGrowthBonus: 0.01, rpResearchCentreBonus: 5, effectDesc: '+10 happiness, +1% GDP growth, +5 bonus RP/research centre' }
  },

  // --- Tier 2 (additional branches) ---
  marketRegulation: {
    id: 'marketRegulation', name: 'Market Regulation',
    tier: 2, path: 'economic', cost: 40, icon: '📊',
    description: 'Regulate markets to protect consumers and improve commerce efficiency.',
    requires: ['basicAutomation'],
    unlocks: null,
    effects: { happinessBonus: 5, policyCostMult: { commerce: 0.85 }, effectDesc: '+5 happiness, −15% commerce policy cost' }
  },
  bankingSystem: {
    id: 'bankingSystem', name: 'Banking System',
    tier: 2, path: 'economic', cost: 40, icon: '🏦',
    description: 'Formalise banking to stabilise the economy and reduce finance costs.',
    requires: ['basicAutomation'],
    unlocks: null,
    effects: { gdpGrowthBonus: 0.005, policyCostMult: { finance: 0.80 }, effectDesc: '+0.5% GDP growth, −20% finance policy cost' }
  },
  scientificMethod: {
    id: 'scientificMethod', name: 'Scientific Method',
    tier: 2, path: 'science', cost: 35, icon: '🔬',
    description: 'Formalise research methodology, making all tech research cheaper.',
    requires: ['educationProgram'],
    unlocks: null,
    effects: { techCostMult: 0.90, effectDesc: '−10% RP cost on all techs' }
  },
  publicHousing: {
    id: 'publicHousing', name: 'Public Housing',
    tier: 2, path: 'social', cost: 35, icon: '🏠',
    description: 'Build affordable public housing, improving citizen welfare.',
    requires: ['healthcareReform'],
    unlocks: null,
    effects: { happinessBonus: 8, effectDesc: '+8 happiness' }
  },

  // --- Tier 3 (additional branches) ---
  renewableEnergy: {
    id: 'renewableEnergy', name: 'Renewable Energy',
    tier: 3, path: 'economic', cost: 75, icon: '🌱',
    description: 'Clean energy reduces infrastructure maintenance costs.',
    requires: ['greenIndustry'],
    unlocks: null,
    effects: { infraDecayMult: 0.80, effectDesc: '−20% infrastructure decay rate' }
  },
  mentalHealthServices: {
    id: 'mentalHealthServices', name: 'Mental Health Services',
    tier: 3, path: 'social', cost: 75, icon: '🧠',
    description: 'Invest in mental health support for long-term citizen wellbeing.',
    requires: ['universalHealthcare'],
    unlocks: null,
    effects: { happinessBonus: 8, effectDesc: '+8 happiness' }
  },
  quantumComputing: {
    id: 'quantumComputing', name: 'Quantum Computing',
    tier: 3, path: 'science', cost: 120, icon: '⚛️',
    description: 'Quantum processing power dramatically reduces all research costs.',
    requires: ['aiAdministration', 'scientificMethod'],
    unlocks: null,
    effects: { techCostMult: 0.80, effectDesc: '−20% RP cost on all techs' }
  },

  // --- Tier 4 ---
  smartGrid: {
    id: 'smartGrid', name: 'Smart Grid',
    tier: 4, path: 'economic', cost: 90, icon: '⚡',
    description: 'Intelligent power distribution boosts economy and infrastructure growth.',
    requires: ['renewableEnergy'],
    unlocks: null,
    effects: { gdpGrowthBonus: 0.005, infraGrowthMult: 1.20, effectDesc: '+0.5% GDP growth, +20% infrastructure growth rate' }
  },

  // ============================================================
  // INDUSTRIAL PATH
  // ============================================================
  industrialisation: {
    id: 'industrialisation', name: 'Industrialisation',
    tier: 2, path: 'industrial', cost: 40, icon: '🏗️',
    description: 'Formal industrial processes enable systematic resource extraction.',
    requires: ['basicAutomation'],
    unlocks: { policies: ['mining'], resources: ['timber'] },
    effects: { effectDesc: 'Unlocks Mining policy + Timber deposits' }
  },
  steelProduction: {
    id: 'steelProduction', name: 'Steel Production',
    tier: 3, path: 'industrial', cost: 70, icon: '⚙️',
    description: 'Mastery of steel enables large-scale goods manufacturing.',
    requires: ['industrialisation'],
    unlocks: { policies: ['manufacturing'], resources: ['steel'] },
    effects: { effectDesc: 'Unlocks Manufacturing policy + Steel deposits' }
  },
  massProduction: {
    id: 'massProduction', name: 'Mass Production',
    tier: 4, path: 'industrial', cost: 100, icon: '🏭',
    description: 'Standardised manufacturing and logistics enable goods at scale.',
    requires: ['steelProduction'],
    unlocks: { policies: ['logistics'] },
    effects: { effectDesc: 'Unlocks Logistics policy' }
  },
  heavyIndustry: {
    id: 'heavyIndustry', name: 'Heavy Industry',
    tier: 5, path: 'industrial', cost: 150, icon: '🔩',
    description: 'Massive industrial operations power the modern economy.',
    requires: ['massProduction'],
    unlocks: null,
    effects: { industrialGrowthMult: 1.20, gdpGrowthBonus: 0.01, effectDesc: '+1% GDP growth, industry grows 20% faster' }
  },
  chemicalIndustry: {
    id: 'chemicalIndustry', name: 'Chemical Industry',
    tier: 6, path: 'industrial', cost: 200, icon: '⚗️',
    description: 'Industrial chemistry enables plastics, fertilisers, and advanced materials.',
    requires: ['heavyIndustry'],
    unlocks: { resources: ['oil', 'chemicals'] },
    effects: { effectDesc: 'Unlocks Oil + Chemicals deposits' }
  },
  electronics: {
    id: 'electronics', name: 'Electronics',
    tier: 6, path: 'industrial', cost: 200, icon: '💡',
    description: 'Electronic components are the foundation of modern industry and computing.',
    requires: ['heavyIndustry'],
    unlocks: { resources: ['copper', 'silicon'] },
    effects: { gdpGrowthBonus: 0.005, effectDesc: '+0.5% GDP growth, unlocks Copper + Silicon deposits' }
  },
  advancedManufacturing: {
    id: 'advancedManufacturing', name: 'Advanced Manufacturing',
    tier: 7, path: 'industrial', cost: 280, icon: '🔧',
    description: 'Precision tooling and automation drastically cut industrial losses.',
    requires: ['electronics', 'massProduction'],
    unlocks: null,
    effects: { industrialDecayMult: 0.70, effectDesc: 'Industry decay rate −30%' }
  },
  robotics: {
    id: 'robotics', name: 'Robotics',
    tier: 8, path: 'industrial', cost: 400, icon: '🤖',
    description: 'Robotic systems replace manual labour, accelerating all industry.',
    requires: ['advancedManufacturing'],
    unlocks: null,
    effects: { industrialGrowthMult: 1.40, industrialDecayMult: 0.80, gdpGrowthBonus: 0.015, effectDesc: '+1.5% GDP growth, industry grows 40% faster, decay −20%' }
  },
  nanotechnology: {
    id: 'nanotechnology', name: 'Nanotechnology',
    tier: 9, path: 'industrial', cost: 600, icon: '🔬',
    description: 'Nanoscale engineering opens new resource and manufacturing possibilities.',
    requires: ['robotics'],
    unlocks: { resources: ['rareEarths'] },
    effects: { gdpGrowthBonus: 0.01, effectDesc: '+1% GDP growth, unlocks Rare Earth Metals deposits' }
  },

  // ============================================================
  // MINING SUB-BRANCH — deposit upgrade unlock techs
  // Each tech unlocks the next tier of deposit upgrades via G.unlockedTechs checks.
  // ============================================================
  prospectingMethods: {
    id: 'prospectingMethods', name: 'Prospecting Methods',
    tier: 3, path: 'industrial', cost: 60, icon: '🗺️',
    description: 'Systematic geological survey methods enable targeted deposit development.',
    requires: ['industrialisation'],
    unlocks: null,
    effects: { effectDesc: 'Enables Trace → Small deposit upgrades' }
  },
  industrialMining: {
    id: 'industrialMining', name: 'Industrial Mining',
    tier: 5, path: 'industrial', cost: 130, icon: '🪨',
    description: 'Industrial-scale extraction equipment unlocks larger subsurface deposits.',
    requires: ['prospectingMethods', 'massProduction'],
    unlocks: null,
    effects: { effectDesc: 'Enables Small → Medium deposit upgrades' }
  },
  openPitMining: {
    id: 'openPitMining', name: 'Open-Pit Mining',
    tier: 7, path: 'industrial', cost: 260, icon: '⛰️',
    description: 'Open-pit excavation unlocks extraction of large deep deposits.',
    requires: ['industrialMining'],
    unlocks: null,
    effects: { effectDesc: 'Enables Medium → Large deposit upgrades' }
  },
  deepVeinExtraction: {
    id: 'deepVeinExtraction', name: 'Deep Vein Extraction',
    tier: 9, path: 'industrial', cost: 520, icon: '🔩',
    description: 'Deep drilling systems tap into the largest possible mineral veins.',
    requires: ['openPitMining', 'robotics'],
    unlocks: null,
    effects: { effectDesc: 'Enables Large → Vast deposit upgrades' }
  },

  // ============================================================
  // TRADE & DIPLOMACY PATH
  // ============================================================
  tradeAgreements: {
    id: 'tradeAgreements', name: 'Trade Agreements',
    tier: 3, path: 'trade', cost: 80, icon: '📜',
    description: 'Formalise international trade frameworks, giving your exporters an edge in all negotiations.',
    requires: ['bankingSystem', 'marketRegulation'],
    unlocks: null,
    effects: { tradeExportQualityBonus: 0.10, effectDesc: '+10% base export quality in all negotiations' }
  },
  diplomacyCorps: {
    id: 'diplomacyCorps', name: 'Diplomacy Corps',
    tier: 4, path: 'trade', cost: 120, icon: '🤝',
    description: 'Establish a professional diplomatic corps. Unlocks the Diplomacy screen.',
    requires: ['tradeAgreements'],
    unlocks: null,
    effects: { effectDesc: 'Unlocks Diplomacy screen' }
  },
  culturalExchange: {
    id: 'culturalExchange', name: 'Cultural Exchange',
    tier: 5, path: 'trade', cost: 160, icon: '🎭',
    description: 'Promote cultural ties with trade partners, strengthening diplomatic bonds.',
    requires: ['diplomacyCorps'],
    unlocks: null,
    effects: { culturalExchangeRelationsBonus: 8, effectDesc: '+8 relations with every active trade partner' }
  },
  strategicAlliances: {
    id: 'strategicAlliances', name: 'Strategic Alliances',
    tier: 5, path: 'trade', cost: 200, icon: '🛡️',
    description: 'Form strategic alliances with trusted nations. Unlocks Alliance actions on the Diplomacy screen.',
    requires: ['diplomacyCorps'],
    unlocks: null,
    effects: { effectDesc: 'Unlocks Alliance and NAP actions on Diplomacy screen' }
  },
  culturalDiplomacy: {
    id: 'culturalDiplomacy', name: 'Cultural Diplomacy',
    tier: 5, path: 'trade', cost: 180, icon: '🎨',
    description: 'Establish cultural institutions that build lasting goodwill with all foreign nations.',
    requires: ['diplomacyCorps'],
    unlocks: null,
    effects: { cultureDiplomacyRelationsBonus: 12, effectDesc: '+12 base relations with all nations' }
  },
  economicUnions: {
    id: 'economicUnions', name: 'Economic Unions',
    tier: 6, path: 'trade', cost: 280, icon: '🏛️',
    description: 'Deep economic integration reduces import asking prices across all trade negotiations.',
    requires: ['tradeAgreements', 'diplomacyCorps'],
    unlocks: null,
    effects: { tradeImportPriceReduction: 0.15, effectDesc: '−15% import asking price in all negotiations' }
  },  unMembership: {
    id: 'unMembership', name: 'UN Membership',
    tier: 6, path: 'trade', cost: 260, icon: '🌐',
    description: 'Join the United Nations. International recognition grants a global relations bonus with all nations.',
    requires: ['strategicAlliances'],
    unlocks: null,
    effects: { unRelationsBonus: 5, effectDesc: '+5 relations with all nations globally' }
  },

  // ============================================================
  // MILITARY PATH (Phase 5.1)
  // Each tech unlocks one branch of the military. Branches are funded
  // independently in the policy panel and contribute weighted to deterrence.
  // ============================================================
  standingArmy: {
    id: 'standingArmy', name: 'Standing Army',
    tier: 1, path: 'military', cost: 30, icon: '⚔️',
    description: 'Establish a professional standing army. Unlocks the Army policy and the Military screen.',
    requires: [],
    unlocks: { policies: ['army'] },
    effects: { effectDesc: 'Unlocks Army policy + Military screen' }
  },
  navalFleet: {
    id: 'navalFleet', name: 'Naval Fleet',
    tier: 2, path: 'military', cost: 80, icon: '⚓',
    description: 'Commission a standing naval fleet. Unlocks Navy commanders and naval unit recruitment.',
    requires: ['standingArmy'],
    unlocks: {},
    effects: { effectDesc: 'Unlocks Navy commanders' }
  },
  airForceEstablishment: {
    id: 'airForceEstablishment', name: 'Air Force',
    tier: 3, path: 'military', cost: 160, icon: '✈️',
    description: 'Establish an air force branch. Requires mass production capability. Unlocks Air Force commanders and air unit recruitment.',
    requires: ['navalFleet', 'massProduction'],
    unlocks: {},
    effects: { effectDesc: 'Unlocks Air Force commanders' }
  },

  // ============================================================
  // MILITARY PATH — additional techs
  // ============================================================
  fortificationDoctrines: {
    id: 'fortificationDoctrines', name: 'Fortification Doctrines',
    tier: 2, path: 'military', cost: 60, icon: '🏰',
    description: 'Codify military doctrine around fixed defences. Province fortifications become 25% more effective.',
    requires: ['standingArmy'],
    unlocks: null,
    effects: { fortificationDefenseBonus: 0.25, effectDesc: '+25% fortification defense effectiveness' }
  },
  militaryLogistics: {
    id: 'militaryLogistics', name: 'Military Logistics',
    tier: 3, path: 'military', cost: 110, icon: '📦',
    description: 'Streamline military supply chains. Increases supply delivery capacity by 15%.',
    requires: ['standingArmy', 'massProduction'],
    unlocks: null,
    effects: { supplyDeliveryMult: 1.15, effectDesc: '+15% supply delivery capacity' }
  },
  militaryIntelligence: {
    id: 'militaryIntelligence', name: 'Military Intelligence',
    tier: 4, path: 'military', cost: 160, icon: '🔍',
    description: 'Establish military intelligence services. Reveals enemy unit strength and troop positions in the war panel.',
    requires: ['standingArmy', 'diplomacyCorps'],
    unlocks: null,
    effects: { effectDesc: 'Reveals enemy unit strength in the war panel' }
  },

  // ============================================================
  // MILITARY ENGINEERING PATH — equipment tiers, unit development, commander brain
  // These techs gate Phase 5.7e (Equipment tab) and Phase 5.7f (Commander brain)
  // ============================================================
  basicMetallurgy: {
    id: 'basicMetallurgy', name: 'Basic Metallurgy',
    tier: 4, path: 'militaryEng', cost: 130, icon: '⚒️',
    description: 'Standardise alloy composition and casting processes. Foundation for all equipment tier improvements.',
    requires: ['massProduction', 'standingArmy'],
    unlocks: null,
    effects: { effectDesc: 'Foundation for Equipment Design tab (Phase 5.7e)' }
  },
  ballisticsResearch: {
    id: 'ballisticsResearch', name: 'Ballistics Research',
    tier: 5, path: 'militaryEng', cost: 170, icon: '🎯',
    description: 'Systematic ballistics science improves all ground unit attack ratings by 10%.',
    requires: ['basicMetallurgy'],
    unlocks: null,
    effects: { unitAttackBonus: 0.10, effectDesc: '+10% all ground unit attack' }
  },
  commanderAutonomy: {
    id: 'commanderAutonomy', name: 'Commander Autonomy',
    tier: 5, path: 'militaryEng', cost: 160, icon: '🧠',
    description: 'Delegate tactical decisions to field commanders. Unlocks the Commander Brain system: commanders auto-recruit and refit units.',
    requires: ['basicMetallurgy'],
    unlocks: null,
    effects: { effectDesc: 'Unlocks Commander Brain auto-recruitment system (Phase 5.7f)' }
  },
  navalUnitDevelopment: {
    id: 'navalUnitDevelopment', name: 'Naval Unit Development',
    tier: 5, path: 'militaryEng', cost: 180, icon: '⚓',
    description: 'Develop standard naval vessel classes. Unlocks the Naval unit roster — commanders can recruit individual ship types.',
    requires: ['navalFleet', 'basicMetallurgy'],
    unlocks: null,
    effects: { effectDesc: 'Unlocks Naval unit types for Navy commanders (Phase 5.7f)' }
  },
  advancedMetallurgy: {
    id: 'advancedMetallurgy', name: 'Advanced Metallurgy',
    tier: 6, path: 'militaryEng', cost: 240, icon: '🔩',
    description: 'High-strength alloys and precision casting unlock the Mk.II equipment tier for all unit types.',
    requires: ['basicMetallurgy', 'heavyIndustry'],
    unlocks: null,
    effects: { effectDesc: 'Unlocks Mk.II equipment tier in Equipment Design tab (Phase 5.7e)' }
  },
  airUnitDevelopment: {
    id: 'airUnitDevelopment', name: 'Air Unit Development',
    tier: 6, path: 'militaryEng', cost: 220, icon: '🛩️',
    description: 'Develop standardised aircraft types. Unlocks the Air Force unit roster — commanders can recruit individual aircraft types.',
    requires: ['airForceEstablishment', 'basicMetallurgy'],
    unlocks: null,
    effects: { effectDesc: 'Unlocks Air Force unit types for Air commanders (Phase 5.7f)' }
  },
  mechanisedWarfare: {
    id: 'mechanisedWarfare', name: 'Mechanised Warfare',
    tier: 7, path: 'militaryEng', cost: 300, icon: '🚛',
    description: 'Combined arms doctrine integrating armour and infantry. +15% combat effectiveness for armored and mechanized units.',
    requires: ['advancedMetallurgy'],
    unlocks: null,
    effects: { mechanisedCombatBonus: 0.15, effectDesc: '+15% armored and mechanized unit combat effectiveness' }
  },
  precisionEngineering: {
    id: 'precisionEngineering', name: 'Precision Engineering',
    tier: 7, path: 'militaryEng', cost: 290, icon: '🔧',
    description: 'Tight manufacturing tolerances improve all unit armor ratings by 15%.',
    requires: ['advancedMetallurgy', 'electronics'],
    unlocks: null,
    effects: { unitDefenseBonus: 0.15, effectDesc: '+15% all unit defense ratings' }
  },
  jetPropulsion: {
    id: 'jetPropulsion', name: 'Jet Propulsion',
    tier: 7, path: 'militaryEng', cost: 310, icon: '🚀',
    description: 'Turbojet engines transform air combat. Unlocks Mk.II aircraft types for Air Force commanders.',
    requires: ['airUnitDevelopment', 'electronics'],
    unlocks: null,
    effects: { effectDesc: 'Unlocks Mk.II air unit types (Phase 5.7f)' }
  },
  compositeArmour: {
    id: 'compositeArmour', name: 'Composite Armour',
    tier: 8, path: 'militaryEng', cost: 420, icon: '🛡️',
    description: 'Layered ceramic-metal composites unlock the Mk.III equipment tier — the most capable ground equipment available.',
    requires: ['mechanisedWarfare', 'precisionEngineering'],
    unlocks: null,
    effects: { effectDesc: 'Unlocks Mk.III equipment tier in Equipment Design tab (Phase 5.7e)' }
  },
  nuclearDeterrence: {
    id: 'nuclearDeterrence', name: 'Nuclear Deterrence',
    tier: 9, path: 'militaryEng', cost: 600, icon: '☢️',
    description: 'Nuclear capability creates a strategic deterrence umbrella. +40 deterrence rating.',
    requires: ['compositeArmour', 'spaceProgram'],
    unlocks: null,
    effects: { deterrenceBonus: 40, effectDesc: '+40 deterrence rating' }
  },

  // ============================================================
  // TRADE PATH — additional techs
  // ============================================================
  tradeIntelligence: {
    id: 'tradeIntelligence', name: 'Trade Intelligence',
    tier: 5, path: 'trade', cost: 180, icon: '📊',
    description: 'Intelligence networks reveal hidden demand profiles of partner nations, giving a 15% bonus to export quality in negotiations.',
    requires: ['diplomacyCorps'],
    unlocks: null,
    effects: { tradeExportQualityBonus: 0.15, effectDesc: '+15% export quality bonus in trade negotiations' }
  },
  financialServices: {
    id: 'financialServices', name: 'Financial Services',
    tier: 6, path: 'trade', cost: 260, icon: '💹',
    description: 'Develop a world-class financial sector that generates GDP growth independent of industrial output.',
    requires: ['economicUnions'],
    unlocks: null,
    effects: { gdpGrowthBonus: 0.02, effectDesc: '+2% GDP growth' }
  },
  internationalMediation: {
    id: 'internationalMediation', name: 'International Mediation',
    tier: 7, path: 'trade', cost: 340, icon: '🕊️',
    description: 'Your diplomatic standing allows you to mediate conflicts. Reduces the happiness penalty from active wars by 4 per war.',
    requires: ['unMembership', 'strategicAlliances'],
    unlocks: null,
    effects: { warHappinessPenaltyReduction: 4, effectDesc: '−4 war happiness penalty per active war' }
  },

  // ============================================================
  // ECONOMIC PATH — additional techs
  // ============================================================
  corporateLaw: {
    id: 'corporateLaw', name: 'Corporate Law',
    tier: 3, path: 'economic', cost: 70, icon: '⚖️',
    description: 'Legal frameworks for commerce reduce the cost of running commercial policy.',
    requires: ['marketRegulation', 'bankingSystem'],
    unlocks: null,
    effects: { policyCostMult: { commerce: 0.90 }, effectDesc: '−10% commerce policy cost' }
  },
  advancedFinance: {
    id: 'advancedFinance', name: 'Advanced Finance',
    tier: 5, path: 'economic', cost: 200, icon: '📈',
    description: 'Sophisticated financial instruments channel capital to the most productive sectors.',
    requires: ['bankingSystem', 'tradeAgreements'],
    unlocks: null,
    effects: { gdpGrowthBonus: 0.01, effectDesc: '+1% GDP growth' }
  },

  // ============================================================
  // INDUSTRIAL PATH — additional techs
  // ============================================================
  syntheticMaterials: {
    id: 'syntheticMaterials', name: 'Synthetic Materials',
    tier: 7, path: 'industrial', cost: 320, icon: '🧪',
    description: 'Synthetic polymers and composites reduce industrial material costs.',
    requires: ['chemicalIndustry', 'electronics'],
    unlocks: null,
    effects: { gdpGrowthBonus: 0.005, industrialDecayMult: 0.90, effectDesc: '+0.5% GDP growth, −10% industry decay rate' }
  },
  automatedLogistics: {
    id: 'automatedLogistics', name: 'Automated Logistics',
    tier: 9, path: 'industrial', cost: 480, icon: '🤖',
    description: 'Fully automated supply chain management drastically cuts infrastructure maintenance costs.',
    requires: ['robotics', 'massProduction'],
    unlocks: null,
    effects: { infraDecayMult: 0.85, effectDesc: '−15% infrastructure decay rate' }
  },

  // ============================================================
  // SOCIAL PATH — additional techs
  // ============================================================
  civilRights: {
    id: 'civilRights', name: 'Civil Rights',
    tier: 3, path: 'social', cost: 75, icon: '✊',
    description: 'Codify civil rights and freedoms. Citizens are happier and more productive.',
    requires: ['publicHousing'],
    unlocks: null,
    effects: { happinessBonus: 12, effectDesc: '+12 happiness' }
  },
  civicEducation: {
    id: 'civicEducation', name: 'Civic Education',
    tier: 4, path: 'social', cost: 120, icon: '🏫',
    description: 'Integrate civic participation into the education curriculum, reducing education costs.',
    requires: ['educationProgram', 'publicHousing'],
    unlocks: null,
    effects: { policyCostMult: { education: 0.85 }, effectDesc: '−15% education policy cost' }
  },
  socialSafety: {
    id: 'socialSafety', name: 'Social Safety Net',
    tier: 5, path: 'social', cost: 175, icon: '🤲',
    description: 'A comprehensive safety net catches citizens through economic hardship, boosting happiness and growth.',
    requires: ['advancedWelfare'],
    unlocks: null,
    effects: { happinessBonus: 12, gdpGrowthBonus: 0.005, effectDesc: '+12 happiness, +0.5% GDP growth' }
  },

  // ============================================================
  // SCIENCE PATH — additional techs
  // ============================================================
  computerScience: {
    id: 'computerScience', name: 'Computer Science',
    tier: 4, path: 'science', cost: 140, icon: '💾',
    description: 'Computational methods accelerate research across all disciplines.',
    requires: ['aiAdministration', 'electronics'],
    unlocks: null,
    effects: { techCostMult: 0.85, effectDesc: '−15% all tech research costs' }
  },
  biotechnology: {
    id: 'biotechnology', name: 'Biotechnology',
    tier: 5, path: 'science', cost: 220, icon: '🧬',
    description: 'Biotech advances improve healthcare outcomes and public wellbeing.',
    requires: ['computerScience', 'universalHealthcare'],
    unlocks: null,
    effects: { happinessBonus: 10, policyCostMult: { healthcare: 0.90 }, effectDesc: '+10 happiness, −10% healthcare cost' }
  },
  materialScience: {
    id: 'materialScience', name: 'Material Science',
    tier: 6, path: 'science', cost: 300, icon: '🔬',
    description: 'Advanced materials research directly supports the military engineering programme, reducing equipment refit costs.',
    requires: ['quantumComputing', 'basicMetallurgy'],
    unlocks: null,
    effects: { equipmentRefitCostMult: 0.80, effectDesc: '−20% equipment refit cost' }
  },
};

// ============================================================
// EQUIPMENT TIERS — Phase 5.7e
// Each tier multiplies unit attack and defense stats, and adds speed.
// Tier 1 (Mk.I) is the baseline — all units start here.
// Tier 2 (Mk.II) requires advancedMetallurgy tech.
// Tier 3 (Mk.III) requires compositeArmour tech.
// ============================================================
const EQUIPMENT_TIERS = {
  1: { name: 'Mk.I',   attackMult: 1.00, defenseMult: 1.00, speedBonus: 0, requiresTech: null },
  2: { name: 'Mk.II',  attackMult: 1.40, defenseMult: 1.35, speedBonus: 1, requiresTech: 'advancedMetallurgy' },
  3: { name: 'Mk.III', attackMult: 1.80, defenseMult: 1.70, speedBonus: 2, requiresTech: 'compositeArmour' },
};

// ============================================================
// PROJECTS — large discrete investments built with direct treasury spend
// Each project has a total cost ($M), and completing it grants a permanent effect.
// Progress is tracked in G.projectProgress[id]; G.projectFunding[id] = $/turn allocation.
// ============================================================
const PROJECTS = {
  // --- Research Projects ---
  university: {
    id: 'university',
    name: 'University',
    category: 'research',
    icon: '🏫',
    description: 'Build a national university system. Raises the research capacity ceiling and boosts research speed.',
    cost: 600,
    techRequired: null,
    effects: { researchCeilingBonus: 25, researchSpeedMult: 1.15, effectDesc: '+25 research capacity ceiling, +15% research speed' }
  },
  researchInstitute: {
    id: 'researchInstitute',
    name: 'Research Institute',
    category: 'research',
    icon: '🔬',
    description: 'Establish a dedicated national research institute. Further raises the research ceiling and accelerates research.',
    cost: 1500,
    techRequired: 'scientificMethod',
    effects: { researchCeilingBonus: 25, researchSpeedMult: 1.20, effectDesc: '+25 research capacity ceiling, +20% research speed' }
  },
  advancedResearchLab: {
    id: 'advancedResearchLab',
    name: 'Advanced Research Lab',
    category: 'research',
    icon: '⚗️',
    description: 'Build cutting-edge research laboratories. Further raises the ceiling and reduces all technology costs.',
    cost: 3000,
    techRequired: 'aiAdministration',
    effects: { researchCeilingBonus: 25, techCostMult: 0.90, effectDesc: '+25 research capacity ceiling, −10% all tech costs' }
  },
  // --- Infrastructure Megaprojects ---
  nationalHighwayNetwork: {
    id: 'nationalHighwayNetwork',
    name: 'National Highway Network',
    category: 'infrastructure',
    icon: '\uD83D\uDEE3\uFE0F',
    description: 'Connect every city and region with a modern highway network, reducing infrastructure maintenance costs and boosting economic activity.',
    cost: 800,
    techRequired: null,
    effects: { infraDecayMult: 0.90, gdpGrowthBonus: 0.005, effectDesc: '\u221210% infra decay rate, +0.5% GDP growth' }
  },
  nationalRailNetwork: {
    id: 'nationalRailNetwork',
    name: 'National Rail Network',
    category: 'infrastructure',
    icon: '\uD83D\uDE82',
    description: 'Build an empire-wide rail system for mass transit and freight, reducing infrastructure upkeep and stimulating economic growth.',
    cost: 1500,
    techRequired: 'basicAutomation',
    effects: { infraDecayMult: 0.85, gdpGrowthBonus: 0.008, effectDesc: '\u221215% infra decay rate, +0.8% GDP growth' }
  },
  nationalPowerGrid: {
    id: 'nationalPowerGrid',
    name: 'National Power Grid',
    category: 'infrastructure',
    icon: '\u26A1',
    description: 'Electrify the entire empire with a centralised power grid. Major reduction in infrastructure decay and significant GDP uplift.',
    cost: 2000,
    techRequired: 'basicAutomation',
    effects: { infraDecayMult: 0.80, gdpGrowthBonus: 0.012, effectDesc: '\u221220% infra decay rate, +1.2% GDP growth' }
  },
  nationalAirportNetwork: {
    id: 'nationalAirportNetwork',
    name: 'National Airport Network',
    category: 'infrastructure',
    icon: '\u2708\uFE0F',
    description: 'Build a network of international and regional airports, connecting the empire to global commerce and generating passive revenue.',
    cost: 2500,
    techRequired: ['marketRegulation', 'bankingSystem'],
    effects: { commerceLevelBonus: 10, passiveIncome: 100, effectDesc: '+10 effective Commerce level, +$100M/turn passive income' }
  },
  seaportExpansion: {
    id: 'seaportExpansion',
    name: 'Seaport Expansion',
    category: 'infrastructure',
    icon: '\u2693',
    description: 'Expand and modernise seaports empire-wide, significantly boosting all trade route income.',
    cost: 2000,
    techRequired: 'bankingSystem',
    effects: { tradeIncomeMult: 1.25, effectDesc: '+25% all trade route income' }
  },
  greatDam: {
    id: 'greatDam',
    name: 'Great Dam',
    category: 'infrastructure',
    icon: '\uD83C\uDF0A',
    description: 'Construct a massive hydroelectric dam providing clean energy and a large source of passive income to the treasury.',
    cost: 3000,
    techRequired: 'greenIndustry',
    effects: { passiveIncome: 200, gdpGrowthBonus: 0.010, effectDesc: '+$200M/turn passive income, +1.0% GDP growth' }
  },
  internetInfrastructure: {
    id: 'internetInfrastructure',
    name: 'Internet Infrastructure',
    category: 'infrastructure',
    icon: '\uD83C\uDF10',
    description: 'Roll out empire-wide broadband internet. Dramatically reduces infrastructure decay and delivers the largest GDP growth bonus of any project.',
    cost: 4500,
    techRequired: 'digitalEconomy',
    effects: { infraDecayMult: 0.75, gdpGrowthBonus: 0.015, effectDesc: '\u221225% infra decay rate, +1.5% GDP growth' }
  },
};

// ============================================================
// NATIONS — static nation definitions. Starting stats only.
// Per-turn AI behaviour is driven by constants in constants.js.
// Live state is stored in G.nations (see state.js).
// GDP is emergent: computed from province development × GDP_PER_PROVINCE_DEVELOPMENT at init.
// ============================================================
const NATIONS = {
  // demand: how much this nation wants to import from the player (>1 = high demand = player earns more)
  // supply: how well this nation can supply the player's imports (>1 = abundant = player saves more)
  // color/label/capital: used by the world map renderer
  // seaZone: which sea zone trade routes to this nation pass through.
  // null = land-adjacent to the player (overland route, no sea disruption risk).
  // 'vaelSea' = north/east sea.  'greyReach' = south sea.
  valdoria: {
    id: 'valdoria', name: 'Valdoria',
    color: '#5e9c76', labelX: 172, labelY: 280, capitalX: 175, capitalY: 262,
    militaryLevel: 20,
    gdpGrowthRate: 0.020,
    seaZone: null,
    adjacency: ['player', 'sorenia', 'orzhan'],
    trade: {
      demandByResource: { steel: 1.4, chemicals: 1.1, silicon: 0.8 },
      supplyByResource: { timber: 1.8, coal: 1.2, iron: 0.9 },
    },
  },
  kethara: {
    id: 'kethara', name: 'Kethara',
    color: '#c4884a', labelX: 395, labelY: 117, capitalX: 395, capitalY: 100,
    militaryLevel: 35,
    gdpGrowthRate: 0.030,
    seaZone: null,
    adjacency: ['player', 'sorenia', 'marveth'],
    trade: {
      demandByResource: { oil: 1.3, rareEarths: 1.0, copper: 1.2 },
      supplyByResource: { steel: 1.6, chemicals: 1.3, silicon: 1.1 },
    },
  },
  orzhan: {
    id: 'orzhan', name: 'Orzhan',
    color: '#8a4a4a', labelX: 173, labelY: 412, capitalX: 173, capitalY: 394,
    militaryLevel: 70,
    gdpGrowthRate: 0.010,
    seaZone: 'greyReach',
    adjacency: ['valdoria', 'nocthar', 'durenna'],
    trade: {
      demandByResource: { steel: 1.2, chemicals: 1.0, timber: 0.8 },
      supplyByResource: { iron: 1.5, coal: 1.4, copper: 0.7 },
    },
  },
  sorenia: {
    id: 'sorenia', name: 'Sorenia',
    color: '#5a7da8', labelX: 155, labelY: 117, capitalX: 158, capitalY: 100,
    militaryLevel: 10,
    gdpGrowthRate: 0.020,
    seaZone: 'vaelSea',
    adjacency: ['valdoria', 'kethara'],
    trade: {
      demandByResource: { iron: 1.1, coal: 0.9, timber: 1.0 },
      supplyByResource: { silicon: 1.4, copper: 1.0, chemicals: 0.8 },
    },
  },
  iravan: {
    id: 'iravan', name: 'Iravan',
    color: '#b8924e', labelX: 615, labelY: 403, capitalX: 615, capitalY: 384,
    militaryLevel: 40,
    gdpGrowthRate: 0.020,
    seaZone: 'vaelSea',
    adjacency: ['marveth', 'nocthar', 'durenna'],
    trade: {
      demandByResource: { steel: 1.0, chemicals: 0.9, silicon: 0.7 },
      supplyByResource: { oil: 1.8, iron: 1.4, copper: 1.0 },
    },
  },
  durenna: {
    id: 'durenna', name: 'Durenna',
    color: '#6b8a5e', labelX: 364, labelY: 490, capitalX: 382, capitalY: 477,
    militaryLevel: 35,
    gdpGrowthRate: 0.025,
    seaZone: 'greyReach',
    adjacency: ['orzhan', 'nocthar', 'iravan'],
    trade: {
      demandByResource: { steel: 1.3, chemicals: 1.1, iron: 0.8 },
      supplyByResource: { timber: 1.5, copper: 1.3, coal: 0.7 },
    },
  },
  marveth: {
    id: 'marveth', name: 'Marveth',
    color: '#7a6b9e', labelX: 617, labelY: 195, capitalX: 640, capitalY: 175,
    militaryLevel: 20,
    gdpGrowthRate: 0.015,
    seaZone: null,
    adjacency: ['player', 'kethara', 'iravan'],
    trade: {
      demandByResource: { oil: 1.2, copper: 1.0, rareEarths: 0.8 },
      supplyByResource: { chemicals: 1.4, steel: 1.2, silicon: 0.9 },
    },
  },
  nocthar: {
    id: 'nocthar', name: 'Nocthar',
    color: '#9e6b4a', labelX: 390, labelY: 412, capitalX: 412, capitalY: 393,
    militaryLevel: 55,
    gdpGrowthRate: 0.015,
    seaZone: null,
    adjacency: ['player', 'orzhan', 'iravan', 'durenna'],
    trade: {
      demandByResource: { chemicals: 1.1, silicon: 0.9, timber: 0.7 },
      supplyByResource: { coal: 1.3, iron: 1.1, oil: 0.8 },
    },
  },
};

// ============================================================
// PLAYER_MAP — label and capital-dot positions for the player empire.
// ============================================================
const PLAYER_MAP = { labelX: 393, labelY: 262, capitalX: 393, capitalY: 248 };

// ============================================================
// PROVINCES — all map provinces, keyed by province ID.
// Coordinate space: 800 × 560 viewBox. Single continent layout.
//
// Shared inter-province border vertices (reference):
//   Venmoor/Stormfen split : y=130, x=75→280
//   Stormfen/Redfen split  : x=175, y=130→195
//   Kethara N/S split      : y=113, x=280→510
//   Kethara W/E split      : x=395, y=29→197
//   Marveth N/S cuts       : y=150 (N), y=270 (S)
//   Marveth NW/NE split    : x=625, y=47→150
//   Valdoria N/S split     : y=280, x=75→275
//   Valdoria W/E split     : x=175, y=200→360
//   Player N/S cuts        : y=278 (N), y=320 (S)
//   Player W/E split       : x=392–395, y=195→358
//   Orzhan N/S split       : y=410, x=75→270
//   Orzhan W/E split       : x=175, y=360→410
//   Nocthar W/E split      : x=390, y=358→460
//   Nocthar N/S split      : y=408, x=270→510
//   Iravan W/E split       : x=620, y=343→460
//   Iravan N/S split       : y=410, x=510→724
//   Durenna W/E cuts       : x=230, x=400, x=580
//
// Each province:
//   nationId    — owning nation ('player' for the player empire)
//   name        — display name
//   points      — SVG polygon points string
//   labelX/Y    — text label position (shown for player provinces; stored for all)
//   adjacency   — neighbouring province IDs (land borders; gates conquest in Phase 5.5)
//   development — economic level 1–5; Σ(dev) × GDP_PER_PROVINCE_DEVELOPMENT = nation GDP
//   infraLevel  — infrastructure level 1–3
//   deposit     — hidden resource type (null = none; revealed by prospecting post-conquest)
//   depositSlots— max simultaneous deposit investigations allowed in this province
//   color       — SVG fill colour
// ============================================================
const PROVINCES = {

  // ---- SORENIA ----
  venmoor: {
    nationId: 'sorenia', name: 'Venmoor',
    points: '90,70 160,40 280,30 280,130 75,130',
    labelX: 177, labelY: 83,
    adjacency: ['stormfen', 'redfen', 'aldenmere', 'veldmoor'],
    development: 2, infraLevel: 2, deposit: 'copper', depositSlots: 2,
    coastal: true,
    color: '#5a7da8',
  },
  stormfen: {
    nationId: 'sorenia', name: 'Stormfen',
    points: '75,130 175,130 175,195 75,200',
    labelX: 125, labelY: 163,
    adjacency: ['venmoor', 'redfen', 'greenvale'],
    development: 1, infraLevel: 1, deposit: 'silicon', depositSlots: 2,
    coastal: true,
    color: '#4e6e96',
  },
  redfen: {
    nationId: 'sorenia', name: 'Redfen',
    points: '175,130 280,130 280,195 175,195',
    labelX: 228, labelY: 163,
    adjacency: ['venmoor', 'stormfen', 'veldmoor', 'ironfields'],
    development: 2, infraLevel: 1, deposit: null, depositSlots: 2,
    color: '#668cb8',
  },

  // ---- KETHARA ----
  aldenmere: {
    nationId: 'kethara', name: 'Aldenmere',
    points: '280,30 395,29 395,113 280,113',
    labelX: 338, labelY: 71,
    adjacency: ['ironspire', 'veldmoor', 'venmoor'],
    development: 4, infraLevel: 3, deposit: 'chemicals', depositSlots: 2,
    coastal: true,
    color: '#d4996a',
  },
  ironspire: {
    nationId: 'kethara', name: 'Ironspire',
    points: '395,29 510,28 510,113 395,113',
    labelX: 453, labelY: 71,
    adjacency: ['aldenmere', 'kestwall', 'havenport'],
    development: 3, infraLevel: 2, deposit: null, depositSlots: 2,
    coastal: true,
    color: '#c4884a',
  },
  veldmoor: {
    nationId: 'kethara', name: 'Veldmoor',
    points: '280,113 395,113 395,197 280,195',
    labelX: 338, labelY: 155,
    adjacency: ['aldenmere', 'kestwall', 'venmoor', 'redfen', 'arvenmoor'],
    development: 3, infraLevel: 2, deposit: null, depositSlots: 2,
    color: '#b8793e',
  },
  kestwall: {
    nationId: 'kethara', name: 'Kestwall',
    points: '395,113 510,113 510,200 395,197',
    labelX: 453, labelY: 156,
    adjacency: ['ironspire', 'veldmoor', 'havenport', 'silverwatch', 'caldrath'],
    development: 2, infraLevel: 2, deposit: 'steel', depositSlots: 2,
    color: '#ac6a32',
  },

  // ---- MARVETH ----
  havenport: {
    nationId: 'marveth', name: 'Havenport',
    points: '510,28 625,47 625,150 510,150',
    labelX: 568, labelY: 94,
    adjacency: ['marport', 'silverwatch', 'ironspire', 'kestwall'],
    development: 2, infraLevel: 2, deposit: 'chemicals', depositSlots: 2,
    coastal: true,
    color: '#7a6b9e',
  },
  marport: {
    nationId: 'marveth', name: 'Marport',
    points: '625,47 640,50 730,110 734,150 625,150',
    labelX: 671, labelY: 101,
    adjacency: ['havenport', 'silverwatch'],
    development: 1, infraLevel: 1, deposit: null, depositSlots: 2,
    coastal: true,
    color: '#6b5c8e',
  },
  silverwatch: {
    nationId: 'marveth', name: 'Silverwatch',
    points: '510,150 734,150 740,200 735,270 510,270',
    labelX: 622, labelY: 210,
    adjacency: ['havenport', 'marport', 'deepstone', 'kestwall', 'caldrath'],
    development: 1, infraLevel: 1, deposit: 'silicon', depositSlots: 2,
    coastal: true,
    color: '#8a7aae',
  },
  deepstone: {
    nationId: 'marveth', name: 'Deepstone',
    points: '510,270 735,270 730,330 510,355',
    labelX: 622, labelY: 306,
    adjacency: ['silverwatch', 'selmark', 'crestmere', 'iraportal', 'iraboreal'],
    development: 1, infraLevel: 1, deposit: null, depositSlots: 2,
    coastal: true,
    color: '#6a5b8e',
  },

  // ---- VALDORIA ----
  greenvale: {
    nationId: 'valdoria', name: 'Greenvale',
    points: '75,200 175,198 175,280 75,280',
    labelX: 125, labelY: 240,
    adjacency: ['ironfields', 'ashwood', 'stormfen'],
    development: 2, infraLevel: 2, deposit: 'timber', depositSlots: 2,
    coastal: true,
    color: '#5e9c76',
  },
  ironfields: {
    nationId: 'valdoria', name: 'Ironfields',
    points: '175,198 280,195 275,280 175,280',
    labelX: 226, labelY: 238,
    adjacency: ['greenvale', 'duskholm', 'redfen', 'arvenmoor'],
    development: 3, infraLevel: 2, deposit: 'iron', depositSlots: 2,
    color: '#6eac86',
  },
  ashwood: {
    nationId: 'valdoria', name: 'Ashwood',
    points: '75,280 175,280 175,360 75,360',
    labelX: 125, labelY: 320,
    adjacency: ['greenvale', 'duskholm', 'gorrath'],
    development: 1, infraLevel: 1, deposit: null, depositSlots: 2,
    coastal: true,
    color: '#4e8c66',
  },
  duskholm: {
    nationId: 'valdoria', name: 'Duskholm',
    points: '175,280 275,280 270,360 175,360',
    labelX: 224, labelY: 320,
    adjacency: ['ironfields', 'ashwood', 'thornhaven', 'dawnford', 'ironhold'],
    development: 2, infraLevel: 1, deposit: null, depositSlots: 2,
    color: '#5a9872',
  },

  // ---- PLAYER ----
  arvenmoor: {
    nationId: 'player', name: 'Arvenmoor',
    points: '280,195 395,198 395,278 275,278',
    labelX: 333, labelY: 240,
    adjacency: ['caldrath', 'thornhaven', 'veldmoor', 'ironfields'],
    development: 3, infraLevel: 2, deposit: null, depositSlots: 4,
    color: '#1a5898',
  },
  caldrath: {
    nationId: 'player', name: 'Caldrath',
    points: '395,198 510,200 510,278 395,278',
    labelX: 452, labelY: 240,
    adjacency: ['arvenmoor', 'selmark', 'kestwall', 'silverwatch'],
    development: 2, infraLevel: 2, deposit: null, depositSlots: 2,
    color: '#205ea8',
  },
  thornhaven: {
    nationId: 'player', name: 'Thornhaven',
    points: '275,278 395,278 392,320 272,320',
    labelX: 334, labelY: 299,
    adjacency: ['arvenmoor', 'selmark', 'duskholm', 'dawnford'],
    development: 2, infraLevel: 1, deposit: null, depositSlots: 2,
    color: '#184898',
  },
  selmark: {
    nationId: 'player', name: 'Selmark',
    points: '395,278 510,278 510,320 392,320',
    labelX: 452, labelY: 299,
    adjacency: ['caldrath', 'thornhaven', 'crestmere', 'deepstone'],
    development: 2, infraLevel: 1, deposit: null, depositSlots: 2,
    color: '#2860b0',
  },
  dawnford: {
    nationId: 'player', name: 'Dawnford',
    points: '272,320 392,320 390,358 270,360',
    labelX: 331, labelY: 340,
    adjacency: ['thornhaven', 'crestmere', 'duskholm', 'duskwall', 'ironhold'],
    development: 1, infraLevel: 1, deposit: null, depositSlots: 2,
    color: '#1e52a0',
  },
  crestmere: {
    nationId: 'player', name: 'Crestmere',
    points: '392,320 510,320 510,355 390,358',
    labelX: 450, labelY: 338,
    adjacency: ['selmark', 'dawnford', 'deepstone', 'stonereach'],
    development: 1, infraLevel: 1, deposit: null, depositSlots: 2,
    color: '#2258a8',
  },

  // ---- ORZHAN ----
  gorrath: {
    nationId: 'orzhan', name: 'Gorrath',
    points: '75,360 175,360 175,410 75,410',
    labelX: 125, labelY: 385,
    adjacency: ['ironhold', 'ashpeak', 'ashwood'],
    development: 2, infraLevel: 1, deposit: null, depositSlots: 2,
    coastal: true,
    color: '#8a4a4a',
  },
  ironhold: {
    nationId: 'orzhan', name: 'Ironhold',
    points: '175,360 270,360 270,410 175,410',
    labelX: 223, labelY: 385,
    adjacency: ['gorrath', 'ashpeak', 'duskholm', 'duskwall'],
    development: 3, infraLevel: 2, deposit: 'iron', depositSlots: 2,
    color: '#9a5a5a',
  },
  ashpeak: {
    nationId: 'orzhan', name: 'Ashpeak',
    points: '75,410 270,410 270,460 75,460',
    labelX: 173, labelY: 435,
    adjacency: ['gorrath', 'ironhold', 'greensward', 'midvale', 'ashvale'],
    development: 1, infraLevel: 1, deposit: 'coal', depositSlots: 2,
    coastal: true,
    color: '#7a3a3a',
  },

  // ---- NOCTHAR ----
  duskwall: {
    nationId: 'nocthar', name: 'Duskwall',
    points: '270,360 390,358 390,408 270,408',
    labelX: 330, labelY: 384,
    adjacency: ['stonereach', 'ashvale', 'ironhold', 'dawnford'],
    development: 2, infraLevel: 2, deposit: 'coal', depositSlots: 2,
    color: '#9e6b4a',
  },
  stonereach: {
    nationId: 'nocthar', name: 'Stonereach',
    points: '390,358 510,355 510,408 390,408',
    labelX: 450, labelY: 382,
    adjacency: ['duskwall', 'grimholt', 'crestmere', 'iraportal'],
    development: 1, infraLevel: 1, deposit: null, depositSlots: 2,
    color: '#8e5b3a',
  },
  ashvale: {
    nationId: 'nocthar', name: 'Ashvale',
    points: '270,408 390,408 390,460 270,460',
    labelX: 330, labelY: 434,
    adjacency: ['duskwall', 'grimholt', 'ashpeak', 'midvale'],
    development: 1, infraLevel: 1, deposit: null, depositSlots: 2,
    color: '#ae7b5a',
  },
  grimholt: {
    nationId: 'nocthar', name: 'Grimholt',
    points: '390,408 510,408 510,460 390,460',
    labelX: 450, labelY: 434,
    adjacency: ['stonereach', 'ashvale', 'iracoast', 'ashbrook'],
    development: 1, infraLevel: 1, deposit: 'oil', depositSlots: 2,
    color: '#8a5740',
  },

  // ---- IRAVAN ----
  iraportal: {
    nationId: 'iravan', name: 'Iraportal',
    points: '510,355 620,343 620,410 510,410',
    labelX: 565, labelY: 380,
    adjacency: ['iraboreal', 'iracoast', 'stonereach', 'deepstone'],
    development: 2, infraLevel: 2, deposit: 'oil', depositSlots: 2,
    color: '#b8924e',
  },
  iraboreal: {
    nationId: 'iravan', name: 'Iraboreal',
    points: '620,343 730,330 724,410 620,410',
    labelX: 673, labelY: 375,
    adjacency: ['iraportal', 'irastone', 'deepstone'],
    development: 2, infraLevel: 1, deposit: null, depositSlots: 2,
    coastal: true,
    color: '#c8a25e',
  },
  iracoast: {
    nationId: 'iravan', name: 'Iracoast',
    points: '510,410 620,410 620,460 510,460',
    labelX: 565, labelY: 435,
    adjacency: ['iraportal', 'irastone', 'grimholt', 'ashbrook', 'dawncoast'],
    development: 2, infraLevel: 1, deposit: 'copper', depositSlots: 2,
    color: '#a8823e',
  },
  irastone: {
    nationId: 'iravan', name: 'Irastone',
    points: '620,410 724,410 720,460 620,460',
    labelX: 671, labelY: 435,
    adjacency: ['iraboreal', 'iracoast', 'dawncoast'],
    development: 1, infraLevel: 1, deposit: null, depositSlots: 2,
    coastal: true,
    color: '#98723e',
  },

  // ---- DURENNA ----
  greensward: {
    nationId: 'durenna', name: 'Greensward',
    points: '75,460 230,460 230,513 100,500 80,470',
    labelX: 143, labelY: 485,
    adjacency: ['midvale', 'ashpeak'],
    development: 1, infraLevel: 1, deposit: 'timber', depositSlots: 2,
    coastal: true,
    color: '#6b8a5e',
  },
  midvale: {
    nationId: 'durenna', name: 'Midvale',
    points: '230,460 400,460 400,520 250,515 230,513',
    labelX: 310, labelY: 492,
    adjacency: ['greensward', 'ashpeak', 'ashvale', 'ashbrook'],
    development: 1, infraLevel: 1, deposit: 'copper', depositSlots: 2,
    coastal: true,
    color: '#5b7a4e',
  },
  ashbrook: {
    nationId: 'durenna', name: 'Ashbrook',
    points: '400,460 580,460 580,505 550,510 400,520',
    labelX: 490, labelY: 491,
    adjacency: ['midvale', 'grimholt', 'iracoast', 'dawncoast'],
    development: 1, infraLevel: 1, deposit: null, depositSlots: 2,
    coastal: true,
    color: '#7a9a6e',
  },
  dawncoast: {
    nationId: 'durenna', name: 'Dawncoast',
    points: '580,460 720,460 680,490 580,505',
    labelX: 640, labelY: 479,
    adjacency: ['ashbrook', 'iracoast', 'irastone'],
    development: 1, infraLevel: 1, deposit: null, depositSlots: 2,
    coastal: true,
    color: '#5d7c50',
  },
};

// Named sea regions — drawn below land provinces on the world map.
// Each sea region borders the coastal provinces of the surrounding nations.
const SEA_PROVINCES = {
  vaelSea: {
    name: 'Vael Sea',
    // Wraps the north coast, east coast, and west strip of the continent.
    // Coastline traced from the outer edges of all bordering land provinces.
    points: '0,0 800,0 800,460 720,460 724,410 730,330 735,270 740,200 734,150 730,110 640,50 625,47 510,28 395,29 280,30 160,40 90,70 75,130 75,200 75,280 75,360 75,410 75,460 0,460',
    labelX: 680, labelY: 25,
    color: '#1a3f6a',
    // Nations whose militaryLevel contributes enemy navy strength in this zone.
    adjacentNations: ['sorenia', 'kethara', 'marveth', 'iravan'],
  },
  greyReach: {
    name: 'Grey Reach',
    // South sea below Durenna and the lower Iravan coast.
    points: '0,460 75,460 80,470 100,500 230,513 250,515 400,520 550,510 580,505 680,490 720,460 800,460 800,560 0,560',
    labelX: 400, labelY: 545,
    color: '#1a3f6a',
    // Nations whose militaryLevel contributes enemy navy strength in this zone.
    adjacentNations: ['orzhan', 'durenna', 'iravan'],
  },
};

// ============================================================
// GROUND UNIT TYPES — Phase 5.7a
// Each type defines baseline "Mk.I" stats.  Equipment variants are added in Phase 5.7d.
//
// Per-unit stat meanings (used in 5.7b/c):
//   attack  — offensive combat power per size-1 unit
//   defense — defensive combat power per size-1 unit
//   speed   — province hops per turn when moving (higher = faster)
//
// Cost and upkeep scale linearly with size.
// Artillery and specialist units with attack:0 cannot capture a province alone.
// ============================================================
const UNIT_TYPES = {
  lightInfantry: {
    name:          'Light Infantry',
    icon:          '🪖',
    description:   'Cheap foot soldiers. Excellent at holding defensive positions; slow to advance.',
    costPerSize:   8,
    upkeepPerSize: 1,
    recruitTurns:  2,
    attack:        3,
    defense:       6,
    speed:         2,
    fuelConsumption: 0.05,  // fuel units per size per turn (marching — minimal)
  },
  mechanizedInfantry: {
    name:          'Mechanized Infantry',
    icon:          '🚛',
    description:   'Infantry with armored transports. Balanced offensive/defensive, moves faster.',
    costPerSize:   22,
    upkeepPerSize: 3,
    recruitTurns:  3,
    attack:        5,
    defense:       5,
    speed:         4,
    fuelConsumption: 0.15,  // armored transports — moderate
  },
  armoredCorps: {
    name:          'Armored Corps',
    icon:          '🛡️',
    description:   'Tank-heavy assault force. High offensive power and fast advance; weaker on defense.',
    costPerSize:   55,
    upkeepPerSize: 8,
    recruitTurns:  5,
    attack:        9,
    defense:       3,
    speed:         6,
    fuelConsumption: 0.30,  // tanks — highest consumer
  },
  artilleryBattery: {
    name:          'Artillery Battery',
    icon:          '💥',
    description:   'Heavy guns. Cannot capture provinces alone. Adds a 30% attack bonus to all friendly units in the same province.',
    costPerSize:   30,
    upkeepPerSize: 5,
    recruitTurns:  3,
    attack:        0,
    defense:       2,
    speed:         1,
    supportAttackBonus: 0.30,
    fuelConsumption: 0.10,  // tow vehicles
  },
  reconUnit: {
    name:          'Recon Unit',
    icon:          '🔭',
    description:   'Fast scouts. Low combat strength; reveals enemy unit presence in adjacent provinces.',
    costPerSize:   12,
    upkeepPerSize: 2,
    recruitTurns:  2,
    attack:        2,
    defense:       2,
    speed:         8,
    fuelConsumption: 0.10,  // fast scout vehicles
  },
  antiAirBattery: {
    name:          'Anti-Air Battery',
    icon:          '🚀',
    description:   'Counters enemy air superiority and strategic bombing over provinces it occupies.',
    costPerSize:   28,
    upkeepPerSize: 4,
    recruitTurns:  3,
    attack:        0,
    defense:       3,
    speed:         2,
    airDefenseStrength: 6,
    fuelConsumption: 0.08,  // vehicle-mounted guns
  },
  antiTankBattalion: {
    name:          'Anti-Tank Battalion',
    icon:          '🎯',
    description:   'Tank hunters. High effectiveness against Armored Corps; normal against everything else.',
    costPerSize:   18,
    upkeepPerSize: 3,
    recruitTurns:  2,
    attack:        2,
    defense:       5,
    speed:         3,
    armorPiercingBonus: 4,
    fuelConsumption: 0.08,  // vehicle-mounted
  },
};

// ============================================================
// NAVAL UNIT TYPES — Phase 5.7f
// ============================================================
// Used by Navy commanders. Effective strength = Σ(attack × size) per ready unit.
// fleetMultiplierBonus (Carrier): multiplies the total attack of all other units in the same commander.
// blockadeBonus (Submarine): adds to attack specifically for offensivePatrol / blockade missions.
const NAVAL_UNIT_TYPES = {
  destroyer: {
    name:          'Destroyer',
    icon:          '🚢',
    description:   'Fast anti-submarine escort. Cheap and versatile; excels at convoy protection and sea patrol.',
    costPerSize:   15,
    upkeepPerSize: 2,
    productionTurns: 3,
    attack:        3,
    defense:       4,
    speed:         8,
  },
  frigate: {
    name:          'Frigate',
    icon:          '⛵',
    description:   'Multi-role warship. Balanced offensive and defensive capability at moderate cost.',
    costPerSize:   25,
    upkeepPerSize: 4,
    productionTurns: 4,
    attack:        5,
    defense:       5,
    speed:         6,
  },
  cruiser: {
    name:          'Cruiser',
    icon:          '⚓',
    description:   'Heavy surface combatant. Strong firepower; effective at area denial and force projection.',
    costPerSize:   50,
    upkeepPerSize: 8,
    productionTurns: 5,
    attack:        8,
    defense:       6,
    speed:         4,
  },
  battleship: {
    name:          'Battleship',
    icon:          '🛳️',
    description:   'Capital warship. Immense firepower and resilience; slow to build but dominates any engagement.',
    costPerSize:   120,
    upkeepPerSize: 18,
    productionTurns: 8,
    attack:        15,
    defense:       12,
    speed:         2,
  },
  submarine: {
    name:          'Submarine',
    icon:          '🤿',
    description:   'Stealth underwater predator. Highly effective at interdicting enemy trade and supply lines.',
    costPerSize:   35,
    upkeepPerSize: 6,
    productionTurns: 5,
    attack:        10,
    defense:       2,
    speed:         4,
    blockadeBonus: 0.5,   // +50% effective attack on offensivePatrol / blockade missions
  },
  carrier: {
    name:          'Carrier',
    icon:          '🛥️',
    description:   'Mobile naval air base. Extends air operations over sea zones and multiplies the effectiveness of accompanying fleet units.',
    costPerSize:   200,
    upkeepPerSize: 25,
    productionTurns: 10,
    attack:        5,
    defense:       8,
    speed:         3,
    fleetMultiplierBonus: 0.20,  // +20% to all other units\' attack within the same commander
  },
};

// ============================================================
// AIR UNIT TYPES — Phase 5.7f
// ============================================================
// Used by Air Force commanders.
// missionBonus: multiplier applied to (attack × size) for each mission type.
// reconBonus: flat multiplier bonus to the whole commander\' effective strength (stacks additively).
const AIR_UNIT_TYPES = {
  fighter: {
    name:          'Fighter Squadron',
    icon:          '🛩️',
    description:   'Air superiority fighters. Dominate contested airspace and intercept enemy aircraft.',
    costPerSize:   20,
    upkeepPerSize: 3,
    productionTurns: 3,
    attack:        6,
    defense:       4,
    speed:         10,
    missionBonus:  { airSuperiority: 1.0, strategicBombing: 0.2, airLogistics: 0.0 },
  },
  groundAttack: {
    name:          'Ground Attack Squadron',
    icon:          '💣',
    description:   'Tactical close air support. Effective against ground positions and medium-value strategic targets.',
    costPerSize:   25,
    upkeepPerSize: 4,
    productionTurns: 4,
    attack:        5,
    defense:       2,
    speed:         7,
    missionBonus:  { airSuperiority: 0.4, strategicBombing: 0.6, airLogistics: 0.0 },
  },
  strategicBomber: {
    name:          'Strategic Bomber Squadron',
    icon:          '✈️',
    description:   'Long-range heavy bombers. Strikes enemy infrastructure and industrial capacity from strategic depth.',
    costPerSize:   40,
    upkeepPerSize: 7,
    productionTurns: 5,
    attack:        4,
    defense:       2,
    speed:         5,
    missionBonus:  { airSuperiority: 0.1, strategicBombing: 1.0, airLogistics: 0.0 },
  },
  transport: {
    name:          'Transport Squadron',
    icon:          '🚁',
    description:   'Military cargo aircraft. Sustains air logistics operations, boosting supply delivery to assigned provinces.',
    costPerSize:   15,
    upkeepPerSize: 2,
    productionTurns: 2,
    attack:        0,
    defense:       1,
    speed:         6,
    missionBonus:  { airSuperiority: 0.0, strategicBombing: 0.0, airLogistics: 1.0 },
  },
  reconSpy: {
    name:          'Recon Squadron',
    icon:          '🔭',
    description:   'Intelligence-gathering aircraft. Provides targeting data that boosts the effectiveness of other squadrons.',
    costPerSize:   18,
    upkeepPerSize: 3,
    productionTurns: 2,
    attack:        2,
    defense:       2,
    speed:         9,
    missionBonus:  { airSuperiority: 0.4, strategicBombing: 0.3, airLogistics: 0.3 },
    reconBonus:    0.10,  // +10% to the commander's total effective strength
  },
};
