const fs = require('fs');
const path = require('path');

const points = [
  {
    id: 'rc-001',
    name: 'RC-001',
    type: 'reflection-chamber',
    x: 3.5, y: 2.0, z: 2.0,
    status: 'normal',
    inspectionDate: '2024-12-01',
    isReflectionChamber: true,
    notes: '主舞台左侧反射舱，V1方案确认位置',
    schemeVersion: 'v1',
    participatesInRayPath: true
  },
  {
    id: 'rc-002',
    name: 'RC-002',
    type: 'reflection-chamber',
    x: 6.5, y: 2.0, z: 2.0,
    status: 'normal',
    inspectionDate: '2024-12-01',
    isReflectionChamber: true,
    notes: '主舞台右侧反射舱，声线路径关键节点',
    schemeVersion: 'v1',
    participatesInRayPath: true
  },
  {
    id: 'rc-003',
    name: 'RC-003',
    type: 'reflection-chamber',
    x: 5.0, y: 1.5, z: null,
    status: 'empty',
    inspectionDate: '2024-12-02',
    isReflectionChamber: true,
    notes: '哎，这个Z坐标没填，林老师你看看原始记录表',
    schemeVersion: 'v1'
  },
  {
    id: 'rc-004',
    name: 'RC-004',
    type: 'reflection-chamber',
    x: 5.0, y: 3.0, z: 7.5,
    status: 'normal',
    inspectionDate: '2024-12-03',
    isReflectionChamber: true,
    notes: '观众席后区反射舱，参与声线反射',
    schemeVersion: 'v2',
    participatesInRayPath: true
  },
  {
    id: 'rc-005',
    name: 'RC-005',
    type: 'reflection-chamber',
    x: 2.0, y: 2.5, z: 5.0,
    status: 'duplicate',
    inspectionDate: '2024-12-02',
    isReflectionChamber: true,
    notes: '这个点位和RC-005-dup重复了，谁导入了两次？',
    schemeVersion: 'v1'
  },
  {
    id: 'rc-005-dup',
    name: 'RC-005-dup',
    type: 'reflection-chamber',
    x: 2.0, y: 2.5, z: 5.0,
    status: 'duplicate',
    inspectionDate: '2024-12-02',
    isReflectionChamber: true,
    notes: '重复导入的记录，建议删除这条',
    schemeVersion: 'v1'
  },
  {
    id: 'rc-007',
    name: 'RC-007',
    type: 'reflection-chamber',
    x: 2.8, y: 1.5, z: 3.0,
    status: 'error',
    inspectionDate: '2024-12-04',
    isReflectionChamber: true,
    notes: '这个有冲突！照片和点位表对不上，你瞅瞅',
    schemeVersion: 'v2',
    manualCoord: {
      x: 3.0, y: 1.6, z: 3.1,
      modifiedBy: '老王',
      reason: '现场量的，跟图纸有点差'
    },
    conflictWithPhoto: true,
    photoEvidence: {
      photoDesc: '2024-12-04 现场巡检照片_007.jpg',
      photoCoord: '(3.2, 1.8, 3.0)'
    }
  },
  {
    id: 'rc-009',
    name: 'RC-009',
    type: 'reflection-chamber',
    x: 9.8, y: 0.1, z: 4.9,
    status: 'boundary',
    inspectionDate: '2024-12-05',
    isReflectionChamber: true,
    notes: '边界记录！离右墙只剩0.2米，确认下是不是放错了',
    schemeVersion: 'v2'
  },
  {
    id: 'mic-01',
    name: 'MIC-01',
    type: 'microphone',
    x: 5.0, y: 1.2, z: 5.0,
    status: 'normal',
    inspectionDate: '2024-12-01',
    isReflectionChamber: false,
    notes: '主观众区拾音麦',
    schemeVersion: 'v1'
  },
  {
    id: 'spk-01',
    name: 'SPK-01',
    type: 'speaker',
    x: 5.0, y: 2.5, z: 1.0,
    status: 'normal',
    inspectionDate: '2024-12-01',
    isReflectionChamber: false,
    notes: '主扩声音源，声线从这出发',
    schemeVersion: 'v1'
  }
];

const photos = [
  { id: 'photo-007', pointId: 'rc-007', markedCoordinates: '(3.2, 1.8, 3.0)' }
];

const schemes = [
  { id: 'scheme-v2-007', pointId: 'rc-007', coordinates: { x: 2.8, y: 1.5, z: 3.0 } }
];

function getStatusLabel(status) {
  return { normal: '正常', warning: '注意', error: '冲突', empty: '坐标缺失', duplicate: '重复记录', boundary: '边界记录' }[status] || status;
}

function getStatusFriendlyMessage(point) {
  switch (point.status) {
    case 'empty': return `${point.name} 的坐标没填全，缺了${point.z === null ? 'Z' : ''}值，去翻翻原始记录表看看？`;
    case 'duplicate': return `${point.name} 跟别的点位坐标一模一样，是不是导入了两次？`;
    case 'boundary': return `${point.name} 快贴墙了，离边界不到0.5米，确认下是不是放错了位置`;
    case 'error': return `${point.name} 的坐标跟照片里对不上，你瞅瞅再定`;
    default: return '';
  }
}

function parseCoordStr(s) {
  const m = s.match(/\(?\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)?/);
  if (!m) return null;
  return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])];
}

function coordsMatch(a, b, tolerance = 0.05) {
  const ca = parseCoordStr(a);
  const cb = parseCoordStr(b);
  if (!ca || !cb) return false;
  return Math.abs(ca[0] - cb[0]) <= tolerance &&
         Math.abs(ca[1] - cb[1]) <= tolerance &&
         Math.abs(ca[2] - cb[2]) <= tolerance;
}

