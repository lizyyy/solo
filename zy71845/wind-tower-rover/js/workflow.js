import {
  putWorkflow, getAllWorkflow, putPoint, getPoint,
  getAllPoints, getAllModels, getAllInspections,
  getInspectionsByPoint, getFullEvidenceChain, exportAllData
} from './store.js';

export async function recordImport(type, count, details = '') {
  await putWorkflow({
    id: `WF_IMP_${type}_${Date.now()}`,
    pointId: 'BATCH',
    action: 'import',
    timestamp: new Date().toISOString(),
    operator: 'user',
    reason: `导入${type}数据 ${count} 条${details ? '：' + details : ''}`,
    nextStep: '请在复核页执行自动判断',
    details: { type, count }
  });
}

export async function recordJudge(results) {
  const flagged = results.filter(r => !r.flags.includes('ok'));
  await putWorkflow({
    id: `WF_JUDGE_${Date.now()}`,
    pointId: 'ALL',
    action: 'auto_judge',
    timestamp: new Date().toISOString(),
    operator: 'system',
    reason: `自动判断完成：${results.length} 个点位检查完毕，${flagged.length} 个存在标记`,
    nextStep: flagged.length > 0
      ? `请在复核页查看 ${flagged.length} 个标记点位的判断理由和下一步操作`
      : '所有点位正常，可进行导出',
    details: {
      total: results.length,
      flagged: flagged.length,
      flagTypes: [...new Set(flagged.flatMap(r => r.flags))]
    }
  });
}

export async function recordCorrection(pointId, changes, reason, nextStep) {
  if (!reason || reason.trim() === '') {
    throw new Error('修正说明不能为空');
  }
  await putWorkflow({
    id: `WF_CORR_${pointId}_${Date.now()}`,
    pointId,
    action: 'correct',
    timestamp: new Date().toISOString(),
    operator: 'user',
    reason: `修正点位 ${pointId}：${reason}`,
    nextStep: nextStep || '修正已保存，可在历史页查看变更记录',
    details: { changes }
  });
}

export async function recordConfirm(pointId, status, reason) {
  if (!reason || reason.trim() === '') {
    throw new Error('确认说明不能为空');
  }
  const point = await getPoint(pointId);
  if (!point) throw new Error(`点位 ${pointId} 不存在`);

  const updatedPoint = {
    ...point,
    confirmStatus: status,
    confirmTime: new Date().toISOString(),
    confirmReason: reason
  };
  await putPoint(updatedPoint);

  const statusText = status === 'confirmed' ? '已确认' : status === 'rejected' ? '已驳回' : '待确认';
  await putWorkflow({
    id: `WF_CONF_${pointId}_${Date.now()}`,
    pointId,
    action: 'manual_confirm',
    timestamp: new Date().toISOString(),
    operator: 'user',
    reason: `人工${statusText}点位 ${pointId}：${reason}`,
    nextStep: status === 'confirmed'
      ? '点位已确认，可继续处理下一个标记点位'
      : status === 'rejected'
        ? '已驳回，请在修正页修改点位信息后重新判断'
        : '状态已更新',
    details: { status, previousStatus: point.confirmStatus }
  });

  return updatedPoint;
}

export async function recordExport(format, count) {
  await putWorkflow({
    id: `WF_EXP_${Date.now()}`,
    pointId: 'ALL',
    action: 'export',
    timestamp: new Date().toISOString(),
    operator: 'user',
    reason: `导出${format}格式数据，共 ${count} 条记录`,
    nextStep: '数据已导出到本地文件',
    details: { format, count }
  });
}

export async function getFilteredHistory(filters = {}) {
  let records = await getAllWorkflow();

  if (filters.action && filters.action !== 'all') {
    records = records.filter(r => r.action === filters.action);
  }

  if (filters.search && filters.search.trim()) {
    const search = filters.search.trim().toLowerCase();
    records = records.filter(r =>
      (r.pointId && r.pointId.toLowerCase().includes(search)) ||
      (r.reason && r.reason.toLowerCase().includes(search)) ||
      (r.nextStep && r.nextStep.toLowerCase().includes(search))
    );
  }

  records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return records;
}

export async function exportJSON(includePhotos = true, includeHistory = true) {
  const data = await exportAllData({ includePhotos, includeHistory });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `风电场塔筒漫游_证据链_${formatDate()}.json`);
  await recordExport('JSON', data.points.length);
  return data;
}

