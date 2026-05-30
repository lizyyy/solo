import { create } from 'zustand';
import {
  TrackElement,
  MagneticField,
  ParticleConfig,
  ParticleType,
  PARTICLE_PROPERTIES,
  GRID_SIZE,
  ToolDefinition,
} from '../types';
import { createSampleRecord } from '../samples';

interface EditorState {
  trackElements: TrackElement[];
  magneticFields: MagneticField[];
  particleConfig: ParticleConfig;
  selectedElementId: string | null;
  selectedFieldId: string | null;
  highlightedToolId: string | null;
  draggingTool: ToolDefinition | null;
  isDragging: boolean;
  dragOffset: { x: number; y: number };
  currentSampleId: string | null;

  addTrackElement: (element: TrackElement) => void;
  removeTrackElement: (id: string) => void;
  updateTrackElement: (id: string, updates: Partial<TrackElement>) => void;
  addMagneticField: (field: MagneticField) => void;
  removeMagneticField: (id: string) => void;
  updateMagneticField: (id: string, updates: Partial<MagneticField>) => void;
  setParticleConfig: (config: Partial<ParticleConfig>) => void;
  setParticleType: (type: ParticleType) => void;
  setSelectedElement: (id: string | null) => void;
  setSelectedField: (id: string | null) => void;
  setHighlightedToolId: (id: string | null) => void;
  setDraggingTool: (tool: ToolDefinition | null) => void;
  setIsDragging: (dragging: boolean) => void;
  setDragOffset: (offset: { x: number; y: number }) => void;
  setCurrentSampleId: (id: string | null) => void;
  clearCanvas: () => void;
  clear: () => void;
  clearAll: () => void;
  loadFromRecord: (record: {
    trackElements: TrackElement[];
    magneticFields: MagneticField[];
    particleConfig: ParticleConfig;
    sampleSource: string | null;
  }) => void;
  loadSample: (sampleId: string) => void;
  snapToGrid: (value: number) => number;
  getElementAtPosition: (x: number, y: number) => TrackElement | null;
  getFieldAtPosition: (x: number, y: number) => MagneticField | null;
  generateId: () => string;
}

const defaultParticleConfig: ParticleConfig = {
  type: 'proton',
  name: PARTICLE_PROPERTIES.proton.name,
  symbol: PARTICLE_PROPERTIES.proton.symbol,
  charge: PARTICLE_PROPERTIES.proton.charge,
  mass: PARTICLE_PROPERTIES.proton.mass,
  initialEnergy: 1e-15,
  initialVelocity: { x: 1e5, y: 0 },
  startPosition: { x: 80, y: 300 },
};

export const useEditorStore = create<EditorState>((set, get) => ({
  trackElements: [],
  magneticFields: [],
  particleConfig: defaultParticleConfig,
  selectedElementId: null,
  selectedFieldId: null,
  highlightedToolId: null,
  draggingTool: null,
  isDragging: false,
  dragOffset: { x: 0, y: 0 },
  currentSampleId: null,

  addTrackElement: (element) =>
    set((state) => ({
      trackElements: [...state.trackElements, element],
      selectedElementId: element.id,
      selectedFieldId: null,
    })),

  removeTrackElement: (id) =>
    set((state) => ({
      trackElements: state.trackElements.filter((el) => el.id !== id),
      selectedElementId: state.selectedElementId === id ? null : state.selectedElementId,
    })),

  updateTrackElement: (id, updates) =>
    set((state) => ({
      trackElements: state.trackElements.map((el) =>
        el.id === id ? { ...el, ...updates } : el
      ),
    })),

  addMagneticField: (field) =>
    set((state) => ({
      magneticFields: [...state.magneticFields, field],
      selectedFieldId: field.id,
      selectedElementId: null,
    })),

  removeMagneticField: (id) =>
    set((state) => ({
      magneticFields: state.magneticFields.filter((f) => f.id !== id),
      selectedFieldId: state.selectedFieldId === id ? null : state.selectedFieldId,
    })),

  updateMagneticField: (id, updates) =>
    set((state) => ({
      magneticFields: state.magneticFields.map((f) =>
        f.id === id ? { ...f, ...updates } : f
      ),
    })),

  setParticleConfig: (config) =>
    set((state) => ({
      particleConfig: { ...state.particleConfig, ...config },
    })),

  setParticleType: (type) => {
    const props = PARTICLE_PROPERTIES[type];
    set((state) => ({
      particleConfig: {
        ...state.particleConfig,
        type,
        name: props.name,
        symbol: props.symbol,
        charge: props.charge,
        mass: props.mass,
      },
    }));
  },

  setSelectedElement: (id) =>
    set({ selectedElementId: id, selectedFieldId: id ? null : get().selectedFieldId }),

  setSelectedField: (id) =>
    set({ selectedFieldId: id, selectedElementId: id ? null : get().selectedElementId }),

  setHighlightedToolId: (id) => set({ highlightedToolId: id }),

  setDraggingTool: (tool) => set({ draggingTool: tool }),

  setIsDragging: (dragging) => set({ isDragging: dragging }),

  setDragOffset: (offset) => set({ dragOffset: offset }),

  setCurrentSampleId: (id) => set({ currentSampleId: id }),

  clearCanvas: () =>
    set({
      trackElements: [],
      magneticFields: [],
      selectedElementId: null,
      selectedFieldId: null,
      currentSampleId: null,
    }),

  clear: () =>
    set({
      selectedElementId: null,
      selectedFieldId: null,
      highlightedToolId: null,
      isDragging: false,
    }),

  clearAll: () =>
    set({
      trackElements: [],
      magneticFields: [],
      particleConfig: { ...defaultParticleConfig },
      selectedElementId: null,
      selectedFieldId: null,
      highlightedToolId: null,
      isDragging: false,
      currentSampleId: null,
    }),

  loadSample: (sampleId) => {
    const record = createSampleRecord(sampleId);
    if (record) {
      set({
        trackElements: [...record.trackElements],
        magneticFields: [...record.magneticFields],
        particleConfig: { ...record.particleConfig },
        currentSampleId: sampleId,
        selectedElementId: null,
        selectedFieldId: null,
      });
    }
  },

  loadFromRecord: (record) =>
    set({
      trackElements: [...record.trackElements],
      magneticFields: [...record.magneticFields],
      particleConfig: { ...record.particleConfig },
      currentSampleId: record.sampleSource,
      selectedElementId: null,
      selectedFieldId: null,
    }),

  snapToGrid: (value) => Math.round(value / GRID_SIZE) * GRID_SIZE,

  getElementAtPosition: (x, y) => {
    const { trackElements } = get();
    for (let i = trackElements.length - 1; i >= 0; i--) {
      const el = trackElements[i];
      if (
        x >= el.x &&
        x <= el.x + el.width &&
        y >= el.y &&
        y <= el.y + el.height
      ) {
        return el;
      }
    }
    return null;
  },

  getFieldAtPosition: (x, y) => {
    const { magneticFields } = get();
    for (let i = magneticFields.length - 1; i >= 0; i--) {
      const field = magneticFields[i];
      if (
        x >= field.x &&
        x <= field.x + field.width &&
        y >= field.y &&
        y <= field.y + field.height
      ) {
        return field;
      }
    }
    return null;
  },

  generateId: () => {
    return `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },
}));
