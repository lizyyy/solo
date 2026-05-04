import { create } from 'zustand';
import { 
  dataApi, 
  thresholdsApi, 
  anomaliesApi, 
  notesApi,
  reportApi,
  importApi 
} from '../services/api';

const useStore = create((set, get) => ({
  dateRange: {
    startDate: null,
    endDate: null,
  },
  
  summaryData: null,
  summaryLoading: false,
  summaryError: null,
  
  thresholds: [],
  thresholdsLoading: false,
  
  anomalies: [],
  anomaliesLoading: false,
  anomalyTypes: [],
  
  notes: {},
  notesLoading: false,
  
  workouts: [],
  workoutsLoading: false,
  
  calendarHeatmap: null,
  
  importHistory: [],
  importLoading: false,
  
  notification: null,
  
  setDateRange: (startDate, endDate) => {
    set({ dateRange: { startDate, endDate } });
  },
  
  fetchSummary: async (startDate, endDate) => {
    set({ summaryLoading: true, summaryError: null });
    try {
      const response = await dataApi.getSummary(startDate, endDate);
      set({ summaryData: response.data, summaryLoading: false });
      return response.data;
    } catch (error) {
      set({ 
        summaryLoading: false, 
        summaryError: error.message || '获取摘要失败' 
      });
      throw error;
    }
  },
  
  fetchThresholds: async (category) => {
    set({ thresholdsLoading: true });
    try {
      const response = await thresholdsApi.getAll(category);
      set({ thresholds: response.data, thresholdsLoading: false });
      return response.data;
    } catch (error) {
      set({ thresholdsLoading: false });
      throw error;
    }
  },
  
  saveThresholds: async (thresholds) => {
    try {
      await thresholdsApi.saveBatch(thresholds);
      set((state) => ({
        thresholds: [...state.thresholds, ...thresholds]
      }));
      get().showNotification('阈值已保存', 'success');
    } catch (error) {
      get().showNotification('保存阈值失败', 'error');
      throw error;
    }
  },
  
  resetThresholds: async (categories) => {
    try {
      await thresholdsApi.reset(categories);
      await get().fetchThresholds();
      get().showNotification('阈值已重置', 'success');
    } catch (error) {
      get().showNotification('重置阈值失败', 'error');
      throw error;
    }
  },
  
  fetchAnomalies: async (startDate, endDate, includeDismissed = false) => {
    set({ anomaliesLoading: true });
    try {
      const response = await anomaliesApi.getAll(startDate, endDate, includeDismissed);
      set({ anomalies: response.data, anomaliesLoading: false });
      return response.data;
    } catch (error) {
      set({ anomaliesLoading: false });
      throw error;
    }
  },
  
  fetchAnomalyTypes: async () => {
    try {
      const response = await anomaliesApi.getTypes();
      set({ anomalyTypes: response.data });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  
  runAnomalyDetection: async (startDate, endDate) => {
    try {
      await anomaliesApi.detect(startDate, endDate, true);
      await get().fetchAnomalies(startDate, endDate);
      get().showNotification('异常检测完成', 'success');
    } catch (error) {
      get().showNotification('异常检测失败', 'error');
      throw error;
    }
  },
  
  dismissAnomaly: async (id) => {
    try {
      await anomaliesApi.dismiss(id);
      set((state) => ({
        anomalies: state.anomalies.map(a => 
          a.id === id ? { ...a, dismissed: true } : a
        )
      }));
      get().showNotification('异常已忽略', 'success');
    } catch (error) {
      get().showNotification('操作失败', 'error');
      throw error;
    }
  },
  
  fetchNotes: async (startDate, endDate) => {
    set({ notesLoading: true });
    try {
      const response = await notesApi.getAll(startDate, endDate);
      const notesMap = {};
      response.data.forEach(note => {
        notesMap[note.date] = note;
      });
      set({ notes: notesMap, notesLoading: false });
      return response.data;
    } catch (error) {
      set({ notesLoading: false });
      throw error;
    }
  },
  
  saveNote: async (date, data) => {
    try {
      const response = await notesApi.save(date, data);
      set((state) => ({
        notes: {
          ...state.notes,
          [date]: response.data
        }
      }));
      get().showNotification('备注已保存', 'success');
      return response.data;
    } catch (error) {
      get().showNotification('保存备注失败', 'error');
      throw error;
    }
  },
  
  fetchWorkouts: async (startDate, endDate, type) => {
    set({ workoutsLoading: true });
    try {
      const response = await dataApi.getWorkouts(startDate, endDate, type);
      set({ workouts: response.data, workoutsLoading: false });
      return response.data;
    } catch (error) {
      set({ workoutsLoading: false });
      throw error;
    }
  },
  
  fetchCalendarHeatmap: async (startDate, endDate, metric) => {
    try {
      const response = await dataApi.getCalendarHeatmap(startDate, endDate, metric);
      set({ calendarHeatmap: response.data });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  
  fetchImportHistory: async (limit = 20, offset = 0) => {
    try {
      const response = await importApi.getHistory(limit, offset);
      set({ importHistory: response.data });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  
  uploadFiles: async (files, onProgress) => {
    set({ importLoading: true });
    try {
      let response;
      if (files.length === 1) {
        response = await importApi.uploadFile(files[0], onProgress);
      } else {
        response = await importApi.uploadMultiple(files);
      }
      set({ importLoading: false });
      await get().fetchImportHistory();
      get().showNotification('导入成功', 'success');
      return response.data;
    } catch (error) {
      set({ importLoading: false });
      get().showNotification('导入失败: ' + (error.message || '未知错误'), 'error');
      throw error;
    }
  },
  
  downloadReport: async (startDate, endDate, format) => {
    try {
      const response = await reportApi.downloadReport(startDate, endDate, format);
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `health-report-${startDate}-${endDate}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      get().showNotification('报告已下载', 'success');
    } catch (error) {
      get().showNotification('导出报告失败', 'error');
      throw error;
    }
  },
  
  showNotification: (message, type = 'info') => {
    set({ notification: { message, type, id: Date.now() } });
    setTimeout(() => {
      set((state) => ({
        notification: state.notification?.id === Date.now() ? null : state.notification
      }));
    }, 3000);
  },
  
  clearNotification: () => {
    set({ notification: null });
  },
}));

export default useStore;
