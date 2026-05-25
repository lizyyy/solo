
import * as THREE from 'three';

export type ElementType = 'cable_tray' | 'duct' | 'fire_pipe';

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface ModelElement {
  id: string;
  type: ElementType;
  name: string;
  elevation: number;
  points: Point3D[];
  radius: number;
  version: number;
  visible: boolean;
  color: string;
  system?: string;
  diameter?: number;
}

export type CollisionType = 'hard' | 'soft';
export type CollisionSeverity = 'critical' | 'major' | 'minor';

export interface CollisionPoint {
  id: string;
  elementA: string;
  elementB: string;
  position: Point3D;
  type: CollisionType;
  distance: number;
  severity: CollisionSeverity;
  resolved: boolean;
  timestamp: number;
  note?: string;
}

export interface FilterState {
  types: ElementType[];
  elevationRange: [number, number];
  versions: number[];
  showOnlyColliding: boolean;
  searchText: string;
}

export interface CameraPreset {
  name: string;
  position: Point3D;
  target: Point3D;
}

export interface ViewState {
  cameraPosition: Point3D;
  cameraTarget: Point3D;
  isOrthographic: boolean;
}

export interface VersionInfo {
  number: number;
  timestamp: number;
  description: string;
  author: string;
}
