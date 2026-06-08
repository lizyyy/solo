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

  // ============ 原有功能保持兼容 ============

  test('边界规则可正确读取', () => {
    const rules = system.getBoundaryRules();
    assert(rules.MAX_TEMPERATURE_DIFF === 15, '最大温差应为15°C');
    assert(rules.MIN_ZONE_HEIGHT === 0.5, '最小高度应为0.5m');
    assert(rules.WAREHOUSE_BOUNDS, '冷库边界应存在');
  });

  test('CAD图层重复导入检测生效', () => {
    const fresh = new ColdChainTemperatureZone3D();
    const layers = [{ name: '测试图层-重复', zones: [{ name: 'A区' }] }];
    const result1 = fresh.cadLayerService.importLayers(layers, '测试员');
    const result2 = fresh.cadLayerService.importLayers(layers, '测试员');
    assert(result1.success.length === 1, '第一次导入应成功');
    assert(result2.duplicates.length === 1, '重复导入应检测到重复');
    assert(result2.success.length === 0, '重复导入不应新增记录');
  });

  test('补录路线长度未重新计算时正确提示', () => {
    const fresh = new ColdChainTemperatureZone3D();
    const route = fresh.measurementService.addSupplementaryRoute({
      name: '测试路线-提示',
      points: [{ x: 0, y: 0 }, { x: 10, y: 0 }]
    }, '测试员');
    const check = fresh.measurementService.checkRouteForReview(route.id);
    assert(check.needsReview === true, '未重新计算长度时应标记为待复核');
    assert(check.message.includes('重新计算长度'), '错误提示应包含友好信息');
  });

  test('仅修改备注时历史记录正确区分', () => {
    const fresh = new ColdChainTemperatureZone3D();
    const zoneResult = fresh.temperatureZoneService.createZone({
      name: '测试温区-备注-only',
      bounds: { minX: 0, maxX: 10, minY: 0, maxY: 10, minZ: 0, maxZ: 2 },
      temperatureRange: { min: -20, max: -15 }
    }, '测试员');
    const updateResult = fresh.temperatureZoneService.updateZone(
      zoneResult.zone.id,
      { remark: '新增备注信息' },
      '测试员'
    );
    assert(updateResult.isRemarkOnly === true, '应识别为仅修改备注');
    assert(updateResult.message.includes('仅更新了备注'), '提示信息应友好');
  });

  test('3D展示点击可追溯到原始数据', () => {
    const fresh = new ColdChainTemperatureZone3D();
    const layerImport = fresh.cadLayerService.importLayers([{
      name: '溯源测试图层-new',
      zones: []
    }], '测试员');
    assert(layerImport.success.length > 0, '图层应导入成功');
    const layer = layerImport.success[0];
    const route = fresh.measurementService.addSupplementaryRoute({
      name: '溯源测试路线-new',
      points: [{ x: 0, y: 0 }, { x: 5, y: 0 }],
      linkedCADLayerId: layer.id
    }, '测试员');
    fresh.measurementService.recalculateRouteLength(route.id, '测试员');
    const zoneResult = fresh.temperatureZoneService.createZone({
      name: '溯源测试温区-new',
      layerId: layer.id,
      routeId: route.id,
      bounds: { minX: 0, maxX: 5, minY: 0, maxY: 5, minZ: 0, maxZ: 2 },
      temperatureRange: { min: 0, max: 5 }
    }, '测试员');
    assert(zoneResult.success, '温区应创建成功');
    const view = fresh.visualizationService.create3DView([zoneResult.zone.id]);
    assert(view.success, '视图应创建成功');
    const clickResult = fresh.visualizationService.clickZoneInView(view.view.id, zoneResult.zone.id);
    assert(clickResult.success === true, '点击温区应成功');
    assert(clickResult.sourceData.layer !== null, '应能追溯到CAD图层');
    assert(clickResult.sourceData.route !== null, '应能追溯到补录路线');
  });

  test('存在待复核路线时导出被阻止', () => {
    const fresh = new ColdChainTemperatureZone3D();
    const reviewRoute = fresh.measurementService.addSupplementaryRoute({
      name: '复核测试路线-new',
      points: [{ x: 0, y: 0 }, { x: 10, y: 0 }]
    }, '测试员');
    fresh.measurementService.markRouteForCustomerReview(reviewRoute.id, '测试员');
    const canExport = fresh.exportService.canExportScreenshot();
    assert(canExport.canExport === false, '有待复核路线时应不能导出');
    assert(canExport.message.includes('客户复核'), '提示信息应友好');
  });

  test('温区边界规则验证生效', () => {
    const fresh = new ColdChainTemperatureZone3D();
    const result = fresh.temperatureZoneService.createZone({
      name: '边界测试温区-new',
      bounds: { minX: -10, maxX: 10, minY: 0, maxY: 10, minZ: 0, maxZ: 2 },
      temperatureRange: { min: -30, max: 10 }
    }, '测试员');
    assert(result.success === false, '超出边界的温区应创建失败');
    assert(result.message.includes('温区数据不完整'), '错误提示应友好');
  });

  // ============ 场景一：历史记录按seq排序稳定，改前改后可正确查看 ============

  test('场景一：历史记录按seq排序稳定，改前改后可正确查看且context完整', () => {
    const fresh = new ColdChainTemperatureZone3D();
    const zoneResult = fresh.temperatureZoneService.createZone({
      name: '场景一-温区',
      bounds: { minX: 0, maxX: 10, minY: 0, maxY: 10, minZ: 0, maxZ: 2 },
      temperatureRange: { min: -20, max: -15 }
    }, '测试员');
    assert(zoneResult.success, '温区应创建成功');

    // 连续更新，测试seq稳定
    const r1 = fresh.temperatureZoneService.updateZone(zoneResult.zone.id, { remark: '备注1' }, '测试员');
    const r2 = fresh.temperatureZoneService.updateZone(zoneResult.zone.id, { remark: '备注2' }, '测试员');
    const r3 = fresh.temperatureZoneService.updateZone(zoneResult.zone.id, { remark: '备注3' }, '测试员');
    assert(r1.snapshot.seq < r2.snapshot.seq, 'r1.seq < r2.seq');
    assert(r2.snapshot.seq < r3.snapshot.seq, 'r2.seq < r3.seq');

    const history = fresh.temperatureZoneService.getZoneHistory(zoneResult.zone.id);
    assert(history.length === 4, `应4条历史（创建+3次更新），实际${history.length}`);

    // 第一条是最新的备注3
    assert(history[0].operation === 'update_remark', `最新应为update_remark，实际${history[0].operation}`);
    assert(history[0].after.remark === '备注3', `最新after.remark应为备注3，实际${history[0].after.remark}`);
    assert(history[0].diff['remark'].after === '备注3', 'diff after应为备注3');
    assert(history[0].diff['remark'].before === '备注2', 'diff before应为备注2');

    // seq严格降序
    for (let i = 1; i < history.length; i++) {
      assert(history[i - 1].seq > history[i].seq, `seq必须降序，第${i}项出错`);
    }

    // context包含：原始说法、改后值、处理原因、下一步找谁、是否复核
    const latest = history[0];
    assert(latest.context !== null, 'context不能为空');
    assert(latest.context.originalValue.remark === '备注2', 'context.originalValue.remark = 备注2');
    assert(latest.context.changedValue.remark === '备注3', 'context.changedValue.remark = 备注3');
    assert(typeof latest.context.reason === 'string' && latest.context.reason.length > 0, 'context.reason有说明');
    assert(typeof latest.context.nextStep === 'string' && latest.context.nextStep.length > 0, 'context.nextStep有说明');
    assert(typeof latest.context.reviewRequired === 'boolean', 'context.reviewRequired为布尔值');
  });

  // ============ 场景二：测距仪记录与补录路线，待复核不提前归正常 ============

  test('场景二：测距仪记录流程，客户复核完成前不提前归为正常', () => {
    const fresh = new ColdChainTemperatureZone3D();
    const layer = fresh.cadLayerService.importLayers([{
      name: '场景二-图层', zones: []
    }], '小陶').success[0];

    const measurement = fresh.measurementService.addMeasurementRecord({
      deviceId: 'DEV-001',
      points: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }]
    }, '小陶');

    const route = fresh.measurementService.addSupplementaryRoute({
      name: '场景二-补录路线',
      points: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }],
      linkedCADLayerId: layer.id
    }, '小陶');

    // 关联测距仪记录
    const linkRes = fresh.measurementService.linkRouteToMeasurement(route.id, measurement.id, '小陶');
    assert(linkRes.success, '关联测距仪成功');

    // 未重算 → needsReview
    const check1 = fresh.measurementService.checkRouteForReview(route.id);
    assert(check1.needsReview === true, '未重算应needsReview');

    fresh.measurementService.markRouteForCustomerReview(route.id, '小陶', '补录路线长度未重算');
    const rs1 = fresh.measurementService.getRouteSummary(route.id);
    assert(rs1.customerReviewStatus === 'pending', '复核状态pending');
    assert(rs1.needsCustomerReview === true, 'needsCustomerReview=true');
    assert(rs1.status === 'reviewing', 'status=reviewing，不提前归为normal');

    // 重新计算长度（客户仍未通过）→ 仍处于待复核，不提前归正常
    const recalc = fresh.measurementService.recalculateRouteLength(route.id, '小陶');
    assert(recalc.newLength === 10, `长度应为10，实际${recalc.newLength}`);
    const rs2 = fresh.measurementService.getRouteSummary(route.id);
    assert(rs2.needsCustomerReview === true, '重算后客户未通过前仍需复核');
    assert(rs2.status === 'reviewing', '仍为reviewing，不提前归normal');

    // history context完整
    const rh = fresh.measurementService.getRouteHistory(route.id);
    const reviewSnap = rh.find(h => h.operation === 'mark_for_review');
    assert(reviewSnap !== undefined, '存在mark_for_review快照');
    assert(reviewSnap.context.reviewRequired === true, 'reviewRequired=true');
    assert(reviewSnap.context.originalValue.customerReviewStatus === 'pending', '原始customerReviewStatus记录');
    assert(reviewSnap.context.changedValue.status === 'reviewing', '改成reviewing记录');
    assert(reviewSnap.context.nextStep.includes('请勿提前归为正常'), 'nextStep提示不提前归正常');

    // 客户拒绝 → 不提前归正常
    fresh.measurementService.completeCustomerReview(route.id, '客户A', false, '数据有问题需修正');
    const rs3 = fresh.measurementService.getRouteSummary(route.id);
    assert(rs3.status === 'rejected', '拒绝后status=rejected');
    assert(rs3.needsCustomerReview === true, '拒绝后仍需复核');

    // 修正后通过 → 可以归为normal
    fresh.measurementService.recalculateRouteLength(route.id, '小陶');
    fresh.measurementService.completeCustomerReview(route.id, '客户A', true, '修正后确认无误');
    const rs4 = fresh.measurementService.getRouteSummary(route.id);
    assert(rs4.status === 'normal', '通过后status=normal');
    assert(rs4.needsCustomerReview === false, '通过后无需复核');
  });

  // ============ 场景三：只改一条备注，摘要/详情/历史/同一条记录最新状态一致 ============

  test('场景三：只改备注，摘要/详情/历史/实体/导出检查均读取同一份最新数据一致', () => {
    const fresh = new ColdChainTemperatureZone3D();
    const layer = fresh.cadLayerService.importLayers([{
      name: '场景三-图层', zones: []
    }], '小陶').success[0];
    const route = fresh.measurementService.addSupplementaryRoute({
      name: '场景三-路线',
      points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
      linkedCADLayerId: layer.id
    }, '小陶');
    const zoneResult = fresh.temperatureZoneService.createZone({
      name: '场景三-温区',
      layerId: layer.id,
      routeId: route.id,
      bounds: { minX: 0, maxX: 10, minY: 0, maxY: 10, minZ: 0, maxZ: 2 },
      temperatureRange: { min: 0, max: 5 },
      remark: ''
    }, '小陶');
    assert(zoneResult.success, '温区创建成功');

    // 先完成路线和温区的复核，避免干扰
    fresh.measurementService.recalculateRouteLength(route.id, '小陶');
    fresh.measurementService.completeCustomerReview(route.id, '客户A', true, 'OK');

    // 小陶只改一条备注
    const targetRemark = '小陶备注：此处温度分布不均，建议加装传感器';
    const up = fresh.temperatureZoneService.updateZone(
      zoneResult.zone.id,
      { remark: targetRemark },
      '小陶'
    );
    assert(up.isRemarkOnly === true, '识别为仅修改备注');
    assert(up.success === true, '更新成功');

    // 同一条记录在多个读取入口下remark一致
    const summary = fresh.temperatureZoneService.getZoneSummary(zoneResult.zone.id);
    const detail = fresh.temperatureZoneService.getZoneDetail(zoneResult.zone.id);
    const byId = fresh.temperatureZoneService.getZoneById(zoneResult.zone.id);
    const historyLatest = fresh.temperatureZoneService.getZoneHistory(zoneResult.zone.id)[0];

    assert(summary.remark === targetRemark, `summary.remark错，实际${summary.remark}`);
    assert(detail.zone.remark === targetRemark, `detail.zone.remark错，实际${detail.zone.remark}`);
    assert(byId.remark === targetRemark, `byId.remark错，实际${byId.remark}`);
    assert(historyLatest.after.remark === targetRemark, `historyLatest.after.remark错，实际${historyLatest.after.remark}`);
    assert(summary.latestOperation.operation === 'update_remark', `latestOperation应为update_remark，实际${summary.latestOperation.operation}`);

    // 详情中备注变更历史也应能看到
    assert(detail.remarkDiff.length >= 1, '备注变更历史应有1条以上');
    const lastRemarkChange = detail.remarkDiff[0];
    assert(lastRemarkChange.after === targetRemark, `remarkDiff最后after应为${targetRemark}`);
    assert(lastRemarkChange.before === '', 'remarkDiff最后before应为空');

    // 3D视图点击拿到的zoneSummary也与其他入口一致
    const view = fresh.visualizationService.create3DView([zoneResult.zone.id]);
    const click = fresh.visualizationService.clickZoneInView(view.view.id, zoneResult.zone.id);
    assert(click.zoneSummary.remark === targetRemark, `3D点击zoneSummary.remark错，实际${click.zoneSummary.remark}`);

    // 导出也不会被阻挡（仅改备注，且reviewRequired=false）
    const canExp = fresh.exportService.canExportScreenshot();
    assert(canExp.canExport === true, `仅改备注+路线复核通过应可导出，实际${JSON.stringify(canExp)}`);
  });

  // ============ 额外验证：暂停续局：同系统实例反复操作历史仍连续 ============

  test('暂停续局：同一HistoryManager中历史连续、seq稳定、导出检查正确', () => {
    const fresh = new ColdChainTemperatureZone3D();
    const layer = fresh.cadLayerService.importLayers([{
      name: '暂停续局-图层', zones: []
    }], '小陶').success[0];
    const route = fresh.measurementService.addSupplementaryRoute({
      name: '暂停续局-路线',
      points: [{ x: 0, y: 0 }, { x: 5, y: 0 }],
      linkedCADLayerId: layer.id
    }, '小陶');
    const zr = fresh.temperatureZoneService.createZone({
      name: '暂停续局-温区',
      layerId: layer.id,
      routeId: route.id,
      bounds: { minX: 0, maxX: 5, minY: 0, maxY: 5, minZ: 0, maxZ: 2 },
      temperatureRange: { min: -5, max: 0 }
    }, '小陶');

    // 第一步：暂停在待复核状态
    fresh.measurementService.markRouteForCustomerReview(route.id, '小陶', '待客户确认');
    const beforeCount = fresh.measurementService.getRouteHistory(route.id).length;
    const exportCheck1 = fresh.exportService.canExportScreenshot();
    assert(exportCheck1.canExport === false, '暂停时未通过复核应不能导出');

    // 第二步：续局 - 客户通过
    fresh.measurementService.recalculateRouteLength(route.id, '小陶');
    fresh.measurementService.completeCustomerReview(route.id, '客户A', true, '已确认');
    const afterCount = fresh.measurementService.getRouteHistory(route.id).length;
    assert(afterCount > beforeCount, '续局后历史记录数应增加');

    // seq严格连续递增
    const routeHistory = fresh.measurementService.getRouteHistory(route.id);
    for (let i = 1; i < routeHistory.length; i++) {
      assert(routeHistory[i - 1].seq > routeHistory[i].seq, `续局seq不连续，索引${i}`);
    }

    // 续局后应可导出
    const exportCheck2 = fresh.exportService.canExportScreenshot();
    assert(exportCheck2.canExport === true, '续局复核通过后应可导出');
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
