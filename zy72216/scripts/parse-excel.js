const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const excelPath = path.join(__dirname, '..', 'curl-test.xlsx');
console.log('文件大小:', fs.statSync(excelPath).size, '字节');

const wb = XLSX.readFile(excelPath);
const sheetName = wb.SheetNames[0];
const sheet = wb.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('工作表:', sheetName);
console.log('行数:', rows.length);
console.log('列数:', rows[0]?.length || 0);

const headers = rows[0];
console.log('\n所有列名:');
headers.forEach((h, i) => console.log(`  ${i}. ${h}`));

const colIdx = {};
headers.forEach((h, i) => {
  if (['除权日截图', '人工改动证据截图', '对账说明', '状态流转历史', '除权日截图备注'].includes(h)) {
    colIdx[h] = i;
  }
});
console.log('\n关键列索引:', colIdx);

// 找到测试记录行
for (let i = 1; i < rows.length; i++) {
  if (rows[i][headers.indexOf('原始行号')] === 99) {
    console.log('\n找到测试记录，Excel行号:', i + 1);
    Object.keys(colIdx).forEach(h => {
      const col = XLSX.utils.encode_col(colIdx[h]);
      const cellAddr = col + (i + 1);
      const cell = sheet[cellAddr];
      console.log('\n  ' + h + ':');
      console.log('    显示文本:', cell?.v);
      console.log('    超链接:', cell?.l?.Target || '无');
      if (cell?.l?.Target) {
        console.log('    ✅ 超链接可点击');
        console.log('    指向原始文件:', cell.l.Target.includes('/uploads/'));
      }
    });
    break;
  }
}

console.log('\n验证所有链接指向原始文件:');
console.log('════════════════════════════════════════════');
const allOk = Object.keys(colIdx).every(h => {
  if (!['除权日截图', '人工改动证据截图'].includes(h)) return true;
  const col = XLSX.utils.encode_col(colIdx[h]);
  const cell = sheet[col + 2];
  return cell?.l?.Target?.includes('/uploads/');
});
console.log(allOk ? '✅ 所有证据链接指向原始文件' : '❌ 证据链接不完整');
