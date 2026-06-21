const http = require('http');

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: postData
        ? {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        : {}
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function generateLabData() {
  const stations = [
    { id: 'S01', name: '一号监测站', lng: 122.1, lat: 30.8 },
    { id: 'S02', name: '二号监测站', lng: 122.3, lat: 31.0 },
    { id: 'S03', name: '三号监测站', lng: 122.5, lat: 31.2 },
    { id: 'S04', name: '四号监测站', lng: 122.7, lat: 31.4 },
    { id: 'S05', name: '五号监测站', lng: 122.9, lat: 31.6 }
  ];
  const data = [];
  const base = new Date('2024-06-01');
  for (let d = 0; d < 7; d++) {
    for (const s of stations) {
      const date = new Date(base);
      date.setDate(date.getDate() + d);
      const r = {
        stationId: s.id,
        stationName: s.name,
        sampleTime: date.toISOString().split('T')[0] + ' 08:00:00',
        longitude: s.lng + (Math.random() - 0.5) * 0.02,
        latitude: s.lat + (Math.random() - 0.5) * 0.02,
        temperature: parseFloat((24 + Math.random() * 3).toFixed(2)),
        salinity: parseFloat((30 + Math.random() * 2).toFixed(2)),
        dissolvedOxygen: parseFloat((6 + Math.random() * 2).toFixed(2)),
        pH: parseFloat((7.8 + Math.random() * 0.3).toFixed(2)),
        chlorophyll: parseFloat((2 + Math.random() * 3).toFixed(2)),
        turbidity: parseFloat((5 + Math.random() * 10).toFixed(2)),
        tideLevel: parseFloat((2 + Math.random() * 1.5).toFixed(2)),
        tideUnit: d === 5 && s.id === 'S03' ? '厘米' : 'm'
      };
      if (d === 3 && s.id === 'S02') {
        r.temperature = 35.5;
        r.salinity = 45.0;
      }
      data.push(r);
    }
  }
  return data;
}

function assertEq(actual, expected, msg) {
  if (actual !== expected) {
    console.error(`❌ ${msg}: 期望 ${expected}, 实际 ${actual}`);
    process.exit(1);
  }
  console.log(`✅ ${msg}`);
}

function assertTrue(cond, msg) {
  if (!cond) {
    console.error(`❌ ${msg}`);
    process.exit(1);
  }
  console.log(`✅ ${msg}`);
}

(async () => {
  console.log('='.repeat(60));
  console.log('🎭 HTTP接口验收：导入→补录→仅离群筛选→导出→历史');
  console.log('='.repeat(60));
  console.log();

  console.log('📍 第1步：导入旧实验室结果表');
  const labBody = {
    data: generateLabData(),
    sourceName: '2024年6月监测报告 v1',
    note: '导入旧材料'
  };
  const { data: importResp } = await request('POST', '/api/import/lab-report', labBody);
  assertTrue(importResp.success, '导入返回 success');
  console.log(`   记录:${importResp.stats.totalRecords} 离群:${importResp.stats.outliers} 待确认:${importResp.stats.pendingConfirm}`);
  assertTrue(importResp.stats.outliers > 0, '有至少1条离群记录被标记');
  assertTrue(importResp.qualityCheck.tideUnitMismatch.hasMismatch, '潮位单位混写被检测到');

  console.log();
  console.log('📍 第2步：补一条边界样本（离群相关站点 S05 外层）');
  const boundaryBody = {
    data: {
      sampleId: 'B-验收-001',
      stationId: 'S05',
      sampleTime: '2024-06-15 14:30:00',
      longitude: 122.95,
      latitude: 31.65,
      boundaryType: 'outer',
      description: '验收用：外海边界样本，配合查看离群值',
      note: '工程师老何补录'
    },
    note: '补录边界样本'
  };
  const { data: bResp } = await request('POST', '/api/import/boundary-sample', boundaryBody);
  assertTrue(bResp.success, '边界样本导入 success');
  assertEq(bResp.sample.sampleId, 'B-验收-001', '边界样本ID正确');

  console.log();
  console.log('📍 第3步：补录后重跑（触发离群重新计算+标记）');
  const { data: rerunResp } = await request('POST', '/api/rerun', { note: '补录后重跑验收' });
  assertTrue(rerunResp.success, '重跑返回 success');
  assertEq(rerunResp.history.broken, false, '历史没有断');
  assertEq(rerunResp.history.totalVersions, 3, '总版本数 3 个（导入→边界→重跑）');
  console.log(`   版本链总版本: ${rerunResp.history.totalVersions} broken=${rerunResp.history.broken}`);

  console.log();
  console.log('📍 第4步：直接查询API，先看hasOutlier缺省时返回全部');
  const { data: allResp } = await request('GET', '/api/records');
  const totalInApi = allResp.total;
  const outlierCount = allResp.records.filter(r => r.isOutlier).length;
  console.log(`   无筛选: ${totalInApi} 条, 其中离群 ${outlierCount} 条`);
  assertTrue(outlierCount > 0, '至少有1条离群记录（否则本次验收场景无法覆盖）');

  console.log();
  console.log('📍 第5步：前端模拟 传 hasOutlier=true（query string形式，字符串）');
  const { data: onlyOutlierResp } = await request('GET', '/api/records?hasOutlier=true');
  console.log(`   hasOutlier=true 返回: ${onlyOutlierResp.total} 条`);
  assertEq(
    onlyOutlierResp.total,
    outlierCount,
    `仅离群筛选数 = 全量里的离群数 (${outlierCount})`
  );
  assertTrue(
    onlyOutlierResp.records.every(r => r.isOutlier === true),
    'hasOutlier=true 筛出的每条 isOutlier 都确实为 true'
  );

  console.log();
  console.log('📍 第6步：前端模拟 传 hasOutlier=false（字符串）');
  const { data: nonOutlierResp } = await request('GET', '/api/records?hasOutlier=false');
  console.log(`   hasOutlier=false 返回: ${nonOutlierResp.total} 条`);
  assertEq(
    nonOutlierResp.total,
    totalInApi - outlierCount,
    `非离群筛选数 = ${totalInApi} - ${outlierCount} = ${totalInApi - outlierCount}`
  );
  assertTrue(
    nonOutlierResp.records.every(r => r.isOutlier === false),
    'hasOutlier=false 筛出的每条 isOutlier 都确实为 false'
  );

  console.log();
  console.log('📍 第7步：导出接口 /api/export?hasOutlier=true → JSON口径一致');
  const { data: exportOutlier } = await request('GET', '/api/export?format=json&hasOutlier=true');
  const exportParsed = JSON.parse(exportOutlier.data);
  console.log(`   导出记录数: ${exportOutlier.recordCount}, 屏幕筛选: ${onlyOutlierResp.total}`);
  assertEq(
    exportOutlier.format,
    'json',
    '导出格式正确'
  );
  assertEq(
    exportOutlier.filters.hasOutlier,
    'true',
    '导出接口返回的 filters.hasOutlier 是字符串 "true"（和请求一致）'
  );
  assertEq(
    exportOutlier.recordCount,
    onlyOutlierResp.total,
    '导出 recordCount == 屏幕筛选 hasOutlier=true 总数（口径一致）'
  );
  assertEq(
    exportParsed.length,
    onlyOutlierResp.total,
    '导出 data 解析后数量 == 屏幕筛选总数（口径一致，数据本身）'
  );

  const screenIds = onlyOutlierResp.records.map(r => r.id).sort();
  const exportIds = exportParsed.map(r => r.id).sort();
  assertTrue(
    JSON.stringify(screenIds) === JSON.stringify(exportIds),
    '导出的记录 ID 集合 == 屏幕筛选的 ID 集合（同一条记录，完全对得上）'
  );

  console.log();
  console.log('📍 第8步：看版本历史，确认变化说明没有断');
  const { data: versionsResp } = await request('GET', '/api/versions');
  const sources = versionsResp.versions.map(v => v.source);
  console.log(`   版本来源链: ${sources.join(' → ')}`);
  assertEq(sources.length, 3, '版本数 3');
  assertTrue(
    sources.includes('2024年6月监测报告 v1') &&
      sources.includes('boundary-sample') &&
      sources.includes('rerun'),
    '能追溯到 导入、补边界、重跑 三类来源的口径变更'
  );

  const latestDiff = versionsResp.versions[versionsResp.versions.length - 1];
  assertTrue(
    latestDiff.changes && latestDiff.stats,
    '末版版本有 stats + changes 说明，不会“断口径”'
  );

  console.log();
  console.log('📍 第9步：确认 /api/pending-confirmations 和边界样本仍正常返回');
  const { data: pendResp } = await request('GET', '/api/pending-confirmations');
  assertTrue(pendResp.total > 0, `有 ${pendResp.total} 条待确认（潮位单位混写），含待确认理由`);
  const { data: boundResp } = await request('GET', '/api/boundary-samples');
  assertEq(boundResp.total, 1, '边界样本共 1 条');

  console.log();
  console.log('='.repeat(60));
  console.log('🎉 全部 HTTP 验收通过！');
  console.log('   ✅ 前端 hasOutlier=true/false 字符串传参贯通到后端');
  console.log('   ✅ 屏幕筛选数量 = 导出接口 recordCount = 导出数据量');
  console.log('   ✅ 导出的记录 ID 集合和屏幕筛选完全一致（口径一套）');
  console.log('   ✅ 版本来源可追溯，历史没有断');
  console.log('='.repeat(60));
})().catch((e) => {
  console.error('验收异常退出:', e);
  process.exit(2);
});
