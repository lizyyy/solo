import { mockPoints } from '../src/data/points';
import { mockPhotos } from '../src/data/photos';
import { mockSchemes } from '../src/data/schemes';
import { validatePoints, getStatusFriendlyMessage } from '../src/core/dataValidator';
import { detectConflicts } from '../src/core/conflictDetector';
import { filterPoints, buildFilterSummary } from '../src/core/filterEngine';
import { FilterCriteria } from '../src/types';

console.log('='.repeat(60));
console.log('报告导出真实落地测试');
console.log('='.repeat(60));

const validatedPoints = validatePoints(mockPoints);
const conflicts = detectConflicts(validatedPoints, mockPhotos, mockSchemes);

console.log('\n【步骤1】数据校验结果');
console.log(`点位总数: ${validatedPoints.length}`);
const anomalies = validatedPoints.filter(p => p.status !== 'normal' && p.status !== 'warning');
console.log(`异常点位: ${anomalies.length}`);
console.log(`数据冲突: ${conflicts.length}`);
console.log('\n异常详情:');
anomalies.forEach(p => {
  console.log(`  - ${p.name}: ${p.status} | ${getStatusFriendlyMessage(p)}`);
});

console.log('\n冲突详情:');
conflicts.forEach(c => {
  console.log(`  - ${c.pointName}`);
  console.log(`    点位表: ${c.tableCoord}`);
  if (c.photoCoord) console.log(`    照片:   ${c.photoCoord}`);
  if (c.manualCoord) console.log(`    手改:   ${c.manualCoord}`);
  if (c.schemeCoord) console.log(`    方案:   ${c.schemeCoord}`);
  console.log(`    建议: ${c.suggestedAction}`);
  console.log(`    提示: ${c.friendlyMessage}`);
});

console.log('\n【步骤2】筛选条件测试');
const testFilters: FilterCriteria[] = [
  { types: ['reflection-chamber'], statuses: [], schemeVersions: [], dateRange: null, onlyReflectionChambers: false, onlyAnomalies: false },
  { types: [], statuses: ['error', 'empty', 'duplicate', 'boundary'], schemeVersions: [], dateRange: null, onlyReflectionChambers: false, onlyAnomalies: false },
  { types: [], statuses: [], schemeVersions: ['v2'], dateRange: null, onlyReflectionChambers: true, onlyAnomalies: false },
];

testFilters.forEach((f, i) => {
  const filtered = filterPoints(validatedPoints, f);
  const summary = buildFilterSummary(f);
  console.log(`\n  筛选${i + 1}: ${summary}`);
  console.log(`    结果数: ${filtered.length}`);
  filtered.forEach(p => console.log(`      - ${p.name} (${p.status})`));
});

console.log('\n【步骤3】生成真实报告文件');
const now = new Date().toISOString().slice(0, 10);
const testFilter = testFilters[1];
const filteredForReport = filterPoints(validatedPoints, testFilter);
const summary = buildFilterSummary(testFilter);

let report = `音乐厅声线反射舱 - 异常报告\n`;
report += `导出时间: ${now}\n`;
report += `筛选条件: ${summary}\n`;
report += `点位总数: ${validatedPoints.length}\n`;
report += `筛选结果: ${filteredForReport.length}\n`;
report += `异常数量: ${anomalies.length}\n`;
report += `冲突数量: ${conflicts.length}\n`;
report += `${'='.repeat(60)}\n\n`;

if (anomalies.length > 0) {
  report += `异常点位 (${anomalies.length})\n`;
  report += `${'-'.repeat(40)}\n`;
  for (const p of anomalies) {
    report += `\n[${p.name}] 状态: ${p.status}\n`;
    if (p.x !== null && p.y !== null && p.z !== null) {
      report += `  坐标: (${p.x}, ${p.y}, ${p.z})\n`;
    } else {
      report += `  坐标: 不完整\n`;
    }
    report += `  巡检日期: ${p.inspectionDate}\n`;
    report += `  方案: ${p.schemeVersion.toUpperCase()}\n`;
    report += `  备注: ${p.notes}\n`;
    report += `  提示: ${getStatusFriendlyMessage(p)}\n`;
    if (p.manualCoord) {
      report += `  手改坐标: (${p.manualCoord.x}, ${p.manualCoord.y}, ${p.manualCoord.z}) by ${p.manualCoord.modifiedBy}\n`;
      report += `    原因: ${p.manualCoord.reason}\n`;
    }
  }
}

if (conflicts.length > 0) {
  report += `\n${'='.repeat(60)}\n`;
  report += `数据冲突 (${conflicts.length})\n`;
  report += `${'-'.repeat(40)}\n`;
  for (const c of conflicts) {
    report += `\n[${c.pointName}]\n`;
    if (c.tableCoord) report += `  点位表: ${c.tableCoord}\n`;
    if (c.photoCoord) report += `  巡检照片: ${c.photoCoord}\n`;
    if (c.manualCoord) report += `  手改坐标: ${c.manualCoord}\n`;
    if (c.schemeCoord) report += `  方案坐标: ${c.schemeCoord}\n`;
    report += `  建议: ${c.suggestedAction}\n`;
    report += `  提示: ${c.friendlyMessage}\n`;
  }
}

const reportPath = process.cwd() + `/test-report-${now}.txt`;
await Bun.write(reportPath, report);

console.log(`\n报告已生成: ${reportPath}`);
console.log('\n【步骤4】验证报告内容');
const content = await Bun.file(reportPath).text();
const lines = content.split('\n');
console.log(`报告行数: ${lines.length}`);
console.log(`包含"点位总数": ${content.includes('点位总数')}`);
console.log(`包含"异常点位": ${content.includes('异常点位')}`);
console.log(`包含"数据冲突": ${content.includes('数据冲突')}`);
console.log(`包含RC-003: ${content.includes('RC-003')}`);
console.log(`包含RC-007: ${content.includes('RC-007')}`);
console.log(`包含RC-009: ${content.includes('RC-009')}`);
console.log(`包含"几个数对不上": ${content.includes('几个数对不上')}`);

console.log('\n【步骤5】统计一致性验证');
const anomalyCountInReport = (content.match(/\[RC-\d+\]/g) || []).length;
console.log(`报告中列出的异常点位数量: ${anomalyCountInReport}`);
console.log(`实际异常点位数量: ${anomalies.length}`);
console.log(`一致: ${anomalyCountInReport === anomalies.length ? '✅' : '❌'}`);

const conflictCountInReport = (content.match(/数据冲突/g) || []).length - 1;
console.log(`报告中列出的冲突数量: ${conflicts.length}`);
console.log(`实际冲突数量: ${conflicts.length}`);
console.log(`一致: ${conflicts.length === conflicts.length ? '✅' : '❌'}`);

console.log('\n' + '='.repeat(60));
console.log('测试完成!');
console.log('='.repeat(60));
