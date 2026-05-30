import { create } from 'zustand';
import type { BridgeState, BridgeActions, LoadState, SceneState, ValidationError } from '../types';
import { createDemoBridge } from '../data/demoBridge';

const demoBridge = createDemoBridge();

interface BridgeStore extends BridgeState, BridgeActions {}

export const useBridgeStore = create<BridgeStore>((set, get) => ({
  model: demoBridge,
  scene: {
    isPlaying: true,
    animationSpeed: 1,
    deformationScale: 5,
    selectedNodeId: null,
    selectedElementId: null,
    cameraTarget: [0, 5, 0],
  },
  modeShape: {
    currentOrder: 1,
    availableModes: demoBridge.modeShapes.map(m => m.order),
    frequencyUnit: 'Hz',
  },
  load: {
    magnitude: 30,
    position: 0,
    lane: 0,
    isVisible: true,
  },
  dataSources: [{
    id: demoBridge._source.sourceId,
    fileName: demoBridge._source.fileName,
    fileType: 'json',
    importedAt: demoBridge._source.importedAt,
    sourceType: demoBridge._source.sourceType,
  }],
  validationErrors: [],

  selectMode: (order: number) => {
    set(state => ({
      modeShape: { ...state.modeShape, currentOrder: order },
    }));
  },

  setLoad: (params: Partial<LoadState>) => {
    set(state => ({
      load: { ...state.load, ...params },
    }));
  },

  setScene: (params: Partial<SceneState>) => {
    set(state => ({
      scene: { ...state.scene, ...params },
    }));
  },

  selectNode: (nodeId: string | null) => {
    set(state => ({
      scene: { ...state.scene, selectedNodeId: nodeId, selectedElementId: null },
    }));
  },

  selectElement: (elementId: string | null) => {
    set(state => ({
      scene: { ...state.scene, selectedElementId: elementId, selectedNodeId: null },
    }));
  },

  importData: async (file: File, sourceType: 'original' | 'processed') => {
    console.log(`Importing ${sourceType} file: ${file.name}`);
    
    const newErrors: ValidationError[] = [];
    
    if (file.name.includes('error') || file.size === 0) {
      newErrors.push({
        id: `err-${Date.now()}`,
        type: 'node_connection',
        severity: 'error',
        sourceId: file.name,
        sourceFileName: file.name,
        location: { lineNumber: 15 },
        message: '节点连接异常',
        suggestion: '请检查节点编号是否匹配，确保单元引用的节点都存在于节点列表中',
        humanReason: '这份材料里第15号单元连接的节点编号在节点列表中找不到，可能是不同文件编号规则不一致导致的',
      });
    }
    
    if (file.name.includes('freq')) {
      newErrors.push({
        id: `err-${Date.now() + 1}`,
        type: 'frequency_unit',
        severity: 'warning',
        sourceId: file.name,
        sourceFileName: file.name,
        location: { lineNumber: 42 },
        message: '频率单位可能不正确',
        suggestion: '建议确认频率单位，桥梁一阶频率通常在0.5~5Hz范围内',
        humanReason: '第1阶频率显示为125.6，这个数值更像是rad/s单位而不是Hz（125.6 rad/s ≈ 20 Hz），对于普通桥梁来说偏高了',
      });
    }
    
    set(state => ({
      validationErrors: [...state.validationErrors, ...newErrors],
    }));
  },

  takeScreenshot: () => {
    console.log('Taking screenshot...');
  },

  locateError: (errorId: string) => {
    const error = get().validationErrors.find(e => e.id === errorId);
    if (error?.location.nodeId) {
      set(state => ({
        scene: { ...state.scene, selectedNodeId: error.location.nodeId! },
      }));
    }
    console.log('Locating error:', errorId);
  },

  togglePlay: () => {
    set(state => ({
      scene: { ...state.scene, isPlaying: !state.scene.isPlaying },
    }));
  },

  setFrequencyUnit: (unit: 'Hz' | 'rad/s') => {
    set(state => ({
      modeShape: { ...state.modeShape, frequencyUnit: unit },
    }));
  },

  clearErrors: () => {
    set({ validationErrors: [] });
  },
}));
