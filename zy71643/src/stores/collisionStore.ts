import { create } from 'zustand';
import type {
  CollisionPoint,
  DetectionConfig,
  CollisionDetectionResult,
  DataIssue,
  WorkflowStatus,
} from '../types';
import { defaultDetectionConfig } from '../data/config';
import { detectCollisions } from '../engine/collision';
import { logger } from '../utils/logger';

interface CollisionState {
  config: DetectionConfig;
  collisions: CollisionPoint[];
  selectedCollision: CollisionPoint | null;
  dataIssues: DataIssue[];
  isDetecting: boolean;
  lastResult: CollisionDetectionResult | null;
  filterSeverity: string;
  filterType: string;
  filterStatus: string;
  setConfig: (config: Partial<DetectionConfig>) => void;
  runDetection: (segments: any[]) => Promise<void>;
  setSelectedCollision: (collision: CollisionPoint | null) => void;
  updateCollisionStatus: (id: string, status: WorkflowStatus) => void;
  setFilterSeverity: (value: string) => void;
  setFilterType: (value: string) => void;
  setFilterStatus: (value: string) => void;
  getFilteredCollisions: () => CollisionPoint[];
  reset: () => void;
}

export const useCollisionStore = create<CollisionState>((set, get) => ({
  config: defaultDetectionConfig,
  collisions: [],
  selectedCollision: null,
  dataIssues: [],
  isDetecting: false,
  lastResult: null,
  filterSeverity: 'all',
  filterType: 'all',
  filterStatus: 'all',

  setConfig: (config) => {
    set((state) => ({
      config: { ...state.config, ...config },
    }));
    logger.info('collision', '更新检测配置', config);
  },

  runDetection: async (segments) => {
    logger.info('collision', '开始执行碰撞检测');
    set({ isDetecting: true });

    try {
      await new Promise((resolve) => setTimeout(resolve, 200));

      const result = detectCollisions(segments, get().config);

      set({
        collisions: result.collisions,
        dataIssues: result.dataIssues,
        lastResult: result,
        isDetecting: false,
        selectedCollision: null,
      });

      logger.info('collision', '碰撞检测完成', {
        collisions: result.collisions.length,
        critical: result.collisions.filter((c) => c.severity === 'critical').length,
        issues: result.dataIssues.length,
      });
    } catch (error) {
      logger.error('collision', '碰撞检测失败', error);
      set({ isDetecting: false });
      throw error;
    }
  },

  setSelectedCollision: (collision) => {
    set({ selectedCollision: collision });
    if (collision) {
      logger.info('collision', '选中碰撞点', {
        id: collision.id,
        type: collision.type,
        severity: collision.severity,
      });
    }
  },

  updateCollisionStatus: (id, status) => {
    set((state) => ({
      collisions: state.collisions.map((c) =>
        c.id === id ? { ...c, status: status as WorkflowStatus } : c
      ),
    }));
    logger.info('workflow', '更新碰撞点状态', { id, status });
  },

  setFilterSeverity: (value) => set({ filterSeverity: value }),
  setFilterType: (value) => set({ filterType: value }),
  setFilterStatus: (value) => set({ filterStatus: value }),

  getFilteredCollisions: () => {
    const { collisions, filterSeverity, filterType, filterStatus } = get();
    return collisions.filter((c) => {
      if (filterSeverity !== 'all' && c.severity !== filterSeverity) return false;
      if (filterType !== 'all' && c.type !== filterType) return false;
      if (filterStatus !== 'all' && c.status !== filterStatus) return false;
      return true;
    });
  },

  reset: () => {
    set({
      collisions: [],
      selectedCollision: null,
      dataIssues: [],
      lastResult: null,
      filterSeverity: 'all',
      filterType: 'all',
      filterStatus: 'all',
    });
    logger.info('collision', '已重置碰撞检测结果');
  },
}));
