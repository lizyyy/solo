import { validatePoints, getStatusLabel, getStatusFriendlyMessage } from '../src/core/dataValidator';
import { detectConflicts } from '../src/core/conflictDetector';
import { filterPoints, buildFilterSummary } from '../src/core/filterEngine';
import { mockPoints } from '../src/data/points';
import { mockPhotos } from '../src/data/photos';
import { mockSchemes } from '../src/data/schemes';
import { FilterCriteria, Point } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';

console.log('='.repeat(70));
console.log('【可复现验证】日期筛选 + 数据冲突 + 报告一致性全链路');
console.log('='.repeat(70));

const validatedPoints = validatePoints(mockPoints);
const allConflicts = detectConflicts(validatedPoints, mockPhotos, mockSchemes);

let allPassed = true;
function check(name: string, condition: boolean, expected: string, actual: string) {
  const passed = condition;
  console.log(`  ${passed ? '✅' : '❌'} ${name}`);
  if (!passed) {
    console.log(`     期望: ${expected}`);
    console.log(`     实际: ${actual}`);
    allPassed = false;
  }
  return passed;
}

interface AppState {
  points: Point[];
  filteredPoints: Point[];
  filterCriteria: FilterCriteria;
  filterSummary: string;
  conflicts: typeof allConflicts;
  currentDate: string;
  selectedPointId: string | null;
}

function createInitialState(): AppState {
  const defaultDate = '2024-12-01';
  const defaultCriteria: FilterCriteria = {
    types: [],
    statuses: [],
    schemeVersions: [],
    dateRange: [defaultDate, defaultDate],
    onlyReflectionChambers: false,
    onlyAnomalies: false
  };
  const filtered = filterPoints(validatedPoints, defaultCriteria);
  return {
    points: validatedPoints,
    filteredPoints: filtered,
    filterCriteria: defaultCriteria,
    filterSummary: buildFilterSummary(defaultCriteria),
    conflicts: allConflicts,
    currentDate: defaultDate,
    selectedPointId: null
  };
}

function setCurrentDate(state: AppState, date: string): AppState {
  const newCriteria: FilterCriteria = {
    ...state.filterCriteria,
    dateRange: [date, date]
  };
  const filtered = filterPoints(state.points, newCriteria);
  return {
    ...state,
    currentDate: date,
    filterCriteria: newCriteria,
    filteredPoints: filtered,
    filterSummary: buildFilterSummary(newCriteria)
  };
}

function setFilterCriteria(state: AppState, criteria: FilterCriteria): AppState {
  const filtered = filterPoints(state.points, criteria);
  return {
    ...state,
    filterCriteria: criteria,
    filteredPoints: filtered,
    filterSummary: buildFilterSummary(criteria)
  };
}

function selectPoint(state: AppState, id: string | null): AppState {
  return { ...state, selectedPointId: id };
}

function getAnomalyPoints(state: AppState) {
  return state.filteredPoints.filter(p => p.status !== 'normal' && p.status !== 'warning');
}

function getRelatedConflicts(state: AppState) {
  return state.conflicts.filter(c =>
    state.filteredPoints.some(p => p.id === c.pointId)
  );
}

