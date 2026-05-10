const test = require('node:test');
const assert = require('node:assert/strict');
const ContractVersionService = require('../src/services/ContractVersionService');
const TaxRuleService = require('../src/services/TaxRuleService');
const ApprovalService = require('../src/services/ApprovalService');
const HistoricalRecalculationService = require('../src/services/HistoricalRecalculationService');
const FinancialExportService = require('../src/services/FinancialExportService');
const store = require('../src/stores/MemoryStore');

test.beforeEach(() => {
  store.clearAll();
  TaxRuleService.initializeDefaultRules();
});

test('ApprovalService - 创建审批请求', (t) => {
  const { contract, version } = ContractVersionService.createContract(
    {
      contractNo: 'HT-2024-APR-001',
      title: '审批测试合同',
      industry: 'GENERAL',
      createdBy: '张三'
    },
    {
      totalAmount: 113000,
      priceType: 'WITH_TAX',
      taxRuleCode: 'VAT_13',
      createdBy: '张三'
    }
  );

  const request = ApprovalService.createApprovalRequest({
    contractId: contract.id,
    contractVersionId: version.id,
    requestedBy: '张三',
    changeSummary: '新建合同审批'
  });

  assert.ok(request.id);
  assert.equal(request.contractId, contract.id);
  assert.equal(request.contractVersionId, version.id);
  assert.equal(request.requestedBy, '张三');
  assert.equal(request.status, 'PENDING');
  assert.equal(request.approvalType, 'NEW_CONTRACT');
});

test('ApprovalService - 审批通过', (t) => {
  const { contract, version } = ContractVersionService.createContract(
    {
      contractNo: 'HT-2024-APR-002',
      title: '审批测试合同',
      industry: 'GENERAL',
      createdBy: '张三'
    },
    {
      totalAmount: 113000,
      priceType: 'WITH_TAX',
      taxRuleCode: 'VAT_13',
      createdBy: '张三'
    }
  );

  const request = ApprovalService.createApprovalRequest({
    contractId: contract.id,
    contractVersionId: version.id,
    requestedBy: '张三'
  });

  const result = ApprovalService.approveApprovalRequest(
    request.id,
    '李四',
    ['同意，数据核对无误']
  );

  assert.equal(result.request.status, 'APPROVED');
  assert.equal(result.request.approvedBy, '李四');
  assert.ok(result.request.approvedAt);
  assert.equal(result.result.businessSummary.message, '审批通过，版本已生效');
  
  const updatedVersion = ContractVersionService.getVersionById(version.id);
  assert.equal(updatedVersion.status, 'ACTIVE');
});

test('ApprovalService - 审批驳回', (t) => {
  const { contract, version } = ContractVersionService.createContract(
    {
      contractNo: 'HT-2024-APR-003',
      title: '审批测试合同',
      industry: 'GENERAL',
      createdBy: '张三'
    },
    {
      totalAmount: 113000,
      priceType: 'WITH_TAX',
      taxRuleCode: 'VAT_13',
      createdBy: '张三'
    }
  );

  const request = ApprovalService.createApprovalRequest({
    contractId: contract.id,
    contractVersionId: version.id,
    requestedBy: '张三'
  });

  const result = ApprovalService.rejectApprovalRequest(
    request.id,
    '李四',
    '合同金额有误，请重新核对'
  );

  assert.equal(result.request.status, 'REJECTED');
  assert.equal(result.request.approvedBy, '李四');
  assert.equal(result.request.rejectionReason, '合同金额有误，请重新核对');
  assert.equal(result.result.businessSummary.message, '审批已驳回，请根据驳回理由修改后重新提交');
  
  const updatedVersion = ContractVersionService.getVersionById(version.id);
  assert.equal(updatedVersion.status, 'REJECTED');
});

test('ApprovalService - 重复审批检测', (t) => {
  const { contract, version } = ContractVersionService.createContract(
    {
      contractNo: 'HT-2024-APR-004',
      title: '审批测试合同',
      industry: 'GENERAL',
      createdBy: '张三'
    },
    {
      totalAmount: 113000,
      priceType: 'WITH_TAX',
      taxRuleCode: 'VAT_13',
      createdBy: '张三'
    }
  );

  ApprovalService.createApprovalRequest({
    contractId: contract.id,
    contractVersionId: version.id,
    requestedBy: '张三'
  });

  assert.throws(() => {
    ApprovalService.createApprovalRequest({
      contractId: contract.id,
      contractVersionId: version.id,
      requestedBy: '王五'
    });
  }, /已有待审批的请求/);
});

