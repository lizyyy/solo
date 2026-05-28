import {
  BusinessObject,
  Issue,
  IssueSeverity,
  IssueType,
  PurposeCodeRule,
} from '@/types';
import { PURPOSE_CODE_RULES } from '@/constants/purposeCodes';

export interface ValidationResult {
  issues: Issue[];
  passed: boolean;
  riskLevel: 'normal' | 'warning' | 'danger';
}

export interface MatchResult {
  matched: boolean;
  expectedCode?: string;
  expectedName?: string;
  matchedKeywords: string[];
  suggestion: string;
}

export const validatePurposeCode = (
  purposeCode: string,
  contractDesc: string,
  invoiceDesc: string,
  applicationDesc: string
): MatchResult => {
  const rule = PURPOSE_CODE_RULES.find((r) => r.code === purposeCode);

  if (!rule) {
    return {
      matched: false,
      matchedKeywords: [],
      suggestion: '用途代码不存在，请选择正确的用途代码',
    };
  }

  const allText = `${contractDesc} ${invoiceDesc} ${applicationDesc}`;

  const matchedKeywords = rule.keywords.filter((kw) =>
    allText.includes(kw)
  );

  if (matchedKeywords.length > 0) {
    return {
      matched: true,
      expectedCode: rule.code,
      expectedName: rule.name,
      matchedKeywords,
      suggestion: `用途代码与材料描述匹配，匹配关键词：${matchedKeywords.join('、')}`,
    };
  }

  let suggestedRule: PurposeCodeRule | undefined;
  let maxMatches = 0;

  for (const r of PURPOSE_CODE_RULES) {
    if (r.code === purposeCode) continue;
    const matches = r.keywords.filter((kw) => allText.includes(kw));
    if (matches.length > maxMatches) {
      maxMatches = matches.length;
      suggestedRule = r;
    }
  }

  if (suggestedRule && maxMatches > 0) {
    return {
      matched: false,
      expectedCode: suggestedRule.code,
      expectedName: suggestedRule.name,
      matchedKeywords: [],
      suggestion: `当前用途代码【${rule.name}】与材料描述不匹配，建议修改为【${suggestedRule.name}】，材料中包含关键词：${suggestedRule.keywords
        .filter((kw) => allText.includes(kw))
        .join('、')}`,
    };
  }

  return {
    matched: false,
    matchedKeywords: [],
    suggestion: `当前用途代码【${rule.name}】与材料描述不匹配，请核对材料内容`,
  };
};

export const validateSupplementCovers = (
  business: BusinessObject): Issue[] => {
    const issues: Issue[] = [];

    business.supplementRecords.forEach((record) => {
      if (record.coversOriginal) {
        const original =
          record.supplementType === 'contract'
            ? business.contracts.find((c) => c.id === record.originalDocumentId)
            : business.invoices.find((i) => i.id === record.originalDocumentId);

        const latest =
          record.supplementType === 'contract'
            ? business.contracts.find((c) => c.id === record.newDocumentId)
            : business.invoices.find((i) => i.id === record.newDocumentId);

        if (original && latest) {
          let severity: IssueSeverity = 'medium';
          let description = `补件覆盖了原件`;

          if (original.amount !== latest.amount) {
            severity = 'high';
            description += `，金额由 ${original.amount.toLocaleString()} ${original.currency} 变更为 ${latest.amount.toLocaleString()} ${latest.currency}`;
          } else {
            description += `，${record.supplementType === 'contract' ? '合同' : '发票'}号：${'contractNo' in original ? original.contractNo : original.invoiceNo}`;
          }

          issues.push({
            id: `issue-supplement-${record.id}`,
            businessNo: business.businessNo,
            type: 'supplement_covers',
            severity,
            description,
            detectedBy: 'system',
            detectedAt: new Date().toISOString(),
            status: 'open',
            resolution: null,
            resolvedAt: null,
            resolver: null,
            relatedDocumentId: record.newDocumentId,
          });
        }
      }
    });

    return issues;
  };

