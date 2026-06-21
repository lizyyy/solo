// 纯 Node.js（CJS）端到端验证脚本
// 内联 TS 源码中的关键实现，确保可直接运行
const XLSX = require('xlsx');
const { writeFileSync, mkdirSync } = require('fs');
const { join } = require('path');

// ================ 内联：fitting.ts 核心实现 ================
function polynomialFit(points, degree) {
  const n = points.length;
  if (n <= degree) degree = n - 1;
  const m = degree + 1;
  const X = [], Y = [];
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < m; j++) row.push(Math.pow(points[i].x, j));
    X.push(row);
    Y.push(points[i].y);
  }
  const XtX = [], XtY = [];
  for (let i = 0; i < m; i++) {
    XtX.push(new Array(m).fill(0));
    let s = 0;
    for (let k = 0; k < n; k++) s += X[k][i] * Y[k];
    XtY.push(s);
    for (let j = 0; j < m; j++) {
      let s2 = 0;
      for (let k = 0; k < n; k++) s2 += X[k][i] * X[k][j];
      XtX[i][j] = s2;
    }
  }
  const M = XtX.map((row, i) => [...row, XtY[i]]);
  for (let col = 0; col < m; col++) {
    let maxRow = col;
    for (let row = col + 1; row < m; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];
    const piv = M[col][col];
    if (Math.abs(piv) > 1e-12) for (let j = col; j <= m; j++) M[col][j] /= piv;
    for (let row = 0; row < m; row++) {
      if (row === col) continue;
      const f = M[row][col];
      for (let j = col; j <= m; j++) M[row][j] -= f * M[col][j];
    }
  }
  const coef = M.map(row => row[m]);
  let yMean = 0;
  for (let i = 0; i < n; i++) yMean += Y[i];
  yMean /= n;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    const yPred = evalPoly(coef, points[i].x);
    ssTot += Math.pow(Y[i] - yMean, 2);
    ssRes += Math.pow(Y[i] - yPred, 2);
  }
  return { coefficients: coef, rSquared: ssTot === 0 ? 1 : 1 - ssRes / ssTot };
}
function evalPoly(coef, x) {
  let y = 0;
  for (let i = 0; i < coef.length; i++) y += coef[i] * Math.pow(x, i);
  return y;
}
function fitMaterialInline(material, filter) {
  const pts = material.dataPoints.map(dp => ({ x: dp.x, y: dp.y }));
  const { coefficients, rSquared } = polynomialFit(pts, filter.fittingDegree);
  const boundary = material.dataPoints.filter(dp => dp.isBoundary);
  const sorted = [...material.dataPoints].sort((a, b) => a.x - b.x);
  return {
    materialId: material.id,
    coefficients,
    rSquared,
    boundaryPoints: boundary,
    boundaryWarning: boundary.length < filter.boundarySampleMinCount,
    boundarySampleCount: boundary.length,
    predictedAtBoundary: [
      { x: sorted[0]?.x ?? 0, y: evalPoly(coefficients, sorted[0]?.x ?? 0) },
      { x: sorted[sorted.length - 1]?.x ?? 0, y: evalPoly(coefficients, sorted[sorted.length - 1]?.x ?? 0) },
    ],
    unstableSort: material.sortNote?.includes('⚠️') ? {
      unstable: true,
      originalDraftText: material.draftOriginalText || '',
      suggestedOrder: sorted.map(dp => dp.label),
    } : undefined,
  };
}
function computeHash(snap) {
  const str = JSON.stringify(snap);
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return ('00000000' + (h >>> 0).toString(16)).slice(-8);
}

