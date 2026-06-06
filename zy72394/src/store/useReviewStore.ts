import { create } from 'zustand';
import type { ReviewTask } from '@/types';
import { storage } from '@/utils/storage';
import { mockReviewTasks } from '@/utils/mockData';
import { generateId } from '@/utils/helpers';

interface ReviewState {
  tasks: ReviewTask[];
  init: () => void;
  addTask: (task: Omit<ReviewTask, 'id' | 'status' | 'createdAt'>) => void;
  approveTask: (taskId: string, reviewerId: string, comment: string) => void;
  rejectTask: (taskId: string, reviewerId: string, comment: string) => void;
  getTaskById: (id: string) => ReviewTask | undefined;
  getTasksByRecordId: (recordId: string) => ReviewTask[];
  getPendingTasks: () => ReviewTask[];
  resetToMock: () => void;
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  tasks: [],

  init: () => {
    const saved = storage.get<ReviewTask[]>('reviewTasks', []);
    if (saved.length === 0) {
      set({ tasks: mockReviewTasks });
      storage.set('reviewTasks', mockReviewTasks);
    } else {
      set({ tasks: saved });
    }
  },

  addTask: (task) => {
    const newTask: ReviewTask = {
      ...task,
      id: generateId(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    const newTasks = [...get().tasks, newTask];
    set({ tasks: newTasks });
    storage.set('reviewTasks', newTasks);
  },

  approveTask: (taskId, reviewerId, comment) => {
    const newTasks = get().tasks.map(t =>
      t.id === taskId ? {
        ...t,
        status: 'approved' as const,
        reviewComment: comment,
        reviewedAt: new Date().toISOString(),
        reviewedBy: reviewerId,
      } : t
    );
    set({ tasks: newTasks });
    storage.set('reviewTasks', newTasks);
  },

  rejectTask: (taskId, reviewerId, comment) => {
    const newTasks = get().tasks.map(t =>
      t.id === taskId ? {
        ...t,
        status: 'rejected' as const,
        reviewComment: comment,
        reviewedAt: new Date().toISOString(),
        reviewedBy: reviewerId,
      } : t
    );
    set({ tasks: newTasks });
    storage.set('reviewTasks', newTasks);
  },

  getTaskById: (id) => {
    return get().tasks.find(t => t.id === id);
  },

  getTasksByRecordId: (recordId) => {
    return get().tasks.filter(t => t.recordId === recordId);
  },

  getPendingTasks: () => {
    return get().tasks.filter(t => t.status === 'pending');
  },

  resetToMock: () => {
    set({ tasks: mockReviewTasks });
    storage.set('reviewTasks', mockReviewTasks);
  },
}));
