import { validatePoints, getStatusLabel, getStatusFriendlyMessage } from '../src/core/dataValidator';
import { detectConflicts } from '../src/core/conflictDetector';
import { filterPoints, buildFilterSummary } from '../src/core/filterEngine';
import { mockPoints } from '../src/data/points';
import { mockPhotos } from '../src/data/photos';
import { mockSchemes } from '../src/data/schemes';
import { FilterCriteria } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';

console.log('='.repeat(70));
console.log('【真实导出验证】直接调用核心模块生成报告');
console.log('='.repeat(70));

const validated = validatePoints(mockPoints);
const conflicts = detectConflicts(validated, mockPhotos, mockSchemes);

const testFilters: FilterCriteria[] = [
  {
    types: [],
    statuses: [],
    schemeVersions: [],
    dateRange: null,
    onlyReflectionChambers: true,
    onlyAnomalies: true
  }
];

const filter = testFilters[0];
const filteredPoints = filterPoints(validated, filter);
const filterSummary = buildFilterSummary(filter);

const currentDate = '2024-12-04';
const selectedPoint = validated.find(p => p.id === 'rc-007');
const anomalies = filteredPoints.filter(p => p.status !== 'normal' && p.status !== 'warning');
const relatedConflicts = conflicts.filter(c =>
  filteredPoints.some(p => p.id === c.pointId)
);

console.log('\n【步骤1】页面统计数据');
console.log(`  点位总数: ${validated.length}`);
console.log(`  筛选结果: ${filteredPoints.length}`);
console.log(`  异常点位: ${anomalies.length}`);
console.log(`  数据冲突: ${relatedConflicts.length}`);
console.log(`  当前选中: ${selectedPoint?.name} (${getStatusLabel(selectedPoint!.status)})`);
console.log(`  巡检日期: ${currentDate}`);
console.log(`  筛选条件: ${filterSummary}`);

console.log('\n【步骤2】异常详情（页面侧边栏显示）');
anomalies.forEach(p => {
  console.log(`  - ${p.name}: ${getStatusLabel(p.status)} | ${getStatusFriendlyMessage(p)}`);
});

console.log('\n【步骤3】生成真实报告文件');
const now = new Date().toISOString().slice(0, 10);

let report = `音乐厅声线反射舱 - 巡检报告\n`;
report += `导出时间: ${now}\n`;
report += `巡检日期: ${currentDate}\n`;
report += `筛选条件: ${filterSummary}\n`;
report += `点位总数: ${validated.length}\n`;
report += `筛选结果: ${filteredPoints.length}\n`;
report += `异常点位: ${anomalies.length}\n`;
report += `数据冲突: ${relatedConflicts.length}\n`;
if (selectedPoint) {
  report += `当前选中: ${selectedPoint.name} (${getStatusLabel(selectedPoint.status)})\n`;
}
report += `${'='.repeat(60)}\n\n`;

if (anomalies.length > 0) {
  report += `异常点位 (${anomalies.length})\n`;
  report += `${'-'.repeat(40)}\n`;
  for (const p of anomalies) {
    report += `\n[${p.name}] 状态: ${getStatusLabel(p.status)}\n`;
    if (p.x !== null && p.y !== null && p.z !== null) {
      report += `  坐标: (${p.x}, ${p.y}, ${p.z})\n`;
    } else {
      report += `  坐标: 不完整\n`;
    }
    report += `  巡检日期: ${p.inspectionDate}\n`;
    report += `  方案: ${p.schemeVersion.toUpperCase()}\n`;
    report += `  类型: ${p.isReflectionChamber ? '声线反射舱' : p.type}\n`;
    report += `  备注: ${p.notes}\n`;
    const friendlyMsg = getStatusFriendlyMessage(p);
    if (friendlyMsg) {
      report += `  提示: ${friendlyMsg}\n`;
    }
    if (p.manualCoord) {
      report += `  手改坐标: (${p.manualCoord.x}, ${p.manualCoord.y}, ${p.manualCoord.z}) by ${p.manualCoord.modifiedBy}\n`;
      report += `    原因: ${p.manualCoord.reason}\n`;
    }
    if (p.participatesInRayPath) {
      report += `  声线路径: 参与计算 ✅\n`;
    }
  }
}

if (relatedConflicts.length > 0) {
  report += `\n${'='.repeat(60)}\n`;
  report += `数据冲突 (${relatedConflicts.length})\n`;
  report += `${'-'.repeat(40)}\n`;
  for (const c of relatedConflicts) {
    report += `\n[${c.pointName}]\n`;
    if (c.tableCoord) report += `  点位表: ${c.tableCoord}\n`;
    if (c.photoCoord) report += `  巡检照片: ${c.photoCoord}\n`;
    if (c.manualCoord) report += `  手改坐标: ${c.manualCoord}\n`;
    if (c.schemeCoord) report += `  方案坐标: ${c.schemeCoord}\n`;
    report += `  建议操作: ${c.suggestedAction}\n`;
    report += `  ${c.friendlyMessage}\n`;
  }
}

