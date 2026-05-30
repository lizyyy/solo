import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  TrainingRecord,
  OperationLog,
  WorkflowStatus,
  OperationType,
  BearingData,
  PositionMark,
  SelectedRoute,
  GeoPoint,
  TriangleData,
  RouteOption
} from '../types';

export interface RecordState {
  records: TrainingRecord[];
  currentRecord: TrainingRecord | null;

  createRecord: (data: {
    recordId: string;
    traineeName: string;
    scenarioId: string;
    startTime: Date;
  }) => void;

  addRecord: (record: TrainingRecord) => void;

  updateRecord: (recordId: string, updates: Partial<TrainingRecord>) => void;

  updateRecordWorkflow: (
    recordId: string,
    status: WorkflowStatus,
    reviewerId: string,
    reviewComment: string
  ) => void;

  finalizeRecord: (data: {
    recordId: string;
    endTime: Date;
    finalError: number;
    bearings: Record<string, BearingData>;
    positionMark: PositionMark & { point: GeoPoint; snappedToEstimate: boolean };
    selectedRoute: SelectedRoute & RouteOption;
    estimatedPosition: GeoPoint | null;
    triangleData: TriangleData | null;
  }) => void;

  addOperation: (recordId: string, operation: Omit<OperationLog, 'id' | 'recordId' | 'timestamp'>) => void;

  getRecord: (recordId: string) => TrainingRecord | undefined;

  getRecordsByStatus: (status: WorkflowStatus) => TrainingRecord[];

  getRecordsByTrainee: (traineeName: string) => TrainingRecord[];

  clearRecords: () => void;

  loadRecordForReview: (recordId: string) => void;

  clearCurrentRecord: () => void;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const useRecordStore = create<RecordState>()(
  persist(
    (set, get) => ({
      records: [],
      currentRecord: null,

      createRecord: ({ recordId, traineeName, scenarioId, startTime }) => {
        const newRecord: TrainingRecord = {
          id: recordId,
          traineeName,
          startTime,
          scenarioId,
          workflow: {
            status: WorkflowStatus.PENDING
          },
          operations: [],
          bearings: {},
          positionMark: null,
          selectedRoute: null,
          triangleData: null,
          estimatedPosition: null
        };

        set({
          records: [...get().records, newRecord]
        });
      },

      addRecord: (record) => {
        set({
          records: [...get().records, record]
        });
      },

      updateRecord: (recordId, updates) => {
        set({
          records: get().records.map(r =>
            r.id === recordId ? { ...r, ...updates } : r
          )
        });
      },

      updateRecordWorkflow: (recordId, status, reviewerId, reviewComment) => {
        const record = get().getRecord(recordId);
        if (!record) return;

        const updatedWorkflow = {
          ...record.workflow,
          status,
          reviewerId,
          reviewComment,
          reviewTime: new Date()
        };

        set({
          records: get().records.map(r =>
            r.id === recordId
              ? { ...r, workflow: updatedWorkflow }
              : r
          )
        });

        get().addOperation(recordId, {
          actionType: status === WorkflowStatus.APPROVED
            ? OperationType.REVIEW_APPROVE
            : OperationType.REVIEW_RETURN,
          actionDetail: status === WorkflowStatus.APPROVED
            ? `复核通过：${reviewComment}`
            : `退回补材料：${reviewComment}`,
          operator: reviewerId
        });
      },

      finalizeRecord: ({ recordId, endTime, finalError, bearings, positionMark, selectedRoute, estimatedPosition, triangleData }) => {
        const record = get().getRecord(recordId);
        if (!record) return;

        const updated: TrainingRecord = {
          ...record,
          endTime,
          finalError,
          bearings,
          positionMark,
          selectedRoute,
          triangleData,
          estimatedPosition,
          operations: [
            ...record.operations,
            {
              id: generateId(),
              recordId,
              actionType: OperationType.SUBMIT,
              actionDetail: `训练完成，最终误差：${finalError.toFixed(0)}米`,
              timestamp: endTime,
              operator: record.traineeName
            }
          ]
        };

        set({
          records: get().records.map(r =>
            r.id === recordId ? updated : r
          )
        });
      },

      addOperation: (recordId, operation) => {
        const record = get().getRecord(recordId);
        if (!record) return;

        const newOperation: OperationLog = {
          ...operation,
          id: generateId(),
          recordId,
          timestamp: new Date()
        };

        set({
          records: get().records.map(r =>
            r.id === recordId
              ? { ...r, operations: [...r.operations, newOperation] }
              : r
          )
        });
      },

      getRecord: (recordId) => {
        return get().records.find(r => r.id === recordId);
      },

      getRecordsByStatus: (status) => {
        return get().records.filter(r => r.workflow.status === status);
      },

      getRecordsByTrainee: (traineeName) => {
        return get().records.filter(r => r.traineeName === traineeName);
      },

      clearRecords: () => set({ records: [] }),

      loadRecordForReview: (recordId) => {
        const record = get().getRecord(recordId);
        set({ currentRecord: record || null });
      },

      clearCurrentRecord: () => set({ currentRecord: null })
    }),
    {
      name: 'triangulation-records-storage'
    }
  )
);
