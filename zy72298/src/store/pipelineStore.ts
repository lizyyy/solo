import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  PipelineRecord,
  HistoryEntry,
  Conflict,
  SelfCheckReport,
  ConflictResolution,
  MaterialType,
  CoordinateType,
  Coordinate,
  WorkflowStatus,
  SelfCheckCategory,
} from '@/types';

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function now(): string {
  return new Date().toISOString();
}

function computeNextStatus(record: PipelineRecord, allRecords: PipelineRecord[]): WorkflowStatus {
  if (record.status === 'rejected') return 'rejected';
  if (record.isCoordinateMixed) return 'pending_review';

  const hasPendingConflict = (recordId: string, conflicts: Conflict[]) =>
    conflicts.some((c) => c.recordId === recordId && c.status === 'pending');

  if (!record.cadLayer) return 'step1';
  if (record.siteInstruction) return 'step3';
  return 'step2';
}

interface PipelineStore {
  records: PipelineRecord[];
  history: HistoryEntry[];
  conflicts: Conflict[];
  selfCheckReports: SelfCheckReport[];
  currentUser: string;

  setCurrentUser: (user: string) => void;
  addRecord: (data: {
    photoNumber: string;
    materialType: MaterialType;
    coordinate: Coordinate;
  }) => PipelineRecord;
  updateCadLayer: (recordId: string, cadLayer: string) => void;
  resolveConflict: (conflictId: string, resolution: ConflictResolution, note?: string) => void;
  updateSiteInstruction: (recordId: string, instruction: string) => void;
  markCoordinateReviewed: (recordId: string, reviewNote: string) => void;
  advanceStatus: (recordId: string, status: WorkflowStatus) => void;
  detectConflicts: () => void;
  detectCoordinateMixed: () => void;
  recalcStatus: (recordId: string) => void;
  runSelfCheck: () => SelfCheckReport;
  exportData: () => string;
  clearAll: () => void;
}

