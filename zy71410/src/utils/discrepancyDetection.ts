import { 
  Discrepancy, 
  FundUsageRecord, 
  ProspectusData, 
  LedgerData, 
  PaymentVoucher,
  DiscrepancyType
} from '../types';
import { generateId } from './import';

export const detectAllDiscrepancies = (
  records: FundUsageRecord[],
  prospectuses: ProspectusData[],
  ledgers: LedgerData[],
  vouchers: PaymentVoucher[]
): Discrepancy[] => {
  const discrepancies: Discrepancy[] = [];

  records.forEach(record => {
    const prospectus = prospectuses.find(p => p.id === record.prospectusId);
    const ledger = ledgers.find(l => l.id === record.ledgerId);
    const projectVouchers = vouchers.filter(v => v.projectName === record.projectName);

    const categoryDiscrepancies = checkCategoryConsistency(
      record, prospectus, ledger, projectVouchers
    );
    discrepancies.push(...categoryDiscrepancies);

    const voucherDiscrepancies = checkVoucherCompleteness(
      record, projectVouchers
    );
    discrepancies.push(...voucherDiscrepancies);

    const disclosureDiscrepancies = checkDisclosureVersion(
      record, prospectus
    );
    discrepancies.push(...disclosureDiscrepancies);

    const amountDiscrepancies = checkAmountConsistency(
      record, prospectus, ledger, projectVouchers
    );
    discrepancies.push(...amountDiscrepancies);

    const dateDiscrepancies = checkDateConsistency(
      record, prospectus, ledger, projectVouchers
    );
    discrepancies.push(...dateDiscrepancies);
  });

  return discrepancies;
};

const checkCategoryConsistency = (
  record: FundUsageRecord,
  prospectus?: ProspectusData,
  ledger?: LedgerData,
  vouchers: PaymentVoucher[] = []
): Discrepancy[] => {
  const discrepancies: Discrepancy[] = [];

  if (prospectus && record.category !== prospectus.plannedCategory) {
    discrepancies.push({
      id: generateId(),
      type: 'category_mismatch',
      severity: 'high',
      description: `项目"${record.projectName}"最终分类"${record.category}"与募集说明书分类"${prospectus.plannedCategory}"不一致`,
      recordId: record.id,
      fieldName: 'category',
      expectedValue: prospectus.plannedCategory,
      actualValue: record.category,
      affectedResults: [
        '资金用途归类结果与计划不符',
        '需提供分类变更的正式说明文件',
        '可能影响绿色债券认证资格',
        '需在季度报告中进行专项说明'
      ],
      resolved: false
    });
  }

  if (ledger && record.category !== ledger.category) {
    discrepancies.push({
      id: generateId(),
      type: 'category_mismatch',
      severity: 'medium',
      description: `项目"${record.projectName}"最终分类"${record.category}"与台账分类"${ledger.category}"不一致`,
      recordId: record.id,
      fieldName: 'category',
      expectedValue: ledger.category,
      actualValue: record.category,
      affectedResults: [
        '内部台账分类需同步更新',
        '可能影响内部绩效考核',
        '需确认最终分类依据'
      ],
      resolved: false
    });
  }

  const voucherCategories = vouchers.map(v => v.category);
  const uniqueCategories = [...new Set(voucherCategories)];
  if (uniqueCategories.length > 1) {
    discrepancies.push({
      id: generateId(),
      type: 'category_mismatch',
      severity: 'low',
      description: `项目"${record.projectName}"凭证包含多种分类：${uniqueCategories.join('、')}`,
      recordId: record.id,
      fieldName: 'category',
      expectedValue: record.category,
      actualValue: uniqueCategories.join('、'),
      affectedResults: [
        '建议核实凭证分类准确性',
        '如为混合用途项目需在披露中说明'
      ],
      resolved: false
    });
  }

  return discrepancies;
};

