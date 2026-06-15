import { create } from 'zustand';
import type {
  PlaybackRecord,
  Anomaly,
  ExperimentBucket,
  LayerMetric,
  VersionHistory,
  ThresholdItem,
  WorkflowStep,
  PlaybackStatus,
  ImportResult,
  ToastMessage
} from '../types';
import {
  generateId,
  formatDateTime,
  findDuplicateByNoteId,
  mergePlaybackRecord,
  createVersionHistory,
  hasAnyAnomaly,
  detectAnomalies,
  syncAnomaliesWithThresholds
} from '../utils';
import { currentUser } from '../data/mockData';

interface AppState {
  playbackRecords: PlaybackRecord[];
  anomalies: Anomaly[];
  experimentBuckets: ExperimentBucket[];
  layerMetrics: LayerMetric[];
  versionHistories: VersionHistory[];
  toasts: ToastMessage[];
  currentWorkflowStep: WorkflowStep;
  selectedPlaybackId: string | null;
  currentPlaybackData: {
    noteId: string;
    fileName: string;
    thresholds: ThresholdItem[];
    remark?: string;
  } | null;

  initMockData: (data: {
    playbackRecords: PlaybackRecord[];
    anomalies: Anomaly[];
    experimentBuckets: ExperimentBucket[];
    layerMetrics: LayerMetric[];
    versionHistories: VersionHistory[];
  }) => void;
  setCurrentWorkflowStep: (step: WorkflowStep) => void;
  setSelectedPlaybackId: (id: string | null) => void;
  setCurrentPlaybackData: (data: {
    noteId: string;
    fileName: string;
    thresholds: ThresholdItem[];
    remark?: string;
  } | null) => void;

  importThresholdNote: (
    noteId: string,
    fileName: string,
    thresholds: ThresholdItem[],
    remark?: string
  ) => ImportResult;

  addExperimentBucket: (playbackId: string, bucketName: string, bucketUrl: string) => void;
  updateLayerMetrics: (playbackId: string, metrics: Omit<LayerMetric, 'id' | 'playbackId' | 'updatedBy' | 'updatedAt'>[]) => void;
  reviewAnomaly: (anomalyId: string, result: 'confirmed_normal' | 'needs_modification', reviewer: string) => void;
  updatePlaybackRemark: (playbackId: string, newRemark: string) => void;
  rollbackToVersion: (playbackId: string, versionHistoryId: string) => void;

  addToast: (type: ToastMessage['type'], message: string) => void;
  removeToast: (id: string) => void;

  getPlaybackById: (id: string) => PlaybackRecord | undefined;
  getAnomaliesByPlaybackId: (playbackId: string) => Anomaly[];
  getBucketsByPlaybackId: (playbackId: string) => ExperimentBucket[];
  getLayerMetricsByPlaybackId: (playbackId: string) => LayerMetric[];
  getVersionHistoriesByPlaybackId: (playbackId: string) => VersionHistory[];
}

