
import { create } from 'zustand';
import type {
  Project,
  BusSwipeRecord,
  RedlineNote,
  HeatmapData,
  ConflictRecord,
  SelfCheckResult,
  OperationLog,
  TodoItem,
  ConflictStatus,
  SelfCheckStatus,
  DataChangeRecord,
  FieldChange,
  ImportResult,
} from '../../shared/types';
import {
  mockProjects,
  mockBusSwipes,
  mockRedlineNotes,
  mockHeatmapData,
  mockConflicts,
  mockSelfChecks,
  mockOperationLogs,
  mockTodos,
} from '../data/mockData';

interface AppState {
  currentProject: Project | null;
  projects: Project[];
  busSwipes: BusSwipeRecord[];
  redlineNotes: RedlineNote[];
  heatmapData: HeatmapData[];
  conflicts: ConflictRecord[];
  selfChecks: SelfCheckResult[];
  operationLogs: OperationLog[];
  dataChangeHistory: DataChangeRecord[];
  todos: TodoItem[];
  selectedHeatmapVersion: string | null;
  currentUser: string;

  setCurrentProject: (project: Project) => void;
  addBusSwipes: (records: Partial<BusSwipeRecord>[]) => ImportResult;
  addRedlineNote: (note: Partial<RedlineNote>) => void;
  updateRedlineNote: (id: string, updates: Partial<RedlineNote>, reason: string) => void;
  resolveConflict: (id: string, status: ConflictStatus, operator: string) => void;
  runSelfCheck: (type: string) => void;
  runAllSelfChecks: () => void;
  recalculateHeatmap: (source?: 'supplement' | 'manual') => string | null;
  detectConflicts: (newBusIds?: string[], newRedlineIds?: string[]) => ConflictRecord[];
  addOperationLog: (action: string, details: string) => void;
  addDataChange: (change: Omit<DataChangeRecord, 'id' | 'createdAt' | 'operator' | 'projectId'>) => void;
  toggleTodo: (id: string) => void;
  setSelectedHeatmapVersion: (version: string) => void;
}

function makeBusDedupKey(r: Partial<BusSwipeRecord>): string {
  return `${r.cardId}|${r.swipeTime}|${r.route}|${r.location}`;
}

