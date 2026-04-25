// ============================================================
// DATA — static game data: policy and technology definitions
// ============================================================

// Effects are the values achieved at $220M spending (baseline full funding).
// Actual effect = effect × (actualSpending / POLICY_REFERENCE_SPEND).
const POLICIES = {
  industry: {
    id: 'industry',
    name: 'Industry',
    category: 'economy',
    icon: '🏭',
    description: 'Build manufacturing and production capacity. Grows Industry level, boosting GDP growth.',
    maxFunding: 20,
    effects: {}
  },
  commerce: {
    id: 'commerce',
    name: 'Commerce',
    category: 'economy',
    icon: '🏪',
    description: 'Develop markets and retail networks. Grows Commerce level, multiplying all tax income.',
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
    description: 'Fund hospitals and public health programs.',
    maxFunding: 20,
    effects: { happiness: 25 }
  },
  education: {
    id: 'education',
    name: 'Education',
    category: 'social',
    icon: '🎓',
    description: 'Fund schools and universities to develop human capital.',
    maxFunding: 20,
    effects: { rpBonus: 3, gdpGrowth: 0.015, happiness: 10 }
  },
  military: {
    id: 'military',
    name: 'Military',
    category: 'security',
    icon: '⚔️',
    description: 'Armed forces for national defense. (War system coming soon!)',
    maxFunding: 20,
    effects: { militaryStrength: 50, happiness: -3 }
  },
};

const TECHNOLOGIES = {
  // --- TIER 1 ---
  basicAutomation: {
    id: 'basicAutomation', name: 'Basic Automation',
    tier: 1, cost: 20, icon: '⚙️',
    description: 'Automate basic industrial processes.',
    requires: null,
    effects: { gdpGrowthBonus: 0.005, effectDesc: '+0.5% GDP growth' }
  },
  healthcareReform: {
    id: 'healthcareReform', name: 'Healthcare Reform',
    tier: 1, cost: 20, icon: '💊',
    description: 'Improve healthcare system efficiency.',
    requires: null,
    effects: { policyCostMult: { healthcare: 0.80 }, effectDesc: '-20% healthcare cost' }
  },
  educationProgram: {
    id: 'educationProgram', name: 'Education Initiative',
    tier: 1, cost: 20, icon: '📚',
    description: 'Boosts research centre output.',
    requires: null,
    effects: { rpCentreBonus: 2, effectDesc: '+2 bonus RP/centre/turn' }
  },
  // --- TIER 2 ---
  greenIndustry: {
    id: 'greenIndustry', name: 'Green Industry',
    tier: 2, cost: 50, icon: '♻️',
    description: 'Sustainable industry for long-term growth.',
    requires: 'basicAutomation',
    effects: { gdpGrowthBonus: 0.01, happinessBonus: 5, effectDesc: '+1% GDP growth, +5 happiness' }
  },
  universalHealthcare: {
    id: 'universalHealthcare', name: 'Universal Healthcare',
    tier: 2, cost: 50, icon: '🏥',
    description: 'Extend healthcare to all citizens.',
    requires: 'healthcareReform',
    effects: { happinessBonus: 18, effectDesc: '+18 happiness' }
  },
  aiAdministration: {
    id: 'aiAdministration', name: 'AI Administration',
    tier: 2, cost: 50, icon: '🤖',
    description: 'AI streamlines all government operations.',
    requires: 'educationProgram',
    effects: { allPolicyCostMult: 0.90, effectDesc: '-10% all policy costs' }
  },
  // --- TIER 3 ---
  digitalEconomy: {
    id: 'digitalEconomy', name: 'Digital Economy',
    tier: 3, cost: 100, icon: '💻',
    description: 'Lead the global digital transformation.',
    requires: 'greenIndustry',
    effects: { gdpGrowthBonus: 0.02, effectDesc: '+2% GDP growth' }
  },
  advancedWelfare: {
    id: 'advancedWelfare', name: 'Advanced Welfare',
    tier: 3, cost: 100, icon: '🌟',
    description: 'Comprehensive citizen support systems.',
    requires: 'universalHealthcare',
    effects: { happinessBonus: 25, effectDesc: '+25 happiness' }
  },
  spaceProgram: {
    id: 'spaceProgram', name: 'Space Program',
    tier: 3, cost: 100, icon: '🚀',
    description: 'National prestige and scientific advancement.',
    requires: 'aiAdministration',
    effects: { happinessBonus: 10, gdpGrowthBonus: 0.01, rpCentreBonus: 5, effectDesc: '+10 happiness, +1% GDP growth, +5 bonus RP/centre' }
  },
};
