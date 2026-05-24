
import React from 'react';
import * as THREE from 'three';
import { LiftingPath } from '../../types';

interface LiftingPath3DProps {
  path: LiftingPath;
  progress: number;
  color?: string;
}

export const LiftingPath3D: React.FC<LiftingPath3DProps> = ({
  path,
  progress,
  color = '#165DFF',
}) => {
  if (path.waypoints.length < 2) return null;

  const points = path.waypoints.map((wp) => new THREE.Vector3(wp.x, wp.y, wp.z));
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
  const totalPoints = 100;
  const curvePoints = curve.getPoints(totalPoints);
  const progressIndex = Math.floor(progress * totalPoints);

  const completedPoints = curvePoints.slice(0, progressIndex + 1);
  const remainingPoints = curvePoints.slice(progressIndex);

  const completedGeometry = new THREE.BufferGeometry().setFromPoints(completedPoints);
  const remainingGeometry = new THREE.BufferGeometry().setFromPoints(remainingPoints);

  return (
    <group>
      <line>
        <bufferGeometry attach="geometry" {...completedGeometry} />
        <lineBasicMaterial attach="material" color={color} linewidth={3} opacity={1} />
      </line>

      {remainingPoints.length > 1 && (
        <line>
          <bufferGeometry attach="geometry" {...remainingGeometry} />
          <lineBasicMaterial attach="material" color={color} linewidth={2} opacity={0.4} />
        </line>
      )}

      {path.waypoints.map((wp, i) => (
        <mesh key={i} position={[wp.x, wp.y, wp.z]}>
          <sphereGeometry args={[i === 0 || i === path.waypoints.length - 1 ? 0.4 : 0.25, 16, 16]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.3}
          />
        </mesh>
      ))}

      {progress > 0 && progress < 1 && (
        <mesh position={[
          curvePoints[progressIndex]?.x || 0,
          curvePoints[progressIndex]?.y || 0,
          curvePoints[progressIndex]?.z || 0,
        ]}>
          <sphereGeometry args={[0.6, 16, 16]} />
          <meshStandardMaterial
            color="#FFD700"
            emissive="#FFD700"
            emissiveIntensity={0.5}
          />
        </mesh>
      )}
    </group>
  );
};

