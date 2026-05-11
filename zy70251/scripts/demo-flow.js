const http = require('http');

const BASE_URL = 'http://localhost:3000';

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      method,
      path,
      hostname: 'localhost',
      port: 3000,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function logStep(step, description) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`步骤 ${step}: ${description}`);
  console.log(`${'='.repeat(60)}`);
}

function logResult(description, result, expectedStatus = 200) {
  const statusOk = result.status === expectedStatus || result.status === 201;
  const statusIcon = statusOk ? '✓' : '✗';
  console.log(`  ${statusIcon} ${description}`);
  console.log(`    状态码: ${result.status}`);
  if (result.data && result.data.data) {
    const d = result.data.data;
    if (d.id) console.log(`    ID: ${d.id}`);
    if (d.barcode) console.log(`    条码: ${d.barcode}`);
    if (d.batch_number) console.log(`    批次号: ${d.batch_number}`);
    if (d.report_number) console.log(`    报告号: ${d.report_number}`);
    if (d.status) console.log(`    状态: ${d.status}`);
  }
  if (!statusOk && result.data && result.data.error) {
    console.log(`    错误码: ${result.data.error.code}`);
    console.log(`    错误信息: ${result.data.error.message}`);
  }
  console.log();
}

async function runDemo() {
  console.log('\n🚀 医院病理标本外送 API - 完整业务流程演示');
  console.log('============================================================');
  
  const storage = {
    specimen1: null,
    specimen2: null,
    specimen3: null,
    batch: null,
    segments: [],
    reports: []
  };

  try {
    logStep(1, '创建3个病理标本条码');
    
    let res = await request('POST', '/api/specimens', {
      barcode: 'SP-2026-001',
      patient_name: '张三',
      patient_id: 'P001',
      specimen_type: '组织切片',
      collection_time: new Date().toISOString(),
      source_department: '病理科',
      destination_lab: '第三方基因检测实验室',
      operator: '李医生'
    });
    logResult('创建标本 1 (SP-2026-001)', res, 201);
    storage.specimen1 = res.data.data;

    res = await request('POST', '/api/specimens', {
      barcode: 'SP-2026-002',
      patient_name: '李四',
      patient_id: 'P002',
      specimen_type: '细胞学涂片',
      collection_time: new Date().toISOString(),
      source_department: '病理科',
      destination_lab: '第三方基因检测实验室',
      operator: '李医生'
    });
    logResult('创建标本 2 (SP-2026-002)', res, 201);
    storage.specimen2 = res.data.data;

    res = await request('POST', '/api/specimens', {
      barcode: 'SP-2026-003',
      patient_name: '王五',
      patient_id: 'P003',
      specimen_type: '组织切片',
      collection_time: new Date().toISOString(),
      source_department: '病理科',
      destination_lab: '第三方基因检测实验室',
      operator: '李医生'
    });
    logResult('创建标本 3 (SP-2026-003)', res, 201);
    storage.specimen3 = res.data.data;

    logStep(2, '创建外送批次');
    
    res = await request('POST', '/api/batches', {
      destination_lab: '第三方基因检测实验室',
      courier: '顺丰冷链物流',
      scheduled_time: new Date().toISOString(),
      operator: '王护士'
    });
    logResult('创建外送批次', res, 201);
    storage.batch = res.data.data;
    const batchId = storage.batch.id;

    logStep(3, '将3个标本加入批次');
    
    res = await request('POST', `/api/specimens/${storage.specimen1.id}/add-to-batch`, {
      batch_id: batchId,
      operator: '王护士'
    });
    logResult('标本1加入批次', res);

    res = await request('POST', `/api/specimens/${storage.specimen2.id}/add-to-batch`, {
      batch_id: batchId,
      operator: '王护士'
    });
    logResult('标本2加入批次', res);

    res = await request('POST', `/api/specimens/${storage.specimen3.id}/add-to-batch`, {
      batch_id: batchId,
      operator: '王护士'
    });
    logResult('标本3加入批次', res);

    logStep(4, '批次准备就绪并发货');
    
    res = await request('POST', `/api/batches/${batchId}/ready`, {
      operator: '王护士'
    });
    logResult('批次准备就绪', res);

    res = await request('POST', `/api/batches/${batchId}/ship`, {
      operator: '张快递'
    });
    logResult('批次发货', res);

    res = await request('POST', `/api/batches/${batchId}/start-transit`, {
      operator: '张快递'
    });
    logResult('批次开始运输', res);

    logStep(5, '创建冷链片段 (医院出库段)');
    
    const now = new Date();
    res = await request('POST', '/api/chain-segments', {
      batch_id: batchId,
      segment_type: 'outbound',
      start_time: now.toISOString(),
      start_location: '医院病理科冷库',
      operator: '张快递',
      notes: '标本从医院病理科出库'
    });
    logResult('创建出库冷链片段', res, 201);
    storage.segments.push(res.data.data);

    logStep(6, '完成冷链片段 (模拟2小时运输)');
    
    await sleep(100);
    
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    res = await request('POST', `/api/chain-segments/${storage.segments[0].id}/complete`, {
      end_time: twoHoursLater.toISOString(),
      end_location: '顺丰冷链中转站',
      temperature_min: -20,
      temperature_max: -15,
      temperature_avg: -18,
      operator: '中转站管理员',
      notes: '温度正常，货物完好'
    });
    logResult('完成出库冷链片段', res);

    logStep(7, '创建冷链片段 (中转站到实验室段)');
    
    res = await request('POST', '/api/chain-segments', {
      batch_id: batchId,
      segment_type: 'last_mile',
      start_time: twoHoursLater.toISOString(),
      start_location: '顺丰冷链中转站',
      operator: '赵快递',
      notes: '从中转站发往实验室'
    });
    logResult('创建最后一公里冷链片段', res, 201);
    storage.segments.push(res.data.data);

    logStep(8, '完成冷链片段 (模拟1小时运输)');
    
    await sleep(100);
    
    const threeHoursLater = new Date(twoHoursLater.getTime() + 1 * 60 * 60 * 1000);
    res = await request('POST', `/api/chain-segments/${storage.segments[1].id}/complete`, {
      end_time: threeHoursLater.toISOString(),
      end_location: '第三方基因检测实验室',
      temperature_min: -19,
      temperature_max: -16,
      temperature_avg: -17.5,
      operator: '实验室接收员',
      notes: '收到货物，温度记录正常'
    });
    logResult('完成最后一公里冷链片段', res);

    logStep(9, '批次送达确认');
    
    res = await request('POST', `/api/batches/${batchId}/deliver`, {
      operator: '实验室接收员'
    });
    logResult('批次送达', res);

    logStep(10, '验证冷链完整性');
    
    res = await request('GET', `/api/chain-segments/batch/${batchId}/verify`);
    logResult('冷链验证', res);
    console.log('    验证结果:', res.data.data.verified ? '通过 ✓' : '失败 ✗');
    console.log('    原因:', res.data.data.reason);

    logStep(11, '创建3个检测报告');
    
    res = await request('POST', '/api/reports', {
      specimen_id: storage.specimen1.id,
      report_type: '基因检测报告',
      result: 'EGFR基因第19外显子缺失突变',
      conclusion: '建议使用EGFR-TKI靶向药物治疗',
      operator: '陈检验师'
    });
    logResult('创建标本1报告', res, 201);
    storage.reports.push(res.data.data);

    res = await request('POST', '/api/reports', {
      specimen_id: storage.specimen2.id,
      report_type: '细胞学诊断报告',
      result: '找到异型细胞，考虑腺癌',
      conclusion: '建议进一步组织学检查',
      operator: '陈检验师'
    });
    logResult('创建标本2报告', res, 201);
    storage.reports.push(res.data.data);

    res = await request('POST', '/api/reports', {
      specimen_id: storage.specimen3.id,
      report_type: '免疫组化报告',
      result: 'PD-L1表达阳性 (TPS 60%)',
      conclusion: '可考虑免疫治疗',
      operator: '陈检验师'
    });
    logResult('创建标本3报告', res, 201);
    storage.reports.push(res.data.data);

    logStep(12, '审核并终审报告');
    
    for (const report of storage.reports) {
      res = await request('POST', `/api/reports/${report.id}/review`, {
        operator: '主任检验师',
        reason: '报告审核通过'
      });
      logResult(`审核报告 ${report.report_number}`, res);

      res = await request('POST', `/api/reports/${report.id}/finalize`, {
        operator: '主任检验师'
      });
      logResult(`终审报告 ${report.report_number}`, res);
    }

    logStep(13, '批次标记为已报告');
    
    res = await request('POST', `/api/batches/${batchId}/mark-reported`, {
      operator: '系统管理员'
    });
    logResult('批次标记为已报告', res);

    logStep(14, '查看标本完整时间线');
    
    res = await request('GET', `/api/dashboard/specimen-timeline/${storage.specimen1.barcode}`);
    logResult(`查看标本 ${storage.specimen1.barcode} 时间线`, res);
    if (res.data && res.data.data) {
      console.log('    当前状态:', res.data.data.current_status);
      console.log('    总体进度:', res.data.data.overall_status.progress, '%');
      console.log('    时间线步骤:');
      res.data.data.timeline.forEach(t => {
        console.log(`      - ${t.name} (${t.status})`);
      });
    }

    logStep(15, '查看批次完整报告');
    
    res = await request('GET', `/api/dashboard/batch-report/${storage.batch.batch_number}`);
    logResult(`查看批次 ${storage.batch.batch_number} 报告`, res);
    if (res.data && res.data.data) {
      console.log('    标本总数:', res.data.data.specimens.total);
      console.log('    报告完成:', res.data.data.reports.finalized, '/', res.data.data.specimens.total);
      console.log('    冷链验证:', res.data.data.cold_chain.verification.verified ? '通过' : '失败');
      console.log('    总体进度:', res.data.data.overall_progress, '%');
    }

    logStep(16, '查看系统概览');
    
    res = await request('GET', '/api/dashboard/overview');
    logResult('系统概览', res);
    if (res.data && res.data.data) {
      console.log('    总标本数:', res.data.data.summary.total_specimens);
      console.log('    总批次:', res.data.data.summary.total_batches);
      console.log('    总报告:', res.data.data.summary.total_reports);
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 完整业务流程演示完成！');
    console.log('='.repeat(60));
    console.log('\n关键数据:');
    console.log(`  标本条码: ${storage.specimen1.barcode}, ${storage.specimen2.barcode}, ${storage.specimen3.barcode}`);
    console.log(`  批次号: ${storage.batch.batch_number}`);
    console.log(`  报告号: ${storage.reports.map(r => r.report_number).join(', ')}`);
    console.log('\n可通过以下API查看详情:');
    console.log(`  GET /api/dashboard/overview`);
    console.log(`  GET /api/dashboard/specimen-timeline/${storage.specimen1.barcode}`);
    console.log(`  GET /api/dashboard/batch-report/${storage.batch.batch_number}`);
    console.log(`  GET /api/dashboard/cold-chain-alerts`);
    console.log();

  } catch (err) {
    console.error('\n❌ 演示过程中发生错误:', err.message);
    console.error(err.stack);
  }
}

runDemo();
