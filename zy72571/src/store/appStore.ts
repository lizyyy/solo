import { create } from 'zustand';
import { 
  AppState, 
  AppAction, 
  ThresholdNote, 
  AnomalySample, 
  HistoryRecord,
  ToastMessage 
} from '@/types';
import { 
  initialThresholdNotes, 
  initialExperiments, 
  initialAnomalies, 
  initialHistory,
  demoDataBundle 
} from '@/data/mockData';

const generateId = () => Math.random().toString(36).substring(2, 11);

const initialState: AppState = {
  thresholdNotes: initialThresholdNotes,
  experiments: initialExperiments,
  anomalies: initialAnomalies,
  history: initialHistory,
  currentStep: 0,
  selectedSampleId: undefined,
  toasts: [],
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'IMPORT_NOTES': {
      const newNotes = action.payload;
      const newAnomalies: AnomalySample[] = [];
      const newHistory: HistoryRecord[] = [];
      
      newNotes.forEach(note => {
        newHistory.push({
          id: generateId(),
          action: '导入调参笔记',
          operator: note.operator,
          targetId: note.id,
          targetType: 'note',
          detail: `导入批次 ${note.batchId}，阈值 ${note.threshold}`,
          timestamp: new Date().toISOString(),
        });
        
        if (note.crossesTimeWindow) {
          const anomaly: AnomalySample = {
            id: generateId(),
            noteId: note.id,
            type: 'time_window',
            description: '检测到这条记录跨了时间窗统计周期，效果可能虚高，需要负责人复核',
            status: 'pending_review',
            createdAt: new Date().toISOString(),
            noteData: note,
          };
          newAnomalies.push(anomaly);
          
          newHistory.push({
            id: generateId(),
            action: '检测到异常',
            operator: '系统',
            targetId: anomaly.id,
            targetType: 'anomaly',
            detail: `批次 ${note.batchId} 跨时间窗，已标记待复核`,
            timestamp: new Date().toISOString(),
          });
        }
      });
      
      return {
        ...state,
        thresholdNotes: [...state.thresholdNotes, ...newNotes],
        anomalies: [...state.anomalies, ...newAnomalies],
        history: [...state.history, ...newHistory],
        currentStep: state.currentStep < 1 ? 1 : state.currentStep,
      };
    }
    
    case 'IMPORT_FROM_EXPERIMENT': {
      const experiment = state.experiments.find(e => e.id === action.payload);
      if (!experiment || experiment.imported) return state;
      
      const newNote: ThresholdNote = {
        id: generateId(),
        batchId: `EXP-${experiment.caliberVersion}`,
        threshold: experiment.threshold,
        wakeRate: experiment.wakeRate,
        falseAlarmRate: experiment.falseAlarmRate,
        timeWindowStart: '线上历史数据',
        timeWindowEnd: '线上历史数据',
        crossesTimeWindow: false,
        status: experiment.isOldCaliber ? 'old_caliber' : 'normal',
        createdAt: new Date().toISOString(),
        operator: '小孟',
        source: 'experiment',
        caliberVersion: experiment.caliberVersion,
      };
      
      const anomaly: AnomalySample | null = experiment.isOldCaliber ? {
        id: generateId(),
        noteId: newNote.id,
        type: 'old_caliber',
        description: `该数据来自旧口径 ${experiment.caliberVersion}，请注意口径差异`,
        status: 'pending_review',
        createdAt: new Date().toISOString(),
        noteData: newNote,
      } : null;
      
      const newHistory: HistoryRecord[] = [
        {
          id: generateId(),
          action: '从实验桶补录',
          operator: '小孟',
          targetId: experiment.id,
          targetType: 'experiment',
          detail: `从实验 "${experiment.experimentName}" 补录数据，口径 ${experiment.caliberVersion}`,
          timestamp: new Date().toISOString(),
        },
      ];
      
      if (anomaly) {
        newHistory.push({
          id: generateId(),
          action: '标记旧口径',
          operator: '系统',
          targetId: anomaly.id,
          targetType: 'anomaly',
          detail: `旧口径数据 ${experiment.caliberVersion} 已标记`,
          timestamp: new Date().toISOString(),
        });
      }
      
      return {
        ...state,
        thresholdNotes: [...state.thresholdNotes, newNote],
        experiments: state.experiments.map(e => 
          e.id === action.payload ? { ...e, imported: true } : e
        ),
        anomalies: anomaly ? [...state.anomalies, anomaly] : state.anomalies,
        history: [...state.history, ...newHistory],
        currentStep: state.currentStep < 2 ? 2 : state.currentStep,
      };
    }
    
    case 'UPDATE_ANOMALY_STATUS': {
      return {
        ...state,
        anomalies: state.anomalies.map(a =>
          a.id === action.payload.id
            ? { ...a, status: action.payload.status, reviewer: action.payload.reviewer, reviewComment: action.payload.comment }
            : a
        ),
      };
    }
    
    case 'SUBMIT_FOR_REVIEW': {
      const anomaly = state.anomalies.find(a => a.id === action.payload);
      return {
        ...state,
        anomalies: state.anomalies.map(a =>
          a.id === action.payload ? { ...a, status: 'pending_review' } : a
        ),
        history: [...state.history, {
          id: generateId(),
          action: '提交复核',
          operator: '小孟',
          targetId: action.payload,
          targetType: 'anomaly',
          detail: `提交异常样本给负责人复核`,
          timestamp: new Date().toISOString(),
        }],
        currentStep: state.currentStep < 3 ? 3 : state.currentStep,
      };
    }
    
    case 'REVIEW_ANOMALY': {
      const { id, passed, comment, reviewer } = action.payload;
      const newStatus = passed ? 'reviewed' : 'rejected';
      
      return {
        ...state,
        anomalies: state.anomalies.map(a =>
          a.id === id ? { ...a, status: newStatus, reviewer, reviewComment: comment } : a
        ),
        history: [...state.history, {
          id: generateId(),
          action: passed ? '复核通过' : '复核驳回',
          operator: reviewer,
          targetId: id,
          targetType: 'anomaly',
          detail: comment || (passed ? '复核通过' : '复核驳回'),
          timestamp: new Date().toISOString(),
        }],
      };
    }
    
    case 'SET_CURRENT_STEP':
      return { ...state, currentStep: action.payload };
    
    case 'SELECT_SAMPLE':
      return { ...state, selectedSampleId: action.payload };
    
    case 'ADD_HISTORY':
      return { ...state, history: [...state.history, action.payload] };
    
    case 'ADD_TOAST': {
      const exists = state.toasts.find(t => t.message === action.payload.message);
      if (exists) return state;
      return { ...state, toasts: [...state.toasts, action.payload] };
    }
    
    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter(t => t.id !== action.payload) };
    
    case 'RERUN_CALIBRATION': {
      return {
        ...state,
        history: [...state.history, {
          id: generateId(),
          action: '重跑校准',
          operator: '小孟',
          targetId: 'calibration',
          targetType: 'note',
          detail: '重新运行校准计算，更新效果数据已更新',
          timestamp: new Date().toISOString(),
        }],
      };
    }
    
    case 'RESET_DEMO':
      return { ...initialState, history: [...initialHistory] };
    
    default:
      return state;
  }
}

