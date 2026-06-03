const { ColdChainTemperatureZone3D } = require('../src/index');

function runTests() {
  console.log('='.repeat(60));
  console.log('冷链库温区三维分层系统 - 测试套件');
  console.log('='.repeat(60));

  const system = new ColdChainTemperatureZone3D();
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

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  test('边界规则可正确读取', () => {
    const rules = system.getBoundaryRules();
    assert(rules.MAX_TEMPERATURE_DIFF === 15, '最大温差应为15°C');
    assert(rules.MIN_ZONE_HEIGHT === 0.5, '最小高度应为0.5m');
    assert(rules.WAREHOUSE_BOUNDS, '冷库边界应存在');
  });

  test('CAD图层重复导入检测生效', () => {
    const layers = [{ name: '测试图层', zones: [{ name: 'A区' }] }];
    const result1 = system.cadLayerService.importLayers(layers, '测试员');
    const result2 = system.cadLayerService.importLayers(layers, '测试员');
    
    assert(result1.success.length === 1, '第一次导入应成功');
    assert(result2.duplicates.length === 1, '重复导入应检测到重复');
    assert(result2.success.length === 0, '重复导入不应新增记录');
  });

  test('补录路线长度未重新计算时正确提示', () => {
    const route = system.measurementService.addSupplementaryRoute({
      name: '测试路线',
      points: [{ x: 0, y: 0 }, { x: 10, y: 0 }]
    }, '测试员');

    const check = system.measurementService.checkRouteForReview(route.id);
    assert(check.needsReview === true, '未重新计算长度时应标记为待复核');
    assert(check.message.includes('重新计算长度'), '错误提示应包含友好信息');
  });

  test('仅修改备注时历史记录正确区分', () => {
    const zoneResult = system.temperatureZoneService.createZone({
      name: '测试温区',
      bounds: { minX: 0, maxX: 10, minY: 0, maxY: 10, minZ: 0, maxZ: 2 },
      temperatureRange: { min: -20, max: -15 }
    }, '测试员');

    const updateResult = system.temperatureZoneService.updateZone(
      zoneResult.zone.id,
      { remark: '新增备注信息' },
      '测试员'
    );

    assert(updateResult.isRemarkOnly === true, '应识别为仅修改备注');
    assert(updateResult.message.includes('仅更新了备注'), '提示信息应友好');
  });

  test('历史记录可查看改前改后差别', () => {
    const freshSystem = new ColdChainTemperatureZone3D();
    
    const zoneResult = freshSystem.temperatureZoneService.createZone({
      name: '历史测试温区',
      bounds: { minX: 0, maxX: 10, minY: 0, maxY: 10, minZ: 0, maxZ: 2 },
      temperatureRange: { min: -20, max: -15 }
    }, '测试员');
    assert(zoneResult.success, '温区应创建成功');

    freshSystem.temperatureZoneService.updateZone(
      zoneResult.zone.id,
      { remark: '测试版本对比' },
      '测试员'
    );

    const history = freshSystem.temperatureZoneService.getZoneHistory(zoneResult.zone.id);
    assert(history.length >= 2, '应至少有2条历史记录（创建+更新）');
    assert(history[0].diff && Object.keys(history[0].diff).length > 0, '历史记录应包含差异信息');
  });

  test('3D展示点击可追溯到原始数据', () => {
    const freshSystem = new ColdChainTemperatureZone3D();
    
    const layerImport = freshSystem.cadLayerService.importLayers([{
      name: '溯源测试图层',
      zones: []
    }], '测试员');
    assert(layerImport.success.length > 0, '图层应导入成功');
    const layer = layerImport.success[0];

    const route = freshSystem.measurementService.addSupplementaryRoute({
      name: '溯源测试路线',
      points: [{ x: 0, y: 0 }, { x: 5, y: 0 }],
      linkedCADLayerId: layer.id
    }, '测试员');

    freshSystem.measurementService.recalculateRouteLength(route.id, '测试员');

    const zoneResult = freshSystem.temperatureZoneService.createZone({
      name: '溯源测试温区',
      layerId: layer.id,
      routeId: route.id,
      bounds: { minX: 0, maxX: 5, minY: 0, maxY: 5, minZ: 0, maxZ: 2 },
      temperatureRange: { min: 0, max: 5 }
    }, '测试员');
    assert(zoneResult.success, '温区应创建成功');

    const view = freshSystem.visualizationService.create3DView([zoneResult.zone.id]);
    assert(view.success, '视图应创建成功');
    
    const clickResult = freshSystem.visualizationService.clickZoneInView(view.view.id, zoneResult.zone.id);
    
    assert(clickResult.success === true, '点击温区应成功');
    assert(clickResult.sourceData.layer !== null, '应能追溯到CAD图层');
    assert(clickResult.sourceData.route !== null, '应能追溯到补录路线');
  });

  test('存在待复核路线时导出被阻止', () => {
    const reviewRoute = system.measurementService.addSupplementaryRoute({
      name: '复核测试路线',
      points: [{ x: 0, y: 0 }, { x: 10, y: 0 }]
    }, '测试员');

    system.measurementService.markRouteForCustomerReview(reviewRoute.id, '测试员');

    const canExport = system.exportService.canExportScreenshot();
    assert(canExport.canExport === false, '有待复核路线时应不能导出');
    assert(canExport.message.includes('客户复核'), '提示信息应友好');
  });

  test('温区边界规则验证生效', () => {
    const result = system.temperatureZoneService.createZone({
      name: '边界测试温区',
      bounds: { minX: -10, maxX: 10, minY: 0, maxY: 10, minZ: 0, maxZ: 2 },
      temperatureRange: { min: -30, max: 10 }
    }, '测试员');

    assert(result.success === false, '超出边界的温区应创建失败');
    assert(result.message.includes('温区数据不完整'), '错误提示应友好');
  });

  console.log('\n' + '='.repeat(60));
  console.log(`测试结果: 通过 ${passed}, 失败 ${failed}`);
  console.log('='.repeat(60));

  return failed === 0;
}

if (require.main === module) {
  const success = runTests();
  process.exit(success ? 0 : 1);
}

module.exports = { runTests };
