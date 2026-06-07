const { WORKFLOW_STAGE, createBusCardPeriod } = require('../data/models');
const store = require('../data/store');

function advanceWorkflow(pointId, targetStage, context = {}) {
  const point = store.getPoint(pointId);
  if (!point) return { error: '点位不存在' };
  
  const stageOrder = [
    WORKFLOW_STAGE.PHOTO_IMPORTED,
    WORKFLOW_STAGE.BUS_CARD_SUPPLEMENTED,
    WORKFLOW_STAGE.MAP_EXPORTED
  ];
  
  const currentIdx = stageOrder.indexOf(point.workflowStage);
  const targetIdx = stageOrder.indexOf(targetStage);
  
  if (targetIdx <= currentIdx) {
    return { error: '不能回退工作流阶段，请使用版本回滚功能' };
  }
  
  const updates = { workflowStage: targetStage };
  const result = store.updatePoint(pointId, updates, {
    action: 'workflow_advance',
    reason: `工作流推进到: ${targetStage}`,
    modifiedBy: context.modifiedBy || 'system'
  });
  
  return result;
}

function supplementBusCard(pointId, busCardData, supplementedBy) {
  const point = store.getPoint(pointId);
  if (!point) return { error: '点位不存在' };
  
  const busCardPeriod = createBusCardPeriod(busCardData, pointId, supplementedBy);
  const result = store.addBusCardPeriod(pointId, busCardPeriod);
  
  if (point.workflowStage === WORKFLOW_STAGE.PHOTO_IMPORTED) {
    store.updatePoint(pointId, { workflowStage: WORKFLOW_STAGE.BUS_CARD_SUPPLEMENTED }, {
      action: 'workflow_advance',
      reason: '补充公交刷卡时段后自动推进工作流',
      modifiedBy: supplementedBy
    });
  }
  
  return result;
}

function exportMap(pointIds, exportedBy) {
  const results = [];
  
  for (const pointId of pointIds) {
    const point = store.getPoint(pointId);
    if (!point) {
      results.push({ pointId, error: '点位不存在' });
      continue;
    }
    
    if (point.boundaryStatus === 'boundary_pending') {
      results.push({
        pointId,
        pointName: point.name,
        error: '点位处于边界待复核状态，需项目经理确认后再导出',
        boundaryStatus: point.boundaryStatus,
        streets: point.streets
      });
      continue;
    }
    
    const advanceResult = advanceWorkflow(pointId, WORKFLOW_STAGE.MAP_EXPORTED, {
      modifiedBy: exportedBy
    });
    
    if (point.matchCount !== undefined) {
      store.updatePoint(pointId, { matchCount: point.matchCount + 1 }, {
        action: 'map_export',
        reason: '地图导出，匹配计数+1',
        modifiedBy: exportedBy
      });
    }
    
    results.push({
      pointId,
      pointName: point.name,
      success: true,
      mapData: generateMapExportData(point)
    });
  }
  
  return { exports: results, exportedAt: new Date().toISOString(), exportedBy };
}

function generateMapExportData(point) {
  return {
    id: point.id,
    name: point.name,
    lat: point.lat,
    lng: point.lng,
    streets: point.streets,
    assignedStreet: point.assignedStreet,
    boundaryStatus: point.boundaryStatus,
    notes: point.notes,
    matchCount: point.matchCount,
    busCardPeriods: point.busCardPeriods.map(p => ({
      period: p.period,
      passengerVolume: p.passengerVolume,
      notes: p.notes
    })),
    photoCount: point.photos.length,
    rawMaterialRefs: {
      photos: point.rawMaterials.originalPhotos.map(p => p.photoId),
      busCardData: point.rawMaterials.originalBusCardData.map(d => d.periodId)
    },
    exportedAt: new Date().toISOString()
  };
}

function reviewBoundaryPoint(pointId, reviewAction, assignedStreet, reviewedBy) {
  const point = store.getPoint(pointId);
  if (!point) return { error: '点位不存在' };
  
  const context = {
    reviewAction,
    assignedStreet,
    reviewedBy,
    action: reviewAction === 'confirm' ? 'boundary_confirm' : 'boundary_rollback',
    reason: reviewAction === 'confirm' 
      ? `项目经理确认边界点位，归属街道: ${assignedStreet}` 
      : '项目经理将边界点位回滚到待复核状态',
    modifiedBy: reviewedBy
  };
  
  const result = store.updatePoint(pointId, {}, context);
  return result;
}

module.exports = {
  advanceWorkflow,
  supplementBusCard,
  exportMap,
  reviewBoundaryPoint,
  generateMapExportData
};