export const useAppStore = create<AppState>((set, get) => ({
  playbackRecords: [],
  anomalies: [],
  experimentBuckets: [],
  layerMetrics: [],
  versionHistories: [],
  toasts: [],
  currentWorkflowStep: 'import',
  selectedPlaybackId: null,
  currentPlaybackData: null,

  initMockData: (data) => set(data),
  setCurrentWorkflowStep: (step) => set({ currentWorkflowStep: step }),
  setSelectedPlaybackId: (id) => set({ selectedPlaybackId: id }),
  setCurrentPlaybackData: (data) => set({ currentPlaybackData: data }),

  importThresholdNote: (noteId, fileName, thresholds, remark) => {
    const state = get();
    const existing = findDuplicateByNoteId(state.playbackRecords, noteId);
    const detectedThresholds = detectAnomalies(thresholds);
    const anomalyExists = hasAnyAnomaly(detectedThresholds);

    if (existing) {
      const { record: merged, updatedFields } = mergePlaybackRecord(existing, {
        thresholds: detectedThresholds,
        remark
      });

      const versionHistories: VersionHistory[] = [];
      let version = state.getVersionHistoriesByPlaybackId(existing.id).length + 1;

      if (updatedFields.includes('thresholds')) {
        versionHistories.push(
          createVersionHistory(
            existing.id,
            'thresholds',
            JSON.stringify(existing.thresholds),
            JSON.stringify(detectedThresholds),
            currentUser.name,
            'update',
            version++
          )
        );
      }

      if (updatedFields.includes('remark')) {
        versionHistories.push(
          createVersionHistory(
            existing.id,
            'remark',
            existing.remark || '',
            remark || '',
            currentUser.name,
            'update',
            version
          )
        );
      }

      const newAnomalies: Anomaly[] = [];
      if (anomalyExists) {
        detectedThresholds
          .filter(t => !t.isConsistent)
          .forEach(t => {
            const existingAnomaly = state.anomalies.find(
              a => a.playbackId === existing.id && a.metricName === t.metricName
            );
            if (!existingAnomaly) {
              newAnomalies.push({
                id: generateId(),
                playbackId: existing.id,
                metricName: t.metricName,
                thresholdValue: t.thresholdValue,
                reportValue: t.reportValue,
                detectedAt: formatDateTime(new Date())
              });
            }
          });
      }

      set(state => ({
        playbackRecords: state.playbackRecords.map(r =>
          r.id === existing.id ? merged : r
        ),
        versionHistories: [...state.versionHistories, ...versionHistories],
        anomalies: [...state.anomalies, ...newAnomalies]
      }));

      return {
        isDuplicate: true,
        playbackId: existing.id,
        message: updatedFields.length > 0
          ? `已更新现有记录，修改了 ${updatedFields.length} 个字段`
          : '记录已存在，无字段变更',
        updatedFields
      };
    }

    const newPlaybackId = generateId();
    const newRecord: PlaybackRecord = {
      id: newPlaybackId,
      noteId,
      fileName,
      operator: currentUser.name,
      status: anomalyExists ? 'pending_review' : 'normal',
      createdAt: formatDateTime(new Date()),
      updatedAt: formatDateTime(new Date()),
      currentStep: 'import',
      hasAnomaly: anomalyExists,
      thresholds: detectedThresholds,
      remark
    };

    const initialVersion: VersionHistory = createVersionHistory(
      newPlaybackId,
      'record',
      '',
      '创建记录',
      currentUser.name,
      'create',
      1
    );

    const newAnomalies: Anomaly[] = [];
    if (anomalyExists) {
      detectedThresholds
        .filter(t => !t.isConsistent)
        .forEach(t => {
          newAnomalies.push({
            id: generateId(),
            playbackId: newPlaybackId,
            metricName: t.metricName,
            thresholdValue: t.thresholdValue,
            reportValue: t.reportValue,
            detectedAt: formatDateTime(new Date())
          });
        });
    }

    set(state => ({
      playbackRecords: [...state.playbackRecords, newRecord],
      versionHistories: [...state.versionHistories, initialVersion],
      anomalies: [...state.anomalies, ...newAnomalies]
    }));

    return {
      isDuplicate: false,
      playbackId: newPlaybackId,
      message: '导入成功，新建回放记录'
    };
  },

  addExperimentBucket: (playbackId, bucketName, bucketUrl) => {
    const newBucket: ExperimentBucket = {
      id: generateId(),
      playbackId,
      bucketName,
      bucketUrl,
      addedBy: currentUser.name,
      addedAt: formatDateTime(new Date())
    };

    set(state => ({
      experimentBuckets: [...state.experimentBuckets, newBucket],
      playbackRecords: state.playbackRecords.map(r =>
        r.id === playbackId
          ? { ...r, currentStep: 'bucket', updatedAt: formatDateTime(new Date()) }
          : r
      )
    }));
  },

  updateLayerMetrics: (playbackId, metrics) => {
    const newMetrics: LayerMetric[] = metrics.map(m => ({
      ...m,
      id: generateId(),
      playbackId,
      updatedBy: currentUser.name,
      updatedAt: formatDateTime(new Date())
    }));

    set(state => ({
      layerMetrics: [...state.layerMetrics, ...newMetrics],
      playbackRecords: state.playbackRecords.map(r =>
        r.id === playbackId
          ? { ...r, currentStep: 'metric', updatedAt: formatDateTime(new Date()) }
          : r
      )
    }));
  },

  reviewAnomaly: (anomalyId, result, reviewer) => {
    set(state => {
      const anomaly = state.anomalies.find(a => a.id === anomalyId);
      if (!anomaly) return state;

      const updatedAnomalies = state.anomalies.map(a =>
        a.id === anomalyId
          ? { ...a, reviewResult: result, reviewedBy: reviewer, reviewedAt: formatDateTime(new Date()) }
          : a
      );

      const allReviewed = updatedAnomalies
        .filter(a => a.playbackId === anomaly.playbackId)
        .every(a => a.reviewResult);

      const updatedRecords = state.playbackRecords.map(r => {
        if (r.id === anomaly.playbackId) {
          const allConfirmed = updatedAnomalies
            .filter(a => a.playbackId === r.id)
            .every(a => a.reviewResult === 'confirmed_normal');
          
          return {
            ...r,
            status: (allConfirmed ? 'normal' : (allReviewed ? 'modified' : 'pending_review')) as PlaybackStatus,
            hasAnomaly: !allConfirmed,
            updatedAt: formatDateTime(new Date())
          };
        }
        return r;
      });

      return {
        anomalies: updatedAnomalies,
        playbackRecords: updatedRecords
      };
    });
  },

  updatePlaybackRemark: (playbackId, newRemark) => {
    const state = get();
    const playback = state.playbackRecords.find(r => r.id === playbackId);
    if (!playback) return;

    const version = state.getVersionHistoriesByPlaybackId(playbackId).length + 1;
    const newVersion = createVersionHistory(
      playbackId,
      'remark',
      playback.remark || '',
      newRemark,
      currentUser.name,
      'update',
      version
    );

    set(state => ({
      playbackRecords: state.playbackRecords.map(r =>
        r.id === playbackId
          ? { ...r, remark: newRemark, updatedAt: formatDateTime(new Date()) }
          : r
      ),
      versionHistories: [...state.versionHistories, newVersion]
    }));
  },

  rollbackToVersion: (playbackId, versionHistoryId) => {
    const state = get();
    const versionHistory = state.versionHistories.find(v => v.id === versionHistoryId);
    if (!versionHistory) return;

    const newVersion = createVersionHistory(
      playbackId,
      versionHistory.fieldName,
      versionHistory.newValue,
      versionHistory.oldValue,
      currentUser.name,
      'rollback',
      state.getVersionHistoriesByPlaybackId(playbackId).length + 1
    );

    set(state => {
      if (versionHistory.fieldName === 'remark') {
        return {
          playbackRecords: state.playbackRecords.map(r =>
            r.id === playbackId
              ? { ...r, remark: versionHistory.oldValue, updatedAt: formatDateTime(new Date()) }
              : r
          ),
          versionHistories: [...state.versionHistories, newVersion]
        };
      }
      if (versionHistory.fieldName === 'thresholds') {
        try {
          const oldThresholdsRaw = JSON.parse(versionHistory.oldValue) as ThresholdItem[];
          const detectedThresholds = detectAnomalies(oldThresholdsRaw);
          const hasAnomaly = hasAnyAnomaly(detectedThresholds);

          const updatedAnomalies = syncAnomaliesWithThresholds(
            playbackId,
            state.anomalies,
            detectedThresholds
          );

          const otherAnomalies = state.anomalies.filter(a => a.playbackId !== playbackId);
          const allAnomalies = [...otherAnomalies, ...updatedAnomalies];

          return {
            playbackRecords: state.playbackRecords.map(r =>
              r.id === playbackId
                ? {
                    ...r,
                    thresholds: detectedThresholds,
                    hasAnomaly,
                    status: hasAnomaly ? 'pending_review' : 'normal',
                    updatedAt: formatDateTime(new Date())
                  }
                : r
            ),
            anomalies: allAnomalies,
            versionHistories: [...state.versionHistories, newVersion]
          };
        } catch {
          return state;
        }
      }
      return state;
    });
  },

  addToast: (type, message) => {
    const id = generateId();
    set(state => ({
      toasts: [...state.toasts, { id, type, message }]
    }));
    setTimeout(() => {
      get().removeToast(id);
    }, 3000);
  },

  removeToast: (id) => {
    set(state => ({
      toasts: state.toasts.filter(t => t.id !== id)
    }));
  },

  getPlaybackById: (id) => {
    return get().playbackRecords.find(r => r.id === id);
  },

  getAnomaliesByPlaybackId: (playbackId) => {
    return get().anomalies.filter(a => a.playbackId === playbackId);
  },

  getBucketsByPlaybackId: (playbackId) => {
    return get().experimentBuckets.filter(b => b.playbackId === playbackId);
  },

  getLayerMetricsByPlaybackId: (playbackId) => {
    return get().layerMetrics.filter(m => m.playbackId === playbackId);
  },

  getVersionHistoriesByPlaybackId: (playbackId) => {
    return get().versionHistories.filter(v => v.playbackId === playbackId);
  }
}));
