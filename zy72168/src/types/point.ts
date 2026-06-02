export interface PointCoordinates {
  lat: number;
  lng: number;
  offset?: boolean;
  originalLat?: number;
  originalLng?: number;
}

export type PointStatus = 'pending' | 'processing' | 'verified' | 'completed' | 'review';

export interface Point {
  id: string;
  name: string;
  aliases: string[];
  address: string;
  coordinates: PointCoordinates;
  status: PointStatus;
  isMerged: boolean;
  mergedFrom?: string[];
  isAdjacent?: boolean;
  adjacentPointIds?: string[];
  timePeriods: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MergeCandidate {
  groupId: string;
  points: Point[];
  similarity: number;
  isAdjacentRisk: boolean;
}
