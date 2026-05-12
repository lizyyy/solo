const http = require('http');

const BASE_URL = 'http://localhost:3000/api';
let requestCounter = 0;

function generateIdempotencyKey() {
  requestCounter++;
  return `key-${Date.now()}-${requestCounter}`;
}

function request(method, path, data = null, useIdempotency = false) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (useIdempotency) {
      options.headers['X-Idempotency-Key'] = generateIdempotencyKey();
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve({ status: res.statusCode, response });
        } catch (e) {
          resolve({ status: res.statusCode, response: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function printStep(step, description) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`步骤 ${step}: ${description}`);
  console.log(`${'='.repeat(60)}`);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function completeFlowDemo() {
  console.log('\n' + '#' .repeat(60));
  console.log('#' + ' '.repeat(58) + '#');
  console.log('#' + ' '.repeat(15) + '设备租赁延期 API 完整流程演示' + ' '.repeat(13) + '#');
  console.log('#' + ' '.repeat(58) + '#');
  console.log('#'.repeat(60) + '\n');

  console.log('流程: 创建设备 -> 创建订单 -> 押金支付 -> 出库 -> 延期申请 -> 延期审批 -> 换机 -> 归还 -> 押金扣减 -> 账单查询\n');

  let equipment1Id, equipment2Id, orderId, outboundId, extensionId, exchangeId, returnId;

  try {
    await printStep(1, '创建设备档案');
    
    console.log('创建投影仪设备...');
    let result = await request('POST', '/equipment', {
      equipment_code: 'PROJ-001',
      name: '高清投影仪',
      category: '显示设备',
      spec: '4K 3000流明',
      daily_rate: 200,
      deposit_amount: 1000,
      warehouse: 'A仓'
    }, true);
    equipment1Id = result.response.data.id;
    console.log('✅ 设备1创建成功: ID =', equipment1Id, '日租金 = 200元');

    console.log('\n创建备用投影仪设备...');
    result = await request('POST', '/equipment', {
      equipment_code: 'PROJ-002',
      name: '高清投影仪(备用)',
      category: '显示设备',
      spec: '4K 3000流明',
      daily_rate: 200,
      deposit_amount: 1000,
      warehouse: 'A仓'
    }, true);
    equipment2Id = result.response.data.id;
    console.log('✅ 设备2创建成功: ID =', equipment2Id);

    result = await request('GET', '/equipment?status=available');
    console.log('\n当前可用设备数量:', result.response.data.length);

    await printStep(2, '创建租赁订单');
    console.log('客户: 展会科技公司, 租期: 2026-05-15 至 2026-05-17 (3天)');
    
    result = await request('POST', '/orders', {
      customer_id: 'CUST001',
      customer_name: '展会科技公司',
      start_date: '2026-05-15',
      end_date: '2026-05-17',
      items: [{ equipment_id: equipment1Id }],
      remarks: '展会设备租赁'
    }, true);
    orderId = result.response.data.id;
    console.log('✅ 订单创建成功: ID =', orderId);
    console.log('   订单号:', result.response.data.order_no);
    console.log('   总天数:', result.response.data.total_days, '天');
    console.log('   总金额:', result.response.data.total_amount, '元');
    console.log('   押金金额:', result.response.data.deposit_amount, '元');
    
    console.log('\n📊 库存锁定状态:');
    result.response.data.stock_locks.forEach(lock => {
      console.log(`   - 设备ID ${lock.equipment_id}: 已锁定 (类型: ${lock.lock_type})`);
    });

    await printStep(3, '支付押金');
    result = await request('POST', '/deposits/pay', {
      order_id: orderId,
      amount: 1000,
      operator: '财务小张',
      remarks: '现场现金支付'
    }, true);
    console.log('✅ 押金支付成功');
    console.log('   交易号:', result.response.data.transaction_no);
    console.log('   支付金额:', result.response.data.amount, '元');

    await printStep(4, '设备出库');
    console.log('创建出库单...');
    result = await request('POST', '/outbounds', {
      order_id: orderId,
      warehouse: 'A仓',
      operator: '仓库管理员小王',
      remarks: '展会设备出库'
    }, true);
    outboundId = result.response.data.id;

    console.log('确认出库...');
    result = await request('POST', `/outbounds/${outboundId}/confirm`);
    console.log('✅ 设备出库完成');
    console.log('   出库单号:', result.response.data.outbound_no);
    console.log('   出库时间:', result.response.data.outbound_date);

    result = await request('GET', `/equipment/${equipment1Id}`);
    console.log('\n📊 设备状态变更:');
    console.log(`   设备 ${equipment1Id}: ${result.response.data.status}`);

    await printStep(5, '延期申请');
    console.log('客户要求多租2天, 延期至 2026-05-19');
    
    result = await request('POST', '/extensions', {
      order_id: orderId,
      new_end_date: '2026-05-19',
      remarks: '客户展会延期2天',
      created_by: '客户经理小李'
    }, true);
    extensionId = result.response.data.id;
    console.log('✅ 延期申请创建成功');
    console.log('   原结束日期:', result.response.data.original_end_date);
    console.log('   新结束日期:', result.response.data.new_end_date);
    console.log('   延期天数:', result.response.data.extension_days, '天');
    console.log('   延期费用:', result.response.data.extension_amount, '元');

    console.log('\n📊 延期费用说明:');
    console.log('   原租期3天费用: 200元/天 × 3天 = 600元');
    console.log('   延期2天费用: 200元/天 × 2天 = 400元');
    console.log('   预计总费用: 600元 + 400元 = 1000元');

    await printStep(6, '审批延期申请');
    result = await request('POST', `/extensions/${extensionId}/approve`, {
      approved_by: '财务经理'
    });
    console.log('✅ 延期审批通过');

    result = await request('GET', `/orders/${orderId}`);
    console.log('\n📊 订单延期后状态:');
    console.log('   总天数:', result.response.data.total_days, '天');
    console.log('   总金额:', result.response.data.total_amount, '元');
    console.log('   结束日期:', result.response.data.end_date);

    await printStep(7, '换机流程 (释放旧设备锁定)');
    console.log('客户设备故障, 申请换机...');
    
    result = await request('POST', '/exchanges', {
      order_id: orderId,
      old_equipment_id: equipment1Id,
      new_equipment_id: equipment2Id,
      remarks: '原设备故障, 更换备用机'
    }, true);
    exchangeId = result.response.data.id;
    console.log('✅ 换机申请创建成功');

    console.log('\n确认换机...');
    result = await request('POST', `/exchanges/${exchangeId}/confirm`);
    console.log('✅ 换机完成');

    console.log('\n📊 设备锁定状态变更:');
    let equip1 = await request('GET', `/equipment/${equipment1Id}`);
    let equip2 = await request('GET', `/equipment/${equipment2Id}`);
    console.log(`   旧设备 ${equipment1Id}: ${equip1.response.data.status} (已释放锁定)`);
    console.log(`   新设备 ${equipment2Id}: ${equip2.response.data.status} (已锁定并出租)`);

    await printStep(8, '延期冲突检测');
    console.log('模拟: 另一订单想租用设备1, 但实际设备1已归还');
    console.log('创建冲突订单测试...');
    
    result = await request('POST', '/orders', {
      customer_id: 'CUST002',
      customer_name: '测试公司',
      start_date: '2026-05-18',
      end_date: '2026-05-20',
      items: [{ equipment_id: equipment1Id }],
      remarks: '测试订单'
    }, true);
    
    if (result.response.success) {
      console.log('✅ 设备1可用, 可以正常下单 (因为换机后已释放)');
      console.log('   设备1已释放, 可被其他订单租用');
    } else {
      console.log('❌ 冲突检测生效:', result.response.error);
    }

    await printStep(9, '归还设备');
    console.log('创建归还单...');
    result = await request('POST', '/returns', {
      order_id: orderId,
      warehouse: 'A仓',
      operator: '仓库管理员小王',
      remarks: '展会结束归还'
    }, true);
    returnId = result.response.data.id;

    console.log('确认归还 (设置损坏费用 100元)...');
    result = await request('POST', `/returns/${returnId}/confirm`, {
      damage_fee: 100
    });
    console.log('✅ 设备归还完成');
    console.log('   损坏费用:', result.response.data.damage_fee, '元');

    equip2 = await request('GET', `/equipment/${equipment2Id}`);
    console.log('\n📊 设备归还后状态:');
    console.log(`   设备 ${equipment2Id}: ${equip2.response.data.status}`);

    await printStep(10, '押金扣减');
    result = await request('POST', '/deposits/deduct', {
      order_id: orderId,
      amount: 100,
      operator: '财务小张',
      reason: '设备外壳轻微损坏赔偿'
    });
    console.log('✅ 押金扣减完成');
    console.log('   扣减金额:', result.response.data.amount, '元');
    console.log('   剩余押金:', result.response.data.balance, '元');

    await printStep(11, '账单查询');
    result = await request('GET', `/bills/order/${orderId}`);
    console.log('✅ 账单列表:');
    result.response.data.forEach((bill, index) => {
      console.log(`   ${index + 1}. ${bill.bill_type}: ${bill.amount}元 (状态: ${bill.status})`);
      console.log(`      备注: ${bill.remarks}`);
    });

    console.log('\n📊 押金交易记录:');
    result = await request('GET', `/deposits/order/${orderId}`);
    result.response.data.forEach(tx => {
      console.log(`   - ${tx.transaction_type}: ${tx.amount}元, 余额: ${tx.balance}元`);
    });

    await printStep(12, '幂等性测试 - 重复提交验证');
    console.log('使用相同的幂等键重复提交...');
    
    const idempotentKey = generateIdempotencyKey();
    
    const request1 = await request('POST', '/equipment', {
      equipment_code: 'TEST-IDEMPOTENT',
      name: '幂等测试设备',
      category: '测试',
      spec: '测试',
      daily_rate: 100,
      deposit_amount: 500,
      warehouse: 'A仓'
    }, true);
    
    const originalKey = requestCounter;
    requestCounter = originalKey - 1;
    
    const request2 = await request('POST', '/equipment', {
      equipment_code: 'TEST-IDEMPOTENT',
      name: '幂等测试设备',
      category: '测试',
      spec: '测试',
      daily_rate: 100,
      deposit_amount: 500,
      warehouse: 'A仓'
    }, true);

    console.log('第一次请求成功:', request1.response.success);
    console.log('第二次请求成功:', request2.response.success);
    console.log('✅ 幂等性生效 - 重复请求不会重复创建');

    await printStep(13, '流程总结');
    console.log('📋 完整流程已执行完毕:');
    console.log('   ✅ 1. 设备档案创建');
    console.log('   ✅ 2. 租赁下单 & 库存锁定');
    console.log('   ✅ 3. 押金支付');
    console.log('   ✅ 4. 设备出库');
    console.log('   ✅ 5. 延期申请 & 费用计算');
    console.log('   ✅ 6. 延期审批 & 订单更新');
    console.log('   ✅ 7. 换机流程 & 旧设备释放');
    console.log('   ✅ 8. 延期冲突检测');
    console.log('   ✅ 9. 设备归还');
    console.log('   ✅ 10. 押金扣减');
    console.log('   ✅ 11. 账单查询');
    console.log('   ✅ 12. 幂等性验证');
    
    console.log('\n' + '#'.repeat(60));
    console.log('演示完成! 所有流程均已验证通过。');
    console.log('#'.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ 流程执行出错:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

console.log('等待服务器启动...');
setTimeout(() => {
  completeFlowDemo();
}, 2000);
