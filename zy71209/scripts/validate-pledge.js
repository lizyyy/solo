const { calculatePledgeRatio, validateWarningLineParams, validatePledgeParams } = require('../src/utils/calculator.ts');

console.log('=== 股票质押业务逻辑验证 ===\n');

const mockPledges = [
  {
    name: '张三/贵州茅台',
    pledge: {
      id: '1',
      customerId: '1',
      stockCode: '600519',
      stockName: '贵州茅台',
      pledgeShares: 10000,
      principal: 10000000,
      warningLine: 66.67,
      closeLine: 76.92,
      startDate: '2024-01-15',
      endDate: '2025-01-15',
      status: 'warning',
      specialFlags: [],
      createdAt: '2025-05-27',
      updatedAt: '2025-05-28',
    },
    marketData: {
      stockCode: '600519',
      latestPrice: 1500.00,
      previousClose: 1680.00,
      tradingStatus: 'normal',
      valuationDiscount: 0.8,
      updateTime: '2025-05-28',
    },
    supplements: [
      {
        id: 's1',
        pledgeId: '1',
        amount: 1000000,
        expectedDate: '2025-05-27',
        actualDate: '2025-05-27',
        status: 'received',
        afterPledgeRatio: 60.00,
      },
    ],
    extensions: [],
    expected: {
      effectivePrice: 1500,
      marketValue: 15000000,
      adjustedPrincipal: 9000000,
      pledgeRatio: 60.00,
      isWarning: false,
      isClose: false,
      warningBuffer: 6.67,
    },
  },
  {
    name: '李四/平安银行（补仓未到账）',
    pledge: {
      id: '2',
      customerId: '2',
      stockCode: '000001',
      stockName: '平安银行',
      pledgeShares: 500000,
      principal: 5000000,
      warningLine: 66.67,
      closeLine: 76.92,
      startDate: '2024-03-20',
      endDate: '2025-03-20',
      status: 'warning',
      specialFlags: ['supplement_pending'],
      createdAt: '2025-05-27',
      updatedAt: '2025-05-28',
    },
    marketData: {
      stockCode: '000001',
      latestPrice: 14.50,
      previousClose: 15.20,
      tradingStatus: 'normal',
      valuationDiscount: 0.8,
      updateTime: '2025-05-28',
    },
    supplements: [
      {
        id: 's2',
        pledgeId: '2',
        amount: 500000,
        expectedDate: '2025-05-28',
        status: 'pending',
        afterPledgeRatio: 64.52,
      },
    ],
    extensions: [],
    expected: {
      effectivePrice: 14.50,
      marketValue: 7250000,
      adjustedPrincipal: 5000000,
      pledgeRatio: 68.97,
      isWarning: true,
      isClose: false,
      warningBuffer: -2.30,
    },
  },
  {
    name: '王五/招商银行（平仓）',
    pledge: {
      id: '3',
      customerId: '3',
      stockCode: '600036',
      stockName: '招商银行',
      pledgeShares: 200000,
      principal: 8000000,
      warningLine: 66.67,
      closeLine: 76.92,
      startDate: '2024-02-10',
      endDate: '2025-02-10',
      status: 'close',
      specialFlags: [],
      createdAt: '2025-05-27',
      updatedAt: '2025-05-28',
    },
    marketData: {
      stockCode: '600036',
      latestPrice: 48.00,
      previousClose: 50.50,
      tradingStatus: 'normal',
      valuationDiscount: 0.8,
      updateTime: '2025-05-28',
    },
    supplements: [],
    extensions: [],
    expected: {
      effectivePrice: 48.00,
      marketValue: 9600000,
      adjustedPrincipal: 8000000,
      pledgeRatio: 83.33,
      isWarning: true,
      isClose: true,
      warningBuffer: -16.66,
    },
  },
  {
    name: '赵六/五粮液（停牌）',
    pledge: {
      id: '4',
      customerId: '4',
      stockCode: '000858',
      stockName: '五粮液',
      pledgeShares: 50000,
      principal: 3000000,
      warningLine: 66.67,
      closeLine: 76.92,
      startDate: '2024-01-05',
      endDate: '2025-01-05',
      status: 'warning',
      specialFlags: ['suspended'],
      createdAt: '2025-05-27',
      updatedAt: '2025-05-28',
    },
    marketData: {
      stockCode: '000858',
      latestPrice: 120.00,
      previousClose: 125.00,
      tradingStatus: 'suspended',
      valuationDiscount: 0.7,
      updateTime: '2025-05-27',
    },
    supplements: [],
    extensions: [],
    expected: {
      effectivePrice: 87.50,
      marketValue: 4375000,
      adjustedPrincipal: 3000000,
      pledgeRatio: 68.57,
      isWarning: true,
      isClose: false,
      warningBuffer: -1.90,
    },
  },
  {
    name: '钱七/中国平安（展期旧任务）',
    pledge: {
      id: '5',
      customerId: '5',
      stockCode: '601318',
      stockName: '中国平安',
      pledgeShares: 300000,
      principal: 12000000,
      warningLine: 66.67,
      closeLine: 76.92,
      startDate: '2024-04-01',
      endDate: '2025-04-01',
      status: 'warning',
      specialFlags: ['extension_old'],
      createdAt: '2025-05-27',
      updatedAt: '2025-05-28',
    },
    marketData: {
      stockCode: '601318',
      latestPrice: 55.00,
      previousClose: 57.50,
      tradingStatus: 'normal',
      valuationDiscount: 0.8,
      updateTime: '2025-05-28',
    },
    supplements: [],
    extensions: [
      {
        id: 'e1',
        pledgeId: '5',
        applyDate: '2025-05-26',
        approveDate: '2025-05-27',
        newEndDate: '2026-04-01',
        newWarningLine: 70,
        status: 'approved',
      },
    ],
    expected: {
      effectivePrice: 55.00,
      marketValue: 16500000,
      adjustedPrincipal: 12000000,
      pledgeRatio: 72.73,
      isWarning: true,
      isClose: false,
      warningBuffer: -2.73,
      effectiveWarningLine: 70,
    },
  },
];

