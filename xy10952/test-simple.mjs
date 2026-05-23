const testValidateOrderRow = (row, rowIndex) => {
  const errors = [];
  const warnings = [];

  if (!row.orderId && !row['订单ID'] && !row['order_id']) {
    errors.push('缺少订单ID');
  }

  if (!row.leaderId && !row['团长ID'] && !row['leader_id']) {
    errors.push('缺少团长ID');
  }

  const amountRaw = row.amount ?? row['金额'] ?? row['订单金额'];
  if (amountRaw === undefined || amountRaw === '' || amountRaw === null) {
    errors.push('缺少订单金额');
  }
  const amount = parseFloat(amountRaw);
  if (isNaN(amount) || amount < 0) {
    errors.push('订单金额无效');
  }

  const quantity = parseInt(row.quantity || row['数量'] || 1);
  if (isNaN(quantity) || quantity < 0) {
    warnings.push('数量无效，默认使用 1');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    rowIndex
  };
};

const testValidateRefundRow = (row, rowIndex) => {
  const errors = [];
  const warnings = [];

  if (!row.orderId && !row['订单ID'] && !row['order_id']) {
    errors.push('缺少关联订单ID');
  }

  const amountRaw = row.amount ?? row['退款金额'] ?? row['refund_amount'];
  if (amountRaw === undefined || amountRaw === '' || amountRaw === null) {
    errors.push('缺少退款金额');
  }
  const amount = parseFloat(amountRaw);
  if (isNaN(amount) || amount < 0) {
    errors.push('退款金额无效');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    rowIndex
  };
};

console.log('🧪 测试订单金额校验逻辑...\n');

let tests = [
  { name: '正常金额 (应该通过)', row: { '订单ID': 'ORD001', '团长ID': 'L001', '金额': '100.00' }, expectedValid: true, expectedErrors: [] },
  { name: '缺失金额字段 (应该失败 - 缺少订单金额)', row: { '订单ID': 'ORD002', '团长ID': 'L001' }, expectedValid: false, expectedError: '缺少订单金额' },
  { name: '空字符串金额 (应该失败 - 缺少订单金额)', row: { '订单ID': 'ORD003', '团长ID': 'L001', '金额': '' }, expectedValid: false, expectedError: '缺少订单金额' },
  { name: '负数金额 (应该失败 - 订单金额无效)', row: { '订单ID': 'ORD004', '团长ID': 'L001', '金额': '-50.00' }, expectedValid: false, expectedError: '订单金额无效' },
  { name: '无效金额字符串 (应该失败 - 订单金额无效)', row: { '订单ID': 'ORD005', '团长ID': 'L001', '金额': 'abc' }, expectedValid: false, expectedError: '订单金额无效' },
  { name: '金额为0 (应该通过 - 0是有效的)', row: { '订单ID': 'ORD006', '团长ID': 'L001', '金额': '0' }, expectedValid: true, expectedErrors: [] },
];

let passed = 0;
tests.forEach((test, i) => {
  const result = testValidateOrderRow(test.row, i + 1);
  const success = test.expectedValid 
    ? result.valid === true && result.errors.length === 0
    : result.valid === false && result.errors.includes(test.expectedError);
  
  console.log(`测试${i + 1}: ${test.name}`);
  console.log(`  valid: ${result.valid}, errors: ${JSON.stringify(result.errors)}`);
  console.log(`  结果: ${success ? '✅ 通过' : '❌ 失败'}\n`);
  if (success) passed++;
});

console.log('🧪 测试退款金额校验逻辑...\n');

const refundTests = [
  { name: '退款缺失金额 (应该失败 - 缺少退款金额)', row: { '订单ID': 'ORD001' }, expectedValid: false, expectedError: '缺少退款金额' },
  { name: '退款空字符串金额 (应该失败 - 缺少退款金额)', row: { '订单ID': 'ORD001', '退款金额': '' }, expectedValid: false, expectedError: '缺少退款金额' },
  { name: '正常退款金额 (应该通过)', row: { '订单ID': 'ORD001', '退款金额': '50.00' }, expectedValid: true, expectedErrors: [] },
];

refundTests.forEach((test, i) => {
  const result = testValidateRefundRow(test.row, i + 1);
  const success = test.expectedValid 
    ? result.valid === true && result.errors.length === 0
    : result.valid === false && result.errors.includes(test.expectedError);
  
  console.log(`测试${tests.length + i + 1}: ${test.name}`);
  console.log(`  valid: ${result.valid}, errors: ${JSON.stringify(result.errors)}`);
  console.log(`  结果: ${success ? '✅ 通过' : '❌ 失败'}\n`);
  if (success) passed++;
});

console.log(`🎉 测试完成! 通过: ${passed}/${tests.length + refundTests.length}`);

if (passed === tests.length + refundTests.length) {
  console.log('\n✅ 所有校验逻辑测试通过！');
  process.exit(0);
} else {
  console.log('\n❌ 部分测试失败！');
  process.exit(1);
}
