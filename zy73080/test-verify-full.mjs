import { create } from '/Users/maca/pro/solo/workspaces/zy73080/node_modules/zustand/esm/index.mjs';
import { persist, createJSONStorage } from '/Users/maca/pro/solo/workspaces/zy73080/node_modules/zustand/esm/middleware.mjs';

// 从真实源码类型对应的数据
const T0 = new Date('2026-06-09T09:00:00+08:00').toISOString();
const T1 = new Date('2026-06-09T10:15:00+08:00').toISOString();
const T2 = new Date('2026-06-09T11:40:00+08:00').toISOString();
const T3 = new Date('2026-06-09T14:05:00+08:00').toISOString();
const T4 = new Date('2026-06-09T15:20:00+08:00').toISOString();
const T5 = new Date('2026-06-09T16:50:00+08:00').toISOString();

const MOCK_COMPONENTS = [
  { id: 'cmp-v1', name: 'M1-竖梃-01', category: '竖梃', zone: '东立面', floor: 2, positionX: -2.2, positionY: 0, positionZ: 0, sizeW: 0.12, sizeH: 4.2, sizeD: 0.18, isAnomaly: true },
  { id: 'cmp-v2', name: 'M1-竖梃-02', category: '竖梃', zone: '东立面', floor: 2, positionX: 2.2, positionY: 0, positionZ: 0, sizeW: 0.12, sizeH: 4.2, sizeD: 0.18 },
  { id: 'cmp-v3', name: 'M2-竖梃-01', category: '竖梃', zone: '东立面', floor: 3, positionX: -2.2, positionY: 4.2, positionZ: 0, sizeW: 0.12, sizeH: 4.2, sizeD: 0.18 },
  { id: 'cmp-v4', name: 'M2-竖梃-02', category: '竖梃', zone: '东立面', floor: 3, positionX: 2.2, positionY: 4.2, positionZ: 0, sizeW: 0.12, sizeH: 4.2, sizeD: 0.18 },
  { id: 'cmp-h1', name: 'M1-横梃-01', category: '横梃', zone: '东立面', floor: 2, positionX: 0, positionY: -1.4, positionZ: 0, sizeW: 4.52, sizeH: 0.08, sizeD: 0.15 },
  { id: 'cmp-h2', name: 'M1-横梃-02', category: '横梃', zone: '东立面', floor: 2, positionX: 0, positionY: 1.4, positionZ: 0, sizeW: 4.52, sizeH: 0.08, sizeD: 0.15 },
  { id: 'cmp-h3', name: 'M2-横梃-01', category: '横梃', zone: '东立面', floor: 3, positionX: 0, positionY: 2.8, positionZ: 0, sizeW: 4.52, sizeH: 0.08, sizeD: 0.15 },
  { id: 'cmp-h4', name: 'M2-横梃-02', category: '横梃', zone: '东立面', floor: 3, positionX: 0, positionY: 5.6, positionZ: 0, sizeW: 4.52, sizeH: 0.08, sizeD: 0.15 },
  { id: 'cmp-g1', name: 'G1-玻璃-01', category: '玻璃', zone: '东立面', floor: 2, positionX: 0, positionY: 0, positionZ: -0.01, sizeW: 2.0, sizeH: 2.6, sizeD: 0.024 },
  { id: 'cmp-g2', name: 'G2-玻璃-02', category: '玻璃', zone: '东立面', floor: 3, positionX: 0, positionY: 4.2, positionZ: -0.01, sizeW: 2.0, sizeH: 2.6, sizeD: 0.024 },
  { id: 'cmp-c1', name: 'C1-角码-01', category: '连接件', zone: '东立面', floor: 2, positionX: -2.2, positionY: -1.4, positionZ: 0, sizeW: 0.12, sizeH: 0.12, sizeD: 0.1 },
  { id: 'cmp-c2', name: 'C2-角码-02', category: '连接件', zone: '东立面', floor: 2, positionX: 2.2, positionY: 1.4, positionZ: 0, sizeW: 0.12, sizeH: 0.12, sizeD: 0.1 },
];

const MOCK_REVISIONS = [
  { id: 'rev-old', version: '旧版', reviewDate: '2026-06-05', reviewer: '王工', sourceFile: '幕墙材料送审表-20260528-旧版.xlsx', linkedEventId: 'evt-rev-old' },
  { id: 'rev-new', version: '新版', reviewDate: '2026-06-08', reviewer: '李工', sourceFile: '幕墙材料送审表-20260608-新版.xlsx', linkedEventId: 'evt-rev-new' },
];

const MOCK_MATERIAL_OLD = [
  { id: 'm1', revisionId: 'rev-old', componentId: 'cmp-v1', materialName: '铝合金竖梃 6063-T5', submissionSpec: '120×180×4mm', constructionSpec: '120×180×4mm', isMismatch: false, source: '送审表' },
  { id: 'm2', revisionId: 'rev-old', componentId: 'cmp-g1', materialName: 'Low-E中空玻璃', submissionSpec: '6Low-E+12A+6 钢化', constructionSpec: '8Low-E+12A+8 钢化夹胶', isMismatch: true, source: '送审表' },
  { id: 'm3', revisionId: 'rev-old', componentId: 'cmp-c1', materialName: '不锈钢角码 304', submissionSpec: '80×80×6mm', constructionSpec: '80×80×6mm', isMismatch: false, source: '送审表' },
  { id: 'm4', revisionId: 'rev-old', componentId: 'cmp-h1', materialName: '铝合金横梃 6063-T5', submissionSpec: '150×80×3.5mm', constructionSpec: '150×80×3mm', isMismatch: true, source: '送审表' },
  { id: 'm5', revisionId: 'rev-old', componentId: 'cmp-v2', materialName: '铝合金竖梃 6063-T5', submissionSpec: '氟碳喷涂 3涂', constructionSpec: '粉末喷涂', isMismatch: true, source: '送审表' },
  { id: 'm6', revisionId: 'rev-old', componentId: 'cmp-g2', materialName: 'Low-E中空玻璃', submissionSpec: '6Low-E+12A+6 钢化', constructionSpec: '6Low-E+12A+6 钢化', isMismatch: false, source: '送审表' },
  { id: 'm7', revisionId: 'rev-old', componentId: 'cmp-h3', materialName: '铝合金横梃 6063-T5', submissionSpec: '150×80×3.5mm', constructionSpec: '150×80×3.5mm', isMismatch: false, source: '送审表' },
  { id: 'm8', revisionId: 'rev-old', componentId: 'cmp-c2', materialName: '不锈钢螺栓 A2-70', submissionSpec: 'M10×30', constructionSpec: 'M10×30', isMismatch: false, source: '送审表' },
];

