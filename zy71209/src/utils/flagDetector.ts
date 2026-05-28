import type {
  SpecialFlag,
  Pledge,
  MarketData,
  SupplementRecord,
  ExtensionRecord,
} from '../types';

export interface FlagDetectionResult {
  flags: SpecialFlag[];
  details: FlagDetail[];
}

export interface FlagDetail {
  flag: SpecialFlag;
  label: string;
  description: string;
  suggestion: string;
  severity: 'info' | 'warning' | 'danger';
}

export const FLAG_CONFIG: Record<SpecialFlag, Omit<FlagDetail, 'description'>> = {
  suspended: {
    flag: 'suspended',
    label: '停牌估值',
    suggestion: '请使用估值折扣计算，关注复牌时间',
    severity: 'warning',
  },
  supplement_pending: {
    flag: 'supplement_pending',
    label: '补仓未到账',
    suggestion: '请跟踪补仓资金到账情况，及时更新状态',
    severity: 'warning',
  },
  extension_old: {
    flag: 'extension_old',
    label: '展期旧任务',
    suggestion: '展期已获批，此为历史任务，请关注新预警',
    severity: 'info',
  },
  extension_pending: {
    flag: 'extension_pending',
    label: '展期待批',
    suggestion: '展期申请审批中，请跟踪审批进度',
    severity: 'info',
  },
};

export function detectSpecialFlags(
  pledge: Pledge,
  marketData: MarketData | undefined,
  supplements: SupplementRecord[],
  extensions: ExtensionRecord[]
): FlagDetectionResult {
  const flags: SpecialFlag[] = [];
  const details: FlagDetail[] = [];

  if (marketData?.tradingStatus === 'suspended') {
    flags.push('suspended');
    details.push({
      ...FLAG_CONFIG.suspended,
      description: `股票${pledge.stockName}(${pledge.stockCode})处于停牌状态，使用估值折扣${(marketData.valuationDiscount * 100).toFixed(0)}%计算`,
    });
  }

  if (marketData?.tradingStatus === 'halted') {
    flags.push('suspended');
    details.push({
      ...FLAG_CONFIG.suspended,
      label: '临时停牌',
      description: `股票${pledge.stockName}(${pledge.stockCode})处于临时停牌状态，使用昨收价计算`,
      suggestion: '请关注停牌进展，复牌后更新价格',
    });
  }

  const pendingSupplements = supplements.filter(
    (s) => s.pledgeId === pledge.id && s.status === 'pending'
  );
  if (pendingSupplements.length > 0) {
    flags.push('supplement_pending');
    const totalAmount = pendingSupplements.reduce((sum, s) => sum + s.amount, 0);
    details.push({
      ...FLAG_CONFIG.supplement_pending,
      description: `有${pendingSupplements.length}笔补仓待到账，合计${formatCurrency(totalAmount)}元，预计最早到账日：${pendingSupplements[0].expectedDate}`,
    });
  }

  const approvedExtension = extensions.find(
    (e) => e.pledgeId === pledge.id && e.status === 'approved'
  );
  if (approvedExtension && pledge.status !== 'extended') {
    flags.push('extension_old');
    details.push({
      ...FLAG_CONFIG.extension_old,
      description: `展期已于${approvedExtension.approveDate}获批，新到期日：${approvedExtension.newEndDate}，新警戒线：${approvedExtension.newWarningLine.toFixed(2)}%`,
    });
  }

  const pendingExtension = extensions.find(
    (e) => e.pledgeId === pledge.id && e.status === 'pending'
  );
  if (pendingExtension) {
    flags.push('extension_pending');
    details.push({
      ...FLAG_CONFIG.extension_pending,
      description: `展期申请于${pendingExtension.applyDate}提交，申请到期日：${pendingExtension.newEndDate}，申请警戒线：${pendingExtension.newWarningLine.toFixed(2)}%`,
    });
  }

  return { flags, details };
}

export function updatePledgeFlags(
  pledge: Pledge,
  marketData: MarketData | undefined,
  supplements: SupplementRecord[],
  extensions: ExtensionRecord[]
): Pledge {
  const { flags } = detectSpecialFlags(pledge, marketData, supplements, extensions);
  return {
    ...pledge,
    specialFlags: flags,
    updatedAt: new Date().toISOString(),
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

export function getFlagDetail(flag: SpecialFlag): Omit<FlagDetail, 'description'> {
  return FLAG_CONFIG[flag];
}
