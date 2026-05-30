import type { SampleFlowData, RatingLevel, Game, Round, RatingAction, Anomaly, BondHolding, NewsEvent } from '@/types';
import { GAME_CONFIG, getRiskWeight } from '@/data/constants';

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const createSampleHoldings = (): BondHolding[] => {
  const bonds = [
    { bondId: 'bond-001', bondCode: '24国开01', bondName: '2024年国家开发银行第一期金融债券', rating: 'AAA' as RatingLevel, marketValue: 102.5, position: 200000 },
    { bondId: 'bond-004', bondCode: '24万科01', bondName: '2024年万科企业股份有限公司公司债券', rating: 'AA' as RatingLevel, marketValue: 98.5, position: 100000 },
    { bondId: 'bond-005', bondCode: '24碧桂02', bondName: '2024年碧桂园控股有限公司公司债券', rating: 'BBB' as RatingLevel, marketValue: 85.2, position: 80000 },
    { bondId: 'bond-007', bondCode: '24万达03', bondName: '2024年大连万达商业管理集团股份有限公司公司债券', rating: 'B' as RatingLevel, marketValue: 68.8, position: 50000 },
    { bondId: 'bond-008', bondCode: '24茅台01', bondName: '2024年贵州茅台酒股份有限公司公司债券', rating: 'AAA' as RatingLevel, marketValue: 103.2, position: 150000 },
  ];

  return bonds.map(bond => {
    const riskWeight = getRiskWeight(bond.rating);
    const adjustedValue = (bond.marketValue * bond.position * riskWeight) / 100;
    return {
      id: `holding-${bond.bondId}-sample`,
      bondId: bond.bondId,
      bondCode: bond.bondCode,
      bondName: bond.bondName,
      currentRating: bond.rating,
      previousRating: bond.rating,
      faceValue: 100,
      marketValue: bond.marketValue,
      position: bond.position,
      riskWeight,
      adjustedValue,
    };
  });
};

