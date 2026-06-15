const http = require('http');

const baseUrl = 'http://localhost:3001/api';

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl + path);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('========================================');
  console.log('📊 问题样例完整流程演示');
  console.log('========================================');
  console.log('');

  console.log('📌 场景说明：');
  console.log('   负样本列表先导入，后来林姐才补看召回候选表。');
  console.log('   回看周报时发现负样本列表结论不能直接照抄，');
  console.log('   尤其是离线和线上分数差了一个桶的记录。');
  console.log('');
  console.log('   本脚本完整走完三步流程，停在导出明细查看，');
  console.log('   展示状态变化、历史留痕和结果说明。');
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('第一步：创建周报 & 导入负样本列表');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const week = '2024-W24-DEMO';
  const report = await request('/reports', {
    method: 'POST',
    body: { week_number: week, title: '【问题样例演示】2024-W24推荐探索率周报', created_by: 'operator_zhang' }
  });
  const reportId = report.id;
  console.log(`✅ 创建周报成功，ID: ${reportId}`);

  const negativeSamples = [
    { original_line_no: 1, item_id: 'DEMO001', item_title: '夏季碎花连衣裙', offline_score: 0.32, online_score: 0.41 },
    { original_line_no: 2, item_id: 'DEMO002', item_title: '男士休闲板鞋', offline_score: 0.58, online_score: 0.52 },
    { original_line_no: 3, item_id: 'DEMO003', item_title: '智能手表Pro', offline_score: 0.75, online_score: 0.68 },
    { original_line_no: 4, item_id: 'DEMO004', item_title: '降噪蓝牙耳机', offline_score: 0.44, online_score: 0.51 },
    { original_line_no: 5, item_id: 'DEMO005', item_title: '家用扫地机器人', offline_score: 0.21, online_score: 0.29 },
  ];
  console.log(`📥 导入 ${negativeSamples.length} 条负样本...`);
  const importResult = await request(`/reports/${reportId}/samples/import`, {
    method: 'POST',
    body: { samples: negativeSamples, operator: 'operator_zhang' }
  });
  console.log(`✅ 导入成功: ${importResult.imported} 条`);

  const samplesAfterImport = await request(`/reports/${reportId}/samples`);
  const anomalies = samplesAfterImport.filter(s => s.is_bucket_diff_anomaly === 1);
  console.log(`🔍 检测到 ${anomalies.length} 条分差一桶异常记录:`);
  anomalies.forEach(a => {
    console.log(`   • #${a.original_line_no} ${a.item_id}: 离线桶${a.offline_bucket} → 线上桶${a.online_bucket} (差1)`);
  });

  await request(`/reports/${reportId}/status`, {
    method: 'PATCH',
    body: { status: 'step1_imported' }
  });
  console.log('✅ 状态更新为：已导入负样本');

  console.log('');
  console.log('📤 第一次导出（导入后立刻导出）');
  await request(`/reports/${reportId}/export?exported_by=operator_zhang`);
  const exportHistory1 = await request(`/reports/${reportId}/export-history`);
  const export1 = exportHistory1[0];
  console.log(`✅ 第一次导出完成，导出ID: #${export1.id}`);
  console.log(`   异常数: ${export1.anomaly_count} 条`);

  await sleep(500);

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('第二步：数据科学家林姐补看召回候选表');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  console.log('👩‍🔬 林姐回看周报，发现召回候选表后来才补上...');
  console.log('📝 林姐补充3条召回候选数据...');

  const recallItems = [
    { item_id: 'REC-DEMO001', item_title: '林姐补录-碎花上衣', recall_source: '召回通道A', recall_score: 0.65, sample_id: samplesAfterImport[0].id },
    { item_id: 'REC-DEMO002', item_title: '林姐补录-休闲凉鞋', recall_source: '召回通道B', recall_score: 0.58, sample_id: samplesAfterImport[1].id },
    { item_id: 'REC-DEMO003', item_title: '林姐补录-运动T恤', recall_source: '召回通道A', recall_score: 0.72 },
  ];
  await request(`/reports/${reportId}/recalls`, {
    method: 'POST',
    body: { items: recallItems, added_by: 'linjie' }
  });
  console.log('✅ 林姐补录召回候选完成，3条已添加');

  console.log('');
  console.log('⚠️  重点：补录后重算分桶');
  console.log('   离线和线上分数差了一个桶的记录，别急着归正常，留给评测运营复核！');
  console.log('');
  const recalcResult = await request(`/reports/${reportId}/recalc`, {
    method: 'POST',
    body: { operator: 'linjie' }
  });
  console.log(`✅ 重算完成，异常记录仍保留: ${recalcResult.anomaly_count} 条`);

  await request(`/reports/${reportId}/status`, {
    method: 'PATCH',
    body: { status: 'step2_recall_added' }
  });
  console.log('✅ 状态更新为：已补录召回候选');

  console.log('');
  console.log('📤 第二次导出（补录重算后导出）');
  await request(`/reports/${reportId}/export?exported_by=linjie`);
  const exportHistory2 = await request(`/reports/${reportId}/export-history`);
  const export2 = exportHistory2[0];
  console.log(`✅ 第二次导出完成，导出ID: #${export2.id}`);

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('第三步：实验对比更新');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  console.log('🧪 更新实验对比结果...');
  console.log('⚠️  分差一桶异常的记录不急着归正常，留给评测运营复核');
  console.log('');

  const demoSample = samplesAfterImport[0];
  console.log(`📝 对异常记录 #${demoSample.original_line_no} ${demoSample.item_id} 添加人工备注`);
  await request(`/samples/${demoSample.id}`, {
    method: 'PATCH',
    body: {
      manual_remark: '林姐：此物料离线线上分差一桶，疑似召回通道影响，待运营复核确认是否为真异常',
      processing_status: 'reviewing',
      operator: 'linjie'
    }
  });
  console.log('✅ 已添加备注并更新状态为"复核中"');

  const demoSample2 = samplesAfterImport[2];
  console.log(`📝 对异常记录 #${demoSample2.original_line_no} ${demoSample2.item_id} 添加人工备注`);
  await request(`/samples/${demoSample2.id}`, {
    method: 'PATCH',
    body: {
      manual_remark: '林姐：分差一桶，已关联召回候选REC-DEMO003，待运营确认',
      processing_status: 'reviewing',
      operator: 'linjie'
    }
  });

  await request(`/reports/${reportId}/status`, {
    method: 'PATCH',
    body: { status: 'step3_experiment_updated' }
  });
  console.log('✅ 状态更新为：实验对比已更新');

  console.log('');
  console.log('📤 第三次导出（实验更新后导出）');
  await request(`/reports/${reportId}/export?exported_by=linjie`);
  const exportHistory3 = await request(`/reports/${reportId}/export-history`);
  const export3 = exportHistory3[0];
  console.log(`✅ 第三次导出完成，导出ID: #${export3.id}`);

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📌 运行自检');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  const checkResult = await request(`/reports/${reportId}/self-check`, { method: 'POST' });
  console.log('✅ 自检结果：');
  Object.entries(checkResult).forEach(([k, v]) => {
    const icon = v.passed ? '✅' : '⚠️ ';
    console.log(`   ${icon} ${k}: ${v.details}`);
  });

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎯 流程完成！现在停在导出明细查看');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`📊 周报 ID: ${reportId}`);
  console.log(`📂 最新导出 ID: #${export3.id}`);
  console.log('');
  console.log('请在浏览器中访问：');
  console.log(`  http://localhost:3001`);
  console.log('');
  console.log('然后：');
  console.log('  1. 点击进入【问题样例演示】周报');
  console.log('  2. 切换到【导出历史】标签');
  console.log(`  3. 点击最新导出 #${export3.id} 的【查看明细】`);
  console.log('');
  console.log('在导出明细页面可以看到：');
  console.log('  ✅ 结果说明：数据一致性承诺');
  console.log('  ✅ 分差一桶异常记录汇总（红色高亮）');
  console.log('  ✅ 与上次导出的差异对比（状态变更等）');
  console.log('  ✅ 每条记录的【查看证据链】→ 导出时的完整历史留痕');
  console.log('  ✅ 状态流转历史、重算历史、备注历史、审计日志');
  console.log('');
  console.log('🧾 证据链说明：');
  console.log('   单条记录可追溯从"第一次导入"到"当前"的每一步操作，');
  console.log('   包括：导入时间、操作人、状态变更、重算记录、备注修改、关联召回等。');
  console.log('   评测运营追问时，可直接对照证据链回复，不是只看一个汇总数。');
  console.log('');
}

main().catch(console.error);
