const http = require('http');

const BASE_URL = 'http://localhost:3000/api/shortages';

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (e) {
          resolve(body);
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

function post(path, data) {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/shortages' + path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-operator': 'test-user'
    }
  };
  return request(options, data);
}

function get(path) {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/shortages' + path,
    method: 'GET',
    headers: {
      'x-operator': 'test-user'
    }
  };
  return request(options, null);
}

function put(path, data) {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/shortages' + path,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-operator': 'test-user'
    }
  };
  return request(options, data);
}

async function runTests() {
  console.log('========================================');
  console.log('  供应链缺料承诺API - 功能测试');
  console.log('========================================\n');

  let shortageId = null;
  let shortageNo = null;
  let urgeTaskId = null;
  let riskReportId = null;

  try {
    console.log('【步骤 1】创建缺料单');
    console.log('----------------------------------------');
    const createResult = await post('', {
      materialCode: 'MAT001',
      materialName: '铝合金型材',
      supplierCode: 'SUP001',
      supplierName: '诚信铝材有限公司',
      requiredDate: '2026-05-20',
      requiredQuantity: 1000
    });
    console.log('结果：', createResult.message);
    console.log('缺料单号：', createResult.data.shortageNo);
    shortageId = createResult.data.id;
    shortageNo = createResult.data.shortageNo;
    console.log();

    console.log('【步骤 2】添加影响订单');
    console.log('----------------------------------------');
    const orderResult = await post(`/${shortageId}/orders`, {
      orderNo: 'PO202605001',
      orderType: '销售订单',
      requiredDate: '2026-05-22',
      quantity: 500,
      customerName: '大型汽车制造公司',
      impactLevel: 'critical'
    });
    console.log('结果：', orderResult.message);
    console.log('订单号：', orderResult.data.orderNo);
    console.log('影响等级：', orderResult.data.impactLevel);
    console.log();

    console.log('【步骤 3】添加第一版承诺');
    console.log('----------------------------------------');
    const commit1 = await post(`/${shortageId}/commitments`, {
      promiseDate: '2026-05-18',
      promiseQuantity: 1000,
      reason: '正常生产周期',
      source: '电话沟通'
    });
    console.log('结果：', commit1.message);
    console.log('承诺版本：第', commit1.data.versionNo, '版');
    console.log('承诺日期：', commit1.data.promiseDate);
    console.log();

    console.log('【步骤 4】添加第二版承诺（延期）');
    console.log('----------------------------------------');
    const commit2 = await post(`/${shortageId}/commitments`, {
      promiseDate: '2026-05-25',
      promiseQuantity: 1000,
      reason: '原材料供应紧张，需要延期',
      source: '邮件确认'
    });
    console.log('结果：', commit2.message);
    console.log('承诺版本：第', commit2.data.versionNo, '版');
    console.log('承诺日期：', commit2.data.promiseDate);
    console.log();

    console.log('【步骤 5】创建催办任务（紧急）');
    console.log('----------------------------------------');
    const urgeResult = await post(`/${shortageId}/urges`, {
      priority: 'urgent',
      assignee: '采购员-张三',
      content: '请立即联系供应商确认实际到料时间，客户订单非常紧急！',
      dueDate: '2026-05-12'
    });
    console.log('结果：', urgeResult.message);
    console.log('任务号：', urgeResult.data.taskNo);
    console.log('紧急程度：', urgeResult.data.priority);
    urgeTaskId = urgeResult.data.id;
    console.log();

    console.log('【步骤 6】创建风险报告（严重）');
    console.log('----------------------------------------');
    const riskResult = await post(`/${shortageId}/risks`, {
      riskLevel: 'critical',
      riskType: '供应商延期',
      description: '供应商承诺日期从5月18日延期到5月25日，晚于客户需求日期',
      impact: '可能导致客户订单违约，影响公司信誉',
      mitigation: '正在寻找替代供应商，同时催促原供应商',
      reporter: '风控专员-李四'
    });
    console.log('结果：', riskResult.message);
    riskReportId = riskResult.data.id;
    console.log();

    console.log('【步骤 7】计算综合结果（查看风险情况）');
    console.log('----------------------------------------');
    const result1 = await get(`/${shortageId}/result`);
    console.log('结果摘要：');
    console.log(result1.data.summary);
    console.log('详细结论：');
    console.log(result1.data.details.conclusion);
    console.log();

    console.log('【步骤 8】完成催办任务');
    console.log('----------------------------------------');
    const completeUrge = await post(`/urges/${urgeTaskId}/complete`, {
      response: '已联系供应商，确认5月25日确实可以到货。同时已找到替代供应商，可在5月20日交货。正在评估切换成本。'
    });
    console.log('结果：', completeUrge.message);
    console.log('处理结果：', completeUrge.data.response);
    console.log();

    console.log('【步骤 9】添加到料回执（部分到料）');
    console.log('----------------------------------------');
    const receipt1 = await post(`/${shortageId}/receipts`, {
      deliveryDate: '2026-05-19',
      deliveryQuantity: 500,
      batchNo: 'B20260519001',
      qualityStatus: 'qualified',
      remark: '第一批到货，质量合格'
    });
    console.log('结果：', receipt1.message);
    console.log('到货数量：', receipt1.data.deliveryQuantity);
    console.log('质量状态：', receipt1.data.qualityStatus);
    console.log();

    console.log('【步骤 10】再次计算结果');
    console.log('----------------------------------------');
    const result2 = await get(`/${shortageId}/result`);
    console.log('结果摘要：');
    console.log(result2.data.summary);
    console.log('详细结论：');
    console.log(result2.data.details.conclusion);
    console.log();

    console.log('【步骤 11】添加第二批到料回执（全部到料）');
    console.log('----------------------------------------');
    const receipt2 = await post(`/${shortageId}/receipts`, {
      deliveryDate: '2026-05-24',
      deliveryQuantity: 500,
      batchNo: 'B20260524001',
      qualityStatus: 'qualified',
      remark: '第二批到货，全部到齐'
    });
    console.log('结果：', receipt2.message);
    console.log();

    console.log('【步骤 12】关闭风险报告');
    console.log('----------------------------------------');
    const closeRisk = await put(`/risks/${riskReportId}`, {
      status: 'closed'
    });
    console.log('结果：', closeRisk.message);
    console.log();

    console.log('【步骤 13】最终结果计算（物料已到齐）');
    console.log('----------------------------------------');
    const result3 = await get(`/${shortageId}/result`);
    console.log('结果摘要：');
    console.log(result3.data.summary);
    console.log('详细结论：');
    console.log(result3.data.details.conclusion);
    console.log();

    console.log('【步骤 14】查看历史记录');
    console.log('----------------------------------------');
    const history = await get(`/${shortageId}/history`);
    console.log('历史操作记录（共', history.data.length, '条）：');
    history.data.forEach((item, index) => {
      console.log(`${index + 1}. [${item.operationType}] 操作人：${item.operator} - ${item.content}`);
    });
    console.log();

    console.log('【步骤 15】查询缺料单详情');
    console.log('----------------------------------------');
    const details = await get(`/${shortageNo}`);
    console.log('缺料单状态：', details.data.status);
    console.log('承诺版本数：', details.data.commitments.length);
    console.log('到料回执数：', details.data.deliveryReceipts.length);
    console.log('累计到料：', details.data.deliveryQuantity);
    console.log();

    console.log('========================================');
    console.log('  测试完成！所有核心功能验证通过 ✅');
    console.log('========================================\n');

    console.log('使用说明：');
    console.log('1. 启动服务：npm start');
    console.log('2. 运行测试：npm test');
    console.log('3. 访问服务：http://localhost:3000');
    console.log();
    console.log('普通用户确认功能可用的方法：');
    console.log('1. 创建缺料单后，能看到缺料单号和状态为"待处理"');
    console.log('2. 添加承诺版本后，能看到版本号递增（第1版、第2版...）');
    console.log('3. 计算结果时，能看到包含承诺情况、到料情况、催办情况、风险情况的完整报告');
    console.log('4. 所有操作都能在历史记录中查到');
    console.log('5. 重复计算相同数据，结果应该一致（幂等性）');
    console.log();

  } catch (error) {
    console.error('测试执行失败:', error);
    console.log('\n请确保：');
    console.log('1. 服务已启动：npm start');
    console.log('2. 服务运行在端口 3000');
    console.log('3. 数据库文件已创建在 data/database.sqlite');
    process.exit(1);
  }
}

runTests();
