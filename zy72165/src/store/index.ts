import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Point, Photo, SchemeVersion, Conflict, FilterState } from '../types';

interface AppState {
  points: Point[];
  photos: Photo[];
  schemes: SchemeVersion[];
  conflicts: Conflict[];
  filters: FilterState;
  addPoint: (point: Omit<Point, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updatePoint: (id: string, updates: Partial<Point>) => void;
  deletePoint: (id: string) => void;
  addPhoto: (photo: Omit<Photo, 'id' | 'uploadedAt'>) => void;
  deletePhoto: (id: string) => void;
  addScheme: (scheme: Omit<SchemeVersion, 'id' | 'createdAt' | 'version'>) => void;
  addConflict: (conflict: Omit<Conflict, 'id' | 'createdAt' | 'resolved'>) => void;
  resolveConflict: (id: string, resolution: string) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  importPoints: (points: Omit<Point, 'id' | 'createdAt' | 'updatedAt'>[]) => void;
  getFilteredPoints: () => Point[];
  getPhotosByPointId: (pointId: string) => Photo[];
  getSchemesByPointId: (pointId: string) => SchemeVersion[];
  getConflictsByPointId: (pointId: string) => Conflict[];
  getPointById: (id: string) => Point | undefined;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      points: [],
      photos: [],
      schemes: [],
      conflicts: [],
      filters: {
        search: '',
        status: 'all',
        hospital: '',
        source: 'all',
      },

      addPoint: (point) => {
        const now = new Date().toISOString();
        set((state) => ({
          points: [
            ...state.points,
            {
              ...point,
              id: generateId(),
              createdAt: now,
              updatedAt: now,
            },
          ],
        }));
      },

      updatePoint: (id, updates) => {
        set((state) => ({
          points: state.points.map((p) =>
            p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
          ),
        }));
      },

      deletePoint: (id) => {
        set((state) => ({
          points: state.points.filter((p) => p.id !== id),
          photos: state.photos.filter((p) => p.pointId !== id),
          schemes: state.schemes.filter((s) => s.pointId !== id),
          conflicts: state.conflicts.filter((c) => c.pointId !== id),
        }));
      },

      addPhoto: (photo) => {
        set((state) => ({
          photos: [
            ...state.photos,
            {
              ...photo,
              id: generateId(),
              uploadedAt: new Date().toISOString(),
            },
          ],
        }));
      },

      deletePhoto: (id) => {
        set((state) => ({
          photos: state.photos.filter((p) => p.id !== id),
        }));
      },

      addScheme: (scheme) => {
        const pointSchemes = get().schemes.filter((s) => s.pointId === scheme.pointId);
        const nextVersion = pointSchemes.length > 0
          ? Math.max(...pointSchemes.map((s) => s.version)) + 1
          : 1;

        set((state) => ({
          schemes: [
            ...state.schemes,
            {
              ...scheme,
              id: generateId(),
              version: nextVersion,
              createdAt: new Date().toISOString(),
            },
          ],
        }));
      },

      addConflict: (conflict) => {
        set((state) => ({
          conflicts: [
            ...state.conflicts,
            {
              ...conflict,
              id: generateId(),
              resolved: false,
              createdAt: new Date().toISOString(),
            },
          ],
        }));
      },

      resolveConflict: (id, resolution) => {
        set((state) => ({
          conflicts: state.conflicts.map((c) =>
            c.id === id ? { ...c, resolved: true, resolution } : c
          ),
        }));
      },

      setFilters: (filters) => {
        set((state) => ({
          filters: { ...state.filters, ...filters },
        }));
      },

      importPoints: (points) => {
        const now = new Date().toISOString();
        set((state) => ({
          points: [
            ...state.points,
            ...points.map((p) => ({
              ...p,
              id: generateId(),
              createdAt: now,
              updatedAt: now,
            })),
          ],
        }));
      },

      getFilteredPoints: () => {
        const { points, filters } = get();
        return points.filter((p) => {
          if (filters.search && !p.name.toLowerCase().includes(filters.search.toLowerCase()) &&
              !p.location.toLowerCase().includes(filters.search.toLowerCase()) &&
              !p.rawNote.toLowerCase().includes(filters.search.toLowerCase())) {
            return false;
          }
          if (filters.status !== 'all' && p.status !== filters.status) {
            return false;
          }
          if (filters.hospital && !p.hospital.includes(filters.hospital)) {
            return false;
          }
          if (filters.source !== 'all' && p.source !== filters.source) {
            return false;
          }
          return true;
        });
      },

      getPhotosByPointId: (pointId) => {
        return get().photos.filter((p) => p.pointId === pointId);
      },

      getSchemesByPointId: (pointId) => {
        return get().schemes
          .filter((s) => s.pointId === pointId)
          .sort((a, b) => b.version - a.version);
      },

      getConflictsByPointId: (pointId) => {
        return get().conflicts.filter((c) => c.pointId === pointId);
      },

      getPointById: (id) => {
        return get().points.find((p) => p.id === id);
      },
    }),
    {
      name: 'parking-inducement-storage',
      partialize: (state) => ({
        points: state.points,
        photos: state.photos,
        schemes: state.schemes,
        conflicts: state.conflicts,
      }),
    }
  )
);
