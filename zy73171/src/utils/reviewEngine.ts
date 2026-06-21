import type {
  BoundarySample,
  DetailRow,
  GraphData,
  GraphEdge,
  GraphNode,
  ImpactNode,
  ParamSnapshot,
  ParamTable,
  ReviewResult,
} from '../types';

const BASE_NODES: GraphNode[] = [
  { id: 'A', name: '起点 A', category: 0 },
  { id: 'B', name: '节点 B', category: 1 },
  { id: 'C', name: '节点 C', category: 1 },
  { id: 'D', name: '节点 D', category: 1 },
  { id: 'E', name: '终点 E', category: 2 },
];

const WEIGHT_PATTERN = /^weight\.([A-Z])→([A-Z])$/;

function parseWeightValue(val: string | null | undefined): number | null {
  if (val === null || val === '∅' || val === '' || val === undefined) return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

export function getParamsAtVersion(table: ParamTable, targetVersion: number): ParamSnapshot {
  const snap: ParamSnapshot = {};
  for (const row of table.rows) {
    if (row.version > targetVersion) continue;
    let value: string | null = row.value;
    let unit: string | null = row.unit;
    let isEmptySet = row.isEmptySet;
    let missingUnit = row.missingUnit;
    let lastChangedAtVersion = row.version;

    const applicableChanges = row.changes
      .filter((c) => c.versionNo <= targetVersion && c.versionNo >= row.version)
      .sort((a, b) => a.versionNo - b.versionNo || a.changedAt.localeCompare(b.changedAt));

    for (const c of applicableChanges) {
      lastChangedAtVersion = Math.max(lastChangedAtVersion, c.versionNo);
      if (c.changeType === 'value' || c.changeType === 'both') {
        value = c.newValue;
        isEmptySet = c.newValue === '∅' || c.newValue === '' || c.newValue === null;
      }
      if (c.changeType === 'unit' || c.changeType === 'both') {
        if (c.newUnit !== undefined) {
          unit = c.newUnit ?? null;
          missingUnit = unit === null || unit === '';
        }
      }
    }

    snap[row.key] = {
      key: row.key,
      value,
      unit,
      sourceRemark: row.sourceRemark,
      isEmptySet,
      missingUnit,
      introducedAtVersion: row.version,
      lastChangedAtVersion,
      batchNo: applicableChanges.length > 0 ? applicableChanges[applicableChanges.length - 1].batchNo : row.batchNo,
    };
  }
  return snap;
}

function buildEdgesFromSnapshot(snapshot: ParamSnapshot): GraphEdge[] {
  const edges: GraphEdge[] = [];
  for (const key in snapshot) {
    const row = snapshot[key];
    const m = key.match(WEIGHT_PATTERN);
    if (!m) continue;
    const w = parseWeightValue(row.value);
    if (w === null) continue;
    edges.push({ source: m[1], target: m[2], weight: w });
  }
  return edges;
}

function dijkstra(
  nodes: GraphNode[],
  edges: GraphEdge[],
  start: string,
  end: string
): { path: string[]; totalCost: number } {
  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  for (const n of nodes) {
    dist[n.id] = Infinity;
    prev[n.id] = null;
  }
  dist[start] = 0;
  const unvisited = new Set(nodes.map((n) => n.id));

  while (unvisited.size > 0) {
    let u: string | null = null;
    for (const id of unvisited) {
      if (u === null || dist[id] < dist[u]) u = id;
    }
    if (u === null || dist[u] === Infinity) break;
    unvisited.delete(u);
    if (u === end) break;
    for (const e of edges) {
      if (e.source !== u) continue;
      const alt = dist[u] + e.weight;
      if (alt < dist[e.target]) {
        dist[e.target] = alt;
        prev[e.target] = u;
      }
    }
  }

  const path: string[] = [];
  let cur: string | null = end;
  while (cur !== null) {
    path.unshift(cur);
    cur = prev[cur];
  }
  return { path: path[0] === start ? path : [], totalCost: dist[end] };
}

function buildGraph(snapshot: ParamSnapshot, sample: BoundarySample): GraphData {
  const edges = buildEdgesFromSnapshot(snapshot);
  const start = String(sample.data.origin ?? 'A');
  const end = String(sample.data.destination ?? 'E');
  const { path, totalCost } = dijkstra(BASE_NODES, edges, start, end);
  return {
    nodes: BASE_NODES.map((n) => ({ ...n, affected: path.includes(n.id) })),
    edges: edges.map((e) => ({
      ...e,
      affected: path.some((p, i) => i < path.length - 1 && p === e.source && path[i + 1] === e.target),
    })),
    path,
    totalCost,
  };
}

function edgeIsOnPath(graph: GraphData, src: string, tgt: string): boolean {
  return graph.edges.some((e) => e.source === src && e.target === tgt && e.affected);
}

function buildDetailRows(
  baseSnapshot: ParamSnapshot,
  targetSnapshot: ParamSnapshot,
  baseGraph: GraphData,
  targetGraph: GraphData,
  table: ParamTable
): DetailRow[] {
  const allKeys = new Set<string>();
  Object.keys(baseSnapshot).forEach((k) => allKeys.add(k));
  Object.keys(targetSnapshot).forEach((k) => allKeys.add(k));
  const weightKeys = Array.from(allKeys).filter((k) => WEIGHT_PATTERN.test(k)).sort();

  const rows: DetailRow[] = [];
  for (const key of weightKeys) {
    const baseRow = baseSnapshot[key];
    const targetRow = targetSnapshot[key];
    const segMatch = key.match(WEIGHT_PATTERN);
    const seg = segMatch ? `${segMatch[1]}→${segMatch[2]}` : key;
    const tableRow = table.rows.find((r) => r.key === key);
    const baseVal = baseRow ? parseWeightValue(baseRow.value) : null;
    const targetVal = targetRow ? parseWeightValue(targetRow.value) : null;
    const src = segMatch ? segMatch[1] : '';
    const tgt = segMatch ? segMatch[2] : '';
    const onBasePath = segMatch ? edgeIsOnPath(baseGraph, src, tgt) : false;
    const onTargetPath = segMatch ? edgeIsOnPath(targetGraph, src, tgt) : false;
    let delta = 0;
    if (baseVal !== null && targetVal !== null) {
      delta = Number((targetVal - baseVal).toFixed(2));
    } else if (baseVal === null && targetVal !== null) {
      delta = targetVal;
    } else if (baseVal !== null && targetVal === null) {
      delta = -baseVal;
    }
    const anyRow = targetRow || baseRow;
    rows.push({
      id: key,
      segment: seg,
      paramKey: key,
      baseValue: baseVal,
      targetValue: targetVal,
      unit: targetRow ? targetRow.unit : baseRow ? baseRow.unit : null,
      sourceRemark: anyRow ? anyRow.sourceRemark : (tableRow?.sourceRemark ?? ''),
      introducedAtVersion: anyRow ? anyRow.introducedAtVersion : (tableRow?.version ?? 0),
      lastChangedAtVersion: anyRow ? anyRow.lastChangedAtVersion : 0,
      onBasePath,
      onTargetPath,
      isValueChanged: baseVal !== targetVal || onBasePath !== onTargetPath,
      isEmptySet: targetRow ? targetRow.isEmptySet : baseRow ? baseRow.isEmptySet : true,
      missingUnit: targetRow ? targetRow.missingUnit : baseRow ? baseRow.missingUnit : true,
      delta: Number(delta.toFixed(2)),
    });
  }
  return rows;
}

function buildImpactChain(
  table: ParamTable,
  baseVersion: number,
  targetVersion: number,
  baseSnapshot: ParamSnapshot,
  targetSnapshot: ParamSnapshot
): ImpactNode[] {
  const chain: ImpactNode[] = [];
  let order = 1;
  const allKeys = new Set<string>();
  Object.keys(baseSnapshot).forEach((k) => allKeys.add(k));
  Object.keys(targetSnapshot).forEach((k) => allKeys.add(k));
  const weightKeys = Array.from(allKeys).filter((k) => WEIGHT_PATTERN.test(k)).sort();

  for (const key of weightKeys) {
    const tableRow = table.rows.find((r) => r.key === key);
    if (!tableRow) continue;
    const baseRow = baseSnapshot[key];
    const targetRow = targetSnapshot[key];

    if (baseRow && baseRow.isEmptySet) {
      chain.push({
        order: order++,
        rule: '空集合校验 R-001',
        ruleCode: 'R-001',
        ruleDescription: `参数 ${key} 在 v${baseVersion} 口径为「${baseRow.value ?? '∅'}」（空集合），原始说法：${tableRow.sourceRemark}`,
        paramKey: key,
        paramSourceRemark: tableRow.sourceRemark,
        versionNo: baseVersion,
        batchNo: baseRow.batchNo,
        isPostSupplement: false,
        before: baseRow.value ?? '∅',
        after: '∞（不可通行）',
        delta: '排除此段路径',
        deltaType: 'change',
      });
    }

    if (tableRow.missingUnit && targetRow && !targetRow.isEmptySet && !baseRow?.unit) {
      chain.push({
        order: order++,
        rule: '单位缺失校验 R-002',
        ruleCode: 'R-002',
        ruleDescription: `参数 ${key} 单位缺失，原始说法：${tableRow.sourceRemark}（${targetRow.missingUnit ? 'v' + targetVersion + ' 仍未补单位' : '在 v' + targetRow.lastChangedAtVersion + ' 已补齐'}）`,
        paramKey: key,
        paramSourceRemark: tableRow.sourceRemark,
        versionNo: targetRow ? targetRow.lastChangedAtVersion : targetVersion,
        batchNo: targetRow ? targetRow.batchNo : tableRow.batchNo,
        isPostSupplement: false,
        before: `${baseRow?.value ?? '—'}${baseRow?.unit ?? ''}`,
        after: `${targetRow?.value ?? '—'}${targetRow?.unit ?? ''}${targetRow?.missingUnit ? '（⚠ 单位待确认）' : ''}`,
        delta: targetRow?.missingUnit ? '计算需谨慎' : '单位已补',
        deltaType: 'change',
      });
    }

    const changedBetween = tableRow.changes
      .filter((c) => c.versionNo > baseVersion && c.versionNo <= targetVersion)
      .sort((a, b) => a.versionNo - b.versionNo || a.changedAt.localeCompare(b.changedAt));
    for (const change of changedBetween) {
      const oldN = parseWeightValue(change.oldValue);
      const newN = parseWeightValue(change.newValue);
      const isPost = change.versionNo > baseVersion;
      if (change.changeType === 'value' || change.changeType === 'both') {
        if (oldN !== null && newN !== null && oldN !== newN) {
          chain.push({
            order: order++,
            rule: `参数变更 R-003（v${change.versionNo} · 批次 ${change.batchNo}）`,
            ruleCode: 'R-003',
            ruleDescription: `${key} 由 ${change.changedBy} 于 ${change.changedAt} 修改；${isPost ? '属于 v' + baseVersion + ' 结论后的后补材料，叠加影响不覆盖早先判断' : '同期修订'}`,
            paramKey: key,
            paramSourceRemark: tableRow.sourceRemark,
            versionNo: change.versionNo,
            batchNo: change.batchNo,
            isPostSupplement: isPost,
            before: change.oldValue,
            after: change.newValue,
            delta: newN > oldN ? `+${(newN - oldN).toFixed(1)}` : `${(newN - oldN).toFixed(1)}`,
            deltaType: newN > oldN ? 'increase' : 'decrease',
          });
        } else if (change.oldValue === '∅' && newN !== null) {
          chain.push({
            order: order++,
            rule: `参数补录 R-003（v${change.versionNo} · 批次 ${change.batchNo}）`,
            ruleCode: 'R-003',
            ruleDescription: `${key} 在 v${change.versionNo} 后补入值，${isPost ? '不覆盖 v' + baseVersion + ' 原判断' : '首次赋值'}：${tableRow.sourceRemark}`,
            paramKey: key,
            paramSourceRemark: tableRow.sourceRemark,
            versionNo: change.versionNo,
            batchNo: change.batchNo,
            isPostSupplement: isPost,
            before: '∅（空集合）',
            after: `${change.newValue}${change.newUnit ?? ''}`,
            delta: '新增可行段',
            deltaType: 'change',
          });
        }
      }
      if (change.changeType === 'unit' && change.oldUnit !== change.newUnit) {
        chain.push({
          order: order++,
          rule: `单位补录 R-003（v${change.versionNo} · 批次 ${change.batchNo}）`,
          ruleCode: 'R-003',
          ruleDescription: `${key} 单位由「${change.oldUnit ?? '空'}」补为「${change.newUnit ?? '空'}」；原说法：${tableRow.sourceRemark}`,
          paramKey: key,
          paramSourceRemark: tableRow.sourceRemark,
          versionNo: change.versionNo,
          batchNo: change.batchNo,
          isPostSupplement: isPost,
          before: change.oldUnit ?? '无单位',
          after: change.newUnit ?? '空',
          delta: '量纲变化 · 对比失真风险',
          deltaType: 'change',
        });
      }
    }
  }

  for (const key of weightKeys) {
    const targetRow = targetSnapshot[key];
    const baseRow = baseSnapshot[key];
    if (!baseRow && targetRow) {
      const tableRow = table.rows.find((r) => r.key === key);
      chain.push({
        order: order++,
        rule: `新段引入 R-003（v${targetRow.introducedAtVersion}）`,
        ruleCode: 'R-003',
        ruleDescription: `参数 ${key} 在 v${targetRow.introducedAtVersion} 才首次录入，v${baseVersion} 口径不存在此段；原始说法：${tableRow?.sourceRemark ?? ''}`,
        paramKey: key,
        paramSourceRemark: tableRow?.sourceRemark ?? '',
        versionNo: targetRow.introducedAtVersion,
        batchNo: targetRow.batchNo,
        isPostSupplement: targetRow.introducedAtVersion > baseVersion,
        before: `（v${baseVersion} 无此参数）`,
        after: `${targetRow.value ?? '∅'}${targetRow.unit ?? ''}`,
        delta: `v${baseVersion}→v${targetVersion} 新增`,
        deltaType: 'change',
      });
    }
  }

  return chain.sort((a, b) => a.versionNo - b.versionNo || a.order - b.order);
}

export function runReview(
  table: ParamTable,
  sample: BoundarySample,
  baseVersionInput?: number,
  targetVersionInput?: number
): ReviewResult {
  const baseVersion = baseVersionInput ?? sample.paramVersion;
  const targetVersion = targetVersionInput ?? table.currentVersion;

  const baseSnapshot = getParamsAtVersion(table, baseVersion);
  const targetSnapshot = getParamsAtVersion(table, targetVersion);

  const graphBefore = buildGraph(baseSnapshot, sample);
  const graphAfter = buildGraph(targetSnapshot, sample);

  const detailRows = buildDetailRows(baseSnapshot, targetSnapshot, graphBefore, graphAfter, table);
  const impactChain = buildImpactChain(table, baseVersion, targetVersion, baseSnapshot, targetSnapshot);

  const baseSum = detailRows
    .filter((r) => r.baseValue !== null)
    .reduce((s, r) => s + (r.baseValue as number), 0);
  const targetSum = detailRows
    .filter((r) => r.targetValue !== null)
    .reduce((s, r) => s + (r.targetValue as number), 0);

  const pathBeforeEdges = detailRows.filter((r) => r.onBasePath && r.baseValue !== null);
  const graphPathBeforeSum = pathBeforeEdges.reduce((s, r) => s + (r.baseValue as number), 0);
  const graphExpectedBefore = Number.isFinite(graphBefore.totalCost) ? graphBefore.totalCost : 0;

  const pathAfterEdges = detailRows.filter((r) => r.onTargetPath && r.targetValue !== null);
  const graphPathAfterSum = pathAfterEdges.reduce((s, r) => s + (r.targetValue as number), 0);
  const graphExpectedAfter = Number.isFinite(graphAfter.totalCost) ? graphAfter.totalCost : 0;

  const calibreVerified =
    Math.abs(graphPathBeforeSum - graphExpectedBefore) < 0.01 &&
    Math.abs(graphPathAfterSum - graphExpectedAfter) < 0.01;

  const pathChanged = graphBefore.path.join(',') !== graphAfter.path.join(',');
  const costChanged =
    Math.abs(
      (Number.isFinite(graphBefore.totalCost) ? graphBefore.totalCost : -1) -
        (Number.isFinite(graphAfter.totalCost) ? graphAfter.totalCost : -1)
    ) > 0.001;

  return {
    id: `res-${Date.now()}`,
    sampleId: sample.id,
    baseVersion,
    targetVersion,
    graphBefore,
    graphAfter,
    aggregate: {
      targetSum: Number(targetSum.toFixed(2)),
      baseSum: Number(baseSum.toFixed(2)),
      diffSum: Number((targetSum - baseSum).toFixed(2)),
      count: detailRows.length,
      changedCount: detailRows.filter((r) => r.isValueChanged).length,
    },
    detailRows,
    impactChain,
    conclusionChanged: pathChanged || costChanged || impactChain.length > 0,
    pathChanged,
    calibreVerified,
    reviewedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
  };
}

export function encodeSnapshotId(conditions: Record<string, unknown>): string {
  try {
    return btoa(encodeURIComponent(JSON.stringify(conditions))).slice(2, 10);
  } catch {
    return `snap-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function exportToCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
}

export function triggerDownload(content: string, fileName: string, mime = 'text/csv;charset=utf-8;') {
  const blob = new Blob(['\ufeff' + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
