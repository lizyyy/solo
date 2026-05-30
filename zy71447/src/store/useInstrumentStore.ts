import { create } from 'zustand';
import type { InstrumentName, InstrumentDataBundle, SectionParams, BandType, Point3D } from '@/types';
import { getInstrumentData } from '@/data/instruments';

interface InstrumentState {
  currentInstrument: InstrumentName;
  instrumentData: InstrumentDataBundle | null;
  sectionParams: SectionParams;
  currentBand: BandType;
  selectedHotspotId: string | null;
  cameraTarget: Point3D;
  isLoading: boolean;

  setCurrentInstrument: (name: InstrumentName) => void;
  setSectionParams: (params: Partial<SectionParams>) => void;
  setCurrentBand: (band: BandType) => void;
  setSelectedHotspot: (id: string | null) => void;
  setCameraTarget: (target: Point3D) => void;
  toggleMaterialVisibility: (materialId: string) => void;
  resetView: () => void;
}

export const useInstrumentStore = create<InstrumentState>((set, get) => ({
  currentInstrument: '古琴',
  instrumentData: getInstrumentData('古琴'),
  sectionParams: {
    axis: 'y',
    position: 0,
    showCutSurface: true,
    highlightMaterial: null,
    showInternal: true,
  },
  currentBand: 'mid',
  selectedHotspotId: null,
  cameraTarget: { x: 0, y: 0, z: 0 },
  isLoading: false,

  setCurrentInstrument: (name) => {
    set({ isLoading: true });
    const data = getInstrumentData(name);
    set({
      currentInstrument: name,
      instrumentData: data,
      selectedHotspotId: null,
      isLoading: false,
    });
  },

  setSectionParams: (params) => {
    const current = get().sectionParams;
    set({
      sectionParams: { ...current, ...params },
    });
  },

  setCurrentBand: (band) => {
    set({ currentBand: band });
  },

  setSelectedHotspot: (id) => {
    set({ selectedHotspotId: id });
  },

  setCameraTarget: (target) => {
    set({ cameraTarget: target });
  },

  toggleMaterialVisibility: (materialId) => {
    const data = get().instrumentData;
    if (!data) return;

    const updatedMaterials = data.instrument.materialGroups.map((g) =>
      g.id === materialId ? { ...g, visible: !g.visible } : g
    );

    set({
      instrumentData: {
        ...data,
        instrument: {
          ...data.instrument,
          materialGroups: updatedMaterials,
        },
      },
    });
  },

  resetView: () => {
    const instrument = get().currentInstrument;
    const data = getInstrumentData(instrument);
    set({
      instrumentData: data,
      sectionParams: {
        axis: 'y',
        position: 0,
        showCutSurface: true,
        highlightMaterial: null,
        showInternal: true,
      },
      selectedHotspotId: null,
      cameraTarget: { x: 0, y: 0, z: 0 },
    });
  },
}));
