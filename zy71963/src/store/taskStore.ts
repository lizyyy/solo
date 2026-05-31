import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Task, HistoryRecord, TaskStatus, TaskSource } from '../types';
import { mockTasks, mockHistory } from '../data/mockData';

interface TaskStore {
  tasks: Task[];
  history: HistoryRecord[];
  currentUser: string;
  
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTask: (id: string, updates: Partial<Task>, changeReason?: string) => void;
  deleteTask: (id: string) => void;
  getTaskById: (id: string) => Task | undefined;
  getTaskHistory: (taskId: string) => HistoryRecord[];
}

const generateId = (): string => {
  return `TASK-${Date.now().toString(36).toUpperCase()}`;
};

const generateHistoryId = (): string => {
  return `HIST-${Date.now().toString(36).toUpperCase()}`;
};

export const useTaskStore = create<TaskStore>()(
  persist(
    (set, get) => ({
      tasks: mockTasks,
      history: mockHistory,
      currentUser: '当前用户',

      addTask: (taskData) => {
        const newTask: Task = {
          ...taskData,
          id: generateId(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({
          tasks: [newTask, ...state.tasks],
        }));
      },

      updateTask: (id, updates, changeReason = '') => {
        const { tasks, history, currentUser } = get();
        const task = tasks.find((t) => t.id === id);
        if (!task) return;

        const newHistoryRecords: HistoryRecord[] = [];
        const now = new Date().toISOString();

        Object.entries(updates).forEach(([key, value]) => {
          const oldValue = String(task[key as keyof Task] || '');
          const newValue = String(value || '');
          if (oldValue !== newValue) {
            newHistoryRecords.push({
              id: generateHistoryId(),
              taskId: id,
              fieldName: key,
              oldValue,
              newValue,
              modifiedBy: currentUser,
              changeReason,
              createdAt: now,
            });
          }
        });

        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, ...updates, updatedAt: now } : t
          ),
          history: [...newHistoryRecords, ...state.history],
        }));
      },

      deleteTask: (id) => {
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id),
          history: state.history.filter((h) => h.taskId !== id),
        }));
      },

      getTaskById: (id) => {
        return get().tasks.find((t) => t.id === id);
      },

      getTaskHistory: (taskId) => {
        return get().history.filter((h) => h.taskId === taskId);
      },
    }),
    {
      name: 'task-queue-storage',
    }
  )
);
