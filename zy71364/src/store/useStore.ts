import { create } from "zustand";
import { api } from "@/utils/api";
import type {
  Artwork,
  Restoration,
  RestorationStep,
  MaterialBatch,
  Photo,
  Anomaly,
  Correction,
  Signature,
  TraceChainItem,
} from "../../shared/types";

interface AppState {
  artworks: Artwork[];
  restorations: Restoration[];
  steps: RestorationStep[];
  materials: MaterialBatch[];
  photos: Photo[];
  anomalies: Anomaly[];
  corrections: Correction[];
  signatures: Signature[];
  traceChain: TraceChainItem[];
  loading: boolean;
  error: string | null;

  fetchArtworks: (params?: { status?: string; keyword?: string }) => Promise<void>;
  fetchArtwork: (id: string) => Promise<Artwork>;
  createArtwork: (data: Partial<Artwork>) => Promise<Artwork>;
  updateArtwork: (id: string, data: Partial<Artwork>) => Promise<Artwork>;

  fetchRestorations: () => Promise<void>;
  fetchRestoration: (id: string) => Promise<Restoration>;
  createRestoration: (data: Partial<Restoration>) => Promise<Restoration>;
  updateRestoration: (id: string, data: Partial<Restoration>) => Promise<Restoration>;

  fetchSteps: (restorationId: string) => Promise<void>;
  createStep: (restorationId: string, data: Partial<RestorationStep>) => Promise<RestorationStep>;
  updateStep: (restorationId: string, stepId: string, data: Partial<RestorationStep>) => Promise<RestorationStep>;
  reorderSteps: (restorationId: string, stepIds: string[]) => Promise<void>;

  fetchMaterials: (restorationId: string) => Promise<void>;
  createMaterial: (restorationId: string, data: Partial<MaterialBatch>) => Promise<MaterialBatch>;
  updateMaterial: (id: string, data: Partial<MaterialBatch>) => Promise<MaterialBatch>;
  fetchMaterialUsage: (id: string) => Promise<RestorationStep[]>;

  fetchPhotos: (restorationId: string) => Promise<void>;
  uploadPhoto: (restorationId: string, formData: FormData) => Promise<Photo>;
  updatePhoto: (id: string, data: Partial<Photo>) => Promise<Photo>;
  deletePhoto: (id: string) => Promise<void>;

  fetchAnomalies: (restorationId: string) => Promise<void>;
  triggerAnomalyCheck: (restorationId: string) => Promise<Anomaly[]>;
  submitCorrection: (anomalyId: string, data: Partial<Correction>) => Promise<Correction>;
  fetchCorrections: (anomalyId: string) => Promise<Correction[]>;

  fetchSignatures: (restorationId: string) => Promise<void>;
  submitSignature: (restorationId: string, data: Partial<Signature>) => Promise<Signature>;
  fetchTraceChain: (restorationId: string) => Promise<void>;

  generateReport: (restorationId: string, options: {
    includeAnomalies: boolean;
    includeCorrections: boolean;
    includeSignatures: boolean;
    includeRules: boolean;
  }) => Promise<{ id: string; fileUrl: string }>;

