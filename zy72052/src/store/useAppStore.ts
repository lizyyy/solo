import { create } from 'zustand';
import { Point, Photo, Scheme, FilterCriteria, ConflictEvidence, SoundRayPath } from '@/types';
import { mockPoints } from '@/data/points';
import { mockPhotos } from '@/data/photos';
import { mockSchemes } from '@/data/schemes';
import { validatePoints } from '@/core/dataValidator';
import { filterPoints, buildFilterSummary } from '@/core/filterEngine';
import { detectConflicts } from '@/core/conflictDetector';
import { calculateRayPaths, isChamberInAnyPath } from '@/core/acousticCalculator';

interface AppState {
  points: Point[];
  photos: Photo[];
  schemes: Scheme[];
  filteredPoints: Point[];
  selectedPointId: string | null;
  filterCriteria: FilterCriteria;
  filterSummary: string;
  conflicts: ConflictEvidence[];
  rayPaths: SoundRayPath[];
  showRayAnimation: boolean;
  sidebarOpen: boolean;
  currentDate: string;

  init: () => void;
  setFilterCriteria: (criteria: FilterCriteria) => void;
  selectPoint: (id: string | null) => void;
  toggleSidebar: () => void;
  setCurrentDate: (date: string) => void;
  setShowRayAnimation: (show: boolean) => void;
  getSelectedPoint: () => Point | undefined;
  isPointInRayPath: (pointId: string) => boolean;
}

const defaultDate = '2024-12-01';

const defaultCriteria: FilterCriteria = {
  types: [],
  statuses: [],
  schemeVersions: [],
  dateRange: [defaultDate, defaultDate],
  onlyReflectionChambers: false,
  onlyAnomalies: false
};

export const useAppStore = create<AppState>((set, get) => ({
  points: [],
  photos: mockPhotos,
  schemes: mockSchemes,
  filteredPoints: [],
  selectedPointId: null,
  filterCriteria: defaultCriteria,
  filterSummary: '全部',
  conflicts: [],
  rayPaths: [],
  showRayAnimation: false,
  sidebarOpen: true,
  currentDate: '2024-12-01',

  init: () => {
    const validatedPoints = validatePoints(mockPoints);
    const filteredPoints = filterPoints(validatedPoints, defaultCriteria);
    const conflicts = detectConflicts(validatedPoints, mockPhotos, mockSchemes);

    const source = validatedPoints.find(p => p.type === 'speaker');
    const listener = validatedPoints.find(p => p.type === 'microphone');
    const chambers = validatedPoints.filter(p => p.isReflectionChamber);

    const rayPaths = source && listener
      ? calculateRayPaths(
          { x: source.x || 5, y: source.y || 2.5, z: source.z || 1 },
          chambers,
          { x: listener.x || 5, y: listener.y || 1.2, z: listener.z || 5 }
        )
      : [];

    set({
      points: validatedPoints,
      filteredPoints,
      conflicts,
      rayPaths
    });
  },

  setFilterCriteria: (criteria: FilterCriteria) => {
    const { points } = get();
    const filteredPoints = filterPoints(points, criteria);
    const filterSummary = buildFilterSummary(criteria);
    set({ filterCriteria: criteria, filteredPoints, filterSummary });
  },

  selectPoint: (id: string | null) => {
    const state = get();
    const showRay = id !== null && state.points.find(p => p.id === id)?.isReflectionChamber === true;
    set({ selectedPointId: id, showRayAnimation: showRay });
  },

  toggleSidebar: () => {
    set(s => ({ sidebarOpen: !s.sidebarOpen }));
  },

  setCurrentDate: (date: string) => {
    const { points, filterCriteria } = get();
    const newCriteria: FilterCriteria = {
      ...filterCriteria,
      dateRange: [date, date]
    };
    const filteredPoints = filterPoints(points, newCriteria);
    const filterSummary = buildFilterSummary(newCriteria);
    set({
      currentDate: date,
      filterCriteria: newCriteria,
      filteredPoints,
      filterSummary
    });
  },

  setShowRayAnimation: (show: boolean) => {
    set({ showRayAnimation: show });
  },

  getSelectedPoint: () => {
    const { points, selectedPointId } = get();
    return points.find(p => p.id === selectedPointId);
  },

  isPointInRayPath: (pointId: string) => {
    const { rayPaths } = get();
    return isChamberInAnyPath(pointId, rayPaths);
  }
}));
