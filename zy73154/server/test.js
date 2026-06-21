const assert = require('assert');
const {
  parseLabReport,
  parseBoundarySample,
  parseVerbalNote,
  detectTideUnitMismatch,
  detectOutliers,
  mergeData,
  filterRecords,
  exportData,
  normalizeUnit
} = require('./processor');

const ReportDataStore = require('./data-store');

console.log('='.repeat(60));
console.log('🌊 海洋牧场报告汇总系统 - 集成测试');
console.log('='.repeat(60));
console.log();

function generateTestLabData() {
  const stations = [
    { id: 'S01', name: '一号监测站', lng: 122.1, lat: 30.8 },
    { id: 'S02', name: '二号监测站', lng: 122.3, lat: 31.0 },
    { id: 'S03', name: '三号监测站', lng: 122.5, lat: 31.2 },
    { id: 'S04', name: '四号监测站', lng: 122.7, lat: 31.4 },
    { id: 'S05', name: '五号监测站', lng: 122.9, lat: 31.6 }
  ];
  
  const data = [];
  const baseDate = new Date('2024-06-01');
  
  for (let day = 0; day < 7; day++) {
    for (const station of stations) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() + day);
      
      const temp = 24 + Math.random() * 3;
      const salinity = 30 + Math.random() * 2;
      const doVal = 6 + Math.random() * 2;
      const ph = 7.8 + Math.random() * 0.3;
      const chl = 2 + Math.random() * 3;
      const turb = 5 + Math.random() * 10;
      
      const tideLevel = 2 + Math.random() * 1.5;
      const tideUnit = (day === 5 && station.id === 'S03') ? '厘米' : 'm';
      
      const record = {
        stationId: station.id,
        stationName: station.name,
        sampleTime: date.toISOString().split('T')[0] + ' 08:00:00',
        longitude: station.lng + (Math.random() - 0.5) * 0.02,
        latitude: station.lat + (Math.random() - 0.5) * 0.02,
        temperature: parseFloat(temp.toFixed(2)),
        salinity: parseFloat(salinity.toFixed(2)),
        dissolvedOxygen: parseFloat(doVal.toFixed(2)),
        pH: parseFloat(ph.toFixed(2)),
        chlorophyll: parseFloat(chl.toFixed(2)),
        turbidity: parseFloat(turb.toFixed(2)),
        tideLevel: parseFloat(tideLevel.toFixed(2)),
        tideUnit: tideUnit
      };
      
      if (day === 3 && station.id === 'S02') {
        record.temperature = 35.5;
        record.salinity = 45.0;
      }
      
      data.push(record);
    }
  }
  
  return data;
}

let testResults = [];

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    testResults.push({ name, passed: true });
  } catch (err) {
    console.log(`❌ ${name}`);
    console.log(`   错误: ${err.message}`);
    testResults.push({ name, passed: false, error: err.message });
  }
}

console.log('📋 第一部分：单位标准化检测');
console.log('-'.repeat(40));

test('normalizeUnit - 米 (m)', () => {
  assert.strictEqual(normalizeUnit('m'), 'METERS');
});

test('normalizeUnit - 厘米 (cm)', () => {
  assert.strictEqual(normalizeUnit('cm'), 'CENTIMETERS');
});

test('normalizeUnit - 中文米', () => {
  assert.strictEqual(normalizeUnit('米'), 'METERS');
});

test('normalizeUnit - 中文厘米', () => {
  assert.strictEqual(normalizeUnit('厘米'), 'CENTIMETERS');
});

test('normalizeUnit - 未知单位返回null', () => {
  assert.strictEqual(normalizeUnit('xyz'), null);
});

console.log();
console.log('📋 第二部分：潮位单位混写检测');
console.log('-'.repeat(40));

