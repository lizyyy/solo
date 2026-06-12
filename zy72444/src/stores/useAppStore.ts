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
  ImportSession,
  ImportDetailItem,
  ImportSourceType,
  TicketType,
  ExportBundle,
} from '@/types';
import {
  mockBatches,
  mockAttendanceRecords,
  mockTicketRecords,
  mockNoteHistories,
  mockAuthorizationAlerts,
  mockProcessSteps,
  mockCalcParams,
  mockImportSessions,
} from '@/data/mockData';
import { detectMixedType, countByType, generateId, generateHash } from '@/utils';

type AttendanceInput = { name: string; type: TicketType; sourcePhotoRef: string; remark?: string };
type TicketInput = { ticketNo: string; type: TicketType; purchaser: string; sourceExportRef: string };

interface ImportPhotoResult {
  session: ImportSession;
  counts: { new: number; dupThis: number; dupHistory: number; updated: number };
}

interface AppState {
  currentRole: UserRole;
  batches: Batch[];
  attendanceRecords: AttendanceRecord[];
  ticketRecords: TicketRecord[];
  noteHistories: NoteHistory[];
  authorizationAlerts: AuthorizationAlert[];
  processSteps: ProcessStep[];
  importSessions: ImportSession[];
  calcParams: CalcParams;
  setCurrentRole: (role: UserRole) => void;
  getBatchById: (id: string) => Batch | undefined;
  getAttendanceByBatchId: (batchId: string) => AttendanceRecord[];
  getTicketsByBatchId: (batchId: string) => TicketRecord[];
  getNoteHistoryByBatchId: (batchId: string) => NoteHistory[];
  getAlertsByBatchId: (batchId: string) => AuthorizationAlert[];
  getProcessStepByBatchId: (batchId: string) => ProcessStep | undefined;
  getImportSessionsByBatchId: (batchId: string) => ImportSession[];

  importAttendanceFromFile: (
    batchId: string,
    fileName: string,
    fileContent: string,
    rows: AttendanceInput[]
  ) => ImportPhotoResult;

  importTicketsFromFile: (
    batchId: string,
    fileName: string,
    fileContent: string,
    rows: TicketInput[]
  ) => ImportPhotoResult;

  updateRecordRemark: (recordId: string, newRemark: string, modifiedBy: UserRole) => { recordId: string; changed: boolean; affected: string[] } | null;

  advanceProcessStep: (batchId: string) => void;
  authorizeBatch: (batchId: string) => void;
  rejectBatch: (batchId: string) => void;
  resolveAlert: (alertId: string) => void;
  createNewBatch: (name: string, date: string) => Batch;
  exportBundle: (batchId: string) => ExportBundle;
  exportAttendanceCSV: (batchId: string) => string;
}

const buildAttendanceDedupKey = (batchId: string, name: string, source: string) =>
  `${batchId}|${name}|${source}`;