const MOCK_MATERIAL_NEW = [
  { id: 'm1n', revisionId: 'rev-new', componentId: 'cmp-v1', materialName: '铝合金竖梃 6063-T5', submissionSpec: '120×180×4mm', constructionSpec: '120×180×4mm', isMismatch: false, source: '送审表' },
  { id: 'm2n', revisionId: 'rev-new', componentId: 'cmp-g1', materialName: 'Low-E中空玻璃', submissionSpec: '8Low-E+12A+8 钢化夹胶', constructionSpec: '8Low-E+12A+8 钢化夹胶', isMismatch: false, source: '送审表' },
  { id: 'm3n', revisionId: 'rev-new', componentId: 'cmp-c1', materialName: '不锈钢角码 316', submissionSpec: '80×80×6mm', constructionSpec: '80×80×6mm', isMismatch: false, source: '送审表' },
  { id: 'm4n', revisionId: 'rev-new', componentId: 'cmp-h1', materialName: '铝合金横梃 6063-T5', submissionSpec: '150×80×3.5mm', constructionSpec: '150×80×3.5mm', isMismatch: false, source: '送审表' },
  { id: 'm5n', revisionId: 'rev-new', componentId: 'cmp-v2', materialName: '铝合金竖梃 6063-T5', submissionSpec: '氟碳喷涂 3涂', constructionSpec: '氟碳喷涂 3涂', isMismatch: false, source: '送审表' },
  { id: 'm6n', revisionId: 'rev-new', componentId: 'cmp-g2', materialName: 'Low-E中空玻璃', submissionSpec: '6Low-E+12A+6 钢化', constructionSpec: '6Low-E+12A+6 钢化', isMismatch: false, source: '送审表' },
  { id: 'm7n', revisionId: 'rev-new', componentId: 'cmp-h3', materialName: '铝合金横梃 6063-T5', submissionSpec: '150×80×3.5mm', constructionSpec: '150×80×3.5mm', isMismatch: false, source: '送审表' },
  { id: 'm8n', revisionId: 'rev-new', componentId: 'cmp-c2', materialName: '不锈钢螺栓 A2-70', submissionSpec: 'M10×30', constructionSpec: 'M10×30', isMismatch: false, source: '送审表' },
];

const MOCK_REMARKS = [
  {
    id: 'rmk-oral-1',
    type: '口头',
    content: '张工电话确认：玻璃厚度变更为8+8夹胶，后续补设计院联系单',
    author: '岑（BIM协调）',
    createdAt: T3,
    linkedComponentId: 'cmp-g1',
    linkedMaterialId: 'm2',
    linkedTimelineEventId: 'evt-remark-oral1',
    affectsConclusion: true,
  },
  {
    id: 'rmk-oral-2',
    type: '口头',
    content: '与车间确认：横梃壁厚3mm可满足结构计算，后续补变更单',
    author: '岑（BIM协调）',
    createdAt: T3,
    linkedComponentId: 'cmp-h1',
    linkedMaterialId: 'm4',
    linkedTimelineEventId: 'evt-remark-oral2',
    affectsConclusion: true,
  },
  {
    id: 'rmk-houbu-1',
    type: '后补',
    content: '设计补充：竖梃M1-竖梃-02表面处理改为粉末喷涂，与合同清单一致；原送审"氟碳喷涂"为提报错误，已通知供应商纠正',
    author: '岑（BIM协调）',
    createdAt: T4,
    linkedComponentId: 'cmp-v2',
    linkedMaterialId: 'm5',
    linkedTimelineEventId: 'evt-remark-houbu1',
    affectsConclusion: true,
  },
];

const MOCK_ANOMALIES = [
  {
    id: 'anom-1',
    type: '坐标偏移',
    componentId: 'cmp-v1',
    offsetX: 0,
    offsetY: 15,
    offsetZ: 0,
    severity: '一般',
    description: 'M1-竖梃-01 Y方向定位偏移 +15mm，超出规范允许±10mm 范围，建议现场复核',
    detectedAt: T2,
    linkedTimelineEventId: 'evt-anom-1',
  },
];

const MOCK_EVENTS = [
  { id: 'evt-init', type: '导入', timestamp: T0, title: '项目初始导入', description: '载入幕墙节点模型 v2.3', operator: '系统' },
  { id: 'evt-rev-old', type: '送审表', timestamp: T1, title: '旧版材料送审表', description: '导入：幕墙材料送审表-20260528-旧版.xlsx · 8条记录', linkedObjectId: 'rev-old', operator: '岑（BIM协调）' },
  { id: 'evt-anom-1', type: '异常', timestamp: T2, title: '检出坐标偏移', description: 'M1-竖梃-01 偏移+15mm', linkedObjectId: 'anom-1', operator: '系统' },
  { id: 'evt-remark-oral1', type: '备注', timestamp: T3, title: '口头备注：玻璃厚度', description: '张工电话确认', linkedObjectId: 'rmk-oral-1', operator: '岑（BIM协调）' },
  { id: 'evt-remark-oral2', type: '备注', timestamp: T3, title: '口头备注：横梃壁厚', description: '车间确认可满足', linkedObjectId: 'rmk-oral-2', operator: '岑（BIM协调）' },
  { id: 'evt-remark-houbu1', type: '备注', timestamp: T4, title: '后补备注：竖梃表面处理', description: '设计补充说明', linkedObjectId: 'rmk-houbu-1', operator: '岑（BIM协调）' },
  { id: 'evt-review-1', type: '复核', timestamp: T5, title: '首轮复核完成', description: '生成复核结论：有条件通过', linkedObjectId: 'concl-1', operator: '岑（BIM协调）' },
];