test('ApprovalService - 缺少驳回理由检测', (t) => {
  const { contract, version } = ContractVersionService.createContract(
    {
      contractNo: 'HT-2024-APR-005',
      title: '审批测试合同',
      industry: 'GENERAL',
      createdBy: '张三'
    },
    {
      totalAmount: 113000,
      priceType: 'WITH_TAX',
      taxRuleCode: 'VAT_13',
      createdBy: '张三'
    }
  );

  const request = ApprovalService.createApprovalRequest({
    contractId: contract.id,
    contractVersionId: version.id,
    requestedBy: '张三'
  });

  assert.throws(() => {
    ApprovalService.rejectApprovalRequest(
      request.id,
      '李四',
      ''
    );
  }, /驳回理由/);
});

test('HistoricalRecalculationService - 按新税率重算', (t) => {
  const { contract } = ContractVersionService.createContract(
    {
      contractNo: 'HT-2024-REC-001',
      title: '历史重算测试合同',
      industry: 'GENERAL',
      createdBy: '张三'
    },
    {
      totalAmount: 113000,
      priceType: 'WITH_TAX',
      taxRuleCode: 'VAT_13',
      createdBy: '张三'
    }
  );

  const rule9 = TaxRuleService.getRuleByCode('VAT_9');
  const result = HistoricalRecalculationService.recalculateWithNewTaxRule(
    contract.id,
    rule9.id,
    { createdBy: '李四' }
  );

  assert.equal(result.comparison.originalVersion.taxRate, 0.13);
  assert.equal(result.comparison.newCalculation.taxRate, 0.09);
  assert.ok(result.comparison.businessImpact.taxRateChange.includes('13.00%'));
  assert.ok(result.comparison.businessImpact.taxRateChange.includes('9.00%'));
  
  assert.ok(result.newVersion);
  assert.equal(result.newVersion.versionNo, 2);
  assert.equal(result.newVersion.taxRate, 0.09);
});

test('HistoricalRecalculationService - 按新金额重算', (t) => {
  const { contract } = ContractVersionService.createContract(
    {
      contractNo: 'HT-2024-REC-002',
      title: '历史重算测试合同',
      industry: 'GENERAL',
      createdBy: '张三'
    },
    {
      totalAmount: 113000,
      priceType: 'WITH_TAX',
      taxRuleCode: 'VAT_13',
      createdBy: '张三'
    }
  );

  const result = HistoricalRecalculationService.recalculateWithNewAmount(
    contract.id,
    226000,
    'WITH_TAX',
    { createdBy: '李四' }
  );

  assert.equal(result.comparison.originalVersion.amountWithTax, 113000);
  assert.equal(result.comparison.newCalculation.amountWithTax, 226000);
  assert.equal(result.comparison.differences.amountWithTax, 113000);
  
  assert.ok(result.newVersion);
  assert.equal(result.newVersion.versionNo, 2);
  assert.equal(result.newVersion.amountWithTax, 226000);
  assert.equal(result.newVersion.amountWithoutTax, 200000);
  assert.equal(result.newVersion.taxAmount, 26000);
});

test('HistoricalRecalculationService - 重算预览（不创建新版本）', (t) => {
  const { contract } = ContractVersionService.createContract(
    {
      contractNo: 'HT-2024-REC-003',
      title: '历史重算测试合同',
      industry: 'GENERAL',
      createdBy: '张三'
    },
    {
      totalAmount: 113000,
      priceType: 'WITH_TAX',
      taxRuleCode: 'VAT_13',
      createdBy: '张三'
    }
  );

  const result = HistoricalRecalculationService.recalculateWithNewTaxRule(
    contract.id,
    TaxRuleService.getRuleByCode('VAT_9').id,
    { createVersion: false }
  );

  assert.ok(result.comparison);
  assert.equal(result.newVersion, undefined);
  
  const versions = ContractVersionService.getAllVersions(contract.id);
  assert.equal(versions.length, 1);
});

test('HistoricalRecalculationService - 多方案预览', (t) => {
  const { contract } = ContractVersionService.createContract(
    {
      contractNo: 'HT-2024-REC-004',
      title: '多方案预览测试合同',
      industry: 'GENERAL',
      createdBy: '张三'
    },
    {
      totalAmount: 113000,
      priceType: 'WITH_TAX',
      taxRuleCode: 'VAT_13',
      createdBy: '张三'
    }
  );

  const rule9 = TaxRuleService.getRuleByCode('VAT_9');
  const rule6 = TaxRuleService.getRuleByCode('VAT_6');

  const result = HistoricalRecalculationService.previewRecalculation(
    contract.id,
    {
      taxRuleIds: [rule9.id, rule6.id],
      amounts: [
        { amount: 226000, priceType: 'WITH_TAX' },
        { amount: 339000, priceType: 'WITH_TAX' }
      ]
    }
  );

  assert.equal(result.previews.length, 4);
  assert.equal(result.previews.filter(p => p.type === 'TAX_RULE_CHANGE').length, 2);
  assert.equal(result.previews.filter(p => p.type === 'AMOUNT_CHANGE').length, 2);
  assert.ok(result.businessAdvice.includes('共生成 4 个重算方案'));
});

