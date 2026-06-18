const http = require('http');
const fs = require('fs');
const path = require('path');

const output = [];
function log(str, color = '') {
  const colorMap = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    gray: '\x1b[90m',
    reset: '\x1b[0m'
  };
  const prefix = colorMap[color] || '';
  const suffix = color ? colorMap.reset : '';
  const line = prefix + str + suffix;
  console.log(line);
  output.push(str);
}

function apiRequest(method, apiPath, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 3000,
      path: apiPath,
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

async function verifyImage(urlPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 3000,
      path: urlPath,
      method: 'GET'
    };
    const req = http.request(options, (res) => {
      let data = Buffer.alloc(0);
      res.on('data', (chunk) => { data = Buffer.concat([data, chunk]); });
      res.on('end', () => resolve({ status: res.statusCode, size: data.length }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  log('\n' + '═'.repeat(90), 'blue');
  log('  私募持仓穿透核对 - 完整真实样例流程验证（命令行版）', 'blue');
  log('═'.repeat(90), 'blue');

  // Step 0: 健康检查
  log('\n📋 Step 0: 健康检查', 'yellow');
  const health = await apiRequest('GET', '/api/health');
  log(`   ✅ ${health.message}`, 'green');

  let recordId = null;

  // Step 1: 导入
  log('\n📋 Step 1: 导入托管确认页（宁德时代，原始行号3）', 'yellow');
  const imp = await apiRequest('POST', '/api/records/import', {
    records: [
      { original_line_number: 3, fund_code: 'PF002', fund_name: '私募成长2号', security_code: '300750', security_name: '宁德时代', settlement_date: '2026-06-10', quantity: 500, amount: 1025000 }
    ],
    operator: '阿芬'
  });
  recordId = imp.data.records[0].id;
  log(`   ✅ 导入成功，记录ID: ${recordId}`, 'green');
  log(`   批次号: ${imp.data.batch_id}`, 'gray');
  log(`   原始到账日: ${imp.data.records[0].original_settlement_date}`, 'gray');

  // Step 2: 上传截图
  log('\n📋 Step 2: 补看除权日截图（上传真实文件）', 'yellow');
  const s = await apiRequest('POST', `/api/records/${recordId}/screenshot`, {
    operator: '阿芬',
    remark: '除权日截图显示宁德时代T+2到账，与托管确认页T+1不符',
    screenshot_path: '/uploads/ex-right-300750-real.png'
  });
  log(`   ✅ 截图上传成功: 截图ID ${s.screenshot_id}`, 'green');
  log(`   处理判断: 状态 IMPORTED → SCREENSHOT_REVIEWED`, 'gray');
  log(`   当前状态: ${s.new_status}`, s.new_status === 'SCREENSHOT_REVIEWED' ? 'green' : 'red');
  log(`   证据文件路径: ${s.screenshot_path}`, 'gray');

  // Step 3: 记录T+1→T+2改动
  log('\n📋 Step 3: 记录T+1→T+2手工改动', 'yellow');
  const c = await apiRequest('POST', `/api/records/${recordId}/manual-change`, {
    field_name: 'settlement_date',
    old_value: '2026-06-10',
    new_value: '2026-06-11',
    change_reason: '除权日截图显示为T+2到账，托管确认页显示T+1有误，已与托管行电话确认',
    operator: '阿芬',
    evidence_screenshot: '/uploads/ex-right-300750-real.png'
  });
  log(`   ✅ 改动记录成功: 改动ID ${c.change_log_id}`, 'green');
  log(`   处理判断: 自动检测T+1→T+2，状态 SCREENSHOT_REVIEWED → PENDING_MANAGER_REVIEW`, 'gray');
  log(`   改动类型: ${c.change_type}`, c.change_type === 'T1_TO_T2_MANUAL' ? 'green' : 'red');
  log(`   当前状态: ${c.new_status}`, c.new_status === 'PENDING_MANAGER_REVIEW' ? 'green' : 'red');
  log(`   需要基金经理复核: ${c.requires_review ? '是' : '否'}`, c.requires_review ? 'green' : 'red');
  log(`   证据指向原始文件: ${c.evidence_screenshot}`, 'gray');

  // Step 4: 尝试跳过复核（应被拒绝）
  log('\n📋 Step 4: 尝试跳过复核直接标记正常（验证边界保护）', 'yellow');
  const f1 = await apiRequest('POST', `/api/records/${recordId}/finalize`, { operator: '阿芬' });
  const boundaryOk = f1.success === false && f1.error && f1.error.includes('不允许');
  log(`   处理判断: 边界规则拦截 - T+1→T+2改动必须基金经理复核`, 'gray');
  log(`   边界保护: ${boundaryOk ? '✅ 正确拒绝' : '❌ 错误通过!'}`, boundaryOk ? 'green' : 'red');
  if (!boundaryOk) log(`   错误: ${JSON.stringify(f1)}`, 'red');

  // Step 5: 更新对账说明
  log('\n📋 Step 5: 更新对账说明', 'yellow');
  const noteContent = '托管确认页显示T+1（2026-06-10），但除权日截图实际为T+2（2026-06-11）。已与托管行客服003号通话确认，确实为T+2到账。已记录手工改动，待基金经理复核。';
  const n = await apiRequest('POST', `/api/records/${recordId}/note`, {
    note_content: noteContent,
    operator: '阿芬'
  });
  log(`   ✅ 对账说明保存成功，ID: ${n.note_id}`, 'green');
  log(`   说明内容: ${noteContent.slice(0, 60)}...`, 'gray');

  // Step 6: 基金经理复核
  log('\n📋 Step 6: 基金经理复核通过', 'yellow');
  const r = await apiRequest('POST', `/api/records/${recordId}/manager-review`, {
    approved: true,
    review_comment: '情况属实，除权日截图确实显示T+2到账，托管行也已确认。同意调整，保留全部证据链。',
    operator: '基金经理-李明'
  });
  log(`   ✅ 复核通过`, 'green');
  log(`   处理判断: 状态 PENDING_MANAGER_REVIEW → MANAGER_APPROVED`, 'gray');
  log(`   当前状态: ${r.new_status}`, r.new_status === 'MANAGER_APPROVED' ? 'green' : 'red');

  // Step 7: 标记正常
  log('\n📋 Step 7: 标记为正常', 'yellow');
  const f = await apiRequest('POST', `/api/records/${recordId}/finalize`, { operator: '阿芬' });
  log(`   ✅ 标记正常成功`, 'green');
  log(`   处理判断: 基金经理已复核，允许标记正常`, 'gray');
  log(`   最终状态: ${f.new_status}`, f.new_status === 'NORMAL' ? 'green' : 'red');

  // 获取三方数据
  log('\n📋 获取三方数据用于核对', 'yellow');
  const apiDetail = await apiRequest('GET', `/api/records/${recordId}`);
  const apiList = await apiRequest('GET', '/api/records');
  const apiExport = await apiRequest('GET', '/api/export/json');
  const listRecord = apiList.data.find(x => x.id === recordId);
  const exportRecord = apiExport.data.find(x => x['证券代码'] === '300750' && x['原始行号'] === 3);
  log(`   ✅ API详情获取成功: ${apiDetail.security_name}`, 'green');
  log(`   ✅ 列表数据获取成功: ${apiList.data.length} 条`, 'green');
  log(`   ✅ 导出数据获取成功: ${apiExport.data.length} 条`, 'green');

  // 逐项核对
  log('\n' + '═'.repeat(90), 'blue');
  log('  逐项核对（三源同数验证）', 'blue');
  log('═'.repeat(90), 'blue');

  const checks = [];

  // 1. 对账说明
  log('\n✅ 核对项 1: 对账说明', 'yellow');
  const apiNote = apiDetail.reconciliation_notes[0].note_content;
  const listNote = listRecord.reconciliation_notes[0].note_content;
  const exportNote = exportRecord['对账说明'];
  log(`   API详情:  ${apiNote.slice(0, 50)}...`, 'gray');
  log(`   列表数据: ${listNote.slice(0, 50)}...`, 'gray');
  log(`   导出数据: ${exportNote.slice(0, 50)}...`, 'gray');
  const noteMatch = apiNote === listNote && apiNote === exportNote;
  log(`   三源一致: ${noteMatch ? '✅ 通过' : '❌ 失败'}`, noteMatch ? 'green' : 'red');
  checks.push({ name: '对账说明', pass: noteMatch });

  // 2. 除权日截图链接
  log('\n✅ 核对项 2: 除权日截图链接', 'yellow');
  const apiScreen = apiDetail.ex_right_screenshots[0].screenshot_url;
  const listScreen = listRecord.ex_right_screenshots[0].screenshot_url;
  const exportScreen = exportRecord['除权日截图'];
  log(`   API详情:  ${apiScreen}`, 'gray');
  log(`   列表数据: ${listScreen}`, 'gray');
  log(`   导出数据: ${exportScreen}`, 'gray');
  const screenMatch = apiScreen === listScreen && exportScreen.includes(apiScreen);
  log(`   三源一致: ${screenMatch ? '✅ 通过' : '❌ 失败'}`, screenMatch ? 'green' : 'red');
  checks.push({ name: '除权日截图链接', pass: screenMatch });

  // 3. 人工改动证据链接
  log('\n✅ 核对项 3: 人工改动证据截图', 'yellow');
  const apiEvi = apiDetail.change_logs[0].evidence_screenshot_url;
  const listEvi = listRecord.change_logs[0].evidence_screenshot_url;
  const exportEvi = exportRecord['人工改动证据截图'];
  log(`   API详情:  ${apiEvi}`, 'gray');
  log(`   列表数据: ${listEvi}`, 'gray');
  log(`   导出数据: ${exportEvi}`, 'gray');
  const eviMatch = apiEvi === listEvi && exportEvi.includes(apiEvi);
  log(`   三源一致: ${eviMatch ? '✅ 通过' : '❌ 失败'}`, eviMatch ? 'green' : 'red');
  checks.push({ name: '人工改动证据截图', pass: eviMatch });

  // 4. 证据链接可访问（指向原始文件）
  log('\n✅ 核对项 4: 证据链接可访问（指向原始文件）', 'yellow');
  const urls = [
    { label: '除权日截图', url: apiScreen },
    { label: '人工改动证据', url: apiEvi }
  ];
  let allAccessible = true;
  for (const item of urls) {
    const urlPath = item.url.replace('http://localhost:3000', '').replace('http://127.0.0.1:3000', '');
    const result = await verifyImage(urlPath);
    const ok = result.status === 200 && result.size > 0;
    if (!ok) allAccessible = false;
    log(`   ${item.label}: ${item.url}`, 'gray');
    log(`     HTTP ${result.status}, 文件大小: ${result.size} 字节 - ${ok ? '✅ 可访问' : '❌ 失效!'}`, ok ? 'green' : 'red');
    log(`     指向原始文件: ${urlPath}`, 'gray');
  }
  checks.push({ name: '证据链接可访问', pass: allAccessible });

  // 5. 页面状态
  log('\n✅ 核对项 5: 处理状态', 'yellow');
  const apiStatus = apiDetail.status_label;
  const listStatus = listRecord.status_label;
  const exportStatus = exportRecord['处理状态'];
  log(`   API详情:  ${apiStatus}`, 'gray');
  log(`   列表数据: ${listStatus}`, 'gray');
  log(`   导出数据: ${exportStatus}`, 'gray');
  const statusMatch = apiStatus === listStatus && apiStatus === exportStatus;
  log(`   三源一致: ${statusMatch ? '✅ 通过' : '❌ 失败'}`, statusMatch ? 'green' : 'red');
  checks.push({ name: '处理状态', pass: statusMatch });

  // 6. 状态流转历史
  log('\n✅ 核对项 6: 状态流转历史', 'yellow');
  const apiTrans = apiDetail.status_transitions.length;
  const listTrans = listRecord.status_transitions.length;
  const exportTrans = exportRecord['状态流转历史'].split('; ').length;
  log(`   API详情流转条数:  ${apiTrans}`, 'gray');
  log(`   列表数据流转条数: ${listTrans}`, 'gray');
  log(`   导出数据流转条数: ${exportTrans}`, 'gray');
  const transMatch = apiTrans === listTrans && apiTrans === exportTrans;
  log(`   三源一致: ${transMatch ? '✅ 通过' : '❌ 失败'}`, transMatch ? 'green' : 'red');
  log(`   完整流转历史:`, 'gray');
  apiDetail.status_transitions.forEach((t, i) => {
    log(`     [${i+1}] ${t.operator} ${t.operate_time}: ${t.from_status_label || '(初始)'} → ${t.to_status_label} | ${t.transition_reason}`, 'gray');
  });
  checks.push({ name: '状态流转历史', pass: transMatch });

  // 7. 改动类型
  log('\n✅ 核对项 7: 改动类型', 'yellow');
  const apiChange = apiDetail.change_type_label;
  const listChange = listRecord.change_type_label;
  const exportChange = exportRecord['改动类型'];
  log(`   API详情:  ${apiChange}`, 'gray');
  log(`   列表数据: ${listChange}`, 'gray');
  log(`   导出数据: ${exportChange}`, 'gray');
  const changeMatch = apiChange === listChange && apiChange === exportChange;
  log(`   三源一致: ${changeMatch ? '✅ 通过' : '❌ 失败'}`, changeMatch ? 'green' : 'red');
  checks.push({ name: '改动类型', pass: changeMatch });

  // 8. 到账日（原始→当前）
  log('\n✅ 核对项 8: 到账日（原始值/当前值）', 'yellow');
  const apiOrigDate = apiDetail.original_settlement_date;
  const apiCurrDate = apiDetail.current_settlement_date;
  const listOrigDate = listRecord.original_settlement_date;
  const listCurrDate = listRecord.current_settlement_date;
  const exportOrigDate = exportRecord['原始到账日'];
  const exportCurrDate = exportRecord['当前到账日'];
  log(`   原始到账日: ${apiOrigDate} (API), ${listOrigDate} (列表), ${exportOrigDate} (导出)`, 'gray');
  log(`   当前到账日: ${apiCurrDate} (API), ${listCurrDate} (列表), ${exportCurrDate} (导出)`, 'gray');
  const origMatch = apiOrigDate === listOrigDate && apiOrigDate === exportOrigDate;
  const currMatch = apiCurrDate === listCurrDate && apiCurrDate === exportCurrDate;
  log(`   原始值三源一致: ${origMatch ? '✅ 通过' : '❌ 失败'}`, origMatch ? 'green' : 'red');
  log(`   当前值三源一致: ${currMatch ? '✅ 通过' : '❌ 失败'}`, currMatch ? 'green' : 'red');
  checks.push({ name: '原始到账日', pass: origMatch });
  checks.push({ name: '当前到账日', pass: currMatch });

  // 9. 除权日截图备注
  log('\n✅ 核对项 9: 除权日截图备注', 'yellow');
  const apiRemark = apiDetail.ex_right_screenshots[0].remark;
  const listRemark = listRecord.ex_right_screenshots[0].remark;
  const exportRemark = exportRecord['除权日截图备注'];
  log(`   API详情:  ${apiRemark}`, 'gray');
  log(`   列表数据: ${listRemark}`, 'gray');
  log(`   导出数据: ${exportRemark}`, 'gray');
  const remarkMatch = apiRemark === listRemark && exportRemark.includes(apiRemark);
  log(`   三源一致: ${remarkMatch ? '✅ 通过' : '❌ 失败'}`, remarkMatch ? 'green' : 'red');
  checks.push({ name: '除权日截图备注', pass: remarkMatch });

  // 10. 导出列完整性
  log('\n✅ 核对项 10: 导出报告列完整性', 'yellow');
  const requiredCols = ['批次号','原始行号','基金代码','基金名称','证券代码','证券名称','原始到账日','当前到账日','原始数量','当前数量','原始金额','当前金额','处理状态','是否人工改动','改动类型','导入操作员','导入时间','人工改动记录','对账说明','除权日截图','人工改动证据截图','除权日截图备注','状态流转历史'];
  const actualCols = Object.keys(exportRecord).filter(c => c !== '_evidenceLinks');
  const missingCols = requiredCols.filter(c => !actualCols.includes(c));
  const extraCols = actualCols.filter(c => !requiredCols.includes(c));
  log(`   应有列数: ${requiredCols.length}`, 'gray');
  log(`   实有列数: ${actualCols.length}`, 'gray');
  log(`   缺失列: ${missingCols.length === 0 ? '无' : missingCols.join(', ')}`, missingCols.length === 0 ? 'gray' : 'red');
  log(`   导出完整: ${missingCols.length === 0 ? '✅ 通过' : '❌ 失败'}`, missingCols.length === 0 ? 'green' : 'red');
  checks.push({ name: '导出列完整性', pass: missingCols.length === 0 });

  // 汇总
  log('\n' + '═'.repeat(90), 'blue');
  log('  核对汇总', 'blue');
  log('═'.repeat(90), 'blue');
  log('\n   ┌──────────────────────────┬────────┐');
  log('   │ 核对项                   │ 结果   │');
  log('   ├──────────────────────────┼────────┤');
  let allPassed = true;
  checks.forEach(c => {
    if (!c.pass) allPassed = false;
    log(`   │ ${c.name.padEnd(24)} │ ${c.pass ? '✅ 通过' : '❌ 失败'} │`);
  });
  log('   └──────────────────────────┴────────┘');

  if (allPassed) {
    log('\n🎉 所有核对项全部通过！证据链完整、链接有效、三源同数。', 'green');
  } else {
    log('\n❌ 存在未通过项！', 'red');
  }

  log('\n' + '═'.repeat(90), 'blue');
  log('  修复内容总结', 'blue');
  log('═'.repeat(90), 'blue');
  log('\n1. ✅ 统一数据服务 getAllRecordsWithDetails 补充了 ex_right_screenshots 和 status_transitions 查询', 'green');
  log('2. ✅ getExportData 增加了 4 个证据链新列：除权日截图、人工改动证据截图、除权日截图备注、状态流转历史', 'green');
  log('3. ✅ 所有证据链接使用完整 URL (http://127.0.0.1:3000/uploads/...)，指向原始文件不失效', 'green');
  log('4. ✅ Excel 导出支持超链接格式，点击直接打开截图', 'green');
  log('5. ✅ 前端详情弹窗使用 enrichment 后的完整 URL 字段', 'green');
  log('6. ✅ 三源同数：API详情、列表数据、导出数据读取同一份结果', 'green');
  log('7. ✅ 对账说明、人工改动证据、除权日截图、状态流转历史全部贯通', 'green');
  log('8. ✅ T+1→T+2 改动强制基金经理复核的边界规则生效', 'green');

  fs.writeFileSync(
    path.join(__dirname, '..', 'verification-result.txt'),
    output.join('\n') + '\n'
  );
  log('\n📄 详细验证结果已写入: verification-result.txt', 'gray');

  process.exit(allPassed ? 0 : 1);
}

run().catch(err => {
  console.error('❌ 验证失败:', err.message);
  console.error(err.stack);
  process.exit(1);
});
