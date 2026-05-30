import { create } from 'zustand';
import type { RiskItem, InstrumentModel, FrequencySample, Hotspot, SectionParams, BandType } from '@/types';
import { RiskDetector } from '@/utils/riskDetector';

interface RiskState {
  risks: RiskItem[];
  autoDetect: boolean;
  showRawData: boolean;

  detectRisks: (
    instrument: InstrumentModel,
    samples: FrequencySample[],
    hotspots: Hotspot[],
    sectionParams: SectionParams,
    currentBand: BandType
  ) => void;
  clearRisks: () => void;
  toggleAutoDetect: () => void;
  toggleShowRawData: () => void;
  getRisksByType: (type: RiskItem['type']) => RiskItem[];
}

export const useRiskStore = create<RiskState>((set, get) => ({
  risks: [],
  autoDetect: true,
  showRawData: false,

  detectRisks: (instrument, samples, hotspots, sectionParams, currentBand) => {
    const risks = RiskDetector.detectAllRisks(
      instrument,
      samples,
      hotspots,
      sectionParams,
      currentBand
    );
    set({ risks });
  },

  clearRisks: () => {
    set({ risks: [] });
  },

  toggleAutoDetect: () => {
    set({ autoDetect: !get().autoDetect });
  },

  toggleShowRawData: () => {
    set({ showRawData: !get().showRawData });
  },

  getRisksByType: (type) => {
    return get().risks.filter((r) => r.type === type);
  },
}));