export const validateDuplicateRemittance = (
  currentBusiness: BusinessObject,
  allBusiness: BusinessObject[]
): Issue[] => {
  const issues: Issue[] = [];
  const currentContracts = currentBusiness.contracts.filter(
    (c) => !c.isSupplement || c.version === currentBusiness.currentVersion
  );
  const currentInvoices = currentBusiness.invoices.filter(
    (i) => !i.isSupplement || i.version === currentBusiness.currentVersion
  );

  for (const other of allBusiness) {
    if (other.id === currentBusiness.id) continue;

    let duplicateReasons: string[] = [];
    let totalAmount = currentBusiness.amount;

    for (const cc of currentContracts) {
      for (const oc of other.contracts) {
        if (cc.contractNo === oc.contractNo) {
          totalAmount += other.amount;
          if (totalAmount > cc.amount) {
            duplicateReasons.push(
              `与业务【${other.businessNo}】使用同一合同号【${cc.contractNo}】，两笔金额合计 ${totalAmount.toLocaleString()} ${currentBusiness.currency}，超过合同金额 ${cc.amount.toLocaleString()} ${cc.currency}`
            );
          } else {
            duplicateReasons.push(
              `与业务【${other.businessNo}】使用同一合同号【${cc.contractNo}】`
            );
          }
        }
      }
    }

    for (const ci of currentInvoices) {
      for (const oi of other.invoices) {
        if (ci.invoiceNo === oi.invoiceNo) {
          duplicateReasons.push(
            `与业务【${other.businessNo}】使用同一发票号【${ci.invoiceNo}】`
          );
        }
      }
    }

    const amountDiff = Math.abs(currentBusiness.amount - other.amount) / other.amount;
    if (
      currentBusiness.purposeCode === other.purposeCode &&
      currentBusiness.customerId === other.customerId &&
      amountDiff < 0.1 &&
      other.status !== 'rejected'
    ) {
      duplicateReasons.push(
        `与业务【${other.businessNo}】用途代码相同、收款人相同、金额差异小于10%，疑似重复提交`
      );
    }

    if (duplicateReasons.length > 0) {
      issues.push({
        id: `issue-duplicate-${other.id}`,
        businessNo: currentBusiness.businessNo,
        type: 'duplicate_remittance',
        severity: 'high',
        description: duplicateReasons.join('；'),
        detectedBy: 'system',
        detectedAt: new Date().toISOString(),
        status: 'open',
        resolution: null,
        resolvedAt: null,
        resolver: null,
      });

      if (!currentBusiness.duplicateWith) {
        currentBusiness.duplicateWith = [];
      }
      if (!currentBusiness.duplicateWith.includes(other.id)) {
        currentBusiness.duplicateWith.push(other.id);
      }
    }
  }

  return issues;
};

export const validateAmountConsistency = (
  business: BusinessObject
): Issue[] => {
  const issues: Issue[] = [];
  const app = business.applications[business.applications.length - 1];
  const latestContract = business.contracts[business.contracts.length - 1];
  const latestInvoice = business.invoices[business.invoices.length - 1];

  if (app && latestContract) {
    if (app.amount > latestContract.amount) {
      issues.push({
        id: `issue-amount-contract-${business.id}`,
        businessNo: business.businessNo,
        type: 'amount_mismatch',
        severity: 'high',
        description: `汇款金额 ${app.amount.toLocaleString()} ${app.currency} 超过合同金额 ${latestContract.amount.toLocaleString()} ${latestContract.currency}`,
        detectedBy: 'system',
        detectedAt: new Date().toISOString(),
        status: 'open',
        resolution: null,
        resolvedAt: null,
        resolver: null,
        relatedDocumentId: latestContract.id,
      });
    } else if (app.amount < latestContract.amount * 0.5) {
      issues.push({
        id: `issue-amount-contract-low-${business.id}`,
        businessNo: business.businessNo,
        type: 'amount_mismatch',
        severity: 'low',
        description: `汇款金额 ${app.amount.toLocaleString()} ${app.currency} 显著低于合同金额 ${latestContract.amount.toLocaleString()} ${latestContract.currency}`,
        detectedBy: 'system',
        detectedAt: new Date().toISOString(),
        status: 'open',
        resolution: null,
        resolvedAt: null,
        resolver: null,
        relatedDocumentId: latestContract.id,
      });
    }
  }

  if (app && latestInvoice) {
    if (Math.abs(app.amount - latestInvoice.amount) > latestInvoice.amount * 0.01) {
      issues.push({
        id: `issue-amount-invoice-${business.id}`,
        businessNo: business.businessNo,
        type: 'amount_mismatch',
        severity: 'medium',
        description: `汇款金额与发票金额差异超过1%，汇款：${app.amount.toLocaleString()} ${app.currency}，发票：${latestInvoice.amount.toLocaleString()} ${latestInvoice.currency}`,
        detectedBy: 'system',
        detectedAt: new Date().toISOString(),
        status: 'open',
        resolution: null,
        resolvedAt: null,
        resolver: null,
        relatedDocumentId: latestInvoice.id,
      });
    }
  }

  return issues;
};