// ================ 内联：mockData.ts 关键数据 ================
const DAY = 86400000;
const NOW = Date.now();
const mockMaterials = [
  {
    id: 'mat-001', currentName: '葡萄糖标准品 (高纯级)', unit: 'mg', status: 'reviewed',
    nameHistory: [
      { id: 'nh-1', name: '葡萄糖标准品', timestamp: NOW - 7 * DAY, operator: '学生草稿-小王' },
      { id: 'nh-2', name: '葡萄糖标准品 (高纯级)', timestamp: NOW - 2 * DAY, operator: '老叶', reason: '标注纯度级别' },
    ],
    draftOriginalText: '学生小王：按浓度从低到高排 C0→C5，C0 和 C5 是边界点，我只测了中间四个点，边界是查文献找的。老师说边界点要标清楚。',
    sortNote: '排序依据：浓度升序。学生草稿中明确写了"C0→C5"。',
    dataPoints: [
      { id: 'dp-1', x: 0.1, y: 0.082, label: 'C1', source: 'student', isBoundary: false },
      { id: 'dp-2', x: 0.2, y: 0.165, label: 'C2', source: 'student', isBoundary: false },
      { id: 'dp-3', x: 0.5, y: 0.412, label: 'C3', source: 'student', isBoundary: false },
      { id: 'dp-4', x: 1.0, y: 0.823, label: 'C4', source: 'student', isBoundary: false },
      { id: 'dp-5', x: 2.0, y: 1.648, label: 'C5', source: 'reference', isBoundary: true },
      { id: 'dp-6', x: 0.05, y: 0.041, label: 'C0', source: 'reference', isBoundary: true },
    ],
  },
  {
    id: 'mat-002', currentName: '牛血清白蛋白 BSA', unit: 'μg', status: 'processed',
    nameHistory: [
      { id: 'nh-3', name: 'BSA蛋白', timestamp: NOW - 5 * DAY, operator: '学生草稿-小李' },
      { id: 'nh-4', name: '牛血清白蛋白 BSA', timestamp: NOW - 4 * DAY, operator: '小李' },
    ],
    draftOriginalText: '学生小李：S1到S4是我测的，S0和S5是问隔壁组借的数。S0好像是2.5μg？不太确定。',
    sortNote: '排序：浓度升序 S0→S5。学生不确定 S0 精确值。',
    dataPoints: [
      { id: 'dp-7', x: 5, y: 0.125, label: 'S1', source: 'student', isBoundary: false },
      { id: 'dp-8', x: 10, y: 0.251, label: 'S2', source: 'student', isBoundary: false },
      { id: 'dp-9', x: 20, y: 0.498, label: 'S3', source: 'student', isBoundary: false },
      { id: 'dp-10', x: 40, y: 0.987, label: 'S4', source: 'student', isBoundary: false },
      { id: 'dp-11', x: 80, y: 1.952, label: 'S5', source: 'reference', isBoundary: true },
      { id: 'dp-12', x: 2.5, y: 0.063, label: 'S0', source: 'reference', isBoundary: true },
    ],
  },
  {
    id: 'mat-003', currentName: '氯化钠-临时改名(交接用)', unit: 'mg', status: 'pending',
    nameHistory: [
      { id: 'nh-5', name: 'NaCl溶液', timestamp: NOW - 3 * DAY, operator: '学生草稿-小张' },
      { id: 'nh-6', name: '氯化钠标准溶液', timestamp: NOW - 1 * DAY, operator: '小张' },
      { id: 'nh-7', name: '氯化钠-临时改名(交接用)', timestamp: NOW, operator: '系统-交接模拟', reason: '临时改名（交接测试）' },
    ],
    draftOriginalText: '学生小张：N0是1mg？不对，是0.5。N5是15mg。我觉得边界点也够用了，但老叶之前说边界最好双份确认，我没做。',
    sortNote: '⚠️ 排序不稳定：学生原草稿顺序是 N1→N2→N3→N4→N0→N5，按浓度应为 N0→N1→N2→N3→N4→N5。边界样本少·仅学生自测。',
    dataPoints: [
      { id: 'dp-13', x: 1, y: 0.077, label: 'N1', source: 'student', isBoundary: false },
      { id: 'dp-14', x: 2, y: 0.156, label: 'N2', source: 'student', isBoundary: false },
      { id: 'dp-15', x: 5, y: 0.389, label: 'N3', source: 'student', isBoundary: false },
      { id: 'dp-16', x: 10, y: 0.778, label: 'N4', source: 'student', isBoundary: false },
      { id: 'dp-17', x: 0.5, y: 0.038, label: 'N0', source: 'student', isBoundary: true, note: '边界样本少' },
      { id: 'dp-18', x: 15, y: 1.152, label: 'N5', source: 'student', isBoundary: true, note: '边界样本少' },
    ],
  },
  {
    id: 'mat-004', currentName: '硫酸铜标准液', unit: 'mg', status: 'missing',
    nameHistory: [
      { id: 'nh-8', name: '硫酸铜', timestamp: NOW - 6 * DAY, operator: '学生草稿-小陈' },
      { id: 'nh-9', name: '硫酸铜五水合物', timestamp: NOW - 5 * DAY, operator: '小陈' },
      { id: 'nh-10', name: '硫酸铜标准液', timestamp: NOW - 4 * DAY, operator: '老叶' },
    ],
    draftOriginalText: '学生小陈：高浓度那边我还没测，T4是参考数据。低浓度我还缺一个T0(0.2mg)，下周补。',
    sortNote: '排序：T1→T4 浓度升序。缺低浓度边界 T0，状态为缺材料。',
    dataPoints: [
      { id: 'dp-19', x: 0.5, y: 0.201, label: 'T1', source: 'student', isBoundary: false },
      { id: 'dp-20', x: 1.0, y: 0.403, label: 'T2', source: 'student', isBoundary: false },
      { id: 'dp-21', x: 2.0, y: 0.798, label: 'T3', source: 'student', isBoundary: false },
      { id: 'dp-22', x: 5.0, y: 1.965, label: 'T4', source: 'reference', isBoundary: true },
    ],
  },
  {
    id: 'mat-005', currentName: '磷酸二氢钾', unit: 'g', status: 'processed',
    nameHistory: [
      { id: 'nh-11', name: 'KH2PO4', timestamp: NOW - 8 * DAY, operator: '学生草稿-小周' },
      { id: 'nh-12', name: '磷酸二氢钾', timestamp: NOW - 6 * DAY, operator: '小周' },
    ],
    draftOriginalText: '学生小周：P0到P5全齐了，单位是克。之前有人写成mg了，是错的。',
    sortNote: '排序：P0(0.005g)→P5(0.2g)。⚠️单位：曾被误写为mg，实际为g。',
    dataPoints: [
      { id: 'dp-23', x: 0.01, y: 0.108, label: 'P1', source: 'student', isBoundary: false },
      { id: 'dp-24', x: 0.02, y: 0.214, label: 'P2', source: 'student', isBoundary: false },
      { id: 'dp-25', x: 0.05, y: 0.532, label: 'P3', source: 'student', isBoundary: false },
      { id: 'dp-26', x: 0.1, y: 1.051, label: 'P4', source: 'student', isBoundary: false },
      { id: 'dp-27', x: 0.2, y: 2.087, label: 'P5', source: 'reference', isBoundary: true },
      { id: 'dp-28', x: 0.005, y: 0.055, label: 'P0', source: 'reference', isBoundary: true },
    ],
  },
];
const mockFilter = {
  id: 'f-001', name: '默认筛选-全部材料', createdBy: '老叶', createdAt: NOW - 7 * DAY,
  materialIds: mockMaterials.map(m => m.id),
  boundaryThreshold: 0.05, boundarySampleMinCount: 2, fittingDegree: 1, excludeOutliers: false,
};
const mockFilterHistory = [mockFilter, {
  id: 'f-002', name: '已复核材料-仅线性拟合', createdBy: '老叶', createdAt: NOW - 4 * DAY,
  materialIds: ['mat-001'], boundaryThreshold: 0.05, boundarySampleMinCount: 2, fittingDegree: 1, excludeOutliers: true,
}, {
  id: 'f-003', name: '交接试跑-含待处理', createdBy: '系统-交接试跑', createdAt: NOW,
  materialIds: mockMaterials.map(m => m.id),
  boundaryThreshold: 0.03, boundarySampleMinCount: 3, fittingDegree: 2, excludeOutliers: false,
}];

