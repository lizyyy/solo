import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Nameplate, BendLossRecord, ConflictEntry, ScreenshotAttachment, AuditLog, SelfCheckResult, CurrentUser, Direction, ConflictStatus, AuditAction, RecordStatus, RecordChange, ScreenshotChange } from '@/types';
import { genId } from '@/utils/id';
import { detectConflicts } from '@/utils/conflict';
import { runAllSelfChecks, classifyDuplicate } from '@/utils/selfcheck';

type SetState = (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>), replace?: boolean) => void;
type GetState = () => AppState;

interface AppState {
  currentUser: CurrentUser | null;
  nameplates: Nameplate[];
  records: BendLossRecord[];
  conflicts: ConflictEntry[];
  screenshots: ScreenshotAttachment[];
  auditLogs: AuditLog[];
  selfCheckResults: SelfCheckResult[];
  lastSelfCheckTime: string | null;

  login: (role: CurrentUser) => void;
  logout: () => void;

  importNameplate: (data: Omit<Nameplate, 'id' | 'importTime' | 'isLocked' | 'source'>) => string;
  addRecord: (data: Omit<BendLossRecord, 'id' | 'recordTime' | 'screenshotIds' | 'status' | 'isSupplementary' | 'supplementaryNote' | 'reviewConclusion' | 'reviewer' | 'errorNote' | 'lastModified' | 'changeHistory'>) => string;
  addSupplementaryRecord: (data: Omit<BendLossRecord, 'id' | 'recordTime' | 'screenshotIds' | 'status' | 'reviewConclusion' | 'reviewer' | 'lastModified' | 'changeHistory'>) => string;
  addScreenshot: (data: Omit<ScreenshotAttachment, 'id' | 'uploadTime' | 'lastModified' | 'changeHistory'>) => void;
  resolveConflict: (conflictId: string, status: ConflictStatus, resolver: string) => void;
  reviewRecord: (recordId: string, conclusion: string, reviewer: string) => void;
  runSelfCheck: () => SelfCheckResult[];

  updateRecordNote: (recordId: string, field: 'errorNote' | 'supplementaryNote' | 'bendRadius' | 'lossValue' | 'direction', value: string, operator: string) => void;
  updateScreenshotNote: (screenshotId: string, note: string, operator: string) => void;

  recalcConflictsForNameplate: (nameplateId: string) => void;
  recalcConflictsForScreenshot: (screenshotId: string) => void;

  addAuditLog: (recordId: string, action: AuditAction, detail: string, operator: string) => void;
}

function addAuditLogImpl(
  set: SetState,
  get: GetState,
  recordId: string,
  action: AuditAction,
  detail: string,
  operator: string
) {
  const now = new Date().toISOString();
  const log: AuditLog = {
    id: genId(),
    recordId,
    action,
    detail,
    timestamp: now,
    operator,
  };
  set((state: AppState) => ({
    auditLogs: [...state.auditLogs, log],
  }));
}

