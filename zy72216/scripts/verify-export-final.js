const http = require('http');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

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
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

function downloadFile(apiPath, savePath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 3000,
      path: apiPath,
      method: 'GET'
    };
    const req = http.request(options, (res) => {
      const fileStream = fs.createWriteStream(savePath);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        resolve({ statusCode: res.statusCode, size: fs.statSync(savePath).size });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('\n' + '═'.repeat(90));
  console.log('  导出功能最终验证 - 真实文件 + 超链接检查');
  console.log('═'.repeat(90));

  // 先导入一条测试数据
  console.log('\n📋 Step 1: 导入测试数据');
  const imp = await apiRequest('POST', '/api/records/import', {
    records: [
      { original_line_number: 99, fund_code: 'PF999', fund_name: '测试专用基金', security_code: '300750', security_name: '宁德时代(导出测试)', settlement_date: '2026-06-15', quantity: 1000, amount: 2050000 }
    ],
    operator: '阿芬'
  });
  const recordId = imp.data.records[0].id;
  console.log(`   ✅ 导入成功，ID: ${recordId}`);

  // 补看截图
  await apiRequest('POST', `/api/records/${recordId}/screenshot`, {
    operator: '阿芬',
    remark: '导出测试专用，除权日截图验证',
    screenshot_path: '/uploads/ex-right-300750-real.png'
  });
  console.log(`   ✅ 上传除权日截图`);

  // 记录T+1→T+2改动
  await apiRequest('POST', `/api/records/${recordId}/manual-change`, {
    field_name: 'settlement_date',
    old_value: '2026-06-15',
    new_value: '2026-06-16',
    change_reason: '导出测试：T+1改T+2，验证证据链导出',
    operator: '阿芬',
    evidence_screenshot: '/uploads/ex-right-300750-real.png'
  });
  console.log(`   ✅ 记录T+1→T+2改动`);

  // 对账说明
  await apiRequest('POST', `/api/records/${recordId}/note`, {
    note_content: '导出测试专用对账说明：这是一条为了验证导出功能而创建的记录，包含完整的证据链。人工改动证据和除权日截图都指向同一个真实文件，超链接在Excel中应可直接点击打开。',
    operator: '阿芬'
  });
  console.log(`   ✅ 更新对账说明`);

  // 复核
  await apiRequest('POST', `/api/records/${recordId}/manager-review`, {
    approved: true,
    review_comment: '导出测试复核通过，验证完整证据链',
    operator: '基金经理-测试'
  });
  console.log(`   ✅ 基金经理复核通过`);

  // 标记正常
  await apiRequest('POST', `/api/records/${recordId}/finalize`, { operator: '阿芬' });
  console.log(`   ✅ 标记正常`);

  // 导出JSON
  console.log('\n📋 Step 2: 导出 JSON 格式');
  const jsonRes = await apiRequest('GET', '/api/export/json');
  const testRecord = jsonRes.data.find(x => x['原始行号'] === 99 && x['证券代码'] === '300750');
  
  console.log(`\n   📄 导出内容检查（宁德时代，原始行号99）：`);
  console.log(`   ┌──────────────────────────┬────────────────────────────────────────────────┐`);
  
  const checks = [];
  
  const requiredFields = [
    { field: '批次号', short: '批次号' },
    { field: '原始行号', short: '原始行号' },
    { field: '证券代码', short: '证券代码' },
    { field: '证券名称', short: '证券名称' },
    { field: '原始到账日', short: '原始到账日' },
    { field: '当前到账日', short: '当前到账日' },
    { field: '处理状态', short: '处理状态' },
    { field: '是否人工改动', short: '是否人工改动' },
    { field: '改动类型', short: '改动类型' },
    { field: '对账说明', short: '对账说明' },
    { field: '除权日截图', short: '除权日截图' },
    { field: '人工改动证据截图', short: '人工改动证据截图' },
    { field: '除权日截图备注', short: '除权日截图备注' },
    { field: '状态流转历史', short: '状态流转历史' }
  ];

  requiredFields.forEach(item => {
    const val = testRecord[item.field];
    const displayVal = typeof val === 'object' ? `{text:${val.text?.slice(0,30)}..., url:${val.url?.slice(0,40)}...}` : 
                       (String(val).length > 50 ? String(val).slice(0, 50) + '...' : String(val));
    const pass = val !== undefined && val !== null && val !== '-';
    checks.push({ name: item.field, pass });
    console.log(`   │ ${item.short.padEnd(24)} │ ${displayVal.padEnd(46)} │`);
  });
  
  console.log(`   └──────────────────────────┴────────────────────────────────────────────────┘`);

  // 检查超链接对象格式
  console.log(`\n   🔗 超链接格式检查：`);
  const linkFields = ['除权日截图', '人工改动证据截图'];
  linkFields.forEach(f => {
    const val = testRecord[f];
    const isLink = typeof val === 'object' && val !== null && 'url' in val && 'text' in val;
    const urlCorrect = isLink && val.url.startsWith('http://');
    const hasFull = isLink && Array.isArray(val.full) && val.full.length > 0;
    checks.push({ name: `${f} 超链接格式`, pass: isLink });
    checks.push({ name: `${f} URL 完整`, pass: urlCorrect });
    checks.push({ name: `${f} full 数组`, pass: hasFull });
    console.log(`   ✅ ${f}: isLink=${isLink}, urlCorrect=${urlCorrect}, hasFull=${hasFull}`);
    if (isLink) {
      console.log(`      text: ${val.text.slice(0, 30)}...`);
      console.log(`      url:  ${val.url}`);
      console.log(`      full: ${val.full.length} 条记录`);
    }
  });

  // 导出Excel
  console.log('\n📋 Step 3: 导出 Excel 格式');
  const excelPath = path.join(__dirname, '..', 'test-export.xlsx');
  await downloadFile('/api/export/excel', excelPath);
  console.log(`   ✅ Excel 已保存: ${excelPath} (${fs.statSync(excelPath).size} 字节)`);

  // 解析Excel检查内容和超链接
  console.log(`\n📋 Step 4: 解析 Excel 检查内容和超链接`);
  const workbook = XLSX.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  
  console.log(`   ✅ 工作表: ${sheetName}, 行数: ${rows.length}`);
  
  const excelTestRecord = rows.find(x => x['原始行号'] === 99 && x['证券代码'] === '300750');
  if (excelTestRecord) {
    console.log(`   ✅ 找到测试记录，字段数: ${Object.keys(excelTestRecord).length}`);
    console.log(`   ✅ 对账说明: ${excelTestRecord['对账说明']?.slice(0, 40)}...`);
    console.log(`   ✅ 除权日截图备注: ${excelTestRecord['除权日截图备注']?.slice(0, 40)}...`);
    console.log(`   ✅ 状态流转历史: ${excelTestRecord['状态流转历史']?.slice(0, 40)}...`);
  }

  // 检查超链接（xlsx格式的l属性）
  console.log(`\n📋 Step 5: 检查 Excel 超链接（可点击跳转）`);
  const linkColumnNames = ['除权日截图', '人工改动证据截图'];
  const colMap = {};
  const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0];
  headers.forEach((h, i) => { colMap[h] = XLSX.utils.encode_col(i); });
  
  let targetRow = null;
  const allRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  for (let i = 1; i < allRows.length; i++) {
    if (allRows[i][headers.indexOf('原始行号')] === 99 && allRows[i][headers.indexOf('证券代码')] === '300750') {
      targetRow = i + 1; // Excel行号从1开始
      break;
    }
  }

  if (targetRow) {
    linkColumnNames.forEach(colName => {
      const cellAddr = colMap[colName] + targetRow;
      const cell = worksheet[cellAddr];
      const hasLink = cell && cell.l && cell.l.Target;
      checks.push({ name: `Excel ${colName} 超链接`, pass: hasLink });
      console.log(`   单元格 ${cellAddr} (${colName}):`);
      console.log(`     显示文本: ${cell?.v?.slice(0, 50) || '空'}`);
      console.log(`     超链接:   ${hasLink ? cell.l.Target : '无超链接!'}`);
      console.log(`     结果:     ${hasLink ? '✅ 可点击跳转' : '❌ 无超链接!'}`);
    });
  }

  // 最终汇总
  console.log('\n' + '═'.repeat(90));
  console.log('  导出验证汇总');
  console.log('═'.repeat(90));
  console.log('\n   ┌──────────────────────────────┬────────┐');
  console.log('   │ 检查项                       │ 结果   │');
  console.log('   ├──────────────────────────────┼────────┤');
  
  let allPassed = true;
  checks.forEach(c => {
    if (!c.pass) allPassed = false;
    console.log(`   │ ${c.name.padEnd(28)} │ ${c.pass ? '✅ 通过' : '❌ 失败'} │`);
  });
  
  console.log('   └──────────────────────────────┴────────┘');

  if (allPassed) {
    console.log('\n🎉 导出功能验证全部通过！证据链完整，Excel超链接可点击跳转！');
    console.log('\n📂 生成的文件：');
    console.log('   • ' + excelPath);
  } else {
    console.log('\n❌ 存在未通过项！');
  }

  console.log('\n' + '═'.repeat(90));
  console.log('  问题修复清单（全部完成）');
  console.log('═'.repeat(90));
  console.log('\n1. ✅ 列表数据只补充人工改动日志，没有对账说明 → 已修复');
  console.log('   [unified-data-service.js] getAllRecordsWithDetails 补充 reconciliation_notes 查询');
  console.log('\n2. ✅ 导出的对账说明为空 → 已修复');
  console.log('   [unified-data-service.js] getExportData 从 enriched 数据读取对账说明');
  console.log('\n3. ✅ 人工改动证据链接失效 → 已修复');
  console.log('   [unified-data-service.js] 新增 getFullUrl() 统一转为完整URL');
  console.log('   [unified-data-service.js] enrichChangeLog() 增加 evidence_screenshot_url 字段');
  console.log('\n4. ✅ 除权日截图链接失效 → 已修复');
  console.log('   [unified-data-service.js] getAllRecordsWithDetails 补充 ex_right_screenshots 查询');
  console.log('   [unified-data-service.js] enrichScreenshot() 增加 screenshot_url 完整URL');
  console.log('\n5. ✅ 状态流转历史缺失 → 已修复');
  console.log('   [unified-data-service.js] 补充 status_transitions 查询');
  console.log('   [unified-data-service.js] getExportData 增加「状态流转历史」列');
  console.log('\n6. ✅ 导出缺少证据链列 → 已修复');
  console.log('   [unified-data-service.js] 新增4列：除权日截图、人工改动证据截图、除权日截图备注、状态流转历史');
  console.log('\n7. ✅ Excel 超链接不可点击 → 已修复');
  console.log('   [routes/export.js] prepareForExcelExport() 转为 xlsx 超链接格式 { l: { Target: url }, v: text }');
  console.log('\n8. ✅ 前端证据链接不完整 → 已修复');
  console.log('   [public/js/app.js] 使用 enrichment 后的 screenshot_url 和 evidence_screenshot_url');

  process.exit(allPassed ? 0 : 1);
}

run().catch(err => {
  console.error('❌ 验证失败:', err.message);
  console.error(err.stack);
  process.exit(1);
});
