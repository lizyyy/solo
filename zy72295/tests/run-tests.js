const { store } = require('../src/store/FileStore');
const { historyManager } = require('../src/utils/history');
const { cadLayerService } = require('../src/services/CADLayerService');
const { measurementService } = require('../src/services/MeasurementService');
const { temperatureZoneService } = require('../src/services/TemperatureZoneService');
const { visualizationService: vizService } = require('../src/services/VisualizationService');
const { exportService } = require('../src/services/ExportService');
const { VisualizationService } = require('../src/services/VisualizationService');
const { getUserFriendlyError } = require('../src/utils/errors');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${name}: ${error.message}`);
    failed++;
  }
}

function asyncTest(name, fn) {
  return new Promise((resolve) => {
    fn().then(() => {
      console.log(`✅ ${name}`);
      passed++;
      resolve();
    }).catch((error) => {
      console.log(`❌ ${name}: ${error.message}`);
      failed++;
      resolve();
    });
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function freshStart() {
  store.clearAll();
  historyManager.reloadFromStore();
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('冷链库温区三维分层系统 - 测试套件');
  console.log('='.repeat(60));

  // ============ 原有功能保持兼容 ============

  freshStart();

  test('边界规则可正确读取', () => {
    const rules = temperatureZoneService.getBoundaryRules();
    assert(rules.MAX_TEMPERATURE_DIFF === 15, '最大温差应为15°C');
    assert(rules.MIN_ZONE_HEIGHT === 0.5, '最小高度应为0.5m');
    assert(rules.WAREHOUSE_BOUNDS, '冷库边界应存在');
  });

  test('CAD图层重复导入检测生效', () => {
    freshStart();
    const layers = [{ name: '测试图层-重复', zones: [{ name: 'A区' }] }];
    const result1 = cadLayerService.importLayers(layers, '测试员');
    const result2 = cadLayerService.importLayers(layers, '测试员');
    assert(result1.success.length === 1, '第一次导入应成功');
    assert(result2.duplicates.length === 1, '重复导入应检测到重复');
    assert(result2.success.length === 0, '重复导入不应新增记录');
  });

  test('补录路线长度未重新计算时正确提示', () => {
    freshStart();
    const route = measurementService.addSupplementaryRoute({
      name: '测试路线-提示',
      points: [{ x: 0, y: 0 }, { x: 10, y: 0 }]
    }, '测试员');
    const check = measurementService.checkRouteForReview(route.id);
    assert(check.needsReview === true, '应标记为需要复核');
    assert(check.message.includes('补录路线未重新计算长度'), '提示信息应友好');
    assert(!check.message.includes('lengthRecalculated'), '提示信息不该有内部字段名');
  });

  test('仅修改备注时历史记录正确区分', () => {
    freshStart();
    const zoneResult = temperatureZoneService.createZone({
      name: '测试温区-备注',
      bounds: { minX: 0, maxX: 10, minY: 0, maxY: 10, minZ: 0, maxZ: 5 },
      temperatureRange: { min: 0, max: 10 },
      remark: '原备注'
    }, '测试员');

    const updateResult = temperatureZoneService.updateZone(
      zoneResult.zone.id,
      { remark: '新备注' },
      '测试员'
    );

    assert(updateResult.isRemarkOnly === true, '应标记为仅修改备注');
    assert(updateResult.message && updateResult.message.includes('仅更新了备注'), '应有人话提示');

    const history = temperatureZoneService.getZoneHistory(zoneResult.zone.id);
    const latest = history[0];
    assert(latest.operation === 'update_remark', '操作类型应为update_remark');
    assert(latest.diff['remark'].before === '原备注', 'diff before正确');
    assert(latest.diff['remark'].after === '新备注', 'diff after正确');
  });

  test('3D展示点击可追溯到原始数据', () => {
    freshStart();
    const layer = cadLayerService.importLayers([{
      name: '测试图层-溯源',
      zones: []
    }], '测试员').success[0];

    const zone = temperatureZoneService.createZone({
      name: '测试温区-溯源',
      layerId: layer.id,
      bounds: { minX: 0, maxX: 10, minY: 0, maxY: 10, minZ: 0, maxZ: 5 },
      temperatureRange: { min: 0, max: 10 }
    }, '测试员').zone;

    const viz = new VisualizationService(cadLayerService, measurementService, temperatureZoneService);
    viz.create3DView([zone.id], '3d');

    const clickResult = viz.clickZoneInView('view_test', zone.id);
    assert(clickResult.success === true, '点击应成功');
    assert(clickResult.sourceData, '应有溯源数据');
    assert(clickResult.sourceData.layer, '应能追溯到CAD图层');
    assert(clickResult.sourceData.layer.name === '测试图层-溯源', '图层名正确');

    const navResult = viz.navigateToCADLayer('view_test', zone.id);
    assert(navResult.success === true, '导航到图层应成功');
    assert(navResult.layer.name === '测试图层-溯源', '导航图层名正确');
  });

  test('存在待复核路线时导出被阻止', () => {
    freshStart();
    measurementService.addSupplementaryRoute({
      name: '待复核路线',
      points: [{ x: 0, y: 0 }, { x: 10, y: 0 }]
    }, '测试员');

    const route = measurementService.getAllRoutes()[0];
    measurementService.markRouteForCustomerReview(route.id, '测试员');

    const canExport = exportService.canExportScreenshot();
    assert(canExport.canExport === false, '应阻止导出');
    assert(canExport.message.includes('客户复核'), '提示含有人话提示');
    assert(canExport.pendingRoutes.length > 0, '有待复核路线列表');
  });

  test('温区边界规则验证生效', () => {
    freshStart();
    const result = temperatureZoneService.createZone({
      name: '违规温区',
      bounds: { minX: -10, maxX: 10, minY: 0, maxY: 10, minZ: 0, maxZ: 5 },
      temperatureRange: { min: 0, max: 10 }
    }, '测试员');
    assert(result.success === false, '应创建失败');
    assert(result.message && result.message.length > 0, '错误提示应存在');
    assert(!result.message.includes('bounds'), '不暴露内部字段');
    assert(result.errors && result.errors.some(e => e.includes('冷链库')), '错误详情包含冷链库提示');
  });

  // ============ 场景一：seq稳定排序 ============

  test('场景一：历史记录按seq排序稳定，改前改后可正确查看且context完整', () => {
    freshStart();

    const zone = temperatureZoneService.createZone({
      name: '排序测试',
      bounds: { minX: 0, maxX: 5, minY: 0, maxY: 5, minZ: 0, maxZ: 3 },
      temperatureRange: { min: 0, max: 5 }
    }, '测试员').zone;

    temperatureZoneService.updateZone(zone.id, { remark: '备注1' }, '测试员');
    temperatureZoneService.updateZone(zone.id, { remark: '备注2' }, '测试员');
    temperatureZoneService.updateZone(zone.id, { remark: '备注3' }, '测试员');

    const history = temperatureZoneService.getZoneHistory(zone.id);
    assert(history.length === 4, '应有4条历史记录');

    for (let i = 1; i < history.length; i++) {
      assert(history[i - 1].seq > history[i].seq, `第${i}条seq应递减`);
    }

    assert(history[0].operation === 'update_remark', '最新应为update_remark');
    assert(history[0].diff['remark'].after === '备注3', '最新remark应为备注3');

    assert(history[0].context, '应有context');
    assert(history[0].context.reason, '应有reason');
    assert(history[0].context.nextStep, '应有nextStep');
    assert(history[0].context.originalValue, '应有originalValue');
    assert(history[0].context.changedValue, '应有changedValue');
    assert(history[0].context.reviewRequired !== undefined, '应有reviewRequired');
  });

  // ============ 场景二：测距仪流程 ============

  test('场景二：测距仪记录流程，客户复核完成前不提前归为正常', () => {
    freshStart();

    const route = measurementService.addSupplementaryRoute({
      name: '测试路线',
      points: [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }]
    }, '小陶');

    measurementService.markRouteForCustomerReview(route.id, '小陶');

    let route1 = measurementService.getRouteById(route.id);
    assert(route1.status === 'reviewing', '状态应为reviewing');
    assert(route1.needsCustomerReview === true, 'needsCustomerReview应为true');

    measurementService.recalculateRouteLength(route.id, '小陶');
    const route2 = measurementService.getRouteById(route.id);
    assert(route2.status === 'reviewing', '重算后仍为reviewing，不提前归normal');
    assert(route2.needsCustomerReview === true, 'needsCustomerReview仍为true');

    measurementService.completeCustomerReview(route.id, '客户', false, '拒绝');
    const route3 = measurementService.getRouteById(route.id);
    assert(route3.status === 'rejected', '拒绝后状态为rejected');
    assert(route3.needsCustomerReview === true, '拒绝后仍需复核');

    measurementService.completeCustomerReview(route.id, '客户', true, '通过');
    const route4 = measurementService.getRouteById(route.id);
    assert(route4.status === 'normal', '通过后状态为normal');
    assert(route4.needsCustomerReview === false, '通过后无需复核');

    const history = measurementService.getRouteHistory(route.id);
    const latestContext = history[0].context;
    assert(latestContext.nextStep, '最新历史有nextStep');
  });

  // ============ 场景三：只改备注全链路一致 ============

  test('场景三：只改备注，摘要/详情/历史/实体/导出检查均读取同一份最新数据一致', () => {
    freshStart();

    const targetRemark = '小陶测试备注：冷链库温度偏低';
    const zone = temperatureZoneService.createZone({
      name: '全链路测试温区',
      bounds: { minX: 5, maxX: 15, minY: 5, maxY: 15, minZ: 0, maxZ: 6 },
      temperatureRange: { min: -18, max: -10 },
      color: '#3498db',
      remark: ''
    }, '小陶').zone;

    temperatureZoneService.updateZone(zone.id, { remark: targetRemark }, '小陶');

    const byId = temperatureZoneService.getZoneById(zone.id);
    assert(byId.remark === targetRemark, 'byId备注一致');

    const summary = temperatureZoneService.getZoneSummary(zone.id);
    assert(summary.remark === targetRemark, 'summary备注一致');

    const detail = temperatureZoneService.getZoneDetail(zone.id);
    assert(detail.zone.remark === targetRemark, 'detail.zone备注一致');
    assert(detail.remarkDiff.length >= 1, '有备注变更记录');
    assert(detail.remarkDiff[0].after === targetRemark, '最新备注diff最新值一致');

    const history = temperatureZoneService.getZoneHistory(zone.id);
    assert(history[0].after.remark === targetRemark, 'history[0].after备注一致');
    assert(history[0].diff['remark'].after === targetRemark, 'history[0].diff备注一致');

    const viz = new VisualizationService(cadLayerService, measurementService, temperatureZoneService);
    const click = viz.clickZoneInView('test', zone.id);
    assert(click.zoneSummary.remark === targetRemark, '3D点击zoneSummary备注一致');

    const canExport = exportService.canExportScreenshot();
    assert(canExport.canExport === true, '仅改备注不阻挡导出');
  });

  // ============ 暂停续局 ============

  test('暂停续局：同一HistoryManager中历史连续、seq稳定、导出检查正确', () => {
    freshStart();

    const route = measurementService.addSupplementaryRoute({
      name: '续局测试路线',
      points: [{ x: 0, y: 0 }, { x: 5, y: 5 }]
    }, '测试员');

    const zone = temperatureZoneService.createZone({
      name: '续局测试温区',
      bounds: { minX: 0, maxX: 5, minY: 0, maxY: 5, minZ: 0, maxZ: 3 },
      temperatureRange: { min: 0, max: 5 },
      routeId: route.id
    }, '测试员').zone;

    const seqBefore = store.getGlobalSeq();
    const historyCountBefore = temperatureZoneService.getZoneHistory(zone.id).length;

    store.reload();
    historyManager.reloadFromStore();

    const seqAfter = store.getGlobalSeq();
    assert(seqAfter === seqBefore, '重启后seq一致');

    const historyCountAfter = temperatureZoneService.getZoneHistory(zone.id).length;
    assert(historyCountAfter === historyCountBefore, '重启后历史数量一致');

    const routeAfter = measurementService.getRouteById(route.id);
    assert(routeAfter.name === '续局测试路线', '重启后路线数据一致');

    const canExportBefore = exportService.canExportScreenshot().canExport;
    measurementService.markRouteForCustomerReview(route.id, '测试员');
    const canExportAfter = exportService.canExportScreenshot().canExport;
    assert(canExportBefore === true, '标记前可导出');
    assert(canExportAfter === false, '标记后阻挡导出');

    store.reload();
    historyManager.reloadFromStore();
    const canExportAfterReload = exportService.canExportScreenshot().canExport;
    assert(canExportAfterReload === false, '重启后仍阻挡导出');
  });

  // ============ 持久化验证 ============

  await asyncTest('持久化：导出图片真实存在且可打开', async () => {
    freshStart();

    temperatureZoneService.createZone({
      name: '导出测试温区',
      bounds: { minX: 10, maxX: 20, minY: 10, maxY: 20, minZ: 0, maxZ: 5 },
      temperatureRange: { min: -5, max: 5 },
      color: '#27ae60'
    }, '测试员');

    const result = await exportService.exportScreenshot('test-view', '测试员');
    assert(result.success === true, '导出成功');
    assert(result.export.filePath, '有文件路径');
    assert(result.export.fileSize > 100, '图片大小合理');

    const fs = require('fs');
    assert(fs.existsSync(result.export.filePath), '文件真实存在');

    const exports = exportService.getExportHistory();
    assert(exports.length >= 1, '导出记录存在');

    store.reload();
    historyManager.reloadFromStore();
    const exportsAfter = exportService.getExportHistory();
    assert(exportsAfter.length >= 1, '重启后导出记录存在');
  });

  console.log();
  console.log('='.repeat(60));
  console.log(`测试结果: 通过 ${passed}, 失败 ${failed}`);
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };
