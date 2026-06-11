import { create } from 'zustand';
import { ReviewSession, CollisionPoint, CADLayer, generateFingerprint } from '../types';
import { importLayersWithDeduplication, updateManualNote, attachScreenshot } from '../core/collisionEngine';
import { createDemoSession, demoLayers } from '../data/demoData';

interface ReviewState {
  session: ReviewSession | null;
  selectedCollisionId: string | null;
  filterSeverity: ('warning' | 'error' | 'critical')[];
  showBoundary: boolean;
  showDuplicates: boolean;
  isLoading: boolean;

  initDemoSession: () => void;
  selectCollision: (id: string | null) => void;
  setFilterSeverity: (severity: ('warning' | 'error' | 'critical')[]) => void;
  setShowBoundary: (show: boolean) => void;
  setShowDuplicates: (show: boolean) => void;
  toggleLayerVisibility: (layerId: string) => void;
  importDemoData: () => {
    added: number;
    skipped: number;
    collisions: number;
  };
  importCustomLayers: (layers: Omit<CADLayer, 'id' | 'importedAt' | 'importBatchId'>[], fileName: string) => {
    added: number;
    skipped: number;
    collisions: number;
  };
  updateNote: (collisionId: string, note: string) => void;
  attachCollisionScreenshot: (collisionId: string, dataUrl: string) => void;
  updateCollisionStatus: (collisionId: string, status: CollisionPoint['status']) => void;
  getFilteredCollisions: () => CollisionPoint[];
  getLayerById: (id: string) => CADLayer | undefined;
}

const STORAGE_KEY = 'review-session';

const loadFromStorage = (): ReviewSession | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load session from storage:', e);
  }
  return null;
};

const saveToStorage = (session: ReviewSession) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (e) {
    console.error('Failed to save session to storage:', e);
  }
};

export const useReviewStore = create<ReviewState>((set, get) => ({
  session: null,
  selectedCollisionId: null,
  filterSeverity: ['warning', 'error', 'critical'],
  showBoundary: true,
  showDuplicates: false,
  isLoading: false,

  initDemoSession: () => {
    localStorage.removeItem(STORAGE_KEY);
    const session = createDemoSession();
    saveToStorage(session);
    set({ session, isLoading: false });
  },

  selectCollision: (id) => set({ selectedCollisionId: id }),

  setFilterSeverity: (severity) => set({ filterSeverity: severity }),

  setShowBoundary: (show) => set({ showBoundary: show }),

  setShowDuplicates: (show) => set({ showDuplicates: show }),

  toggleLayerVisibility: (layerId) => {
    const { session } = get();
    if (!session) return;

    const updatedSession = {
      ...session,
      layers: session.layers.map(l =>
        l.id === layerId ? { ...l, visible: !l.visible } : l
      ),
      updatedAt: new Date().toISOString(),
    };

    saveToStorage(updatedSession);
    set({ session: updatedSession });
  },

  importDemoData: () => {
    const { session } = get();
    if (!session) return { added: 0, skipped: 0, collisions: 0 };

    const result = importLayersWithDeduplication(session, demoLayers, '演示数据_重复导入测试.dwg');
    saveToStorage(result.updatedSession);
    set({ session: result.updatedSession });
    return result.stats;
  },

  importCustomLayers: (layers, fileName) => {
    const { session } = get();
    if (!session) return { added: 0, skipped: 0, collisions: 0 };

    const result = importLayersWithDeduplication(session, layers, fileName);
    saveToStorage(result.updatedSession);
    set({ session: result.updatedSession });
    return result.stats;
  },

  updateNote: (collisionId, note) => {
    const { session } = get();
    if (!session) return;

    const updatedSession = updateManualNote(session, collisionId, note);
    saveToStorage(updatedSession);
    set({ session: updatedSession });
  },

  attachCollisionScreenshot: (collisionId, dataUrl) => {
    const { session } = get();
    if (!session) return;

    const updatedSession = attachScreenshot(session, collisionId, dataUrl);
    saveToStorage(updatedSession);
    set({ session: updatedSession });
  },

  updateCollisionStatus: (collisionId, status) => {
    const { session } = get();
    if (!session) return;

    const updatedSession = {
      ...session,
      collisions: session.collisions.map(c =>
        c.id === collisionId ? { ...c, status } : c
      ),
      updatedAt: new Date().toISOString(),
    };

    saveToStorage(updatedSession);
    set({ session: updatedSession });
  },

  getFilteredCollisions: () => {
    const { session, filterSeverity, showBoundary, showDuplicates } = get();
    if (!session) return [];

    return session.collisions.filter(c => {
      if (!filterSeverity.includes(c.severity)) return false;
      if (!showBoundary && c.isBoundary) return false;
      if (!showDuplicates && c.duplicateOf) return false;
      return true;
    });
  },

  getLayerById: (id) => {
    const { session } = get();
    return session?.layers.find(l => l.id === id);
  },
}));
