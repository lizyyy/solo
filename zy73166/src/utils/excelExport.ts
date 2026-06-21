import * as XLSX from 'xlsx';
import type {
  Material, FilterCriteria, FittingResult, JumpCause,
  TimelineEvent, ExportRecord, HandoverNote,
} from '../types';
import { formatEquation, computeDataHash } from './fitting';

export interface ExportBundle {
  materials: Material[];
  filteredMaterials: Material[];
  filter: FilterCriteria;
  filterHistory: FilterCriteria[];
  fittingResults: Record<string, FittingResult>;
  jumpCauses: JumpCause[];
  timeline: TimelineEvent[];
  previousExports: ExportRecord[];
  handoverNote: HandoverNote;
  operator: string;
  generatedAt: number;
}

interface Snapshot {
  materialCount: number;
  totalPoints: number;
  rSquaredValues: Record<string, number>;
  boundaryWarnings: string[];
}

function buildScreenSnapshot(filteredMaterials: Material[], fittingResults: Record<string, FittingResult>, filter: FilterCriteria): Snapshot {
  const rSquaredValues: Record<string, number> = {};
  const boundaryWarnings: string[] = [];
  let totalPoints = 0;
  for (const m of filteredMaterials) {
    const r = fittingResults[m.id];
    if (r) {
      rSquaredValues[m.id] = r.rSquared;
      totalPoints += m.dataPoints.length;
      if (r.boundaryWarning) {
        boundaryWarnings.push(
          `${m.id}(${m.currentName}): 边界样本不足(${r.boundarySampleCount}份，要求${filter.boundarySampleMinCount})`,
        );
      }
    }
    if (m.status === 'missing') {
      boundaryWarnings.push(`${m.id}(${m.currentName}): 材料状态为"缺材料"`);
    }
  }
  return { materialCount: filteredMaterials.length, totalPoints, rSquaredValues, boundaryWarnings };
}

type Row = unknown[];
function ws_from_rows(rows: Row[]): XLSX.WorkSheet {
  return XLSX.utils.aoa_to_sheet(rows as (string | number)[][]);
}

function set_col_widths(ws: XLSX.WorkSheet, widths: number[]) {
  ws['!cols'] = widths.map(w => ({ wch: w }));
}

function statusLabel(s: Material['status']): string {
  switch (s) {
    case 'pending': return '待处理';
    case 'processed': return '已处理';
    case 'missing': return '缺材料';
    case 'reviewed': return '已复核';
  }
}

function jumpTypeLabel(t: JumpCause['type']): string {
  switch (t) {
    case 'threshold': return '阈值/拟合参数变更';
    case 'unit': return '单位不一致/存疑';
    case 'name_mismatch': return '材料名称前后不一致';
  }
}

