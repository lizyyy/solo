import { create } from 'zustand';
import type { 
  Gallery, LightSource, Artwork, SamplingData, 
  Exhibition, Risk, ProtectionReport, Point3D,
  RelayoutPreviewResponse, RiskSeverity
} from '@/types';
import { 
  demoGallery, demoLightSources, demoArtworks, 
  demoSamplingData, demoExhibition, demoRisks 
} from '@/mock/demoData';
import { calculateTotalIllumination } from '@/hooks/useLightCalculation';
import { LIGHT_RESISTANCE_THRESHOLDS } from '@/types';

interface AppState {
  gallery: Gallery | null;
  lightSources: LightSource[];
  artworks: Artwork[];
  samplingData: SamplingData[];
  exhibitions: Exhibition[];
  currentExhibition: Exhibition | null;
  risks: Risk[];
  reports: ProtectionReport[];
  
  selectedArtworkId: string | null;
  selectedLightSourceId: string | null;
  selectedRiskId: string | null;
  
  isRelayoutMode: boolean;
  relayoutPreview: RelayoutPreviewResponse | null;
  draggingArtworkId: string | null;
  originalPosition: Point3D | null;
  isRelayoutConfirmMode: boolean;
  
  showHeatmap: boolean;
  showLightRays: boolean;
  showRiskMarkers: boolean;
  
  idempotencyKeys: Set<string>;
  
  setGallery: (gallery: Gallery | null) => void;
  setLightSources: (sources: LightSource[]) => void;
  setArtworks: (artworks: Artwork[]) => void;
  setSamplingData: (data: SamplingData[]) => void;
  setExhibitions: (exhibitions: Exhibition[]) => void;
  setCurrentExhibition: (exhibition: Exhibition | null) => void;
  setRisks: (risks: Risk[]) => void;
  setReports: (reports: ProtectionReport[]) => void;
  
  selectArtwork: (id: string | null) => void;
  selectLightSource: (id: string | null) => void;
  selectRisk: (id: string | null) => void;
  
  setRelayoutMode: (enabled: boolean) => void;
  setRelayoutPreview: (preview: RelayoutPreviewResponse | null) => void;
  setDraggingArtworkId: (id: string | null) => void;
  setOriginalPosition: (pos: Point3D | null) => void;
  confirmRelayout: () => void;
  cancelRelayout: () => void;
  
  setShowHeatmap: (show: boolean) => void;
  setShowLightRays: (show: boolean) => void;
  setShowRiskMarkers: (show: boolean) => void;
  
  addArtwork: (artwork: Artwork, idempotencyKey: string) => { success: boolean; error?: string };
  updateArtwork: (id: string, updates: Partial<Artwork>) => void;
  deleteArtwork: (id: string) => { success: boolean; error?: string };
  updateArtworkPosition: (id: string, position: Point3D) => void;
  
  addLightSource: (source: LightSource, idempotencyKey: string) => { success: boolean; error?: string };
  updateLightSource: (id: string, updates: Partial<LightSource>) => void;
  deleteLightSource: (id: string) => void;
  
  addSamplingData: (data: SamplingData, idempotencyKey: string) => { success: boolean; error?: string };
  
  addExhibition: (exhibition: Exhibition, idempotencyKey: string) => { success: boolean; error?: string };
  updateExhibition: (id: string, updates: Partial<Exhibition>) => { success: boolean; error?: string };
  
  acknowledgeRisk: (riskId: string, userId: string) => { success: boolean; error?: string };
  resolveRisk: (riskId: string, resolution: string, userId: string) => { success: boolean; error?: string };
  
  addReport: (report: ProtectionReport) => void;
  
  checkIdempotency: (key: string) => boolean;
  markIdempotencyUsed: (key: string) => void;
  
  loadDemoData: () => void;
  resetData: () => void;
}

