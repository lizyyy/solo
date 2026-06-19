const fs = require('fs');
const path = require('path');
const { store, EXPORT_IMG_DIR } = require('../src/store/FileStore');
const { historyManager } = require('../src/utils/history');
const { cadLayerService } = require('../src/services/CADLayerService');
const { temperatureZoneService } = require('../src/services/TemperatureZoneService');
const { measurementService } = require('../src/services/MeasurementService');
const { exportService } = require('../src/services/ExportService');
const { VisualizationService } = require('../src/services/VisualizationService');

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    const result = fn();
    if (result === true || result === undefined) {
      console.log(`✅ ${name}`);
      passCount++;
    } else {
      console.log(`❌ ${name}`);
      console.log(`   原因: ${result}`);
      failCount++;
    }
  } catch (e) {
    console.log(`❌ ${name}`);
    console.log(`   异常: ${e.message}`);
    console.log(e.stack);
    failCount++;
  }
}

function assert(condition, message) {
  if (!condition) {
    return message || '断言失败';
  }
  return true;
}

async function testAsync(name, fn) {
  try {
    const result = await fn();
    if (result === true || result === undefined) {
      console.log(`✅ ${name}`);
      passCount++;
    } else {
      console.log(`❌ ${name}`);
      console.log(`   原因: ${result}`);
      failCount++;
    }
  } catch (e) {
    console.log(`❌ ${name}`);
    console.log(`   异常: ${e.message}`);
    console.log(e.stack);
    failCount++;
  }
}

console.log('='.repeat(60));
console.log('冷链库温区三维分层 - 全流程验证');
console.log('验证：持久化 + 重启恢复 + 导出真实图片 + 3D/图表回源');
console.log('='.repeat(60));
console.log();

const sampleLayerData = {
  name: '冷链库-一层-冷冻区',
  sourceFile: 'cold_storage_f1.dwg',
  zones: [
    { name: '冷冻A区-三维', color: '#3498db' }
  ]
};

const sampleZoneData = {
  name: '冷冻A区-三维',
  bounds: { minX: 10, maxX: 40, minY: 10, maxY: 35, minZ: 0, maxZ: 8 },
  temperatureRange: { min: -20, max: -15 },
  color: '#3498db',
  remark: ''
};

const sampleRouteData = {
  name: '补录路线-冷冻A区外围',
  points: [
    { x: 10, y: 10, z: 0 },
    { x: 40, y: 10, z: 0 },
    { x: 40, y: 35, z: 0 },
    { x: 10, y: 35, z: 0 }
  ]
};

const targetRemark = '小陶备注：冷冻区温度偏低，需重点关注';

