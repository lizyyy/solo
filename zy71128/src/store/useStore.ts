import { create } from 'zustand';
import { Watchtower, PatrolRoute, BlindSpot, FirePoint, Season, CoverageAnalysis, Position3D } from '../types';
import { WATCHTOWERS } from '../data/watchtowers';
import { PATROL_ROUTES } from '../data/routes';
import { FIRE_POINTS } from '../data/firePoints';
import { SEASONS } from '../data/seasons';
import { TERRAIN_DATA } from '../data/terrain';
import { TREES } from '../data/trees';
import { calculateCoverageMap, detectBlindSpots, calculateCoverageStats } from '../utils/visibility';

interface AppState {
  season: Season;
  watchtowers: Watchtower[];
  routes: PatrolRoute[];
  blindSpots: BlindSpot[];
  firePoints: FirePoint[];
  coverageMap: boolean[][];
  coverageStats: CoverageAnalysis;
  
  selectedWatchtower: string | null;
  selectedRoute: string | null;
  selectedBlindSpot: string | null;
  
  showCoverage: boolean;
  showBlindSpots: boolean;
  showRoutes: boolean;
  showTrees: boolean;
  showFirePoints: boolean;
  
  isPlaying: boolean;
  currentTime: number;
  cameraPosition: Position3D;
  
  setSeason: (season: Season) => void;
  toggleWatchtower: (id: string) => void;
  toggleRoute: (id: string) => void;
  selectWatchtower: (id: string | null) => void;
  selectRoute: (id: string | null) => void;
  selectBlindSpot: (id: string | null) => void;
  
  setShowCoverage: (show: boolean) => void;
  setShowBlindSpots: (show: boolean) => void;
  setShowRoutes: (show: boolean) => void;
  setShowTrees: (show: boolean) => void;
  setShowFirePoints: (show: boolean) => void;
  
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number | ((prev: number) => number)) => void;
  setCameraPosition: (pos: Position3D) => void;
  
  resetState: () => void;
  recalculateCoverage: () => void;
  importData: (data: any) => void;
}

const initialCoverageMap = calculateCoverageMap(WATCHTOWERS, TERRAIN_DATA, TREES, SEASONS[1]);
const initialBlindSpots = detectBlindSpots(WATCHTOWERS, TERRAIN_DATA, TREES, SEASONS[1], initialCoverageMap);
const initialCoverageStats = calculateCoverageStats(initialCoverageMap, initialBlindSpots);

export const useStore = create<AppState>((set, get) => ({
  season: SEASONS[1],
  watchtowers: WATCHTOWERS,
  routes: PATROL_ROUTES,
  blindSpots: initialBlindSpots,
  firePoints: FIRE_POINTS,
  coverageMap: initialCoverageMap,
  coverageStats: initialCoverageStats,
  
  selectedWatchtower: null,
  selectedRoute: null,
  selectedBlindSpot: null,
  
  showCoverage: true,
  showBlindSpots: true,
  showRoutes: true,
  showTrees: true,
  showFirePoints: true,
  
  isPlaying: false,
  currentTime: 0,
  cameraPosition: { x: 80, y: 80, z: 80 },
  
  setSeason: (season) => {
    set({ season });
    get().recalculateCoverage();
  },
  
  toggleWatchtower: (id) => {
    set((state) => ({
      watchtowers: state.watchtowers.map(t =>
        t.id === id ? { ...t, enabled: !t.enabled } : t
      )
    }));
    get().recalculateCoverage();
  },
  
  toggleRoute: (id) => {
    set((state) => ({
      routes: state.routes.map(r =>
        r.id === id ? { ...r, enabled: !r.enabled } : r
      )
    }));
  },
  
  selectWatchtower: (id) => set({ selectedWatchtower: id }),
  selectRoute: (id) => set({ selectedRoute: id }),
  selectBlindSpot: (id) => set({ selectedBlindSpot: id }),
  
  setShowCoverage: (show) => set({ showCoverage: show }),
  setShowBlindSpots: (show) => set({ showBlindSpots: show }),
  setShowRoutes: (show) => set({ showRoutes: show }),
  setShowTrees: (show) => set({ showTrees: show }),
  setShowFirePoints: (show) => set({ showFirePoints: show }),
  
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set((state) => ({ 
    currentTime: typeof time === 'function' ? time(state.currentTime) : time 
  })),
  setCameraPosition: (pos) => set({ cameraPosition: pos }),
  
  importData: (data) => {
    const { season, watchtowers, routes, firePoints, showCoverage, showBlindSpots, showRoutes, showTrees, showFirePoints } = data;
    
    if (season) set({ season });
    if (watchtowers) set({ watchtowers });
    if (routes) set({ routes });
    if (firePoints) set({ firePoints });
    if (typeof showCoverage === 'boolean') set({ showCoverage });
    if (typeof showBlindSpots === 'boolean') set({ showBlindSpots });
    if (typeof showRoutes === 'boolean') set({ showRoutes });
    if (typeof showTrees === 'boolean') set({ showTrees });
    if (typeof showFirePoints === 'boolean') set({ showFirePoints });
    
    get().recalculateCoverage();
  },
  
  resetState: () => {
    const coverageMap = calculateCoverageMap(WATCHTOWERS, TERRAIN_DATA, TREES, SEASONS[1]);
    const blindSpots = detectBlindSpots(WATCHTOWERS, TERRAIN_DATA, TREES, SEASONS[1], coverageMap);
    const coverageStats = calculateCoverageStats(coverageMap, blindSpots);
    
    set({
      season: SEASONS[1],
      watchtowers: WATCHTOWERS,
      routes: PATROL_ROUTES,
      blindSpots,
      firePoints: FIRE_POINTS,
      coverageMap,
      coverageStats,
      selectedWatchtower: null,
      selectedRoute: null,
      selectedBlindSpot: null,
      showCoverage: true,
      showBlindSpots: true,
      showRoutes: true,
      showTrees: true,
      showFirePoints: true,
      isPlaying: false,
      currentTime: 0,
      cameraPosition: { x: 80, y: 80, z: 80 }
    });
  },
  
  recalculateCoverage: () => {
    const { watchtowers, season } = get();
    const coverageMap = calculateCoverageMap(watchtowers, TERRAIN_DATA, TREES, season);
    const blindSpots = detectBlindSpots(watchtowers, TERRAIN_DATA, TREES, season, coverageMap);
    const coverageStats = calculateCoverageStats(coverageMap, blindSpots);
    
    set({ coverageMap, blindSpots, coverageStats });
  }
}));
