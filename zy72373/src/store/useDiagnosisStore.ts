import { create } from 'zustand';
import type {
  DiagnosisTask,
  SensorData,
  WorkPhoto,
  CorrectionRecord,
  OperationLog,
  TaskStatus,
} from '../types';
import { sampleTasks, demoTask, demoOperationLogs } from '../data/demoData';
import { TemperatureUnitDetector } from '../services/temperatureService';
import { ReportAutoUpdater } from '../services/reportService';

interface DiagnosisState {
  tasks: DiagnosisTask[];
  currentTaskId: string | null;
  operationLogs: OperationLog[];
  isDemoMode: boolean;

  getCurrentTask: () => DiagnosisTask | undefined;
  setCurrentTask: (taskId: string) => void;
  createNewTask: (title: string, createdBy: string) => DiagnosisTask;
  loadDemoData: () => void;
  importSensorData: (taskId: string, data: SensorData[]) => void;
  addPhoto: (taskId: string, photo: Omit<WorkPhoto, 'id' | 'diagnosisId'>) => void;
  addCorrection: (taskId: string, correction: Omit<CorrectionRecord, 'id' | 'diagnosisId'>) => void;
  rerunDiagnosis: (taskId: string) => void;
  updateTaskStatus: (taskId: string, status: TaskStatus, currentStep: number) => void;
  addOperationLog: (taskId: string, action: string, details: Record<string, unknown>, operator: string) => void;
  getTaskLogs: (taskId: string) => OperationLog[];
}

const generateId = () => Math.random().toString(36).substring(2, 10);

export const useDiagnosisStore = create<DiagnosisState>((set, get) => ({
  tasks: sampleTasks,
  currentTaskId: null,
  operationLogs: demoOperationLogs,
  isDemoMode: false,

  getCurrentTask: () => {
    const { tasks, currentTaskId } = get();
    return tasks.find(t => t.id === currentTaskId);
  },

  setCurrentTask: (taskId: string) => {
    set({ currentTaskId: taskId });
  },

  createNewTask: (title: string, createdBy: string) => {
    const newTask: DiagnosisTask = {
      id: `task-${generateId()}`,
      title,
      status: 'importing',
      currentStep: 1,
      sensorData: [],
      photos: [],
      corrections: [],
      report: null,
      hasUnitMixing: false,
      unitMixingInfo: null,
      createdAt: new Date().toISOString(),
      createdBy,
    };

    set(state => ({
      tasks: [...state.tasks, newTask],
      currentTaskId: newTask.id,
    }));

    get().addOperationLog(newTask.id, '创建诊断任务', { title }, createdBy);

    return newTask;
  },

  loadDemoData: () => {
    set({
      tasks: [demoTask],
      currentTaskId: 'demo-001',
      operationLogs: demoOperationLogs,
      isDemoMode: true,
    });
  },

  importSensorData: (taskId: string, data: SensorData[]) => {
    const markedData = TemperatureUnitDetector.markForReview(data);
    const mixingInfo = TemperatureUnitDetector.detectMixing(markedData);

    set(state => {
      const updatedTasks = state.tasks.map(task => {
        if (task.id === taskId) {
          const updatedTask = {
            ...task,
            sensorData: markedData,
            hasUnitMixing: mixingInfo.hasMixing,
            unitMixingInfo: mixingInfo,
            status: 'pending_review' as TaskStatus,
            currentStep: 1,
          };
          return {
            ...updatedTask,
            report: ReportAutoUpdater.generateInitialReport(updatedTask),
          };
        }
        return task;
      });

      return { tasks: updatedTasks };
    });

    get().addOperationLog(
      taskId,
      '导入传感器数据',
      { count: data.length, hasMixing: mixingInfo.hasMixing },
      '新人'
    );

    if (mixingInfo.hasMixing) {
      get().addOperationLog(
        taskId,
        '检测到温度单位混用',
        {
          celsiusCount: mixingInfo.celsiusCount,
          kelvinCount: mixingInfo.kelvinCount,
        },
        '系统'
      );
    }
  },

  addPhoto: (taskId: string, photo: Omit<WorkPhoto, 'id' | 'diagnosisId'>) => {
    const newPhoto: WorkPhoto = {
      ...photo,
      id: `photo-${generateId()}`,
      diagnosisId: taskId,
    };

    set(state => {
      const updatedTasks = state.tasks.map(task => {
        if (task.id === taskId) {
          const updatedTask = {
            ...task,
            photos: [...task.photos, newPhoto],
            status: 'photo_added' as TaskStatus,
            currentStep: 2,
          };
          return {
            ...updatedTask,
            report: ReportAutoUpdater.onPhotoAdded(updatedTask),
          };
        }
        return task;
      });

      return { tasks: updatedTasks };
    });

    get().addOperationLog(
      taskId,
      '补录工况照片',
      { filename: photo.filename, description: photo.description },
      photo.uploadBy
    );
  },

  addCorrection: (taskId: string, correction: Omit<CorrectionRecord, 'id' | 'diagnosisId'>) => {
    const newCorrection: CorrectionRecord = {
      ...correction,
      id: `correction-${generateId()}`,
      diagnosisId: taskId,
    };

    set(state => {
      const updatedTasks = state.tasks.map(task => {
        if (task.id === taskId) {
          const updatedSensorData = task.sensorData.map(data => {
            if (data.needsReview && correction.field === 'temperature') {
              return { ...data, needsReview: false };
            }
            return data;
          });

          const stillHasMixing = updatedSensorData.some(d => d.needsReview);

          const updatedTask = {
            ...task,
            sensorData: updatedSensorData,
            corrections: [...task.corrections, newCorrection],
            status: 'reviewing' as TaskStatus,
            hasUnitMixing: stillHasMixing,
            unitMixingInfo: stillHasMixing ? task.unitMixingInfo : null,
          };

          return {
            ...updatedTask,
            report: ReportAutoUpdater.onCorrectionMade(updatedTask),
          };
        }
        return task;
      });

      return { tasks: updatedTasks };
    });

    get().addOperationLog(
      taskId,
      '人工修正数据',
      {
        field: correction.field,
        oldValue: correction.oldValue,
        newValue: correction.newValue,
      },
      correction.correctedBy
    );
  },

  rerunDiagnosis: (taskId: string) => {
    set(state => {
      const updatedTasks = state.tasks.map(task => {
        if (task.id === taskId) {
          const updatedTask = {
            ...task,
            status: 'completed' as TaskStatus,
            currentStep: 3,
          };
          return {
            ...updatedTask,
            report: ReportAutoUpdater.onRerunComplete(updatedTask),
          };
        }
        return task;
      });

      return { tasks: updatedTasks };
    });

    get().addOperationLog(taskId, '重跑诊断', { status: 'success' }, '训练教练老唐');
    get().addOperationLog(taskId, '更新交接报告', { version: get().getCurrentTask()?.report?.version }, '系统');
  },

  updateTaskStatus: (taskId: string, status: TaskStatus, currentStep: number) => {
    set(state => ({
      tasks: state.tasks.map(task =>
        task.id === taskId ? { ...task, status, currentStep } : task
      ),
    }));
  },

  addOperationLog: (taskId: string, action: string, details: Record<string, unknown>, operator: string) => {
    const newLog: OperationLog = {
      id: `log-${generateId()}`,
      diagnosisId: taskId,
      action,
      details,
      operator,
      timestamp: new Date().toISOString(),
    };

    set(state => ({
      operationLogs: [...state.operationLogs, newLog],
    }));
  },

  getTaskLogs: (taskId: string) => {
    return get().operationLogs
      .filter(log => log.diagnosisId === taskId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  },
}));