const buildTicketDedupKey = (batchId: string, ticketNo: string) =>
  `${batchId}|${ticketNo}`;

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
      importSessions: mockImportSessions,
      calcParams: mockCalcParams,

      setCurrentRole: (role) => set({ currentRole: role }),

      getBatchById: (id) => get().batches.find((b) => b.id === id),

      getAttendanceByBatchId: (batchId) =>
        get().attendanceRecords.filter((r) => r.batchId === batchId),

      getTicketsByBatchId: (batchId) =>
        get().ticketRecords.filter((r) => r.batchId === batchId),

      getNoteHistoryByBatchId: (batchId) =>
        get()
          .noteHistories.filter((h) => h.batchId === batchId)
          .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()),

      getAlertsByBatchId: (batchId) =>
        get().authorizationAlerts.filter((a) => a.batchId === batchId),

      getProcessStepByBatchId: (batchId) =>
        get().processSteps.find((p) => p.batchId === batchId),

      getImportSessionsByBatchId: (batchId) =>
        get()
          .importSessions.filter((s) => s.batchId === batchId)
          .sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()),

      importAttendanceFromFile(batchId, fileName, fileContent, rows) {
        const state = get();
        const sessionId = `sess-${generateId()}`;
        const now = new Date().toISOString();
        const fileHash = generateHash(fileContent + fileName);

        const existingRecords = state.attendanceRecords.filter((r) => r.batchId === batchId);
        const existingDedupMap = new Map(
          existingRecords.map((r) => [r.dedupKey, r])
        );

        const thisSessionDedup = new Set<string>();
        const details: ImportDetailItem[] = [];
        const newRecordsToAdd: AttendanceRecord[] = [];
        const recordsToUpdate: AttendanceRecord[] = [];

        let newCount = 0;
        let dupThis = 0;
        let dupHistory = 0;
        let updatedCount = 0;

        rows.forEach((row, idx) => {
          const dedupKey = buildAttendanceDedupKey(batchId, row.name, row.sourcePhotoRef);
          const lineNo = idx + 1;

          if (thisSessionDedup.has(dedupKey)) {
            dupThis++;
            details.push({
              lineNo,
              dedupKey,
              displayName: row.name,
              status: 'duplicate-this-session',
              message: `本次导入重复：${row.name} 在第${lineNo}行已出现过（本次文件内部重复）`,
            });
            return;
          }
          thisSessionDedup.add(dedupKey);

          const existing = existingDedupMap.get(dedupKey);
          if (existing) {
            if (row.remark && row.remark !== existing.remark) {
              updatedCount++;
              recordsToUpdate.push({
                ...existing,
                remark: row.remark,
                updatedAt: now,
              });
              details.push({
                lineNo,
                dedupKey,
                displayName: row.name,
                status: 'updated',
                existingRecordId: existing.id,
                message: `历史已有记录，但备注已更新：${existing.remark || '(空)'} → ${row.remark}`,
              });
              return;
            }
            dupHistory++;
            details.push({
              lineNo,
              dedupKey,
              displayName: row.name,
              status: 'duplicate-history',
              existingRecordId: existing.id,
              message: `历史导入重复：${row.name} (记录ID ${existing.id}) 已于 ${existing.createdAt} 导入，跳过不翻倍`,
            });
            return;
          }

          const recordId = `att-${generateId()}`;
          newCount++;
          newRecordsToAdd.push({
            id: recordId,
            batchId,
            name: row.name,
            type: row.type,
            sourcePhotoRef: row.sourcePhotoRef,
            remark: row.remark,
            createdAt: now,
            updatedAt: now,
            importSessionId: sessionId,
            dedupKey,
          });
          details.push({
            lineNo,
            dedupKey,
            displayName: row.name,
            status: 'new',
            newRecordId: recordId,
            message: `新增记录：${row.name}（${row.type === 'free' ? '赠票' : '售票'}） ID:${recordId}`,
          });
        });

        const allRecordsForBatch = [
          ...existingRecords.filter((er) => !recordsToUpdate.find((u) => u.id === er.id)),
          ...recordsToUpdate,
          ...newRecordsToAdd,
        ];
        const hasMixed = detectMixedType(allRecordsForBatch);
        const counts = countByType(allRecordsForBatch);
        const totalCount = allRecordsForBatch.length;

        const session: ImportSession = {
          id: sessionId,
          batchId,
          sourceType: 'photo',
          fileName,
          fileHash,
          importedBy: state.currentRole,
          importedAt: now,
          totalInputCount: rows.length,
          newCount,
          duplicateThisSessionCount: dupThis,
          duplicateHistoryCount: dupHistory,
          updatedCount,
          details,
          calcParamsVersion: state.calcParams.version,
        };

        let updatedBatch = state.batches.map((b) =>
          b.id === batchId
            ? {
                ...b,
                attendancePhotoHash: fileHash,
                hasMixedType: hasMixed,
                totalCount,
                freeTicketCount: counts.free,
                paidTicketCount: counts.paid,
                status: (hasMixed ? 'reviewing' : 'pending') as Batch['status'],
                updatedAt: now,
              }
            : b
        );

        let updatedProcessSteps = state.processSteps.map((p) =>
          p.batchId === batchId
            ? {
                ...p,
                step1Completed: true,
                step1At: p.step1At || now,
                currentStep: (Math.max(p.currentStep, 2) as 1 | 2 | 3),
              }
            : p
        );

        const batchInfo = updatedBatch.find((b) => b.id === batchId)!;
        const updatedAlerts = [...state.authorizationAlerts];

        if (hasMixed) {
          const newRecordIds = newRecordsToAdd.map((r) => r.id);
          const existingFreeIds = existingRecords
            .filter((r) => r.type === 'free')
            .map((r) => r.id);
          const newFreeIds = newRecordsToAdd
            .filter((r) => r.type === 'free')
            .map((r) => r.id);
          const allFreeIds = [...existingFreeIds, ...newFreeIds];

          const alertIndex = updatedAlerts.findIndex(
            (a) => a.batchId === batchId && !a.isResolved && a.title.includes('混批')
          );
          const alert: AuthorizationAlert = {
            id: `alert-${generateId()}`,
            batchId,
            title: '存在赠票与售票混批，需要录音师复核',
            reason: `导入会话 ${sessionId} 本批次共 ${totalCount} 人，其中赠票 ${counts.free} 人、售票 ${counts.paid} 人，两种类型混合。已按要求不归为正常，留待录音师复核。本次新增 ${newCount} 条，历史重复 ${dupHistory} 条，本次内部重复 ${dupThis} 条，备注更新 ${updatedCount} 条。`,
            missingMaterials: [
              ...(counts.free > 0 ? [`赠票(${counts.free}人)需标注来源渠道并补盖章确认函`] : []),
              '需核对票务导出表与签到照片是否一一对应',
            ],
            nextStep:
              state.currentRole === 'copyright'
                ? '请版权运营小鹿补看票务导出表并完善赠票备注，然后提交录音师复核。'
                : '请录音师在10分钟内完成混批复核，确认无误后点击授权。',
            assignee: state.currentRole === 'copyright' ? 'copyright' : 'recorder',
            isResolved: false,
            createdAt: now,
            traceImportSessionId: sessionId,
            traceRecordIds: allFreeIds,
          };

          if (alertIndex >= 0) {
            updatedAlerts[alertIndex] = alert;
          } else {
            updatedAlerts.push(alert);
          }
        }

        set((s) => ({
          attendanceRecords: [
            ...s.attendanceRecords.filter(
              (er) => !recordsToUpdate.find((u) => u.id === er.id)
            ),
            ...recordsToUpdate,
            ...newRecordsToAdd,
          ],
          importSessions: [...s.importSessions, session],
          batches: updatedBatch,
          processSteps: updatedProcessSteps,
          authorizationAlerts: updatedAlerts,
        }));

        return {
          session,
          counts: { new: newCount, dupThis, dupHistory, updated: updatedCount },
        };
      },

      importTicketsFromFile(batchId, fileName, fileContent, rows) {
        const state = get();
        const sessionId = `sess-${generateId()}`;
        const now = new Date().toISOString();
        const fileHash = generateHash(fileContent + fileName);

        const existingTickets = state.ticketRecords.filter((r) => r.batchId === batchId);
        const existingDedup = new Map(existingTickets.map((t) => [t.dedupKey, t]));
        const thisSessionDedup = new Set<string>();

        const details: ImportDetailItem[] = [];
        const newTickets: TicketRecord[] = [];
        let newCount = 0;
        let dupThis = 0;
        let dupHistory = 0;

        rows.forEach((row, idx) => {
          const dedupKey = buildTicketDedupKey(batchId, row.ticketNo);
          const lineNo = idx + 1;

          if (thisSessionDedup.has(dedupKey)) {
            dupThis++;
            details.push({
              lineNo,
              dedupKey,
              displayName: `${row.ticketNo} / ${row.purchaser}`,
              status: 'duplicate-this-session',
              message: `本次文件内部重复：票号 ${row.ticketNo} 已在本文件出现`,
            });
            return;
          }
          thisSessionDedup.add(dedupKey);

          if (existingDedup.has(dedupKey)) {
            dupHistory++;
            const ex = existingDedup.get(dedupKey)!;
            details.push({
              lineNo,
              dedupKey,
              displayName: `${row.ticketNo} / ${row.purchaser}`,
              status: 'duplicate-history',
              existingRecordId: ex.id,
              message: `历史已导入：票号 ${row.ticketNo} 记录ID ${ex.id} 已于 ${ex.createdAt} 导入，跳过`,
            });
            return;
          }

          const ticketId = `tkt-${generateId()}`;
          newCount++;
          newTickets.push({
            id: ticketId,
            batchId,
            ticketNo: row.ticketNo,
            type: row.type,
            purchaser: row.purchaser,
            sourceExportRef: row.sourceExportRef,
            createdAt: now,
            dedupKey,
          });
          details.push({
            lineNo,
            dedupKey,
            displayName: `${row.ticketNo} / ${row.purchaser}`,
            status: 'new',
            newRecordId: ticketId,
            message: `新增票务：${row.ticketNo}（${row.type === 'free' ? '赠票' : '售票'}） ID:${ticketId}`,
          });
        });

        const session: ImportSession = {
          id: sessionId,
          batchId,
          sourceType: 'ticket',
          fileName,
          fileHash,
          importedBy: state.currentRole,
          importedAt: now,
          totalInputCount: rows.length,
          newCount,
          duplicateThisSessionCount: dupThis,
          duplicateHistoryCount: dupHistory,
          updatedCount: 0,
          details,
          calcParamsVersion: state.calcParams.version,
        };

        set((s) => ({
          ticketRecords: [...s.ticketRecords, ...newTickets],
          importSessions: [...s.importSessions, session],
          batches: s.batches.map((b) =>
            b.id === batchId ? { ...b, ticketExportHash: fileHash, updatedAt: now } : b
          ),
          processSteps: s.processSteps.map((p) =>
            p.batchId === batchId
              ? {
                  ...p,
                  step2Completed: true,
                  step2At: p.step2At || now,
                  currentStep: 3,
                }
              : p
          ),
          authorizationAlerts: s.authorizationAlerts.map((a) =>
            a.batchId === batchId && a.assignee === 'copyright'
              ? {
                  ...a,
                  assignee: 'recorder' as UserRole,
                  nextStep: `票务导出表已通过会话 ${sessionId} 补入（新增${newCount}条/历史重复${dupHistory}条/内部重复${dupThis}条）。请录音师在10分钟内完成混批复核并授权。`,
                }
              : a
          ),
        }));

        return {
          session,
          counts: { new: newCount, dupThis, dupHistory, updated: 0 },
        };
      },

      updateRecordRemark(recordId, newRemark, modifiedBy) {
        const state = get();
        const record = state.attendanceRecords.find((r) => r.id === recordId);
        if (!record) return null;
        const oldRemark = record.remark || '';
        if (oldRemark === newRemark) return null;

        const now = new Date().toISOString();
        const affected: string[] = ['remark'];
        if (newRemark.includes('赠票') || oldRemark.includes('赠票')) {
          affected.push('赠票来源统计');
        }
        if (newRemark.includes('媒体') || newRemark.includes('员工') || newRemark.includes('合作')) {
          affected.push('报表分类汇总');
        }

        const history: NoteHistory = {
          id: `nh-${generateId()}`,
          batchId: record.batchId,
          recordId,
          oldContent: oldRemark,
          newContent: newRemark,
          modifiedBy,
          modifiedAt: now,
          affectedResultFields: affected,
          operatorName: modifiedBy === 'copyright' ? '版权运营小鹿' : '录音师',
        };

        set((s) => ({
          attendanceRecords: s.attendanceRecords.map((r) =>
            r.id === recordId ? { ...r, remark: newRemark, updatedAt: now } : r
          ),
          noteHistories: [...s.noteHistories, history],
        }));

        return { recordId, changed: true, affected };
      },

      advanceProcessStep: (batchId) => {
        set((s) => ({
          processSteps: s.processSteps.map((p) => {
            if (p.batchId !== batchId) return p;
            const nextStep = Math.min(p.currentStep + 1, 3) as 1 | 2 | 3;
            const updates: Partial<ProcessStep> = { currentStep: nextStep };
            const now = new Date().toISOString();
            if (nextStep === 2 && !p.step2Completed) {
              updates.step2Completed = true;
              updates.step2At = now;
            }
            if (nextStep === 3 && !p.step3Completed) {
              updates.step3Completed = true;
              updates.step3At = now;
            }
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

      exportBundle(batchId) {
        const s = get();
        const batch = s.getBatchById(batchId)!;
        const bundle: ExportBundle = {
          exportVersion: 'v1.0.0',
          exportedAt: new Date().toISOString(),
          batch,
          records: s.getAttendanceByBatchId(batchId),
          tickets: s.getTicketsByBatchId(batchId),
          importSessions: s.getImportSessionsByBatchId(batchId),
          noteHistories: s.getNoteHistoryByBatchId(batchId),
          processStep: s.getProcessStepByBatchId(batchId),
          calcParams: s.calcParams,
        };
        return bundle;
      },

      exportAttendanceCSV(batchId) {
        const s = get();
        const records = s.getAttendanceByBatchId(batchId);
        const headers = [
          '记录ID',
          '姓名',
          '类型',
          '照片位置',
          '备注',
          '去重Key',
          '导入会话ID',
          '创建时间',
          '更新时间',
        ];
        const lines = [headers.join(',')];
        records.forEach((r) => {
          const row = [
            r.id,
            r.name,
            r.type === 'free' ? '赠票' : '售票',
            r.sourcePhotoRef,
            `"${(r.remark || '').replace(/"/g, '""')}"`,
            r.dedupKey,
            r.importSessionId || '',
            r.createdAt,
            r.updatedAt,
          ];
          lines.push(row.join(','));
        });
        return lines.join('\n');
      },
    }),
    {
      name: 'kids-ensemble-checkin-storage-v2',
    }
  )
);
