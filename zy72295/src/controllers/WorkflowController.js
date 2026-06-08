const { ColdChainTemperatureZone3D } = require('../index');

class WorkflowController {
  constructor() {
    this.system = new ColdChainTemperatureZone3D();
  }

  step1_importCADLayers(layerDataList, operator) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`步骤1: 导入CAD图层 (操作人: ${operator})`);
    console.log('='.repeat(60));
    const result = this.system.cadLayerService.importLayers(layerDataList, operator);

    console.log(`成功导入: ${result.success.length} 个图层`);
    if (result.duplicates.length > 0) {
      console.log(`重复跳过: ${result.duplicates.length} 个图层`);
      result.duplicates.forEach(d => console.log(`  - ${d.name}: ${d.message}`));
    }

    for (const layer of result.success) {
      const detail = this.system.cadLayerService.getLayerDetail(layer.id);
      const latest = detail.latestSnapshot;
      console.log(`  图层 "${layer.name}" 最新历史: ${latest.operation} | 原因: ${latest.context.reason} | 下一步: ${latest.context.nextStep}`);
    }

    return result;
  }

  step2_reviewMeasurements(routeIds, operator) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`步骤2: 复核测距仪记录 (操作人: ${operator})`);
    console.log('='.repeat(60));

    const results = [];
    for (const routeId of routeIds) {
      const check = this.system.measurementService.checkRouteForReview(routeId);
      results.push(check);

      if (check.needsReview) {
        console.log(`  路线 ${check.route.name}: ${check.message}`);
        console.log(`  -> 标记为待客户复核（不提前归正常，留给展陈客户复核）`);
        this.system.measurementService.markRouteForCustomerReview(routeId, operator);

        const routeSummary = this.system.measurementService.getRouteSummary(routeId);
        console.log(`  -> 状态: ${routeSummary.status} | 复核状态: ${routeSummary.customerReviewStatus}`);
        if (routeSummary.latestOperation && routeSummary.latestOperation.context) {
          console.log(`  -> 下一步: ${routeSummary.latestOperation.context.nextStep}`);
        }
      } else if (check.valid) {
        console.log(`  路线 ${check.route.name}: 复核通过`);
      }
    }

    return results;
  }

  step3_exportScreenshot(viewId, operator) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`步骤3: 导出截图 (操作人: ${operator})`);
    console.log('='.repeat(60));

    const checkResult = this.system.exportService.canExportScreenshot();
    if (!checkResult.canExport) {
      console.log(`导出失败: ${checkResult.message}`);
      if (checkResult.pendingRoutes) {
        checkResult.pendingRoutes.forEach(r => {
          console.log(`  待复核路线: ${r.name} | 状态: ${r.customerReviewStatus} | 下一步: ${r.nextStep}`);
        });
      }
      return { success: false, ...checkResult };
    }

    const result = this.system.exportService.exportScreenshot(viewId, operator);
    console.log(`导出成功: ${result.export.id}`);
    return result;
  }

  showFullRecordChain(zoneId) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`完整记录链 - 温区 ${zoneId}`);
    console.log('='.repeat(60));

    const detail = this.system.temperatureZoneService.getZoneDetail(zoneId);
    if (!detail) {
      console.log('温区不存在');
      return;
    }

    console.log(`\n[摘要]`);
    const summary = this.system.temperatureZoneService.getZoneSummary(zoneId);
    console.log(`  名称: ${summary.name} | 状态: ${summary.status} | 备注: ${summary.remark || '(空)'}`);
    console.log(`  历史记录总数: ${summary.totalHistoryCount} | 待复核: ${summary.hasPendingReview}`);
    if (summary.latestOperation) {
      console.log(`  最近操作: ${summary.latestOperation.operation} by ${summary.latestOperation.operator}`);
      if (summary.latestOperation.context) {
        console.log(`  原因: ${summary.latestOperation.context.reason}`);
        console.log(`  原始值: ${JSON.stringify(summary.latestOperation.context.originalValue)}`);
        console.log(`  改后值: ${JSON.stringify(summary.latestOperation.context.changedValue)}`);
        console.log(`  下一步: ${summary.latestOperation.context.nextStep}`);
        console.log(`  需复核: ${summary.latestOperation.context.reviewRequired}`);
      }
    }

    console.log(`\n[备注变更历史]`);
    if (detail.remarkDiff.length === 0) {
      console.log('  (无备注变更)');
    } else {
      for (const r of detail.remarkDiff) {
        console.log(`  ${r.timestamp} | ${r.operator} | 改前: "${r.before}" | 改后: "${r.after}"`);
        if (r.context) {
          console.log(`    原因: ${r.context.reason} | 下一步: ${r.context.nextStep}`);
        }
      }
    }

    console.log(`\n[关联路线详情]`);
    if (detail.zone.routeId) {
      const routeSummary = this.system.measurementService.getRouteSummary(detail.zone.routeId);
      if (routeSummary) {
        console.log(`  路线: ${routeSummary.name} | 长度: ${routeSummary.length} | 已重算: ${routeSummary.lengthRecalculated}`);
        console.log(`  状态: ${routeSummary.status} | 复核状态: ${routeSummary.customerReviewStatus}`);
        if (routeSummary.latestOperation && routeSummary.latestOperation.context) {
          console.log(`  下一步: ${routeSummary.latestOperation.context.nextStep}`);
        }
      }
    } else {
      console.log('  (无关联路线)');
    }

    console.log(`\n[完整历史快照]`);
    for (const h of detail.history) {
      const diffKeys = h.diff ? Object.keys(h.diff) : [];
      console.log(`  [seq=${h.seq}] ${h.operation} | ${h.operator} | ${h.timestamp} | diff字段: [${diffKeys.join(', ')}]`);
      if (h.context) {
        console.log(`    原因: ${h.context.reason} | 需复核: ${h.context.reviewRequired} | 下一步: ${h.context.nextStep}`);
      }
    }
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

    this.showFullRecordChain(zoneResult.zone.id);

    const viewResult = this.system.visualizationService.create3DView([zoneResult.zone.id]);
    if (viewResult.success) {
      const clickResult = this.system.visualizationService.clickZoneInView(viewResult.view.id, zoneResult.zone.id);
      console.log(`\n3D视图点击结果: needsReview=${clickResult.needsReview}`);
      if (clickResult.reviewContext) {
        console.log(`  问题: ${clickResult.reviewContext.issue}`);
        console.log(`  下一步: ${clickResult.reviewContext.nextStep}`);
      }

      this.step3_exportScreenshot(viewResult.view.id, '小陶');
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('场景: 小陶只改了一条备注');
    console.log('='.repeat(60));
    const remarkUpdate = this.system.temperatureZoneService.updateZone(
      zoneResult.zone.id,
      { remark: '小陶备注：冷冻区温度偏低，需关注' },
      '小陶'
    );
    console.log(`备注更新结果: isRemarkOnly=${remarkUpdate.isRemarkOnly}`);
    console.log(`提示: ${remarkUpdate.message}`);
    if (remarkUpdate.snapshot && remarkUpdate.snapshot.context) {
      console.log(`原始值: ${JSON.stringify(remarkUpdate.snapshot.context.originalValue)}`);
      console.log(`改后值: ${JSON.stringify(remarkUpdate.snapshot.context.changedValue)}`);
      console.log(`原因: ${remarkUpdate.snapshot.context.reason}`);
      console.log(`下一步: ${remarkUpdate.snapshot.context.nextStep}`);
    }

    this.showFullRecordChain(zoneResult.zone.id);

    console.log(`\n${'='.repeat(60)}`);
    console.log('场景: 客户复核通过后继续导出');
    console.log('='.repeat(60));
    this.system.measurementService.recalculateRouteLength(demoRoute.id, '小陶');
    this.system.measurementService.completeCustomerReview(demoRoute.id, '展陈客户', true, '数据确认无误');

    const routeSummary = this.system.measurementService.getRouteSummary(demoRoute.id);
    console.log(`路线状态: ${routeSummary.status} | 复核状态: ${routeSummary.customerReviewStatus}`);
    if (routeSummary.latestOperation && routeSummary.latestOperation.context) {
      console.log(`下一步: ${routeSummary.latestOperation.context.nextStep}`);
    }

    if (viewResult.success) {
      this.step3_exportScreenshot(viewResult.view.id, '小陶');
    }

    this.showFullRecordChain(zoneResult.zone.id);

    console.log('\n=== 工作流演示结束 ===');
  }
}

if (require.main === module) {
  const controller = new WorkflowController();
  controller.runFullDemo();
}

module.exports = { WorkflowController };
