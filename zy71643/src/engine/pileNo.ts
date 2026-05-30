import type { Point3D, PipelineSegment, PileMarker } from '../types';
import { pointToSegmentDistance } from './distance';

export function parsePileNo(pileNo: string): number | null {
  if (!pileNo) return null;

  const match = pileNo.match(/K(\d+)\+(\d+(?:\.\d+)?)/);
  if (match) {
    const km = parseInt(match[1], 10);
    const meters = parseFloat(match[2]);
    return km * 1000 + meters;
  }

  const simpleMatch = pileNo.match(/(\d+(?:\.\d+)?)/);
  if (simpleMatch) {
    return parseFloat(simpleMatch[1]);
  }

  return null;
}

export function formatPileNo(meters: number): string {
  const km = Math.floor(meters / 1000);
  const m = (meters % 1000).toFixed(0);
  return `K${km}+${m.padStart(3, '0')}`;
}

export function findNearestPileMarker(
  position: Point3D,
  markers: PileMarker[]
): PileMarker | null {
  if (markers.length === 0) return null;

  let nearest = markers[0];
  let minDist = Infinity;

  for (const marker of markers) {
    const dx = position.x - marker.position.x;
    const dy = position.z - marker.position.z;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < minDist) {
      minDist = dist;
      nearest = marker;
    }
  }

  return nearest;
}

export function estimatePileNoAtPoint(
  position: Point3D,
  segments: PipelineSegment[]
): string {
  let bestSeg: PipelineSegment | null = null;
  let bestT = 0;
  let minDist = Infinity;

  for (const seg of segments) {
    const result = pointToSegmentDistance(position, seg);
    if (result.distance < minDist) {
      minDist = result.distance;
      bestSeg = seg;
      bestT = result.t;
    }
  }

  if (!bestSeg) return '';

  const startMeters = parsePileNo(bestSeg.startPileNo);
  const endMeters = parsePileNo(bestSeg.endPileNo);

  if (startMeters !== null && endMeters !== null) {
    const meters = startMeters + (endMeters - startMeters) * bestT;
    return formatPileNo(meters);
  }

  return bestSeg.startPileNo || bestSeg.endPileNo || '';
}

export function searchSegmentsByPileNo(
  pileNoQuery: string,
  segments: PipelineSegment[]
): PipelineSegment[] {
  const query = pileNoQuery.toLowerCase().trim();
  if (!query) return [];

  const queryMeters = parsePileNo(query);

  return segments.filter((seg) => {
    if (seg.startPileNo.toLowerCase().includes(query) || seg.endPileNo.toLowerCase().includes(query)) {
      return true;
    }

    if (queryMeters !== null) {
      const startM = parsePileNo(seg.startPileNo);
      const endM = parsePileNo(seg.endPileNo);
      if (startM !== null && endM !== null) {
        const minM = Math.min(startM, endM);
        const maxM = Math.max(startM, endM);
        return queryMeters >= minM && queryMeters <= maxM;
      }
    }

    return false;
  });
}

export function getPileNoFromPoint(
  x: number,
  roadStartX: number = 0,
  pileSpacing: number = 50
): string {
  const offset = x - roadStartX;
  const meters = Math.max(0, Math.round(offset / pileSpacing) * pileSpacing);
  return formatPileNo(meters);
}
