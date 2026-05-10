const test = require('node:test');
const assert = require('node:assert/strict');
const TaxSeparationService = require('../src/services/TaxSeparationService');

test('TaxSeparationService - 从含税价计算', (t) => {
  const result = TaxSeparationService.calculateFromIncludingTax(11300, 0.13);
  
  assert.equal(result.amountWithTax, 11300);
  assert.equal(result.amountWithoutTax, 10000);
  assert.equal(result.taxAmount, 1300);
  assert.equal(result.taxRate, 0.13);
  
  const verification = TaxSeparationService.verifyCalculation(result);
  assert.equal(verification.isValid, true);
});

test('TaxSeparationService - 从不含税价计算', (t) => {
  const result = TaxSeparationService.calculateFromExcludingTax(10000, 0.13);
  
  assert.equal(result.amountWithTax, 11300);
  assert.equal(result.amountWithoutTax, 10000);
  assert.equal(result.taxAmount, 1300);
  assert.equal(result.taxRate, 0.13);
  
  const verification = TaxSeparationService.verifyCalculation(result);
  assert.equal(verification.isValid, true);
});

test('TaxSeparationService - 9% 税率测试', (t) => {
  const result = TaxSeparationService.calculateFromIncludingTax(10900, 0.09);
  
  assert.equal(result.amountWithTax, 10900);
  assert.equal(result.amountWithoutTax, 10000);
  assert.equal(result.taxAmount, 900);
  
  const verification = TaxSeparationService.verifyCalculation(result);
  assert.equal(verification.isValid, true);
});

test('TaxSeparationService - 6% 税率测试', (t) => {
  const result = TaxSeparationService.calculateFromIncludingTax(10600, 0.06);
  
  assert.equal(result.amountWithTax, 10600);
  assert.equal(result.amountWithoutTax, 10000);
  assert.equal(result.taxAmount, 600);
  
  const verification = TaxSeparationService.verifyCalculation(result);
  assert.equal(verification.isValid, true);
});

test('TaxSeparationService - 3% 税率测试（小规模）', (t) => {
  const result = TaxSeparationService.calculateFromIncludingTax(10300, 0.03);
  
  assert.equal(result.amountWithTax, 10300);
  assert.equal(result.amountWithoutTax, 10000);
  assert.equal(result.taxAmount, 300);
  
  const verification = TaxSeparationService.verifyCalculation(result);
  assert.equal(verification.isValid, true);
});

test('TaxSeparationService - 免税测试（0%）', (t) => {
  const result = TaxSeparationService.calculateFromIncludingTax(10000, 0);
  
  assert.equal(result.amountWithTax, 10000);
  assert.equal(result.amountWithoutTax, 10000);
  assert.equal(result.taxAmount, 0);
  
  const verification = TaxSeparationService.verifyCalculation(result);
  assert.equal(verification.isValid, true);
});

test('TaxSeparationService - 四舍五入边界测试 1', (t) => {
  const result = TaxSeparationService.calculateFromIncludingTax(100, 0.13);
  
  assert.equal(result.amountWithTax, 100);
  assert.equal(result.amountWithoutTax, 88.5);
  assert.equal(result.taxAmount, 11.5);
  
  const sum = TaxSeparationService.roundToTwoDecimals(result.amountWithoutTax + result.taxAmount);
  assert.equal(sum, 100);
  
  const verification = TaxSeparationService.verifyCalculation(result);
  assert.equal(verification.isValid, true);
});

test('TaxSeparationService - 四舍五入边界测试 2', (t) => {
  const result = TaxSeparationService.calculateFromIncludingTax(1, 0.13);
  
  assert.equal(result.amountWithTax, 1);
  assert.equal(result.amountWithoutTax, 0.88);
  assert.equal(result.taxAmount, 0.12);
  
  const verification = TaxSeparationService.verifyCalculation(result);
  assert.equal(verification.isValid, true);
});

