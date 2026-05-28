import { create } from 'zustand';
import type { Work, ColorSwatch, DistanceRecord, DirtyDataAlert, Cluster, PendingRecord } from '@/data/types';
import { WORKS, SWATCHES, PENDING_RECORDS } from '@/data/mockData';
import { ciede2000FromHex, computeHueDistance, computeComponentDistances } from '@/utils/ciede2000';
import { hexToHsl, euclideanRgbDistance } from '@/utils/colorSpace';
import { computeWorkDistance, agglomerativeClustering, extractClusters } from '@/utils/clustering';
import { detectDirtyData } from '@/utils/dirtyDetection';

interface AppState {
  works: Work[];
  swatches: ColorSwatch[];
  distances: DistanceRecord[];
  dirtyAlerts: DirtyDataAlert[];
  clusters: Cluster[];
  pendingRecords: PendingRecord[];
  clusterThreshold: number;
  selectedWorkId: string | null;

  setClusterThreshold: (t: number) => void;
  selectWork: (id: string | null) => void;
  resolveAlert: (id: string) => void;
  togglePending: (id: string) => void;
  recompute: () => void;
}

function computeAllDistances(works: Work[], swatches: ColorSwatch[]): DistanceRecord[] {
  const records: DistanceRecord[] = [];
  let idx = 0;

  for (let i = 0; i < works.length; i++) {
    for (let j = i + 1; j < works.length; j++) {
      const swA = swatches.filter(s => s.workId === works[i].id && !s.isBackground);
      const swB = swatches.filter(s => s.workId === works[j].id && !s.isBackground);

      let totalCiede = 0;
      let totalHue = 0;
      let totalLightness = 0;
      let totalSaturation = 0;
      let pairs = 0;

      for (const a of swA) {
        let minCiede = Infinity, minHue = Infinity, minLight = Infinity, minSat = Infinity;
        for (const b of swB) {
          const ciede = ciede2000FromHex(a.hex, b.hex);
          const hslA = hexToHsl(a.hex);
          const hslB = hexToHsl(b.hex);
          const comp = computeComponentDistances(hslA, hslB);
          if (ciede < minCiede) {
            minCiede = ciede;
            minHue = comp.hue;
            minLight = comp.lightness;
            minSat = comp.saturation;
          }
        }
        totalCiede += minCiede;
        totalHue += minHue;
        totalLightness += minLight;
        totalSaturation += minSat;
        pairs++;
      }

      for (const b of swB) {
        let minCiede = Infinity, minHue = Infinity, minLight = Infinity, minSat = Infinity;
        for (const a of swA) {
          const ciede = ciede2000FromHex(a.hex, b.hex);
          const hslA = hexToHsl(a.hex);
          const hslB = hexToHsl(b.hex);
          const comp = computeComponentDistances(hslA, hslB);
          if (ciede < minCiede) {
            minCiede = ciede;
            minHue = comp.hue;
            minLight = comp.lightness;
            minSat = comp.saturation;
          }
        }
        totalCiede += minCiede;
        totalHue += minHue;
        totalLightness += minLight;
        totalSaturation += minSat;
        pairs++;
      }

      const avgTotal = pairs > 0 ? totalCiede / pairs : 100;
      const avgHue = pairs > 0 ? totalHue / pairs : 0;
      const avgLight = pairs > 0 ? totalLightness / pairs : 0;
      const avgSat = pairs > 0 ? totalSaturation / pairs : 0;

      const eucRgb = pairs > 0
        ? swA.reduce((s, a) => s + swB.reduce((s2, b) => s2 + euclideanRgbDistance(a.hex, b.hex), 0), 0) / (swA.length * swB.length)
        : 0;

      records.push({
        id: `dist-${idx++}`,
        workAId: works[i].id,
        workBId: works[j].id,
        totalDistance: Math.round(avgTotal * 100) / 100,
        hueDistance: Math.round(avgHue * 100) / 100,
        lightnessDistance: Math.round(avgLight * 100) / 100,
        saturationDistance: Math.round(avgSat * 100) / 100,
        ciede2000: Math.round(avgTotal * 100) / 100,
        euclideanRgb: Math.round(eucRgb * 100) / 100,
      });
    }
  }

  return records;
}

function computeClusterData(works: Work[], swatches: ColorSwatch[], threshold: number): Cluster[] {
  const nodes = agglomerativeClustering(works, swatches, threshold);
  return extractClusters(nodes, works, swatches);
}

export const useStore = create<AppState>((set, get) => {
  const initialDistances = computeAllDistances(WORKS, SWATCHES);
  const initialAlerts = detectDirtyData(WORKS, SWATCHES);
  const initialClusters = computeClusterData(WORKS, SWATCHES, 15);

  return {
    works: WORKS,
    swatches: SWATCHES,
    distances: initialDistances,
    dirtyAlerts: initialAlerts,
    clusters: initialClusters,
    pendingRecords: PENDING_RECORDS,
    clusterThreshold: 15,
    selectedWorkId: null,

    setClusterThreshold: (t: number) => {
      set({ clusterThreshold: t });
      const { works, swatches } = get();
      const clusters = computeClusterData(works, swatches, t);
      set({ clusters });
    },

    selectWork: (id: string | null) => set({ selectedWorkId: id }),

    resolveAlert: (id: string) => {
      set(state => ({
        dirtyAlerts: state.dirtyAlerts.map(a =>
          a.id === id ? { ...a, resolved: true } : a
        ),
      }));
    },

    togglePending: (id: string) => {
      set(state => ({
        pendingRecords: state.pendingRecords.map(p =>
          p.id === id ? { ...p, completed: !p.completed } : p
        ),
      }));
    },

    recompute: () => {
      const { works, swatches, clusterThreshold } = get();
      const distances = computeAllDistances(works, swatches);
      const alerts = detectDirtyData(works, swatches);
      const clusters = computeClusterData(works, swatches, clusterThreshold);
      set({ distances, dirtyAlerts: alerts, clusters });
    },
  };
});
