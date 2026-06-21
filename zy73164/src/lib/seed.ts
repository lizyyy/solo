import type {
  HistoricalAnswer,
  ManualOverride,
  ReplayResult,
  RunRecord,
  SupplementaryNote,
} from '@/types';
import { decomposeLU } from './decompose';
import { fingerprint } from './fingerprint';
import { buildReplay } from './replay';

export const DEFAULT_TOLERANCE = 1e-9;
const SEED_TIME = Date.now() - 36 * 3600 * 1000;

const M_NORMAL: number[][] = [
  [4, 3, 0],
  [2, 1, 5],
  [1, 0, 2],
];
const M_SINGULAR: number[][] = [
  [4, 0, 2],
  [2, 0, 1],
  [1, 0, 3],
];
const M_QR: number[][] = [
  [1, 0, 2],
  [2, 0, 3],
  [3, 0, 1],
];

function expectedUForNormal(): number[][] {
  const out = decomposeLU(M_NORMAL, DEFAULT_TOLERANCE, 'partial');
  return out.factors.U ?? [];
}

export interface SeedState {
  materials: HistoricalAnswer[];
  runs: RunRecord[];
  results: Record<string, ReplayResult>;
  overrides: Record<string, ManualOverride>;
  notes: Record<string, SupplementaryNote>;
  idempotency: Record<string, string>;
}

export function createSeedState(): SeedState {
  const materials: HistoricalAnswer[] = [
    {
      id: 'mat-normal',
      matrixId: 'M-NORMAL',
      label: '良态矩阵 A1',
      matrix: M_NORMAL,
      expectedU: expectedUForNormal(),
      method: 'LU',
      emptySet: false,
      traces: [
        { label: '产生时间', value: new Date(SEED_TIME).toISOString() },
        { label: '参数快照', value: 'LU / partial / tol=1e-9' },
        { label: '环境', value: '回放引擎 v1 · 工位-03' },
        { label: '来源行', value: 'decompose.ts:99' },
      ],
      sourceLine: 99,
      createdAt: SEED_TIME,
    },
    {
      id: 'mat-singular',
      matrixId: 'M-SINGULAR',
      label: '奇异矩阵 A2（第2列全零）',
      matrix: M_SINGULAR,
      expectedU: [],
      method: 'LU',
      emptySet: true,
      traces: [
        { label: '产生时间', value: new Date(SEED_TIME).toISOString() },
        { label: '参数快照', value: 'LU / partial / tol=1e-9' },
        { label: '环境', value: '现场 · 历史答案为空集合，曾被当正常输入卡住' },
        { label: '来源行', value: 'decompose.ts:81' },
      ],
      sourceLine: 81,
      createdAt: SEED_TIME,
    },
    {
      id: 'mat-qr',
      matrixId: 'M-QR',
      label: '退化列矩阵 A3（QR 演示）',
      matrix: M_QR,
      method: 'QR',
      emptySet: false,
      traces: [
        { label: '产生时间', value: new Date(SEED_TIME).toISOString() },
        { label: '参数快照', value: 'QR / tol=1e-9' },
        { label: '环境', value: '回放引擎 v1 · 工位-03' },
        { label: '来源行', value: 'decompose.ts:129' },
      ],
      sourceLine: 129,
      createdAt: SEED_TIME,
    },
  ];

  const singular = materials[1];
  const req = {
    matrixId: singular.matrixId,
    matrix: singular.matrix,
    method: 'LU' as const,
    pivot: 'partial' as const,
    tolerance: DEFAULT_TOLERANCE,
  };
  const seededRunId = 'run-singular-seed';
  const built = buildReplay(req, singular, {
    runId: seededRunId,
    createdAt: SEED_TIME,
    note: '历史空集合导致“数学老师老叶”卡住；已人工改判放行，并标注影响范围与来源行',
    csvToken: 'csv-run-singular-seed',
  });

  const override: ManualOverride = {
    runId: seededRunId,
    reason: '奇异矩阵，除零属预期；空集合历史答案已拦截，按人工改判通过',
    updatedAt: SEED_TIME + 1000,
    by: '算法值班 · 老叶交接',
    originRunId: seededRunId,
  };
  const note: SupplementaryNote = {
    runId: seededRunId,
    note:
      '后补说明：经复核确认为秩亏场景，第 2 列全零。影响范围：行 2-3 / 列 2-3；来源行 src/lib/decompose.ts:81（LU 主元搜索）。重跑后此备注随 runId 保留，与状态、CSV 明细不断线。',
    updatedAt: SEED_TIME + 2000,
  };

  built.run.status = 'override';

  return {
    materials,
    runs: [built.run],
    results: { [seededRunId]: built.result },
    overrides: { [seededRunId]: override },
    notes: { [seededRunId]: note },
    idempotency: { [fingerprint(req)]: seededRunId },
  };
}
