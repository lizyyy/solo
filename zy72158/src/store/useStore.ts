import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { OutdoorStall, ApprovalStatus, ImportData, ApprovalRecord } from '@/types';
import { sampleStalls } from '@/data/sampleData';
import { generateId } from '@/utils/timeUtils';
import { runFullCheck } from '@/services/conflictDetector';

interface AppState {
  stalls: OutdoorStall[];
  currentOperator: string;
  addStall: (data: ImportData) => void;
  updateStallStatus: (id: string, status: ApprovalStatus, remark?: string) => void;
  addApprovalRecord: (stallId: string, record: Omit<ApprovalRecord, 'id' | 'createdAt'>) => void;
  deleteStall: (id: string) => void;
  resetToSampleData: () => void;
  runAutoCheck: (stallId: string) => void;
  getStallById: (id: string) => OutdoorStall | undefined;
  getStatusCount: (status: ApprovalStatus) => number;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      stalls: sampleStalls,
      currentOperator: '市政设计师 老曹',

      addStall: (data: ImportData) => {
        const now = new Date().toISOString();
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