const checkVoucherCompleteness = (
  record: FundUsageRecord,
  vouchers: PaymentVoucher[]
): Discrepancy[] => {
  const discrepancies: Discrepancy[] = [];
  const totalVoucherAmount = vouchers.reduce((sum, v) => sum + v.amount, 0);

  if (totalVoucherAmount < record.actualAmount * 0.95) {
    const gap = record.actualAmount - totalVoucherAmount;
    const gapPercent = ((gap / record.actualAmount) * 100).toFixed(1);
    discrepancies.push({
      id: generateId(),
      type: 'voucher_gap',
      severity: 'high',
      description: `项目"${record.projectName}"凭证金额缺口${gapPercent}%，共${formatAmount(gap)}`,
      recordId: record.id,
      fieldName: 'actualAmount',
      expectedValue: formatAmount(record.actualAmount),
      actualValue: formatAmount(totalVoucherAmount),
      affectedResults: [
        '资金支出真实性无法完全证明',
        '缺口部分无法纳入合规绿色资产',
        '审计时可能被要求调整',
        '需在15个工作日内补充缺失凭证'
      ],
      resolved: false
    });
  }

  const missingReceipts = vouchers.filter(v => !v.hasReceipt);
  if (missingReceipts.length > 0) {
    discrepancies.push({
      id: generateId(),
      type: 'voucher_gap',
      severity: 'medium',
      description: `项目"${record.projectName}"有${missingReceipts.length}张凭证缺少发票`,
      recordId: record.id,
      fieldName: 'hasReceipt',
      expectedValue: '全部有发票',
      actualValue: `${missingReceipts.length}张无发票`,
      affectedResults: [
        '增值税抵扣可能受影响',
        '支出真实性证明力减弱',
        '需要求供应商补开发票'
      ],
      resolved: false
    });
  }

  const missingApprovals = vouchers.filter(v => !v.hasApproval);
  if (missingApprovals.length > 0) {
    discrepancies.push({
      id: generateId(),
      type: 'voucher_gap',
      severity: 'high',
      description: `项目"${record.projectName}"有${missingApprovals.length}张凭证未经审批`,
      recordId: record.id,
      fieldName: 'hasApproval',
      expectedValue: '全部已审批',
      actualValue: `${missingApprovals.length}张未审批`,
      affectedResults: [
        '违反财务审批制度',
        '相关支出需暂停支付',
        '需追究相关人员责任',
        '内部控制流程需整改'
      ],
      resolved: false
    });
  }

  if (vouchers.length === 0) {
    discrepancies.push({
      id: generateId(),
      type: 'voucher_gap',
      severity: 'high',
      description: `项目"${record.projectName}"无任何付款凭证`,
      recordId: record.id,
      fieldName: 'vouchers',
      expectedValue: '有付款凭证',
      actualValue: '无付款凭证',
      affectedResults: [
        '资金支付真实性完全无法证明',
        '项目暂不能认定为绿色项目',
        '需立即核实资金去向'
      ],
      resolved: false
    });
  }

  return discrepancies;
};

const checkDisclosureVersion = (
  record: FundUsageRecord,
  prospectus?: ProspectusData
): Discrepancy[] => {
  const discrepancies: Discrepancy[] = [];
  const currentVersion = 'v1.0';

  if (record.disclosureVersion !== currentVersion) {
    const versionDiff = compareVersions(record.disclosureVersion, currentVersion);
    let severity: 'high' | 'medium' | 'low' = 'medium';
    let affectedResults: string[] = [];

    if (versionDiff < 0) {
      severity = 'high';
      affectedResults = [
        '披露数据不符合最新监管要求',
        '需按新版目录重新核对所有项目分类',
        '可能需要追溯调整历史披露数据',
        '年度绿色评估可能扣分',
        '需在1个月内完成口径更新'
      ];
    } else if (versionDiff > 0) {
      severity = 'low';
      affectedResults = [
        '披露版本高于系统当前版本',
        '建议更新系统披露标准'
      ];
    }

    discrepancies.push({
      id: generateId(),
      type: 'disclosure_version',
      severity,
      description: `项目"${record.projectName}"使用披露口径${record.disclosureVersion}，当前标准为${currentVersion}`,
      recordId: record.id,
      fieldName: 'disclosureVersion',
      expectedValue: currentVersion,
      actualValue: record.disclosureVersion,
      affectedResults,
      resolved: false
    });
  }

  if (prospectus && !prospectus.disclosureStandard) {
    discrepancies.push({
      id: generateId(),
      type: 'disclosure_version',
      severity: 'medium',
      description: `项目"${record.projectName}"募集说明书未明确披露标准`,
      recordId: record.id,
      fieldName: 'disclosureStandard',
      expectedValue: '有明确披露标准',
      actualValue: '未明确',
      affectedResults: [
        '披露依据不充分',
        '需补充披露标准说明'
      ],
      resolved: false
    });
  }

  return discrepancies;
};

