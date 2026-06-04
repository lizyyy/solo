import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Nameplate, BendLossRecord, ConflictEntry, ScreenshotAttachment, AuditLog, SelfCheckResult, CurrentUser, Direction, ConflictStatus, AuditAction, RecordStatus } from '@/types';
import { genId } from '@/utils/id';
import { detectConflicts } from '@/utils/conflict';
import { runAllSelfChecks } from '@/utils/selfcheck';

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
  addRecord: (data: Omit<BendLossRecord, 'id' | 'recordTime' | 'screenshotIds' | 'status' | 'isSupplementary' | 'supplementaryNote' | 'reviewConclusion' | 'reviewer'>) => string;
  addSupplementaryRecord: (data: Omit<BendLossRecord, 'id' | 'recordTime' | 'screenshotIds' | 'status' | 'reviewConclusion' | 'reviewer'>) => string;
  addScreenshot: (data: Omit<ScreenshotAttachment, 'id' | 'uploadTime'>) => void;
  resolveConflict: (conflictId: string, status: ConflictStatus, resolver: string) => void;
  reviewRecord: (recordId: string, conclusion: string, reviewer: string) => void;
  runSelfCheck: () => SelfCheckResult[];

  addAuditLog: (recordId: string, action: AuditAction, detail: string, operator: string) => void;
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
        const nameplate: Nameplate = {
          ...data,
          id,
          importTime: new Date().toISOString(),
          isLocked: true,
          source: 'nameplate',
        };
        set((state) => {
          const newConflicts = detectConflicts(nameplate, state.records, state.screenshots);
          return {
            nameplates: [...state.nameplates, nameplate],
            conflicts: [...state.conflicts, ...newConflicts],
          };
        });
        const operator = get().currentUser?.name || '系统';
        get().addAuditLog(id, 'import', `导入铭牌参数: 设备编码 ${data.equipmentCode}`, operator);
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
        };
        set((state) => {
          const newConflicts: ConflictEntry[] = [];
          for (const np of state.nameplates) {
            if (np.id === data.nameplateId) {
              const detected = detectConflicts(np, [record], state.screenshots);
              newConflicts.push(...detected);
            }
          }
          const hasConflict = newConflicts.length > 0;
          const finalRecord = hasConflict ? { ...record, status: 'conflict' as RecordStatus } : record;
          return {
            records: [...state.records, finalRecord],
            conflicts: [...state.conflicts, ...newConflicts],
          };
        });
        const operator = get().currentUser?.name || '系统';
        get().addAuditLog(id, 'create', `录入弯曲损耗数据: 半径${data.bendRadius}mm 方向${data.direction} 损耗${data.lossValue}dB`, operator);
        if (direction === '向左') {
          get().addAuditLog(id, 'review', `方向为"向左"，自动标记为待复核`, '系统');
        }
        return id;
      },

      addSupplementaryRecord: (data) => {
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
          isSupplementary: true,
        };
        set((state) => ({
          records: [...state.records, record],
        }));
        const operator = get().currentUser?.name || '系统';
        get().addAuditLog(id, 'supplementary', `补录数据: ${data.supplementaryNote || '无说明'}`, operator);
        return id;
      },

      addScreenshot: (data) => {
        const id = genId();
        const screenshot: ScreenshotAttachment = {
          ...data,
          id,
          uploadTime: new Date().toISOString(),
        };
        set((state) => {
          const updatedRecords = state.records.map(r =>
            r.id === data.recordId ? { ...r, screenshotIds: [...r.screenshotIds, id] } : r
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
        const operator = get().currentUser?.name || '系统';
        get().addAuditLog(data.recordId, 'create', `上传维修群截图: "${data.note}"`, operator);
      },

      resolveConflict: (conflictId, status, resolver) => {
        let targetRecordId = '';
        set((state) => {
          const conflict = state.conflicts.find(c => c.id === conflictId);
          targetRecordId = conflict?.recordId || '';
          return {
            conflicts: state.conflicts.map(c =>
              c.id === conflictId ? { ...c, status, resolvedBy: resolver, resolvedAt: new Date().toISOString() } : c
            ),
            records: state.records.map(r => {
              if (conflict && r.id === conflict.recordId && status !== 'rejected') {
                return { ...r, status: 'normal' as RecordStatus };
              }
              return r;
            }),
          };
        });
        const operator = get().currentUser?.name || resolver;
        get().addAuditLog(
          targetRecordId,
          'conflict_resolved',
          `冲突裁决: ${status === 'confirmed_nameplate' ? '确认铭牌' : status === 'confirmed_screenshot' ? '确认截图' : '驳回'}`,
          operator
        );
      },

      reviewRecord: (recordId, conclusion, reviewer) => {
        set((state) => ({
          records: state.records.map(r =>
            r.id === recordId ? { ...r, status: 'reviewed' as RecordStatus, reviewConclusion: conclusion, reviewer } : r
          ),
        }));
        get().addAuditLog(recordId, 'review', `实验老师复核: ${conclusion}`, reviewer);
      },

      runSelfCheck: () => {
        const state = get();
        const results = runAllSelfChecks(state.records, state.conflicts);
        set({ selfCheckResults: results, lastSelfCheckTime: new Date().toISOString() });
        const operator = state.currentUser?.name || '系统';
        const allPassed = results.every(r => r.passed);
        get().addAuditLog('system', 'selfcheck', `自检${allPassed ? '全部通过' : '存在未通过项'}`, operator);
        return results;
      },

      addAuditLog: (recordId, action, detail, operator) => {
        const log: AuditLog = {
          id: genId(),
          recordId,
          action,
          detail,
          operator,
          timestamp: new Date().toISOString(),
        };
        set((state) => ({
          auditLogs: [...state.auditLogs, log],
        }));
      },
    }),
    {
      name: 'fiber-bend-loss-storage',
      partialize: (state) => ({
        nameplates: state.nameplates,
        records: state.records,
        conflicts: state.conflicts,
        screenshots: state.screenshots,
        auditLogs: state.auditLogs,
        currentUser: state.currentUser,
      }),
    }
  )
);
