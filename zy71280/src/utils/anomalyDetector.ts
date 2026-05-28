import type {
  BidRecord,
  TransactionRecord,
  UnsoldRecord,
  CommissionTier,
  AnomalyItem,
  AnomalySeverity,
} from '../types/auction';
import rules from '../data/rules.json';

function generateId(): string {
  return 'ANOM-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function getSeverity(sampleSize: number): AnomalySeverity {
  if (sampleSize < rules.sampleSizeThresholds.critical) return 'critical';
  if (sampleSize < rules.sampleSizeThresholds.warning) return 'high';
  if (sampleSize < rules.sampleSizeThresholds.good) return 'medium';
  return 'low';
}

export function detectSampleSizeAnomalies(
  bids: BidRecord[],
  transactions: TransactionRecord[]
): AnomalyItem[] {
  const anomalies: AnomalyItem[] = [];
  const totalSample = bids.length + transactions.length;
  const severity = getSeverity(totalSample);

  if (severity !== 'low') {
    const confidence = totalSample < 10 ? '65%' : totalSample < 30 ? '80%' : '90%';
    anomalies.push({
      id: generateId(),
      type: 'sample_size',
      severity,
      title: `样本量不足（共${totalSample}条）`,
      description: `当前有效样本量为${totalSample}条（出价记录${bids.length}条 + 成交记录${transactions.length}条），低于统计推荐的最小样本量${rules.sampleSizeThresholds.good}条。`,
      basis: `统计学上，样本量≥${rules.sampleSizeThresholds.good}时置信度可达95%以上；当前样本量${totalSample}，对应置信度约${confidence}。依据中心极限定理，样本量不足会导致参数估计偏差。`,
      impact: '计算结果的置信度降低，最优保留价区间可能存在±15%的偏差，极端情况下可能导致流拍或贱卖。',
      suggestion: `建议补充${Math.max(0, rules.sampleSizeThresholds.good - totalSample)}条以上同品类拍品的历史数据，包括：1) 同类拍品近6个月成交记录 2) 本场拍卖会已收到的意向出价 3) 同类拍品的流拍记录。`,
      relatedData: bids.slice(0, 5).map(b => b.id),
    });
  }

  const uniqueBuyers = new Set(bids.map(b => b.buyerId)).size;
  if (uniqueBuyers < 3) {
    anomalies.push({
      id: generateId(),
      type: 'sample_size',
      severity: uniqueBuyers === 0 ? 'critical' : 'high',
      title: `潜在买家样本过少（${uniqueBuyers}人）`,
      description: `当前数据中仅有${uniqueBuyers}位独立买家，不足以支撑买家活跃度分析。`,
      basis: `买家出价模型需要至少5位独立买家的数据才能拟合出价分布，当前仅有${uniqueBuyers}位，数据代表性不足。`,
      impact: '买家活跃度权重计算失真，可能高估或低估成交概率。',
      suggestion: '建议扩大买家范围，调取近12个月内有同类拍品出价记录的买家数据，或引入市场指数作为补充。',
    });
  }

  return anomalies;
}

