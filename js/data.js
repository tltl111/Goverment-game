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
    effects: {}
  },
  manufacturing: {
    id: 'manufacturing',
    name: 'Manufacturing',
    category: 'economy',
    icon: '🏭',
    description: 'Convert raw materials into goods. Effective output is capped by Mining level.',
    maxFunding: 20,
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
  military: {
    id: 'military',
    name: 'Military',
    category: 'security',
    icon: '⚔️',
    description: 'Fund armed forces. Builds Military level, increasing national defence strength. High military levels have a small happiness cost.',
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
  },};
