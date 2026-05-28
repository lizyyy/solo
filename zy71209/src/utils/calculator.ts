import type {
  Pledge,
  MarketData,
  SupplementRecord,
  ExtensionRecord,
  PledgeCalculation,
} from '../types';

export function calculatePledgeRatio(
  pledge: Pledge,
  marketData: MarketData | undefined,
  supplements: SupplementRecord[],
  extensions: ExtensionRecord[]
): PledgeCalculation {
  const steps: PledgeCalculation['calculationSteps'] = [];

  const validation = validateWarningLineParams(pledge.warningLine, pledge.closeLine);
  if (!validation.valid) {
    steps.push({
      label: '参数校验',
      value: '警告',
      formula: validation.errors.join('；'),
    });
  }

  let effectivePrice: number;
  if (!marketData) {
    effectivePrice = 0;
    steps.push({
      label: '有效价格',
      value: '0.00',
      formula: '无行情数据',
    });
  } else if (marketData.tradingStatus === 'suspended') {
    effectivePrice = marketData.previousClose * marketData.valuationDiscount;
    steps.push({
      label: '股票状态',
      value: '停牌',
    });
    steps.push({
      label: '昨收价',
      value: marketData.previousClose.toFixed(2),
    });
    steps.push({
      label: '估值折扣',
      value: `${(marketData.valuationDiscount * 100).toFixed(0)}%`,
    });
    steps.push({
      label: '有效价格',
      value: effectivePrice.toFixed(2),
      formula: `昨收价 × 估值折扣 = ${marketData.previousClose.toFixed(2)} × ${marketData.valuationDiscount}`,
    });
  } else if (marketData.tradingStatus === 'halted') {
    effectivePrice = marketData.previousClose;
    steps.push({
      label: '股票状态',
      value: '临时停牌',
    });
    steps.push({
      label: '有效价格',
      value: effectivePrice.toFixed(2),
      formula: '使用昨收价',
    });
  } else {
    effectivePrice = marketData.latestPrice;
    steps.push({
      label: '股票状态',
      value: '正常交易',
    });
    steps.push({
      label: '最新价',
      value: effectivePrice.toFixed(2),
    });
  }

  const marketValue = pledge.pledgeShares * effectivePrice;
  steps.push({
    label: '质押股数',
    value: pledge.pledgeShares.toLocaleString(),
  });
  steps.push({
    label: '质押市值',
    value: formatCurrency(marketValue),
    formula: `质押股数 × 有效价格 = ${pledge.pledgeShares.toLocaleString()} × ${effectivePrice.toFixed(2)}`,
  });

  const receivedSupplements = supplements
    .filter((s) => s.pledgeId === pledge.id && s.status === 'received')
    .reduce((sum, s) => sum + s.amount, 0);

  if (receivedSupplements > 0) {
    steps.push({
      label: '已到账补仓',
      value: formatCurrency(receivedSupplements),
    });
  }

  const adjustedPrincipal = Math.max(0, pledge.principal - receivedSupplements);
  steps.push({
    label: '融资本金',
    value: formatCurrency(pledge.principal),
  });
  if (receivedSupplements > 0) {
    steps.push({
      label: '调整后本金',
      value: formatCurrency(adjustedPrincipal),
      formula: `融资本金 - 已到账补仓 = ${formatCurrency(pledge.principal)} - ${formatCurrency(receivedSupplements)}`,
    });
  }

  let pledgeRatio: number;
  if (marketValue > 0) {
    pledgeRatio = (adjustedPrincipal / marketValue) * 100;
  } else {
    pledgeRatio = 100;
  }

  steps.push({
    label: '质押率',
    value: `${pledgeRatio.toFixed(2)}%`,
    formula: `调整后本金 / 质押市值 × 100% = ${formatCurrency(adjustedPrincipal)} / ${formatCurrency(marketValue)} × 100%`,
  });

  const activeExtension = extensions.find(
    (e) => e.pledgeId === pledge.id && e.status === 'approved'
  );
  const effectiveWarningLine = activeExtension?.newWarningLine ?? pledge.warningLine;

  if (activeExtension) {
    steps.push({
      label: '原警戒线',
      value: `${pledge.warningLine.toFixed(2)}%`,
    });
    steps.push({
      label: '展期后警戒线',
      value: `${effectiveWarningLine.toFixed(2)}%`,
    });
  } else {
    steps.push({
      label: '警戒线',
      value: `${effectiveWarningLine.toFixed(2)}%`,
    });
  }

  steps.push({
    label: '平仓线',
    value: `${pledge.closeLine.toFixed(2)}%`,
  });

  const isWarning = pledgeRatio >= effectiveWarningLine;
  const isClose = pledgeRatio >= pledge.closeLine;
  const warningBuffer = effectiveWarningLine - pledgeRatio;

  if (isClose) {
    steps.push({
      label: '风险状态',
      value: '已触发平仓线',
      formula: `质押率 ${pledgeRatio.toFixed(2)}% ≥ 平仓线 ${pledge.closeLine.toFixed(2)}%`,
    });
  } else if (isWarning) {
    steps.push({
      label: '风险状态',
      value: '已触发警戒线',
      formula: `质押率 ${pledgeRatio.toFixed(2)}% ≥ 警戒线 ${effectiveWarningLine.toFixed(2)}%`,
    });
  } else {
    steps.push({
      label: '安全缓冲',
      value: `${warningBuffer.toFixed(2)}%`,
      formula: `警戒线 ${effectiveWarningLine.toFixed(2)}% - 质押率 ${pledgeRatio.toFixed(2)}%`,
    });
  }

  return {
    marketValue,
    effectivePrice,
    pledgeRatio,
    isWarning,
    isClose,
    warningBuffer,
    effectiveWarningLine,
    calculationSteps: steps,
  };
}

function formatCurrency(value: number): string {
  if (value >= 100000000) {
    return `${(value / 100000000).toFixed(2)}亿`;
  } else if (value >= 10000) {
    return `${(value / 10000).toFixed(2)}万`;
  }
  return value.toFixed(2);
}

export function formatCurrencyFull(value: number): string {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function validateWarningLineParams(warningLine: number, closeLine: number): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (isNaN(warningLine) || warningLine <= 0) {
    errors.push(`警戒线必须大于0，当前值：${warningLine}`);
  }

  if (isNaN(closeLine) || closeLine <= 0) {
    errors.push(`平仓线必须大于0，当前值：${closeLine}`);
  }

  if (warningLine >= 200) {
    errors.push(`警戒线过高，建议不超过200%，当前值：${warningLine}%`);
  }

  if (warningLine >= closeLine) {
    errors.push(`警戒线(${warningLine}%)必须低于平仓线(${closeLine}%)`);
  }

  const diff = closeLine - warningLine;
  if (diff < 5) {
    errors.push(`警戒线与平仓线差距过小，建议至少相差5%，当前差距：${diff}%`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validatePledgeParams(pledgeShares: number, principal: number): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (isNaN(pledgeShares) || pledgeShares <= 0) {
    errors.push(`质押股数必须大于0，当前值：${pledgeShares}`);
  }

  if (isNaN(principal) || principal <= 0) {
    errors.push(`融资本金必须大于0，当前值：${principal}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
