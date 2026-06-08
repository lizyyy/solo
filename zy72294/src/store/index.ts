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
  confirmSafetyReport: (reportId: string) => void;
  getHistoryForEntity: (entityType: T.ChangeHistory['entityType'], entityId: string) => T.ChangeHistory[];
  getReviewForRecord: (recordId: string) => T.AlarmReview | undefined;
  getNoteForRecord: (recordId: string) => T.ObstacleNote | undefined;
  getEstimationForRecord: (recordId: string) => T.VolumeEstimation | undefined;
  getReportForRecord: (recordId: string) => T.SafetyReport | undefined;
  getUniqueRecords: () => T.RangefinderRecord[];
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
        const newObstacleNotes: T.ObstacleNote[] = [];
        const newChangeHistories: T.ChangeHistory[] = [];

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

          const isOccluded = record.alarmOccluded || services.detectOcclusion(record.screenshotUrl);

          if (isOccluded) {
            newAlarmReviews.push(services.markForReview(record.id));
          }

          newObstacleNotes.push({
            id: generateId(),
            recordId: record.id,
            content: '',
            status: 'pending',
            updatedAt: now,
            updatedBy: '',
          });

          newChangeHistories.push(
            services.trackChange(
              'rangefinder_record',
              record.id,
              'import',
              '',
              `导入测距仪记录：批次${record.batchNo}，测距点(${record.pointX},${record.pointY})，距离${record.distance}m${isOccluded ? '，检测到遮挡告警' : ''}`,
              operator
            )
          );
        }

        const updatedRecords = result.newRecords.map((r) => {
          const isOccluded = r.alarmOccluded || newAlarmReviews.some((ar) => ar.recordId === r.id);
          return {
            ...r,
            alarmOccluded: isOccluded,
          };
        });

        set({
          rangefinderRecords: [...state.rangefinderRecords, ...updatedRecords],
          volumeEstimations: [...state.volumeEstimations, ...newVolumeEstimations],
          alarmReviews: [...state.alarmReviews, ...newAlarmReviews],
          obstacleNotes: [...state.obstacleNotes, ...newObstacleNotes],
          changeHistories: [...state.changeHistories, ...newChangeHistories],
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
          const oldContent = existingNote.content;
          const oldStatus = existingNote.status;
          const histories: T.ChangeHistory[] = [];

          if (oldContent !== content) {
            histories.push(
              services.trackChange('obstacle_note', existingNote.id, 'content', oldContent, content, operator)
            );
          }
          if (oldStatus !== newStatus) {
            histories.push(
              services.trackChange(
                'obstacle_note',
                existingNote.id,
                'status',
                oldStatus,
                newStatus,
                operator
              )
            );
          }

          set({
            obstacleNotes: state.obstacleNotes.map((n) =>
              n.id === existingNote.id
                ? { ...n, content, status: newStatus, updatedAt: now, updatedBy: operator }
                : n
            ),
            changeHistories: [...state.changeHistories, ...histories],
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

          const history = services.trackChange(
            'obstacle_note',
            newNote.id,
            'content',
            '',
            content,
            operator
          );

          set({
            obstacleNotes: [...state.obstacleNotes, newNote],
            changeHistories: [...state.changeHistories, history],
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
        const review = state.alarmReviews.find((r) => r.id === reviewId);
        if (!review) return;

        const oldStatus = review.reviewStatus;
        const oldComment = review.reviewComment;

        const updatedReviews = state.alarmReviews.map((r) =>
          r.id === reviewId
            ? {
                ...r,
                reviewStatus: status,
                reviewComment: comment,
                reviewedAt: now,
                reviewedBy: operator,
              }
            : r
        );

        const histories: T.ChangeHistory[] = [];
        if (oldStatus !== status) {
          histories.push(
            services.trackChange('alarm_review', reviewId, 'reviewStatus', oldStatus, status, operator)
          );
        }
        if (oldComment !== comment) {
          histories.push(
            services.trackChange('alarm_review', reviewId, 'reviewComment', oldComment || '(无)', comment, operator)
          );
        }

        const updatedNotes = state.obstacleNotes.map((n) => {
          if (n.recordId !== review.recordId) return n;
          const record = state.rangefinderRecords.find((r) => r.id === review.recordId);
          if (record?.alarmOccluded && status !== 'pending' && n.status === 'verify') {
            histories.push(
              services.trackChange(
                'obstacle_note',
                n.id,
                'status',
                'verify',
                'completed',
                operator
              )
            );
            return { ...n, status: 'completed' as const, updatedAt: now, updatedBy: operator };
          }
          return n;
        });

        set({
          alarmReviews: updatedReviews,
          obstacleNotes: updatedNotes,
          changeHistories: [...state.changeHistories, ...histories],
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
          status: 'confirmed',
          createdAt: new Date().toISOString(),
        };

        const history = services.trackChange(
          'safety_report',
          newReport.id,
          'status',
          '(无)',
          'confirmed',
          '系统'
        );

        set({
          safetyReports: [...state.safetyReports, newReport],
          changeHistories: [...state.changeHistories, history],
        });

        return newReport;
      },

      confirmSafetyReport: (reportId: string) => {
        const state = get();
        const report = state.safetyReports.find((r) => r.id === reportId);
        if (!report || report.status === 'exported') return;

        const oldStatus = report.status;
        const updatedReports = state.safetyReports.map((r) =>
          r.id === reportId ? { ...r, status: 'exported' as const } : r
        );

        const history = services.trackChange(
          'safety_report',
          reportId,
          'status',
          oldStatus,
          'exported',
          '系统'
        );

        set({
          safetyReports: updatedReports,
          changeHistories: [...state.changeHistories, history],
        });
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

      getUniqueRecords: () => {
        const records = get().rangefinderRecords;
        return records.filter(
          (r, i, arr) =>
            arr.findIndex((x) => x.batchNo === r.batchNo && x.pointX === r.pointX && x.pointY === r.pointY) === i
        );
      },

      getStats: () => {
        const state = get();
        const uniqueRecords = state.getUniqueRecords();
        const notesPending = uniqueRecords.filter((r) => {
          const note = state.obstacleNotes.find((n) => n.recordId === r.id);
          return !note || note.status === 'pending' || note.status === 'verify';
        }).length;
        const pendingReviews = state.alarmReviews.filter((r) => r.reviewStatus === 'pending').length;
        const recordsWithoutReport = uniqueRecords.filter(
          (r) =>
            (r.distance < 1.2 || r.alarmOccluded) &&
            !state.safetyReports.some((s) => s.recordId === r.id)
        ).length;

        return {
          importPending: uniqueRecords.filter(
            (r) => !state.obstacleNotes.some((n) => n.recordId === r.id)
          ).length,
          notesPending,
          reviewPending: pendingReviews,
          reportPending: recordsWithoutReport,
          totalRecords: uniqueRecords.length,
          pendingReviews,
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
