const http = require('http');

const BASE_URL = 'http://localhost:3000';

const makeRequest = (method, path, data = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ status: res.statusCode, data: parsed });
          } else {
            reject({ status: res.statusCode, error: parsed });
          }
        } catch (e) {
          reject({ status: res.statusCode, error: { message: body } });
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

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const runDemo = async () => {
  console.log('========================================');
  console.log('  土地流转合同履约 API 演示脚本');
  console.log('========================================\n');

  try {
    await makeRequest('GET', '/');
    console.log('[OK] 服务已启动\n');
  } catch (e) {
    console.log('[ERROR] 请先运行: npm install && npm start');
    process.exit(1);
  }

  let contractId = null;
  let rentPlanIds = [];

  console.log('--- 步骤 1: 创建合同 ---');
  const contractData = {
    contract_no: 'TEST-001',
    parties: {
      transferor: '张三',
      transferee: '李四'
    },
    start_date: '2024-01-01',
    end_date: '2026-01-01',
    land_plots: [
      { plot_no: 'P1', area: 50.5, location: '东村一组' },
      { plot_no: 'P2', area: 30.0, location: '东村二组' }
    ],
    rent_plans: [
      { period_start: '2024-01-01', period_end: '2025-01-01', amount: 10100 },
      { period_start: '2025-01-01', period_end: '2026-01-01', amount: 10100 }
    ]
  };

  try {
    const result = await makeRequest('POST', '/contracts', contractData);
    contractId = result.data.id;
    rentPlanIds = result.data.rent_plans.map(p => p.id);
    console.log('合同创建成功,ID:', contractId);
    console.log('总 面 积:', result.data.total_area, '亩');
    console.log('总租金:', result.data.total_rent, '元');
    console.log('当前版本:', result.data.current_version);
  } catch (e) {
    console.log('创建失败:', e.error?.message || e);
    process.exit(1);
  }

  console.log('\n--- 步骤 2: 支付第一期租金 ---');
  try {
    const result = await makeRequest('POST', `/contracts/${contractId}/rent/pay`, {
      plan_id: rentPlanIds[0],
      amount: 10100
    });
    console.log('租金支付成功:', result.data.paid_at);
  } catch (e) {
    console.log('支付失败:', e.error?.message || e);
  }

  console.log('\n--- 步骤 3: 验证并发支付保护 ---');
  console.log('尝试再次支付同一期租金...');
  try {
    await makeRequest('POST', `/contracts/${contractId}/rent/pay`, {
      plan_id: rentPlanIds[0],
      amount: 10100
    });
    console.log('[警告] 本应该失败但成功了!');
  } catch (e) {
    console.log('[OK] 并发保护生效:', e.error?.message);
  }

  console.log('\n--- 步骤 4: 调整合同(面积和租金变更) ---');
  const updateData = {
    parties: {
      transferor: '张三',
      transferee: '李四'
    },
    start_date: '2024-01-01',
    end_date: '2026-01-01',
    land_plots: [
      { plot_no: 'P1', area: 60.0, location: '东村一组' },
      { plot_no: 'P2', area: 30.0, location: '东村二组' },
      { plot_no: 'P3', area: 20.0, location: '东村三组' }
    ],
    rent_plans: [
      { period_start: '2024-01-01', period_end: '2025-01-01', amount: 11000 },
      { period_start: '2025-01-01', period_end: '2026-01-01', amount: 11000 }
    ]
  };

  try {
    const result = await makeRequest('PUT', `/contracts/${contractId}`, updateData);
    rentPlanIds = result.data.rent_plans.map(p => p.id);
    console.log('合同更新成功!');
    console.log('新版本:', result.data.current_version);
    console.log('新面积:', result.data.total_area, '亩');
    console.log('新总租金:', result.data.total_rent, '元');
  } catch (e) {
    console.log('更新失败:', e.error?.message || e);
  }

  console.log('\n--- 步骤 5: 查看合同版本历史 ---');
  try {
    const result = await makeRequest('GET', `/contracts/${contractId}/versions`);
    console.log('版本数量:', result.data.length);
    result.data.forEach((v, i) => {
      console.log(`  版本${v.version}: 面积=${v.total_area}亩, 租金=${v.total_rent}元, 时间=${v.created_at}`);
    });
  } catch (e) {
    console.log('查询失败:', e.error?.message || e);
  }

  console.log('\n--- 步骤 6: 创建续签申请 ---');
  let renewalId = null;
  try {
    const result = await makeRequest('POST', `/contracts/${contractId}/renewals`, {
      requested_end_date: '2028-01-01',
      new_rent: 25000
    });
    renewalId = result.data.id;
    console.log('续签申请创建成功,ID:', renewalId);
    console.log('申请状态:', result.data.status);
  } catch (e) {
    console.log('申请失败:', e.error?.message || e);
  }

  console.log('\n--- 步骤 7: 审批续签 ---');
  try {
    const result = await makeRequest('POST', `/renewals/${renewalId}/approve`, {
      approved_by: '管理员'
    });
    console.log('续签审批通过!');
    console.log('新版本:', result.data.contract.current_version);
    console.log('新到期日:', result.data.contract.end_date);
  } catch (e) {
    console.log('审批失败:', e.error?.message || e);
  }

  console.log('\n--- 步骤 8: 记录违约提醒 ---');
  let breachId = null;
  try {
    const result = await makeRequest('POST', `/contracts/${contractId}/breaches`, {
      type: 'rent_overdue',
      description: '第二期租金逾期未支付'
    });
    breachId = result.data.id;
    console.log('违约提醒创建成功,ID:', breachId);
  } catch (e) {
    console.log('创建失败:', e.error?.message || e);
  }

  console.log('\n--- 步骤 9: 查看履约汇总 ---');
  try {
    const result = await makeRequest('GET', '/performance');
    const contract = result.data.find(c => c.contract_id === contractId);
    console.log('合同状态:', contract.status);
    console.log('履约状态:', contract.performance_status);
    console.log('未付租金期数:', contract.unpaid_rent_count);
    console.log('未解决违约:', contract.unresolved_breach_count);
  } catch (e) {
    console.log('查询失败:', e.error?.message || e);
  }

  console.log('\n--- 步骤 10: 解决违约 ---');
  try {
    await makeRequest('POST', `/breaches/${breachId}/resolve`);
    console.log('违约已标记为解决');
  } catch (e) {
    console.log('解决失败:', e.error?.message || e);
  }

  console.log('\n--- 步骤 11: 导出完整履约报告 ---');
  try {
    const result = await makeRequest('GET', `/contracts/${contractId}/performance/export`);
    console.log('导出时间:', result.data.export_time);
    console.log('合同版本数:', result.data.performance_history.length);
    console.log('违约记录数:', result.data.breach_history.length);
    console.log('续签记录数:', result.data.renewal_history.length);
    console.log('租金支付情况:');
    result.data.rent_status.plans.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.period} - ${p.status} (${p.amount}元)`);
    });
  } catch (e) {
    console.log('导出失败:', e.error?.message || e);
  }

  console.log('\n--- 步骤 12: 验证数据持久化 ---');
  console.log('重启服务后,访问以下地址验证数据:');
  console.log(`  合同详情: GET ${BASE_URL}/contracts/${contractId}`);
  console.log(`  版本历史: GET ${BASE_URL}/contracts/${contractId}/versions`);
  console.log(`  履约导出: GET ${BASE_URL}/contracts/${contractId}/performance/export`);
  console.log(`  汇总列表: GET ${BASE_URL}/performance`);

  console.log('\n========================================');
  console.log('  演示完成!');
  console.log('========================================');
};

runDemo().catch(console.error);