  clearError: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  artworks: [],
  restorations: [],
  steps: [],
  materials: [],
  photos: [],
  anomalies: [],
  corrections: [],
  signatures: [],
  traceChain: [],
  loading: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchArtworks: async (params) => {
    set({ loading: true, error: null });
    try {
      const artworks = await api.artworks.list(params);
      set({ artworks, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  fetchArtwork: async (id) => {
    set({ loading: true, error: null });
    try {
      const artwork = await api.artworks.get(id);
      set((s) => {
        const exists = s.artworks.some((a) => a.id === id);
        return {
          artworks: exists
            ? s.artworks.map((a) => (a.id === id ? artwork : a))
            : [...s.artworks, artwork],
          loading: false,
        };
      });
      return artwork;
    } catch (e: any) {
      set({ error: e.message, loading: false });
      throw e;
    }
  },

  createArtwork: async (data) => {
    set({ loading: true, error: null });
    try {
      const artwork = await api.artworks.create(data);
      set((s) => ({ artworks: [...s.artworks, artwork], loading: false }));
      return artwork;
    } catch (e: any) {
      set({ error: e.message, loading: false });
      throw e;
    }
  },

  updateArtwork: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const artwork = await api.artworks.update(id, data);
      set((s) => ({
        artworks: s.artworks.map((a) => (a.id === id ? artwork : a)),
        loading: false,
      }));
      return artwork;
    } catch (e: any) {
      set({ error: e.message, loading: false });
      throw e;
    }
  },

  fetchRestorations: async () => {
    set({ loading: true, error: null });
    try {
      const restorations = await api.restorations.list();
      set({ restorations, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  fetchRestoration: async (id) => {
    set({ loading: true, error: null });
    try {
      const restoration = await api.restorations.get(id);
      set((s) => {
        const exists = s.restorations.some((r) => r.id === id);
        return {
          restorations: exists
            ? s.restorations.map((r) => (r.id === id ? restoration : r))
            : [...s.restorations, restoration],
          loading: false,
        };
      });
      return restoration;
    } catch (e: any) {
      set({ error: e.message, loading: false });
      throw e;
    }
  },

  createRestoration: async (data) => {
    set({ loading: true, error: null });
    try {
      const restoration = await api.restorations.create(data);
      set((s) => ({ restorations: [...s.restorations, restoration], loading: false }));
      return restoration;
    } catch (e: any) {
      set({ error: e.message, loading: false });
      throw e;
    }
  },

  updateRestoration: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const restoration = await api.restorations.update(id, data);
      set((s) => ({
        restorations: s.restorations.map((r) => (r.id === id ? restoration : r)),
        loading: false,
      }));
      return restoration;
    } catch (e: any) {
      set({ error: e.message, loading: false });
      throw e;
    }
  },

  fetchSteps: async (restorationId) => {
    set({ loading: true, error: null });
    try {
      const steps = await api.steps.list(restorationId);
      set({ steps, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  createStep: async (restorationId, data) => {
    set({ loading: true, error: null });
    try {
      const step = await api.steps.create(restorationId, data);
      set((s) => ({ steps: [...s.steps, step], loading: false }));
      return step;
    } catch (e: any) {
      set({ error: e.message, loading: false });
      throw e;
    }
  },

  updateStep: async (restorationId, stepId, data) => {
    set({ loading: true, error: null });
    try {
      const step = await api.steps.update(restorationId, stepId, data);
      set((s) => ({
        steps: s.steps.map((st) => (st.id === stepId ? step : st)),
        loading: false,
      }));
      return step;
    } catch (e: any) {
      set({ error: e.message, loading: false });
      throw e;
    }
  },

  reorderSteps: async (restorationId, stepIds) => {
    set({ loading: true, error: null });
    try {
      await api.steps.reorder(restorationId, stepIds);
      const steps = await api.steps.list(restorationId);
      set({ steps, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  fetchMaterials: async (restorationId) => {
    set({ loading: true, error: null });
    try {
      const materials = await api.materials.list(restorationId);
      set({ materials, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  createMaterial: async (restorationId, data) => {
    set({ loading: true, error: null });
    try {
      const material = await api.materials.create(restorationId, data);
      set((s) => ({ materials: [...s.materials, material], loading: false }));
      return material;
    } catch (e: any) {
      set({ error: e.message, loading: false });
      throw e;
    }
  },

  updateMaterial: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const material = await api.materials.update(id, data);
      set((s) => ({
        materials: s.materials.map((m) => (m.id === id ? material : m)),
        loading: false,
      }));
      return material;
    } catch (e: any) {
      set({ error: e.message, loading: false });
      throw e;
    }
  },

  fetchMaterialUsage: async (id) => {
    try {
      return await api.materials.usage(id);
    } catch (e: any) {
      set({ error: e.message });
      throw e;
    }
  },

  fetchPhotos: async (restorationId) => {
    set({ loading: true, error: null });
    try {
      const photos = await api.photos.list(restorationId);
      set({ photos, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  uploadPhoto: async (restorationId, formData) => {
    set({ loading: true, error: null });
    try {
      const photo = await api.photos.upload(restorationId, formData);
      set((s) => ({ photos: [...s.photos, photo], loading: false }));
      return photo;
    } catch (e: any) {
      set({ error: e.message, loading: false });
      throw e;
    }
  },

  updatePhoto: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const photo = await api.photos.update(id, data);
      set((s) => ({
        photos: s.photos.map((p) => (p.id === id ? photo : p)),
        loading: false,
      }));
      return photo;
    } catch (e: any) {
      set({ error: e.message, loading: false });
      throw e;
    }
  },

  deletePhoto: async (id) => {
    set({ loading: true, error: null });
    try {
      await api.photos.delete(id);
      set((s) => ({
        photos: s.photos.filter((p) => p.id !== id),
        loading: false,
      }));
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  fetchAnomalies: async (restorationId) => {
    set({ loading: true, error: null });
    try {
      const anomalies = await api.anomalies.list(restorationId);
      set({ anomalies, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  triggerAnomalyCheck: async (restorationId) => {
    set({ loading: true, error: null });
    try {
      const anomalies = await api.anomalies.check(restorationId);
      set({ anomalies, loading: false });
      return anomalies;
    } catch (e: any) {
      set({ error: e.message, loading: false });
      throw e;
    }
  },

  submitCorrection: async (anomalyId, data) => {
    set({ loading: true, error: null });
    try {
      const correction = await api.anomalies.submitCorrection(anomalyId, data);
      set((s) => ({ corrections: [...s.corrections, correction], loading: false }));
      return correction;
    } catch (e: any) {
      set({ error: e.message, loading: false });
      throw e;
    }
  },

  fetchCorrections: async (anomalyId) => {
    try {
      const corrections = await api.anomalies.getCorrections(anomalyId);
      set((s) => {
        const existing = s.corrections.filter((c) => c.anomalyId !== anomalyId);
        return { corrections: [...existing, ...corrections] };
      });
      return corrections;
    } catch (e: any) {
      set({ error: e.message });
      throw e;
    }
  },

  fetchSignatures: async (restorationId) => {
    set({ loading: true, error: null });
    try {
      const signatures = await api.signatures.list(restorationId);
      set({ signatures, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  submitSignature: async (restorationId, data) => {
    set({ loading: true, error: null });
    try {
      const signature = await api.signatures.submit(restorationId, data);
      set((s) => ({ signatures: [...s.signatures, signature], loading: false }));
      return signature;
    } catch (e: any) {
      set({ error: e.message, loading: false });
      throw e;
    }
  },

  fetchTraceChain: async (restorationId) => {
    set({ loading: true, error: null });
    try {
      const traceChain = await api.signatures.traceChain(restorationId);
      set({ traceChain, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  generateReport: async (restorationId, options) => {
    set({ loading: true, error: null });
    try {
      const result = await api.reports.generate(restorationId, options);
      set({ loading: false });
      return result;
    } catch (e: any) {
      set({ error: e.message, loading: false });
      throw e;
    }
  },
}));
