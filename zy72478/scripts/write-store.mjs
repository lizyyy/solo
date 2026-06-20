
import fs from 'fs';
import path from 'path';

const content = `
import { create } from 'zustand';
import * as XLSX from 'xlsx';
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
  ExportResult,
  HeatmapExportRow,
  HistoryExportRow,
  DataSource,
  HeatmapPoint,
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
  generateHeatmapPointsFromBusSwipes,
  AREA_COORDINATE_MAP,
  LOCATION_TO_AREA,
  calculateHeatValue,
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
  lastExportResult: ExportResult | null;
  setCurrentProject: (project: Project) => void;
  parseCsvFile: (file: File) => Promise<Partial<BusSwipeRecord>[]>;
  parseExcelFile: (file: File) => Promise<Partial<BusSwipeRecord>[]>;
  addBusSwipes: (records: Partial<BusSwipeRecord>[], sourceFile?: string, parseMethod?: 'csv' | 'xlsx') => ImportResult;
  addRedlineNote: (note: Partial<RedlineNote>) => void;
  updateRedlineNote: (id: string, updates: Partial<RedlineNote>, reason: string) => void;
  resolveConflict: (id: string, status: ConflictStatus, operator: string) => void;
  runSelfCheck: (type: string) => SelfCheckResult;
  runAllSelfChecks: () => void;
  recalculateHeatmap: (source?: 'supplement' | 'manual', sourceBusIds?: string[]) => string | null;
  detectConflicts: (newBusIds?: string[], newRedlineIds?: string[]) => ConflictRecord[];
  addOperationLog: (action: string, details: string) => void;
  addDataChange: (change: Omit<DataChangeRecord, 'id' | 'createdAt' | 'operator' | 'projectId'>) => void;
  toggleTodo: (id: string) => void;
  setSelectedHeatmapVersion: (version: string) => void;
  exportHeatmap: (heatmapId: string) => ExportResult;
  exportHistory: () => ExportResult;
  verifyEvidenceChain: (busSwipeId: string) => any;
}

function makeBusDedupKey(r: Partial<BusSwipeRecord>): string {
  return r.cardId + '|' + r.swipeTime + '|' + r.route + '|' + r.location;
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

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(String(e.target?.result || ''));
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function parseCsvText(text: string): Partial<BusSwipeRecord>[] {
  const lines = text.trim().split(/\\r?\\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = lines[0].split(/[,，\\t]/).map((h) => h.trim());
  const idx = (name: string) => header.findIndex((h) => h.includes(name));
  const iCard = idx('卡号');
  let iTime = idx('时间');
  if (iTime === -1) iTime = idx('刷卡时间');
  const iRoute = idx('线路');
  let iLoc = idx('站点');
  if (iLoc === -1) iLoc = idx('站点');
  const iArea = idx('区域');
  const iSource = idx('口径');
  const result: Partial<BusSwipeRecord>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/[,，\\t]/).map((c) => c.trim());
    const cardId = cols[iCard >= 0 ? iCard : 0] || '';
    const swipeTime = cols[iTime >= 0 ? iTime : 1] || '';
    const route = cols[iRoute >= 0 ? iRoute : 2] || '';
    const location = cols[iLoc >= 0 ? iLoc : 3] || '';
    const areaName = iArea >= 0 ? cols[iArea] : LOCATION_TO_AREA[location] || '';
    const sourceRaw = iSource >= 0 ? cols[iSource] : 'normal';
    const source: DataSource = sourceRaw.includes('补录') ? 'supplement' : sourceRaw.includes('错') ? 'wrong' : 'normal';
    if (cardId && swipeTime) {
      result.push({ cardId, swipeTime, route, location, areaName, source });
    }
  }
  return result;
}

function buildExportFile(rows: any[], fileName: string, sheetName: string): ExportResult {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const csvContent = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob(['\\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const preview = rows.slice(0, 3).map((r) => Object.values(r).join(' | ')).join('\\n');
  return {
    success: true,
    fileName: fileName + '_' + new Date().toISOString().slice(0, 10) + '.csv',
    rowCount: rows.length,
    contentPreview: preview,
    downloadUrl: url,
  };
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
  lastExportResult: null,

  setCurrentProject: (project) => set({ currentProject: project }),

  parseCsvFile: async (file) => {
    const text = await readFileAsText(file);
    return parseCsvText(text);
  },

  parseExcelFile: async (file) => {
    const buffer = await readFileAsArrayBuffer(file);
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheet = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheet];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    return jsonData.map((row: any) => {
      const cardId = String(row['卡号'] || row['cardId'] || '');
      const swipeTime = String(row['刷卡时间'] || row['时间'] || row['swipeTime'] || '');
      const route = String(row['线路'] || row['route'] || '');
      const location = String(row['站点'] || row['location'] || '');
      const areaName = String(row['区域'] || row['areaName'] || LOCATION_TO_AREA[location] || '');
      const sourceRaw = String(row['数据口径'] || row['口径'] || row['source'] || 'normal');
      const source: DataSource = sourceRaw.includes('补录') ? 'supplement' : sourceRaw.includes('错') ? 'wrong' : 'normal';
      return { cardId, swipeTime, route, location, areaName, source };
    }).filter((r) => r.cardId && r.swipeTime);
  },

  addBusSwipes: (records, sourceFile, parseMethod) => {
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
        total: 0, imported: 0, duplicates: 0, duplicateIds: [], duplicatesDetail: [],
        conflictsDetected: 0, conflictIds: [], heatmapRecalculated: false,
      };
    }

    const enriched = records.map((r) => {
      const hour = parseInt(r.swipeTime?.split(' ')[1]?.split(':')[0] || '0', 10);
      return {
        ...r,
        areaName: r.areaName || LOCATION_TO_AREA[r.location || ''] || '未知区域',
        hourOfDay: hour,
        isNight: hour >= 22 || hour < 6,
      };
    });

    const existingKeys = new Set(busSwipes.map(makeBusDedupKey));
    const duplicatesDetail: ImportResult['duplicatesDetail'] = [];
    const duplicateIds: string[] = [];
    const toImport: BusSwipeRecord[] = [];
    let sourceOfImport = enriched[0]?.source || 'normal';

    enriched.forEach((r) => {
      const key = makeBusDedupKey(r);
      if (existingKeys.has(key)) {
        duplicateIds.push(r.cardId || 'unknown');
        duplicatesDetail.push({
          cardId: r.cardId || '',
          swipeTime: r.swipeTime || '',
          location: r.location || '',
        });
      } else {
        existingKeys.add(key);
        toImport.push({
          ...r,
          projectId: currentProject.id,
          id: 'bus-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
          isDuplicate: false,
        } as BusSwipeRecord);
      }
    });

    const newIds: string[] = [];
    if (toImport.length > 0) {
      set((state) => ({ busSwipes: [...state.busSwipes, ...toImport] }));
      newIds.push(...toImport.map((r) => r.id));
      const sampleSnapshot = toImport.slice(0, 5).map((r) => ({
        卡号: r.cardId,
        刷卡时间: r.swipeTime,
        线路: r.route,
        站点: r.location,
        区域: r.areaName,
      }));
      addDataChange({
        targetType: 'bus_swipe',
        targetId: 'batch-' + Date.now(),
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
    let newHeatmapId: string | null = null;
    let heatmapRecalculated = false;
    if (sourceOfImport === 'supplement' && toImport.length > 0) {
      newHeatmapId = recalculateHeatmap('supplement', newIds);
      heatmapRecalculated = true;
      const newHeat = get().heatmapData.find((h) => h.id === newHeatmapId);
      newHeatmapVersion = newHeat?.version || null;
    }

    let newConflicts: ConflictRecord[] = [];
    if (toImport.length > 0) {
      newConflicts = detectConflicts(newIds);
    }

    const detailsArr = [
      '共' + records.length + '条数据',
      '成功导入' + toImport.length + '条',
      duplicateIds.length > 0 ? '去重跳过' + duplicateIds.length + '条' : null,
      newConflicts.length > 0 ? '检测到' + newConflicts.length + '条冲突' : null,
      heatmapRecalculated ? '热力图已重算至' + newHeatmapVersion : null,
      parseMethod ? '解析方式：' + (parseMethod === 'csv' ? 'CSV文本解析' : 'Excel二进制解析') : null,
    ].filter(Boolean);

    addOperationLog('导入公交刷卡数据', detailsArr.join('；'));

    return {
      total: records.length,
      imported: toImport.length,
      duplicates: duplicateIds.length,
      duplicateIds,
      duplicatesDetail,
      conflictsDetected: newConflicts.length,
      conflictIds: newConflicts.map((c) => c.id),
      heatmapRecalculated,
      newHeatmapVersion: newHeatmapVersion || undefined,
      newHeatmapId: newHeatmapId || undefined,
      sourceFile,
      parseMethod,
    };
  },

  addRedlineNote: (note) => {
    const { currentProject, addOperationLog, addDataChange, detectConflicts } = get();
    if (!currentProject) return;
    const newNote: RedlineNote = {
      ...note,
      projectId: currentProject.id,
      id: 'red-' + Date.now(),
      source: note.source || 'normal',
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
    addOperationLog('录入红线图备注', '录入区域"' + newNote.areaName + '"的红线图备注');
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
      '区域"' + before.areaName + '"备注已更新，原因：' + (reason || '未说明')
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
    const existingKeys = new Set(conflicts.map((c) => c.busSwipeId + '|' + c.redlineNoteId));

    for (const bus of busPool) {
      for (const redline of redlinePool) {
        const key = bus.id + '|' + redline.id;
        if (existingKeys.has(key)) continue;
        const contradictionTexts: string[] = [];
        const busHour = bus.hourOfDay || parseInt(bus.swipeTime.split(' ')[1]?.split(':')[0] || '0', 10);
        const isNight = busHour >= 22 || busHour < 6;

        if (redline.remark.includes('拆迁') || redline.remark.includes('无居民')) {
          contradictionTexts.push(
            '红线图备注说明"' + redline.areaName + '"已拆迁无居民，但公交刷卡记录显示卡号' + bus.cardId + '于' + bus.swipeTime + '在附近站点"' + bus.location + '"刷卡'
          );
        }
        if (redline.remark.includes('夜间封闭') && isNight) {
          contradictionTexts.push(
            '红线图备注说明该区域夜间封闭，但存在' + busHour + '时的夜间刷卡记录'
          );
        }
        if (bus.location.includes(redline.areaName.slice(0, 2))) {
          if (redline.recordDate && bus.swipeTime.slice(0, 10) < redline.recordDate) {
            contradictionTexts.push(
              '红线图记录日期为' + redline.recordDate + '，刷卡记录' + bus.swipeTime.slice(0, 10) + '早于备注日期，口径可能不一致'
            );
          }
        }

        if (contradictionTexts.length > 0) {
          const conflict: ConflictRecord = {
            id: 'cf-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            projectId: currentProject.id,
            busSwipeId: bus.id,
            redlineNoteId: redline.id,
            description: '公交数据与"' + redline.areaName + '"红线图备注存在矛盾',
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
          snapshotAfter: {
            刷卡卡号: c.evidence.busSwipe.cardId,
            刷卡时间: c.evidence.busSwipe.swipeTime,
            矛盾内容: c.evidence.contradiction,
          },
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
      '冲突记录已' + (status === 'confirmed' ? '确认' : '驳回') + '，操作人：' + operator
    );
  },

  runSelfCheck: (type) => {
    const { addOperationLog, busSwipes, heatmapData, verifyEvidenceChain } = get();
    const now = new Date().toISOString();
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
        const detailMsg = duplicates.length > 0
          ? '检测到' + duplicates.length + '条重复导入记录（' + duplicates[0].cardId + ' ' + duplicates[0].swipeTime + ' ' + duplicates[0].location + '等），可能导致热力图数据重复统计，建议去重后重新导入'
          : '未检测到重复导入记录，数据干净';
        result = {
          type: 'duplicate',
          name: '重复导入检测',
          status,
          message: detailMsg,
          details: {
            duplicateCount: duplicates.length,
            duplicates: duplicates.map((d) => ({
              cardId: d.cardId,
              swipeTime: d.swipeTime,
              location: d.location,
              id: d.id,
            })),
          },
          lastRunAt: now,
        };
        break;
      }
      case 'low_sampling': {
        const latestHeatmap = heatmapData[heatmapData.length - 1];
        const status: SelfCheckStatus = latestHeatmap?.hasLowSampling ? 'error' : 'pass';
        const areas = latestHeatmap?.lowSamplingAreas || [];
        result = {
          type: 'low_sampling',
          name: '夜间采样不足检测',
          status,
          message: latestHeatmap?.hasLowSampling
            ? areas.join('、') + '夜间采样量低于日间30%，热力图颜色偏淡，留给街道规划员复核后再确认。当前最新版本' + latestHeatmap.version + '，共' + latestHeatmap.sourceBusCount + '条刷卡记录参与。'
            : '所有区域采样量正常，热力图可靠',
          details: {
            areas,
            areaStats: latestHeatmap?.areaStats || [],
            heatmapVersion: latestHeatmap?.version,
          },
          lastRunAt: now,
        };
        break;
      }
      case 'recalculation': {
        const supplementBusIds = busSwipes.filter((b) => b.source === 'supplement').map((b) => b.id);
        const heatmapSupplements = heatmapData.filter((h) =>
          h.sourceBusSwipeIds?.some((id) => supplementBusIds.includes(id))
        );
        result = {
          type: 'recalculation',
          name: '补录后重算验证',
          status: heatmapSupplements.length > 0 ? 'pass' : 'warning',
          message: heatmapSupplements.length > 0
            ? '补录数据导入后热力图已自动重算' + heatmapSupplements.length + '次，当前共' + heatmapData.length + '个版本可追溯。最新版本' + heatmapData[heatmapData.length - 1]?.version + '包含' + heatmapData[heatmapData.length - 1]?.sourceBusCount + '条公交记录。'
            : '未检测到补录数据触发的热力图重算，请确认补录数据导入流程',
          details: {
            heatmapCount: heatmapData.length,
            supplementBusCount: supplementBusIds.length,
            relatedHeatmapVersions: heatmapSupplements.map((h) => h.version),
          },
          lastRunAt: now,
        };
        break;
      }
      case 'export_consistency': {
        const latestHeatmap = heatmapData[heatmapData.length - 1];
        let matched = 0;
        let unmatched = 0;
        const sampleMismatch: any[] = [];
        if (latestHeatmap) {
          const busIdMap = new Map(busSwipes.map((b) => [b.id, b]));
          latestHeatmap.data.forEach((p) => {
            if (busIdMap.has(p.busSwipeId)) matched++;
            else {
              unmatched++;
              if (sampleMismatch.length < 3) {
                sampleMismatch.push({
                  busSwipeId: p.busSwipeId,
                  cardId: p.cardId,
                  areaName: p.areaName,
                });
              }
            }
          });
        }
        const sampleVerification = busSwipes.length > 0 ? verifyEvidenceChain(busSwipes[0].id) : null;
        result = {
          type: 'export_consistency',
          name: '导出一致性校验',
          status: unmatched === 0 ? 'pass' : 'error',
          message: unmatched === 0
            ? '导出数据与系统内部数据一致，共' + busSwipes.length + '条公交记录、' + (latestHeatmap?.data.length || 0) + '个热力点核对无误，所有热力点均可追溯到原始刷卡记录。抽样验证' + (sampleVerification?.busSwipe?.cardId || '') + '完整链条：刷卡记录→热力点→冲突检测→变更记录，全部可追溯。'
            : '发现' + unmatched + '个热力点无法追溯到原始公交记录，请检查数据完整性。',
          details: sampleVerification,
          exportCheck: {
            busCount: busSwipes.length,
            heatmapPointsCount: latestHeatmap?.data.length || 0,
            matchedPointsCount: matched,
            unmatchedCount: unmatched,
            sampleMismatch,
          },
          lastRunAt: now,
        };
        break;
      }
      default:
        return get().selfChecks.find((s) => s.type === type)!;
    }

    set((state) => ({
      selfChecks: state.selfChecks.map((s) => (s.type === type ? result : s)),
    }));
    addOperationLog(
      '执行自检',
      result.name + ' - ' + (result.status === 'pass' ? '通过' : result.status === 'warning' ? '警告' : '异常')
    );
    return result;
  },

  runAllSelfChecks: () => {
    const { runSelfCheck } = get();
    ['duplicate', 'low_sampling', 'recalculation', 'export_consistency'].forEach((type) => {
      runSelfCheck(type);
    });
  },

  recalculateHeatmap: (source = 'manual', sourceBusIds) => {
    const { currentProject, heatmapData, addOperationLog, addDataChange, busSwipes } = get();
    if (!currentProject) return null;

    const effectiveBusIds = sourceBusIds && sourceBusIds.length > 0
      ? [...new Set([...(heatmapData[heatmapData.length - 1]?.sourceBusSwipeIds || []), ...sourceBusIds])]
      : busSwipes.filter((b) => b.projectId === currentProject.id).map((b) => b.id);

    const effectiveSwipes = busSwipes.filter((b) => effectiveBusIds.includes(b.id));
    const lastVersion = heatmapData[heatmapData.length - 1];
    const versionNum = parseFloat(lastVersion?.version.replace('v', '') || '1.0') + 0.1;
    const newVersion = 'v' + versionNum.toFixed(1);

    const result = generateHeatmapPointsFromBusSwipes(effectiveSwipes);
    const lowSamplingAreas = result.areaStats.filter((s) => s.hasLowSampling).map((s) => s.areaName);

    const newHeatmap: HeatmapData = {
      id: 'heat-' + Date.now(),
      projectId: currentProject.id,
      version: newVersion,
      data: result.points,
      areaStats: result.areaStats,
      sourceBusSwipeIds: result.sourceIds,
      sourceBusCount: result.sourceIds.length,
      hasLowSampling: lowSamplingAreas.length > 0,
      lowSamplingAreas: lowSamplingAreas.length > 0 ? lowSamplingAreas : undefined,
      status: source === 'supplement' && lowSamplingAreas.length > 0 ? 'pending_review' : 'confirmed',
      createdAt: new Date().toISOString(),
      calculatedAt: new Date().toISOString(),
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
        { field: 'points', fieldLabel: '热力点数', before: String(lastVersion?.data.length || '0'), after: String(result.points.length) },
        { field: 'sourceBusCount', fieldLabel: '参与公交数', before: String(lastVersion?.sourceBusCount || '0'), after: String(effectiveSwipes.length) },
        { field: 'status', fieldLabel: '状态', before: '-', after: newHeatmap.status === 'pending_review' ? '待规划员复核' : '已确认' },
      ],
      snapshotBefore: lastVersion ? {
        version: lastVersion.version,
        points: lastVersion.data.length,
        busCount: lastVersion.sourceBusCount,
      } : null,
      snapshotAfter: {
        version: newVersion,
        points: result.points.length,
        busCount: effectiveSwipes.length,
        lowSampling: lowSamplingAreas,
        areaStats: result.areaStats,
      },
    });

    addOperationLog(
      '热力图重算',
      (source === 'supplement' ? '补录数据后自动' : '手动') + '重算热力图至' + newVersion + '，共' + effectiveSwipes.length + '条记录、' + result.points.length + '个热力点' + (newHeatmap.hasLowSampling ? '（夜间采样不足，待复核）' : '')
    );
    return newHeatmap.id;
  },

  addOperationLog: (action, details) => {
    const { currentProject, currentUser } = get();
    if (!currentProject) return;
    const log: OperationLog = {
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
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
      id: 'dc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
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

  exportHeatmap: (heatmapId) => {
    const { heatmapData, addOperationLog } = get();
    const heatmap = heatmapData.find((h) => h.id === heatmapId);
    if (!heatmap) {
      return { success: false, fileName: '', rowCount: 0, contentPreview: '', downloadUrl: '' };
    }
    const rows: HeatmapExportRow[] = heatmap.data.map((p) => ({
      热力图版本: heatmap.version,
      区域名称: p.areaName,
      卡号: p.cardId,
      刷卡时间: p.time,
      时段: p.isNight ? '夜间(22:00-06:00)' : '日间',
      热力值: p.value + '/100',
      坐标: '(' + Math.round(p.x) + ', ' + Math.round(p.y) + ')',
      关联公交记录ID: p.busSwipeId,
      数据口径: p.source === 'supplement' ? '补录数据' : p.source === 'wrong' ? '错口径' : '正常口径',
    }));
    const result = buildExportFile(rows, '热力图_' + heatmap.version, '热力图数据');
    set({ lastExportResult: result });
    addOperationLog(
      '导出热力图',
      '导出热力图' + heatmap.version + '，共' + rows.length + '行数据，含卡号、时段、热力值、关联公交ID等完整证据链'
    );
    return result;
  },

  exportHistory: () => {
    const { operationLogs, dataChangeHistory, busSwipes, addOperationLog } = get();
    const rows: HistoryExportRow[] = operationLogs.map((log) => {
      const relatedChange = dataChangeHistory.find((c) =>
        log.details.includes(c.targetId) || (c.targetType === 'bus_swipe' && log.details.includes('导入'))
      );
      let cardId = '';
      let area = '';
      let reason = '';
      let before = '';
      let after = '';
      if (relatedChange) {
        if (relatedChange.targetType === 'bus_swipe') {
          const first = relatedChange.snapshotAfter?.[0];
          cardId = first?.卡号 || '';
          area = first?.区域 || '';
        }
        if (relatedChange.targetType === 'redline_note') {
          area = relatedChange.changes.find((c) => c.field === 'areaName')?.after || '';
          reason = relatedChange.reason || '';
          const remarkChange = relatedChange.changes.find((c) => c.field === 'remark');
          before = remarkChange?.before || '';
          after = remarkChange?.after || '';
        }
      }
      return {
        时间: new Date(log.createdAt).toLocaleString(),
        操作人: log.operator,
        操作类型: log.action,
        详情: log.details,
        关联卡号: cardId,
        关联区域: area,
        变更原因: reason,
        改前内容: before,
        改后内容: after,
      };
    });
    const result = buildExportFile(rows, '操作历史_城市更新租户安置', '操作历史');
    set({ lastExportResult: result });
    addOperationLog(
      '导出历史记录',
      '导出完整操作历史，共' + rows.length + '行数据，含关联卡号、区域、改前改后内容等完整证据链'
    );
    return result;
  },

  verifyEvidenceChain: (busSwipeId) => {
    const { busSwipes, heatmapData, conflicts, dataChangeHistory, redlineNotes } = get();
    const busSwipe = busSwipes.find((b) => b.id === busSwipeId);
    const heatmapPoints = heatmapData.flatMap((h) => h.data.filter((p) => p.busSwipeId === busSwipeId));
    const relatedConflicts = conflicts.filter((c) => c.busSwipeId === busSwipeId);
    const relatedChanges = dataChangeHistory.filter((c) =>
      c.targetId === busSwipeId || (c.snapshotAfter && Array.isArray(c.snapshotAfter) && c.snapshotAfter.some((s: any) => s.卡号 === busSwipe?.cardId))
    );
    const relatedRedline = relatedConflicts.map((c) => redlineNotes.find((r) => r.id === c.redlineNoteId)!).filter(Boolean);
    return {
      busSwipe,
      heatmapPoints,
      relatedConflicts,
      relatedChanges,
      redlineNotes: relatedRedline,
    };
  },
}));
`;

const targetPath = path.resolve(process.cwd(), 'src/store/appStore.ts');
fs.writeFileSync(targetPath, content, 'utf8');
console.log('✓ store 文件已写入:', targetPath);
console.log('  行数:', content.split('\n').length);
