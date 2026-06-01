import { create } from 'zustand';
import type { 
  RawData, 
  ProcessedData, 
  FittingResult, 
  QualityIssue, 
  PreprocessConfig,
  FittingModel 
} from '../types';
import { mockRawData, mockProcessedData } from '../data/mockData';
import { runFullPreprocess, addJudgment } from '../services/dataPreprocess';
import { fitModel, suggestBestModel } from '../services/fittingAlgorithm';
import { calculateWeightClosure, checkBoundaryThreshold } from '../services/weightBoundary';
import { runAllQualityChecks } from '../services/anomalyDetection';
import { saveToStorage, loadFromStorage } from '../utils/storage';

interface DataState {
  rawData: RawData[];
  processedData: ProcessedData[];
  fittingResult: FittingResult | null;
  qualityIssues: QualityIssue[];
  preprocessConfig: PreprocessConfig;
  selectedModel: FittingModel;
  selectedDataId: string | null;
  isTracePanelOpen: boolean;
  weightClosureStatus: { value: number; status: 'normal' | 'warning' | 'error'; message: string } | null;
  boundaryStatus: { 
    minStress: number; 
    maxStress: number; 
    outOfBounds: string[];
    status: 'normal' | 'warning' | 'error';
    message: string;
  } | null;
  currentStep: 'import' | 'preprocess' | 'fitting' | 'report';

  setRawData: (data: RawData[]) => void;
  setProcessedData: (data: ProcessedData[]) => void;
  setFittingResult: (result: FittingResult | null) => void;
  setWeightClosureStatus: (status: DataState['weightClosureStatus']) => void;
  setBoundaryStatus: (status: DataState['boundaryStatus']) => void;
  setPreprocessConfig: (config: Partial<PreprocessConfig>) => void;
  setSelectedModel: (model: FittingModel) => void;
  setSelectedDataId: (id: string | null) => void;
  setTracePanelOpen: (open: boolean) => void;
  setCurrentStep: (step: 'import' | 'preprocess' | 'fitting' | 'report') => void;

  loadMockData: () => void;
  runPreprocess: () => void;
  runFitting: () => void;
  autoSelectBestModel: () => void;
  confirmDataStatus: (dataId: string, status: ProcessedData['status'], judgment: string, judge: string) => void;
  updateDataItem: (dataId: string, updates: Partial<ProcessedData>) => void;
  saveCurrentState: () => void;
  loadSavedState: () => boolean;
  resetAll: () => void;
}

export const useDataStore = create<DataState>((set, get) => ({
  rawData: [],
  processedData: [],
  fittingResult: null,
  qualityIssues: [],
  preprocessConfig: {
    targetStressUnit: 'MPa',
    targetLifeUnit: '次',
    testFrequency: 10,
    fillNullStrategy: 'manual',
    mergeDuplicateStrategy: 'keep_first',
    anomalyThreshold: 1.5,
  },
  selectedModel: 'power',
  selectedDataId: null,
  isTracePanelOpen: false,
  weightClosureStatus: null,
  boundaryStatus: null,
  currentStep: 'import',

  setRawData: (data) => set({ rawData: data }),
  setProcessedData: (data) => set({ processedData: data }),
  setFittingResult: (result) => set({ fittingResult: result }),
  setWeightClosureStatus: (status) => set({ weightClosureStatus: status }),
  setBoundaryStatus: (status) => set({ boundaryStatus: status }),
  setPreprocessConfig: (config) => set(state => ({
    preprocessConfig: { ...state.preprocessConfig, ...config },
  })),
  setSelectedModel: (model) => set({ selectedModel: model }),
  setSelectedDataId: (id) => set({ selectedDataId: id, isTracePanelOpen: id !== null }),
  setTracePanelOpen: (open) => set({ isTracePanelOpen: open, selectedDataId: open ? get().selectedDataId : null }),
  setCurrentStep: (step) => set({ currentStep: step }),

  loadMockData: () => {
    const config = get().preprocessConfig;
    const result = runFullPreprocess(mockRawData, config);
    set({
      rawData: mockRawData,
      processedData: result.processedData,
      qualityIssues: result.qualityIssues,
      currentStep: 'preprocess',
    });
  },

  runPreprocess: () => {
    const { rawData, preprocessConfig } = get();
    if (rawData.length === 0) return;
    
    const result = runFullPreprocess(rawData, preprocessConfig);
    set({
      processedData: result.processedData,
      qualityIssues: result.qualityIssues,
      currentStep: 'preprocess',
    });
  },

  runFitting: () => {
    const { processedData, selectedModel, preprocessConfig } = get();
    
    const validData = processedData.filter(d => 
      d.stressConverted !== null && 
      d.lifeConverted !== null && 
      !d.isNull
    );

    if (validData.length < 3) return;

    const baseResult = fitModel(validData, selectedModel);
    const weightResult = calculateWeightClosure(baseResult.points);
    
    const fullFittingResult: FittingResult = {
      ...baseResult,
      weightClosure: weightResult.value,
      boundaryCheck: {
        minStress: 0,
        maxStress: 0,
        outOfBounds: [],
      },
    };

    const boundaryResult = checkBoundaryThreshold(processedData, fullFittingResult);
    fullFittingResult.boundaryCheck = {
      minStress: boundaryResult.minStress,
      maxStress: boundaryResult.maxStress,
      outOfBounds: boundaryResult.outOfBounds,
    };

    set({
      fittingResult: fullFittingResult,
      weightClosureStatus: weightResult,
      boundaryStatus: boundaryResult,
      currentStep: 'fitting',
    });
  },

  autoSelectBestModel: () => {
    const { processedData } = get();
    const validData = processedData.filter(d => 
      d.stressConverted !== null && 
      d.lifeConverted !== null && 
      !d.isNull
    );
    
    if (validData.length < 3) return;

    const { model } = suggestBestModel(validData);
    set({ selectedModel: model });
    get().runFitting();
  },

  confirmDataStatus: (dataId, status, judgment, judge) => {
    set(state => ({
      processedData: state.processedData.map(item => {
        if (item.id === dataId) {
          return addJudgment(item, status, judgment, judge, '人工确认');
        }
        return item;
      }),
    }));
  },

  updateDataItem: (dataId, updates) => {
    set(state => ({
      processedData: state.processedData.map(item => 
        item.id === dataId ? { ...item, ...updates } : item
      ),
    }));
  },

  saveCurrentState: () => {
    const { processedData, fittingResult, preprocessConfig } = get();
    saveToStorage(processedData, fittingResult, preprocessConfig);
  },

  loadSavedState: () => {
    const saved = loadFromStorage();
    if (saved) {
      set({
        processedData: saved.processedData,
        fittingResult: saved.fittingResult,
        preprocessConfig: saved.preprocessConfig,
      });
      return true;
    }
    return false;
  },

  resetAll: () => {
    set({
      rawData: [],
      processedData: [],
      fittingResult: null,
      qualityIssues: [],
      selectedDataId: null,
      isTracePanelOpen: false,
      weightClosureStatus: null,
      boundaryStatus: null,
      currentStep: 'import',
    });
  },
}));
