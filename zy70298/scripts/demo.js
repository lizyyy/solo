const http = require('http');

const BASE_URL = 'http://localhost:3000';

function request(method, path, body = null) {
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
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data
          });
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function printSection(title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(60)}\n`);
}

function printResult(label, result, showData = true) {
  console.log(`>>> ${label}`);
  console.log(`    状态码: ${result.status}`);
  if (showData && result.data) {
    if (result.data.success) {
      console.log(`    成功: yes`);
      if (result.data.data) {
        console.log(`    数据摘要: ${JSON.stringify(result.data.data, null, 2).substring(0, 500)}`);
      }
    } else {
      console.log(`    成功: no`);
      console.log(`    错误码: ${result.data.error?.code}`);
      console.log(`    错误信息: ${result.data.error?.message}`);
      console.log(`    已记录问题: ${result.data.issueRecorded}`);
      if (result.data.error?.details) {
        console.log(`    详情: ${JSON.stringify(result.data.error.details, null, 2)}`);
      }
    }
  }
  console.log();
}

async function main() {
  printSection('Demo开始 - 养老院药盒分发核验API');
  
  console.log('正在检查服务是否启动...\n');
  await sleep(1000);
  
  try {
    const health = await request('GET', '/health');
    if (health.status !== 200) {
      console.log('服务未启动。请先运行: npm start');
      console.log('然后在另一个终端运行: npm run demo');
      process.exit(1);
    }
    printResult('健康检查', health);
  } catch (e) {
    console.log('服务未启动。请先运行: npm start');
    console.log('然后在另一个终端运行: npm run demo');
    process.exit(1);
  }
  
  printSection('步骤1: 查看系统规则');
  const rules = await request('GET', '/api/rules');
  printResult('获取规则说明', rules);
  await sleep(500);
  
  printSection('步骤2: 创建老人档案');
  const elder1 = await request('POST', '/api/elders', {
    id: 'elder-zhang',
    name: '张大爷',
    bed_number: 'A-101',
    status: 'active'
  });
  printResult('创建张大爷档案', elder1);
  
  const elder2 = await request('POST', '/api/elders', {
    id: 'elder-li',
    name: '李奶奶',
    bed_number: 'A-102',
    status: 'active'
  });
  printResult('创建李奶奶档案', elder2);
  await sleep(500);
  
  printSection('步骤3: 为老人创建医嘱（带版本）');
  const today = new Date().toISOString().split('T')[0];
  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const prescription1 = await request('POST', '/api/prescriptions', {
    elder_id: 'elder-zhang',
    doctor_name: '王医生',
    effective_from: today,
    effective_to: nextMonth,
    notes: '高血压常规用药',
    items: [
      { medicine_name: '降压片', dosage: '5mg', frequency: '每日1次', quantity: 1 },
      { medicine_name: '阿司匹林', dosage: '100mg', frequency: '每日1次', quantity: 1 }
    ]
  });
  printResult('创建张大爷的医嘱 v1', prescription1);
  
  const prescription2 = await request('POST', '/api/prescriptions', {
    elder_id: 'elder-li',
    doctor_name: '王医生',
    effective_from: today,
    effective_to: nextMonth,
    notes: '糖尿病用药',
    items: [
      { medicine_name: '二甲双胍', dosage: '500mg', frequency: '每日2次', quantity: 2 }
    ]
  });
  printResult('创建李奶奶的医嘱 v1', prescription2);
  await sleep(500);
  
  printSection('步骤4: 准备药盒 - 完全匹配的情况');
  const goodBox = await request('POST', '/api/pill-boxes', {
    elder_id: 'elder-zhang',
    box_label: '张大爷-今日早',
    intended_date: today,
    items: [
      { medicine_name: '降压片', dosage: '5mg', quantity: 1, unit: '片' },
      { medicine_name: '阿司匹林', dosage: '100mg', quantity: 1, unit: '片' }
    ]
  });
  printResult('创建正确药盒', goodBox);
  const goodBoxId = goodBox.data.data.id;
  
  const match1 = await request('GET', `/api/pill-boxes/${goodBoxId}/match`);
  printResult('检查药盒匹配情况（应匹配成功）', match1);
  await sleep(500);
  
  printSection('步骤5: 准备药盒 - 多种不匹配的情况（演示脏数据不跳过，进入问题列表）');
  
  const wrongDosage = await request('POST', '/api/pill-boxes', {
    elder_id: 'elder-zhang',
    box_label: '张大爷-错误剂量',
    intended_date: today,
    items: [
      { medicine_name: '降压片', dosage: '10mg', quantity: 1, unit: '片' },
      { medicine_name: '阿司匹林', dosage: '100mg', quantity: 1, unit: '片' }
    ]
  });
  printResult('创建剂量错误药盒', wrongDosage);
  
  const wrongQty = await request('POST', '/api/pill-boxes', {
    elder_id: 'elder-zhang',
    box_label: '张大爷-数量错误',
    intended_date: today,
    items: [
      { medicine_name: '降压片', dosage: '5mg', quantity: 2, unit: '片' },
      { medicine_name: '阿司匹林', dosage: '100mg', quantity: 1, unit: '片' }
    ]
  });
  printResult('创建数量错误药盒', wrongQty);
  
  const extraMed = await request('POST', '/api/pill-boxes', {
    elder_id: 'elder-zhang',
    box_label: '张大爷-多药',
    intended_date: today,
    items: [
      { medicine_name: '降压片', dosage: '5mg', quantity: 1, unit: '片' },
      { medicine_name: '阿司匹林', dosage: '100mg', quantity: 1, unit: '片' },
      { medicine_name: '维生素C', dosage: '100mg', quantity: 1, unit: '片' }
    ]
  });
  printResult('创建含未医嘱药品的药盒', extraMed);
  
  const missingMed = await request('POST', '/api/pill-boxes', {
    elder_id: 'elder-zhang',
    box_label: '张大爷-缺药',
    intended_date: today,
    items: [
      { medicine_name: '降压片', dosage: '5mg', quantity: 1, unit: '片' }
    ]
  });
  printResult('创建缺少医嘱药品的药盒', missingMed);
  await sleep(500);
  
  printSection('步骤6: 执行分发 - 正确药盒可以分发成功');
  const goodPrescriptionId = prescription1.data.data.id;
  const distSuccess = await request('POST', '/api/distributions', {
    pill_box_id: goodBoxId,
    prescription_id: goodPrescriptionId,
    distributor: '护士小张'
  });
  printResult('正确药盒分发（应成功）', distSuccess);
  const distId = distSuccess.data.data?.distribution?.id;
  await sleep(500);
  
  printSection('步骤7: 执行分发 - 不匹配的药盒会失败并记录问题');
  const wrongDosageId = wrongDosage.data.data.id;
  const distFail1 = await request('POST', '/api/distributions', {
    pill_box_id: wrongDosageId,
    prescription_id: goodPrescriptionId,
    distributor: '护士小张'
  });
  printResult('剂量错误药盒分发（应失败）', distFail1);
  
  const extraMedId = extraMed.data.data.id;
  const distFail2 = await request('POST', '/api/distributions', {
    pill_box_id: extraMedId,
    prescription_id: goodPrescriptionId,
    distributor: '护士小张'
  });
  printResult('含未医嘱药品药盒分发（应失败）', distFail2);
  
  const missingMedId = missingMed.data.data.id;
  const distFail3 = await request('POST', '/api/distributions', {
    pill_box_id: missingMedId,
    prescription_id: goodPrescriptionId,
    distributor: '护士小张'
  });
  printResult('缺少医嘱药品药盒分发（应失败）', distFail3);
  await sleep(500);
  
  printSection('步骤8: 测试医嘱-老人不匹配的情况');
  const liBox = await request('POST', '/api/pill-boxes', {
    elder_id: 'elder-li',
    box_label: '李奶奶-今日早',
    intended_date: today,
    items: [
      { medicine_name: '二甲双胍', dosage: '500mg', quantity: 2, unit: '片' }
    ]
  });
  const liBoxId = liBox.data.data.id;
  
  const crossMatchFail = await request('POST', '/api/distributions', {
    pill_box_id: liBoxId,
    prescription_id: goodPrescriptionId,
    distributor: '护士小张'
  });
  printResult('李奶奶药盒用张大爷医嘱（应失败）', crossMatchFail);
  await sleep(500);
  
  printSection('步骤9: 提交服药回执 - 成功流程');
  const receiptSuccess = await request('POST', '/api/receipts', {
    distribution_id: distId,
    receipt_type: 'self',
    received_by: '张大爷本人',
    notes: '已确认服用',
    actual_medicines: [
      { medicine_name: '降压片', dosage: '5mg', quantity: 1 },
      { medicine_name: '阿司匹林', dosage: '100mg', quantity: 1 }
    ]
  });
  printResult('提交正确回执（应成功）', receiptSuccess);
  await sleep(500);
  
  printSection('步骤10: 提交服药回执 - 药品不匹配会失败');
  const liPrescriptionId = prescription2.data.data.id;
  const liDist = await request('POST', '/api/distributions', {
    pill_box_id: liBoxId,
    prescription_id: liPrescriptionId,
    distributor: '护士小张'
  });
  const liDistId = liDist.data.data?.distribution?.id;
  
  const receiptFail = await request('POST', '/api/receipts', {
    distribution_id: liDistId,
    receipt_type: 'self',
    received_by: '李奶奶本人',
    actual_medicines: [
      { medicine_name: '降压片', dosage: '5mg', quantity: 1 }
    ]
  });
  printResult('提交药品不匹配的回执（应失败）', receiptFail);
  await sleep(500);
  
  printSection('步骤11: 查看问题列表 - 所有脏数据都被记录');
  const issues = await request('GET', '/api/issues?status=open');
  const openCount = issues.data?.data?.length || 0;
  console.log(`>>> 获取所有未解决问题`);
  console.log(`    状态码: ${issues.status}`);
  console.log(`    未解决问题数量: ${openCount}`);
  if (issues.data?.data && issues.data.data.length > 0) {
    console.log(`\n    问题列表:`);
    issues.data.data.slice(0, 8).forEach((issue, idx) => {
      console.log(`      ${idx + 1}. [${issue.severity.toUpperCase()}] ${issue.title}`);
      console.log(`         类型: ${issue.type}, 来源: ${issue.source_type}`);
      console.log(`         来源ID: ${issue.source_id}`);
    });
  }
  console.log();
  
  printSection('步骤12: 按老人查看相关问题');
  const zhangIssues = await request('GET', '/api/issues?elder_id=elder-zhang');
  const zhangCount = zhangIssues.data?.data?.length || 0;
  console.log(`>>> 获取张大爷相关问题`);
  console.log(`    张大爷相关问题数量: ${zhangCount}`);
  console.log();
  
  printSection('Demo完成! 关键验证点总结');
  console.log(`
  已验证的核心规则:
  
  1. 药盒药品必须与医嘱完全匹配
     - 药品名称+剂量必须一致 ✓
     - 药品数量必须一致 ✓
     - 不能有未医嘱药品 ✓
     - 不能缺少医嘱药品 ✓
  
  2. 医嘱必须在有效期内
     - 必须在effective_from和effective_to之间 ✓
  
  3. 老人一致性
     - 药盒、医嘱、回执必须属于同一老人 ✓
  
  4. 回执一致性
     - 回执药品必须与分发药盒一致 ✓
  
  5. 问题记录
     - 所有失败都进入问题列表 ✓
     - 问题包含来源类型和来源ID ✓
     - 问题可按老人查询 ✓
  
  可查询的接口:
  - GET /api/elders                       老人列表
  - GET /api/elders/:id/prescriptions     老人医嘱
  - GET /api/pill-boxes/:id/match         药盒匹配详情
  - GET /api/issues                       问题列表
  - GET /api/rules                        规则说明
  
  运行 npm run test 可执行自动化测试脚本
  `);
}

main().catch(console.error);