test('detectTideUnitMismatch - 单位一致时不报错', () => {
  const records = [
    { id: '1', stationId: 'S01', sampleTime: '2024-06-01', tideLevel: 2.5, tideUnit: 'm' },
    { id: '2', stationId: 'S02', sampleTime: '2024-06-01', tideLevel: 3.0, tideUnit: '米' }
  ];
  const result = detectTideUnitMismatch(records);
  assert.strictEqual(result.hasMismatch, false);
  assert.strictEqual(result.affectedRecords.length, 0);
});

test('detectTideUnitMismatch - 单位混写时检测到问题', () => {
  const records = [
    { id: '1', stationId: 'S01', sampleTime: '2024-06-01', tideLevel: 2.5, tideUnit: 'm' },
    { id: '2', stationId: 'S02', sampleTime: '2024-06-01', tideLevel: 250, tideUnit: '厘米' }
  ];
  const result = detectTideUnitMismatch(records);
  assert.strictEqual(result.hasMismatch, true);
  assert.ok(result.affectedRecords.length > 0);
  assert.ok(result.unitsFound.length >= 2);
});

console.log();
console.log('📋 第三部分：离群值检测');
console.log('-'.repeat(40));

test('detectOutliers - 正常数据无离群值', () => {
  const records = [];
  for (let i = 0; i < 10; i++) {
    records.push({
      id: `r${i}`,
      stationId: 'S01',
      sampleTime: `2024-06-0${i + 1}`,
      temperature: 25 + Math.random() * 0.5
    });
  }
  const result = detectOutliers(records, { sigma: 3 });
  assert.strictEqual(result.length, 0);
});

test('detectOutliers - 明显离群值被检测到', () => {
  const records = [];
  for (let i = 0; i < 9; i++) {
    records.push({
      id: `r${i}`,
      stationId: 'S01',
      sampleTime: `2024-06-0${i + 1}`,
      temperature: 25 + Math.random() * 0.3
    });
  }
  records.push({
    id: 'r9',
    stationId: 'S01',
    sampleTime: '2024-06-10',
    temperature: 35
  });
  const result = detectOutliers(records, { sigma: 2 });
  assert.ok(result.length > 0);
  assert.ok(result.some(o => o.recordId === 'r9'));
});

test('detectOutliers - 离群值保留不删除（只标记）', () => {
  const records = [];
  for (let i = 0; i < 12; i++) {
    records.push({
      id: `r${i}`,
      stationId: 'S01',
      sampleTime: `2024-06-${String(i + 1).padStart(2, '0')}`,
      temperature: 25.0 + (Math.random() - 0.5) * 0.4
    });
  }
  records.push({
    id: 'r99',
    stationId: 'S01',
    sampleTime: '2024-06-20',
    temperature: 40.0
  });
  const result = detectOutliers(records, { sigma: 2 });
  assert.strictEqual(records.length, 13);
  assert.ok(result.length > 0);
  assert.ok(result.some(o => o.recordId === 'r99'));
});

console.log();
console.log('📋 第四部分：实验室报告解析');
console.log('-'.repeat(40));

test('parseLabReport - 正确解析数据结构', () => {
  const rawData = generateTestLabData();
  const result = parseLabReport(rawData, { name: 'test-lab' });
  
  assert.ok(Array.isArray(result.records));
  assert.strictEqual(result.records.length, rawData.length);
  
  const first = result.records[0];
  assert.ok(first.id);
  assert.ok(first.stationId);
  assert.strictEqual(first.source, 'test-lab');
  assert.strictEqual(first.sourceType, 'lab');
});

test('parseLabReport - 潮位单位混写标记为待确认', () => {
  const rawData = generateTestLabData();
  const result = parseLabReport(rawData);
  
  const pendingRecords = result.records.filter(r => r.status === 'pending');
  assert.ok(pendingRecords.length > 0);
  
  for (const r of pendingRecords) {
    assert.ok(r.pendingReasons.some(p => p.type === 'tide_unit_mismatch'));
  }
});

test('parseLabReport - 离群值标记但保留', () => {
  const rawData = generateTestLabData();
  const result = parseLabReport(rawData);
  
  const outlierRecords = result.records.filter(r => r.isOutlier);
  assert.ok(outlierRecords.length > 0);
  assert.ok(result.records.length > outlierRecords.length);
});

