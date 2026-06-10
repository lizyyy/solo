const { loadDB } = require('../models/db');
const { MATERIAL_STATUS, STATUS_LABEL } = require('../models/material');

function computeAggregation() {
  const db = loadDB();
  const { materials, collisionPoints, meetingMinutes } = db;

  const statusCount = {};
  Object.values(MATERIAL_STATUS).forEach(s => { statusCount[s] = 0; });

  const byCategory = {};
  const byOwner = {};
  const overdue = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  materials.forEach(m => {
    if (statusCount[m.status] !== undefined) statusCount[m.status]++;
    else statusCount[m.status] = 1;

    const cat = m.category || '未分类';
    byCategory[cat] = byCategory[cat] || { total: 0, status: {} };
    byCategory[cat].total++;
    byCategory[cat].status[m.status] = (byCategory[cat].status[m.status] || 0) + 1;

    if (m.reviewer) {
      byOwner[m.reviewer] = byOwner[m.reviewer] || { total: 0, status: {} };
      byOwner[m.reviewer].total++;
      byOwner[m.reviewer].status[m.status] = (byOwner[m.reviewer].status[m.status] || 0) + 1;
    }

    const materials_with_deadline = collisionPoints.filter(c =>
      c.materialId === m.id && c.resolution
    );
  });

  const collisionStats = {
    total: collisionPoints.length,
    unresolved: collisionPoints.filter(c => !c.resolved).length,
    bySeverity: {
      critical: collisionPoints.filter(c => !c.resolved && c.severity === 'critical').length,
      warning: collisionPoints.filter(c => !c.resolved && c.severity === 'warning').length,
      info: collisionPoints.filter(c => !c.resolved && c.severity === 'info').length
    },
    linkedToMinutes: collisionPoints.filter(c => c.sourceMinutesId).length,
    hasScreenshot: collisionPoints.filter(c => c.screenshot).length,
    hasCameraView: collisionPoints.filter(c => c.cameraView).length
  };

  const minutesStats = {
    total: meetingMinutes.length,
    totalItems: meetingMinutes.reduce((s, m) => s + (m.items?.length || 0), 0),
    processedItems: meetingMinutes.reduce((s, m) =>
      s + (m.items?.filter(i => i.processed).length || 0), 0)
  };

  const anomalyMaterials = materials.filter(m => {
    const unresolved = collisionPoints.filter(c => c.materialId === m.id && !c.resolved).length;
    return unresolved > 0 || m.status === MATERIAL_STATUS.NEED_SUPPLEMENT;
  }).map(m => {
    const unresolved = collisionPoints.filter(c => c.materialId === m.id && !c.resolved);
    return {
      materialId: m.id,
      materialNo: m.materialNo,
      name: m.name,
      status: m.status,
      statusLabel: STATUS_LABEL[m.status],
      reason: [
        unresolved.length > 0
          ? `存在 ${unresolved.length} 条未解决碰撞点（${unresolved.map(c => c.type || c.severity).join('/')}）`
          : null,
        m.status === MATERIAL_STATUS.NEED_SUPPLEMENT ? '状态标记为需补材料' : null,
        m.reviewConclusion ? `复核结论：${m.reviewConclusion}` : null
      ].filter(Boolean).join('；'),
      unresolvedCollisions: unresolved.map(c => ({
        id: c.id,
        type: c.type,
        severity: c.severity,
        description: c.description,
        originalQuote: c.originalQuote,
        location: buildLocationText(c),
        sourceRef: c.sourceRef
      })),
      history: m.history ? m.history.slice(-3) : []
    };
  });

  const summary = {
    generatedAt: new Date().toISOString(),
    materialsTotal: materials.length,
    statusCount,
    statusLabels: STATUS_LABEL,
    byCategory,
    byOwner,
    collision: collisionStats,
    meetingMinutes: minutesStats,
    anomalyCount: anomalyMaterials.length,
    decisions: buildDecisions(materials, collisionPoints)
  };

  return {
    summary,
    anomalyMaterials,
    detailBreakdown: buildDetailBreakdown(summary, anomalyMaterials)
  };
}

