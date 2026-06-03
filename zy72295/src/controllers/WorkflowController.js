const { ColdChainTemperatureZone3D } = require('../index');

class WorkflowController {
  constructor() {
    this.system = new ColdChainTemperatureZone3D();
  }

  step1_importCADLayers(layerDataList, operator) {
    console.log(`\n=== 步骤1: 导入CAD图层 (操作人: ${operator}) ===`);
    const result = this.system.cadLayerService.importLayers(layerDataList, operator);
    
    console.log(`成功导入: ${result.success.length} 个图层`);
    if (result.duplicates.length > 0) {
      console.log(`重复跳过: ${result.duplicates.length} 个图层`);
      result.duplicates.forEach(d => console.log(`  - ${d.name}: ${d.message}`));
    }
    if (result.errors.length > 0) {
      console.log(`导入失败: ${result.errors.length} 个图层`);
    }
    
    return result;
  }

  step2_reviewMeasurements(routeIds, operator) {
    console.log(`\n=== 步骤2: 复核测距仪记录 (操作人: ${operator}) ===`);
    
    const results = [];
    for (const routeId of routeIds) {
      const check = this.system.measurementService.checkRouteForReview(routeId);
      results.push(check);
      
      if (check.needsReview) {
        console.log(`路线 ${routeId}: ${check.message}`);
        console.log('  -> 标记为待客户复核');
        this.system.measurementService.markRouteForCustomerReview(routeId, operator);
      } else if (check.valid) {
        console.log(`路线 ${routeId}: 复核通过`);
      }
    }
    
    return results;
  }

  step3_exportScreenshot(viewId, operator) {
    console.log(`\n=== 步骤3: 导出截图 (操作人: ${operator}) ===`);
    
    const checkResult = this.system.exportService.canExportScreenshot();
    if (!checkResult.canExport) {
      console.log(`导出失败: ${checkResult.message}`);
      console.log(`待复核路线: ${checkResult.pendingRoutes.map(r => r.name).join(', ')}`);
      return checkResult;
    }
    
    const result = this.system.exportService.exportScreenshot(viewId, operator);
    console.log(`导出成功: ${result.export.id}`);
    return result;
  }

  runFullDemo() {
    console.log('='.repeat(60));
    console.log('冷链库温区三维分层 - 完整工作流演示');
    console.log('='.repeat(60));

    const demoLayers = [
      { name: '冷链库-一层-冷冻区', zones: [{ name: '冷冻A区', temp: -18 }] },
      { name: '冷链库-二层-冷藏区', zones: [{ name: '冷藏B区', temp: 4 }] }
    ];

    const layerResult = this.step1_importCADLayers(demoLayers, '小陶');
    if (layerResult.success.length === 0) {
      console.log('没有成功导入的图层，演示结束');
      return;
    }

    const demoRoute = this.system.measurementService.addSupplementaryRoute({
      name: '补录路线-1',
      points: [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }],
      linkedCADLayerId: layerResult.success[0].id
    }, '小陶');

    const zoneResult = this.system.temperatureZoneService.createZone({
      name: '冷冻A区-三维',
      layerId: layerResult.success[0].id,
      routeId: demoRoute.id,
      bounds: { minX: 0, maxX: 20, minY: 0, maxY: 20, minZ: 0, maxZ: 3 },
      temperatureRange: { min: -20, max: -15 },
      color: '#0000ff'
    }, '小陶');

    if (!zoneResult.success) {
      console.log(`温区创建失败: ${zoneResult.message}`);
      return;
    }

    this.step2_reviewMeasurements([demoRoute.id], '小陶');

    const viewResult = this.system.visualizationService.create3DView([zoneResult.zone.id]);
    if (viewResult.success) {
      this.step3_exportScreenshot(viewResult.view.id, '小陶');
    }

    console.log('\n=== 工作流演示结束 ===');
    console.log('提示: 存在未复核的补录路线时，导出会被阻止');
  }
}

if (require.main === module) {
  const controller = new WorkflowController();
  controller.runFullDemo();
}

module.exports = { WorkflowController };
