import { v4 as uuidv4 } from 'uuid';
import type { GraphNode, GraphEdge, ParameterVersion, ParameterRecord, AppState } from '../types';

export const mockNodes: GraphNode[] = [
  { id: 'A', label: '站点A', x: 100, y: 100, z: 0 },
  { id: 'B', label: '站点B', x: 250, y: 80, z: 0 },
  { id: 'C', label: '站点C', x: 400, y: 150, z: 0 },
  { id: 'D', label: '站点D', x: 150, y: 250, z: 0 },
  { id: 'E', label: '站点E', x: 300, y: 300, z: 0 },
  { id: 'F', label: '站点F', x: 450, y: 280, z: 0 },
  { id: 'G', label: '站点G', x: 200, y: 400, z: 0 },
  { id: 'H', label: '站点H', x: 380, y: 420, z: 0 },
];

export const mockEdges: GraphEdge[] = [
  { id: 'AB', source: 'A', target: 'B', weight: 5, traffic: 30 },
  { id: 'AC', source: 'A', target: 'C', weight: 15, traffic: 10 },
  { id: 'AD', source: 'A', target: 'D', weight: 8, traffic: 20 },
  { id: 'BC', source: 'B', target: 'C', weight: 6, traffic: 40 },
  { id: 'BD', source: 'B', target: 'D', weight: 12, traffic: 15 },
  { id: 'BE', source: 'B', target: 'E', weight: 9, traffic: 25 },
  { id: 'CE', source: 'C', target: 'E', weight: 4, traffic: 35 },
  { id: 'CF', source: 'C', target: 'F', weight: 7, traffic: 20 },
  { id: 'DE', source: 'D', target: 'E', weight: 3, traffic: 45 },
  { id: 'DG', source: 'D', target: 'G', weight: 10, traffic: 15 },
  { id: 'EF', source: 'E', target: 'F', weight: 5, traffic: 30 },
  { id: 'EG', source: 'E', target: 'G', weight: 8, traffic: 20 },
  { id: 'EH', source: 'E', target: 'H', weight: 11, traffic: 10 },
  { id: 'FG', source: 'F', target: 'G', weight: 9, traffic: 25 },
  { id: 'FH', source: 'F', target: 'H', weight: 6, traffic: 35 },
  { id: 'GH', source: 'G', target: 'H', weight: 4, traffic: 40 },
];

export const initialParameterVersions: ParameterVersion[] = [
  {
    version: 'v1.0.0',
    timestamp: Date.now() - 86400000 * 7,
    author: 'system',
    parameters: {
      edgeWeightFormula: 'distance + traffic * 0.1',
      detourThreshold: 1.3,
      considerTraffic: true,
      maxPathLength: 10,
      allowUturn: false,
    },
    reasoning: '初始版本，综合考虑距离和流量因素，绕行阈值设为30%',
  },
  {
    version: 'v1.1.0',
    timestamp: Date.now() - 86400000 * 3,
    author: 'data_reviewer',
    parameters: {
      edgeWeightFormula: 'distance + traffic * 0.15',
      detourThreshold: 1.25,
      considerTraffic: true,
      maxPathLength: 12,
      allowUturn: false,
    },
    reasoning: '根据复核意见调整流量权重，提高绕行敏感度',
  },
];

function generateImportHash(record: Partial<ParameterRecord>): string {
  const key = `${record.sourceNode}-${record.targetNode}-${record.numerator}-${record.denominator}-${record.edgeWeight}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

const rawRecords: Array<{
  source: string; target: string; num: number; den: number | null; weight: number; remark: string;
}> = [
  { source: 'A', target: 'H', num: 25, den: 20, weight: 1.25, remark: '经E到H的主路径' },
  { source: 'A', target: 'F', num: 18, den: 15, weight: 1.20, remark: '常规通勤路线' },
  { source: 'B', target: 'G', num: 30, den: 0, weight: 0, remark: '早高峰时段临时封路' },
  { source: 'C', target: 'D', num: 12, den: 10, weight: 1.20, remark: '跨区绕行方案' },
  { source: 'D', target: 'F', num: 22, den: 18, weight: 1.22, remark: '避开拥堵路段' },
  { source: 'E', target: 'A', num: 15, den: 12, weight: 1.25, remark: '返程路线对比' },
  { source: 'F', target: 'D', num: 28, den: 0, weight: 0, remark: '晚高峰流量异常' },
  { source: 'G', target: 'B', num: 35, den: 25, weight: 1.40, remark: '周末绕行方案' },
  { source: 'H', target: 'A', num: 40, den: 30, weight: 1.33, remark: '夜间备选路线' },
  { source: 'B', target: 'F', num: 20, den: 16, weight: 1.25, remark: '物流配送优化路线' },
];

const batchId = uuidv4();
const now = Date.now();

export const initialParameterRecords: ParameterRecord[] = rawRecords.map((r, idx) => {
  const isZeroDenominator = r.den === 0;
  const id = uuidv4();
  return {
    id,
    batchId,
    importTimestamp: now - 86400000 + idx * 1000,
    importHash: generateImportHash({
      sourceNode: r.source,
      targetNode: r.target,
      numerator: r.num,
      denominator: r.den,
      edgeWeight: r.weight,
    }),
    sourceNode: r.source,
    targetNode: r.target,
    numerator: r.num,
    denominator: isZeroDenominator ? 0 : r.den,
    denominatorDisplayEmpty: isZeroDenominator,
    edgeWeight: r.weight,
    remark: r.remark,
    status: isZeroDenominator ? 'zero_denominator' : 'needs_review',
    reviewStatus: 'pending',
    assignedTo: isZeroDenominator ? 'data_reviewer' : 'alan',
    versions: [
      {
        version: 1,
        timestamp: now - 86400000 + idx * 1000,
        author: 'system',
        changes: {},
        changeDescription: '首次导入',
      },
    ],
    currentVersion: 1,
    parameterVersionRef: 'v1.1.0',
  };
});

export const initialAppState: AppState = {
  parameterRecords: initialParameterRecords,
  comparisonResults: [],
  reviewTasks: [],
  parameterVersions: initialParameterVersions,
  currentParameterVersion: 'v1.1.0',
  graph: {
    nodes: mockNodes,
    edges: mockEdges,
  },
  workflowStage: 'initial_import',
  displayMode: 'list',
  selectedRecordId: null,
  selectedResultId: null,
  currentUser: 'alan',
  showHistoryDiff: false,
  compareVersionFrom: null,
  compareVersionTo: null,
};
