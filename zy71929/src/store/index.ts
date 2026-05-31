import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Task,
  TaskStatus,
  StatusHistory,
  Artwork,
  WallLayout,
  OperationLog,
  ConsistencyCheckResult,
  ConsistencyIssue,
} from '@/types';
import {
  mockTasks,
  mockStatusHistories,
  mockArtworks,
  mockWallLayouts,
  mockOperationLogs,
} from '@/data/mockData';
import { generateId, generateHash } from '@/utils';

interface AppState {
  tasks: Task[];
  statusHistories: StatusHistory[];
  artworks: Artwork[];
  wallLayouts: WallLayout[];
  operationLogs: OperationLog[];
  currentUser: { id: string; name: string; role: string };
  searchQuery: string;
  statusFilter: TaskStatus | 'all';

  setSearchQuery: (query: string) => void;
  setStatusFilter: (status: TaskStatus | 'all') => void;

  createTask: (source: string, title: string, curatorNote: string) => Task | null;
  getTaskById: (id: string) => Task | undefined;
  getFilteredTasks: () => Task[];
  updateTaskStatus: (
    taskId: string,
    newStatus: TaskStatus,
    remark?: string,
    pendingReason?: string
  ) => void;

  getStatusHistoriesByTaskId: (taskId: string) => StatusHistory[];
  getArtworksByTaskId: (taskId: string) => Artwork[];
  getWallLayoutsByTaskId: (taskId: string) => WallLayout[];
  getOperationLogsByTaskId: (taskId: string) => OperationLog[];
  getLatestWallLayout: (taskId: string) => WallLayout | undefined;

  addOperationLog: (
    taskId: string,
    action: 'create' | 'update' | 'delete',
    fieldName: string,
    oldValue?: string,
    newValue?: string
  ) => void;

  checkConsistency: (taskId: string) => ConsistencyCheckResult;

  saveWallLayout: (
    taskId: string,
    layoutData: WallLayout['layoutData'],
    changeNote: string
  ) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      tasks: mockTasks,
      statusHistories: mockStatusHistories,
      artworks: mockArtworks,
      wallLayouts: mockWallLayouts,
      operationLogs: mockOperationLogs,
      currentUser: { id: 'user-2', name: '李助理', role: 'assistant' },
      searchQuery: '',
      statusFilter: 'all',

      setSearchQuery: (query) => set({ searchQuery: query }),
      setStatusFilter: (status) => set({ statusFilter: status }),

      createTask: (source, title, curatorNote) => {
        const sourceHash = generateHash(source + title + curatorNote);
        const existingTask = get().tasks.find((t) => t.sourceHash === sourceHash);

        if (existingTask) {
          set((state) => ({
            tasks: state.tasks.map((t) =>
              t.id === existingTask.id
                ? {
                    ...t,
                    executionCount: t.executionCount + 1,
                    updatedAt: new Date().toISOString(),
                    updatedBy: get().currentUser.name,
                  }
                : t
            ),
          }));
          get().addOperationLog(
            existingTask.id,
            'update',
            'execution',
            `第 ${existingTask.executionCount} 次`,
            `第 ${existingTask.executionCount + 1} 次`
          );
          return get().tasks.find((t) => t.id === existingTask.id) || null;
        }

        const newTask: Task = {
          id: generateId(),
          source,
          sourceHash,
          title,
          curatorNote,
          status: 'waiting_artworks',
          createdBy: get().currentUser.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          updatedBy: get().currentUser.name,
          executionCount: 1,
        };

        const newHistory: StatusHistory = {
          id: generateId(),
          taskId: newTask.id,
          fromStatus: null,
          toStatus: 'waiting_artworks',
          operator: get().currentUser.name,
          operatedAt: new Date().toISOString(),
          remark: '创建投屏任务',
        };

        set((state) => ({
          tasks: [...state.tasks, newTask],
          statusHistories: [...state.statusHistories, newHistory],
        }));

        get().addOperationLog(newTask.id, 'create', 'task', undefined, '创建投屏任务');
        return newTask;
      },

      getTaskById: (id) => get().tasks.find((t) => t.id === id),

      getFilteredTasks: () => {
        const { tasks, searchQuery, statusFilter } = get();
        return tasks.filter((task) => {
          const matchesSearch =
            task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            task.source.toLowerCase().includes(searchQuery.toLowerCase());
          const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
          return matchesSearch && matchesStatus;
        });
      },

