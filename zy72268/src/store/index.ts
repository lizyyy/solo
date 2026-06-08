import { create } from 'zustand';
import type {
  User,
  FloorSketch,
  Obstacle,
  Conflict,
  PointCloudLog,
  AuditLog,
  SelfCheckResult,
  ExportData,
} from '../types';
import { db } from '../db';
import { detectAllConflicts, generateId } from '../services/conflictDetectionService';
import { logChange } from '../services/auditService';

interface AppStore {
  currentUser: User;
  currentSketch: FloorSketch | null;
  obstacles: Obstacle[];
  pointCloudLogs: PointCloudLog[];
  conflicts: Conflict[];
  auditLogs: AuditLog[];
  selfCheckResults: SelfCheckResult[];
  isLoading: boolean;
  setCurrentUser: (user: User) => void;
  setAuditLogs: (logs: AuditLog[]) => void;
  importFloorSketch: (file: File) => Promise<void>;
  importPointCloudLog: (sketchId: string, file: File) => Promise<void>;
  resolveConflict: (
    conflictId: string,
    resolution: 'confirmed' | 'rejected',
    mergedName?: string
  ) => Promise<void>;
  reviewConflict: (
    conflictId: string,
    comment: string
  ) => Promise<void>;
  mergeObstacles: (
    obstacleIds: string[],
    mergedName: string
  ) => Promise<void>;
  exportData: () => Promise<ExportData>;
  loadAllData: () => Promise<void>;
  addConflicts: (conflicts: Conflict[]) => void;
  setSelfCheckResults: (results: SelfCheckResult[]) => void;
}

const defaultUser: User = {
  id: 'user-1',
  name: '阿景',
  role: 'designer',
};

