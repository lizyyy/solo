
import { create } from 'zustand';
import { CollisionPoint } from '../types/model';

interface CollisionState {
  collisions: CollisionPoint[];
  selectedCollisionId: string | null;
  isDetecting: boolean;
  softCollisionThreshold: number;
  
  setCollisions: (collisions: CollisionPoint[]) => void;
  setSelectedCollision: (id: string | null) => void;
  setIsDetecting: (detecting: boolean) => void;
  setSoftCollisionThreshold: (threshold: number) => void;
  resolveCollision: (id: string, resolved: boolean) => void;
  clearCollisions: () => void;
  getCollisionById: (id: string) => CollisionPoint | undefined;
  getStatistics: () => {
    total: number;
    hard: number;
    soft: number;
    resolved: number;
    critical: number;
    major: number;
    minor: number;
  };
}

export const useCollisionStore = create<CollisionState>((set, get) => ({
  collisions: [],
  selectedCollisionId: null,
  isDetecting: false,
  softCollisionThreshold: 0.1,

  setCollisions: (collisions) => set({ collisions }),

  setSelectedCollision: (id) => set({ selectedCollisionId: id }),

  setIsDetecting: (detecting) => set({ isDetecting: detecting }),

  setSoftCollisionThreshold: (threshold) => set({ softCollisionThreshold: threshold }),

  resolveCollision: (id, resolved) => set((state) => ({
    collisions: state.collisions.map(c =>
      c.id === id ? { ...c, resolved } : c
    )
  })),

  clearCollisions: () => set({ collisions: [], selectedCollisionId: null }),

  getCollisionById: (id) => {
    return get().collisions.find(c => c.id === id);
  },

  getStatistics: () => {
    const { collisions } = get();
    return {
      total: collisions.length,
      hard: collisions.filter(c => c.type === 'hard').length,
      soft: collisions.filter(c => c.type === 'soft').length,
      resolved: collisions.filter(c => c.resolved).length,
      critical: collisions.filter(c => c.severity === 'critical').length,
      major: collisions.filter(c => c.severity === 'major').length,
      minor: collisions.filter(c => c.severity === 'minor').length
    };
  }
}));
