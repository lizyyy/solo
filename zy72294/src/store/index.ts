import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type * as T from '@/types';
import { mockData, duplicateRecordIds } from '@/mock';
import * as services from '@/services';

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface AppState {
  rangefinderRecords: T.RangefinderRecord[];
  volumeEstimations: T.VolumeEstimation[];
  obstacleNotes: T.ObstacleNote[];
  alarmReviews: T.AlarmReview[];
  safetyReports: T.SafetyReport[];
  changeHistories: T.ChangeHistory[];
  duplicateRecordIds: string[];

  currentStep: T.WorkflowStep;
  selectedRecordId: string | null;
  viewMode: 'list' | '3d' | 'chart';

  importRecords: (records: T.RangefinderRecord[], operator: string) => T.DuplicateCheckResult;
  updateObstacleNote: (recordId: string, content: string, operator: string) => void;
  reviewAlarm: (reviewId: string, status: T.AlarmReview['reviewStatus'], comment: string, operator: string) => void;
  generateSafetyReport: (recordId: string) => T.SafetyReport | null;
  getHistoryForEntity: (entityType: T.ChangeHistory['entityType'], entityId: string) => T.ChangeHistory[];
  getReviewForRecord: (recordId: string) => T.AlarmReview | undefined;
  getNoteForRecord: (recordId: string) => T.ObstacleNote | undefined;
  getEstimationForRecord: (recordId: string) => T.VolumeEstimation | undefined;
  getReportForRecord: (recordId: string) => T.SafetyReport | undefined;
  getStats: () => {
    importPending: number;
    notesPending: number;
    reviewPending: number;
    reportPending: number;
    totalRecords: number;
    pendingReviews: number;
  };
  setSelectedRecordId: (id: string | null) => void;
  setCurrentStep: (step: T.WorkflowStep) => void;
  setViewMode: (mode: 'list' | '3d' | 'chart') => void;
  resetToMock: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      rangefinderRecords: mockData.rangefinderRecords,
      volumeEstimations: mockData.volumeEstimations,
      obstacleNotes: mockData.obstacleNotes,
      alarmReviews: mockData.alarmReviews,
      safetyReports: mockData.safetyReports,
      changeHistories: mockData.changeHistories,
      duplicateRecordIds: duplicateRecordIds,

      currentStep: 'import',
      selectedRecordId: null,
      viewMode: 'list',

      importRecords: (records: T.RangefinderRecord[], operator: string) => {
        const state = get();
        const importBatch = services.generateImportBatch();
        const now = new Date().toISOString();

        const recordsWithMeta = records.map((r) => ({
          ...r,
          importBatch,
          createdAt: now,
          createdBy: operator,
        }));

        const result = services.checkDuplicates(recordsWithMeta, state.rangefinderRecords);

        const newVolumeEstimations: T.VolumeEstimation[] = [];
        const newAlarmReviews: T.AlarmReview[] = [];

        for (const record of result.newRecords) {
          const calcResult = services.autoSelectModel(record);
          newVolumeEstimations.push({
            id: generateId(),
            recordId: record.id,
            volume: calcResult.volume,
            calculationModel: calcResult.model,
            paramVersion: calcResult.paramVersion,
            tradeoffReason: calcResult.tradeoffReason,
            calculationParams: calcResult.params,
            calculatedAt: now,
          });

          if (services.detectOcclusion(record.screenshotUrl)) {
            newAlarmReviews.push(services.markForReview(record.id));
          }
        }

        const updatedRecords = result.newRecords.map((r) => ({
          ...r,
          alarmOccluded: newAlarmReviews.some((ar) => ar.recordId === r.id),
        }));

        set({
          rangefinderRecords: [...state.rangefinderRecords, ...updatedRecords],
          volumeEstimations: [...state.volumeEstimations, ...newVolumeEstimations],
          alarmReviews: [...state.alarmReviews, ...newAlarmReviews],
          duplicateRecordIds: [
            ...state.duplicateRecordIds,
            ...result.duplicateRecords.map((r) => r.id),
          ],
        });

        return result;
      },

      updateObstacleNote: (recordId: string, content: string, operator: string) => {
        const state = get();
        const existingNote = state.obstacleNotes.find((n) => n.recordId === recordId);
        const now = new Date().toISOString();
        const record = state.rangefinderRecords.find((r) => r.id === recordId);
        const review = state.alarmReviews.find((r) => r.recordId === recordId);

        let newStatus: T.ObstacleNote['status'] = 'completed';
        if (record?.alarmOccluded && review?.reviewStatus === 'pending') {
          newStatus = 'verify';
        }

        if (existingNote) {
          const history = services.trackChange(
            'obstacle_note',
            existingNote.id,
            'content',
            existingNote.content,
            content,
            operator
          );

          set({
            obstacleNotes: state.obstacleNotes.map((n) =>
              n.id === existingNote.id
                ? { ...n, content, status: newStatus, updatedAt: now, updatedBy: operator }
                : n
            ),
            changeHistories: [...state.changeHistories, history],
          });
        } else {
          const newNote: T.ObstacleNote = {
            id: generateId(),
            recordId,
            content,
            status: newStatus,
            updatedAt: now,
            updatedBy: operator,
          };

          set({
            obstacleNotes: [...state.obstacleNotes, newNote],
          });
        }
      },

      reviewAlarm: (
        reviewId: string,
        status: T.AlarmReview['reviewStatus'],
        comment: string,
        operator: string
      ) => {
        const state = get();
        const now = new Date().toISOString();

        set({
          alarmReviews: state.alarmReviews.map((r) =>
            r.id === reviewId
              ? {
                  ...r,
                  reviewStatus: status,
                  reviewComment: comment,
                  reviewedAt: now,
                  reviewedBy: operator,
                }
              : r
          ),
        });
      },

      generateSafetyReport: (recordId: string) => {
        const state = get();
        const record = state.rangefinderRecords.find((r) => r.id === recordId);
        const estimation = state.volumeEstimations.find((e) => e.recordId === recordId);
        const review = state.alarmReviews.find((r) => r.recordId === recordId);

        if (!record || !estimation) {
          return null;
        }

        if (review?.reviewStatus === 'pending') {
          console.warn('请先由经理复核告警，再生成安全报告');
          return null;
        }

        const existingReport = state.safetyReports.find((r) => r.recordId === recordId);
        if (existingReport) {
          return existingReport;
        }

        const reason = services.generateReason(record, estimation, review);
        const missingMaterials = services.determineMissingMaterials(record, estimation);
        const { nextStep, nextOwner } = services.determineNextStep(review);

        const newReport: T.SafetyReport = {
          id: generateId(),
          recordId,
          reason,
          missingMaterials,
          nextStep,
          nextOwner,
          status: 'draft',
          createdAt: new Date().toISOString(),
        };

        set({
          safetyReports: [...state.safetyReports, newReport],
        });

        return newReport;
      },

      getHistoryForEntity: (entityType: T.ChangeHistory['entityType'], entityId: string) => {
        return services.getHistory(get().changeHistories, entityType, entityId);
      },

      getReviewForRecord: (recordId: string) => {
        return get().alarmReviews.find((r) => r.recordId === recordId);
      },

      getNoteForRecord: (recordId: string) => {
        return get().obstacleNotes.find((n) => n.recordId === recordId);
      },

      getEstimationForRecord: (recordId: string) => {
        return get().volumeEstimations.find((e) => e.recordId === recordId);
      },

      getReportForRecord: (recordId: string) => {
        return get().safetyReports.find((r) => r.recordId === recordId);
      },

      getStats: () => {
        const state = get();
        const pendingNotes = state.obstacleNotes.filter((n) => n.status === 'pending' || n.status === 'verify');
        const pendingReviews = state.alarmReviews.filter((r) => r.reviewStatus === 'pending');
        const recordsWithNote = state.rangefinderRecords.filter(
          (r) => !state.obstacleNotes.some((n) => n.recordId === r.id && n.status === 'completed')
        );
        const recordsWithoutReport = state.rangefinderRecords.filter(
          (r) =>
            (r.distance < 1.2 || r.alarmOccluded) &&
            !state.safetyReports.some((s) => s.recordId === r.id)
        );

        return {
          importPending: state.rangefinderRecords.filter((r) => !state.obstacleNotes.some((n) => n.recordId === r.id)).length,
          notesPending: pendingNotes.length,
          reviewPending: pendingReviews.length,
          reportPending: recordsWithoutReport.length,
          totalRecords: state.rangefinderRecords.length,
          pendingReviews: pendingReviews.length,
        };
      },

      setSelectedRecordId: (id: string | null) => {
        set({ selectedRecordId: id });
      },

      setCurrentStep: (step: T.WorkflowStep) => {
        set({ currentStep: step });
      },

      setViewMode: (mode: 'list' | '3d' | 'chart') => {
        set({ viewMode: mode });
      },

      resetToMock: () => {
        set({
          rangefinderRecords: mockData.rangefinderRecords,
          volumeEstimations: mockData.volumeEstimations,
          obstacleNotes: mockData.obstacleNotes,
          alarmReviews: mockData.alarmReviews,
          safetyReports: mockData.safetyReports,
          changeHistories: mockData.changeHistories,
          duplicateRecordIds: duplicateRecordIds,
          currentStep: 'import',
          selectedRecordId: null,
          viewMode: 'list',
        });
      },
    }),
    {
      name: 'app-storage',
    }
  )
);
