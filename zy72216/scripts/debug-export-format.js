const unifiedDataService = require('../services/unified-data-service');

unifiedDataService.getExportData((err, data) => {
  if (err) {
    console.error('❌ 错误:', err.message);
    process.exit(1);
  }

  console.log('\n' + '═'.repeat(80));
  console.log('  getExportData 原始数据格式检查');
  console.log('═'.repeat(80));
  console.log(`\n总记录数: ${data.length}`);

  const testRec = data.find(r => r['原始行号'] === 99 || r['证券代码'] === '300750');
  if (!testRec) {
    console.log('❌ 未找到测试记录');
    process.exit(1);
  }

  console.log(`\n找到测试记录: ${testRec['证券名称']} (原始行号: ${testRec['原始行号']})`);
  console.log(`\n字段数: ${Object.keys(testRec).length}`);

  const linkFields = ['除权日截图', '人工改动证据截图'];
  linkFields.forEach(f => {
    const val = testRec[f];
    console.log(`\n📋 ${f}:`);
    console.log(`   类型: ${typeof val}`);
    console.log(`   值: ${JSON.stringify(val, null, 2).slice(0, 500)}`);
    if (typeof val === 'object' && val !== null) {
      console.log(`   ✅ 是对象格式`);
      console.log(`   - text 存在: ${'text' in val}`);
      console.log(`   - url 存在: ${'url' in val}`);
      console.log(`   - full 存在: ${'full' in val}`);
      if ('url' in val) {
        console.log(`   - URL 完整: ${val.url.startsWith('http://') ? '✅' : '❌'} (${val.url})`);
      }
      if ('full' in val && Array.isArray(val.full)) {
        console.log(`   - full 数组长度: ${val.full.length}`);
        val.full.forEach((s, i) => {
          console.log(`     [${i+1}] text=${s.text}, url=${s.url}`);
        });
      }
    } else {
      console.log(`   ❌ 不是对象格式，值: ${val}`);
    }
  });

  console.log(`\n📋 对账说明:`);
  console.log(`   ${testRec['对账说明']?.slice(0, 100)}...`);

  console.log(`\n📋 状态流转历史:`);
  console.log(`   ${testRec['状态流转历史']?.slice(0, 100)}...`);

  console.log('\n' + '═'.repeat(80));
  console.log('  检查 prepareForExcelExport 转换结果');
  console.log('═'.repeat(80));

  const prepareForExcelExport = (rows) => {
    return rows.map(row => {
      const excelRow = {};
      Object.keys(row).forEach(key => {
        if (key === '_evidenceLinks') return;
        const val = row[key];
        if (typeof val === 'object' && val !== null && 'url' in val) {
          if (val.full && val.full.length > 0) {
            excelRow[key] = {
              t: 's',
              v: val.full.map(s => s.text).join('; '),
              l: { Target: val.full[0].url }
            };
          } else if (val.url) {
            excelRow[key] = {
              t: 's',
              v: val.text,
              l: { Target: val.url }
            };
          } else {
            excelRow[key] = val.text || '-';
          }
        } else {
          excelRow[key] = val;
        }
      });
      return excelRow;
    });
  };

  const excelData = prepareForExcelExport([testRec]);
  const excelRow = excelData[0];
  linkFields.forEach(f => {
    const val = excelRow[f];
    console.log(`\n📋 Excel ${f}:`);
    console.log(`   类型: ${typeof val}`);
    if (typeof val === 'object' && val !== null && 'l' in val) {
      console.log(`   ✅ 超链接格式`);
      console.log(`   显示文本: ${val.v}`);
      console.log(`   目标URL: ${val.l.Target}`);
      console.log(`   URL有效: ${val.l.Target.startsWith('http://') ? '✅' : '❌'}`);
    } else {
      console.log(`   ❌ 无超链接`);
      console.log(`   值: ${JSON.stringify(val)}`);
    }
  });

  // 写入临时xlsx测试
  const XLSX = require('xlsx');
  const testExcelPath = require('path').join(__dirname, '..', 'debug-export.xlsx');
  const ws = XLSX.utils.json_to_sheet(excelData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '测试');
  XLSX.writeFile(wb, testExcelPath);
  const fs = require('fs');
  console.log(`\n📄 测试Excel已写入: ${testExcelPath} (${fs.statSync(testExcelPath).size} 字节)`);

  // 解析验证
  const wb2 = XLSX.readFile(testExcelPath);
  const rows2 = XLSX.utils.sheet_to_json(wb2.Sheets['测试'], { header: 1 });
  console.log(`   解析后行数: ${rows2.length}`);

  const colMap = {};
  rows2[0].forEach((h, i) => { colMap[h] = XLSX.utils.encode_col(i); });
  linkFields.forEach(f => {
    const cellAddr = colMap[f] + '2';
    const cell = wb2.Sheets['测试'][cellAddr];
    console.log(`\n📋 解析Excel单元格 ${cellAddr} (${f}):`);
    console.log(`   显示值: ${cell?.v}`);
    console.log(`   超链接: ${cell?.l?.Target || '无'}`);
    console.log(`   结果: ${cell?.l?.Target ? '✅ 超链接保留' : '❌ 超链接丢失'}`);
  });

  process.exit(0);
});
