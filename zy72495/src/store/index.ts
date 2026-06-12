import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  User,
  Point,
  BusTimeSlot,
  RedlineRemark,
  StallRotation,
  OperationLog,
  Street,
  BoundaryStatus,
} from '@/types';
import {
  mockStreets,
  mockPoints,
  mockBusTimeSlots,
  mockRedlineRemarks,
  mockStallRotations,
  mockUsers,
} from '@/data/mockData';
import { deepDiff } from '@/utils/diffUtils';

interface AppState {
  currentUser: User | null;
  streets: Street[];
  points: Point[];
  busTimeSlots: BusTimeSlot[];
  redlineRemarks: RedlineRemark[];
  stallRotations: StallRotation[];
  operationLogs: OperationLog[];

  login: (username: string) => boolean;
  logout: () => void;

  addBusTimeSlots: (slots: BusTimeSlot[], batchId?: string) => { newCount: number; updateCount: number };
  updateBusTimeSlot: (id: string, updates: Partial<BusTimeSlot>) => boolean;
  deleteBusTimeSlot: (id: string) => void;

  addRedlineRemark: (pointId: string, content: string, userId: string, userName: string) => void;
  getPointRemarks: (pointId: string) => RedlineRemark[];

  updateStallRotation: (id: string, updates: Partial<StallRotation>) => boolean;
  rollbackStallRotation: (stallId: string) => boolean;

  updatePointBoundaryStatus: (
    pointId: string,
    status: BoundaryStatus,
    reviewerId: string,
    reviewerName: string,
    reviewRemark: string
  ) => void;

  addOperationLog: (
    operatorId: string,
    operatorName: string,
    operationType: OperationLog['operationType'],
    targetType: OperationLog['targetType'],
    targetId: string,
    beforeData?: unknown,
    afterData?: unknown,
    metadata?: Record<string, unknown>
  ) => void;

  rollbackToVersion: (targetId: string, targetType: OperationLog['targetType'], versionIndex: number) => boolean;
  getPendingReviewPoints: () => Point[];
  getStallRotationLogs: (stallId: string) => OperationLog[];
}

function generateId(prefix: string): string {
  return prefix + Date.now() + Math.random().toString(36).substr(2, 9);
}