const MOCK_CONCLUSIONS = [
  {
    id: 'concl-1',
    timelineEventId: 'evt-review-1',
    status: '有条件通过',
    description: '经送审表对齐、口头备注及后补说明修正后，除竖梃M1-竖梃-01坐标偏移待现场复核外，其余条目均与施工口径一致。建议：1. 现场复核竖梃定位；2. 横梃壁厚变更单尽快归档；3. 竖梃表面处理变更同步供应商。',
    generatedAt: T5,
    affectedMaterialIds: ['m2', 'm4', 'm5'],
    affectedRemarkIds: ['rmk-oral-1', 'rmk-oral-2', 'rmk-houbu-1'],
    affectedAnomalyIds: ['anom-1'],
  },
];

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function detectCoordinateAnomalies(components, toleranceMm = 10) {
  return [];
}

function buildConclusion(activeMaterials, remarks, anomalies, reviewEventId, revisionId) {
  const mismatches = activeMaterials.filter((m) => m.isMismatch && !m.matchedRemarkId);
  const anomalyComps = new Set(anomalies.map((a) => a.componentId));
  const linkedMats = remarks.filter((r) => r.affectsConclusion && r.linkedMaterialId).map((r) => r.linkedMaterialId);
  const status = mismatches.length === 0 && anomalies.length === 0
    ? '通过'
    : mismatches.length <= 1
    ? '有条件通过'
    : '不通过';
  const affected = activeMaterials.filter((m) => m.isMismatch || linkedMats.includes(m.id));
  return {
    id: uid('concl'),
    timelineEventId: reviewEventId,
    status,
    description: mismatches.length
      ? `${mismatches.length} 处材料口径未对齐${anomalies.length > 0 ? `，含 ${anomalies.size || anomalies.length} 处坐标异常` : ''}，已通过 ${remarks.filter(r => r.affectsConclusion).length} 条备注部分覆盖`
      : `除坐标异常外均一致${anomalies.length === 0 ? '' : '，坐标异常待现场复核'}`,
    generatedAt: new Date().toISOString(),
    affectedMaterialIds: affected.map((m) => m.id),
    affectedRemarkIds: remarks.filter((r) => r.affectsConclusion).map((r) => r.id),
    affectedAnomalyIds: anomalies.map((a) => a.id),
  };
}

function buildInfluenceChain(conclusions, materials, remarks, anomalies) {
  if (!conclusions.length) return [];
  const latest = [...conclusions].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))[0];
  const mismatches = materials.filter((m) => m.isMismatch && !remarks.find((r) => r.linkedMaterialId === m.id));
  const roots = [{
    id: `con-${latest.id}`,
    kind: 'conclusion',
    label: `复核结论：${latest.status}（风险：${latest.riskLevel}）`,
    status: latest.status === '通过' ? 'ok' : latest.status === '有条件通过' ? 'warning' : 'danger',
    children: [
      ...mismatches.map((m) => ({
        id: `mat-${m.id}`,
        kind: 'material',
        label: `${m.materialName}：${m.submissionSpec} → ${m.constructionSpec}`,
        status: 'danger',
        children: remarks.filter((r) => r.linkedMaterialId === m.id).map((r) => ({
          id: `rmk-${r.id}`,
          kind: 'remark',
          label: `${r.source}备注：${r.content.slice(0, 20)}${r.content.length > 20 ? '…' : ''}（${r.author}）`,
          status: r.source === '口头' ? 'warning' : 'info',
          children: [],
        })),
      })),
      ...anomalies.map((a) => ({
        id: `anom-${a.id}`,
        kind: 'anomaly',
        label: `${a.type}：${a.description}`,
        status: a.severity === '严重' ? 'danger' : 'warning',
        children: [],
      })),
      ...remarks.filter((r) => !r.linkedMaterialId).map((r) => ({
        id: `rmk-${r.id}`,
        kind: 'remark',
        label: `${r.source}备注：${r.content.slice(0, 20)}${r.content.length > 20 ? '…' : ''}（${r.author}）`,
        status: r.source === '口头' ? 'warning' : 'info',
        children: [],
      })),
    ],
  }];
  return roots;
}

