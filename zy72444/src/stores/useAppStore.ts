import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Batch,
  AttendanceRecord,
  TicketRecord,
  NoteHistory,
  AuthorizationAlert,
  ProcessStep,
  CalcParams,
  UserRole,
} from '@/types';
import {
  mockBatches,
  mockAttendanceRecords,
  mockTicketRecords,
  mockNoteHistories,
  mockAuthorizationAlerts,
  mockProcessSteps,
  mockCalcParams,
} from '@/data/mockData';
import { detectMixedType, countByType, generateId, generateHash } from '@/utils';

interface AppState {
  currentRole: UserRole;
  batches: Batch[];
  attendanceRecords: AttendanceRecord[];
  ticketRecords: TicketRecord[];
  noteHistories: NoteHistory[];
  authorizationAlerts: AuthorizationAlert[];
  processSteps: ProcessStep[];
  calcParams: CalcParams;
  importedPhotoHashes: string[];
  importedTicketHashes: string[];
  setCurrentRole: (role: UserRole) => void;
  getBatchById: (id: string) => Batch | undefined;
  getAttendanceByBatchId: (batchId: string) => AttendanceRecord[];
  getTicketsByBatchId: (batchId: string) => TicketRecord[];
  getNoteHistoryByBatchId: (batchId: string) => NoteHistory[];
  getAlertsByBatchId: (batchId: string) => AuthorizationAlert[];
  getProcessStepByBatchId: (batchId: string) => ProcessStep | undefined;
  importAttendancePhoto: (batchId: string, photoContent: string, records: Omit<AttendanceRecord, 'id' | 'batchId' | 'createdAt'>[]) => { success: boolean; isDuplicate: boolean; message: string };
  importTicketExport: (batchId: string, exportContent: string, records: Omit<TicketRecord, 'id' | 'batchId' | 'createdAt'>[]) => { success: boolean; isDuplicate: boolean; message: string };
  updateRecordRemark: (recordId: string, newRemark: string, modifiedBy: UserRole) => void;
  advanceProcessStep: (batchId: string) => void;
  authorizeBatch: (batchId: string) => void;
  rejectBatch: (batchId: string) => void;
  resolveAlert: (alertId: string) => void;
  createNewBatch: (name: string, date: string) => Batch;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentRole: 'copyright',
      batches: mockBatches,
      attendanceRecords: mockAttendanceRecords,
      ticketRecords: mockTicketRecords,
      noteHistories: mockNoteHistories,
      authorizationAlerts: mockAuthorizationAlerts,
      processSteps: mockProcessSteps,
      calcParams: mockCalcParams,
      importedPhotoHashes: ['abc123xyz', 'ghi789rst', 'jkl012mno'],
      importedTicketHashes: ['def456uvw', 'pqr345stu'],

      setCurrentRole: (role) => set({ currentRole: role }),

      getBatchById: (id) => get().batches.find((b) => b.id === id),

      getAttendanceByBatchId: (batchId) =>
        get().attendanceRecords.filter((r) => r.batchId === batchId),

      getTicketsByBatchId: (batchId) =>
        get().ticketRecords.filter((r) => r.batchId === batchId),

      getNoteHistoryByBatchId: (batchId) =>
        get().noteHistories.filter((h) => h.batchId === batchId).sort((a, b) =>
          new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
        ),

      getAlertsByBatchId: (batchId) =>
        get().authorizationAlerts.filter((a) => a.batchId === batchId),

      getProcessStepByBatchId: (batchId) =>
        get().processSteps.find((p) => p.batchId === batchId),

      importAttendancePhoto: (batchId, photoContent, records) => {
        const state = get();
        const hash = generateHash(photoContent);

        if (state.importedPhotoHashes.includes(hash)) {
          return {
            success: false,
            isDuplicate: true,
            message: '该照片已导入过，不会重复计数',
          };
        }

        const newRecords: AttendanceRecord[] = records.map((r) => ({
          ...r,
          id: `att-${generateId()}`,
          batchId,
          createdAt: new Date().toISOString(),
        }));

        const hasMixed = detectMixedType(newRecords);
        const counts = countByType(newRecords);

        set((s) => ({
          importedPhotoHashes: [...s.importedPhotoHashes, hash],
          attendanceRecords: [...s.attendanceRecords, ...newRecords],
          batches: s.batches.map((b) =>
            b.id === batchId
              ? {
                  ...b,
                  attendancePhotoHash: hash,
                  hasMixedType: hasMixed,
                  totalCount: newRecords.length,
                  freeTicketCount: counts.free,
                  paidTicketCount: counts.paid,
                  status: hasMixed ? 'reviewing' : 'pending',
                  updatedAt: new Date().toISOString(),
                }
              : b
          ),
          processSteps: s.processSteps.map((p) =>
            p.batchId === batchId
              ? {
                  ...p,
                  step1Completed: true,
                  step1At: new Date().toISOString(),
                  currentStep: (p.currentStep < 2 ? 2 : p.currentStep) as 1 | 2 | 3,
                }
              : p
          ),
        }));

        if (hasMixed) {
          const batch = get().getBatchById(batchId);
          if (batch) {
            const newAlert: AuthorizationAlert = {
              id: `alert-${generateId()}`,
              batchId,
              title: '存在赠票与售票混批，需要录音师复核',
              reason: `本批次共${batch.totalCount}人，其中${batch.freeTicketCount}人为赠票、${batch.paidTicketCount}人为售票，两种类型混合在同一批次导入。根据流程要求，混批数据不可直接标记为正常，需录音师最终确认。`,
              missingMaterials: ['请核对票务导出表与签到照片是否一一对应', '赠票需要标注来源渠道'],
              nextStep: '请版权运营小鹿补看票务导出表并完善备注，然后提交录音师复核。',
              assignee: 'copyright',
              isResolved: false,
              createdAt: new Date().toISOString(),
            };
            set((s) => ({
              authorizationAlerts: [...s.authorizationAlerts, newAlert],
            }));
          }
        }

        return {
          success: true,
          isDuplicate: false,
          message: `成功导入 ${newRecords.length} 条签到记录`,
        };
      },

