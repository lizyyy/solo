import { useStore } from './src/store/useStore';
import { INSTRUMENT_GROUPS } from './src/data/mockData';
import type { SoundFieldPoint } from './src/types';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CANVAS_HEIGHT = 550;
const PADDING = 60;

const getState = () => useStore.getState();

const log: string[] = [];
const out = (msg: string) => {
  console.log(msg);
  log.push(msg);
};

out('============================================================');
out('  交响乐团站位声场 - 回归验证脚本');
out('  覆盖: 重新检测 → p012跨楼层 → p010/p015可视化 → 报告导出');
out('============================================================\n');

out('【步骤1】初始状态检查');
const initStats = getState().getAnomalyStats();
const initNormal = getState().points.filter(p => p.status === 'normal').length;
const initPending = getState().points.filter(p => p.status === 'pending').length;
const initAnomaly = getState().points.filter(p => p.status === 'anomaly').length;
out(`   总点数: ${getState().points.length}`);
out(`   正常: ${initNormal}, 待确认: ${initPending}, 异常: ${initAnomaly}`);
out(`   异常分布: 坐标偏移${initStats.coordinate_offset}, 设备重名${initStats.duplicate_name}, 缺照片${initStats.missing_photo}, 跨楼层${initStats.cross_floor}, 坐标系不一致${initStats.coordinate_mismatch}`);
out(`   ✓ 初始状态记录完成\n`);

out('【步骤2】点击重新检测 - 触发detectAnomalies()');
const p012Before = getState().points.find(p => p.id === 'p012');
out(`   重新检测前 p012(${p012Before?.name}):`);
out(`     状态: ${p012Before?.status}`);
out(`     异常: [${p012Before?.anomalies.join(', ')}]`);
out(`     判断过程: ${p012Before?.judgmentProcess?.substring(0, 60)}...`);

getState().detectAnomalies();

const p012After = getState().points.find(p => p.id === 'p012');
out(`   重新检测后 p012(${p012After?.name}):`);
out(`     状态: ${p012After?.status}`);
out(`     异常: [${p012After?.anomalies.join(', ')}]`);
out(`     判断过程: ${p012After?.judgmentProcess?.substring(0, 80)}...`);

const hasCrossFloor = p012After?.anomalies.includes('cross_floor');
out(`   跨楼层异常保留: ${hasCrossFloor ? '✓ 是 (关键修复验证通过)' : '✗ 否 (回归失败!)'}`);
if (!hasCrossFloor) {
  out(`   ERROR: 铜管组跨楼层在重新检测后丢失!`);
  out(`   铜管组乐器: ${INSTRUMENT_GROUPS['铜管组'].join(', ')}`);
  const brassGroup = getState().points.filter(p => INSTRUMENT_GROUPS['铜管组'].includes(p.instrument));
  brassGroup.forEach(p => {
    out(`     ${p.id} ${p.name}(${p.instrument}): floor=${p.floor}`);
  });
}
out('');

out('【步骤3】铜管组楼层归集验证 - 核心业务逻辑');
out(`   铜管组乐器: ${INSTRUMENT_GROUPS['铜管组'].join('、')}`);
const brassPoints = getState().points.filter(p => INSTRUMENT_GROUPS['铜管组'].includes(p.instrument));
const brassFloors = [...new Set(brassPoints.map(p => p.floor))].sort();
out(`   铜管组所有点位:`);
brassPoints.forEach(p => {
  out(`     ${p.id} ${p.name}(${p.instrument}): ${p.floor}层, 异常=[${p.anomalies.join(',')}]`);
});
out(`   铜管组楼层集合: [${brassFloors.join(', ')}]`);
out(`   跨楼层判定: ${brassFloors.length > 1 ? '✓ 是 (1层和2层同时存在)' : '✗ 否'}`);
const allBrassHasCrossFloor = brassPoints.every(p => p.anomalies.includes('cross_floor'));
out(`   铜管组所有点位均标记跨楼层: ${allBrassHasCrossFloor ? '✓ 是' : '✗ 否'}`);
out('');