export const usePipelineStore = create<PipelineStore>()(
  persist(
    (set, get) => ({
      records: [],
      history: [],
      conflicts: [],
      selfCheckReports: [],
      currentUser: '培训教官老梁',

      setCurrentUser: (user) => set({ currentUser: user }),

      addRecord: (data) => {
        const existing = get().records.filter(
          (r) => r.photoNumber === data.photoNumber
        );
        const record: PipelineRecord = {
          id: uid(),
          photoNumber: data.photoNumber,
          materialType: data.materialType,
          coordinate: data.coordinate,
          status: 'step1',
          isCoordinateMixed: false,
          createdBy: get().currentUser,
          updatedBy: get().currentUser,
          createdAt: now(),
          updatedAt: now(),
        };

        const historyEntry: HistoryEntry = {
          id: uid(),
          recordId: record.id,
          action: 'import',
          operator: get().currentUser,
          timestamp: now(),
          changes: [
            { field: 'photoNumber', oldValue: null, newValue: data.photoNumber },
            { field: 'coordinate', oldValue: null, newValue: JSON.stringify(data.coordinate) },
            { field: 'status', oldValue: null, newValue: 'step1' },
          ],
          evidence: existing.length > 0
            ? `照片编号 ${data.photoNumber} 已存在 ${existing.length} 条记录，可能为重复导入`
            : undefined,
        };

        if (existing.length > 0) {
          const conflict: Conflict = {
            id: uid(),
            recordId: record.id,
            type: 'duplicate_import',
            evidence: [{
              description: `照片编号 ${data.photoNumber} 重复导入`,
              photoValue: data.photoNumber,
              cadValue: `已有 ${existing.length} 条相同编号记录`,
            }],
            status: 'pending',
          };
          set((s) => ({
            records: [...s.records, record],
            history: [...s.history, historyEntry],
            conflicts: [...s.conflicts, conflict],
          }));
        } else {
          set((s) => ({
            records: [...s.records, record],
            history: [...s.history, historyEntry],
          }));
        }

        return record;
      },

      updateCadLayer: (recordId, cadLayer) => {
        const record = get().records.find((r) => r.id === recordId);
        if (!record) return;

        const oldCadLayer = record.cadLayer;
        const oldStatus = record.status;

        set((s) => {
          const updatedRecords = s.records.map((r) =>
            r.id === recordId
              ? { ...r, cadLayer, updatedBy: s.currentUser, updatedAt: now() }
              : r
          );
          const updatedRecord = updatedRecords.find((r) => r.id === recordId)!;
          const newStatus = computeNextStatus(updatedRecord, updatedRecords);

          return {
            records: updatedRecords.map((r) =>
              r.id === recordId ? { ...r, status: newStatus } : r
            ),
            history: [
              ...s.history,
              {
                id: uid(),
                recordId,
                action: 'update_cad' as const,
                operator: s.currentUser,
                timestamp: now(),
                changes: [
                  { field: 'cadLayer', oldValue: oldCadLayer ?? null, newValue: cadLayer },
                  { field: 'status', oldValue: oldStatus, newValue: newStatus },
                ],
              },
            ],
          };
        });

        get().detectConflicts();
        get().detectCoordinateMixed();
      },

      resolveConflict: (conflictId, resolution, note) => {
        const conflict = get().conflicts.find((c) => c.id === conflictId);
        if (!conflict) return;

        set((s) => {
          const updatedConflicts = s.conflicts.map((c) =>
            c.id === conflictId
              ? { ...c, status: 'resolved' as const, resolution, resolvedBy: s.currentUser, resolvedAt: now() }
              : c
          );

          const updatedRecords = s.records.map((r) => {
            if (r.id !== conflict.recordId) return r;
            return { ...r, resolutionNote: note, updatedBy: s.currentUser, updatedAt: now() };
          });

          const updatedRecord = updatedRecords.find((r) => r.id === conflict.recordId)!;
          const newStatus = computeNextStatus(updatedRecord, updatedRecords);

          const finalRecords = updatedRecords.map((r) =>
            r.id === conflict.recordId ? { ...r, status: newStatus } : r
          );

          const oldStatus = s.records.find((r) => r.id === conflict.recordId)?.status;

          return {
            conflicts: updatedConflicts,
            records: finalRecords,
            history: [
              ...s.history,
              {
                id: uid(),
                recordId: conflict.recordId,
                action: 'resolve_conflict' as const,
                operator: s.currentUser,
                timestamp: now(),
                changes: [
                  { field: 'conflictResolution', oldValue: 'pending', newValue: resolution },
                  { field: 'resolutionNote', oldValue: null, newValue: note || '' },
                  { field: 'status', oldValue: oldStatus ?? null, newValue: newStatus },
                ],
                evidence: conflict.evidence.map((e) => e.description).join('; '),
              },
            ],
          };
        });
      },

      updateSiteInstruction: (recordId, instruction) => {
        const record = get().records.find((r) => r.id === recordId);
        if (!record) return;

        const oldInstruction = record.siteInstruction;
        const oldStatus = record.status;

        set((s) => {
          const updatedRecords = s.records.map((r) =>
            r.id === recordId
              ? { ...r, siteInstruction: instruction, updatedBy: s.currentUser, updatedAt: now() }
              : r
          );
          const updatedRecord = updatedRecords.find((r) => r.id === recordId)!;
          const newStatus = computeNextStatus(updatedRecord, updatedRecords);

          return {
            records: updatedRecords.map((r) =>
              r.id === recordId ? { ...r, status: newStatus } : r
            ),
            history: [
              ...s.history,
              {
                id: uid(),
                recordId,
                action: 'update_instruction' as const,
                operator: s.currentUser,
                timestamp: now(),
                changes: [
                  { field: 'siteInstruction', oldValue: oldInstruction ?? null, newValue: instruction },
                  { field: 'status', oldValue: oldStatus, newValue: newStatus },
                ],
              },
            ],
          };
        });
      },

      markCoordinateReviewed: (recordId, reviewNote) => {
        const record = get().records.find((r) => r.id === recordId);
        if (!record) return;

        const oldStatus = record.status;
        const oldMixed = record.isCoordinateMixed;

        set((s) => {
          const updatedRecords = s.records.map((r) =>
            r.id === recordId
              ? { ...r, isCoordinateMixed: false, updatedBy: s.currentUser, updatedAt: now() }
              : r
          );
          const updatedRecord = updatedRecords.find((r) => r.id === recordId)!;
          const newStatus = computeNextStatus(updatedRecord, updatedRecords);

          return {
            records: updatedRecords.map((r) =>
              r.id === recordId ? { ...r, status: newStatus } : r
            ),
            history: [
              ...s.history,
              {
                id: uid(),
                recordId,
                action: 'review_coordinate' as const,
                operator: s.currentUser,
                timestamp: now(),
                changes: [
                  { field: 'isCoordinateMixed', oldValue: oldMixed, newValue: false },
                  { field: 'status', oldValue: oldStatus, newValue: newStatus },
                  { field: 'reviewNote', oldValue: null, newValue: reviewNote },
                ],
                evidence: `巡检组复核完成: ${reviewNote}。原坐标类型(${record.coordinate.type})保留，状态从 ${oldStatus} 推进至 ${newStatus}。下一步: ${newStatus === 'step2' ? '前往现场说明页更新作业说明' : newStatus === 'step3' ? '作业说明已填写，确认即可' : '继续处理'}`,
              },
            ],
          };
        });
      },

      advanceStatus: (recordId, status) => {
        const record = get().records.find((r) => r.id === recordId);
        if (!record) return;

        const oldStatus = record.status;
        set((s) => ({
          records: s.records.map((r) =>
            r.id === recordId
              ? { ...r, status, updatedBy: s.currentUser, updatedAt: now() }
              : r
          ),
          history: [
            ...s.history,
            {
              id: uid(),
              recordId,
              action: 'update_instruction' as const,
              operator: s.currentUser,
              timestamp: now(),
              changes: [{ field: 'status', oldValue: oldStatus, newValue: status }],
            },
          ],
        }));
      },

      recalcStatus: (recordId) => {
        const record = get().records.find((r) => r.id === recordId);
        if (!record) return;
        const newStatus = computeNextStatus(record, get().records);
        if (record.status !== newStatus) {
          get().advanceStatus(recordId, newStatus);
        }
      },

      detectConflicts: () => {
        const { records } = get();
        const newConflicts: Conflict[] = [];

        const byPhoto = new Map<string, PipelineRecord[]>();
        records.forEach((r) => {
          const list = byPhoto.get(r.photoNumber) || [];
          list.push(r);
          byPhoto.set(r.photoNumber, list);
        });

        byPhoto.forEach((group, photoNumber) => {
          const withCad = group.filter((r) => r.cadLayer);
          if (withCad.length <= 1) return;

          const layers = new Set(withCad.map((r) => r.cadLayer));
          if (layers.size > 1) {
            const values = Array.from(layers);
            const alreadyExists = get().conflicts.some(
              (c) => c.type === 'photo_cad_mismatch' && c.status === 'pending' && withCad.some((r) => r.id === c.recordId)
            );
            if (!alreadyExists) {
              newConflicts.push({
                id: uid(),
                recordId: withCad[0].id,
                type: 'photo_cad_mismatch',
                evidence: [{
                  description: `照片编号 ${photoNumber} 对应多个CAD图层名`,
                  photoValue: photoNumber,
                  cadValue: values.join(' / '),
                }],
                status: 'pending',
              });
            }
          }
        });

        records.forEach((r) => {
          if (!r.cadLayer || !r.photoNumber) return;
          const photoPrefix = r.photoNumber.split('-')[0];
          const cadPrefix = r.cadLayer.split('-')[0];
          if (photoPrefix && cadPrefix && photoPrefix !== cadPrefix) {
            const existing = get().conflicts.find(
              (c) => c.recordId === r.id && c.type === 'photo_cad_mismatch' && c.status === 'pending'
            );
            if (!existing) {
              newConflicts.push({
                id: uid(),
                recordId: r.id,
                type: 'photo_cad_mismatch',
                evidence: [{
                  description: `照片编号前缀(${photoPrefix})与CAD图层名前缀(${cadPrefix})不一致`,
                  photoValue: r.photoNumber,
                  cadValue: r.cadLayer,
                }],
                status: 'pending',
              });
            }
          }
        });

        if (newConflicts.length > 0) {
          set((s) => ({ conflicts: [...s.conflicts, ...newConflicts] }));
        }
      },

      detectCoordinateMixed: () => {
        const { records, conflicts } = get();
        const hasLatlng = records.some((r) => r.coordinate.type === 'latlng');
        const hasMetric = records.some((r) => r.coordinate.type === 'metric');

        if (!hasLatlng || !hasMetric) return;

        set((s) => {
          const updatedRecords = s.records.map((r) => {
            const mixed =
              (r.coordinate.type === 'latlng' && hasMetric) ||
              (r.coordinate.type === 'metric' && hasLatlng);
            if (mixed && !r.isCoordinateMixed) {
              return { ...r, isCoordinateMixed: true, updatedAt: now() };
            }
            if (!mixed && r.isCoordinateMixed) {
              return { ...r, isCoordinateMixed: false, updatedAt: now() };
            }
            return r;
          });

          const finalRecords = updatedRecords.map((r) => {
            const newStatus = computeNextStatus(r, updatedRecords);
            if (r.status !== newStatus) {
              return { ...r, status: newStatus };
            }
            return r;
          });

          const newHistoryEntries: HistoryEntry[] = [];
          finalRecords.forEach((r) => {
            const oldRecord = s.records.find((or) => or.id === r.id);
            if (!oldRecord) return;
            if (oldRecord.isCoordinateMixed !== r.isCoordinateMixed) {
              newHistoryEntries.push({
                id: uid(),
                recordId: r.id,
                action: 'review_coordinate' as const,
                operator: '系统自动检测',
                timestamp: now(),
                changes: [
                  { field: 'isCoordinateMixed', oldValue: oldRecord.isCoordinateMixed, newValue: r.isCoordinateMixed },
                  { field: 'status', oldValue: oldRecord.status, newValue: r.status },
                ],
                evidence: r.isCoordinateMixed
                  ? `检测到系统中同时存在经纬度和米制坐标，本记录坐标类型为${r.coordinate.type === 'latlng' ? '经纬度' : '米制'}，标记为待巡检组复核。不自动归为正常，需巡检组确认处理。`
                  : `坐标混合标记已解除`,
              });
            }
          });

          return {
            records: finalRecords,
            history: [...s.history, ...newHistoryEntries],
          };
        });
      },

      runSelfCheck: () => {
        const { records, conflicts } = get();
        const timestamp = now();

        const duplicateIssues: SelfCheckCategory['issues'] = [];
        const photoCount = new Map<string, number>();
        records.forEach((r) => {
          photoCount.set(r.photoNumber, (photoCount.get(r.photoNumber) || 0) + 1);
        });
        photoCount.forEach((count, photoNumber) => {
          if (count > 1) {
            const record = records.find((r) => r.photoNumber === photoNumber);
            if (record) {
              duplicateIssues.push({ recordId: record.id, photoNumber, count, detail: `重复导入 ${count} 次` });
            }
          }
        });

        const coordMixedIssues: SelfCheckCategory['issues'] = [];
        records.forEach((r) => {
          if (r.isCoordinateMixed) {
            coordMixedIssues.push({
              recordId: r.id,
              photoNumber: r.photoNumber,
              detail: `坐标类型为${r.coordinate.type === 'latlng' ? '经纬度' : '米制'}，但系统中存在混合坐标，状态: ${r.status}，待巡检组复核`,
            });
          }
        });

        const suppRecalcIssues: SelfCheckCategory['issues'] = [];
        const supplementaryRecords = records.filter((r) => r.materialType === 'supplementary');
        supplementaryRecords.forEach((r) => {
          const relatedRecords = records.filter(
            (rr) => rr.photoNumber.startsWith(r.photoNumber.split('-')[0]) && rr.id !== r.id
          );
          const hasInconsistent = relatedRecords.some(
            (rr) => rr.status !== 'confirmed' && rr.status !== 'step3'
          );
          if (hasInconsistent) {
            suppRecalcIssues.push({
              recordId: r.id,
              photoNumber: r.photoNumber,
              detail: '补录后关联记录状态不一致，需要重新计算',
            });
          }
        });

        const exportIssues: SelfCheckCategory['issues'] = [];
        records.forEach((r) => {
          if (!r.photoNumber || !r.coordinate.type) {
            exportIssues.push({
              recordId: r.id,
              photoNumber: r.photoNumber || '未知',
              detail: '关键字段缺失，导出将不完整',
            });
          }
          if (r.status === 'pending_review') {
            exportIssues.push({
              recordId: r.id,
              photoNumber: r.photoNumber,
              detail: `记录处于待复核状态，坐标混合未处理，导出结果可能不反映最终结论`,
            });
          }
        });

        const pendingConflicts = conflicts.filter((c) => c.status === 'pending');
        if (pendingConflicts.length > 0) {
          pendingConflicts.forEach((c) => {
            const record = records.find((r) => r.id === c.recordId);
            if (record) {
              exportIssues.push({
                recordId: record.id,
                photoNumber: record.photoNumber,
                detail: `存在未解决的冲突(${c.type})，导出结果可能不完整`,
              });
            }
          });
        }

        const checks: SelfCheckReport['checks'] = {
          duplicateImport: { passed: duplicateIssues.length === 0, issues: duplicateIssues },
          coordinateMixed: { passed: coordMixedIssues.length === 0, issues: coordMixedIssues },
          supplementaryRecalc: { passed: suppRecalcIssues.length === 0, issues: suppRecalcIssues },
          exportConsistency: { passed: exportIssues.length === 0, issues: exportIssues },
        };

        const overallPassed = Object.values(checks).every((c) => c.passed);

        const report: SelfCheckReport = {
          id: uid(),
          timestamp,
          checks,
          overallPassed,
        };

        set((s) => ({
          selfCheckReports: [...s.selfCheckReports, report],
        }));

        return report;
      },

      exportData: () => {
        const { records, history, conflicts } = get();
        return JSON.stringify({ records, history, conflicts, exportedAt: now() }, null, 2);
      },

      clearAll: () => {
        set({ records: [], history: [], conflicts: [], selfCheckReports: [] });
      },
    }),
    {
      name: 'pipeline-storage',
    }
  )
);

if (typeof window !== 'undefined') {
  (window as any).__PIPELINE_STORE__ = usePipelineStore;
}