      updateTaskStatus: (taskId, newStatus, remark, pendingReason) => {
        const task = get().getTaskById(taskId);
        if (!task) return;

        const oldStatus = task.status;

        const newHistory: StatusHistory = {
          id: generateId(),
          taskId,
          fromStatus: oldStatus,
          toStatus: newStatus,
          operator: get().currentUser.name,
          operatedAt: new Date().toISOString(),
          remark,
        };

        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: newStatus,
                  updatedAt: new Date().toISOString(),
                  updatedBy: get().currentUser.name,
                  pendingReason: newStatus === 'pending' ? pendingReason : undefined,
                }
              : t
          ),
          statusHistories: [...state.statusHistories, newHistory],
        }));

        get().addOperationLog(
          taskId,
          'update',
          'status',
          oldStatus,
          newStatus
        );
      },

      getStatusHistoriesByTaskId: (taskId) =>
        get()
          .statusHistories.filter((h) => h.taskId === taskId)
          .sort((a, b) => new Date(a.operatedAt).getTime() - new Date(b.operatedAt).getTime()),

      getArtworksByTaskId: (taskId) =>
        get().artworks.filter((a) => a.taskId === taskId),

      getWallLayoutsByTaskId: (taskId) =>
        get()
          .wallLayouts.filter((l) => l.taskId === taskId)
          .sort((a, b) => b.version - a.version),

      getOperationLogsByTaskId: (taskId) =>
        get()
          .operationLogs.filter((l) => l.taskId === taskId)
          .sort((a, b) => new Date(b.operatedAt).getTime() - new Date(a.operatedAt).getTime()),

      getLatestWallLayout: (taskId) => get().getWallLayoutsByTaskId(taskId)[0],

      addOperationLog: (taskId, action, fieldName, oldValue, newValue) => {
        const newLog: OperationLog = {
          id: generateId(),
          taskId,
          operator: get().currentUser.name,
          action,
          fieldName,
          oldValue,
          newValue,
          operatedAt: new Date().toISOString(),
        };
        set((state) => ({
          operationLogs: [...state.operationLogs, newLog],
        }));
      },

      checkConsistency: (taskId) => {
        const artworks = get().getArtworksByTaskId(taskId);
        const latestLayout = get().getLatestWallLayout(taskId);
        const issues: ConsistencyIssue[] = [];

        if (!latestLayout) {
          return { isConsistent: true, issues: [] };
        }

        const layoutArtworkIds = new Set(
          latestLayout.layoutData.walls.flatMap((w) =>
            w.artworks.map((a) => a.artworkId)
          )
        );

        artworks.forEach((artwork) => {
          if (!layoutArtworkIds.has(artwork.id)) {
            issues.push({
              type: 'missing_in_layout',
              artworkId: artwork.id,
              artworkTitle: artwork.title,
              message: `作品《${artwork.title}》未在展墙图中布置`,
              severity: 'error',
            });
          }
        });

        layoutArtworkIds.forEach((id) => {
          if (!artworks.find((a) => a.id === id)) {
            issues.push({
              type: 'missing_in_list',
              artworkId: id,
              artworkTitle: id,
              message: `展墙图中的作品 ${id} 不在作品清单中`,
              severity: 'warning',
            });
          }
        });

        return {
          isConsistent: issues.length === 0,
          issues,
        };
      },

      saveWallLayout: (taskId, layoutData, changeNote) => {
        const existingLayouts = get().getWallLayoutsByTaskId(taskId);
        const newVersion = existingLayouts.length > 0 ? existingLayouts[0].version + 1 : 1;

        const newLayout: WallLayout = {
          id: generateId(),
          taskId,
          version: newVersion,
          layoutData,
          modifiedBy: get().currentUser.name,
          modifiedAt: new Date().toISOString(),
          changeNote,
        };

        set((state) => ({
          wallLayouts: [...state.wallLayouts, newLayout],
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  updatedAt: new Date().toISOString(),
                  updatedBy: get().currentUser.name,
                }
              : t
          ),
        }));

        get().addOperationLog(
          taskId,
          'update',
          'wall_layout',
          `版本 ${newVersion - 1}`,
          `版本 ${newVersion}`
        );
      },
    }),
    {
      name: 'digital-art-casting-storage',
    }
  )
);
