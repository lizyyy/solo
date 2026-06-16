const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const DOWNLOAD_DIR = path.join(require('os').homedir(), 'Downloads');

const targetFile = fs
  .readdirSync(DOWNLOAD_DIR)
  .filter((f) => f.startsWith('音乐教师课时核销_') && f.endsWith('.xlsx'))
  .sort()
  .pop();

if (!targetFile) {
  console.error('未找到导出的音乐教师课时核销文件，请先在浏览器中点击「导出Excel」');
  process.exit(1);
}

const filePath = path.join(DOWNLOAD_DIR, targetFile);
console.log(`\n📄 正在验证文件: ${filePath}\n`);

const wb = XLSX.readFile(filePath);
const sheetNames = wb.SheetNames;

console.log('--- 工作表名称检查 ---');
const expectedSheets = ['核销结果', '备注修改历史', '导出报告'];
sheetNames.forEach((name, i) => {
  const ok = name === expectedSheets[i];
  console.log(`${ok ? '✅' : '❌'} 第${i + 1}个Sheet: "${name}" ${ok ? '(预期)' : `(预期: "${expectedSheets[i]}")`}`);
});
console.log();

console.log('--- Sheet1: 核销结果 ---');
const mainWs = wb.Sheets['核销结果'];
const mainData = XLSX.utils.sheet_to_json(mainWs, { header: 1 });
const mainHeaders = mainData[0];
const mainRows = mainData.slice(1);
console.log(`列数: ${mainHeaders.length} (预期: 17)`);
console.log(`数据行数: ${mainRows.length}`);
console.log(`表头: ${mainHeaders.join(' | ')}`);
const expectedHeaders = [
  '序号', '教师姓名', '曲目名称', '授权开始日期', '授权结束日期', '开始时码', '结束时码', '课时(分钟)',
  '当前备注', '备注修改次数', '最近一次备注修改', '校验状态', '问题详情', '原始来源文件',
  '导入时间', '数据最后修改时间', '记录唯一ID',
];
expectedHeaders.forEach((h, i) => {
  const ok = mainHeaders[i] === h;
  console.log(`  ${ok ? '✅' : '❌'} 第${i + 1}列: ${mainHeaders[i]} ${ok ? '' : `(预期: ${h})`}`);
});
mainRows.forEach((row, i) => {
  console.log(`  行${i + 1}: ${row[1]} - ${row[2]} [${row[11]}] 备注修改次数=${row[9]}`);
});
console.log();

console.log('--- Sheet2: 备注修改历史 ---');
const historyWs = wb.Sheets['备注修改历史'];
const historyData = XLSX.utils.sheet_to_json(historyWs, { header: 1 });
const historyHeaders = historyData[0];
const historyRows = historyData.slice(1);
console.log(`列数: ${historyHeaders.length} (预期: 8)`);
console.log(`记录行数: ${historyRows.length}`);
console.log(`表头: ${historyHeaders.join(' | ')}`);
const expectedHistoryHeaders = [
  '记录ID', '教师姓名', '曲目名称', '修改序号', '修改时间', '修改前文本', '修改后文本', '变更差异说明',
];
expectedHistoryHeaders.forEach((h, i) => {
  const ok = historyHeaders[i] === h;
  console.log(`  ${ok ? '✅' : '❌'} 第${i + 1}列: ${historyHeaders[i]} ${ok ? '' : `(预期: ${h})`}`);
});
historyRows.forEach((row, i) => {
  console.log(`  行${i + 1}: [${row[3]}] ${row[1]} - ${row[2]}`);
  console.log(`    修改前: ${row[5]}`);
  console.log(`    修改后: ${row[6]}`);
  console.log(`    差异: ${row[7]}`);
});
console.log();

console.log('--- Sheet3: 导出报告 ---');
const reportWs = wb.Sheets['导出报告'];
const reportData = XLSX.utils.sheet_to_json(reportWs, { header: 1 });
console.log(`行数: ${reportData.length} (预期: 13)`);
reportData.forEach((row, i) => {
  const key = row[0] || '(空)';
  const val = row[1] || '';
  const marker = [0, 1].includes(i) ? '📌' : '  ';
  console.log(`${marker} ${key}: ${val}`);
});
console.log();

const reportMap = new Map(reportData.slice(2).map((r) => [r[0], r[1]]));
const exportedCount = reportMap.get('导出记录数');
const totalCount = reportMap.get('总记录数(含未筛选)');
const filterDesc = reportMap.get('筛选条件说明');
const statusFilter = reportMap.get('状态筛选');
const sourceFiles = reportMap.get('涉及原始文件');

console.log('--- 核心业务断言 ---');
const checks = [];
checks.push(['数据行数 = 导出报告中的导出记录数', mainRows.length === exportedCount]);
checks.push(['导出记录数 > 0', exportedCount > 0]);
checks.push(['总记录数 ≥ 导出记录数', Number(totalCount) >= Number(exportedCount)]);
checks.push(['状态筛选已设置', statusFilter && statusFilter !== '全部']);
checks.push(['筛选条件说明非空', typeof filterDesc === 'string' && filterDesc.length > 0]);
checks.push(['涉及原始文件非空', typeof sourceFiles === 'string' && sourceFiles.length > 0]);
checks.push(['备注历史中有至少1条修改', historyRows.some((r) => r[3] !== '-' && r[5] !== r[6])]);
checks.forEach(([desc, ok]) => {
  console.log(`${ok ? '✅' : '❌'} ${desc}`);
});
const passed = checks.filter(([, ok]) => ok).length;
console.log(`\n总计: ${passed}/${checks.length} 项断言通过`);

if (passed !== checks.length) process.exit(1);
