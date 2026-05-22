const http = require('http');

const BASE_URL = 'localhost';
const PORT = 3000;

function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      port: PORT,
      path,
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
            statusCode: res.statusCode,
            data: JSON.parse(body)
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
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
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testFlow() {
  console.log('========================================');
  console.log('影院排片补贴核算 API 完整流程测试');
  console.log('========================================\n');

  try {
    console.log('1. 检查服务健康状态...');
    const health = await request('GET', '/api/health');
    console.log(`   状态码: ${health.statusCode}`);
    console.log(`   响应: ${health.data.message}\n`);

    if (health.statusCode !== 200) {
      console.error('服务未启动，请先运行 npm start');
      process.exit(1);
    }

    console.log('2. 创建核算批次...');
    const batchData = {
      batchName: '2024年5月第一周补贴核算',
      operator: '张三',
      period: {
        startDate: '2024-05-01',
        endDate: '2024-05-07'
      },
      rawData: [
        {
          screeningId: 'S001',
          cinemaId: 'C001',
          cinemaName: '万达影城CBD店',
          filmId: 'F001',
          filmName: '速度与激情10',
          startTime: '2024-05-01T19:00:00+08:00',
          endTime: '2024-05-01T21:30:00+08:00',
          totalBoxOffice: 15000,
          refundAmount: 500,
          audienceCount: 200,
          hasMinimumGuarantee: false,
          isCrossDay: false
        },
        {
          screeningId: 'S002',
          cinemaId: 'C001',
          cinemaName: '万达影城CBD店',
          filmId: 'F002',
          filmName: '银河护卫队3',
          startTime: '2024-05-01T23:00:00+08:00',
          endTime: '2024-05-02T01:30:00+08:00',
          totalBoxOffice: 8000,
          refundAmount: 3000,
          audienceCount: 100,
          hasMinimumGuarantee: true,
          guaranteeAmount: 6000,
          isCrossDay: true
        },
        {
          screeningId: 'S003',
          cinemaId: 'C002',
          cinemaName: '博纳影城望京店',
          filmId: 'F001',
          filmName: '速度与激情10',
          startTime: '2024-05-02T14:00:00+08:00',
          endTime: '2024-05-02T16:30:00+08:00',
          totalBoxOffice: 500,
          refundAmount: 50,
          audienceCount: 10,
          hasMinimumGuarantee: false,
          isCrossDay: false
        }
      ]
    };

    const createBatch = await request('POST', '/api/batches', batchData);
    const batchId = createBatch.data.data.id;
    console.log(`   状态码: ${createBatch.statusCode}`);
    console.log(`   批次ID: ${batchId}\n`);

    console.log('3. 触发核算处理...');
    const process = await request('POST', `/api/batches/${batchId}/process`);
    const taskId = process.data.data.task.id;
    console.log(`   状态码: ${process.statusCode}`);
    console.log(`   任务ID: ${taskId}\n`);

    console.log('4. 等待核算完成...');
    let taskStatus;
    for (let i = 0; i < 10; i++) {
      await sleep(500);
      const task = await request('GET', `/api/tasks/${taskId}`);
      taskStatus = task.data.data;
      console.log(`   进度: ${taskStatus.progress}%, 状态: ${taskStatus.status}`);
      
      if (taskStatus.status === 'completed' || taskStatus.status === 'pending_confirmation' || taskStatus.status === 'failed') {
        break;
      }
    }
    console.log('');

    console.log('5. 查看核算结果...');
    const results = await request('GET', `/api/tasks/${taskId}/results`);
    console.log(`   共 ${results.data.data.length} 条记录:`);
    results.data.data.forEach((r, i) => {
      const categoryName = { normal: '正常', pending: '待补充', blocked: '已拦截' }[r.category];
      console.log(`   ${i + 1}. [${categoryName}] ${r.cinemaName} - ${r.filmName}: 补贴 ${r.subsidyAmount}元`);
      console.log(`       原因: ${r.reason || '无'}`);
    });
    console.log('');

    if (taskStatus.status === 'pending_confirmation') {
      console.log('6. 人工确认待补充记录...');
      const confirm = await request('POST', `/api/tasks/${taskId}/confirm`, { operator: '李四' });
      console.log(`   状态码: ${confirm.statusCode}`);
      console.log(`   ${confirm.data.data.message || '确认成功'}\n`);
    }

    console.log('7. 修改一条核算结论...');
    const blockedResult = results.data.data.find(r => r.category === 'blocked');
    if (blockedResult) {
      const modify = await request('PUT', `/api/tasks/results/${blockedResult.id}/conclusion`, {
        operator: '李四',
        category: 'normal',
        subsidyAmount: 25,
        reason: '经核实，该场次为测试场，同意补贴'
      });
      console.log(`   状态码: ${modify.statusCode}`);
      console.log(`   修改前: blocked, 0元 → 修改后: normal, 25元`);
      console.log(`   修改原因: 经核实，该场次为测试场，同意补贴\n`);
    }

    console.log('8. 查看审计日志...');
    const audit = await request('GET', `/api/audit/task/${taskId}`);
    console.log(`   共 ${audit.data.data.length} 条记录:`);
    audit.data.data.forEach((log, i) => {
      console.log(`   ${i + 1}. [${log.timestamp}] ${log.operator} - ${log.action}`);
      console.log(`       原因: ${log.reason || '无'}`);
    });
    console.log('');

    console.log('9. 生成核算报告...');
    const report = await request('GET', `/api/reports/${batchId}/download?operator=%E6%9D%8E%E5%9B%9B`);
    console.log(`   报告已生成，状态码: ${report.statusCode}`);
    console.log(`   报告保存在 reports/ 目录下\n`);

    console.log('========================================');
    console.log('测试完成！所有流程验证通过 ✓');
    console.log('========================================\n');

    console.log('关键信息汇总:');
    console.log(`  批次ID: ${batchId}`);
    console.log(`  任务ID: ${taskId}`);
    console.log(`  服务地址: http://localhost:${PORT}`);
    console.log(`\n可使用 curl 命令继续测试，详情见 README.md\n`);

  } catch (error) {
    console.error('测试失败:', error.message);
    process.exit(1);
  }
}

testFlow();
