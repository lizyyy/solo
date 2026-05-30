import { create } from 'zustand';
import type { DataMaterial, SurfaceData, Point3D, Vector3D, UVPoint } from '../types/surface';

interface SurfaceState {
  materials: DataMaterial[];
  vertices: Point3D[];
  normals: Vector3D[];
  uvs: UVPoint[];
  indices: number[];
  boundaryPoints: Point3D[];
  samplePoints: Point3D[];
  isLoaded: boolean;

  addMaterial: (material: DataMaterial) => void;
  removeMaterial: (id: string) => void;
  updateMaterial: (id: string, updates: Partial<DataMaterial>) => void;
  setSurfaceData: (data: Partial<SurfaceData>) => void;
  clearAll: () => void;
  setProcessed: (materialId: string) => void;
}

export const useSurfaceStore = create<SurfaceState>((set) => ({
  materials: [],
  vertices: [],
  normals: [],
  uvs: [],
  indices: [],
  boundaryPoints: [],
  samplePoints: [],
  isLoaded: false,

  addMaterial: (material) =>
    set((state) => ({
      materials: [...state.materials, material],
      isLoaded: true,
    })),

  removeMaterial: (id) =>
    set((state) => ({
      materials: state.materials.filter((m) => m.id !== id),
    })),

  updateMaterial: (id, updates) =>
    set((state) => ({
      materials: state.materials.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ),
    })),

  setSurfaceData: (data) =>
    set(() => ({
      ...data,
      isLoaded: true,
    })),

  clearAll: () =>
    set(() => ({
      materials: [],
      vertices: [],
      normals: [],
      uvs: [],
      indices: [],
      boundaryPoints: [],
      samplePoints: [],
      isLoaded: false,
    })),

  setProcessed: (materialId) =>
    set((state) => ({
      materials: state.materials.map((m) =>
        m.id === materialId ? { ...m, status: 'processed' as const } : m
      ),
    })),
}));
