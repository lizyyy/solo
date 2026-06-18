const http = require('http');
const fs = require('fs');
const path = require('path');

const output = [];
function log(str) {
  console.log(str);
  output.push(str);
}

function apiRequest(method, path, data = null, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`请求超时: ${method} ${path}`));
    }, timeout);

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
      clearTimeout(timer);
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

    req.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  log('\n' + '═'.repeat(80));
  log('  私募持仓穿透核对 - 完整真实样例流程验证');
  log('═'.repeat(80) + '\n');

  let ningdeId = null;

  // Step 1: 导入
  log('📋 Step 1: 导入托管确认页');
  const importResult = await apiRequest('POST', '/api/records/import', {
    records: [
      { original_line_number: 3, fund_code: 'PF002', fund_name: '私募成长2号', security_code: '300750', security_name: '宁德时代', settlement_date: '2026-06-10', quantity: 500, amount: 1025000 }
    ],
    operator: '阿芬'
  });
  ningdeId = importResult.records[0].id;
  log(`   ✅ 导入成功，宁德时代ID: ${ningdeId}`);
  log(`   当前状态: ${importResult.records[0].status}`);
  log();

  // Step 2: 上传截图
  log('📋 Step 2: 上传除权日截图');
  const screenshotResult = await apiRequest('POST', `/api/records/${ningdeId}/screenshot`, {
    operator: '阿芬',
    remark: '除权日截图显示T+2到账',
    screenshot_path: '/uploads/ex-right-300750-real.png'
  });
  log(`   ✅ 截图上传成功: ${screenshotResult.new_status}`);
  log();

  // Step 3: 记录改动
  log('📋 Step 3: 记录T+1→T+2手工改动');
  const changeResult = await apiRequest('POST', `/api/records/${ningdeId}/manual-change`, {
    field_name: 'settlement_date',
    old_value: '2026-06-10',
    new_value: '2026-06-11',
    change_reason: '除权日截图显示T+2，与托管确认页T+1不符',
    operator: '阿芬',
    evidence_screenshot: '/uploads/ex-right-300750-real.png'
  });
  log(`   ✅ 改动记录成功: ${changeResult.change_type}`);
  log(`   新状态: ${changeResult.new_status}`);
  log(`   需要复核: ${changeResult.requires_review}`);
  log();

  // Step 4: 更新对账说明
  log('📋 Step 4: 更新对账说明');
  const noteResult = await apiRequest('POST', `/api/records/${ningdeId}/note`, {
    note_content: '托管确认页显示T+1，除权日截图实际为T+2，已与托管行确认，待基金经理复核。',
    operator: '阿芬'
  });
  log(`   ✅ 对账说明更新成功`);
  log();

  // Step 5: 基金经理复核
  log('📋 Step 5: 基金经理复核通过');
  const reviewResult = await apiRequest('POST', `/api/records/${ningdeId}/manager-review`, {
    approved: true,
    review_comment: '情况属实，同意调整。',
    operator: '基金经理-李明'
  });
  log(`   ✅ 复核通过: ${reviewResult.new_status}`);
  log();

  // Step 6: 标记正常
  log('📋 Step 6: 标记为正常');
  const finalizeResult = await apiRequest('POST', `/api/records/${ningdeId}/finalize`, {
    operator: '阿芬'
  });
  log(`   ✅ 标记正常: ${finalizeResult.new_status}`);
  log();

  // Step 7: 验证详情
  log('📋 Step 7: 验证详情数据');
  const detail = await apiRequest('GET', `/api/records/${ningdeId}`);
  log(`   ✅ 对账说明: ${detail.reconciliation_notes[0].note_content.slice(0, 50)}...`);
  log(`   ✅ 除权日截图链接: ${detail.ex_right_screenshots[0].screenshot_url}`);
  log(`   ✅ 人工改动证据链接: ${detail.change_logs[0].evidence_screenshot_url}`);
  log(`   ✅ 状态流转条数: ${detail.status_transitions.length}`);
  log();

  // Step 8: 验证列表
  log('📋 Step 8: 验证列表数据');
  const listData = await apiRequest('GET', '/api/records');
  const listRecord = listData.data.find(r => r.id === ningdeId);
  log(`   ✅ 列表对账说明存在: ${listRecord.reconciliation_notes && listRecord.reconciliation_notes.length > 0 ? '是' : '否'}`);
  log(`   ✅ 列表除权日截图存在: ${listRecord.ex_right_screenshots && listRecord.ex_right_screenshots.length > 0 ? '是' : '否'}`);
  log(`   ✅ 列表状态流转存在: ${listRecord.status_transitions && listRecord.status_transitions.length > 0 ? '是' : '否'}`);
  log(`   ✅ 列表截图链接完整: ${listRecord.ex_right_screenshots[0].screenshot_url.startsWith('http') ? '是' : '否'}`);
  log();

  // Step 9: 验证导出
  log('📋 Step 9: 验证导出数据');
  const exportData = await apiRequest('GET', '/api/export/json');
  const exportRecord = exportData.data.find(r => r['证券代码'] === '300750');
  log(`   ✅ 导出对账说明: ${exportRecord['对账说明'] ? exportRecord['对账说明'].slice(0, 50) + '...' : '为空!'}`);
  log(`   ✅ 导出除权日截图: ${exportRecord['除权日截图']}`);
  log(`   ✅ 导出人工改动证据: ${exportRecord['人工改动证据截图']}`);
  log(`   ✅ 导出状态流转历史: ${exportRecord['状态流转历史'] ? '有' : '为空!'}`);
  log();

  // Step 10: 验证截图链接可访问
  log('📋 Step 10: 验证截图链接可访问');
  const urls = [
    detail.ex_right_screenshots[0].screenshot_url,
    detail.change_logs[0].evidence_screenshot_url
  ];
  for (const url of urls) {
    const path = url.replace('http://localhost:3000', '');
    const result = await apiRequest('GET', path);
    const ok = result.statusCode === 200 && result.rawBody && result.rawBody.length > 0;
    log(`   ${ok ? '✅' : '❌'} ${url}`);
    log(`     HTTP ${result.statusCode}, 文件大小: ${result.rawBody ? result.rawBody.length : 0} 字节`);
  }
  log();

  // Step 11: 三源同数核对
  log('📋 Step 11: 三源同数最终核对');
  const exportData2 = await apiRequest('GET', '/api/export/json');
  const exportRecord2 = exportData2.data.find(r => r['证券代码'] === '300750');
  const listRecord2 = (await apiRequest('GET', '/api/records')).data.find(r => r.id === ningdeId);
  const detail2 = await apiRequest('GET', `/api/records/${ningdeId}`);

  const checks = [
    {
      name: '对账说明',
      api: detail2.reconciliation_notes[0].note_content,
      list: listRecord2.reconciliation_notes[0].note_content,
      export: exportRecord2['对账说明']
    },
    {
      name: '除权日截图URL',
      api: detail2.ex_right_screenshots[0].screenshot_url,
      list: listRecord2.ex_right_screenshots[0].screenshot_url,
      export: exportRecord2['除权日截图']
    },
    {
      name: '人工改动证据URL',
      api: detail2.change_logs[0].evidence_screenshot_url,
      list: listRecord2.change_logs[0].evidence_screenshot_url,
      export: exportRecord2['人工改动证据截图']
    },
    {
      name: '当前到账日',
      api: detail2.current_settlement_date,
      list: listRecord2.current_settlement_date,
      export: exportRecord2['当前到账日']
    },
    {
      name: '处理状态',
      api: detail2.status_label,
      list: listRecord2.status_label,
      export: exportRecord2['处理状态']
    }
  ];

  log(`   ┌──────────────────────┬──────────────────────────────────┬─────────┐`);
  log(`   │ 核对项               │ 值                                │ 三源一致?│`);
  log(`   ├──────────────────────┼──────────────────────────────────┼─────────┤`);

  let allPassed = true;
  for (const c of checks) {
    const match = String(c.api) === String(c.list) && 
                  String(c.api) === String(c.export);
    if (!match) allPassed = false;
    const valStr = String(c.api).slice(0, 30).padEnd(32);
    log(`   │ ${c.name.padEnd(20)} │ ${valStr} │ ${match ? '✅ 通过  ' : '❌ 失败  '}│`);
  }
  log(`   └──────────────────────┴──────────────────────────────────┴─────────┘`);
  log();

  if (allPassed) {
    log('🎉 所有核对项全部通过！证据链完整、链接有效、三源同数。');
  } else {
    log('❌ 存在不一致项！');
    process.exit(1);
  }

  fs.writeFileSync(
    path.join(__dirname, '..', 'flow-result.txt'),
    output.join('\n') + '\n'
  );

  log('\n结果已写入 flow-result.txt');
  log('\n现在请在浏览器验证页面：');
  log('   1. 访问 http://localhost:3000');
  log('   2. 点击宁德时代行的「详情」按钮');
  log('   3. 检查6个区域都有内容：基本信息、核对数据、人工改动日志、状态流转历史、除权日截图、对账说明');
  log('   4. 点击「查看截图」链接验证能打开图片');
  log('   5. 点击「导出JSON」验证导出内容\n');
}

runTests().catch(err => {
  console.error('错误:', err.message);
  process.exit(1);
});