function recalcConflictsForNameplateImpl(
  set: SetState,
  get: GetState,
  nameplateId: string
) {
  const state = get();
  const np = state.nameplates.find((n: Nameplate) => n.id === nameplateId);
  if (!np) return;
  const operator = state.currentUser?.name || '系统';
  const now = new Date().toISOString();

  const npRecs = state.records.filter((r: BendLossRecord) => r.nameplateId === nameplateId);
  const npSS = state.screenshots.filter((s: ScreenshotAttachment) => npRecs.some((r: BendLossRecord) => r.id === s.recordId));
  const newConflicts = detectConflicts(np, npRecs, npSS);

  set((state: AppState) => {
    const otherConflicts = state.conflicts.filter(c => {
      const rec = state.records.find(r => r.id === c.recordId);
      return rec?.nameplateId !== nameplateId || c.status !== 'pending';
    });

    const oldConflictRecIds = new Set(
      state.conflicts
        .filter(c => {
          const rec = state.records.find(r => r.id === c.recordId);
          return rec?.nameplateId === nameplateId && c.status === 'pending';
        })
        .map(c => c.recordId)
    );
    const newConflictRecIds = new Set(newConflicts.map(c => c.recordId));
    const affectedRecIds = new Set([...oldConflictRecIds, ...newConflictRecIds]);

    const updatedRecords = state.records.map(r => {
      if (!affectedRecIds.has(r.id)) return r;
      const recHasNewConflict = newConflictRecIds.has(r.id);
      const oldStatus = r.status;
      let newStatus: RecordStatus = r.status;

      if (r.direction === '向左' || r.direction === '向右') {
        newStatus = recHasNewConflict ? 'conflict' : 'pending_review';
      } else {
        newStatus = recHasNewConflict ? 'conflict' : (r.isSupplementary ? 'reviewed' : 'normal');
      }

      if (oldStatus === newStatus && !recHasNewConflict) return r;

      const change: RecordChange = {
        id: genId(),
        field: 'direction',
        oldValue: `状态: ${oldStatus}`,
        newValue: `状态: ${newStatus}`,
        changedBy: operator,
        changedAt: now,
        affectedResults: recHasNewConflict
          ? `新增冲突：同铭牌(${np.equipmentCode})补录数据后触发冲突重检，${newConflicts.filter(c => c.recordId === r.id).length}项冲突待裁决`
          : `冲突已解除：同铭牌(${np.equipmentCode})补录数据后重检，原冲突已消失`,
      };
      const prevHistory = r.changeHistory || [];
      return { ...r, status: newStatus, lastModified: now, changeHistory: [...prevHistory, change] };
    });

    return {
      conflicts: [...otherConflicts, ...newConflicts],
      records: updatedRecords,
      selfCheckResults: [],
      lastSelfCheckTime: null,
    };
  });

  const newConflictCount = newConflicts.length;
  const affectedRecCount = npRecs.length;
  addAuditLogImpl(set, get, 'system', 'supplementary_recalc',
    `补录后重算完成: 同铭牌(${np.equipmentCode})所有记录状态、冲突列表、自检缓存已同步更新。受影响记录: ${affectedRecCount}条，新冲突: ${newConflictCount}项`,
    operator);
}