test('HistoricalRecalculationService - 版本一致性验证', (t) => {
  const { contract } = ContractVersionService.createContract(
    {
      contractNo: 'HT-2024-REC-005',
      title: '验证测试合同',
      industry: 'GENERAL',
      createdBy: '张三'
    },
    {
      totalAmount: 113000,
      priceType: 'WITH_TAX',
      taxRuleCode: 'VAT_13',
      createdBy: '张三'
    }
  );

  ContractVersionService.updateContractAmount(
    contract.id,
    226000,
    'WITH_TAX',
    { createdBy: '李四' }
  );

  const result = HistoricalRecalculationService.verifyAllVersions(contract.id);

  assert.equal(result.totalVersions, 2);
  assert.equal(result.allConsistent, true);
  assert.equal(result.inconsistentCount, 0);
  assert.ok(result.summary.status.includes('所有版本计算一致'));
});

test('FinancialExportService - 财务导出', (t) => {
  const { contract, version } = ContractVersionService.createContract(
    {
      contractNo: 'HT-2024-EXP-001',
      title: '财务导出测试合同',
      partyA: '测试甲方公司',
      partyB: '测试乙方公司',
      signDate: '2024-01-01',
      effectiveDate: '2024-01-01',
      industry: 'GENERAL',
      createdBy: '张三'
    },
    {
      totalAmount: 226000,
      priceType: 'WITH_TAX',
      taxRuleCode: 'VAT_13',
      createdBy: '张三'
    }
  );

  const exportData = FinancialExportService.exportContractForFinance(contract.id);

  assert.equal(exportData.exportType, 'FINANCE_EXPORT');
  assert.equal(exportData.businessContext.contractNo, 'HT-2024-EXP-001');
  assert.equal(exportData.businessContext.partyA, '测试甲方公司');
  assert.equal(exportData.taxRuleInfo.taxRatePercentage, '13.00%');
  
  assert.equal(exportData.financialBreakdown.amounts.amountWithTax, 226000);
  assert.equal(exportData.financialBreakdown.amounts.amountWithoutTax, 200000);
  assert.equal(exportData.financialBreakdown.amounts.taxAmount, 26000);
  
  assert.equal(exportData.financialBreakdown.verification.status, '计算正确');
});

test('FinancialExportService - 版本历史导出', (t) => {
  const { contract } = ContractVersionService.createContract(
    {
      contractNo: 'HT-2024-EXP-002',
      title: '版本历史测试合同',
      industry: 'GENERAL',
      createdBy: '张三'
    },
    {
      totalAmount: 113000,
      priceType: 'WITH_TAX',
      taxRuleCode: 'VAT_13',
      createdBy: '张三'
    }
  );

  ContractVersionService.updateContractAmount(
    contract.id,
    226000,
    'WITH_TAX',
    { createdBy: '李四' }
  );

  const exportData = FinancialExportService.exportVersionHistory(contract.id);

  assert.equal(exportData.exportType, 'VERSION_HISTORY');
  assert.equal(exportData.totalVersions, 2);
  assert.equal(exportData.versions.length, 2);
  assert.equal(exportData.versions[0].versionNo, 1);
  assert.equal(exportData.versions[1].versionNo, 2);
  assert.equal(exportData.versions[0].amounts.amountWithTax, 113000);
  assert.equal(exportData.versions[1].amounts.amountWithTax, 226000);
});

test('FinancialExportService - 文本格式报告', (t) => {
  const { contract, version } = ContractVersionService.createContract(
    {
      contractNo: 'HT-2024-EXP-003',
      title: '文本报告测试合同',
      partyA: '甲方公司',
      partyB: '乙方公司',
      industry: 'GENERAL',
      createdBy: '张三'
    },
    {
      totalAmount: 113000,
      priceType: 'WITH_TAX',
      taxRuleCode: 'VAT_13',
      createdBy: '张三'
    }
  );

  const exportData = FinancialExportService.exportContractForFinance(contract.id);
  const textReport = FinancialExportService.formatAsTextReport(exportData);

  assert.ok(textReport.includes('合同财务导出报告'));
  assert.ok(textReport.includes('HT-2024-EXP-003'));
  assert.ok(textReport.includes('13.00%'));
  assert.ok(textReport.includes('¥113,000.00'));
  assert.ok(textReport.includes('¥100,000.00'));
  assert.ok(textReport.includes('¥13,000.00'));
  assert.ok(textReport.includes('计算正确'));
});
