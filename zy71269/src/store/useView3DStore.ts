import { create } from 'zustand';
import { ColorScale, SectionPlane, Position } from '../types';
import { temperatureColors } from '../data/mockData';

interface View3DState {
  cameraPosition: Position;
  targetPosition: Position;
  sectionPlane: SectionPlane;
  colorScale: ColorScale;
  showAirFlow: boolean;
  showSensors: boolean;
  showHeatMap: boolean;
  focusItem: (position: Position) => void;
  setSectionPlane: (axis: 'x' | 'y' | 'z' | null, position: number) => void;
  setColorScale: (min: number, max: number) => void;
  toggleAirFlow: () => void;
  toggleSensors: () => void;
  toggleHeatMap: () => void;
  setCameraPosition: (position: Position, target: Position) => void;
}

export const useView3DStore = create<View3DState>((set) => ({
  cameraPosition: { x: 6, y: 6, z: 6 },
  targetPosition: { x: 0, y: 0, z: 0 },
  sectionPlane: {
    axis: null,
    position: 0
  },
  colorScale: {
    min: 50,
    max: 110,
    colors: temperatureColors
  },
  showAirFlow: true,
  showSensors: true,
  showHeatMap: true,

  focusItem: (position) => set({
    cameraPosition: {
      x: position.x + 4,
      y: position.y + 4,
      z: position.z + 4
    },
    targetPosition: position
  }),

  setSectionPlane: (axis, position) => set({
    sectionPlane: { axis, position }
  }),

  setColorScale: (min, max) => set((state) => ({
    colorScale: { ...state.colorScale, min, max }
  })),

  toggleAirFlow: () => set((state) => ({ showAirFlow: !state.showAirFlow })),
  toggleSensors: () => set((state) => ({ showSensors: !state.showSensors })),
  toggleHeatMap: () => set((state) => ({ showHeatMap: !state.showHeatMap })),

  setCameraPosition: (position, target) => set({
    cameraPosition: position,
    targetPosition: target
  })
}));
