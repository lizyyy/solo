import { Borehole, Layer, MarkType, LayerMark } from '../types';

const STORAGE_KEY_MARKS = 'drilling_stratum_marks';
const STORAGE_KEY_DATA = 'drilling_stratum_data';

interface StoredMark {
  layerId: string;
  boreholeId: string;
  layerIndex: number;
  markType: MarkType;
  note?: string;
  timestamp: number;
}

interface StoredMarks {
  version: string;
  marks: StoredMark[];
  createdAt: number;
}

export function saveMarks(boreholes: Borehole[]): void {
  const marks: StoredMark[] = [];

  boreholes.forEach(borehole => {
    borehole.layers.forEach(layer => {
      if (layer.mark && layer.mark.type !== 'none') {
        marks.push({
          layerId: layer.id,
          boreholeId: borehole.id,
          layerIndex: layer.layerIndex,
          markType: layer.mark.type,
          note: layer.mark.note,
          timestamp: layer.mark.timestamp,
        });
      }
    });
  });

  const data: StoredMarks = {
    version: '1.0',
    marks,
    createdAt: Date.now(),
  };

  localStorage.setItem(STORAGE_KEY_MARKS, JSON.stringify(data));
}

export function loadMarks(boreholes: Borehole[]): number {
  const stored = localStorage.getItem(STORAGE_KEY_MARKS);
  if (!stored) return 0;

  try {
    const data: StoredMarks = JSON.parse(stored);
    let loadedCount = 0;

    data.marks.forEach(storedMark => {
      const borehole = boreholes.find(b => b.id === storedMark.boreholeId);
      if (!borehole) return;

      const layer = borehole.layers.find(
        l => l.id === storedMark.layerId || l.layerIndex === storedMark.layerIndex
      );
      if (!layer) return;

      layer.mark = {
        type: storedMark.markType,
        note: storedMark.note,
        timestamp: storedMark.timestamp,
      };
      loadedCount++;
    });

    return loadedCount;
  } catch (e) {
    console.error('Failed to load marks:', e);
    return 0;
  }
}

export function setLayerMark(
  boreholes: Borehole[],
  layerId: string,
  markType: MarkType,
  note?: string
): boolean {
  for (const borehole of boreholes) {
    const layer = borehole.layers.find(l => l.id === layerId);
    if (layer) {
      if (markType === 'none') {
        delete layer.mark;
      } else {
        layer.mark = {
          type: markType,
          note,
          timestamp: Date.now(),
        };
      }
      return true;
    }
  }
  return false;
}

export function clearAllMarks(boreholes: Borehole[]): void {
  boreholes.forEach(borehole => {
    borehole.layers.forEach(layer => {
      delete layer.mark;
    });
  });
  localStorage.removeItem(STORAGE_KEY_MARKS);
}

export function getMarksSummary(boreholes: Borehole[]): {
  total: number;
  suspicious: number;
  confirmed: number;
  danger: number;
} {
  let total = 0, suspicious = 0, confirmed = 0, danger = 0;

  boreholes.forEach(borehole => {
    borehole.layers.forEach(layer => {
      if (layer.mark && layer.mark.type !== 'none') {
        total++;
        switch (layer.mark.type) {
          case 'suspicious': suspicious++; break;
          case 'confirmed': confirmed++; break;
          case 'danger': danger++; break;
        }
      }
    });
  });

  return { total, suspicious, confirmed, danger };
}
