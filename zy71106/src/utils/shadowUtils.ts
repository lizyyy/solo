import * as THREE from 'three';
import { PVComponent, Tree, Roof, SolarPosition } from '../types';

export interface ShadowSamplePoint {
  position: THREE.Vector3;
  isShadowed: boolean;
}

export function generateComponentSamplePoints(
  component: PVComponent,
  gridSize: number = 3
): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const { width, height } = component.size;
  const { x, y, z } = component.position;
  const rotation = component.rotation * (Math.PI / 180);

  const stepX = width / (gridSize + 1);
  const stepZ = height / (gridSize + 1);

  for (let i = 1; i <= gridSize; i++) {
    for (let j = 1; j <= gridSize; j++) {
      const localX = -width / 2 + i * stepX;
      const localZ = -height / 2 + j * stepZ;

      const rotatedX = localX * Math.cos(rotation) - localZ * Math.sin(rotation);
      const rotatedZ = localX * Math.sin(rotation) + localZ * Math.cos(rotation);

      points.push(new THREE.Vector3(
        x + rotatedX,
        y + 0.03,
        z + rotatedZ
      ));
    }
  }

  return points;
}

export function createSceneOccluders(
  trees: Tree[],
  roof: Roof
): THREE.Object3D[] {
  const occluders: THREE.Object3D[] = [];

  trees.forEach((tree) => {
    const trunkHeight = tree.height * 0.4;
    const foliageHeight = tree.height * 0.7;
    const foliageRadius = tree.radius;

    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, trunkHeight, 8);
    const trunkMat = new THREE.MeshBasicMaterial();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(
      tree.position.x,
      trunkHeight / 2,
      tree.position.z
    );
    trunk.userData = { type: 'tree', id: tree.id };
    occluders.push(trunk);

    const foliageGeo = new THREE.ConeGeometry(foliageRadius, foliageHeight, 8);
    const foliageMat = new THREE.MeshBasicMaterial();
    const foliage = new THREE.Mesh(foliageGeo, foliageMat);
    foliage.position.set(
      tree.position.x,
      trunkHeight + foliageHeight / 2,
      tree.position.z
    );
    foliage.userData = { type: 'tree', id: tree.id };
    occluders.push(foliage);

    const foliage2Geo = new THREE.ConeGeometry(foliageRadius * 0.8, foliageHeight * 0.7, 8);
    const foliage2 = new THREE.Mesh(foliage2Geo, foliageMat);
    foliage2.position.set(
      tree.position.x,
      trunkHeight * 1.2 + foliageHeight * 0.6,
      tree.position.z
    );
    foliage2.userData = { type: 'tree', id: tree.id };
    occluders.push(foliage2);
  });

  const parapetHeight = roof.parapetHeight;
  const parapetThickness = 0.3;

  const frontParapetGeo = new THREE.BoxGeometry(
    roof.width + parapetThickness * 2,
    parapetHeight,
    parapetThickness
  );
  const parapetMat = new THREE.MeshBasicMaterial();
  const frontParapet = new THREE.Mesh(frontParapetGeo, parapetMat);
  frontParapet.position.set(0, roof.height + parapetHeight / 2, -roof.depth / 2);
  frontParapet.userData = { type: 'parapet' };
  occluders.push(frontParapet);

  const backParapet = new THREE.Mesh(frontParapetGeo, parapetMat);
  backParapet.position.set(0, roof.height + parapetHeight / 2, roof.depth / 2);
  backParapet.userData = { type: 'parapet' };
  occluders.push(backParapet);

  const sideParapetGeo = new THREE.BoxGeometry(
    parapetThickness,
    parapetHeight,
    roof.depth
  );
  const leftParapet = new THREE.Mesh(sideParapetGeo, parapetMat);
  leftParapet.position.set(-roof.width / 2, roof.height + parapetHeight / 2, 0);
  leftParapet.userData = { type: 'parapet' };
  occluders.push(leftParapet);

  const rightParapet = new THREE.Mesh(sideParapetGeo, parapetMat);
  rightParapet.position.set(roof.width / 2, roof.height + parapetHeight / 2, 0);
  rightParapet.userData = { type: 'parapet' };
  occluders.push(rightParapet);

  return occluders;
}

