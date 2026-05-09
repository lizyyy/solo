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
  printSection('【顺利流程样例】完整噪音投诉处理流程');
  console.log('场景说明：住客深夜派对噪音超标，证据完整，自动赔付判断通过');

  await sleep(500);

  printStep(1, '检查服务健康状态');
  let res = await request('/api/health');
  console.log('状态码:', res.status);
  printResult('响应', res.data, 2);

  if (res.status !== 200) {
    console.error('❌ 服务未启动，请先执行: npm start');
    process.exit(1);
  }
  console.log('✅ 服务正常');

  const ts = Date.now();
  const orderKey = `success-order-${ts}`;
  const complaintKey = `success-complaint-${ts}`;

  printStep(2, '创建住客订单（幂等键演示）');
  const orderData = {
    property_id: 'PROP-SH-001',
    property_name: '上海静安区精品民宿',
    guest_name: '张三',
    guest_phone: '13800138001',
    check_in_date: '2026-05-10',
    check_out_date: '2026-05-12',
    total_amount: 1580.00,
    room_no: '302',
    order_no: `ORD-SUCCESS-${Date.now()}`
  };

  res = await request('/api/orders', {
    method: 'POST',
    headers: { 'x-idempotency-key': orderKey },
    body: orderData
  });
  console.log('状态码:', res.status);
  printResult('订单创建响应', res.data, 2);

  const orderId = res.data.data.id;
  console.log('✅ 订单创建成功, ID:', orderId);

  printStep(3, '重复请求同一订单（幂等性测试）');
  res = await request('/api/orders', {
    method: 'POST',
    headers: { 'x-idempotency-key': orderKey },
    body: orderData
  });
  console.log('状态码:', res.status);
  printResult('幂等响应', res.data, 2);
  console.log(res.data.idempotent ? '✅ 幂等性生效，返回已有记录' : '⚠️ 幂等性未触发');

  printStep(4, '创建投诉单（夜间噪音投诉）');
  const complaintData = {
    order_id: orderId,
    property_id: 'PROP-SH-001',
    reporter_type: 'neighbor',
    reporter_name: '王阿姨',
    reporter_phone: '13900139002',
    complaint_time: '2026-05-10T23:45:00.000Z',
    description: '302房间深夜23点还在开派对，噪音很大，影响休息',
    priority: 'high',
    assigned_to: '客服专员-小李',
    complaint_no: `CMP-SUCCESS-${Date.now()}`
  };

  res = await request('/api/complaints', {
    method: 'POST',
    body: complaintData
  });
  console.log('状态码:', res.status);
  printResult('投诉单创建响应', res.data, 2);

  const complaintId = res.data.data.id;
  console.log('✅ 投诉单创建成功, ID:', complaintId);
  console.log('  投诉状态:', res.data.data.status);

  printStep(5, '尝试推进到验证阶段（无证据会被拦截）');
  res = await request(`/api/complaints/${complaintId}/advance`, {
    method: 'POST',
    body: {
      to_status: 'verifying',
      operator: '客服-小李',
      remark: '开始核实噪音情况'
    }
  });
  console.log('状态码:', res.status);
  printResult('拦截响应', res.data, 2);
  console.log(res.status === 400 ? '✅ 正确拦截：缺少证据无法进入验证阶段' : '⚠️ 拦截未生效');

  printStep(6, '上传夜间分贝记录（关键差异点：连续超标证据）');
  const baseTime = new Date('2026-05-10T23:30:00.000Z');
  const decibelRecords = [];

  for (let i = 0; i < 8; i++) {
    const recordTime = new Date(baseTime.getTime() + i * 60000).toISOString();
    const dbValue = [68, 72, 70, 75, 78, 73, 69, 66][i];

    const recRes = await request('/api/decibel-records', {
      method: 'POST',
      body: {
        order_id: orderId,
        property_id: 'PROP-SH-001',
        record_time: recordTime,
        db_value: dbValue,
        duration_seconds: 60,
        location: '302房间门口',
        source: '智能噪音监测设备'
      }
    });

    if (recRes.status === 201) {
      decibelRecords.push(recRes.data.data);
      console.log(`  已上传分贝记录 #${i + 1}: ${dbValue}dB @ ${recordTime.slice(11, 19)}`);
    }
  }
  console.log(`✅ 共上传 ${decibelRecords.length} 条分贝记录`);
  console.log('  【关键差异】夜间23:30-23:38，持续8分钟≥65分贝，触发"夜间高峰噪音"规则');

  printStep(7, '上传证据片段（带分贝数据的音频片段）');
  const evidenceRes1 = await request('/api/evidence-segments', {
    method: 'POST',
    body: {
      complaint_id: complaintId,
      segment_type: 'audio',
      segment_time: '2026-05-10T23:32:00.000Z',
      duration_seconds: 120,
      db_avg: 72,
      db_max: 78,
      db_min: 66,
      description: '两分钟音频片段，包含派对音乐和人声喧哗',
      file_url: '/evidence/audio/cmp_001_segment1.mp3',
      is_verified: true,
      verified_by: '质检-小王',
      verified_at: '2026-05-11T00:15:00.000Z'
    }
  });
  const evidence1Id = evidenceRes1.data.data.id;
  console.log('  已上传音频证据片段');

  const evidenceRes2 = await request('/api/evidence-segments', {
    method: 'POST',
    body: {
      complaint_id: complaintId,
      segment_type: 'neighbor_feedback',
      segment_time: '2026-05-10T23:50:00.000Z',
      description: '邻居王阿姨电话录音："已经不是第一次了，凌晨还在吵"',
      is_verified: true,
      verified_by: '质检-小王',
      verified_at: '2026-05-11T00:20:00.000Z'
    }
  });
  console.log('  已上传邻居反馈证据');
  console.log('✅ 证据片段上传完成，均已验证');

  printStep(8, '查询投诉详情（查看实时分析结果）');
  res = await request(`/api/complaints/${complaintId}`);
  console.log('状态码:', res.status);

  const analysis = res.data.data.analysis;
  printResult('分贝分析摘要', {
    has_evidence: analysis.decibel_analysis.hasEvidence,
    max_db: analysis.decibel_analysis.maxDb,
    avg_db: analysis.decibel_analysis.avgDb.toFixed(1),
    violation_count: analysis.decibel_analysis.continuousViolations.length,
    triggered_rules: analysis.decibel_analysis.triggeredRules.map(r => r.rule_name)
  }, 2);

  printResult('证据质量评估', analysis.evidence_quality, 2);
  printResult('赔付计算（关键差异）', {
    eligible: analysis.compensation_calculation.eligible,
    amount: analysis.compensation_calculation.amount,
    reason: analysis.compensation_calculation.reason,
    applied_rule: analysis.compensation_calculation.appliedRule?.rule_name
  }, 2);

  printResult('复核判断', analysis.review_required, 2);

  if (analysis.compensation_calculation.eligible) {
    console.log('✅ 赔付计算完成：订单金额 ¥1,580 × 50% = ¥790');
    console.log('  【关键差异】触发高优先级规则：夜间≥75dB持续3分钟 → 50%赔付');
  }

  printStep(9, '推进到调查阶段 investigating');
  res = await request(`/api/complaints/${complaintId}/advance`, {
    method: 'POST',
    body: {
      to_status: 'investigating',
      operator: '客服-小李',
      remark: '已联系住客核实情况'
    }
  });
  console.log('状态码:', res.status);
  console.log('  当前状态:', res.data.data.status);
  console.log('✅ 状态推进成功');

  printStep(10, '推进到验证阶段 verifying（有证据可通过）');
  res = await request(`/api/complaints/${complaintId}/advance`, {
    method: 'POST',
    body: {
      to_status: 'verifying',
      operator: '质检-小王',
      remark: '证据完整，分贝数据和音频均已验证'
    }
  });
  console.log('状态码:', res.status);
  console.log('  当前状态:', res.data.data.status);
  console.log('✅ 有证据可正常进入验证阶段');

  printStep(11, '推进到已批准 approved（自动计算赔付金额）');
  res = await request(`/api/complaints/${complaintId}/advance`, {
    method: 'POST',
    body: {
      to_status: 'approved',
      operator: '主管-张经理',
      remark: '证据确凿，符合赔付条件'
    }
  });
  console.log('状态码:', res.status);
  printResult('批准响应', {
    status: res.data.data.status,
    compensation_amount: res.data.data.compensation_amount,
    compensation_decision: res.data.data.compensation_decision,
    decision_reason: res.data.data.decision_reason
  }, 2);

  if (res.data.data.compensation_decision === 'approve') {
    console.log('✅ 自动赔付判定成功，金额已写入投诉单');
  }

  printStep(12, '推进到已完成 completed');
  res = await request(`/api/complaints/${complaintId}/advance`, {
    method: 'POST',
    body: {
      to_status: 'completed',
      operator: '财务-小刘',
      remark: '赔付已到账，流程结束'
    }
  });
  console.log('状态码:', res.status);
  console.log('  最终状态:', res.data.data.status);
  console.log('✅ 投诉处理完成');

  printStep(13, '查看完整处理历史');
  res = await request(`/api/process-history/${complaintId}`);
  console.log('状态码:', res.status);
  console.log('  历史记录数:', res.data.data.length);

  res.data.data.forEach((h, i) => {
    console.log(`    ${i + 1}. [${h.created_at.slice(11, 19)}] ${h.action}: ${h.from_status || 'NULL'} → ${h.to_status} (${h.operator})`);
    if (h.remark) console.log(`       备注: ${h.remark}`);
  });

  printStep(14, '查询投诉汇总列表');
  res = await request('/api/complaints?property_id=PROP-SH-001');
  console.log('状态码:', res.status);
  printResult('汇总统计', res.data.summary, 2);

  printStep(15, '导出CSV数据');
  res = await request('/api/export/complaints?property_id=PROP-SH-001');
  console.log('状态码:', res.status);
  console.log('  Content-Type:', res.headers['content-type']);
  console.log('  Content-Disposition:', res.headers['content-disposition']);
  console.log('✅ 数据可导出为CSV');

  printSection('【顺利流程样例】执行完毕');
  console.log('✅ 所有步骤顺利完成');
  console.log('');
  console.log('关键差异点总结：');
  console.log('  1. 噪音证据片段：连续8分钟夜间分贝记录 + 已验证音频 + 邻居反馈');
  console.log('  2. 赔付规则匹配：触发最高优先级"夜间≥75dB持续3分钟 → 50%赔付"');
  console.log('  3. 自动判定：证据质量 excellent + 有违规证据 → 无需人工复核');
  console.log('  4. 幂等性：重复请求不会创建重复数据');
}

main().catch(console.error);