export const validateDocumentDates = (business: BusinessObject): Issue[] => {
  const issues: Issue[] = [];
  const app = business.applications[business.applications.length - 1];

  if (!app) return issues;

  const appDate = new Date(app.submitTime);

  for (const contract of business.contracts) {
    const contractDate = new Date(contract.contractDate);
    if (contractDate > appDate) {
      issues.push({
        id: `issue-date-contract-${contract.id}`,
        businessNo: business.businessNo,
        type: 'date_invalid',
        severity: 'high',
        description: `合同日期【${contract.contractDate}】晚于汇款申请日期【${app.submitTime}】`,
        detectedBy: 'system',
        detectedAt: new Date().toISOString(),
        status: 'open',
        resolution: null,
        resolvedAt: null,
        resolver: null,
        relatedDocumentId: contract.id,
      });
    }
  }

  for (const invoice of business.invoices) {
    const invoiceDate = new Date(invoice.invoiceDate);
    if (invoiceDate > appDate) {
      issues.push({
        id: `issue-date-invoice-${invoice.id}`,
        businessNo: business.businessNo,
        type: 'date_invalid',
        severity: 'high',
        description: `发票日期【${invoice.invoiceDate}】晚于汇款申请日期【${app.submitTime}】`,
        detectedBy: 'system',
        detectedAt: new Date().toISOString(),
        status: 'open',
        resolution: null,
        resolvedAt: null,
        resolver: null,
        relatedDocumentId: invoice.id,
      });
    }
  }

  return issues;
};

export const validateDocumentCompleteness = (business: BusinessObject): Issue[] => {
  const issues: Issue[] = [];

  if (business.contracts.length === 0) {
    issues.push({
      id: `issue-missing-contract-${business.id}`,
      businessNo: business.businessNo,
      type: 'document_missing',
      severity: 'high',
      description: '缺少合同材料',
      detectedBy: 'system',
      detectedAt: new Date().toISOString(),
      status: 'open',
      resolution: null,
      resolvedAt: null,
      resolver: null,
    });
  }

  if (business.invoices.length === 0) {
    issues.push({
      id: `issue-missing-invoice-${business.id}`,
      businessNo: business.businessNo,
      type: 'document_missing',
      severity: 'high',
      description: '缺少发票材料',
      detectedBy: 'system',
      detectedAt: new Date().toISOString(),
      status: 'open',
      resolution: null,
      resolvedAt: null,
      resolver: null,
    });
  }

  return issues;
};

export const runFullValidation = (
  business: BusinessObject,
  allBusiness: BusinessObject[]
): ValidationResult => {
  const allIssues: Issue[] = [];

  const app = business.applications[business.applications.length - 1];
  const contract = business.contracts[business.contracts.length - 1];
  const invoice = business.invoices[business.invoices.length - 1];

  if (app && contract && invoice) {
    const purposeResult = validatePurposeCode(
      business.purposeCode,
      contract.goodsDescription,
      invoice.goodsDescription,
      app.purposeDescription
    );

    if (!purposeResult.matched) {
      allIssues.push({
        id: `issue-purpose-${business.id}`,
        businessNo: business.businessNo,
        type: 'purpose_mismatch',
        severity: 'high',
        description: `用途代码不匹配：${purposeResult.suggestion}`,
        detectedBy: 'system',
        detectedAt: new Date().toISOString(),
        status: 'open',
        resolution: null,
        resolvedAt: null,
        resolver: null,
      });
    }
  }

  allIssues.push(...validateSupplementCovers(business));
  allIssues.push(...validateDuplicateRemittance(business, allBusiness));
  allIssues.push(...validateAmountConsistency(business));
  allIssues.push(...validateDocumentDates(business));
  allIssues.push(...validateDocumentCompleteness(business));

  const openIssues = allIssues.filter((i) => i.status === 'open');
  const highCount = openIssues.filter((i) => i.severity === 'high').length;
  const mediumCount = openIssues.filter((i) => i.severity === 'medium').length;

  let riskLevel: 'normal' | 'warning' | 'danger' = 'normal';
  if (highCount > 0) riskLevel = 'danger';
  else if (mediumCount > 0) riskLevel = 'warning';

  return {
    issues: allIssues,
    passed: openIssues.length === 0,
    riskLevel,
  };
};

export const calculateRiskLevel = (issues: Issue[]): 'normal' | 'warning' | 'danger' => {
  const openIssues = issues.filter((i) => i.status === 'open');
  const highCount = openIssues.filter((i) => i.severity === 'high').length;
  const mediumCount = openIssues.filter((i) => i.severity === 'medium').length;

  if (highCount > 0) return 'danger';
  if (mediumCount > 0) return 'warning';
  return 'normal';
};
