import { create } from 'zustand';
import { 
  tasksApi, 
  contextApi, 
  strategiesApi, 
  evaluationsApi,
  reportsApi 
} from '../api/client';

const useAppStore = create((set, get) => ({
  tasks: [],
  currentTask: null,
  strategies: [],
  currentContextPackage: null,
  currentEvaluation: null,
  evaluations: [],
  reports: [],
  loading: false,
  error: null,
  notification: null,

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setNotification: (notification) => set({ notification }),
  clearNotification: () => set({ notification: null }),

  fetchTasks: async () => {
    set({ loading: true, error: null });
    try {
      const response = await tasksApi.getAll();
      set({ tasks: response.data.data?.tasks || [], loading: false });
    } catch (error) {
      set({ 
        error: error.response?.data?.error || 'Failed to fetch tasks', 
        loading: false 
      });
    }
  },

  createTask: async (data) => {
    set({ loading: true, error: null });
    try {
      const response = await tasksApi.create(data);
      const newTask = response.data.data;
      set((state) => ({ 
        tasks: [newTask, ...state.tasks],
        loading: false,
        notification: { type: 'success', message: 'Task created successfully' }
      }));
      return newTask;
    } catch (error) {
      set({ 
        error: error.response?.data?.error || 'Failed to create task', 
        loading: false 
      });
      throw error;
    }
  },

  setCurrentTask: (task) => set({ currentTask: task }),

  fetchStrategies: async () => {
    set({ loading: true, error: null });
    try {
      const response = await strategiesApi.getAll();
      set({ strategies: response.data.data || [], loading: false });
    } catch (error) {
      set({ 
        error: error.response?.data?.error || 'Failed to fetch strategies', 
        loading: false 
      });
    }
  },

  uploadContext: async (formData) => {
    set({ loading: true, error: null });
    try {
      const response = await contextApi.upload(formData);
      const contextPackage = response.data.data;
      set({ 
        currentContextPackage: contextPackage,
        loading: false,
        notification: { type: 'success', message: 'Context uploaded successfully' }
      });
      return contextPackage;
    } catch (error) {
      set({ 
        error: error.response?.data?.error || 'Failed to upload context', 
        loading: false 
      });
      throw error;
    }
  },

  fetchContextPackage: async (id) => {
    set({ loading: true, error: null });
    try {
      const response = await contextApi.getById(id);
      set({ 
        currentContextPackage: response.data.data,
        loading: false 
      });
      return response.data.data;
    } catch (error) {
      set({ 
        error: error.response?.data?.error || 'Failed to fetch context package', 
        loading: false 
      });
      throw error;
    }
  },

  setCurrentContextPackage: (contextPackage) => 
    set({ currentContextPackage: contextPackage }),

  runEvaluation: async (data) => {
    set({ loading: true, error: null });
    try {
      const response = await evaluationsApi.run(data);
      const evaluation = response.data.data.evaluation;
      set((state) => ({
        currentEvaluation: evaluation,
        evaluations: [evaluation, ...state.evaluations],
        loading: false,
        notification: { type: 'success', message: 'Evaluation completed successfully' }
      }));
      return evaluation;
    } catch (error) {
      set({ 
        error: error.response?.data?.error || 'Failed to run evaluation', 
        loading: false 
      });
      throw error;
    }
  },

  runDryEvaluation: async (data) => {
    set({ loading: true, error: null });
    try {
      const response = await evaluationsApi.runDry(data);
      set({ loading: false });
      return response.data.data;
    } catch (error) {
      set({ 
        error: error.response?.data?.error || 'Failed to run dry evaluation', 
        loading: false 
      });
      throw error;
    }
  },

  compareStrategies: async (data) => {
    set({ loading: true, error: null });
    try {
      const response = await evaluationsApi.compare(data);
      set({ loading: false });
      return response.data.data;
    } catch (error) {
      set({ 
        error: error.response?.data?.error || 'Failed to compare strategies', 
        loading: false 
      });
      throw error;
    }
  },

  fetchEvaluations: async (params = {}) => {
    set({ loading: true, error: null });
    try {
      const response = await evaluationsApi.getAll(params);
      set({ evaluations: response.data.data || [], loading: false });
    } catch (error) {
      set({ 
        error: error.response?.data?.error || 'Failed to fetch evaluations', 
        loading: false 
      });
    }
  },

  setCurrentEvaluation: (evaluation) => 
    set({ currentEvaluation: evaluation }),

  updateEvaluation: async (id, data) => {
    try {
      const response = await evaluationsApi.update(id, data);
      const updatedEvaluation = response.data.data;
      set((state) => ({
        currentEvaluation: state.currentEvaluation?.id === id 
          ? updatedEvaluation 
          : state.currentEvaluation,
        evaluations: state.evaluations.map(e => 
          e.id === id ? updatedEvaluation : e
        ),
        notification: { type: 'success', message: 'Evaluation updated successfully' }
      }));
      return updatedEvaluation;
    } catch (error) {
      set({ 
        error: error.response?.data?.error || 'Failed to update evaluation' 
      });
      throw error;
    }
  },

  generateReport: async (data) => {
    set({ loading: true, error: null });
    try {
      const response = await reportsApi.generate(data);
      const report = response.data.data;
      set((state) => ({
        reports: [report, ...state.reports],
        loading: false,
        notification: { type: 'success', message: 'Report generated successfully' }
      }));
      return report;
    } catch (error) {
      set({ 
        error: error.response?.data?.error || 'Failed to generate report', 
        loading: false 
      });
      throw error;
    }
  },

  reset: () => set({
    currentTask: null,
    currentContextPackage: null,
    currentEvaluation: null,
    error: null
  })
}));

export default useAppStore;
