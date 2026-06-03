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
  markCoordinateReviewed: (recordId: string) => void;
  advanceStatus: (recordId: string, status: WorkflowStatus) => void;
  detectConflicts: () => void;
  detectCoordinateMixed: () => void;
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
            {
              field: 'photoNumber',
              oldValue: null,
              newValue: data.photoNumber,
            },
            {
              field: 'coordinate',
              oldValue: null,
              newValue: JSON.stringify(data.coordinate),
            },
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
            evidence: [
              {
                description: `照片编号 ${data.photoNumber} 重复导入`,
                photoValue: data.photoNumber,
                cadValue: `已有 ${existing.length} 条相同编号记录`,
              },
            ],
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
        set((s) => ({
          records: s.records.map((r) =>
            r.id === recordId
              ? { ...r, cadLayer, status: 'step2' as WorkflowStatus, updatedBy: s.currentUser, updatedAt: now() }
              : r
          ),
          history: [
            ...s.history,
            {
              id: uid(),
              recordId,
              action: 'update_cad' as const,
              operator: s.currentUser,
              timestamp: now(),
              changes: [{ field: 'cadLayer', oldValue: oldCadLayer, newValue: cadLayer }],
            },
          ],
        }));

        get().detectConflicts();
        get().detectCoordinateMixed();
      },

      resolveConflict: (conflictId, resolution, note) => {
        const conflict = get().conflicts.find((c) => c.id === conflictId);
        if (!conflict) return;

        set((s) => ({
          conflicts: s.conflicts.map((c) =>
            c.id === conflictId
              ? {
                  ...c,
                  status: 'resolved' as const,
                  resolution,
                  resolvedBy: s.currentUser,
                  resolvedAt: now(),
                }
              : c
          ),
          records: s.records.map((r) =>
            r.id === conflict.recordId
              ? {
                  ...r,
                  resolutionNote: note,
                  updatedBy: s.currentUser,
                  updatedAt: now(),
                }
              : r
          ),
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
              ],
              evidence: conflict.evidence.map((e) => e.description).join('; '),
            },
          ],
        }));
      },

      updateSiteInstruction: (recordId, instruction) => {
        const record = get().records.find((r) => r.id === recordId);
        if (!record) return;

        const oldInstruction = record.siteInstruction;
        set((s) => ({
          records: s.records.map((r) =>
            r.id === recordId
              ? { ...r, siteInstruction: instruction, status: 'step3' as WorkflowStatus, updatedBy: s.currentUser, updatedAt: now() }
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
              changes: [{ field: 'siteInstruction', oldValue: oldInstruction, newValue: instruction }],
            },
          ],
        }));
      },

      markCoordinateReviewed: (recordId) => {
        set((s) => ({
          records: s.records.map((r) =>
            r.id === recordId
              ? { ...r, isCoordinateMixed: false, updatedBy: s.currentUser, updatedAt: now() }
              : r
          ),
          history: [
            ...s.history,
            {
              id: uid(),
              recordId,
              action: 'review_coordinate' as const,
              operator: s.currentUser,
              timestamp: now(),
              changes: [{ field: 'isCoordinateMixed', oldValue: true, newValue: false }],
              evidence: '巡检组复核完成，坐标混合问题已确认处理',
            },
          ],
        }));
      },

      advanceStatus: (recordId, status) => {
        set((s) => ({
          records: s.records.map((r) =>
            r.id === recordId
              ? { ...r, status, updatedBy: s.currentUser, updatedAt: now() }
              : r
          ),
        }));
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
            newConflicts.push({
              id: uid(),
              recordId: withCad[0].id,
              type: 'photo_cad_mismatch',
              evidence: [
                {
                  description: `照片编号 ${photoNumber} 对应多个CAD图层名`,
                  photoValue: photoNumber,
                  cadValue: values.join(' / '),
                },
              ],
              status: 'pending',
            });
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
                evidence: [
                  {
                    description: `照片编号前缀(${photoPrefix})与CAD图层名前缀(${cadPrefix})不一致`,
                    photoValue: r.photoNumber,
                    cadValue: r.cadLayer,
                  },
                ],
                status: 'pending',
              });
            }
          }
        });

        if (newConflicts.length > 0) {
          set((s) => ({ conflicts: [...s.conflicts.filter((c) => c.status === 'pending'), ...newConflicts] }));
        }
      },

      detectCoordinateMixed: () => {
        const { records } = get();
        const hasLatlng = records.some((r) => r.coordinate.type === 'latlng');
        const hasMetric = records.some((r) => r.coordinate.type === 'metric');

        if (hasLatlng && hasMetric) {
          set((s) => ({
            records: s.records.map((r) => {
              const mixed =
                (r.coordinate.type === 'latlng' && hasMetric) ||
                (r.coordinate.type === 'metric' && hasLatlng);
              if (mixed && !r.isCoordinateMixed) {
                return { ...r, isCoordinateMixed: true, status: 'pending_review' as WorkflowStatus, updatedAt: now() };
              }
              return r;
            }),
          }));
        }
      },

      runSelfCheck: () => {
        const { records } = get();
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
              detail: `坐标类型为${r.coordinate.type === 'latlng' ? '经纬度' : '米制'}，但系统中存在混合坐标`,
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
        });

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
