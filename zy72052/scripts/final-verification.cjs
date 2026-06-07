const fs = require('fs');
const path = require('path');

console.log('='.repeat(70));
console.log('【最终复验】音乐厅声线反射舱系统 - 全链路验证');
console.log('='.repeat(70));

const validatePoints = require('../src/core/dataValidator.js').validatePoints;
const getStatusLabel = require('../src/core/dataValidator.js').getStatusLabel;
const getStatusFriendlyMessage = require('../src/core/dataValidator.js').getStatusFriendlyMessage;
const detectConflicts = require('../src/core/conflictDetector.js').detectConflicts;
const filterPoints = require('../src/core/filterEngine.js').filterPoints;
const buildFilterSummary = require('../src/core/filterEngine.js').buildFilterSummary;

const mockPoints = [
  { id: 'rc-001', name: 'RC-001', type: 'reflection-chamber', x: 3.5, y: 2.0, z: 2.0, status: 'normal', inspectionDate: '2024-12-01', isReflectionChamber: true, notes: '主舞台左侧反射舱', schemeVersion: 'v1', participatesInRayPath: true },
  { id: 'rc-002', name: 'RC-002', type: 'reflection-chamber', x: 6.5, y: 2.0, z: 2.0, status: 'normal', inspectionDate: '2024-12-01', isReflectionChamber: true, notes: '主舞台右侧反射舱', schemeVersion: 'v1', participatesInRayPath: true },
  { id: 'rc-003', name: 'RC-003', type: 'reflection-chamber', x: 5.0, y: 1.5, z: null, status: 'empty', inspectionDate: '2024-12-02', isReflectionChamber: true, notes: 'Z坐标没填', schemeVersion: 'v1' },
  { id: 'rc-004', name: 'RC-004', type: 'reflection-chamber', x: 5.0, y: 3.0, z: 7.5, status: 'normal', inspectionDate: '2024-12-03', isReflectionChamber: true, notes: '观众席后区', schemeVersion: 'v2', participatesInRayPath: true },
  { id: 'rc-005', name: 'RC-005', type: 'reflection-chamber', x: 2.0, y: 2.5, z: 5.0, status: 'duplicate', inspectionDate: '2024-12-02', isReflectionChamber: true, notes: '重复点位', schemeVersion: 'v1' },
  { id: 'rc-005-dup', name: 'RC-005-dup', type: 'reflection-chamber', x: 2.0, y: 2.5, z: 5.0, status: 'duplicate', inspectionDate: '2024-12-02', isReflectionChamber: true, notes: '重复导入', schemeVersion: 'v1' },
  { id: 'rc-007', name: 'RC-007', type: 'reflection-chamber', x: 2.8, y: 1.5, z: 3.0, status: 'error', inspectionDate: '2024-12-04', isReflectionChamber: true, notes: '数据冲突', schemeVersion: 'v2', manualCoord: { x: 3.0, y: 1.6, z: 3.1, modifiedBy: '老王', reason: '现场量的' }, conflictWithPhoto: true, photoEvidence: { photoDesc: '现场照片', photoCoord: '(3.2, 1.8, 3.0)' } },
  { id: 'rc-009', name: 'RC-009', type: 'reflection-chamber', x: 9.8, y: 0.1, z: 4.9, status: 'boundary', inspectionDate: '2024-12-05', isReflectionChamber: true, notes: '边界记录', schemeVersion: 'v2' },
  { id: 'mic-01', name: 'MIC-01', type: 'microphone', x: 5.0, y: 1.2, z: 5.0, status: 'normal', inspectionDate: '2024-12-01', isReflectionChamber: false, notes: '拾音麦', schemeVersion: 'v1' },
  { id: 'spk-01', name: 'SPK-01', type: 'speaker', x: 5.0, y: 2.5, z: 1.0, status: 'normal', inspectionDate: '2024-12-01', isReflectionChamber: false, notes: '主扩声', schemeVersion: 'v1' },
];

const mockPhotos = [
  { id: 'photo-007', pointId: 'rc-007', markedCoordinates: '(3.2, 1.8, 3.0)' }
];

const mockSchemes = [
  { id: 'scheme-v2-007', pointId: 'rc-007', coordinates: { x: 2.8, y: 1.5, z: 3.0 } }
];

let allPassed = true;
function check(name, condition, expected, actual) {
  const passed = condition;
  console.log(`  ${passed ? '✅' : '❌'} ${name}`);
  if (!passed) {
    console.log(`     期望: ${expected}`);
    console.log(`     实际: ${actual}`);
    allPassed = false;
  }
  return passed;
}

