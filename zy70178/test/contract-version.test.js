const test = require('node:test');
const assert = require('node:assert/strict');
const ContractVersionService = require('../src/services/ContractVersionService');
const TaxRuleService = require('../src/services/TaxRuleService');
const store = require('../src/stores/MemoryStore');

test.beforeEach(() => {
  store.clearAll();
  TaxRuleService.initializeDefaultRules();
});

test('ContractVersionService - 创建合同和版本', (t) => {
  const result = ContractVersionService.createContract(
    {
      contractNo: 'HT-2024-001',
      title: '销售合同-测试',
      partyA: '甲方公司',
      partyB: '乙方公司',
      signDate: '2024-01-01',
      effectiveDate: '2024-01-01',
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

  assert.ok(result.contract.id);
  assert.equal(result.contract.contractNo, 'HT-2024-001');
  assert.equal(result.contract.title, '销售合同-测试');
  
  assert.ok(result.version.id);
  assert.equal(result.version.versionNo, 1);
  assert.equal(result.version.amountWithTax, 113000);
  assert.equal(result.version.amountWithoutTax, 100000);
  assert.equal(result.version.taxAmount, 13000);
  assert.equal(result.version.taxRate, 0.13);
});

test('ContractVersionService - 金额变更测试', (t) => {
  const { contract } = ContractVersionService.createContract(
    {
      contractNo: 'HT-2024-002',
      title: '测试合同',
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

  const result = ContractVersionService.updateContractAmount(
    contract.id,
    226000,
    'WITH_TAX',
    {
      versionDescription: '合同金额翻倍',
      createdBy: '李四'
    }
  );

  assert.equal(result.oldVersion.versionNo, 1);
  assert.equal(result.newVersion.versionNo, 2);
  assert.equal(result.newVersion.amountWithTax, 226000);
  assert.equal(result.newVersion.amountWithoutTax, 200000);
  assert.equal(result.newVersion.taxAmount, 26000);
  
  assert.equal(result.comparison.changes.amountWithTax.difference, 113000);
  assert.equal(result.comparison.changes.amountWithoutTax.difference, 100000);
  assert.equal(result.comparison.changes.taxAmount.difference, 13000);
  
  assert.ok(result.comparison.businessSummary.impact.includes('增加'));
});

test('ContractVersionService - 税率变更测试', (t) => {
  const { contract } = ContractVersionService.createContract(
    {
      contractNo: 'HT-2024-003',
      title: '测试合同',
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

  const newRule = TaxRuleService.getRuleByCode('VAT_9');
  
  const result = ContractVersionService.updateContractTaxRate(
    contract.id,
    newRule.id,
    {
      createdBy: '李四'
    }
  );

  assert.equal(result.oldVersion.taxRate, 0.13);
  assert.equal(result.newVersion.taxRate, 0.09);
  assert.equal(result.comparison.changes.taxRate.isChanged, true);
  assert.equal(result.comparison.changes.taxRate.oldPercentage, '13.00%');
  assert.equal(result.comparison.changes.taxRate.newPercentage, '9.00%');
});

test('ContractVersionService - 不含税价输入测试', (t) => {
  const result = ContractVersionService.createContract(
    {
      contractNo: 'HT-2024-004',
      title: '测试合同',
      industry: 'GENERAL',
      createdBy: '张三'
    },
    {
      totalAmount: 100000,
      priceType: 'WITHOUT_TAX',
      taxRuleCode: 'VAT_13',
      createdBy: '张三'
    }
  );

  assert.equal(result.version.totalAmount, 100000);
  assert.equal(result.version.priceType, 'WITHOUT_TAX');
  assert.equal(result.version.amountWithTax, 113000);
  assert.equal(result.version.amountWithoutTax, 100000);
  assert.equal(result.version.taxAmount, 13000);
});

test('ContractVersionService - 自动匹配行业税率', (t) => {
  const result = ContractVersionService.createContract(
    {
      contractNo: 'HT-2024-005',
      title: '服务合同',
      industry: 'SERVICE',
      createdBy: '张三'
    },
    {
      totalAmount: 106000,
      priceType: 'WITH_TAX',
      createdBy: '张三'
    }
  );

  assert.equal(result.version.taxRuleCode, 'VAT_6');
  assert.equal(result.version.taxRate, 0.06);
  assert.equal(result.version.amountWithTax, 106000);
  assert.equal(result.version.amountWithoutTax, 100000);
  assert.equal(result.version.taxAmount, 6000);
});

test('ContractVersionService - 带明细项的合同', (t) => {
  const items = [
    { description: '商品A', amount: 56500, priceType: 'WITH_TAX' },
    { description: '商品B', amount: 56500, priceType: 'WITH_TAX' }
  ];

  const result = ContractVersionService.createContract(
    {
      contractNo: 'HT-2024-006',
      title: '销售合同',
      industry: 'GENERAL',
      createdBy: '张三'
    },
    {
      totalAmount: 113000,
      priceType: 'WITH_TAX',
      taxRuleCode: 'VAT_13',
      items: items,
      createdBy: '张三'
    }
  );

  assert.equal(result.version.items.length, 2);
  assert.equal(result.version.items[0].amountWithTax, 56500);
  assert.equal(result.version.items[0].amountWithoutTax, 50000);
  assert.equal(result.version.items[0].taxAmount, 6500);
  
  assert.equal(result.version.items[1].amountWithTax, 56500);
  assert.equal(result.version.items[1].amountWithoutTax, 50000);
  assert.equal(result.version.items[1].taxAmount, 6500);
});

test('ContractVersionService - 生成业务报告', (t) => {
  const { contract, version } = ContractVersionService.createContract(
    {
      contractNo: 'HT-2024-007',
      title: '销售合同-正式',
      partyA: '北京科技有限公司',
      partyB: '上海贸易有限公司',
      signDate: '2024-01-15',
      effectiveDate: '2024-01-15',
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

  const report = ContractVersionService.generateBusinessReport(contract, version);

  assert.equal(report.businessSummary.contractNo, 'HT-2024-007');
  assert.equal(report.businessSummary.taxRate, '13.00%');
  
  assert.equal(report.amounts.amountWithTax, 226000);
  assert.equal(report.amounts.amountWithoutTax, 200000);
  assert.equal(report.amounts.taxAmount, 26000);
  
  assert.equal(report.contractInfo.partyA, '北京科技有限公司');
  assert.equal(report.contractInfo.partyB, '上海贸易有限公司');
  
  assert.equal(report.verification.status, '计算正确');
  assert.ok(report.breakdown.description.includes('¥226,000.00'));
});

test('ContractVersionService - 合同编号重复检测', (t) => {
  ContractVersionService.createContract(
    {
      contractNo: 'HT-2024-008',
      title: '测试合同1',
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

  assert.throws(() => {
    ContractVersionService.createContract(
      {
        contractNo: 'HT-2024-008',
        title: '测试合同2',
        industry: 'GENERAL',
        createdBy: '李四'
      },
      {
        totalAmount: 226000,
        priceType: 'WITH_TAX',
        taxRuleCode: 'VAT_13',
        createdBy: '李四'
      }
    );
  }, /已存在/);
});

test('ContractVersionService - 缺少必要字段检测', (t) => {
  assert.throws(() => {
    ContractVersionService.createContract(
      {
        title: '测试合同',
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
  }, /缺少必要字段/);
});

test('ContractVersionService - 版本历史查询', (t) => {
  const { contract } = ContractVersionService.createContract(
    {
      contractNo: 'HT-2024-009',
      title: '测试合同',
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

  ContractVersionService.updateContractAmount(
    contract.id,
    339000,
    'WITH_TAX',
    { createdBy: '王五' }
  );

  const versions = ContractVersionService.getAllVersions(contract.id);
  assert.equal(versions.length, 3);
  assert.equal(versions[0].versionNo, 1);
  assert.equal(versions[1].versionNo, 2);
  assert.equal(versions[2].versionNo, 3);

  const latest = ContractVersionService.getLatestVersion(contract.id);
  assert.equal(latest.versionNo, 3);
  assert.equal(latest.amountWithTax, 339000);
});
