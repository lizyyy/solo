import * as THREE from 'three';
import { Artwork } from '../types/artwork';
import { ClusterResult } from '../types/colorSpace';
import { hslTo3DPosition } from './hslCalculator';

export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const groupKey = String(item[key]);
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

export function calculateMeanPosition(positions: THREE.Vector3[]): THREE.Vector3 {
  if (positions.length === 0) return new THREE.Vector3(0, 0, 0);
  
  const sum = positions.reduce((acc, pos) => acc.add(pos), new THREE.Vector3(0, 0, 0));
  return sum.divideScalar(positions.length);
}

export function calculateClassClusters(artworks: Artwork[]): ClusterResult[] {
  const validArtworks = artworks.filter(a => a.hue !== null && a.saturation !== null && a.lightness !== null);
  const classGroups = groupBy(validArtworks, 'classId');
  
  return Object.entries(classGroups).map(([classId, classArtworks]) => {
    const positions = classArtworks.map(a => hslTo3DPosition(a.hue!, a.saturation!, a.lightness!));
    const center = calculateMeanPosition(positions);
    
    return {
      clusterId: `cluster-${classId}`,
      center,
      members: classArtworks.map(a => a.id),
      className: classArtworks[0].className,
      classId,
      color: getClassColor(classId)
    };
  });
}

export function calculateColorClusters(artworks: Artwork[], k: number = 5): ClusterResult[] {
  const validArtworks = artworks.filter(a => a.hue !== null && a.saturation !== null && a.lightness !== null);
  const positions = validArtworks.map(a => hslTo3DPosition(a.hue!, a.saturation!, a.lightness!));
  
  if (positions.length < k) {
    k = Math.max(1, positions.length);
  }
  
  const centroids = kMeans(positions, k);
  const assignments = assignToClusters(positions, centroids);
  
  return centroids.map((center, idx) => {
    const memberIndices = assignments
      .map((a, i) => a === idx ? i : -1)
      .filter(i => i >= 0);
    
    return {
      clusterId: `color-cluster-${idx}`,
      center,
      members: memberIndices.map(i => validArtworks[i].id),
      className: `色彩聚类 ${idx + 1}`,
      classId: `color-${idx}`,
      color: getClusterColor(idx)
    };
  }).filter(c => c.members.length > 0);
}

function kMeans(positions: THREE.Vector3[], k: number, maxIterations: number = 100): THREE.Vector3[] {
  if (positions.length === 0) return [];
  
  let centroids = initializeCentroids(positions, k);
  let assignments = assignToClusters(positions, centroids);
  
  for (let iter = 0; iter < maxIterations; iter++) {
    const newCentroids = updateCentroids(positions, assignments, k);
    const newAssignments = assignToClusters(positions, newCentroids);
    
    if (arraysEqual(assignments, newAssignments)) {
      break;
    }
    
    centroids = newCentroids;
    assignments = newAssignments;
  }
  
  return centroids;
}

function initializeCentroids(positions: THREE.Vector3[], k: number): THREE.Vector3[] {
  const shuffled = [...positions].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, k).map(p => p.clone());
}

function assignToClusters(positions: THREE.Vector3[], centroids: THREE.Vector3[]): number[] {
  return positions.map(pos => {
    let minDist = Infinity;
    let closestIdx = 0;
    
    centroids.forEach((centroid, idx) => {
      const dist = pos.distanceTo(centroid);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = idx;
      }
    });
    
    return closestIdx;
  });
}

function updateCentroids(positions: THREE.Vector3[], assignments: number[], k: number): THREE.Vector3[] {
  const clusters: THREE.Vector3[][] = Array.from({ length: k }, () => []);
  
  positions.forEach((pos, idx) => {
    clusters[assignments[idx]].push(pos);
  });
  
  return clusters.map(cluster => {
    if (cluster.length === 0) {
      return positions[Math.floor(Math.random() * positions.length)].clone();
    }
    return calculateMeanPosition(cluster);
  });
}

function arraysEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((val, idx) => val === b[idx]);
}

function getClassColor(classId: string): string {
  const colors = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];
  const hash = classId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

function getClusterColor(idx: number): string {
  const colors = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];
  return colors[idx % colors.length];
}

export function getDistanceFromCenter(position: THREE.Vector3): number {
  return position.length();
}
