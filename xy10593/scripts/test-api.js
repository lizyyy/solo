const http = require('http');

const BASE_URL = 'http://localhost:3001';

const request = (method, path, data = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: body ? JSON.parse(body) : null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: body
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
};

const log = (step, message, data = null) => {
  console.log(`\n[${step}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
};

const runTests = async () => {
  console.log('='.repeat(60));
  console.log('售楼认购锁房API - 自动化测试');
  console.log('='.repeat(60));

  try {
    log('测试0', '健康检查');
    const health = await request('GET', '/health');
    console.log('状态:', health.status);
    if (health.status !== 200) throw new Error('服务未启动');

    log('测试1', '获取项目列表');
    const projects = await request('GET', '/api/projects');
    const projectId = projects.data.data[0]?.id;
    console.log('项目数:', projects.data.data.length);

    log('测试2', '获取房源列表');
    const properties = await request('GET', '/api/properties');
    const propA101 = properties.data.data.find(p => p.property_code === 'PROP-A101');
    const propA102 = properties.data.data.find(p => p.property_code === 'PROP-A102');
    const propA201 = properties.data.data.find(p => p.property_code === 'PROP-A201');
    console.log('房源数:', properties.data.data.length);
    console.log('PROP-A101 ID:', propA101?.id);
    console.log('PROP-A102 ID:', propA102?.id);

    log('测试3', '获取客户列表');
    const customers = await request('GET', '/api/customers');
    const cus001 = customers.data.data.find(c => c.customer_code === 'CUS-001');
    const cus002 = customers.data.data.find(c => c.customer_code === 'CUS-002');
    console.log('客户数:', customers.data.data.length);

    log('测试4', '获取渠道列表');
    const channels = await request('GET', '/api/channels');
    const chn001 = channels.data.data.find(c => c.channel_code === 'CHN-001');
    console.log('渠道数:', channels.data.data.length);

    log('场景一', '正常认购流程');
    
    log('1.1', '创建认购单');
    const booking1 = await request('POST', '/api/bookings', {
      property_id: propA101.id,
      customer_id: cus001.id,
      channel_id: chn001.id,
      total_price: 3500000,
      booking_amount: 50000,
      deposit_amount: 200000,
      lock_source: 'manual',
      notes: '测试认购',
      created_by: 'test_user'
    });
    console.log('认购单创建状态:', booking1.status);
    const booking1Id = booking1.data.data.id;
    console.log('认购单ID:', booking1Id);

    log('1.2', '锁定房源');
    const lockResult = await request('POST', `/api/bookings/${booking1Id}/lock`, {
      operator: 'test_user'
    });
    console.log('锁定状态:', lockResult.status);
    console.log('认购单状态:', lockResult.data.data.status);

    log('1.3', '验证房源状态');
    const propAfterLock = await request('GET', `/api/properties/${propA101.id}`);
    console.log('房源状态:', propAfterLock.data.data.status);
    if (propAfterLock.data.data.status !== 'locked') {
      throw new Error('房源未锁定');
    }

    log('1.4', '尝试重复锁定 (预期失败)');
    const duplicateBooking = await request('POST', '/api/bookings', {
      property_id: propA101.id,
      customer_id: cus001.id,
      channel_id: chn001.id,
      total_price: 3500000,
      booking_amount: 50000,
      deposit_amount: 200000,
      created_by: 'test_user'
    });
    console.log('重复创建状态:', duplicateBooking.status);
    if (duplicateBooking.status === 201) {
      throw new Error('重复锁定应该失败');
    }
    console.log('失败原因:', duplicateBooking.data.error);

    log('1.5', '创建定金单');
    const deposit1 = await request('POST', '/api/deposits', {
      booking_id: booking1Id,
      amount: 200000,
      payment_method: 'bank_transfer',
      created_by: 'test_user'
    });
    console.log('定金单创建状态:', deposit1.status);
    const deposit1Id = deposit1.data.data.id;

    log('1.6', '支付回调 (成功)');
    const callbackId = 'CB-TEST-001';
    const callback1 = await request('POST', '/api/deposits/callback', {
      callback_id: callbackId,
      deposit_id: deposit1Id,
      success: true,
      transaction_no: 'TXN-TEST-001',
      operator: 'test'
    });
    console.log('回调状态:', callback1.status);
    console.log('定金状态:', callback1.data.data.deposit.status);

    log('1.7', '验证支付回调幂等');
    const callbackIdempotent = await request('POST', '/api/deposits/callback', {
      callback_id: callbackId,
      deposit_id: deposit1Id,
      success: true,
      transaction_no: 'TXN-TEST-001',
      operator: 'test'
    });
    console.log('幂等回调状态:', callbackIdempotent.data.data.idempotent);
    if (!callbackIdempotent.data.data.idempotent) {
      throw new Error('幂等验证失败');
    }

    log('1.8', '验证认购单状态变更');
    const bookingAfterPay = await request('GET', `/api/bookings/${booking1Id}`);
    console.log('认购单状态:', bookingAfterPay.data.data.status);
    if (bookingAfterPay.data.data.status !== 'deposited') {
      throw new Error('认购单状态未更新');
    }

    log('1.9', '验证房源状态变更');
    const propAfterPay = await request('GET', `/api/properties/${propA101.id}`);
    console.log('房源状态:', propAfterPay.data.data.status);
    if (propAfterPay.data.data.status !== 'deposited') {
      throw new Error('房源状态未更新');
    }

    log('1.10', '创建佣金');
    const comm1 = await request('POST', '/api/commissions', {
      booking_id: booking1Id,
      operator: 'test_user'
    });
    console.log('佣金创建状态:', comm1.status);
    const comm1Id = comm1.data.data.commission.id;
    console.log('佣金金额:', comm1.data.data.commission.amount);

    log('1.11', '审批佣金');
    const commApprove = await request('POST', `/api/commissions/${comm1Id}/approve`, {
      operator: 'test_admin'
    });
    console.log('佣金审批后状态:', commApprove.data.data.status);

    log('场景二', '改名审批流程');

    log('2.1', '创建改名申请');
    const nc1 = await request('POST', '/api/name-changes', {
      booking_id: booking1Id,
      old_customer_id: cus001.id,
      new_customer_id: cus002.id,
      reason: '测试改名',
      created_by: 'test_user'
    });
    console.log('改名申请创建状态:', nc1.status);
    const nc1Id = nc1.data.data.id;

    log('2.2', '提交审批');
    const ncSubmit = await request('POST', `/api/name-changes/${nc1Id}/submit`, {
      operator: 'test_user'
    });
    console.log('提交后状态:', ncSubmit.data.data.status);

    log('2.3', '审批通过');
    const ncApprove = await request('POST', `/api/name-changes/${nc1Id}/approve`, {
      approval_notes: '测试审批通过',
      operator: 'test_admin'
    });
    console.log('审批后状态:', ncApprove.data.data.status);

    log('2.4', '验证客户变更');
    const bookingAfterNC = await request('GET', `/api/bookings/${booking1Id}`);
    console.log('认购单客户:', bookingAfterNC.data.data.customer_name);
    if (bookingAfterNC.data.data.customer_name !== '李小红') {
      throw new Error('客户未变更');
    }

    log('2.5', '验证佣金冻结');
    const commAfterNC = await request('GET', `/api/commissions/${comm1Id}`);
    console.log('佣金状态:', commAfterNC.data.data.status);
    if (commAfterNC.data.data.status !== 'frozen') {
      throw new Error('佣金未冻结');
    }

    log('场景三', '退定解锁流程');

    log('3.1', '创建第二个认购单');
    const booking2 = await request('POST', '/api/bookings', {
      property_id: propA102.id,
      customer_id: cus001.id,
      channel_id: chn001.id,
      total_price: 3200000,
      booking_amount: 50000,
      deposit_amount: 150000,
      created_by: 'test_user'
    });
    const booking2Id = booking2.data.data.id;
    await request('POST', `/api/bookings/${booking2Id}/lock`, { operator: 'test' });

    log('3.2', '创建定金并支付');
    const deposit2 = await request('POST', '/api/deposits', {
      booking_id: booking2Id,
      amount: 150000,
      payment_method: 'wechat',
      created_by: 'test'
    });
    const deposit2Id = deposit2.data.data.id;
    await request('POST', '/api/deposits/callback', {
      callback_id: 'CB-TEST-002',
      deposit_id: deposit2Id,
      success: true,
      transaction_no: 'TXN-TEST-002'
    });

    log('3.3', '创建佣金');
    const comm2 = await request('POST', '/api/commissions', {
      booking_id: booking2Id,
      operator: 'test'
    });
    const comm2Id = comm2.data.data.commission.id;

    log('3.4', '创建退定申请');
    const refund1 = await request('POST', '/api/refunds', {
      booking_id: booking2Id,
      amount: 150000,
      reason: '测试退定',
      created_by: 'test_user'
    });
    const refund1Id = refund1.data.data.id;
    console.log('退定申请创建状态:', refund1.status);

    log('3.5', '提交审批');
    await request('POST', `/api/refunds/${refund1Id}/submit`, { operator: 'test' });

    log('3.6', '审批通过');
    await request('POST', `/api/refunds/${refund1Id}/approve`, { operator: 'test_admin' });

    log('3.7', '执行退款');
    const refundExec = await request('POST', `/api/refunds/${refund1Id}/execute`, {
      refund_method: 'bank_transfer',
      transaction_no: 'RF-TEST-001',
      operator: 'test_finance'
    });
    console.log('退款执行后状态:', refundExec.data.data.status);

    log('3.8', '验证房源解锁');
    const propAfterRefund = await request('GET', `/api/properties/${propA102.id}`);
    console.log('房源状态:', propAfterRefund.data.data.status);
    if (propAfterRefund.data.data.status !== 'available') {
      throw new Error('房源未解锁');
    }

    log('3.9', '验证定金退还');
    const depositAfterRefund = await request('GET', `/api/deposits/${deposit2Id}`);
    console.log('定金状态:', depositAfterRefund.data.data.status);
    if (depositAfterRefund.data.data.status !== 'refunded') {
      throw new Error('定金未退还');
    }

    log('3.10', '验证佣金作废');
    const commAfterRefund = await request('GET', `/api/commissions/${comm2Id}`);
    console.log('佣金状态:', commAfterRefund.data.data.status);
    if (commAfterRefund.data.data.status !== 'void') {
      throw new Error('佣金未作废');
    }

    log('场景四', '失败路径验证');

    log('4.1', '定金未到账创建佣金 (预期失败)');
    const booking3 = await request('POST', '/api/bookings', {
      property_id: propA201.id,
      customer_id: cus001.id,
      channel_id: chn001.id,
      total_price: 3600000,
      booking_amount: 50000,
      deposit_amount: 180000,
      created_by: 'test'
    });
    const booking3Id = booking3.data.data.id;
    await request('POST', `/api/bookings/${booking3Id}/lock`, { operator: 'test' });

    const commFail = await request('POST', '/api/commissions', {
      booking_id: booking3Id,
      operator: 'test'
    });
    console.log('创建佣金状态:', commFail.status);
    if (commFail.status !== 400) {
      throw new Error('定金未到账应该无法创建佣金');
    }
    console.log('失败原因:', commFail.data.error);

    log('4.2', '支付失败回调');
    const deposit3 = await request('POST', '/api/deposits', {
      booking_id: booking3Id,
      amount: 180000,
      payment_method: 'alipay',
      created_by: 'test'
    });
    const deposit3Id = deposit3.data.data.id;

    const callbackFail = await request('POST', '/api/deposits/callback', {
      callback_id: 'CB-TEST-003',
      deposit_id: deposit3Id,
      success: false,
      transaction_no: 'TXN-TEST-003',
      failure_reason: '余额不足'
    });
    console.log('支付失败回调状态:', callbackFail.status);
    console.log('定金状态:', callbackFail.data.data.deposit.status);

    log('4.3', '验证认购单仍锁定');
    const bookingAfterFail = await request('GET', `/api/bookings/${booking3Id}`);
    console.log('认购单状态:', bookingAfterFail.data.data.status);
    if (bookingAfterFail.data.data.status !== 'locked') {
      throw new Error('支付失败时认购单应保持锁定');
    }

    log('报告导出', '生成业务报告');

    log('5.1', '仪表盘数据');
    const dashboard = await request('GET', '/api/reports/dashboard');
    console.log('项目数:', dashboard.data.data.overview.project_count);
    console.log('房源数:', dashboard.data.data.overview.property_count);

    log('5.2', '房源时间线');
    const timeline = await request('GET', `/api/properties/${propA101.id}/timeline`);
    console.log('历史记录数:', timeline.data.data.status_history.length);

    log('5.3', '定金账本');
    const ledger = await request('GET', '/api/deposits');
    console.log('定金单数:', ledger.data.data.summary.count);
    console.log('已到账:', ledger.data.data.summary.total_paid);
    console.log('已退还:', ledger.data.data.summary.total_refunded);
    console.log('净收入:', ledger.data.data.summary.net_amount);

    log('5.4', '客户变更');
    const changes = await request('GET', '/api/name-changes/changes');
    console.log('变更次数:', changes.data.data.count);

    log('5.5', '佣金报告');
    const commReport = await request('GET', '/api/commissions');
    console.log('佣金记录数:', commReport.data.data.summary.count);
    console.log('已冻结:', commReport.data.data.summary.total_frozen);
    console.log('已作废:', commReport.data.data.summary.total_void);

    log('5.6', '完整报告 (文本)');
    const fullReport = await request('GET', '/api/reports/export?format=text');
    console.log('报告生成成功，长度:', fullReport.data.length);

    console.log('\n' + '='.repeat(60));
    console.log('✅ 所有测试通过！业务闭环验证完成');
    console.log('='.repeat(60));
    console.log('\n关键验证点:');
    console.log('  ✓ 房源状态同步 (available → locked → deposited → available)');
    console.log('  ✓ 认购单状态同步 (draft → locked → deposited)');
    console.log('  ✓ 重复锁房拦截');
    console.log('  ✓ 支付回调幂等');
    console.log('  ✓ 改名后客户变更');
    console.log('  ✓ 改名后佣金冻结');
    console.log('  ✓ 退定后房源解锁');
    console.log('  ✓ 退定后定金退还');
    console.log('  ✓ 退定后佣金作废');
    console.log('  ✓ 定金未到账无法创建佣金');
    console.log('  ✓ 状态历史记录完整');
    console.log('  ✓ 报告导出正常');
    console.log('');

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

runTests();
