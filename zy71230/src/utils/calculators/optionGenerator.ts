/* eslint-disable @typescript-eslint/no-explicit-any */
import type { DisposalOption, RiskType, RiskOptionLevel } from '../../types/tour';

function generateOptionId(): string {
  return `opt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

type SeverityMultiplier = {
  impact: number;
  outcome: number;
};

function getSeverityMultiplier(severity: string): SeverityMultiplier {
  const s = severity.toLowerCase();
  if (s === 'critical') return { impact: 1.5, outcome: 0.7 };
  if (s === 'warning') return { impact: 1.0, outcome: 1.0 };
  return { impact: 1.0, outcome: 1.0 };
}

function createOption(
  level: RiskOptionLevel,
  name: string,
  description: string,
  baseImpact: { cashFlow: number; riskIndex: number },
  baseOutcome: { bestCase: number; expectedCase: number; worstCase: number },
  severity: string
): DisposalOption {
  const mult = getSeverityMultiplier(severity);
  return {
    id: generateOptionId(),
    name,
    description,
    riskLevel: level,
    immediateImpact: {
      cashFlow: Math.round(baseImpact.cashFlow * mult.impact),
      riskIndex: Math.round(baseImpact.riskIndex * mult.impact),
    },
    projectedOutcome: {
      bestCase: Math.round(baseOutcome.bestCase * mult.outcome),
      expectedCase: Math.round(baseOutcome.expectedCase * mult.outcome),
      worstCase: Math.round(baseOutcome.worstCase * mult.outcome),
    },
  };
}

function generateBoxOfficeOptions(severity: string, currentState: any): DisposalOption[] {
  const shortfall = Math.max(0, (currentState?.predictedRevenue || 0) - (currentState?.actualRevenue || 0));

  return [
    createOption(
      'conservative',
      '加大社交媒体宣传',
      '通过现有社交媒体渠道增加演出宣传投入，发布乐队幕后花絮和排练视频，吸引已有粉丝群体购票',
      { cashFlow: -2000, riskIndex: -10 },
      { bestCase: Math.round(shortfall * 0.4), expectedCase: Math.round(shortfall * 0.25), worstCase: Math.round(shortfall * 0.1) },
      severity
    ),
    createOption(
      'balanced',
      '推出套票优惠 + 本地KOL合作',
      '与本地生活方式KOL合作推广，同时推出限量早鸟套票和双人优惠套餐，通过价格杠杆刺激销售',
      { cashFlow: -5000, riskIndex: -25 },
      { bestCase: Math.round(shortfall * 0.7), expectedCase: Math.round(shortfall * 0.45), worstCase: Math.round(shortfall * 0.2) },
      severity
    ),
    createOption(
      'aggressive',
      '场地降价 + 大规模广告投放',
      '临时下调票价20%-30%，同时在本地音乐平台、电台和户外广告进行大规模投放，目标是在短时间内最大化触达潜在观众',
      { cashFlow: -12000, riskIndex: -40 },
      { bestCase: Math.round(shortfall * 1.1), expectedCase: Math.round(shortfall * 0.65), worstCase: Math.round(shortfall * 0.15) },
      severity
    ),
  ];
}

function generateInventoryOptions(severity: string, currentState: any): DisposalOption[] {
  const stockDeficit = Math.max(
    0,
    (currentState?.projectedDemand || 0) - (currentState?.currentStock || 0)
  );
  const unitProfit = (currentState?.sellingPrice || 0) - (currentState?.costPrice || 0);

  return [
    createOption(
      'conservative',
      '优化现有库存调配',
      '将滞销商品与热门商品捆绑销售，调整各城市间的库存分配，优先保障高需求场次的供货',
      { cashFlow: -500, riskIndex: -8 },
      { bestCase: Math.round(stockDeficit * unitProfit * 0.3), expectedCase: Math.round(stockDeficit * unitProfit * 0.2), worstCase: Math.round(stockDeficit * unitProfit * 0.05) },
      severity
    ),
    createOption(
      'balanced',
      '紧急补货 + 预售机制',
      '对热销商品进行紧急补货（空运+快递加急），同时开启现场预售，承诺后续邮寄，锁定当前销售收入',
      { cashFlow: -3000, riskIndex: -20 },
      { bestCase: Math.round(stockDeficit * unitProfit * 0.6), expectedCase: Math.round(stockDeficit * unitProfit * 0.4), worstCase: Math.round(stockDeficit * unitProfit * 0.15) },
      severity
    ),
    createOption(
      'aggressive',
      '全品类紧急补货 + 限时促销',
      '对所有商品品类进行大规模紧急补货，同时推出"买二送一"、"满减"等促销活动，最大化巡演期间的周边销售收入',
      { cashFlow: -8000, riskIndex: -35 },
      { bestCase: Math.round(stockDeficit * unitProfit * 0.9), expectedCase: Math.round(stockDeficit * unitProfit * 0.55), worstCase: Math.round(stockDeficit * unitProfit * 0.1) },
      severity
    ),
  ];
}

function generateRouteOptions(severity: string, currentState: any): DisposalOption[] {
  const extraDistance = Math.max(
    0,
    (currentState?.actualDistance || 0) - (currentState?.optimalDistance || 0)
  );
  const costPerKm = currentState?.transportCostPerKm || 3;

  return [
    createOption(
      'conservative',
      '优化行车时间安排',
      '调整出发时间避开交通高峰，利用夜间行车减少拥堵影响，同时合理安排司机轮班避免疲劳驾驶',
      { cashFlow: -200, riskIndex: -5 },
      { bestCase: Math.round(extraDistance * costPerKm * 0.3), expectedCase: Math.round(extraDistance * costPerKm * 0.15), worstCase: 0 },
      severity
    ),
    createOption(
      'balanced',
      '调整演出顺序 + 部分路段改高速',
      '重新规划后续城市演出顺序以减少折返，对部分关键路段改走高速公路缩短时间，权衡高速费与时间成本',
      { cashFlow: -1500, riskIndex: -18 },
      { bestCase: Math.round(extraDistance * costPerKm * 0.55), expectedCase: Math.round(extraDistance * costPerKm * 0.35), worstCase: Math.round(extraDistance * costPerKm * 0.1) },
      severity
    ),
    createOption(
      'aggressive',
      '更换交通方式 + 航班接驳',
      '对长距离路段改为飞机或高铁出行，将设备和人员分批次运输，确保准时到达所有演出场地，避免违约损失',
      { cashFlow: -15000, riskIndex: -45 },
      { bestCase: Math.round(extraDistance * costPerKm * 0.95), expectedCase: Math.round(extraDistance * costPerKm * 0.6), worstCase: Math.round(extraDistance * costPerKm * 0.2) },
      severity
    ),
  ];
}

function generateCashFlowOptions(severity: string, currentState: any): DisposalOption[] {
  const cashShortfall = Math.max(
    0,
    (currentState?.projectedExpenses || 0) - (currentState?.currentCash || 0)
  );

  return [
    createOption(
      'conservative',
      '削减非必要支出',
      '立即暂停所有非必要支出，包括营销预算、团队餐饮标准、住宿升级等，确保核心演出相关支出不受影响',
      { cashFlow: 5000, riskIndex: -12 },
      { bestCase: Math.round(cashShortfall * 0.35), expectedCase: Math.round(cashShortfall * 0.2), worstCase: Math.round(cashShortfall * 0.08) },
      severity
    ),
    createOption(
      'balanced',
      '寻求赞助商预付款 + 供应商账期协商',
      '与主要赞助商协商提前支付部分赞助款项，同时与场地、供应商协商延长付款账期，缓解短期资金压力',
      { cashFlow: 15000, riskIndex: -28 },
      { bestCase: Math.round(cashShortfall * 0.7), expectedCase: Math.round(cashShortfall * 0.45), worstCase: Math.round(cashShortfall * 0.2) },
      severity
    ),
    createOption(
      'aggressive',
      '紧急融资 + 预售未来场次',
      '通过乐队个人关系进行紧急借款或引入短期投资人，同时提前开启后续所有场次的门票预售，快速回笼资金',
      { cashFlow: 50000, riskIndex: -50 },
      { bestCase: Math.round(cashShortfall * 1.2), expectedCase: Math.round(cashShortfall * 0.7), worstCase: Math.round(cashShortfall * 0.15) },
      severity
    ),
  ];
}

export function generateDisposalOptions(
  riskType: string,
  severity: string,
  currentState: any
): DisposalOption[] {
  const type = riskType as RiskType;

  switch (type) {
    case 'box_office':
      return generateBoxOfficeOptions(severity, currentState);
    case 'inventory':
      return generateInventoryOptions(severity, currentState);
    case 'route':
      return generateRouteOptions(severity, currentState);
    case 'cashflow':
      return generateCashFlowOptions(severity, currentState);
    default:
      return [];
  }
}
