import { create } from 'zustand';
import { produce } from 'immer';
import {
  OrderBookSnapshot,
  Cube3D,
  DataRange,
  ProcessingStats,
  DataProcessingConfig,
} from '../types/data';
import { Anomaly, AnomalyDetectionResult } from '../types/anomaly';
import { DataProcessor } from '../engine/dataProcessor';
import { AnomalyDetector } from '../engine/anomalyDetector';

interface DataState {
  rawSnapshots: OrderBookSnapshot[];
  processedSnapshots: OrderBookSnapshot[];
  cubes: Cube3D[];
  dataRange: DataRange | null;
  timeRange: { min: number; max: number } | null;
  priceRange: { min: number; max: number } | null;
  quantityRange: { min: number; max: number } | null;
  processingStats: ProcessingStats | null;
  anomalies: Anomaly[];
  anomalyStats: AnomalyDetectionResult['stats'] | null;
  selectedCubeId: string | null;
  selectedCube: Cube3D | null;
  highlightedCubeIds: string[];
  currentTimeIndex: number;
  isPlaying: boolean;
  playSpeed: number;
  playbackSpeed: number;
  visibleLevels: number[];
  showBids: boolean;
  showAsks: boolean;
  showBid: boolean;
  showAsk: boolean;
  showAnomalies: boolean;
  processingConfig: DataProcessingConfig;
  isLoading: boolean;
  error: string | null;
  warnings: string[];

