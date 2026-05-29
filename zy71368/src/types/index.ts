export interface Wall {
  id: string;
  width: number;
  height: number;
  floorOffset: number;
  sightLineHeight: number;
  createdAt: string;
  updatedAt: string;
}

export interface Artwork {
  id: string;
  wallId: string;
  name: string;
  frameWidth: number;
  frameHeight: number;
  posX: number;
  posY: number;
  orderIndex: number;
  centerHeight: number;
  sightLineDeviation: number;
  hasCollision: boolean;
  collisionWith: string[];
  createdAt: string;
  updatedAt: string;
}

export type ObstacleType = 'switch' | 'fire_extinguisher' | 'pipe' | 'outlet' | 'other';

export interface Obstacle {
  id: string;
  wallId: string;
  name: string;
  obstacleType: ObstacleType;
  posX: number;
  posY: number;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
}

export type HistoryAction = 'create' | 'update' | 'delete' | 'auto_calc' | 'collision_fix';
export type HistoryEntityType = 'wall' | 'artwork' | 'obstacle';
export type HistorySource = 'user' | 'auto_calc' | 'collision_fix' | 'drag';

export interface HistoryEntry {
  id: string;
  entityType: HistoryEntityType;
  entityId: string;
  action: HistoryAction;
  field: string;
  oldValue: string;
  newValue: string;
  source: HistorySource;
  timestamp: string;
}

export interface ExhibitionReport {
  wall: Wall;
  artworks: Artwork[];
  obstacles: Obstacle[];
  historyEntries: HistoryEntry[];
  generatedAt: string;
}
