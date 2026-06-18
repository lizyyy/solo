const http = require('http');

function apiRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const result = body ? JSON.parse(body) : {};
          resolve({ statusCode: res.statusCode, ...result });
        } catch (e) {
          resolve({ statusCode: res.statusCode, rawBody: body });
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

async function runFullFlow() {
  console.log('\n' + '═'.repeat(80));
  console.log('  私募持仓穿透核对 - 完整真实样例流程');
  console.log('═'.repeat(80) + '\n');

  console.log('📋 Step 1: 导入托管确认页');
  console.log('─'.repeat(80));
  const importResult = await apiRequest('POST', '/api/records/import', {
    records: [
      { original_line_number: 1, fund_code: 'PF001', fund_name: '私募精选1号', security_code: '600519', security_name: '贵州茅台', settlement_date: '2026-06-10', quantity: 1000, amount: 1680000 },
      { original_line_number: 2, fund_code: 'PF001', fund_name: '私募精选1号', security_code: '000858', security_name: '五粮液', settlement_date: '2026-06-10', quantity: 2000, amount: 320000 },
      { original_line_number: 3, fund_code: 'PF002', fund_name: '私募成长2号', security_code: '300750', security_name: '宁德时代', settlement_date: '2026-06-10', quantity: 500, amount: 1025000 },
      { original_line_number: 4, fund_code: 'PF002', fund_name: '私募成长2号', security_code: '002594', security_name: '比亚迪', settlement_date: '2026-06-10', quantity: 800, amount: 208000 },
      { original_line_number: 5, fund_code: 'PF001', fund_name: '私募精选1号', security_code: '601318', security_name: '中国平安', settlement_date: '2026-06-10', quantity: 3000, amount: 150000 }
    ],
    operator: '阿芬'
  });
  console.log(`✅ 导入成功: 批次 ${importResult.batch_id}, 共 ${importResult.count} 条记录`);
  const ningdeId = importResult.records.find(r => r.security_code === '300750').id;
  console.log(`   宁德时代记录ID: ${ningdeId}`);
  console.log(`   当前状态: ${importResult.records.find(r => r.id === ningdeId).status}`);
  console.log(`   原始行号: ${importResult.records.find(r => r.id === ningdeId).original_line_number}`);
  console.log(`   原始到账日: ${importResult.records.find(r => r.id === ningdeId).original_settlement_date}`);
  console.log();

  console.log('📋 Step 2: 补看除权日截图，上传真实证据');
  console.log('─'.repeat(80));
  const screenshotResult = await apiRequest('POST', `/api/records/${ningdeId}/screenshot`, {
    operator: '阿芬',
    remark: '除权日截图显示宁德时代实际为T+2到账，与托管确认页T+1不符',
    screenshot_path: '/uploads/ex-right-300750-real.png'
  });
  console.log(`✅ 截图上传成功: 截图ID ${screenshotResult.screenshot_id}`);
  console.log(`   新状态: ${screenshotResult.new_status}`);
  console.log(`   截图路径: ${screenshotResult.screenshot_path}`);
  console.log();

  console.log('📋 Step 3: 记录T+1→T+2手工改动（关联证据截图）');
  console.log('─'.repeat(80));
  const changeResult = await apiRequest('POST', `/api/records/${ningdeId}/manual-change`, {
    field_name: 'settlement_date',
    old_value: '2026-06-10',
    new_value: '2026-06-11',
    change_reason: '除权日截图显示为T+2到账，托管确认页显示T+1有误，已与托管行电话确认',
    operator: '阿芬',
    evidence_screenshot: '/uploads/ex-right-300750-real.png'
  });
  console.log(`✅ 手工改动记录成功: 改动ID ${changeResult.change_log_id}`);
  console.log(`   改动类型: ${changeResult.change_type}`);
  console.log(`   新状态: ${changeResult.new_status}`);
  console.log(`   是否需要复核: ${changeResult.requires_review ? '是' : '否'}`);
  console.log(`   证据截图: ${changeResult.evidence_screenshot}`);
  console.log();

  console.log('📋 Step 4: 更新对账说明');
  console.log('─'.repeat(80));
  const noteResult = await apiRequest('POST', `/api/records/${ningdeId}/note`, {
    note_content: '托管确认页显示T+1（2026-06-10），但除权日截图实际为T+2（2026-06-11）。已与托管行客服003号通话确认，确实为T+2到账。已记录手工改动，待基金经理复核。',
    operator: '阿芬'
  });
  console.log(`✅ 对账说明更新成功: 说明ID ${noteResult.note_id}`);
  console.log(`   说明内容: ${noteResult.note_content}`);
  console.log();

  console.log('📋 Step 5: 基金经理复核');
  console.log('─'.repeat(80));
  const reviewResult = await apiRequest('POST', `/api/records/${ningdeId}/manager-review`, {
    approved: true,
    review_comment: '情况属实，除权日截图确实显示T+2到账，托管行也已确认。同意调整，保留全部证据链。',
    operator: '基金经理-李明'
  });
  console.log(`✅ 基金经理复核完成`);
  console.log(`   复核结果: ${reviewResult.approved ? '通过' : '驳回'}`);
  console.log(`   新状态: ${reviewResult.new_status}`);
  console.log(`   复核意见: ${reviewResult.review_comment}`);
  console.log();

  console.log('📋 Step 6: 标记为正常');
  console.log('─'.repeat(80));
  const finalizeResult = await apiRequest('POST', `/api/records/${ningdeId}/finalize`, {
    operator: '阿芬'
  });
  console.log(`✅ 标记正常成功`);
  console.log(`   最终状态: ${finalizeResult.new_status}`);
  console.log();

  console.log('📋 Step 7: 获取详情（验证所有字段）');
  console.log('─'.repeat(80));
  const detail = await apiRequest('GET', `/api/records/${ningdeId}`);
  console.log(`✅ 详情获取成功`);
  console.log(`   基本信息: ${detail.fund_name} - ${detail.security_name}`);
  console.log(`   原始到账日: ${detail.original_settlement_date}`);
  console.log(`   当前到账日: ${detail.current_settlement_date}`);
  console.log(`   处理状态: ${detail.status_label}`);
  console.log(`   是否人工改动: ${detail.has_manual_change ? '是' : '否'}`);
  console.log(`   改动类型: ${detail.change_type_label}`);
  console.log();
  console.log(`   对账说明 (${detail.reconciliation_notes.length}条):`);
  detail.reconciliation_notes.forEach((n, i) => console.log(`     [${i+1}] ${n.operator} ${n.update_time}: ${n.note_content}`));
  console.log();
  console.log(`   人工改动日志 (${detail.change_logs.length}条):`);
  detail.change_logs.forEach((l, i) => {
    console.log(`     [${i+1}] ${l.operator} ${l.operate_time} 改动 ${l.field_label}`);
    console.log(`         ${l.old_value} → ${l.new_value}`);
    console.log(`         原因: ${l.change_reason}`);
    console.log(`         证据: ${l.evidence_screenshot_url}`);
  });
  console.log();
  console.log(`   除权日截图 (${detail.ex_right_screenshots.length}条):`);
  detail.ex_right_screenshots.forEach((s, i) => {
    console.log(`     [${i+1}] ${s.upload_operator} ${s.upload_time}`);
    console.log(`         链接: ${s.screenshot_url}`);
    console.log(`         备注: ${s.remark}`);
  });
  console.log();
  console.log(`   状态流转历史 (${detail.status_transitions.length}条):`);
  detail.status_transitions.forEach((t, i) => {
    console.log(`     [${i+1}] ${t.operator} ${t.operate_time}`);
    console.log(`         ${t.from_status_label || '(初始)'} → ${t.to_status_label}`);
    console.log(`         ${t.transition_reason}`);
  });
  console.log();

  console.log('📋 Step 8: 导出数据（验证一致性）');
  console.log('─'.repeat(80));
  const exportData = await apiRequest('GET', '/api/export/json');
  const exportRecord = exportData.data.find(r => r['原始行号'] === 3 && r['证券代码'] === '300750');
  console.log(`✅ 导出数据获取成功，共 ${exportData.count} 条记录`);
  console.log();
  console.log(`   ┌─────────────────────────────────────────────────────────────┐`);
  console.log(`   │                导出数据 - 宁德时代 明细                        │`);
  console.log(`   ├──────────────────┬──────────────────────────────────────────┤`);
  console.log(`   │ 字段             │ 值                                        │`);
  console.log(`   ├──────────────────┼──────────────────────────────────────────┤`);
  console.log(`   │ 原始行号         │ ${String(exportRecord['原始行号']).padEnd(41)} │`);
  console.log(`   │ 证券名称         │ ${exportRecord['证券名称'].padEnd(41)} │`);
  console.log(`   │ 原始到账日       │ ${exportRecord['原始到账日'].padEnd(41)} │`);
  console.log(`   │ 当前到账日       │ ${exportRecord['当前到账日'].padEnd(41)} │`);
  console.log(`   │ 处理状态         │ ${exportRecord['处理状态'].padEnd(41)} │`);
  console.log(`   │ 是否人工改动     │ ${exportRecord['是否人工改动'].padEnd(41)} │`);
  console.log(`   │ 改动类型         │ ${exportRecord['改动类型'].padEnd(41)} │`);
  console.log(`   │ 对账说明         │ ${(exportRecord['对账说明'] || '').slice(0, 40).padEnd(41)} │`);
  console.log(`   │                  │ ${(exportRecord['对账说明'] || '').slice(40, 80).padEnd(41)} │`);
  console.log(`   │ 除权日截图       │ ${(exportRecord['除权日截图'] || '').slice(0, 40).padEnd(41)} │`);
  console.log(`   │ 人工改动证据     │ ${(exportRecord['人工改动证据截图'] || '').slice(0, 40).padEnd(41)} │`);
  console.log(`   │ 状态流转历史     │ ${(exportRecord['状态流转历史'] || '').slice(0, 40).padEnd(41)} │`);
  console.log(`   └──────────────────┴──────────────────────────────────────────┘`);
  console.log();

  console.log('📋 Step 9: 验证截图链接可访问');
  console.log('─'.repeat(80));
  const screenshotUrls = [
    detail.ex_right_screenshots[0].screenshot_url,
    detail.change_logs[0].evidence_screenshot_url
  ];

  for (const url of screenshotUrls) {
    const path = url.replace('http://localhost:3000', '');
    const result = await apiRequest('GET', path);
    const accessible = result.statusCode === 200;
    console.log(`   ${accessible ? '✅' : '❌'} ${url}`);
    console.log(`     HTTP状态: ${result.statusCode} ${accessible ? '(可访问)' : '(失效!)'}`);
    console.log(`     指向文件: ${path}`);
  }
  console.log();

  console.log('📋 Step 10: 三源同数一致性核对');
  console.log('─'.repeat(80));
  const listData = await apiRequest('GET', '/api/records');
  const listRecord = listData.data.find(r => r.id === ningdeId);

  const checks = [
    { name: '对账说明', api: detail.reconciliation_notes[0].note_content, list: listRecord.reconciliation_notes[0].note_content, export: exportRecord['对账说明'] },
    { name: '除权日截图链接', api: detail.ex_right_screenshots[0].screenshot_url, list: listRecord.ex_right_screenshots[0].screenshot_url, export: exportRecord['除权日截图'].includes(detail.ex_right_screenshots[0].screenshot_url) ? detail.ex_right_screenshots[0].screenshot_url : 'MISMATCH' },
    { name: '人工改动证据链接', api: detail.change_logs[0].evidence_screenshot_url, list: listRecord.change_logs[0].evidence_screenshot_url, export: exportRecord['人工改动证据截图'].includes(detail.change_logs[0].evidence_screenshot_url) ? detail.change_logs[0].evidence_screenshot_url : 'MISMATCH' },
    { name: '状态流转历史条数', api: detail.status_transitions.length, list: listRecord.status_transitions.length, export: exportRecord['状态流转历史'].split('; ').length },
    { name: '当前到账日', api: detail.current_settlement_date, list: listRecord.current_settlement_date, export: exportRecord['当前到账日'] },
    { name: '处理状态', api: detail.status_label, list: listRecord.status_label, export: exportRecord['处理状态'] }
  ];

  console.log(`   ┌──────────────────────┬──────────────────────┬──────────────────────┬────────┐`);
  console.log(`   │ 核对项               │ API详情              │ 列表数据             │ 导出数据 │ 一致? │`);
  console.log(`   ├──────────────────────┼──────────────────────┼──────────────────────┼──────────┼───────┤`);

  let allPassed = true;
  for (const c of checks) {
    const apiStr = String(c.api).slice(0, 20);
    const listStr = String(c.list).slice(0, 20);
    const exportStr = String(c.export).slice(0, 20);
    const match = String(c.api) === String(c.list) && String(c.api) === String(c.export);
    if (!match) allPassed = false;
    console.log(`   │ ${c.name.padEnd(20)} │ ${apiStr.padEnd(20)} │ ${listStr.padEnd(20)} │ ${exportStr.padEnd(22)} │ ${match ? '✅ 通过' : '❌ 失败'} │`);
  }

  console.log(`   └──────────────────────┴──────────────────────┴──────────────────────┴──────────┴───────┘`);
  console.log();

  if (allPassed) {
    console.log('🎉 所有核对项全部通过！三源同数验证成功。');
  } else {
    console.log('❌ 存在不一致项，请检查。');
    process.exit(1);
  }

  console.log();
  console.log('═'.repeat(80));
  console.log('  完整流程走完，请在浏览器中验证页面展示：');
  console.log('  http://localhost:3000');
  console.log('═'.repeat(80) + '\n');
}

runFullFlow().catch(err => {
  console.error('流程执行失败:', err);
  process.exit(1);
});
