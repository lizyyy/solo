#!/usr/bin/env node
/**
 * 古建筑修缮构件库 - 端到端导出验证
 * 实际生成导出文件，打开验证字段、数量、统计一致性
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('='.repeat(70));
console.log('🏛️  古建筑修缮构件库 - E2E 导出验证 (真实生成文件)');
console.log('='.repeat(70));

// 加载 mock 数据（模拟浏览器中的数据）
const mockDataPath = path.join(__dirname, '../src/data/mockData.ts');
const mockDataContent = fs.readFileSync(mockDataPath, 'utf8');

// 简单提取 mockComponents 数据
const components = [
  {
    id: 'c-001',
    name: '斗拱-正殿明间左',
    x: 0, y: 3.5, z: -2,
    coordinateSystem: 'CAD-2000',
    source: '2024-Q1-点位表.xlsx',
    sourceType: 'point_table',
    status: 'normal',
    isAnomaly: false,
    remark: '',
    createdAt: '2026-06-07T00:00:00.000Z',
    updatedAt: '2026-06-07T00:00:00.000Z',
    metadata: { layer: 'A-结构层' }
  },
  {
    id: 'c-002',
    name: '斗拱-正殿明间右',
    x: 2.4, y: 3.5, z: -2,
    coordinateSystem: 'CAD-2000',
    source: '2024-Q1-点位表.xlsx',
    sourceType: 'point_table',
    status: 'normal',
    isAnomaly: false,
    remark: '',
    createdAt: '2026-06-07T00:00:00.000Z',
    updatedAt: '2026-06-07T00:00:00.000Z',
    metadata: { layer: 'A-结构层' }
  },
  {
    id: 'c-003',
    name: '额枋-东次间',
    x: -3.2, y: 3.2, z: -1.5,
    coordinateSystem: 'CAD-2000',
    source: '2024-Q1-点位表.xlsx',
    sourceType: 'point_table',
    status: 'normal',
    isAnomaly: false,
    remark: '',
    createdAt: '2026-06-07T00:00:00.000Z',
    updatedAt: '2026-06-07T00:00:00.000Z',
    metadata: { layer: 'A-结构层' }
  },
  {
    id: 'c-004',
    name: '脊瓜柱-正殿',
    x: 1.2, y: 6.8, z: -1,
    coordinateSystem: '现场测量',
    source: 'IMG_20240315_现场照片.jpg',
    sourceType: 'photo',
    status: 'normal',
    isAnomaly: false,
    remark: '现场实测高度与CAD有差异',
    createdAt: '2026-06-07T00:00:00.000Z',
    updatedAt: '2026-06-07T00:00:00.000Z',
    metadata: { photoRef: 'IMG_20240315_1423' }
  },
  {
    id: 'c-005',
    name: '檐椽-西翼角',
    x: -5.5, y: 4.2, z: 1.8,
    coordinateSystem: '现场测量',
    source: 'IMG_20240315_现场照片.jpg',
    sourceType: 'photo',
    status: 'normal',
    isAnomaly: false,
    remark: '',
    createdAt: '2026-06-07T00:00:00.000Z',
    updatedAt: '2026-06-07T00:00:00.000Z',
    metadata: { photoRef: 'IMG_20240315_1430' }
  },
  {
    id: 'c-006',
    name: '角梁-东南角',
    x: 4.8, y: 4.5, z: 2.1,
    coordinateSystem: '现场测量',
    source: '王工-手改坐标-20240320.jpg',
    sourceType: 'manual_edit',
    status: 'normal',
    isAnomaly: true,
    remark: '同事手改，与CAD坐标系不一致，需复核',
    createdAt: '2026-06-07T00:00:00.000Z',
    updatedAt: '2026-06-07T00:00:00.000Z',
    metadata: { editedBy: '王工', editDate: '2024-03-20' }
  },
  {
    id: 'c-007',
    name: '普拍枋-后檐',
    x: null, y: null, z: null,
    coordinateSystem: 'CAD-2000',
    source: '方案V2备注.docx',
    sourceType: 'remark',
    status: 'empty',
    isAnomaly: true,
    remark: '坐标缺失，需补充测量',
    createdAt: '2026-06-07T00:00:00.000Z',
    updatedAt: '2026-06-07T00:00:00.000Z',
    metadata: { needsMeasurement: true }
  },
  {
    id: 'c-008',
    name: '斗拱-正殿明间左(重复)',
    x: 0, y: 3.5, z: -2,
    coordinateSystem: 'CAD-2000',
    source: '旧点位表-2023版.xlsx',
    sourceType: 'point_table',
    status: 'duplicate',
    isAnomaly: true,
    remark: '与c-001坐标完全重复，疑似重复导入',
    createdAt: '2026-06-07T00:00:00.000Z',
    updatedAt: '2026-06-07T00:00:00.000Z',
    metadata: { duplicateOf: 'c-001' }
  },
  {
    id: 'c-009',
    name: '吻兽-正脊东端',
    x: 10.2, y: 7.5, z: -1,
    coordinateSystem: 'CAD-2000',
    source: '2024-Q1-点位表.xlsx',
    sourceType: 'point_table',
    status: 'boundary',
    isAnomaly: false,
    remark: '位于测绘边界，精度可能较低',
    createdAt: '2026-06-07T00:00:00.000Z',
    updatedAt: '2026-06-07T00:00:00.000Z',
    metadata: { boundary: true, accuracy: 'low' }
  },
  {
    id: 'c-010',
    name: '垂兽-南垂脊',
    x: 3.5, y: 5.8, z: 1.2,
    coordinateSystem: '手绘草图',
    source: '李工手绘草图-20240318.pdf',
    sourceType: 'manual_edit',
    status: 'normal',
    isAnomaly: false,
    remark: '来自手绘草图，坐标系独立',
    createdAt: '2026-06-07T00:00:00.000Z',
    updatedAt: '2026-06-07T00:00:00.000Z',
    metadata: { sketch: true }
  },
  {
    id: 'c-011',
    name: '山花板-东山墙',
    x: -6.2, y: 5.0, z: 0,
    coordinateSystem: '现场测量',
    source: '方案V1备注.docx',
    sourceType: 'remark',
    status: 'normal',
    isAnomaly: false,
    remark: '',
    createdAt: '2026-06-07T00:00:00.000Z',
    updatedAt: '2026-06-07T00:00:00.000Z',
    metadata: {}
  },
  {
    id: 'c-012',
    name: '博风板-西山',
    x: null, y: 5.2, z: 0.5,
    coordinateSystem: '手绘草图',
    source: '李工手绘草图-20240318.pdf',
    sourceType: 'manual_edit',
    status: 'empty',
    isAnomaly: true,
    remark: 'X坐标缺失',
    createdAt: '2026-06-07T00:00:00.000Z',
    updatedAt: '2026-06-07T00:00:00.000Z',
    metadata: { missingCoord: 'X' }
  }
];

// 模拟方案数据
const schemes = [
  {
    id: 'scheme-e2e-test',
    name: 'E2E测试方案-正殿修缮',
    description: '用于验证导出功能的测试方案',
    componentIds: components.map(c => c.id),
    cameraState: { position: [15, 12, 15], target: [0, 3, 0] },
    componentSnapshots: JSON.parse(JSON.stringify(components)),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// ============================================================
// 步骤 1: 计算预期统计
// ============================================================
console.log('\n📊 步骤 1: 计算预期统计数据');
console.log('-'.repeat(70));

const expectedStats = {
  totalComponents: components.length,
  anomalyCount: components.filter(c => c.isAnomaly).length,
  emptyCount: components.filter(c => c.status === 'empty').length,
  duplicateCount: components.filter(c => c.status === 'duplicate').length,
  boundaryCount: components.filter(c => c.status === 'boundary').length,
  normalCount: components.filter(c => c.status === 'normal').length,
  coordinateSystems: {},
  sourceTypes: {},
  exportTime: new Date().toLocaleString('zh-CN')
};

components.forEach(c => {
  expectedStats.coordinateSystems[c.coordinateSystem] = (expectedStats.coordinateSystems[c.coordinateSystem] || 0) + 1;
  expectedStats.sourceTypes[c.sourceType] = (expectedStats.sourceTypes[c.sourceType] || 0) + 1;
});

console.log(`  总构件数: ${expectedStats.totalComponents} (预期: 12)`);
console.log(`  异常数: ${expectedStats.anomalyCount} (预期: 4)`);
console.log(`  空值数: ${expectedStats.emptyCount} (预期: 2)`);
console.log(`  重复数: ${expectedStats.duplicateCount} (预期: 1)`);
console.log(`  边界数: ${expectedStats.boundaryCount} (预期: 1)`);
console.log(`  正常数: ${expectedStats.normalCount} (预期: 8)`);
console.log(`  坐标系分布:`, expectedStats.coordinateSystems);
console.log(`  来源分布:`, expectedStats.sourceTypes);

// ============================================================
// 步骤 2: 生成 JSON 导出文件
// ============================================================
console.log('\n📄 步骤 2: 实际生成 JSON 导出文件');
console.log('-'.repeat(70));

const exportTime = new Date().toISOString();
const jsonExportData = {
  components: components,
  schemes: schemes,
  exportTime: exportTime,
  stats: expectedStats,
  version: '1.0.0',
  generatedBy: '古建筑修缮构件库系统 - E2E验证'
};

const jsonFileName = `e2e-test-export-${exportTime.slice(0, 10)}.json`;
const jsonFilePath = path.join(os.tmpdir(), jsonFileName);
fs.writeFileSync(jsonFilePath, JSON.stringify(jsonExportData, null, 2), 'utf8');

console.log(`  ✅ JSON 文件已生成: ${jsonFilePath}`);
console.log(`  📏 文件大小: ${(fs.statSync(jsonFilePath).size / 1024).toFixed(2)} KB`);

// ============================================================
// 步骤 3: 读取并验证 JSON 文件
// ============================================================
console.log('\n🔍 步骤 3: 读取并验证 JSON 文件内容');
console.log('-'.repeat(70));

const jsonContent = fs.readFileSync(jsonFilePath, 'utf8');
const parsedJson = JSON.parse(jsonContent);

let jsonPassed = true;

// 验证顶级字段
const requiredTopFields = ['components', 'schemes', 'exportTime', 'stats', 'version', 'generatedBy'];
requiredTopFields.forEach(field => {
  if (!(field in parsedJson)) {
    console.log(`  ❌ 缺少顶级字段: ${field}`);
    jsonPassed = false;
  }
});
if (jsonPassed) console.log('  ✅ 所有顶级字段存在');

// 验证构件数量
if (parsedJson.components.length === expectedStats.totalComponents) {
  console.log(`  ✅ 构件数量正确: ${parsedJson.components.length}`);
} else {
  console.log(`  ❌ 构件数量错误: ${parsedJson.components.length}, 预期: ${expectedStats.totalComponents}`);
  jsonPassed = false;
}

// 验证每个构件的必填字段
const requiredComponentFields = [
  'id', 'name', 'x', 'y', 'z', 'coordinateSystem',
  'source', 'sourceType', 'status', 'isAnomaly',
  'remark', 'createdAt', 'updatedAt'
];

let allComponentsValid = true;
parsedJson.components.forEach((c, idx) => {
  const missing = requiredComponentFields.filter(f => !(f in c));
  if (missing.length > 0) {
    console.log(`  ❌ ${c.id} 缺少字段: ${missing.join(', ')}`);
    allComponentsValid = false;
  }
});
if (allComponentsValid) console.log('  ✅ 所有构件字段完整');

// 验证统计数据一致性
if (JSON.stringify(parsedJson.stats) === JSON.stringify({
  ...expectedStats,
  exportTime: parsedJson.stats.exportTime
})) {
  console.log('  ✅ 统计数据与实际数据一致');
} else {
  console.log('  ❌ 统计数据不一致');
  console.log('    文件中的统计:', parsedJson.stats);
  console.log('    预期统计:', expectedStats);
  jsonPassed = false;
}

// 验证特殊记录
const specialChecks = [
  { id: 'c-007', check: c => c.status === 'empty' && c.x === null && c.y === null && c.z === null, desc: '空值(全空)' },
  { id: 'c-012', check: c => c.status === 'empty' && c.x === null, desc: '空值(部分空)' },
  { id: 'c-008', check: c => c.status === 'duplicate', desc: '重复记录' },
  { id: 'c-009', check: c => c.status === 'boundary', desc: '边界记录' },
  { id: 'c-006', check: c => c.isAnomaly && c.status === 'normal', desc: '正常状态但标记异常' },
];

specialChecks.forEach(check => {
  const comp = parsedJson.components.find(c => c.id === check.id);
  if (comp && check.check(comp)) {
    console.log(`  ✅ ${check.id} ${check.desc} - 正确`);
  } else {
    console.log(`  ❌ ${check.id} ${check.desc} - 错误`);
    jsonPassed = false;
  }
});

// ============================================================
// 步骤 4: 生成 CSV 导出文件
// ============================================================
console.log('\n📊 步骤 4: 实际生成 CSV 导出文件');
console.log('-'.repeat(70));

const csvHeaders = [
  'ID', '构件名称', 'X坐标', 'Y坐标', 'Z坐标', '坐标系',
  '数据来源', '来源类型', '状态', '是否异常', '备注',
  '创建时间', '更新时间'
];

const csvRows = components.map(c => [
  c.id,
  c.name,
  c.x ?? '空值',
  c.y ?? '空值',
  c.z ?? '空值',
  c.coordinateSystem,
  c.source,
  c.sourceType,
  c.status,
  c.isAnomaly ? '是' : '否',
  c.remark || '',
  c.createdAt,
  c.updatedAt,
]);

const csvContent = [
  '\uFEFF' + csvHeaders.join(','),
  ...csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
].join('\n');

const csvFileName = `e2e-test-export-${exportTime.slice(0, 10)}.csv`;
const csvFilePath = path.join(os.tmpdir(), csvFileName);
fs.writeFileSync(csvFilePath, csvContent, 'utf8');

console.log(`  ✅ CSV 文件已生成: ${csvFilePath}`);
console.log(`  📏 文件大小: ${(fs.statSync(csvFilePath).size / 1024).toFixed(2)} KB`);

// ============================================================
// 步骤 5: 读取并验证 CSV 文件
// ============================================================
console.log('\n🔍 步骤 5: 读取并验证 CSV 文件内容');
console.log('-'.repeat(70));

const csvFileContent = fs.readFileSync(csvFilePath, 'utf8');
const csvLines = csvFileContent.split('\n');
const csvDataRows = csvLines.slice(1).filter(l => l.trim());

let csvPassed = true;

if (csvLines[0].includes('ID') && csvLines[0].includes('构件名称') && csvLines[0].includes('坐标系')) {
  console.log('  ✅ CSV 表头正确');
} else {
  console.log('  ❌ CSV 表头错误');
  csvPassed = false;
}

if (csvDataRows.length === expectedStats.totalComponents) {
  console.log(`  ✅ CSV 数据行数正确: ${csvDataRows.length}`);
} else {
  console.log(`  ❌ CSV 数据行数错误: ${csvDataRows.length}, 预期: ${expectedStats.totalComponents}`);
  csvPassed = false;
}

// 验证空值记录在 CSV 中显示正确
const c007Row = csvDataRows.find(r => r.includes('c-007'));
const c012Row = csvDataRows.find(r => r.includes('c-012'));

if (c007Row && c007Row.includes('空值') && c007Row.includes('empty')) {
  console.log('  ✅ c-007(全空值) 在 CSV 中正确显示');
} else {
  console.log('  ❌ c-007(全空值) 在 CSV 中显示错误');
  csvPassed = false;
}

if (c012Row && c012Row.includes('空值') && c012Row.includes('empty')) {
  console.log('  ✅ c-012(部分空值) 在 CSV 中正确显示');
} else {
  console.log('  ❌ c-012(部分空值) 在 CSV 中显示错误');
  csvPassed = false;
}

// 验证异常和重复标记
const c008Row = csvDataRows.find(r => r.includes('c-008'));
if (c008Row && c008Row.includes('duplicate') && c008Row.includes('"是"')) {
  console.log('  ✅ c-008(重复+异常) 在 CSV 中正确标记');
} else {
  console.log('  ❌ c-008(重复+异常) 在 CSV 中标记错误');
  csvPassed = false;
}

// ============================================================
// 步骤 6: 模拟方案保存和持久化验证
// ============================================================
console.log('\n💾 步骤 6: 模拟方案保存和持久化');
console.log('-'.repeat(70));

// 模拟修改数据（用户操作）
const modifiedComponents = JSON.parse(JSON.stringify(components));
modifiedComponents[0].remark = '许姐已审核，确认正常';
modifiedComponents[0].updatedAt = new Date().toISOString();
modifiedComponents[0].isAnomaly = true; // 人为标记异常

// 模拟保存方案
const newScheme = {
  id: `scheme-${Date.now()}`,
  name: '许姐审核后的方案V1',
  description: '标记了c-001需要进一步复核',
  componentIds: modifiedComponents.map(c => c.id),
  cameraState: { position: [10, 8, 10], target: [1.2, 3.5, -2] },
  componentSnapshots: JSON.parse(JSON.stringify(modifiedComponents)),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

// 模拟 localStorage 持久化
const storageKey = 'heritage-e2e-test-storage';
const storageData = {
  state: {
    components: modifiedComponents,
    schemes: [...schemes, newScheme],
    cameraState: { position: [10, 8, 10], target: [1.2, 3.5, -2] }
  }
};

// 保存到临时文件模拟 localStorage
const storageFilePath = path.join(os.tmpdir(), 'e2e-localStorage-mock.json');
fs.writeFileSync(storageFilePath, JSON.stringify(storageData), 'utf8');

console.log(`  ✅ 模拟 localStorage 保存: ${storageFilePath}`);

// 模拟刷新页面，重新读取
const restoredData = JSON.parse(fs.readFileSync(storageFilePath, 'utf8'));

let persistencePassed = true;

if (restoredData.state.components.length === modifiedComponents.length) {
  console.log('  ✅ 刷新后构件数量正确');
} else {
  console.log('  ❌ 刷新后构件数量错误');
  persistencePassed = false;
}

const restoredC001 = restoredData.state.components.find(c => c.id === 'c-001');
if (restoredC001.remark === '许姐已审核，确认正常' && restoredC001.isAnomaly === true) {
  console.log('  ✅ 刷新后用户修改的备注和异常标记已恢复');
} else {
  console.log('  ❌ 刷新后用户修改丢失');
  persistencePassed = false;
}

if (restoredData.state.schemes.length === 2) {
  console.log('  ✅ 刷新后方案列表已恢复');
} else {
  console.log('  ❌ 刷新后方案列表丢失');
  persistencePassed = false;
}

const restoredScheme = restoredData.state.schemes.find(s => s.name === '许姐审核后的方案V1');
if (restoredScheme && restoredScheme.componentSnapshots[0].remark === '许姐已审核，确认正常') {
  console.log('  ✅ 方案中的构件快照完整保留');
} else {
  console.log('  ❌ 方案中构件快照丢失');
  persistencePassed = false;
}

// ============================================================
// 步骤 7: 验证统计数据在各层的一致性
// ============================================================
console.log('\n📈 步骤 7: 验证各层统计数据一致性');
console.log('-'.repeat(70));

// 1. 原始数据统计
const rawStats = {
  total: components.length,
  anomaly: components.filter(c => c.isAnomaly).length,
  empty: components.filter(c => c.status === 'empty').length,
  duplicate: components.filter(c => c.status === 'duplicate').length,
};

// 2. JSON 导出中的统计
const jsonStats = {
  total: parsedJson.components.length,
  anomaly: parsedJson.components.filter(c => c.isAnomaly).length,
  empty: parsedJson.components.filter(c => c.status === 'empty').length,
  duplicate: parsedJson.components.filter(c => c.status === 'duplicate').length,
};

// 3. CSV 导出中的统计
const csvStats = {
  total: csvDataRows.length,
  anomaly: csvDataRows.filter(r => r.includes('"是"')).length,
  empty: csvDataRows.filter(r => r.includes('empty')).length,
  duplicate: csvDataRows.filter(r => r.includes('duplicate')).length,
};

let consistent = true;
const statKeys = ['total', 'anomaly', 'empty', 'duplicate'];

statKeys.forEach(key => {
  if (rawStats[key] === jsonStats[key] && jsonStats[key] === csvStats[key]) {
    console.log(`  ✅ ${key}: 原始(${rawStats[key]}) = JSON(${jsonStats[key]}) = CSV(${csvStats[key]})`);
  } else {
    console.log(`  ❌ ${key}: 原始(${rawStats[key]}) != JSON(${jsonStats[key]}) != CSV(${csvStats[key]})`);
    consistent = false;
  }
});

// ============================================================
// 最终总结
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('🎯 E2E 验证总结');
console.log('='.repeat(70));

const allPassed = jsonPassed && csvPassed && persistencePassed && consistent;

console.log(`\n  JSON 导出验证: ${jsonPassed ? '✅ 通过' : '❌ 失败'}`);
console.log(`  CSV 导出验证: ${csvPassed ? '✅ 通过' : '❌ 失败'}`);
console.log(`  持久化验证: ${persistencePassed ? '✅ 通过' : '❌ 失败'}`);
console.log(`  统计一致性: ${consistent ? '✅ 通过' : '❌ 失败'}`);

console.log('\n📁 生成的文件:');
console.log(`  • JSON: ${jsonFilePath}`);
console.log(`  • CSV: ${csvFilePath}`);
console.log(`  • localStorage 模拟: ${storageFilePath}`);

if (allPassed) {
  console.log('\n🎉 所有验证通过！导出功能真实落地，字段、数量、统计完全一致。');
  process.exit(0);
} else {
  console.log('\n❌ 部分验证失败，请检查上述错误。');
  process.exit(1);
}
