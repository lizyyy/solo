import type { TrackPoint, Position } from '../types';
import { TRACK_WIDTH, TRACK_HEIGHT } from '../physics/constants';

const generateFigure8Track = (numPoints: number = 360): TrackPoint[] => {
  const points: TrackPoint[] = [];
  const centerX = TRACK_WIDTH / 2;
  const centerY = TRACK_HEIGHT / 2;
  const radiusX = TRACK_WIDTH * 0.4;
  const radiusY = TRACK_HEIGHT * 0.35;
  
  for (let i = 0; i < numPoints; i++) {
    const t = (i / numPoints) * Math.PI * 2;
    const x = centerX + radiusX * Math.sin(t);
    const y = centerY + radiusY * Math.sin(t * 2) * 0.8;
    
    let sector: number;
    if (i < numPoints / 3) {
      sector = 0;
    } else if (i < (numPoints * 2) / 3) {
      sector = 1;
    } else {
      sector = 2;
    }
    
    points.push({ x, y, curvature: 0, sector });
  }
  
  for (let i = 0; i < numPoints; i++) {
    const prev = points[(i - 2 + numPoints) % numPoints];
    const curr = points[i];
    const next = points[(i + 2) % numPoints];
    
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    
    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    
    const cross = dx1 * dy2 - dy1 * dx2;
    const curvature = cross / (len1 * len2);
    
    points[i].curvature = curvature;
  }
  
  return points;
};

export const TRACK_POINTS = generateFigure8Track();

export const getTrackPoint = (progress: number): TrackPoint => {
  const index = Math.floor(progress * TRACK_POINTS.length) % TRACK_POINTS.length;
  return TRACK_POINTS[index];
};

export const getTrackSegment = (progress: number, lookAhead: number = 5): TrackPoint[] => {
  const startIndex = Math.floor(progress * TRACK_POINTS.length) % TRACK_POINTS.length;
  const segment: TrackPoint[] = [];
  
  for (let i = 0; i < lookAhead; i++) {
    const index = (startIndex + i) % TRACK_POINTS.length;
    segment.push(TRACK_POINTS[index]);
  }
  
  return segment;
};

export const getHeading = (progress: number): number => {
  const curr = getTrackPoint(progress);
  const next = getTrackPoint(progress + 0.002);
  const dx = next.x - curr.x;
  const dy = next.y - curr.y;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
};

export const getCurvature = (progress: number): number => {
  const point = getTrackPoint(progress);
  return point.curvature;
};

export const getSector = (progress: number): number => {
  const point = getTrackPoint(progress);
  return point.sector;
};

export const moveAlongTrack = (
  progress: number,
  distance: number
): { newProgress: number; position: Position; heading: number } => {
  const trackLength = TRACK_POINTS.length;
  const totalDist = trackLength * 0.5;
  const deltaProgress = distance / totalDist;
  
  let newProgress = progress + deltaProgress;
  while (newProgress >= 1) newProgress -= 1;
  while (newProgress < 0) newProgress += 1;
  
  const point = getTrackPoint(newProgress);
  const heading = getHeading(newProgress);
  
  return {
    newProgress,
    position: { x: point.x, y: point.y },
    heading
  };
};

export const getTrackLength = (): number => {
  let length = 0;
  for (let i = 0; i < TRACK_POINTS.length; i++) {
    const p1 = TRACK_POINTS[i];
    const p2 = TRACK_POINTS[(i + 1) % TRACK_POINTS.length];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length;
};

export const getSectorStartProgress = (sector: number): number => {
  return sector / 3;
};