      importTicketExport: (batchId, exportContent, records) => {
        const state = get();
        const hash = generateHash(exportContent);

        if (state.importedTicketHashes.includes(hash)) {
          return {
            success: false,
            isDuplicate: true,
            message: '该票务导出表已导入过',
          };
        }

        const newRecords: TicketRecord[] = records.map((r) => ({
          ...r,
          id: `tkt-${generateId()}`,
          batchId,
          createdAt: new Date().toISOString(),
        }));

        set((s) => ({
          importedTicketHashes: [...s.importedTicketHashes, hash],
          ticketRecords: [...s.ticketRecords, ...newRecords],
          batches: s.batches.map((b) =>
            b.id === batchId
              ? { ...b, ticketExportHash: hash, updatedAt: new Date().toISOString() }
              : b
          ),
          processSteps: s.processSteps.map((p) =>
            p.batchId === batchId
              ? {
                  ...p,
                  step2Completed: true,
                  step2At: new Date().toISOString(),
                  currentStep: 3,
                }
              : p
          ),
          authorizationAlerts: s.authorizationAlerts.map((a) =>
            a.batchId === batchId && a.assignee === 'copyright'
              ? {
                  ...a,
                  assignee: 'recorder' as UserRole,
                  nextStep: '票务导出表已补充，请录音师在10分钟内完成复核并授权。',
                  updatedAt: new Date().toISOString(),
                }
              : a
          ),
        }));

        return {
          success: true,
          isDuplicate: false,
          message: `成功导入 ${newRecords.length} 条票务记录`,
        };
      },

      updateRecordRemark: (recordId, newRemark, modifiedBy) => {
        const state = get();
        const record = state.attendanceRecords.find((r) => r.id === recordId);
        if (!record) return;

        const oldRemark = record.remark || '';
        if (oldRemark === newRemark) return;

        const history: NoteHistory = {
          id: `nh-${generateId()}`,
          batchId: record.batchId,
          recordId,
          oldContent: oldRemark,
          newContent: newRemark,
          modifiedBy,
          modifiedAt: new Date().toISOString(),
        };

        set((s) => ({
          attendanceRecords: s.attendanceRecords.map((r) =>
            r.id === recordId ? { ...r, remark: newRemark } : r
          ),
          noteHistories: [...s.noteHistories, history],
        }));
      },

      advanceProcessStep: (batchId) => {
        set((s) => ({
          processSteps: s.processSteps.map((p) => {
            if (p.batchId !== batchId) return p;
            const nextStep = Math.min(p.currentStep + 1, 3) as 1 | 2 | 3;
            const updates: Partial<ProcessStep> = { currentStep: nextStep };
            if (nextStep === 2) updates.step2Completed = true;
            if (nextStep === 3) updates.step3Completed = true;
            return { ...p, ...updates };
          }),
        }));
      },

      authorizeBatch: (batchId) => {
        const now = new Date().toISOString();
        set((s) => ({
          batches: s.batches.map((b) =>
            b.id === batchId ? { ...b, status: 'authorized', updatedAt: now } : b
          ),
          processSteps: s.processSteps.map((p) =>
            p.batchId === batchId
              ? { ...p, step3Completed: true, step3At: now, currentStep: 3 }
              : p
          ),
          authorizationAlerts: s.authorizationAlerts.map((a) =>
            a.batchId === batchId ? { ...a, isResolved: true } : a
          ),
        }));
      },

      rejectBatch: (batchId) => {
        set((s) => ({
          batches: s.batches.map((b) =>
            b.id === batchId
              ? { ...b, status: 'rejected', updatedAt: new Date().toISOString() }
              : b
          ),
          authorizationAlerts: s.authorizationAlerts.map((a) =>
            a.batchId === batchId
              ? {
                  ...a,
                  assignee: 'copyright' as UserRole,
                  nextStep: '录音师已退回，请重新核对材料并修改备注。',
                }
              : a
          ),
        }));
      },

      resolveAlert: (alertId) => {
        set((s) => ({
          authorizationAlerts: s.authorizationAlerts.map((a) =>
            a.id === alertId ? { ...a, isResolved: true } : a
          ),
        }));
      },

      createNewBatch: (name, date) => {
        const batchId = `batch-${generateId()}`;
        const now = new Date().toISOString();
        const newBatch: Batch = {
          id: batchId,
          name,
          date,
          status: 'pending',
          hasMixedType: false,
          totalCount: 0,
          freeTicketCount: 0,
          paidTicketCount: 0,
          attendancePhotoHash: '',
          createdAt: now,
          updatedAt: now,
        };

        const newProcessStep: ProcessStep = {
          id: `ps-${generateId()}`,
          batchId,
          currentStep: 1,
          step1Completed: false,
          step2Completed: false,
          step3Completed: false,
        };

        set((s) => ({
          batches: [newBatch, ...s.batches],
          processSteps: [...s.processSteps, newProcessStep],
        }));

        return newBatch;
      },
    }),
    {
      name: 'kids-ensemble-checkin-storage',
    }
  )
);