const normalChambers = filteredPoints.filter(
  p => p.isReflectionChamber && p.status === 'normal' && p.participatesInRayPath
);
if (normalChambers.length > 0) {
  report += `\n${'='.repeat(60)}\n`;
  report += `正常参与声线路径的反射舱 (${normalChambers.length})\n`;
  report += `${'-'.repeat(40)}\n`;
  for (const p of normalChambers) {
    report += `  - ${p.name} (${p.x}, ${p.y}, ${p.z}) | ${p.schemeVersion.toUpperCase()}方案\n`;
  }
}

report += `\n${'='.repeat(60)}\n`;
report += `报告说明: 本报告由系统自动生成，数据冲突部分请人工复核\n`;

const reportPath = path.join(process.cwd(), `actual-export-report-${now}.txt`);
fs.writeFileSync(reportPath, report, 'utf-8');

console.log(`\n  ✅ 报告已生成: ${reportPath}`);

console.log('\n【步骤4】读取报告文件验证内容');
const fileContent = fs.readFileSync(reportPath, 'utf-8');
const lines = fileContent.split('\n');
console.log(`  报告行数: ${lines.length}`);

console.log('\n  🔍 验证字段完整性:');
const checks = [
  { name: '报告标题', match: fileContent.includes('音乐厅声线反射舱 - 巡检报告') },
  { name: '导出时间', match: fileContent.includes('导出时间:') },
  { name: '巡检日期', match: fileContent.includes('巡检日期: 2024-12-04') },
  { name: '筛选条件', match: fileContent.includes('筛选条件:') },
  { name: '点位总数', match: fileContent.includes('点位总数: ' + validated.length) },
  { name: '筛选结果', match: fileContent.includes('筛选结果: ' + filteredPoints.length) },
  { name: '异常点位数量', match: fileContent.includes('异常点位: ' + anomalies.length) },
  { name: '数据冲突数量', match: fileContent.includes('数据冲突: ' + relatedConflicts.length) },
  { name: '当前选中', match: fileContent.includes('当前选中: RC-007 (冲突)') },
  { name: 'RC-003 空值', match: fileContent.includes('RC-003') && fileContent.includes('坐标缺失') },
  { name: 'RC-005 重复', match: fileContent.includes('RC-005') && fileContent.includes('重复记录') },
  { name: 'RC-005-dup 重复', match: fileContent.includes('RC-005-dup') && fileContent.includes('重复记录') },
  { name: 'RC-007 冲突', match: fileContent.includes('RC-007') && fileContent.includes('冲突') },
  { name: 'RC-009 边界', match: fileContent.includes('RC-009') && fileContent.includes('边界记录') },
  { name: '友好提示: 林老师', match: fileContent.includes('林老师') },
  { name: '友好提示: 几个数对不上', match: fileContent.includes('几个数对不上') },
  { name: '手改人: 老王', match: fileContent.includes('老王') },
  { name: '声线路径参与标记', match: fileContent.includes('声线路径: 参与计算 ✅') },
  { name: '报告说明', match: fileContent.includes('报告说明:') },
  { name: 'RC-001 正常反射舱', match: fileContent.includes('RC-001') },
  { name: 'RC-002 正常反射舱', match: fileContent.includes('RC-002') },
  { name: 'RC-004 正常反射舱', match: fileContent.includes('RC-004') },
];

let allPassed = true;
checks.forEach(c => {
  if (c.match) {
    console.log(`    ✅ ${c.name}`);
  } else {
    console.log(`    ❌ ${c.name}`);
    allPassed = false;
  }
});

console.log('\n  🔍 验证数量一致性:');
const anomalyCountInReport = (fileContent.match(/\[RC-\d+(-dup)?\]/g) || []).length;
const expectedAnomalyCount = anomalies.length + normalChambers.length;
const countMatch = anomalyCountInReport === expectedAnomalyCount;
console.log(`    ${countMatch ? '✅' : '❌'} 报告中列出的点位数量: ${anomalyCountInReport}，应为: ${expectedAnomalyCount}`);
if (!countMatch) allPassed = false;

const conflictCountInReport = fileContent.match(/数据冲突 \(\d+\)/g);
const expectedConflictCount = relatedConflicts.length;
const conflictMatch = conflictCountInReport && conflictCountInReport.length > 0 &&
  conflictCountInReport[0].includes(`数据冲突 (${expectedConflictCount})`);
console.log(`    ${conflictMatch ? '✅' : '❌'} 数据冲突数量标记: ${expectedConflictCount}`);
if (!conflictMatch) allPassed = false;

console.log('\n【步骤5】报告前30行预览:');
lines.slice(0, 30).forEach((line, i) => {
  console.log(`  ${String(i + 1).padStart(2)}: ${line}`);
});

console.log('\n' + '='.repeat(70));
console.log(`【最终结论】${allPassed ? '✅ 全部字段验证通过！报告真实落地' : '❌ 存在验证失败项'}`);
console.log('='.repeat(70));

if (!allPassed) {
  process.exit(1);
}