  setRawSnapshots: (snapshots: OrderBookSnapshot[], externalAnomalies?: Anomaly[]) => void;
  setProcessedSnapshots: (snapshots: OrderBookSnapshot[]) => void;
  setCubes: (cubes: Cube3D[]) => void;
  setAnomalies: (anomalies: Anomaly[]) => void;
  setDataRange: (range: DataRange | null) => void;
  setTimeRange: (range: { min: number; max: number } | null) => void;
  setPriceRange: (range: { min: number; max: number } | null) => void;
  setQuantityRange: (range: { min: number; max: number } | null) => void;
  processData: () => void;
  detectAnomalies: () => void;
  selectCube: (cube: Cube3D | string | null) => void;
  highlightCubes: (cubeIds: string[]) => void;
  setCurrentTimeIndex: (index: number | ((prev: number) => number)) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaySpeed: (speed: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  toggleLevel: (level: number) => void;
  setShowBids: (show: boolean) => void;
  setShowAsks: (show: boolean) => void;
  setShowBid: (show: boolean) => void;
  setShowAsk: (show: boolean) => void;
  setShowAnomalies: (show: boolean) => void;
  updateProcessingConfig: (config: Partial<DataProcessingConfig>) => void;
  getCubeById: (id: string) => Cube3D | undefined;
  getSnapshotById: (id: string) => OrderBookSnapshot | undefined;
  getAnomaliesForCube: (cubeId: string) => Anomaly[];
  filterCubesByTime: (startIndex: number, endIndex: number) => Cube3D[];
  clearData: () => void;
}

export const useDataStore = create<DataState>((set, get) => ({
  rawSnapshots: [],
  processedSnapshots: [],
  cubes: [],
  dataRange: null,
  timeRange: null,
  priceRange: null,
  quantityRange: null,
  processingStats: null,
  anomalies: [],
  anomalyStats: null,
  selectedCubeId: null,
  selectedCube: null,
  highlightedCubeIds: [],
  currentTimeIndex: 0,
  isPlaying: false,
  playSpeed: 1,
  playbackSpeed: 1,
  visibleLevels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  showBids: true,
  showAsks: true,
  showBid: true,
  showAsk: true,
  showAnomalies: true,
  processingConfig: {
    tickSize: 1,
    expectedInterval: 500,
    priceLevels: 10,
    handleNullValues: 'interpolate',
    handleDuplicates: 'keep_first',
    outlierSigma: 3,
  },
  isLoading: false,
  error: null,
  warnings: [],

  setRawSnapshots: (snapshots: OrderBookSnapshot[], externalAnomalies: Anomaly[] = []) => {
    set(
      produce((state: DataState) => {
        state.rawSnapshots = snapshots;
        state.anomalies = externalAnomalies;
        state.currentTimeIndex = 0;
        state.selectedCubeId = null;
        state.selectedCube = null;
        state.highlightedCubeIds = [];
      })
    );
    get().processData();
  },

  setProcessedSnapshots: (snapshots: OrderBookSnapshot[]) => {
    set({ processedSnapshots: snapshots });
  },

  setCubes: (cubes: Cube3D[]) => {
    set({ cubes });
  },

  setAnomalies: (anomalies: Anomaly[]) => {
    set({ anomalies });
  },

  setDataRange: (range: DataRange | null) => {
    set({ dataRange: range });
  },

  setTimeRange: (range: { min: number; max: number } | null) => {
    set({ timeRange: range });
  },

  setPriceRange: (range: { min: number; max: number } | null) => {
    set({ priceRange: range });
  },

  setQuantityRange: (range: { min: number; max: number } | null) => {
    set({ quantityRange: range });
  },

  processData: () => {
    set(
      produce((state: DataState) => {
        state.isLoading = true;
        state.error = null;
      })
    );

    try {
      const { rawSnapshots, anomalies, processingConfig } = get();
      
      if (rawSnapshots.length === 0) {
        set(
          produce((state: DataState) => {
            state.isLoading = false;
            state.error = '没有数据可处理';
          })
        );
        return;
      }

      const processor = new DataProcessor(processingConfig);
      const result = processor.process(rawSnapshots, anomalies);

      set(
        produce((state: DataState) => {
          state.processedSnapshots = result.snapshots;
          state.cubes = result.cubes;
          state.dataRange = result.dataRange;
          state.timeRange = {
            min: result.dataRange.minTime,
            max: result.dataRange.maxTime,
          };
          state.priceRange = {
            min: result.dataRange.minPrice,
            max: result.dataRange.maxPrice,
          };
          state.quantityRange = {
            min: result.dataRange.minQuantity,
            max: result.dataRange.maxQuantity,
          };
          state.processingStats = result.stats;
          state.isLoading = false;
        })
      );

      get().detectAnomalies();
    } catch (error) {
      set(
        produce((state: DataState) => {
          state.isLoading = false;
          state.error = error instanceof Error ? error.message : '数据处理失败';
        })
      );
    }
  },

  detectAnomalies: () => {
    try {
      const { processedSnapshots, processingConfig } = get();
      
      if (processedSnapshots.length === 0) return;

      const detector = new AnomalyDetector({}, processingConfig);
      const result = detector.detect(processedSnapshots);

      set(
        produce((state: DataState) => {
          state.anomalies = [...state.anomalies, ...result.anomalies];
          state.anomalyStats = result.stats;
        })
      );

      const { cubes, dataRange } = get();
      if (cubes.length > 0 && dataRange) {
        const processor = new DataProcessor(processingConfig);
        const updatedCubes = processor.updateCubeColors(cubes, dataRange);
        
        set(
          produce((state: DataState) => {
            state.cubes = updatedCubes;
          })
        );
      }
    } catch (error) {
      console.error('异常检测失败:', error);
    }
  },

  selectCube: (cube: Cube3D | string | null) => {
    set(
      produce((state: DataState) => {
        if (cube === null) {
          state.selectedCubeId = null;
          state.selectedCube = null;
          state.cubes = state.cubes.map(c => ({
            ...c,
            isSelected: false,
          }));
        } else if (typeof cube === 'string') {
          state.selectedCubeId = cube;
          state.selectedCube = state.cubes.find(c => c.id === cube) || null;
          state.cubes = state.cubes.map(c => ({
            ...c,
            isSelected: c.id === cube,
          }));
        } else {
          state.selectedCubeId = cube.id;
          state.selectedCube = cube;
          state.cubes = state.cubes.map(c => ({
            ...c,
            isSelected: c.id === cube.id,
          }));
        }
      })
    );
  },

  highlightCubes: (cubeIds: string[]) => {
    set(
      produce((state: DataState) => {
        state.highlightedCubeIds = cubeIds;
        state.cubes = state.cubes.map(cube => ({
          ...cube,
          isHighlighted: cubeIds.includes(cube.id) || cube.isAnomaly,
        }));
      })
    );
  },

  setCurrentTimeIndex: (index: number | ((prev: number) => number)) => {
    set(
      produce((state: DataState) => {
        const maxIndex = state.processedSnapshots.length - 1;
        if (typeof index === 'function') {
          const newIndex = index(state.currentTimeIndex);
          state.currentTimeIndex = Math.max(0, Math.min(newIndex, maxIndex));
        } else {
          state.currentTimeIndex = Math.max(0, Math.min(index, maxIndex));
        }
      })
    );
  },

  setIsPlaying: (playing: boolean) => {
    set({ isPlaying: playing });
  },

  setPlaySpeed: (speed: number) => {
    set({ playSpeed: speed, playbackSpeed: speed });
  },

  setPlaybackSpeed: (speed: number) => {
    set({ playSpeed: speed, playbackSpeed: speed });
  },

  toggleLevel: (level: number) => {
    set(
      produce((state: DataState) => {
        const index = state.visibleLevels.indexOf(level);
        if (index > -1) {
          state.visibleLevels.splice(index, 1);
        } else {
          state.visibleLevels.push(level);
          state.visibleLevels.sort((a, b) => a - b);
        }
      })
    );
  },

  setShowBids: (show: boolean) => {
    set({ showBids: show, showBid: show });
  },

  setShowAsks: (show: boolean) => {
    set({ showAsks: show, showAsk: show });
  },

  setShowBid: (show: boolean) => {
    set({ showBid: show, showBids: show });
  },

  setShowAsk: (show: boolean) => {
    set({ showAsk: show, showAsks: show });
  },

  setShowAnomalies: (show: boolean) => {
    set({ showAnomalies: show });
  },

  updateProcessingConfig: (config: Partial<DataProcessingConfig>) => {
    set(
      produce((state: DataState) => {
        state.processingConfig = { ...state.processingConfig, ...config };
      })
    );
  },

  getCubeById: (id: string) => {
    return get().cubes.find(c => c.id === id);
  },

  getSnapshotById: (id: string) => {
    return get().processedSnapshots.find(s => s.id === id);
  },

  getAnomaliesForCube: (cubeId: string) => {
    const cube = get().getCubeById(cubeId);
    if (!cube) return [];
    
    return get().anomalies.filter(
      a => a.dataPoint.timestamp === cube.timestamp && a.dataPoint.level === cube.level
    );
  },

  filterCubesByTime: (startIndex: number, endIndex: number) => {
    const { cubes, processedSnapshots } = get();
    if (processedSnapshots.length === 0) return [];
    
    const startTime = processedSnapshots[Math.max(0, startIndex)]?.timestamp ?? 0;
    const endTime = processedSnapshots[Math.min(processedSnapshots.length - 1, endIndex)]?.timestamp ?? Infinity;
    
    return cubes.filter(c => c.timestamp >= startTime && c.timestamp <= endTime);
  },

  clearData: () => {
    set({
      rawSnapshots: [],
      processedSnapshots: [],
      cubes: [],
      dataRange: null,
      timeRange: null,
      priceRange: null,
      quantityRange: null,
      processingStats: null,
      anomalies: [],
      anomalyStats: null,
      selectedCubeId: null,
      selectedCube: null,
      highlightedCubeIds: [],
      currentTimeIndex: 0,
      isPlaying: false,
      isLoading: false,
      error: null,
      warnings: [],
    });
  },
}));