export function detectUnsoldCostAnomalies(
  unsolds: UnsoldRecord[]
): AnomalyItem[] {
  const anomalies: AnomalyItem[] = [];

  const missingStorage = unsolds.filter(u => u.storageCost === undefined || u.storageCost === 0);
  const missingMarketing = unsolds.filter(u => u.marketingCost === undefined || u.marketingCost === 0);
  const missingOpportunity = unsolds.filter(u => u.opportunityCost === undefined || u.opportunityCost === 0);

  if (missingStorage.length > 0 || missingMarketing.length > 0 || missingOpportunity.length > 0) {
    const missingItems = [
      missingStorage.length > 0 ? `仓储成本缺${missingStorage.length}项` : null,
      missingMarketing.length > 0 ? `营销成本缺${missingMarketing.length}项` : null,
      missingOpportunity.length > 0 ? `机会成本缺${missingOpportunity.length}项` : null,
    ].filter(Boolean).join('，');

    const sampleWithMissing = unsolds.find(u =>
      u.storageCost === undefined || u.marketingCost === undefined || u.opportunityCost === undefined
    );

    const estimatedTotal = sampleWithMissing
      ? (sampleWithMissing.storageCost || 0) + (sampleWithMissing.marketingCost || 0) + (sampleWithMissing.opportunityCost || 0)
      : 0;

    anomalies.push({
      id: generateId(),
      type: 'unsold_cost',
      severity: missingOpportunity.length > unsolds.length * 0.5 ? 'high' : 'medium',
      title: `流拍成本核算不完整（${missingItems}）`,
      description: `在${unsolds.length}条流拍记录中，${missingItems}。系统将使用默认系数估算，但可能与实际成本有偏差。`,
      basis: `完整的流拍成本应包含三项：1) 仓储成本（估值×1.5%×存储月数）2) 营销成本（估值×3%）3) 机会成本（估值×5%）。当前样本"${sampleWithMissing?.itemName}"的流拍成本仅记录了${estimatedTotal.toLocaleString()}元，约占估值的${sampleWithMissing ? ((estimatedTotal / sampleWithMissing.appraisedValue) * 100).toFixed(1) : 0}%，低于建议的9.5%。`,
      impact: `流拍成本低估将导致最优保留价偏高，据测算每低估1万元，最优保留价可能偏高2-3万元，流拍风险增加5-8%。`,
      suggestion: '建议补全历史流拍记录的三项成本：1) 调取仓储费用台账 2) 核对营销推广费用明细 3) 按同期市场收益率核算机会成本。',
      relatedData: unsolds.filter(u =>
        u.storageCost === undefined || u.marketingCost === undefined || u.opportunityCost === undefined
      ).slice(0, 3).map(u => u.id),
    });
  }

  const highReauction = unsolds.filter(u => u.reAuctionCount >= 2);
  if (highReauction.length > 0) {
    anomalies.push({
      id: generateId(),
      type: 'unsold_cost',
      severity: 'high',
      title: `${highReauction.length}件拍品多次流拍`,
      description: `有${highReauction.length}件拍品经历了2次及以上流拍，累计重拍成本已超过估值的15%。`,
      basis: `数据显示"${highReauction[0].itemName}"已流拍${highReauction[0].reAuctionCount}次，每次流拍的平均成本约为估值的9.5%，累计成本已达${(highReauction[0].reAuctionCount * 9.5).toFixed(1)}%。当累计成本超过估值的20%时，理论上已无利可图。`,
      impact: '这类拍品如继续按原保留价上拍，期望收益为负的概率超过70%。',
      suggestion: '建议对此类拍品：1) 降低保留价至估值的50%以下 2) 考虑私洽等非拍卖方式出手 3) 如继续上拍，需重新评估品相和估值。',
      relatedData: highReauction.map(u => u.id),
    });
  }

  return anomalies;
}

export function detectCommissionTierAnomalies(
  currentTiers: CommissionTier[]
): AnomalyItem[] {
  const anomalies: AnomalyItem[] = [];
  const standardTiers = rules.commissionIndustryStandard;

  for (let i = 0; i < currentTiers.length; i++) {
    const current = currentTiers[i];
    const standard = standardTiers[i];

    if (!standard) break;

    if (current.maxAmount !== standard.maxAmount) {
      anomalies.push({
        id: generateId(),
        type: 'commission_tier',
        severity: 'medium',
        title: `佣金阶梯${i + 1}区间设置异常`,
        description: `第${i + 1}阶梯区间设置为${current.minAmount.toLocaleString()}-${current.maxAmount?.toLocaleString() || '无限'}元，与行业标准${standard.minAmount.toLocaleString()}-${standard.maxAmount?.toLocaleString() || '无限'}元不符。`,
        basis: `行业通用的佣金阶梯设置是经过长期实践验证的：低价位拍品（5万以下）佣金25%，中价位（5-20万）20%，高价位（20-100万）15%，超高价位（100万以上）12%。当前设置的断点可能导致佣金计算跳变。`,
        impact: '阶梯区间错误可能导致同一成交价附近佣金跳变超过1000元，引发客户质疑或佣金损失。',
        suggestion: '建议核对最新的佣金政策文件，如确需调整阶梯，应设置过渡区间避免跳变。',
      });
    }

    const rateDiff = Math.abs(current.rate - standard.rate);
    if (rateDiff > 3) {
      anomalies.push({
        id: generateId(),
        type: 'commission_tier',
        severity: rateDiff > 5 ? 'high' : 'medium',
        title: `佣金阶梯${i + 1}比例偏离行业标准`,
        description: `第${i + 1}阶梯佣金比例设置为${current.rate}%，行业标准为${standard.rate}%，偏离${rateDiff}个百分点。`,
        basis: `行业调研显示，${current.description || '该价位段'}的佣金比例通常在${standard.rate - 2}%到${standard.rate + 2}%之间波动。当前设置的${current.rate}%偏离超过3个百分点，属于异常值。`,
        impact: `按偏离${rateDiff}%计算，每件${current.description || '该价位段'}拍品的佣金收入可能偏差约${current.maxAmount ? (current.maxAmount * rateDiff / 100 / 2).toLocaleString() : '较大金额'}元。`,
        suggestion: '建议确认该阶梯比例调整是否有特殊原因，如为促销活动应标注有效期，如为设置错误请更正。',
      });
    }
  }

  for (let i = 1; i < currentTiers.length; i++) {
    if (currentTiers[i].rate > currentTiers[i - 1].rate) {
      anomalies.push({
        id: generateId(),
        type: 'commission_tier',
        severity: 'critical',
        title: '佣金阶梯出现倒转',
        description: `第${i + 1}阶梯（${currentTiers[i].rate}%）高于第${i}阶梯（${currentTiers[i - 1].rate}%），违反"金额越高佣金越低"的常规逻辑。`,
        basis: '佣金阶梯设计应遵循边际递减原则，即成交金额越高，佣金比例越低，因为大额交易的服务成本边际递减。当前设置会导致"拍品成交价越高，拍卖行收入比例越高"的反常现象。',
        impact: '如客户发现此规则，可能质疑拍卖行的专业性和收费合理性；对高端拍品的征集产生负面影响。',
        suggestion: '请立即核对佣金政策文件，将高价位阶梯的佣金比例调整至低于低价位阶梯。',
      });
    }
  }

  for (let i = 0; i < currentTiers.length - 1; i++) {
    if (currentTiers[i].maxAmount !== currentTiers[i + 1].minAmount) {
      anomalies.push({
        id: generateId(),
        type: 'commission_tier',
        severity: 'high',
        title: `佣金阶梯${i + 1}和${i + 2}之间存在断点`,
        description: `第${i + 1}阶梯上限${currentTiers[i].maxAmount?.toLocaleString()}元与第${i + 2}阶梯下限${currentTiers[i + 1].minAmount.toLocaleString()}元不连续，存在${(currentTiers[i + 1].minAmount - (currentTiers[i].maxAmount || 0)).toLocaleString()}元的空白区间。`,
        basis: '佣金阶梯应是连续覆盖的，否则空白区间的成交金额将无法适用任何佣金比例，导致系统计算错误或漏收佣金。',
        impact: `落在空白区间的成交价将无法正确计算佣金，涉及金额${(currentTiers[i + 1].minAmount - (currentTiers[i].maxAmount || 0)).toLocaleString()}元区间。`,
        suggestion: '请立即修正阶梯设置，确保前一阶梯的上限等于后一阶梯的下限。',
      });
    }
  }

  return anomalies;
}

