import { create } from 'zustand';
import type {
  ImportResult,
  ManualStatus,
  ParamSnapshot,
  RunParams,
  SurveyRecord,
} from '@/types';
import {
  buildSnapshot,
  detectAnomalies,
  diffParams,
  nextVersion,
  simulateImport,
} from '@/utils/anomaly';
import {
  buildInitialRecords,
  buildInitialSnapshots,
  buildIncomingBatch,
  INITIAL_PARAMS,
} from '@/utils/mockData';

interface ReplayState {
  records: SurveyRecord[];
  params: RunParams;
  snapshots: ParamSnapshot[];
  activeVersion: string;
  lastImportResult: ImportResult | null;
  highlightRecordIds: string[];
  selectedRecordId: string | null;
  diffDrawerOpen: boolean;
  handoverOpen: boolean;
  selectedForCompare: string[];
  setParam: <K extends keyof RunParams>(key: K, value: RunParams[K]) => void;
  rerunWithParams: () => void;
  rollbackTo: (version: string) => void;
  toggleCompareVersion: (version: string) => void;
  setHighlight: (ids: string[]) => void;
  selectRecord: (id: string | null) => void;
  setManualOverride: (
    recordId: string,
    opts: { by: string; reason: string; newStatus: ManualStatus }
  ) => void;
  updateRemark: (recordId: string, remark: string) => void;
  runImportSimulation: () => void;
  openDiffDrawer: (open: boolean) => void;
  openHandover: (open: boolean) => void;
  exportCSV: () => string;
  locateFirstAnomaly: () => string | null;
}

const initialRecordsBase = buildInitialRecords();
const initialSnapshots = buildInitialSnapshots();
const { records: initialRecords } = detectAnomalies(initialRecordsBase, INITIAL_PARAMS);

export const useReplayStore = create<ReplayState>((set, get) => ({
  records: initialRecords,
  params: { ...INITIAL_PARAMS },
  snapshots: initialSnapshots,
  activeVersion: initialSnapshots[initialSnapshots.length - 1].version,
  lastImportResult: null,
  highlightRecordIds: [],
  selectedRecordId: null,
  diffDrawerOpen: false,
  handoverOpen: false,
  selectedForCompare: [
    initialSnapshots[0].version,
    initialSnapshots[initialSnapshots.length - 1].version,
  ],

  setParam: (key, value) =>
    set((s) => ({ params: { ...s.params, [key]: value } })),

  rerunWithParams: () => {
    const { records, params, snapshots } = get();
    const prevFlagMap: Record<string, SurveyRecord['flags']> = {};
    for (const r of records) prevFlagMap[r.id] = { ...r.flags };
    const prevParams = snapshots[snapshots.length - 1]?.params ?? params;
    const diffs = diffParams(prevParams, params);
    const { records: next, report } = detectAnomalies(records, params, prevFlagMap);
    const ver = nextVersion(snapshots[snapshots.length - 1].version);
    const snap = buildSnapshot(ver, params, report.changedFromPrevIds, diffs.length ? diffs : undefined);
    set((s) => ({
      records: next,
      snapshots: [...s.snapshots, snap],
      activeVersion: ver,
      highlightRecordIds: report.changedFromPrevIds,
      selectedForCompare: [
        s.snapshots[s.snapshots.length - 1].version,
        ver,
      ],
    }));
  },

  rollbackTo: (version) => {
    const { snapshots } = get();
    const target = snapshots.find((s) => s.version === version);
    if (!target) return;
    const prevFlagMap: Record<string, SurveyRecord['flags']> = {};
    for (const r of get().records) prevFlagMap[r.id] = { ...r.flags };
    const { records: next, report } = detectAnomalies(get().records, target.params, prevFlagMap);
    set({
      params: { ...target.params },
      activeVersion: version,
      records: next,
      highlightRecordIds: report.changedFromPrevIds,
    });
  },

  toggleCompareVersion: (version) => {
    set((s) => {
      const set2 = new Set(s.selectedForCompare);
      if (set2.has(version)) {
        set2.delete(version);
      } else {
        if (set2.size >= 3) {
          const [first] = Array.from(set2);
          set2.delete(first);
        }
        set2.add(version);
      }
      return { selectedForCompare: Array.from(set2) };
    });
  },

  setHighlight: (ids) => set({ highlightRecordIds: ids }),
  selectRecord: (id) => set({ selectedRecordId: id }),

  setManualOverride: (recordId, { by, reason, newStatus }) => {
    set((s) => ({
      records: s.records.map((r) =>
        r.id === recordId
          ? {
              ...r,
              manualOverride: {
                by,
                at: new Date().toISOString(),
                reason,
                newStatus,
              },
              processedAt: new Date().toISOString(),
              flags: {
                ...r.flags,
                isPendingMaterial: newStatus === 'pending',
              },
            }
          : r
      ),
      selectedRecordId: recordId,
    }));
  },

  updateRemark: (recordId, remark) => {
    set((s) => ({
      records: s.records.map((r) =>
        r.id === recordId
          ? { ...r, remark: r.remark && remark ? r.remark : remark || r.remark }
          : r
      ),
    }));
  },

  runImportSimulation: () => {
    const existing = get().records;
    const incoming = buildIncomingBatch();
    const { merged, result } = simulateImport(existing, incoming);
    set({ records: merged, lastImportResult: result });
  },

  openDiffDrawer: (open) => set({ diffDrawerOpen: open }),
  openHandover: (open) => set({ handoverOpen: open }),

  exportCSV: () => {
    const { records } = get();
    const headers = [
      'id',
      '站点',
      '时间',
      '覆盖度%',
      '潮位',
      '单位',
      '水质',
      '来源行',
      '批次',
      '离群',
      '单位混写',
      '命名不符',
      '待补材料',
      '异常标签',
      '人工备注',
      '改判人',
      '改判理由',
      '改判状态',
    ];
    const lines = [headers.join(',')];
    for (const r of records) {
      lines.push(
        [
          r.id,
          r.siteName,
          r.timestamp,
          r.coverage,
          r.tideLevel,
          r.tideUnit,
          r.waterQuality,
          r.sourceRow,
          r.sourceBatch,
          r.flags.isOutlier ? '是' : '',
          r.flags.isUnitMismatch ? '是' : '',
          r.flags.isNameMismatch ? '是' : '',
          r.flags.isPendingMaterial ? '是' : '',
          (r.anomalyTags ?? []).join('|'),
          (r.remark ?? '').replace(/,/g, '，'),
          r.manualOverride?.by ?? '',
          (r.manualOverride?.reason ?? '').replace(/,/g, '，'),
          r.manualOverride?.newStatus ?? '',
        ].join(',')
      );
    }
    return lines.join('\n');
  },

  locateFirstAnomaly: () => {
    const { records } = get();
    const first = records.find(
      (r) =>
        r.flags.isOutlier ||
        r.flags.isUnitMismatch ||
        r.flags.isNameMismatch ||
        r.flags.isPendingMaterial
    );
    if (!first) return null;
    set({ selectedRecordId: first.id, highlightRecordIds: [first.id] });
    return first.id;
  },
}));
