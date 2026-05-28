import { create } from 'zustand'
import type { Subsidiary, Currency, Exposure, HedgeContract, ExchangeRate, Anomaly } from '@/types'

interface ExposureState {
  subsidiaries: Subsidiary[]
  currencies: Currency[]
  exposures: Exposure[]
  hedgeContracts: HedgeContract[]
  exchangeRates: ExchangeRate[]
  anomalies: Anomaly[]
  selectedCurrencies: string[]
  selectedSubsidiaryCodes: string[]
  selectedDirections: string[]
  selectedNodeId: string | null
  dataLoaded: boolean

  setSubsidiaries: (d: Subsidiary[]) => void
  setCurrencies: (d: Currency[]) => void
  setExposures: (d: Exposure[]) => void
  setHedgeContracts: (d: HedgeContract[]) => void
  setExchangeRates: (d: ExchangeRate[]) => void
  setAnomalies: (d: Anomaly[]) => void
  setSelectedCurrencies: (c: string[]) => void
  setSelectedSubsidiaryCodes: (s: string[]) => void
  setSelectedDirections: (d: string[]) => void
  setSelectedNodeId: (id: string | null) => void
  setDataLoaded: (v: boolean) => void
  updateExposureNote: (id: string, note: string) => void
  updateHedgeNote: (id: string, note: string) => void
  updateAnomalyResolution: (id: string, resolution: Anomaly['resolution'], note: string) => void
  toggleExposureHedge: (id: string, contractNo: string) => void
  loadFromSnapshot: (s: { subsidiaries: Subsidiary[]; currencies: Currency[]; exposures: Exposure[]; hedgeContracts: HedgeContract[]; exchangeRates: ExchangeRate[]; anomalies: Anomaly[] }) => void
  reset: () => void
}

export const useExposureStore = create<ExposureState>((set) => ({
  subsidiaries: [],
  currencies: [],
  exposures: [],
  hedgeContracts: [],
  exchangeRates: [],
  anomalies: [],
  selectedCurrencies: [],
  selectedSubsidiaryCodes: [],
  selectedDirections: [],
  selectedNodeId: null,
  dataLoaded: false,

  setSubsidiaries: (d) => set({ subsidiaries: d }),
  setCurrencies: (d) => set({ currencies: d }),
  setExposures: (d) => set({ exposures: d }),
  setHedgeContracts: (d) => set({ hedgeContracts: d }),
  setExchangeRates: (d) => set({ exchangeRates: d }),
  setAnomalies: (d) => set({ anomalies: d }),
  setSelectedCurrencies: (c) => set({ selectedCurrencies: c }),
  setSelectedSubsidiaryCodes: (s) => set({ selectedSubsidiaryCodes: s }),
  setSelectedDirections: (d) => set({ selectedDirections: d }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setDataLoaded: (v) => set({ dataLoaded: v }),
  updateExposureNote: (id, note) =>
    set((s) => ({
      exposures: s.exposures.map((e) => (e.id === id ? { ...e, manualNote: note } : e)),
    })),
  updateHedgeNote: (id, note) =>
    set((s) => ({
      hedgeContracts: s.hedgeContracts.map((h) => (h.id === id ? { ...h, manualNote: note } : h)),
    })),
  updateAnomalyResolution: (id, resolution, note) =>
    set((s) => ({
      anomalies: s.anomalies.map((a) => (a.id === id ? { ...a, resolution, userNote: note } : a)),
    })),
  toggleExposureHedge: (id, contractNo) =>
    set((s) => ({
      exposures: s.exposures.map((e) =>
        e.id === id ? { ...e, hedged: !e.hedged, hedgeContractNo: contractNo } : e
      ),
    })),
  loadFromSnapshot: (s) =>
    set({
      subsidiaries: s.subsidiaries,
      currencies: s.currencies,
      exposures: s.exposures,
      hedgeContracts: s.hedgeContracts,
      exchangeRates: s.exchangeRates,
      anomalies: s.anomalies,
      dataLoaded: true,
      selectedCurrencies: [],
      selectedSubsidiaryCodes: [],
      selectedDirections: [],
      selectedNodeId: null,
    }),
  reset: () =>
    set({
      subsidiaries: [],
      currencies: [],
      exposures: [],
      hedgeContracts: [],
      exchangeRates: [],
      anomalies: [],
      dataLoaded: false,
      selectedCurrencies: [],
      selectedSubsidiaryCodes: [],
      selectedDirections: [],
      selectedNodeId: null,
    }),
}))