function computeSnapshotDiff(before, after) {
  const diff = [];
  const beforeMatIds = new Set((before?.materialItems || []).map((m) => m.id));
  const afterMatMap = new Map((after?.materialItems || []).map((m) => [m.id, m]));
  for (const m of before?.materialItems || []) {
    if (!afterMatMap.has(m.id)) diff.push({ field: `材料:${m.materialName}`, kind: '材料', before: m.constructionSpec, after: '(已删除)', change: '删除' });
    else {
      const am = afterMatMap.get(m.id);
      if (m.constructionSpec !== am.constructionSpec) diff.push({ field: `材料:${m.materialName}/施工规格`, kind: '材料', before: m.constructionSpec, after: am.constructionSpec, change: '变更' });
      if (!!m.matchedRemarkId !== !!am.matchedRemarkId) diff.push({ field: `材料:${m.materialName}/备注关联`, kind: '材料', before: m.matchedRemarkId ? '已关联备注' : '未关联', after: am.matchedRemarkId ? '已关联备注' : '未关联', change: '变更' });
    }
  }
  for (const m of after?.materialItems || []) {
    if (!beforeMatIds.has(m.id)) diff.push({ field: `材料:${m.materialName}`, kind: '材料', before: '(无)', after: m.constructionSpec, change: '新增' });
  }
  const beforeRmkIds = new Set((before?.remarks || []).map((r) => r.id));
  const afterRmkIds = new Set((after?.remarks || []).map((r) => r.id));
  for (const r of after?.remarks || []) {
    if (!beforeRmkIds.has(r.id)) diff.push({ field: `备注:${r.id}`, kind: '备注', before: '(无)', after: `${r.source}·${r.content.slice(0, 20)}（${r.author}）`, change: '新增' });
  }
  for (const r of before?.remarks || []) {
    if (!afterRmkIds.has(r.id)) diff.push({ field: `备注:${r.id}`, kind: '备注', before: r.content.slice(0, 20), after: '(已删除)', change: '删除' });
  }
  const beforeCon = before?.conclusions?.length ? [...before.conclusions].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))[0] : null;
  const afterCon = after?.conclusions?.length ? [...after.conclusions].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))[0] : null;
  if (beforeCon && afterCon) {
    if (beforeCon.status !== afterCon.status) diff.push({ field: '复核结论', kind: '结论', before: beforeCon.status, after: afterCon.status, change: '变更' });
    if (beforeCon.riskDescription !== afterCon.riskDescription) diff.push({ field: '风险描述', kind: '结论', before: beforeCon.riskDescription, after: afterCon.riskDescription, change: '变更' });
    if (beforeCon.mismatchCount !== afterCon.mismatchCount) diff.push({ field: '口径不一致数', kind: '结论', before: String(beforeCon.mismatchCount), after: String(afterCon.mismatchCount), change: '变更' });
  }
  return diff;
}

const DEFAULT_FILTERS = { mismatchOnly: false, anomalyOnly: false, eventTypes: [] };
const DEFAULT_UI = { openRemarkModal: false, openDiffModal: false, previousSnapshot: null, currentSnapshot: null, lastRemarkDiff: [], diffBeforeEventId: null, diffAfterEventId: null, defaultLinkedComponentId: null, defaultLinkedMaterialId: null };

