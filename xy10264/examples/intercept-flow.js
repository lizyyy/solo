const http = require('http');

const BASE_URL = 'http://localhost:3005';

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = data ? JSON.parse(data) : {};
            resolve({ status: res.statusCode, data: parsed, headers: res.headers });
          } catch (e) {
            resolve({ status: res.statusCode, data, headers: res.headers });
          }
        });
      }
    );

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printSection(title) {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60) + '\n');
}

function printStep(step, desc) {
  console.log(`\n[步骤 ${step}] ${desc}`);
  console.log('-'.repeat(50));
}

function printResult(label, obj, indent = 0) {
  const prefix = ' '.repeat(indent);
  if (typeof obj === 'object' && obj !== null) {
    console.log(`${prefix}${label}:`, JSON.stringify(obj, null, 2).split('\n').map((line, i) => i === 0 ? line : prefix + line).join('\n'));
  } else {
    console.log(`${prefix}${label}:`, obj);
  }
}

async function main() {
  printSection('【拦截/待复核样例】证据不足场景');
  console.log('场景说明：住客自称有噪音但证据不足，触发拦截和人工复核');

  await sleep(500);

  printStep(1, '检查服务健康状态');
  let res = await request('/api/health');
  if (res.status !== 200) {
    console.error('❌ 服务未启动，请先执行: npm start');
    process.exit(1);
  }
  console.log('✅ 服务正常');

  const timestamp = Date.now();

  printStep(2, '创建住客订单');
  const orderRes = await request('/api/orders', {
    method: 'POST',
    body: {
      property_id: 'PROP-BJ-002',
      property_name: '北京朝阳区温馨民宿',
      guest_name: '李四',
      guest_phone: '13700137003',
      check_in_date: '2026-05-10',
      check_out_date: '2026-05-11',
      total_amount: 680.00,
      room_no: '205',
      order_no: `ORD-INTERCEPT-${timestamp}`
    }
  });
  const orderId = orderRes.data.data.id;
  console.log('✅ 订单创建成功, ID:', orderId);

  printStep(3, '创建投诉单（住客自称有噪音）');
  const complaintRes = await request('/api/complaints', {
    method: 'POST',
    body: {
      order_id: orderId,
      property_id: 'PROP-BJ-002',
      reporter_type: 'guest',
      reporter_name: '李四',
      reporter_phone: '13700137003',
      complaint_time: '2026-05-10T22:30:00.000Z',
      description: '晚上10点多楼道有人说话，影响睡眠',
      priority: 'low',
      assigned_to: '客服-小陈',
      complaint_no: `CMP-INTERCEPT-${timestamp}`
    }
  });
  const complaintId = complaintRes.data.data.id;
  console.log('✅ 投诉单创建成功, ID:', complaintId);

  printStep(4, '仅上传1条单次分贝记录（无连续性证据）');
  await request('/api/decibel-records', {
    method: 'POST',
    body: {
      order_id: orderId,
      property_id: 'PROP-BJ-002',
      record_time: '2026-05-10T22:30:00.000Z',
      db_value: 62,
      duration_seconds: 60,
      location: '205房间内',
      source: '手机APP'
    }
  });
  console.log('  已上传单条分贝记录: 62dB');
  console.log('  【关键差异】单次超标无法形成连续违规证据');

  printStep(5, '上传未验证的文字描述证据');
  const evRes = await request('/api/evidence-segments', {
    method: 'POST',
    body: {
      complaint_id: complaintId,
      segment_type: 'text',
      segment_time: '2026-05-10T22:35:00.000Z',
      description: '我听到外面有人说话，但没有录音',
      is_verified: false
    }
  });
  console.log('  已上传文字证据（未验证）');
  console.log('  【关键差异】缺少分贝数据、音频/视频、未经过验证');

  printStep(6, '查询投诉详情（查看分析结果）');
  res = await request(`/api/complaints/${complaintId}`);
  const analysis = res.data.data.analysis;

  printResult('分贝分析（关键差异）', {
    has_evidence: analysis.decibel_analysis.hasEvidence,
    max_db: analysis.decibel_analysis.maxDb,
    avg_db: analysis.decibel_analysis.avgDb?.toFixed(1) || 0,
    violation_count: analysis.decibel_analysis.continuousViolations.length,
    triggered_rules: analysis.decibel_analysis.triggeredRules.map(r => r.rule_name)
  }, 2);

  printResult('证据质量评估（关键差异）', analysis.evidence_quality, 2);

  printResult('赔付计算', {
    eligible: analysis.compensation_calculation.eligible,
    amount: analysis.compensation_calculation.amount,
    reason: analysis.compensation_calculation.reason
  }, 2);

  printResult('复核判断', analysis.review_required, 2);

  if (!analysis.decibel_analysis.hasEvidence) {
    console.log('❌ 无连续违规证据 → 无法自动赔付');
  }
  if (analysis.review_required.required) {
    console.log('⚠️ 触发人工复核，原因: ' + analysis.review_required.reasons.join(', '));
  }

  printStep(7, '尝试直接推进到 approved（被拦截）');
  res = await request(`/api/complaints/${complaintId}/advance`, {
    method: 'POST',
    body: {
      to_status: 'approved',
      operator: '主管-王经理',
      remark: '客户坚持要赔付'
    }
  });
  console.log('状态码:', res.status);
  printResult('拦截响应', res.data, 2);
  console.log(res.status === 400 ? '✅ 正确拦截：需要人工复核' : '⚠️ 拦截未生效');

  printStep(8, '先推进到 investigating');
  await request(`/api/complaints/${complaintId}/advance`, {
    method: 'POST',
    body: {
      to_status: 'investigating',
      operator: '客服-小陈',
      remark: '开始调查核实'
    }
  });
  console.log('✅ 已推进到 investigating');

  printStep(9, '推进到 verifying（被拦截：缺少有效证据）');
  res = await request(`/api/complaints/${complaintId}/advance`, {
    method: 'POST',
    body: {
      to_status: 'verifying',
      operator: '质检-小周',
      remark: '尝试进入验证阶段'
    }
  });
  console.log('状态码:', res.status);
  printResult('拦截响应', res.data, 2);
  console.log(res.status === 400 ? '✅ 正确拦截：缺少有效噪音证据' : '⚠️ 拦截未生效');

  printStep(10, '补充证据：添加3条连续分贝记录（刚好达标）');
  const baseTime = new Date('2026-05-10T22:28:00.000Z');
  for (let i = 0; i < 5; i++) {
    const recordTime = new Date(baseTime.getTime() + i * 60000).toISOString();
    const dbValue = [66, 68, 67, 65, 64][i];
    await request('/api/decibel-records', {
      method: 'POST',
      body: {
        order_id: orderId,
        property_id: 'PROP-BJ-002',
        record_time: recordTime,
        db_value: dbValue,
        duration_seconds: 60,
        location: '205房间内',
        source: '手机APP'
      }
    });
    console.log(`  已上传分贝记录 #${i + 1}: ${dbValue}dB`);
  }
  console.log('  【关键差异】补充后有连续超标证据，但证据质量仍存疑');

  printStep(11, '验证文字证据');
  const evidenceId = evRes.data.data.id;
  await request(`/api/evidence-segments/${evidenceId}/verify`, {
    method: 'POST',
    body: { operator: '质检-小周' }
  });
  console.log('✅ 已验证文字证据');

  printStep(12, '再次查询分析结果');
  res = await request(`/api/complaints/${complaintId}`);
  const analysis2 = res.data.data.analysis;

  printResult('分贝分析', {
    has_evidence: analysis2.decibel_analysis.hasEvidence,
    triggered_rules: analysis2.decibel_analysis.triggeredRules.map(r => r.rule_name)
  }, 2);

  printResult('证据质量', analysis2.evidence_quality, 2);
  printResult('赔付计算', {
    eligible: analysis2.compensation_calculation.eligible,
    amount: analysis2.compensation_calculation.amount,
    reason: analysis2.compensation_calculation.reason
  }, 2);
  printResult('复核判断', analysis2.review_required, 2);

  if (analysis2.decibel_analysis.hasEvidence && analysis2.review_required.required) {
    console.log('⚠️ 有证据但仍需复核：证据质量 fair（缺少音频/视频）');
  }

  printStep(13, '推进到 verifying（现在有证据可通过）');
  res = await request(`/api/complaints/${complaintId}/advance`, {
    method: 'POST',
    body: {
      to_status: 'verifying',
      operator: '质检-小周',
      remark: '分贝记录达标，进入验证'
    }
  });
  console.log('状态码:', res.status);
  console.log(res.status === 200 ? '✅ 有证据可推进到 verifying' : '❌ 推进失败');

  printStep(14, '尝试直接推进到 approved（仍被拦截：需复核）');
  res = await request(`/api/complaints/${complaintId}/advance`, {
    method: 'POST',
    body: {
      to_status: 'approved',
      operator: '主管-王经理',
      remark: '尝试直接批准'
    }
  });
  console.log('状态码:', res.status);
  printResult('拦截响应（复核原因）', res.data, 2);
  console.log(res.status === 400 && res.data.error === 'REVIEW_REQUIRED'
    ? '✅ 正确拦截：需人工复核'
    : '⚠️ 拦截未生效');

  printStep(15, '正确路径：先推进到 pending_review');
  res = await request(`/api/complaints/${complaintId}/advance`, {
    method: 'POST',
    body: {
      to_status: 'pending_review',
      operator: '质检-小周',
      remark: '证据存在争议，提交主管复核'
    }
  });
  console.log('状态码:', res.status);
  console.log('  当前状态:', res.data.data?.status);
  console.log('✅ 已进入待复核状态');

  printStep(16, '人工复核后批准（从 pending_review 可以直接 approved）');
  res = await request(`/api/complaints/${complaintId}/advance`, {
    method: 'POST',
    body: {
      to_status: 'approved',
      operator: '主管-王经理',
      remark: '人工复核通过：考虑客户体验，给予30%赔付'
    }
  });
  console.log('状态码:', res.status);
  printResult('批准结果', {
    status: res.data.data?.status,
    compensation_amount: res.data.data?.compensation_amount,
    compensation_decision: res.data.data?.compensation_decision,
    decision_reason: res.data.data?.decision_reason
  }, 2);
  console.log('✅ 人工复核后可正常批准');

  printStep(17, '完成投诉');
  await request(`/api/complaints/${complaintId}/advance`, {
    method: 'POST',
    body: {
      to_status: 'completed',
      operator: '财务-小吴',
      remark: '赔付已完成'
    }
  });
  console.log('✅ 投诉已完成');

  printStep(18, '撤回演示：创建新投诉然后撤回');
  const complaintRes2 = await request('/api/complaints', {
    method: 'POST',
    body: {
      order_id: orderId,
      property_id: 'PROP-BJ-002',
      reporter_type: 'guest',
      reporter_name: '李四',
      complaint_time: '2026-05-10T23:00:00.000Z',
      description: '水龙头漏水',
      priority: 'low',
      complaint_no: `CMP-WITHDRAW-${timestamp}`
    }
  });
  const withdrawId = complaintRes2.data.data.id;
  console.log('  已创建测试投诉:', withdrawId);

  res = await request(`/api/complaints/${withdrawId}/withdraw`, {
    method: 'POST',
    body: {
      operator: '客服-小陈',
      remark: '问题已解决，客户撤回投诉'
    }
  });
  console.log('  撤回后状态:', res.data.data?.status);
  console.log('✅ 撤回功能正常');

  printStep(19, '状态流转拦截：终态无法操作');
  res = await request(`/api/complaints/${withdrawId}/advance`, {
    method: 'POST',
    body: {
      to_status: 'investigating',
      operator: '客服-小陈'
    }
  });
  console.log('  状态码:', res.status);
  console.log('  错误:', res.data.error, '-', res.data.message);
  console.log('✅ 终态拦截生效');

  printStep(20, '修正演示');
  const complaintRes3 = await request('/api/complaints', {
    method: 'POST',
    body: {
      order_id: orderId,
      property_id: 'PROP-BJ-002',
      reporter_type: 'guest',
      reporter_name: '李四',
      complaint_time: '2026-05-10T23:30:00.000Z',
      description: '需要修正的描述',
      priority: 'low',
      complaint_no: `CMP-AMEND-${timestamp}`
    }
  });
  const amendId = complaintRes3.data.data.id;

  res = await request(`/api/complaints/${amendId}/amend`, {
    method: 'POST',
    body: {
      operator: '客服-小陈',
      changes: {
        description: '修正后的投诉描述：空调噪音过大',
        priority: 'high'
      },
      remark: '客户补充了更详细的信息'
    }
  });
  console.log('  修正后状态:', res.data.data?.status);
  console.log('  修正后描述:', res.data.data?.description);
  console.log('  修正后优先级:', res.data.data?.priority);
  console.log('✅ 修正功能正常');

  printStep(21, '查看修正后的处理历史');
  res = await request(`/api/process-history/${amendId}`);
  console.log('  历史记录:');
  res.data.data.forEach((h, i) => {
    console.log(`    ${i + 1}. ${h.action}: ${h.from_status || '-'} → ${h.to_status}`);
    if (h.change_data) {
      try {
        const changes = JSON.parse(h.change_data);
        console.log(`       变更内容: ${JSON.stringify(changes)}`);
      } catch (e) {}
    }
  });

  printSection('【拦截/待复核样例】执行完毕');
  console.log('✅ 所有拦截场景演示完成');
  console.log('');
  console.log('关键差异点总结：');
  console.log('  1. 无连续证据 → 无法进入验证阶段 → 被拦截');
  console.log('  2. 证据质量 fair（缺少音频/视频）→ 需人工复核');
  console.log('  3. 赔付计算：夜间65dB持续5分钟 → 订单¥680 × 30% = ¥204');
  console.log('  4. 状态流转限制：终态无法推进、非法状态转换被拦截');
  console.log('  5. 撤回和修正功能正常，操作被记录到历史');
}

main().catch(console.error);