function generateBatchId(): string {
  return 'batch-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      streets: mockStreets,
      points: mockPoints,
      busTimeSlots: mockBusTimeSlots,
      redlineRemarks: mockRedlineRemarks,
      stallRotations: mockStallRotations,
      operationLogs: [],

      login: (username: string) => {
        const user = mockUsers.find((u) => u.username === username);
        if (user) {
          set({ currentUser: user });
          return true;
        }
        return false;
      },

      logout: () => {
        set({ currentUser: null });
      },

      addBusTimeSlots: (slots: BusTimeSlot[], batchId?: string) => {
        const beforeData = [...get().busTimeSlots];
        const existingSlots = get().busTimeSlots;
        const newSlots: BusTimeSlot[] = [];
        const updatedSlots: BusTimeSlot[] = [];
        let updateCount = 0;
        let newCount = 0;

        const now = new Date().toISOString();
        const actualBatchId = batchId || slots[0]?.importBatchId || generateBatchId();

        slots.forEach((slot) => {
          const existingIndex = existingSlots.findIndex(
            (s) =>
              s.routeName === slot.routeName &&
              s.date === slot.date &&
              s.startTime === slot.startTime &&
              s.endTime === slot.endTime
          );

          if (existingIndex >= 0) {
            const existing = existingSlots[existingIndex];
            const updated = {
              ...existing,
              passengerCount: slot.passengerCount,
              relatedPointIds: slot.relatedPointIds.length > 0 ? slot.relatedPointIds : existing.relatedPointIds,
              updatedAt: now,
              importBatchId: actualBatchId,
            };
            updatedSlots.push(updated);
            updateCount++;
          } else {
            newSlots.push(slot);
            newCount++;
          }
        });

        set((state) => {
          let newStateSlots = [...state.busTimeSlots];
          updatedSlots.forEach((updated) => {
            const idx = newStateSlots.findIndex((s) => s.id === updated.id);
            if (idx >= 0) newStateSlots[idx] = updated;
          });
          newStateSlots = [...newStateSlots, ...newSlots];
          return { busTimeSlots: newStateSlots };
        });

        const user = get().currentUser;
        if (user) {
          const allIds = [...updatedSlots.map((s) => s.id), ...newSlots.map((s) => s.id)];
          const afterData = [...get().busTimeSlots];
          get().addOperationLog(
            user.id,
            user.name,
            'import',
            'busTimeSlot',
            allIds.join(','),
            beforeData,
            afterData,
            {
              batchId: actualBatchId,
              newCount,
              updateCount,
              updateSlotIds: updatedSlots.map((s) => s.id),
              newSlotIds: newSlots.map((s) => s.id),
            }
          );
        }

        return { newCount, updateCount };
      },

      updateBusTimeSlot: (id: string, updates: Partial<BusTimeSlot>) => {
        const existing = get().busTimeSlots.find((s) => s.id === id);
        if (!existing) return false;

        const beforeData = { ...existing };
        const now = new Date().toISOString();
        const updated = { ...existing, ...updates, updatedAt: now };

        set((state) => ({
          busTimeSlots: state.busTimeSlots.map((s) => (s.id === id ? updated : s)),
        }));

        const user = get().currentUser;
        if (user) {
          get().addOperationLog(user.id, user.name, 'edit', 'busTimeSlot', id, beforeData, updated);
        }
        return true;
      },

      deleteBusTimeSlot: (id: string) => {
        const slot = get().busTimeSlots.find((s) => s.id === id);
        set((state) => ({
          busTimeSlots: state.busTimeSlots.filter((s) => s.id !== id),
        }));
        const user = get().currentUser;
        if (user && slot) {
          get().addOperationLog(
            user.id,
            user.name,
            'delete',
            'busTimeSlot',
            id,
            slot,
            null
          );
        }
      },

      addRedlineRemark: (pointId: string, content: string, userId: string, userName: string) => {
        const pointRemarks = get()
          .redlineRemarks.filter((r) => r.pointId === pointId)
          .sort((a, b) => b.version - a.version);
        const latestRemark = pointRemarks[0];
        const newVersion = (latestRemark?.version || 0) + 1;

        const diff = latestRemark
          ? deepDiff({ content: latestRemark.content }, { content })
          : {};

        const newRemark: RedlineRemark = {
          id: generateId('r'),
          pointId,
          content,
          version: newVersion,
          createdBy: userId,
          createdByName: userName,
          createdAt: new Date().toISOString(),
          previousId: latestRemark?.id,
          diff,
        };

        const beforeData = [...get().redlineRemarks];
        set((state) => ({
          redlineRemarks: [...state.redlineRemarks, newRemark],
        }));

        get().addOperationLog(
          userId,
          userName,
          'edit',
          'redlineRemark',
          newRemark.id,
          latestRemark,
          newRemark
        );
      },

      getPointRemarks: (pointId: string) => {
        return get()
          .redlineRemarks.filter((r) => r.pointId === pointId)
          .sort((a, b) => b.version - a.version);
      },

      updatePointBoundaryStatus: (
        pointId: string,
        status: BoundaryStatus,
        reviewerId: string,
        reviewerName: string,
        reviewRemark: string
      ) => {
        const point = get().points.find((p) => p.id === pointId);
        const beforeData = { ...point };
        set((state) => ({
          points: state.points.map((p) =>
            p.id === pointId
              ? {
                  ...p,
                  boundaryStatus: status,
                  reviewerId,
                  reviewerName,
                  reviewTime: new Date().toISOString(),
                  reviewRemark,
                }
              : p
          ),
        }));

        const afterData = get().points.find((p) => p.id === pointId);
        get().addOperationLog(
          reviewerId,
          reviewerName,
          'review',
          'point',
          pointId,
          beforeData,
          afterData
        );
      },

      addOperationLog: (
        operatorId: string,
        operatorName: string,
        operationType: OperationLog['operationType'],
        targetType: OperationLog['targetType'],
        targetId: string,
        beforeData?: unknown,
        afterData?: unknown,
        metadata?: Record<string, unknown>
      ) => {
        const diff =
          beforeData && afterData
            ? deepDiff(
                beforeData as Record<string, unknown>,
                afterData as Record<string, unknown>
              )
            : undefined;

        const log: OperationLog & { metadata?: Record<string, unknown> } = {
          id: generateId('log'),
          operatorId,
          operatorName,
          operationType,
          targetType,
          targetId,
          beforeData,
          afterData,
          diff,
          timestamp: new Date().toISOString(),
          metadata,
        };

        set((state) => ({
          operationLogs: [log, ...state.operationLogs],
        }));
      },

      updateStallRotation: (id: string, updates: Partial<StallRotation>) => {
        const existing = get().stallRotations.find((s) => s.id === id);
        if (!existing) return false;

        const beforeData = { ...existing };
        const updated = { ...existing, ...updates };

        set((state) => ({
          stallRotations: state.stallRotations.map((s) => (s.id === id ? updated : s)),
        }));

        const user = get().currentUser;
        if (user) {
          get().addOperationLog(user.id, user.name, 'edit', 'stallRotation', id, beforeData, updated);
        }
        return true;
      },

      rollbackStallRotation: (stallId: string) => {
        const logs = get().operationLogs.filter(
          (l) => l.targetType === 'stallRotation' && l.targetId === stallId
        );
        if (logs.length === 0) return false;

        const lastEditLog = logs.find((l) => l.operationType === 'edit');
        if (!lastEditLog || !lastEditLog.beforeData) return false;

        const user = get().currentUser;
        if (!user) return false;

        const beforeData = lastEditLog.beforeData as StallRotation;
        const existing = get().stallRotations.find((s) => s.id === stallId);
        if (!existing) return false;

        const reverted = { ...existing, ...beforeData };
        set((state) => ({
          stallRotations: state.stallRotations.map((s) => (s.id === stallId ? reverted : s)),
        }));

        get().addOperationLog(
          user.id,
          user.name,
          'rollback',
          'stallRotation',
          stallId,
          existing,
          reverted,
          { rollbackFromVersion: lastEditLog.id }
        );

        return true;
      },

      rollbackToVersion: (targetId: string, targetType: OperationLog['targetType'], versionIndex: number) => {
        const logs = get().operationLogs.filter(
          (l) => l.targetType === targetType && l.targetId.includes(targetId)
        );
        if (versionIndex >= logs.length) return false;

        const targetLog = logs[versionIndex];
        const user = get().currentUser;
        if (!user) return false;

        if (targetType === 'redlineRemark' && targetLog.beforeData) {
          const beforeRemark = targetLog.beforeData as RedlineRemark;
          get().addRedlineRemark(
            beforeRemark.pointId,
            beforeRemark.content,
            user.id,
            user.name
          );
          return true;
        }

        if (targetType === 'stallRotation' && targetLog.beforeData) {
          return get().rollbackStallRotation(targetId);
        }

        if (targetType === 'busTimeSlot' && targetLog.beforeData) {
          const beforeSlots = targetLog.beforeData as BusTimeSlot[];
          const ids = targetId.split(',');
          let success = false;
          ids.forEach((id) => {
            const beforeSlot = beforeSlots.find((s) => s.id === id);
            if (beforeSlot) {
              const ok = get().updateBusTimeSlot(id, {
                passengerCount: beforeSlot.passengerCount,
                relatedPointIds: beforeSlot.relatedPointIds,
              });
              if (ok) success = true;
            }
          });
          return success;
        }

        return false;
      },

      getPendingReviewPoints: () => {
        return get().points.filter((p) => p.boundaryStatus === 'pending');
      },

      getStallRotationLogs: (stallId: string) => {
        return get().operationLogs.filter(
          (l) => l.targetType === 'stallRotation' && l.targetId === stallId
        );
      },
    }),
    {
      name: 'stall-rotation-storage',
    }
  )
);
