import { STANDARD, MATERIAL_HISTORY, FLOOR_DATA } from '../data/mockData';

// 生成 CSV 内容，带口径头注释
export function generateCsv(selectedFloorId, filterType) {
  const lines = [];

  // 口径元数据（注释行）
  lines.push('# 旧楼测绘交底清单 CSV 明细导出');
  lines.push(`# 口径版本: ${STANDARD.version}`);
  lines.push(`# 口径说明: ${STANDARD.desc}`);
  lines.push(`# 导出时间: ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`);
  lines.push(`# 楼层筛选: ${selectedFloorId || '全部'}`);
  lines.push(`# 类型筛选: ${filterType || '全部'}`);

  // 获取数据
  let points = [];
  if (selectedFloorId && FLOOR_DATA[selectedFloorId]) {
    points = FLOOR_DATA[selectedFloorId].points;
  } else {
    points = Object.values(FLOOR_DATA).flatMap(f => f.points);
  }

  // 应用类型筛选
  if (filterType === 'anomaly') {
    points = points.filter(p => p.hasAnomaly);
  } else if (filterType === 'offset') {
    points = points.filter(p => p.offset?.exceeds);
  } else if (filterType === 'material') {
    points = points.filter(p => p.anomalyType === '材料不符');
  } else if (filterType === 'action') {
    points = points.filter(p => (p.actionItems?.length || 0) > 0);
  }

  lines.push(`# 记录总数: ${points.length}`);
  lines.push('');

  // 表头
  const headers = [
    '测点编号',
    '楼层',
    '空间位置',
    '模型坐标',
    '异常状态',
    '异常等级',
    '异常类型',
    '异常说明',
    '材料来源版本',
    '历史备注摘要',
    'X偏移(mm)',
    'Y偏移(mm)',
    'Z偏移(mm)',
    '欧氏距离(mm)',
    '是否超限',
    '处置动作',
    'BIM协调员',
    '算法值班人',
    '跑批ID',
    '状态',
    '口径版本',
  ];
  lines.push(headers.join(','));

  // 数据行
  points.forEach(p => {
    // 材料版本摘要
    const matVersions = (p.materials || []).map(m => {
      const hist = MATERIAL_HISTORY[m] || [];
      const cur = hist.find(h => h.isCurrent);
      return cur ? `${m}(v${cur.version})` : m;
    }).join('; ');

    // 历史备注摘要
    const remarks = (p.materials || []).flatMap(m => {
      const hist = MATERIAL_HISTORY[m] || [];
      return hist.slice(0, 3).map(h => `v${h.version}: ${h.remark || '无'} [${h.submittedBy}]`);
    }).join(' | ');

    // 处置动作
    const actions = (p.actionItems || []).join('、');

    const row = [
      p.itemNo,
      p.floorId,
      p.roomId + ' · ' + p.name,
      p.modelRef,
      p.hasAnomaly ? '是' : '否',
      p.anomalyLevel || '',
      p.anomalyType || '',
      p.anomalyNote || '',
      matVersions,
      remarks,
      p.offset?.x || 0,
      p.offset?.y || 0,
      p.offset?.z || 0,
      p.offset?.distance?.toFixed(1) || '0',
      p.offset?.exceeds ? '是' : '否',
      actions,
      p.coordinator,
      p.operator,
      p.batchId || '',
      p.status,
      STANDARD.version,
    ].map(v => {
      const s = String(v ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    }).join(',');

    lines.push(row);
  });

  return lines.join('\n');
}

// 触发下载
export function downloadCsv(content, filename) {
  // 加 BOM 以便 Excel 正确识别 UTF-8
  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `survey-checklist-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