console.log();
console.log('📋 第五部分：边界样本与口头说明');
console.log('-'.repeat(40));

test('parseBoundarySample - 正确解析边界样本', () => {
  const sampleData = {
    sampleId: 'B001',
    stationId: 'S05',
    sampleTime: '2024-06-15 14:30:00',
    longitude: 122.95,
    latitude: 31.65,
    boundaryType: 'edge',
    description: '海域边界监测点',
    note: '老何现场采集'
  };
  
  const result = parseBoundarySample(sampleData);
  assert.ok(result.id);
  assert.strictEqual(result.sampleId, 'B001');
  assert.strictEqual(result.isBoundary, true);
  assert.strictEqual(result.source, 'boundary-sample');
});

test('parseVerbalNote - 正确解析口头说明', () => {
  const noteData = {
    content: '三号站昨天的潮位读数好像有点问题，注意核对',
    reporter: '老何'
  };
  
  const result = parseVerbalNote(noteData);
  assert.ok(result.id);
  assert.strictEqual(result.content, '三号站昨天的潮位读数好像有点问题，注意核对');
  assert.strictEqual(result.reporter, '老何');
  assert.strictEqual(result.source, 'verbal-note');
});

console.log();
console.log('📋 第六部分：数据合并与版本管理');
console.log('-'.repeat(40));

test('mergeData - 正确合并数据', () => {
  const existing = {
    records: [{ id: 'r1', stationId: 'S01', temperature: 25 }],
    boundarySamples: [],
    verbalNotes: []
  };
  
  const newData = {
    records: [{ id: 'r2', stationId: 'S02', temperature: 26 }],
    boundarySamples: [{ id: 'b1', sampleId: 'B001' }],
    verbalNotes: [{ id: 'n1', content: 'test' }]
  };
  
  const merged = mergeData(existing, newData, 'test');
  assert.strictEqual(merged.records.length, 2);
  assert.strictEqual(merged.boundarySamples.length, 1);
  assert.strictEqual(merged.verbalNotes.length, 1);
});

test('ReportDataStore - 初始版本创建', () => {
  const store = new ReportDataStore();
  const data = {
    records: [
      { id: 'r1', stationId: 'S01', temperature: 25, isOutlier: false, status: 'normal' }
    ],
    boundarySamples: [],
    verbalNotes: []
  };
  
  const version = store.createVersion(data, 'lab-report', '初始导入');
  assert.ok(version.id);
  assert.strictEqual(store.versions.length, 1);
  assert.strictEqual(store.latestVersion.id, version.id);
  assert.strictEqual(version.changes.type, 'initial');
});

test('ReportDataStore - 版本变更检测', () => {
  const store = new ReportDataStore();
  
  const data1 = {
    records: [
      { id: 'r1', stationId: 'S01', temperature: 25, isOutlier: false, status: 'normal' }
    ],
    boundarySamples: [],
    verbalNotes: []
  };
  store.createVersion(data1, 'lab-report', '第一次导入');
  
  const data2 = {
    records: [
      { id: 'r1', stationId: 'S01', temperature: 25, isOutlier: false, status: 'normal' },
      { id: 'r2', stationId: 'S02', temperature: 26, isOutlier: false, status: 'normal' }
    ],
    boundarySamples: [],
    verbalNotes: []
  };
  const v2 = store.createVersion(data2, 'lab-report', '第二次导入');
  
  assert.strictEqual(store.versions.length, 2);
  assert.strictEqual(v2.changes.recordDiff, 1);
  assert.strictEqual(v2.changes.addedCount, 1);
});