test('TaxSeparationService - 明细项计算测试', (t) => {
  const items = [
    { description: '商品A', amount: 11300, priceType: 'WITH_TAX' },
    { description: '商品B', amount: 22600, priceType: 'WITH_TAX' }
  ];
  
  const result = TaxSeparationService.calculateItems(items, 0.13, 'WITH_TAX');
  
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].amountWithTax, 11300);
  assert.equal(result.items[0].amountWithoutTax, 10000);
  assert.equal(result.items[0].taxAmount, 1300);
  
  assert.equal(result.items[1].amountWithTax, 22600);
  assert.equal(result.items[1].amountWithoutTax, 20000);
  assert.equal(result.items[1].taxAmount, 2600);
  
  assert.equal(result.totals.amountWithTax, 33900);
  assert.equal(result.totals.amountWithoutTax, 30000);
  assert.equal(result.totals.taxAmount, 3900);
  
  assert.equal(result.totals.verification.mathCheck, true);
});

test('TaxSeparationService - 明细项不同税率测试', (t) => {
  const items = [
    { description: '商品A', amount: 11300, priceType: 'WITH_TAX', taxRate: 0.13 },
    { description: '服务B', amount: 10600, priceType: 'WITH_TAX', taxRate: 0.06 }
  ];
  
  const result = TaxSeparationService.calculateItems(items, 0.13, 'WITH_TAX');
  
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].taxRate, 0.13);
  assert.equal(result.items[0].amountWithoutTax, 10000);
  
  assert.equal(result.items[1].taxRate, 0.06);
  assert.equal(result.items[1].amountWithoutTax, 10000);
  
  assert.equal(result.totals.amountWithTax, 21900);
  assert.equal(result.totals.amountWithoutTax, 20000);
  assert.equal(result.totals.taxAmount, 1900);
  
  assert.equal(result.totals.verification.mathCheck, true);
});

test('TaxSeparationService - 业务报告生成测试', (t) => {
  const calculation = TaxSeparationService.calculateFromIncludingTax(11300, 0.13);
  const report = TaxSeparationService.generateBusinessReport(calculation, {
    title: '测试合同',
    contractNo: 'HT-2024-001'
  });
  
  assert.equal(report.businessSummary.contractTitle, '测试合同');
  assert.equal(report.businessSummary.contractNo, 'HT-2024-001');
  assert.equal(report.businessSummary.taxRate, '13.00%');
  
  assert.equal(report.amounts.amountWithTax, 11300);
  assert.equal(report.amounts.amountWithoutTax, 10000);
  assert.equal(report.amounts.taxAmount, 1300);
  
  assert.equal(report.verification.status, '计算正确');
  assert.ok(report.breakdown.description.includes('¥11,300.00'));
  assert.ok(report.breakdown.description.includes('¥10,000.00'));
  assert.ok(report.breakdown.description.includes('¥1,300.00'));
});

test('TaxSeparationService - 计算错误检测', (t) => {
  const badCalculation = {
    amountWithTax: 11300,
    amountWithoutTax: 9000,
    taxAmount: 1300,
    taxRate: 0.13
  };
  
  const verification = TaxSeparationService.verifyCalculation(badCalculation);
  assert.equal(verification.isValid, false);
  assert.ok(verification.checks.sumCheck.includes('≠'));
});

test('TaxSeparationService - 从总额计算 - 含税价类型', (t) => {
  const result = TaxSeparationService.calculateFromTotalAmount(11300, 0.13, 'WITH_TAX');
  
  assert.equal(result.amountWithTax, 11300);
  assert.equal(result.amountWithoutTax, 10000);
  assert.equal(result.taxAmount, 1300);
});

test('TaxSeparationService - 从总额计算 - 不含税价类型', (t) => {
  const result = TaxSeparationService.calculateFromTotalAmount(10000, 0.13, 'WITHOUT_TAX');
  
  assert.equal(result.amountWithTax, 11300);
  assert.equal(result.amountWithoutTax, 10000);
  assert.equal(result.taxAmount, 1300);
});

test('TaxSeparationService - 无效价格类型抛出错误', (t) => {
  assert.throws(() => {
    TaxSeparationService.calculateFromTotalAmount(10000, 0.13, 'INVALID_TYPE');
  }, /未知的价格类型/);
});

test('TaxSeparationService - 金额格式化测试', (t) => {
  assert.equal(TaxSeparationService.formatCurrency(10000), '¥10,000.00');
  assert.equal(TaxSeparationService.formatCurrency(1234567.89), '¥1,234,567.89');
  assert.equal(TaxSeparationService.formatCurrency(0), '¥0.00');
});