let passed = 0;
let failed = 0;

mockPledges.forEach((testCase) => {
  console.log(`测试：${testCase.name}`);
  console.log(`  警戒线：${testCase.pledge.warningLine}%，平仓线：${testCase.pledge.closeLine}%`);
  
  const lineValidation = validateWarningLineParams(testCase.pledge.warningLine, testCase.pledge.closeLine);
  console.log(`  警戒线参数验证：${lineValidation.valid ? '通过' : '失败 - ' + lineValidation.errors.join(',')}`);
  
  const pledgeValidation = validatePledgeParams(testCase.pledge.pledgeShares, testCase.pledge.principal);
  console.log(`  质押参数验证：${pledgeValidation.valid ? '通过' : '失败 - ' + pledgeValidation.errors.join(',')}`);
  
  const calc = calculatePledgeRatio(testCase.pledge, testCase.marketData, testCase.supplements, testCase.extensions);
  
  let testPassed = true;
  
  const checks = [
    { field: 'effectivePrice', expected: testCase.expected.effectivePrice, actual: calc.effectivePrice, tolerance: 0.01 },
    { field: 'marketValue', expected: testCase.expected.marketValue, actual: calc.marketValue, tolerance: 1 },
    { field: 'pledgeRatio', expected: testCase.expected.pledgeRatio, actual: calc.pledgeRatio, tolerance: 0.01 },
    { field: 'isWarning', expected: testCase.expected.isWarning, actual: calc.isWarning },
    { field: 'isClose', expected: testCase.expected.isClose, actual: calc.isClose },
    { field: 'warningBuffer', expected: testCase.expected.warningBuffer, actual: calc.warningBuffer, tolerance: 0.01 },
  ];
  
  checks.forEach((check) => {
    if (typeof check.expected === 'boolean') {
      if (check.expected !== check.actual) {
        console.log(`  ❌ ${check.field}: 预期 ${check.expected}，实际 ${check.actual}`);
        testPassed = false;
      } else {
        console.log(`  ✅ ${check.field}: ${check.actual}`);
      }
    } else {
      const diff = Math.abs(check.expected - check.actual);
      if (diff > (check.tolerance || 0.01)) {
        console.log(`  ❌ ${check.field}: 预期 ${check.expected}，实际 ${check.actual}，差值 ${diff}`);
        testPassed = false;
      } else {
        console.log(`  ✅ ${check.field}: ${check.actual}`);
      }
    }
  });
  
  if (testCase.expected.effectiveWarningLine) {
    if (calc.effectiveWarningLine !== testCase.expected.effectiveWarningLine) {
      console.log(`  ❌ effectiveWarningLine: 预期 ${testCase.expected.effectiveWarningLine}，实际 ${calc.effectiveWarningLine}`);
      testPassed = false;
    } else {
      console.log(`  ✅ effectiveWarningLine: ${calc.effectiveWarningLine}%`);
    }
  }
  
  if (testPassed) {
    console.log('  ✅ 测试通过\n');
    passed++;
  } else {
    console.log('  ❌ 测试失败\n');
    failed++;
  }
});

console.log('=== 测试结果 ===');
console.log(`通过：${passed}，失败：${failed}`);
console.log(`总测试用例：${mockPledges.length}`);

if (failed > 0) {
  process.exit(1);
}