test('ReportDataStore - 记录修改检测', () => {
  const store = new ReportDataStore();
  
  const data1 = {
    records: [
      { id: 'r1', stationId: 'S01', temperature: 25, isOutlier: false, status: 'normal' }
    ],
    boundarySamples: [],
    verbalNotes: []
  };
  store.createVersion(data1, 'lab-report', '第一次');
  
  const data2 = {
    records: [
      { id: 'r1', stationId: 'S01', temperature: 27, isOutlier: true, status: 'pending' }
    ],
    boundarySamples: [],
    verbalNotes: []
  };
  const v2 = store.createVersion(data2, 'update', '修改');
  
  assert.strictEqual(v2.changes.modifiedCount, 1);
  assert.ok(v2.changes.modifiedRecords.length > 0);
  assert.ok(v2.changes.modifiedRecords[0].changes.length > 0);
});

console.log();
console.log('📋 第七部分：筛选与导出');
console.log('-'.repeat(40));

test('filterRecords - 按状态筛选', () => {
  const records = [
    { id: 'r1', stationId: 'S01', status: 'normal', isOutlier: false },
    { id: 'r2', stationId: 'S02', status: 'pending', isOutlier: false },
    { id: 'r3', stationId: 'S03', status: 'normal', isOutlier: true }
  ];
  
  const pending = filterRecords(records, { status: 'pending' });
  assert.strictEqual(pending.length, 1);
  assert.strictEqual(pending[0].id, 'r2');
});

test('filterRecords - 按离群值筛选', () => {
  const records = [
    { id: 'r1', stationId: 'S01', status: 'normal', isOutlier: false },
    { id: 'r2', stationId: 'S02', status: 'normal', isOutlier: true }
  ];
  
  const outliers = filterRecords(records, { hasOutlier: true });
  assert.strictEqual(outliers.length, 1);
  assert.strictEqual(outliers[0].id, 'r2');
});

test('filterRecords - hasOutlier传字符串"true"仍能筛出离群（对应前端query string）', () => {
  const records = [
    { id: 'r1', stationId: 'S01', isOutlier: false },
    { id: 'r2', stationId: 'S02', isOutlier: true },
    { id: 'r3', stationId: 'S03', isOutlier: true }
  ];

  const byStrTrue = filterRecords(records, { hasOutlier: 'true' });
  assert.strictEqual(byStrTrue.length, 2, '字符串"true"应等同于布尔true筛出离群');
  assert.ok(byStrTrue.every(r => r.isOutlier === true));

  const byStrFalse = filterRecords(records, { hasOutlier: 'false' });
  assert.strictEqual(byStrFalse.length, 1, '字符串"false"应等同于布尔false筛出非离群');
  assert.strictEqual(byStrFalse[0].id, 'r1');
});

test('filterRecords - hasOutlier大小写与前后空格不敏感', () => {
  const records = [
    { id: 'r1', isOutlier: true },
    { id: 'r2', isOutlier: false }
  ];
  assert.strictEqual(filterRecords(records, { hasOutlier: 'TRUE' }).length, 1);
  assert.strictEqual(filterRecords(records, { hasOutlier: '  True  ' }).length, 1);
  assert.strictEqual(filterRecords(records, { hasOutlier: 'False' }).length, 1);
});

test('filterRecords - hasOutlier缺省或空时不过滤（返回全部）', () => {
  const records = [
    { id: 'r1', isOutlier: true },
    { id: 'r2', isOutlier: false }
  ];
  assert.strictEqual(filterRecords(records, {}).length, 2);
  assert.strictEqual(filterRecords(records, { hasOutlier: undefined }).length, 2);
  assert.strictEqual(filterRecords(records, { hasOutlier: '' }).length, 2);
});

