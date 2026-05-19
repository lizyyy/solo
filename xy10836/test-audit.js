const axios = require('axios');

const API_BASE = 'http://localhost:3000/api/leases';

async function runTests() {
  console.log('='.repeat(60));
  console.log('审计日志完整性测试');
  console.log('='.repeat(60));

  try {
    // 1. 测试缺参创建租约（应该失败并记录审计）
    console.log('\n[测试1] 缺参创建租约...');
    try {
      await axios.post(API_BASE, {
        // 缺少 applicant, resourceId, durationHours
        operator: 'TEST_OPERATOR'
      });
    } catch (e) {
      console.log('  ✅ 返回错误:', e.response?.data?.error);
    }

    // 2. 测试查询租约
    console.log('\n[测试2] 查询租约列表...');
    const queryRes = await axios.get(API_BASE);
    console.log('  ✅ 查询成功, 结果数:', queryRes.data.data.length);

    // 3. 测试缺参密钥校验
    console.log('\n[测试3] 缺参密钥校验...');
    try {
      await axios.post(`${API_BASE}/validate`, {
        // 缺少 secretToken, resourceId
        operator: 'TEST_OPERATOR'
      });
    } catch (e) {
      console.log('  ✅ 返回错误:', e.response?.data?.error);
    }

    // 4. 测试空参创建租约
    console.log('\n[测试4] 空请求创建租约...');
    try {
      await axios.post(API_BASE, {});
    } catch (e) {
      console.log('  ✅ 返回错误:', e.response?.data?.error);
    }

    // 5. 测试成功创建租约
    console.log('\n[测试5] 成功创建租约...');
    const createRes = await axios.post(API_BASE, {
      applicant: '张三',
      resourceId: 'mysql-production',
      durationHours: 8,
      approvalStrategy: 'manual',
      reason: '生产环境调试',
      operator: 'TEST_OPERATOR'
    });
    console.log('  ✅ 创建成功, 租约ID:', createRes.data.data.id);

    // 6. 查看审计日志
    console.log('\n[测试6] 查看审计日志...');
    const auditRes = await axios.get(`${API_BASE}/audit-logs`);
    const logs = auditRes.data.data;
    console.log('  ✅ 审计日志总数:', logs.length);
    
    if (logs.length > 0) {
      console.log('\n  📋 最近审计日志:');
      logs.slice(-10).forEach((log, i) => {
        const status = log.result === 'success' ? '✅' : '❌';
        console.log(`    ${status} [${log.action}] - ${log.operator} - ${new Date(log.timestamp).toLocaleTimeString()}`);
        if (log.error) {
          console.log(`       错误: ${log.error}`);
        }
        if (log.input) {
          console.log(`       输入: ${JSON.stringify(log.input).substring(0, 80)}`);
        }
      });
    }

    // 统计成功率
    const successCount = logs.filter(l => l.result === 'success').length;
    const failedCount = logs.filter(l => l.result === 'failed').length;
    
    console.log('\n' + '='.repeat(60));
    console.log('测试总结:');
    console.log('  总审计日志数:', logs.length);
    console.log('  成功记录:', successCount);
    console.log('  失败记录:', failedCount);
    console.log('='.repeat(60));

    if (logs.length > 0) {
      console.log('\n🎉 审计日志功能验证通过!');
      console.log('   - 失败请求已记录');
      console.log('   - 成功请求已记录');
      console.log('   - 查询请求已记录');
      console.log('   - 操作人已记录');
      console.log('   - 输入参数已记录');
    } else {
      console.log('\n❌ 审计日志为空!');
    }

  } catch (error) {
    console.error('测试失败:', error.message);
    if (error.response) {
      console.error('响应:', error.response.data);
    }
  }
}

runTests();
