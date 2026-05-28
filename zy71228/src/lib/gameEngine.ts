import type {
  PolicyAction,
  MarketState,
  RiskStatus,
  EventCard,
  EventOption,
  Difficulty,
} from '@/types/game';

const DEPOSIT_BASE = 200000;
const TARGET_MATURITY = 14;
const MATURITY_WARNING_THRESHOLD = 7;
const MATURITY_DANGER_THRESHOLD = 14;
const EXCESS_RESERVE_LOW = 0.015;
const EXCESS_RESERVE_HIGH = 0.025;

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function calculateLiquidityChange(
  actions: PolicyAction[],
  eventOption: EventOption | null
): number {
  let change = 0;

  for (const action of actions) {
    if (action.status !== 'confirmed') continue;
    const multiplier = action.direction === 'inject' ? 1 : -1;
    change += action.amount * multiplier;
  }

  if (eventOption) {
    change += eventOption.liquidityModifier;
  }

  change += (Math.random() - 0.5) * 200;

  return change;
}

export function calculateTheoreticalRateChange(
  liquidityChange: number,
  currentLiquidity: number
): number {
  const ratio = liquidityChange / currentLiquidity;
  const baseSensitivity = -0.05;
  return baseSensitivity * ratio * 100;
}

export function applyRateLag(
  theoreticalChange: number,
  pendingChange: number,
  lagEffect: number
): { actualChange: number; newPending: number } {
  const effectiveChange = theoreticalChange * (1 - lagEffect) + pendingChange * lagEffect;
  const newPending = theoreticalChange * lagEffect;

  return { actualChange: effectiveChange, newPending };
}

export function calculateWeightedAverageMaturity(actions: PolicyAction[]): number {
  const confirmedActions = actions.filter(a => a.status === 'confirmed');
  if (confirmedActions.length === 0) return TARGET_MATURITY;

  const totalAmount = confirmedActions.reduce((sum, a) => sum + a.amount, 0);
  if (totalAmount === 0) return TARGET_MATURITY;

  const weightedSum = confirmedActions.reduce(
    (sum, a) => sum + a.amount * a.term,
    0
  );

  return weightedSum / totalAmount;
}

export function calculateMaturityGap(
  weightedAvgMaturity: number,
  targetMaturity: number = TARGET_MATURITY
): number {
  return Math.abs(targetMaturity - weightedAvgMaturity);
}

export function assessMaturityRisk(maturityGap: number): RiskStatus {
  if (maturityGap >= MATURITY_DANGER_THRESHOLD) return 'danger';
  if (maturityGap >= MATURITY_WARNING_THRESHOLD) return 'warning';
  return 'normal';
}

export function calculateExcessReserveRatio(liquidity: number): number {
  return liquidity / DEPOSIT_BASE;
}

export function assessLiquidityRisk(
  excessReserveRatio: number,
  maturityGap: number
): RiskStatus {
  const maturityRisk = assessMaturityRisk(maturityGap);

  if (maturityRisk === 'danger') return 'danger';
  if (
    excessReserveRatio < EXCESS_RESERVE_LOW ||
    excessReserveRatio > EXCESS_RESERVE_HIGH
  ) {
    return maturityRisk === 'warning' ? 'danger' : 'warning';
  }

  return maturityRisk;
}

export function createInitialMarketState(): MarketState {
  return {
    roundNumber: 0,
    liquidity: 4000,
    dr007: 2.0,
    t10y: 2.8,
    excessReserveRatio: 4000 / DEPOSIT_BASE,
    maturityGap: 0,
    liquidityRisk: 'normal',
    rateLagEffect: 0.6,
    pendingRateChange: 0,
  };
}

export function processRound(
  prevState: MarketState,
  actions: PolicyAction[],
  eventOption: EventOption | null,
  roundNumber: number
): { newState: MarketState; liquidityChange: number } {
  const liquidityChange = calculateLiquidityChange(actions, eventOption);
  const newLiquidity = prevState.liquidity + liquidityChange;

  const theoreticalRateChange = calculateTheoreticalRateChange(
    liquidityChange,
    prevState.liquidity
  );

  const { actualChange, newPending } = applyRateLag(
    theoreticalRateChange + (eventOption?.rateModifier || 0),
    prevState.pendingRateChange,
    prevState.rateLagEffect
  );

  const newDr007 = Math.max(0.5, Math.min(5, prevState.dr007 + actualChange));
  const newT10y = Math.max(1.5, Math.min(4.5, prevState.t10y + actualChange * 0.5));

  const weightedAvgMaturity = calculateWeightedAverageMaturity(actions);
  const maturityGap = calculateMaturityGap(weightedAvgMaturity);
  const excessReserveRatio = calculateExcessReserveRatio(newLiquidity);
  const liquidityRisk = assessLiquidityRisk(excessReserveRatio, maturityGap);

  const newLagEffect = Math.max(0.2, prevState.rateLagEffect - 0.05);

  return {
    newState: {
      roundNumber,
      liquidity: newLiquidity,
      dr007: newDr007,
      t10y: newT10y,
      excessReserveRatio,
      maturityGap,
      liquidityRisk,
      rateLagEffect: newLagEffect,
      pendingRateChange: newPending,
    },
    liquidityChange,
  };
}