test('筛出口径一致：filterRecords与exportData使用同一hasOutlier判断', () => {
  const { toBool } = require('./processor');
  const records = [
    { id: 'r1', stationId: 'S01', isOutlier: false },
    { id: 'r2', stationId: 'S02', isOutlier: true },
    { id: 'r3', stationId: 'S03', isOutlier: true }
  ];
  const filters = { hasOutlier: 'true' };

  const filtered = filterRecords(records, filters);
  const exportedStr = exportData(filtered, 'json');
  const exported = JSON.parse(exportedStr);

  assert.strictEqual(filtered.length, 2);
  assert.strictEqual(exported.length, filtered.length, '导出记录数应等于屏幕筛选记录数');
  assert.deepStrictEqual(
    exported.map(r => r.id).sort(),
    filtered.map(r => r.id).sort(),
    '导出的记录ID集合应与屏幕筛选的一致'
  );

  assert.strictEqual(toBool('true'), true, 'toBool(true字符串)统一归一');
  assert.strictEqual(toBool(true), true, 'toBool(布尔true)统一归一');
});

test('filterRecords - 按站点筛选', () => {
  const records = [
    { id: 'r1', stationId: 'S01', status: 'normal', isOutlier: false },
    { id: 'r2', stationId: 'S02', status: 'normal', isOutlier: false }
  ];
  
  const filtered = filterRecords(records, { stationId: 'S01' });
  assert.strictEqual(filtered.length, 1);
  assert.strictEqual(filtered[0].stationId, 'S01');
});

test('exportData - JSON导出', () => {
  const records = [
    { id: 'r1', stationId: 'S01', temperature: 25 },
    { id: 'r2', stationId: 'S02', temperature: 26 }
  ];
  
  const exported = exportData(records, 'json');
  const parsed = JSON.parse(exported);
  assert.strictEqual(parsed.length, 2);
});

test('exportData - CSV导出', () => {
  const records = [
    { id: 'r1', stationId: 'S01', temperature: 25 },
    { id: 'r2', stationId: 'S02', temperature: 26 }
  ];
  
  const exported = exportData(records, 'csv');
  const lines = exported.split('\n');
  assert.strictEqual(lines.length, 3);
  assert.ok(lines[0].includes('stationId'));
});

console.log();
console.log('🎭 第八部分：完整彩排流程');
console.log('-'.repeat(40));