export async function exportCSV() {
  const points = await getAllPoints();
  const models = await getAllModels();
  const modelMap = new Map(models.map(m => [m.id, m]));

  const header = '点位ID,点位名称,坐标X,坐标Z,高程,关联模型,确认状态,标记,判断理由,下一步操作,判断时间\n';
  const rows = points.map(p => {
    const model = p.linkedModelId ? modelMap.get(p.linkedModelId) : null;
    const modelName = model ? model.name : '无';
    const flags = (p.flags || []).join(';');
    const reasons = (p.judgeReasons || []).join(';');
    const nextSteps = (p.judgeNextSteps || []).join(';');
    const confirmText = p.confirmStatus === 'confirmed' ? '已确认' : p.confirmStatus === 'rejected' ? '已驳回' : '待确认';
    return `${p.id},${p.name},${p.x},${p.z},${p.elevation},${modelName},${confirmText},"${flags}","${reasons}","${nextSteps}",${p.judgeTime || ''}`;
  }).join('\n');

  const csv = '\uFEFF' + header + rows;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `风电场塔筒漫游_点位汇总_${formatDate()}.csv`);
  await recordExport('CSV', points.length);
}

export async function exportReport() {
  const points = await getAllPoints();
  const models = await getAllModels();
  const inspections = await getAllInspections();
  const workflow = await getAllWorkflow();
  const modelMap = new Map(models.map(m => [m.id, m]));

  const lines = [];
  lines.push('========================================');
  lines.push('  风电场塔筒漫游 - 判断报告');
  lines.push(`  生成时间: ${new Date().toLocaleString('zh-CN')}`);
  lines.push('========================================');
  lines.push('');

  lines.push(`【概况】`);
  lines.push(`  总点位数: ${points.length}`);
  lines.push(`  模型数量: ${models.length}`);
  lines.push(`  巡检记录: ${inspections.length}`);
  lines.push(`  操作记录: ${workflow.length}`);
  lines.push('');

  const flagged = points.filter(p => p.flags && !p.flags.includes('ok'));
  const ok = points.filter(p => p.flags && p.flags.includes('ok') && p.flags.length === 1);
  lines.push(`【判断汇总】`);
  lines.push(`  正常点位: ${ok.length}`);
  lines.push(`  标记点位: ${flagged.length}`);
  lines.push('');

  if (flagged.length > 0) {
    lines.push('【标记详情】');
    lines.push('');
    for (const p of flagged) {
      lines.push(`  ◆ ${p.name} (${p.id})`);
      lines.push(`    坐标: (${p.x}, ${p.z}), 高程: ${p.elevation}`);
      const model = p.linkedModelId ? modelMap.get(p.linkedModelId) : null;
      lines.push(`    模型: ${model ? model.name : '未关联'}`);
      lines.push(`    确认状态: ${p.confirmStatus === 'confirmed' ? '已确认' : p.confirmStatus === 'rejected' ? '已驳回' : '待确认'}`);
      lines.push(`    标记: ${(p.flags || []).join(', ')}`);
      if (p.judgeReasons) {
        for (const r of p.judgeReasons) {
          lines.push(`    判断理由: ${r}`);
        }
      }
      if (p.judgeNextSteps) {
        for (const s of p.judgeNextSteps) {
          lines.push(`    下一步: ${s}`);
        }
      }
      lines.push('');
    }
  }

  lines.push('【建议操作顺序】');
  const priorityOrder = ['overlap', 'no-model', 'duplicate-photo', 'no-inspection', 'boundary'];
  const actionMap = {
    overlap: '处理点位重叠',
    'no-model': '分配模型清单',
    'duplicate-photo': '核实重复照片',
    'no-inspection': '安排现场巡检',
    boundary: '确认边界点位'
  };
  for (const flagType of priorityOrder) {
    const pts = flagged.filter(p => p.flags && p.flags.includes(flagType));
    if (pts.length > 0) {
      lines.push(`  ${actionMap[flagType]}: ${pts.map(p => p.name).join(', ')}`);
    }
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, `风电场塔筒漫游_判断报告_${formatDate()}.txt`);
  await recordExport('Report', points.length);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatDate() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
}
