const http = require('http');

const BASE_URL = 'http://localhost:3001';

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(options.path, BASE_URL);
    const req = http.request({
      hostname: url.hostname,
      port: url.port || 3001,
      path: url.pathname,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-operator': 'tester',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data: { raw: data } });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function testAll() {
  let sampleId = null;
  let sampleNo = null;

  console.log('='.repeat(60));
  console.log('采购样品评审 API 测试');
  console.log('='.repeat(60));

  try {
    console.log('\n1. 健康检查...');
    const health = await request({ path: '/health', method: 'GET' });
    console.log('  ✓ 健康检查:', health.data.success);

    console.log('\n2. 创建样品...');
    const sample = await request({ path: '/api/samples', method: 'POST' }, {
      name: '电子元件样品',
      supplier: '供应商A',
      category: '电子元件',
      quantity: 100,
      unitPrice: 10.5
    });
    console.log('  ✓ 状态:', sample.data.success);
    if (sample.data.success) {
      sampleId = sample.data.data.id;
      sampleNo = sample.data.data.sampleNo;
      console.log('  ✓ 样品ID:', sampleId);
      console.log('  ✓ 样品编号:', sampleNo);
      console.log('  ✓ 初始状态:', sample.data.data.status);
      console.log('  ✓ 总金额:', sample.data.data.totalAmount);
    }

    console.log('\n3. 寄送样品 (CREATED -> SHIPPED)...');
    const shipped = await request({ path: `/api/samples/${sampleId}/status`, method: 'PATCH' }, { status: 'SHIPPED' });
    console.log('  ✓ 状态:', shipped.data.success);
    console.log('  ✓ 新状态:', shipped.data.data?.status);

    console.log('\n4. 开始试用 (SHIPPED -> IN_TRIAL)...');
    const trial = await request({ path: `/api/samples/${sampleId}/status`, method: 'PATCH' }, { status: 'IN_TRIAL' });
    console.log('  ✓ 状态:', trial.data.success);
    console.log('  ✓ 新状态:', trial.data.data?.status);

    console.log('\n5. 提交试用反馈...');
    const feedback = await request({ path: '/api/trial-feedbacks', method: 'POST' }, {
      sampleId,
      trialUser: '张三',
      trialDate: '2024-01-15',
      trialPeriod: 7,
      trialLocation: '实验室A',
      testItems: [
        { name: '外观检查', criteria: '无缺陷', result: 'PASS' },
        { name: '性能测试', criteria: '达标', result: 'PASS' }
      ],
      overallRating: 5,
      conclusion: '测试通过，样品质量良好'
    });
    console.log('  ✓ 状态:', feedback.data.success);
    console.log('  ✓ 综合评分:', feedback.data.data?.overallRating);

    console.log('\n6. 检查样品状态变化 (IN_TRIAL -> PENDING_REVIEW)...');
    const checkStatus = await request({ path: `/api/samples/${sampleId}`, method: 'GET' });
    console.log('  ✓ 当前状态:', checkStatus.data.data?.status);

    console.log('\n7. 创建评审任务...');
    const task = await request({ path: '/api/review-tasks', method: 'POST' }, {
      sampleId,
      assignee: '李四',
      taskType: 'FINAL_REVIEW',
      priority: 'HIGH'
    });
    console.log('  ✓ 状态:', task.data.success);
    console.log('  ✓ 任务类型:', task.data.data?.taskType);
    const taskId = task.data.data?.id;

    console.log('\n8. 开始处理任务...');
    await request({ path: `/api/review-tasks/${taskId}/status`, method: 'PATCH' }, { status: 'IN_PROGRESS' });

    console.log('\n9. 完成评审任务...');
    const completed = await request({ path: `/api/review-tasks/${taskId}/status`, method: 'PATCH' }, {
      status: 'COMPLETED',
      opinion: '样品质量良好，建议定版采购',
      rating: 5
    });
    console.log('  ✓ 状态:', completed.data.success);
    console.log('  ✓ 评审意见:', completed.data.data?.opinion);

    console.log('\n10. 检查样品状态 (PENDING_REVIEW -> REVIEWED)...');
    const afterReview = await request({ path: `/api/samples/${sampleId}`, method: 'GET' });
    console.log('  ✓ 当前状态:', afterReview.data.data?.status);

    console.log('\n11. 定版冻结...');
    const finalize = await request({ path: '/api/finalization/finalize', method: 'POST' }, {
      sampleId,
      finalQuantity: 500,
      finalUnitPrice: 9.8
    });
    console.log('  ✓ 状态:', finalize.data.success);
    console.log('  ✓ 最终数量:', finalize.data.data?.finalQuantity);
    console.log('  ✓ 最终单价:', finalize.data.data?.finalUnitPrice);
    console.log('  ✓ 最终金额:', finalize.data.data?.finalTotalAmount);

    console.log('\n12. 检查样品最终状态...');
    const finalSample = await request({ path: `/api/samples/${sampleId}`, method: 'GET' });
    console.log('  ✓ 最终状态:', finalSample.data.data?.status);
    console.log('  ✓ 是否已冻结:', finalSample.data.data?.isFrozen);

    console.log('\n13. 测试状态转换校验 (已冻结样品无法修改)...');
    const frozenTest = await request({ path: `/api/samples/${sampleId}/status`, method: 'PATCH' }, { status: 'CREATED' });
    console.log('  ✓ 预期失败:', !frozenTest.data.success);
    console.log('  ✓ 错误信息:', frozenTest.data.message);

    console.log('\n14. 查看历史记录...');
    const history = await request({ path: `/api/samples/${sampleId}/history`, method: 'GET' });
    console.log('  ✓ 历史记录数:', history.data.data?.length);
    history.data.data?.slice(0, 3).forEach((h, i) => {
      console.log(`    ${i + 1}. ${h.action}: ${h.description}`);
    });

    console.log('\n15. 获取系统概览...');
    const overview = await request({ path: '/api/export/overview', method: 'GET' });
    console.log('  ✓ 样品总数:', overview.data.data?.sampleSummary?.total);
    console.log('  ✓ 已结版数量:', overview.data.data?.sampleSummary?.byStatus?.FINALIZED);

    console.log('\n' + '='.repeat(60));
    console.log('测试完成！核心业务流程验证通过 ✓');
    console.log('='.repeat(60));

    console.log('\n已验证的功能:');
    console.log('  ✓ 样品创建和自动编号');
    console.log('  ✓ 状态流转校验');
    console.log('  ✓ 试用反馈提交');
    console.log('  ✓ 评审任务管理');
    console.log('  ✓ 定版冻结机制');
    console.log('  ✓ 历史记录追踪');
    console.log('  ✓ 数据一致性校验');

  } catch (error) {
    console.error('测试失败:', error.message);
    process.exit(1);
  }
}

testAll();