function recalcConflictsForScreenshotImpl(
  set: SetState,
  get: GetState,
  screenshotId: string
) {
  const state = get();
  const ss = state.screenshots.find((s: ScreenshotAttachment) => s.id === screenshotId);
  if (!ss) return;

  const rec = state.records.find((r: BendLossRecord) => r.id === ss.recordId);
  if (!rec) return;

  const np = state.nameplates.find((n: Nameplate) => n.id === rec.nameplateId);
  if (!np) return;

  const operator = state.currentUser?.name || '系统';
  const now = new Date().toISOString();

  const newConflicts = detectConflicts(np, [rec], [ss]);

  set((state: AppState) => {
    const otherConflicts = state.conflicts.filter(c => c.screenshotId !== screenshotId || c.status !== 'pending');

    const oldStatus = rec.status;
    const hasConflict = newConflicts.length > 0;
    let newStatus: RecordStatus = rec.status;

    if (rec.direction === '向左' || rec.direction === '向右') {
      newStatus = hasConflict ? 'conflict' : 'pending_review';
    } else {
      newStatus = hasConflict ? 'conflict' : (rec.isSupplementary ? 'reviewed' : 'normal');
    }

    const updatedRecords = state.records.map(r => {
      if (r.id !== rec.id) return r;
      if (oldStatus === newStatus && !hasConflict) return r;

      const change: RecordChange = {
        id: genId(),
        field: 'direction',
        oldValue: `状态: ${oldStatus}`,
        newValue: `状态: ${newStatus}`,
        changedBy: operator,
        changedAt: now,
        affectedResults: hasConflict
          ? `新增冲突：截图备注变更后检测到 ${newConflicts.length} 项矛盾，状态由 ${oldStatus} → ${newStatus}`
          : `冲突已解除：截图备注变更后重检，原冲突已消失，状态由 ${oldStatus} → ${newStatus}`,
      };
      const prevHistory = r.changeHistory || [];
      return { ...r, status: newStatus, lastModified: now, changeHistory: [...prevHistory, change] };
    });

    return {
      conflicts: [...otherConflicts, ...newConflicts],
      records: updatedRecords,
      selfCheckResults: [],
      lastSelfCheckTime: null,
    };
  });

  const conflictDetails = newConflicts.map(c => `${c.nameplateValue.replace('最小弯曲半径: ', '')} vs ${c.screenshotValue.replace('最小弯曲半径: ', '')}`).join('; ');
  const detail = newConflicts.length > 0
    ? `截图备注变更后检测到 ${newConflicts.length} 项冲突：${conflictDetails}（设备编码: ${np.equipmentCode}）`
    : `截图备注变更后未检测到冲突（设备编码: ${np.equipmentCode}）`;
  addAuditLogImpl(set, get, rec.id, 'conflict_detected', detail, operator);
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      nameplates: [],
      records: [],
      conflicts: [],
      screenshots: [],
      auditLogs: [],
      selfCheckResults: [],
      lastSelfCheckTime: null,

      login: (user) => set({ currentUser: user }),

      logout: () => set({ currentUser: null }),

      importNameplate: (data) => {
        const id = genId();
        const now = new Date().toISOString();
        const nameplate: Nameplate = {
          ...data,
          id,
          importTime: now,
          isLocked: true,
          source: 'nameplate',
        };
        const operator = get().currentUser?.name || '系统';

        set((state) => {
          const existingCodes = state.nameplates.filter(np => np.equipmentCode.trim() === data.equipmentCode.trim());
          if (existingCodes.length > 0) {
            const existingIds = existingCodes.map(np => np.id.slice(0, 10)).join(', ');
            setTimeout(() => {
              addAuditLogImpl(
                set,
                get,
                id,
                'nameplate_duplicate_warning',
                `铭牌参数重复警告: 设备编码"${data.equipmentCode}"与已导入的 ${existingCodes.length} 条铭牌相同 (ID: ${existingIds}) — 请注意是否误操作`,
                operator
              );
            }, 0);
          }
          const newConflicts = detectConflicts(nameplate, state.records, state.screenshots);
          return {
            nameplates: [...state.nameplates, nameplate],
            conflicts: [...state.conflicts, ...newConflicts],
          };
        });

        addAuditLogImpl(set, get, id, 'import', `导入铭牌参数: 设备编码 ${data.equipmentCode}, 类型${data.fiberType}, 芯径${data.coreDiameter}μm, 最小弯曲半径${data.minBendRadius}mm`, operator);
        return id;
      },

      addRecord: (data) => {
        const id = genId();
        const now = new Date().toISOString();
        const direction = data.direction as Direction;
        const status: RecordStatus = direction === '向左' ? 'pending_review' : 'normal';
        const record: BendLossRecord = {
          ...data,
          id,
          recordTime: now,
          screenshotIds: [],
          status,
          isSupplementary: false,
          changeHistory: [],
        };
        const operator = get().currentUser?.name || '系统';

        set((state) => {
          const newConflicts: ConflictEntry[] = [];
          for (const np of state.nameplates) {
            if (np.id === data.nameplateId) {
              const detected = detectConflicts(np, [record], state.screenshots);
              newConflicts.push(...detected);
            }
          }
          const hasConflict = newConflicts.length > 0;
          const finalRecord: BendLossRecord = hasConflict ? { ...record, status: 'conflict' as RecordStatus } : record;

          const dupInfo = classifyDuplicate(finalRecord, state.records, state.nameplates);
          if (dupInfo.category !== 'new_record') {
            setTimeout(() => {
              addAuditLogImpl(
                set,
                get,
                id,
                'record_duplicate_warning',
                `${dupInfo.description} (匹配: ${dupInfo.matchRecordIds.map(rid => rid.slice(0,10)).join(', ')})`,
                '系统'
              );
            }, 0);
          }

          return {
            records: [...state.records, finalRecord],
            conflicts: [...state.conflicts, ...newConflicts],
          };
        });

        addAuditLogImpl(set, get, id, 'create', `录入弯曲损耗数据: 半径${data.bendRadius}mm 方向${data.direction} 损耗${data.lossValue}dB`, operator);
        if (direction === '向左') {
          addAuditLogImpl(set, get, id, 'review', `方向为"向左"，自动标记为待复核（不自动归为正常），请实验老师确认`, '系统');
        }
        return id;
      },

      addSupplementaryRecord: (data) => {
        const id = genId();
        const now = new Date().toISOString();
        const direction = data.direction as Direction;
        const status: RecordStatus = direction === '向左' ? 'pending_review' : 'reviewed';
        const operator = get().currentUser?.name || '系统';
        const record: BendLossRecord = {
          ...data,
          id,
          recordTime: now,
          screenshotIds: [],
          status,
          isSupplementary: true,
          lastModified: now,
          changeHistory: [],
          reviewConclusion: status === 'reviewed' ? `补录数据，已由${operator}确认` : undefined,
          reviewer: status === 'reviewed' ? operator : undefined,
        };
        const np = get().nameplates.find((n: Nameplate) => n.id === data.nameplateId);
        const equipmentCode = np ? np.equipmentCode : data.nameplateId.slice(0, 10);

        set((state) => {
          const allRecs = [...state.records, record];
          return { records: allRecs };
        });

        addAuditLogImpl(set, get, id, 'supplementary', `补录数据: ${data.supplementaryNote || '无说明'} — 数据: R=${data.bendRadius}mm D=${data.direction} L=${data.lossValue}dB`, operator);
        recalcConflictsForNameplateImpl(set, get, data.nameplateId);
        addAuditLogImpl(set, get, id, 'supplementary_recalc', `补录后重算完成: 同铭牌(${equipmentCode})所有记录状态、冲突列表、自检缓存已同步更新`, '系统');
        return id;
      },

      addScreenshot: (data) => {
        const id = genId();
        const now = new Date().toISOString();
        const screenshot: ScreenshotAttachment = {
          ...data,
          id,
          uploadTime: now,
          changeHistory: [],
        };
        const operator = get().currentUser?.name || '系统';

        set((state) => {
          const updatedRecords = state.records.map(r =>
            r.id === data.recordId ? { ...r, screenshotIds: [...r.screenshotIds, id], lastModified: now } : r
          );
          const newConflicts: ConflictEntry[] = [];
          const record = state.records.find(r => r.id === data.recordId);
          if (record) {
            for (const np of state.nameplates) {
              if (np.id === record.nameplateId) {
                const detected = detectConflicts(np, [record], [{ ...screenshot }]);
                newConflicts.push(...detected);
              }
            }
          }
          return {
            screenshots: [...state.screenshots, screenshot],
            records: updatedRecords,
            conflicts: [...state.conflicts, ...newConflicts],
          };
        });

        addAuditLogImpl(set, get, data.recordId, 'create', `上传维修群截图: 备注="${data.note}" (保留原文，不清洗)`, operator);
      },

      resolveConflict: (conflictId, status, resolver) => {
        let targetRecordId = '';
        set((state) => {
          const conflict = state.conflicts.find(c => c.id === conflictId);
          targetRecordId = conflict?.recordId || '';
          const now = new Date().toISOString();
          return {
            conflicts: state.conflicts.map(c =>
              c.id === conflictId ? { ...c, status, resolvedBy: resolver, resolvedAt: now } : c
            ),
            records: state.records.map(r => {
              if (conflict && r.id === conflict.recordId && status !== 'rejected') {
                const change: RecordChange = {
                  id: genId(),
                  field: 'direction',
                  oldValue: `conflict(${conflict.nameplateValue} vs ${conflict.screenshotValue})`,
                  newValue: status === 'confirmed_nameplate' ? `nameplate:${conflict.nameplateValue}` : `screenshot:${conflict.screenshotValue}`,
                  changedBy: resolver,
                  changedAt: now,
                  affectedResults: `冲突已裁决，状态由 conflict → normal`,
                };
                const prevHistory = r.changeHistory || [];
                return { ...r, status: 'normal' as RecordStatus, lastModified: now, changeHistory: [...prevHistory, change] };
              }
              return r;
            }),
          };
        });
        const operator = get().currentUser?.name || resolver;
        const statusLabel = status === 'confirmed_nameplate' ? '确认铭牌' : status === 'confirmed_screenshot' ? '确认截图' : '驳回';
        addAuditLogImpl(
          set,
          get,
          targetRecordId,
          'conflict_resolved',
          `冲突裁决: ${statusLabel} — 裁决人: ${operator}`,
          operator
        );
      },

      reviewRecord: (recordId, conclusion, reviewer) => {
        const now = new Date().toISOString();
        set((state) => ({
          records: state.records.map(r => {
            if (r.id !== recordId) return r;
            const change: RecordChange = {
              id: genId(),
              field: 'direction',
              oldValue: `${r.direction} (状态: pending_review)`,
              newValue: `${r.direction} (状态: reviewed, 结论: ${conclusion})`,
              changedBy: reviewer,
              changedAt: now,
              affectedResults: `方向判定复核完成，导出状态就绪`,
            };
            const prevHistory = r.changeHistory || [];
            return { ...r, status: 'reviewed' as RecordStatus, reviewConclusion: conclusion, reviewer, lastModified: now, changeHistory: [...prevHistory, change] };
          }),
        }));
        addAuditLogImpl(set, get, recordId, 'review', `实验老师复核: 方向判定结论 — ${conclusion}`, reviewer);
      },

      runSelfCheck: () => {
        const state = get();
        const results = runAllSelfChecks(state.nameplates, state.records, state.conflicts, state.screenshots);
        set({ selfCheckResults: results, lastSelfCheckTime: new Date().toISOString() });
        const operator = state.currentUser?.name || '系统';
        const allPassed = results.every(r => r.passed);
        const failedCount = results.filter(r => !r.passed).length;
        const passedCount = results.filter(r => r.passed).length;
        addAuditLogImpl(
          set,
          get,
          'system',
          'selfcheck',
          `自检完成: ${passedCount}项通过，${failedCount}项未通过。${allPassed ? '可导出报告。' : '请修复问题后重新自检。'}`,
          operator
        );
        return results;
      },

      updateRecordNote: (recordId, field, value, operator) => {
        const now = new Date().toISOString();
        let oldVal = '';
        set((state) => {
          const record = state.records.find(r => r.id === recordId);
          if (!record) return state;
          const prevHistory = record.changeHistory || [];

          if (field === 'errorNote') oldVal = record.errorNote || '(空)';
          else if (field === 'supplementaryNote') oldVal = record.supplementaryNote || '(空)';
          else if (field === 'bendRadius') oldVal = `${record.bendRadius}mm`;
          else if (field === 'lossValue') oldVal = `${record.lossValue}dB`;
          else if (field === 'direction') oldVal = record.direction;

          const change: RecordChange = {
            id: genId(),
            field,
            oldValue: oldVal,
            newValue: value,
            changedBy: operator,
            changedAt: now,
            affectedResults: field === 'errorNote'
              ? '更新误差/备注说明，不影响数值'
              : field === 'supplementaryNote'
                ? '更新补录说明，关联记录统计已联动'
                : `变更字段 ${field}，请重新运行自检`,
          };

          const updatedRecords = state.records.map(r => {
            if (r.id !== recordId) return r;
            const newRec: BendLossRecord = { ...r, lastModified: now, changeHistory: [...prevHistory, change] };
            if (field === 'errorNote') newRec.errorNote = value;
            else if (field === 'supplementaryNote') newRec.supplementaryNote = value;
            else if (field === 'bendRadius') newRec.bendRadius = parseFloat(value);
            else if (field === 'lossValue') newRec.lossValue = parseFloat(value);
            else if (field === 'direction') newRec.direction = value as Direction;
            return newRec;
          });

          return { records: updatedRecords };
        });

        addAuditLogImpl(
          set,
          get,
          recordId,
          'edit',
          `修改 ${field}: "${oldVal}" → "${value}" (修改人: ${operator})`,
          operator
        );
      },

      updateScreenshotNote: (screenshotId, note, operator) => {
        const now = new Date().toISOString();
        let oldVal = '';
        let recordId = '';
        set((state) => {
          const ss = state.screenshots.find(s => s.id === screenshotId);
          if (!ss) return state;
          oldVal = ss.note || '(空)';
          recordId = ss.recordId;
          const prevHistory = ss.changeHistory || [];
          const change: ScreenshotChange = {
            id: genId(),
            field: 'note',
            oldValue: oldVal,
            newValue: note,
            changedBy: operator,
            changedAt: now,
          };
          const updatedSS = state.screenshots.map(s =>
            s.id === screenshotId ? { ...s, note, lastModified: now, changeHistory: [...prevHistory, change] } : s
          );
          return { screenshots: updatedSS };
        });

        if (recordId) {
          addAuditLogImpl(
            set,
            get,
            recordId,
            'edit',
            `修改维修群截图备注: "${oldVal}" → "${note}" (修改人: ${operator}) — 原文保留在变更历史中`,
            operator
          );
          recalcConflictsForScreenshotImpl(set, get, screenshotId);
        }
      },

      recalcConflictsForNameplate: (nameplateId) => {
        recalcConflictsForNameplateImpl(set, get, nameplateId);
      },

      recalcConflictsForScreenshot: (screenshotId) => {
        recalcConflictsForScreenshotImpl(set, get, screenshotId);
      },

      addAuditLog: (recordId, action, detail, operator) => {
        addAuditLogImpl(set, get, recordId, action, detail, operator);
      },
    }),
    {
      name: 'fiber-bend-loss-storage',
    }
  )
);
