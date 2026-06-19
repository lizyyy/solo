import type {
  BoundarySample,
  DetailRow,
  GraphData,
  GraphEdge,
  GraphNode,
  ImpactNode,
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

function parseWeightValue(val: string | null): number | null {
  if (val === null || val === '∅' || val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function buildEdgesFromParams(paramTable: ParamTable): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const pattern = /^weight\.([A-Z])→([A-Z])$/;
  for (const row of paramTable.rows) {
    const m = row.key.match(pattern);
    if (!m) continue;
    const w = parseWeightValue(row.value);
    if (w === null) continue;
    edges.push({ source: m[1], target: m[2], weight: w });
  }
  return edges;
}

function dijkstra(nodes: GraphNode[], edges: GraphEdge[], start: string, end: string): { path: string[]; totalCost: number } {
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

function buildGraph(paramTable: ParamTable, sample: BoundarySample, overrides?: Record<string, number>): GraphData {
  let edges = buildEdgesFromParams(paramTable);
  if (overrides) {
    edges = edges.map((e) => {
      const key = `weight.${e.source}→${e.target}`;
      return overrides[key] !== undefined ? { ...e, weight: overrides[key] } : e;
    });
  }
  const start = String(sample.data.origin ?? 'A');
  const end = String(sample.data.destination ?? 'E');
  const { path, totalCost } = dijkstra(BASE_NODES, edges, start, end);
  return {
    nodes: BASE_NODES.map((n) => ({
      ...n,
      affected: path.includes(n.id),
    })),
    edges: edges.map((e) => ({
      ...e,
      affected: path.some((p, i) => i < path.length - 1 && p === e.source && path[i + 1] === e.target),
    })),
    path,
    totalCost,
  };
}

function buildDetailRows(graphBefore: GraphData, graphAfter: GraphData): DetailRow[] {
  const allEdges = new Set<string>();
  [...graphBefore.edges, ...graphAfter.edges].forEach((e) => allEdges.add(`${e.source}→${e.target}`));
  const rows: DetailRow[] = [];
  for (const key of Array.from(allEdges).sort()) {
    const [s, t] = key.split('→');
    const before = graphBefore.edges.find((e) => e.source === s && e.target === t)?.weight ?? 0;
    const after = graphAfter.edges.find((e) => e.source === s && e.target === t)?.weight ?? 0;
    const chartVal = (before + after) / 2;
    const detailVal = after;
    const diff = Math.abs(chartVal - detailVal);
    rows.push({
      id: key,
      segment: key,
      chartValue: Number(chartVal.toFixed(2)),
      detailValue: Number(detailVal.toFixed(2)),
      diff: Number(diff.toFixed(2)),
      isDiff: diff > 0.01,
    });
  }
  return rows;
}

export function runReview(paramTable: ParamTable, sample: BoundarySample): ReviewResult {
  const graphBefore = buildGraph(paramTable, sample);

  const overrides: Record<string, number> = {};
  const impactChain: ImpactNode[] = [];

  const pattern = /^weight\.([A-Z])→([A-Z])$/;
  let step = 1;
  for (const row of paramTable.rows) {
    const m = row.key.match(pattern);
    if (!m) continue;
    if (row.isEmptySet) {
      impactChain.push({
        order: step++,
        rule: '空集合校验规则 R-001',
        ruleDescription: `参数 ${row.key} 原值为「${row.value}」（空集合），原始说法：${row.sourceRemark}`,
        paramKey: row.key,
        before: row.value ?? '∅',
        after: '∞（不可通行）',
        delta: '排除此段路径',
        deltaType: 'change',
      });
    }
    if (row.missingUnit && !row.isEmptySet) {
      impactChain.push({
        order: step++,
        rule: '单位缺失告警规则 R-002',
        ruleDescription: `参数 ${row.key} 单位缺失，追溯原始说法：${row.sourceRemark}`,
        paramKey: row.key,
        before: row.value ?? '—',
        after: `${row.value}（⚠ 单位待确认）`,
        delta: '计算需谨慎',
        deltaType: 'change',
      });
    }
    if (row.changes.length > 0) {
      const last = row.changes[row.changes.length - 1];
      const oldN = parseWeightValue(last.oldValue);
      const newN = parseWeightValue(last.newValue);
      if (oldN !== null && newN !== null && oldN !== newN) {
        overrides[row.key] = newN;
        impactChain.push({
          order: step++,
          rule: `参数变更规则 R-003（批次 ${last.batchNo}）`,
          ruleDescription: `${row.key} 由 ${last.changedBy} 于 ${last.changedAt} 修改，不覆盖早先 v${row.version - 1} 结论，仅叠加影响`,
          paramKey: row.key,
          before: last.oldValue,
          after: last.newValue,
          delta: newN > oldN ? `+${(newN - oldN).toFixed(1)}` : `${(newN - oldN).toFixed(1)}`,
          deltaType: newN > oldN ? 'increase' : 'decrease',
        });
      }
    }
  }

  const graphAfter = buildGraph(paramTable, sample, Object.keys(overrides).length > 0 ? overrides : undefined);
  const detailRows = buildDetailRows(graphBefore, graphAfter);
  const calibreDiff = detailRows.filter((r) => r.isDiff);

  const chartSum = detailRows.reduce((s, r) => s + r.chartValue, 0);
  const detailSum = detailRows.reduce((s, r) => s + r.detailValue, 0);

  return {
    id: `res-${Date.now()}`,
    sampleId: sample.id,
    graphBefore,
    graphAfter,
    chartAggregate: {
      sum: Number(chartSum.toFixed(2)),
      avg: Number((chartSum / detailRows.length).toFixed(2)),
      count: detailRows.length,
    },
    detailRows,
    calibreDiff,
    impactChain,
    conclusionChanged: graphBefore.totalCost !== graphAfter.totalCost || graphBefore.path.join(',') !== graphAfter.path.join(','),
    reviewedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
  };
}

export function encodeSnapshotId(conditions: Record<string, unknown>): string {
  try {
    return btoa(encodeURIComponent(JSON.stringify(conditions))).slice(0, 10);
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