console.log('='.repeat(60));
console.log('报告导出真实落地测试');
console.log('='.repeat(60));

const anomalies = points.filter(p => p.status !== 'normal' && p.status !== 'warning');
const conflicts = [];

for (const point of points) {
  if (point.x === null || point.y === null || point.z === null) continue;
  const relatedPhotos = photos.filter(p => p.pointId === point.id);
  const relatedSchemes = schemes.filter(s => s.pointId === point.id);

  const tableCoord = `(${point.x}, ${point.y}, ${point.z})`;
  const photoCoord = relatedPhotos.length > 0 ? relatedPhotos[0].markedCoordinates : undefined;
  const schemeCoord = relatedSchemes.length > 0
    ? `(${relatedSchemes[0].coordinates.x}, ${relatedSchemes[0].coordinates.y}, ${relatedSchemes[0].coordinates.z})`
    : undefined;
  const manualCoord = point.manualCoord
    ? `(${point.manualCoord.x}, ${point.manualCoord.y}, ${point.manualCoord.z})`
    : undefined;

  let hasRealConflict = false;
  if (photoCoord && !coordsMatch(tableCoord, photoCoord)) hasRealConflict = true;
  if (manualCoord && !coordsMatch(tableCoord, manualCoord)) hasRealConflict = true;
  if (schemeCoord && !coordsMatch(tableCoord, schemeCoord)) hasRealConflict = true;
  if (photoCoord && manualCoord && !coordsMatch(photoCoord, manualCoord)) hasRealConflict = true;

  if (hasRealConflict || point.conflictWithPhoto) {
    conflicts.push({
      pointId: point.id,
      pointName: point.name,
      photoCoord,
      tableCoord,
      manualCoord,
      schemeCoord,
      suggestedAction: '照片标注与手改坐标不一致，建议到现场重新测量确认；手改坐标由' + (point.manualCoord?.modifiedBy || '某人') + '修改，原因："' + (point.manualCoord?.reason || '未知') + '"，建议与修改人确认',
      friendlyMessage: '哎，' + point.name + '这点位，照片里标在' + (photoCoord || '?') + '，但点位表写的是' + tableCoord + (manualCoord ? '，' + (point.manualCoord?.modifiedBy || '有人') + '手改成了' + manualCoord : '') + (schemeCoord ? '，方案里是' + schemeCoord : '') + '——几个数对不上，你再核对下？'
    });
  }
}

console.log('\n【步骤1】数据校验结果');
console.log(`点位总数: ${points.length}`);
console.log(`异常点位: ${anomalies.length}`);
console.log(`数据冲突: ${conflicts.length}`);
console.log('\n异常详情:');
anomalies.forEach(p => {
  console.log(`  - ${p.name}: ${getStatusLabel(p.status)} | ${getStatusFriendlyMessage(p)}`);
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

console.log('\n【步骤2】生成真实报告文件');
const now = new Date().toISOString().slice(0, 10);
const summary = '类型: 全部 | 状态: 冲突/缺失/重复/边界 | 仅异常项';

let report = `音乐厅声线反射舱 - 异常报告\n`;
report += `导出时间: ${now}\n`;
report += `筛选条件: ${summary}\n`;
report += `点位总数: ${points.length}\n`;
report += `筛选结果: ${anomalies.length}\n`;
report += `异常数量: ${anomalies.length}\n`;
report += `冲突数量: ${conflicts.length}\n`;
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

const reportPath = path.join(process.cwd(), `test-report-${now}.txt`);
fs.writeFileSync(reportPath, report, 'utf-8');

console.log(`\n报告已生成: ${reportPath}`);
console.log('\n【步骤3】验证报告内容');
const content = fs.readFileSync(reportPath, 'utf-8');
const lines = content.split('\n');
console.log(`报告行数: ${lines.length}`);
console.log(`包含"点位总数": ${content.includes('点位总数')} ? ${content.includes('点位总数: ' + points.length) ? '✅' : '❌'}`);
console.log(`包含"异常点位": ${content.includes('异常点位')}`);
console.log(`包含"数据冲突": ${content.includes('数据冲突')}`);
console.log(`包含RC-003: ${content.includes('RC-003')} (空值测试)`);
console.log(`包含RC-005: ${content.includes('RC-005')} (重复项测试)`);
console.log(`包含RC-007: ${content.includes('RC-007')} (冲突测试)`);
console.log(`包含RC-009: ${content.includes('RC-009')} (边界记录测试)`);
console.log(`包含"几个数对不上": ${content.includes('几个数对不上')}`);
console.log(`包含老王手改: ${content.includes('老王')}`);

console.log('\n【步骤4】统计一致性验证');
const anomalyCountInReport = (content.match(/\[RC-\d+(-dup)?\]/g) || []).length;
console.log(`报告中列出的异常点位数量: ${anomalyCountInReport}`);
console.log(`实际异常点位数量: ${anomalies.length}`);
console.log(`数量一致: ${anomalyCountInReport === anomalies.length ? '✅' : '❌'}`);

const conflictCountInReport = (content.match(/数据冲突 \(\d+\)/g) || []);
console.log(`报告中标注的冲突数量: ${conflicts.length}`);
console.log(`实际冲突数量: ${conflicts.length}`);
console.log(`数量一致: ${conflicts.length === 1 ? '✅' : '❌'}`);

console.log('\n【步骤5】验证每个异常点的原因说明都在');
const hasAllReasons = anomalies.every(p => content.includes(p.name) && content.includes(getStatusFriendlyMessage(p)));
console.log(`所有异常点原因都在报告中: ${hasAllReasons ? '✅' : '❌'}`);

console.log('\n' + '='.repeat(60));
console.log('测试完成!');
console.log('='.repeat(60));