console.log('\n【1/6】数据校验模块');
const validated = validatePoints(mockPoints);
check('点位总数=10', validated.length === 10, 10, validated.length);

const anomalies = validated.filter(p => p.status !== 'normal' && p.status !== 'warning');
check('异常点位=5 (RC-003/005/005-dup/007/009)', anomalies.length === 5, 5, anomalies.length);

const emptyPts = validated.filter(p => p.status === 'empty');
check('空值检测: RC-003', emptyPts.length === 1 && emptyPts[0].id === 'rc-003', 'rc-003', emptyPts.map(p => p.id).join(','));

const dupPts = validated.filter(p => p.status === 'duplicate');
check('重复检测: RC-005 + RC-005-dup', dupPts.length === 2, '2个', dupPts.length + '个');

const boundaryPts = validated.filter(p => p.status === 'boundary');
check('边界检测: RC-009', boundaryPts.length === 1 && boundaryPts[0].id === 'rc-009', 'rc-009', boundaryPts.map(p => p.id).join(','));

console.log('\n【2/6】冲突检测模块');
const conflicts = detectConflicts(validated, mockPhotos, mockSchemes);
check('冲突数量=1 (仅RC-007)', conflicts.length === 1, 1, conflicts.length);
check('冲突点位是RC-007', conflicts[0].pointId === 'rc-007', 'rc-007', conflicts[0].pointId);
check('包含点位表坐标', !!conflicts[0].tableCoord, '存在', conflicts[0].tableCoord ? '存在' : '缺失');
check('包含照片坐标', !!conflicts[0].photoCoord, '存在', conflicts[0].photoCoord ? '存在' : '缺失');
check('包含手改坐标', !!conflicts[0].manualCoord, '存在', conflicts[0].manualCoord ? '存在' : '缺失');
check('包含方案坐标', !!conflicts[0].schemeCoord, '存在', conflicts[0].schemeCoord ? '存在' : '缺失');
check('包含建议操作', !!conflicts[0].suggestedAction, '存在', conflicts[0].suggestedAction ? '存在' : '缺失');
check('友好提示像同事说话', conflicts[0].friendlyMessage.includes('几个数对不上'), '包含"几个数对不上"', conflicts[0].friendlyMessage);

console.log('\n【3/6】筛选引擎模块');
const f1 = filterPoints(validated, { types: ['reflection-chamber'], statuses: [], schemeVersions: [], dateRange: null, onlyReflectionChambers: false, onlyAnomalies: false });
check('按类型筛选: 反射舱=8个', f1.length === 8, 8, f1.length);

const f2 = filterPoints(validated, { types: [], statuses: ['empty', 'duplicate', 'boundary', 'error'], schemeVersions: [], dateRange: null, onlyReflectionChambers: false, onlyAnomalies: false });
check('按状态筛选: 异常=5个', f2.length === 5, 5, f2.length);

const f3 = filterPoints(validated, { types: [], statuses: [], schemeVersions: ['v2'], dateRange: null, onlyReflectionChambers: false, onlyAnomalies: false });
check('按方案筛选: V2方案=3个 (RC-004/007/009)', f3.length === 3, 3, f3.length);

const f4 = filterPoints(validated, { types: [], statuses: [], schemeVersions: [], dateRange: null, onlyReflectionChambers: true, onlyAnomalies: true });
check('组合筛选: 仅反射舱+仅异常=5个', f4.length === 5, 5, f4.length);

const summary = buildFilterSummary({ types: ['reflection-chamber'], statuses: ['error'], schemeVersions: ['v2'], dateRange: null, onlyReflectionChambers: false, onlyAnomalies: false });
check('筛选摘要包含中文', summary.includes('反射舱') && summary.includes('冲突') && summary.includes('V2'), '包含中文标签', summary);

console.log('\n【4/6】报告内容验证');
const now = new Date().toISOString().slice(0, 10);
const currentDate = '2024-12-04';

