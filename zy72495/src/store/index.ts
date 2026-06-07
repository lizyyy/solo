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

  addBusTimeSlots: (slots: BusTimeSlot[]) => void;
  deleteBusTimeSlot: (id: string) => void;

  addRedlineRemark: (pointId: string, content: string, userId: string, userName: string) => void;
  getPointRemarks: (pointId: string) => RedlineRemark[];

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
    afterData?: unknown
  ) => void;

  rollbackToVersion: (targetId: string, targetType: OperationLog['targetType'], versionIndex: number) => boolean;
  getPendingReviewPoints: () => Point[];
}

function generateId(prefix: string): string {
  return prefix + Date.now() + Math.random().toString(36).substr(2, 9);
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

      addBusTimeSlots: (slots: BusTimeSlot[]) => {
        const beforeData = [...get().busTimeSlots];
        set((state) => ({
          busTimeSlots: [...state.busTimeSlots, ...slots],
        }));
        const user = get().currentUser;
        if (user) {
          get().addOperationLog(
            user.id,
            user.name,
            'import',
            'busTimeSlot',
            slots.map((s) => s.id).join(','),
            beforeData,
            [...beforeData, ...slots]
          );
        }
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
        afterData?: unknown
      ) => {
        const diff =
          beforeData && afterData
            ? deepDiff(
                beforeData as Record<string, unknown>,
                afterData as Record<string, unknown>
              )
            : undefined;

        const log: OperationLog = {
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
        };

        set((state) => ({
          operationLogs: [log, ...state.operationLogs],
        }));
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

        return false;
      },

      getPendingReviewPoints: () => {
        return get().points.filter((p) => p.boundaryStatus === 'pending');
      },
    }),
    {
      name: 'stall-rotation-storage',
    }
  )
);
