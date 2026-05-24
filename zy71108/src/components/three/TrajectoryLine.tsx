import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Trajectory } from '../../types';

interface TrajectoryLineProps {
  trajectory: Trajectory;
  currentTime: number;
  terrainHeightmap?: number[][];
  terrainScale?: number;
}

export function TrajectoryLine({
  trajectory,
  currentTime,
  terrainHeightmap,
  terrainScale = 1
}: TrajectoryLineProps) {
  const lineRef = useRef<THREE.Line>(null);
  const skierRef = useRef<THREE.Mesh>(null);
  const progressLineRef = useRef<THREE.Line>(null);

  const { fullLineGeometry, progressLineGeometry, skierGeometry } = useMemo(() => {
    const points = trajectory.points.map(p => {
      let height = 0;
      if (terrainHeightmap && terrainHeightmap.length > 0) {
        const xIdx = Math.floor(p.x / 2);
        const zIdx = Math.floor(p.z / 2);
        if (terrainHeightmap[zIdx] && terrainHeightmap[zIdx][xIdx] !== undefined) {
          height = terrainHeightmap[zIdx][xIdx] * terrainScale * 0.5;
        }
      }
      return new THREE.Vector3(p.x, height + 1, p.z);
    });

    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
    const curvePoints = curve.getPoints(100);

    const fullLineGeometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
    const progressLineGeometry = new THREE.BufferGeometry().setFromPoints([]);
    const skierGeometry = new THREE.SphereGeometry(1.5, 16, 16);

    return { fullLineGeometry, progressLineGeometry, skierGeometry };
  }, [trajectory, terrainHeightmap, terrainScale]);

  useFrame(() => {
    const points = trajectory.points.map(p => {
      let height = 0;
      if (terrainHeightmap && terrainHeightmap.length > 0) {
        const xIdx = Math.floor(p.x / 2);
        const zIdx = Math.floor(p.z / 2);
        if (terrainHeightmap[zIdx] && terrainHeightmap[zIdx][xIdx] !== undefined) {
          height = terrainHeightmap[zIdx][xIdx] * terrainScale * 0.5;
        }
      }
      return new THREE.Vector3(p.x, height + 1, p.z);
    });

    const timestamps = trajectory.points.map(p => p.timestamp);
    const totalDuration = timestamps[timestamps.length - 1];
    
    let progress = Math.min(currentTime / totalDuration, 1);
    progress = Math.max(0, progress);

    let segmentIndex = 0;
    for (let i = 0; i < timestamps.length - 1; i++) {
      if (currentTime >= timestamps[i] && currentTime <= timestamps[i + 1]) {
        segmentIndex = i;
        break;
      }
      if (currentTime > timestamps[i + 1]) {
        segmentIndex = i + 1;
      }
    }

    const segmentProgress = segmentIndex < timestamps.length - 1
      ? (currentTime - timestamps[segmentIndex]) / (timestamps[segmentIndex + 1] - timestamps[segmentIndex])
      : 1;

    const clampedProgress = Math.max(0, Math.min(1, segmentProgress));
    const currentPos = points[Math.min(segmentIndex, points.length - 1)].clone();
    if (segmentIndex < points.length - 1) {
      currentPos.lerp(points[segmentIndex + 1], clampedProgress);
    }

    if (skierRef.current) {
      skierRef.current.position.copy(currentPos);
    }

    const progressPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= segmentIndex; i++) {
      progressPoints.push(points[i].clone());
    }
    if (segmentIndex < points.length - 1) {
      progressPoints.push(currentPos);
    }

    if (progressLineRef.current && progressPoints.length > 1) {
      const curve = new THREE.CatmullRomCurve3(progressPoints, false, 'catmullrom', 0.5);
      progressLineRef.current.geometry.dispose();
      progressLineRef.current.geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(50));
    }
  });

  return (
    <group>
      <primitive object={new THREE.Line(fullLineGeometry, new THREE.LineBasicMaterial({ color: trajectory.color, transparent: true, opacity: 0.4 }))} />
      
      <primitive object={new THREE.Line(progressLineGeometry, new THREE.LineBasicMaterial({ color: trajectory.color }))} ref={progressLineRef} />
      
      <mesh ref={skierRef} geometry={skierGeometry}>
        <meshStandardMaterial color={trajectory.color} emissive={trajectory.color} emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

export default TrajectoryLine;