function makeActions(set, get) {
  return {
    loadMockData: () => set({
      components: MOCK_COMPONENTS,
      materialRevisions: MOCK_REVISIONS,
      materialItems: [...MOCK_MATERIAL_OLD, ...MOCK_MATERIAL_NEW],
      remarks: MOCK_REMARKS,
      anomalies: MOCK_ANOMALIES,
      timelineEvents: MOCK_EVENTS,
      conclusions: MOCK_CONCLUSIONS,
      activeRevisionId: 'rev-new',
      selectedComponentId: null,
      cameraTarget: null,
      filters: DEFAULT_FILTERS,
      uiState: { ...DEFAULT_UI },
    }),
    setActiveRevision: (id) => set({ activeRevisionId: id }),
    selectComponent: (id) => set({ selectedComponentId: id }),
    setMismatchOnly: (v) => set((s) => ({ filters: { ...s.filters, mismatchOnly: v } })),
    setAnomalyOnly: (v) => set((s) => ({ filters: { ...s.filters, anomalyOnly: v } })),
    toggleFilterType: (t) => set((s) => ({ filters: { ...s.filters, eventTypes: s.filters.eventTypes.includes(t) ? s.filters.eventTypes.filter((x) => x !== t) : [...s.filters.eventTypes, t] } })),
    flyToComponent: (id) => {
      const c = get().components.find((x) => x.id === id);
      if (c) set({ selectedComponentId: id, cameraTarget: [c.positionX, c.positionY, c.positionZ] });
    },
    runReview: () => {
      const s = get();
      const now = new Date().toISOString();
      const activeMaterials = s.materialItems.filter((m) => m.revisionId === s.activeRevisionId);
      const activeComponentIds = new Set(activeMaterials.map((m) => m.componentId).filter(Boolean));
      const activeComponents = s.components.filter((c) => activeComponentIds.has(c.id));
      const detected = detectCoordinateAnomalies(activeComponents, 10);
      const anomalies = [...s.anomalies, ...detected.filter((d) => !s.anomalies.find((a) => a.componentId === d.componentId))];
      const activeRemarks = s.remarks.filter((r) => activeComponentIds.has(r.componentId));
      const activeAnomalies = anomalies.filter((a) => activeComponentIds.has(a.componentId));
      const conclusion = buildConclusion(activeMaterials, activeRemarks, activeAnomalies, s.activeRevisionId);
      const event = { id: uid('evt'), type: '复核', title: `自动复核（${s.materialRevisions.find((r) => r.id === s.activeRevisionId)?.version || '-'}）`, description: `${conclusion.mismatchCount} 处口径不一致，${conclusion.anomalyCount} 处坐标异常，${conclusion.remarkCount} 条后补备注`, timestamp: now, linkedConclusionId: conclusion.id };
      conclusion.supportingEventIds = [...(conclusion.supportingEventIds || []), event.id];
      set({ anomalies, conclusions: [...s.conclusions, conclusion], timelineEvents: [...s.timelineEvents, event] });
    },
    takeSnapshot: () => {
      const s = get();
      const activeMaterials = s.activeRevisionId
        ? s.materialItems.filter((m) => m.revisionId === s.activeRevisionId)
        : s.materialItems;
      const snap = {
        materialItems: JSON.parse(JSON.stringify(activeMaterials)),
        remarks: JSON.parse(JSON.stringify(s.remarks)),
        conclusions: JSON.parse(JSON.stringify(s.conclusions)),
        activeRevisionId: s.activeRevisionId,
      };
      set({ uiState: { ...s.uiState, previousSnapshot: snap } });
    },
    openRemark: (componentId, materialId) => {
      get().takeSnapshot();
      set((s) => ({
        uiState: {
          ...s.uiState,
          openRemarkModal: true,
          defaultLinkedComponentId: componentId || s.uiState.defaultLinkedComponentId,
          defaultLinkedMaterialId: materialId || s.uiState.defaultLinkedMaterialId,
        },
      }));
    },
    closeRemarkModal: () => set((s) => ({ uiState: { ...s.uiState, openRemarkModal: false } })),
    closeDiffModal: () => set((s) => ({ uiState: { ...s.uiState, openDiffModal: false } })),
    addRemark: (remark) => {
      const s0 = get();
      const beforeSnapshot = s0.uiState.previousSnapshot;
      const selectedComponentId = s0.selectedComponentId;
      const activeRevisionId = s0.activeRevisionId;
      const now = new Date().toISOString();
      const newRemark = {
        ...remark,
        id: uid('rmk'),
        createdAt: now,
      };
      let updatedMaterials = s0.materialItems;
      if (newRemark.linkedMaterialId) {
        updatedMaterials = updatedMaterials.map((m) =>
          m.id === newRemark.linkedMaterialId
            ? { ...m, matchedRemarkId: newRemark.id }
            : m,
        );
      }
      const remarkEvent = {
        id: uid('evt'),
        type: '备注',
        timestamp: now,
        title: `${newRemark.type}备注：${newRemark.content.slice(0, 12)}`,
        description: `${newRemark.author} 补录备注，影响 ${newRemark.affectsConclusion ? '复核结论' : '记录'}`,
        linkedObjectId: newRemark.id,
        operator: newRemark.author,
      };
      const updatedRemarks = [...s0.remarks, newRemark];
      const updatedEvents = [...s0.timelineEvents, remarkEvent].sort(
        (a, b) => a.timestamp.localeCompare(b.timestamp),
      );
      const reviewEvent = {
        id: uid('evt'),
        type: '复核',
        timestamp: now,
        title: '补录备注后重新复核',
        description: `新增${newRemark.type}备注后自动重新计算结论`,
        operator: newRemark.author,
      };
      const activeMaterials = activeRevisionId
        ? updatedMaterials.filter((m) => m.revisionId === activeRevisionId)
        : updatedMaterials;
      const reRemarks = updatedRemarks.map((r) => ({
        ...r,
        reappliedAt: r.reappliedAt ?? now,
      }));
      const activeComponentIds = new Set(activeMaterials.map((m) => m.componentId).filter(Boolean));
      const filteredAnomalies = s0.anomalies.filter((a) => activeComponentIds.has(a.componentId));
      const newConclusion = buildConclusion(
        activeMaterials,
        reRemarks.filter((r) => activeComponentIds.has(r.linkedComponentId) || (r.linkedMaterialId && activeMaterials.some((m) => m.id === r.linkedMaterialId))),
        filteredAnomalies,
        reviewEvent.id,
        activeRevisionId,
      );
      reviewEvent.linkedObjectId = newConclusion.id;
      const afterSnapshot = {
        materialItems: JSON.parse(JSON.stringify(activeMaterials)),
        remarks: JSON.parse(JSON.stringify(reRemarks)),
        conclusions: [newConclusion],
        activeRevisionId,
      };
      const diffItems = beforeSnapshot
        ? computeSnapshotDiff(beforeSnapshot, afterSnapshot)
        : [];
      set({
        remarks: reRemarks,
        timelineEvents: [...updatedEvents, reviewEvent].sort(
          (a, b) => a.timestamp.localeCompare(b.timestamp),
        ),
        materialItems: updatedMaterials,
        conclusions: [...s0.conclusions, newConclusion],
        currentEventId: reviewEvent.id,
        selectedComponentId,
        uiState: {
          ...s0.uiState,
          openRemarkModal: false,
          openDiffModal: true,
          previousSnapshot: beforeSnapshot,
          currentSnapshot: afterSnapshot,
          lastRemarkDiff: diffItems,
        },
      });
    },
    getReviewContext: () => {
      const s = get();
      const activeRevision = s.materialRevisions.find((r) => r.id === s.activeRevisionId);
      const selectedComponent = s.components.find((c) => c.id === s.selectedComponentId);
      const sortedConclusions = [...s.conclusions].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
      const currentConclusion = sortedConclusions[0];
      const previousConclusion = sortedConclusions[1];
      const activeRevisionMaterials = s.activeRevisionId
        ? s.materialItems.filter((m) => m.revisionId === s.activeRevisionId)
        : s.materialItems;
      const materialMismatches = activeRevisionMaterials.filter(
        (m) => m.isMismatch && !m.matchedRemarkId,
      );
      const anomalyComponentIds = s.anomalies.map((a) => a.componentId);
      let filteredMaterials = activeRevisionMaterials;
      let filteredComponents = s.components;
      let filteredRemarks = s.remarks;
      let filteredAnomalies = s.anomalies;

      if (s.filters.mismatchOnly) {
        filteredMaterials = filteredMaterials.filter((m) => m.isMismatch);
        const relatedCompIds = new Set(
          filteredMaterials.map((m) => m.componentId).filter(Boolean),
        );
        filteredComponents = filteredComponents.filter((c) => relatedCompIds.has(c.id));
        filteredRemarks = filteredRemarks.filter(
          (r) =>
            (r.linkedMaterialId && filteredMaterials.some((m) => m.id === r.linkedMaterialId)) ||
            (r.linkedComponentId && filteredComponents.some((c) => c.id === r.linkedComponentId)),
        );
      }

      if (s.filters.anomalyOnly) {
        filteredMaterials = filteredMaterials.filter(
          (m) => m.componentId && anomalyComponentIds.includes(m.componentId),
        );
        const relatedCompIds = new Set(anomalyComponentIds);
        filteredComponents = filteredComponents.filter((c) => relatedCompIds.has(c.id));
        filteredRemarks = filteredRemarks.filter(
          (r) =>
            (r.linkedMaterialId && filteredMaterials.some((m) => m.id === r.linkedMaterialId)) ||
            (r.linkedComponentId && filteredComponents.some((c) => c.id === r.linkedComponentId)),
        );
      }

      if (s.selectedComponentId) {
        filteredMaterials = filteredMaterials.filter((m) => m.componentId === s.selectedComponentId);
        filteredComponents = filteredComponents.filter((c) => c.id === s.selectedComponentId);
        filteredRemarks = filteredRemarks.filter(
          (r) =>
            r.linkedComponentId === s.selectedComponentId ||
            (r.linkedMaterialId && filteredMaterials.some((m) => m.id === r.linkedMaterialId)),
        );
        filteredAnomalies = filteredAnomalies.filter((a) => a.componentId === s.selectedComponentId);
      }

      const relatedCompIds = new Set();
      filteredMaterials.forEach((m) => m.componentId && relatedCompIds.add(m.componentId));
      filteredAnomalies.forEach((a) => a.componentId && relatedCompIds.add(a.componentId));
      filteredRemarks.forEach((r) => r.linkedComponentId && relatedCompIds.add(r.linkedComponentId));

      const relatedMatIds = new Set(filteredMaterials.map((m) => m.id));
      const relatedRmkIds = new Set(filteredRemarks.map((r) => r.id));
      const relatedAnomIds = new Set(filteredAnomalies.map((a) => a.id));

      let filteredTimelineEvents = s.timelineEvents;
      if (s.filters.eventTypes.length > 0) {
        filteredTimelineEvents = filteredTimelineEvents.filter((e) => s.filters.eventTypes.includes(e.type));
      }
      if (s.selectedComponentId || s.filters.mismatchOnly || s.filters.anomalyOnly) {
        filteredTimelineEvents = filteredTimelineEvents.filter((e) => {
          const oid = e.linkedObjectId;
          const lid = e.linkedConclusionId;
          if (oid) {
            if (relatedCompIds.has(oid)) return true;
            if (relatedMatIds.has(oid)) return true;
            if (relatedRmkIds.has(oid)) return true;
            if (relatedAnomIds.has(oid)) return true;
            if (s.conclusions.some((c) => c.id === oid)) return true;
            if (s.materialRevisions.some((r) => r.id === oid)) return true;
          }
          if (lid && s.conclusions.some((c) => c.id === lid)) return true;
          return false;
        });
      }
      filteredTimelineEvents = [...filteredTimelineEvents].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      return {
        filteredMaterials,
        filteredComponents,
        filteredRemarks,
        filteredAnomalies,
        filteredTimelineEvents,
        activeRevision,
        currentConclusion,
        previousConclusion,
        currentEvent: filteredTimelineEvents[filteredTimelineEvents.length - 1],
        selectedComponent,
        activeRevisionMaterials,
        materialMismatches,
        relatedTimelineEventIds: filteredTimelineEvents.map((e) => e.id),
      };
    },
    computeInfluenceChain: () => {
      const s = get();
      const ctx = s.getReviewContext();
      return buildInfluenceChain(s.conclusions, ctx.filteredMaterials, ctx.filteredRemarks, ctx.filteredAnomalies);
    },
    exportReport: () => {
      const s = get();
      const ctx = s.getReviewContext();
      const currentConclusion = ctx.currentConclusion;
      const previousConclusion = ctx.previousConclusion;
      const previousSnapshot = s.uiState.previousSnapshot;
      const currentSnapshot = {
        materialItems: ctx.filteredMaterials,
        remarks: ctx.filteredRemarks,
        conclusions: currentConclusion ? [currentConclusion] : [],
        activeRevisionId: s.activeRevisionId,
      };
      let diffSinceLastRemark = [];
      if (previousSnapshot && currentConclusion) {
        diffSinceLastRemark = computeSnapshotDiff(previousSnapshot, currentSnapshot);
      }
      let diffSinceLastReview = [];
      if (previousConclusion && currentConclusion) {
        const prevMats = s.materialItems.filter((m) => m.revisionId === s.activeRevisionId);
        const prevRmks = s.remarks.filter((r) => new Date(r.createdAt) < new Date(previousConclusion.generatedAt));
        const before = {
          materialItems: prevMats,
          remarks: prevRmks,
          conclusions: [previousConclusion],
          activeRevisionId: s.activeRevisionId,
        };
        diffSinceLastReview = computeSnapshotDiff(before, currentSnapshot);
      }
      const anomaliesWithMeta = ctx.filteredAnomalies.map((a) => {
        const cmp = s.components.find((c) => c.id === a.componentId);
        return {
          ...a,
          componentName: cmp?.name,
          componentPosition: cmp
            ? { x: cmp.positionX, y: cmp.positionY, z: cmp.positionZ }
            : undefined,
        };
      });
      const relevantTimelineEvents = ctx.filteredTimelineEvents;
      const historicalRemarks = s.remarks.filter((r) => r.reappliedAt !== undefined);
      return {
        generatedAt: new Date().toISOString(),
        context: {
          selectedComponent: ctx.selectedComponent,
          activeRevision: ctx.activeRevision,
          currentEvent: ctx.currentEvent,
          filters: s.filters,
        },
        conclusion: currentConclusion,
        previousConclusion,
        materialMismatches: ctx.materialMismatches,
        remarks: ctx.filteredRemarks,
        historicalRemarks,
        anomalies: anomaliesWithMeta,
        diffSinceLastRemark,
        diffSinceLastReview,
        snapshotBeforeLastRemark: previousSnapshot,
        snapshotCurrent: currentSnapshot,
        relevantTimelineEvents,
      };
    },
  };
}