export const useMainStore = create<AppState>((set, get) => ({
  gallery: null,
  lightSources: [],
  artworks: [],
  samplingData: [],
  exhibitions: [],
  currentExhibition: null,
  risks: [],
  reports: [],
  
  selectedArtworkId: null,
  selectedLightSourceId: null,
  selectedRiskId: null,
  
  isRelayoutMode: false,
  relayoutPreview: null,
  draggingArtworkId: null,
  originalPosition: null,
  isRelayoutConfirmMode: false,
  
  showHeatmap: true,
  showLightRays: true,
  showRiskMarkers: true,
  
  idempotencyKeys: new Set(),
  
  setGallery: (gallery) => set({ gallery }),
  setLightSources: (lightSources) => set({ lightSources }),
  setArtworks: (artworks) => set({ artworks }),
  setSamplingData: (samplingData) => set({ samplingData }),
  setExhibitions: (exhibitions) => set({ exhibitions }),
  setCurrentExhibition: (currentExhibition) => set({ currentExhibition }),
  setRisks: (risks) => set({ risks }),
  setReports: (reports) => set({ reports }),
  
  selectArtwork: (id) => set({ selectedArtworkId: id, selectedRiskId: null }),
  selectLightSource: (id) => set({ selectedLightSourceId: id, selectedRiskId: null }),
  selectRisk: (id) => {
    const state = get();
    const risk = state.risks.find(r => r.id === id);
    set({ 
      selectedRiskId: id, 
      selectedArtworkId: risk?.artworkId || null,
      selectedLightSourceId: risk?.lightSourceId || null
    });
  },
  
  setRelayoutMode: (isRelayoutMode) => set({ 
    isRelayoutMode, 
    relayoutPreview: null,
    draggingArtworkId: null,
    originalPosition: null,
    isRelayoutConfirmMode: false
  }),
  setRelayoutPreview: (relayoutPreview) => set({ 
    relayoutPreview,
    isRelayoutConfirmMode: relayoutPreview !== null
  }),
  setDraggingArtworkId: (draggingArtworkId) => set({ draggingArtworkId }),
  setOriginalPosition: (originalPosition) => set({ originalPosition }),
  
  confirmRelayout: () => {
    const state = get();
    if (!state.relayoutPreview || !state.draggingArtworkId) return;
    
    const artwork = state.artworks.find(a => a.id === state.draggingArtworkId);
    if (artwork) {
      state.updateArtworkPosition(
        state.draggingArtworkId,
        {
          x: artwork.posX,
          y: artwork.posY,
          z: artwork.posZ
        }
      );
    }
    
    set({
      relayoutPreview: null,
      originalPosition: null,
      draggingArtworkId: null,
      isRelayoutConfirmMode: false
    });
  },
  
  cancelRelayout: () => {
    const state = get();
    if (state.originalPosition && state.draggingArtworkId) {
      state.updateArtworkPosition(
        state.draggingArtworkId,
        state.originalPosition
      );
    }
    
    set({
      relayoutPreview: null,
      originalPosition: null,
      draggingArtworkId: null,
      isRelayoutConfirmMode: false
    });
  },
  
  setShowHeatmap: (showHeatmap) => set({ showHeatmap }),
  setShowLightRays: (showLightRays) => set({ showLightRays }),
  setShowRiskMarkers: (showRiskMarkers) => set({ showRiskMarkers }),
  
  addArtwork: (artwork, idempotencyKey) => {
    const state = get();
    
    if (state.checkIdempotency(idempotencyKey)) {
      return { success: false, error: '重复提交，该数据已存在' };
    }
    
    const existing = state.artworks.find(a => a.id === artwork.id);
    if (existing) {
      return { success: false, error: '作品ID已存在' };
    }
    
    if (state.currentExhibition && artwork.exhibitionId !== state.currentExhibition.id) {
      artwork.exhibitionId = state.currentExhibition.id;
    }
    
    state.markIdempotencyUsed(idempotencyKey);
    set(state => ({ artworks: [...state.artworks, artwork] }));
    return { success: true };
  },
  
  updateArtwork: (id, updates) => set(state => ({
    artworks: state.artworks.map(a => 
      a.id === id 
        ? { ...a, ...updates, lastModifiedBy: '当前用户', lastModifiedAt: new Date().toISOString() }
        : a
    )
  })),
  
  deleteArtwork: (id) => {
    const state = get();
    const artwork = state.artworks.find(a => a.id === id);
    
    if (!artwork) {
      return { success: false, error: '作品不存在' };
    }
    
    if (artwork.exhibitionId && state.currentExhibition?.id === artwork.exhibitionId && state.currentExhibition?.status === 'ongoing') {
      return { success: false, error: '展期进行中的作品不允许删除' };
    }
    
    set(state => ({
      artworks: state.artworks.filter(a => a.id !== id),
      selectedArtworkId: state.selectedArtworkId === id ? null : state.selectedArtworkId
    }));
    return { success: true };
  },
  
  updateArtworkPosition: (id, position) => set(state => ({
    artworks: state.artworks.map(a =>
      a.id === id
        ? { ...a, posX: position.x, posY: position.y, posZ: position.z, lastModifiedBy: '当前用户', lastModifiedAt: new Date().toISOString() }
        : a
    )
  })),
  
  addLightSource: (source, idempotencyKey) => {
    const state = get();
    
    if (state.checkIdempotency(idempotencyKey)) {
      return { success: false, error: '重复提交，该数据已存在' };
    }
    
    const existing = state.lightSources.find(l => l.id === source.id);
    if (existing) {
      return { success: false, error: '光源ID已存在' };
    }
    
    state.markIdempotencyUsed(idempotencyKey);
    set(state => ({ lightSources: [...state.lightSources, source] }));
    return { success: true };
  },
  
  updateLightSource: (id, updates) => set(state => ({
    lightSources: state.lightSources.map(l =>
      l.id === id ? { ...l, ...updates } : l
    )
  })),
  
  deleteLightSource: (id) => set(state => ({
    lightSources: state.lightSources.filter(l => l.id !== id),
    selectedLightSourceId: state.selectedLightSourceId === id ? null : state.selectedLightSourceId
  })),
  
  addSamplingData: (data, idempotencyKey) => {
    const state = get();
    
    if (state.checkIdempotency(idempotencyKey)) {
      return { success: false, error: '重复提交，该数据已存在' };
    }
    
    state.markIdempotencyUsed(idempotencyKey);
    set(state => ({ samplingData: [...state.samplingData, data] }));
    return { success: true };
  },
  
  addExhibition: (exhibition, idempotencyKey) => {
    const state = get();
    
    if (state.checkIdempotency(idempotencyKey)) {
      return { success: false, error: '重复提交，该数据已存在' };
    }
    
    const existing = state.exhibitions.find(e => e.id === exhibition.id);
    if (existing) {
      return { success: false, error: '展览ID已存在' };
    }
    
    state.markIdempotencyUsed(idempotencyKey);
    set(state => ({ exhibitions: [...state.exhibitions, exhibition] }));
    return { success: true };
  },
  
  updateExhibition: (id, updates) => {
    const state = get();
    const exhibition = state.exhibitions.find(e => e.id === id);
    
    if (!exhibition) {
      return { success: false, error: '展览不存在' };
    }
    
    if (exhibition.status === 'ended') {
      return { success: false, error: '已结束的展期不允许修改' };
    }
    
    set(state => ({
      exhibitions: state.exhibitions.map(e =>
        e.id === id ? { ...e, ...updates } : e
      ),
      currentExhibition: state.currentExhibition?.id === id
        ? { ...state.currentExhibition, ...updates }
        : state.currentExhibition
    }));
    return { success: true };
  },
  
  acknowledgeRisk: (riskId, userId) => {
    const state = get();
    const risk = state.risks.find(r => r.id === riskId);
    
    if (!risk) {
      return { success: false, error: '风险不存在' };
    }
    
    if (risk.status !== 'detected') {
      return { success: false, error: '该风险状态不允许重复确认' };
    }
    
    set(state => ({
      risks: state.risks.map(r =>
        r.id === riskId
          ? { ...r, status: 'acknowledged', acknowledgedBy: userId, acknowledgedAt: new Date().toISOString() }
          : r
      )
    }));
    return { success: true };
  },
  
  resolveRisk: (riskId, resolution, userId) => {
    const state = get();
    const risk = state.risks.find(r => r.id === riskId);
    
    if (!risk) {
      return { success: false, error: '风险不存在' };
    }
    
    if (risk.status === 'resolved') {
      return { success: false, error: '该风险已解决，不允许重复操作' };
    }
    
    set(state => ({
      risks: state.risks.map(r =>
        r.id === riskId
          ? { ...r, status: 'resolved', resolvedAt: new Date().toISOString(), resolution, resolvedBy: userId }
          : r
      )
    }));
    return { success: true };
  },
  
  addReport: (report) => set(state => ({
    reports: [...state.reports, report]
  })),
  
  checkIdempotency: (key) => {
    return get().idempotencyKeys.has(key);
  },
  
  markIdempotencyUsed: (key) => set(state => {
    const newSet = new Set(state.idempotencyKeys);
    newSet.add(key);
    return { idempotencyKeys: newSet };
  }),
  
  loadDemoData: () => {
    set({
      gallery: demoGallery,
      lightSources: demoLightSources,
      artworks: demoArtworks,
      samplingData: demoSamplingData,
      exhibitions: [demoExhibition],
      currentExhibition: demoExhibition,
      risks: demoRisks
    });
  },
  
  resetData: () => {
    set({
      gallery: null,
      lightSources: [],
      artworks: [],
      samplingData: [],
      exhibitions: [],
      currentExhibition: null,
      risks: [],
      reports: [],
      selectedArtworkId: null,
      selectedLightSourceId: null,
      selectedRiskId: null,
      isRelayoutMode: false,
      relayoutPreview: null,
      draggingArtworkId: null,
      originalPosition: null,
      isRelayoutConfirmMode: false,
      idempotencyKeys: new Set()
    });
  }
}));