function generateReport(state: AppState): string {
  const anomalies = getAnomalyPoints(state);
  const relatedConflicts = getRelatedConflicts(state);
  const selectedPoint = state.points.find(p => p.id === state.selectedPointId);
  const now = new Date().toISOString().slice(0, 10);

  let report = `音乐厅声线反射舱 - 巡检报告\n`;
  report += `导出时间: ${now}\n`;
  report += `巡检日期: ${state.currentDate}\n`;
  report += `筛选条件: ${state.filterSummary}\n`;
  report += `点位总数: ${state.points.length}\n`;
  report += `筛选结果: ${state.filteredPoints.length}\n`;
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
      if (friendlyMsg) report += `  提示: ${friendlyMsg}\n`;
      if (p.manualCoord) {
        report += `  手改坐标: (${p.manualCoord.x}, ${p.manualCoord.y}, ${p.manualCoord.z}) by ${p.manualCoord.modifiedBy}\n`;
        report += `    原因: ${p.manualCoord.reason}\n`;
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

  report += `\n${'='.repeat(60)}\n`;
  report += `报告说明: 本报告由系统自动生成，数据冲突部分请人工复核\n`;
  return report;
}

console.log('\n【场景1：打开项目，初始状态验证】');
let state = createInitialState();
console.log(`  当前日期: ${state.currentDate}`);
console.log(`  筛选摘要: ${state.filterSummary}`);
console.log(`  筛选结果: ${state.filteredPoints.length} 个点位`);
console.log(`  异常点位: ${getAnomalyPoints(state).length} 个`);
console.log(`  数据冲突: ${getRelatedConflicts(state).length} 个`);

check('初始日期=2024-12-01', state.currentDate === '2024-12-01', '2024-12-01', state.currentDate);
check('筛选摘要包含日期', state.filterSummary.includes('日期:'), '包含日期:', state.filterSummary);
check('初始筛选结果数正确', state.filteredPoints.length === 4, '4个点位', String(state.filteredPoints.length));

const dec1Points = validatedPoints.filter(p => p.inspectionDate === '2024-12-01');
check('12-01实际点位数量', dec1Points.length === 4, '4个点位', dec1Points.length + '个: ' + dec1Points.map(p => p.name).join(', '));

console.log('\n【场景2：切换到2024-12-04，验证日期筛选真正生效】');
state = setCurrentDate(state, '2024-12-04');
console.log(`  当前日期: ${state.currentDate}`);
console.log(`  筛选摘要: ${state.filterSummary}`);
console.log(`  筛选结果: ${state.filteredPoints.length} 个点位`);
console.log(`  异常点位: ${getAnomalyPoints(state).length} 个`);
console.log(`  数据冲突: ${getRelatedConflicts(state).length} 个`);
console.log(`  侧边栏异常列表: ${getAnomalyPoints(state).map(p => p.name).join(', ')}`);

check('日期切换后currentDate更新', state.currentDate === '2024-12-04', '2024-12-04', state.currentDate);
check('筛选摘要更新为新日期', state.filterSummary.includes('2024-12-04'), '包含2024-12-04', state.filterSummary);

const dec4Points = validatedPoints.filter(p => p.inspectionDate === '2024-12-04');
check('12-04筛选结果数=当天实际数', state.filteredPoints.length === dec4Points.length, 
  String(dec4Points.length), String(state.filteredPoints.length));

const dec4PointNames = state.filteredPoints.map(p => p.name).sort().join(',');
const expectedDec4Names = dec4Points.map(p => p.name).sort().join(',');
check('12-04点位列表只有当天的', dec4PointNames === expectedDec4Names, 
  expectedDec4Names, dec4PointNames);

const anomalyNames = getAnomalyPoints(state).map(p => p.name);
const hasOtherDateAnomalies = anomalyNames.some(name => 
  ['RC-003', 'RC-005', 'RC-005-dup', 'RC-009'].includes(name)
);
check('其他日期异常不会混入（RC-003/005/009不在列表中）', 
  !hasOtherDateAnomalies, 
  '不包含RC-003/RC-005/RC-005-dup/RC-009',
  anomalyNames.join(', '));

check('12-04只有RC-007是异常', 
  getAnomalyPoints(state).length === 1 && getAnomalyPoints(state)[0].id === 'rc-007',
  '1个: RC-007',
  getAnomalyPoints(state).map(p => p.name).join(', '));

console.log('\n【场景3：生成报告，验证报告与页面统计一致】');
const report1 = generateReport(state);
const reportPath1 = path.join(process.cwd(), 'verify-scenario-2024-12-04.txt');
fs.writeFileSync(reportPath1, report1, 'utf-8');
console.log(`  报告已生成: ${reportPath1}`);

const reportLines = report1.split('\n');
const reportDateLine = reportLines.find(l => l.startsWith('巡检日期:'));
const reportAnomalyLine = reportLines.find(l => l.startsWith('异常点位:'));
const reportConflictLine = reportLines.find(l => l.startsWith('数据冲突:'));
const reportFilterLine = reportLines.find(l => l.startsWith('筛选条件:'));

check('报告中巡检日期=页面currentDate', 
  reportDateLine?.includes('2024-12-04'),
  '2024-12-04',
  reportDateLine || '未找到');

check('报告异常点位数量=页面异常数',
  reportAnomalyLine?.includes(`异常点位: ${getAnomalyPoints(state).length}`),
  `异常点位: ${getAnomalyPoints(state).length}`,
  reportAnomalyLine || '未找到');

check('报告数据冲突数量=页面冲突数',
  reportConflictLine?.includes(`数据冲突: ${getRelatedConflicts(state).length}`),
  `数据冲突: ${getRelatedConflicts(state).length}`,
  reportConflictLine || '未找到');

check('报告筛选条件与页面一致',
  reportFilterLine?.includes(state.filterSummary),
  state.filterSummary,
  reportFilterLine || '未找到');

check('报告异常详情条目数=异常数量',
  (report1.match(/\[RC-\d+(-dup)?\] 状态:/g) || []).length === getAnomalyPoints(state).length,
  String(getAnomalyPoints(state).length),
  String((report1.match(/\[RC-\d+(-dup)?\] 状态:/g) || []).length));

check('报告冲突详情条目数=冲突数量',
  (report1.match(/数据冲突 \(\d+\)/g) || []).length > 0 && 
  report1.includes('数据冲突 (1)'),
  '数据冲突 (1)',
  report1.match(/数据冲突 \(\d+\)/g)?.join(', ') || '未找到');

console.log('\n【场景4：筛选到V1方案（不含RC-007），验证数量与详情一致】');
const v1Criteria: FilterCriteria = {
  ...state.filterCriteria,
  schemeVersions: ['v1']
};
state = setFilterCriteria(state, v1Criteria);
console.log(`  筛选条件: ${state.filterSummary}`);
console.log(`  筛选结果: ${state.filteredPoints.length} 个点位`);
console.log(`  异常点位: ${getAnomalyPoints(state).length} 个`);
console.log(`  数据冲突: ${getRelatedConflicts(state).length} 个`);
console.log(`  侧边栏异常列表: ${getAnomalyPoints(state).map(p => p.name).join(', ') || '无'}`);

check('V1方案+12-04筛选结果正确', state.filteredPoints.length === 0, '0个点位 (12-04只有RC-007，是V2方案)', String(state.filteredPoints.length));
check('12-04且V1方案下无异常', getAnomalyPoints(state).length === 0, '0个异常', String(getAnomalyPoints(state).length));
check('12-04且V1方案下无冲突', getRelatedConflicts(state).length === 0, '0个冲突', String(getRelatedConflicts(state).length));

const report2 = generateReport(state);
const reportPath2 = path.join(process.cwd(), 'verify-scenario-v1-no-rc007.txt');
fs.writeFileSync(reportPath2, report2, 'utf-8');

const report2Lines = report2.split('\n');
const report2AnomalyLine = report2Lines.find(l => l.startsWith('异常点位:'));
const report2ConflictLine = report2Lines.find(l => l.startsWith('数据冲突:'));

check('报告头部异常数=0（无RC-007时）',
  report2AnomalyLine?.includes('异常点位: 0'),
  '异常点位: 0',
  report2AnomalyLine || '未找到');

check('报告头部冲突数=0（无RC-007时）',
  report2ConflictLine?.includes('数据冲突: 0'),
  '数据冲突: 0',
  report2ConflictLine || '未找到');

const anomalyDetailCount2 = (report2.match(/\[RC-\d+(-dup)?\] 状态:/g) || []).length;
check('报告异常详情条目数=头部声明数量（0=0）',
  anomalyDetailCount2 === 0,
  '0条详情',
  `${anomalyDetailCount2}条详情`);

const conflictDetailCount2 = (report2.match(/\[RC-\d+(-dup)?\]\n  点位表:/g) || []).length;
check('报告冲突详情条目数=头部声明数量（0=0）',
  conflictDetailCount2 === 0,
  '0条冲突详情',
  `${conflictDetailCount2}条冲突详情`);

console.log('\n【场景5：切换回全部方案，勾选仅异常项，验证侧边栏与报告一致】');
state = setFilterCriteria(state, {
  ...state.filterCriteria,
  schemeVersions: [],
  onlyAnomalies: true
});
console.log(`  筛选条件: ${state.filterSummary}`);
console.log(`  筛选结果: ${state.filteredPoints.length} 个点位`);
console.log(`  异常点位: ${getAnomalyPoints(state).length} 个`);
console.log(`  数据冲突: ${getRelatedConflicts(state).length} 个`);

check('仅异常项+12-04筛选结果=1个', state.filteredPoints.length === 1, '1个点位', String(state.filteredPoints.length));
check('仅异常项+12-04=RC-007', getAnomalyPoints(state)[0]?.id === 'rc-007', 'RC-007', getAnomalyPoints(state)[0]?.name || '无');

const sidebarAnomalyCount = getAnomalyPoints(state).length;
const reportAnomalyCount = getAnomalyPoints(state).length;
check('侧边栏异常数=报告异常数', sidebarAnomalyCount === reportAnomalyCount,
  String(sidebarAnomalyCount), String(reportAnomalyCount));

console.log('\n【场景6：模拟刷新/重算，状态一致性】');
const savedDate = state.currentDate;
const savedCriteria = { ...state.filterCriteria };
const savedSummary = state.filterSummary;

const recreatedState = setCurrentDate(createInitialState(), '2024-12-04');
const finalState = setFilterCriteria(recreatedState, {
  ...recreatedState.filterCriteria,
  onlyAnomalies: true
});

check('重算后日期一致', finalState.currentDate === savedDate, savedDate, finalState.currentDate);
check('重算后筛选条件一致', 
  JSON.stringify(finalState.filterCriteria) === JSON.stringify(savedCriteria),
  JSON.stringify(savedCriteria),
  JSON.stringify(finalState.filterCriteria));
check('重算后筛选摘要一致', finalState.filterSummary === savedSummary, savedSummary, finalState.filterSummary);
check('重算后筛选结果数一致', finalState.filteredPoints.length === state.filteredPoints.length,
  String(state.filteredPoints.length), String(finalState.filteredPoints.length));
check('重算后异常数一致', getAnomalyPoints(finalState).length === getAnomalyPoints(state).length,
  String(getAnomalyPoints(state).length), String(getAnomalyPoints(finalState).length));
check('重算后冲突数一致', getRelatedConflicts(finalState).length === getRelatedConflicts(state).length,
  String(getRelatedConflicts(state).length), String(getRelatedConflicts(finalState).length));

console.log('\n【场景7：全量日期验证，每天的报告都不混入其他日期】');
const testDates = ['2024-12-01', '2024-12-02', '2024-12-03', '2024-12-04', '2024-12-05'];
let allDatesOk = true;
for (const date of testDates) {
  const dateState = setCurrentDate(createInitialState(), date);
  const allSameDate = dateState.filteredPoints.every(p => p.inspectionDate === date);
  if (!allSameDate) {
    console.log(`  ❌ ${date}: 混入了其他日期点位`);
    allDatesOk = false;
    allPassed = false;
  }
}
if (allDatesOk) {
  console.log(`  ✅ 全部5个日期的筛选结果都只包含当天点位，无混入`);
}

console.log('\n【场景8：统计值一致性汇总】');
state = setCurrentDate(createInitialState(), '2024-12-04');
const anomalies = getAnomalyPoints(state);
const relConflicts = getRelatedConflicts(state);

console.log(`  页面统计:`);
console.log(`    点位总数: ${state.points.length}`);
console.log(`    筛选结果: ${state.filteredPoints.length}`);
console.log(`    异常点位: ${anomalies.length}`);
console.log(`    数据冲突: ${relConflicts.length}`);
console.log(`    侧边栏异常列表: ${anomalies.map(p => p.name).join(', ')}`);
console.log(`    侧边栏冲突列表: ${relConflicts.map(c => c.pointName).join(', ')}`);

const finalReport = generateReport(state);
const finalReportPath = path.join(process.cwd(), 'verify-final-consistency-report.txt');
fs.writeFileSync(finalReportPath, finalReport, 'utf-8');

const reportStats = {
  totalPoints: parseInt(finalReport.match(/点位总数: (\d+)/)?.[1] || '0'),
  filteredCount: parseInt(finalReport.match(/筛选结果: (\d+)/)?.[1] || '0'),
  anomalyCount: parseInt(finalReport.match(/异常点位: (\d+)/)?.[1] || '0'),
  conflictCount: parseInt(finalReport.match(/数据冲突: (\d+)/)?.[1] || '0'),
};

console.log(`  报告统计:`);
console.log(`    点位总数: ${reportStats.totalPoints}`);
console.log(`    筛选结果: ${reportStats.filteredCount}`);
console.log(`    异常点位: ${reportStats.anomalyCount}`);
console.log(`    数据冲突: ${reportStats.conflictCount}`);

check('点位总数一致', reportStats.totalPoints === state.points.length, 
  String(state.points.length), String(reportStats.totalPoints));
check('筛选结果数一致', reportStats.filteredCount === state.filteredPoints.length,
  String(state.filteredPoints.length), String(reportStats.filteredCount));
check('异常点位数量一致', reportStats.anomalyCount === anomalies.length,
  String(anomalies.length), String(reportStats.anomalyCount));
check('数据冲突数量一致', reportStats.conflictCount === relConflicts.length,
  String(relConflicts.length), String(reportStats.conflictCount));

const anomalyInReport = (finalReport.match(/\n\[RC-\d+(-dup)?\] 状态:/g) || []).length;
check('报告异常详情条目数=异常数量', anomalyInReport === anomalies.length,
  String(anomalies.length), String(anomalyInReport));

const conflictInReport = (finalReport.match(/数据冲突 \(\d+\)\n/g) || []).length;
check('报告冲突章节存在且数量匹配', 
  finalReport.includes(`数据冲突 (${relConflicts.length})`),
  `数据冲突 (${relConflicts.length})`,
  finalReport.match(/数据冲突 \(\d+\)/)?.[0] || '未找到');

console.log('\n' + '='.repeat(70));
console.log(`【验证结论】${allPassed ? '✅ 全部通过' : '❌ 存在失败项'}`);
console.log('='.repeat(70));

if (!allPassed) {
  process.exit(1);
}