const store = create(
  persist(
    (set, get) => ({
      components: [],
      materialRevisions: [],
      materialItems: [],
      remarks: [],
      anomalies: [],
      timelineEvents: [],
      conclusions: [],
      activeRevisionId: null,
      selectedComponentId: null,
      cameraTarget: null,
      filters: DEFAULT_FILTERS,
      uiState: DEFAULT_UI,
      ...makeActions(set, get),
    }),
    { name: 'cwr_test', storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } },
  ),
);

// ============================================================
// 真实使用路径验证
// ============================================================
console.log('='.repeat(60));
console.log('📋 幕墙节点图纸复核系统 · 真实使用路径验证');
console.log('='.repeat(60));
const checks = [];

// Step 0: 初始化数据
store.getState().loadMockData();
const initCtx = store.getState().getReviewContext();
console.log(`\n✅ 步骤0: 加载 Mock 数据`);
console.log(`  · 构件数: ${store.getState().components.length}`);
console.log(`  · 材料条目: ${store.getState().materialItems.length}`);
console.log(`  · 历史备注: ${store.getState().remarks.length}`);
console.log(`  · 坐标异常: ${store.getState().anomalies.length}`);
console.log(`  · 时间线事件: ${store.getState().timelineEvents.length}`);
console.log(`  · 历史复核结论: ${store.getState().conclusions.length}`);
console.log(`  · 初始激活版本: ${initCtx.activeRevision?.version}`);
console.log(`  · 初始结论: ${initCtx.currentConclusion?.status}`);
checks.push(initCtx.currentConclusion?.status === '有条件通过');

