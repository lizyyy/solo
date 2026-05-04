import {
  validateProduct,
  validateTransaction,
  validateSubscription,
  validateShareRatios,
  validatePayoutRule,
  ValidationError
} from '../utils/validators.js';

const testValidateProduct = () => {
  console.log('\n========================================');
  console.log('测试: validateProduct');
  console.log('========================================');

  const validProduct = {
    product_code: 'TEST001',
    product_name: '测试产品',
    product_type: 'bank_wealth',
    annual_return_rate: '0.035',
    management_fee_rate: '0.003',
    redemption_fee_rate: '0.001'
  };

  const result1 = validateProduct(validProduct, 2);
  console.log('\n✓ 有效产品验证:', result1.isValid ? '通过' : '失败');
  if (!result1.isValid) {
    console.log('  错误:', result1.errors.map(e => e.message));
  }

  const invalidProduct1 = {
    product_code: '',
    product_name: '测试产品',
    product_type: 'bank_wealth',
    annual_return_rate: '0.035'
  };
  const result2 = validateProduct(invalidProduct1, 3);
  console.log('✓ 缺失产品代码:', !result2.isValid ? '正确检测到错误' : '未检测到错误');

  const invalidProduct2 = {
    product_code: 'TEST002',
    product_name: '',
    product_type: 'bank_wealth',
    annual_return_rate: '0.035'
  };
  const result3 = validateProduct(invalidProduct2, 4);
  console.log('✓ 缺失产品名称:', !result3.isValid ? '正确检测到错误' : '未检测到错误');

  const invalidProduct3 = {
    product_code: 'TEST003',
    product_name: '测试产品',
    product_type: 'unknown_type',
    annual_return_rate: '0.035'
  };
  const result4 = validateProduct(invalidProduct3, 5);
  console.log('✓ 无效产品类型:', !result4.isValid ? '正确检测到错误' : '未检测到错误');

  const invalidProduct4 = {
    product_code: 'TEST004',
    product_name: '测试产品',
    product_type: 'bank_wealth',
    annual_return_rate: 'invalid_rate'
  };
  const result5 = validateProduct(invalidProduct4, 6);
  console.log('✓ 无效收益率:', !result5.isValid ? '正确检测到错误' : '未检测到错误');
};

const testValidateTransaction = () => {
  console.log('\n========================================');
  console.log('测试: validateTransaction');
  console.log('========================================');

  const validTransaction = {
    transaction_date: '2025-01-15',
    transaction_amount: '100328.77',
    description: '招行添利宝到期本息',
    account_name: '招商银行账户',
    transaction_type: 'income'
  };

  const result1 = validateTransaction(validTransaction, 2);
  console.log('\n✓ 有效交易验证:', result1.isValid ? '通过' : '失败');

  const invalidTransaction1 = {
    transaction_date: '',
    transaction_amount: '100328.77',
    description: '测试交易'
  };
  const result2 = validateTransaction(invalidTransaction1, 3);
  console.log('✓ 缺失交易日期:', !result2.isValid ? '正确检测到错误' : '未检测到错误');

  const invalidTransaction2 = {
    transaction_date: '2025-01-15',
    transaction_amount: 'invalid_amount',
    description: '测试交易'
  };
  const result3 = validateTransaction(invalidTransaction2, 4);
  console.log('✓ 无效交易金额:', !result3.isValid ? '正确检测到错误' : '未检测到错误');

  const validDates = ['2025-01-15', '2025/01/15', '2025年1月15日', '01-15-2025'];
  console.log('\n✓ 测试多种日期格式:');
  validDates.forEach((date, idx) => {
    const tx = {
      transaction_date: date,
      transaction_amount: '100',
      description: '测试'
    };
    const result = validateTransaction(tx, idx + 5);
    console.log(`  - "${date}":`, result.isValid ? '通过' : '失败');
  });
};