const checkAmountConsistency = (
  record: FundUsageRecord,
  prospectus?: ProspectusData,
  ledger?: LedgerData,
  vouchers: PaymentVoucher[] = []
): Discrepancy[] => {
  const discrepancies: Discrepancy[] = [];
  const totalVoucherAmount = vouchers.reduce((sum, v) => sum + v.amount, 0);

  if (prospectus && Math.abs(record.plannedAmount - prospectus.issueAmount) > 0) {
    const diff = Math.abs(record.plannedAmount - prospectus.issueAmount);
    const diffPercent = ((diff / prospectus.issueAmount) * 100).toFixed(1);
    discrepancies.push({
      id: generateId(),
      type: 'amount_mismatch',
      severity: 'medium',
      description: `项目"${record.projectName}"计划金额与募集说明书差异${diffPercent}%`,
      recordId: record.id,
      fieldName: 'plannedAmount',
      expectedValue: formatAmount(prospectus.issueAmount),
      actualValue: formatAmount(record.plannedAmount),
      affectedResults: [
        '需说明金额调整原因',
        '如为项目调整需补充董事会决议',
        '需履行信息披露义务'
      ],
      resolved: false
    });
  }

  if (ledger && Math.abs(record.actualAmount - ledger.actualAmount) > 0) {
    discrepancies.push({
      id: generateId(),
      type: 'amount_mismatch',
      severity: 'high',
      description: `项目"${record.projectName}"实际金额与台账不一致`,
      recordId: record.id,
      fieldName: 'actualAmount',
      expectedValue: formatAmount(ledger.actualAmount),
      actualValue: formatAmount(record.actualAmount),
      affectedResults: [
        '数据一致性存在问题',
        '需立即核对数据源',
        '可能影响财务报表准确性'
      ],
      resolved: false
    });
  }

  if (Math.abs(totalVoucherAmount - record.actualAmount) > record.actualAmount * 0.05) {
    discrepancies.push({
      id: generateId(),
      type: 'amount_mismatch',
      severity: 'high',
      description: `项目"${record.projectName}"凭证总额与实际支出差异超过5%`,
      recordId: record.id,
      fieldName: 'actualAmount',
      expectedValue: formatAmount(record.actualAmount),
      actualValue: formatAmount(totalVoucherAmount),
      affectedResults: [
        '资金去向存疑',
        '需逐笔核对付款记录',
        '可能存在账外支出'
      ],
      resolved: false
    });
  }

  return discrepancies;
};

const checkDateConsistency = (
  record: FundUsageRecord,
  prospectus?: ProspectusData,
  ledger?: LedgerData,
  vouchers: PaymentVoucher[] = []
): Discrepancy[] => {
  const discrepancies: Discrepancy[] = [];

  if (prospectus && record.paymentDate && prospectus.expectedDate) {
    const paymentDate = new Date(record.paymentDate);
    const expectedDate = new Date(prospectus.expectedDate);
    
    if (paymentDate > expectedDate) {
      const daysLate = Math.ceil((paymentDate.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24));
      discrepancies.push({
        id: generateId(),
        type: 'date_mismatch',
        severity: 'low',
        description: `项目"${record.projectName}"实际支付晚于预计日期${daysLate}天`,
        recordId: record.id,
        fieldName: 'paymentDate',
        expectedValue: prospectus.expectedDate,
        actualValue: record.paymentDate,
        affectedResults: [
          '项目进度滞后',
          '需评估对整体进度的影响',
          '需在披露中说明延期原因'
        ],
        resolved: false
      });
    }
  }

  if (vouchers.length > 0) {
    const dates = vouchers.map(v => new Date(v.paymentDate).getTime());
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    
    if (ledger?.plannedDate) {
      const plannedDate = new Date(ledger.plannedDate);
      if (maxDate > plannedDate) {
        const daysLate = Math.ceil((maxDate.getTime() - plannedDate.getTime()) / (1000 * 60 * 60 * 24));
        discrepancies.push({
          id: generateId(),
          type: 'date_mismatch',
          severity: 'medium',
          description: `项目"${record.projectName}"最后一笔付款晚于台账计划日期${daysLate}天`,
          recordId: record.id,
          fieldName: 'plannedDate',
          expectedValue: ledger.plannedDate,
          actualValue: formatDate(maxDate),
          affectedResults: [
            '项目进度滞后于台账计划',
            '需更新台账进度',
            '需评估对后续付款的影响'
          ],
          resolved: false
        });
      }
    }
  }

  return discrepancies;
};

const compareVersions = (v1: string, v2: string): number => {
  const parts1 = v1.replace(/^v/, '').split('.').map(Number);
  const parts2 = v2.replace(/^v/, '').split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 !== p2) return p1 - p2;
  }
  return 0;
};

const formatAmount = (amount: number): string => {
  if (amount >= 100000000) {
    return (amount / 100000000).toFixed(2) + '亿元';
  } else if (amount >= 10000) {
    return (amount / 10000).toFixed(2) + '万元';
  }
  return amount.toLocaleString() + '元';
};

const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const getDiscrepanciesByRecord = (
  discrepancies: Discrepancy[],
  recordId: string
): Discrepancy[] => {
  return discrepancies.filter(d => d.recordId === recordId && !d.resolved);
};

export const getDiscrepanciesByType = (
  discrepancies: Discrepancy[],
  type: DiscrepancyType
): Discrepancy[] => {
  return discrepancies.filter(d => d.type === type && !d.resolved);
};

export const getUnresolvedDiscrepancies = (
  discrepancies: Discrepancy[]
): Discrepancy[] => {
  return discrepancies.filter(d => !d.resolved);
};

export const resolveDiscrepancy = (
  discrepancy: Discrepancy,
  resolution: string,
  operator: string
): Discrepancy => {
  return {
    ...discrepancy,
    resolved: true,
    resolution: `${resolution}（处理人：${operator}，时间：${new Date().toLocaleString()}）`
  };
};
