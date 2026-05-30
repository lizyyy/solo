import { create } from 'zustand';
import type { PipelineSegment, LayerVisibility } from '../types';
import { pipelineSegments as mockSegments } from '../data/pipelines';
import { logger } from '../utils/logger';

interface PipelineState {
  segments: PipelineSegment[];
  originalSegments: PipelineSegment[];
  selectedSegment: PipelineSegment | null;
  visibility: LayerVisibility;
  transparency: number;
  isLoading: boolean;
  loadData: () => Promise<void>;
  setSelectedSegment: (segment: PipelineSegment | null) => void;
  setVisibility: (layer: keyof LayerVisibility, visible: boolean) => void;
  setTransparency: (value: number) => void;
  resetData: () => void;
}

export const usePipelineStore = create<PipelineState>((set, get) => ({
  segments: [],
  originalSegments: [],
  selectedSegment: null,
  visibility: {
    water: true,
    electric: true,
    gas: true,
    collision: true,
    pileNo: true,
    grid: true,
  },
  transparency: 0.85,
  isLoading: false,

  loadData: async () => {
    logger.info('data', '开始加载管线数据');
    set({ isLoading: true });

    try {
      await new Promise((resolve) => setTimeout(resolve, 300));

      const segments = JSON.parse(JSON.stringify(mockSegments));
      set({
        segments,
        originalSegments: JSON.parse(JSON.stringify(mockSegments)),
        isLoading: false,
      });

      logger.info('data', '管线数据加载完成', { count: segments.length });
    } catch (error) {
      logger.error('data', '管线数据加载失败', error);
      set({ isLoading: false });
      throw error;
    }
  },

  setSelectedSegment: (segment) => {
    set({ selectedSegment: segment });
    if (segment) {
      logger.info('data', '选中管线段', {
        id: segment.id,
        name: segment.pipelineName,
      });
    }
  },

  setVisibility: (layer, visible) => {
    set((state) => ({
      visibility: {
        ...state.visibility,
        [layer]: visible,
      },
    }));
    logger.info('ui', `图层${visible ? '显示' : '隐藏'}`, { layer });
  },

  setTransparency: (value) => {
    set({ transparency: value });
  },

  resetData: () => {
    const { originalSegments } = get();
    set({
      segments: JSON.parse(JSON.stringify(originalSegments)),
      selectedSegment: null,
    });
    logger.info('data', '已重置管线数据');
  },
}));