export function buildReportWorkbook(bundle: ExportBundle): { wb: XLSX.WorkBook; snapshot: Snapshot; hash: string; fileName: string } {
  const {
    filteredMaterials, filter, fittingResults, jumpCauses,
    timeline, previousExports, handoverNote, operator, generatedAt,
  } = bundle;

  const snapshot = buildScreenSnapshot(filteredMaterials, fittingResults, filter);
  const hash = computeDataHash(snapshot);
  const dateStr = new Date(generatedAt).toISOString().slice(0, 10).replace(/-/g, '');
  const fileName = `boundary_review_${dateStr}_${hash}.xlsx`;

  const wb = XLSX.utils.book_new();
  const genAtStr = new Date(generatedAt).toLocaleString('zh-CN');

  // ---------- Sheet 1: 数据校验 ----------
  const verifyRows: Row[] = [
    ['【曲线拟合边界复核 · 数据校验页】', ''],
    ['用途说明', '本页用于复核：拿到的导出文件是否与当时屏幕上看到的数字完全一致。'],
    ['操作步骤', '1. 回到系统同一筛选口径；2. 对比"屏幕快照区"与下方"当期快照"的数字；3. 或重新导出一份，比较两个文件的校验哈希。'],
    [],
    ['--- 文件元信息 ---', ''],
    ['文件名', fileName],
    ['校验哈希 (SHA-like)', hash],
    ['生成时间', genAtStr],
    ['操作人', operator],
    [],
    ['--- 当期屏幕快照（导出当时截下的数字） ---', ''],
    ['材料数量', snapshot.materialCount],
    ['数据点总数', snapshot.totalPoints],
    ['边界警告数量', snapshot.boundaryWarnings.length],
    ['筛选口径ID', filter.id],
    ['筛选口径名称', filter.name],
    ['筛选口径创建人', filter.createdBy],
    ['拟合度', filter.fittingDegree === 1 ? '线性(1次)' : `${filter.fittingDegree}次多项式`],
    ['边界最少样本数', filter.boundarySampleMinCount],
    ['边界阈值', filter.boundaryThreshold],
    ['是否排除离群点', filter.excludeOutliers ? '是' : '否'],
    [],
    ['--- 各材料 R² 快照 ---', ''],
    ['材料ID', '材料名称', 'R²(导出时)'],
    ...filteredMaterials.map(m => [m.id, m.currentName, snapshot.rSquaredValues[m.id] ?? 'N/A']),
    [],
    ['--- 边界警告清单（导出当时） ---', ''],
    ['序号', '警告内容'],
    ...snapshot.boundaryWarnings.map((w, i) => [i + 1, w]),
    snapshot.boundaryWarnings.length === 0 ? [['-', '无']] : [],
    [],
    ['--- 如何使用本页做复核 ---', ''],
    ['第一步', '在系统里用同一份筛选口径，查看顶部屏幕快照面板的哈希值，与本页"校验哈希"对比。相同 = 屏幕数字未分家。'],
    ['第二步', '打开 Sheet2"报告摘要"看总览；有异常先看 Sheet4"异常跳变分析"。'],
    ['第三步', '看不懂异常说法 → 查 Sheet5"学生草稿溯源"，里面有学生原始文字。'],
    ['第四步', '缺哪些材料、处理状态如何 → Sheet2 底部 + Sheet7 交接指引。'],
    ['第五步', '要再导一份 → 回到系统顶部"导出报告（绑定屏幕快照）"按钮即可。'],
  ];
  const wsVerify = ws_from_rows(verifyRows);
  set_col_widths(wsVerify, [30, 90]);
  // 合并标题行
  wsVerify['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 1 } },
    { s: { r: 8, c: 0 }, e: { r: 8, c: 1 } },
    { s: { r: 19, c: 0 }, e: { r: 19, c: 1 } },
    { s: { r: 24, c: 0 }, e: { r: 24, c: 1 } },
    { s: { r: 28, c: 0 }, e: { r: 28, c: 1 } },
  ];
  XLSX.utils.book_append_sheet(wb, wsVerify, '1.数据校验');

  // ---------- Sheet 2: 报告摘要 ----------
  const avgR2 = filteredMaterials.length > 0
    ? Object.values(snapshot.rSquaredValues).reduce((a, b) => a + b, 0) / filteredMaterials.length
    : 0;
  const statusCounts: Record<string, number> = {};
  for (const m of filteredMaterials) {
    statusCounts[m.status] = (statusCounts[m.status] || 0) + 1;
  }
  const summaryRows: Row[] = [
    ['【曲线拟合边界复核 · 报告摘要】', '', '', '', ''],
    ['生成时间', genAtStr, '', '操作人', operator],
    ['文件名', fileName, '', '校验哈希', hash],
    [],
    ['--- 总体统计 ---', '', '', '', ''],
    ['材料总数', snapshot.materialCount, '', '数据点总数', snapshot.totalPoints],
    ['平均拟合优度 R²', Number(avgR2.toFixed(6)), '', '边界警告数', snapshot.boundaryWarnings.length],
    ['跳变风险数', jumpCauses.length, '', '', ''],
    [],
    ['--- 处理状态分布 ---', '', '', '', ''],
    ['已复核', statusCounts['reviewed'] || 0, '', '已处理', statusCounts['processed'] || 0],
    ['待处理', statusCounts['pending'] || 0, '', '缺材料', statusCounts['missing'] || 0],
    [],
    ['--- 本次筛选口径 ---', '', '', '', ''],
    ['口径ID', filter.id, '', '名称', filter.name],
    ['创建人', filter.createdBy, '', '创建时间', new Date(filter.createdAt).toLocaleString('zh-CN')],
    ['拟合度', filter.fittingDegree === 1 ? '线性(1次)' : `${filter.fittingDegree}次多项式`, '', '排除离群', filter.excludeOutliers ? '是' : '否'],
    ['边界最少样本', filter.boundarySampleMinCount, '', '边界阈值', filter.boundaryThreshold],
    ['包含材料ID', filter.materialIds.join('、'), '', '', ''],
    filter.dateRange ? ['日期范围', `${new Date(filter.dateRange.start).toLocaleDateString('zh-CN')} ~ ${new Date(filter.dateRange.end).toLocaleDateString('zh-CN')}`, '', '', ''] : [],
    [],
    ['--- 材料处理清单 ---', '', '', '', ''],
    ['材料ID', '当前名称', '处理状态', '边界样本数', '是否缺材料风险'],
    ...filteredMaterials.map(m => [
      m.id,
      m.currentName,
      statusLabel(m.status),
      fittingResults[m.id]?.boundarySampleCount ?? 0,
      m.status === 'missing' || fittingResults[m.id]?.boundaryWarning ? '是' : '否',
    ]),
    [],
    ['--- 最近 3 条导出历史对比 ---', '', '', '', ''],
    ['文件名', '生成时间', '操作人', '校验哈希', '筛选口径ID'],
    ...previousExports.slice(0, 3).map(exp => [
      exp.fileName,
      new Date(exp.timestamp).toLocaleString('zh-CN'),
      exp.operator,
      exp.dataHash,
      exp.filterCriteriaId,
    ]),
    previousExports.length === 0 ? [['(无历史)', '', '', '', '']] : [],
  ];
  const wsSummary = ws_from_rows(summaryRows);
  set_col_widths(wsSummary, [22, 45, 20, 22, 40]);
  wsSummary['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 4 } },
    { s: { r: 8, c: 0 }, e: { r: 8, c: 4 } },
    { s: { r: 12, c: 0 }, e: { r: 12, c: 4 } },
    { s: { r: 20, c: 0 }, e: { r: 20, c: 4 } },
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, '2.报告摘要');

  // ---------- Sheet 3: 拟合结果明细 ----------
  const detailHeader = [
    '材料ID', '材料名称', '单位', '处理状态',
    'R²', '拟合方程', '边界样本数', '边界告警',
    '低浓度边界X', '低浓度拟合Y', '高浓度边界X', '高浓度拟合Y',
    '数据点数(学生)', '数据点数(参考)', '排序是否稳定',
  ];
  const detailRows: Row[] = [
    ['【曲线拟合边界复核 · 拟合结果明细】', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    detailHeader,
    ...filteredMaterials.map(m => {
      const r = fittingResults[m.id];
      const boundaryL = r?.predictedAtBoundary[0];
      const boundaryH = r?.predictedAtBoundary[1];
      const studentCount = m.dataPoints.filter(d => d.source === 'student').length;
      const refCount = m.dataPoints.filter(d => d.source === 'reference').length;
      return [
        m.id,
        m.currentName,
        m.unit,
        statusLabel(m.status),
        r ? Number(r.rSquared.toFixed(6)) : 'N/A',
        r ? `y = ${formatEquation(r.coefficients)}` : '',
        r?.boundarySampleCount ?? 0,
        r?.boundaryWarning ? '是' : '否',
        boundaryL?.x ?? '',
        boundaryL ? Number(boundaryL.y.toFixed(4)) : '',
        boundaryH?.x ?? '',
        boundaryH ? Number(boundaryH.y.toFixed(4)) : '',
        studentCount,
        refCount,
        r?.unstableSort?.unstable ? '不稳定 ⚠️' : '正常',
      ];
    }),
    [],
    ['--- 各数据点残差表（按材料分段） ---', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['材料ID', '标签', 'X', 'Y实测', 'Y拟合', '残差', '来源', '是否边界', '备注'],
    ...(filteredMaterials.flatMap(m => {
      const r = fittingResults[m.id];
      if (!r) return [];
      const sorted = [...m.dataPoints].sort((a, b) => a.x - b.x);
      return sorted.map(dp => {
        const predicted = (r.coefficients || []).reduce((acc, c, i) => acc + c * Math.pow(dp.x, i), 0);
        const residual = dp.y - predicted;
        return [
          m.id,
          dp.label,
          dp.x,
          Number(dp.y.toFixed(4)),
          Number(predicted.toFixed(4)),
          Number(residual.toFixed(4)),
          dp.source === 'student' ? '学生自测' : '参考数据',
          dp.isBoundary ? '边界点' : '内点',
          dp.note || '',
        ];
      });
    })),
  ];
  const wsDetail = ws_from_rows(detailRows);
  set_col_widths(wsDetail, [14, 28, 10, 10, 12, 50, 10, 10, 14, 14, 14, 14, 12, 12, 12]);
  wsDetail['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 14 } },
  ];
  XLSX.utils.book_append_sheet(wb, wsDetail, '3.拟合结果明细');

  // ---------- Sheet 4: 异常与跳变分析 ----------
  const anomalyHeader = ['类型', '标题', '详细说明', '涉及材料', '前后数值'];
  const anomalyRows: Row[] = [
    ['【曲线拟合边界复核 · 异常与跳变分析】', '', '', '', '', ''],
    ['说明', '本页列出导致结果跳变或需要关注的全部原因。接手同事按"类型"列区分处理。', '', '', '', ''],
    [],
    ['--- 跳变/异常总览 ---', '', '', '', '', ''],
    ['跳变风险总数', jumpCauses.length, '', '', '', ''],
    ...(['threshold', 'unit', 'name_mismatch'] as const).map(t => [
      jumpTypeLabel(t),
      jumpCauses.filter(j => j.type === t).length,
      '', '', '',
    ]),
    [],
    ['--- 详细异常清单 ---', '', '', '', '', ''],
    anomalyHeader,
    ...jumpCauses.map(j => [
      jumpTypeLabel(j.type),
      j.description,
      j.detail,
      j.affectedMaterials?.join('、') || '（无具体材料）',
      j.beforeValue !== undefined && j.afterValue !== undefined
        ? `${Number(j.beforeValue.toFixed(6))}  →  ${Number(j.afterValue.toFixed(6))}`
        : '（无数值前后对比）',
    ]),
    jumpCauses.length === 0 ? [['无', '未检测到跳变风险', '-', '-', '-']] : [],
    [],
    ['--- 材料异常矩阵（所有异常项一眼扫） ---', '', '', '', '', ''],
    ['材料ID', '材料名称', '边界样本不足', '排序不稳定', '改名超过2次', '单位存疑', '状态=缺材料', '综合告警'],
    ...filteredMaterials.map(m => {
      const r = fittingResults[m.id];
      const boundary = r?.boundaryWarning || false;
      const sort = r?.unstableSort?.unstable || m.sortNote?.includes('⚠️') || false;
      const rename = m.nameHistory.length > 2;
      const unit = m.sortNote?.includes('单位') || m.sortNote?.includes('⚠️单位') || false;
      const miss = m.status === 'missing';
      const total = Number(boundary) + Number(sort) + Number(rename) + Number(unit) + Number(miss);
      return [
        m.id,
        m.currentName,
        boundary ? '是 ⚠️' : '否',
        sort ? '是 ⚠️' : '否',
        rename ? `是 (${m.nameHistory.length}次)` : '否',
        unit ? '是 ⚠️' : '否',
        miss ? '是 🚩' : '否',
        total === 0 ? '无' : `${total}项`,
      ];
    }),
  ];
  const wsAnomaly = ws_from_rows(anomalyRows);
  set_col_widths(wsAnomaly, [22, 40, 60, 32, 28, 16]);
  wsAnomaly['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 5 } },
    { s: { r: 9, c: 0 }, e: { r: 9, c: 5 } },
    { s: { r: 12, c: 0 }, e: { r: 12, c: 5 } },
  ];
  XLSX.utils.book_append_sheet(wb, wsAnomaly, '4.异常跳变分析');

  // ---------- Sheet 5: 学生草稿溯源 ----------
  const draftRows: Row[] = [
    ['【曲线拟合边界复核 · 学生草稿溯源】', '', '', '', '', '', ''],
    ['说明', '当排序不稳定、数值有争议时，回到本页看学生原始说法，而不是靠感觉。', '', '', '', '', ''],
    [],
    ['材料ID', '当前名称', '学生草稿原文（完整）', '系统排序注释', '草稿原始顺序', '系统推荐顺序(浓度升序)', '命名变更次数'],
    ...filteredMaterials.map(m => {
      const sorted = [...m.dataPoints].sort((a, b) => a.x - b.x).map(d => d.label).join(' → ');
      const orig = m.dataPoints.map(d => d.label).join(' → ');
      return [
        m.id,
        m.currentName,
        m.draftOriginalText || '（学生草稿原文未记录）',
        m.sortNote || '（无系统注释）',
        orig,
        sorted,
        m.nameHistory.length,
      ];
    }),
    [],
    ['--- 命名历史（写法不一致的完整链路） ---', '', '', '', '', '', ''],
    ['材料ID', '变更序号', '名称', '变更时间', '操作人', '变更原因', '是否临时/交接改名'],
    ...(filteredMaterials.flatMap(m => m.nameHistory.map((h, idx) => [
      m.id,
      idx + 1,
      h.name,
      new Date(h.timestamp).toLocaleString('zh-CN'),
      h.operator,
      h.reason || '（未记录）',
      h.operator.includes('交接') || (h.reason || '').includes('临时改名') || (h.reason || '').includes('交接') ? '是 ⚠️' : '否',
    ]))),
    [],
    ['--- 各点溯源明细（到数据点级别） ---', '', '', '', '', '', ''],
    ['材料ID', '标签', 'X', 'Y', '来源', '是否边界', '学生备注', '草稿原始位置序号'],
    ...(filteredMaterials.flatMap(m => m.dataPoints.map((dp, idx) => [
      m.id,
      dp.label,
      dp.x,
      Number(dp.y.toFixed(4)),
      dp.source === 'student' ? '学生自测' : '参考数据',
      dp.isBoundary ? '边界' : '内点',
      dp.note || '',
      idx + 1,
    ]))),
  ];
  const wsDraft = ws_from_rows(draftRows);
  set_col_widths(wsDraft, [14, 28, 70, 60, 36, 36, 14]);
  wsDraft['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 0 } },
    { s: { r: 6 + filteredMaterials.length + 1, c: 0 }, e: { r: 6 + filteredMaterials.length + 1, c: 6 } },
  ];
  XLSX.utils.book_append_sheet(wb, wsDraft, '5.学生草稿溯源');

  // ---------- Sheet 6: 历史时间线 ----------
  const evRows: Row[] = [
    ['【曲线拟合边界复核 · 历史时间线】', '', '', '', ''],
    ['说明', '本页完整记录所有操作，筛选口径变更、改名、状态变更、导出均有留痕。', '', '', ''],
    [],
    ['时间', '类型', '操作人', '描述', '详情(JSON)'],
    ...[...timeline].sort((a, b) => b.timestamp - a.timestamp).map(e => [
      new Date(e.timestamp).toLocaleString('zh-CN'),
      (
        { import: '📥导入', filter: '🔍筛选', fit: '📈拟合', review: '✅复核', export: '📤导出', handover: '🤝交接', rename: '✏️改名', status_change: '🔄状态变更' } as Record<string, string>
      )[e.type] || e.type,
      e.operator,
      e.description,
      e.detail ? JSON.stringify(e.detail) : (e.filterSnapshot ? `[筛选快照:${e.filterSnapshot.name}]` : ''),
    ]),
    [],
    ['--- 所有筛选口径版本列表 ---', '', '', '', ''],
    ['口径ID', '名称', '创建人', '创建时间', '参数摘要(拟合度/边界样本/阈值/排除离群)'],
    ...bundle.filterHistory.map(f => [
      f.id,
      f.name,
      f.createdBy,
      new Date(f.createdAt).toLocaleString('zh-CN'),
      `${f.fittingDegree === 1 ? '线性' : `${f.fittingDegree}次`} / ${f.boundarySampleMinCount} / ${f.boundaryThreshold} / ${f.excludeOutliers ? '是' : '否'}`,
    ]),
  ];
  const wsTime = ws_from_rows(evRows);
  set_col_widths(wsTime, [22, 14, 18, 60, 60]);
  wsTime['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 0 } },
  ];
  XLSX.utils.book_append_sheet(wb, wsTime, '6.历史时间线');

  // ---------- Sheet 7: 交接指引 ----------
  const handoverRows: Row[] = [
    ['【曲线拟合边界复核 · 交接指引】', ''],
    ['目的', '接手同事不依赖原负责人即可独立工作：知道材料在哪、异常怎么看、怎么再导出一份报告。'],
    [],
    ['=== 一、材料放在哪里 ===', ''],
    ['内容', handoverNote.materialLocation],
    [],
    ['=== 二、异常在哪里看 ===', ''],
    ['内容', handoverNote.anomalyLocation],
    [],
    ['=== 三、如何重新导出一份可复核报告 ===', ''],
    ['内容', handoverNote.reexportGuide],
    [],
    ['=== 四、处理情况一目了然 ===', ''],
    ['分类', '材料ID / 名称'],
    ['✅ 已复核', filteredMaterials.filter(m => m.status === 'reviewed').map(m => `${m.id}:${m.currentName}`).join('\n') || '(无)'],
    ['✅ 已处理', filteredMaterials.filter(m => m.status === 'processed').map(m => `${m.id}:${m.currentName}`).join('\n') || '(无)'],
    ['⏳ 待处理', filteredMaterials.filter(m => m.status === 'pending').map(m => `${m.id}:${m.currentName}`).join('\n') || '(无)'],
    ['🚩 缺材料', filteredMaterials.filter(m => m.status === 'missing').map(m => `${m.id}:${m.currentName}`).join('\n') || '(无)'],
    [],
    ['=== 五、原负责人留言 ===', ''],
    ['内容', handoverNote.remarks || '（无）'],
    [],
    ['=== 六、紧急联系 ===', ''],
    ['说明', '如果以上信息不够，请按历史时间线页中的操作人记录找对应人员。'],
  ];
  const wsHandover = ws_from_rows(handoverRows);
  set_col_widths(wsHandover, [28, 120]);
  wsHandover['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 1 } },
    { s: { r: 6, c: 0 }, e: { r: 6, c: 1 } },
    { s: { r: 9, c: 0 }, e: { r: 9, c: 1 } },
    { s: { r: 12, c: 0 }, e: { r: 12, c: 1 } },
    { s: { r: 18, c: 0 }, e: { r: 18, c: 1 } },
    { s: { r: 21, c: 0 }, e: { r: 21, c: 1 } },
  ];
  XLSX.utils.book_append_sheet(wb, wsHandover, '7.交接指引');

  return { wb, snapshot, hash, fileName };
}

export function triggerDownload(wb: XLSX.WorkBook, fileName: string) {
  const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([xlsxBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseExcelForVerification(file: File): Promise<{
  hash: string;
  fileName: string;
  generatedAt: string;
  operator: string;
  materialCount: number;
  totalPoints: number;
  filterId: string;
  filterName: string;
  warnings: string[];
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets['1.数据校验'];
        if (!ws) return reject(new Error('缺少校验页'));
        const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1 });
        const get = (key: string) => {
          const row = rows.find(r => r && r[0] === key);
          return row ? String(row[1] ?? '') : '';
        };
        const hash = get('校验哈希 (SHA-like)');
        const fileName = get('文件名');
        const generatedAt = get('生成时间');
        const operator = get('操作人');
        const materialCount = Number(get('材料数量') || 0);
        const totalPoints = Number(get('数据点总数') || 0);
        const filterId = get('筛选口径ID');
        const filterName = get('筛选口径名称');
        const warnStart = rows.findIndex(r => r && r[0] === '序号' && String(r[1]).includes('警告'));
        const warnings: string[] = [];
        if (warnStart >= 0) {
          for (let i = warnStart + 1; i < rows.length; i++) {
            const r = rows[i];
            if (!r || r[0] === undefined || r[0] === null || r[0] === '') continue;
            if (String(r[0]).startsWith('---')) break;
            if (r[1] !== undefined && r[1] !== '' && String(r[0]) !== '-') {
              warnings.push(String(r[1]));
            }
          }
        }
        resolve({ hash, fileName, generatedAt, operator, materialCount, totalPoints, filterId, filterName, warnings });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