export const useAppStore = create<AppStore>((set, get) => ({
  currentUser: defaultUser,
  currentSketch: null,
  obstacles: [],
  pointCloudLogs: [],
  conflicts: [],
  auditLogs: [],
  selfCheckResults: [],
  isLoading: false,

  setCurrentUser: (user) => set({ currentUser: user }),

  importFloorSketch: async (file) => {
    set({ isLoading: true });
    const { currentUser } = get();

    try {
      const content = await file.text();
      const data = JSON.parse(content);

      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest(
        'SHA-256',
        encoder.encode(content)
      );
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const sketchId = generateId();
      const now = new Date();

      const obstacles: Obstacle[] = (data.obstacles || []).map((obs: Record<string, unknown>) => ({
        id: generateId(),
        sketchId,
        currentName: obs.name as string,
        position: (obs.position as { x: number; y: number; z: number }) || { x: 0, y: 0, z: 0 },
        dimensions: (obs.dimensions as { width: number; height: number; depth: number }) || { width: 1, height: 1, depth: 1 },
        source: 'sketch',
        isConflicted: false,
        status: 'pending',
        nameHistory: [{
          id: generateId(),
          name: obs.name as string,
          changedBy: currentUser.name,
          changedAt: now,
          reason: '草图导入',
        }],
        createdAt: now,
        updatedAt: now,
      }));

      const sketch: FloorSketch = {
        id: sketchId,
        name: data.name || file.name,
        floor: data.floor || '未知楼层',
        importedBy: currentUser.name,
        importedAt: now,
        fileHash,
        obstacles,
      };

      await db.transaction('rw', [db.floorSketches, db.obstacles], async () => {
        await db.floorSketches.add(sketch);
        for (const obs of obstacles) {
          await db.obstacles.add(obs);
        }
      });

      await logChange(
        currentUser,
        'import',
        'floor-sketch',
        sketchId,
        null,
        { name: sketch.name, obstacleCount: obstacles.length },
        '导入楼层剖面草图'
      );

      const newConflicts = detectAllConflicts(obstacles);
      const conflictedIds = new Set<string>();
      for (const c of newConflicts) {
        for (const oid of c.obstacleIds) {
          conflictedIds.add(oid);
        }
      }
      const obstaclesWithFlag = obstacles.map(o => ({
        ...o,
        isConflicted: conflictedIds.has(o.id),
      }));

      if (newConflicts.length > 0) {
        for (const conflict of newConflicts) {
          await db.conflicts.add(conflict);
        }
        await db.transaction('rw', [db.obstacles], async () => {
          for (const o of obstaclesWithFlag) {
            await db.obstacles.put(o);
          }
        });
      }

      set({
        currentSketch: sketch,
        obstacles: obstaclesWithFlag,
        conflicts: newConflicts,
        isLoading: false,
      });
    } catch (error) {
      console.error('导入失败:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  importPointCloudLog: async (sketchId, file) => {
    set({ isLoading: true });
    const { currentUser, obstacles } = get();

    try {
      const content = await file.text();
      const data = JSON.parse(content);

      const logId = generateId();
      const now = new Date();

      const pcObstacles: Obstacle[] = (data.obstacles || []).map((obs: Record<string, unknown>) => ({
        id: generateId(),
        sketchId,
        currentName: obs.name as string,
        position: (obs.position as { x: number; y: number; z: number }) || { x: 0, y: 0, z: 0 },
        dimensions: (obs.dimensions as { width: number; height: number; depth: number }) || { width: 1, height: 1, depth: 1 },
        source: 'point-cloud',
        isConflicted: false,
        status: 'pending',
        nameHistory: [{
          id: generateId(),
          name: obs.name as string,
          changedBy: currentUser.name,
          changedAt: now,
          reason: '点云抽稀日志补录',
        }],
        createdAt: now,
        updatedAt: now,
      }));

      const pointCloudLog: PointCloudLog = {
        id: logId,
        sketchId,
        name: file.name,
        processedBy: currentUser.name,
        processedAt: now,
        data,
      };

      await db.transaction('rw', [db.pointCloudLogs, db.obstacles], async () => {
        await db.pointCloudLogs.add(pointCloudLog);
        for (const obs of pcObstacles) {
          await db.obstacles.add(obs);
        }
      });

      await logChange(
        currentUser,
        'import',
        'point-cloud-log',
        logId,
        null,
        { name: pointCloudLog.name, obstacleCount: pcObstacles.length },
        '补看点云抽稀日志'
      );

      const allObstacles = [...obstacles, ...pcObstacles];
      const sketchObstacles = obstacles.filter(o => o.source === 'sketch');
      const newConflicts = detectAllConflicts(sketchObstacles, pcObstacles);

      const conflictedIds = new Set<string>();
      for (const c of newConflicts) {
        for (const oid of c.obstacleIds) {
          conflictedIds.add(oid);
        }
      }
      const allObstaclesWithFlag = allObstacles.map(o => ({
        ...o,
        isConflicted: conflictedIds.has(o.id) ? true : o.isConflicted,
      }));

      if (newConflicts.length > 0) {
        for (const conflict of newConflicts) {
          await db.conflicts.add(conflict);
        }
        await db.transaction('rw', [db.obstacles], async () => {
          for (const o of allObstaclesWithFlag) {
            await db.obstacles.put(o);
          }
        });
      }

      set(state => ({
        pointCloudLogs: [...state.pointCloudLogs, pointCloudLog],
        obstacles: allObstaclesWithFlag,
        conflicts: [...state.conflicts, ...newConflicts],
        isLoading: false,
      }));
    } catch (error) {
      console.error('导入失败:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  resolveConflict: async (conflictId, resolution, mergedName) => {
    const { currentUser, conflicts, obstacles } = get();
    const conflict = conflicts.find(c => c.id === conflictId);
    if (!conflict) return;

    const updatedConflict: Conflict = {
      ...conflict,
      status: resolution,
      resolvedBy: currentUser.name,
      resolvedAt: new Date(),
      resolution,
    };

    await db.conflicts.update(conflictId, {
      status: resolution,
      resolvedBy: currentUser.name,
      resolvedAt: new Date(),
      resolution,
    });

    if (resolution === 'confirmed' && mergedName && conflict.obstacleIds.length > 1) {
      const [mainId, ...mergeIds] = conflict.obstacleIds;
      const mainObs = obstacles.find(o => o.id === mainId);

      if (mainObs) {
        const updatedObs: Obstacle = {
          ...mainObs,
          currentName: mergedName,
          status: 'confirmed',
          isConflicted: false,
          nameHistory: [
            ...mainObs.nameHistory,
            {
              id: generateId(),
              name: mergedName,
              changedBy: currentUser.name,
              changedAt: new Date(),
              reason: '冲突确认合并',
            },
          ],
          updatedAt: new Date(),
        };

        await db.obstacles.put(updatedObs);

        for (const mergeId of mergeIds) {
          const mergeObs = obstacles.find(o => o.id === mergeId);
          if (mergeObs) {
            await db.obstacles.put({
              ...mergeObs,
              status: 'merged',
              mergedInto: mainId,
              isConflicted: false,
              updatedAt: new Date(),
            });
          }
        }
      }
    }

    await logChange(
      currentUser,
      resolution === 'confirmed' ? 'confirm' : 'reject',
      'conflict',
      conflictId,
      { status: conflict.status },
      { status: resolution },
      resolution === 'confirmed' ? '确认冲突并合并' : '驳回冲突'
    );

    set(state => ({
      conflicts: state.conflicts.map(c =>
        c.id === conflictId ? updatedConflict : c
      ),
      obstacles: state.obstacles.map(o => {
        if (o.id === conflict.obstacleIds[0] && resolution === 'confirmed' && mergedName) {
          return {
            ...o,
            currentName: mergedName,
            status: 'confirmed',
            isConflicted: false,
            updatedAt: new Date(),
          };
        }
        if (conflict.obstacleIds.includes(o.id) && o.id !== conflict.obstacleIds[0] && resolution === 'confirmed') {
          return { ...o, status: 'merged', mergedInto: conflict.obstacleIds[0], isConflicted: false };
        }
        return o;
      }),
    }));
  },

  reviewConflict: async (conflictId, comment) => {
    const { currentUser, conflicts } = get();
    const conflict = conflicts.find(c => c.id === conflictId);
    if (!conflict) return;

    await db.conflicts.update(conflictId, {
      requiresReview: false,
      reviewedBy: currentUser.name,
      reviewedAt: new Date(),
      reviewComment: comment,
    });

    await logChange(
      currentUser,
      'review',
      'conflict',
      conflictId,
      { requiresReview: true },
      { requiresReview: false, reviewComment: comment },
      '学员复核完成'
    );

    set(state => ({
      conflicts: state.conflicts.map(c =>
        c.id === conflictId
          ? { ...c, requiresReview: false, reviewedBy: currentUser.name, reviewedAt: new Date(), reviewComment: comment }
          : c
      ),
    }));
  },

  mergeObstacles: async (obstacleIds, mergedName) => {
    const { currentUser, obstacles } = get();
    if (obstacleIds.length < 2) return;

    const [mainId, ...mergeIds] = obstacleIds;
    const mainObs = obstacles.find(o => o.id === mainId);
    if (!mainObs) return;

    const mergedObs: Obstacle = {
      ...mainObs,
      currentName: mergedName,
      status: 'confirmed',
      isConflicted: false,
      nameHistory: [
        ...mainObs.nameHistory,
        {
          id: generateId(),
          name: mergedName,
          changedBy: currentUser.name,
          changedAt: new Date(),
          reason: '手动合并障碍物',
        },
      ],
      updatedAt: new Date(),
    };

    await db.obstacles.put(mergedObs);

    for (const mergeId of mergeIds) {
      const mergeObs = obstacles.find(o => o.id === mergeId);
      if (mergeObs) {
        await db.obstacles.put({
          ...mergeObs,
          status: 'merged',
          mergedInto: mainId,
          isConflicted: false,
          updatedAt: new Date(),
        });
      }
    }

    await logChange(
      currentUser,
      'merge',
      'obstacle',
      mainId,
      { obstacleIds },
      { mergedName, mainObstacle: mainId },
      '手动合并障碍物',
      obstacleIds
    );

    set(state => ({
      obstacles: state.obstacles.map(o => {
        if (o.id === mainId) return mergedObs;
        if (mergeIds.includes(o.id)) {
          return { ...o, status: 'merged', mergedInto: mainId, isConflicted: false };
        }
        return o;
      }),
    }));
  },

  exportData: async () => {
    const { currentUser, currentSketch, obstacles, conflicts, pointCloudLogs } = get();

    const exportData: ExportData = {
      sketch: currentSketch!,
      pointCloudLogs,
      conflicts,
      obstacles,
      exportTime: new Date(),
      exportedBy: currentUser.name,
    };

    await logChange(
      currentUser,
      'export',
      'data',
      'export-all',
      null,
      { exportTime: new Date() },
      '导出数据明细'
    );

    return exportData;
  },

  loadAllData: async () => {
    set({ isLoading: true });

    try {
      const [sketches, obstacles, logs, conflicts, auditLogs] = await Promise.all([
        db.floorSketches.toArray(),
        db.obstacles.toArray(),
        db.pointCloudLogs.toArray(),
        db.conflicts.toArray(),
        db.auditLogs.orderBy('createdAt').reverse().toArray(),
      ]);

      set({
        currentSketch: sketches[0] || null,
        obstacles,
        pointCloudLogs: logs,
        conflicts,
        auditLogs,
        isLoading: false,
      });
    } catch (error) {
      console.error('loadAllData failed:', error);
      set({ isLoading: false });
    }
  },

  addConflicts: (conflicts) => {
    set(state => ({
      conflicts: [...state.conflicts, ...conflicts],
    }));
  },

  setAuditLogs: (logs) => {
    set({ auditLogs: logs });
  },

  setSelfCheckResults: (results) => {
    set({ selfCheckResults: results });
  },
}));