test('完整彩排：导入旧材料 → 补录边界样本 → 重跑 → 检查变化', () => {
  const store = new ReportDataStore();
  
  console.log('   第一步：导入实验室结果表（旧材料）');
  const rawLabData = generateTestLabData();
  const parsedLab = parseLabReport(rawLabData, { name: '2024年6月监测报告 v1' });
  const v1 = store.createVersion(
    { records: parsedLab.records, boundarySamples: [], verbalNotes: [] },
    'lab-report',
    '初始导入：2024年6月监测报告'
  );
  assert.ok(v1.id);
  assert.ok(v1.stats.totalRecords > 0);
  console.log(`      → 导入 ${v1.stats.totalRecords} 条记录，${v1.stats.outliers} 个离群值，${v1.stats.pendingConfirm} 条待确认`);
  
  console.log('   第二步：添加口头说明');
  const verbalNote = parseVerbalNote({
    content: '三号站S03的潮位单位好像写成厘米了，注意核对一下',
    reporter: '老何'
  });
  const dataAfterNote = mergeData(
    { records: v1.records, boundarySamples: v1.boundarySamples, verbalNotes: v1.verbalNotes },
    { verbalNotes: [verbalNote] },
    'verbal-note'
  );
  const v2 = store.createVersion(dataAfterNote, 'verbal-note', '老何口头说明：潮位单位存疑');
  assert.strictEqual(v2.verbalNotes.length, 1);
  console.log(`      → 添加口头说明，当前版本：${v2.id.slice(0, 8)}...`);
  
  console.log('   第三步：补录边界样本');
  const boundarySample = parseBoundarySample({
    sampleId: 'B001',
    stationId: 'S05',
    sampleTime: '2024-06-15 14:30:00',
    longitude: 122.95,
    latitude: 31.65,
    boundaryType: 'outer',
    description: '外海边界补充样本',
    note: '老何现场采样，数据待核实'
  });
  const dataAfterBoundary = mergeData(
    { records: v2.records, boundarySamples: v2.boundarySamples, verbalNotes: v2.verbalNotes },
    { boundarySamples: [boundarySample] },
    'boundary-sample'
  );
  const v3 = store.createVersion(dataAfterBoundary, 'boundary-sample', '补录边界样本 B001');
  assert.strictEqual(v3.boundarySamples.length, 1);
  console.log(`      → 补录边界样本：${boundarySample.sampleId}`);
  
  console.log('   第四步：补录后重跑');
  const { detectTideUnitMismatch: recheckTide, detectOutliers: recheckOutliers } = require('./processor');
  
  const tideCheck = recheckTide(v3.records);
  const outliers = recheckOutliers(v3.records);
  
  const reprocessedRecords = v3.records.map(r => ({ ...r, reprocessTime: new Date().toISOString() }));
  
  const outlierMap = new Map();
  for (const o of outliers) {
    if (!outlierMap.has(o.recordId)) outlierMap.set(o.recordId, []);
    outlierMap.get(o.recordId).push(o);
  }
  for (const record of reprocessedRecords) {
    if (outlierMap.has(record.id)) {
      record.isOutlier = true;
      record.outlierInfo = outlierMap.get(record.id);
    }
  }
  
  if (tideCheck.hasMismatch) {
    const affectedIds = new Set(tideCheck.affectedRecords.map(r => r.recordId));
    for (const record of reprocessedRecords) {
      if (affectedIds.has(record.id)) {
        record.status = 'pending';
      }
    }
  }
  
  const v4 = store.createVersion(
    {
      records: reprocessedRecords,
      boundarySamples: v3.boundarySamples,
      verbalNotes: v3.verbalNotes
    },
    'rerun',
    '补录后重跑'
  );
  
  console.log(`      → 重跑完成，版本：${v4.id.slice(0, 8)}...`);
  console.log(`      → 记录数: ${v4.stats.totalRecords}`);
  console.log(`      → 离群值: ${v4.stats.outliers}`);
  console.log(`      → 待确认: ${v4.stats.pendingConfirm}`);
  
  console.log('   第五步：检查历史连续性');
  assert.strictEqual(store.versions.length, 4);
  assert.strictEqual(store.latestVersion.id, v4.id);
  console.log(`      → 历史版本数: ${store.versions.length} 个（连续）`);
  
  console.log('   第六步：检查口径变更追溯');
  const allVersions = store.getAllVersions();
  assert.strictEqual(allVersions.length, 4);
  
  const sources = allVersions.map(v => v.source);
  assert.ok(sources.includes('lab-report'));
  assert.ok(sources.includes('verbal-note'));
  assert.ok(sources.includes('boundary-sample'));
  assert.ok(sources.includes('rerun'));
  console.log(`      → 版本来源: ${sources.join(' → ')}`);
  
  console.log('   第七步：检查待确认记录的详细信息');
  const pendingRecords = v4.records.filter(r => r.status === 'pending');
  assert.ok(pendingRecords.length > 0);
  
  for (const r of pendingRecords) {
    assert.ok(r.pendingReasons.length > 0);
    const tideReason = r.pendingReasons.find(p => p.type === 'tide_unit_mismatch');
    assert.ok(tideReason);
    assert.ok(tideReason.reason.includes('潮位单位混写'));
  }
  console.log(`      → 待确认记录: ${pendingRecords.length} 条`);
  console.log(`      → 每条都有明确的待确认理由`);
  
  console.log('   第八步：导出与屏幕筛选口径一致');
  const filters = { status: 'pending' };
  const filteredRecords = filterRecords(v4.records, filters);
  const exportedJSON = exportData(filteredRecords, 'json');
  const exportedParsed = JSON.parse(exportedJSON);
  
  assert.strictEqual(exportedParsed.length, filteredRecords.length);
  console.log(`      → 筛选待确认: 屏幕 ${filteredRecords.length} 条 = 导出 ${exportedParsed.length} 条`);
  console.log(`      → ✅ 口径一致`);
  
  console.log('   第九步：检查离群值保留不删除');
  const outlierRecords = v4.records.filter(r => r.isOutlier);
  assert.ok(outlierRecords.length > 0);
  assert.ok(v4.records.length > outlierRecords.length);
  console.log(`      → 离群值: ${outlierRecords.length} 条（保留但标记）`);
  console.log(`      → 总记录: ${v4.records.length} 条`);
  console.log(`      → ✅ 没有删除离群数据`);

  console.log('   第十步：模拟前端 hasOutlier="true" 筛选 → 贯通到导出');
  const screenFiltered = filterRecords(v4.records, { hasOutlier: 'true' });
  assert.strictEqual(
    screenFiltered.length,
    outlierRecords.length,
    '前端传字符串 "true" 时，screen筛选结果应等于全量离群记录数'
  );
  for (const r of screenFiltered) {
    assert.strictEqual(r.isOutlier, true, '筛出的每条记录必须确实是离群');
  }

  const nonOutlierScreen = filterRecords(v4.records, { hasOutlier: 'false' });
  assert.strictEqual(
    nonOutlierScreen.length,
    v4.records.length - outlierRecords.length,
    '前端传字符串 "false" 时，应筛出全部非离群'
  );
  for (const r of nonOutlierScreen) {
    assert.strictEqual(r.isOutlier, false, '筛出的每条记录必须确实是非离群');
  }

  const noCondition = filterRecords(v4.records, {});
  assert.strictEqual(noCondition.length, v4.records.length, '不传hasOutlier时不过滤');

  const exportJSONStr = exportData(screenFiltered, 'json');
  const exportJSON = JSON.parse(exportJSONStr);
  assert.strictEqual(
    exportJSON.length,
    screenFiltered.length,
    'JSON导出记录数 = 屏幕筛选记录数'
  );
  assert.deepStrictEqual(
    exportJSON.map(r => r.id).sort(),
    screenFiltered.map(r => r.id).sort(),
    '导出的ID集合 = 屏幕筛选的ID集合（口径一致）'
  );

  const exportCSV = exportData(screenFiltered, 'csv');
  const csvLines = exportCSV.split('\n').filter(l => l.trim() !== '');
  assert.strictEqual(
    csvLines.length,
    screenFiltered.length + 1,
    'CSV导出行数（含表头） = 屏幕筛选数 + 1（口径一致）'
  );

  console.log(`      → 仅离群筛选（hasOutlier="true"）: ${screenFiltered.length} 条`);
  console.log(`      → 非离群筛选（hasOutlier="false"）: ${nonOutlierScreen.length} 条`);
  console.log(`      → 无筛选条件: ${noCondition.length} 条`);
  console.log(`      → JSON导出: ${exportJSON.length} 条 ↔ 屏幕: ${screenFiltered.length} 条 ✅ 一致`);
  console.log(`      → CSV导出: ${screenFiltered.length} 条数据行 + 表头 ✅ 一致`);
  console.log(`      → ✅ 前端筛选 / 后端查询 / 导出 共用一套判断，没有各走一套`);

  console.log('   第十一步：历史没有断');
  const history = store.getAllVersions();
  assert.strictEqual(history.length, 4);
  const flow = history.map(h => h.source);
  assert.deepStrictEqual(flow, ['lab-report', 'verbal-note', 'boundary-sample', 'rerun']);
  console.log(`      → 版本链: ${flow.join(' → ')}`);
  console.log(`      → ✅ 历史连续、口径变更追踪完整`);
  
  console.log('   ✅ 完整彩排流程通过！');
});

console.log();
console.log('='.repeat(60));
const passed = testResults.filter(r => r.passed).length;
const total = testResults.length;
console.log(`测试结果: ${passed}/${total} 通过`);

if (passed === total) {
  console.log('🎉 所有测试通过！');
} else {
  console.log('❌ 部分测试失败');
  const failed = testResults.filter(r => !r.passed);
  for (const f of failed) {
    console.log(`   - ${f.name}: ${f.error}`);
  }
  process.exit(1);
}
console.log('='.repeat(60));