function buildLocationText(c) {
  const parts = [];
  if (c.buildingId) parts.push(c.buildingId);
  if (c.floor) parts.push(`${c.floor}层`);
  if (c.axisX) parts.push(`轴X:${c.axisX}`);
  if (c.axisY) parts.push(`轴Y:${c.axisY}`);
  return parts.join(' / ') || '位置未记录';
}

function buildDecisions(materials, collisions) {
  const decisions = {
    release: [],
    supplement: [],
    hold: []
  };

  materials.forEach(m => {
    const unresolved = collisions.filter(c => c.materialId === m.id && !c.resolved);

    if (unresolved.length === 0 && (m.status === MATERIAL_STATUS.APPROVED || m.status === MATERIAL_STATUS.PENDING)) {
      decisions.release.push({
        materialId: m.id,
        materialNo: m.materialNo,
        name: m.name,
        category: m.category,
        reason: m.status === MATERIAL_STATUS.APPROVED
          ? '已通过复核'
          : '无未解决碰撞点，建议放行',
        reviewer: m.reviewer,
        conclusion: m.reviewConclusion
      });
    } else if (m.status === MATERIAL_STATUS.NEED_SUPPLEMENT) {
      const missingInfo = extractMissingInfo(m, unresolved);
      decisions.supplement.push({
        materialId: m.id,
        materialNo: m.materialNo,
        name: m.name,
        category: m.category,
        missingInfo,
        collisionCount: unresolved.length,
        owner: m.reviewer || unresolved[0]?.assignedTo || '',
        deadline: unresolved.find(c => c.resolution)?.resolution || ''
      });
    } else if (unresolved.length > 0) {
      decisions.hold.push({
        materialId: m.id,
        materialNo: m.materialNo,
        name: m.name,
        category: m.category,
        reason: `有 ${unresolved.length} 条碰撞点待处理`,
        collisions: unresolved.map(c => ({
          id: c.id,
          location: buildLocationText(c),
          type: c.type,
          severity: c.severity,
          originalQuote: c.originalQuote,
          sourceRef: c.sourceRef
        }))
      });
    }
  });

  return decisions;
}

function extractMissingInfo(material, collisions) {
  const info = [];
  if (!material.specification) info.push('缺少规格说明');
  if (!material.quantity || material.quantity === 0) info.push('缺少数量');
  if (!material.source) info.push('缺少来源记录');
  if (collisions.length > 0) {
    const unprocessed = collisions.filter(c => !c.resolution || !c.resolved);
    if (unprocessed.length > 0) {
      info.push(`${unprocessed.length} 条碰撞点未给出解决方案`);
    }
  }
  if (material.reviewConclusion) {
    info.push(`复核意见：${material.reviewConclusion}`);
  }
  return info;
}

function buildDetailBreakdown(summary, anomalies) {
  const breakdown = {};

  breakdown['待复核材料数'] = {
    value: summary.statusCount[MATERIAL_STATUS.PENDING] || 0,
    source: 'materials.status = pending',
    contribution: anomalies.filter(a => a.status === MATERIAL_STATUS.PENDING).map(a => a.materialNo).join('、')
  };

  breakdown['需补材料数'] = {
    value: summary.statusCount[MATERIAL_STATUS.NEED_SUPPLEMENT] || 0,
    source: 'materials.status = need_supplement',
    contribution: anomalies.filter(a => a.status === MATERIAL_STATUS.NEED_SUPPLEMENT).map(a => a.materialNo).join('、')
  };

  breakdown['未解决碰撞点(严重)'] = {
    value: summary.collision.bySeverity.critical,
    source: 'collisionPoints.severity=critical AND resolved=false',
    contribution: '见下方异常明细列表'
  };

  breakdown['未解决碰撞点(警告)'] = {
    value: summary.collision.bySeverity.warning,
    source: 'collisionPoints.severity=warning AND resolved=false',
    contribution: '见下方异常明细列表'
  };

  return breakdown;
}

module.exports = { computeAggregation, buildLocationText };
