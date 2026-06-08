import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { OutdoorStall, ApprovalStatus, ImportData, ApprovalRecord } from '@/types';
import { sampleStalls } from '@/data/sampleData';
import { generateId } from '@/utils/timeUtils';
import { runFullCheck } from '@/services/conflictDetector';

export interface MergeResult {
  merged: boolean;
  stallId: string;
  stallName: string;
}

interface AppState {
  stalls: OutdoorStall[];
  currentOperator: string;
  addStall: (data: ImportData) => MergeResult;
  updateStallStatus: (id: string, status: ApprovalStatus, remark?: string) => void;
  addApprovalRecord: (stallId: string, record: Omit<ApprovalRecord, 'id' | 'createdAt'>) => void;
  deleteStall: (id: string) => void;
  resetToSampleData: () => void;
  runAutoCheck: (stallId: string) => void;
  getStallById: (id: string) => OutdoorStall | undefined;
  getStatusCount: (status: ApprovalStatus) => number;
}

function namesMatch(a: string, b: string): boolean {
  const normalize = (s: string) => s.replace(/[\s（）()]/g, '').toLowerCase();
  const na = normalize(a);
  const nb = normalize(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      stalls: sampleStalls,
      currentOperator: '市政设计师 老曹',

      addStall: (data: ImportData): MergeResult => {
        const state = get();
        const now = new Date().toISOString();

        const existing = state.stalls.find(s => namesMatch(s.name, data.name));

        if (existing) {
          const newSource = {
            id: generateId(),
            sourceType: data.sourceType,
            sourceName: data.sourceName,
            importTime: now,
            rawData: data.rawData,
          };

          const updated = {
            ...existing,
            updatedAt: now,
            sources: [...existing.sources, newSource],
            area: data.area > 0 ? data.area : existing.area,
            timePeriod: data.timePeriod || existing.timePeriod,
            location: data.location || existing.location,
            contact: data.contact || existing.contact,
            phone: data.phone || existing.phone,
            lat: data.lat ?? existing.lat,
            lng: data.lng ?? existing.lng,
            approvalRecords: [
              ...existing.approvalRecords,
              {
                id: generateId(),
                type: 'manual_review' as const,
                result: 'pass' as const,
                description: `补充材料：从「${data.sourceName}」归并追加来源（${data.sourceType === 'street_form' ? '街道表格' : data.sourceType === 'site_photo' ? '现场照片' : data.sourceType === 'approval_record' ? '审批记录' : 'GIS点位'}），原有审批状态保持不变。`,
                createdAt: now,
                operator: '系统归并',
              },
            ],
          };

          set((s) => ({
            stalls: s.stalls.map(st => st.id === existing.id ? updated : st),
          }));

          return { merged: true, stallId: existing.id, stallName: existing.name };
        }

        const newStall: OutdoorStall = {
          id: generateId(),
          name: data.name,
          location: data.location,
          lat: data.lat || 31.2304,
          lng: data.lng || 121.4737,
          area: data.area,
          maxArea: 10,
          timePeriod: data.timePeriod,
          status: 'pending',
          createdAt: now,
          updatedAt: now,
          contact: data.contact,
          phone: data.phone,
          sources: [
            {
              id: generateId(),
              sourceType: data.sourceType,
              sourceName: data.sourceName,
              importTime: now,
              rawData: data.rawData,
            },
          ],
          approvalRecords: [],
        };
        set((state) => ({ stalls: [...state.stalls, newStall] }));
        setTimeout(() => get().runAutoCheck(newStall.id), 100);

        return { merged: false, stallId: newStall.id, stallName: newStall.name };
      },

      updateStallStatus: (id: string, status: ApprovalStatus, remark?: string) => {
        const now = new Date().toISOString();
        set((state) => ({
          stalls: state.stalls.map((stall) =>
            stall.id === id
              ? { ...stall, status, humanRemark: remark, updatedAt: now }
              : stall
          ),
        }));
        
        const statusDesc: Record<ApprovalStatus, string> = {
          pending: '待审批',
          approved: '审批通过',
          rejected: '审批驳回',
          need_confirm: '需人工确认',
          legacy: '历史遗留',
        };
        
        get().addApprovalRecord(id, {
          type: 'manual_review',
          result: status === 'approved' || status === 'legacy' ? 'pass' : status === 'rejected' ? 'fail' : 'warning',
          description: `人工复核：状态更新为「${statusDesc[status]}」${remark ? `，备注：${remark}` : ''}`,
          operator: get().currentOperator,
        });
      },

      addApprovalRecord: (stallId: string, record: Omit<ApprovalRecord, 'id' | 'createdAt'>) => {
        const now = new Date().toISOString();
        set((state) => ({
          stalls: state.stalls.map((stall) =>
            stall.id === stallId
              ? {
                  ...stall,
                  approvalRecords: [
                    ...stall.approvalRecords,
                    { ...record, id: generateId(), createdAt: now },
                  ],
                  updatedAt: now,
                }
              : stall
          ),
        }));
      },

      deleteStall: (id: string) => {
        set((state) => ({
          stalls: state.stalls.filter((stall) => stall.id !== id),
        }));
      },

      resetToSampleData: () => {
        set({ stalls: sampleStalls });
      },

      runAutoCheck: (stallId: string) => {
        const state = get();
        const stall = state.getStallById(stallId);
        if (!stall) return;

        const results = runFullCheck(stall, state.stalls);
        
        results.forEach((result) => {
          state.addApprovalRecord(stallId, {
            type: result.type === 'capacity' ? 'capacity_check' : 'time_conflict',
            result: result.hasConflict ? 'warning' : 'pass',
            description: result.description,
            operator: '系统自动检测',
          });
        });

        const hasHighConflict = results.some((r) => r.hasConflict && r.severity === 'high');
        const hasMediumConflict = results.some((r) => r.hasConflict && r.severity === 'medium');
        
        if (hasHighConflict) {
          set((s) => ({
            stalls: s.stalls.map((st) =>
              st.id === stallId ? { ...st, status: 'rejected' } : st
            ),
          }));
        } else if (hasMediumConflict) {
          set((s) => ({
            stalls: s.stalls.map((st) =>
              st.id === stallId ? { ...st, status: 'need_confirm' } : st
            ),
          }));
        } else {
          set((s) => ({
            stalls: s.stalls.map((st) =>
              st.id === stallId ? { ...st, status: 'approved' } : st
            ),
          }));
        }
      },

      getStallById: (id: string) => {
        return get().stalls.find((stall) => stall.id === id);
      },

      getStatusCount: (status: ApprovalStatus) => {
        return get().stalls.filter((stall) => stall.status === status).length;
      },
    }),
    {
      name: 'outdoor-stall-approval-storage',
    }
  )
);