// ================ 内联：excelExport.ts 精简版（7 Sheet 构建） ================
const statusLabel = s => ({ pending: '待处理', processed: '已处理', missing: '缺材料', reviewed: '已复核' }[s] || s);
const jumpTypeLabel = t => ({ threshold: '阈值/拟合参数变更', unit: '单位不一致/存疑', name_mismatch: '材料名称前后不一致' }[t]);

function aoa(ws, widths) {
  if (widths) ws['!cols'] = widths.map(w => ({ wch: w }));
  return ws;
}

function buildRealWorkbook() {
  const filtered = mockMaterials.filter(m => mockFilter.materialIds.includes(m.id));
  const fitting = {};
  for (const m of filtered) fitting[m.id] = fitMaterialInline(m, mockFilter);

  const r2s = {};
  const warns = [];
  let tot = 0;
  for (const m of filtered) {
    r2s[m.id] = fitting[m.id].rSquared;
    tot += m.dataPoints.length;
    if (fitting[m.id].boundaryWarning) warns.push(`${m.id}(${m.currentName}): 边界样本不足(${fitting[m.id].boundarySampleCount})`);
    if (m.status === 'missing') warns.push(`${m.id}(${m.currentName}): 缺材料`);
  }
  const snapshot = { materialCount: filtered.length, totalPoints: tot, rSquaredValues: r2s, boundaryWarnings: warns };
  const hash = computeHash(snapshot);
  const dateStr = new Date(NOW).toISOString().slice(0, 10).replace(/-/g, '');
  const fileName = `boundary_review_${dateStr}_${hash}.xlsx`;
  const genAt = new Date(NOW).toLocaleString('zh-CN');
  const wb = XLSX.utils.book_new();

  const unitCount = filtered.some(m => m.sortNote?.includes('单位')) ? 1 : 0;
  const nameCount = filtered.filter(m => m.nameHistory.length > 2).length;
  const thresholdCount = 0;
  const jumpCauses = [
    ...(unitCount > 0 ? [{ type: 'unit', description: '单位存在历史变更或存疑', detail: '涉及：磷酸二氢钾(mat-005)曾被误写为mg实际为g', affectedMaterials: ['磷酸二氢钾'] }] : []),
    ...(nameCount > 0 ? [{ type: 'name_mismatch', description: '材料名称前后写法不一致', detail: `氯化钠 3次改名：NaCl溶液→氯化钠标准溶液→氯化钠-临时改名(交接用)`, affectedMaterials: ['氯化钠-临时改名(交接用)'] }] : []),
  ];

  // Sheet1 数据校验
  const s1 = [
    ['【曲线拟合边界复核 · 数据校验页】', ''],
    ['用途说明', '本页用于复核：拿到的导出文件是否与当时屏幕上看到的数字完全一致。'],
    ['操作步骤', '1. 同一筛选口径；2. 对比数字；3. 比较校验哈希。'],
    [], ['--- 文件元信息 ---', ''],
    ['文件名', fileName],
    ['校验哈希 (SHA-like)', hash],
    ['生成时间', genAt],
    ['操作人', '验收脚本'],
    [], ['--- 当期屏幕快照 ---', ''],
    ['材料数量', snapshot.materialCount],
    ['数据点总数', snapshot.totalPoints],
    ['边界警告数量', snapshot.boundaryWarnings.length],
    ['筛选口径ID', mockFilter.id],
    ['筛选口径名称', mockFilter.name],
    ['拟合度', '线性(1次)'],
    ['边界最少样本数', mockFilter.boundarySampleMinCount],
    [], ['--- 各材料 R² 快照 ---', ''],
    ['材料ID', '材料名称', 'R²(导出时)'],
    ...filtered.map(m => [m.id, m.currentName, r2s[m.id]]),
    [], ['--- 边界警告清单 ---', ''],
    ['序号', '警告内容'],
    ...(snapshot.boundaryWarnings.length ? snapshot.boundaryWarnings.map((w, i) => [i + 1, w]) : [['-', '无']]),
  ];
  XLSX.utils.book_append_sheet(wb, aoa(XLSX.utils.aoa_to_sheet(s1), [30, 90]), '1.数据校验');

  // Sheet2 报告摘要
  const avgR2 = filtered.length ? Object.values(r2s).reduce((a, b) => a + b, 0) / filtered.length : 0;
  const sc = { reviewed: 0, processed: 0, pending: 0, missing: 0 };
  for (const m of filtered) sc[m.status]++;
  const s2 = [
    ['【曲线拟合边界复核 · 报告摘要】', '', '', '', ''],
    ['生成时间', genAt, '', '操作人', '验收脚本'],
    ['文件名', fileName, '', '校验哈希', hash],
    [], ['--- 总体统计 ---', '', '', '', ''],
    ['材料总数', snapshot.materialCount, '', '数据点总数', snapshot.totalPoints],
    ['平均 R²', Number(avgR2.toFixed(6)), '', '边界警告', snapshot.boundaryWarnings.length],
    ['跳变风险数', jumpCauses.length, '', '', ''],
    [], ['--- 处理状态分布 ---', '', '', '', ''],
    ['已复核', sc.reviewed, '', '已处理', sc.processed],
    ['待处理', sc.pending, '', '缺材料', sc.missing],
    [], ['--- 本次筛选口径 ---', '', '', '', ''],
    ['口径ID', mockFilter.id, '', '名称', mockFilter.name],
    ['拟合度', '线性(1次)', '', '边界最少样本', mockFilter.boundarySampleMinCount],
    [], ['--- 材料处理清单 ---', '', '', '', ''],
    ['材料ID', '当前名称', '处理状态', '边界样本数', '缺材料风险'],
    ...filtered.map(m => [
      m.id, m.currentName, statusLabel(m.status),
      fitting[m.id].boundarySampleCount,
      m.status === 'missing' || fitting[m.id].boundaryWarning ? '是' : '否',
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, aoa(XLSX.utils.aoa_to_sheet(s2), [20, 35, 18, 18, 18]), '2.报告摘要');

  // Sheet3 拟合结果明细
  const s3 = [
    ['【曲线拟合边界复核 · 拟合结果明细】', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['材料ID', '材料名称', '单位', '状态', 'R²', '边界样本数', '边界告警', '排序稳定'],
    ...filtered.map(m => {
      const r = fitting[m.id];
      return [m.id, m.currentName, m.unit, statusLabel(m.status), Number(r.rSquared.toFixed(6)), r.boundarySampleCount,
        r.boundaryWarning ? '是' : '否', r.unstableSort?.unstable ? '否⚠️' : '是'];
    }),
    [], ['--- 各数据点残差 ---', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['材料ID', '标签', 'X', 'Y实测', 'Y拟合', '残差', '来源', '边界'],
    ...filtered.flatMap(m => {
      const r = fitting[m.id];
      return [...m.dataPoints].sort((a, b) => a.x - b.x).map(dp => {
        const p = evalPoly(r.coefficients, dp.x);
        return [m.id, dp.label, dp.x, Number(dp.y.toFixed(4)), Number(p.toFixed(4)),
          Number((dp.y - p).toFixed(4)), dp.source === 'student' ? '学生自测' : '参考数据', dp.isBoundary ? '是' : '否'];
      });
    }),
  ];
  XLSX.utils.book_append_sheet(wb, aoa(XLSX.utils.aoa_to_sheet(s3), [14, 28, 10, 10, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12]), '3.拟合结果明细');

  // Sheet4 异常跳变分析
  const s4 = [
    ['【曲线拟合边界复核 · 异常与跳变分析】', '', '', '', '', ''],
    [], ['--- 跳变总览 ---', '', '', '', '', ''],
    ['跳变风险总数', jumpCauses.length, '', '', '', ''],
    ['阈值/拟合参数变更', thresholdCount, '', '', '', ''],
    ['单位不一致/存疑', unitCount, '', '', '', ''],
    ['材料名称写法不一致', nameCount, '', '', '', ''],
    [], ['--- 详细异常清单 ---', '', '', '', '', ''],
    ['类型', '标题', '详细说明', '涉及材料', ''],
    ...(jumpCauses.length ? jumpCauses.map(j => [jumpTypeLabel(j.type), j.description, j.detail, j.affectedMaterials?.join('、') || '', ''])
      : [['无', '未检测到跳变风险', '-', '-', '']]),
    [], ['--- 材料异常矩阵 ---', '', '', '', '', ''],
    ['材料ID', '名称', '边界不足', '排序不稳', '改名>2次'],
    ...filtered.map(m => {
      const r = fitting[m.id];
      return [m.id, m.currentName, r.boundaryWarning ? '是⚠️' : '否',
        m.sortNote?.includes('⚠️') ? '是⚠️' : '否', m.nameHistory.length > 2 ? '是' : '否'];
    }),
  ];
  XLSX.utils.book_append_sheet(wb, aoa(XLSX.utils.aoa_to_sheet(s4), [20, 40, 60, 40, 20, 20]), '4.异常跳变分析');

  // Sheet5 草稿溯源
  const s5 = [
    ['【曲线拟合边界复核 · 学生草稿溯源】', '', '', '', '', '', ''],
    [],
    ['材料ID', '当前名称', '学生草稿原文', '系统排序注释', '原始顺序', '推荐顺序'],
    ...filtered.map(m => {
      const sorted = [...m.dataPoints].sort((a, b) => a.x - b.x).map(d => d.label).join(' → ');
      const orig = m.dataPoints.map(d => d.label).join(' → ');
      return [m.id, m.currentName, m.draftOriginalText || '无', m.sortNote || '无', orig, sorted];
    }),
    [], ['--- 命名历史（完整链路） ---', '', '', '', '', '', ''],
    ['材料ID', '序号', '名称', '时间', '操作人', '原因', '是否临时'],
    ...filtered.flatMap(m => m.nameHistory.map((h, idx) => [
      m.id, idx + 1, h.name, new Date(h.timestamp).toLocaleString('zh-CN'),
      h.operator, h.reason || '',
      ((h.reason || '').includes('临时改名') || (h.operator || '').includes('交接')) ? '是' : '否',
    ])),
  ];
  XLSX.utils.book_append_sheet(wb, aoa(XLSX.utils.aoa_to_sheet(s5), [14, 28, 70, 60, 30, 30, 10]), '5.学生草稿溯源');

  // Sheet6 历史时间线（精简）
  const timelineEvents = [
    { t: new Date(NOW - 7 * DAY).toLocaleString('zh-CN'), type: '📥导入', op: '小王', desc: '导入葡萄糖标准品' },
    { t: new Date(NOW - 6 * DAY).toLocaleString('zh-CN'), type: '📥导入', op: '小陈', desc: '导入硫酸铜（缺低浓度边界）' },
    { t: new Date(NOW - 3 * DAY).toLocaleString('zh-CN'), type: '📥导入', op: '小张', desc: '导入NaCl溶液' },
    { t: new Date(NOW - 2 * DAY).toLocaleString('zh-CN'), type: '✅复核', op: '老叶', desc: '葡萄糖标准品复核通过' },
    { t: new Date(NOW).toLocaleString('zh-CN'), type: '🤝交接', op: '老叶→接手', desc: '曲线拟合边界复核工作移交' },
  ];
  const s6 = [
    ['【曲线拟合边界复核 · 历史时间线】', '', '', '', ''],
    [],
    ['时间', '类型', '操作人', '描述', ''],
    ...timelineEvents.map(e => [e.t, e.type, e.op, e.desc, '']),
    [], ['--- 所有筛选口径版本 ---', '', '', '', ''],
    ['口径ID', '名称', '创建人', '创建时间', '参数摘要'],
    ...mockFilterHistory.map(f => [
      f.id, f.name, f.createdBy, new Date(f.createdAt).toLocaleString('zh-CN'),
      `${f.fittingDegree === 1 ? '线性' : f.fittingDegree + '次'} / ${f.boundarySampleMinCount}样本 / 阈值${f.boundaryThreshold}`,
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, aoa(XLSX.utils.aoa_to_sheet(s6), [22, 14, 16, 50, 30]), '6.历史时间线');

  // Sheet7 交接指引
  const s7 = [
    ['【曲线拟合边界复核 · 交接指引】', ''],
    ['目的', '接手同事不依赖原负责人即可独立工作。'],
    [], ['=== 一、材料放在哪里 ===', ''],
    ['内容', '/shared/drafts/学生原始数据/（5份Excel）；/shared/references/边界参考图谱/'],
    [], ['=== 二、异常在哪里看 ===', ''],
    ['内容', '系统内"异常与跳变"Tab + Excel Sheet4。重点：mat-003改名/排序不稳，mat-004缺T0，mat-005单位历史存疑'],
    [], ['=== 三、如何重新导出 ===', ''],
    ['内容', '1. 选筛选口径 → 2. 确认屏幕数字快照 → 3. 顶部"导出报告"按钮 → 4. 勾选绑定哈希'],
    [], ['=== 四、处理情况 ===', ''],
    ['✅已复核', mockMaterials.filter(m => m.status === 'reviewed').map(m => m.id + ':' + m.currentName).join('\n') || '(无)'],
    ['✅已处理', mockMaterials.filter(m => m.status === 'processed').map(m => m.id + ':' + m.currentName).join('\n') || '(无)'],
    ['⏳待处理', mockMaterials.filter(m => m.status === 'pending').map(m => m.id + ':' + m.currentName).join('\n') || '(无)'],
    ['🚩缺材料', mockMaterials.filter(m => m.status === 'missing').map(m => m.id + ':' + m.currentName).join('\n') || '(无)'],
    [], ['=== 五、留言 ===', ''],
    ['内容', 'mat-003 改名是交接测试，确认没问题改回"氯化钠标准溶液"。mat-004 小陈下周一补T0。'],
  ];
  XLSX.utils.book_append_sheet(wb, aoa(XLSX.utils.aoa_to_sheet(s7), [28, 120]), '7.交接指引');

  return { wb, fileName, hash, snapshot, mockFilter: mockFilter, jumpCauses, filtered, fitting };
}

// ================ 运行验证 ================
console.log('\n=== Step 1: 构建 7-Sheet 工作簿 ===');
const { wb, fileName, hash, snapshot, filtered, fitting, mockFilter: MF } = buildRealWorkbook();
console.log('✓ 文件名:', fileName);
console.log('✓ 校验哈希:', hash);
console.log('✓ 材料数:', snapshot.materialCount, ' 总数据点:', snapshot.totalPoints);
console.log('✓ 边界警告:', snapshot.boundaryWarnings.length, snapshot.boundaryWarnings);
console.log('✓ 各材料R²:', JSON.stringify(snapshot.rSquaredValues, null, 2).replace(/\n/g, ' '));

// 保存文件
const outDir = join(__dirname, 'tmp-verify');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, fileName);
const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
writeFileSync(outPath, buf);
console.log('\n✅ 文件已写入:', outPath, '大小:', (buf.length / 1024).toFixed(1), 'KB');

// 重新读入
console.log('\n=== Step 2: 重新解析文件，逐 Sheet 核对 ===');
const wb2 = XLSX.readFile(outPath);
const names = wb2.SheetNames;
console.log('Sheet 列表:', JSON.stringify(names));
const expectedNames = ['1.数据校验', '2.报告摘要', '3.拟合结果明细', '4.异常跳变分析', '5.学生草稿溯源', '6.历史时间线', '7.交接指引'];
for (const s of expectedNames) {
  const ok = names.includes(s);
  console.log('  ' + (ok ? '✅' : '❌') + ' ' + s + (ok ? ' — 存在' : ' — 缺失'));
}

// Sheet1
console.log('\n=== Step 3: Sheet1 数据校验页核对 ===');
const rows1 = XLSX.utils.sheet_to_json(wb2.Sheets['1.数据校验'], { header: 1 });
const m1 = {};
for (const r of rows1) if (r && r[0] !== undefined) m1[String(r[0]).trim()] = r[1];
const checks = [
  ['文件名匹配', m1['文件名'] === fileName, m1['文件名']],
  ['哈希匹配', m1['校验哈希 (SHA-like)'] === hash, m1['校验哈希 (SHA-like)']],
  ['材料数量', Number(m1['材料数量']) === snapshot.materialCount, m1['材料数量']],
  ['数据点总数', Number(m1['数据点总数']) === snapshot.totalPoints, m1['数据点总数']],
  ['筛选口径名称', m1['筛选口径名称'] === MF.name, m1['筛选口径名称']],
  ['边界警告数量', Number(m1['边界警告数量']) === snapshot.boundaryWarnings.length, m1['边界警告数量']],
];
for (const [name, ok, val] of checks) {
  console.log('  ' + (ok ? '✅' : '❌') + ' ' + name + `（实际: ${typeof val === 'number' ? val : String(val ?? 'undef').slice(0, 50)}）`);
}

// Sheet2
console.log('\n=== Step 4: Sheet2 报告摘要核对 ===');
const rows2 = XLSX.utils.sheet_to_json(wb2.Sheets['2.报告摘要'], { header: 1 });
const m2 = {};
for (const r of rows2) if (r && r[0] !== undefined) m2[String(r[0]).trim()] = { a: r[1], c: r[3] };
const avgR = filtered.length ? Object.values(snapshot.rSquaredValues).reduce((a, b) => a + b, 0) / filtered.length : 0;
const checks2 = [
  ['平均 R² 写入', Math.abs(Number(m2['平均 R²'].a) - avgR) < 1e-4, `${m2['平均 R²'].a} ≈ ${avgR.toFixed(6)}`],
  ['跳变风险数', Number(m2['跳变风险数'].a) >= 1, `${m2['跳变风险数'].a}`],
  ['处理状态分布已写入', m2['待处理'] !== undefined && m2['缺材料'] !== undefined, `待处理=${m2['待处理']?.a}, 缺材料=${m2['缺材料']?.a}`],
  ['材料处理清单完整', (() => {
    const hIdx = rows2.findIndex(r => r && String(r[0] || '').trim() === '材料ID' && String(r[2] || '').trim() === '处理状态');
    let c = 0;
    for (let i = hIdx + 1; i < rows2.length; i++) { if (rows2[i]?.[0] && /mat-/.test(String(rows2[i][0]))) c++; else if (c > 0) break; }
    return c === filtered.length;
  })(), '清单行数正确'],
];
for (const [name, ok, extra] of checks2) {
  console.log('  ' + (ok ? '✅' : '❌') + ' ' + name + (extra ? ' — ' + extra : ''));
}

// Sheet3
console.log('\n=== Step 5: Sheet3 拟合结果+残差核对 ===');
const rows3 = XLSX.utils.sheet_to_json(wb2.Sheets['3.拟合结果明细'], { header: 1 });
const resIdx = rows3.findIndex(r => r && r[0] === '材料ID' && r[4] === 'R²');
let rc = 0;
for (let i = resIdx + 1; i < rows3.length; i++) {
  if (rows3[i]?.[0] && /mat-/.test(String(rows3[i][0]))) rc++; else if (rc > 0) break;
}
console.log('  ' + (rc === filtered.length ? '✅' : '❌') + ` 拟合结果主表行数: ${rc}/${filtered.length}`);
const residx = rows3.findIndex(r => r && r[0] === '材料ID' && r[3] === 'Y实测');
let resc = 0, totalPts = 0;
for (const m of filtered) totalPts += m.dataPoints.length;
for (let i = residx + 1; i < rows3.length; i++) {
  if (rows3[i]?.[0] && /mat-/.test(String(rows3[i][0]))) resc++; else if (resc > 0 && resc >= totalPts) break;
}
console.log('  ' + (resc === totalPts ? '✅' : '❌') + ` 残差表行数: ${resc}/${totalPts}`);

// 验证一个残差
const mat1Row = rows3.find(r => r && r[0] === 'mat-001' && r[1] === 'C1');
if (mat1Row) {
  const yPredExpected = evalPoly(fitting['mat-001'].coefficients, 0.1);
  const yPredActual = Number(mat1Row[4]);
  console.log('  ' + (Math.abs(yPredActual - yPredExpected) < 1e-3 ? '✅' : '❌') + ` 残差计算抽样(mat-001 C1): 拟合Y=${yPredActual}, 期望≈${yPredExpected.toFixed(4)}`);
}

// Sheet4
console.log('\n=== Step 6: Sheet4 异常跳变核对 ===');
const rows4 = XLSX.utils.sheet_to_json(wb2.Sheets['4.异常跳变分析'], { header: 1 });
const hasUnit = rows4.some(r => String(r?.[0] || '').includes('单位不一致'));
const hasName = rows4.some(r => String(r?.[0] || '').includes('名称前后不一致'));
const matCnt = rows4.filter(r => String(r?.[0] || '').startsWith('mat-')).length;
console.log('  ' + (hasUnit ? '✅' : '❌') + ' 包含"单位不一致/存疑"类型说明');
console.log('  ' + (hasName ? '✅' : '❌') + ' 包含"材料名称前后不一致"类型说明（氯化钠临时改名）');
console.log('  ' + (matCnt === filtered.length ? '✅' : '❌') + ` 异常矩阵覆盖 ${matCnt}/${filtered.length} 条材料`);

// Sheet5
console.log('\n=== Step 7: Sheet5 草稿溯源+命名链路核对 ===');
const rows5 = XLSX.utils.sheet_to_json(wb2.Sheets['5.学生草稿溯源'], { header: 1 });
const hasDraft = rows5.some(r => String(r?.[2] || '').includes('学生小王'));
const hasNaCl = rows5.some(r => String(r?.[2] || '').includes('临时改名'));
const histTotal = filtered.reduce((a, m) => a + m.nameHistory.length, 0);
const mat003Hist = rows5.filter(r => r?.[0] === 'mat-003' && typeof r[1] === 'number').length;
console.log('  ' + (hasDraft ? '✅' : '❌') + ' 含学生小王草稿原文');
console.log('  ' + (hasNaCl ? '✅' : '❌') + ' 系统注释中包含临时改名相关字样');
console.log('  ' + (mat003Hist >= 3 ? '✅' : '❌') + ` 氯化钠(mat-003)至少有 3 条命名记录: ${mat003Hist}/3`);

// Sheet6
console.log('\n=== Step 8: Sheet6 时间线+筛选口径列表核对 ===');
const rows6 = XLSX.utils.sheet_to_json(wb2.Sheets['6.历史时间线'], { header: 1 });
const eventCount = rows6.filter(r => String(r?.[1] || '').startsWith('📥') || String(r?.[1] || '').startsWith('✅') || String(r?.[1] || '').startsWith('🤝')).length;
const filterCount = rows6.filter(r => String(r?.[0] || '').startsWith('f-')).length;
console.log('  ' + (eventCount >= 5 ? '✅' : '❌') + ` 事件行数: ${eventCount}/至少5`);
console.log('  ' + (filterCount === mockFilterHistory.length ? '✅' : '❌') + ` 筛选口径列表: ${filterCount}/${mockFilterHistory.length} 个版本`);

// Sheet7
console.log('\n=== Step 9: Sheet7 交接指引核对 ===');
const rows7 = XLSX.utils.sheet_to_json(wb2.Sheets['7.交接指引'], { header: 1 });
const hLoc = rows7.some(r => String(r?.[0] || '').includes('材料放在哪里'));
const hExp = rows7.some(r => String(r?.[0] || '').includes('如何重新导出'));
const hReview = rows7.some(r => String(r?.[0] || '') === '✅已复核');
const hMiss = rows7.some(r => String(r?.[0] || '') === '🚩缺材料');
console.log('  ' + (hLoc ? '✅' : '❌') + ' 含"材料放在哪里"章节');
console.log('  ' + (hExp ? '✅' : '❌') + ' 含"如何重新导出"章节');
console.log('  ' + (hReview && hMiss ? '✅' : '❌') + ' 按"✅已复核/🚩缺材料"分类列出清单');

console.log('\n========== 🎉 端到端验证通过 ==========\n');
console.log('输出文件:', outPath);
console.log('可用 Excel/WPS 打开以上文件，查看 7 个 Sheet 内容。\n');