const createSampleGame = (): Game => {
  const holdings = createSampleHoldings();
  const initialNav = holdings.reduce((sum, h) => sum + h.adjustedValue, 0) + GAME_CONFIG.INITIAL_CASH;

  const news1: NewsEvent = {
    id: 'news-sample-001',
    title: '【样例1】央行宣布全面降准0.5个百分点',
    content: '中国人民银行决定于下周一起下调金融机构存款准备金率0.5个百分点，释放长期资金约1万亿元。市场流动性预期大幅改善，债券市场整体向好。',
    type: 'macro',
    severity: 'high',
    direction: 'upgrade',
    affectedBondCodes: ['24国开01', '24茅台01'],
    expectedRating: 'AAA',
  };

  const news2: NewsEvent = {
    id: 'news-sample-002',
    title: '【样例2】万科发布业绩预警：净利润预计同比下降40%',
    content: '万科企业股份有限公司发布2024年度业绩预告，受房地产市场持续调整影响，预计净利润同比下降约40%。公司表示将继续推进销售和债务管理。',
    type: 'company',
    severity: 'high',
    direction: 'downgrade',
    affectedBondCodes: ['24万科01'],
    expectedRating: 'BBB',
  };

  const news3: NewsEvent = {
    id: 'news-sample-003',
    title: '【样例3】万达商管未能按时兑付5亿美元债券利息',
    content: '大连万达商业管理集团股份有限公司公告称，因流动性紧张，未能按时兑付一笔5亿美元债券的利息。标普已将其信用评级列入负面观察名单。',
    type: 'company',
    severity: 'high',
    direction: 'downgrade',
    affectedBondCodes: ['24万达03'],
    expectedRating: 'CCC',
  };

  const createAction = (
    bondCode: string,
    oldRating: RatingLevel,
    newRating: RatingLevel,
    reason: string,
    timeSpent: number,
    isCorrect: boolean,
    scoreImpact: number,
    hasAnomaly: boolean
  ): RatingAction => {
    const holding = holdings.find(h => h.bondCode === bondCode)!;
    const oldRiskWeight = getRiskWeight(oldRating);
    const newRiskWeight = getRiskWeight(newRating);
    const oldAdjusted = (holding.marketValue * holding.position * oldRiskWeight) / 100;
    const newAdjusted = (holding.marketValue * holding.position * newRiskWeight) / 100;
    const navImpact = newAdjusted - oldAdjusted;

    return {
      id: generateId(),
      bondCode,
      bondName: holding.bondName,
      oldRating,
      newRating,
      reason,
      timeSpent,
      reactionTime: timeSpent,
      navImpact,
      scoreImpact,
      isCorrect,
      hasAnomaly,
      timestamp: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
    };
  };

  const updateHolding = (holdingsList: BondHolding[], bondCode: string, newRating: RatingLevel): BondHolding[] => {
    return holdingsList.map(h => {
      if (h.bondCode === bondCode) {
        const newRiskWeight = getRiskWeight(newRating);
        const newAdjustedValue = (h.marketValue * h.position * newRiskWeight) / 100;
        return { ...h, previousRating: h.currentRating, currentRating: newRating, riskWeight: newRiskWeight, adjustedValue: newAdjustedValue };
      }
      return h;
    });
  };

  const holdingsAfterRound1 = updateHolding(holdings, '24国开01', 'AAA');
  const navAfterRound1 = holdingsAfterRound1.reduce((sum, h) => sum + h.adjustedValue, 0) + GAME_CONFIG.INITIAL_CASH;

  const holdingsAfterRound2 = updateHolding(holdingsAfterRound1, '24万科01', 'BBB');
  const navAfterRound2 = holdingsAfterRound2.reduce((sum, h) => sum + h.adjustedValue, 0) + GAME_CONFIG.INITIAL_CASH;

  const holdingsAfterRound3 = updateHolding(holdingsAfterRound2, '24万达03', 'AA');
  const navAfterRound3 = holdingsAfterRound3.reduce((sum, h) => sum + h.adjustedValue, 0) + GAME_CONFIG.INITIAL_CASH;

  const action1 = createAction('24国开01', 'AAA', 'AAA', '降准利好利率债，但国开债已是最高评级，维持AAA不变', 25, true, 50, false);
  const action2 = createAction('24万科01', 'AA', 'BBB', '', 35, true, 80, true);
  const action3 = createAction('24万达03', 'B', 'AA', '认为市场反应过度', 40, false, -90, true);

  const anomaly2: Anomaly = {
    id: generateId(),
    type: 'MATERIAL_ISSUE',
    severity: 'low',
    description: '评级调整理由为空',
    rootCause: '操作时未填写调整理由，缺少必要的评级依据',
    suggestion: '每次评级调整都应填写充分的理由，包括分析逻辑和参考依据',
    timestamp: new Date().toISOString(),
  };

  const anomaly3a: Anomaly = {
    id: generateId(),
    type: 'RULE_ISSUE',
    severity: 'high',
    description: '评级调整与新闻方向矛盾',
    rootCause: '新闻明确为负面（债券违约），但评级反而上调，违反基本逻辑',
    suggestion: '评级调整方向应与新闻影响方向一致，负面新闻应下调或维持评级',
    timestamp: new Date().toISOString(),
  };

  const anomaly3b: Anomaly = {
    id: generateId(),
    type: 'DATA_ISSUE',
    severity: 'high',
    description: '评级大幅倒退：从B直接调到AA，跨越5个档位',
    rootCause: '评级调整过于激进，不符合评级调整的渐进性原则',
    suggestion: '单次评级调整不宜超过2个档位，重大变化应分阶段调整',
    timestamp: new Date().toISOString(),
  };

  const rounds: Round[] = [
    {
      id: generateId(),
      roundNumber: 1,
      news: news1,
      affectedBondCodes: news1.affectedBondCodes,
      action: action1,
      anomalies: [],
      correctRating: 'AAA',
      roundScore: 50,
      feedback: '✅ 评级方向正确！国开债已是最高评级AAA，维持不变是合理的判断。',
      navBefore: initialNav,
      navAfter: navAfterRound1,
      holdingsBefore: JSON.parse(JSON.stringify(holdings)),
      holdingsAfter: JSON.parse(JSON.stringify(holdingsAfterRound1)),
      isTimeout: false,
    },
    {
      id: generateId(),
      roundNumber: 2,
      news: news2,
      affectedBondCodes: news2.affectedBondCodes,
      action: action2,
      anomalies: [anomaly2],
      correctRating: 'BBB',
      roundScore: 80,
      feedback: '⚠️ 评级方向正确，但存在材料问题：未填写调整理由。',
      navBefore: navAfterRound1,
      navAfter: navAfterRound2,
      holdingsBefore: JSON.parse(JSON.stringify(holdingsAfterRound1)),
      holdingsAfter: JSON.parse(JSON.stringify(holdingsAfterRound2)),
      isTimeout: false,
    },
    {
      id: generateId(),
      roundNumber: 3,
      news: news3,
      affectedBondCodes: news3.affectedBondCodes,
      action: action3,
      anomalies: [anomaly3a, anomaly3b],
      correctRating: 'CCC',
      roundScore: -90,
      feedback: '❌ 评级方向与新闻影响方向相反：负面新闻（违约）应下调评级而非上调。',
      navBefore: navAfterRound2,
      navAfter: navAfterRound3,
      holdingsBefore: JSON.parse(JSON.stringify(holdingsAfterRound2)),
      holdingsAfter: JSON.parse(JSON.stringify(holdingsAfterRound3)),
      isTimeout: false,
    },
  ];

  return {
    id: generateId(),
    mode: 'sample',
    status: 'finished',
    studentName: '演示学员',
    initialNav,
    currentNav: navAfterRound3,
    cash: GAME_CONFIG.INITIAL_CASH,
    trustScore: 55,
    totalScore: 40,
    totalRounds: 3,
    currentRoundIndex: 2,
    holdings: holdingsAfterRound3,
    rounds,
    selectedBond: null,
    createdAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
  };
};