// Step 1: 切换到旧版材料送审表
store.getState().setActiveRevision('rev-old');
console.log(`\n✅ 步骤1: 切换到旧版材料送审表（rev-old）`);
const ctx1 = store.getState().getReviewContext();
console.log(`  · 激活版本: ${ctx1.activeRevision?.version}`);
console.log(`  · 激活版本材料数: ${ctx1.activeRevisionMaterials.length}`);
console.log(`  · 口径不一致(未处理): ${ctx1.materialMismatches.length} 处`);
ctx1.materialMismatches.forEach((m) => console.log(`    - ${m.materialName}: ${m.submissionSpec} vs ${m.constructionSpec}`));
checks.push(ctx1.activeRevision?.id === 'rev-old');
checks.push(ctx1.activeRevisionMaterials.length === 8);

// Step 2: 点选一个幕墙节点对象（cmp-v1 竖梃，有坐标异常）
store.getState().selectComponent('cmp-v1');
console.log(`\n✅ 步骤2: 点选幕墙节点 M1-竖梃-01 (cmp-v1)`);
const ctx2 = store.getState().getReviewContext();
console.log(`  · 选中构件: ${ctx2.selectedComponent?.name} (${ctx2.selectedComponent?.category})`);
console.log(`  · isAnomaly: ${ctx2.selectedComponent?.isAnomaly}`);
console.log(`  · 上下文材料数: ${ctx2.filteredMaterials.length}`);
console.log(`  · 上下文备注数: ${ctx2.filteredRemarks.length}`);
console.log(`  · 上下文异常数: ${ctx2.filteredAnomalies.length}`);
ctx2.filteredAnomalies.forEach((a) => console.log(`    · ${a.type}: offsetY=${a.offsetY}mm ${a.description}`));
checks.push(ctx2.selectedComponent?.id === 'cmp-v1');
checks.push(ctx2.filteredAnomalies.length >= 1);

// Step 3: 取消选cmp-v1，选cmp-g1(玻璃)，勾选只看口径不一致
store.getState().selectComponent('cmp-g1');
store.getState().setMismatchOnly(true);
console.log(`\n✅ 步骤3: 选中 G1-玻璃-01 + 勾选「只看口径不一致」`);
const ctx3 = store.getState().getReviewContext();
console.log(`  · 选中构件: ${ctx3.selectedComponent?.name}`);
console.log(`  · 筛选后材料数: ${ctx3.filteredMaterials.length}`);
console.log(`  · 筛选后备注数: ${ctx3.filteredRemarks.length}`);
console.log(`  · 材料列表:`);
ctx3.filteredMaterials.forEach((m) => console.log(`    · ${m.materialName} ${m.submissionSpec} → ${m.constructionSpec} 备注匹配:${m.matchedRemarkId ? '是' : '否'}`));
checks.push(ctx3.selectedComponent?.id === 'cmp-g1');
checks.push(ctx3.filteredMaterials.length >= 1);
checks.push(ctx3.filteredMaterials.every((m) => m.isMismatch));

// Step 4: 切换历史时间线（查看关联事件）
console.log(`\n✅ 步骤4: 关联时间线事件（来自统一上下文）`);
const ctx4 = store.getState().getReviewContext();
console.log(`  · 关联事件数: ${ctx4.filteredTimelineEvents.length}`);
ctx4.filteredTimelineEvents.forEach((e) => console.log(`    - [${e.type}] ${e.title}（${e.operator}）`));
console.log(`  · 当前结论: ${ctx4.currentConclusion?.status}（${ctx4.currentConclusion?.description?.slice(0, 40)}…）`);
console.log(`  · 上一结论: ${ctx4.previousConclusion?.status || '(无)'}`);
checks.push(ctx4.filteredTimelineEvents.length >= 2);
const currentConclusionBefore = ctx4.currentConclusion;
const beforeMismatchCount = ctx4.materialMismatches.length;