export function calculatePointShadow(
  point: THREE.Vector3,
  sunDirection: THREE.Vector3,
  occluders: THREE.Object3D[],
  raycaster: THREE.Raycaster
): boolean {
  raycaster.set(point, sunDirection.clone().normalize());

  const intersects = raycaster.intersectObjects(occluders, false);

  return intersects.length > 0 && intersects[0].distance < 100;
}

export function calculateComponentShadowRate(
  component: PVComponent,
  sunPosition: SolarPosition,
  occluders: THREE.Object3D[],
  raycaster: THREE.Raycaster,
  gridSize: number = 3
): { shadowRate: number; shadowedPoints: number; totalPoints: number } {
  if (sunPosition.altitude <= 0) {
    return { shadowRate: 100, shadowedPoints: gridSize * gridSize, totalPoints: gridSize * gridSize };
  }

  const samplePoints = generateComponentSamplePoints(component, gridSize);
  const sunDirection = new THREE.Vector3(
    -sunPosition.x,
    -sunPosition.y,
    -sunPosition.z
  ).normalize();

  let shadowedCount = 0;

  samplePoints.forEach((point) => {
    if (calculatePointShadow(point, sunDirection, occluders, raycaster)) {
      shadowedCount++;
    }
  });

  return {
    shadowRate: (shadowedCount / samplePoints.length) * 100,
    shadowedPoints: shadowedCount,
    totalPoints: samplePoints.length,
  };
}

export interface ComponentShadowResult {
  componentId: string;
  shadowRate: number;
  shadowedPoints: number;
  totalPoints: number;
}

export function calculateAllComponentsShadow(
  components: PVComponent[],
  sunPosition: SolarPosition,
  trees: Tree[],
  roof: Roof
): ComponentShadowResult[] {
  const raycaster = new THREE.Raycaster();
  const occluders = createSceneOccluders(trees, roof);

  return components.map((component) => {
    const result = calculateComponentShadowRate(
      component,
      sunPosition,
      occluders,
      raycaster,
      4
    );
    return {
      componentId: component.id,
      shadowRate: result.shadowRate,
      shadowedPoints: result.shadowedPoints,
      totalPoints: result.totalPoints,
    };
  });
}

export interface MonthlyShadowData {
  month: number;
  avgShadowRate: number;
  peakShadowRate: number;
  totalShadowHours: number;
}

export function calculateMonthlyShadowData(
  component: PVComponent,
  trees: Tree[],
  roof: Roof,
  month: number,
  latitude: number = 39.9
): MonthlyShadowData {
  const { calculateSolarPosition, getSunriseSunset } = require('./solarMath');

  const day = 15;
  const { sunrise, sunset } = getSunriseSunset(month, day, latitude);
  const raycaster = new THREE.Raycaster();
  const occluders = createSceneOccluders(trees, roof);

  let totalShadowRate = 0;
  let peakShadowRate = 0;
  let shadowHours = 0;
  let sampleCount = 0;

  const stepHours = 0.5;
  for (let hour = sunrise; hour <= sunset; hour += stepHours) {
    const sunPos = calculateSolarPosition(month, day, hour, latitude);
    const result = calculateComponentShadowRate(
      component,
      sunPos,
      occluders,
      raycaster,
      3
    );

    totalShadowRate += result.shadowRate;
    peakShadowRate = Math.max(peakShadowRate, result.shadowRate);

    if (result.shadowRate > 10) {
      shadowHours += stepHours;
    }

    sampleCount++;
  }

  return {
    month,
    avgShadowRate: sampleCount > 0 ? totalShadowRate / sampleCount : 0,
    peakShadowRate,
    totalShadowHours: shadowHours,
  };
}

export function calculateFullYearShadowData(
  component: PVComponent,
  trees: Tree[],
  roof: Roof,
  latitude: number = 39.9
): MonthlyShadowData[] {
  return Array.from({ length: 12 }, (_, i) =>
    calculateMonthlyShadowData(component, trees, roof, i + 1, latitude)
  );
}