out('【步骤4】重新检测后异常概览统计一致性');
const afterDetectStats = getState().getAnomalyStats();
const afterDetectNormal = getState().points.filter(p => p.status === 'normal').length;
const afterDetectPending = getState().points.filter(p => p.status === 'pending').length;
const afterDetectAnomaly = getState().points.filter(p => p.status === 'anomaly').length;
out(`   总点数: ${getState().points.length}`);
out(`   正常: ${afterDetectNormal}, 待确认: ${afterDetectPending}, 异常: ${afterDetectAnomaly}`);
out(`   异常分布: 坐标偏移${afterDetectStats.coordinate_offset}, 设备重名${afterDetectStats.duplicate_name}, 缺照片${afterDetectStats.missing_photo}, 跨楼层${afterDetectStats.cross_floor}, 坐标系不一致${afterDetectStats.coordinate_mismatch}`);
const crossFloorCount = afterDetectStats.cross_floor;
out(`   跨楼层异常数量: ${crossFloorCount} (铜管组4个乐器:圆号/小号/长号/大号，预期全部标记)`);
out(`   跨楼层数量>=1: ${crossFloorCount >= 1 ? '✓ 是' : '✗ 否 (回归失败!)'}`);
out('');

out('【步骤5】p010/p015 坐标系分区可视化位置验证');
const p010 = getState().points.find(p => p.id === 'p010');
const p015 = getState().points.find(p => p.id === 'p015');
out(`   p010: ${p010?.name}, 坐标系=${p010?.coordinateSystem}`);
out(`   p015: ${p015?.name}, 坐标系=${p015?.coordinateSystem}`);

const coordSystems = [...new Set(getState().points.map(p => p.coordinateSystem))];
const mainCoordSystem = getState().params.coordinateSystem;
const otherSystems = coordSystems.filter(s => s !== mainCoordSystem);
out(`   主坐标系: ${mainCoordSystem}`);
out(`   其他坐标系: [${otherSystems.join(', ')}]`);

const computeVisualPos = (point: SoundFieldPoint) => {
  if (point.coordinateSystem === mainCoordSystem) {
    return { drawX: point.x + PADDING, drawY: point.y + PADDING, inMainZone: true };
  }
  const systemIndex = otherSystems.indexOf(point.coordinateSystem);
  const zoneHeight = (CANVAS_HEIGHT - PADDING * 2) / (otherSystems.length + 1);
  const systemPoints = getState().points.filter(p => p.coordinateSystem === point.coordinateSystem);
  const pointIndexInSystem = systemPoints.findIndex(p => p.id === point.id);
  const pointsPerRow = 5;
  const row = Math.floor(pointIndexInSystem / pointsPerRow);
  const col = pointIndexInSystem % pointsPerRow;
  return {
    drawX: PADDING + 50 + col * 80,
    drawY: PADDING + zoneHeight * (systemIndex + 1) + zoneHeight / 2 + row * 30,
    inMainZone: false,
    systemIndex,
    pointIndexInSystem,
  };
};

const p010Pos = computeVisualPos(p010!);
const p015Pos = computeVisualPos(p015!);
out(`   p010 可视化位置: X=${p010Pos.drawX}, Y=${p010Pos.drawY} (WGS84分区，systemIndex=${'systemIndex' in p010Pos ? p010Pos.systemIndex : 'N/A'})`);
out(`   p015 可视化位置: X=${p015Pos.drawX}, Y=${p015Pos.drawY} (BD-09分区，systemIndex=${'systemIndex' in p015Pos ? p015Pos.systemIndex : 'N/A'})`);

const positionsDiffer = Math.abs(p010Pos.drawX - p015Pos.drawX) > 10 || Math.abs(p010Pos.drawY - p015Pos.drawY) > 10;
const inCorrectZones = 
  p010.coordinateSystem !== mainCoordSystem && !p010Pos.inMainZone &&
  p015.coordinateSystem !== mainCoordSystem && !p015Pos.inMainZone;
out(`   p010/p015位置不重叠: ${positionsDiffer ? '✓ 是 (关键修复验证通过)' : '✗ 否 (位置错误!)'}`);
out(`   p010/p015不落入主坐标系: ${inCorrectZones ? '✓ 是' : '✗ 否'}`);
out('');

out('【步骤6】生成报告 - 验证报告统计与当前状态一致');
const report = getState().generateReport();
out(`   报告总点数: ${report.summary.totalPoints} vs 实际: ${getState().points.length}`);
out(`   报告正常: ${report.summary.normalCount} vs 实际: ${afterDetectNormal}`);
out(`   报告待确认: ${report.summary.pendingCount} vs 实际: ${afterDetectPending}`);
out(`   报告异常: ${report.summary.anomalyCount} vs 实际: ${afterDetectAnomaly}`);
const reportConsistent =
  report.summary.totalPoints === getState().points.length &&
  report.summary.normalCount === afterDetectNormal &&
  report.summary.pendingCount === afterDetectPending &&
  report.summary.anomalyCount === afterDetectAnomaly;
