import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  GaitFrame,
  SkeletonPoint,
  CameraState,
  FilterState,
  ProcessNote,
  AnomalyType,
  BoneGroup,
  DataSource,
  Snapshot,
  Statistics,
  CoordinateDiff,
  AnomalyStatusDiff,
  ChangeRecord,
  ChangeType,
  ActionLog,
  ActionType,
} from '../types';
import { MOCK_FRAMES } from '../data/mockData';

const generateId = () => Math.random().toString(36).substring(2, 11);

interface GaitState {
  frames: GaitFrame[];
  currentFrameIndex: number;
  selectedPointId: string | null;
  cameraState: CameraState;
  filters: FilterState;
  isPlaying: boolean;
  playSpeed: number;
  snapshots: Snapshot[];
  actionLogs: ActionLog[];
  importReport: {
    fileName: string;
    importedAt: string;
    totalPoints: number;
    warnings: string[];
  } | null;

  setFrames: (frames: GaitFrame[], author?: string) => void;
  setCurrentFrameIndex: (index: number) => void;
  setSelectedPointId: (id: string | null) => void;
  setCameraState: (state: CameraState) => void;
  toggleBoneGroupFilter: (group: BoneGroup) => void;
  toggleDataSourceFilter: (source: DataSource) => void;
  setShowAnomalyOnly: (show: boolean) => void;
  setSearchQuery: (query: string) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaySpeed: (speed: number) => void;

  togglePointAnomaly: (pointId: string, anomalyType?: AnomalyType, anomalyNote?: string, reason?: string, author?: string) => void;
  addNoteToPoint: (pointId: string, content: string, author: string, reason?: string) => void;
  updatePointCoordinates: (pointId: string, x: number, y: number, z: number, author: string, reason?: string) => void;

  createSnapshot: (name: string, description: string, author: string) => void;
  restoreSnapshot: (snapshotId: string, author?: string) => void;
  deleteSnapshot: (snapshotId: string) => void;

  setImportReport: (report: { fileName: string; importedAt: string; totalPoints: number; warnings: string[] } | null) => void;

  getCurrentFrame: () => GaitFrame | undefined;
  getSelectedPoint: () => SkeletonPoint | undefined;
  getFilteredPoints: () => SkeletonPoint[];
  getStatistics: () => Statistics;
  getPointHistory: (pointName: string) => ProcessNote[];
  getActionLogs: () => ActionLog[];
}

const initialCameraState: CameraState = {
  position: [3, 2, 3],
  target: [0, 0.8, 0],
};

const initialFilters: FilterState = {
  boneGroups: [],
  dataSources: [],
  showAnomalyOnly: false,
  searchQuery: '',
};

const calculateCoordinateDiff = (
  prev: { x: number; y: number; z: number },
  curr: { x: number; y: number; z: number },
): CoordinateDiff => {
  const dx = curr.x - prev.x;
  const dy = curr.y - prev.y;
  const dz = curr.z - prev.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return {
    previous: { ...prev },
    current: { ...curr },
    delta: { x: dx, y: dy, z: dz, distance },
  };
};

const updatePointModificationStats = (
  point: SkeletonPoint,
  changeType: ChangeType,
  author: string,
): SkeletonPoint['modificationStats'] => {
  const stats = { ...point.modificationStats };
  stats.totalChanges += 1;
  stats.lastModifiedAt = new Date().toISOString();

  if (!stats.modifiedBy.includes(author)) {
    stats.modifiedBy = [...stats.modifiedBy, author];
  }

  switch (changeType) {
    case 'coordinate':
      stats.coordinateChanges += 1;
      break;
    case 'anomaly_status':
    case 'anomaly_type':
      stats.anomalyStatusChanges += 1;
      break;
    case 'note':
      stats.noteAdditions += 1;
      break;
    case 'source':
      stats.sourceChanges += 1;
      break;
  }

  return stats;
};

