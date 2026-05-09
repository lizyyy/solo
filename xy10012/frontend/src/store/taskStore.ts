import { create } from 'zustand';
import { Task, taskApi, ApiError } from '../api';

interface TaskStore {
  tasks: Task[];
  selectedTask: Task | null;
  loading: boolean;
  error: ApiError | null;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  filters: {
    status?: string[];
    priority?: string[];
    assigneeId?: string;
    search?: string;
  };

  fetchTasks: (params?: Record<string, any>) => Promise<void>;
  fetchTask: (id: string) => Promise<void>;
  createTask: (data: Partial<Task>) => Promise<Task>;
  updateTask: (id: string, data: Partial<Task> & { expectedVersion: number }) => Promise<Task>;
  deleteTask: (id: string, reason?: string) => Promise<void>;
  setFilters: (filters: Partial<TaskStore['filters']>) => void;
  setSelectedTask: (task: Task | null) => void;
  clearError: () => void;
  updateTaskInList: (task: Task) => void;
  removeTaskFromList: (taskId: string) => void;
  addTaskToList: (task: Task) => void;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  selectedTask: null,
  loading: false,
  error: null,
  pagination: {
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  },
  filters: {},

  fetchTasks: async (params = {}) => {
    set({ loading: true, error: null });
    try {
      const { filters, pagination } = get();
      const response = await taskApi.list({
        ...filters,
        ...params,
        page: params.page || pagination.page,
        pageSize: params.pageSize || pagination.pageSize,
      });
      set({
        tasks: response.tasks,
        pagination: response.pagination,
        loading: false,
      });
    } catch (error: any) {
      set({
        error: error.response?.data || { error: 'UNKNOWN', message: error.message },
        loading: false,
      });
    }
  },

  fetchTask: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const response = await taskApi.get(id);
      set({
        selectedTask: response.data,
        loading: false,
      });
    } catch (error: any) {
      set({
        error: error.response?.data || { error: 'UNKNOWN', message: error.message },
        loading: false,
      });
    }
  },

  createTask: async (data: Partial<Task>) => {
    set({ loading: true, error: null });
    try {
      const response = await taskApi.create(data);
      if (!response.isDuplicate) {
        set((state) => ({
          tasks: [response.data, ...state.tasks],
          loading: false,
        }));
      }
      return response.data;
    } catch (error: any) {
      set({
        error: error.response?.data || { error: 'UNKNOWN', message: error.message },
        loading: false,
      });
      throw error;
    }
  },

  updateTask: async (id: string, data: Partial<Task> & { expectedVersion: number }) => {
    set({ loading: true, error: null });
    try {
      const response = await taskApi.update(id, data);
      set((state) => ({
        selectedTask: state.selectedTask?.id === id ? response.data : state.selectedTask,
        tasks: state.tasks.map((t) => (t.id === id ? response.data : t)),
        loading: false,
      }));
      return response.data;
    } catch (error: any) {
      set({
        error: error.response?.data || { error: 'UNKNOWN', message: error.message },
        loading: false,
      });
      throw error;
    }
  },

  deleteTask: async (id: string, reason?: string) => {
    set({ loading: true, error: null });
    try {
      await taskApi.delete(id, reason);
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
        selectedTask: state.selectedTask?.id === id ? null : state.selectedTask,
        loading: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data || { error: 'UNKNOWN', message: error.message },
        loading: false,
      });
      throw error;
    }
  },

  setFilters: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
      pagination: { ...state.pagination, page: 1 },
    }));
  },

  setSelectedTask: (task) => {
    set({ selectedTask: task });
  },

  clearError: () => {
    set({ error: null });
  },

  updateTaskInList: (task) => {
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === task.id ? task : t)),
      selectedTask: state.selectedTask?.id === task.id ? task : state.selectedTask,
    }));
  },

  removeTaskFromList: (taskId) => {
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== taskId),
      selectedTask: state.selectedTask?.id === taskId ? null : state.selectedTask,
    }));
  },

  addTaskToList: (task) => {
    set((state) => ({
      tasks: [task, ...state.tasks],
    }));
  },
}));