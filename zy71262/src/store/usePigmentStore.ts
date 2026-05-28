import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { Pigment, PigmentStatus, SimilarPigmentResult } from '../types';
import { detectAnomalies, determineStatus } from '../utils/anomalyDetector';
import { findSimilarPigments } from '../utils/similarityCalculator';
import { mockPigments } from '../data/mockPigments';

interface PigmentStore {
  pigments: Pigment[];
  selectedPigmentId: string | null;
  isLoading: boolean;
  error: string | null;
  
  initStore: () => void;
  addPigment: (pigment: Omit<Pigment, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'anomalies'>) => void;
  updatePigment: (id: string, updates: Partial<Pigment>) => void;
  deletePigment: (id: string) => void;
  selectPigment: (id: string | null) => void;
  updatePigmentStatus: (id: string, status: PigmentStatus) => void;
  revalidateAnomalies: () => void;
  
  getSelectedPigment: () => Pigment | undefined;
  getSimilarPigments: (id: string, topN?: number) => SimilarPigmentResult[];
  getPigmentsByStatus: (status: PigmentStatus) => Pigment[];
  getStatistics: () => { total: number; processed: number; pending: number; rejected: number };
}

const STORAGE_KEY = 'pigment-cube-data';

export const usePigmentStore = create<PigmentStore>((set, get) => ({
  pigments: [],
  selectedPigmentId: null,
  isLoading: false,
  error: null,

  initStore: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        set({ pigments: parsed, isLoading: false });
      } else {
        set({ pigments: mockPigments, isLoading: false });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mockPigments));
      }
    } catch {
      set({ pigments: mockPigments, isLoading: false });
    }
  },

  addPigment: (pigmentData) => {
    const newPigment: Pigment = {
      ...pigmentData,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'processed',
      anomalies: [],
    };
    
    const { anomalies } = detectAnomalies(newPigment, get().pigments);
    newPigment.anomalies = anomalies;
    newPigment.status = determineStatus(anomalies);
    
    const newPigments = [...get().pigments, newPigment];
    set({ pigments: newPigments });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newPigments));
  },

  updatePigment: (id, updates) => {
    const updatedPigments = get().pigments.map(p => {
      if (p.id === id) {
        const updated = { ...p, ...updates, updatedAt: new Date().toISOString() };
        const { anomalies } = detectAnomalies(updated, get().pigments);
        updated.anomalies = anomalies;
        updated.status = determineStatus(anomalies);
        return updated;
      }
      return p;
    });
    
    set({ pigments: updatedPigments });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPigments));
  },

  deletePigment: (id) => {
    const newPigments = get().pigments.filter(p => p.id !== id);
    set({ pigments: newPigments, selectedPigmentId: get().selectedPigmentId === id ? null : get().selectedPigmentId });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newPigments));
  },

  selectPigment: (id) => {
    set({ selectedPigmentId: id });
  },

  updatePigmentStatus: (id, status) => {
    const updatedPigments = get().pigments.map(p => 
      p.id === id ? { ...p, status, updatedAt: new Date().toISOString() } : p
    );
    set({ pigments: updatedPigments });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPigments));
  },

  revalidateAnomalies: () => {
    const updatedPigments = get().pigments.map(p => {
      const { anomalies } = detectAnomalies(p, get().pigments);
      return { ...p, anomalies, status: determineStatus(anomalies) };
    });
    set({ pigments: updatedPigments });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPigments));
  },

  getSelectedPigment: () => {
    return get().pigments.find(p => p.id === get().selectedPigmentId);
  },

  getSimilarPigments: (id, topN = 5) => {
    return findSimilarPigments(id, get().pigments, topN);
  },

  getPigmentsByStatus: (status) => {
    return get().pigments.filter(p => p.status === status);
  },

  getStatistics: () => {
    const pigments = get().pigments;
    return {
      total: pigments.length,
      processed: pigments.filter(p => p.status === 'processed').length,
      pending: pigments.filter(p => p.status === 'pending').length,
      rejected: pigments.filter(p => p.status === 'rejected').length,
    };
  },
}));