export const SAMPLE_FLOW: SampleFlowData = {
  game: createSampleGame(),
  steps: [
    {
      id: 'step-1',
      title: '导入样例数据',
      description: '系统加载预设的债券组合和新闻事件，演示完整流程。初始组合包含5只不同评级的债券。',
      icon: '📂',
      keyPoints: ['组合包含AAA到B共5个评级档位的债券', '初始净值约1000万，现金100万', '3个回合分别演示正确、材料问题、规则问题三种情况'],
      showGameContent: true,
    },
    {
      id: 'step-2',
      title: '第一回合：正确操作',
      description: '央行降准利好债券市场。国开债已是最高评级AAA，维持不变。这是正确的判断——不是所有利好都需要调整评级。',
      icon: '✅',
      highlightedRound: 0,
      showGameContent: true,
      keyPoints: ['新闻方向为利好（upgrade），但最高评级无需上调', '维持不变也是正确决策，得分+50', '本回合无异常触发'],
    },
    {
      id: 'step-3',
      title: '第二回合：材料问题',
      description: '万科业绩预警，评级从AA下调至BBB，方向正确但未填写理由。系统检测到材料问题异常（🟡）。',
      icon: '🟡',
      highlightedRound: 1,
      showGameContent: true,
      keyPoints: ['评级方向正确（AA→BBB），但调整理由为空', '触发材料问题异常：依据未填写', '扣20分，本回合得分80分', '这提醒我们：方向对≠操作对，理由是重要的工作留痕'],
    },
    {
      id: 'step-4',
      title: '第三回合：规则问题 + 数据问题',
      description: '万达违约利空，但操作者反向将B调至AA，触发规则问题和数据问题双重异常（🟠🔴）。',
      icon: '🔴',
      highlightedRound: 2,
      showGameContent: true,
      keyPoints: ['评级方向与新闻完全矛盾（利空却上调）', '触发规则问题：方向矛盾', '触发数据问题：跨越5个档位', '本回合扣90分，净值大幅下降', '教训：负面新闻应果断下调，不可逆向操作'],
    },
    {
      id: 'step-5',
      title: '游戏结束与复盘',
      description: '游戏结束，查看最终得分、净值变化和异常统计。系统会生成改进建议和完整的审计日志。',
      icon: '📊',
      showSummary: true,
      keyPoints: ['总得分40分，净值从1000万降至约941万', '异常分类：1项材料问题、1项规则问题、1项数据问题', '建议：加强负面新闻敏感度、填写调整理由、遵循评级渐进原则'],
    },
    {
      id: 'step-6',
      title: '导出报告',
      description: '支持PDF、Excel、JSON和审计日志四种格式导出，方便存档和进一步分析。',
      icon: '📄',
      showExportDemo: true,
      keyPoints: ['PDF报告：包含核心指标、异常统计、改进建议', 'Excel表格：详细的操作明细和异常明细', 'JSON数据：完整结构化数据，便于二次开发', '审计日志：完整的操作审计轨迹'],
    },
  ],
  autoPlayInterval: 4000,
};