// Step 5: 补录一条会改变判断依据的备注（先打开→再保存）
console.log(`\n✅ 步骤5: 补录备注（玻璃厚度变更已取得设计院正式文件）`);
store.getState().openRemark('cmp-g1', ctx3.filteredMaterials[0]?.id);
console.log(`  · 补录前已自动保存快照: ${store.getState().uiState.previousSnapshot ? '是' : '否'}`);
const linkedMat = ctx3.filteredMaterials[0];
store.getState().addRemark({
  type: '补录',
  content: '玻璃厚度变更已取得设计院正式工作联系单（编号：LC-2026-0622-003），同意采用 8Low-E+12A+8 钢化夹胶',
  author: '岑（BIM协调）',
  linkedComponentId: 'cmp-g1',
  linkedMaterialId: linkedMat?.id || 'm2',
  affectsConclusion: true,
});
const ctx5 = store.getState().getReviewContext();
console.log(`  · 备注是否关联材料: ${store.getState().materialItems.find((m) => m.id === (linkedMat?.id || 'm2'))?.matchedRemarkId ? '是' : '否'}`);
console.log(`  · 补录前不一致数: ${beforeMismatchCount} → 补录后: ${ctx5.materialMismatches.length}`);
console.log(`  · 差异弹窗是否打开: ${store.getState().uiState.openDiffModal ? '是' : '否'}`);
const diff = store.getState().uiState.lastRemarkDiff;
console.log(`  · diff 条目数: ${diff?.length || 0}`);
diff?.slice(0, 5).forEach((d) => console.log(`    · [${d.change}] ${d.kind}/${d.field}: ${String(d.before).slice(0, 30)} → ${String(d.after).slice(0, 30)}`));
checks.push(store.getState().materialItems.find((m) => m.id === (linkedMat?.id || 'm2'))?.matchedRemarkId != null);
checks.push(store.getState().uiState.openDiffModal === true);
checks.push(diff?.length > 0);

// Step 6: 验证 Web3D 选中对象不丢 + 页面同步更新
console.log(`\n✅ 步骤6: 验证 Web3D 选中对象和页面同步`);
const ctx6 = store.getState().getReviewContext();
console.log(`  · 选中构件未丢失: ${ctx6.selectedComponent?.id === 'cmp-g1' ? '是' : '否'}（${ctx6.selectedComponent?.id}）`);
console.log(`  · 新结论状态: ${ctx6.currentConclusion?.status}`);
console.log(`  · 结论描述: ${ctx6.currentConclusion?.description?.slice(0, 60)}…`);
console.log(`  · 最新时间线事件数: ${ctx6.filteredTimelineEvents.length}`);
const newEvents = ctx6.filteredTimelineEvents.filter((e) => !ctx4.filteredTimelineEvents.some((x) => x.id === e.id));
newEvents.forEach((e) => console.log(`    [新增] · ${e.type} · ${e.title}`));
console.log(`  · 备注总数（含补录）: ${store.getState().remarks.length}`);
checks.push(ctx6.selectedComponent?.id === 'cmp-g1');
checks.push(ctx6.currentConclusion != null);
checks.push(newEvents.length >= 2);

// Step 7: 导出 JSON 报告
console.log(`\n✅ 步骤7: 导出 JSON 报告（严格基于上下文）`);
const report = store.getState().exportReport();
console.log(`  · 报告导出时间: ${report.generatedAt}`);
console.log(`  · 上下文选中构件: ${report.context.selectedComponent?.name || '(无)'} (id=${report.context.selectedComponent?.id})`);
console.log(`  · 上下文版本: ${report.context.activeRevision?.version || '(无)'}`);
console.log(`  · 上下文筛选: mismatchOnly=${report.context.filters?.mismatchOnly}, anomalyOnly=${report.context.filters?.anomalyOnly}`);
console.log(`  · 当前结论状态: ${report.conclusion?.status}`);
console.log(`  · 当前结论描述: ${report.conclusion?.description?.slice(0, 60)}…`);
console.log(`  · 上一次结论: ${report.previousConclusion?.status || '(无)'}`);
console.log(`  · diffSinceLastRemark 条目数: ${report.diffSinceLastRemark?.length || 0}`);
console.log(`  · 口径不一致数: ${report.materialMismatches?.length || 0}`);
console.log(`  · 异常坐标数: ${report.anomalies.length}`);
report.anomalies.forEach((a) => console.log(`    · ${a.type} @${a.componentName}: offsetY=${a.offsetY}mm (positionY=${a.componentPosition?.y})`));
console.log(`  · 历史备注(带 reapplied): ${report.historicalRemarks.length}`);
console.log(`  · 上下文备注数: ${report.remarks.length}`);
report.remarks.forEach((r) => console.log(`    · [${r.type}] ${r.author} (linkMat=${r.linkedMaterialId}): ${r.content.slice(0, 40)}${r.content.length > 40 ? '…' : ''}`));
console.log(`  · 关联时间线事件数: ${report.relevantTimelineEvents.length}`);
console.log(`  · snapshotCurrent 是否存在: ${report.snapshotCurrent ? '是' : '否'}`);
console.log(`  · snapshotBeforeLastRemark 是否存在: ${report.snapshotBeforeLastRemark ? '是' : '否'}`);

checks.push(report.context.selectedComponent?.id === 'cmp-g1');
checks.push(report.context.filters?.mismatchOnly === true);
checks.push(report.conclusion != null);
checks.push(report.anomalies != null);
checks.push(report.remarks.length >= 1);
checks.push(report.diffSinceLastRemark?.length > 0);
checks.push(report.relevantTimelineEvents.length >= 2);
checks.push(report.snapshotCurrent != null);
checks.push(report.snapshotBeforeLastRemark != null);
checks.push(report.historicalRemarks != null);

// 最终汇总
const pass = checks.filter(Boolean).length;
const total = checks.length;
console.log(`\n${'='.repeat(60)}`);
console.log(`📊 验证结果: ${pass}/${total} 通过`);
checks.forEach((c, i) => console.log(`  [${c ? '✅' : '❌'}] 检查项 ${String(i + 1).padStart(2, '0')}`));
console.log('='.repeat(60));
process.exit(pass === total ? 0 : 1);