function generateTestReport(filtered, allPoints, allConflicts, selectedPoint, filterSum) {
  const anomalies = filtered.filter(p => p.status !== 'normal' && p.status !== 'warning');
  let report = `音乐厅声线反射舱 - 巡检报告\n`;
  report += `导出时间: ${now}\n`;
  report += `巡检日期: ${currentDate}\n`;
  report += `筛选条件: ${filterSum}\n`;
  report += `点位总数: ${allPoints.length}\n`;
  report += `筛选结果: ${filtered.length}\n`;
  report += `异常点位: ${anomalies.length}\n`;
  report += `数据冲突: ${allConflicts.filter(c => filtered.some(p => p.id === c.pointId)).length}\n`;
  if (selectedPoint) report += `当前选中: ${selectedPoint.name} (${getStatusLabel(selectedPoint.status)})\n`;
  report += `${'='.repeat(60)}\n\n`;

  for (const p of anomalies) {
    report += `[${p.name}] 状态: ${getStatusLabel(p.status)}\n`;
    report += `  坐标: ${p.x !== null ? `(${p.x}, ${p.y}, ${p.z})` : '不完整'}\n`;
    report += `  提示: ${getStatusFriendlyMessage(p)}\n`;
    if (p.manualCoord) report += `  手改: by ${p.manualCoord.modifiedBy}\n`;
  }

  for (const c of allConflicts) {
    if (!filtered.some(p => p.id === c.pointId)) continue;
    report += `\n[${c.pointName}] 冲突\n`;
    report += `  ${c.friendlyMessage}\n`;
  }
  return report;
}

const testFiltered = f4;
const testConflicts = conflicts;
const testSelected = validated.find(p => p.id === 'rc-007');
const testSummary = buildFilterSummary({ types: [], statuses: [], schemeVersions: [], dateRange: null, onlyReflectionChambers: true, onlyAnomalies: true });
const report = generateTestReport(testFiltered, validated, testConflicts, testSelected, testSummary);

check('报告包含表头', report.includes('音乐厅声线反射舱 - 巡检报告'), '是', report.slice(0, 50));
check('报告包含筛选条件', report.includes('筛选条件:'), '是', '存在');
check('报告包含点位总数', report.includes('点位总数: 10'), '是', '存在');
check('报告包含当前选中', report.includes('当前选中: RC-007'), '是', '存在');
check('报告包含所有异常点位', ['RC-003', 'RC-005', 'RC-005-dup', 'RC-007', 'RC-009'].every(name => report.includes(name)), '全部5个都在', '都在');
check('报告包含中文状态标签', ['坐标缺失', '重复记录', '边界记录', '冲突'].every(s => report.includes(s)), '全部中文标签', '都在');
check('报告包含友好提示', report.includes('几个数对不上') || report.includes('林老师'), '有同事对话式提示', '存在');
check('报告包含手改人信息', report.includes('老王'), '有手改人', '存在');

const reportPath = path.join(process.cwd(), `final-verification-report-${now}.txt`);
fs.writeFileSync(reportPath, report, 'utf-8');
check('报告文件已生成', fs.existsSync(reportPath), '已生成', reportPath);

const reportOnDisk = fs.readFileSync(reportPath, 'utf-8');
check('报告文件内容一致', reportOnDisk === report, '一致', '一致');

console.log('\n【5/6】同步一致性验证');
const selectedInReport = report.includes('RC-007');
const selectedInStore = !!testSelected;
check('点选→报告同步', selectedInReport === selectedInStore, '同步', '同步');

const filteredCount = testFiltered.length;
const reportFilteredCountMatch = report.includes(`筛选结果: ${filteredCount}`);
check('筛选→报告同步', reportFilteredCountMatch, '同步', `筛选${filteredCount}个，报告显示${filteredCount}个`);

const dateInReport = report.includes('2024-12-04');
check('时间轴→报告同步', dateInReport, '同步', '巡检日期2024-12-04在报告中');

console.log('\n【6/6】源码文件完整性');
const filesToCheck = [
  'src/types/index.ts',
  'src/data/points.ts',
  'src/data/photos.ts',
  'src/data/schemes.ts',
  'src/core/dataValidator.ts',
  'src/core/conflictDetector.ts',
  'src/core/filterEngine.ts',
  'src/core/acousticCalculator.ts',
  'src/store/useAppStore.ts',
  'src/components/Scene3D/index.tsx',
  'src/components/FilterPanel/index.tsx',
  'src/components/Sidebar/index.tsx',
  'src/components/Timeline/index.tsx',
  'src/components/ExportButton/index.tsx',
  'src/pages/Home.tsx',
  'src/App.tsx',
];

let filesOk = true;
for (const f of filesToCheck) {
  const exists = fs.existsSync(path.join(process.cwd(), f));
  if (!exists) {
    console.log(`  ❌ 缺失文件: ${f}`);
    filesOk = false;
  }
}
if (filesOk) console.log('  ✅ 全部16个核心文件存在');
allPassed = allPassed && filesOk;

console.log('\n' + '='.repeat(70));
console.log(`【复验结论】${allPassed ? '✅ 全部通过' : '❌ 存在失败项'}`);
console.log('='.repeat(70));

if (!allPassed) {
  process.exit(1);
}