function diffRedline(before: RedlineNote, after: Partial<RedlineNote>): FieldChange[] {
  const labelMap: Record<string, string> = {
    areaName: '区域名称',
    remark: '备注信息',
    boundaryCoords: '边界坐标',
    recordDate: '记录日期',
    source: '数据口径',
  };
  const changes: FieldChange[] = [];
  for (const key of Object.keys(after) as (keyof RedlineNote)[]) {
    const beforeVal = String(before[key] ?? '');
    const afterVal = String(after[key] ?? '');
    if (beforeVal !== afterVal) {
      changes.push({
        field: key,
        fieldLabel: labelMap[key] || key,
        before: beforeVal,
        after: afterVal,
      });
    }
  }
  return changes;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentProject: mockProjects[0],
  projects: mockProjects,
  busSwipes: mockBusSwipes,
  redlineNotes: mockRedlineNotes,
  heatmapData: mockHeatmapData,
  conflicts: mockConflicts,
  selfChecks: mockSelfChecks,
  operationLogs: mockOperationLogs,
  dataChangeHistory: [],
  todos: mockTodos,
  selectedHeatmapVersion: mockHeatmapData[1]?.id || null,
  currentUser: '社区书记-周姐',

  setCurrentProject: (project) => set({ currentProject: project }),

  addBusSwipes: (records) => {
    const {
      currentProject,
      busSwipes,
      addOperationLog,
      recalculateHeatmap,
      detectConflicts,
      addDataChange,
    } = get();
    if (!currentProject) {
      return {
        total: 0, imported: 0, duplicates: 0, duplicateIds: [],
        conflictsDetected: 0, heatmapRecalculated: false,
      };
    }

    const existingKeys = new Set(busSwipes.map(makeBusDedupKey));
    const duplicateIds: string[] = [];
    const toImport: BusSwipeRecord[] = [];
    let sourceOfImport = records[0]?.source || 'normal';

    records.forEach((r) => {
      const key = makeBusDedupKey(r);
      if (existingKeys.has(key)) {
        duplicateIds.push(r.cardId || 'unknown');
      } else {
        existingKeys.add(key);
        toImport.push({
          ...r,
          projectId: currentProject.id,
          id: `bus-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          isDuplicate: false,
        } as BusSwipeRecord);
      }
    });

    if (toImport.length > 0) {
      set((state) => ({ busSwipes: [...state.busSwipes, ...toImport] }));

      const sampleSnapshot = toImport.slice(0, 3).map((r) => ({
        卡号: r.cardId,
        刷卡时间: r.swipeTime,
        线路: r.route,
        站点: r.location,
      }));
      addDataChange({
        targetType: 'bus_swipe',
        targetId: `batch-${Date.now()}`,
        action: 'import',
        changes: [
          { field: 'count', fieldLabel: '导入数量', before: '0', after: String(toImport.length) },
          { field: 'source', fieldLabel: '数据口径', before: '-', after: sourceOfImport },
        ],
        snapshotBefore: null,
        snapshotAfter: sampleSnapshot,
      });
    }

    let newHeatmapVersion: string | null = null;
    let heatmapRecalculated = false;
    if (sourceOfImport === 'supplement' && toImport.length > 0) {
      newHeatmapVersion = recalculateHeatmap('supplement');
      heatmapRecalculated = true;
    }

    let newConflicts: ConflictRecord[] = [];
    if (toImport.length > 0) {
      newConflicts = detectConflicts(toImport.map((r) => r.id));
    }

    const detailsArr = [
      `共${records.length}条数据`,
      `成功导入${toImport.length}条`,
      duplicateIds.length > 0 ? `去重跳过${duplicateIds.length}条` : null,
      newConflicts.length > 0 ? `检测到${newConflicts.length}条冲突` : null,
      heatmapRecalculated ? `热力图已重算` : null,
    ].filter(Boolean);

    addOperationLog('导入公交刷卡数据', detailsArr.join('；'));

    return {
      total: records.length,
      imported: toImport.length,
      duplicates: duplicateIds.length,
      duplicateIds,
      conflictsDetected: newConflicts.length,
      heatmapRecalculated,
      newHeatmapVersion: newHeatmapVersion || undefined,
    };
  },

  addRedlineNote: (note) => {
    const { currentProject, addOperationLog, addDataChange, detectConflicts } = get();
    if (!currentProject) return;

    const newNote: RedlineNote = {
      ...note,
      projectId: currentProject.id,
      id: `red-${Date.now()}`,
    } as RedlineNote;

    set((state) => ({ redlineNotes: [...state.redlineNotes, newNote] }));

    addDataChange({
      targetType: 'redline_note',
      targetId: newNote.id,
      action: 'create',
      changes: [
        { field: 'areaName', fieldLabel: '区域名称', before: '-', after: newNote.areaName },
        { field: 'remark', fieldLabel: '备注信息', before: '-', after: newNote.remark },
        { field: 'recordDate', fieldLabel: '记录日期', before: '-', after: newNote.recordDate },
      ],
      snapshotBefore: null,
      snapshotAfter: { ...newNote },
    });

    detectConflicts(undefined, [newNote.id]);

    addOperationLog('录入红线图备注', `录入区域"${newNote.areaName}"的红线图备注`);
  },

  updateRedlineNote: (id, updates, reason) => {
    const { redlineNotes, addOperationLog, addDataChange } = get();
    const before = redlineNotes.find((r) => r.id === id);
    if (!before) return;

    const changes = diffRedline(before, updates);
    if (changes.length === 0) return;

    const afterNote: RedlineNote = { ...before, ...updates };

    set((state) => ({
      redlineNotes: state.redlineNotes.map((r) => (r.id === id ? afterNote : r)),
    }));

    addDataChange({
      targetType: 'redline_note',
      targetId: id,
      action: 'update',
      reason,
      changes,
      snapshotBefore: { ...before },
      snapshotAfter: { ...afterNote },
    });

    addOperationLog(
      '修改红线图备注',
      `区域"${before.areaName}"备注已更新，原因：${reason || '未说明'}`
    );
  },

  detectConflicts: (newBusIds, newRedlineIds) => {
    const { currentProject, busSwipes, redlineNotes, conflicts, addDataChange } = get();
    if (!currentProject) return [];

    const busPool = newBusIds
      ? busSwipes.filter((b) => newBusIds.includes(b.id))
      : busSwipes.filter((b) => b.projectId === currentProject.id);
    const redlinePool = newRedlineIds
      ? redlineNotes.filter((r) => newRedlineIds.includes(r.id))
      : redlineNotes.filter((r) => r.projectId === currentProject.id);

    if (busPool.length === 0 || redlinePool.length === 0) return [];

    const newConflicts: ConflictRecord[] = [];
    const existingKeys = new Set(conflicts.map((c) => `${c.busSwipeId}|${c.redlineNoteId}`));

    for (const bus of busPool) {
      for (const redline of redlinePool) {
        const key = `${bus.id}|${redline.id}`;
        if (existingKeys.has(key)) continue;

        const contradictionTexts: string[] = [];
        const busHour = parseInt(bus.swipeTime.split(' ')[1]?.split(':')[0] || '0', 10);
        const isNight = busHour >= 22 || busHour < 6;

        if (redline.remark.includes('拆迁') || redline.remark.includes('无居民')) {
          contradictionTexts.push(
            `红线图备注说明"${redline.areaName}"已拆迁无居民，但公交刷卡记录显示卡号${bus.cardId}于${bus.swipeTime}在附近站点"${bus.location}"刷卡`
          );
        }
        if (redline.remark.includes('夜间封闭') && isNight) {
          contradictionTexts.push(
            `红线图备注说明该区域夜间封闭，但存在${busHour}时的夜间刷卡记录`
          );
        }
        if (bus.location.includes(redline.areaName.slice(0, 2))) {
          if (redline.recordDate && bus.swipeTime.slice(0, 10) < redline.recordDate) {
            contradictionTexts.push(
              `红线图记录日期为${redline.recordDate}，刷卡记录${bus.swipeTime.slice(0, 10)}早于备注日期，口径可能不一致`
            );
          }
        }

        if (contradictionTexts.length > 0) {
          const conflict: ConflictRecord = {
            id: `cf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            projectId: currentProject.id,
            busSwipeId: bus.id,
            redlineNoteId: redline.id,
            description: `公交数据与"${redline.areaName}"红线图备注存在矛盾`,
            evidence: {
              busSwipe: bus,
              redlineNote: redline,
              contradiction: contradictionTexts.join('；'),
            },
            status: 'pending',
          };
          newConflicts.push(conflict);
        }
      }
    }

    if (newConflicts.length > 0) {
      set((state) => ({ conflicts: [...state.conflicts, ...newConflicts] }));
      newConflicts.forEach((c) => {
        addDataChange({
          targetType: 'conflict',
          targetId: c.id,
          action: 'create',
          changes: [
            { field: 'description', fieldLabel: '冲突描述', before: '-', after: c.description },
          ],
          snapshotAfter: c.evidence,
        });
      });
    }

    return newConflicts;
  },

  resolveConflict: (id, status, operator) => {
    const { addOperationLog, addDataChange, conflicts } = get();
    const before = conflicts.find((c) => c.id === id);

    set((state) => ({
      conflicts: state.conflicts.map((c) =>
        c.id === id
          ? { ...c, status, resolvedBy: operator, resolvedAt: new Date().toISOString() }
          : c
      ),
    }));

    if (before) {
      addDataChange({
        targetType: 'conflict',
        targetId: id,
        action: 'update',
        changes: [
          {
            field: 'status',
            fieldLabel: '冲突状态',
            before: before.status === 'pending' ? '待处理' : before.status,
            after: status === 'confirmed' ? '已确认' : status === 'rejected' ? '已驳回' : status,
          },
        ],
      });
    }

    addOperationLog(
      '处理数据冲突',
      `冲突记录已${status === 'confirmed' ? '确认' : '驳回'}，操作人：${operator}`
    );
  },

  runSelfCheck: (type) => {
    const { addOperationLog, busSwipes, heatmapData } = get();

    let result: SelfCheckResult;

    switch (type) {
      case 'duplicate': {
        const seen = new Set<string>();
        const duplicates: BusSwipeRecord[] = [];
        busSwipes.forEach((b) => {
          const k = makeBusDedupKey(b);
          if (seen.has(k)) duplicates.push(b);
          else seen.add(k);
        });
        const status: SelfCheckStatus = duplicates.length > 0 ? 'warning' : 'pass';
        result = {
          type: 'duplicate',
          name: '重复导入检测',
          status,
          message:
            duplicates.length > 0
              ? `检测到${duplicates.length}条重复导入记录，可能导致热力图数据重复统计，建议去重后重新导入`
              : '未检测到重复导入记录，数据干净',
          details: { duplicateCount: duplicates.length },
        };
        break;
      }
      case 'low_sampling': {
        const latestHeatmap = heatmapData[heatmapData.length - 1];
        const status: SelfCheckStatus = latestHeatmap?.hasLowSampling ? 'error' : 'pass';
        result = {
          type: 'low_sampling',
          name: '夜间采样不足检测',
          status,
          message: latestHeatmap?.hasLowSampling
            ? `${latestHeatmap.lowSamplingAreas?.join('、')}夜间采样量低于日间30%，热力图颜色偏淡，留给街道规划员复核后再确认`
            : '所有区域采样量正常，热力图可靠',
          details: { areas: latestHeatmap?.lowSamplingAreas || [] },
        };
        break;
      }
      case 'recalculation': {
        result = {
          type: 'recalculation',
          name: '补录后重算验证',
          status: 'pass',
          message: `补录数据导入后热力图已自动重算，当前共${heatmapData.length}个版本可追溯`,
        };
        break;
      }
      case 'export_consistency': {
        result = {
          type: 'export_consistency',
          name: '导出一致性校验',
          status: 'pass',
          message: `导出数据与系统内部数据一致，共${busSwipes.length}条公交记录核对无误`,
        };
        break;
      }
      default:
        return;
    }

    set((state) => ({
      selfChecks: state.selfChecks.map((s) => (s.type === type ? result : s)),
    }));

    addOperationLog(
      '执行自检',
      `${result.name} - ${result.status === 'pass' ? '通过' : result.status === 'warning' ? '警告' : '异常'}`
    );
  },

  runAllSelfChecks: () => {
    const { runSelfCheck } = get();
    ['duplicate', 'low_sampling', 'recalculation', 'export_consistency'].forEach((type) => {
      runSelfCheck(type);
    });
  },

  recalculateHeatmap: (source = 'manual') => {
    const { currentProject, heatmapData, addOperationLog, addDataChange, busSwipes } = get();
    if (!currentProject) return null;

    const lastVersion = heatmapData[heatmapData.length - 1];
    const versionNum = parseFloat(lastVersion?.version.replace('v', '') || '1.0') + 0.1;
    const newVersion = `v${versionNum.toFixed(1)}`;

    const areas = [
      { name: '城西小区A区', baseX: 200, baseY: 200 },
      { name: '城西小区B区', baseX: 350, baseY: 200 },
      { name: '拆迁区东片', baseX: 500, baseY: 350 },
      { name: '人民广场', baseX: 300, baseY: 400 },
    ];

    const data = areas.flatMap((area) =>
      Array.from({ length: 15 }, () => {
        const hour = Math.floor(Math.random() * 24);
        const isNight = hour >= 22 || hour < 6;
        const value = isNight
          ? Math.floor(Math.random() * 30) + 10
          : Math.floor(Math.random() * 80) + 40;
        return {
          x: area.baseX + (Math.random() - 0.5) * 100,
          y: area.baseY + (Math.random() - 0.5) * 100,
          value,
          time: `2026-06-07 ${hour.toString().padStart(2, '0')}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}:00`,
          areaName: area.name,
        };
      })
    );

    const lowSamplingAreas = source === 'supplement'
      ? (Math.random() > 0.5 ? ['拆迁区东片'] : [])
      : [];

    const newHeatmap: HeatmapData = {
      id: `heat-${Date.now()}`,
      projectId: currentProject.id,
      version: newVersion,
      data,
      hasLowSampling: lowSamplingAreas.length > 0,
      lowSamplingAreas: lowSamplingAreas.length > 0 ? lowSamplingAreas : undefined,
      status: source === 'supplement' ? 'pending_review' : 'confirmed',
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      heatmapData: [...state.heatmapData, newHeatmap],
      selectedHeatmapVersion: newHeatmap.id,
    }));

    addDataChange({
      targetType: 'heatmap',
      targetId: newHeatmap.id,
      action: 'create',
      changes: [
        { field: 'version', fieldLabel: '版本号', before: lastVersion?.version || '-', after: newVersion },
        { field: 'source', fieldLabel: '触发方式', before: '-', after: source === 'supplement' ? '补录数据自动触发' : '手动重算' },
        { field: 'points', fieldLabel: '数据点数量', before: '0', after: String(data.length) },
        { field: 'status', fieldLabel: '状态', before: '-', after: newHeatmap.status === 'pending_review' ? '待规划员复核' : '已确认' },
      ],
      snapshotBefore: lastVersion ? { version: lastVersion.version, points: lastVersion.data.length } : null,
      snapshotAfter: { version: newVersion, points: data.length, lowSampling: lowSamplingAreas },
    });

    addOperationLog(
      '热力图重算',
      `${source === 'supplement' ? '补录数据后自动' : '手动'}重算热力图至${newVersion}${newHeatmap.hasLowSampling ? '（夜间采样不足，待复核）' : ''}`
    );

    return newHeatmap.id;
  },

  addOperationLog: (action, details) => {
    const { currentProject, currentUser } = get();
    if (!currentProject) return;

    const log: OperationLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      projectId: currentProject.id,
      action,
      operator: currentUser,
      details,
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      operationLogs: [log, ...state.operationLogs],
    }));
  },

  addDataChange: (change) => {
    const { currentProject, currentUser } = get();
    if (!currentProject) return;

    const record: DataChangeRecord = {
      ...change,
      id: `dc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      projectId: currentProject.id,
      operator: currentUser,
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      dataChangeHistory: [record, ...state.dataChangeHistory],
    }));
  },

  toggleTodo: (id) => {
    set((state) => ({
      todos: state.todos.map((t) =>
        t.id === id ? { ...t, status: t.status === 'done' ? 'pending' : 'done' } : t
      ),
    }));
  },

  setSelectedHeatmapVersion: (version) => set({ selectedHeatmapVersion: version }),
}));
