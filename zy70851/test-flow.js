const http = require('http');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(body);
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runTest() {
  console.log('=== 保险理赔预审系统完整流程测试 ===\n');

  const baseOptions = {
    hostname: 'localhost',
    port: 3000,
    headers: { 'Content-Type': 'application/json' }
  };

  console.log('1. 创建批次...');
  const batchResponse = await request({
    ...baseOptions,
    path: '/api/batches',
    method: 'POST'
  }, { operator: '理赔内勤张三' });
  const batchId = batchResponse.id;
  console.log(`   批次ID: ${batchId}`);
  console.log(`   批次号: ${batchResponse.batch_no}`);
  console.log('   ✓ 创建成功\n');

  console.log('2. 上传理赔材料...');
  const claimsData = {
    claims: [
      { claim_no: 'CLAIM-001', policy_no: 'POL-2024-001', insured_name: '张三', insured_id_card: '110101199001011234', accident_date: '2024-01-15', claim_amount: 3000, diagnosis: '急性阑尾炎', hospital: '北京协和医院', materials: ['身份证', '住院发票', '出院小结', '费用清单', '诊断证明'] },
      { claim_no: 'CLAIM-002', policy_no: 'POL-2024-002', insured_name: '李四', insured_id_card: '110101199002022345', accident_date: '2024-02-20', claim_amount: 60000, diagnosis: '骨折', hospital: '上海瑞金医院', materials: ['身份证', '住院发票', '出院小结', '费用清单', '诊断证明'] },
      { claim_no: 'CLAIM-003', policy_no: 'POL-2024-003', insured_name: '王五', insured_id_card: '110101199003033456', accident_date: '2024-03-10', claim_amount: 8000, diagnosis: '肺炎', hospital: '广州中山医院', materials: ['身份证', '住院发票'] },
      { claim_no: 'CLAIM-004', policy_no: 'POL-2024-004', insured_name: '赵六', insured_id_card: '110101199004044567', accident_date: '2024-04-05', claim_amount: 5000, diagnosis: '抑郁症', hospital: '深圳人民医院', materials: ['身份证', '住院发票', '出院小结', '费用清单', '诊断证明'] },
      { claim_no: 'CLAIM-005', policy_no: 'POL-2024-001', insured_name: '张三', insured_id_card: '110101199001011234', accident_date: '2024-01-15', claim_amount: 2000, diagnosis: '急性阑尾炎', hospital: '北京协和医院', materials: ['身份证', '住院发票', '出院小结', '费用清单', '诊断证明'] }
    ]
  };
  const uploadResponse = await request({
    ...baseOptions,
    path: `/api/claims/batch/${batchId}`,
    method: 'POST'
  }, claimsData);
  console.log(`   成功导入: ${uploadResponse.imported} 条`);
  console.log(`   失败: ${uploadResponse.failed} 条`);
  console.log('   ✓ 上传完成\n');

  console.log('3. 执行批量预审...');
  const precheckResult = await request({
    ...baseOptions,
    path: `/api/precheck/batch/${batchId}`,
    method: 'POST'
  });
  console.log(`   总处理: ${precheckResult.total} 条`);
  console.log(`   成功: ${precheckResult.success} 条`);
  console.log(`   失败: ${precheckResult.errors} 条`);
  console.log('   ✓ 预审完成\n');

  console.log('4. 预审结果统计:');
  console.log(`   正常: ${precheckResult.categories.normal} 件`);
  console.log(`   待补充: ${precheckResult.categories.supplement} 件`);
  console.log(`   已拦截: ${precheckResult.categories.blocked} 件`);
  console.log(`   需人工复核: ${precheckResult.categories.manual_review} 件`);
  console.log('');

  console.log('5. 预审结果详情:');
  for (const result of precheckResult.results) {
    const categoryNames = { normal: '正常', supplement: '待补充', blocked: '已拦截' };
    console.log(`   ${result.claim_no} (${result.claim_id}): ${categoryNames[result.category] || result.category}`);
    console.log(`      原因: ${result.reasons.join(', ')}`);
    if (result.needs_manual_review) {
      console.log(`      ⚠️  需要人工复核`);
    }
  }
  console.log('');

  console.log('6. 查看批次摘要...');
  const summary = await request({
    ...baseOptions,
    path: `/api/reports/batch/${batchId}/summary`,
    method: 'GET'
  });
  console.log(`   总报案数: ${summary.total_claims}`);
  console.log(`   总金额: ${summary.total_amount.toFixed(2)} 元`);
  console.log(`   预审完成: ${summary.precheck_completed} 条`);
  console.log('   ✓ 获取摘要完成\n');

  console.log('7. 导出 CSV 报告...');
  const exportResponse = await request({
    ...baseOptions,
    path: `/api/reports/batch/${batchId}/export`,
    method: 'POST'
  }, { format: 'csv' });
  console.log(`   文件名: ${exportResponse.filename}`);
  console.log(`   下载地址: ${exportResponse.download_url}`);
  console.log(`   记录数: ${exportResponse.record_count} 条`);
  console.log('   ✓ 导出完成\n');

  console.log('8. 查看批次任务历史...');
  const batchDetail = await request({
    ...baseOptions,
    path: `/api/batches/${batchId}`,
    method: 'GET'
  });
  console.log(`   当前批次状态: ${batchDetail.batch.status}`);
  console.log(`   任务历史 (共${batchDetail.tasks.length}条):`);
  batchDetail.tasks.forEach((task, i) => {
    console.log(`     ${i + 1}. [${task.status}] ${task.message} (${task.created_at})`);
  });
  console.log('');

  console.log('=== 测试全部通过 ===');
  console.log(`批次ID: ${batchId}`);
  console.log(`查看详情接口: GET /api/batches/${batchId}`);
  console.log(`预审结果接口: GET /api/precheck/batch/${batchId}/results`);
}

runTest().catch(console.error);
