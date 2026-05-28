import * as THREE from 'three';

export interface HSLPosition {
  x: number;
  y: number;
  z: number;
  hue: number;
  lightness: number;
  saturation: number;
}

export interface ClusterResult {
  clusterId: string;
  center: THREE.Vector3;
  members: string[];
  className: string;
  classId: string;
  color: string;
}

export interface SceneSettings {
  autoRotate: boolean;
  showGrid: boolean;
  showAxes: boolean;
  clusterMode: 'none' | 'class' | 'color';
  showTrails: boolean;
  bloomIntensity: number;
}

export interface StarPointData {
  id: string;
  position: THREE.Vector3;
  color: string;
  size: number;
  artworkId: string;
  qualityFlags: {
    transparentBgRisk: boolean;
    extremeColorRisk: boolean;
    missingData: boolean;
  };
}