const addActionLog = (
  state: GaitState,
  actionType: ActionType,
  description: string,
  author: string,
  details?: ActionLog['details'],
): ActionLog[] => {
  const newLog: ActionLog = {
    id: generateId(),
    actionType,
    timestamp: new Date().toISOString(),
    author,
    description,
    details,
  };
  return [newLog, ...state.actionLogs].slice(0, 200);
};

export const useGaitStore = create<GaitState>()(
  persist(
    (set, get) => ({
      frames: MOCK_FRAMES,
      currentFrameIndex: 0,
      selectedPointId: null,
      cameraState: initialCameraState,
      filters: initialFilters,
      isPlaying: false,
      playSpeed: 1,
      snapshots: [],
      actionLogs: [],
      importReport: null,

      setFrames: (frames, author = '系统') =>
        set((state) => ({
          frames,
          actionLogs: addActionLog(state, 'import_data', `导入 ${frames.length} 帧数据`, author),
        })),

      setCurrentFrameIndex: (index) =>
        set((state) => {
          const maxIndex = state.frames.length - 1;
          const newIndex = Math.max(0, Math.min(index, maxIndex));
          return {
            currentFrameIndex: newIndex,
            actionLogs: addActionLog(state, 'change_frame', `切换到第 ${newIndex + 1} 帧`, '系统', {
              frameNumber: newIndex,
            }),
          };
        }),

      setSelectedPointId: (id) => set({ selectedPointId: id }),

      setCameraState: (state) => set({ cameraState: state }),

      toggleBoneGroupFilter: (group) =>
        set((state) => {
          const groups = state.filters.boneGroups.includes(group)
            ? state.filters.boneGroups.filter((g) => g !== group)
            : [...state.filters.boneGroups, group];
          return {
            filters: { ...state.filters, boneGroups: groups },
            actionLogs: addActionLog(
              state,
              'update_filter',
              `${state.filters.boneGroups.includes(group) ? '取消' : '添加'}部位筛选：${group}`,
              '系统',
              { previousValue: state.filters.boneGroups, newValue: groups },
            ),
          };
        }),

      toggleDataSourceFilter: (source) =>
        set((state) => {
          const sources = state.filters.dataSources.includes(source)
            ? state.filters.dataSources.filter((s) => s !== source)
            : [...state.filters.dataSources, source];
          return {
            filters: { ...state.filters, dataSources: sources },
            actionLogs: addActionLog(
              state,
              'update_filter',
              `${state.filters.dataSources.includes(source) ? '取消' : '添加'}来源筛选：${source}`,
              '系统',
              { previousValue: state.filters.dataSources, newValue: sources },
            ),
          };
        }),

      setShowAnomalyOnly: (show) =>
        set((state) => ({
          filters: { ...state.filters, showAnomalyOnly: show },
          actionLogs: addActionLog(
            state,
            'update_filter',
            show ? '开启仅显示异常' : '关闭仅显示异常',
            '系统',
            { previousValue: state.filters.showAnomalyOnly, newValue: show },
          ),
        })),

      setSearchQuery: (query) =>
        set((state) => ({
          filters: { ...state.filters, searchQuery: query },
        })),

      setIsPlaying: (playing) => set({ isPlaying: playing }),

      setPlaySpeed: (speed) => set({ playSpeed: Math.max(0.25, Math.min(4, speed)) }),

      togglePointAnomaly: (pointId, anomalyType, anomalyNote, reason = '', author = '当前用户') =>
        set((state) => {
          const pointName = pointId.split('_frame')[0];
          const currentFrameIdx = state.currentFrameIndex;

          const newFrames = state.frames.map((frame) => ({
            ...frame,
            points: frame.points.map((point) => {
              if (point.name === pointName) {
                const isNowAnomaly = !point.isAnomaly;
                const changes: ChangeRecord[] = [
                  {
                    field: 'isAnomaly',
                    previous: point.isAnomaly,
                    current: isNowAnomaly,
                    reason: reason || undefined,
                  },
                ];

                if (anomalyType) {
                  changes.push({
                    field: 'anomalyType',
                    previous: point.anomalyType,
                    current: anomalyType,
                    reason: reason || undefined,
                  });
                }

                if (anomalyNote) {
                  changes.push({
                    field: 'anomalyNote',
                    previous: point.anomalyNote,
                    current: anomalyNote,
                    reason: reason || undefined,
                  });
                }

                const anomalyDiff: AnomalyStatusDiff = {
                  previous: point.isAnomaly,
                  current: isNowAnomaly,
                  previousType: point.anomalyType,
                  currentType: isNowAnomaly ? anomalyType : undefined,
                };

                const newNote: ProcessNote = {
                  id: generateId(),
                  pointId: point.id,
                  frameNumber: frame.frameNumber,
                  content: isNowAnomaly
                    ? `标记为异常：${anomalyType || '未指定类型'}${anomalyNote ? ' - ' + anomalyNote : ''}`
                    : '取消异常标记，复核确认正常',
                  author,
                  createdAt: new Date().toISOString(),
                  changeType: 'anomaly_status',
                  changes,
                  anomalyDiff,
                  originalSourceRow: point.sourceRow,
                  originalSourceFile: point.sourceFile,
                };

                return {
                  ...point,
                  isAnomaly: isNowAnomaly,
                  anomalyType: isNowAnomaly ? anomalyType : undefined,
                  anomalyNote: isNowAnomaly ? anomalyNote : undefined,
                  notes: [...point.notes, newNote],
                  modificationStats: updatePointModificationStats(point, 'anomaly_status', author),
                  updatedAt: new Date().toISOString(),
                  processedBy: author,
                };
              }
              return point;
            }),
          }));

          const samplePoint = state.frames[currentFrameIdx]?.points.find((p) => p.name === pointName);
          const wasAnomaly = samplePoint?.isAnomaly || false;

          return {
            frames: newFrames,
            actionLogs: addActionLog(
              state,
              'toggle_anomaly',
              `${pointName} ${wasAnomaly ? '取消异常标记' : '标记为异常'}`,
              author,
              {
                pointName,
                pointId,
                frameNumber: currentFrameIdx,
                previousValue: wasAnomaly,
                newValue: !wasAnomaly,
                reason: reason || undefined,
              },
            ),
          };
        }),

      addNoteToPoint: (pointId, content, author, reason = '') =>
        set((state) => {
          const pointName = pointId.split('_frame')[0];

          const newFrames = state.frames.map((frame) => ({
            ...frame,
            points: frame.points.map((point) => {
              if (point.name === pointName) {
                const changes: ChangeRecord[] = [
                  {
                    field: 'note',
                    previous: null,
                    current: content,
                    reason: reason || undefined,
                  },
                ];

                const newNote: ProcessNote = {
                  id: generateId(),
                  pointId: point.id,
                  frameNumber: frame.frameNumber,
                  content,
                  author,
                  createdAt: new Date().toISOString(),
                  changeType: 'note',
                  changes,
                  originalSourceRow: point.sourceRow,
                  originalSourceFile: point.sourceFile,
                };

                return {
                  ...point,
                  notes: [...point.notes, newNote],
                  modificationStats: updatePointModificationStats(point, 'note', author),
                  updatedAt: new Date().toISOString(),
                };
              }
              return point;
            }),
          }));

          return {
            frames: newFrames,
            actionLogs: addActionLog(state, 'add_note', `${pointName} 添加备注：${content.slice(0, 30)}`, author, {
              pointName,
              pointId,
              frameNumber: state.currentFrameIndex,
              newValue: content,
              reason: reason || undefined,
            }),
          };
        }),

      updatePointCoordinates: (pointId, x, y, z, author, reason = '') =>
        set((state) => {
          const pointName = pointId.split('_frame')[0];
          const currentFrameIdx = state.currentFrameIndex;

          const currentPoint = state.frames[currentFrameIdx]?.points.find((p) => p.name === pointName);

          if (!currentPoint) return state;

          const coordinateDiff = calculateCoordinateDiff(
            { x: currentPoint.x, y: currentPoint.y, z: currentPoint.z },
            { x, y, z },
          );

          const changes: ChangeRecord[] = [
            { field: 'x', previous: currentPoint.x, current: x, reason: reason || undefined },
            { field: 'y', previous: currentPoint.y, current: y, reason: reason || undefined },
            { field: 'z', previous: currentPoint.z, current: z, reason: reason || undefined },
          ];

          const newNote: ProcessNote = {
            id: generateId(),
            pointId,
            frameNumber: currentFrameIdx,
            content: `坐标修正：原值(${currentPoint.x.toFixed(4)}, ${currentPoint.y.toFixed(4)}, ${currentPoint.z.toFixed(4)}) → 新值(${x.toFixed(4)}, ${y.toFixed(4)}, ${z.toFixed(4)})，偏移距离：${coordinateDiff.delta.distance.toFixed(4)}`,
            author,
            createdAt: new Date().toISOString(),
            changeType: 'coordinate',
            changes,
            coordinateDiff,
            originalSourceRow: currentPoint.sourceRow,
            originalSourceFile: currentPoint.sourceFile,
          };

          const newFrames = state.frames.map((frame) => ({
            ...frame,
            points: frame.points.map((point) => {
              if (point.name === pointName) {
                return {
                  ...point,
                  x: x + (point.x - currentPoint.x),
                  y: y + (point.y - currentPoint.y),
                  z: z + (point.z - currentPoint.z),
                  source: 'manual_edit' as DataSource,
                  notes: [...point.notes, newNote],
                  modificationStats: updatePointModificationStats(point, 'coordinate', author),
                  updatedAt: new Date().toISOString(),
                  processedBy: author,
                };
              }
              return point;
            }),
          }));

          return {
            frames: newFrames,
            actionLogs: addActionLog(
              state,
              'update_coordinates',
              `${pointName} 坐标修正，偏移：${coordinateDiff.delta.distance.toFixed(4)}`,
              author,
              {
                pointName,
                pointId,
                frameNumber: currentFrameIdx,
                previousValue: { x: currentPoint.x, y: currentPoint.y, z: currentPoint.z },
                newValue: { x, y, z },
                reason: reason || undefined,
              },
            ),
          };
        }),

      createSnapshot: (name, description, author) =>
        set((state) => {
          const snapshot: Snapshot = {
            id: generateId(),
            name,
            description,
            createdAt: new Date().toISOString(),
            createdBy: author,
            frames: JSON.parse(JSON.stringify(state.frames)),
            cameraState: { ...state.cameraState },
            filters: { ...state.filters },
            anomalyCount: state.frames.reduce(
              (sum, f) => sum + f.points.filter((p) => p.isAnomaly).length,
              0,
            ),
            totalPoints: state.frames[0]?.points.length || 0,
            noteCount: state.frames.reduce(
              (sum, f) => sum + f.points.reduce((s, p) => s + p.notes.length, 0),
              0,
            ),
          };
          return {
            snapshots: [...state.snapshots, snapshot],
            actionLogs: addActionLog(state, 'create_snapshot', `创建快照：${name}`, author, {
              snapshotName: name,
            }),
          };
        }),

      restoreSnapshot: (snapshotId, author = '当前用户') =>
        set((state) => {
          const snapshot = state.snapshots.find((s) => s.id === snapshotId);
          if (!snapshot) return state;
          return {
            frames: JSON.parse(JSON.stringify(snapshot.frames)),
            cameraState: { ...snapshot.cameraState },
            filters: { ...snapshot.filters },
            currentFrameIndex: 0,
            selectedPointId: null,
            actionLogs: addActionLog(state, 'restore_snapshot', `恢复快照：${snapshot.name}`, author, {
              snapshotName: snapshot.name,
            }),
          };
        }),

      deleteSnapshot: (snapshotId) =>
        set((state) => ({
          snapshots: state.snapshots.filter((s) => s.id !== snapshotId),
        })),

      setImportReport: (report) => set({ importReport: report }),

      getCurrentFrame: () => {
        const state = get();
        return state.frames[state.currentFrameIndex];
      },

      getSelectedPoint: () => {
        const state = get();
        const currentFrame = state.frames[state.currentFrameIndex];
        return currentFrame?.points.find(
          (p) => p.id === state.selectedPointId || p.name === state.selectedPointId,
        );
      },

      getFilteredPoints: () => {
        const state = get();
        const currentFrame = state.frames[state.currentFrameIndex];
        if (!currentFrame) return [];

        return currentFrame.points.filter((point) => {
          if (state.filters.boneGroups.length > 0 && !state.filters.boneGroups.includes(point.boneGroup)) {
            return false;
          }
          if (state.filters.dataSources.length > 0 && !state.filters.dataSources.includes(point.source)) {
            return false;
          }
          if (state.filters.showAnomalyOnly && !point.isAnomaly) {
            return false;
          }
          if (state.filters.searchQuery) {
            const query = state.filters.searchQuery.toLowerCase();
            if (!point.name.toLowerCase().includes(query) && !point.nameCn.includes(query)) {
              return false;
            }
          }
          return true;
        });
      },

      getStatistics: () => {
        const state = get();
        const allPoints = state.frames.flatMap((f) => f.points);
        const firstFramePoints = state.frames[0]?.points || [];

        const anomalyByType: Record<AnomalyType, number> = {
          coordinate_error: 0,
          missing_data: 0,
          outlier: 0,
          suspicious: 0,
        };

        firstFramePoints.forEach((p) => {
          if (p.isAnomaly && p.anomalyType) {
            anomalyByType[p.anomalyType] = (anomalyByType[p.anomalyType] || 0) + 1;
          }
        });

        const pointsBySource: Record<DataSource, number> = {
          cad_export: 0,
          manual_edit: 0,
          photo_estimate: 0,
        };
        firstFramePoints.forEach((p) => {
          pointsBySource[p.source] = (pointsBySource[p.source] || 0) + 1;
        });

        const pointsByBoneGroup: Record<BoneGroup, number> = {
          head: 0,
          spine: 0,
          leftArm: 0,
          rightArm: 0,
          leftLeg: 0,
          rightLeg: 0,
        };
        firstFramePoints.forEach((p) => {
          pointsByBoneGroup[p.boneGroup] = (pointsByBoneGroup[p.boneGroup] || 0) + 1;
        });

        const totalCoordinateChanges = firstFramePoints.reduce(
          (sum, p) => sum + p.modificationStats.coordinateChanges,
          0,
        );

        const totalNotes = allPoints.reduce((sum, p) => sum + p.notes.length, 0);

        return {
          totalFrames: state.frames.length,
          totalPoints: firstFramePoints.length,
          anomalyPoints: firstFramePoints.filter((p) => p.isAnomaly).length,
          anomalyByType,
          totalNotes,
          totalCoordinateChanges,
          pointsBySource,
          pointsByBoneGroup,
        };
      },

      getPointHistory: (pointName) => {
        const state = get();
        const notes: ProcessNote[] = [];
        state.frames.forEach((frame) => {
          frame.points.forEach((point) => {
            if (point.name === pointName) {
              notes.push(...point.notes);
            }
          });
        });
        return notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      },

      getActionLogs: () => {
        return get().actionLogs;
      },
    }),
    {
      name: 'gait-skeleton-storage-v3',
      partialize: (state) => ({
        frames: state.frames,
        currentFrameIndex: state.currentFrameIndex,
        selectedPointId: state.selectedPointId,
        cameraState: state.cameraState,
        filters: state.filters,
        playSpeed: state.playSpeed,
        importReport: state.importReport,
        snapshots: state.snapshots,
        actionLogs: state.actionLogs,
      }),
    },
  ),
);