const EVENT_TEMPLATES: Omit<EventCard, 'id' | 'roundNumber'>[] = [
  {
    title: '缴税大月',
    description: '本月为季度缴税高峰期，银行体系流动性面临收紧压力',
    impactType: 'liquidity',
    impactValue: -800,
    options: [
      {
        id: 'opt1',
        label: '大额逆回购对冲',
        effectDescription: '投放1000亿流动性，利率下行5bp',
        liquidityModifier: 1000,
        rateModifier: -0.05,
      },
      {
        id: 'opt2',
        label: 'MLF续作',
        effectDescription: '投放500亿中期流动性，利率基本稳定',
        liquidityModifier: 500,
        rateModifier: 0,
      },
      {
        id: 'opt3',
        label: '不干预',
        effectDescription: '流动性自然收紧，利率上行10bp',
        liquidityModifier: 0,
        rateModifier: 0.1,
      },
    ],
  },
  {
    title: '海外加息预期升温',
    description: '美联储释放鹰派信号，中美利差收窄引发资本外流担忧',
    impactType: 'expectation',
    impactValue: 10,
    options: [
      {
        id: 'opt1',
        label: '主动跟随抬升',
        effectDescription: '政策利率引导上行15bp，汇率稳定',
        liquidityModifier: -300,
        rateModifier: 0.15,
      },
      {
        id: 'opt2',
        label: '保持内部均衡优先',
        effectDescription: '维持利率稳定，资本外流压力增加',
        liquidityModifier: -500,
        rateModifier: 0.05,
      },
      {
        id: 'opt3',
        label: '降准释放信号',
        effectDescription: '释放长期流动性，利率下行10bp',
        liquidityModifier: 800,
        rateModifier: -0.1,
      },
    ],
  },
  {
    title: '银行半年末考核',
    description: '临近半年末，银行面临MPA考核，流动性需求季节性上升',
    impactType: 'liquidity',
    impactValue: -600,
    options: [
      {
        id: 'opt1',
        label: '7天逆回购+14天跨季',
        effectDescription: '组合投放1200亿，平稳跨季',
        liquidityModifier: 1200,
        rateModifier: -0.03,
      },
      {
        id: 'opt2',
        label: '仅7天逆回购',
        effectDescription: '投放600亿，跨季后自然到期',
        liquidityModifier: 600,
        rateModifier: 0.02,
      },
      {
        id: 'opt3',
        label: '提醒机构自律',
        effectDescription: '窗口指导，市场波动加大',
        liquidityModifier: 0,
        rateModifier: 0.08,
      },
    ],
  },
  {
    title: '通胀数据超预期',
    description: 'CPI同比上涨3.2%，高于市场预期的2.8%',
    impactType: 'rate',
    impactValue: 15,
    options: [
      {
        id: 'opt1',
        label: '边际收紧流动性',
        effectDescription: '回笼400亿，引导通胀预期',
        liquidityModifier: -400,
        rateModifier: 0.05,
      },
      {
        id: 'opt2',
        label: '观察后续数据',
        effectDescription: '维持中性，市场预期分化',
        liquidityModifier: 0,
        rateModifier: 0.03,
      },
      {
        id: 'opt3',
        label: '强调物价稳定目标',
        effectDescription: '舆论引导，实际操作不变',
        liquidityModifier: 0,
        rateModifier: 0.01,
      },
    ],
  },
  {
    title: '经济下行压力加大',
    description: 'PMI连续3个月位于荣枯线以下，实体经济融资需求疲弱',
    impactType: 'expectation',
    impactValue: -15,
    options: [
      {
        id: 'opt1',
        label: '降准降息组合拳',
        effectDescription: '大幅宽松，释放1500亿流动性',
        liquidityModifier: 1500,
        rateModifier: -0.2,
      },
      {
        id: 'opt2',
        label: '定向流动性支持',
        effectDescription: 'MLF增量续作800亿',
        liquidityModifier: 800,
        rateModifier: -0.08,
      },
      {
        id: 'opt3',
        label: '以我为主保持定力',
        effectDescription: '维持现有政策，等待财政发力',
        liquidityModifier: 0,
        rateModifier: -0.02,
      },
    ],
  },
];

export function generateEventCard(roundNumber: number): EventCard | null {
  if (Math.random() > 0.5) return null;

  const template = EVENT_TEMPLATES[Math.floor(Math.random() * EVENT_TEMPLATES.length)];

  return {
    id: generateId(),
    roundNumber,
    ...template,
  };
}

export function getDifficultyConfig(difficulty: Difficulty): {
  maxRounds: number;
  eventFrequency: number;
  volatility: number;
} {
  switch (difficulty) {
    case 'easy':
      return { maxRounds: 8, eventFrequency: 0.3, volatility: 0.8 };
    case 'normal':
      return { maxRounds: 12, eventFrequency: 0.5, volatility: 1.0 };
    case 'hard':
      return { maxRounds: 16, eventFrequency: 0.7, volatility: 1.3 };
  }
}

export function validatePolicyAction(action: Omit<PolicyAction, 'id' | 'roundNumber'>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!action.amount || action.amount <= 0) {
    errors.push('金额必须大于0');
  }

  if (!action.term || action.term <= 0) {
    errors.push('期限必须大于0');
  }

  if (action.amount > 5000) {
    errors.push('单次操作金额不能超过5000亿元');
  }

  return { valid: errors.length === 0, errors };
}

export function validateRoundSubmission(
  roundActions: PolicyAction[],
  currentStatus: string
): { valid: boolean; error?: string } {
  if (currentStatus === 'confirmed') {
    return { valid: false, error: '本回合已确认提交，请勿重复操作' };
  }

  const hasConfirmedAction = roundActions.some(a => a.status === 'confirmed');
  if (!hasConfirmedAction && roundActions.length > 0) {
    return { valid: false, error: '请至少确认一项政策操作后再提交' };
  }

  return { valid: true };
}
