const http = require('http');

const BASE_URL = 'http://localhost:3000/api';
const OPERATOR = 'demo_user';

const request = (path, method = 'GET', data = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Operator': OPERATOR
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
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
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runDemo() {
  console.log('========================================');
  console.log('  数据集签收API - 样例演示脚本');
  console.log('========================================\n');

  try {
    console.log('1. 健康检查...');
    const health = await request('/health');
    console.log('   结果:', JSON.stringify(health, null, 2), '\n');

    await delay(500);

    console.log('2. 创建下游项目...');
    const project1 = await request('/downstream-projects', 'POST', {
      project_name: '推荐系统_v2',
      owner: 'wangwu',
      contact_email: 'wangwu@example.com',
      description: '核心推荐模型'
    });
    console.log('   项目1:', JSON.stringify(project1, null, 2));

    const project2 = await request('/downstream-projects', 'POST', {
      project_name: '搜索排序模型',
      owner: 'zhaoliu',
      description: '搜索排序用模型'
    });
    console.log('   项目2:', JSON.stringify(project2, null, 2), '\n');

    await delay(500);

    console.log('3. 查询所有下游项目...');
    const projects = await request('/downstream-projects');
    console.log('   结果:', JSON.stringify(projects, null, 2), '\n');

    await delay(500);

    console.log('4. 创建数据集版本(草稿)...');
    const datasetVersion = await request('/dataset-versions', 'POST', {
      dataset_name: 'user_behavior_dataset',
      version: '20240501_v2',
      publisher: 'data_team',
      change_summary: '新增用户点击行为特征,修复数据偏差',
      change_details: '1. 新增click_7d特征字段; 2. 修复曝光数据统计偏差; 3. 数据量: 500万条'
    });
    console.log('   结果:', JSON.stringify(datasetVersion, null, 2), '\n');

    await delay(500);

    const datasetVersionId = datasetVersion.id;

    console.log('5. 发布数据集版本...');
    const publishResult = await request(`/dataset-versions/${datasetVersionId}/publish`, 'POST');
    console.log('   结果:', JSON.stringify(publishResult, null, 2), '\n');

    await delay(500);

    console.log('6. 为下游项目创建签收任务...');
    const ack1 = await request('/acknowledgments', 'POST', {
      dataset_version_id: datasetVersionId,
      project_id: project1.id,
      assignee: 'wangwu',
      deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    });
    console.log('   签收任务1:', JSON.stringify(ack1, null, 2));

    const ack2 = await request('/acknowledgments', 'POST', {
      dataset_version_id: datasetVersionId,
      project_id: project2.id,
      assignee: 'zhaoliu',
      deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
    });
    console.log('   签收任务2:', JSON.stringify(ack2, null, 2), '\n');

    await delay(500);

    console.log('7. 第一个项目执行签收...');
    const acknowledgeResult = await request(`/acknowledgments/${ack1.id}/acknowledge`, 'POST', {
      acknowledgment_note: '已完成数据验证,效果符合预期,可以使用'
    });
    console.log('   结果:', JSON.stringify(acknowledgeResult, null, 2), '\n');

    await delay(500);

    console.log('8. 查询所有签收任务...');
    const acknowledgments = await request('/acknowledgments');
    console.log('   结果:', JSON.stringify(acknowledgments, null, 2), '\n');

    await delay(500);

    console.log('9. 第二个项目申请回退...');
    const rollbackRequest = await request('/rollback-requests', 'POST', {
      dataset_version_id: datasetVersionId,
      project_id: project2.id,
      requester: 'zhaoliu',
      reason: '新数据集在搜索场景下AUC下降5%,需要回退到上一版本'
    });
    console.log('   结果:', JSON.stringify(rollbackRequest, null, 2), '\n');

    await delay(500);

    console.log('10. 审批回退申请...');
    const approvalResult = await request(`/rollback-requests/${rollbackRequest.id}/approve`, 'POST', {
      approver: 'data_manager',
      approval_note: '同意回退,请排查数据质量问题',
      approved: true
    });
    console.log('   结果:', JSON.stringify(approvalResult, null, 2), '\n');

    await delay(500);

    console.log('11. 生成签收报告...');
    const reportResult = await request(`/reports/acknowledgment/${datasetVersionId}`, 'POST');
    console.log('   结果:', JSON.stringify(reportResult, null, 2), '\n');

    await delay(500);

    console.log('12. 查询数据集版本操作日志(追溯)...');
    const logs = await request(`/operation-logs/dataset_version/${datasetVersionId}`);
    console.log('   操作日志数量:', logs.data.length);
    console.log('   最新操作:', JSON.stringify(logs.data[0], null, 2), '\n');

    await delay(500);

    console.log('13. 人工修正签收任务状态(模拟异常处理)...');
    const manualCorrectResult = await request(`/acknowledgments/${ack2.id}/manual-correct`, 'POST', {
      operator: 'admin',
      correction_reason: '已线下确认接收,补录签收状态',
      updates: {
        status: 'acknowledged',
        acknowledgment_note: '线下确认后人工补录,补录人: admin'
      }
    });
    console.log('   结果:', JSON.stringify(manualCorrectResult, null, 2), '\n');

    await delay(500);

    console.log('14. 再次查询签收任务验证修正结果...');
    const updatedAck = await request(`/acknowledgments/${ack2.id}`);
    console.log('   结果:', JSON.stringify(updatedAck, null, 2), '\n');

    await delay(500);

    console.log('15. 导出签收报告数据...');
    const exportResult = await request(`/export/acknowledgment/${datasetVersionId}`);
    console.log('   导出统计:', {
      总签收任务: exportResult.stats.total,
      已签收: exportResult.stats.acknowledged,
      待处理: exportResult.stats.pending,
      已超时: exportResult.stats.timeout
    }, '\n');

    console.log('========================================');
    console.log('  样例演示完成!');
    console.log('========================================');
    console.log('\n关键流程已覆盖:');
    console.log('✓ 数据集版本发布');
    console.log('✓ 下游项目签收');
    console.log('✓ 回退申请与审批');
    console.log('✓ 操作日志追溯');
    console.log('✓ 人工修正异常');
    console.log('✓ 签收报告导出');

  } catch (error) {
    console.error('演示出错:', error.message);
    console.log('\n提示: 请先启动服务 (npm start)');
  }
}

runDemo();
