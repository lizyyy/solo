const http = require('http');

const BASE_URL = 'http://localhost:3000';

function request(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(body)
          });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runNormalTest() {
  console.log('='.repeat(60));
  console.log('正常流程测试 - 数据血缘服务字段下线订阅通知');
  console.log('='.repeat(60));
  console.log('');

  try {
    console.log('步骤 1: 检查服务健康状态');
    const health = await request('/health');
    console.log('  状态码:', health.status);
    console.log('  结果:', health.data.success ? '服务正常' : '服务异常');
    console.log('');

    console.log('步骤 2: 批量导入血缘影响（字段改名场景）');
    const importData = {
      records: [
        {
          tableName: 'user_profile',
          fieldName: 'old_phone',
          downstreamTask: 'daily_report_job',
          notifier: 'zhangsan@example.com',
          notes: '字段改名为new_phone'
        },
        {
          tableName: 'user_profile',
          fieldName: 'old_phone',
          downstreamTask: 'user_analytics',
          notifier: 'lisi@example.com',
          notes: '用户分析任务'
        },
        {
          tableName: 'order_info',
          fieldName: 'legacy_amount',
          downstreamTask: 'monthly_statistics',
          notifier: 'wangwu@example.com',
          notes: '任务已停用'
        }
      ]
    };
    const importResult = await request('/api/deprecation/import', 'POST', importData);
    console.log('  状态码:', importResult.status);
    console.log('  导入总数:', importResult.data.data.total);
    console.log('  成功:', importResult.data.data.success);
    console.log('  失败:', importResult.data.data.failed);
    
    const records = importResult.data.data.results.filter(r => r.success).map(r => r.data);
    console.log('  生成记录数:', records.length);
    console.log('');

    console.log('步骤 3: 逐个确认下线通知');
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const confirmResult = await request(`/api/deprecation/${record.id}/confirm`, 'POST', {
        confirmedBy: `${record.notifier}`,
        notes: `已确认第${i + 1}条`
      });
      console.log(`  记录${i + 1} (${record.downstreamTask}):`);
      console.log('    状态码:', confirmResult.status);
      console.log('    新状态:', confirmResult.data.data.status);
      console.log('    确认人:', confirmResult.data.data.confirmedBy);
    }
    console.log('');

    console.log('步骤 4: 发布校验（全部确认后）');
    const validateResult = await request(
      `/api/deprecation/validate-publish?tableName=user_profile&fieldName=old_phone`
    );
    console.log('  状态码:', validateResult.status);
    console.log('  可发布:', validateResult.data.data.canPublish);
    console.log('  未确认数量:', validateResult.data.data.unconfirmedCount);
    console.log('');

    console.log('步骤 5: 查看统计信息');
    const stats = await request('/api/deprecation/statistics');
    console.log('  总记录数:', stats.data.data.total);
    console.log('  待确认:', stats.data.data.pending);
    console.log('  已确认:', stats.data.data.confirmed);
    console.log('  已撤回:', stats.data.data.revoked);
    console.log('');

    console.log('步骤 6: 查询所有记录');
    const allRecords = await request('/api/deprecation');
    console.log('  返回记录数:', allRecords.data.data.length);
    console.log('');

    console.log('步骤 7: 导出CSV');
    const exportResult = await request('/api/deprecation/export');
    console.log('  状态码:', exportResult.status);
    console.log('  导出成功:', exportResult.status === 200 ? '是' : '否');
    console.log('');

    console.log('='.repeat(60));
    console.log('正常流程测试完成！');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('测试失败:', error.message);
    console.error('请确保服务已启动: npm start');
    process.exit(1);
  }
}

runNormalTest();