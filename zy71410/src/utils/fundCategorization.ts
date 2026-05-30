import { 
  FundUsageRecord, 
  ProspectusData, 
  LedgerData, 
  PaymentVoucher,
  FundCategory,
  Discrepancy,
  ProcessingHistory,
  ApprovalStatus
} from '../types';
import { generateId } from './import';

export const matchAndCategorizeFunds = (
  prospectuses: ProspectusData[],
  ledgers: LedgerData[],
  vouchers: PaymentVoucher[]
): { records: FundUsageRecord[], discrepancies: Discrepancy[] } => {
  const records: FundUsageRecord[] = [];
  const discrepancies: Discrepancy[] = [];

  const projectGroups = new Map<string, {
    prospectus?: ProspectusData;
    ledger?: LedgerData;
    vouchers: PaymentVoucher[];
  }>();

  prospectuses.forEach(p => {
    if (!projectGroups.has(p.projectName)) {
      projectGroups.set(p.projectName, { vouchers: [] });
    }
    projectGroups.get(p.projectName)!.prospectus = p;
  });

  ledgers.forEach(l => {
    if (!projectGroups.has(l.projectName)) {
      projectGroups.set(l.projectName, { vouchers: [] });
    }
    projectGroups.get(l.projectName)!.ledger = l;
  });

  vouchers.forEach(v => {
    if (!projectGroups.has(v.projectName)) {
      projectGroups.set(v.projectName, { vouchers: [] });
    }
    projectGroups.get(v.projectName)!.vouchers.push(v);
  });

  projectGroups.forEach((group, projectName) => {
    const { prospectus, ledger, vouchers } = group;
    
    if (!prospectus) {
      discrepancies.push(createDiscrepancy(
        'voucher_gap',
        'high',
        `项目"${projectName}"缺少募集说明书，无法核对资金用途`,
        '',
        ['无法确认资金用途合规性', '无法核对金额匹配度', '无法验证披露口径一致性']
      ));
      return;
    }

    const totalVoucherAmount = vouchers.reduce((sum, v) => sum + v.amount, 0);
    const actualAmount = ledger?.actualAmount ?? totalVoucherAmount;
    const plannedAmount = prospectus.issueAmount;

    let finalCategory: FundCategory = prospectus.plannedCategory;
    let categoryChanged = false;
    let categoryChangeReason = '';

    if (ledger && ledger.category !== prospectus.plannedCategory) {
      finalCategory = ledger.category;
      categoryChanged = true;
      categoryChangeReason = `台账分类由"${prospectus.plannedCategory}"变更为"${ledger.category}"`;
      
      discrepancies.push(createDiscrepancy(
        'category_mismatch',
        'medium',
        `项目"${projectName}"用途分类不一致：募集说明书为"${prospectus.plannedCategory}"，台账为"${ledger.category}"`,
        '',
        ['资金用途归类结果变更', '需解释分类变更原因', '影响披露报告准确性'],
        prospectus.plannedCategory,
        ledger.category
      ));
    }

    const voucherCategories = vouchers.map(v => v.category);
    const uniqueVoucherCategories = [...new Set(voucherCategories)];
    if (uniqueVoucherCategories.length > 0 && !uniqueVoucherCategories.includes(finalCategory)) {
      const voucherCategoryCount: Record<string, number> = {};
      voucherCategories.forEach(c => {
        voucherCategoryCount[c] = (voucherCategoryCount[c] || 0) + 1;
      });
      const mostCommonCategory = Object.entries(voucherCategoryCount)
        .sort((a, b) => b[1] - a[1])[0][0] as FundCategory;
      
      finalCategory = mostCommonCategory;
      categoryChanged = true;
      categoryChangeReason = `凭证实际用途多数为"${mostCommonCategory}"，与原分类"${prospectus.plannedCategory}"不符`;
      
      discrepancies.push(createDiscrepancy(
        'category_mismatch',
        'high',
        `项目"${projectName}"凭证分类与计划分类不一致：计划为"${prospectus.plannedCategory}"，凭证多数为"${mostCommonCategory}"`,
        '',
        ['资金用途归类结果强制变更', '需立即解释差异原因', '可能触发监管合规检查', '影响绿色债券认证有效性'],
        prospectus.plannedCategory,
        mostCommonCategory
      ));
    }

    let disclosureVersion = prospectus.disclosureVersion;
    if (disclosureVersion !== 'v1.0') {
      discrepancies.push(createDiscrepancy(
        'disclosure_version',
        'high',
        `项目"${projectName}"使用旧版披露口径：${disclosureVersion}，当前标准为v1.0`,
        '',
        ['披露数据可能不符合最新监管要求', '需补充新版口径所需信息', '可能影响年度绿色评估结果', '需追溯调整历史披露数据'],
        'v1.0',
        disclosureVersion
      ));
    }

    let approvalStatus: ApprovalStatus = 'pending';
    let affectedResults: string[] = [];
    let explanation = '';

    if (categoryChanged) {
      approvalStatus = 'needs_explanation';
      explanation = categoryChangeReason;
      affectedResults.push('用途分类已根据实际凭证/台账调整');
    }

    if (disclosureVersion !== 'v1.0') {
      approvalStatus = 'needs_explanation';
      affectedResults.push('披露口径非最新版本，需补充信息');
    }

    if (totalVoucherAmount < actualAmount * 0.95) {
      const gap = actualAmount - totalVoucherAmount;
      approvalStatus = 'needs_explanation';
      discrepancies.push(createDiscrepancy(
        'voucher_gap',
        'high',
        `项目"${projectName}"凭证缺口：台账金额${formatAmount(actualAmount)}，凭证金额${formatAmount(totalVoucherAmount)}，差额${formatAmount(gap)}`,
        '',
        ['资金支付完整性存疑', '缺失凭证对应的支出无法证明合规性', '需补充缺失凭证', '影响审计结论'],
        formatAmount(actualAmount),
        formatAmount(totalVoucherAmount)
      ));
      affectedResults.push(`凭证缺口${formatAmount(gap)}，待补充`);
    }

    if (vouchers.some(v => !v.hasReceipt || !v.hasApproval)) {
      const incompleteVouchers = vouchers.filter(v => !v.hasReceipt || !v.hasApproval);
      approvalStatus = 'needs_explanation';
      discrepancies.push(createDiscrepancy(
        'voucher_gap',
        'medium',
        `项目"${projectName}"有${incompleteVouchers.length}张凭证不完整`,
        '',
        ['凭证有效性存疑', '需补充缺失的发票或审批文件', '影响合规性证明']
      ));
      affectedResults.push(`${incompleteVouchers.length}张凭证缺少发票或审批`);
    }

    if (ledger && Math.abs(ledger.plannedAmount - plannedAmount) > plannedAmount * 0.01) {
      discrepancies.push(createDiscrepancy(
        'amount_mismatch',
        'medium',
        `项目"${projectName}"金额不一致：募集说明书${formatAmount(plannedAmount)}，台账${formatAmount(ledger.plannedAmount)}`,
        '',
        ['需解释金额差异原因', '影响资金使用进度统计'],
        formatAmount(plannedAmount),
        formatAmount(ledger.plannedAmount)
      ));
    }

    const record: FundUsageRecord = {
      id: generateId(),
      projectName,
      bondCode: prospectus.bondCode,
      category: finalCategory,
      plannedAmount,
      actualAmount,
      paymentDate: vouchers.length > 0 ? vouchers[vouchers.length - 1].paymentDate : undefined,
      prospectusId: prospectus.id,
      ledgerId: ledger?.id,
      voucherId: vouchers.length > 0 ? vouchers[vouchers.length - 1].id : undefined,
      disclosureVersion,
      approvalStatus,
      explanation: explanation || undefined,
      affectedResults: affectedResults.length > 0 ? affectedResults : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    records.push(record);

    discrepancies.forEach(d => {
      if (d.recordId === '') {
        d.recordId = record.id;
      }
    });
  });

  return { records, discrepancies };
};

export const updateCategory = (
  record: FundUsageRecord,
  newCategory: FundCategory,
  operator: string,
  reason: string
): { record: FundUsageRecord; history: ProcessingHistory } => {
  const history: ProcessingHistory = {
    id: generateId(),
    recordId: record.id,
    action: '修改用途分类',
    oldValue: record.category,
    newValue: newCategory,
    operator,
    timestamp: new Date().toISOString(),
    reason
  };

  const updatedRecord: FundUsageRecord = {
    ...record,
    category: newCategory,
    approvalStatus: 'pending',
    explanation: reason,
    affectedResults: record.affectedResults 
      ? [...record.affectedResults, `分类由${record.category}变更为${newCategory}`]
      : [`分类由${record.category}变更为${newCategory}`],
    updatedAt: new Date().toISOString()
  };

  return { record: updatedRecord, history };
};

export const approveRecord = (
  record: FundUsageRecord,
  operator: string,
  comments?: string
): { record: FundUsageRecord; history: ProcessingHistory } => {
  const history: ProcessingHistory = {
    id: generateId(),
    recordId: record.id,
    action: '审核通过',
    operator,
    timestamp: new Date().toISOString(),
    reason: comments
  };

  const updatedRecord: FundUsageRecord = {
    ...record,
    approvalStatus: 'approved',
    updatedAt: new Date().toISOString()
  };

  return { record: updatedRecord, history };
};

export const rejectRecord = (
  record: FundUsageRecord,
  operator: string,
  reason: string
): { record: FundUsageRecord; history: ProcessingHistory } => {
  const history: ProcessingHistory = {
    id: generateId(),
    recordId: record.id,
    action: '审核拒绝',
    operator,
    timestamp: new Date().toISOString(),
    reason
  };

  const updatedRecord: FundUsageRecord = {
    ...record,
    approvalStatus: 'rejected',
    explanation: reason,
    updatedAt: new Date().toISOString()
  };

  return { record: updatedRecord, history };
};

export const requestExplanation = (
  record: FundUsageRecord,
  operator: string,
  reason: string
): { record: FundUsageRecord; history: ProcessingHistory } => {
  const history: ProcessingHistory = {
    id: generateId(),
    recordId: record.id,
    action: '要求解释',
    operator,
    timestamp: new Date().toISOString(),
    reason
  };

  const updatedRecord: FundUsageRecord = {
    ...record,
    approvalStatus: 'needs_explanation',
    explanation: reason,
    updatedAt: new Date().toISOString()
  };

  return { record: updatedRecord, history };
};

const createDiscrepancy = (
  type: Discrepancy['type'],
  severity: Discrepancy['severity'],
  description: string,
  recordId: string,
  affectedResults: string[],
  expectedValue?: string,
  actualValue?: string
): Discrepancy => ({
  id: generateId(),
  type,
  severity,
  description,
  recordId,
  expectedValue,
  actualValue,
  affectedResults,
  resolved: false
});

export const formatAmount = (amount: number): string => {
  if (amount >= 100000000) {
    return (amount / 100000000).toFixed(2) + '亿元';
  } else if (amount >= 10000) {
    return (amount / 10000).toFixed(2) + '万元';
  }
  return amount.toLocaleString() + '元';
};

export const getVouchersByProject = (
  vouchers: PaymentVoucher[],
  projectName: string
): PaymentVoucher[] => {
  return vouchers.filter(v => v.projectName === projectName);
};

export const getTotalByCategory = (
  records: FundUsageRecord[],
  category: FundCategory
): number => {
  return records
    .filter(r => r.category === category)
    .reduce((sum, r) => sum + r.actualAmount, 0);
};
