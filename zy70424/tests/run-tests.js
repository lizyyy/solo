const http = require('http');

const BASE_URL = 'localhost';
const PORT = 3000;

function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
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

async function runTest(name, testFn) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`▶ 测试: ${name}`);
  try {
    await testFn();
    console.log(`✅ 通过: ${name}`);
    return true;
  } catch (error) {
    console.log(`❌ 失败: ${name}`);
    console.log(`   错误: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║       鉴权路径解释器 - 自动化验收测试          ║');
  console.log('╚═══════════════════════════════════════════════╝');

  const results = [];

  results.push(await runTest('1. 健康检查 - 服务可访问', async () => {
    const res = await request('GET', '/health');
    if (res.status !== 200) throw new Error(`状态码: ${res.status}`);
    if (res.data.code !== 'HEALTH_OK') throw new Error('响应码错误');
    console.log('   ✓ 服务运行正常');
  }));

  results.push(await runTest('2. 主流程 - 补录会议纪要(无缓存异常)', async () => {
    const res = await request('POST', '/api/records', {
      title: '验收测试会议',
      department: '合规部',
      meetingDate: '2024-06-15',
      summary: '测试缓存未刷新场景'
    });
    if (res.data.code !== 'CACHE_STALE_NO_REFRESH') {
      throw new Error(`期望错误码 CACHE_STALE_NO_REFRESH，实际: ${res.data.code}`);
    }
    if (!res.data.details.failedItemId) {
      throw new Error('失败项ID未返回');
    }
    console.log('   ✓ 正确触发缓存未刷新异常');
    console.log(`   ✓ 失败项ID: ${res.data.details.failedItemId}`);
  }));

  results.push(await runTest('3. 失败项 - 可查询已记录的失败项', async () => {
    const res = await request('GET', '/api/admin/failed-items');
    if (res.status !== 200) throw new Error(`状态码: ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('返回数据格式错误');
    console.log(`   ✓ 查询到 ${res.data.total} 个失败项`);
    console.log(`   ✓ 待处理: ${res.data.summary.pending}`);
  }));

  results.push(await runTest('4. 缓存刷新 - 刷新部门鉴权路径', async () => {
    const res = await request('POST', '/api/admin/cache/refresh', {
      department: '合规部',
      authPaths: ['/api/auth/compliance/**', '/api/auth/level-3/compliance/*']
    });
    if (res.data.code !== 'CACHE_REFRESHED') {
      throw new Error(`期望错误码 CACHE_REFRESHED，实际: ${res.data.code}`);
    }
    console.log('   ✓ 缓存刷新成功');
    console.log(`   ✓ 路径数量: ${res.data.data.pathsCount}`);
  }));

  let testRecordId = null;
  results.push(await runTest('5. 主流程 - 缓存刷新后正常补录会议', async () => {
    const res = await request('POST', '/api/records', {
      title: '合规部季度工作会议',
      department: '合规部',
      meetingDate: '2024-06-15',
      summary: '讨论季度合规工作计划'
    });
    if (res.data.code !== 'SUCCESS') {
      throw new Error(`期望错误码 SUCCESS，实际: ${res.data.code}`);
    }
    testRecordId = res.data.data.recordId;
    console.log('   ✓ 会议补录成功');
    console.log(`   ✓ 记录ID: ${testRecordId}`);
  }));

  results.push(await runTest('5.1 状态验证 - 会议记录应为 completed 状态', async () => {
    if (!testRecordId) throw new Error('缺少测试记录ID');
    const res = await request('GET', `/api/records/${testRecordId}`);
    if (res.data.data.status !== 'completed') {
      throw new Error(`期望状态 completed，实际: ${res.data.data.status}`);
    }
    if (!res.data.data.processedAt) {
      throw new Error('processedAt 未设置');
    }
    console.log(`   ✓ 记录状态: ${res.data.data.status}`);
    console.log(`   ✓ 处理时间: ${res.data.data.processedAt}`);
  }));

  let candidateId = null;
  results.push(await runTest('6. 回滚流程 - 生成候选清单(防误伤)', async () => {
    const res = await request('POST', '/api/admin/rollback/candidates', {
      operationType: 'bulk_rollback',
      criteria: { department: '合规部' }
    });
    if (res.data.code !== 'CANDIDATES_GENERATED') {
      throw new Error(`期望错误码 CANDIDATES_GENERATED，实际: ${res.data.code}`);
    }
    candidateId = res.data.data.candidateId;
    console.log(`   ✓ 候选清单ID: ${candidateId}`);
    console.log(`   ✓ 包含 ${res.data.data.itemsCount} 个项目`);
    console.log(`   ✓ 每项都有风险级别: ${res.data.data.items[0]?.risk || 'N/A'}`);
  }));

  results.push(await runTest('7. 回滚流程 - 未审批直接执行应失败', async () => {
    if (!candidateId) throw new Error('缺少候选清单ID');
    const res = await request('POST', '/api/admin/rollback/execute', {
      candidateId: candidateId
    });
    if (res.status !== 400) throw new Error(`期望状态码 400，实际: ${res.status}`);
    if (!res.data.message.includes('未审批')) {
      throw new Error('错误信息未包含"未审批"提示');
    }
    console.log('   ✓ 正确阻止未审批的回滚操作');
    console.log(`   ✓ 错误信息: ${res.data.message}`);
  }));

  results.push(await runTest('8. 回滚流程 - 审批候选清单', async () => {
    if (!candidateId) throw new Error('缺少候选清单ID');
    const res = await request('POST', '/api/admin/rollback/approve', {
      candidateId: candidateId,
      approver: '测试验收员',
      approvalNote: '验收测试，确认回滚'
    });
    if (res.data.code !== 'CANDIDATE_APPROVED') {
      throw new Error(`期望错误码 CANDIDATE_APPROVED，实际: ${res.data.code}`);
    }
    if (res.data.data.approved !== true) {
      throw new Error('审批状态未更新为true');
    }
    console.log('   ✓ 候选清单审批通过');
    console.log(`   ✓ 审批人: ${res.data.data.approver}`);
  }));

  results.push(await runTest('9. 回滚流程 - 执行已审批的回滚', async () => {
    if (!candidateId) throw new Error('缺少候选清单ID');
    const res = await request('POST', '/api/admin/rollback/execute', {
      candidateId: candidateId
    });
    if (res.data.code !== 'ROLLBACK_EXECUTED') {
      throw new Error(`期望错误码 ROLLBACK_EXECUTED，实际: ${res.data.code}`);
    }
    console.log('   ✓ 回滚执行成功');
    console.log(`   ✓ 影响数量: ${res.data.data.affectedCount}`);
  }));

  results.push(await runTest('10. 回滚流程 - 重复执行应失败', async () => {
    if (!candidateId) throw new Error('缺少候选清单ID');
    const res = await request('POST', '/api/admin/rollback/execute', {
      candidateId: candidateId
    });
    if (res.status !== 400) throw new Error(`期望状态码 400，实际: ${res.status}`);
    if (!res.data.message.includes('已执行')) {
      throw new Error('错误信息未包含"已执行"提示');
    }
    console.log('   ✓ 正确阻止重复执行');
  }));

  results.push(await runTest('11. 搜索报告 - 创建+导出摘要', async () => {
    const records = await request('GET', '/api/records');
    const record = records.data.data.find(r => r.department === '合规部');
    if (!record) throw new Error('未找到测试会议记录');

    const res = await request('POST', '/api/admin/search-reports', {
      searchTerm: '合规工作',
      recordId: record.id,
      recordTitle: record.title,
      matchedContent: '讨论季度合规工作计划',
      confidence: 0.92
    });
    if (res.data.code !== 'REPORT_CREATED') {
      throw new Error(`期望错误码 REPORT_CREATED，实际: ${res.data.code}`);
    }
    console.log('   ✓ 搜索报告创建成功');
    console.log(`   ✓ 导出摘要: ${res.data.data.exportSummary}`);
  }));

  results.push(await runTest('13. 数据持久化 - 查询会议记录', async () => {
    const res = await request('GET', '/api/records');
    if (res.status !== 200) throw new Error(`状态码: ${res.status}`);
    const completed = res.data.data.filter(r => r.status === 'completed');
    const rolledBack = res.data.data.filter(r => r.status === 'rolled_back');
    console.log(`   ✓ 总记录数: ${res.data.total}`);
    console.log(`   ✓ 已完成记录: ${completed.length}`);
    console.log(`   ✓ 已回滚记录: ${rolledBack.length}`);
  }));

  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║                  测试汇总                      ║');
  console.log('╠═══════════════════════════════════════════════╣');
  const passed = results.filter(r => r).length;
  const total = results.length;
  console.log(`║  通过: ${passed.toString().padEnd(2)} / ${total.toString().padEnd(2)}                             ║`);
  console.log(`║  成功率: ${((passed / total) * 100).toFixed(1).toString().padStart(5)}%                               ║`);
  console.log('╠═══════════════════════════════════════════════╣');
  if (passed === total) {
    console.log('║         ✅ 所有验收测试通过！                   ║');
    console.log('╚═══════════════════════════════════════════════╝');
    process.exit(0);
  } else {
    console.log('║         ❌ 部分测试失败，请检查！               ║');
    console.log('╚═══════════════════════════════════════════════╝');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('\n❌ 测试执行失败:', err.message);
  console.log('💡 请确保服务已启动: node src/server.js');
  process.exit(1);
});