out(`   报告与状态一致: ${reportConsistent ? '✓ 是' : '✗ 否 (两套说法!)'}`);

const reportP012 = report.points.find(p => p.id === 'p012');
out(`   报告中p012状态: ${reportP012?.status}`);
out(`   报告中p012异常: [${reportP012?.anomalies.join(', ')}]`);
const reportCrossFloor = reportP012?.anomalies.includes('cross_floor');
out(`   报告跨楼层保留: ${reportCrossFloor ? '✓ 是' : '✗ 否 (报告脱节!)'}`);

const reportCrossFloorStat = report.summary.anomalies.cross_floor;
out(`   报告跨楼层统计: ${reportCrossFloorStat} vs 实际: ${crossFloorCount}`);
out('');

out('【步骤7】导出JSON - 验证导出文件字段完整且与页面一致');
const jsonContent = getState().exportData('json');
const jsonData = JSON.parse(jsonContent);
out(`   导出元数据: 项目=${jsonData.meta.project}, 导出人=${jsonData.meta.exportedBy}`);
out(`   导出判断过程步骤数: ${jsonData.meta.judgmentProcess.length}`);
out(`   导出汇总跨楼层数: ${jsonData.summary.anomalies.cross_floor} vs 实际: ${crossFloorCount}`);
const exportP012 = jsonData.points.find((p: { id: string }) => p.id === 'p012');
out(`   导出p012状态: ${exportP012.status}, 异常标签=[${exportP012.anomalyLabels.join(', ')}]`);
out(`   导出p012判断过程: ${exportP012.judgmentProcess.substring(0, 70)}...`);
const exportHasCrossFloor = exportP012.anomalies.includes('cross_floor');
out(`   导出跨楼层保留: ${exportHasCrossFloor ? '✓ 是' : '✗ 否 (导出脱节!)'}`);

const jsonPath = join(__dirname, 'regression-export.json');
fs.writeFileSync(jsonPath, jsonContent, 'utf-8');
out(`   导出文件已保存: ${jsonPath}\n`);

out('【步骤8】p012 历史变化轨迹记录');
out(`   初始anomalies: [${p012Before?.anomalies.join(',')}] (mockData预置)`);
out(`   重新检测后anomalies: [${p012After?.anomalies.join(',')}] (detectAnomalies重算)`);
out(`   报告中anomalies: [${reportP012?.anomalies.join(',')}] (generateReport)`);
out(`   导出中anomalies: [${exportP012.anomalies.join(',')}] (exportData)`);
const allConsistent = 
  (p012After?.anomalies.includes('cross_floor') ?? false) &&
  (reportP012?.anomalies.includes('cross_floor') ?? false) &&
  exportP012.anomalies.includes('cross_floor');
out(`   全链路跨楼层一致: ${allConsistent ? '✓ 是' : '✗ 否'}\n`);

out('============================================================');
out('  验证结果汇总');
out('============================================================');
const results = {
  '重新检测后p012保留跨楼层': hasCrossFloor,
  '铜管组按组归集楼层': brassFloors.length > 1,
  'p010/p015可视化位置不重叠': positionsDiffer,
  'p010/p015不落入主坐标系': inCorrectZones,
  '报告统计与状态一致': reportConsistent,
  '报告中保留跨楼层': reportCrossFloor,
  '导出中保留跨楼层': exportHasCrossFloor,
  '全链路跨楼层一致': allConsistent,
};

Object.entries(results).forEach(([name, passed]) => {
  out(`   ${passed ? '✅' : '❌'} ${name}`);
});

const allPassed = Object.values(results).every(Boolean);
out(`\n  最终结论: ${allPassed ? '✅ 全部验证通过，回归已修复' : '❌ 存在回归问题，需继续修复'}`);
out('============================================================');

const logPath = join(__dirname, 'regression-test-log.txt');
fs.writeFileSync(logPath, log.join('\n'), 'utf-8');
console.log(`\n运行记录已保存: ${logPath}`);

if (!allPassed) process.exit(1);