export const useAppStore = create<AppState & {
  dispatch: (action: AppAction) => void;
  importDemoData: () => void;
  importFromExperiment: (expId: string) => void;
  submitForReview: (anomalyId: string) => void;
  reviewAnomaly: (anomalyId: string, passed: boolean, comment: string, reviewer: string) => void;
  rerunCalibration: () => void;
  showToast: (type: ToastMessage['type'], message: string) => void;
  removeToast: (id: string) => void;
  resetDemo: () => void;
}>((set, get) => ({
  ...initialState,
  
  dispatch: (action) => set(state => appReducer(state, action)),
  
  importDemoData: () => {
    const { dispatch, showToast } = get();
    const { normalNote, timeWindowNote } = demoDataBundle;
    
    dispatch({
      type: 'IMPORT_NOTES',
      payload: [normalNote, timeWindowNote],
    });
    
    showToast('success', '调参笔记导入成功！检测到1条时间窗穿越记录');
  },
  
  importFromExperiment: (expId: string) => {
    const { dispatch, experiments, showToast } = get();
    const exp = experiments.find(e => e.id === expId);
    
    if (exp?.imported) {
      showToast('warning', '这条旧口径数据已经补录过了，不用重复添加哦');
      return;
    }
    
    dispatch({ type: 'IMPORT_FROM_EXPERIMENT', payload: expId });
    showToast('success', exp?.isOldCaliber ? '旧口径数据补录成功，已标记为待复核' : '实验数据补录成功');
  },
  
  submitForReview: (anomalyId: string) => {
    const { dispatch, showToast } = get();
    dispatch({ type: 'SUBMIT_FOR_REVIEW', payload: anomalyId });
    showToast('success', '已提交给实验平台负责人复核');
  },
  
  reviewAnomaly: (anomalyId: string, passed: boolean, comment: string, reviewer: string) => {
    const { dispatch, showToast } = get();
    dispatch({ type: 'REVIEW_ANOMALY', payload: { id: anomalyId, passed, comment, reviewer } });
    showToast('success', passed ? '复核通过，数据已确认' : '已驳回，请重新处理');
  },
  
  rerunCalibration: () => {
    const { dispatch, thresholdNotes, showToast } = get();
    
    if (thresholdNotes.length < 2) {
      showToast('error', '还缺少一些必要数据，先补全调参笔记再重跑吧');
      return;
    }
    
    dispatch({ type: 'RERUN_CALIBRATION' });
    showToast('success', '校准重跑完成！请查看历史记录对比效果');
  },
  
  showToast: (type, message) => {
    const id = generateId();
    set(state => ({ toasts: [...state.toasts, { id, type, message }] }));
    setTimeout(() => {
      set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
    }, 4000);
  },
  
  removeToast: (id) => {
    set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
  },
  
  resetDemo: () => {
    set({ ...initialState, history: [...initialHistory] });
  },
}));