const testValidateSubscription = () => {
  console.log('\n========================================');
  console.log('测试: validateSubscription');
  console.log('========================================');

  const validSubscription = {
    product_code: 'TEST001',
    holder_name: '张三',
    share_amount: '50000',
    share_ratio: '0.5',
    start_date: '2024-12-15',
    maturity_date: '2025-01-15'
  };

  const result1 = validateSubscription(validSubscription, 2);
  console.log('\n✓ 有效认购验证:', result1.isValid ? '通过' : '失败');

  const invalidSubscription1 = {
    product_code: '',
    holder_name: '张三',
    share_amount: '50000',
    share_ratio: '0.5'
  };
  const result2 = validateSubscription(invalidSubscription1, 3);
  console.log('✓ 缺失产品代码:', !result2.isValid ? '正确检测到错误' : '未检测到错误');

  const invalidSubscription2 = {
    product_code: 'TEST001',
    holder_name: '',
    share_amount: '50000',
    share_ratio: '0.5'
  };
  const result3 = validateSubscription(invalidSubscription2, 4);
  console.log('✓ 缺失持有人名称:', !result3.isValid ? '正确检测到错误' : '未检测到错误');

  const invalidSubscription3 = {
    product_code: 'TEST001',
    holder_name: '张三',
    share_amount: 'invalid',
    share_ratio: '0.5'
  };
  const result4 = validateSubscription(invalidSubscription3, 5);
  console.log('✓ 无效份额金额:', !result4.isValid ? '正确检测到错误' : '未检测到错误');

  const invalidSubscription4 = {
    product_code: 'TEST001',
    holder_name: '张三',
    share_amount: '50000',
    share_ratio: '-0.1'
  };
  const result5 = validateSubscription(invalidSubscription4, 6);
  console.log('✓ 负份额比例:', !result5.isValid ? '正确检测到错误' : '未检测到错误');
};

const testValidateShareRatios = () => {
  console.log('\n========================================');
  console.log('测试: validateShareRatios');
  console.log('========================================');

  const validRecords = [
    { product_code: 'BW001', product_name: '产品A', share_ratio: 0.5, holder_name: '张三', rowNumber: 2 },
    { product_code: 'BW001', product_name: '产品A', share_ratio: 0.3, holder_name: '李四', rowNumber: 3 },
    { product_code: 'BW001', product_name: '产品A', share_ratio: 0.2, holder_name: '王五', rowNumber: 4 }
  ];

  const result1 = validateShareRatios(validRecords);
  console.log('\n✓ 有效分摊比例 (100%):', result1.isValid ? '通过' : '失败');

  const invalidRecords = [
    { product_code: 'BW001', product_name: '产品A', share_ratio: 0.6, holder_name: '张三', rowNumber: 2 },
    { product_code: 'BW001', product_name: '产品A', share_ratio: 0.5, holder_name: '李四', rowNumber: 3 },
    { product_code: 'BW001', product_name: '产品A', share_ratio: 0.2, holder_name: '王五', rowNumber: 4 }
  ];

  const result2 = validateShareRatios(invalidRecords);
  console.log('✓ 无效分摊比例 (130%):', !result2.isValid ? '正确检测到错误' : '未检测到错误');
  if (!result2.isValid) {
    console.log('  错误详情:', result2.errors.map(e => `${e.productCode}: ${(e.totalRatio * 100).toFixed(1)}%`));
  }
};

const testValidationError = () => {
  console.log('\n========================================');
  console.log('测试: ValidationError');
  console.log('========================================');

  const error = new ValidationError(
    '产品代码不能为空',
    'product_code',
    '',
    2
  );

  console.log('\n✓ 创建错误对象:', error instanceof ValidationError ? '通过' : '失败');
  console.log('  - 错误信息:', error.message);
  console.log('  - 字段名:', error.field);
  console.log('  - 值:', error.value);
  console.log('  - 行号:', error.rowNumber);

  const json = error.toJSON();
  console.log('\n✓ 转换为 JSON:', 
    json.error === '产品代码不能为空' && 
    json.field === 'product_code' ? '通过' : '失败');
};

const runAllTests = () => {
  console.log('\n========================================');
  console.log('运行验证器测试');
  console.log('========================================');

  testValidationError();
  testValidateProduct();
  testValidateTransaction();
  testValidateSubscription();
  testValidateShareRatios();

  console.log('\n========================================');
  console.log('所有验证器测试完成');
  console.log('========================================');
};

runAllTests();