export function detectDataQualityAnomalies(
  bids: BidRecord[],
  transactions: TransactionRecord[]
): AnomalyItem[] {
  const anomalies: AnomalyItem[] = [];

  const suspiciousTransactions = transactions.filter(t =>
    t.salePrice < t.reservePrice * 0.9 ||
    t.salePrice > t.reservePrice * 2
  );

  if (suspiciousTransactions.length > 0) {
    anomalies.push({
      id: generateId(),
      type: 'data_quality',
      severity: 'medium',
      title: `${suspiciousTransactions.length}条成交记录价格异常`,
      description: `有${suspiciousTransactions.length}条成交记录的成交价与保留价偏差超过±10%，可能存在数据录入错误或特殊情况。`,
      basis: `正常拍卖中，成交价通常在保留价的90%-200%区间内。记录"${suspiciousTransactions[0].itemName}"成交价${suspiciousTransactions[0].salePrice.toLocaleString()}元，保留价${suspiciousTransactions[0].reservePrice.toLocaleString()}元，偏差${((suspiciousTransactions[0].salePrice / suspiciousTransactions[0].reservePrice - 1) * 100).toFixed(1)}%。`,
      impact: '异常成交记录如未剔除，将拉偏价格分布模型，导致期望收益计算失真。',
      suggestion: '建议人工复核这些异常记录：1) 确认成交价是否为落槌价+佣金 2) 核实保留价设置记录 3) 对确属异常的数据标注后从模型中剔除。',
      relatedData: suspiciousTransactions.map(t => t.id),
    });
  }

  const zeroActivityBuyers = bids.filter(b => b.buyerActivity === 0);
  if (zeroActivityBuyers.length > 0) {
    anomalies.push({
      id: generateId(),
      type: 'data_quality',
      severity: 'low',
      title: `${zeroActivityBuyers.length}条出价记录缺少买家活跃度`,
      description: `有${zeroActivityBuyers.length}条出价记录的买家活跃度评分为0，可能是新买家或数据缺失。`,
      basis: '买家活跃度评分范围应为1-10分，0分表示该买家的历史行为数据未被采集，系统将按平均活跃度处理。',
      impact: '活跃度缺失可能导致对该买家出价能力的估计偏差±15%。',
      suggestion: '建议补充新买家的基本信息：1) 是否为首次参与拍卖 2) 有无其他渠道的购买记录 3) 业务人员对其实力的主观评价。',
    });
  }

  return anomalies;
}

export function detectAllAnomalies(
  bids: BidRecord[],
  transactions: TransactionRecord[],
  unsolds: UnsoldRecord[],
  commissionTiers: CommissionTier[]
): AnomalyItem[] {
  return [
    ...detectSampleSizeAnomalies(bids, transactions),
    ...detectUnsoldCostAnomalies(unsolds),
    ...detectCommissionTierAnomalies(commissionTiers),
    ...detectDataQualityAnomalies(bids, transactions),
  ];
}
