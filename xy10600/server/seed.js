const services = require('./services');

async function createDemoData() {
  console.log('\n========= 开始生成演示数据...\n');

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  console.log('📌 路径1: 成功变更 (SUCCESS)');
  const result1 = await services.processPriceChange({
    product_code: 'SKU001',
    product_name: '农夫山泉550ml',
    old_price: 2.00,
    new_price: 2.50,
    operator: '张三',
    reason: '供应商调价',
    devices: [
      { device_id: 'ESL-A-001' },
      { device_id: 'ESL-A-002' }
    ],
    terminals: [
      { terminal_id: 'POS-001' },
      { terminal_id: 'POS-002' }
    ]
  });
  console.log('   ✅ 成功创建，ID:', result1.price_change_id, '状态:', result1.status);

  console.log('\n📌 路径2: 促销拦截 (INTERCEPTED)');
  const result2 = await services.processPriceChange({
    product_code: 'SKU002',
    product_name: '可口可乐330ml',
    old_price: 3.50,
    new_price: 4.00,
    operator: '李四',
    reason: '例行调价',
    promotion: {
      promotion_name: '五一劳动节促销',
      rule_type: 'MULTI_BUY',
      effect_start: today,
      effect_end: nextWeek
    },
    devices: [{ device_id: 'ESL-B-001' }],
    terminals: [{ terminal_id: 'POS-003' }]
  });
  console.log('   ✅ 已拦截，ID:', result2.price_change_id, '拦截:', result2.intercepted);

  const result2b = await services.processPriceChange({
    product_code: 'SKU002',
    product_name: '可口可乐330ml',
    old_price: 3.50,
    new_price: 4.00,
    operator: '李四',
    reason: '无视促销强制调整',
    force: true,
    devices: [{ device_id: 'ESL-B-001' }],
    terminals: [{ terminal_id: 'POS-003' }]
  });
  console.log('   ✅ 强制创建，ID:', result2b.price_change_id, '状态:', result2b.status);

  console.log('\n📌 路径3: 人工修正 (MANUAL_CORRECTION_REQUIRED)');
  const result3 = await services.processPriceChange({
    product_code: 'SKU003',
    product_name: '康师傅红烧牛肉面',
    old_price: 4.50,
    new_price: 5.00,
    operator: '王五',
    reason: '成本上涨',
    devices: [
      { device_id: 'ESL-C-001', simulate_offline: true },
      { device_id: 'ESL-C-002' }
    ],
    terminals: [
      { terminal_id: 'POS-004', simulate_failure: true }
    ]
  });
  console.log('   ✅ 异常记录，ID:', result3.price_change_id, '状态:', result3.status);

  console.log('\n📌 路径4: 重复提交幂等 (IDEMPOTENT)');
  const requestId = 'REQ_DEMO_001';
  const result4a = await services.processPriceChange({
    product_code: 'SKU004',
    product_name: '伊利纯牛奶250ml',
    old_price: 5.50,
    new_price: 6.00,
    operator: '赵六',
    reason: '促销活动',
    request_id: requestId,
    devices: [{ device_id: 'ESL-D-001' }],
    terminals: [{ terminal_id: 'POS-005' }]
  });
  console.log('   ✅ 首次提交，ID:', result4a.price_change_id);

  const result4b = await services.processPriceChange({
    product_code: 'SKU004',
    product_name: '伊利纯牛奶250ml',
    old_price: 5.50,
    new_price: 6.00,
    operator: '赵六',
    reason: '促销活动',
    request_id: requestId,
    devices: [{ device_id: 'ESL-D-001' }],
    terminals: [{ terminal_id: 'POS-005' }]
  });
  console.log('   ✅ 重复提交，幂等:', result4b.idempotent, '原ID:', result4b.price_change_id);

  console.log('\n📌 演示回滚和补发');
  const rollbackResult = await services.rollbackPriceChange(result3.price_change_id, {
    rollback_by: '管理员',
    rollback_reason: '发现价格错误，需要回滚',
    reissue: true
  });
  console.log('   ✅ 已回滚，新状态:', rollbackResult.status);

  const reissueResult = await services.reissuePriceChange(
    result3.price_change_id,
    '管理员'
  );
  console.log('   ✅ 已补发，次数:', reissueResult.reissue_count);

  console.log('\n========= 演示数据生成完成！\n');
  console.log('访问 http://localhost:3001 查看数据\n');

  process.exit(0);
}

createDemoData().catch(err => {
  console.error('生成失败:', err);
  process.exit(1);
});