async function main() {
  console.log('--- 第1步：清空数据，从零开始 ---');
  store.clearAll();
  historyManager.reloadFromStore();
  console.log('数据已清空');
  console.log();

  console.log('--- 第2步：导入CAD图层（第一次） ---');
  let layerId = null;
  let zoneId = null;
  let routeId = null;

  test('第一次导入CAD图层成功', () => {
    const result = cadLayerService.importLayers([sampleLayerData], '小陶');
    if (result.success.length !== 1) return `成功数应为1，实际${result.success.length}`;
    if (result.duplicates.length !== 0) return `重复数应为0，实际${result.duplicates.length}`;
    layerId = result.success[0].id;
    return true;
  });

  test('创建温区（关联到图层）', () => {
    const result = temperatureZoneService.createZone(
      { ...sampleZoneData, layerId, remark: '' },
      '小陶'
    );
    if (!result.success) return result.message;
    zoneId = result.zone.id;
    return true;
  });

  test('创建补录路线（关联图层）', () => {
    const route = measurementService.addSupplementaryRoute(
      { ...sampleRouteData, linkedCADLayerId: layerId },
      '小陶'
    );
    if (!route) return '创建失败';
    routeId = route.id;
    return true;
  });

  test('将温区关联到补录路线', () => {
    const result = temperatureZoneService.updateZone(
      zoneId,
      { routeId },
      '小陶'
    );
    return result.success ? true : result.message;
  });

  console.log();
  console.log('--- 第3步：重复导入同一CAD图层（验证防翻倍） ---');

  test('第二次导入相同图层被检测为重复', () => {
    const result = cadLayerService.importLayers([sampleLayerData], '小陶');
    if (result.success.length !== 0) return `成功数应为0，实际${result.success.length}`;
    if (result.duplicates.length !== 1) return `重复数应为1，实际${result.duplicates.length}`;
    return true;
  });

  test('温区总数保持1个（未翻倍）', () => {
    const zones = temperatureZoneService.getAllZones();
    if (zones.length !== 1) return `温区数应为1，实际${zones.length}`;
    return true;
  });

  test('图层总数保持1个（未翻倍）', () => {
    const layers = cadLayerService.getAllLayers();
    if (layers.length !== 1) return `图层数应为1，实际${layers.length}`;
    return true;
  });

  console.log();
  console.log('--- 第4步：标记待复核（模拟补录路线未重算） ---');

  test('标记路线为待客户复核', () => {
    const route = measurementService.markRouteForCustomerReview(routeId, '小陶', '补录路线待确认');
    if (!route) return '标记失败';
    if (route.status !== 'reviewing') return `状态应为reviewing，实际${route.status}`;
    if (route.needsCustomerReview !== true) return 'needsCustomerReview应为true';
    return true;
  });

  test('最新历史记录不是创建快照（是mark_for_review）', () => {
    const history = measurementService.getRouteHistory(routeId);
    if (history.length === 0) return '无历史记录';
    const latest = history[0];
    if (latest.operation === 'create') return '最新历史是创建快照，不对！';
    if (latest.operation !== 'mark_for_review') return `最新操作应为mark_for_review，实际${latest.operation}`;
    return true;
  });

  test('历史记录context包含"请勿提前归为正常"', () => {
    const history = measurementService.getRouteHistory(routeId);
    const latest = history[0];
    if (!latest.context?.nextStep?.includes('请勿提前归为正常')) {
      return `nextStep应包含"请勿提前归为正常"，实际：${latest.context?.nextStep}`;
    }
    return true;
  });

  console.log();
  console.log('--- 第5步：小陶只改一条备注 ---');

  const remarkBefore = temperatureZoneService.getZoneById(zoneId).remark;

  test('只改备注，返回isRemarkOnly=true', () => {
    const result = temperatureZoneService.updateZone(zoneId, { remark: targetRemark }, '小陶');
    if (!result.success) return result.message;
    if (result.isRemarkOnly !== true) return 'isRemarkOnly应为true';
    return true;
  });

  test('温区备注已更新', () => {
    const zone = temperatureZoneService.getZoneById(zoneId);
    return assert(zone.remark === targetRemark,
      `备注应为"${targetRemark}"，实际"${zone.remark}"`);
  });

  test('6个入口读取同一份最新备注（验证全链路一致）', () => {
    const z = temperatureZoneService.getZoneById(zoneId);
    const summary = temperatureZoneService.getZoneSummary(zoneId);
    const detail = temperatureZoneService.getZoneDetail(zoneId);
    const history = temperatureZoneService.getZoneHistory(zoneId);
    const viz = new VisualizationService(cadLayerService, measurementService, temperatureZoneService);
    const clickResult = viz.clickZoneInView('test', zoneId);

    const checks = [
      { name: 'byId', value: z.remark },
      { name: 'summary', value: summary.remark },
      { name: 'detail.zone', value: detail.zone.remark },
      { name: 'history[0].after', value: history[0]?.after?.remark },
      { name: 'history[0].diff.remark.after', value: history[0]?.diff?.['remark']?.after },
      { name: '3D click zoneSummary', value: clickResult.zoneSummary?.remark }
    ];

    for (const c of checks) {
      if (c.value !== targetRemark) {
        return `${c.name} 的remark不一致："${c.value}" ≠ "${targetRemark}"`;
      }
    }

    return true;
  });

  test('最新历史是update_remark，不是create', () => {
    const history = temperatureZoneService.getZoneHistory(zoneId);
    if (history.length < 2) return `历史记录不足，应有至少2条`;
    const latest = history[0];
    if (latest.operation === 'create') return '最新历史是创建快照，不对！';
    if (latest.operation !== 'update_remark') return `最新操作应为update_remark，实际${latest.operation}`;
    if (!latest.diff?.['remark']) return 'diff应包含remark字段';
    if (latest.diff['remark'].before !== remarkBefore) return 'diff before不对';
    if (latest.diff['remark'].after !== targetRemark) return 'diff after不对';
    return true;
  });

  test('canExportScreenshot被待复核路线阻挡（不提前归正常）', () => {
    const check = exportService.canExportScreenshot();
    if (check.canExport !== false) return '应被阻挡，但canExport为true';
    if (!check.message?.includes('客户复核')) return '错误提示不对';
    return true;
  });

  console.log();
  console.log('--- 第6步：保存并模拟重启（跨进程恢复验证） ---');

  const seqBeforeReload = store.getGlobalSeq();
  const zonesBeforeReload = temperatureZoneService.getAllZones().length;
  const routesBeforeReload = measurementService.getAllRoutes().length;
  const historyBeforeCount = temperatureZoneService.getZoneHistory(zoneId).length;

  test('所有数据已写入文件（存在JSON文件）', () => {
    const files = ['cadLayers.json', 'measurementRecords.json', 'supplementaryRoutes.json',
      'temperatureZones.json', 'history.json', 'exports.json', 'meta.json'];
    for (const f of files) {
      const p = path.join(process.cwd(), 'data', f);
      if (!fs.existsSync(p)) return `文件不存在: ${f}`;
    }
    return true;
  });

  test('重新加载store和historyManager（模拟重启）', () => {
    store.reload();
    historyManager.reloadFromStore();
    return true;
  });

  test('重启后seq一致', () => {
    const seqAfter = store.getGlobalSeq();
    return assert(seqAfter === seqBeforeReload,
      `重启后seq不一致：${seqAfter} ≠ ${seqBeforeReload}`);
  });

  test('重启后温区数量一致', () => {
    const after = temperatureZoneService.getAllZones().length;
    return assert(after === zonesBeforeReload, `重启后温区数：${after} ≠ ${zonesBeforeReload}`);
  });

  test('重启后路线数量一致', () => {
    const after = measurementService.getAllRoutes().length;
    return assert(after === routesBeforeReload, `重启后路线数：${after} ≠ ${routesBeforeReload}`);
  });

  test('重启后温区备注还是目标值', () => {
    const zone = temperatureZoneService.getZoneById(zoneId);
    return assert(zone.remark === targetRemark,
      `重启后备注不对：${zone.remark} ≠ ${targetRemark}`);
  });

  test('重启后路线状态还是reviewing（不提前归正常）', () => {
    const route = measurementService.getRouteById(routeId);
    return assert(route.status === 'reviewing',
      `重启后状态不对：${route.status} ≠ reviewing`);
  });

  test('重启后历史记录数量一致且seq排序稳定', () => {
    const history = temperatureZoneService.getZoneHistory(zoneId);
    if (history.length !== historyBeforeCount) return `历史记录数不一致`;
    for (let i = 1; i < history.length; i++) {
      if (history[i-1].seq <= history[i].seq) return 'seq不是严格降序';
    }
    return true;
  });

  test('重启后最新历史仍是update_remark（不是创建快照）', () => {
    const history = temperatureZoneService.getZoneHistory(zoneId);
    const latest = history[0];
    if (latest.operation === 'create') return '最新历史是创建快照，不对！';
    if (latest.operation !== 'update_remark') return `最新操作不对：${latest.operation}`;
    return true;
  });

  console.log();
  console.log('--- 第7步：重新计算长度 + 客户复核通过 ---');

  test('重新计算路线长度', () => {
    const result = measurementService.recalculateRouteLength(routeId, '小陶');
    if (!result) return '重算失败';
    if (result.newLength <= 0) return '长度应为正数';
    if (result.route.lengthRecalculated !== true) return 'lengthRecalculated应为true';
    return true;
  });

  test('重算后状态仍是reviewing（不提前归为正常）', () => {
    const route = measurementService.getRouteById(routeId);
    if (route.status !== 'reviewing') return `状态应为reviewing，实际${route.status}`;
    if (route.needsCustomerReview !== true) return 'needsCustomerReview应为true';
    return true;
  });

  test('客户复核通过后状态变为normal', () => {
    const route = measurementService.completeCustomerReview(routeId, '展陈客户', true, '确认通过');
    if (route.status !== 'normal') return `状态应为normal，实际${route.status}`;
    if (route.needsCustomerReview !== false) return 'needsCustomerReview应为false';
    if (route.customerReviewStatus !== 'approved') return 'customerReviewStatus应为approved';
    return true;
  });

  test('客户复核通过后canExportScreenshot放行', () => {
    const check = exportService.canExportScreenshot();
    return check.canExport === true ? true : `仍被阻挡：${check.message}`;
  });

  console.log();
  console.log('--- 第8步：导出截图（真实PNG图片） ---');

  let exportResult = null;

  await testAsync('导出截图并验证全部属性', async () => {
    const result = await exportService.exportScreenshot('demo-view', '小陶', { zoneIds: [zoneId] });
    if (!result.success) return result.message;
    exportResult = result;

    const exp = result.export;
    if (!exp.filePath) return '缺少filePath';
    if (!exp.relativePath) return '缺少relativePath';
    if (!exp.exportedAt) return '缺少exportedAt';
    if (!exp.exportedBy) return '缺少exportedBy';

    const p = exp.filePath;
    if (!fs.existsSync(p)) return `图片文件不存在：${p}`;
    const stat = fs.statSync(p);
    if (stat.size < 100) return `图片文件太小（${stat.size}字节），可能生成失败`;

    if (!exp.snapshot) return '缺少snapshot';
    if (!exp.snapshot.zones || exp.snapshot.zones.length === 0) return '缺少zones快照';
    const zoneSnap = exp.snapshot.zones.find(z => z.id === zoneId);
    if (!zoneSnap) return '快照中没有目标温区';
    if (zoneSnap.remark !== targetRemark) return '快照中备注不对，不是最新值';

    const exports = exportService.getExportHistory();
    if (exports.length === 0) return '导出记录为空';
    const latest = exports[0];
    if (latest.id !== exp.id) return '最新导出记录ID不对';

    return true;
  });

  await testAsync('重启后导出记录仍然存在', async () => {
    store.reload();
    historyManager.reloadFromStore();
    const exports = exportService.getExportHistory();
    if (exports.length === 0) return '重启后导出记录消失';
    if (exportResult && exports[0].id !== exportResult.export.id) return '重启后记录ID不一致';
    return true;
  });

  console.log();
  console.log('--- 第9步：3D视图和图表回源验证 ---');

  test('3D视图点击温区能获取zoneSummary（备注正确）', () => {
    const viz = new VisualizationService(cadLayerService, measurementService, temperatureZoneService);
    const result = viz.clickZoneInView('demo', zoneId);
    if (!result.success) return result.message;
    if (result.zoneSummary?.remark !== targetRemark) {
      return `3D点击zoneSummary备注不对：${result.zoneSummary?.remark} ≠ ${targetRemark}`;
    }
    return true;
  });

  test('3D视图点击能回源到CAD图层（正确图层名）', () => {
    const viz = new VisualizationService(cadLayerService, measurementService, temperatureZoneService);
    const result = viz.navigateToCADLayer('demo', zoneId);
    if (!result.success) return result.message;
    if (!result.layer) return '没有返回layer';
    if (result.layer.name !== sampleLayerData.name) {
      return `回源图层名不对：${result.layer.name} ≠ ${sampleLayerData.name}`;
    }
    if (!result.layerDetail) return '缺少layerDetail';
    return true;
  });

  test('3D视图点击能回源到补录路线（正确路线名）', () => {
    const viz = new VisualizationService(cadLayerService, measurementService, temperatureZoneService);
    const result = viz.navigateToMeasurement('demo', zoneId);
    if (!result.success) return result.message;
    if (!result.route) return '没有返回route';
    if (result.route.name !== sampleRouteData.name) {
      return `回源路线名不对：${result.route.name} ≠ ${sampleRouteData.name}`;
    }
    if (!result.routeDetail) return '缺少routeDetail';
    return true;
  });

  test('回源路线详情包含最新状态（normal）', () => {
    const viz = new VisualizationService(cadLayerService, measurementService, temperatureZoneService);
    const result = viz.navigateToMeasurement('demo', zoneId);
    if (result.routeDetail?.route?.status !== 'normal') {
      return `路线状态不对：${result.routeDetail?.route?.status}`;
    }
    return true;
  });

  test('回源路线详情包含最新历史（seq排序，最新不是create）', () => {
    const viz = new VisualizationService(cadLayerService, measurementService, temperatureZoneService);
    const result = viz.navigateToMeasurement('demo', zoneId);
    const history = result.routeDetail?.history || [];
    if (history.length < 3) return `历史记录不足3条`;
    if (history[0].operation === 'create') return '最新历史是创建快照，不对！';
    if (history[0].seq <= history[1].seq) return 'seq不是降序';
    return true;
  });

  console.log();
  console.log('--- 第10步：历史记录综合验证（创建不是最新处理结果） ---');

  test('温区历史按seq降序，最新不是create', () => {
    const history = temperatureZoneService.getZoneHistory(zoneId);
    if (history.length < 2) return '历史记录不足';
    if (history[0].operation === 'create') return '最新历史是创建快照！';
    if (history[0].seq <= history[history.length - 1].seq) return 'seq排序错误';
    return true;
  });

  test('路线历史按seq降序，最新不是create', () => {
    const history = measurementService.getRouteHistory(routeId);
    if (history.length < 3) return '历史记录不足';
    if (history[0].operation === 'create') return '最新历史是创建快照！';
    return true;
  });

  test('getLatestSnapshot返回的不是创建快照', () => {
    const latest = historyManager.getLatestSnapshot(zoneId);
    if (!latest) return '无快照';
    if (latest.operation === 'create') return 'getLatestSnapshot返回了create，不对！';
    return true;
  });

  test('所有快照context五要素完整（有改前/改后/原因/下一步/需复核）', () => {
    const history = temperatureZoneService.getZoneHistory(zoneId);
    const remarkSnap = history.find(h => h.operation === 'update_remark');
    if (!remarkSnap?.context) return 'update_remark没有context';
    if (remarkSnap.context.originalValue?.remark === undefined) return '缺少originalValue.remark';
    if (remarkSnap.context.changedValue?.remark === undefined) return '缺少changedValue.remark';
    if (!remarkSnap.context.reason) return '缺少reason';
    if (!remarkSnap.context.nextStep) return '缺少nextStep';
    if (remarkSnap.context.reviewRequired === undefined) return '缺少reviewRequired';
    return true;
  });

  console.log();
  console.log('='.repeat(60));
  console.log(`验证结果: 通过 ${passCount}, 失败 ${failCount}`);
  console.log('='.repeat(60));

  if (failCount > 0) {
    console.log('\n❌ 有测试失败');
    process.exit(1);
  } else {
    console.log('\n✅ 全部通过！');
    console.log(`\n可验证的文件位置：`);
    console.log(`  数据目录: ${path.join(process.cwd(), 'data')}`);
    console.log(`  导出图片: ${exportResult?.export?.filePath || '(未生成)'}`);
    console.log(`  Web服务: npm start 启动后访问 http://localhost:3000`);
  }
}

main().catch(e => {
  console.error('脚本执行失败:', e);
  process.exit(1);
});
